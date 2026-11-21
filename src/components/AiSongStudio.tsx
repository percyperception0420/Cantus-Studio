import React, { useState } from 'react';
import { Music, Play, Square, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
import { sharedAudioEngine } from '../audio/dspEngine';
import { AiSong, BusChannel, BusId } from '../types/studio';

interface AiSongStudioProps {
  songs: AiSong[];
  buses: Record<BusId, BusChannel>;
  onSongCreated: (song: AiSong) => void;
  onLoadToDaw: (song: AiSong) => void;
}

const GENRE_OPTIONS = [
  'Cinematic Choral',
  'Gospel & Neo-Soul',
  'Pop Anthem with Choir',
  'Nordic A Cappella',
  'Chamber Folk & Vocal',
  'R&B Vocal Harmony',
];

const QUICK_PROMPTS = [
  {
    label: 'Cathedral Choir Anthem',
    prompt: 'Soaring cinematic choir anthem with an emotional soprano soloist, warm cathedral reverb, lush suspended chords, and hopeful lyrics about dawn.',
    genre: 'Cinematic Choral',
    mood: 'Luminous & Uplifting',
    bpm: 82,
    musicalKey: 'Eb Major',
  },
  {
    label: 'Modern Gospel Pocket',
    prompt: 'Warm neo-soul gospel song with velvety alto lead, tight SATB backing responses, rich minor-9th piano harmony, and uplifting lyrics.',
    genre: 'Gospel & Neo-Soul',
    mood: 'Soulful & Warm',
    bpm: 92,
    musicalKey: 'C Minor',
  },
  {
    label: 'Ethereal Chamber Ballad',
    prompt: 'Intimate chamber vocal ballad for lyric tenor soloist and soft four-part choir in D minor, minimal piano accompaniment, poetic winter imagery.',
    genre: 'Chamber Folk & Vocal',
    mood: 'Intimate & Reflective',
    bpm: 74,
    musicalKey: 'D Minor',
  },
];

export const AiSongStudio: React.FC<AiSongStudioProps> = ({
  songs,
  buses,
  onSongCreated,
  onLoadToDaw,
}) => {
  const [prompt, setPrompt] = useState(QUICK_PROMPTS[0].prompt);
  const [genre, setGenre] = useState(QUICK_PROMPTS[0].genre);
  const [mood, setMood] = useState(QUICK_PROMPTS[0].mood);
  const [bpm, setBpm] = useState(84);
  const [musicalKey, setMusicalKey] = useState('Eb Major');
  const [lyricsHint, setLyricsHint] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string>(songs[0]?.id ?? '');
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const activeSong = songs.find((s) => s.id === selectedSongId) ?? songs[0];

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setErrorMsg('Enter a musical description or style prompt before composing.');
      return;
    }
    setErrorMsg(null);
    setIsComposing(true);
    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          genre,
          mood,
          bpm,
          musicalKey,
          lyricsHint: lyricsHint.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not compose song. Please try again.');
        return;
      }
      if (data.song) {
        onSongCreated(data.song);
        setSelectedSongId(data.song.id);
      }
    } catch {
      setErrorMsg('Network error reaching the AI composition endpoint.');
    } finally {
      setIsComposing(false);
    }
  };

  const handlePreviewSong = async (song: AiSong) => {
    if (previewingId === song.id) {
      sharedAudioEngine.stop();
      setPreviewingId(null);
      return;
    }
    sharedAudioEngine.stop();
    sharedAudioEngine.init(buses, song.tracks, song.bpm, 32);
    await sharedAudioEngine.play();
    setPreviewingId(song.id);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Suno-Style Song Prompt Composer */}
      <section
        aria-label="AI Song Composer"
        className="lg:col-span-5 bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-5"
      >
        <div>
          <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
            AI Song Studio
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1 leading-relaxed">
            Compose full vocal &amp; SATB choral songs from a text brief. Generates lyrics, chord progressions, and multi-track vocal voicings ready to audition through your 8-bus DAW mastering rack.
          </p>
        </div>

        {/* Starter Briefs */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[#94A3B8]">Starter Briefs</span>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                type="button"
                onClick={() => {
                  setPrompt(qp.prompt);
                  setGenre(qp.genre);
                  setMood(qp.mood);
                  setBpm(qp.bpm);
                  setMusicalKey(qp.musicalKey);
                  setErrorMsg(null);
                }}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#1C2029] text-[#CBD5E1] border border-[#2E3444] hover:border-amber-500/50 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleCompose} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="song-prompt" className="text-xs font-medium text-[#E2E8F0]">
              Song Style &amp; Arrangement Prompt
            </label>
            <textarea
              id="song-prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe vocal style, choral texture, instruments, atmosphere, and story..."
              className="w-full rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-2.5 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="song-genre" className="text-xs font-medium text-[#E2E8F0]">
                Genre
              </label>
              <select
                id="song-genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-500"
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="song-mood" className="text-xs font-medium text-[#E2E8F0]">
                Mood
              </label>
              <input
                id="song-mood"
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="song-bpm" className="text-xs font-medium text-[#E2E8F0]">
                Tempo (BPM)
              </label>
              <input
                id="song-bpm"
                type="number"
                min={56}
                max={160}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value) || 84)}
                className="rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-2 text-sm font-mono tabular-nums text-[#F1F5F9] focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="song-key" className="text-xs font-medium text-[#E2E8F0]">
                Key Signature
              </label>
              <select
                id="song-key"
                value={musicalKey}
                onChange={(e) => setMusicalKey(e.target.value)}
                className="rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-500"
              >
                {['Eb Major', 'C Major', 'F Major', 'G Major', 'Bb Major', 'C Minor', 'D Minor', 'A Minor'].map(
                  (k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="song-lyrics-hint" className="text-xs font-medium text-[#E2E8F0]">
              Custom Lyrics / Theme (Optional)
            </label>
            <input
              id="song-lyrics-hint"
              type="text"
              value={lyricsHint}
              onChange={(e) => setLyricsHint(e.target.value)}
              placeholder="e.g. A chorus about stars over quiet water"
              className="rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-2 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-amber-500"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-md bg-red-500/10 border border-red-500/40 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isComposing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold bg-amber-500 text-[#0E1014] hover:bg-amber-400 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isComposing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Composing Multi-Track Song...
              </>
            ) : (
              <>
                <Music className="w-4 h-4" />
                Compose Full Song
              </>
            )}
          </button>
        </form>
      </section>

      {/* Right: Studio Song Library & Selected Song Inspector */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        {/* Library List */}
        <section
          aria-label="Studio Song Library"
          className="bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F1F5F9]">Studio Arrangements</h2>
            <span className="text-xs font-mono text-[#64748B] tabular-nums">
              {songs.length} Tracks
            </span>
          </div>

          <div className="divide-y divide-[#222733]">
            {songs.map((song) => {
              const isSelected = activeSong?.id === song.id;
              const isPreviewing = previewingId === song.id;
              return (
                <div
                  key={song.id}
                  className={`py-3 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'text-[#F1F5F9]' : 'text-[#CBD5E1]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSongId(song.id)}
                    className="text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-amber-400' : 'text-[#F1F5F9]'
                        }`}
                      >
                        {song.title}
                      </span>
                    </div>
                    <div className="text-xs text-[#94A3B8] mt-0.5 font-mono">
                      {song.genre} · {song.bpm} BPM · {song.musicalKey} · {song.tracks.length} Stems
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePreviewSong(song)}
                      aria-label={isPreviewing ? `Stop preview of ${song.title}` : `Preview ${song.title}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        isPreviewing
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-[#1C2029] text-[#E2E8F0] border-[#2E3444] hover:text-white'
                      }`}
                    >
                      {isPreviewing ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {isPreviewing ? 'Stop' : 'Preview'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sharedAudioEngine.stop();
                        setPreviewingId(null);
                        onLoadToDaw(song);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 text-[#0E1014] hover:bg-amber-400 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Load to DAW
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Active Song Sheet: Lyrics & Chord Progression */}
        {activeSong && (
          <section
            aria-label={`Song Sheet: ${activeSong.title}`}
            className="bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-4"
          >
            <div className="border-b border-[#222733] pb-3">
              <h3 className="text-base font-semibold text-[#F1F5F9]">{activeSong.title}</h3>
              <p className="text-xs text-[#94A3B8] mt-1">{activeSong.stylePrompt}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSong.sections.map((sec, idx) => (
                <div
                  key={`${sec.name}-${idx}`}
                  className="bg-[#101319] border border-[#222733] rounded-md p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-400">{sec.name}</span>
                    <span className="font-mono text-[#64748B] tabular-nums">{sec.bars} Bars</span>
                  </div>
                  <div className="text-xs font-mono text-[#CBD5E1]">
                    {sec.chords.join('  |  ')}
                  </div>
                  <p className="text-sm text-[#E2E8F0] whitespace-pre-line leading-relaxed mt-1">
                    {sec.lyrics}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
