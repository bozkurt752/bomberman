import {
  AVATAR_PRESETS,
  AvatarId,
  BombState,
  BotPolicy,
  BotVariant,
  CellType,
  ExitDoorState,
  ExplosionCell,
  GRID_COLS,
  GRID_ROWS,
  MAX_MP_LEVEL,
  MAX_SOLO_LEVEL,
  PlayerInput,
  PlayerState,
  PowerUpType,
  SimEvent,
  WorldState,
} from './types';
import {
  getBugRosterForLevel,
  getLevelBiome,
  getMpLevelDifficultyLabel,
  getSoloLevelDifficultyLabel,
} from './levels';

export const PLAYER_PALETTES = [
  { color: '#22D3EE', accentColor: '#0284C7', avatarId: 'knight' as AvatarId },
  { color: '#FB7185', accentColor: '#E11D48', avatarId: 'samurai' as AvatarId },
  { color: '#34D399', accentColor: '#059669', avatarId: 'ninja' as AvatarId },
  { color: '#C084FC', accentColor: '#7C3AED', avatarId: 'mage' as AvatarId },
] as const;

export function getHumanSpawnCoords(rows: number): ReadonlyArray<{ gx: number; gy: number }> {
  return [
    { gx: 0, gy: 0 },        // Top-Left 1
    { gx: 2, gy: 0 },        // Top-Left 2
    { gx: 0, gy: rows - 1 }, // Bottom-Left 1
    { gx: 2, gy: rows - 1 }, // Bottom-Left 2
  ];
}

export const SPAWN_COORDS: ReadonlyArray<{ gx: number; gy: number }> = getHumanSpawnCoords(GRID_ROWS);

export const BASE_MOVE_SPEED = 4.1; // tiles/sec
export const SPEED_PER_LEVEL = 0.55;
export const BOMB_FUSE_SECONDS = 2.55;
export const EXPLOSION_DURATION = 0.48;
export const MATCH_DURATION_SECONDS = 180;
export const SUDDEN_DEATH_WINDOW_SECONDS = 35;
export const PLAYER_HIT_RADIUS = 0.34;
export const CORNER_SNAP_THRESHOLD = 0.48;
export const COMBO_WINDOW_SECONDS = 12.0;

export interface SoloLevelConfig {
  wave: number;
  name: string;
  difficultyLabel: string;
  cols: number;
  rows: number;
  crateDensity: number;
  botCount: number;
  botSpeedMultiplier: number;
  slowBotSpeedMultiplier: number;
  botFlameRange: number;
  botMaxBombs: number;
  durationSeconds: number;
}

export const BOT_EAT_RADIUS = 0.62;

export function getArenaConfig(wave: number, isSoloMode: boolean): SoloLevelConfig {
  if (!isSoloMode) {
    const safeWave = Math.min(MAX_MP_LEVEL, Math.max(1, wave));
    const biome = getLevelBiome(safeWave, false);
    const rawCols = Math.min(41, 27 + Math.floor((safeWave - 1) * 1.4));
    const rawRows = Math.min(27, 19 + Math.floor((safeWave - 1) * 0.8));
    const cols = rawCols % 2 === 0 ? rawCols + 1 : rawCols;
    const rows = rawRows % 2 === 0 ? rawRows + 1 : rawRows;
    return {
      wave: safeWave,
      name: biome.name,
      difficultyLabel: getMpLevelDifficultyLabel(safeWave),
      cols,
      rows,
      crateDensity: Math.min(0.72, 0.58 + (safeWave - 1) * 0.008),
      botCount: Math.min(46, 16 + Math.floor((safeWave - 1) * 1.8)),
      botSpeedMultiplier: Math.min(1.16, 0.88 + (safeWave - 1) * 0.012),
      slowBotSpeedMultiplier: Math.min(0.80, 0.54 + (safeWave - 1) * 0.010),
      botFlameRange: 2,
      botMaxBombs: 0,
      durationSeconds: Math.min(340, 240 + Math.floor((safeWave - 1) * 4)),
    };
  }

  const safeWave = Math.min(MAX_SOLO_LEVEL, Math.max(1, wave));
  const biome = getLevelBiome(safeWave, true);

  if (safeWave === 1) {
    return {
      wave: 1,
      name: biome.name,
      difficultyLabel: 'Kolay',
      cols: 17,
      rows: 13,
      crateDensity: 0.50,
      botCount: 6,
      botSpeedMultiplier: 0.52,
      slowBotSpeedMultiplier: 0.52,
      botFlameRange: 2,
      botMaxBombs: 0,
      durationSeconds: 180,
    };
  }
  if (safeWave === 2) {
    return {
      wave: 2,
      name: biome.name,
      difficultyLabel: 'Orta',
      cols: 21,
      rows: 15,
      crateDensity: 0.55,
      botCount: 9,
      botSpeedMultiplier: 0.61,
      slowBotSpeedMultiplier: 0.61,
      botFlameRange: 2,
      botMaxBombs: 0,
      durationSeconds: 210,
    };
  }
  if (safeWave === 3) {
    return {
      wave: 3,
      name: biome.name,
      difficultyLabel: 'Zor',
      cols: 25,
      rows: 17,
      crateDensity: 0.60,
      botCount: 13,
      botSpeedMultiplier: 0.69,
      slowBotSpeedMultiplier: 0.69,
      botFlameRange: 2,
      botMaxBombs: 0,
      durationSeconds: 240,
    };
  }

  const progress = (safeWave - 4) / Math.max(1, MAX_SOLO_LEVEL - 4);
  const rawCols = Math.min(39, 29 + Math.floor((safeWave - 4) * 0.45));
  const rawRows = Math.min(25, 19 + Math.floor((safeWave - 4) * 0.25));
  const cols = rawCols % 2 === 0 ? rawCols + 1 : rawCols;
  const rows = rawRows % 2 === 0 ? rawRows + 1 : rawRows;
  const lateSpeed = Math.min(1.02, 0.74 + Math.pow(progress, 0.75) * 0.28);

  return {
    wave: safeWave,
    name: biome.name,
    difficultyLabel: getSoloLevelDifficultyLabel(safeWave),
    cols,
    rows,
    crateDensity: Math.min(0.72, 0.63 + progress * 0.09),
    botCount: Math.min(40, 17 + Math.floor((safeWave - 4) * 0.35)),
    botSpeedMultiplier: lateSpeed,
    slowBotSpeedMultiplier: lateSpeed,
    botFlameRange: 2,
    botMaxBombs: 0,
    durationSeconds: Math.min(330, 270 + Math.floor(progress * 60)),
  };
}

