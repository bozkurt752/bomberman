import React, { useEffect, useRef, useState } from 'react';
import { AVATAR_PRESETS } from '../game/types';
import { BombermanEmblem } from './SvgIcons';

const SPLASH_ART_URL = '/src/assets/images/mobile_splash_art_1795167426767.jpg';
const TITLE_BG_URL = '/src/assets/images/title_arena_bg_1795156761316.jpg';

interface SplashPreloaderProps {
  onComplete: () => void;
}

const STAGE_LABELS = [
  'Arena Motoru Başlatılıyor...',
  'Kahraman Portreleri Yükleniyor...',
  'Dokunmatik Kontroller Hazırlanıyor...',
  'Savaşa Hazır!',
];

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    img.src = src;
  });
}

export function SplashPreloader({ onComplete }: SplashPreloaderProps) {
  const [progress, setProgress] = useState(12);
  const [fadingOut, setFadingOut] = useState(false);
  const sparkCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = sparkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const sparks = Array.from({ length: 42 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vy: 0.08 + Math.random() * 0.16,
      vx: (Math.random() - 0.5) * 0.05,
      r: 1.4 + (i % 3) * 0.9,
      alpha: 0.3 + Math.random() * 0.65,
      color: i % 3 === 0 ? '56, 189, 248' : i % 2 === 0 ? '251, 146, 60' : '253, 224, 71',
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
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const s of sparks) {
        s.y -= s.vy * dt;
        s.x += s.vx * dt;
        if (s.y < -0.04) {
          s.y = 1.04;
          s.x = Math.random();
        }
        ctx.fillStyle = `rgba(${s.color}, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const startMs = performance.now();
    const urls = [SPLASH_ART_URL, TITLE_BG_URL, ...AVATAR_PRESETS.map((a) => a.imageUrl)];
    let loadedCount = 0;

    const minTimer = new Promise<void>((resolve) => setTimeout(resolve, 1150));
    const fontPromise =
      typeof document !== 'undefined' && document.fonts?.ready
        ? document.fonts.ready.catch(() => {})
        : Promise.resolve();

    const assetPromises = urls.map((url) =>
      preloadImage(url).then(() => {
        loadedCount += 1;
        if (!cancelled) {
          const assetPct = Math.round((loadedCount / urls.length) * 72);
          setProgress((prev) => Math.max(prev, 15 + assetPct));
        }
      })
    );

    const animTimer = setInterval(() => {
      if (cancelled) return;
      const elapsed = performance.now() - startMs;
      const timePct = Math.min(94, Math.round(12 + (elapsed / 1100) * 82));
      setProgress((prev) => Math.max(prev, timePct));
    }, 60);

    void Promise.all([...assetPromises, fontPromise, minTimer]).then(() => {
      if (cancelled) return;
      clearInterval(animTimer);
      setProgress(100);
      setTimeout(() => {
        if (cancelled) return;
        setFadingOut(true);
        setTimeout(() => {
          if (!cancelled) onComplete();
        }, 380);
      }, 180);
    });

    return () => {
      cancelled = true;
      clearInterval(animTimer);
    };
  }, [onComplete]);

  const stageIdx =
    progress >= 98 ? 3 : progress >= 70 ? 2 : progress >= 40 ? 1 : 0;

  return (
    <div
      data-testid="splash-preloader"
      className={`absolute inset-0 z-50 bg-[#0B0F17] flex flex-col items-center justify-between overflow-hidden transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Generated Mobile Splash Visual with subtle Ken Burns zoom */}
      <img
        src={SPLASH_ART_URL}
        alt="Bomberman Mobil Arena açılış görseli"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-[1600ms] ease-out scale-105"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#0B0F17]/90 via-transparent to-[#0B0F17]/95 pointer-events-none"
        aria-hidden="true"
      />

      {/* Rising Ember Particles */}
      <canvas
        ref={sparkCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Brand Emblem */}
      <div className="relative z-10 pt-8 sm:pt-12 [@media(max-height:480px)]:pt-4 px-6 flex flex-col items-center text-center">
        <BombermanEmblem className="w-64 sm:w-72 [@media(max-height:480px)]:w-52 h-auto drop-shadow-[0_10px_28px_rgba(0,0,0,0.85)]" />
        <span className="mt-1.5 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.26em] text-cyan-300/90">
          Mobil Arena Sürümü · 16:9
        </span>
      </div>

      {/* Center Pulsing Energy Ring */}
      <div className="relative z-10 flex items-center justify-center pointer-events-none">
        <div className="w-24 h-24 [@media(max-height:480px)]:w-16 [@media(max-height:480px)]:h-16 rounded-full border-2 border-cyan-400/35 animate-ping" />
      </div>

      {/* Bottom Preloading Progress Bar */}
      <div className="relative z-10 w-full max-w-sm px-6 pb-8 sm:pb-12 [@media(max-height:480px)]:pb-4">
        <div className="flex items-center justify-between text-xs font-medium mb-1.5">
          <span className="text-slate-200 tracking-wide">{STAGE_LABELS[stageIdx]}</span>
          <span className="font-mono tabular-nums font-bold text-amber-300">{progress}%</span>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-900/90 border border-slate-700/80 overflow-hidden p-0.5 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-amber-400 to-orange-500 transition-all duration-150 ease-out shadow-[0_0_12px_rgba(251,191,36,0.65)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-2 [@media(max-height:480px)]:mt-1.5 text-center text-[11px] text-slate-400">
          Varlıklar ve bulut profili hazırlanıyor...
        </p>
      </div>
    </div>
  );
}
