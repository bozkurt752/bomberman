import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Compass, Lock, Play, ShieldAlert } from 'lucide-react';
import { getSoloLevelConfig } from '../game/engine';
import {
  BUG_VARIANT_META,
  CampaignNode,
  canPlayLevel,
  generateSoloCampaignNodes,
  normalizeLevelProgress,
} from '../game/levels';
import { MAX_SOLO_LEVEL } from '../game/types';

interface SoloCampaignMapProps {
  highestUnlocked: number;
  completedLevels: number[];
  bestScore: number;
  initialSelectedLevel?: number;
  onStartLevel: (level: number) => void;
  onBackToTitle: () => void;
}

const REGION_RANGES: Array<{ label: string; start: number; end: number }> = [
  { label: '1 - 100', start: 1, end: 100 },
  { label: '101 - 200', start: 101, end: 200 },
  { label: '201 - 300', start: 201, end: 300 },
  { label: '301 - 400', start: 301, end: 400 },
  { label: '401 - 500', start: 401, end: 500 },
];

export function SoloCampaignMap({
  highestUnlocked,
  completedLevels,
  bestScore,
  initialSelectedLevel,
  onStartLevel,
  onBackToTitle,
}: SoloCampaignMapProps) {
  const allNodes = useMemo(() => generateSoloCampaignNodes(MAX_SOLO_LEVEL), []);
  const normalizedProgress = useMemo(
    () => normalizeLevelProgress({ highestUnlocked, completed: completedLevels }, MAX_SOLO_LEVEL),
    [completedLevels, highestUnlocked]
  );
  const safeHighest = normalizedProgress.highestUnlocked;
  const defaultTarget = Math.min(MAX_SOLO_LEVEL, Math.max(1, initialSelectedLevel ?? safeHighest));
  const [selectedLevel, setSelectedLevel] = useState<number>(defaultTarget);
  const [activeRegionIdx, setActiveRegionIdx] = useState<number>(() =>
    Math.min(4, Math.floor((defaultTarget - 1) / 100))
  );

  const completedSet = useMemo(
    () => new Set(normalizedProgress.completed),
    [normalizedProgress.completed]
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeNodeRef = useRef<HTMLButtonElement | null>(null);

  const region = REGION_RANGES[activeRegionIdx];
  const regionNodes = useMemo(
    () => allNodes.filter((n) => n.level >= region.start && n.level <= region.end),
    [allNodes, region.end, region.start]
  );

  const minY = regionNodes[0]?.y ?? 64;
  const maxY = regionNodes[regionNodes.length - 1]?.y ?? 800;
  const mapTopOffset = minY - 64;
  const mapHeight = Math.max(520, maxY - mapTopOffset + 96);

  // Build winding SVG path strings for unlocked and locked segments
  const { unlockedPath, fullPath } = useMemo(() => {
    if (regionNodes.length === 0) return { unlockedPath: '', fullPath: '' };
    const toLocalY = (y: number) => y - mapTopOffset;

    const buildPath = (pts: CampaignNode[]) => {
      if (pts.length === 0) return '';
      let d = `M ${pts[0].x} ${toLocalY(pts[0].y)}`;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const cur = pts[i];
        const py = toLocalY(prev.y);
        const cy = toLocalY(cur.y);
        const mx = (prev.x + cur.x) / 2;
        const my = (py + cy) / 2;
        // Slight directional perpendicular bend for organic map curves
        const bend = (i % 2 === 0 ? 1 : -1) * 14;
        d += ` Q ${mx + bend} ${my} ${cur.x} ${cy}`;
      }
      return d;
    };

    const unlockedPts = regionNodes.filter((n) => n.level <= safeHighest);
    return {
      fullPath: buildPath(regionNodes),
      unlockedPath: buildPath(unlockedPts),
    };
  }, [mapTopOffset, regionNodes, safeHighest]);

  useEffect(() => {
    setSelectedLevel(safeHighest);
    setActiveRegionIdx(Math.min(4, Math.floor((safeHighest - 1) / 100)));
  }, [safeHighest]);

  useEffect(() => {
    if (activeNodeRef.current) {
      activeNodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeRegionIdx, safeHighest]);

  const selectedNode = allNodes[selectedLevel - 1] ?? allNodes[0];
  const selectedConfig = useMemo(() => getSoloLevelConfig(selectedLevel), [selectedLevel]);
  const isSelectedUnlocked = canPlayLevel(selectedLevel, normalizedProgress, MAX_SOLO_LEVEL);

  const focusCurrentLevel = () => {
    const targetRegion = Math.min(4, Math.floor((safeHighest - 1) / 100));
    setSelectedLevel(safeHighest);
    setActiveRegionIdx(targetRegion);
    setTimeout(() => {
      activeNodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 40);
  };

  return (
    <div className="relative w-full h-full bg-[#0C111B] text-slate-100 flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="shrink-0 bg-[#121927] border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToTitle}
            className="min-h-[42px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-base sm:text-xl font-bold text-slate-100 truncate">
              Tek Oyuncu Sefer Haritası
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span>Açılan: {safeHighest} / {MAX_SOLO_LEVEL}</span>
              <span aria-hidden="true">·</span>
              <span>Tamamlanan: {completedLevels.length}</span>
              {bestScore > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300">Rekor: {Math.round(bestScore)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={focusCurrentLevel}
            className="min-h-[42px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            Seviyem ({safeHighest})
          </button>
          <button
            type="button"
            onClick={() => onStartLevel(safeHighest)}
            className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-md"
          >
            <Play className="w-4 h-4 fill-current" />
            Seviye {safeHighest} Oyna
          </button>
        </div>
      </header>

      {/* 500-Level Region Selector Tabs */}
      <div className="shrink-0 bg-[#101622] border-b border-slate-800/80 px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto">
        <span className="text-xs font-semibold text-slate-400 mr-2 whitespace-nowrap shrink-0">
          Bölgeler:
        </span>
        {REGION_RANGES.map((reg, idx) => {
          const active = idx === activeRegionIdx;
          const regionLocked = safeHighest < reg.start;
          return (
            <button
              key={reg.label}
              type="button"
              onClick={() => setActiveRegionIdx(idx)}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-amber-500 text-slate-950'
                  : regionLocked
                    ? 'bg-slate-900 text-slate-500 hover:text-slate-300'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              Seviye {reg.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable Winding Random-Direction Map */}
      <div
        ref={scrollContainerRef}
        data-testid="solo-campaign-scroll"
        className="flex-1 overflow-y-auto overflow-x-auto relative bg-[radial-gradient(circle_at_50%_15%,#172235,#0B101A_70%)]"
      >
        <div
          className="relative mx-auto my-4"
          style={{ width: 820, height: mapHeight }}
        >
          {/* Directional Winding SVG Route */}
          <svg
            width={820}
            height={mapHeight}
            viewBox={`0 0 820 ${mapHeight}`}
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
            {/* Base Dashed Future Trail */}
            {fullPath && (
              <path
                d={fullPath}
                fill="none"
                stroke="rgba(71, 85, 105, 0.55)"
                strokeWidth={6}
                strokeDasharray="10 8"
                strokeLinecap="round"
              />
            )}
            {/* Unlocked Glowing Trail */}
            {unlockedPath && (
              <path
                d={unlockedPath}
                fill="none"
                stroke="#F59E0B"
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.85}
              />
            )}
          </svg>

          {/* Interactive Level Nodes (1..500) */}
          {regionNodes.map((node) => {
            const topY = node.y - mapTopOffset;
            const unlocked = canPlayLevel(node.level, normalizedProgress, MAX_SOLO_LEVEL);
            const completed = unlocked && completedSet.has(node.level);
            const isCurrent = node.level === safeHighest;
            const isSelected = node.level === selectedLevel;
            const size = node.isMilestone ? 52 : 44;

            return (
              <button
                key={node.level}
                ref={isCurrent ? activeNodeRef : undefined}
                type="button"
                data-testid={`solo-level-node-${node.level}`}
                onClick={() => setSelectedLevel(node.level)}
                onDoubleClick={() => {
                  if (unlocked) onStartLevel(node.level);
                }}
                aria-label={`Seviye ${node.level}${unlocked ? '' : ' (Kilitli)'}`}
                style={{
                  left: node.x - size / 2,
                  top: topY - size / 2,
                  width: size,
                  height: size,
                  borderColor: isSelected
                    ? '#FDE047'
                    : unlocked
                      ? node.biome.nodeColor
                      : '#334155',
                }}
                className={`absolute rounded-full border-2 flex flex-col items-center justify-center transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isSelected ? 'scale-115 z-10 shadow-xl shadow-amber-500/25' : 'hover:scale-105'
                } ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 font-extrabold'
                    : completed
                      ? 'bg-[#14292B] text-emerald-200 font-bold'
                      : unlocked
                        ? 'bg-[#172133] text-slate-100 font-bold'
                        : 'bg-[#111724] text-slate-500'
                }`}
              >
                <span className="font-mono tabular-nums text-xs leading-none">
                  {node.level}
                </span>
                {completed && !isCurrent && (
                  <Check className="w-3 h-3 text-emerald-400 mt-0.5" aria-hidden="true" />
                )}
                {!unlocked && (
                  <Lock className="w-2.5 h-2.5 text-slate-500 mt-0.5" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Level Footer Control Bar */}
      <footer className="shrink-0 bg-[#121927] border-t border-slate-800 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-100">
            <span className="font-mono tabular-nums" style={{ color: selectedNode.biome.nodeColor }}>
              Seviye {selectedLevel} / {MAX_SOLO_LEVEL}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>{selectedNode.biome.name}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-xs font-medium text-slate-400">{selectedNode.biome.uiName}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Zorluk: {selectedConfig.difficultyLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Harita: {selectedConfig.cols}×{selectedConfig.rows}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{selectedConfig.botCount} Böcek:</span>
            <span className="text-slate-200 font-medium">
              {selectedNode.variants.map((v) => BUG_VARIANT_META[v].label).join(', ')}
            </span>
          </div>
        </div>

        <button
          type="button"
          data-testid="start-selected-level-btn"
          disabled={!isSelectedUnlocked}
          onClick={() => onStartLevel(selectedLevel)}
          className={`min-h-[46px] px-6 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
            isSelectedUnlocked
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isSelectedUnlocked ? (
            <>
              <Play className="w-4 h-4 fill-current" />
              Seviye {selectedLevel} Başlat
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4" />
              Önce Seviye {Math.max(1, selectedLevel - 1)} Geçilmeli
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