export function getSoloLevelConfig(wave: number): SoloLevelConfig {
  return getArenaConfig(wave, true);
}

export interface CreateWorldOptions {
  wave?: number;
  seed?: number;
  isSoloMode?: boolean;
  hasExitDoor?: boolean;
  cols?: number;
  rows?: number;
  players: Array<{
    id: string;
    name: string;
    slot: number;
    isBot: boolean;
    botPolicy?: BotPolicy;
    botVariant?: BotVariant;
    avatarId?: AvatarId;
    avatarUrl?: string;
  }>;
}

export function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 1337;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function isSpawnSafeZone(gx: number, gy: number, rows = GRID_ROWS): boolean {
  const coords = getHumanSpawnCoords(rows);
  for (const s of coords) {
    const dist = Math.abs(gx - s.gx) + Math.abs(gy - s.gy);
    if (dist <= 2) return true;
  }
  return false;
}

export function createInitialGrid(
  seed = 42,
  crateDensity = 0.60,
  cols = GRID_COLS,
  rows = GRID_ROWS,
  wave = 1
): CellType[][] {
  const rng = createSeededRng(seed + wave * 7919);
  const pattern = (wave - 1) % 6;
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const grid: CellType[][] = [];

  for (let y = 0; y < rows; y++) {
    const row: CellType[] = [];
    for (let x = 0; x < cols; x++) {
      if (x % 2 === 1 && y % 2 === 1) {
        row.push('wall');
      } else if (isSpawnSafeZone(x, y, rows)) {
        row.push('empty');
      } else {
        // Distinct structural crate pattern per level while preserving fair open lanes
        let bias = 0;
        if (pattern === 1 && (y === cy || x === cx)) {
          bias = -0.32; // Grand cross corridor
        } else if (pattern === 2 && ((x + y) % 4 === 0)) {
          bias = -0.25; // Diagonal avenue lanes
        } else if (pattern === 3 && (Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 2)) {
          bias = 0.22; // Dense central citadel
        } else if (pattern === 4 && (x % 4 === 0 || y % 4 === 0)) {
          bias = -0.22; // Twin chamber grid
        } else if (pattern === 5 && ((x % 2 === 0 && y % 2 === 0))) {
          bias = 0.16; // Checker pockets
        }
        const effectiveDensity = Math.max(0.18, Math.min(0.86, crateDensity + bias));
        row.push(rng() < effectiveDensity ? 'crate' : 'empty');
      }
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Selects a random crate coordinate among the tiles furthest away from human spawn points.
 */
export function pickFurthestExitDoor(
  grid: CellType[][],
  seed: number,
  humanSpawns: ReadonlyArray<{ gx: number; gy: number }>,
  cols: number,
  rows: number
): ExitDoorState {
  const rng = createSeededRng(seed + 911);
  const crateCandidates: Array<{ gx: number; gy: number; dist: number }> = [];
  const openFarCandidates: Array<{ gx: number; gy: number; dist: number }> = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 'wall') continue;
      if (isSpawnSafeZone(x, y, rows)) continue;
      let minDist = Infinity;
      for (const hs of humanSpawns) {
        const d = Math.abs(x - hs.gx) + Math.abs(y - hs.gy);
        if (d < minDist) minDist = d;
      }
      if (grid[y][x] === 'crate') {
        crateCandidates.push({ gx: x, gy: y, dist: minDist });
      } else {
        openFarCandidates.push({ gx: x, gy: y, dist: minDist });
      }
    }
  }

  const pool = crateCandidates.length > 0 ? crateCandidates : openFarCandidates;
  if (pool.length === 0) {
    return { gx: cols - 3, gy: rows - 1, revealed: grid[rows - 1][cols - 3] === 'empty' };
  }

  const maxDist = Math.max(...pool.map((c) => c.dist));
  const minThreshold = Math.max(8, maxDist - 3);
  const furthestPool = pool.filter((c) => c.dist >= minThreshold);
  const finalPool = furthestPool.length > 0 ? furthestPool : pool;
  const chosen = finalPool[Math.floor(rng() * finalPool.length)];

  if (grid[chosen.gy][chosen.gx] === 'empty') {
    grid[chosen.gy][chosen.gx] = 'crate';
  }

  return {
    gx: chosen.gx,
    gy: chosen.gy,
    revealed: false,
  };
}

function clearBotPocket(grid: CellType[][], gx: number, gy: number, cols: number, rows: number): void {
  grid[gy][gx] = 'empty';
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  let cleared = 0;
  for (const d of dirs) {
    const nx = gx + d.dx;
    const ny = gy + d.dy;
    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny][nx] !== 'wall') {
      grid[ny][nx] = 'empty';
      cleared += 1;
      if (cleared >= 2) break;
    }
  }
}

function buildBotSpawnPool(
  cols: number,
  rows: number,
  humanSpawns: ReadonlyArray<{ gx: number; gy: number }>,
  seed: number
): Array<{ gx: number; gy: number }> {
  const candidates: Array<{ gx: number; gy: number }> = [];
  const minRightX = Math.max(6, Math.floor(cols * 0.35));

  for (let y = 0; y < rows; y += 2) {
    for (let x = minRightX; x < cols; x += 2) {
      if (x % 2 === 1 && y % 2 === 1) continue;
      if (isSpawnSafeZone(x, y, rows)) continue;
      const farFromHumans = humanSpawns.every((hs) => Math.abs(x - hs.gx) + Math.abs(y - hs.gy) >= 6);
      if (farFromHumans) {
        candidates.push({ gx: x, gy: y });
      }
    }
  }

  // Fallback to additional open corridor tiles if needed for giant 32-bug swarms
  if (candidates.length < 32) {
    for (let y = 0; y < rows; y++) {
      for (let x = minRightX; x < cols; x++) {
        if (x % 2 === 1 && y % 2 === 1) continue;
        if (isSpawnSafeZone(x, y, rows)) continue;
        if (!candidates.some((c) => c.gx === x && c.gy === y)) {
          const farFromHumans = humanSpawns.every((hs) => Math.abs(x - hs.gx) + Math.abs(y - hs.gy) >= 5);
          if (farFromHumans) candidates.push({ gx: x, gy: y });
        }
      }
    }
  }

  // Deterministic seeded shuffle
  const rng = createSeededRng(seed + 4242);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates;
}

