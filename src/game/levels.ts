import { BotVariant, MAX_MP_LEVEL, MAX_SOLO_LEVEL } from './types';

export interface LevelBiome {
  id: number;
  name: string;
  uiName: string;
  // Canvas Arena Theme
  bgOuter: string;
  frameBg: string;
  frameBorder: string;
  floorTint: string;
  checkerTint: string;
  pillarBase: string;
  pillarTop: string;
  pillarStroke: string;
  crateDark: string;
  crateMid: string;
  crateInner: string;
  crateStrap: string;
  // Distinct HUD UI Interface Styling
  hudPanelBg: string;
  hudBorderColor: string;
  hudAccentColor: string;
  hudBadgeBg: string;
  nodeColor: string;
}

export const LEVEL_BIOMES: LevelBiome[] = [
  {
    id: 0,
    name: 'Zümrüt Vadi Kalesi',
    uiName: 'Kale Arayüzü',
    bgOuter: '#0F1922',
    frameBg: '#1E3A3A',
    frameBorder: '#2DD4BF',
    floorTint: 'rgba(16, 65, 58, 0.34)',
    checkerTint: 'rgba(52, 211, 153, 0.09)',
    pillarBase: '#1E3A5F',
    pillarTop: '#2E5A88',
    pillarStroke: '#38BDF8',
    crateDark: '#92400E',
    crateMid: '#D97706',
    crateInner: '#F59E0B',
    crateStrap: '#78350F',
    hudPanelBg: 'rgba(15, 29, 36, 0.92)',
    hudBorderColor: 'rgba(45, 212, 191, 0.45)',
    hudAccentColor: '#5EEAD4',
    hudBadgeBg: 'rgba(13, 148, 136, 0.22)',
    nodeColor: '#2DD4BF',
  },
  {
    id: 1,
    name: 'Kızıl Lav Tapınağı',
    uiName: 'Volkan Arayüzü',
    bgOuter: '#1C1017',
    frameBg: '#3D1E26',
    frameBorder: '#FB7185',
    floorTint: 'rgba(88, 28, 36, 0.34)',
    checkerTint: 'rgba(251, 146, 60, 0.09)',
    pillarBase: '#3F273B',
    pillarTop: '#5E3856',
    pillarStroke: '#F472B6',
    crateDark: '#7C2D12',
    crateMid: '#C2410C',
    crateInner: '#EA580C',
    crateStrap: '#431407',
    hudPanelBg: 'rgba(38, 16, 24, 0.92)',
    hudBorderColor: 'rgba(251, 113, 133, 0.48)',
    hudAccentColor: '#FDA4AF',
    hudBadgeBg: 'rgba(225, 29, 72, 0.22)',
    nodeColor: '#FB7185',
  },
  {
    id: 2,
    name: 'Safir Buzul Zindanı',
    uiName: 'Buzul Arayüzü',
    bgOuter: '#0E1529',
    frameBg: '#1E2D52',
    frameBorder: '#60A5FA',
    floorTint: 'rgba(30, 58, 138, 0.30)',
    checkerTint: 'rgba(125, 211, 252, 0.10)',
    pillarBase: '#1E3A8A',
    pillarTop: '#2563EB',
    pillarStroke: '#93C5FD',
    crateDark: '#854D0E',
    crateMid: '#CA8A04',
    crateInner: '#EAB308',
    crateStrap: '#713F12',
    hudPanelBg: 'rgba(15, 26, 56, 0.92)',
    hudBorderColor: 'rgba(96, 165, 250, 0.50)',
    hudAccentColor: '#93C5FD',
    hudBadgeBg: 'rgba(37, 99, 235, 0.25)',
    nodeColor: '#60A5FA',
  },
  {
    id: 3,
    name: 'Altın Şampiyona Arenası',
    uiName: 'İmparatorluk Arayüzü',
    bgOuter: '#171126',
    frameBg: '#342357',
    frameBorder: '#FACC15',
    floorTint: 'rgba(76, 29, 149, 0.30)',
    checkerTint: 'rgba(250, 204, 21, 0.09)',
    pillarBase: '#3B2364',
    pillarTop: '#5B349C',
    pillarStroke: '#E879F9',
    crateDark: '#881337',
    crateMid: '#BE123C',
    crateInner: '#E11D48',
    crateStrap: '#4C0519',
    hudPanelBg: 'rgba(30, 20, 54, 0.92)',
    hudBorderColor: 'rgba(250, 204, 21, 0.50)',
    hudAccentColor: '#FDE047',
    hudBadgeBg: 'rgba(202, 138, 4, 0.24)',
    nodeColor: '#FACC15',
  },
  {
    id: 4,
    name: 'Zehirli Orman Labirenti',
    uiName: 'Biyo-Orman Arayüzü',
    bgOuter: '#0D1912',
    frameBg: '#1D3B25',
    frameBorder: '#A3E635',
    floorTint: 'rgba(34, 84, 38, 0.32)',
    checkerTint: 'rgba(163, 230, 53, 0.09)',
    pillarBase: '#1F3A2C',
    pillarTop: '#2E5942',
    pillarStroke: '#84CC16',
    crateDark: '#713F12',
    crateMid: '#A16207',
    crateInner: '#D97706',
    crateStrap: '#422006',
    hudPanelBg: 'rgba(16, 36, 22, 0.92)',
    hudBorderColor: 'rgba(163, 230, 53, 0.45)',
    hudAccentColor: '#BEF264',
    hudBadgeBg: 'rgba(101, 163, 13, 0.24)',
    nodeColor: '#A3E635',
  },
  {
    id: 5,
    name: 'Çöl Kum Fırtınası',
    uiName: 'Çöl Kalesi Arayüzü',
    bgOuter: '#1E150C',
    frameBg: '#4A2F18',
    frameBorder: '#F59E0B',
    floorTint: 'rgba(120, 68, 22, 0.30)',
    checkerTint: 'rgba(251, 191, 36, 0.10)',
    pillarBase: '#4E342E',
    pillarTop: '#6D4C41',
    pillarStroke: '#FBBF24',
    crateDark: '#78350F',
    crateMid: '#B45309',
    crateInner: '#F59E0B',
    crateStrap: '#451A03',
    hudPanelBg: 'rgba(42, 27, 15, 0.92)',
    hudBorderColor: 'rgba(245, 158, 11, 0.50)',
    hudAccentColor: '#FCD34D',
    hudBadgeBg: 'rgba(217, 119, 6, 0.24)',
    nodeColor: '#F59E0B',
  },
  {
    id: 6,
    name: 'Siber Neon Çekirdeği',
    uiName: 'Siber Arayüz',
    bgOuter: '#090D18',
    frameBg: '#112240',
    frameBorder: '#22D3EE',
    floorTint: 'rgba(8, 47, 73, 0.36)',
    checkerTint: 'rgba(34, 211, 238, 0.10)',
    pillarBase: '#162944',
    pillarTop: '#1E3F66',
    pillarStroke: '#22D3EE',
    crateDark: '#701A75',
    crateMid: '#A21CAF',
    crateInner: '#D946EF',
    crateStrap: '#4A044E',
    hudPanelBg: 'rgba(9, 17, 34, 0.94)',
    hudBorderColor: 'rgba(34, 211, 238, 0.55)',
    hudAccentColor: '#67E8F9',
    hudBadgeBg: 'rgba(6, 182, 212, 0.24)',
    nodeColor: '#22D3EE',
  },
  {
    id: 7,
    name: 'Karanlık Kristal Uçurumu',
    uiName: 'Kristal Arayüzü',
    bgOuter: '#140C1C',
    frameBg: '#2F1942',
    frameBorder: '#E879F9',
    floorTint: 'rgba(74, 20, 102, 0.34)',
    checkerTint: 'rgba(232, 121, 249, 0.09)',
    pillarBase: '#2A1842',
    pillarTop: '#45246B',
    pillarStroke: '#F0ABFC',
    crateDark: '#881337',
    crateMid: '#9F1239',
    crateInner: '#F43F5E',
    crateStrap: '#4C0519',
    hudPanelBg: 'rgba(28, 14, 42, 0.93)',
    hudBorderColor: 'rgba(232, 121, 249, 0.50)',
    hudAccentColor: '#F5D0FE',
    hudBadgeBg: 'rgba(192, 38, 211, 0.24)',
    nodeColor: '#E879F9',
  },
];

