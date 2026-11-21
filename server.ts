import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import { createDefaultBuses, updatePluginInBuses } from './src/audio/pluginCatalog.ts';
import { CURATED_SONGS, DEFAULT_SONG, buildVoicedTracks } from './src/audio/demoArrangements.ts';
import {
  AiSong,
  ActivityEvent,
  BusId,
  Collaborator,
  StudioState,
  VoiceAcousticMetrics,
  WsClientMessage,
  WsServerMessage,
} from './src/types/studio.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface RoomClient {
  ws: WebSocket;
  user: Collaborator;
}

interface RoomRecord {
  state: StudioState;
  clients: Map<string, RoomClient>;
}

const rooms = new Map<string, RoomRecord>();

function getOrCreateRoom(roomId: string): RoomRecord {
  const cleanId = roomId.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 40) || 'studio-main';
  let room = rooms.get(cleanId);
  if (!room) {
    room = {
      state: {
        roomId: cleanId,
        projectTitle: DEFAULT_SONG.title,
        bpm: DEFAULT_SONG.bpm,
        musicalKey: DEFAULT_SONG.musicalKey,
        totalBeats: 32,
        buses: createDefaultBuses(),
        tracks: structuredClone(DEFAULT_SONG.tracks),
        messages: [
          {
            id: 'msg-welcome',
            authorId: 'studio-system',
            authorName: 'Studio Session',
            authorColor: '#F59E0B',
            text: 'Choral & Soloist template loaded with all 8 buses (SATB Section, Soloist Stem, Soloist Bus, Choir Bus, Master Bus) and 26 active plugin slots.',
            barMarker: 1,
            busTag: 'Master Bus',
            timestamp: new Date().toISOString(),
          },
        ],
        activity: [
          {
            id: 'act-init',
            actor: 'Session',
            summary: `Initialized room "${cleanId}" with "${DEFAULT_SONG.title}"`,
            timestamp: new Date().toISOString(),
          },
        ],
        savedSongs: structuredClone(CURATED_SONGS),
      },
      clients: new Map(),
    };
    rooms.set(cleanId, room);
  }
  return room;
}

function broadcast(room: RoomRecord, payload: WsServerMessage, excludeClientId?: string): void {
  const encoded = JSON.stringify(payload);
  for (const [id, client] of room.clients.entries()) {
    if (excludeClientId && id === excludeClientId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(encoded);
    }
  }
}