export function createWorld(options: CreateWorldOptions): WorldState {
  const isSoloMode = Boolean(options.isSoloMode);
  const maxWave = isSoloMode ? MAX_SOLO_LEVEL : MAX_MP_LEVEL;
  const wave = Math.min(maxWave, Math.max(1, options.wave ?? 1));
  const hasExitDoor = isSoloMode || Boolean(options.hasExitDoor);
  const seed = options.seed ?? ((wave * 2654435761) >>> 0);
  const levelCfg = getArenaConfig(wave, isSoloMode);

  const rawCols = options.cols ?? levelCfg.cols;
  const rawRows = options.rows ?? levelCfg.rows;
  const cols = rawCols % 2 === 0 ? rawCols + 1 : rawCols;
  const rows = rawRows % 2 === 0 ? rawRows + 1 : rawRows;

  const crateDensity = levelCfg.crateDensity;
  const grid = createInitialGrid(seed, crateDensity, cols, rows, wave);

  const specs = options.players.slice(0, 50);
  const humanSpecs = specs.filter((s) => !s.isBot);
  const humanSpawnCoords = getHumanSpawnCoords(rows);
  const humanSpawns: Array<{ gx: number; gy: number }> = [];
  const usedCoords = new Set<string>();

  // Assign human spawns first from left-side 2+2 SPAWN_COORDS
  const specSpawnMap = new Map<string, { gx: number; gy: number }>();
  humanSpecs.forEach((h, i) => {
    const coord = humanSpawnCoords[i % humanSpawnCoords.length];
    specSpawnMap.set(h.id, coord);
    humanSpawns.push(coord);
    usedCoords.add(`${coord.gx},${coord.gy}`);
  });

  // Assign bot spawns dynamically across center-right and far-right of the map
  const botSpecs = specs.filter((s) => s.isBot);
  const effectiveHumanSpawns = humanSpawns.length > 0 ? humanSpawns : [humanSpawnCoords[0]];
  const botPool = buildBotSpawnPool(cols, rows, effectiveHumanSpawns, seed);

  botSpecs.forEach((b, i) => {
    const chosen =
      botPool.find((c) => !usedCoords.has(`${c.gx},${c.gy}`)) ??
      botPool[i % Math.max(1, botPool.length)] ??
      { gx: cols - 1, gy: rows - 1 };
    usedCoords.add(`${chosen.gx},${chosen.gy}`);
    specSpawnMap.set(b.id, chosen);
    clearBotPocket(grid, chosen.gx, chosen.gy, cols, rows);
  });

  // Pick hidden exit door AFTER bot pockets are cleared so the hiding crate stays intact
  const exitDoor = hasExitDoor
    ? pickFurthestExitDoor(grid, seed, effectiveHumanSpawns, cols, rows)
    : null;

  const botRoster = getBugRosterForLevel(wave, isSoloMode, botSpecs.length);
  let botAssignIdx = 0;

  const variantColorMap: Record<BotVariant, { color: string; accent: string }> = {
    slow: { color: '#E11D48', accent: '#4C0519' },
    fast: { color: '#9333EA', accent: '#3B0764' },
    armored: { color: '#D97706', accent: '#78350F' },
    ghost: { color: '#14B8A6', accent: '#115E59' },
    charger: { color: '#EA580C', accent: '#7C2D12' },
  };

  const players: PlayerState[] = specs.map((spec, idx) => {
    const slot = spec.slot ?? idx;
    const spawn = specSpawnMap.get(spec.id) ?? humanSpawnCoords[slot % humanSpawnCoords.length];
    const defaultPalette = PLAYER_PALETTES[slot % PLAYER_PALETTES.length];
    const chosenAvatar = spec.avatarId
      ? AVATAR_PRESETS.find((a) => a.id === spec.avatarId)
      : undefined;

    let botVariant: BotVariant | undefined;
    let speedMultiplier = 1;
    let maxHp = 1;
    if (spec.isBot) {
      botVariant = spec.botVariant ?? botRoster[botAssignIdx % Math.max(1, botRoster.length)] ?? 'slow';
      botAssignIdx += 1;

      const baseSpeed = isSoloMode
        ? levelCfg.botSpeedMultiplier
        : levelCfg.slowBotSpeedMultiplier;

      if (botVariant === 'armored') {
        speedMultiplier = Number((baseSpeed * 0.78).toFixed(4));
        maxHp = 2;
      } else if (botVariant === 'ghost') {
        speedMultiplier = Number((baseSpeed * 1.12).toFixed(4));
      } else if (botVariant === 'charger') {
        speedMultiplier = Number((baseSpeed * 1.24).toFixed(4));
      } else if (botVariant === 'fast') {
        speedMultiplier = isSoloMode
          ? Number((baseSpeed * 1.42).toFixed(4))
          : levelCfg.botSpeedMultiplier;
      } else {
        speedMultiplier = baseSpeed;
      }
    }

    const botPalette = botVariant ? variantColorMap[botVariant] : variantColorMap.slow;
    const color = spec.isBot
      ? botPalette.color
      : chosenAvatar
        ? chosenAvatar.color
        : defaultPalette.color;
    const accentColor = spec.isBot
      ? botPalette.accent
      : chosenAvatar
        ? chosenAvatar.accentColor
        : defaultPalette.accentColor;
    const avatarId = spec.avatarId ?? defaultPalette.avatarId;

    return {
      id: spec.id,
      slot,
      name: spec.isBot ? '' : spec.name,
      color,
      accentColor,
      avatarId,
      isBot: spec.isBot,
      botPolicy: spec.botPolicy,
      botVariant,
      hp: maxHp,
      maxHp,
      isDashing: false,
      speedMultiplier,
      x: spawn.gx + 0.5,
      y: spawn.gy + 0.5,
      vx: 0,
      vy: 0,
      facing: spec.isBot ? 'left' : spawn.gy === 0 ? 'down' : 'up',
      walkPhase: 0,
      alive: true,
      koTimer: 0,
      maxBombs: spec.isBot ? 0 : 1,
      activeBombs: 0,
      flameRange: spec.isBot ? 0 : 2,
      speedLevel: 0,
      canKick: false,
      hasShield: false,
      hasPierce: false,
      ghostTimer: 0,
      starTimer: 0,
      invulnTimer: 0,
      hitFlashTimer: 0,
      score: 0,
      kills: 0,
      cratesBroken: 0,
      comboCount: 0,
      comboTimer: 0,
      comboMultiplier: 1,
      maxCombo: 0,
      passThroughBombIds: [],
      avatarUrl: spec.avatarUrl,
    };
  });

  return {
    tick: 0,
    cols,
    rows,
    timeRemaining: levelCfg.durationSeconds,
    elapsedTime: 0,
    suddenDeathStep: 0,
    suddenDeathTimer: 0,
    wave,
    isSoloMode,
    grid,
    players,
    bombs: [],
    explosions: [],
    powerUps: [],
    exitDoor,
    events: [],
    hitstopTimer: 0,
    winnerId: null,
    matchFinished: false,
    endReason: null,
    nextIdCounter: 1,
  };
}

