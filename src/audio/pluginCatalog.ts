import {
  BusChannel,
  BusId,
  PluginDefinition,
  PluginInstance,
  PluginTypeId,
  VoicePluginRecommendation,
} from '../types/studio';

export const PLUGIN_DEFINITIONS: Record<PluginTypeId, PluginDefinition> = {
  'fabfilter-pro-q-3': {
    typeId: 'fabfilter-pro-q-3',
    name: 'FabFilter Pro-Q 3',
    vendor: 'FabFilter',
    category: 'EQ',
    shortTag: 'Pro-Q 3',
    accentHex: '#F59E0B',
    summary: 'Surgical 24-band linear/zero-latency dynamic parametric EQ for resonance control, high-pass cleanup, and tonal balance.',
    params: [
      { key: 'hpfFreq', label: 'Low Cut (HPF)', min: 20, max: 300, step: 1, unit: 'Hz', defaultValue: 80, description: 'Steep 18 dB/oct high-pass filter removing rumble and plosives.' },
      { key: 'lowGain', label: 'Low Body (220 Hz)', min: -12, max: 12, step: 0.5, unit: 'dB', defaultValue: -1.5, description: 'Controls chest mud and proximity buildup.' },
      { key: 'midFreq', label: 'Mid Focus Freq', min: 400, max: 4500, step: 10, unit: 'Hz', defaultValue: 1800, description: 'Center frequency for presence or nasal resonance attenuation.' },
      { key: 'midGain', label: 'Mid Focus Gain', min: -12, max: 12, step: 0.5, unit: 'dB', defaultValue: 0.5, description: 'Bell cut or boost at the mid focus frequency.' },
      { key: 'highShelf', label: 'Air Shelf (10 kHz)', min: -12, max: 12, step: 0.5, unit: 'dB', defaultValue: 1.5, description: 'Smooth high-frequency sheen and vocal articulation.' },
      { key: 'outputGain', label: 'Output Trim', min: -12, max: 12, step: 0.5, unit: 'dB', defaultValue: 0, description: 'Makeup or attenuation trim to maintain gain staging.' },
    ],
  },
  'fabfilter-saturn-2': {
    typeId: 'fabfilter-saturn-2',
    name: 'FabFilter Saturn 2',
    vendor: 'FabFilter',
    category: 'Saturation',
    shortTag: 'Saturn 2',
    accentHex: '#EA580C',
    summary: 'Multiband harmonic saturation and tape/tube coloration for density, vocal glue, and upper-harmonic richness.',
    params: [
      { key: 'drive', label: 'Drive', min: 0, max: 100, step: 1, unit: '%', defaultValue: 22, description: 'Amount of harmonic saturation applied to the signal.' },
      { key: 'style', label: 'Algorithm', min: 0, max: 2, step: 1, unit: '', defaultValue: 0, options: ['Warm Tape', 'Clean Tube', 'Subtle Transformer'], description: 'Harmonic transfer curve topology.' },
      { key: 'tone', label: 'Tone Tilt', min: -10, max: 10, step: 0.5, unit: 'dB', defaultValue: 1, description: 'Post-saturation spectral tilt toward warmth or brilliance.' },
      { key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, unit: '%', defaultValue: 40, description: 'Parallel wet/dry saturation blend.' },
      { key: 'level', label: 'Output', min: -12, max: 12, step: 0.5, unit: 'dB', defaultValue: 0, description: 'Output gain compensation.' },
    ],
  },
  'rule-tec-eq1a': {
    typeId: 'rule-tec-eq1a',
    name: 'Rule Tec EQ1A',
    vendor: 'NoiseAsh',
    category: 'EQ',
    shortTag: 'EQ1A',
    accentHex: '#38BDF8',
    summary: 'Classic Pultec EQP-1A passive tube program equalizer famed for its silky high shelf and simultaneous low boost/atten trick.',
    params: [
      { key: 'lowFreq', label: 'Low Freq', min: 0, max: 3, step: 1, unit: '', defaultValue: 2, options: ['20 Hz', '30 Hz', '60 Hz', '100 Hz'], description: 'Low shelf corner frequency.' },
      { key: 'lowBoost', label: 'Low Boost', min: 0, max: 10, step: 0.2, unit: 'pt', defaultValue: 2.0, description: 'Passive low-end weight boost.' },
      { key: 'lowAtten', label: 'Low Atten', min: 0, max: 10, step: 0.2, unit: 'pt', defaultValue: 1.5, description: 'Simultaneous dip just above the boost for tight, sculpted lows.' },
      { key: 'highFreq', label: 'High Freq', min: 0, max: 4, step: 1, unit: '', defaultValue: 3, options: ['3 kHz', '5 kHz', '8 kHz', '10 kHz', '16 kHz'], description: 'Passive high-frequency bell peak.' },
      { key: 'highBoost', label: 'High Boost', min: 0, max: 10, step: 0.2, unit: 'pt', defaultValue: 3.0, description: 'Silky tube air and presence lift.' },
      { key: 'bandwidth', label: 'Bandwidth', min: 0, max: 10, step: 0.5, unit: 'Q', defaultValue: 5.5, description: 'Broad-to-narrow Q contour of the high boost.' },
      { key: 'highAtten', label: 'High Atten', min: 0, max: 10, step: 0.2, unit: 'pt', defaultValue: 0.5, description: 'Gentle top-end smoothing shelf at 10–20 kHz.' },
    ],
  },
  'rule-tec-eq5m': {
    typeId: 'rule-tec-eq5m',
    name: 'Rule Tec EQ5M',
    vendor: 'NoiseAsh',
    category: 'EQ',
    shortTag: 'EQ5M',
    accentHex: '#60A5FA',
    summary: 'Classic Pultec MEQ-5 passive midrange tube equalizer dedicated to sculpting vocal intelligibility and removing boxy mids.',
    params: [
      { key: 'lowPeakFreq', label: 'Low Peak Freq', min: 0, max: 3, step: 1, unit: '', defaultValue: 1, options: ['200 Hz', '300 Hz', '500 Hz', '700 Hz'], description: 'Lower-midrange warmth band.' },
      { key: 'lowPeakGain', label: 'Low Peak', min: 0, max: 10, step: 0.2, unit: 'pt', defaultValue: 1.5, description: 'Adds chest fullness and harmonic weight.' },
      { key: 'dipFreq', label: 'Mid Dip Freq', min: 0, max: 4, step: 1, unit: '', defaultValue: 1, options: ['300 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz'], description: 'Center frequency for midrange notch attenuation.' },
      { key: 'dipAtten', label: 'Mid Dip', min: 0, max: 10, step: 0.2, unit: 'pt', defaultValue: 2.0, description: 'Carves boxiness or honky choir resonances.' },
      { key: 'highPeakFreq', label: 'High Peak Freq', min: 0, max: 3, step: 1, unit: '', defaultValue: 2, options: ['1.5 kHz', '2 kHz', '3 kHz', '4 kHz'], description: 'Upper-midrange articulation band.' },
      { key: 'highPeakGain', label: 'High Peak', min: 0, max: 10, step: 0.2, unit: 'pt', defaultValue: 2.5, description: 'Brings vocal lyrics forward without harshness.' },
    ],
  },
  'bx-opto': {
    typeId: 'bx-opto',
    name: 'bx_opto',
    vendor: 'Brainworx',
    category: 'Dynamics',
    shortTag: 'bx_opto',
    accentHex: '#10B981',
    summary: 'Musical optical compressor combining multiple classic light-cell responses for smooth vocal leveling and choir sustain.',
    params: [
      { key: 'peakReduction', label: 'Peak Reduction', min: 0, max: 100, step: 1, unit: '%', defaultValue: 38, description: 'Optical cell compression depth (threshold + ratio curve).' },
      { key: 'speed', label: 'Speed', min: 0, max: 100, step: 1, unit: '%', defaultValue: 45, description: 'Adjusts attack/release response from slow tube opto to snappy.' },
      { key: 'scFilter', label: 'Sidechain HPF', min: 20, max: 400, step: 5, unit: 'Hz', defaultValue: 110, description: 'Keeps low fundamentals from over-triggering compression.' },
      { key: 'gain', label: 'Makeup Gain', min: -12, max: 18, step: 0.5, unit: 'dB', defaultValue: 2.5, description: 'Restores level after gain reduction.' },
      { key: 'mix', label: 'Parallel Mix', min: 0, max: 100, step: 1, unit: '%', defaultValue: 85, description: 'Blends compressed and uncompressed vocal signals.' },
    ],
  },
  'black-box-hg-2': {
    typeId: 'black-box-hg-2',
    name: 'Black Box Analog Design HG-2',
    vendor: 'Brainworx / Black Box',
    category: 'Saturation',
    shortTag: 'HG-2',
    accentHex: '#F97316',
    summary: 'Dual-stage Pentode & Triode tube saturation processor with parallel Saturation circuit and high-frequency Air lift for soloist authority.',
    params: [
      { key: 'pentode', label: 'Pentode Drive', min: 0, max: 100, step: 1, unit: '%', defaultValue: 36, description: 'Rich odd/even harmonic density and punch.' },
      { key: 'triode', label: 'Triode Drive', min: 0, max: 100, step: 1, unit: '%', defaultValue: 42, description: 'Smooth even-order warmth and low-mid body.' },
      { key: 'saturation', label: 'Saturation', min: 0, max: 100, step: 1, unit: '%', defaultValue: 30, description: 'Parallel 12AX7 tube saturation stage.' },
      { key: 'air', label: 'Air Boost', min: 0, max: 100, step: 1, unit: '%', defaultValue: 35, description: 'Sweet 10+ kHz harmonic top-end lift.' },
      { key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, unit: '%', defaultValue: 65, description: 'Wet/dry blend.' },
      { key: 'output', label: 'Output', min: -12, max: 12, step: 0.5, unit: 'dB', defaultValue: -0.5, description: 'Final stage trim.' },
    ],
  },
  'valhalla-vintage-verb': {
    typeId: 'valhalla-vintage-verb',
    name: 'ValhallaVintageVerb',
    vendor: 'Valhalla DSP',
    category: 'Reverb',
    shortTag: 'VintageVerb',
    accentHex: '#818CF8',
    summary: 'Lush algorithmic hardware-inspired reverb with 1970s/1980s/Now color modes for concert hall choir bloom and soloist dimension.',
    params: [
      { key: 'mode', label: 'Space Mode', min: 0, max: 2, step: 1, unit: '', defaultValue: 0, options: ['Concert Hall', 'Smooth Plate', 'Sanctuary'], description: 'Algorithmic reflection density and modulation character.' },
      { key: 'color', label: 'Era Color', min: 0, max: 2, step: 1, unit: '', defaultValue: 1, options: ['1970s Dark', '1980s Bright', 'Now Clean'], description: 'Bandwidth and chorus modulation character.' },
      { key: 'decay', label: 'Decay', min: 0.4, max: 6.0, step: 0.1, unit: 's', defaultValue: 2.2, description: 'Reverb tail RT60 decay duration.' },
      { key: 'predelay', label: 'PreDelay', min: 0, max: 120, step: 2, unit: 'ms', defaultValue: 28, description: 'Separates dry vocal transients from the reverb wash.' },
      { key: 'lowCut', label: 'Low Cut', min: 40, max: 600, step: 10, unit: 'Hz', defaultValue: 180, description: 'Keeps bass voices from muddying the hall.' },
      { key: 'highCut', label: 'High Cut', min: 2000, max: 16000, step: 250, unit: 'Hz', defaultValue: 7500, description: 'Tames sibilance inside the reverb tail.' },
      { key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, unit: '%', defaultValue: 22, description: 'Reverb wet/dry ratio.' },
    ],
  },
  'ssl-bus-comp-2': {
    typeId: 'ssl-bus-comp-2',
    name: 'SSL Native Bus Compressor 2',
    vendor: 'Solid State Logic',
    category: 'Dynamics',
    shortTag: 'SSL Bus 2',
    accentHex: '#94A3B8',
    summary: 'Legendary G-Series VCA bus compressor that glues choral sections and full mixes into a cohesive, punchy stereo image.',
    params: [
      { key: 'threshold', label: 'Threshold', min: -30, max: 0, step: 0.5, unit: 'dB', defaultValue: -14, description: 'Level at which VCA glue compression engages.' },
      { key: 'ratio', label: 'Ratio', min: 0, max: 2, step: 1, unit: '', defaultValue: 1, options: ['2:1', '4:1', '10:1'], description: 'Compression slope (2:1 mastering, 4:1 bus glue).' },
      { key: 'attack', label: 'Attack', min: 0, max: 4, step: 1, unit: '', defaultValue: 3, options: ['0.1 ms', '1 ms', '3 ms', '10 ms', '30 ms'], description: '10–30 ms preserves consonant transients.' },
      { key: 'release', label: 'Release', min: 0, max: 4, step: 1, unit: '', defaultValue: 4, options: ['0.1 s', '0.3 s', '0.6 s', '1.2 s', 'Auto'], description: 'Auto release adapts musically to ensemble swells.' },
      { key: 'scHpf', label: 'SC High-Pass', min: 20, max: 250, step: 5, unit: 'Hz', defaultValue: 90, description: 'Sidechain HPF prevents bass notes from pumping the choir.' },
      { key: 'makeup', label: 'Makeup', min: 0, max: 12, step: 0.5, unit: 'dB', defaultValue: 2.0, description: 'Output gain restoration.' },
      { key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, unit: '%', defaultValue: 100, description: 'Parallel New York bus compression blend.' },
    ],
  },
  'mc77': {
    typeId: 'mc77',
    name: 'MC77',
    vendor: 'Purple Audio / Plugin Alliance',
    category: 'Dynamics',
    shortTag: 'MC77',
    accentHex: '#A855F7',
    summary: 'Ultra-fast FET 1176-style vocal limiter ideal for catching soloist stem peaks before optical leveling on the Soloist Bus.',
    params: [
      { key: 'input', label: 'Input Drive', min: -12, max: 24, step: 0.5, unit: 'dB', defaultValue: 6, description: 'Drives the FET detector and input transformer.' },
      { key: 'output', label: 'Output', min: -24, max: 12, step: 0.5, unit: 'dB', defaultValue: -2, description: 'Post-FET stage level.' },
      { key: 'ratio', label: 'Ratio', min: 0, max: 3, step: 1, unit: '', defaultValue: 0, options: ['4:1', '8:1', '12:1', '20:1'], description: '4:1 for natural peak taming; 8:1+ for aggressive pop lead.' },
      { key: 'attack', label: 'Attack (1-7)', min: 1, max: 7, step: 0.5, unit: '', defaultValue: 4.5, description: 'Higher numbers are faster (microsecond FET response).' },
      { key: 'release', label: 'Release (1-7)', min: 1, max: 7, step: 0.5, unit: '', defaultValue: 5.5, description: 'Fast release (5–7) keeps lead vocals upfront and energetic.' },
      { key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, unit: '%', defaultValue: 85, description: 'Wet/dry blend.' },
    ],
  },
  'fabfilter-pro-mb': {
    typeId: 'fabfilter-pro-mb',
    name: 'FabFilter Pro-MB',
    vendor: 'FabFilter',
    category: 'Multiband',
    shortTag: 'Pro-MB',
    accentHex: '#F59E0B',
    summary: '4-band dynamic multiband compressor for mastering tonal stability across sub-bass, vocal warmth, presence, and air.',
    params: [
      { key: 'lowThresh', label: 'Low (<160 Hz)', min: -36, max: 0, step: 1, unit: 'dB', defaultValue: -18, description: 'Tightens bass choir and accompaniment fundamentals.' },
      { key: 'lowMidThresh', label: 'Low-Mid (160-800 Hz)', min: -36, max: 0, step: 1, unit: 'dB', defaultValue: -16, description: 'Controls choral buildup during fortissimo passages.' },
      { key: 'highMidThresh', label: 'High-Mid (0.8-4.5 kHz)', min: -36, max: 0, step: 1, unit: 'dB', defaultValue: -15, description: 'Tames harsh upper-mid vocal resonances dynamically.' },
      { key: 'highThresh', label: 'High (>4.5 kHz)', min: -36, max: 0, step: 1, unit: 'dB', defaultValue: -16, description: 'Smooths sibilance and bright air transients.' },
      { key: 'range', label: 'Max Range', min: -12, max: 0, step: 0.5, unit: 'dB', defaultValue: -3.5, description: 'Caps maximum gain reduction per band for transparent mastering.' },
      { key: 'output', label: 'Output', min: -6, max: 6, step: 0.5, unit: 'dB', defaultValue: 0.5, description: 'Master multiband trim.' },
    ],
  },
  'ozone-12-vintage-tape': {
    typeId: 'ozone-12-vintage-tape',
    name: 'iZotope Ozone 12 Vintage Tape',
    vendor: 'iZotope',
    category: 'Tape',
    shortTag: 'Ozone 12 Tape',
    accentHex: '#D97706',
    summary: 'Studer A810-modeled analog mastering tape emulation imparting cohesive glue, subtle head-bump weight, and silky transient rounding.',
    params: [
      { key: 'inputDrive', label: 'Input Drive', min: 0, max: 12, step: 0.2, unit: 'dB', defaultValue: 2.6, description: 'Pushes signal into analog magnetic tape saturation.' },
      { key: 'bias', label: 'Bias', min: 0, max: 10, step: 0.5, unit: '', defaultValue: 4.5, description: 'Adjusts tape hysteresis warmth and high-frequency compression.' },
      { key: 'speed', label: 'Tape Speed', min: 0, max: 1, step: 1, unit: '', defaultValue: 1, options: ['15 IPS (Warm)', '30 IPS (Open)'], description: '15 IPS adds richer low-end head bump; 30 IPS preserves crisp air.' },
      { key: 'harmonics', label: 'Harmonics', min: 0, max: 10, step: 0.5, unit: '', defaultValue: 3.5, description: 'Even/odd tape harmonic coloration.' },
      { key: 'lowEmphasis', label: 'Low Emphasis', min: -6, max: 6, step: 0.5, unit: 'dB', defaultValue: 0.8, description: 'Subtle analog head bump weight.' },
      { key: 'highEmphasis', label: 'High Emphasis', min: -6, max: 6, step: 0.5, unit: 'dB', defaultValue: 0.5, description: 'Top-end sheen compensating for tape roll-off.' },
    ],
  },
  'a1-stereo-control': {
    typeId: 'a1-stereo-control',
    name: 'A1StereoControl',
    vendor: 'Alex Hilton',
    category: 'Stereo',
    shortTag: 'A1Stereo',
    accentHex: '#06B6D4',
    summary: 'Precision Mid/Side stereo width expander featuring Safe Bass phase-coherent mono summation below a user-defined crossover.',
    params: [
      { key: 'width', label: 'Stereo Width', min: 0, max: 200, step: 1, unit: '%', defaultValue: 112, description: '100% is neutral; 108–120% widens choir halls without phase collapse.' },
      { key: 'safeBassFreq', label: 'Safe Bass Mono', min: 20, max: 400, step: 5, unit: 'Hz', defaultValue: 130, description: 'Centers all frequencies below this point strictly in mono.' },
      { key: 'pan', label: 'Balance / Pan', min: -50, max: 50, step: 1, unit: '%', defaultValue: 0, description: 'Master left/right stereo field balance.' },
      { key: 'safeBassOn', label: 'Safe Bass Active', min: 0, max: 1, step: 1, unit: '', defaultValue: 1, options: ['Off', 'On'], description: 'Engages phase-safe bass mono centering.' },
    ],
  },
  'fabfilter-pro-l-2': {
    typeId: 'fabfilter-pro-l-2',
    name: 'FabFilter Pro-L 2',
    vendor: 'FabFilter',
    category: 'Limiter',
    shortTag: 'Pro-L 2',
    accentHex: '#EF4444',
    summary: 'True-peak transparent mastering brickwall limiter with loudness metering (LUFS), lookahead transient control, and vocal-safe styles.',
    params: [
      { key: 'gain', label: 'Limiter Gain', min: 0, max: 18, step: 0.2, unit: 'dB', defaultValue: 4.0, description: 'Drives mix into final mastering ceiling for competitive loudness.' },
      { key: 'ceiling', label: 'Output Ceiling', min: -3.0, max: 0.0, step: 0.1, unit: 'dBTP', defaultValue: -1.0, description: '-1.0 dBTP prevents inter-sample clipping on streaming codecs.' },
      { key: 'style', label: 'Limiting Style', min: 0, max: 3, step: 1, unit: '', defaultValue: 0, options: ['Transparent', 'Modern', 'Dynamic', 'Allround'], description: 'Ballistics profile tailored to acoustic/choral vs pop masters.' },
      { key: 'lookahead', label: 'Lookahead', min: 0, max: 5, step: 0.1, unit: 'ms', defaultValue: 1.2, description: 'Anticipates vocal peaks to minimize audible distortion.' },
      { key: 'attack', label: 'Attack', min: 10, max: 500, step: 10, unit: 'ms', defaultValue: 200, description: 'Slow attack preserves ensemble punch.' },
      { key: 'release', label: 'Release', min: 50, max: 1000, step: 10, unit: 'ms', defaultValue: 420, description: 'Smooth recovery preventing pumping.' },
    ],
  },
};

