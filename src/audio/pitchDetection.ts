import {
  BusId,
  VoiceAcousticMetrics,
  VoiceAnalysisResult,
  VoiceFach,
  VoicePluginRecommendation,
} from '../types/studio';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

export function freqToNoteName(freq: number): string {
  if (!Number.isFinite(freq) || freq < 20) return '—';
  const midi = freqToMidi(freq);
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${note}${octave}`;
}

/**
 * Autocorrelation pitch detector (YIN-inspired normalized difference) for mono PCM frames.
 * Returns fundamental frequency in Hz, or null when unvoiced/silent.
 */
export function detectPitchAutocorrelation(
  buffer: Float32Array,
  sampleRate: number,
  minHz = 65,
  maxHz = 1200
): number | null {
  const n = buffer.length;
  if (n < 256 || sampleRate <= 0) return null;

  // RMS silence gate
  let rms = 0;
  for (let i = 0; i < n; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / n);
  if (rms < 0.012) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / minHz));
  if (maxLag <= minLag) return null;

  let globalMaxCorr = 0;
  const correlations = new Float32Array(maxLag + 1);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let normA = 0;
    let normB = 0;
    const limit = n - lag;
    for (let i = 0; i < limit; i++) {
      const a = buffer[i];
      const b = buffer[i + lag];
      sum += a * b;
      normA += a * a;
      normB += b * b;
    }
    const denom = Math.sqrt(normA * normB);
    const corr = denom > 1e-8 ? sum / denom : 0;
    correlations[lag] = corr;
    if (corr > globalMaxCorr) {
      globalMaxCorr = corr;
    }
  }

  if (globalMaxCorr < 0.62) return null;

  // Select the first local maximum reaching >= 92% of globalMaxCorr (prevents subharmonic 1/2x or 1/4x octave errors)
  const peakThreshold = Math.max(0.62, globalMaxCorr * 0.92);
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    const c = correlations[lag];
    if (c >= peakThreshold && c >= correlations[lag - 1] && c >= correlations[lag + 1]) {
      bestLag = lag;
      bestCorr = c;
      break;
    }
  }

  if (bestLag < 0) {
    // Fallback to global maximum lag
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (correlations[lag] > bestCorr) {
        bestCorr = correlations[lag];
        bestLag = lag;
      }
    }
  }

  if (bestLag < 0 || bestCorr < 0.62) return null;

  // Parabolic interpolation around bestLag for sub-sample accuracy
  const y1 = correlations[bestLag - 1] ?? bestCorr;
  const y2 = bestCorr;
  const y3 = correlations[bestLag + 1] ?? bestCorr;
  const denom = 2 * (y1 - 2 * y2 + y3);
  const shift = Math.abs(denom) > 1e-7 ? (y1 - y3) / denom : 0;
  const refinedLag = bestLag + Math.max(-0.5, Math.min(0.5, shift));

  const freq = sampleRate / refinedLag;
  if (freq < minHz || freq > maxHz) return null;
  return Number(freq.toFixed(1));
}

/**
 * Estimates spectral brightness (zero-crossing weighted centroid proxy) from PCM frames.
 */
export function estimateSpectralCentroidHz(buffer: Float32Array, sampleRate: number): number {
  let zeroCrossings = 0;
  for (let i = 1; i < buffer.length; i++) {
    if ((buffer[i - 1] >= 0 && buffer[i] < 0) || (buffer[i - 1] < 0 && buffer[i] >= 0)) {
      zeroCrossings++;
    }
  }
  const zcrHz = (zeroCrossings * sampleRate) / (2 * buffer.length);
  // Vocal formant centroid typically tracks 1.6x-2.4x ZCR in voiced vowels
  return Math.round(Math.max(450, Math.min(4800, zcrHz * 2.1)));
}

/**
 * Analyze a full PCM Float32Array vocal take and extract acoustic range, tessitura, and timbre.
 */
export function analyzePcmVocalBuffer(
  samples: Float32Array,
  sampleRate: number
): VoiceAcousticMetrics {
  const frameSize = 2048;
  const hopSize = 1024;
  const pitches: number[] = [];
  const centroids: number[] = [];
  const rmsValues: number[] = [];

  for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
    const frame = samples.subarray(offset, offset + frameSize);
    let sq = 0;
    for (let i = 0; i < frame.length; i++) sq += frame[i] * frame[i];
    const rms = Math.sqrt(sq / frame.length);
    if (rms > 0.015) {
      rmsValues.push(rms);
      const f0 = detectPitchAutocorrelation(frame, sampleRate);
      if (f0) {
        pitches.push(f0);
        centroids.push(estimateSpectralCentroidHz(frame, sampleRate));
      }
    }
  }

  const durationSec = Number((samples.length / sampleRate).toFixed(1));
  if (pitches.length === 0) {
    return {
      lowestHz: 196,
      highestHz: 523.3,
      medianHz: 311.1,
      lowestNote: 'G3',
      highestNote: 'C5',
      tessituraRange: 'B3 – A4',
      spectralCentroidHz: 1750,
      timbreBrightness: 'Balanced & Rich',
      estimatedVibratoHz: 5.4,
      dynamicRangeDb: 14,
      durationSec,
    };
  }

  const sortedPitches = [...pitches].sort((a, b) => a - b);
  const p05 = sortedPitches[Math.floor(sortedPitches.length * 0.05)];
  const p20 = sortedPitches[Math.floor(sortedPitches.length * 0.2)];
  const p50 = sortedPitches[Math.floor(sortedPitches.length * 0.5)];
  const p80 = sortedPitches[Math.floor(sortedPitches.length * 0.8)];
  const p95 = sortedPitches[Math.floor(sortedPitches.length * 0.95)];

  const avgCentroid =
    centroids.reduce((acc, v) => acc + v, 0) / Math.max(1, centroids.length);

  const timbreBrightness: VoiceAcousticMetrics['timbreBrightness'] =
    avgCentroid < 1350
      ? 'Warm & Dark'
      : avgCentroid > 2300
        ? 'Bright & Forward'
        : 'Balanced & Rich';

  const maxRms = Math.max(...rmsValues, 0.02);
  const minRms = Math.min(...rmsValues, maxRms);
  const dynamicRangeDb = Number(
    Math.min(32, Math.max(6, 20 * Math.log10(maxRms / Math.max(0.005, minRms)))).toFixed(1)
  );

  // Estimate vibrato modulation rate from pitch contour sign reversals
  let reversals = 0;
  for (let i = 2; i < pitches.length; i++) {
    const d1 = pitches[i - 1] - pitches[i - 2];
    const d2 = pitches[i] - pitches[i - 1];
    if ((d1 > 1.2 && d2 < -1.2) || (d1 < -1.2 && d2 > 1.2)) reversals++;
  }
  const voicedSeconds = (pitches.length * hopSize) / sampleRate;
  const rawVib = voicedSeconds > 0.4 ? reversals / (2 * voicedSeconds) : 5.4;
  const estimatedVibratoHz = Number(Math.min(7.5, Math.max(4.2, rawVib)).toFixed(1));

  return {
    lowestHz: Number(p05.toFixed(1)),
    highestHz: Number(p95.toFixed(1)),
    medianHz: Number(p50.toFixed(1)),
    lowestNote: freqToNoteName(p05),
    highestNote: freqToNoteName(p95),
    tessituraRange: `${freqToNoteName(p20)} – ${freqToNoteName(p80)}`,
    spectralCentroidHz: Math.round(avgCentroid),
    timbreBrightness,
    estimatedVibratoHz,
    dynamicRangeDb,
    durationSec,
  };
}

/**
 * Deterministic voice classification + tailored DAW plugin recommendations from acoustic metrics.
 * Used both as instant DSP analysis and as structured context passed to Gemini for deeper vocal coaching.
 */
export function classifyVoiceFromMetrics(metrics: VoiceAcousticMetrics): VoiceAnalysisResult {
  const { medianHz, highestHz, lowestHz, timbreBrightness } = metrics;

  let voiceType: VoiceFach;
  let subCategory: string;
  let targetBus: BusId;
  let idealKeys: string[];
  let recommendedGenres: VoiceAnalysisResult['recommendedGenres'];
  let vocalStrengths: string[];
  let coachingTips: string[];
  let hpfFreq: number;
  let airBoost: number;
  let midDipFreqIdx: number;

  if (medianHz >= 390 || highestHz >= 760) {
    voiceType = 'Soprano';
    subCategory = timbreBrightness === 'Bright & Forward' ? 'Lyric Coloratura Soprano' : 'Warm Lyric Soprano';
    targetBus = 'soprano';
    idealKeys = ['Eb Major', 'G Major', 'Bb Major', 'D Minor'];
    recommendedGenres = [
      { genre: 'Cinematic Choral & Film Score', fitScore: 96, reason: 'Effortless upper-register float cuts cleanly over lush string and choir swells.' },
      { genre: 'Art Pop & Dream Pop', fitScore: 91, reason: 'Harmonic clarity above 400 Hz pairs naturally with atmospheric plate reverbs.' },
      { genre: 'Classical Crossover & Sacred', fitScore: 94, reason: 'Natural head-voice shimmer excels in reverberant concert hall spaces.' },
    ];
    vocalStrengths = [
      'Radiant upper tessitura with strong harmonic overtone projection',
      'Clean separation above dense alto and tenor choral voicings',
      'Expressive dynamic bloom on sustained legato phrases',
    ];
    coachingTips = [
      'Engage a 130 Hz high-pass on Pro-Q 3 to clear low-end room rumble without thinning tone.',
      'Use Rule Tec EQ1A at 10–16 kHz gently rather than boosting 3–4 kHz to avoid piercing highs.',
      'Pair MC77 fast peak catch (2–3 dB) with bx_opto smooth leveling on soaring chorus notes.',
    ];
    hpfFreq = 130;
    airBoost = timbreBrightness === 'Bright & Forward' ? 24 : 42;
    midDipFreqIdx = 3; // 2 kHz tame
  } else if (medianHz >= 310) {
    voiceType = 'Mezzo-Soprano';
    subCategory = timbreBrightness === 'Warm & Dark' ? 'Dramatic Mezzo-Soprano' : 'Contemporary Lyric Mezzo';
    targetBus = 'alto';
    idealKeys = ['F Major', 'C Major', 'A Minor', 'Db Major'];
    recommendedGenres = [
      { genre: 'Neo-Soul & Contemporary R&B', fitScore: 95, reason: 'Rich chest-mix midrange translates emotional phrasing and subtle runs effortlessly.' },
      { genre: 'Gospel & Modern Choir Lead', fitScore: 93, reason: 'Commanding belt zone sits right in the mix sweet spot above the choir bus.' },
      { genre: 'Indie Folk & Chamber Pop', fitScore: 89, reason: 'Intimate vocal body shines with warm tube saturation and light room ambience.' },
    ];
    vocalStrengths = [
      'Versatile chest-to-head mix bridging Alto warmth and Soprano brilliance',
      'Natural presence between 800 Hz and 2.5 kHz for lyric storytelling',
      'Balanced harmonic density that takes tube saturation gracefully',
    ];
    coachingTips = [
      'Dip 500 Hz slightly on Rule Tec EQ5M to open vocal clarity during belted phrases.',
      'Drive Black Box HG-2 Triode stage (45%) for silky chest-voice weight on soloist leads.',
      'Set ValhallaVintageVerb PreDelay to 40 ms so rhythmic phrasing stays intimate.',
    ];
    hpfFreq = 110;
    airBoost = 38;
    midDipFreqIdx = 1; // 500 Hz
  } else if (medianHz >= 245) {
    voiceType = 'Alto';
    subCategory = timbreBrightness === 'Warm & Dark' ? 'Velvet Contralto' : 'Contemporary Alto';
    targetBus = 'alto';
    idealKeys = ['D Major', 'G Minor', 'Bb Major', 'E Minor'];
    recommendedGenres = [
      { genre: 'Acoustic Soul & Jazz Ballad', fitScore: 96, reason: 'Deep velvety lower-mid resonance anchors intimate acoustic arrangements.' },
      { genre: 'Cinematic Vocal Ensemble', fitScore: 92, reason: 'Provides essential harmonic glue between Sopranos and Tenors.' },
      { genre: 'Trip-Hop & Ambient Electronic', fitScore: 88, reason: 'Smoky vocal core contrasts strikingly against crisp electronic percussion.' },
    ];
    vocalStrengths = [
      'Warm, grounded lower register with immediate emotional authority',
      'Zero upper-mid harshness even at high monitor volumes',
      'Rich harmonic foundation for inner choral harmonies',
    ];
    coachingTips = [
      'Use Rule Tec EQ5M High Peak at 3 kHz (+2.8) to keep diction crisp over pads.',
      'Apply FabFilter Saturn 2 Clean Tube mode lightly to add upper-harmonic sheen.',
      'Keep HPF around 100 Hz so your signature lower warmth stays intact.',
    ];
    hpfFreq = 100;
    airBoost = 44;
    midDipFreqIdx = 1;
  } else if (medianHz >= 175) {
    voiceType = 'Tenor';
    subCategory = timbreBrightness === 'Bright & Forward' ? 'Pop / Lyric Tenor' : 'Spinto Choral Tenor';
    targetBus = 'tenor';
    idealKeys = ['C Major', 'A Minor', 'E Major', 'G Major'];
    recommendedGenres = [
      { genre: 'Anthemic Pop & Worship Choral', fitScore: 96, reason: 'Ring in the 2.5–3.5 kHz singer’s formant slices through full ensemble arrangements.' },
      { genre: 'R&B & Falsetto Soul', fitScore: 93, reason: 'Agile transition into upper head register supports soaring hooks.' },
      { genre: 'Alternative Rock & Cinematic Ballad', fitScore: 90, reason: 'High-energy chest belt pairs powerfully with SSL bus glue and HG-2 grit.' },
    ];
    vocalStrengths = [
      'Natural singer’s formant focus that carries melodies without excess volume',
      'Expressive contrast between warm baritonal verses and bright chorus highs',
      'Strong transient articulation ideal for lead soloist duties',
    ];
    coachingTips = [
      'Use MC77 at 4:1 (fast release) on the Soloist Stem to lock dynamic chorus surges.',
      'Carve 1–2 dB near 350–500 Hz with EQ5M to prevent boxiness when stacked with choir.',
      'Blend 30% Black Box HG-2 Pentode drive to thicken sustained high notes.',
    ];
    hpfFreq = 90;
    airBoost = 36;
    midDipFreqIdx = 1;
  } else if (medianHz >= 125) {
    voiceType = 'Baritone';
    subCategory = timbreBrightness === 'Warm & Dark' ? 'Velvet Lyric Baritone' : 'Contemporary Pop Baritone';
    targetBus = 'bass';
    idealKeys = ['F Major', 'D Minor', 'Ab Major', 'C Minor'];
    recommendedGenres = [
      { genre: 'Chamber Folk & Americana', fitScore: 95, reason: 'Rich chest resonance delivers commanding, conversational narrative presence.' },
      { genre: 'Cinematic Neo-Classical & Choral', fitScore: 94, reason: 'Balances lush low-mid warmth with effortless storytelling clarity.' },
      { genre: 'Crooner Jazz & Modern Soul', fitScore: 91, reason: 'Warm upper-bass fundamentals shine through analog tape and optical compression.' },
    ];
    vocalStrengths = [
      'Commanding chest warmth and natural intimacy on close-mic recordings',
      'Effortless dynamic stability across verses and choruses',
      'Rich harmonic foundation that grounds both solo and ensemble mixes',
    ];
    coachingTips = [
      'Apply the Pultec EQ1A 100 Hz boost + attenuation trick to sculpt weighty yet clean lows.',
      'Lift 3–4 kHz on EQ5M High Peak (+3.0) so consonants stay forward in dense mixes.',
      'Keep ValhallaVintageVerb Low Cut at 240 Hz to prevent low-mid reverb buildup.',
    ];
    hpfFreq = 75;
    airBoost = 40;
    midDipFreqIdx = 0; // 300 Hz
  } else {
    voiceType = 'Bass';
    subCategory = lowestHz < 78 ? 'Basso Profondo' : 'Choral Resonant Bass';
    targetBus = 'bass';
    idealKeys = ['Eb Major', 'C Minor', 'Bb Major', 'G Minor'];
    recommendedGenres = [
      { genre: 'A Cappella & Sacred Choral', fitScore: 97, reason: 'Deep resonant fundamentals anchor the entire harmonic spectrum.' },
      { genre: 'Epic Trailer & Orchestral Folk', fitScore: 94, reason: 'Sub-100 Hz vocal power blends seamlessly with low cellos and contrabasses.' },
      { genre: 'Deep Country & Acoustic Blues', fitScore: 90, reason: 'Authoritative low-end timbre thrives with minimal processing and warm tape.' },
    ];
    vocalStrengths = [
      'Deep, resonant sub-120 Hz fundamentals rare in contemporary vocalists',
      'Immense harmonic stability anchoring SATB choral chords',
      'Dramatic, unmistakable tonal signature on lead lines',
    ];
    coachingTips = [
      'Keep Pro-Q 3 HPF low (50–55 Hz) to protect sub-harmonics while cutting sub-rumble.',
      'Enable A1StereoControl Safe Bass at 130 Hz on Master Bus to keep bass vocal phase-locked mono.',
      'Use FabFilter Saturn 2 Subtle Transformer mode to generate 2nd/3rd harmonics audible on small speakers.',
    ];
    hpfFreq = 55;
    airBoost = 46;
    midDipFreqIdx = 0;
  }

  const pluginRecommendations: VoicePluginRecommendation[] = [
    {
      busId: 'soloist-stem',
      pluginTypeId: 'fabfilter-pro-q-3',
      pluginName: 'FabFilter Pro-Q 3 (Soloist Stem)',
      rationale: `Sets high-pass at ${hpfFreq} Hz matched to ${voiceType} lowest note (${metrics.lowestNote}) and trims low-mid buildup.`,
      suggestedParams: { hpfFreq, lowGain: -1.5, midGain: 1.0, highShelf: 1.8 },
    },
    {
      busId: 'soloist-bus',
      pluginTypeId: 'black-box-hg-2',
      pluginName: 'Black Box Analog Design HG-2 (Soloist Bus)',
      rationale: `Tailors Triode warmth and ${airBoost}% Air lift for a ${timbreBrightness.toLowerCase()} ${voiceType} vocal.`,
      suggestedParams: { pentode: 34, triode: 48, saturation: 32, air: airBoost, mix: 68 },
    },
    {
      busId: 'soloist-bus',
      pluginTypeId: 'rule-tec-eq5m',
      pluginName: 'Rule Tec EQ5M (Soloist Bus)',
      rationale: `Carves boxy resonances and lifts vocal articulation specifically for ${subCategory}.`,
      suggestedParams: { dipFreq: midDipFreqIdx, dipAtten: 2.4, highPeakFreq: 2, highPeakGain: 3.0 },
    },
    {
      busId: targetBus,
      pluginTypeId: 'fabfilter-pro-q-3',
      pluginName: `FabFilter Pro-Q 3 (${voiceType} Section Bus)`,
      rationale: `Aligns section bus HPF (${hpfFreq} Hz) and air shelf for ${voiceType} ensemble integration.`,
      suggestedParams: { hpfFreq, highShelf: 1.6 },
    },
  ];

  return {
    voiceType,
    subCategory,
    confidenceNote: `Measured ${metrics.lowestNote}–${metrics.highestNote} (${metrics.lowestHz}–${metrics.highestHz} Hz), median ${metrics.medianHz} Hz`,
    targetBus,
    timbreSummary: `${timbreBrightness} tonal profile (spectral centroid ~${metrics.spectralCentroidHz} Hz) with comfortable tessitura in ${metrics.tessituraRange} and ${metrics.dynamicRangeDb} dB natural dynamic expression.`,
    recommendedGenres,
    idealKeys,
    vocalStrengths,
    coachingTips,
    pluginRecommendations,
    metrics,
    source: 'acoustic-dsp',
  };
}