function nextEntityId(world: WorldState, prefix: string): string {
  const id = `${prefix}_${world.nextIdCounter}`;
  world.nextIdCounter += 1;
  return id;
}

export function isCellWalkable(
  world: WorldState,
  gx: number,
  gy: number,
  passThroughBombIds: string[] = [],
  canPhaseCrates = false,
  canPhaseBombs = false
): boolean {
  if (gx < 0 || gx >= world.cols || gy < 0 || gy >= world.rows) return false;
  const cell = world.grid[gy][gx];
  if (cell === 'wall') return false;
  if (cell === 'crate' && !canPhaseCrates) return false;
  if (!canPhaseBombs) {
    const bomb = world.bombs.find((b) => b.gx === gx && b.gy === gy);
    if (bomb && !passThroughBombIds.includes(bomb.id)) return false;
  }
  return true;
}

function collidesAtPosition(
  world: WorldState,
  x: number,
  y: number,
  player: PlayerState
): BombState | 'blocked' | null {
  const r = PLAYER_HIT_RADIUS;
  const minGx = Math.floor(x - r);
  const maxGx = Math.floor(x + r);
  const minGy = Math.floor(y - r);
  const maxGy = Math.floor(y + r);
  const canPhaseCrates = !player.isBot && player.ghostTimer > 0;
  const canPhaseBombs = !player.isBot && player.ghostTimer > 0;

  if (minGx < 0 || maxGx >= world.cols || minGy < 0 || maxGy >= world.rows) {
    return 'blocked';
  }

  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const cell = world.grid[gy][gx];
      if (cell === 'wall' || (cell === 'crate' && !canPhaseCrates)) {
        return 'blocked';
      }
      if (!canPhaseBombs) {
        const bomb = world.bombs.find((b) => b.gx === gx && b.gy === gy);
        if (bomb && !player.passThroughBombIds.includes(bomb.id)) {
          return bomb;
        }
      }
    }
  }
  return null;
}

function tryMovePlayer(
  world: WorldState,
  player: PlayerState,
  dx: number,
  dy: number,
  dt: number,
  events: SimEvent[],
  dash = false
): void {
  player.isDashing = player.isBot && player.botVariant === 'charger' && dash;
  if (dx === 0 && dy === 0) {
    player.vx = 0;
    player.vy = 0;
    return;
  }

  const len = Math.hypot(dx, dy);
  const ndx = len > 0 ? dx / len : 0;
  const ndy = len > 0 ? dy / len : 0;

  if (Math.abs(ndx) >= Math.abs(ndy)) {
    player.facing = ndx > 0 ? 'right' : 'left';
  } else {
    player.facing = ndy > 0 ? 'down' : 'up';
  }

  const starBoost = !player.isBot && player.starTimer > 0 ? 1.28 : 1;
  const dashBoost = player.isDashing ? 1.48 : 1;
  const canPhaseCrates = !player.isBot && player.ghostTimer > 0;
  const canPhaseBombs = !player.isBot && player.ghostTimer > 0;
  const speed =
    (BASE_MOVE_SPEED + player.speedLevel * SPEED_PER_LEVEL) *
    (player.speedMultiplier || 1) *
    starBoost *
    dashBoost;
  const stepX = ndx * speed * dt;
  const stepY = ndy * speed * dt;

  const prevX = player.x;
  const prevY = player.y;

  if (stepX !== 0) {
    const nextX = player.x + stepX;
    const hitX = collidesAtPosition(world, nextX, player.y, player);
    if (hitX === null) {
      player.x = nextX;
    } else if (hitX !== 'blocked' && player.canKick && Math.abs(ndx) > 0.5 && hitX.vx === 0 && hitX.vy === 0) {
      const dir = Math.sign(ndx);
      if (isCellWalkable(world, hitX.gx + dir, hitX.gy)) {
        hitX.vx = dir * 8.5;
        hitX.vy = 0;
        events.push({ type: 'bomb_kick', gx: hitX.gx, gy: hitX.gy, playerId: player.id });
      }
    } else {
      const targetCenterY = Math.floor(player.y) + 0.5;
      const offsetY = targetCenterY - player.y;
      if (Math.abs(offsetY) > 0.02 && Math.abs(offsetY) <= CORNER_SNAP_THRESHOLD) {
        const probeGy = Math.floor(targetCenterY);
        const probeGx = Math.floor(nextX + Math.sign(stepX) * PLAYER_HIT_RADIUS);
        if (isCellWalkable(world, probeGx, probeGy, player.passThroughBombIds, canPhaseCrates, canPhaseBombs)) {
          const nudge = Math.sign(offsetY) * Math.min(Math.abs(offsetY), speed * dt * 0.9);
          if (collidesAtPosition(world, player.x, player.y + nudge, player) === null) {
            player.y += nudge;
          }
        }
      }
    }
  }

  if (stepY !== 0) {
    const nextY = player.y + stepY;
    const hitY = collidesAtPosition(world, player.x, nextY, player);
    if (hitY === null) {
      player.y = nextY;
    } else if (hitY !== 'blocked' && player.canKick && Math.abs(ndy) > 0.5 && hitY.vx === 0 && hitY.vy === 0) {
      const dir = Math.sign(ndy);
      if (isCellWalkable(world, hitY.gx, hitY.gy + dir)) {
        hitY.vx = 0;
        hitY.vy = dir * 8.5;
        events.push({ type: 'bomb_kick', gx: hitY.gx, gy: hitY.gy, playerId: player.id });
      }
    } else {
      const targetCenterX = Math.floor(player.x) + 0.5;
      const offsetX = targetCenterX - player.x;
      if (Math.abs(offsetX) > 0.02 && Math.abs(offsetX) <= CORNER_SNAP_THRESHOLD) {
        const probeGx = Math.floor(targetCenterX);
        const probeGy = Math.floor(nextY + Math.sign(stepY) * PLAYER_HIT_RADIUS);
        if (isCellWalkable(world, probeGx, probeGy, player.passThroughBombIds, canPhaseCrates, canPhaseBombs)) {
          const nudge = Math.sign(offsetX) * Math.min(Math.abs(offsetX), speed * dt * 0.9);
          if (collidesAtPosition(world, player.x + nudge, player.y, player) === null) {
            player.x += nudge;
          }
        }
      }
    }
  }

  const movedDist = Math.hypot(player.x - prevX, player.y - prevY);
  player.vx = (player.x - prevX) / Math.max(dt, 0.001);
  player.vy = (player.y - prevY) / Math.max(dt, 0.001);
  if (movedDist > 0.0005) {
    player.walkPhase += movedDist * 4.5;
  }

  player.passThroughBombIds = player.passThroughBombIds.filter((bombId) => {
    const bomb = world.bombs.find((b) => b.id === bombId);
    if (!bomb) return false;
    const minGx = Math.floor(player.x - PLAYER_HIT_RADIUS);
    const maxGx = Math.floor(player.x + PLAYER_HIT_RADIUS);
    const minGy = Math.floor(player.y - PLAYER_HIT_RADIUS);
    const maxGy = Math.floor(player.y + PLAYER_HIT_RADIUS);
    return bomb.gx >= minGx && bomb.gx <= maxGx && bomb.gy >= minGy && bomb.gy <= maxGy;
  });
}

