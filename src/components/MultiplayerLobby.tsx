import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bug,
  Check,
  Crown,
  KeyRound,
  Link2,
  Lock,
  LockOpen,
  Mic,
  MicOff,
  Minus,
  Play,
  Plus,
  UserX,
  Users,
} from 'lucide-react';
import { getLevelBiome, getMpLevelDifficultyLabel } from '../game/levels';
import { MAX_MP_LEVEL, RoomSnapshot, RoomSummary } from '../game/types';

interface MultiplayerLobbyProps {
  connected: boolean;
  clientId: string;
  pingMs: number;
  rooms: RoomSummary[];
  room: RoomSnapshot | null;
  errorMessage: string | null;
  playerName: string;
  initialJoinCode?: string;
  localMpUnlockedLevel: number;
  micEnabled: boolean;
  voiceError: string | null;
  onChangePlayerName: (name: string) => void;
  onCreateRoom: (roomName: string, name: string, password?: string) => void;
  onJoinRoom: (code: string, name: string, password?: string) => void;
  onLeaveRoom: () => void;
  onToggleReady: (ready: boolean) => void;
  onToggleFillBots: (fill: boolean) => void;
  onChangeMpWave: (wave: number) => void;
  onSetPassword: (password: string) => void;
  onKickMember: (targetId: string) => void;
  onToggleMic: () => void;
  onStartMatch: () => void;
  onBackToTitle: () => void;
}

