export type BusId =
  | 'soprano'
  | 'alto'
  | 'tenor'
  | 'bass'
  | 'soloist-stem'
  | 'soloist-bus'
  | 'choir-bus'
  | 'master-bus';

export type BusGroup = 'section' | 'soloist' | 'choir' | 'master';

export type PluginTypeId =
  | 'fabfilter-pro-q-3'
  | 'fabfilter-saturn-2'
  | 'rule-tec-eq1a'
  | 'rule-tec-eq5m'
  | 'bx-opto'
  | 'black-box-hg-2'
  | 'valhalla-vintage-verb'
  | 'ssl-bus-comp-2'
  | 'mc77'
  | 'fabfilter-pro-mb'
  | 'ozone-12-vintage-tape'
  | 'a1-stereo-control'
  | 'fabfilter-pro-l-2';

export type PluginCategory =
  | 'EQ'
  | 'Saturation'
  | 'Dynamics'
  | 'Reverb'
  | 'Multiband'
  | 'Tape'
  | 'Stereo'
  | 'Limiter';

export interface PluginParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;
  options?: string[]; // If set, maps integer values 0..N-1 to discrete mode names
  description: string;
}

export interface PluginDefinition {
  typeId: PluginTypeId;
  name: string;
  vendor: string;
  category: PluginCategory;
  shortTag: string;
  accentHex: string;
  summary: string;
  params: PluginParamSpec[];
}

export interface PluginInstance {
  id: string;
  typeId: PluginTypeId;
  name: string;
  bypassed: boolean;
  params: Record<string, number>;
}

export interface BusChannel {
  id: BusId;
  name: string;
  shortName: string;
  group: BusGroup;
  routesTo: BusId | 'output';
  volumeDb: number; // -60 to +6 dB
  pan: number; // -1 to +1
  muted: boolean;
  soloed: boolean;
  color: string;
  plugins: PluginInstance[];
}

export interface MidiNote {
  id: string;
  pitch: number; // MIDI note number (e.g. 60 = C4)
  startBeat: number;
  durationBeats: number;
  velocity: number; // 0.1 - 1.0
  lyric?: string;
}

export interface DawTrack {
  id: string;
  name: string;
  role: 'soprano' | 'alto' | 'tenor' | 'bass' | 'soloist' | 'accompaniment';
  targetBus: BusId;
  waveformType: 'vocal-formant' | 'choir-pad' | 'warm-piano' | 'strings';
  color: string;
  muted: boolean;
  soloed: boolean;
  gainDb: number;
  notes: MidiNote[];
}

export interface SongSection {
  name: string;
  bars: number;
  chords: string[];
  lyrics: string;
}

export interface AiSong {
  id: string;
  title: string;
  stylePrompt: string;
  genre: string;
  mood: string;
  bpm: number;
  musicalKey: string;
  timeSignature: string;
  createdAt: string;
  sections: SongSection[];
  tracks: DawTrack[];
}

export type VoiceFach =
  | 'Soprano'
  | 'Mezzo-Soprano'
  | 'Alto'
  | 'Tenor'
  | 'Baritone'
  | 'Bass';

export interface VoiceAcousticMetrics {
  lowestHz: number;
  highestHz: number;
  medianHz: number;
  lowestNote: string;
  highestNote: string;
  tessituraRange: string;
  spectralCentroidHz: number;
  timbreBrightness: 'Warm & Dark' | 'Balanced & Rich' | 'Bright & Forward';
  estimatedVibratoHz: number;
  dynamicRangeDb: number;
  durationSec: number;
}

export interface VoicePluginRecommendation {
  busId: BusId;
  pluginTypeId: PluginTypeId;
  pluginName: string;
  rationale: string;
  suggestedParams: Record<string, number>;
}

export interface VoiceAnalysisResult {
  voiceType: VoiceFach;
  subCategory: string;
  confidenceNote: string;
  targetBus: BusId;
  timbreSummary: string;
  recommendedGenres: Array<{
    genre: string;
    fitScore: number;
    reason: string;
  }>;
  idealKeys: string[];
  vocalStrengths: string[];
  coachingTips: string[];
  pluginRecommendations: VoicePluginRecommendation[];
  metrics: VoiceAcousticMetrics;
  source: 'gemini-ai' | 'acoustic-dsp';
}

export interface Collaborator {
  id: string;
  name: string;
  role: string;
  color: string;
  activeView: string;
  selectedBusId?: BusId;
  joinedAt: string;
}

export interface MixNoteMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  barMarker?: number;
  busTag?: string;
  timestamp: string;
}

export interface ActivityEvent {
  id: string;
  actor: string;
  summary: string;
  timestamp: string;
}

export interface StudioState {
  roomId: string;
  projectTitle: string;
  bpm: number;
  musicalKey: string;
  totalBeats: number;
  buses: Record<BusId, BusChannel>;
  tracks: DawTrack[];
  messages: MixNoteMessage[];
  activity: ActivityEvent[];
  savedSongs: AiSong[];
}

export type WsClientMessage =
  | { type: 'room:join'; roomId: string; user: { id: string; name: string; role: string; color: string } }
  | { type: 'presence:update'; activeView: string; selectedBusId?: BusId }
  | { type: 'bus:update'; busId: BusId; patch: Partial<Pick<BusChannel, 'volumeDb' | 'pan' | 'muted' | 'soloed'>> }
  | { type: 'plugin:update'; busId: BusId; pluginId: string; patch: { bypassed?: boolean; params?: Record<string, number> } }
  | { type: 'track:update'; trackId: string; patch: Partial<Pick<DawTrack, 'muted' | 'soloed' | 'gainDb' | 'notes'>> }
  | { type: 'song:load'; song: AiSong }
  | { type: 'project:meta'; bpm?: number; musicalKey?: string; projectTitle?: string }
  | { type: 'chat:send'; message: MixNoteMessage };

export type WsServerMessage =
  | { type: 'state:init'; state: StudioState; collaborators: Collaborator[] }
  | { type: 'presence:list'; collaborators: Collaborator[] }
  | { type: 'bus:updated'; busId: BusId; patch: Partial<Pick<BusChannel, 'volumeDb' | 'pan' | 'muted' | 'soloed'>>; actor: string }
  | { type: 'plugin:updated'; busId: BusId; pluginId: string; patch: { bypassed?: boolean; params?: Record<string, number> }; actor: string }
  | { type: 'track:updated'; trackId: string; patch: Partial<Pick<DawTrack, 'muted' | 'soloed' | 'gainDb' | 'notes'>>; actor: string }
  | { type: 'song:loaded'; song: AiSong; actor: string }
  | { type: 'project:meta'; bpm?: number; musicalKey?: string; projectTitle?: string; actor: string }
  | { type: 'chat:message'; message: MixNoteMessage }
  | { type: 'activity:event'; event: ActivityEvent };