function makePlugin(
  busId: BusId,
  slotIndex: number,
  typeId: PluginTypeId,
  overrides: Record<string, number> = {}
): PluginInstance {
  const def = PLUGIN_DEFINITIONS[typeId];
  const params: Record<string, number> = {};
  for (const p of def.params) {
    params[p.key] = overrides[p.key] !== undefined ? overrides[p.key] : p.defaultValue;
  }
  return {
    id: `${busId}-${slotIndex}-${typeId}`,
    typeId,
    name: def.name,
    bypassed: false,
    params,
  };
}

/**
 * Exact Bus & Plugin Chain Architecture requested by the user:
 * - Section buses (Soprano, Alto, Tenor, Bass): Pro-Q 3, Saturn 2, Rule Tec EQ1A, Rule Tec EQ5M, bx_opto
 * - Soloist stem inserts: Pro-Q 3, MC77
 * - Soloist bus: Black Box Analog Design HG-2, Rule Tec EQ1A, Rule Tec EQ5M, bx_opto, ValhallaVintageVerb
 * - Choir bus: Pro-Q 3, SSL Native Bus Compressor 2, Rule Tec EQ1A, ValhallaVintageVerb
 * - Master bus: Pro-Q 3, SSL Native Bus Compressor 2, Pro-MB, iZotope Ozone 12 Vintage Tape, A1StereoControl, Pro-L 2
 */