export function MultiplayerLobby({
  connected,
  clientId,
  pingMs,
  rooms,
  room,
  errorMessage,
  playerName,
  initialJoinCode = '',
  localMpUnlockedLevel,
  micEnabled,
  voiceError,
  onChangePlayerName,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  onToggleFillBots,
  onChangeMpWave,
  onSetPassword,
  onKickMember,
  onToggleMic,
  onStartMatch,
  onBackToTitle,
}: MultiplayerLobbyProps) {
  const [promptRoomCode, setPromptRoomCode] = useState<string>(initialJoinCode);
  const [joinPassword, setJoinPassword] = useState('');
  const [hostPasswordInput, setHostPasswordInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');

  useEffect(() => {
    if (initialJoinCode) {
      setPromptRoomCode(initialJoinCode);
    }
  }, [initialJoinCode]);

  const humanMembers = room ? room.members.filter((m) => !m.isBot) : [];
  const botCount = room ? room.members.filter((m) => m.isBot).length : 0;
  const me = humanMembers.find((m) => m.id === clientId);
  const isHost = room?.hostId === clientId;

  const handleCopyInviteLink = () => {
    if (!room) return;
    const url = `${window.location.origin}/?room=${room.code}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  return (
    <div className="relative w-full h-full bg-[#0E121A] overflow-y-auto flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-[#161D2B] border border-slate-700/80 p-4 sm:p-7 shadow-2xl">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <button
            type="button"
            onClick={room ? onLeaveRoom : onBackToTitle}
            className="min-h-[44px] px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            {room ? 'Odadan Ayrıl' : 'Geri'}
          </button>

          <div className="text-right">
            <h1 className="font-display text-lg sm:text-xl font-bold text-slate-100">
              {room ? room.name : 'Çok Oyunculu Odalar'}
            </h1>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              {connected ? `Sunucu Bağlı · ${pingMs}ms` : 'Sunucuya bağlanılıyor...'}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-3 text-sm text-rose-200"
          >
            {errorMessage}
          </div>
        )}

        {!room ? (
          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="mp-player-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Oyuncu Adın
              </label>
              <input
                id="mp-player-name"
                type="text"
                maxLength={16}
                value={playerName}
                onChange={(e) => onChangePlayerName(e.target.value)}
                placeholder="Örn: AteşKral"
                className="w-full min-h-[46px] rounded-xl bg-slate-900 border border-slate-700 px-3.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="font-display text-sm sm:text-base font-bold text-slate-200">
                    Odalar (En Fazla 4 Oyuncu)
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>İlk giren oda yetkilisi olur</span>
                    <span aria-hidden="true">·</span>
                    <span
                      data-testid="local-mp-level-badge"
                      className="font-mono tabular-nums text-cyan-300 font-semibold"
                    >
                      Cihaz Seviyen: Sv. {localMpUnlockedLevel} / {MAX_MP_LEVEL}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!connected}
                  onClick={() => setShowCreateForm((v) => !v)}
                  className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-md"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  Oda Oluştur
                </button>
              </div>

              {showCreateForm && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onCreateRoom(newRoomName, playerName, newRoomPassword);
                    setShowCreateForm(false);
                    setNewRoomName('');
                    setNewRoomPassword('');
                  }}
                  className="mb-4 rounded-xl bg-slate-900 border border-amber-500/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-amber-300">Yeni Oda Oluştur</h3>
                    <span className="text-[11px] text-slate-400">Oda yetkilisi olarak başlarsın</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="create-room-name" className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Oda Adı (Opsiyonel)
                      </label>
                      <input
                        id="create-room-name"
                        type="text"
                        maxLength={28}
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Örn: Arkadaş Arenası"
                        className="w-full min-h-[42px] rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="create-room-pass" className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Oda Şifresi (Opsiyonel)
                      </label>
                      <input
                        id="create-room-pass"
                        type="text"
                        maxLength={24}
                        value={newRoomPassword}
                        onChange={(e) => setNewRoomPassword(e.target.value)}
                        placeholder="Boş bırakırsan herkese açık"
                        className="w-full min-h-[42px] rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="min-h-[40px] px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={!connected}
                      className="min-h-[40px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold whitespace-nowrap"
                    >
                      Odayı Aç ve Katıl
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {rooms.map((r) => {
                  const isPlaying = r.status === 'playing' || r.status === 'countdown';
                  const isFull = r.humanCount >= r.maxHumans;
                  const canJoin = connected && !isPlaying && !isFull;
                  const showingPasswordPrompt = promptRoomCode === r.code && r.hasPassword;

                  return (
                    <div
                      key={r.code}
                      data-testid={`room-card-${r.code}`}
                      className="rounded-xl bg-slate-900/80 border border-slate-700/80 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {r.hasPassword ? (
                                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="Şifreli Oda" />
                              ) : (
                                <LockOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-label="Açık Oda" />
                              )}
                              <h3 className="font-display text-sm font-bold text-slate-100 truncate">
                                {r.name}
                              </h3>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                              <span>{r.code}</span>
                              <span>·</span>
                              <span className={isPlaying ? 'text-amber-300' : 'text-emerald-300'}>
                                {isPlaying ? 'Oyunda' : 'Bekliyor'}
                              </span>
                              <span>·</span>
                              <span className="text-cyan-300 font-semibold">
                                Sv. {r.wave}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-xs font-mono tabular-nums font-bold text-slate-200 shrink-0">
                            {r.humanCount}/{r.maxHumans}
                          </div>
                        </div>

                        {/* Enrolled Players Preview */}
                        <div className="mt-3 min-h-[44px] rounded-lg bg-slate-950/70 border border-slate-800/90 px-2.5 py-2">
                          {r.players.length === 0 ? (
                            <span className="text-xs text-slate-500">Oda boş — ilk katılan yetkili olur</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {r.players.map((p) => (
                                <span
                                  key={p.id}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-800/90 border border-slate-700/80 px-2 py-0.5 text-xs text-slate-200"
                                >
                                  <span
                                    className="w-2 h-2 rounded-sm shrink-0"
                                    style={{ backgroundColor: p.color }}
                                  />
                                  <span className="truncate max-w-[84px]">{p.name}</span>
                                  <span className="font-mono tabular-nums text-[10px] text-cyan-300">
                                    Sv.{p.unlockedLevel}
                                  </span>
                                  {p.isHost && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {showingPasswordPrompt ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            onJoinRoom(r.code, playerName, joinPassword);
                          }}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="password"
                            value={joinPassword}
                            onChange={(e) => setJoinPassword(e.target.value)}
                            placeholder="Oda şifresi"
                            autoFocus
                            className="flex-1 min-w-0 min-h-[42px] rounded-lg bg-slate-950 border border-amber-500/60 px-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="submit"
                            disabled={!canJoin}
                            className="min-h-[42px] px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs whitespace-nowrap"
                          >
                            Gir
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          disabled={!canJoin}
                          onClick={() => {
                            if (r.hasPassword) {
                              setPromptRoomCode(r.code);
                              setJoinPassword('');
                            } else {
                              onJoinRoom(r.code, playerName);
                            }
                          }}
                          className={`w-full min-h-[44px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                            canJoin
                              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Users className="w-4 h-4" />
                          {isPlaying ? 'Maç Devam Ediyor' : isFull ? 'Oda Dolu (4/4)' : r.hasPassword ? 'Şifreyle Katıl' : 'Odaya Katıl'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Room Info & Invite */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-700/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono font-bold text-amber-300">{room.code}</span>
                  <span>·</span>
                  <span
                    data-testid="room-active-wave"
                    className="font-semibold text-slate-200 font-mono tabular-nums"
                  >
                    Seviye {room.wave} / {MAX_MP_LEVEL}
                  </span>
                  <span>·</span>
                  <span
                    data-testid="room-party-max-level"
                    className="font-mono tabular-nums text-cyan-300 font-semibold"
                  >
                    Grup Limiti: Sv. {room.partyMaxLevel}
                  </span>
                  <span>·</span>
                  <span className="text-rose-300 font-medium">
                    {getMpLevelDifficultyLabel(room.wave)}
                  </span>
                  <span>·</span>
                  <span>{humanMembers.length}/{room.maxHumans} Oyuncu</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100">
                  {room.hasPassword ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-300">
                      <Lock className="w-4 h-4" /> Şifreli Oda
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-emerald-300">
                      <LockOpen className="w-4 h-4" /> Herkese Açık Oda
                    </span>
                  )}
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: getLevelBiome(room.wave, false).hudAccentColor }}
                  >
                    {getLevelBiome(room.wave, false).name}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Tüm grup aynı seviyede oynar; en düşük seviyeli arkadaşa göre en fazla Seviye {room.partyMaxLevel} açılır.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    micEnabled
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/30'
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {micEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-slate-400" />}
                  {micEnabled ? 'Mikrofon Açık' : 'Mikrofonu Aç'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="min-h-[44px] px-3.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
                  {copiedLink ? 'Link Kopyalandı' : 'Davet Linki'}
                </button>
              </div>
            </div>

            {voiceError && (
              <div className="rounded-xl bg-amber-500/15 border border-amber-500/40 px-4 py-2.5 text-xs text-amber-200">
                {voiceError}
              </div>
            )}

            {/* Host Controls: Password + Bug Swarm Toggle */}
            {isHost && (
              <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-4 h-4" />
                    Oda Yetkilisi Ayarları
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleFillBots(!room.fillWithBots)}
                    className={`min-h-[36px] px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      room.fillWithBots
                        ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Bug className="w-3.5 h-3.5" />
                    {room.fillWithBots ? 'Böcek Sürüsü: Açık' : 'Böcek Sürüsü: Kapalı'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-200">Grup Seviyesi: </span>
                    <span className="font-mono tabular-nums font-bold text-cyan-300">
                      Seviye {room.wave}
                    </span>
                    <span className="text-slate-500 font-mono tabular-nums"> / {room.partyMaxLevel}</span>
                    {room.partyMaxLevel < MAX_MP_LEVEL && (
                      <span className="block sm:inline sm:ml-2 text-[11px] text-amber-300/90">
                        (İleri seviye için önce Seviye {room.partyMaxLevel} geçilmeli)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="mp-wave-prev"
                      disabled={room.wave <= 1}
                      onClick={() => onChangeMpWave(room.wave - 1)}
                      aria-label="Önceki seviye"
                      className="min-h-[34px] min-w-[34px] rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono tabular-nums text-xs font-bold text-slate-100 px-2">
                      {room.wave}
                    </span>
                    <button
                      type="button"
                      data-testid="mp-wave-next"
                      disabled={room.wave >= room.partyMaxLevel}
                      onClick={() => onChangeMpWave(room.wave + 1)}
                      aria-label="Sonraki seviye"
                      className="min-h-[34px] min-w-[34px] rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSetPassword(hostPasswordInput.trim());
                    setHostPasswordInput('');
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <div className="relative flex-1 min-w-[160px]">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={24}
                      value={hostPasswordInput}
                      onChange={(e) => setHostPasswordInput(e.target.value)}
                      placeholder={room.hasPassword ? 'Yeni şifre yaz...' : 'Odaya şifre ekle (opsiyonel)'}
                      className="w-full min-h-[40px] rounded-lg bg-slate-950 border border-slate-700 pl-8 pr-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!hostPasswordInput.trim()}
                    className="min-h-[40px] px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs whitespace-nowrap"
                  >
                    Şifre Kaydet
                  </button>
                  {room.hasPassword && (
                    <button
                      type="button"
                      onClick={() => onSetPassword('')}
                      className="min-h-[40px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs whitespace-nowrap"
                    >
                      Şifreyi Kaldır
                    </button>
                  )}
                </form>
              </div>
            )}

            {/* Human Players List (Bots stay nameless) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  Oyuncular ({humanMembers.length}/4 · Sol Üst & Sol Alt 2+2 Başlangıç)
                </span>
                {room.fillWithBots && botCount > 0 && (
                  <span className="text-xs text-rose-300 flex items-center gap-1">
                    <Bug className="w-3.5 h-3.5" />
                    {botCount} Böcek
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-800 rounded-xl bg-slate-900/60 border border-slate-800 px-3.5">
                {humanMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-sm shrink-0 border border-slate-950"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {m.name}
                        {m.id === clientId && ' (Sen)'}
                      </span>
                      {m.isHost && (
                        <Crown className="w-4 h-4 text-amber-400 shrink-0" aria-label="Oda Yetkilisi" />
                      )}
                      {m.voiceEnabled ? (
                        <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-label="Sesli Sohbet Açık" />
                      ) : (
                        <MicOff className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-label="Mikrofon Kapalı" />
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 text-xs shrink-0">
                      <span
                        data-testid={`member-level-${m.id}`}
                        className={`font-mono tabular-nums px-2 py-0.5 rounded-md border ${
                          m.unlockedLevel === room.partyMaxLevel && humanMembers.length > 1
                            ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                            : 'bg-slate-800 border-slate-700 text-cyan-300'
                        }`}
                      >
                        Sv. {m.unlockedLevel}
                      </span>
                      {m.pingMs > 0 && (
                        <span className="hidden sm:inline font-mono tabular-nums text-slate-400">
                          {m.pingMs}ms
                        </span>
                      )}
                      <span
                        className={`font-semibold ${
                          m.ready ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {m.ready ? 'Hazır' : 'Bekleniyor'}
                      </span>
                      {isHost && !m.isHost && (
                        <button
                          type="button"
                          onClick={() => onKickMember(m.id)}
                          title={`${m.name} oyuncusunu odadan at`}
                          className="min-h-[32px] px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-semibold flex items-center gap-1 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>At</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-1 flex items-center gap-3">
              {isHost ? (
                <button
                  type="button"
                  onClick={onStartMatch}
                  className="w-full min-h-[50px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Maçı Başlat
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleReady(!me?.ready)}
                  className={`w-full min-h-[50px] rounded-xl font-display font-bold text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    me?.ready
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  {me?.ready ? 'Hazırsın (İptal Et)' : 'Hazırım'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
