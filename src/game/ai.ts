import {
  PlayerInput,
  PlayerState,
  WorldState,
} from './types';

function tileKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

interface WanderMemory {
  prevGx: number;
  prevGy: number;
  targetGx: number;
  targetGy: number;
  lastX: number;
  lastY: number;
  lastTick: number;
  stallCount: number;
  paceDir: 1 | -1;
}

const worldWanderMemory = new WeakMap<WorldState, Map<string, WanderMemory>>();

function getBotWanderMemory(world: WorldState, botId: string): WanderMemory | undefined {
  return worldWanderMemory.get(world)?.get(botId);
}

function setBotWanderMemory(world: WorldState, botId: string, mem: WanderMemory): void {
  let map = worldWanderMemory.get(world);
  if (!map) {
    map = new Map();
    worldWanderMemory.set(world, map);
  }
  map.set(botId, mem);
}

/**
 * Computes set of tiles currently threatened by explosions or bomb blast lanes.
 */
export function computeDangerMap(world: WorldState): Set<string> {
  const danger = new Set<string>();

  for (const exp of world.explosions) {
    for (const c of exp.cells) {
      danger.add(tileKey(c.gx, c.gy));
    }
  }

  for (const bomb of world.bombs) {
    danger.add(tileKey(bomb.gx, bomb.gy));
    const dirs = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];
    for (const d of dirs) {
      for (let s = 1; s <= bomb.range; s++) {
        const tx = bomb.gx + d.dx * s;
        const ty = bomb.gy + d.dy * s;
        if (tx < 0 || tx >= world.cols || ty < 0 || ty >= world.rows) break;
        const cell = world.grid[ty][tx];
        if (cell === 'wall') break;
        danger.add(tileKey(tx, ty));
        if (cell === 'crate') break;
      }
    }
  }

  return danger;
}

export function computeActiveFlames(world: WorldState): Set<string> {
  const flames = new Set<string>();
  for (const exp of world.explosions) {
    for (const c of exp.cells) {
      flames.add(tileKey(c.gx, c.gy));
    }
  }
  return flames;
}

function canBotTraverse(
  world: WorldState,
  gx: number,
  gy: number,
  bot: PlayerState,
  flames?: Set<string>
): boolean {
  if (gx < 0 || gx >= world.cols || gy < 0 || gy >= world.rows) return false;
  const cell = world.grid[gy][gx];
  if (cell === 'wall') return false;
  if (cell === 'crate') return false;
  if (flames && flames.has(tileKey(gx, gy))) return false;
  const bomb = world.bombs.find((b) => b.gx === gx && b.gy === gy);
  if (bomb && !bot.passThroughBombIds.includes(bomb.id)) return false;
  return true;
}

/**
 * Checks if there is an unobstructed straight corridor line-of-sight between two tiles.
 * Returns true ONLY if they share the exact same row (gy === ty) OR same column (gx === tx)
 * AND no wall, crate, or bomb sits between them.
 */
export function hasClearCorridorLineOfSight(
  world: WorldState,
  gx1: number,
  gy1: number,
  gx2: number,
  gy2: number
): boolean {
  if (gx1 !== gx2 && gy1 !== gy2) return false;

  if (gy1 === gy2) {
    const minX = Math.min(gx1, gx2);
    const maxX = Math.max(gx1, gx2);
    for (let x = minX; x <= maxX; x++) {
      if (world.grid[gy1]?.[x] !== 'empty') return false;
      // Dropped bombs act like solid walls blocking corridor sight
      if (x !== gx1 && world.bombs.some((b) => b.gx === x && b.gy === gy1)) {
        return false;
      }
    }
    return true;
  }

  const minY = Math.min(gy1, gy2);
  const maxY = Math.max(gy1, gy2);
  for (let y = minY; y <= maxY; y++) {
    if (world.grid[y]?.[gx1] !== 'empty') return false;
    if (y !== gy1 && world.bombs.some((b) => b.gx === gx1 && b.gy === y)) {
      return false;
    }
  }
  return true;
}

/**
 * Finds the nearest alive human player visible in the bot's own unobstructed corridor.
 * Bots CANNOT see players in other corridors or behind walls/crates/bombs.
 */