export function placeBombForPlayer(
  world: WorldState,
  player: PlayerState,
  events: SimEvent[]
): boolean {
  if (!player.alive) return false;
  if (player.isBot) return false;
  if (player.activeBombs >= player.maxBombs) return false;

  const gx = Math.floor(player.x);
  const gy = Math.floor(player.y);
  if (gx < 0 || gx >= world.cols || gy < 0 || gy >= world.rows) return false;
  if (world.grid[gy][gx] !== 'empty') return false;
  if (world.bombs.some((b) => b.gx === gx && b.gy === gy)) return false;

  const bombId = nextEntityId(world, 'bomb');
  world.bombs.push({
    id: bombId,
    ownerId: player.id,
    gx,
    gy,
    x: gx + 0.5,
    y: gy + 0.5,
    fuseTimer: BOMB_FUSE_SECONDS,
    maxFuse: BOMB_FUSE_SECONDS,
    range: player.flameRange,
    vx: 0,
    vy: 0,
    piercing: player.hasPierce,
  });

  player.activeBombs += 1;
  for (const p of world.players) {
    if (!p.alive) continue;
    const minGx = Math.floor(p.x - PLAYER_HIT_RADIUS);
    const maxGx = Math.floor(p.x + PLAYER_HIT_RADIUS);
    const minGy = Math.floor(p.y - PLAYER_HIT_RADIUS);
    const maxGy = Math.floor(p.y + PLAYER_HIT_RADIUS);
    if (gx >= minGx && gx <= maxGx && gy >= minGy && gy <= maxGy) {
      if (!p.passThroughBombIds.includes(bombId)) {
        p.passThroughBombIds.push(bombId);
      }
    }
  }

  events.push({ type: 'bomb_place', gx, gy, playerId: player.id });
  return true;
}

function rollPowerUp(seedNum: number): PowerUpType | null {
  const r = (Math.sin(seedNum * 12.9898 + 78.233) * 43758.5453) % 1;
  const val = Math.abs(r);
  if (val > 0.56) return null;
  const norm = val / 0.56;
  if (norm < 0.17) return 'bomb';
  if (norm < 0.34) return 'flame';
  if (norm < 0.49) return 'speed';
  if (norm < 0.60) return 'kick';
  if (norm < 0.71) return 'shield';
  if (norm < 0.80) return 'pierce';
  if (norm < 0.89) return 'ghost';
  if (norm < 0.95) return 'star';
  return 'mega';
}

