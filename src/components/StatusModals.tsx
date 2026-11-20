import React from 'react';
import { Home, Play, RotateCcw, Skull, Trophy, Users } from 'lucide-react';
import { MAX_MP_LEVEL, MAX_SOLO_LEVEL, MatchSummary } from '../game/types';

interface PauseModalProps {
  isMultiplayer: boolean;
  onResume: () => void;
  onRestart: () => void;
  onExitToTitle: () => void;
}

export function PauseModal({
  isMultiplayer,
  onResume,
  onRestart,
  onExitToTitle,
}: PauseModalProps) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#161D2B] border border-slate-700 p-5 sm:p-6 shadow-2xl my-auto">
        <h2
          id="pause-title"
          className="font-display text-2xl font-bold text-slate-100 text-center tracking-tight"
        >
          Oyun Duraklatıldı
        </h2>
        <p className="mt-1 text-sm text-slate-400 text-center">
          {isMultiplayer
            ? 'Çok oyunculu maç arka planda devam ediyor.'
            : 'Hazır olduğunuzda arenaya geri dönebilirsiniz.'}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" />
            Devam Et
          </button>

          {!isMultiplayer && (
            <button
              type="button"
              onClick={onRestart}
              className="w-full min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Yeniden Başlat
            </button>
          )}

          <button
            type="button"
            onClick={onExitToTitle}
            className="w-full min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Home className="w-4 h-4" />
            Ana Menüye Dön
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  summary: MatchSummary;
  isMpHost?: boolean;
  nextUnpassedLevel?: number;
  onPlayAgain: () => void;
  onNextWave?: () => void;
  onStartNextMpWave?: (retrySame: boolean) => void;
  onBackToLobby?: () => void;
  onExitToTitle: () => void;
}

export function GameOverModal({
  summary,
  isMpHost = false,
  nextUnpassedLevel,
  onPlayAgain,
  onNextWave,
  onStartNextMpWave,
  onBackToLobby,
  onExitToTitle,
}: GameOverModalProps) {
  const maxCap = summary.isMultiplayer ? MAX_MP_LEVEL : MAX_SOLO_LEVEL;
  const levelCleared = summary.isMultiplayer ? Boolean(summary.teamCleared || summary.won) : summary.won;
  const reachedCap = levelCleared && summary.wave >= maxCap;
  const nextTargetLevel = Math.min(
    maxCap,
    Math.max(1, nextUnpassedLevel ?? (levelCleared && !reachedCap ? summary.wave + 1 : summary.wave))
  );

  const titleText = reachedCap
    ? `${maxCap}. Seviye Büyük Zafer!`
    : levelCleared
      ? summary.foundDoor || summary.isMultiplayer
        ? `Seviye ${summary.wave} Tamamlandı!`
        : 'Zafer Senindir!'
      : summary.isDraw
        ? 'Berabere!'
        : 'Elendin!';

  const subtitleText = reachedCap
    ? summary.isMultiplayer
      ? 'Tüm 100 çok oyunculu seviyeyi başarıyla tamamladınız!'
      : '500 seviyelik sefer haritasının zirvesine ulaştın!'
    : summary.reviveNextLevel
      ? 'Takımın bölümü geçti! Başka lobiye geçmediğin için sonraki seviyede canlanıyorsun.'
      : summary.foundDoor
        ? 'Çıkış kapısına ulaştın ve yeni arenanın kilidini açtın.'
        : summary.winnerName
          ? `Arena Şampiyonu: ${summary.winnerName}`
          : summary.endReason === 'timeout'
            ? 'Süre doldu! Tüm böcekleri temizleyip çıkış kapısına ulaşamadın.'
            : summary.endReason === 'defeat'
              ? 'Böcek sürüsü tarafından yakalandın.'
              : 'Tüm savaşçılar aynı anda patlamada elendi.';

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#161D2B] border border-slate-700 p-5 sm:p-6 shadow-2xl my-auto">
        <div className="flex flex-col items-center text-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
              levelCleared
                ? 'bg-amber-500/20 text-amber-400 border border-amber-400/40'
                : 'bg-rose-500/20 text-rose-400 border border-rose-400/40'
            }`}
          >
            {levelCleared ? <Trophy className="w-7 h-7" /> : <Skull className="w-7 h-7" />}
          </div>
          <h2 id="gameover-title" className="font-display text-2xl font-extrabold text-slate-100">
            {titleText}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {subtitleText}
          </p>
        </div>

        {/* 4 Tabular Stat Tiles */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Skor</div>
            <div className="mt-0.5 text-base font-bold font-mono tabular-nums text-amber-300">
              {Math.round(summary.score)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Eleme</div>
            <div className="mt-0.5 text-base font-bold font-mono tabular-nums text-slate-100">
              {summary.kills}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">En İyi Combo</div>
            <div className="mt-0.5 text-base font-bold font-mono tabular-nums text-orange-300">
              {summary.maxCombo > 0 ? `${summary.maxCombo}x` : '—'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Süre</div>
            <div className="mt-0.5 text-base font-bold font-mono tabular-nums text-slate-100">
              {Math.round(summary.elapsedSeconds)}sn
            </div>
          </div>
        </div>

        {/* Standings (human players only; bugs are nameless) */}
        <div className="mt-4 max-h-40 overflow-y-auto divide-y divide-slate-800/80 rounded-xl bg-slate-900/60 border border-slate-800 px-3">
          {summary.standings
            .filter((row) => !row.isBot)
            .map((row) => (
              <div key={row.id} className="flex items-center justify-between py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="font-semibold text-slate-200 truncate">{row.name}</span>
                  {!row.alive && levelCleared && summary.isMultiplayer && (
                    <span className="text-[10px] text-emerald-300 font-medium whitespace-nowrap">
                      · Canlanacak
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums text-slate-300 shrink-0">
                  <span>{row.kills} Eleme</span>
                  <span className="font-bold text-amber-300">{Math.round(row.score)}</span>
                </div>
              </div>
            ))}
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2.5">
          {summary.isMultiplayer && onBackToLobby ? (
            <>
              {isMpHost && onStartNextMpWave && (
                <button
                  type="button"
                  data-start="true"
                  onClick={() => onStartNextMpWave(!levelCleared || reachedCap)}
                  className="w-full min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {levelCleared && !reachedCap
                    ? `Seviye ${nextTargetLevel} Başlat (Herkes Canlanır)`
                    : `Seviye ${nextTargetLevel} Başlat`}
                </button>
              )}

              <button
                type="button"
                onClick={onBackToLobby}
                className={`w-full min-h-[44px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                  isMpHost && onStartNextMpWave
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                <Users className="w-4 h-4" />
                {`Oda Lobisine Dön (Seviye ${nextTargetLevel})`}
              </button>
            </>
          ) : (
            <>
              {summary.won && !reachedCap && onNextWave ? (
                <button
                  type="button"
                  data-start="true"
                  onClick={onNextWave}
                  className="w-full min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Seviye {nextTargetLevel} Başlat
                </button>
              ) : (
                <button
                  type="button"
                  data-start="true"
                  onClick={onPlayAgain}
                  className="w-full min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  Tekrar Oyna (Seviye {nextTargetLevel})
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onExitToTitle}
            className="w-full min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Home className="w-4 h-4" />
            Ana Menü
          </button>
        </div>
      </div>
    </div>
  );
}
