import { useCallback, useEffect, useRef, useState } from 'react';
import { createDefaultBuses, updatePluginInBuses } from '../audio/pluginCatalog';
import { CURATED_SONGS, DEFAULT_SONG } from '../audio/demoArrangements';
import {
  AiSong,
  BusChannel,
  BusId,
  Collaborator,
  DawTrack,
  MixNoteMessage,
  StudioState,
  WsClientMessage,
  WsServerMessage,
} from '../types/studio';

const USER_COLORS = ['#F59E0B', '#38BDF8', '#10B981', '#F97316', '#A78BFA', '#2DD4BF'];

function getOrCreateLocalUser(): { id: string; name: string; role: string; color: string } {
  if (typeof window === 'undefined') {
    return { id: 'user-local', name: 'Lead Engineer', role: 'Mix Engineer', color: '#F59E0B' };
  }
  const stored = window.sessionStorage.getItem('cantus_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallthrough
    }
  }
  const num = Math.floor(10 + Math.random() * 89);
  const user = {
    id: `u-${Date.now()}-${num}`,
    name: `Engineer ${num}`,
    role: 'Vocal Producer',
    color: USER_COLORS[num % USER_COLORS.length],
  };
  window.sessionStorage.setItem('cantus_user', JSON.stringify(user));
  return user;
}

function getInitialRoomId(): string {
  if (typeof window === 'undefined') return 'studio-main';
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room');
  if (room && room.trim()) return room.trim().replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 40);
  return 'studio-main';
}

function buildFallbackState(roomId: string): StudioState {
  return {
    roomId,
    projectTitle: DEFAULT_SONG.title,
    bpm: DEFAULT_SONG.bpm,
    musicalKey: DEFAULT_SONG.musicalKey,
    totalBeats: 32,
    buses: createDefaultBuses(),
    tracks: structuredClone(DEFAULT_SONG.tracks),
    messages: [],
    activity: [],
    savedSongs: structuredClone(CURATED_SONGS),
  };
}