export const BUS_ORDER: BusId[] = [
  'soprano',
  'alto',
  'tenor',
  'bass',
  'choir-bus',
  'soloist-stem',
  'soloist-bus',
  'master-bus',
];

export function createDefaultBuses(): Record<BusId, BusChannel> {
  return {
    soprano: {
      id: 'soprano',
      name: 'Soprano Bus',
      shortName: 'SOP',
      group: 'section',
      routesTo: 'choir-bus',
      volumeDb: -1.5,
      pan: -0.35,
      muted: false,
      soloed: false,
      color: '#F59E0B',
      plugins: [
        makePlugin('soprano', 0, 'fabfilter-pro-q-3', { hpfFreq: 130, lowGain: -1.0, midFreq: 2800, midGain: -0.5, highShelf: 1.5 }),
        makePlugin('soprano', 1, 'fabfilter-saturn-2', { drive: 18, style: 0, tone: 0.5, mix: 32 }),
        makePlugin('soprano', 2, 'rule-tec-eq1a', { lowFreq: 3, lowBoost: 1.0, lowAtten: 0.5, highFreq: 3, highBoost: 2.8, bandwidth: 6 }),
        makePlugin('soprano', 3, 'rule-tec-eq5m', { lowPeakFreq: 2, lowPeakGain: 1.0, dipFreq: 2, dipAtten: 1.5, highPeakFreq: 2, highPeakGain: 2.0 }),
        makePlugin('soprano', 4, 'bx-opto', { peakReduction: 35, speed: 42, scFilter: 150, gain: 2.0, mix: 85 }),
      ],
    },
    alto: {
      id: 'alto',
      name: 'Alto Bus',
      shortName: 'ALT',
      group: 'section',
      routesTo: 'choir-bus',
      volumeDb: -1.0,
      pan: -0.15,
      muted: false,
      soloed: false,
      color: '#38BDF8',
      plugins: [
        makePlugin('alto', 0, 'fabfilter-pro-q-3', { hpfFreq: 105, lowGain: -1.5, midFreq: 1400, midGain: 0.5, highShelf: 1.0 }),
        makePlugin('alto', 1, 'fabfilter-saturn-2', { drive: 20, style: 1, tone: 0.5, mix: 35 }),
        makePlugin('alto', 2, 'rule-tec-eq1a', { lowFreq: 3, lowBoost: 1.6, lowAtten: 1.0, highFreq: 2, highBoost: 2.2, bandwidth: 5.5 }),
        makePlugin('alto', 3, 'rule-tec-eq5m', { lowPeakFreq: 1, lowPeakGain: 1.8, dipFreq: 1, dipAtten: 2.0, highPeakFreq: 1, highPeakGain: 2.2 }),
        makePlugin('alto', 4, 'bx-opto', { peakReduction: 38, speed: 45, scFilter: 120, gain: 2.2, mix: 85 }),
      ],
    },
    tenor: {
      id: 'tenor',
      name: 'Tenor Bus',
      shortName: 'TEN',
      group: 'section',
      routesTo: 'choir-bus',
      volumeDb: -1.5,
      pan: 0.2,
      muted: false,
      soloed: false,
      color: '#10B981',
      plugins: [
        makePlugin('tenor', 0, 'fabfilter-pro-q-3', { hpfFreq: 90, lowGain: -1.5, midFreq: 1900, midGain: 1.0, highShelf: 1.2 }),
        makePlugin('tenor', 1, 'fabfilter-saturn-2', { drive: 24, style: 0, tone: 1.0, mix: 38 }),
        makePlugin('tenor', 2, 'rule-tec-eq1a', { lowFreq: 3, lowBoost: 1.8, lowAtten: 1.2, highFreq: 2, highBoost: 2.6, bandwidth: 5.0 }),
        makePlugin('tenor', 3, 'rule-tec-eq5m', { lowPeakFreq: 1, lowPeakGain: 1.5, dipFreq: 1, dipAtten: 1.8, highPeakFreq: 2, highPeakGain: 2.6 }),
        makePlugin('tenor', 4, 'bx-opto', { peakReduction: 40, speed: 48, scFilter: 100, gain: 2.5, mix: 85 }),
      ],
    },
    bass: {
      id: 'bass',
      name: 'Bass Bus',
      shortName: 'BAS',
      group: 'section',
      routesTo: 'choir-bus',
      volumeDb: -0.5,
      pan: 0.35,
      muted: false,
      soloed: false,
      color: '#A78BFA',
      plugins: [
        makePlugin('bass', 0, 'fabfilter-pro-q-3', { hpfFreq: 55, lowGain: 1.0, midFreq: 420, midGain: -2.0, highShelf: 0.5 }),
        makePlugin('bass', 1, 'fabfilter-saturn-2', { drive: 26, style: 2, tone: -0.5, mix: 42 }),
        makePlugin('bass', 2, 'rule-tec-eq1a', { lowFreq: 2, lowBoost: 3.2, lowAtten: 2.4, highFreq: 1, highBoost: 1.8, bandwidth: 5.0 }),
        makePlugin('bass', 3, 'rule-tec-eq5m', { lowPeakFreq: 0, lowPeakGain: 2.0, dipFreq: 1, dipAtten: 2.4, highPeakFreq: 1, highPeakGain: 1.8 }),
        makePlugin('bass', 4, 'bx-opto', { peakReduction: 42, speed: 40, scFilter: 85, gain: 2.5, mix: 90 }),
      ],
    },
    'choir-bus': {
      id: 'choir-bus',
      name: 'Choir Bus',
      shortName: 'CHOIR',
      group: 'choir',
      routesTo: 'master-bus',
      volumeDb: -0.5,
      pan: 0,
      muted: false,
      soloed: false,
      color: '#2DD4BF',
      plugins: [
        makePlugin('choir-bus', 0, 'fabfilter-pro-q-3', { hpfFreq: 65, lowGain: -1.0, midFreq: 350, midGain: -1.5, highShelf: 1.5 }),
        makePlugin('choir-bus', 1, 'ssl-bus-comp-2', { threshold: -15, ratio: 1, attack: 3, release: 4, scHpf: 95, makeup: 2.0, mix: 85 }),
        makePlugin('choir-bus', 2, 'rule-tec-eq1a', { lowFreq: 2, lowBoost: 1.8, lowAtten: 1.2, highFreq: 3, highBoost: 2.5, bandwidth: 6.0 }),
        makePlugin('choir-bus', 3, 'valhalla-vintage-verb', { mode: 0, color: 1, decay: 2.6, predelay: 32, lowCut: 200, highCut: 7000, mix: 24 }),
      ],
    },
    'soloist-stem': {
      id: 'soloist-stem',
      name: 'Soloist Stem Inserts',
      shortName: 'SOL-ST',
      group: 'soloist',
      routesTo: 'soloist-bus',
      volumeDb: 0,
      pan: 0,
      muted: false,
      soloed: false,
      color: '#FB923C',
      plugins: [
        makePlugin('soloist-stem', 0, 'fabfilter-pro-q-3', { hpfFreq: 95, lowGain: -1.5, midFreq: 2600, midGain: 1.0, highShelf: 1.5 }),
        makePlugin('soloist-stem', 1, 'mc77', { input: 6.5, output: -2.0, ratio: 0, attack: 4.5, release: 5.5, mix: 85 }),
      ],
    },
    'soloist-bus': {
      id: 'soloist-bus',
      name: 'Soloist Bus',
      shortName: 'SOLO',
      group: 'soloist',
      routesTo: 'master-bus',
      volumeDb: 0.5,
      pan: 0,
      muted: false,
      soloed: false,
      color: '#F97316',
      plugins: [
        makePlugin('soloist-bus', 0, 'black-box-hg-2', { pentode: 38, triode: 44, saturation: 32, air: 38, mix: 65, output: -0.5 }),
        makePlugin('soloist-bus', 1, 'rule-tec-eq1a', { lowFreq: 3, lowBoost: 2.0, lowAtten: 1.2, highFreq: 4, highBoost: 3.4, bandwidth: 5.5 }),
        makePlugin('soloist-bus', 2, 'rule-tec-eq5m', { lowPeakFreq: 1, lowPeakGain: 1.6, dipFreq: 1, dipAtten: 2.2, highPeakFreq: 2, highPeakGain: 3.0 }),
        makePlugin('soloist-bus', 3, 'bx-opto', { peakReduction: 42, speed: 50, scFilter: 120, gain: 2.8, mix: 90 }),
        makePlugin('soloist-bus', 4, 'valhalla-vintage-verb', { mode: 1, color: 2, decay: 1.9, predelay: 42, lowCut: 240, highCut: 8500, mix: 18 }),
      ],
    },
    'master-bus': {
      id: 'master-bus',
      name: 'Master Bus',
      shortName: 'MASTER',
      group: 'master',
      routesTo: 'output',
      volumeDb: 0,
      pan: 0,
      muted: false,
      soloed: false,
      color: '#EF4444',
      plugins: [
        makePlugin('master-bus', 0, 'fabfilter-pro-q-3', { hpfFreq: 30, lowGain: 0.5, midFreq: 320, midGain: -0.5, highShelf: 1.0 }),
        makePlugin('master-bus', 1, 'ssl-bus-comp-2', { threshold: -12, ratio: 0, attack: 4, release: 4, scHpf: 80, makeup: 1.5, mix: 100 }),
        makePlugin('master-bus', 2, 'fabfilter-pro-mb', { lowThresh: -18, lowMidThresh: -16, highMidThresh: -15, highThresh: -16, range: -3.0, output: 0.5 }),
        makePlugin('master-bus', 3, 'ozone-12-vintage-tape', { inputDrive: 2.6, bias: 4.5, speed: 1, harmonics: 3.5, lowEmphasis: 0.8, highEmphasis: 0.5 }),
        makePlugin('master-bus', 4, 'a1-stereo-control', { width: 112, safeBassFreq: 130, pan: 0, safeBassOn: 1 }),
        makePlugin('master-bus', 5, 'fabfilter-pro-l-2', { gain: 3.8, ceiling: -1.0, style: 0, lookahead: 1.2, attack: 200, release: 420 }),
      ],
    },
  };
}

