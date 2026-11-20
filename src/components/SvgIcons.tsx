import React from 'react';

export function BombermanEmblem({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 380 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="BOMBERMAN"
    >
      {/* Fuse spark & bomb badge */}
      <circle cx="42" cy="48" r="26" fill="#1E293B" stroke="#F97316" strokeWidth="3.5" />
      <ellipse cx="33" cy="39" rx="7" ry="4.5" transform="rotate(-25 33 39)" fill="#64748B" opacity="0.55" />
      <rect x="36" y="17" width="12" height="7" rx="2" fill="#475569" stroke="#F8FAFC" strokeWidth="1.5" />
      <path d="M42 17 C45 9, 54 7, 60 12" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
      <circle cx="62" cy="13" r="6" fill="#FACC15" />
      <circle cx="62" cy="13" r="2.8" fill="#FFFFFF" />
      {/* Wordmark */}
      <text
        x="82"
        y="58"
        fill="#F8FAFC"
        stroke="#0B0F17"
        strokeWidth="6"
        paintOrder="stroke fill"
        fontFamily="Outfit, system-ui, sans-serif"
        fontWeight="800"
        fontSize="44"
        letterSpacing="1.5"
      >
        BOMBERMAN
      </text>
      <rect x="84" y="68" width="164" height="4" rx="2" fill="#F97316" />
      <text
        x="258"
        y="74"
        fill="#FACC15"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="700"
        fontSize="12"
        letterSpacing="2"
      >
        MOBİL ARENA
      </text>
    </svg>
  );
}

export function BombStatIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="14" r="7" fill="#22D3EE" stroke="#0B0F17" strokeWidth="2" />
      <path d="M15 8L18 5" stroke="#FACC15" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="19" cy="4" r="2" fill="#FACC15" />
    </svg>
  );
}

export function FlameStatIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3C15.5 7.5 18 11 18 14.5C18 18.1 15.3 21 12 21C8.7 21 6 18.1 6 14.5C6 11 8.5 7.5 12 3Z"
        fill="#F97316"
        stroke="#0B0F17"
        strokeWidth="2"
      />
      <path
        d="M12 10.5C13.8 12.8 14.8 14.5 14.8 16.2C14.8 17.8 13.5 19 12 19C10.5 19 9.2 17.8 9.2 16.2C9.2 14.5 10.2 12.8 12 10.5Z"
        fill="#FEF08A"
      />
    </svg>
  );
}

export function SpeedStatIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M14 3L6 13H12L10 21L18 11H12L14 3Z"
        fill="#4ADE80"
        stroke="#0B0F17"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldStatIcon({ className = 'w-5 h-5', active = false }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3L19 6.5V12C19 16.5 15.8 19.8 12 21C8.2 19.8 5 16.5 5 12V6.5L12 3Z"
        fill={active ? '#38BDF8' : '#334155'}
        stroke="#0B0F17"
        strokeWidth="2"
      />
    </svg>
  );
}
