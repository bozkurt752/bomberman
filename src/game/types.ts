export const GRID_COLS = 13;
export const GRID_ROWS = 11;
export const MAX_SOLO_LEVEL = 500;
export const MAX_MP_LEVEL = 100;

export type CellType = 'empty' | 'wall' | 'crate';

export type PowerUpType =
  | 'bomb'
  | 'flame'
  | 'speed'
  | 'kick'
  | 'shield'
  | 'pierce'
  | 'ghost'
  | 'star'
  | 'mega';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

export type BotPolicy = 'stalker' | 'trapper' | 'raider';

export type BotVariant = 'slow' | 'fast' | 'armored' | 'ghost' | 'charger';

export type AvatarId = 'knight' | 'samurai' | 'ninja' | 'mage';

export interface AvatarPreset {
  id: AvatarId;
  label: string;
  color: string;
  accentColor: string;
  imageUrl: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'knight',
    label: 'Siber Şövalye',
    color: '#22D3EE',
    accentColor: '#0284C7',
    imageUrl: '/src/assets/images/hero_bomber_emblem_1795156760463.jpg',
  },
  {
    id: 'samurai',
    label: 'Alev Samuray',
    color: '#FB7185',
    accentColor: '#E11D48',
    imageUrl: '/src/assets/images/avatar_crimson_samurai_1795157761757.jpg',
  },
  {
    id: 'ninja',
    label: 'Zümrüt Ninja',
    color: '#34D399',
    accentColor: '#059669',
    imageUrl: '/src/assets/images/avatar_emerald_ninja_1795157762003.jpg',
  },
  {
    id: 'mage',
    label: 'Mor Büyücü',
    color: '#C084FC',
    accentColor: '#7C3AED',
    imageUrl: '/src/assets/images/avatar_violet_mage_1795157762366.jpg',
  },
];

export type UiScreenState =
  | 'TITLE_MENU'
  | 'SOLO_MAP'
  | 'MULTIPLAYER_LOBBY'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER';

export interface PlayerInput {
  dx: number; // -1, 0, 1
  dy: number; // -1, 0, 1
  placeBomb: boolean;
  dash?: boolean;
}

export interface PlayerState {
  id: string;
  slot: number; // 0..3
  name: string;
  color: string;
  accentColor: string;
  avatarId: AvatarId;
  isBot: boolean;
  botPolicy?: BotPolicy;
  botVariant?: BotVariant;
  hp: number;
  maxHp: number;
  isDashing?: boolean;
  speedMultiplier: number;
  x: number; // continuous tile coords (center of player), e.g., 0.5
  y: number;
  vx: number;
  vy: number;
  facing: Direction;
  walkPhase: number;
  alive: boolean;
  koTimer: number; // 0..0.45s KO topple animation
  maxBombs: number;
  activeBombs: number;
  flameRange: number;
  speedLevel: number; // 0..4
  canKick: boolean;
  hasShield: boolean;
  hasPierce: boolean;
  ghostTimer: number; // seconds remaining to pass through crates & bombs
  starTimer: number; // seconds remaining of golden invincibility + bug crush
  invulnTimer: number; // seconds after shield pop or star
  hitFlashTimer: number; // seconds for white flash
  score: number;
  kills: number;
  cratesBroken: number;
  comboCount: number;
  comboTimer: number;
  comboMultiplier: number;
  maxCombo: number;
  passThroughBombIds: string[];
  avatarUrl?: string;
}

export interface BombState {
  id: string;
  ownerId: string;
  gx: number;
  gy: number;
  x: number;
  y: number;
  fuseTimer: number;
  maxFuse: number;
  range: number;
  vx: number;
  vy: number;
  piercing?: boolean;
}

export interface ExplosionCell {
  gx: number;
  gy: number;
  kind: 'center' | 'h' | 'v' | 'end-left' | 'end-right' | 'end-up' | 'end-down';
}

export interface ExplosionState {
  id: string;
  ownerId: string;
  timer: number;
  maxTimer: number;
  cells: ExplosionCell[];
}

export interface PowerUpItem {
  id: string;
  gx: number;
  gy: number;
  type: PowerUpType;
  spawnAnim: number;
}

export interface ExitDoorState {
  gx: number;
  gy: number;
  revealed: boolean;
}