export function clampParam(typeId: PluginTypeId, key: string, value: number): number {
  const spec = PLUGIN_DEFINITIONS[typeId]?.params.find((p) => p.key === key);
  if (!spec) return value;
  const clamped = Math.min(spec.max, Math.max(spec.min, value));
  return Number(clamped.toFixed(2));
}

export function updatePluginInBuses(
  buses: Record<BusId, BusChannel>,
  busId: BusId,
  pluginId: string,
  patch: { bypassed?: boolean; params?: Record<string, number> }
): Record<BusId, BusChannel> {
  const bus = buses[busId];
  if (!bus) return buses;
  return {
    ...buses,
    [busId]: {
      ...bus,
      plugins: bus.plugins.map((plugin) => {
        if (plugin.id !== pluginId) return plugin;
        const nextParams = { ...plugin.params };
        if (patch.params) {
          for (const [k, v] of Object.entries(patch.params)) {
            nextParams[k] = clampParam(plugin.typeId, k, v);
          }
        }
        return {
          ...plugin,
          bypassed: patch.bypassed !== undefined ? patch.bypassed : plugin.bypassed,
          params: nextParams,
        };
      }),
    },
  };
}

export function applyVocalRecommendationsToBuses(
  buses: Record<BusId, BusChannel>,
  recommendations: VoicePluginRecommendation[]
): Record<BusId, BusChannel> {
  let next = buses;
  for (const rec of recommendations) {
    const bus = next[rec.busId];
    if (!bus) continue;
    const targetPlugin = bus.plugins.find((p) => p.typeId === rec.pluginTypeId);
    if (!targetPlugin) continue;
    next = updatePluginInBuses(next, rec.busId, targetPlugin.id, {
      bypassed: false,
      params: rec.suggestedParams,
    });
  }
  return next;
}

export function formatParamValue(spec: PluginDefinition['params'][number], value: number): string {
  if (spec.options && spec.options.length > 0) {
    const idx = Math.round(value);
    return spec.options[Math.min(spec.options.length - 1, Math.max(0, idx))] ?? String(value);
  }
  const formatted = Number.isInteger(spec.step) ? Math.round(value).toString() : value.toFixed(1);
  return spec.unit ? `${formatted} ${spec.unit}` : formatted;
}