export const BUG_VARIANT_META: Record<
  BotVariant,
  { label: string; shortDesc: string; color: string }
> = {
  slow: { label: 'Kızıl Uğur', shortDesc: 'Standart devriye', color: '#FB7185' },
  fast: { label: 'Mor Arı', shortDesc: 'En yüksek hız', color: '#C084FC' },
  armored: { label: 'Zırhlı Gergedan', shortDesc: 'Yavaş · 2 Canlı zırh', color: '#F59E0B' },
  ghost: { label: 'Hayalet Güve', shortDesc: 'Hızlı süzülür', color: '#2DD4BF' },
  charger: { label: 'Atılgan Boynuz', shortDesc: 'Koridorda depar', color: '#FB923C' },
};

export function getLevelBiome(wave: number, isSoloMode: boolean): LevelBiome {
  const safeWave = Math.max(1, wave);
  if (!isSoloMode) {
    // Multiplayer cycles themes every level for constant visual variety
    return LEVEL_BIOMES[(safeWave - 1) % LEVEL_BIOMES.length];
  }
  // Solo changes theme every level for waves 1-8, then shifts every 2 levels across 500 stages
  const idx =
    safeWave <= 8
      ? safeWave - 1
      : Math.floor((safeWave - 9) / 2 + 8) % LEVEL_BIOMES.length;
  return LEVEL_BIOMES[idx];
}