export function detonateBomb(world: WorldState, bombId: string, events: SimEvent[]): void {
  const index = world.bombs.findIndex((b) => b.id === bombId);
  if (index === -1) return;

  const [bomb] = world.bombs.splice(index, 1);
  const owner = world.players.find((p) => p.id === bomb.ownerId);
  if (owner && owner.activeBombs > 0) {
    owner.activeBombs -= 1;
  }

  const cells: ExplosionCell[] = [{ gx: bomb.gx, gy: bomb.gy, kind: 'center' }];
  const chainBombIds: string[] = [];

  const dirs: Array<{
    dx: number;
    dy: number;
    midKind: 'h' | 'v';
    endKind: 'end-left' | 'end-right' | 'end-up' | 'end-down';
  }> = [
    { dx: -1, dy: 0, midKind: 'h', endKind: 'end-left' },
    { dx: 1, dy: 0, midKind: 'h', endKind: 'end-right' },
    { dx: 0, dy: -1, midKind: 'v', endKind: 'end-up' },
    { dx: 0, dy: 1, midKind: 'v', endKind: 'end-down' },
  ];

  for (const dir of dirs) {
    for (let step = 1; step <= bomb.range; step++) {
      const tx = bomb.gx + dir.dx * step;
      const ty = bomb.gy + dir.dy * step;
      if (tx < 0 || tx >= world.cols || ty < 0 || ty >= world.rows) break;

      const cell = world.grid[ty][tx];
      if (cell === 'wall') break;

      if (cell === 'crate') {
        world.grid[ty][tx] = 'empty';
        if (owner) {
          owner.cratesBroken += 1;
          owner.score += 25;
        }
        events.push({ type: 'crate_break', gx: tx, gy: ty, playerId: bomb.ownerId });

        // Check if this crate hid the Exit Door
        if (world.exitDoor && world.exitDoor.gx === tx && world.exitDoor.gy === ty && !world.exitDoor.revealed) {
          world.exitDoor.revealed = true;
          events.push({ type: 'door_revealed', gx: tx, gy: ty, playerId: bomb.ownerId });
        } else {
          const drop = rollPowerUp(world.tick * 31 + tx * 17 + ty * 53 + world.nextIdCounter);
          if (drop) {
            world.powerUps.push({
              id: nextEntityId(world, 'pu'),
              gx: tx,
              gy: ty,
              type: drop,
              spawnAnim: 0,
            });
          }
        }
        cells.push({
          gx: tx,
          gy: ty,
          kind: bomb.piercing && step < bomb.range ? dir.midKind : dir.endKind,
        });
        if (!bomb.piercing) break;
        continue;
      }

      // Power-ups spawned from broken crates are indestructible by bomb blasts

      const hitBomb = world.bombs.find((b) => b.gx === tx && b.gy === ty);
      if (hitBomb) {
        chainBombIds.push(hitBomb.id);
      }

      cells.push({
        gx: tx,
        gy: ty,
        kind: step === bomb.range ? dir.endKind : dir.midKind,
      });
    }
  }

  world.explosions.push({
    id: nextEntityId(world, 'exp'),
    ownerId: bomb.ownerId,
    timer: EXPLOSION_DURATION,
    maxTimer: EXPLOSION_DURATION,
    cells,
  });

  world.hitstopTimer = Math.max(world.hitstopTimer, 0.032);
  events.push({ type: 'explode', gx: bomb.gx, gy: bomb.gy, intensity: bomb.range, playerId: bomb.ownerId });

  for (const cid of chainBombIds) {
    detonateBomb(world, cid, events);
  }
}

function updateMovingBombs(world: WorldState, dt: number): void {
  for (const bomb of world.bombs) {
    if (bomb.vx === 0 && bomb.vy === 0) continue;

    const nextX = bomb.x + bomb.vx * dt;
    const nextY = bomb.y + bomb.vy * dt;
    const nextGx = Math.floor(nextX);
    const nextGy = Math.floor(nextY);

    const blockedByGrid =
      nextGx < 0 ||
      nextGx >= world.cols ||
      nextGy < 0 ||
      nextGy >= world.rows ||
      world.grid[nextGy][nextGx] !== 'empty';

    const blockedByBomb = world.bombs.some(
      (other) => other.id !== bomb.id && other.gx === nextGx && other.gy === nextGy
    );

    const blockedByPlayer = world.players.some(
      (p) =>
        p.alive &&
        Math.floor(p.x) === nextGx &&
        Math.floor(p.y) === nextGy &&
        (nextGx !== bomb.gx || nextGy !== bomb.gy)
    );

    if (blockedByGrid || blockedByBomb || blockedByPlayer) {
      bomb.x = bomb.gx + 0.5;
      bomb.y = bomb.gy + 0.5;
      bomb.vx = 0;
      bomb.vy = 0;
    } else {
      bomb.x = nextX;
      bomb.y = nextY;
      bomb.gx = Math.floor(bomb.x);
      bomb.gy = Math.floor(bomb.y);
    }
  }
}

function applySuddenDeathStep(world: WorldState, events: SimEvent[]): void {
  const maxRings = 3;
  let remaining = world.suddenDeathStep;
  let ring = 0;
  let perimeter: Array<{ gx: number; gy: number }> = [];

  while (ring < maxRings) {
    const ringCells: Array<{ gx: number; gy: number }> = [];
    for (let x = ring; x < world.cols - ring; x++) ringCells.push({ gx: x, gy: ring });
    for (let y = ring + 1; y < world.rows - ring; y++) ringCells.push({ gx: world.cols - 1 - ring, gy: y });
    for (let x = world.cols - 2 - ring; x >= ring; x--) ringCells.push({ gx: x, gy: world.rows - 1 - ring });
    for (let y = world.rows - 2 - ring; y > ring; y--) ringCells.push({ gx: ring, gy: y });
    if (remaining < ringCells.length) {
      perimeter = ringCells;
      break;
    }
    remaining -= ringCells.length;
    ring += 1;
  }
  if (ring >= maxRings || perimeter.length === 0) return;

  const target = perimeter[remaining];
  world.suddenDeathStep += 1;
  if (!target) return;

  // Never crush the exit door tile!
  if (world.exitDoor && world.exitDoor.gx === target.gx && world.exitDoor.gy === target.gy) {
    return;
  }

  world.grid[target.gy][target.gx] = 'wall';
  world.powerUps = world.powerUps.filter((p) => !(p.gx === target.gx && p.gy === target.gy));

  const crushedBomb = world.bombs.find((b) => b.gx === target.gx && b.gy === target.gy);
  if (crushedBomb) {
    detonateBomb(world, crushedBomb.id, events);
  }

  for (const p of world.players) {
    if (!p.alive) continue;
    if (Math.floor(p.x) === target.gx && Math.floor(p.y) === target.gy) {
      p.alive = false;
      p.koTimer = 0.42;
      events.push({ type: 'player_ko', gx: target.gx, gy: target.gy, playerId: p.id });
    }
  }
}

