import React, { useCallback, useEffect, useRef, useState } from 'react';
import { computeBotInput } from './game/ai';
import { gameAudio } from './game/audio';
import { createWorld, getSoloLevelConfig, stepWorld } from './game/engine';
import {
  DeviceLevelProgress,
  buildProgressFromHighestUnlocked,
  canPlayLevel,
  normalizeLevelProgress,
  recordLevelCompletion,
} from './game/levels';
import { BombermanRenderer } from './game/renderer';
import {
  AvatarId,
  BotPolicy,
  ClientWsMessage,
  MAX_MP_LEVEL,
  MAX_SOLO_LEVEL,
  MatchSummary,
  PlayerInput,
  RoomSnapshot,
  RoomSummary,
  ServerWsMessage,
  UiScreenState,
  WorldState,
} from './game/types';
import {
  CloudPlayerProfile,
  observeAuthChanges,
  signInWithGooglePlay,
  signOutGooglePlay,
  subscribePlayerProfile,
  syncPlayerProfileToCloud,
} from './firebase/client';
import type { User } from 'firebase/auth';
import { GameHud } from './components/GameHud';
import { OfflineIndicator } from './components/MobilePwaBar';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { SettingsModal } from './components/SettingsModal';
import { SoloCampaignMap } from './components/SoloCampaignMap';
import { SplashPreloader } from './components/SplashPreloader';
import { GameOverModal, PauseModal } from './components/StatusModals';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { useVoiceChat } from './hooks/useVoiceChat';

const BEST_SCORE_KEY = 'bomberman_best_score_v1';
const SOLO_PROGRESS_KEY = 'bomberman_solo_progress_v1';
const MP_PROGRESS_KEY = 'bomberman_mp_progress_v1';
const PLAYER_NAME_KEY = 'bomberman_player_name_v1';
const AVATAR_ID_KEY = 'bomberman_avatar_id_v1';

function loadDeviceProgress(storageKey: string, maxCap: number): DeviceLevelProgress {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { highestUnlocked: 1, completed: [] };
    const parsed = JSON.parse(raw) as Partial<DeviceLevelProgress>;
    return normalizeLevelProgress(parsed, maxCap);
  } catch {
    return { highestUnlocked: 1, completed: [] };
  }
}

function buildMatchSummary(
  world: WorldState,
  localPlayerId: string,
  bestScore: number,
  isMultiplayer: boolean
): MatchSummary {
  const local = world.players.find((p) => p.id === localPlayerId) ?? world.players[0];
  const winner = world.winnerId ? world.players.find((p) => p.id === world.winnerId) ?? null : null;
  const hasBots = world.players.some((p) => p.isBot);
  const teamCleared = isMultiplayer && hasBots && world.endReason === 'victory';
  const reviveNextLevel = Boolean(teamCleared && local && !local.alive);
  const won = Boolean((winner && winner.id === localPlayerId) || teamCleared);
  const isDraw = world.winnerId === null;

  return {
    won,
    teamCleared,
    reviveNextLevel,
    isDraw,
    endReason: world.endReason ?? (won ? 'victory' : isDraw ? 'draw' : 'defeat'),
    winnerName: winner?.name ?? null,
    winnerId: world.winnerId,
    localPlayerId,
    score: local?.score ?? 0,
    bestScore: Math.max(bestScore, local?.score ?? 0),
    kills: local?.kills ?? 0,
    maxCombo: local?.maxCombo ?? 0,
    foundDoor: Boolean(world.exitDoor?.revealed && world.endReason === 'victory'),
    cratesBroken: local?.cratesBroken ?? 0,
    elapsedSeconds: world.elapsedTime,
    wave: world.wave,
    isMultiplayer,
    standings: [...world.players]
      .sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score)
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        avatarId: p.avatarId,
        alive: p.alive,
        kills: p.kills,
        score: p.score,
        isBot: p.isBot,
      })),
  };
}