export function useStudioSocket() {
  const [roomId, setRoomId] = useState<string>(getInitialRoomId);
  const [localUser, setLocalUser] = useState(getOrCreateLocalUser);
  const [studio, setStudio] = useState<StudioState>(() => buildFallbackState(getInitialRoomId()));
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const userRef = useRef(localUser);
  userRef.current = localUser;

  const sendMessage = useCallback((msg: WsClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    let closedByCleanup = false;

    const connect = () => {
      if (typeof window === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        ws.send(
          JSON.stringify({
            type: 'room:join',
            roomId,
            user: userRef.current,
          } satisfies WsClientMessage)
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsServerMessage;
          if (msg.type === 'state:init') {
            setStudio(msg.state);
            setCollaborators(msg.collaborators);
          } else if (msg.type === 'presence:list') {
            setCollaborators(msg.collaborators);
          } else if (msg.type === 'bus:updated') {
            setStudio((prev) => ({
              ...prev,
              buses: {
                ...prev.buses,
                [msg.busId]: { ...prev.buses[msg.busId], ...msg.patch },
              },
            }));
          } else if (msg.type === 'plugin:updated') {
            setStudio((prev) => ({
              ...prev,
              buses: updatePluginInBuses(prev.buses, msg.busId, msg.pluginId, msg.patch),
            }));
          } else if (msg.type === 'track:updated') {
            setStudio((prev) => ({
              ...prev,
              tracks: prev.tracks.map((t) => (t.id === msg.trackId ? { ...t, ...msg.patch } : t)),
            }));
          } else if (msg.type === 'song:loaded') {
            setStudio((prev) => ({
              ...prev,
              projectTitle: msg.song.title,
              bpm: msg.song.bpm,
              musicalKey: msg.song.musicalKey,
              tracks: msg.song.tracks,
              savedSongs: prev.savedSongs.some((s) => s.id === msg.song.id)
                ? prev.savedSongs
                : [msg.song, ...prev.savedSongs],
            }));
          } else if (msg.type === 'project:meta') {
            setStudio((prev) => ({
              ...prev,
              bpm: msg.bpm ?? prev.bpm,
              musicalKey: msg.musicalKey ?? prev.musicalKey,
              projectTitle: msg.projectTitle ?? prev.projectTitle,
            }));
          } else if (msg.type === 'chat:message') {
            setStudio((prev) => {
              if (prev.messages.some((m) => m.id === msg.message.id)) return prev;
              return { ...prev, messages: [...prev.messages, msg.message] };
            });
          } else if (msg.type === 'activity:event') {
            setStudio((prev) => {
              if (prev.activity.some((a) => a.id === msg.event.id)) return prev;
              return { ...prev, activity: [msg.event, ...prev.activity].slice(0, 40) };
            });
          }
        } catch {
          // Ignore invalid payloads
        }
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        setConnectionStatus('reconnecting');
        reconnectTimerRef.current = window.setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [roomId]);

  const switchRoom = useCallback((nextRoom: string) => {
    const clean = nextRoom.trim().replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 40) || 'studio-main';
    setRoomId(clean);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', clean);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const updateUserProfile = useCallback(
    (name: string, role: string) => {
      const updated = { ...localUser, name: name.trim() || localUser.name, role: role.trim() || localUser.role };
      setLocalUser(updated);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('cantus_user', JSON.stringify(updated));
      }
      sendMessage({ type: 'room:join', roomId, user: updated });
    },
    [localUser, roomId, sendMessage]
  );

  const updateBus = useCallback(
    (busId: BusId, patch: Partial<Pick<BusChannel, 'volumeDb' | 'pan' | 'muted' | 'soloed'>>) => {
      setStudio((prev) => ({
        ...prev,
        buses: {
          ...prev.buses,
          [busId]: { ...prev.buses[busId], ...patch },
        },
      }));
      sendMessage({ type: 'bus:update', busId, patch });
    },
    [sendMessage]
  );

  const updatePlugin = useCallback(
    (busId: BusId, pluginId: string, patch: { bypassed?: boolean; params?: Record<string, number> }) => {
      setStudio((prev) => ({
        ...prev,
        buses: updatePluginInBuses(prev.buses, busId, pluginId, patch),
      }));
      sendMessage({ type: 'plugin:update', busId, pluginId, patch });
    },
    [sendMessage]
  );

  const updateTrack = useCallback(
    (trackId: string, patch: Partial<Pick<DawTrack, 'muted' | 'soloed' | 'gainDb' | 'notes'>>) => {
      setStudio((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
      }));
      sendMessage({ type: 'track:update', trackId, patch });
    },
    [sendMessage]
  );

  const loadSongIntoDaw = useCallback(
    (song: AiSong) => {
      setStudio((prev) => ({
        ...prev,
        projectTitle: song.title,
        bpm: song.bpm,
        musicalKey: song.musicalKey,
        tracks: structuredClone(song.tracks),
        savedSongs: prev.savedSongs.some((s) => s.id === song.id)
          ? prev.savedSongs
          : [song, ...prev.savedSongs],
      }));
      sendMessage({ type: 'song:load', song });
    },
    [sendMessage]
  );

  const updateProjectMeta = useCallback(
    (patch: { bpm?: number; musicalKey?: string; projectTitle?: string }) => {
      setStudio((prev) => ({
        ...prev,
        bpm: patch.bpm ?? prev.bpm,
        musicalKey: patch.musicalKey ?? prev.musicalKey,
        projectTitle: patch.projectTitle ?? prev.projectTitle,
      }));
      sendMessage({ type: 'project:meta', ...patch });
    },
    [sendMessage]
  );

  const sendMixNote = useCallback(
    (text: string, barMarker?: number, busTag?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const message: MixNoteMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        authorId: localUser.id,
        authorName: localUser.name,
        authorColor: localUser.color,
        text: trimmed,
        barMarker,
        busTag,
        timestamp: new Date().toISOString(),
      };
      setStudio((prev) => ({
        ...prev,
        messages: [...prev.messages, message],
      }));
      sendMessage({ type: 'chat:send', message });
    },
    [localUser, sendMessage]
  );

  const updatePresence = useCallback(
    (activeView: string, selectedBusId?: BusId) => {
      sendMessage({ type: 'presence:update', activeView, selectedBusId });
    },
    [sendMessage]
  );

  return {
    roomId,
    localUser,
    studio,
    collaborators,
    connectionStatus,
    switchRoom,
    updateUserProfile,
    updateBus,
    updatePlugin,
    updateTrack,
    loadSongIntoDaw,
    updateProjectMeta,
    sendMixNote,
    updatePresence,
  };
}