export function findVisibleHumanInCorridor(
  world: WorldState,
  bot: PlayerState
): PlayerState | null {
  const gx = Math.floor(bot.x);
  const gy = Math.floor(bot.y);
  const humans = world.players.filter((p) => !p.isBot && p.alive);
  let best: PlayerState | null = null;
  let bestDist = Infinity;

  for (const h of humans) {
    const hx = Math.floor(h.x);
    const hy = Math.floor(h.y);
    if (!hasClearCorridorLineOfSight(world, gx, gy, hx, hy)) continue;
    const dist = Math.hypot(h.x - bot.x, h.y - bot.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = h;
    }
  }

  return best;
}

function moveTowardTileCenter(bot: PlayerState, targetGx: number, targetGy: number): { dx: number; dy: number } {
  const curGx = Math.floor(bot.x);
  const curGy = Math.floor(bot.y);
  const curCenterX = curGx + 0.5;
  const curCenterY = curGy + 0.5;

  // If moving into a neighboring row/col, center on current lane axis first so we never snag on pillars
  if (targetGx !== curGx && Math.abs(bot.y - curCenterY) > 0.14) {
    return { dx: 0, dy: Math.sign(curCenterY - bot.y) };
  }
  if (targetGy !== curGy && Math.abs(bot.x - curCenterX) > 0.14) {
    return { dx: Math.sign(curCenterX - bot.x), dy: 0 };
  }

  const tx = targetGx + 0.5;
  const ty = targetGy + 0.5;
  const diffX = tx - bot.x;
  const diffY = ty - bot.y;

  let dx = 0;
  let dy = 0;
  if (Math.abs(diffX) > 0.04) dx = Math.sign(diffX);
  if (Math.abs(diffY) > 0.04) dy = Math.sign(diffY);

  if (dx !== 0 && dy !== 0) {
    if (Math.abs(diffX) > Math.abs(diffY)) {
      dy = 0;
    } else {
      dx = 0;
    }
  }
  return { dx, dy };
}

function steerDirectlyToTarget(bot: PlayerState, targetX: number, targetY: number): { dx: number; dy: number } {
  const diffX = targetX - bot.x;
  const diffY = targetY - bot.y;
  if (Math.abs(diffX) < 0.04 && Math.abs(diffY) < 0.04) {
    return { dx: 0, dy: 0 };
  }
  if (Math.abs(diffX) >= Math.abs(diffY)) {
    return { dx: Math.sign(diffX), dy: 0 };
  }
  return { dx: 0, dy: Math.sign(diffY) };
}

/**
 * Computes AI input for non-bombing bug enemies:
 * - Never drops bombs (placeBomb is always false).
 * - Treats dropped bombs strictly as solid walls (does not anticipate bomb blast zones).
 * - Never stops moving: attacks along clear corridor LOS, wanders, or paces inside current cell.
 */