export interface SimEvent {
  type:
    | 'bomb_place'
    | 'explode'
    | 'crate_break'
    | 'powerup_pickup'
    | 'shield_break'
    | 'armor_crack'
    | 'player_ko'
    | 'bomb_kick'
    | 'combo_up'
    | 'door_revealed'
    | 'door_enter';
  gx: number;
  gy: number;
  powerUpType?: PowerUpType;
  playerId?: string;
  intensity?: number;
  comboCount?: number;
  comboMultiplier?: number;
  bonusPoints?: number;
}

export interface WorldState {
  tick: number;
  cols: number;
  rows: number;
  timeRemaining: number; // seconds
  elapsedTime: number;
  suddenDeathStep: number;
  suddenDeathTimer: number;
  wave: number;
  isSoloMode: boolean;
  grid: CellType[][]; // [row][col]
  players: PlayerState[];
  bombs: BombState[];
  explosions: ExplosionState[];
  powerUps: PowerUpItem[];
  exitDoor: ExitDoorState | null;
  events: SimEvent[];
  hitstopTimer: number;
  winnerId: string | null;
  matchFinished: boolean;
  endReason: 'victory' | 'defeat' | 'draw' | 'timeout' | null;
  nextIdCounter: number;
}

export interface MatchSummary {
  won: boolean;
  teamCleared?: boolean;
  reviveNextLevel?: boolean;
  isDraw: boolean;
  endReason: 'victory' | 'defeat' | 'draw' | 'timeout';
  winnerName: string | null;
  winnerId: string | null;
  localPlayerId: string;
  score: number;
  bestScore: number;
  kills: number;
  maxCombo: number;
  foundDoor: boolean;
  cratesBroken: number;
  elapsedSeconds: number;
  wave: number;
  isMultiplayer: boolean;
  standings: Array<{
    id: string;
    name: string;
    color: string;
    avatarId: AvatarId;
    alive: boolean;
    kills: number;
    score: number;
    isBot: boolean;
  }>;
}

export interface RoomMemberInfo {
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

export interface RoomSummary {
  code: string;
  name: string;
  status: 'lobby' | 'countdown' | 'playing' | 'finished';
  wave: number;
  partyMaxLevel: number;
  hasPassword: boolean;
  humanCount: number;
  maxHumans: number;
  players: Array<{
    id: string;
    name: string;
    color: string;
    avatarId: AvatarId;
    isHost: boolean;
    unlockedLevel: number;
  }>;
}

export interface RoomSnapshot {
  code: string;
  name: string;
  status: 'lobby' | 'countdown' | 'playing' | 'finished';
  countdown: number;
  wave: number;
  partyMaxLevel: number;
  hasPassword: boolean;
  hostId: string;
  fillWithBots: boolean;
  maxHumans: number;
  members: RoomMemberInfo[];
}

export type ClientWsMessage =
  | { type: 'list_rooms' }
  | {
      type: 'create_room';
      roomName?: string;
      name: string;
      password?: string;
      avatarUrl?: string;
      avatarId?: AvatarId;
      unlockedLevel?: number;
    }
  | {
      type: 'join_room';
      code: string;
      name: string;
      password?: string;
      avatarUrl?: string;
      avatarId?: AvatarId;
      unlockedLevel?: number;
    }
  | { type: 'leave_room' }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'set_mp_wave'; wave: number }
  | { type: 'sync_mp_progress'; unlockedLevel: number }
  | { type: 'set_room_password'; password: string }
  | { type: 'kick_member'; targetId: string }
  | { type: 'toggle_fill_bots'; fillWithBots: boolean }
  | { type: 'start_match' }
  | { type: 'start_next_wave'; retrySame?: boolean }
  | { type: 'rematch'; nextWave?: boolean }
  | { type: 'voice_state'; enabled: boolean }
  | { type: 'rtc_signal'; targetId: string; signal: unknown }
  | { type: 'player_input'; input: PlayerInput; seq?: number }
  | { type: 'ping'; ts: number };

export type ServerWsMessage =
  | { type: 'welcome'; clientId: string }
  | { type: 'room_list'; rooms: RoomSummary[] }
  | { type: 'room_update'; room: RoomSnapshot }
  | { type: 'room_error'; message: string }
  | { type: 'kicked'; message: string }
  | { type: 'rtc_signal'; fromId: string; signal: unknown }
  | { type: 'match_started'; world: WorldState; localPlayerId: string }
  | { type: 'world_state'; world: WorldState }
  | { type: 'match_ended'; world: WorldState }
  | { type: 'pong'; ts: number };
