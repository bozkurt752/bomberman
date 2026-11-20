import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Cloud, LogOut, Play, Settings, Users } from 'lucide-react';
import { AVATAR_PRESETS, AvatarId, MAX_MP_LEVEL, MAX_SOLO_LEVEL } from '../game/types';
import { BombermanEmblem } from './SvgIcons';
import { PWAInstallButton } from './MobilePwaBar';
import type { GoogleProfileBadge } from './SettingsModal';

const TITLE_BG_URL = '/src/assets/images/title_arena_bg_1795156761316.jpg';

interface TitleScreenProps {
  playerName: string;
  bestScore: number;
  soloHighestUnlocked: number;
  mpHighestUnlocked: number;
  selectedAvatarId: AvatarId;
  googleProfile: GoogleProfileBadge | null;
  authBusy?: boolean;
  authError?: string | null;
  onOpenSettings: () => void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onSelectAvatar: (id: AvatarId) => void;
  onStartSolo: () => void;
  onOpenMultiplayer: () => void;
}

export function TitleScreen({
  playerName,
  bestScore,
  soloHighestUnlocked,
  mpHighestUnlocked,
  selectedAvatarId,
  googleProfile,
  authBusy = false,
  authError = null,
  onOpenSettings,
  onConnectGoogle,
  onDisconnectGoogle,
  onSelectAvatar,
  onStartSolo,
  onOpenMultiplayer,
}: TitleScreenProps) {
  const emberCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = emberCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const embers = Array.from({ length: 34 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vy: 0.04 + Math.random() * 0.09,
      vx: (Math.random() - 0.5) * 0.03,
      r: 1.5 + (i % 3),
      alpha: 0.25 + Math.random() * 0.55,
      color: i % 3 === 0 ? '56, 189, 248' : i % 2 === 0 ? '251, 146, 60' : '250, 204, 21',
    }));

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent?.clientWidth || window.innerWidth;
      canvas.height = parent?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && canvas.parentElement
        ? new ResizeObserver(() => resize())
        : null;
    if (resizeObserver && canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const e of embers) {
        e.y -= e.vy * dt;
        e.x += e.vx * dt;
        if (e.y < -0.05) {
          e.y = 1.05;
          e.x = Math.random();
        }
        ctx.fillStyle = `rgba(${e.color}, ${e.alpha})`;
        ctx.beginPath();
        ctx.arc(e.x * canvas.width, e.y * canvas.height, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
        e.preventDefault();
        onStartSolo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStartSolo]);

  const activePreset = AVATAR_PRESETS.find((a) => a.id === selectedAvatarId) ?? AVATAR_PRESETS[0];

  return (
    <main className="relative w-full h-full overflow-y-auto overflow-x-hidden bg-[#0E121A] flex flex-col justify-between">
      {/* Illustrated Key-Art Backdrop */}
      <img
        src={TITLE_BG_URL}
        alt="Bomberman kale arenası illüstrasyonu"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-right opacity-90 pointer-events-none select-none"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#0B0F17] via-[#0B0F17]/88 to-transparent pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-[#0B0F17]/40 pointer-events-none"
        aria-hidden="true"
      />

      <canvas
        ref={emberCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Bar: Player Profile Chip + Top-Right Settings Gear */}
      <header className="relative z-20 w-full flex items-center justify-between gap-3 px-4 sm:px-6 pt-3 [@media(max-height:480px)]:pt-2">
        <button
          type="button"
          onClick={onOpenSettings}
          data-testid="profile-chip-btn"
          className="flex items-center gap-2.5 min-h-[42px] pl-1.5 pr-3.5 py-1 rounded-2xl bg-[#141B29]/90 hover:bg-[#1C263B] border border-slate-700/80 transition-colors max-w-[68%]"
        >
          <img
            src={googleProfile?.photoUrl || activePreset.imageUrl}
            alt={playerName}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-xl object-cover border border-amber-400/60 shrink-0"
          />
          <div className="min-w-0 text-left">
            <div className="text-xs font-bold text-slate-100 truncate">{playerName}</div>
            <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
              <span style={{ color: activePreset.color }}>{activePreset.label}</span>
              {googleProfile && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-300 font-semibold">Google Play</span>
                </>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          data-testid="settings-btn"
          aria-label="Ayarlar"
          title="Profil ve Ayarlar"
          className="min-w-[42px] min-h-[42px] px-3 rounded-2xl bg-[#141B29]/90 hover:bg-[#1C263B] border border-slate-700/80 text-slate-100 flex items-center justify-center gap-2 shadow-lg transition-colors shrink-0"
        >
          <Settings className="w-5 h-5 text-amber-300" />
          <span className="hidden sm:inline text-xs font-semibold">Ayarlar</span>
        </button>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-8 py-2 [@media(max-height:480px)]:py-1">
        <div className="w-full max-w-md landscape:max-w-4xl flex flex-col landscape:grid landscape:grid-cols-[1.05fr_0.95fr] landscape:items-center landscape:gap-5">
          {/* Left Column (Title, Hero Roster & Tagline) */}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-2 [@media(max-height:480px)]:mb-1.5">
              {AVATAR_PRESETS.map((preset) => {
                const selected = preset.id === selectedAvatarId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectAvatar(preset.id)}
                    aria-label={`Avatar seç: ${preset.label}`}
                    title={preset.label}
                    className={`relative w-11 h-11 sm:w-12 sm:h-12 [@media(max-height:480px)]:w-10 [@media(max-height:480px)]:h-10 rounded-xl overflow-hidden border-2 transition-transform shrink-0 ${
                      selected
                        ? 'border-amber-400 scale-105 shadow-lg shadow-amber-500/25'
                        : 'border-slate-700/80 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={preset.imageUrl}
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
              {bestScore > 0 && (
                <div className="pl-2 text-xs text-slate-300">
                  <div className="text-[10px] text-slate-400">En Yüksek</div>
                  <div className="font-mono tabular-nums text-sm sm:text-base font-bold text-amber-300">
                    {Math.round(bestScore)}
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs font-semibold tracking-wide mb-1" style={{ color: activePreset.color }}>
              Seçili Kahraman · {activePreset.label}
            </div>

            <BombermanEmblem className="w-full max-w-[270px] sm:max-w-[300px] [@media(max-height:480px)]:max-w-[235px] h-auto" />

            <h1 className="sr-only">Bomberman Mobil Arena</h1>
            <p className="mt-1.5 text-xs sm:text-sm [@media(max-height:420px)]:text-[11px] text-slate-300 leading-snug max-w-sm">
              16:9 Android mobil kontrolleri, 500 seviyeli sefer ve Google Play bulut profiliyle kaldığın seviyeden devam et.
            </p>
          </div>

          {/* Right Column (Google Play Profile + Action Buttons) */}
          <div className="w-full flex flex-col mt-3 landscape:mt-0">
            <div className="w-full rounded-2xl bg-[#141B29]/95 border border-slate-700/80 p-3 [@media(max-height:480px)]:p-2.5 shadow-xl">
            {googleProfile ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {googleProfile.photoUrl ? (
                      <img
                        src={googleProfile.photoUrl}
                        alt={googleProfile.displayName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full border border-emerald-400/60 object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-bold text-sm shrink-0">
                        {googleProfile.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-100 truncate">
                          {googleProfile.displayName}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      </div>
                      <div className="text-[11px] text-emerald-300/90 flex items-center gap-1">
                        <Cloud className="w-3 h-3" />
                        <span>Google Play Profili Bağlı · Bulut Eşitlendi</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onDisconnectGoogle}
                    title="Hesaptan çıkış yap"
                    className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Çıkış
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums text-[11px]">
                  <div className="rounded-lg bg-slate-900/90 border border-slate-800 py-1.5 px-1">
                    <div className="text-[10px] text-slate-400">Tekil Seviye</div>
                    <div className="font-bold text-amber-300">
                      {soloHighestUnlocked}/{MAX_SOLO_LEVEL}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/90 border border-slate-800 py-1.5 px-1">
                    <div className="text-[10px] text-slate-400">Çoklu Seviye</div>
                    <div className="font-bold text-cyan-300">
                      {mpHighestUnlocked}/{MAX_MP_LEVEL}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/90 border border-slate-800 py-1.5 px-1">
                    <div className="text-[10px] text-slate-400">En İyi Skor</div>
                    <div className="font-bold text-emerald-300">{Math.round(bestScore)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="google-play-connect-btn"
                  disabled={authBusy}
                  onClick={onConnectGoogle}
                  className="w-full min-h-[44px] px-4 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-colors whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  {authBusy ? 'Google Bağlanıyor...' : 'Google Play ile Bağlan'}
                </button>
                <p className="text-[11px] text-slate-400 text-center">
                  Bağlanan oyuncuların kaldığı seviye, skor ve profili bulutta saklanır.
                </p>
              </div>
            )}

            {authError && (
              <div className="mt-2 rounded-lg bg-rose-500/15 border border-rose-500/40 px-2.5 py-1.5 text-[11px] text-rose-200">
                {authError}
              </div>
            )}
          </div>

          <div className="mt-2.5 w-full flex flex-col gap-2">
            <button
              type="button"
              data-start="true"
              onClick={onStartSolo}
              className="w-full min-h-[46px] [@media(max-height:480px)]:min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all whitespace-nowrap"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              Tek Oyuncu Başlat
            </button>

            <button
              type="button"
              onClick={onOpenMultiplayer}
              className="w-full min-h-[44px] [@media(max-height:480px)]:min-h-[40px] px-5 rounded-xl bg-[#1A2333]/95 hover:bg-[#232F44] border border-slate-600/80 text-slate-100 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Users className="w-4 h-4 text-cyan-400" />
              Arkadaşlarla Oyna (Çok Oyunculu)
            </button>

            <PWAInstallButton />
          </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 px-4 sm:px-6 pb-2.5 pt-0.5 [@media(max-height:400px)]:hidden">
        <p className="text-[11px] text-slate-400 font-medium tracking-wide">
          16:9 Android Mobil Dokunmatik D-Pad · Bomba Tuşu · Google Play Profil
        </p>
      </footer>
    </main>
  );
}