export function computeBotInput(world: WorldState, bot: PlayerState): PlayerInput {
  if (!bot.alive) return { dx: 0, dy: 0, placeBomb: false };

  const gx = Math.floor(bot.x);
  const gy = Math.floor(bot.y);
  const flames = computeActiveFlames(world);

  const prevMem = getBotWanderMemory(world, bot.id);
  const distMoved =
    prevMem && world.tick > prevMem.lastTick
      ? Math.hypot(bot.x - prevMem.lastX, bot.y - prevMem.lastY)
      : 1;
  const stallCount =
    prevMem && world.tick > prevMem.lastTick
      ? distMoved < 0.002
        ? prevMem.stallCount + 1
        : 0
      : prevMem?.stallCount ?? 0;

  let paceDir: 1 | -1 = prevMem?.paceDir ?? 1;

  const commitMove = (
    dx: number,
    dy: number,
    prevGx = prevMem?.prevGx ?? gx,
    prevGy = prevMem?.prevGy ?? gy,
    targetGx = prevMem?.targetGx ?? gx,
    targetGy = prevMem?.targetGy ?? gy,
    resetStall = false,
    dash = false
  ): PlayerInput => {
    setBotWanderMemory(world, bot.id, {
      prevGx,
      prevGy,
      targetGx,
      targetGy,
      lastX: bot.x,
      lastY: bot.y,
      lastTick: world.tick,
      stallCount: resetStall ? 0 : stallCount,
      paceDir,
    });
    return { dx, dy, placeBomb: false, dash };
  };

  // 1. Line-of-Sight Corridor Attack: ONLY if a human is in the same corridor with no walls/crates/bombs between
  if (stallCount < 3) {
    const visibleHuman = findVisibleHumanInCorridor(world, bot);
    if (visibleHuman) {
      const targetGx = Math.floor(visibleHuman.x);
      const targetGy = Math.floor(visibleHuman.y);
      const nextGx = gx + Math.sign(targetGx - gx);
      const nextGy = gy + Math.sign(targetGy - gy);

      if (canBotTraverse(world, nextGx, nextGy, bot, flames)) {
        const shouldDash = bot.botVariant === 'charger';
        if (gy === targetGy && Math.abs(bot.y - (gy + 0.5)) > 0.22) {
          return commitMove(0, Math.sign(gy + 0.5 - bot.y), gx, gy, nextGx, nextGy, false, shouldDash);
        }
        if (gx === targetGx && Math.abs(bot.x - (gx + 0.5)) > 0.22) {
          return commitMove(Math.sign(gx + 0.5 - bot.x), 0, gx, gy, nextGx, nextGy, false, shouldDash);
        }
        const move = steerDirectlyToTarget(bot, visibleHuman.x, visibleHuman.y);
        if (move.dx !== 0 || move.dy !== 0) {
          return commitMove(move.dx, move.dy, gx, gy, nextGx, nextGy, false, shouldDash);
        }
      }
    }
  }

  // 2. Continuous Corridor Wandering (treats dropped bombs as walls; never stops!)
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const isTargetAdjacentOrHere =
    prevMem !== undefined &&
    Math.abs(prevMem.targetGx - gx) + Math.abs(prevMem.targetGy - gy) <= 1;

  const reachedTarget =
    !prevMem ||
    !isTargetAdjacentOrHere ||
    stallCount >= 2 ||
    (Math.floor(bot.x) === prevMem.targetGx &&
      Math.floor(bot.y) === prevMem.targetGy &&
      Math.hypot(bot.x - (prevMem.targetGx + 0.5), bot.y - (prevMem.targetGy + 0.5)) < 0.24);

  const targetStillWalkable =
    prevMem &&
    isTargetAdjacentOrHere &&
    (prevMem.targetGx !== gx || prevMem.targetGy !== gy) &&
    canBotTraverse(world, prevMem.targetGx, prevMem.targetGy, bot, flames);

  if (!reachedTarget && targetStillWalkable && prevMem) {
    const move = moveTowardTileCenter(bot, prevMem.targetGx, prevMem.targetGy);
    if (move.dx !== 0 || move.dy !== 0) {
      return commitMove(move.dx, move.dy, prevMem.prevGx, prevMem.prevGy, prevMem.targetGx, prevMem.targetGy);
    }
  }

  const walkableNeighbors = dirs
    .map((d) => ({ nx: gx + d.dx, ny: gy + d.dy }))
    .filter(({ nx, ny }) => canBotTraverse(world, nx, ny, bot, flames));

  if (walkableNeighbors.length > 0) {
    // Avoid immediate 180-degree backtracking or repeating a stalled target unless at a dead end
    const preferred = walkableNeighbors.filter((n) => {
      if (stallCount >= 2 && prevMem && n.nx === prevMem.targetGx && n.ny === prevMem.targetGy) {
        return false;
      }
      if (prevMem && n.nx === prevMem.prevGx && n.ny === prevMem.prevGy) {
        return false;
      }
      return true;
    });
    const pool = preferred.length > 0 ? preferred : walkableNeighbors;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const move = moveTowardTileCenter(bot, chosen.nx, chosen.ny);
    if (move.dx !== 0 || move.dy !== 0) {
      return commitMove(move.dx, move.dy, gx, gy, chosen.nx, chosen.ny, stallCount >= 2);
    }
  }

  // Fallback: if surrounded by walls/crates/bombs, pace continuously inside current tile
  if (distMoved < 0.002 && prevMem && prevMem.targetGx === gx && prevMem.targetGy === gy) {
    paceDir = paceDir === 1 ? -1 : 1;
  } else if (bot.x <= gx + 0.44) {
    paceDir = 1;
  } else if (bot.x >= gx + 0.56) {
    paceDir = -1;
  }
  return commitMove(paceDir, 0, gx, gy, gx, gy, true);
}

