import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createWorld, getArenaConfig, stepWorld } from './src/game/engine';
import { computePartyMaxLevel, getBugRosterForLevel } from './src/game/levels';
import { computeBotInput } from './src/game/ai';
import {
  AvatarId,
  BotPolicy,
  BotVariant,
  ClientWsMessage,
  MAX_MP_LEVEL,
  PlayerInput,
  RoomMemberInfo,
  RoomSnapshot,
  RoomSummary,
  ServerWsMessage,
  WorldState,
} from './src/game/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const MAX_ROOM_HUMANS = 4;
const PLAYER_COLORS = ['#22D3EE', '#FB7185', '#34D399', '#C084FC'];
const SLOT_AVATARS: AvatarId[] = ['knight', 'samurai', 'ninja', 'mage'];
const BOT_POLICIES: BotPolicy[] = ['stalker', 'trapper', 'raider'];

const PERMANENT_ROOMS: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'ODA1', name: 'Oda 1 · Zümrüt Kale' },
  { code: 'ODA2', name: 'Oda 2 · Lav Tapınağı' },
  { code: 'ODA3', name: 'Oda 3 · Buzul Zindanı' },
  { code: 'ODA4', name: 'Oda 4 · Şampiyona Arenası' },
];

interface ClientSession {
  id: string;
  ws: WebSocket;
  name: string;
  avatarId: AvatarId;
  avatarUrl?: string;
  unlockedLevel: number;
  roomCode: string | null;
  pingMs: number;
}

interface RoomMember {
  id: string;
  slot: number;
  name: string;
  color: string;
  avatarId: AvatarId;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
  botPolicy?: BotPolicy;
  botVariant?: BotVariant;
  pingMs: number;
  unlockedLevel: number;
  voiceEnabled?: boolean;
  avatarUrl?: string;
}

interface GameRoom {
  code: string;
  name: string;
  isPermanent: boolean;
  status: 'lobby' | 'countdown' | 'playing' | 'finished';
  countdown: number;
  wave: number;
  partyMaxLevel: number;
  lastMatchCleared: boolean;
  password: string | null;
  hostId: string;
  fillWithBots: boolean;
  members: RoomMember[];
  world: WorldState | null;
  inputs: Record<string, PlayerInput>;
  tickInterval: NodeJS.Timeout | null;
  countdownInterval: NodeJS.Timeout | null;
}

const clients = new Map<string, ClientSession>();
const rooms = new Map<string, GameRoom>();

for (const cfg of PERMANENT_ROOMS) {
  rooms.set(cfg.code, {
    code: cfg.code,
    name: cfg.name,
    isPermanent: true,
    status: 'lobby',
    countdown: 0,
    wave: 1,
    partyMaxLevel: 1,
    lastMatchCleared: false,
    password: null,
    hostId: '',
    fillWithBots: true,
    members: [],
    world: null,
    inputs: {},
    tickInterval: null,
    countdownInterval: null,
  });
}

function sanitizeUnlockedLevel(val: unknown): number {
  const n = Math.floor(Number(val));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_MP_LEVEL, n);
}

