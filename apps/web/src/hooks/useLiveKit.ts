import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, type LocalParticipant, ConnectionState } from 'livekit-client';

interface UseLiveKitResult {
  room: Room | null;
  isConnected: boolean;
  isConnecting: boolean;
  localParticipant: LocalParticipant | null;
  disconnect: () => Promise<void>;
  connectionError: string | null;
}

export function useLiveKit(
  token: string | null,
  wsUrl: string | null
): UseLiveKitResult {
  const roomRef = useRef<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !wsUrl) return;

    let cancelled = false;

    async function connect() {
      setIsConnecting(true);
      setConnectionError(null);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      room.on(RoomEvent.Connected, () => {
        if (!cancelled) {
          setIsConnected(true);
          setIsConnecting(false);
          setLocalParticipant(room.localParticipant);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        if (!cancelled) {
          setIsConnected(false);
          setLocalParticipant(null);
        }
      });

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (!cancelled) {
          if (state === ConnectionState.Connected) {
            setIsConnected(true);
            setIsConnecting(false);
          } else if (state === ConnectionState.Connecting || state === ConnectionState.Reconnecting) {
            setIsConnecting(true);
          } else if (state === ConnectionState.Disconnected) {
            setIsConnected(false);
            setIsConnecting(false);
          }
        }
      });

      try {
        await room.connect(wsUrl!, token!, {
          autoSubscribe: true,
        });
        roomRef.current = room;

        // Enable microphone after connecting
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (err) {
        if (!cancelled) {
          setConnectionError('Failed to connect to interview room. Please try again.');
          setIsConnecting(false);
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [token, wsUrl]);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
      setIsConnected(false);
      setLocalParticipant(null);
    }
  }, []);

  return {
    room: roomRef.current,
    isConnected,
    isConnecting,
    localParticipant,
    disconnect,
    connectionError,
  };
}