export default function App() {
  const [screen, setScreen] = useState<UiScreenState>('TITLE_MENU');
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(BEST_SCORE_KEY) || '0') || 0;
    } catch {
      return 0;
    }
  });
  const [soloProgress, setSoloProgress] = useState<DeviceLevelProgress>(() =>
    loadDeviceProgress(SOLO_PROGRESS_KEY, MAX_SOLO_LEVEL)
  );
  const [mpProgress, setMpProgress] = useState<DeviceLevelProgress>(() =>
    loadDeviceProgress(MP_PROGRESS_KEY, MAX_MP_LEVEL)
  );
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(PLAYER_NAME_KEY)?.trim();
      return saved ? saved.slice(0, 16) : 'Oyuncu 1';
    } catch {
      return 'Oyuncu 1';
    }
  });
  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>(() => {
    try {
      const saved = localStorage.getItem(AVATAR_ID_KEY);
      if (saved === 'knight' || saved === 'samurai' || saved === 'ninja' || saved === 'mage') {
        return saved;
      }
      return 'knight';
    } catch {
      return 'knight';
    }
  });
  const [splashDone, setSplashDone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [cloudProfile, setCloudProfile] = useState<CloudPlayerProfile | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(true);

  // Multiplayer WebSocket states
  const [wsConnected, setWsConnected] = useState(false);
  const [wsClientId, setWsClientId] = useState('');
  const [pingMs, setPingMs] = useState(0);
  const [roomList, setRoomList] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [initialJoinCode, setInitialJoinCode] = useState('');

  // Discrete HUD & End-of-Run Snapshots
  const [hudWorld, setHudWorld] = useState<WorldState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState('p1');
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);

  // Refs for 60fps loop isolation
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<BombermanRenderer | null>(null);
  const worldRef = useRef<WorldState | null>(null);
  const screenRef = useRef<UiScreenState>('TITLE_MENU');
  const isMultiplayerRef = useRef(false);
  const localPlayerIdRef = useRef('p1');
  const bestScoreRef = useRef(bestScore);
  const soloProgressRef = useRef(soloProgress);
  const mpProgressRef = useRef(mpProgress);
  const playerNameRef = useRef(playerName);
  const selectedAvatarIdRef = useRef(selectedAvatarId);
  const googleUserRef = useRef(googleUser);
  const cloudProfileRef = useRef(cloudProfile);
  const hydratedCloudAvatarRef = useRef(false);
  const showTouchRef = useRef(showTouchControls);
  const wsRef = useRef<WebSocket | null>(null);

  // Unified Keyboard + Touch input state
  const heldKeysRef = useRef<Set<string>>(new Set());
  const touchInputRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const bombQueuedRef = useRef(false);
  const lastWsSendRef = useRef(0);

  screenRef.current = screen;
  isMultiplayerRef.current = isMultiplayer;
  localPlayerIdRef.current = localPlayerId;
  bestScoreRef.current = bestScore;
  soloProgressRef.current = soloProgress;
  mpProgressRef.current = mpProgress;
  playerNameRef.current = playerName;
  selectedAvatarIdRef.current = selectedAvatarId;
  googleUserRef.current = googleUser;
  cloudProfileRef.current = cloudProfile;
  showTouchRef.current = showTouchControls;

  // Sync document.body.dataset.state for deterministic state inspection
  useEffect(() => {
    const mapped =
      screen === 'TITLE_MENU' || screen === 'SOLO_MAP' || screen === 'MULTIPLAYER_LOBBY'
        ? 'title'
        : screen === 'PLAYING'
          ? 'playing'
          : screen === 'PAUSED'
            ? 'paused'
            : 'gameover';
    document.body.dataset.state = mapped;
  }, [screen]);

  // Initialize canvas renderer once
  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = new BombermanRenderer();
    }
  }, []);

  const pushCloudSync = useCallback(
    (deltas?: { deltaMatches?: number; deltaWins?: number; deltaKills?: number; avatarOverride?: AvatarId }) => {
      const user = googleUserRef.current;
      if (!user) return;
      void syncPlayerProfileToCloud(
        user,
        {
          displayName: playerNameRef.current,
          avatarId: deltas?.avatarOverride ?? selectedAvatarIdRef.current,
          bestScore: bestScoreRef.current,
          soloHighestUnlocked: soloProgressRef.current.highestUnlocked,
          mpHighestUnlocked: mpProgressRef.current.highestUnlocked,
          deltaMatches: deltas?.deltaMatches,
          deltaWins: deltas?.deltaWins,
          deltaKills: deltas?.deltaKills,
        },
        cloudProfileRef.current
      )
        .then((saved) => {
          cloudProfileRef.current = saved;
          setCloudProfile(saved);
        })
        .catch((err) => {
          console.error('Cloud sync failed:', err);
        });
    },
    []
  );

  // Observe Google Play / Firebase Auth session and subscribe to cloud profile
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubAuth = observeAuthChanges((user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      setGoogleUser(user);
      googleUserRef.current = user;
      setAuthError(null);

      if (!user) {
        setCloudProfile(null);
        cloudProfileRef.current = null;
        hydratedCloudAvatarRef.current = false;
        return;
      }

      if (user.displayName && (playerNameRef.current === 'Oyuncu 1' || !playerNameRef.current.trim())) {
        const cleanName = user.displayName.trim().slice(0, 16);
        if (cleanName) {
          setPlayerName(cleanName);
          playerNameRef.current = cleanName;
        }
      }

      unsubProfile = subscribePlayerProfile(
        user.uid,
        (profile) => {
          if (!profile) {
            void syncPlayerProfileToCloud(
              user,
              {
                displayName: user.displayName || playerNameRef.current,
                avatarId: selectedAvatarIdRef.current,
                bestScore: bestScoreRef.current,
                soloHighestUnlocked: soloProgressRef.current.highestUnlocked,
                mpHighestUnlocked: mpProgressRef.current.highestUnlocked,
              },
              null
            )
              .then((created) => {
                cloudProfileRef.current = created;
                setCloudProfile(created);
              })
              .catch((err) => {
                setAuthError(err instanceof Error ? err.message : 'Bulut profili oluşturulamadı.');
              });
            return;
          }

          cloudProfileRef.current = profile;
          setCloudProfile(profile);

          const mergedBest = Math.max(bestScoreRef.current, profile.bestScore);
          if (mergedBest !== bestScoreRef.current) {
            bestScoreRef.current = mergedBest;
            setBestScore(mergedBest);
            try {
              localStorage.setItem(BEST_SCORE_KEY, String(mergedBest));
            } catch {
              // ignore
            }
          }

          const mergedSoloLevel = Math.max(
            soloProgressRef.current.highestUnlocked,
            profile.soloHighestUnlocked
          );
          if (mergedSoloLevel !== soloProgressRef.current.highestUnlocked) {
            const nextSolo = buildProgressFromHighestUnlocked(mergedSoloLevel, MAX_SOLO_LEVEL);
            soloProgressRef.current = nextSolo;
            setSoloProgress(nextSolo);
            try {
              localStorage.setItem(SOLO_PROGRESS_KEY, JSON.stringify(nextSolo));
            } catch {
              // ignore
            }
          }

          const mergedMpLevel = Math.max(
            mpProgressRef.current.highestUnlocked,
            profile.mpHighestUnlocked
          );
          if (mergedMpLevel !== mpProgressRef.current.highestUnlocked) {
            const nextMp = buildProgressFromHighestUnlocked(mergedMpLevel, MAX_MP_LEVEL);
            mpProgressRef.current = nextMp;
            setMpProgress(nextMp);
            try {
              localStorage.setItem(MP_PROGRESS_KEY, JSON.stringify(nextMp));
            } catch {
              // ignore
            }
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'sync_mp_progress',
                  unlockedLevel: nextMp.highestUnlocked,
                })
              );
            }
          }

          if (!hydratedCloudAvatarRef.current) {
            hydratedCloudAvatarRef.current = true;
            setSelectedAvatarId(profile.avatarId);
            selectedAvatarIdRef.current = profile.avatarId;
            if (profile.displayName) {
              const shortName = profile.displayName.slice(0, 16);
              setPlayerName(shortName);
              playerNameRef.current = shortName;
            }
          }

          // If local device had higher progress than cloud, sync back up once
          if (
            bestScoreRef.current > profile.bestScore ||
            soloProgressRef.current.highestUnlocked > profile.soloHighestUnlocked ||
            mpProgressRef.current.highestUnlocked > profile.mpHighestUnlocked
          ) {
            void syncPlayerProfileToCloud(
              user,
              {
                displayName: profile.displayName || playerNameRef.current,
                avatarId: selectedAvatarIdRef.current,
                bestScore: bestScoreRef.current,
                soloHighestUnlocked: soloProgressRef.current.highestUnlocked,
                mpHighestUnlocked: mpProgressRef.current.highestUnlocked,
              },
              profile
            ).catch(() => {});
          }
        },
        (err) => {
          setAuthError(err.message);
        }
      );
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubAuth();
    };
  }, []);

  const handleConnectGoogle = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGooglePlay();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Google Play bağlantısı tamamlanamadı. Tekrar deneyin.');
      }
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const handleDisconnectGoogle = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOutGooglePlay();
    } catch {
      setAuthError('Hesaptan çıkış yapılamadı.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const handleSaveProfileSettings = useCallback(
    (nextName: string, nextAvatar: AvatarId) => {
      const cleaned = nextName.trim().slice(0, 16) || 'Oyuncu 1';
      setPlayerName(cleaned);
      playerNameRef.current = cleaned;
      setSelectedAvatarId(nextAvatar);
      selectedAvatarIdRef.current = nextAvatar;
      try {
        localStorage.setItem(PLAYER_NAME_KEY, cleaned);
        localStorage.setItem(AVATAR_ID_KEY, nextAvatar);
      } catch {
        // ignore
      }
      pushCloudSync({ avatarOverride: nextAvatar });
    },
    [pushCloudSync]
  );

  const startSoloWave = useCallback((waveNum = 1, carryScore = 0) => {
    const requestedWave = Math.min(MAX_SOLO_LEVEL, Math.max(1, Math.floor(waveNum)));
    if (!canPlayLevel(requestedWave, soloProgressRef.current, MAX_SOLO_LEVEL)) {
      return;
    }

    heldKeysRef.current.clear();
    touchInputRef.current = { dx: 0, dy: 0 };
    bombQueuedRef.current = false;

    const levelCfg = getSoloLevelConfig(requestedWave);
    const botPolicies: BotPolicy[] = ['stalker', 'trapper', 'raider'];

    const botPlayers = Array.from({ length: levelCfg.botCount }, (_, i) => ({
      id: `b${i + 1}`,
      name: '',
      slot: i + 1,
      isBot: true,
      botPolicy: botPolicies[i % botPolicies.length],
      avatarId: 'knight' as AvatarId,
    }));

    const newWorld = createWorld({
      wave: requestedWave,
      seed: Date.now() & 0x7fffffff,
      isSoloMode: true,
      players: [
        {
          id: 'p1',
          name: playerName.trim() || 'Sen',
          slot: 0,
          isBot: false,
          avatarId: selectedAvatarId,
        },
        ...botPlayers,
      ],
    });
    if (carryScore > 0 && newWorld.players[0]) {
      newWorld.players[0].score = carryScore;
    }

    worldRef.current = newWorld;
    setLocalPlayerId('p1');
    localPlayerIdRef.current = 'p1';
    setIsMultiplayer(false);
    isMultiplayerRef.current = false;
    setMatchSummary(null);
    setHudWorld({ ...newWorld });
    setScreen('PLAYING');
    document.body.dataset.state = 'playing';

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    canvasRef.current?.focus();
  }, [playerName, selectedAvatarId]);

  const sendWsMessage = useCallback((msg: ClientWsMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const {
    micEnabled,
    voiceError,
    toggleMic,
    handleIncomingSignal,
    stopLocalMic,
  } = useVoiceChat({
    clientId: wsClientId,
    room,
    sendWsMessage,
  });

  const handleIncomingSignalRef = useRef(handleIncomingSignal);
  handleIncomingSignalRef.current = handleIncomingSignal;

  const ensureWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'list_rooms' }));
      }
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setRoomError(null);
      ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      ws.send(
        JSON.stringify({
          type: 'sync_mp_progress',
          unlockedLevel: mpProgressRef.current.highestUnlocked,
        })
      );
      ws.send(JSON.stringify({ type: 'list_rooms' }));
    };

    ws.onmessage = (ev) => {
      let msg: ServerWsMessage;
      try {
        msg = JSON.parse(ev.data) as ServerWsMessage;
      } catch {
        return;
      }

      if (msg.type === 'welcome') {
        setWsClientId(msg.clientId);
      } else if (msg.type === 'pong') {
        setPingMs(Math.max(1, Date.now() - msg.ts));
      } else if (msg.type === 'room_list') {
        setRoomList(msg.rooms);
      } else if (msg.type === 'room_error') {
        setRoomError(msg.message);
      } else if (msg.type === 'kicked') {
        setRoom(null);
        setRoomError(msg.message);
        worldRef.current = null;
        setScreen('MULTIPLAYER_LOBBY');
      } else if (msg.type === 'rtc_signal') {
        void handleIncomingSignalRef.current(msg.fromId, msg.signal);
      } else if (msg.type === 'room_update') {
        setRoom(msg.room);
        setRoomError(null);
      } else if (msg.type === 'match_started') {
        heldKeysRef.current.clear();
        touchInputRef.current = { dx: 0, dy: 0 };
        bombQueuedRef.current = false;

        worldRef.current = msg.world;
        setLocalPlayerId(msg.localPlayerId);
        localPlayerIdRef.current = msg.localPlayerId;
        setIsMultiplayer(true);
        isMultiplayerRef.current = true;
        setMatchSummary(null);
        setHudWorld(msg.world);
        setScreen('PLAYING');
        document.body.dataset.state = 'playing';
      } else if (msg.type === 'world_state') {
        worldRef.current = msg.world;
        if (msg.world.events?.length) {
          rendererRef.current?.ingestEvents(msg.world.events);
          gameAudio.handleEvents(msg.world.events);
        }
      } else if (msg.type === 'match_ended') {
        worldRef.current = msg.world;
        const summary = buildMatchSummary(
          msg.world,
          localPlayerIdRef.current,
          bestScoreRef.current,
          true
        );
        if (summary.bestScore > bestScoreRef.current) {
          bestScoreRef.current = summary.bestScore;
          setBestScore(summary.bestScore);
          try {
            localStorage.setItem(BEST_SCORE_KEY, String(summary.bestScore));
          } catch {
            // ignore
          }
        }
        const mpCleared = Boolean(summary.teamCleared || summary.won);
        if (mpCleared) {
          gameAudio.playVictory();
          const nextMp = recordLevelCompletion(
            mpProgressRef.current,
            msg.world.wave,
            MAX_MP_LEVEL
          );
          mpProgressRef.current = nextMp;
          setMpProgress(nextMp);
          try {
            localStorage.setItem(MP_PROGRESS_KEY, JSON.stringify(nextMp));
          } catch {
            // ignore
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'sync_mp_progress',
                unlockedLevel: nextMp.highestUnlocked,
              })
            );
          }
        } else {
          gameAudio.playDefeat();
        }
        pushCloudSync({
          deltaMatches: 1,
          deltaWins: mpCleared ? 1 : 0,
          deltaKills: summary.kills,
        });
        setMatchSummary(summary);
        setHudWorld(msg.world);
        setScreen('GAME_OVER');
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };
  }, []);

  // Periodic RTT ping when WebSocket is open
  useEffect(() => {
    const timer = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // Handle ?autostart=1 and ?room=XXXXXX on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInitialJoinCode(roomParam.toUpperCase().slice(0, 6));
      ensureWebSocket();
      setScreen('MULTIPLAYER_LOBBY');
      return;
    }
    if (params.get('autostart') === '1') {
      startSoloWave(1, 0);
    }
  }, [ensureWebSocket, startSoloWave]);

  // Responsive check for mobile viewport resize
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768) {
        setShowTouchControls(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Keyboard bindings & focus-loss hygiene
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      if (code === 'KeyM' && !e.repeat) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          const muted = gameAudio.toggleMute();
          setIsMuted(muted);
          return;
        }
      }

      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        if (screenRef.current === 'PLAYING') {
          e.preventDefault();
          heldKeysRef.current.clear();
          setScreen('PAUSED');
          return;
        }
        if (screenRef.current === 'PAUSED') {
          e.preventDefault();
          setScreen('PLAYING');
          return;
        }
      }

      if (screenRef.current !== 'PLAYING') return;

      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'KeyW' ||
        code === 'KeyA' ||
        code === 'KeyS' ||
        code === 'KeyD'
      ) {
        e.preventDefault();
        heldKeysRef.current.add(code);
      }

      if ((code === 'Space' || code === 'Enter') && !e.repeat) {
        e.preventDefault();
        bombQueuedRef.current = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.code);
    };

    const clearAllInputs = () => {
      heldKeysRef.current.clear();
      touchInputRef.current = { dx: 0, dy: 0 };
      bombQueuedRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAllInputs);
    document.addEventListener('visibilitychange', clearAllInputs);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAllInputs);
      document.removeEventListener('visibilitychange', clearAllInputs);
    };
  }, []);

  const readCurrentLocalInput = useCallback((): PlayerInput => {
    const keys = heldKeysRef.current;
    let dx = touchInputRef.current.dx;
    let dy = touchInputRef.current.dy;

    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;

    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));

    const placeBomb = bombQueuedRef.current;
    bombQueuedRef.current = false;

    return { dx, dy, placeBomb };
  }, []);

  // Isolated 60fps Canvas Simulation & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!rendererRef.current) {
      rendererRef.current = new BombermanRenderer();
    }

    const syncCanvasSize = () => {
      const stage = stageRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(320, stage?.clientWidth || window.innerWidth);
      const h = Math.max(240, stage?.clientHeight || window.innerHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && stageRef.current
        ? new ResizeObserver(() => syncCanvasSize())
        : null;
    if (resizeObserver && stageRef.current) {
      resizeObserver.observe(stageRef.current);
    }

    let rafId = 0;
    let lastTime = performance.now();
    let hudSyncAccum = 0;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const curScreen = screenRef.current;
      const world = worldRef.current;
      const renderer = rendererRef.current!;

      if (world && (curScreen === 'PLAYING' || curScreen === 'PAUSED' || curScreen === 'GAME_OVER')) {
        if (curScreen === 'PLAYING') {
          if (isMultiplayerRef.current) {
            // Send input to server at 25Hz or immediately on bomb press
            const input = readCurrentLocalInput();
            if (input.placeBomb || now - lastWsSendRef.current >= 40) {
              lastWsSendRef.current = now;
              sendWsMessage({ type: 'player_input', input });
            }
          } else {
            // Local Solo Simulation
            const localInput = readCurrentLocalInput();
            const inputs: Record<string, PlayerInput> = {
              [localPlayerIdRef.current]: localInput,
            };
            for (const p of world.players) {
              if (p.isBot && p.alive) {
                inputs[p.id] = computeBotInput(world, p);
              }
            }
            stepWorld(world, inputs, dt, localPlayerIdRef.current);

            if (world.events.length > 0) {
              renderer.ingestEvents(world.events);
              gameAudio.handleEvents(world.events);
            }

            if (world.matchFinished) {
              const summary = buildMatchSummary(
                world,
                localPlayerIdRef.current,
                bestScoreRef.current,
                false
              );
              if (summary.bestScore > bestScoreRef.current) {
                bestScoreRef.current = summary.bestScore;
                setBestScore(summary.bestScore);
                try {
                  localStorage.setItem(BEST_SCORE_KEY, String(summary.bestScore));
                } catch {
                  // ignore
                }
              }
              if (summary.won) {
                gameAudio.playVictory();
                const nextSolo = recordLevelCompletion(
                  soloProgressRef.current,
                  world.wave,
                  MAX_SOLO_LEVEL
                );
                soloProgressRef.current = nextSolo;
                setSoloProgress(nextSolo);
                try {
                  localStorage.setItem(SOLO_PROGRESS_KEY, JSON.stringify(nextSolo));
                } catch {
                  // ignore
                }
              } else {
                gameAudio.playDefeat();
              }
              pushCloudSync({
                deltaMatches: 1,
                deltaWins: summary.won ? 1 : 0,
                deltaKills: summary.kills,
              });
              setMatchSummary(summary);
              setHudWorld({ ...world });
              setScreen('GAME_OVER');
            }
          }
        }

        const stageW = Math.max(320, stageRef.current?.clientWidth || window.innerWidth);
        const stageH = Math.max(240, stageRef.current?.clientHeight || window.innerHeight);
        renderer.updateEffects(dt);
        renderer.render(
          ctx,
          stageW,
          stageH,
          world,
          localPlayerIdRef.current,
          showTouchRef.current || stageW < 1024 || stageH < 600
        );

        hudSyncAccum += dt;
        if (hudSyncAccum >= 0.1 && curScreen === 'PLAYING') {
          hudSyncAccum = 0;
          setHudWorld({ ...world });
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncCanvasSize);
      resizeObserver?.disconnect();
    };
  }, [readCurrentLocalInput, sendWsMessage]);

  const showGameCanvas = screen === 'PLAYING' || screen === 'PAUSED' || screen === 'GAME_OVER';

  return (
    <div ref={stageRef} data-testid="android-stage" className="android-stage select-none">
      {/* Isolated Gameplay Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="bomberman-canvas"
        tabIndex={0}
        className={`block w-full h-full outline-none ${showGameCanvas ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}
      />

      {screen === 'TITLE_MENU' && (
        <TitleScreen
          playerName={playerName}
          bestScore={bestScore}
          soloHighestUnlocked={soloProgress.highestUnlocked}
          mpHighestUnlocked={mpProgress.highestUnlocked}
          selectedAvatarId={selectedAvatarId}
          googleProfile={
            googleUser
              ? {
                  displayName: cloudProfile?.displayName || googleUser.displayName || playerName,
                  photoUrl: googleUser.photoURL || cloudProfile?.photoUrl || undefined,
                  email: googleUser.email || undefined,
                  totalWins: cloudProfile?.totalWins,
                }
              : null
          }
          authBusy={authBusy}
          authError={authError}
          onOpenSettings={() => setSettingsOpen(true)}
          onConnectGoogle={() => void handleConnectGoogle()}
          onDisconnectGoogle={() => void handleDisconnectGoogle()}
          onSelectAvatar={(id) => {
            setSelectedAvatarId(id);
            selectedAvatarIdRef.current = id;
            try {
              localStorage.setItem(AVATAR_ID_KEY, id);
            } catch {
              // ignore
            }
            pushCloudSync({ avatarOverride: id });
          }}
          onStartSolo={() => setScreen('SOLO_MAP')}
          onOpenMultiplayer={() => {
            ensureWebSocket();
            setScreen('MULTIPLAYER_LOBBY');
          }}
        />
      )}

      {screen === 'SOLO_MAP' && (
        <SoloCampaignMap
          highestUnlocked={soloProgress.highestUnlocked}
          completedLevels={soloProgress.completed}
          bestScore={bestScore}
          initialSelectedLevel={soloProgress.highestUnlocked}
          onStartLevel={(lvl) => startSoloWave(lvl, 0)}
          onBackToTitle={() => setScreen('TITLE_MENU')}
        />
      )}

      {screen === 'MULTIPLAYER_LOBBY' && (
        <MultiplayerLobby
          connected={wsConnected}
          clientId={wsClientId}
          pingMs={pingMs}
          rooms={roomList}
          room={room}
          errorMessage={roomError}
          playerName={playerName}
          initialJoinCode={initialJoinCode}
          localMpUnlockedLevel={mpProgress.highestUnlocked}
          micEnabled={micEnabled}
          voiceError={voiceError}
          onChangePlayerName={setPlayerName}
          onCreateRoom={(roomName, name, password) =>
            sendWsMessage({
              type: 'create_room',
              roomName,
              name,
              password,
              avatarId: selectedAvatarId,
              avatarUrl: googleUser?.photoURL || undefined,
              unlockedLevel: mpProgressRef.current.highestUnlocked,
            })
          }
          onJoinRoom={(code, name, password) =>
            sendWsMessage({
              type: 'join_room',
              code,
              name,
              password,
              avatarId: selectedAvatarId,
              avatarUrl: googleUser?.photoURL || undefined,
              unlockedLevel: mpProgressRef.current.highestUnlocked,
            })
          }
          onLeaveRoom={() => {
            stopLocalMic();
            sendWsMessage({ type: 'leave_room' });
            setRoom(null);
            setRoomError(null);
          }}
          onToggleReady={(ready) => sendWsMessage({ type: 'set_ready', ready })}
          onToggleFillBots={(fillWithBots) => sendWsMessage({ type: 'toggle_fill_bots', fillWithBots })}
          onChangeMpWave={(wave) => sendWsMessage({ type: 'set_mp_wave', wave })}
          onSetPassword={(password) => sendWsMessage({ type: 'set_room_password', password })}
          onKickMember={(targetId) => sendWsMessage({ type: 'kick_member', targetId })}
          onToggleMic={() => {
            void toggleMic();
          }}
          onStartMatch={() => sendWsMessage({ type: 'start_match' })}
          onBackToTitle={() => {
            stopLocalMic();
            setScreen('TITLE_MENU');
          }}
        />
      )}

      {showGameCanvas && hudWorld && (
        <GameHud
          world={hudWorld}
          localPlayerId={localPlayerId}
          isMuted={isMuted}
          isMultiplayer={isMultiplayer}
          pingMs={pingMs}
          showTouchControls={showTouchControls}
          micEnabled={micEnabled}
          onToggleMic={
            isMultiplayer
              ? () => {
                  void toggleMic();
                }
              : undefined
          }
          onToggleMute={() => setIsMuted(gameAudio.toggleMute())}
          onPause={() => setScreen((s) => (s === 'PAUSED' ? 'PLAYING' : 'PAUSED'))}
          onToggleTouchControls={() => setShowTouchControls((v) => !v)}
        />
      )}

      {screen === 'PLAYING' && (
        <TouchControls
          visible={showTouchControls}
          onInputChange={(inp) => {
            touchInputRef.current = {
              dx: inp.dx ?? 0,
              dy: inp.dy ?? 0,
            };
          }}
          onPlaceBomb={() => {
            bombQueuedRef.current = true;
          }}
        />
      )}

      {screen === 'PAUSED' && (
        <PauseModal
          isMultiplayer={isMultiplayer}
          onResume={() => setScreen('PLAYING')}
          onRestart={() => startSoloWave(hudWorld?.wave ?? 1, 0)}
          onExitToTitle={() => {
            if (isMultiplayer) {
              stopLocalMic();
              sendWsMessage({ type: 'leave_room' });
              setRoom(null);
            }
            worldRef.current = null;
            setScreen('TITLE_MENU');
          }}
        />
      )}

      {screen === 'GAME_OVER' && matchSummary && (
        <GameOverModal
          summary={matchSummary}
          isMpHost={Boolean(room && room.hostId === wsClientId)}
          nextUnpassedLevel={
            isMultiplayer
              ? room?.partyMaxLevel ?? mpProgress.highestUnlocked
              : soloProgress.highestUnlocked
          }
          onPlayAgain={() => startSoloWave(soloProgressRef.current.highestUnlocked, 0)}
          onNextWave={
            !isMultiplayer && matchSummary.won && matchSummary.wave < MAX_SOLO_LEVEL
              ? () => startSoloWave(soloProgressRef.current.highestUnlocked, matchSummary.score)
              : undefined
          }
          onStartNextMpWave={
            isMultiplayer
              ? (retrySame) => sendWsMessage({ type: 'start_next_wave', retrySame })
              : undefined
          }
          onBackToLobby={
            isMultiplayer
              ? () => {
                  sendWsMessage({
                    type: 'rematch',
                    nextWave: Boolean(matchSummary.teamCleared || matchSummary.won),
                  });
                  setScreen('MULTIPLAYER_LOBBY');
                }
              : undefined
          }
          onExitToTitle={() => {
            if (isMultiplayer) {
              stopLocalMic();
              sendWsMessage({ type: 'leave_room' });
              setRoom(null);
            }
            worldRef.current = null;
            setScreen('TITLE_MENU');
          }}
        />
      )}
      <SettingsModal
        open={settingsOpen}
        playerName={playerName}
        selectedAvatarId={selectedAvatarId}
        bestScore={bestScore}
        soloHighestUnlocked={soloProgress.highestUnlocked}
        mpHighestUnlocked={mpProgress.highestUnlocked}
        googleProfile={
          googleUser
            ? {
                displayName: cloudProfile?.displayName || googleUser.displayName || playerName,
                photoUrl: googleUser.photoURL || cloudProfile?.photoUrl || undefined,
                email: googleUser.email || undefined,
                totalWins: cloudProfile?.totalWins,
              }
            : null
        }
        authBusy={authBusy}
        authError={authError}
        onClose={() => setSettingsOpen(false)}
        onSaveProfile={handleSaveProfileSettings}
        onConnectGoogle={() => void handleConnectGoogle()}
        onDisconnectGoogle={() => void handleDisconnectGoogle()}
      />
      {!splashDone && <SplashPreloader onComplete={() => setSplashDone(true)} />}
      <OfflineIndicator />
    </div>
  );
}
