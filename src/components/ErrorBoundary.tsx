import React from 'react';
import { RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Beklenmeyen bir uygulama hatası oluştu.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-[#0E121A] text-slate-100 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-[#161D2B] border border-rose-500/40 p-6 text-center shadow-2xl">
            <h2 className="font-display text-xl font-bold text-rose-300">Bir Sorun Oluştu</h2>
            <p className="mt-2 text-xs text-slate-300 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Uygulamayı Yeniden Başlat
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