export function getBugRosterForLevel(
  wave: number,
  isSoloMode: boolean,
  botCount: number
): BotVariant[] {
  const safeCount = Math.max(0, botCount);
  const roster: BotVariant[] = [];
  if (safeCount === 0) return roster;

  if (!isSoloMode) {
    // Every MP level has >1 bug type: Wave 1 splits slow/fast; Wave 2+ rotates armored, ghost, charger
    for (let i = 0; i < safeCount; i++) {
      if (wave === 1) {
        roster.push(i % 2 === 0 ? 'slow' : 'fast');
      } else {
        const mod = i % 10;
        if (wave >= 4 && mod === 9) roster.push('charger');
        else if (wave >= 3 && mod === 7) roster.push('ghost');
        else if (wave >= 2 && mod === 5) roster.push('armored');
        else roster.push(i % 2 === 0 ? 'slow' : 'fast');
      }
    }
    return roster;
  }

  // Solo Mode: Every level has >1 distinct bug species and unlocks new species progressively
  for (let i = 0; i < safeCount; i++) {
    if (wave === 1) {
      roster.push(i % 3 === 2 ? 'fast' : 'slow');
    } else if (wave === 2) {
      if (i % 4 === 3) roster.push('armored');
      else if (i % 3 === 1) roster.push('fast');
      else roster.push('slow');
    } else if (wave <= 4) {
      if (i % 5 === 4) roster.push('ghost');
      else if (i % 4 === 3) roster.push('armored');
      else if (i % 3 === 1) roster.push('fast');
      else roster.push('slow');
    } else {
      const m = (i + wave) % 10;
      if (m === 9 || (wave >= 40 && m === 4)) roster.push('charger');
      else if (m === 7 || (wave >= 70 && m === 2)) roster.push('ghost');
      else if (m === 5 || (wave >= 25 && m === 0)) roster.push('armored');
      else if (m % 2 === 1 || wave >= 100) roster.push('fast');
      else roster.push('slow');
    }
  }
  return roster;
}

export function getUniqueVariantsForLevel(wave: number, isSoloMode: boolean, botCount: number): BotVariant[] {
  const roster = getBugRosterForLevel(wave, isSoloMode, botCount);
  return Array.from(new Set(roster));
}

export interface CampaignNode {
  level: number;
  x: number; // px in virtual 820px wide campaign map
  y: number; // px vertically downward
  angleDeg: number; // direction from previous node in degrees
  biome: LevelBiome;
  isMilestone: boolean;
  variants: BotVariant[];
}

