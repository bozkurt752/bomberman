import React from 'react';
import { DoorOpen, Flame, Footprints, Gamepad2, Ghost, Mic, MicOff, Pause, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { AVATAR_PRESETS, MAX_MP_LEVEL, MAX_SOLO_LEVEL, WorldState } from '../game/types';
import { COMBO_WINDOW_SECONDS, getArenaConfig } from '../game/engine';
import { getLevelBiome } from '../game/levels';
import { BombStatIcon, FlameStatIcon, ShieldStatIcon, SpeedStatIcon } from './SvgIcons';

interface GameHudProps {
  world: WorldState;
  localPlayerId: string;
  isMuted: boolean;
  isMultiplayer: boolean;
  pingMs: number;
  showTouchControls: boolean;
  micEnabled?: boolean;
  onToggleMic?: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onToggleTouchControls: () => void;
}

export function GameHud({
  world,
  localPlayerId,
  isMuted,
  isMultiplayer,
  pingMs,
  showTouchControls,
  micEnabled = false,
  onToggleMic,
  onToggleMute,
  onPause,
  onToggleTouchControls,
}: GameHudProps) {
  const local = world.players.find((p) => p.id === localPlayerId) ?? world.players[0];
  const aliveCount = world.players.filter((p) => p.alive).length;
  const botsAlive = world.players.filter((p) => p.isBot && p.alive).length;
  const totalSecs = Math.ceil(world.timeRemaining);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const timeFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  const comboCount = local?.comboCount ?? 0;
  const comboMult = local?.comboMultiplier ?? 1;
  const comboTimer = local?.comboTimer ?? 0;
  const comboPct = Math.max(0, Math.min(100, (comboTimer / COMBO_WINDOW_SECONDS) * 100));

  const avatarImg =
    local?.avatarUrl ||
    AVATAR_PRESETS.find((a) => a.id === local?.avatarId)?.imageUrl ||
    AVATAR_PRESETS[0].imageUrl;

  const levelCfg = getArenaConfig(world.wave, !isMultiplayer);
  const biome = getLevelBiome(world.wave, !isMultiplayer);
  const maxLevel = isMultiplayer ? MAX_MP_LEVEL : MAX_SOLO_LEVEL;
  const panelStyle: React.CSSProperties = {
    backgroundColor: biome.hudPanelBg,
    borderColor: biome.hudBorderColor,
  };

  return (
    <div className="absolute inset-x-0 top-0 z-20 pointer-events-none px-2 pt-2 sm:px-4 sm:pt-2.5 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-1 sm:gap-3 min-w-0">
        {/* Top-Left Cluster: Avatar, Score, Combo Multiplier & Desktop Powerups */}
        <div
          style={panelStyle}
          className="pointer-events-auto flex items-center gap-1.5 sm:gap-3 border rounded-xl px-1.5 py-1 sm:px-3 sm:py-1.5 shadow-lg min-w-0"
        >
          {local && (
            <>
              <div className="flex items-center gap-1.5 sm:gap-2 pr-1.5 sm:pr-2 border-r border-slate-700/70">
                <img
                  src={avatarImg}
                  alt={local.name}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg object-cover border shrink-0"
                  style={{ borderColor: local.color }}
                />
                <div>
                  <div className="text-[8px] sm:text-[10px] uppercase tracking-wider text-slate-400 leading-none">
                    SKOR
                  </div>
                  <div className="text-xs sm:text-lg font-bold font-mono tabular-nums text-amber-300 leading-tight hud-stroke">
                    {Math.round(local.score)}
                  </div>
                </div>
              </div>

              {/* Combo Tracker */}
              <div
                data-testid="combo-tracker"
                className={`flex flex-col justify-center sm:pr-2 sm:border-r sm:border-slate-700/70 min-w-[46px] sm:min-w-[74px] ${
                  comboCount > 0 ? 'opacity-100' : 'opacity-70'
                }`}
              >
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Flame
                    className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 ${
                      comboCount >= 2 ? 'text-amber-400' : comboCount === 1 ? 'text-orange-400' : 'text-slate-500'
                    }`}
                  />
                  <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-slate-400 leading-none">
                    COMBO
                  </span>
                </div>
                <div
                  className={`text-[11px] sm:text-sm font-extrabold font-mono tabular-nums leading-tight ${
                    comboCount >= 2
                      ? 'text-yellow-300'
                      : comboCount === 1
                        ? 'text-orange-300'
                        : 'text-slate-400'
                  }`}
                >
                  {comboCount > 0 ? `${comboMult.toFixed(1)}x (${comboCount})` : '1.0x'}
                </div>
                <div className="mt-0.5 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-yellow-300 transition-all duration-100"
                    style={{ width: `${comboPct}%` }}
                  />
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs font-mono tabular-nums">
                <div className="flex items-center gap-1" title="Maksimum Bomba">
                  <BombStatIcon className="w-4 h-4" />
                  <span className="font-bold text-slate-100">{local.maxBombs}</span>
                </div>
                <div className="flex items-center gap-1" title="Patlama Menzili">
                  <FlameStatIcon className="w-4 h-4" />
                  <span className="font-bold text-slate-100">{local.flameRange}</span>
                </div>
                <div className="flex items-center gap-1" title="Hız Seviyesi">
                  <SpeedStatIcon className="w-4 h-4" />
                  <span className="font-bold text-slate-100">{local.speedLevel + 1}</span>
                </div>
                {local.hasShield && (
                  <div className="flex items-center" title="Kalkan Aktif">
                    <ShieldStatIcon className="w-4 h-4" active />
                  </div>
                )}
                {local.canKick && (
                  <div className="flex items-center text-purple-300" title="Bomba Tekmeleme">
                    <Footprints className="w-3.5 h-3.5" />
                  </div>
                )}
                {local.hasPierce && (
                  <div className="flex items-center text-rose-400" title="Delici Alev">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                )}
                {local.ghostTimer > 0 && (
                  <div className="flex items-center gap-0.5 text-teal-300" title="Hayalet Modu">
                    <Ghost className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold">{Math.ceil(local.ghostTimer)}s</span>
                  </div>
                )}
                {local.starTimer > 0 && (
                  <div className="flex items-center gap-0.5 text-yellow-300" title="Süper Yıldız">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold">{Math.ceil(local.starTimer)}s</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Top-Center Cluster: Level / Difficulty, Survivors & Timer */}
        <div
          style={panelStyle}
          className="flex items-center gap-1.5 sm:gap-3 border rounded-xl px-2 py-1 sm:px-3.5 sm:py-1.5 shadow-lg shrink-0"
        >
          <div className="text-center">
            <div
              style={{ color: biome.hudAccentColor }}
              className="text-[8px] sm:text-[10px] uppercase tracking-wider leading-none whitespace-nowrap"
            >
              {`SV ${world.wave}/${maxLevel} · ${levelCfg.difficultyLabel}`}
            </div>
            <div className="text-xs sm:text-base font-bold font-mono tabular-nums text-slate-100 leading-tight">
              {aliveCount}/{world.players.length}
            </div>
          </div>
          <div className="h-5 sm:h-6 w-px bg-slate-700/80" />
          <div className="text-center">
            <div className="text-[8px] sm:text-[10px] uppercase tracking-wider text-slate-400 leading-none">
              SÜRE
            </div>
            <div
              className={`text-xs sm:text-base font-bold font-mono tabular-nums leading-tight ${
                totalSecs <= 30 ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              {timeFormatted}
            </div>
          </div>
          {isMultiplayer && (
            <>
              <div className="hidden sm:block h-6 w-px bg-slate-700/80" />
              <div className="hidden sm:block text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 leading-none">PİNG</div>
                <div className="text-sm font-mono tabular-nums text-emerald-400 leading-tight">{pingMs}ms</div>
              </div>
            </>
          )}
        </div>

        {/* Top-Right Utility Buttons */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          {isMultiplayer && onToggleMic && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMic();
              }}
              aria-label={micEnabled ? 'Mikrofonu Kapat' : 'Mikrofonu Aç'}
              title={micEnabled ? 'Mikrofon Açık' : 'Mikrofon Kapalı'}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-colors ${
                micEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-300'
                  : 'bg-[#141A26]/90 border-slate-700/75 text-slate-300 hover:text-white'
              }`}
            >
              {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-slate-400" />}
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleTouchControls();
            }}
            aria-label="Dokunmatik Kumandayı Aç/Kapat"
            title="Dokunmatik Kumanda"
            className={`hidden md:flex w-10 h-10 rounded-xl border items-center justify-center transition-colors ${
              showTouchControls
                ? 'bg-amber-500/20 border-amber-400/70 text-amber-300'
                : 'bg-[#141A26]/90 border-slate-700/75 text-slate-300 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
            title="Sesi Aç/Kapat (M)"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#141A26]/90 border border-slate-700/75 text-slate-200 hover:text-white flex items-center justify-center transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Oyunu Duraklat"
            title="Duraklat (Esc / P)"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#141A26]/90 border border-slate-700/75 text-slate-200 hover:text-white flex items-center justify-center transition-colors"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Compact Powerup Strip (< 640px) */}
      {local && (
        <div className="flex sm:hidden items-center self-start gap-2.5 bg-[#141A26]/85 border border-slate-700/70 rounded-lg px-2 py-0.5 text-[11px] font-mono tabular-nums">
          <div className="flex items-center gap-1" title="Maksimum Bomba">
            <BombStatIcon className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-100">{local.maxBombs}</span>
          </div>
          <div className="flex items-center gap-1" title="Patlama Menzili">
            <FlameStatIcon className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-100">{local.flameRange}</span>
          </div>
          <div className="flex items-center gap-1" title="Hız Seviyesi">
            <SpeedStatIcon className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-100">{local.speedLevel + 1}</span>
          </div>
          {local.hasShield && (
            <div className="flex items-center" title="Kalkan Aktif">
              <ShieldStatIcon className="w-3.5 h-3.5" active />
            </div>
          )}
          {local.canKick && (
            <div className="flex items-center text-purple-300" title="Bomba Tekmeleme">
              <Footprints className="w-3 h-3" />
            </div>
          )}
          {local.hasPierce && (
            <div className="flex items-center text-rose-400" title="Delici Alev">
              <Zap className="w-3 h-3" />
            </div>
          )}
          {local.ghostTimer > 0 && (
            <div className="flex items-center gap-0.5 text-teal-300" title="Hayalet Modu">
              <Ghost className="w-3 h-3" />
              <span className="font-bold">{Math.ceil(local.ghostTimer)}s</span>
            </div>
          )}
          {local.starTimer > 0 && (
            <div className="flex items-center gap-0.5 text-yellow-300" title="Süper Yıldız">
              <Sparkles className="w-3 h-3" />
              <span className="font-bold">{Math.ceil(local.starTimer)}s</span>
            </div>
          )}
        </div>
      )}

      {/* Exit Door Guidance Cue (Solo & Multiplayer) */}
      {world.exitDoor && (world.exitDoor.revealed || botsAlive === 0) && (
        <div
          className={`self-center flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold shadow-lg ${
            botsAlive === 0
              ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-200'
              : 'bg-amber-950/90 border-amber-400/60 text-amber-200'
          }`}
        >
          <DoorOpen className="w-4 h-4 text-amber-300 shrink-0" />
          <span>
            {world.exitDoor.revealed && botsAlive === 0
              ? 'Çıkış Kapısı Açıldı! Sonraki tura geçmek için kapıya gir.'
              : world.exitDoor.revealed && botsAlive > 0
                ? `Çıkış Kapısı Bulundu! Kapıyı açmak için kalan ${botsAlive} böceği yok et.`
                : 'Tüm böcekler yok edildi! Çıkış Kapısını bul.'}
          </span>
        </div>
      )}

      {/* Multiplayer Spectator Revive Notice when local player died while teammates continue */}
      {isMultiplayer && local && !local.alive && !world.matchFinished && (
        <div className="self-center rounded-lg bg-amber-950/90 border border-amber-400/60 px-3.5 py-1.5 text-xs font-semibold text-amber-200 shadow-lg text-center">
          Elendin — Takım arkadaşların bu seviyeyi geçerse başka lobiye geçmediğin sürece sonraki seviyede canlanacaksın!
        </div>
      )}
    </div>
  );
}