function pushActivity(room: RoomRecord, actor: string, summary: string): void {
  const event: ActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actor,
    summary,
    timestamp: new Date().toISOString(),
  };
  room.state.activity = [event, ...room.state.activity].slice(0, 40);
  broadcast(room, { type: 'activity:event', event });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health & room listing
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      activeRooms: rooms.size,
      geminiConfigured: Boolean(getGeminiClient()),
    });
  });

  // Suno-style AI Song Composition endpoint using Gemini 4 Hydrogen
  app.post('/api/compose', async (req, res) => {
    try {
      const { prompt, genre, mood, bpm, musicalKey, lyricsHint } = req.body ?? {};
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Please provide a song prompt describing style, mood, or theme.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets. Configure a key to generate new AI songs, or load any curated studio arrangement below.',
        });
      }

      const userBrief = [
        `Compose an original vocal & choral song arrangement inspired by: "${prompt.trim()}".`,
        genre ? `Target genre: ${genre}.` : '',
        mood ? `Mood: ${mood}.` : '',
        bpm ? `Preferred tempo around ${bpm} BPM.` : '',
        musicalKey ? `Preferred key: ${musicalKey}.` : '',
        lyricsHint ? `Incorporate lyrical theme or lines: ${lyricsHint}.` : '',
        'Return an 8-bar progression with 5-voice MIDI note numbers per bar in the order [bass (38-55), tenor (50-64), alto (57-69), soprano (64-79), soloist (64-81)], ensuring rich, consonant voice-leading.',
      ]
        .filter(Boolean)
        .join(' ');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userBrief,
        config: {
          systemInstruction:
            'You are an award-winning choral arranger, vocal producer, and songwriter. Write poetic, singable lyrics with clear meter and musically accurate SATB + Soloist MIDI voice-leading.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              genre: { type: Type.STRING },
              mood: { type: Type.STRING },
              bpm: { type: Type.INTEGER },
              musicalKey: { type: Type.STRING },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    bars: { type: Type.INTEGER },
                    chords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    lyrics: { type: Type.STRING },
                  },
                },
              },
              barVoicings: {
                type: Type.ARRAY,
                description: '8 arrays of 5 MIDI integers: [bass, tenor, alto, soprano, soloist]',
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                },
              },
            },
          },
        },
      });

      const raw = (response.text ?? '').trim();
      const parsed = JSON.parse(raw);
      const clampedBpm = Math.max(56, Math.min(160, Number(parsed.bpm) || Number(bpm) || 88));
      const song: AiSong = {
        id: `song-${Date.now()}`,
        title: parsed.title || 'Untitled Choral Piece',
        stylePrompt: prompt.trim(),
        genre: parsed.genre || genre || 'Contemporary Choral',
        mood: parsed.mood || mood || 'Expressive',
        bpm: clampedBpm,
        musicalKey: parsed.musicalKey || musicalKey || 'C Major',
        timeSignature: '4/4',
        createdAt: new Date().toISOString(),
        sections: Array.isArray(parsed.sections) && parsed.sections.length > 0
          ? parsed.sections
          : [
              {
                name: 'Verse 1',
                bars: 4,
                chords: ['C', 'Am', 'F', 'G'],
                lyrics: 'Voices gather in the quiet light.',
              },
            ],
        tracks: buildVoicedTracks(Array.isArray(parsed.barVoicings) ? parsed.barVoicings : []),
      };

      return res.json({ song });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate AI song.';
      return res.status(502).json({ error: `AI Song Composer failed: ${message}` });
    }
  });

  // Multimodal Voice & Genre Analyzer endpoint using Gemini 4 Hydrogen
  app.post('/api/voice/analyze', async (req, res) => {
    try {
      const { metrics, audioBase64, mimeType, singerGoal } = req.body as {
        metrics?: VoiceAcousticMetrics;
        audioBase64?: string;
        mimeType?: string;
        singerGoal?: string;
      };

      if (!metrics) {
        return res.status(400).json({ error: 'Measured acoustic metrics are required for vocal analysis.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets. Acoustic DSP analysis is still available locally.',
        });
      }

      const textPrompt = [
        'Analyze this singer’s voice based on the measured acoustic metrics (and audio recording if attached).',
        `Measured metrics: lowest ${metrics.lowestNote} (${metrics.lowestHz} Hz), highest ${metrics.highestNote} (${metrics.highestHz} Hz), median ${metrics.medianHz} Hz, comfortable tessitura ${metrics.tessituraRange}, spectral centroid ${metrics.spectralCentroidHz} Hz (${metrics.timbreBrightness}), estimated vibrato ${metrics.estimatedVibratoHz} Hz, dynamic range ${metrics.dynamicRangeDb} dB.`,
        singerGoal ? `Singer’s artistic goal: ${singerGoal}.` : '',
        'Classify their exact voice fach (one of: Soprano, Mezzo-Soprano, Alto, Tenor, Baritone, Bass), sub-category, best-fit musical genres (3–4 genres with 0-100 fitScore and concise reasons), ideal singing keys, vocal strengths, coaching tips, and tailored DAW plugin parameter recommendations for FabFilter Pro-Q 3 (soloist-stem), Black Box Analog Design HG-2 (soloist-bus), and Rule Tec EQ5M (soloist-bus).',
      ]
        .filter(Boolean)
        .join(' ');

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (audioBase64 && mimeType && audioBase64.length < 10_000_000) {
        parts.push({ inlineData: { mimeType, data: audioBase64 } });
      }
      parts.push({ text: textPrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'You are a world-class vocal pedagogue, A&R vocal director, and Grammy-winning vocal mixing engineer. Ground every recommendation in vocal acoustics and pro-audio mixing technique.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              voiceType: {
                type: Type.STRING,
                description: 'Must be one of Soprano, Mezzo-Soprano, Alto, Tenor, Baritone, Bass',
              },
              subCategory: { type: Type.STRING },
              timbreSummary: { type: Type.STRING },
              recommendedGenres: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    genre: { type: Type.STRING },
                    fitScore: { type: Type.INTEGER },
                    reason: { type: Type.STRING },
                  },
                },
              },
              idealKeys: { type: Type.ARRAY, items: { type: Type.STRING } },
              vocalStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              coachingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              hpfHz: { type: Type.INTEGER },
              hg2Air: { type: Type.INTEGER },
              hg2Triode: { type: Type.INTEGER },
              eq5mHighPeak: { type: Type.NUMBER },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const validFachs = ['Soprano', 'Mezzo-Soprano', 'Alto', 'Tenor', 'Baritone', 'Bass'] as const;
      type ValidFach = (typeof validFachs)[number];
      const voiceType: ValidFach = (validFachs as readonly string[]).includes(parsed.voiceType)
        ? (parsed.voiceType as ValidFach)
        : 'Tenor';
      const busMap: Record<ValidFach, BusId> = {
        Soprano: 'soprano',
        'Mezzo-Soprano': 'alto',
        Alto: 'alto',
        Tenor: 'tenor',
        Baritone: 'bass',
        Bass: 'bass',
      };
      const targetBus = busMap[voiceType];
      const hpfFreq = Math.max(45, Math.min(180, Number(parsed.hpfHz) || 95));
      const air = Math.max(10, Math.min(85, Number(parsed.hg2Air) || 38));
      const triode = Math.max(15, Math.min(85, Number(parsed.hg2Triode) || 46));
      const highPeakGain = Math.max(0.5, Math.min(6, Number(parsed.eq5mHighPeak) || 2.8));

      return res.json({
        analysis: {
          voiceType,
          subCategory: parsed.subCategory || `Lyric ${voiceType}`,
          confidenceNote: `Gemini multimodal + DSP: ${metrics.lowestNote}–${metrics.highestNote} (median ${metrics.medianHz} Hz)`,
          targetBus,
          timbreSummary: parsed.timbreSummary || `${metrics.timbreBrightness} voice profile centered around ${metrics.tessituraRange}.`,
          recommendedGenres: Array.isArray(parsed.recommendedGenres) ? parsed.recommendedGenres : [],
          idealKeys: Array.isArray(parsed.idealKeys) ? parsed.idealKeys : ['C Major', 'G Major'],
          vocalStrengths: Array.isArray(parsed.vocalStrengths) ? parsed.vocalStrengths : [],
          coachingTips: Array.isArray(parsed.coachingTips) ? parsed.coachingTips : [],
          pluginRecommendations: [
            {
              busId: 'soloist-stem',
              pluginTypeId: 'fabfilter-pro-q-3',
              pluginName: 'FabFilter Pro-Q 3 (Soloist Stem)',
              rationale: `High-pass tuned to ${hpfFreq} Hz for ${voiceType} vocal range.`,
              suggestedParams: { hpfFreq, lowGain: -1.5, highShelf: 1.8 },
            },
            {
              busId: 'soloist-bus',
              pluginTypeId: 'black-box-hg-2',
              pluginName: 'Black Box Analog Design HG-2 (Soloist Bus)',
              rationale: `Calibrates Triode warmth (${triode}%) and Air (${air}%) to complement your vocal timbre.`,
              suggestedParams: { triode, air, pentode: 36, saturation: 32, mix: 68 },
            },
            {
              busId: 'soloist-bus',
              pluginTypeId: 'rule-tec-eq5m',
              pluginName: 'Rule Tec EQ5M (Soloist Bus)',
              rationale: `Enhances vocal diction with +${highPeakGain.toFixed(1)} High Peak focus.`,
              suggestedParams: { dipAtten: 2.2, highPeakGain },
            },
            {
              busId: targetBus,
              pluginTypeId: 'fabfilter-pro-q-3',
              pluginName: `FabFilter Pro-Q 3 (${voiceType} Section Bus)`,
              rationale: `Synchronizes ${voiceType} section bus HPF (${hpfFreq} Hz) with your vocal profile.`,
              suggestedParams: { hpfFreq, highShelf: 1.5 },
            },
          ],
          metrics,
          source: 'gemini-ai',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Voice analysis failed.';
      return res.status(502).json({ error: `Gemini Voice Analyzer error: ${message}` });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let joinedRoom: RoomRecord | null = null;
    let clientId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientMessage;

        if (msg.type === 'room:join') {
          const room = getOrCreateRoom(msg.roomId);
          joinedRoom = room;
          clientId = msg.user.id;
          const collab: Collaborator = {
            id: msg.user.id,
            name: msg.user.name || 'Studio Guest',
            role: msg.user.role || 'Producer',
            color: msg.user.color || '#F59E0B',
            activeView: 'daw',
            joinedAt: new Date().toISOString(),
          };
          room.clients.set(clientId, { ws, user: collab });

          const collaborators = Array.from(room.clients.values()).map((c) => c.user);
          const initPayload: WsServerMessage = {
            type: 'state:init',
            state: room.state,
            collaborators,
          };
          ws.send(JSON.stringify(initPayload));
          broadcast(room, { type: 'presence:list', collaborators }, clientId);
          pushActivity(room, collab.name, 'joined the studio session');
          return;
        }

        if (!joinedRoom || !clientId) return;
        const sender = joinedRoom.clients.get(clientId)?.user;
        const actor = sender?.name ?? 'Collaborator';

        if (msg.type === 'presence:update' && sender) {
          sender.activeView = msg.activeView;
          sender.selectedBusId = msg.selectedBusId;
          const collaborators = Array.from(joinedRoom.clients.values()).map((c) => c.user);
          broadcast(joinedRoom, { type: 'presence:list', collaborators });
        } else if (msg.type === 'bus:update') {
          const bus = joinedRoom.state.buses[msg.busId];
          if (!bus) return;
          joinedRoom.state.buses[msg.busId] = { ...bus, ...msg.patch };
          broadcast(
            joinedRoom,
            { type: 'bus:updated', busId: msg.busId, patch: msg.patch, actor },
            clientId
          );
          if (msg.patch.muted !== undefined || msg.patch.soloed !== undefined) {
            pushActivity(
              joinedRoom,
              actor,
              `updated ${bus.name} (${msg.patch.muted ? 'Muted' : msg.patch.soloed ? 'Soloed' : 'Active'})`
            );
          }
        } else if (msg.type === 'plugin:update') {
          joinedRoom.state.buses = updatePluginInBuses(
            joinedRoom.state.buses,
            msg.busId,
            msg.pluginId,
            msg.patch
          );
          broadcast(
            joinedRoom,
            {
              type: 'plugin:updated',
              busId: msg.busId,
              pluginId: msg.pluginId,
              patch: msg.patch,
              actor,
            },
            clientId
          );
          const busName = joinedRoom.state.buses[msg.busId]?.name ?? msg.busId;
          const pluginName =
            joinedRoom.state.buses[msg.busId]?.plugins.find((p) => p.id === msg.pluginId)?.name ??
            'Plugin';
          if (msg.patch.bypassed !== undefined) {
            pushActivity(
              joinedRoom,
              actor,
              `${msg.patch.bypassed ? 'bypassed' : 'engaged'} ${pluginName} on ${busName}`
            );
          }
        } else if (msg.type === 'track:update') {
          joinedRoom.state.tracks = joinedRoom.state.tracks.map((t) =>
            t.id === msg.trackId ? { ...t, ...msg.patch } : t
          );
          broadcast(
            joinedRoom,
            { type: 'track:updated', trackId: msg.trackId, patch: msg.patch, actor },
            clientId
          );
        } else if (msg.type === 'song:load') {
          joinedRoom.state.projectTitle = msg.song.title;
          joinedRoom.state.bpm = msg.song.bpm;
          joinedRoom.state.musicalKey = msg.song.musicalKey;
          joinedRoom.state.tracks = structuredClone(msg.song.tracks);
          if (!joinedRoom.state.savedSongs.some((s) => s.id === msg.song.id)) {
            joinedRoom.state.savedSongs = [msg.song, ...joinedRoom.state.savedSongs].slice(0, 20);
          }
          broadcast(joinedRoom, { type: 'song:loaded', song: msg.song, actor }, clientId);
          pushActivity(joinedRoom, actor, `loaded arrangement "${msg.song.title}" (${msg.song.bpm} BPM)`);
        } else if (msg.type === 'project:meta') {
          if (msg.bpm !== undefined) joinedRoom.state.bpm = msg.bpm;
          if (msg.musicalKey !== undefined) joinedRoom.state.musicalKey = msg.musicalKey;
          if (msg.projectTitle !== undefined) joinedRoom.state.projectTitle = msg.projectTitle;
          broadcast(
            joinedRoom,
            {
              type: 'project:meta',
              bpm: msg.bpm,
              musicalKey: msg.musicalKey,
              projectTitle: msg.projectTitle,
              actor,
            },
            clientId
          );
        } else if (msg.type === 'chat:send') {
          // Idempotent guard against duplicate message IDs
          if (!joinedRoom.state.messages.some((m) => m.id === msg.message.id)) {
            joinedRoom.state.messages = [...joinedRoom.state.messages, msg.message].slice(-100);
            broadcast(joinedRoom, { type: 'chat:message', message: msg.message });
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      if (joinedRoom && clientId) {
        const leaving = joinedRoom.clients.get(clientId)?.user;
        joinedRoom.clients.delete(clientId);
        const collaborators = Array.from(joinedRoom.clients.values()).map((c) => c.user);
        broadcast(joinedRoom, { type: 'presence:list', collaborators });
        if (leaving) {
          pushActivity(joinedRoom, leaving.name, 'left the studio session');
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cantus Studio server listening on http://localhost:${PORT}`);
  });
}

startServer();