function seededRand(seed: number): () => number {
  let state = (seed >>> 0) || 98765;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

let cachedNodes: CampaignNode[] | null = null;
let cachedMax = 0;

/**
 * Builds the 500-level Solo Campaign trail moving in deterministic random directions
 * (east, west, south-east, south-west, sharp turns and bends) with guaranteed node separation.
 */
export function generateSoloCampaignNodes(maxLevel = MAX_SOLO_LEVEL): CampaignNode[] {
  const safeMax = Math.max(1, Math.min(MAX_SOLO_LEVEL, maxLevel));
  if (cachedNodes && cachedMax === safeMax) return cachedNodes;

  const rng = seededRand(20260500);
  const nodes: CampaignNode[] = [];
  const minX = 88;
  const maxX = 732;
  const minDist = 66;

  let curX = 410;
  let curY = 64;
  // Random-direction vector angle in radians; generally trending downward while swinging wildly left/right/diagonal/up-bend
  let heading = 0.45;

  for (let level = 1; level <= safeMax; level++) {
    const biome = getLevelBiome(level, true);
    const botCount = Math.min(36, 6 + Math.floor((level - 1) * 0.25));
    const variants = getUniqueVariantsForLevel(level, true, botCount);
    const isMilestone = level === 1 || level % 10 === 0 || level === 3 || level === 5 || level === 8 || level === 12;

    if (level === 1) {
      nodes.push({
        level,
        x: Math.round(curX),
        y: Math.round(curY),
        angleDeg: 0,
        biome,
        isMilestone: true,
        variants,
      });
      continue;
    }

    let placed = false;
    let nextX = curX;
    let nextY = curY + 76;
    let chosenAngle = heading;

    // Try up to 14 randomized directional steps (allowing left, right, diagonal, slight upward loops)
    for (let attempt = 0; attempt < 14; attempt++) {
      // Pick a varied angular turn across [-135deg, +135deg] around horizontal/downward flow
      const turn = (rng() - 0.5) * 2.5;
      let candidateAngle = heading + turn;

      // Softly steer inward if close to horizontal edges
      if (curX < minX + 90) candidateAngle = -0.35 + rng() * 1.3; // head right/down-right
      else if (curX > maxX - 90) candidateAngle = Math.PI - 0.95 + rng() * 1.3; // head left/down-left
      else if (attempt > 6) {
        // Fallback downward-diagonal angle if tight loop collided
        candidateAngle = Math.PI * 0.2 + rng() * Math.PI * 0.6;
      }

      // Clamp upward component so path always makes steady forward progress down the map
      const stepLen = 78 + rng() * 24;
      const dx = Math.cos(candidateAngle) * stepLen;
      let dy = Math.sin(candidateAngle) * stepLen;
      if (dy < 16 && attempt > 4) dy = 34 + rng() * 28;
      if (dy < -24) dy = -24;

      const candX = Math.max(minX, Math.min(maxX, curX + dx));
      const candY = Math.max(nodes[0].y + 24, curY + dy);

      // Keep minimum spacing from the last 18 nodes so circles/labels never overlap
      let overlaps = false;
      for (let k = Math.max(0, nodes.length - 18); k < nodes.length; k++) {
        if (Math.hypot(candX - nodes[k].x, candY - nodes[k].y) < minDist) {
          overlaps = true;
          break;
        }
      }
      // Also prevent drifting above the most recent 6 nodes' average Y minus buffer
      const recentMaxY = nodes.slice(-4).reduce((m, n) => Math.max(m, n.y), 0);
      if (candY < recentMaxY - 40) overlaps = true;

      if (!overlaps) {
        nextX = candX;
        nextY = candY;
        chosenAngle = Math.atan2(nextY - curY, nextX - curX);
        placed = true;
        break;
      }
    }

    if (!placed) {
      const baseFloorY = nodes.slice(-16).reduce((m, n) => Math.max(m, n.y), curY);
      nextY = baseFloorY + 72;
      const side = curX > 410 ? -1 : 1;
      nextX = Math.max(minX, Math.min(maxX, curX + side * (66 + rng() * 34)));
      // Sweep X across safe bounds if needed to guarantee zero overlap with recent nodes
      for (let probe = 0; probe < 12; probe++) {
        const probeX =
          probe === 0
            ? nextX
            : minX + ((probe * 79 + Math.round(rng() * 60)) % (maxX - minX));
        let ok = true;
        for (let k = Math.max(0, nodes.length - 16); k < nodes.length; k++) {
          if (Math.hypot(probeX - nodes[k].x, nextY - nodes[k].y) < minDist) {
            ok = false;
            break;
          }
        }
        if (ok) {
          nextX = probeX;
          break;
        }
      }
      chosenAngle = Math.atan2(nextY - curY, nextX - curX);
    }

    heading = chosenAngle;
    curX = nextX;
    curY = nextY;

    nodes.push({
      level,
      x: Math.round(curX),
      y: Math.round(curY),
      angleDeg: Math.round((chosenAngle * 180) / Math.PI),
      biome,
      isMilestone,
      variants,
    });
  }

  cachedNodes = nodes;
  cachedMax = safeMax;
  return nodes;
}

export function getSoloLevelDifficultyLabel(wave: number): string {
  if (wave <= 1) return 'Kolay';
  if (wave <= 2) return 'Orta';
  if (wave <= 12) return 'Zor';
  if (wave <= 60) return 'Usta';
  if (wave <= 200) return 'Efsane';
  return 'Kabus';
}

export function getMpLevelDifficultyLabel(wave: number): string {
  const safe = Math.min(MAX_MP_LEVEL, Math.max(1, wave));
  if (safe <= 5) return 'Çok Zor';
  if (safe <= 25) return 'Ölümcül';
  if (safe <= 60) return 'Kıyamet';
  return 'İmkansız';
}

export interface DeviceLevelProgress {
  highestUnlocked: number;
  completed: number[];
}

/**
 * Strictly computes the highest unlocked level from contiguous completed levels starting at 1.
 * Prevents skipping ahead: Level N is only unlocked once Levels 1..(N-1) are all passed.
 */
export function normalizeLevelProgress(
  raw: Partial<DeviceLevelProgress> | null | undefined,
  maxCap: number
): DeviceLevelProgress {
  const completedSet = new Set<number>();
  if (raw && Array.isArray(raw.completed)) {
    for (const item of raw.completed) {
      const n = Math.floor(Number(item));
      if (Number.isFinite(n) && n >= 1 && n <= maxCap) {
        completedSet.add(n);
      }
    }
  }
  const contiguousCompleted: number[] = [];
  let highestUnlocked = 1;
  while (highestUnlocked <= maxCap && completedSet.has(highestUnlocked)) {
    contiguousCompleted.push(highestUnlocked);
    if (highestUnlocked === maxCap) break;
    highestUnlocked += 1;
  }
  return {
    highestUnlocked,
    completed: contiguousCompleted,
  };
}

export function canPlayLevel(
  level: number,
  progress: DeviceLevelProgress,
  maxCap: number
): boolean {
  const n = Math.floor(level);
  if (!Number.isFinite(n) || n < 1 || n > maxCap) return false;
  if (n === 1) return true;
  return n <= progress.highestUnlocked && progress.completed.includes(n - 1);
}

export function recordLevelCompletion(
  progress: DeviceLevelProgress,
  clearedLevel: number,
  maxCap: number
): DeviceLevelProgress {
  const safe = Math.floor(clearedLevel);
  const current = normalizeLevelProgress(progress, maxCap);
  if (!Number.isFinite(safe) || safe < 1 || safe > maxCap) {
    return current;
  }
  if (safe > current.highestUnlocked) {
    return current;
  }
  return normalizeLevelProgress({ completed: [...current.completed, safe] }, maxCap);
}

/**
 * Multiplayer party level rule:
 * Everyone in the room plays at most the lowest-level friend's unlocked level.
 */
export function computePartyMaxLevel(
  unlockedLevels: number[],
  maxCap = MAX_MP_LEVEL
): number {
  const valid = unlockedLevels
    .map((lvl) => Math.floor(Number(lvl)))
    .filter((lvl) => Number.isFinite(lvl) && lvl >= 1);
  if (valid.length === 0) return 1;
  return Math.min(maxCap, Math.max(1, Math.min(...valid)));
}

export function buildProgressFromHighestUnlocked(
  highestUnlocked: number,
  maxCap: number
): DeviceLevelProgress {
  const safe = Math.min(maxCap, Math.max(1, Math.floor(Number(highestUnlocked) || 1)));
  const completed = Array.from({ length: Math.max(0, safe - 1) }, (_, idx) => idx + 1);
  return normalizeLevelProgress({ completed }, maxCap);
}


