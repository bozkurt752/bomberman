import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bomb } from 'lucide-react';
import { PlayerInput } from '../game/types';

interface TouchControlsProps {
  onInputChange: (input: Partial<PlayerInput>) => void;
  onPlaceBomb: () => void;
  visible: boolean;
}

export function TouchControls({ onInputChange, onPlaceBomb, visible }: TouchControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [activeDir, setActiveDir] = useState<'up' | 'down' | 'left' | 'right' | null>(null);
  const [bombPressed, setBombPressed] = useState(false);

  if (!visible) return null;

  const updateDirectionFromPointer = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < 14) {
      setActiveDir(null);
      onInputChange({ dx: 0, dy: 0 });
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      const dir = dx > 0 ? 'right' : 'left';
      setActiveDir(dir);
      onInputChange({ dx: dx > 0 ? 1 : -1, dy: 0 });
    } else {
      const dir = dy > 0 ? 'down' : 'up';
      setActiveDir(dir);
      onInputChange({ dx: 0, dy: dy > 0 ? 1 : -1 });
    }
  };

  const handlePadDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    updateDirectionFromPointer(e.clientX, e.clientY);
  };

  const handlePadMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateDirectionFromPointer(e.clientX, e.clientY);
  };

  const handlePadUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setActiveDir(null);
    onInputChange({ dx: 0, dy: 0 });
  };

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-3 pb-3 sm:px-5 sm:pb-5 [@media(max-height:540px)]:px-3 [@media(max-height:540px)]:pb-3 pt-1 pointer-events-none select-none"
      aria-label="Mobil Dokunmatik Kontroller"
    >
      {/* Left Thumb: Android D-Pad with slide-across pointer tracking */}
      <div
        ref={padRef}
        onPointerDown={handlePadDown}
        onPointerMove={handlePadMove}
        onPointerUp={handlePadUp}
        onPointerCancel={handlePadUp}
        role="application"
        aria-label="Yön Tuşları"
        className="pointer-events-auto relative w-28 h-28 sm:w-36 sm:h-36 [@media(max-height:540px)]:w-28 [@media(max-height:540px)]:h-28 rounded-full bg-[#151C28]/85 border-2 border-slate-600/70 shadow-2xl touch-none flex items-center justify-center"
      >
        {/* Crosshair center */}
        <div className="w-8 h-8 sm:w-10 sm:h-10 [@media(max-height:540px)]:w-8 [@media(max-height:540px)]:h-8 rounded-full bg-slate-800/90 border border-slate-600/60" />

        {/* Up */}
        <div
          className={`absolute top-1 left-1/2 -translate-x-1/2 w-9 h-9 sm:w-11 sm:h-11 [@media(max-height:540px)]:w-9 [@media(max-height:540px)]:h-9 rounded-xl flex items-center justify-center transition-transform ${
            activeDir === 'up' ? 'bg-amber-500 text-slate-950 scale-95' : 'bg-slate-800/80 text-slate-200'
          }`}
        >
          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 [@media(max-height:540px)]:w-4 [@media(max-height:540px)]:h-4" />
        </div>

        {/* Down */}
        <div
          className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-9 h-9 sm:w-11 sm:h-11 [@media(max-height:540px)]:w-9 [@media(max-height:540px)]:h-9 rounded-xl flex items-center justify-center transition-transform ${
            activeDir === 'down' ? 'bg-amber-500 text-slate-950 scale-95' : 'bg-slate-800/80 text-slate-200'
          }`}
        >
          <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 [@media(max-height:540px)]:w-4 [@media(max-height:540px)]:h-4" />
        </div>

        {/* Left */}
        <div
          className={`absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 [@media(max-height:540px)]:w-9 [@media(max-height:540px)]:h-9 rounded-xl flex items-center justify-center transition-transform ${
            activeDir === 'left' ? 'bg-amber-500 text-slate-950 scale-95' : 'bg-slate-800/80 text-slate-200'
          }`}
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 [@media(max-height:540px)]:w-4 [@media(max-height:540px)]:h-4" />
        </div>

        {/* Right */}
        <div
          className={`absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 [@media(max-height:540px)]:w-9 [@media(max-height:540px)]:h-9 rounded-xl flex items-center justify-center transition-transform ${
            activeDir === 'right' ? 'bg-amber-500 text-slate-950 scale-95' : 'bg-slate-800/80 text-slate-200'
          }`}
        >
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 [@media(max-height:540px)]:w-4 [@media(max-height:540px)]:h-4" />
        </div>
      </div>

      {/* Right Thumb: Tactile Bomb Action Button */}
      <div className="pointer-events-auto flex flex-col items-center gap-2 pb-1">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setBombPressed(true);
            onPlaceBomb();
          }}
          onPointerUp={() => setBombPressed(false)}
          onPointerLeave={() => setBombPressed(false)}
          onPointerCancel={() => setBombPressed(false)}
          aria-label="Bomba Bırak"
          className={`w-16 h-16 sm:w-20 sm:h-20 [@media(max-height:540px)]:w-16 [@media(max-height:540px)]:h-16 rounded-full border-4 border-amber-300/80 shadow-xl flex flex-col items-center justify-center gap-0.5 transition-transform touch-none ${
            bombPressed
              ? 'bg-orange-600 scale-92 shadow-orange-600/40'
              : 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/30'
          }`}
        >
          <Bomb className="w-6 h-6 sm:w-8 sm:h-8 [@media(max-height:540px)]:w-6 [@media(max-height:540px)]:h-6 text-slate-950 stroke-[2.5]" />
          <span className="text-[10px] sm:text-[11px] font-bold tracking-wide text-slate-950">BOMBA</span>
        </button>
      </div>
    </div>
  );
}