function recomputeRoomPartyLevel(room: GameRoom, snapToPartyMax = false): void {
  const humans = room.members.filter((m) => !m.isBot);
  if (humans.length === 0) {
    room.partyMaxLevel = 1;
    room.wave = 1;
    return;
  }
  room.partyMaxLevel = computePartyMaxLevel(
    humans.map((h) => h.unlockedLevel),
    MAX_MP_LEVEL
  );
  if (snapToPartyMax && room.status === 'lobby') {
    room.wave = room.partyMaxLevel;
  }
  room.wave = Math.max(1, Math.min(room.partyMaxLevel, room.wave));
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `O${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function sendWs(ws: WebSocket, msg: ServerWsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function getRoomSummaryList(): RoomSummary[] {
  const ordered = [
    ...PERMANENT_ROOMS.map((cfg) => rooms.get(cfg.code)!).filter(Boolean),
    ...Array.from(rooms.values()).filter((r) => !r.isPermanent),
  ];
  return ordered.map((room) => {
    const humans = room.members.filter((m) => !m.isBot);
    return {
      code: room.code,
      name: room.name,
      status: room.status,
      wave: room.wave,
      partyMaxLevel: room.partyMaxLevel,
      hasPassword: Boolean(room.password),
      humanCount: humans.length,
      maxHumans: MAX_ROOM_HUMANS,
      players: humans.map((h) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        avatarId: h.avatarId,
        isHost: h.isHost,
        unlockedLevel: h.unlockedLevel,
      })),
    };
  });
}

function broadcastRoomList(): void {
  const listMsg: ServerWsMessage = { type: 'room_list', rooms: getRoomSummaryList() };
  for (const client of clients.values()) {
    if (!client.roomCode) {
      sendWs(client.ws, listMsg);
    }
  }
}

function broadcastRoomUpdate(room: GameRoom): void {
  const snapshot: RoomSnapshot = {
    code: room.code,
    name: room.name,
    status: room.status,
    countdown: room.countdown,
    wave: room.wave,
    partyMaxLevel: room.partyMaxLevel,
    hasPassword: Boolean(room.password),
    hostId: room.hostId,
    fillWithBots: room.fillWithBots,
    maxHumans: MAX_ROOM_HUMANS,
    members: room.members.map((m): RoomMemberInfo => ({
      id: m.id,
      slot: m.slot,
      name: m.name,
      color: m.color,
      avatarId: m.avatarId,
      ready: m.ready,
      isHost: m.isHost,
      isBot: m.isBot,
      botPolicy: m.botPolicy,
      botVariant: m.botVariant,
      pingMs: m.pingMs,
      unlockedLevel: m.unlockedLevel,
      voiceEnabled: m.voiceEnabled,
      avatarUrl: m.avatarUrl,
    })),
  };

  for (const m of room.members) {
    if (m.isBot) continue;
    const session = clients.get(m.id);
    if (session) {
      sendWs(session.ws, { type: 'room_update', room: snapshot });
    }
  }
}

function broadcastToRoom(room: GameRoom, msgFactory: (memberId: string) => ServerWsMessage): void {
  for (const m of room.members) {
    if (m.isBot) continue;
    const session = clients.get(m.id);
    if (session) {
      sendWs(session.ws, msgFactory(m.id));
    }
  }
}

function stopRoomLoops(room: GameRoom): void {
  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }
}

function syncRoomBots(room: GameRoom): void {
  const humans = room.members.filter((m) => !m.isBot).slice(0, MAX_ROOM_HUMANS);
  if (humans.length > 0 && !humans.some((h) => h.id === room.hostId)) {
    room.hostId = humans[0].id;
  }

  const newMembers: RoomMember[] = humans.map((h, i) => ({
    ...h,
    slot: i,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    avatarId: h.avatarId || SLOT_AVATARS[i % SLOT_AVATARS.length],
    isHost: h.id === room.hostId,
    ready: h.id === room.hostId ? true : h.ready,
  }));

  if (room.fillWithBots && humans.length > 0) {
    const mpConfig = getArenaConfig(room.wave, false);
    const desiredBots = mpConfig.botCount;
    const roster = getBugRosterForLevel(room.wave, false, desiredBots);
    const variantColors: Record<BotVariant, string> = {
      slow: '#E11D48',
      fast: '#9333EA',
      armored: '#D97706',
      ghost: '#14B8A6',
      charger: '#EA580C',
    };
    for (let i = 0; i < desiredBots; i++) {
      const slot = newMembers.length;
      const botVariant = roster[i] ?? 'slow';
      newMembers.push({
        id: `bot_${room.code}_${slot}`,
        slot,
        name: '',
        color: variantColors[botVariant],
        avatarId: 'knight',
        ready: true,
        isHost: false,
        isBot: true,
        botPolicy: BOT_POLICIES[i % BOT_POLICIES.length],
        botVariant,
        pingMs: 0,
        unlockedLevel: 1,
      });
    }
  }

  room.members = newMembers;
}

function startRoomSimulation(room: GameRoom): void {
  stopRoomLoops(room);
  recomputeRoomPartyLevel(room, false);
  syncRoomBots(room);

  if (room.members.length < 2) {
    room.status = 'lobby';
    broadcastRoomUpdate(room);
    broadcastRoomList();
    return;
  }

  room.status = 'playing';
  room.inputs = {};
  room.world = createWorld({
    wave: room.wave,
    seed: Math.floor(Math.random() * 999999) + 1,
    isSoloMode: false,
    hasExitDoor: true,
    players: room.members.map((m) => ({
      id: m.id,
      name: m.name,
      slot: m.slot,
      isBot: m.isBot,
      botPolicy: m.botPolicy,
      botVariant: m.botVariant,
      avatarId: m.avatarId,
      avatarUrl: m.avatarUrl,
    })),
  });

  broadcastToRoom(room, (memberId) => ({
    type: 'match_started',
    world: room.world!,
    localPlayerId: memberId,
  }));
  broadcastRoomList();

  const TICK_MS = 40; // 25Hz authoritative server loop
  room.tickInterval = setInterval(() => {
    if (!room.world || room.status !== 'playing') {
      stopRoomLoops(room);
      return;
    }

    const tickInputs: Record<string, PlayerInput> = {};
    for (const p of room.world.players) {
      if (!p.alive) continue;
      if (p.isBot) {
        tickInputs[p.id] = computeBotInput(room.world, p);
      } else {
        const cur = room.inputs[p.id] ?? { dx: 0, dy: 0, placeBomb: false };
        tickInputs[p.id] = { ...cur };
        if (room.inputs[p.id]) {
          room.inputs[p.id].placeBomb = false;
        }
      }
    }

    stepWorld(room.world, tickInputs, TICK_MS / 1000);

    if (room.world.matchFinished) {
      room.status = 'finished';
      room.lastMatchCleared = room.world.endReason === 'victory';
      if (room.lastMatchCleared) {
        const nextUnlock = Math.min(MAX_MP_LEVEL, room.wave + 1);
        for (const m of room.members) {
          if (!m.isBot && m.unlockedLevel <= room.wave) {
            m.unlockedLevel = nextUnlock;
            const sess = clients.get(m.id);
            if (sess) {
              sess.unlockedLevel = Math.max(sess.unlockedLevel, nextUnlock);
            }
          }
        }
        recomputeRoomPartyLevel(room, false);
      }
      stopRoomLoops(room);
      broadcastToRoom(room, () => ({
        type: 'match_ended',
        world: room.world!,
      }));
      broadcastRoomUpdate(room);
      broadcastRoomList();
    } else {
      broadcastToRoom(room, () => ({
        type: 'world_state',
        world: room.world!,
      }));
    }
  }, TICK_MS);
}

function removeClientFromRoom(session: ClientSession): void {
  if (!session.roomCode) return;
  const room = rooms.get(session.roomCode);
  session.roomCode = null;
  if (!room) return;

  room.members = room.members.filter((m) => m.id !== session.id);
  const remainingHumans = room.members.filter((m) => !m.isBot);

  if (remainingHumans.length === 0) {
    stopRoomLoops(room);
    if (!room.isPermanent) {
      rooms.delete(room.code);
      broadcastRoomList();
      return;
    }
    room.status = 'lobby';
    room.wave = 1;
    room.partyMaxLevel = 1;
    room.lastMatchCleared = false;
    room.hostId = '';
    room.password = null;
    room.fillWithBots = true;
    room.members = [];
    room.world = null;
    room.inputs = {};
    broadcastRoomList();
    return;
  }

  if (room.hostId === session.id) {
    room.hostId = remainingHumans[0].id;
    remainingHumans[0].isHost = true;
    remainingHumans[0].ready = true;
  }

  recomputeRoomPartyLevel(room, room.status === 'lobby');
  if (room.status === 'lobby') {
    syncRoomBots(room);
  }
  broadcastRoomUpdate(room);
  broadcastRoomList();
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, clients: clients.size });
  });

  // Gemini Nano Banana 2.1: Generate image from text prompt
  app.post('/api/images/generate', async (req, res) => {
    try {
      const { prompt, aspectRatio = '1:1', imageSize = '1K' } = req.body ?? {};
      if (typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Lütfen geçerli bir görsel açıklaması (prompt) girin.' });
        return;
      }

      const validRatios = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
      const validSizes = new Set(['1K', '2K']);
      const safeRatio = validRatios.has(aspectRatio) ? aspectRatio : '1:1';
      const safeSize = validSizes.has(imageSize) ? imageSize : '1K';

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: {
          parts: [{ text: prompt.trim() }],
        },
        config: {
          imageConfig: {
            aspectRatio: safeRatio,
            imageSize: safeSize,
          },
        },
      });

      let imageUrl: string | null = null;
      let textNote = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textNote += part.text;
        }
      }

      if (!imageUrl) {
        res.status(502).json({
          error: 'Model görsel döndürmedi. Lütfen farklı bir açıklama ile tekrar deneyin.',
          details: textNote || undefined,
        });
        return;
      }

      res.json({ imageUrl, note: textNote });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Görsel oluşturulurken sunucu hatası oluştu.';
      console.error('Gemini image generate error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  // Gemini Nano Banana 2.1: Edit image with text prompt
  app.post('/api/images/edit', async (req, res) => {
    try {
      const { prompt, imageDataUrl, aspectRatio = '1:1', imageSize = '1K' } = req.body ?? {};
      if (typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Lütfen düzenleme talimatını girin.' });
        return;
      }
      if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        res.status(400).json({ error: 'Düzenlenecek geçerli bir görsel seçin veya yükleyin.' });
        return;
      }

      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: 'Görsel verisi okunamadı (base64 formatı geçersiz).' });
        return;
      }

      const mimeType = match[1];
      const base64Data = match[2];

      const validRatios = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
      const validSizes = new Set(['1K', '2K']);
      const safeRatio = validRatios.has(aspectRatio) ? aspectRatio : '1:1';
      const safeSize = validSizes.has(imageSize) ? imageSize : '1K';

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: prompt.trim(),
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: safeRatio,
            imageSize: safeSize,
          },
        },
      });

      let imageUrl: string | null = null;
      let textNote = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textNote += part.text;
        }
      }

      if (!imageUrl) {
        res.status(502).json({
          error: 'Düzenlenen görsel oluşturulamadı. Lütfen talimatı netleştirin.',
          details: textNote || undefined,
        });
        return;
      }

      res.json({ imageUrl, note: textNote });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Görsel düzenlenirken sunucu hatası oluştu.';
      console.error('Gemini image edit error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  const server = http.createServer(app);

  // WebSocket Multiplayer Server on /ws
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    const clientId = generateId('usr');
    const session: ClientSession = {
      id: clientId,
      ws,
      name: 'Oyuncu',
      avatarId: 'knight',
      unlockedLevel: 1,
      roomCode: null,
      pingMs: 0,
    };
    clients.set(clientId, session);
    sendWs(ws, { type: 'welcome', clientId });
    sendWs(ws, { type: 'room_list', rooms: getRoomSummaryList() });

    ws.on('message', (raw) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientWsMessage;
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        sendWs(ws, { type: 'pong', ts: msg.ts });
        return;
      }

      if (msg.type === 'list_rooms') {
        sendWs(ws, { type: 'room_list', rooms: getRoomSummaryList() });
        return;
      }

      if (msg.type === 'sync_mp_progress') {
        session.unlockedLevel = sanitizeUnlockedLevel(msg.unlockedLevel);
        if (session.roomCode) {
          const r = rooms.get(session.roomCode);
          const m = r?.members.find((mem) => mem.id === session.id);
          if (r && m) {
            m.unlockedLevel = session.unlockedLevel;
            recomputeRoomPartyLevel(r, r.status === 'lobby');
            if (r.status === 'lobby') syncRoomBots(r);
            broadcastRoomUpdate(r);
            broadcastRoomList();
          }
        }
        return;
      }

      if (msg.type === 'create_room') {
        removeClientFromRoom(session);
        const code = generateRoomCode();
        const cleanName = (msg.name || 'Oyuncu').trim().slice(0, 16) || 'Oyuncu';
        const chosenAvatar: AvatarId = SLOT_AVATARS.includes(msg.avatarId as AvatarId)
          ? (msg.avatarId as AvatarId)
          : SLOT_AVATARS[0];
        const cleanRoomName = (msg.roomName || '').trim().slice(0, 28) || `${cleanName} Odası`;
        const cleanPassword = (msg.password || '').trim().slice(0, 24) || null;
        const unlockedLevel = sanitizeUnlockedLevel(msg.unlockedLevel);

        session.name = cleanName;
        session.avatarId = chosenAvatar;
        session.avatarUrl = msg.avatarUrl;
        session.unlockedLevel = unlockedLevel;
        session.roomCode = code;

        const newRoom: GameRoom = {
          code,
          name: cleanRoomName,
          isPermanent: false,
          status: 'lobby',
          countdown: 0,
          wave: unlockedLevel,
          partyMaxLevel: unlockedLevel,
          lastMatchCleared: false,
          password: cleanPassword,
          hostId: session.id,
          fillWithBots: true,
          members: [
            {
              id: session.id,
              slot: 0,
              name: cleanName,
              color: PLAYER_COLORS[0],
              avatarId: chosenAvatar,
              ready: true,
              isHost: true,
              isBot: false,
              pingMs: session.pingMs,
              unlockedLevel,
              voiceEnabled: false,
              avatarUrl: msg.avatarUrl,
            },
          ],
          world: null,
          inputs: {},
          tickInterval: null,
          countdownInterval: null,
        };
        rooms.set(code, newRoom);
        syncRoomBots(newRoom);
        broadcastRoomUpdate(newRoom);
        broadcastRoomList();
        return;
      }

      if (msg.type === 'join_room') {
        const targetCode = (msg.code || '').trim().toUpperCase();
        const room = rooms.get(targetCode);
        if (!room) {
          sendWs(ws, { type: 'room_error', message: `"${targetCode}" kodlu bir oda bulunamadı.` });
          return;
        }
        if (room.status === 'playing' || room.status === 'countdown') {
          sendWs(ws, { type: 'room_error', message: 'Bu odadaki maç şu anda devam ediyor.' });
          return;
        }
        const alreadyInRoom = room.members.some((m) => m.id === session.id);
        if (alreadyInRoom) {
          broadcastRoomUpdate(room);
          return;
        }
        const humanCount = room.members.filter((m) => !m.isBot).length;
        if (humanCount >= MAX_ROOM_HUMANS) {
          sendWs(ws, { type: 'room_error', message: 'Oda dolu (en fazla 4 kişi oynayabilir).' });
          return;
        }
        if (room.password && room.password !== (msg.password ?? '').trim()) {
          sendWs(ws, { type: 'room_error', message: 'Oda şifresi hatalı!' });
          return;
        }

        removeClientFromRoom(session);
        const cleanName = (msg.name || 'Oyuncu').trim().slice(0, 16) || 'Oyuncu';
        const chosenAvatar: AvatarId = SLOT_AVATARS.includes(msg.avatarId as AvatarId)
          ? (msg.avatarId as AvatarId)
          : SLOT_AVATARS[humanCount % SLOT_AVATARS.length];
        const unlockedLevel = sanitizeUnlockedLevel(msg.unlockedLevel);

        session.name = cleanName;
        session.avatarId = chosenAvatar;
        session.avatarUrl = msg.avatarUrl;
        session.unlockedLevel = unlockedLevel;
        session.roomCode = room.code;

        const isFirstHuman = room.members.filter((m) => !m.isBot).length === 0;
        if (isFirstHuman) {
          room.hostId = session.id;
        }

        room.members.push({
          id: session.id,
          slot: humanCount,
          name: cleanName,
          color: PLAYER_COLORS[humanCount % PLAYER_COLORS.length],
          avatarId: chosenAvatar,
          ready: isFirstHuman,
          isHost: isFirstHuman,
          isBot: false,
          pingMs: session.pingMs,
          unlockedLevel,
          voiceEnabled: false,
          avatarUrl: msg.avatarUrl,
        });
        recomputeRoomPartyLevel(room, true);
        syncRoomBots(room);
        broadcastRoomUpdate(room);
        broadcastRoomList();
        return;
      }

      if (msg.type === 'leave_room') {
        removeClientFromRoom(session);
        sendWs(ws, { type: 'room_list', rooms: getRoomSummaryList() });
        return;
      }

      const room = session.roomCode ? rooms.get(session.roomCode) : undefined;
      if (!room) return;

      if (msg.type === 'set_ready') {
        const member = room.members.find((m) => m.id === session.id);
        if (member) {
          member.ready = member.isHost ? true : msg.ready;
          broadcastRoomUpdate(room);
        }
        return;
      }

      if (msg.type === 'set_mp_wave') {
        if (room.hostId !== session.id || room.status !== 'lobby') return;
        const requested = Math.floor(Number(msg.wave));
        if (!Number.isFinite(requested) || requested < 1) return;
        recomputeRoomPartyLevel(room, false);
        if (requested > room.partyMaxLevel) {
          sendWs(ws, {
            type: 'room_error',
            message: `Gruptaki en düşük seviyeli arkadaş en fazla Seviye ${room.partyMaxLevel} oynayabilir.`,
          });
          return;
        }
        room.wave = requested;
        syncRoomBots(room);
        broadcastRoomUpdate(room);
        broadcastRoomList();
        return;
      }

      if (msg.type === 'set_room_password') {
        if (room.hostId !== session.id) return;
        room.password = (msg.password || '').trim().slice(0, 24) || null;
        broadcastRoomUpdate(room);
        broadcastRoomList();
        return;
      }

      if (msg.type === 'kick_member') {
        if (room.hostId !== session.id) return;
        if (msg.targetId === session.id) return;
        const targetMember = room.members.find((m) => m.id === msg.targetId && !m.isBot);
        if (!targetMember) return;

        room.members = room.members.filter((m) => m.id !== msg.targetId);
        const targetSession = clients.get(msg.targetId);
        if (targetSession) {
          targetSession.roomCode = null;
          sendWs(targetSession.ws, {
            type: 'kicked',
            message: 'Oda yetkilisi tarafından odadan çıkarıldınız.',
          });
          sendWs(targetSession.ws, { type: 'room_list', rooms: getRoomSummaryList() });
        }

        recomputeRoomPartyLevel(room, room.status === 'lobby');
        if (room.status === 'lobby') {
          syncRoomBots(room);
        }
        broadcastRoomUpdate(room);
        broadcastRoomList();
        return;
      }

      if (msg.type === 'toggle_fill_bots') {
        if (room.hostId !== session.id || room.status !== 'lobby') return;
        room.fillWithBots = msg.fillWithBots;
        syncRoomBots(room);
        broadcastRoomUpdate(room);
        return;
      }

      if (msg.type === 'start_match') {
        if (room.hostId !== session.id) return;
        const humans = room.members.filter((m) => !m.isBot);
        const allReady = humans.every((h) => h.ready || h.isHost);
        if (!allReady) {
          sendWs(ws, { type: 'room_error', message: 'Tüm oyuncular hazır olmadan maç başlatılamaz.' });
          return;
        }
        if (!room.fillWithBots && humans.length < 2) {
          sendWs(ws, {
            type: 'room_error',
            message: 'Tek başınıza başlamak için Böcekleri açın veya arkadaşınızı bekleyin.',
          });
          return;
        }
        startRoomSimulation(room);
        return;
      }

      if (msg.type === 'start_next_wave') {
        if (room.hostId !== session.id) return;
        if (room.status === 'finished') {
          recomputeRoomPartyLevel(room, false);
          room.wave = room.partyMaxLevel;
          room.lastMatchCleared = false;
          for (const m of room.members) {
            if (!m.isBot) m.ready = true;
          }
          startRoomSimulation(room);
        }
        return;
      }

      if (msg.type === 'rematch') {
        if (room.status === 'finished') {
          recomputeRoomPartyLevel(room, false);
          room.wave = room.partyMaxLevel;
          room.lastMatchCleared = false;
          stopRoomLoops(room);
          room.status = 'lobby';
          room.world = null;
          for (const m of room.members) {
            if (!m.isBot) m.ready = m.isHost;
          }
          syncRoomBots(room);
          broadcastRoomUpdate(room);
          broadcastRoomList();
        } else if (room.status === 'lobby') {
          broadcastRoomUpdate(room);
        }
        return;
      }

      if (msg.type === 'voice_state') {
        const member = room.members.find((m) => m.id === session.id);
        if (member) {
          member.voiceEnabled = Boolean(msg.enabled);
          broadcastRoomUpdate(room);
        }
        return;
      }

      if (msg.type === 'rtc_signal') {
        const targetSession = clients.get(msg.targetId);
        if (targetSession && targetSession.roomCode === room.code) {
          sendWs(targetSession.ws, {
            type: 'rtc_signal',
            fromId: session.id,
            signal: msg.signal,
          });
        }
        return;
      }

      if (msg.type === 'player_input') {
        if (room.status !== 'playing') return;
        const prev = room.inputs[session.id] ?? { dx: 0, dy: 0, placeBomb: false };
        room.inputs[session.id] = {
          dx: Math.max(-1, Math.min(1, msg.input.dx || 0)),
          dy: Math.max(-1, Math.min(1, msg.input.dy || 0)),
          placeBomb: prev.placeBomb || Boolean(msg.input.placeBomb),
        };
      }
    });

    ws.on('close', () => {
      removeClientFromRoom(session);
      clients.delete(clientId);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Bomberman Mobil Arena server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