export function stepWorld(
  world: WorldState,
  inputs: Record<string, PlayerInput>,
  rawDt: number,
  localPlayerId?: string
): WorldState {
  if (world.matchFinished) {
    world.events = [];
    return world;
  }

  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const events: SimEvent[] = [];

  if (world.hitstopTimer > 0) {
    world.hitstopTimer = Math.max(0, world.hitstopTimer - dt);
    for (const p of world.players) {
      if (p.hitFlashTimer > 0) p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
    }
    world.events = [];
    return world;
  }

  world.tick += 1;
  world.elapsedTime += dt;
  world.timeRemaining = Math.max(0, world.timeRemaining - dt);

  for (const player of world.players) {
    if (player.koTimer > 0) player.koTimer = Math.max(0, player.koTimer - dt);
    if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    if (player.hitFlashTimer > 0) player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);

    if (player.starTimer > 0) {
      player.starTimer = Math.max(0, player.starTimer - dt);
      if (player.starTimer > 0) {
        player.invulnTimer = Math.max(player.invulnTimer, 0.12);
      }
    }

    if (player.ghostTimer > 0) {
      player.ghostTimer = Math.max(0, player.ghostTimer - dt);
      // Keep ghost phase active slightly if still overlapping a crate so player never gets wedged
      if (player.ghostTimer === 0) {
        const minGx = Math.floor(player.x - PLAYER_HIT_RADIUS);
        const maxGx = Math.floor(player.x + PLAYER_HIT_RADIUS);
        const minGy = Math.floor(player.y - PLAYER_HIT_RADIUS);
        const maxGy = Math.floor(player.y + PLAYER_HIT_RADIUS);
        let insideCrate = false;
        for (let gy = Math.max(0, minGy); gy <= Math.min(world.rows - 1, maxGy); gy++) {
          for (let gx = Math.max(0, minGx); gx <= Math.min(world.cols - 1, maxGx); gx++) {
            if (world.grid[gy][gx] === 'crate') insideCrate = true;
          }
        }
        if (insideCrate) player.ghostTimer = 0.08;
      }
    }

    // Tick Combo window decay
    if (player.comboTimer > 0) {
      player.comboTimer = Math.max(0, player.comboTimer - dt);
      if (player.comboTimer <= 0) {
        player.comboCount = 0;
        player.comboMultiplier = 1;
      }
    }

    if (!player.alive) continue;

    const input = inputs[player.id] ?? { dx: 0, dy: 0, placeBomb: false };
    tryMovePlayer(world, player, input.dx, input.dy, dt, events, Boolean((input as { dash?: boolean }).dash));
    if (input.placeBomb) {
      placeBombForPlayer(world, player, events);
    }

    const pgx = Math.floor(player.x);
    const pgy = Math.floor(player.y);

    // Power-up collection: only human players can pick up power-ups; bugs cannot collect them
    if (!player.isBot) {
      const puIdx = world.powerUps.findIndex((pu) => pu.gx === pgx && pu.gy === pgy);
      if (puIdx !== -1) {
        const [pu] = world.powerUps.splice(puIdx, 1);
        switch (pu.type) {
          case 'bomb':
            player.maxBombs = Math.min(6, player.maxBombs + 1);
            break;
          case 'flame':
            player.flameRange = Math.min(6, player.flameRange + 1);
            break;
          case 'speed':
            player.speedLevel = Math.min(4, player.speedLevel + 1);
            break;
          case 'kick':
            player.canKick = true;
            break;
          case 'shield':
            player.hasShield = true;
            break;
          case 'pierce':
            player.hasPierce = true;
            break;
          case 'ghost':
            player.ghostTimer = Math.max(player.ghostTimer, 12.0);
            break;
          case 'star':
            player.starTimer = Math.max(player.starTimer, 8.0);
            player.invulnTimer = Math.max(player.invulnTimer, 8.0);
            break;
          case 'mega':
            player.maxBombs = Math.min(6, player.maxBombs + 1);
            player.flameRange = Math.min(6, player.flameRange + 1);
            player.speedLevel = Math.min(4, player.speedLevel + 1);
            player.score += 125;
            break;
        }
        player.score += 75;
        events.push({ type: 'powerup_pickup', gx: pgx, gy: pgy, powerUpType: pu.type, playerId: player.id });
      }
    }

    // Check Exit Door entry for any real player (Solo or Multiplayer):
    // Requires ALL bugs to be eliminated first, AND a player to reach the revealed door.
    const allBugsEliminated = world.players.every((p) => !p.isBot || !p.alive);
    if (
      !player.isBot &&
      allBugsEliminated &&
      world.exitDoor &&
      world.exitDoor.revealed &&
      pgx === world.exitDoor.gx &&
      pgy === world.exitDoor.gy
    ) {
      player.score += 400;
      world.matchFinished = true;
      world.winnerId = player.id;
      world.endReason = localPlayerId ? (player.id === localPlayerId ? 'victory' : 'defeat') : 'victory';
      events.push({ type: 'door_enter', gx: pgx, gy: pgy, playerId: player.id });
    }
  }

  // Bot chaser contact: Star-powered humans crush bugs on contact; otherwise bugs eat humans!
  if (!world.matchFinished) {
    for (const bot of world.players) {
      if (!bot.isBot || !bot.alive) continue;
      for (const human of world.players) {
        if (human.isBot || !human.alive) continue;
        const dist = Math.hypot(bot.x - human.x, bot.y - human.y);
        if (dist >= BOT_EAT_RADIUS) continue;

        if (human.starTimer > 0) {
          const bgx = Math.floor(bot.x);
          const bgy = Math.floor(bot.y);
          bot.alive = false;
          bot.koTimer = 0.45;
          bot.hitFlashTimer = 0.2;
          world.hitstopTimer = Math.max(world.hitstopTimer, 0.045);
          human.kills += 1;
          human.comboCount += 1;
          human.comboTimer = COMBO_WINDOW_SECONDS;
          human.comboMultiplier = Math.min(5, 1 + (human.comboCount - 1) * 0.5);
          human.maxCombo = Math.max(human.maxCombo, human.comboCount);
          const bonusPoints = Math.round(300 * human.comboMultiplier);
          human.score += bonusPoints;
          events.push({
            type: 'combo_up',
            gx: bgx,
            gy: bgy,
            playerId: human.id,
            comboCount: human.comboCount,
            comboMultiplier: human.comboMultiplier,
            bonusPoints,
          });
          events.push({ type: 'player_ko', gx: bgx, gy: bgy, playerId: bot.id });
          break;
        }

        if (human.invulnTimer > 0) continue;
        const hgx = Math.floor(human.x);
        const hgy = Math.floor(human.y);
        if (human.hasShield) {
          human.hasShield = false;
          human.invulnTimer = 1.6;
          human.hitFlashTimer = 0.18;
          events.push({ type: 'shield_break', gx: hgx, gy: hgy, playerId: human.id });
        } else {
          human.alive = false;
          human.koTimer = 0.45;
          human.hitFlashTimer = 0.2;
          world.hitstopTimer = Math.max(world.hitstopTimer, 0.055);
          bot.kills += 1;
          bot.score += 300;
          events.push({ type: 'player_ko', gx: hgx, gy: hgy, playerId: human.id });
        }
      }
    }
  }

  for (const pu of world.powerUps) {
    pu.spawnAnim = Math.min(1, pu.spawnAnim + dt * 4);
  }

  updateMovingBombs(world, dt);

  const toDetonate: string[] = [];
  for (const bomb of world.bombs) {
    bomb.fuseTimer -= dt;
    if (bomb.fuseTimer <= 0) {
      toDetonate.push(bomb.id);
    }
  }
  for (const id of toDetonate) {
    detonateBomb(world, id, events);
  }

  const activeExplosions = [];
  for (const exp of world.explosions) {
    exp.timer -= dt;
    if (exp.timer > 0) {
      activeExplosions.push(exp);
      for (const player of world.players) {
        if (!player.alive || player.invulnTimer > 0) continue;
        const pgx = Math.floor(player.x);
        const pgy = Math.floor(player.y);
        const hit = exp.cells.some((c) => c.gx === pgx && c.gy === pgy);
        if (hit) {
          if (player.hasShield) {
            player.hasShield = false;
            player.invulnTimer = 1.4;
            player.hitFlashTimer = 0.16;
            events.push({ type: 'shield_break', gx: pgx, gy: pgy, playerId: player.id });
          } else if (player.hp > 1) {
            player.hp -= 1;
            player.invulnTimer = 0.65;
            player.hitFlashTimer = 0.22;
            events.push({ type: 'armor_crack', gx: pgx, gy: pgy, playerId: player.id });
          } else {
            player.hp = 0;
            player.alive = false;
            player.koTimer = 0.45;
            player.hitFlashTimer = 0.2;
            world.hitstopTimer = Math.max(world.hitstopTimer, 0.055);
            if (exp.ownerId && exp.ownerId !== player.id) {
              const killer = world.players.find((k) => k.id === exp.ownerId);
              if (killer) {
                killer.kills += 1;
                // Combo multiplier progression: 1.0x -> 1.5x -> 2.0x -> ... up to 5.0x
                killer.comboCount += 1;
                killer.comboTimer = COMBO_WINDOW_SECONDS;
                killer.comboMultiplier = Math.min(5, 1 + (killer.comboCount - 1) * 0.5);
                killer.maxCombo = Math.max(killer.maxCombo, killer.comboCount);
                const bonusPoints = Math.round(300 * killer.comboMultiplier);
                killer.score += bonusPoints;
                events.push({
                  type: 'combo_up',
                  gx: pgx,
                  gy: pgy,
                  playerId: killer.id,
                  comboCount: killer.comboCount,
                  comboMultiplier: killer.comboMultiplier,
                  bonusPoints,
                });
              }
            }
            events.push({ type: 'player_ko', gx: pgx, gy: pgy, playerId: player.id });
          }
        }
      }
    }
  }
  world.explosions = activeExplosions;

  if (world.timeRemaining <= SUDDEN_DEATH_WINDOW_SECONDS) {
    world.suddenDeathTimer += dt;
    if (world.suddenDeathTimer >= 0.35) {
      world.suddenDeathTimer = 0;
      applySuddenDeathStep(world, events);
    }
  }

  // Check end conditions
  if (!world.matchFinished) {
    const humans = world.players.filter((p) => !p.isBot);
    const bots = world.players.filter((p) => p.isBot);
    const aliveHumans = humans.filter((p) => p.alive);
    const anyHumanKoAnimating = humans.some((p) => !p.alive && p.koTimer > 0.05);

    if (world.exitDoor) {
      // Exit Door mode (Solo or Multiplayer with AI chasers):
      // Victory occurs when a human enters the exitDoor (handled above), or if 0 bots and only 1 of >=2 humans survives.
      if (humans.length > 0 && aliveHumans.length === 0 && !anyHumanKoAnimating) {
        world.matchFinished = true;
        const topBot = [...bots].sort((a, b) => b.kills - a.kills || b.score - a.score)[0];
        world.winnerId = topBot?.id ?? null;
        world.endReason = 'defeat';
      } else if (bots.length === 0 && humans.length > 1 && aliveHumans.length === 1 && !anyHumanKoAnimating) {
        const winner = aliveHumans[0];
        winner.score += 500;
        world.matchFinished = true;
        world.winnerId = winner.id;
        world.endReason = localPlayerId ? (winner.id === localPlayerId ? 'victory' : 'defeat') : 'victory';
      } else if (world.timeRemaining <= 0) {
        // Time ran out before all bugs were cleared and the exit door was entered: level is NOT completed.
        world.matchFinished = true;
        world.winnerId = null;
        world.endReason = 'timeout';
      }
    } else {
      // Classic PvP elimination mode (no exit door)
      const alivePlayers = world.players.filter((p) => p.alive);
      if (world.players.length > 1 && alivePlayers.length <= 1) {
        const anyKoAnimating = world.players.some((p) => !p.alive && p.koTimer > 0.05);
        if (!anyKoAnimating) {
          world.matchFinished = true;
          if (alivePlayers.length === 1) {
            const winner = alivePlayers[0];
            winner.score += 500;
            world.winnerId = winner.id;
            if (localPlayerId) {
              world.endReason = winner.id === localPlayerId ? 'victory' : 'defeat';
            } else {
              world.endReason = 'victory';
            }
          } else {
            world.winnerId = null;
            world.endReason = 'draw';
          }
        }
      } else if (world.timeRemaining <= 0) {
        world.matchFinished = true;
        const sorted = [...alivePlayers].sort((a, b) => b.score - a.score);
        if (sorted.length > 0 && (sorted.length === 1 || sorted[0].score > sorted[1].score)) {
          world.winnerId = sorted[0].id;
          world.endReason = localPlayerId ? (sorted[0].id === localPlayerId ? 'victory' : 'defeat') : 'timeout';
        } else {
          world.winnerId = null;
          world.endReason = 'timeout';
        }
      }
    }
  }

  world.events = events;
  return world;
}
