import React, { useRef, useState } from 'react';
import { Mic, Square, Upload, Sliders, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  analyzePcmVocalBuffer,
  classifyVoiceFromMetrics,
  detectPitchAutocorrelation,
  freqToNoteName,
} from '../audio/pitchDetection';
import { synthesizeVocalTestSample } from '../audio/dspEngine';
import { VoiceAnalysisResult, VoicePluginRecommendation } from '../types/studio';

interface VoiceAnalyzerProps {
  onApplyVocalChain: (recs: VoicePluginRecommendation[], voiceLabel: string) => void;
}

const TEST_PROFILES: Array<{
  id: 'soprano' | 'alto' | 'tenor' | 'bass';
  label: string;
  desc: string;
}> = [
  { id: 'soprano', label: 'Soprano Sample (A4–G5)', desc: 'Bright lyric upper range' },
  { id: 'alto', label: 'Alto Sample (A3–F4)', desc: 'Warm resonant chest mix' },
  { id: 'tenor', label: 'Tenor Sample (E3–E4)', desc: 'Forward contemporary lead' },
  { id: 'bass', label: 'Bass Sample (G2–E3)', desc: 'Deep choral foundation' },
];

export const VoiceAnalyzer: React.FC<VoiceAnalyzerProps> = ({ onApplyVocalChain }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [liveNote, setLiveNote] = useState('—');
  const [liveHz, setLiveHz] = useState<number | null>(null);
  const [singerGoal, setSingerGoal] = useState('');
  const [activeSample, setActiveSample] = useState<'soprano' | 'alto' | 'tenor' | 'bass' | null>('tenor');
  const [analysis, setAnalysis] = useState<VoiceAnalysisResult>(() => {
    const sample = synthesizeVocalTestSample('tenor');
    return classifyVoiceFromMetrics(analyzePcmVocalBuffer(sample.samples, sample.sampleRate));
  });
  const [audioPayload, setAudioPayload] = useState<{ base64: string; mimeType: string } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveCtxRef = useRef<AudioContext | null>(null);
  const liveIntervalRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const runDspOnAudioBuffer = (buffer: AudioBuffer) => {
    const channelData = buffer.getChannelData(0);
    const metrics = analyzePcmVocalBuffer(channelData, buffer.sampleRate);
    const result = classifyVoiceFromMetrics(metrics);
    setActiveSample(null);
    setAnalysis(result);
    setAppliedBanner(null);
    setErrorMsg(null);
  };

  const handleStartRecording = async () => {
    setErrorMsg(null);
    setAppliedBanner(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      liveCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);

      const frame = new Float32Array(analyser.fftSize);
      liveIntervalRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(frame);
        const f0 = detectPitchAutocorrelation(frame, ctx.sampleRate);
        if (f0) {
          setLiveHz(f0);
          setLiveNote(freqToNoteName(f0));
        }
      }, 120);

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const arrayBuf = await blob.arrayBuffer();

        // Store base64 for optional Gemini multimodal analysis
        const bytes = new Uint8Array(arrayBuf);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        setAudioPayload({ base64: btoa(binary), mimeType: blob.type || 'audio/webm' });

        try {
          const decodeCtx = new AudioContext();
          const decoded = await decodeCtx.decodeAudioData(arrayBuf.slice(0));
          runDspOnAudioBuffer(decoded);
          await decodeCtx.close();
        } catch {
          setErrorMsg('Recorded audio could not be decoded in this browser. Try uploading a WAV file or running a vocal sample.');
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setErrorMsg('Microphone permission was denied or no microphone is available. Upload a vocal recording or test with any built-in vocal sample below.');
    }
  };

  const handleStopRecording = () => {
    if (liveIntervalRef.current !== null) {
      window.clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    liveCtxRef.current?.close();
    setIsRecording(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setAppliedBanner(null);
    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < Math.min(bytes.byteLength, 6_000_000); i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      setAudioPayload({ base64: btoa(binary), mimeType: file.type || 'audio/wav' });

      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      runDspOnAudioBuffer(decoded);
      await ctx.close();
    } catch {
      setErrorMsg('Unable to decode uploaded audio file. Please choose a standard WAV or MP3 vocal take.');
    }
  };

  const handleRunTestSample = (profile: 'soprano' | 'alto' | 'tenor' | 'bass') => {
    setErrorMsg(null);
    setAppliedBanner(null);
    setAudioPayload(null);
    setActiveSample(profile);
    const { samples, sampleRate } = synthesizeVocalTestSample(profile);
    const metrics = analyzePcmVocalBuffer(samples, sampleRate);
    setAnalysis(classifyVoiceFromMetrics(metrics));
    setLiveHz(metrics.medianHz);
    setLiveNote(freqToNoteName(metrics.medianHz));
  };

  const handleDeepAiAnalyze = async () => {
    setErrorMsg(null);
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/voice/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: analysis.metrics,
          audioBase64: audioPayload?.base64,
          mimeType: audioPayload?.mimeType,
          singerGoal: singerGoal.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gemini vocal analysis failed.');
        return;
      }
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch {
      setErrorMsg('Could not reach the voice analysis API.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Vocal Capture & Built-In Reference Samples */}
      <section
        aria-label="Vocal Capture and Test Samples"
        className="lg:col-span-5 bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-5"
      >
        <div>
          <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
            Voice &amp; Genre Analyzer
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1 leading-relaxed">
            Measure vocal range, tessitura, and spectral timbre to discover your voice type (Soprano, Mezzo, Alto, Tenor, Baritone, Bass), best-fit music genres, and custom DAW vocal chain settings.
          </p>
        </div>

        {/* Live Pitch Readout */}
        <div className="bg-[#0B0D11] border border-[#222733] rounded-md p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#94A3B8]">Detected Pitch Center</div>
            <div className="text-2xl font-mono font-semibold text-amber-400 tabular-nums mt-0.5">
              {liveNote}{' '}
              <span className="text-sm text-[#94A3B8]">
                {liveHz ? `${liveHz.toFixed(1)} Hz` : `${analysis.metrics.medianHz} Hz`}
              </span>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-[#94A3B8] tabular-nums">
            <div>Range: {analysis.metrics.lowestNote} – {analysis.metrics.highestNote}</div>
            <div className="mt-1">Timbre: {analysis.metrics.timbreBrightness}</div>
          </div>
        </div>

        {/* Capture Controls */}
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              isRecording
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-amber-500 text-[#0E1014] hover:bg-amber-400'
            }`}
          >
            {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {isRecording ? 'Stop & Analyze Recording' : 'Record Microphone'}
          </button>

          <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-xs font-medium bg-[#1C2029] text-[#E2E8F0] border border-[#2E3444] hover:border-[#475569] hover:text-white transition-colors whitespace-nowrap cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Upload Vocal Take
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>
        </div>

        {/* Built-in Reference Samples */}
        <div className="border-t border-[#222733] pt-4 flex flex-col gap-2.5">
          <span className="text-xs font-medium text-[#94A3B8]">
            Or Analyze Calibrated Vocal Reference Samples
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TEST_PROFILES.map((tp) => {
              const selected = activeSample === tp.id;
              return (
                <button
                  key={tp.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => handleRunTestSample(tp.id)}
                  className={`text-left rounded-md border px-3 py-2.5 transition-colors cursor-pointer ${
                    selected
                      ? 'bg-amber-500/12 border-amber-500/60'
                      : 'bg-[#101319] border-[#222733] hover:border-amber-500/50'
                  }`}
                >
                  <div className={`text-xs font-semibold ${selected ? 'text-amber-300' : 'text-[#F1F5F9]'}`}>
                    {tp.label}
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">{tp.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Gemini Multimodal Vocal Coaching */}
        <div className="border-t border-[#222733] pt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="singer-goal" className="text-xs font-medium text-[#E2E8F0]">
              Artistic Goal for Deep AI Coaching (Optional)
            </label>
            <input
              id="singer-goal"
              type="text"
              value={singerGoal}
              onChange={(e) => setSingerGoal(e.target.value)}
              placeholder="e.g. Choir soloist, indie folk EP, gospel lead..."
              className="rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-2 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={handleDeepAiAnalyze}
            disabled={isAiLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-[#1C2029] text-amber-300 border border-amber-500/40 hover:bg-amber-500/15 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sliders className="w-3.5 h-3.5" />}
            {isAiLoading ? 'Running Multimodal Vocal Coaching...' : 'Run Deep AI Vocal & Genre Coaching'}
          </button>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-md bg-red-500/10 border border-red-500/40 px-3 py-2 text-xs text-red-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </section>

      {/* Right: Vocal Classification, Genre Fit & Auto-Plugin Recommendations */}
      <section
        aria-label="Vocal Analysis Report"
        className="lg:col-span-7 bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#222733] pb-4">
          <div>
            <div className="text-xs font-mono text-[#94A3B8]">
              {analysis.source === 'gemini-ai' ? 'Gemini Multimodal + Acoustic DSP' : 'Acoustic DSP Profile'} · Assigned Bus: {analysis.targetBus.toUpperCase()}
            </div>
            <h2 className="text-2xl font-semibold text-[#F1F5F9] mt-1 tracking-tight">
              {analysis.voiceType}{' '}
              <span className="text-base font-normal text-amber-400">— {analysis.subCategory}</span>
            </h2>
            <p className="text-sm text-[#94A3B8] mt-1.5 leading-relaxed">
              {analysis.timbreSummary}
            </p>
          </div>
        </div>

        {/* Acoustic Measurements Table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#101319] border border-[#222733] rounded-md p-3">
            <div className="text-[#64748B]">Measured Range</div>
            <div className="font-mono font-semibold text-[#F1F5F9] text-sm mt-1 tabular-nums">
              {analysis.metrics.lowestNote} – {analysis.metrics.highestNote}
            </div>
            <div className="font-mono text-[11px] text-[#64748B] tabular-nums">
              {analysis.metrics.lowestHz}–{analysis.metrics.highestHz} Hz
            </div>
          </div>

          <div className="bg-[#101319] border border-[#222733] rounded-md p-3">
            <div className="text-[#64748B]">Tessitura Sweet Spot</div>
            <div className="font-mono font-semibold text-[#F1F5F9] text-sm mt-1 tabular-nums">
              {analysis.metrics.tessituraRange}
            </div>
            <div className="font-mono text-[11px] text-[#64748B] tabular-nums">
              Median {analysis.metrics.medianHz} Hz
            </div>
          </div>

          <div className="bg-[#101319] border border-[#222733] rounded-md p-3">
            <div className="text-[#64748B]">Spectral Centroid</div>
            <div className="font-mono font-semibold text-[#F1F5F9] text-sm mt-1 tabular-nums">
              {analysis.metrics.spectralCentroidHz} Hz
            </div>
            <div className="text-[11px] text-[#94A3B8]">{analysis.metrics.timbreBrightness}</div>
          </div>

          <div className="bg-[#101319] border border-[#222733] rounded-md p-3">
            <div className="text-[#64748B]">Vibrato &amp; Dynamics</div>
            <div className="font-mono font-semibold text-[#F1F5F9] text-sm mt-1 tabular-nums">
              {analysis.metrics.estimatedVibratoHz} Hz
            </div>
            <div className="font-mono text-[11px] text-[#64748B] tabular-nums">
              {analysis.metrics.dynamicRangeDb} dB range
            </div>
          </div>
        </div>

        {/* Best-Fit Musical Genres */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F1F5F9]">Best-Fit Musical Styles</h3>
            <span className="text-xs text-[#94A3B8] font-mono">
              Ideal Keys: {analysis.idealKeys.join(' · ')}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {analysis.recommendedGenres.map((item) => (
              <div
                key={item.genre}
                className="bg-[#101319] border border-[#222733] rounded-md p-3.5 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[#F1F5F9]">{item.genre}</span>
                  <span className="text-xs font-mono tabular-nums text-amber-400">
                    {item.fitScore}% match
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#1C2029] rounded overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, item.fitScore)}%` }}
                    className="h-full bg-amber-500"
                  />
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Engineering Tips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-[#E2E8F0]">Vocal Strengths</h3>
            <ul className="space-y-1.5 text-xs text-[#94A3B8] list-disc pl-4">
              {analysis.vocalStrengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-[#E2E8F0]">Studio Mixing Advice</h3>
            <ul className="space-y-1.5 text-xs text-[#94A3B8] list-disc pl-4">
              {analysis.coachingTips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Tailored DAW Plugin Chain Application */}
        <div className="border-t border-[#222733] pt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#F1F5F9]">
                Recommended DAW Vocal Chain Presets
              </h3>
              <p className="text-xs text-[#94A3B8]">
                One-click tuning for Soloist Stem (Pro-Q 3), Soloist Bus (HG-2 &amp; EQ5M), and {analysis.voiceType} Section Bus.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onApplyVocalChain(analysis.pluginRecommendations, analysis.subCategory);
                setAppliedBanner(`Applied ${analysis.subCategory} presets to Soloist Stem, Soloist Bus, and ${analysis.voiceType} Bus.`);
              }}
              className="px-4 py-2 rounded-md text-xs font-semibold bg-amber-500 text-[#0E1014] hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Apply Recommended Vocal Chain
            </button>
          </div>

          {appliedBanner && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/40 px-3.5 py-2 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{appliedBanner}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {analysis.pluginRecommendations.map((rec, i) => (
              <div
                key={`${rec.busId}-${rec.pluginTypeId}-${i}`}
                className="bg-[#101319] border border-[#222733] rounded-md p-3"
              >
                <div className="text-xs font-semibold text-[#F1F5F9]">{rec.pluginName}</div>
                <p className="text-[11px] text-[#94A3B8] mt-1">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
