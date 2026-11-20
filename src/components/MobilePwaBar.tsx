import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="w-full min-h-[44px] px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
      >
        <Download className="w-4 h-4" />
        Telefona Uygulama Olarak Yükle
      </button>
    );
  }

  if (isIOS || isAndroid) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="w-full min-h-[44px] px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600/80 text-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Smartphone className="w-4 h-4 text-cyan-300" />
          {isAndroid ? 'Android Telefona Yükle' : 'Ana Ekrana Ekle (Mobil)'}
        </button>

        {showGuide && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
            <div className="w-full max-w-sm rounded-2xl bg-[#161D2B] border border-slate-700 p-5 shadow-2xl my-auto">
              <h3 className="font-display text-lg font-bold text-slate-100">
                Telefona Uygulama Ekle
              </h3>
              {isAndroid ? (
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  1. Bu sayfayı Android <strong>Chrome</strong> tarayıcısında açın.
                  <br />
                  2. Sağ üstteki <strong>⋮</strong> menüsüne dokunup <strong>Uygulamayı yükle</strong> veya <strong>Ana ekrana ekle</strong> seçeneğini seçin.
                </p>
              ) : (
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  1. Tarayıcı menüsünden <strong>Paylaş</strong> simgesine dokunun.
                  <br />
                  2. Aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> seçeneğini seçin.
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-4 w-full min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm"
              >
                Anladım
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="absolute bottom-3 left-3 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      Çevrimdışı Mod — Yerel kayıtlar kullanılıyor
    </div>
  );
};
