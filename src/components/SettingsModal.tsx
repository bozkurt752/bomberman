import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Cloud, LogOut, Save, User, X } from 'lucide-react';
import { AVATAR_PRESETS, AvatarId, MAX_MP_LEVEL, MAX_SOLO_LEVEL } from '../game/types';

export interface GoogleProfileBadge {
  displayName: string;
  photoUrl?: string;
  email?: string;
  totalWins?: number;
}

interface SettingsModalProps {
  open: boolean;
  playerName: string;
  selectedAvatarId: AvatarId;
  bestScore: number;
  soloHighestUnlocked: number;
  mpHighestUnlocked: number;
  googleProfile: GoogleProfileBadge | null;
  authBusy?: boolean;
  authError?: string | null;
  onClose: () => void;
  onSaveProfile: (nextName: string, nextAvatarId: AvatarId) => void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
}

export function SettingsModal({
  open,
  playerName,
  selectedAvatarId,
  bestScore,
  soloHighestUnlocked,
  mpHighestUnlocked,
  googleProfile,
  authBusy = false,
  authError = null,
  onClose,
  onSaveProfile,
  onConnectGoogle,
  onDisconnectGoogle,
}: SettingsModalProps) {
  const [draftName, setDraftName] = useState(playerName);
  const [draftAvatar, setDraftAvatar] = useState<AvatarId>(selectedAvatarId);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftName(playerName);
      setDraftAvatar(selectedAvatarId);
      setSavedNotice(false);
    }
  }, [open, playerName, selectedAvatarId]);

  if (!open) return null;

  const activePreset = AVATAR_PRESETS.find((a) => a.id === draftAvatar) ?? AVATAR_PRESETS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftName.trim().slice(0, 16) || 'Oyuncu 1';
    onSaveProfile(cleaned, draftAvatar);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 450);
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      data-testid="settings-modal"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#141B29] border border-slate-700 p-5 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-300">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="font-display text-lg font-bold text-slate-100">
                Oyuncu Profili ve Ayarlar
              </h2>
              <p className="text-[11px] text-slate-400">
                İsmini, kahramanını ve Google Play bağlantını yönet
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Ayarları Kapat"
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Player Name Input */}
          <div>
            <label htmlFor="settings-player-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Oyuncu İsmi
            </label>
            <input
              id="settings-player-name"
              data-testid="settings-player-name-input"
              type="text"
              maxLength={16}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="İsmini yaz (örn: AteşKral)"
              className="w-full min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Hero Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">Kahraman Seç</span>
              <span className="text-xs font-semibold" style={{ color: activePreset.color }}>
                {activePreset.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {AVATAR_PRESETS.map((preset) => {
                const selected = preset.id === draftAvatar;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`settings-hero-${preset.id}`}
                    onClick={() => setDraftAvatar(preset.id)}
                    className={`relative flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                      selected
                        ? 'bg-slate-800/90 border-amber-400 shadow-md shadow-amber-500/15'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={preset.imageUrl}
                        alt={preset.label}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-700"
                      />
                      {selected && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-100 leading-tight">
                        {preset.label}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {selected ? 'Seçili' : 'Seç'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Google Play Account Section */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                Google Play Hesap Bağlantısı
              </span>
              {googleProfile && (
                <span className="text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Bağlı
                </span>
              )}
            </div>

            {googleProfile ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {googleProfile.photoUrl ? (
                      <img
                        src={googleProfile.photoUrl}
                        alt={googleProfile.displayName}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full border border-emerald-400/50 object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-bold text-xs shrink-0">
                        {googleProfile.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {googleProfile.displayName}
                      </div>
                      {googleProfile.email && (
                        <div className="text-[10px] text-slate-400 truncate">{googleProfile.email}</div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={onDisconnectGoogle}
                    className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Çıkış
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums text-[11px]">
                  <div className="rounded-lg bg-slate-950/80 border border-slate-800 py-1.5">
                    <div className="text-[10px] text-slate-400">Tekil</div>
                    <div className="font-bold text-amber-300">
                      {soloHighestUnlocked}/{MAX_SOLO_LEVEL}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 border border-slate-800 py-1.5">
                    <div className="text-[10px] text-slate-400">Çoklu</div>
                    <div className="font-bold text-cyan-300">
                      {mpHighestUnlocked}/{MAX_MP_LEVEL}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 border border-slate-800 py-1.5">
                    <div className="text-[10px] text-slate-400">En İyi</div>
                    <div className="font-bold text-emerald-300">{Math.round(bestScore)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="settings-google-connect-btn"
                  disabled={authBusy}
                  onClick={onConnectGoogle}
                  className="w-full min-h-[42px] px-4 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow transition-colors whitespace-nowrap"
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
                  Seviye, skor ve profilini Google Play bulutuyla eşitle.
                </p>
              </div>
            )}

            {authError && (
              <div className="rounded-lg bg-rose-500/15 border border-rose-500/40 px-2.5 py-1.5 text-[11px] text-rose-200">
                {authError}
              </div>
            )}
          </div>

          <button
            type="submit"
            data-testid="settings-save-btn"
            className="w-full min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedNotice ? 'Profil Kaydedildi!' : 'Profili Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
