import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientWsMessage, RoomSnapshot } from '../game/types';

export interface IncomingRtcSignal {
  fromId: string;
  signal: {
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
}

interface UseVoiceChatOptions {
  clientId: string;
  room: RoomSnapshot | null;
  sendWsMessage: (msg: ClientWsMessage) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useVoiceChat({ clientId, room, sendWsMessage }: UseVoiceChatOptions) {
  const [micEnabled, setMicEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const clientIdRef = useRef(clientId);
  const roomRef = useRef(room);

  clientIdRef.current = clientId;
  roomRef.current = room;

  const cleanupPeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      peersRef.current.delete(peerId);
    }
    const audio = audioElsRef.current.get(peerId);
    if (audio) {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {
        // ignore
      }
      audioElsRef.current.delete(peerId);
    }
    setConnectedPeers(peersRef.current.size);
  }, []);

  const cleanupAllPeers = useCallback(() => {
    for (const peerId of Array.from(peersRef.current.keys())) {
      cleanupPeer(peerId);
    }
  }, [cleanupPeer]);

  const stopLocalMic = useCallback(() => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    for (const pc of peersRef.current.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track) {
          try {
            pc.removeTrack(sender);
          } catch {
            // ignore
          }
        }
      }
    }
    setMicEnabled(false);
    sendWsMessage({ type: 'voice_state', enabled: false });
  }, [sendWsMessage]);

  const createPeer = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peersRef.current.set(peerId, pc);
      setConnectedPeers(peersRef.current.size);

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendWsMessage({
            type: 'rtc_signal',
            targetId: peerId,
            signal: { candidate: ev.candidate.toJSON() },
          });
        }
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0];
        if (!stream) return;
        let audio = audioElsRef.current.get(peerId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.setAttribute('playsinline', 'true');
          audio.style.display = 'none';
          document.body.appendChild(audio);
          audioElsRef.current.set(peerId, audio);
        }
        audio.srcObject = stream;
        audio.play().catch(() => {
          // autoplay may await interaction; user toggle satisfies gesture
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanupPeer(peerId);
        }
      };

      return pc;
    },
    [cleanupPeer, sendWsMessage]
  );

  const sendOfferTo = useCallback(
    async (peerId: string) => {
      const pc = createPeer(peerId);
      try {
        // Ensure audio transceiver exists even in listen-only mode
        if (pc.getTransceivers().length === 0) {
          pc.addTransceiver('audio', { direction: localStreamRef.current ? 'sendrecv' : 'recvonly' });
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWsMessage({
          type: 'rtc_signal',
          targetId: peerId,
          signal: { sdp: pc.localDescription ?? offer },
        });
      } catch {
        // ignore transient signaling errors
      }
    },
    [createPeer, sendWsMessage]
  );

  // Sync peers whenever room human members change
  useEffect(() => {
    if (!room || !clientId || typeof RTCPeerConnection === 'undefined') {
      cleanupAllPeers();
      if (!room && localStreamRef.current) {
        stopLocalMic();
      }
      return;
    }

    const otherHumanIds = new Set(
      room.members.filter((m) => !m.isBot && m.id !== clientId).map((m) => m.id)
    );

    // Clean up departed peers
    for (const existingId of Array.from(peersRef.current.keys())) {
      if (!otherHumanIds.has(existingId)) {
        cleanupPeer(existingId);
      }
    }

    // Establish connections with new peers (smaller ID initiates offer)
    for (const peerId of otherHumanIds) {
      if (!peersRef.current.has(peerId)) {
        createPeer(peerId);
        if (clientId < peerId) {
          void sendOfferTo(peerId);
        }
      }
    }
  }, [cleanupAllPeers, cleanupPeer, clientId, createPeer, room, sendOfferTo, stopLocalMic]);

  // Clean up everything on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
      }
      cleanupAllPeers();
    };
  }, [cleanupAllPeers]);

  const handleIncomingSignal = useCallback(
    async (fromId: string, rawSignal: unknown) => {
      if (!roomRef.current || typeof RTCPeerConnection === 'undefined') return;
      const sig = rawSignal as IncomingRtcSignal['signal'];
      const pc = createPeer(fromId);

      try {
        if (sig.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          if (sig.sdp.type === 'offer') {
            if (localStreamRef.current) {
              const existingTracks = new Set(pc.getSenders().map((s) => s.track));
              for (const track of localStreamRef.current.getTracks()) {
                if (!existingTracks.has(track)) {
                  pc.addTrack(track, localStreamRef.current);
                }
              }
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendWsMessage({
              type: 'rtc_signal',
              targetId: fromId,
              signal: { sdp: pc.localDescription ?? answer },
            });
          }
        } else if (sig.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
        }
      } catch {
        // ignore stale ICE/SDP errors
      }
    },
    [createPeer, sendWsMessage]
  );

  const toggleMic = useCallback(async () => {
    setVoiceError(null);
    if (micEnabled) {
      stopLocalMic();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('Bu tarayıcıda sesli sohbet (mikrofon) desteklenmiyor.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      setMicEnabled(true);
      sendWsMessage({ type: 'voice_state', enabled: true });

      const currentRoom = roomRef.current;
      if (currentRoom) {
        const others = currentRoom.members.filter((m) => !m.isBot && m.id !== clientIdRef.current);
        for (const peer of others) {
          const pc = createPeer(peer.id);
          const existingTracks = new Set(pc.getSenders().map((s) => s.track));
          for (const track of stream.getTracks()) {
            if (!existingTracks.has(track)) {
              pc.addTrack(track, stream);
            }
          }
          await sendOfferTo(peer.id);
        }
      }
    } catch {
      setVoiceError('Mikrofon izni verilmedi veya cihazda mikrofon bulunamadı.');
      setMicEnabled(false);
      sendWsMessage({ type: 'voice_state', enabled: false });
    }
  }, [createPeer, micEnabled, sendOfferTo, sendWsMessage, stopLocalMic]);

  return {
    micEnabled,
    voiceError,
    connectedPeers,
    toggleMic,
    handleIncomingSignal,
    stopLocalMic,
  };
}
