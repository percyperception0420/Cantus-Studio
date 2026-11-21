export interface DocSection {
  id: string;
  category: 'Architecture' | 'Bus Chains' | 'Plugin Manuals' | 'AI Composer' | 'Voice Analyzer' | 'Collaboration & API';
  title: string;
  subtitle: string;
  body: string;
  codeBlock?: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export const DOCUMENTATION_SECTIONS: DocSection[] = [
  {
    id: 'arch-signal-flow',
    category: 'Architecture',
    title: '01. Signal Routing & Bus Topology',
    subtitle: 'Complete multi-bus choral, soloist, and mastering architecture',
    body: 'Cantus Studio routes individual vocal stems through dedicated section buses before summing into ensemble and mastering stages. Every stage processes real-time Web Audio DSP nodes so changes to EQ, saturation, compression, stereo imaging, and brickwall limiting are immediately audible and synchronized across all collaborators in the session.',
    codeBlock: `[Soprano Track] ──▶ [Soprano Section Bus] ──┐
                     • FabFilter Pro-Q 3    │
                     • FabFilter Saturn 2   │
                     • Rule Tec EQ1A        │
                     • Rule Tec EQ5M        │
                     • bx_opto              │
                                            │
[Alto Track]    ──▶ [Alto Section Bus]    ──┼──▶ [Choir Bus] ──────────────────────┐
                     (5-plugin chain)       │     • FabFilter Pro-Q 3              │
                                            │     • SSL Native Bus Compressor 2    │
[Tenor Track]   ──▶ [Tenor Section Bus]   ──┤     • Rule Tec EQ1A                  │
                     (5-plugin chain)       │     • ValhallaVintageVerb            │
                                            │                                      ├──▶ [Master Bus] ──▶ Output / WAV
[Bass Track]    ──▶ [Bass Section Bus]    ──┘                                      │     • FabFilter Pro-Q 3
                     (5-plugin chain)                                              │     • SSL Native Bus Compressor 2
                                                                                   │     • FabFilter Pro-MB
[Soloist Track] ──▶ [Soloist Stem Inserts] ──▶ [Soloist Bus] ──────────────────────┤     • iZotope Ozone 12 Vintage Tape
                     • FabFilter Pro-Q 3        • Black Box Analog Design HG-2     │     • A1StereoControl
                     • MC77                     • Rule Tec EQ1A                    │     • FabFilter Pro-L 2
                                                • Rule Tec EQ5M                    │
                                                • bx_opto                          │
                                                • ValhallaVintageVerb              │
                                                                                   │
[Accompaniment] ───────────────────────────────────────────────────────────────────┘`,
  },
  {
    id: 'arch-gain-staging',
    category: 'Architecture',
    title: '02. Gain Staging & Headroom Standards',
    subtitle: 'Nominal operating levels across section, ensemble, and mastering buses',
    body: 'Proper gain staging ensures analog-modeled saturators (FabFilter Saturn 2, Black Box HG-2, iZotope Ozone 12 Vintage Tape) and bus compressors (SSL Native Bus Compressor 2, bx_opto) operate in their harmonic sweet spot without digital clipping.',
    table: {
      headers: ['Bus Stage', 'Target RMS', 'Peak Ceiling', 'Primary Engineering Goal'],
      rows: [
        ['Section Buses (S/A/T/B)', '-18 to -14 dBFS', '-6 dBFS', 'Surgical cleanup, harmonic density, smooth optical leveling'],
        ['Soloist Stem Inserts', '-16 to -12 dBFS', '-4 dBFS', 'Fast FET transient catch (MC77) and proximity cleanup'],
        ['Soloist Bus', '-14 to -10 dBFS', '-3 dBFS', 'Tube authority (HG-2), passive sheen, lyrical presence & plate depth'],
        ['Choir Bus', '-14 to -10 dBFS', '-3 dBFS', 'Unified VCA glue (2–3 dB GR) and shared concert hall space'],
        ['Master Bus', '-14 LUFS (Streaming)', '-1.0 dBTP', 'Tonal glue, multiband control, tape polish, Safe Bass, true-peak limit'],
      ],
    },
  },
  {
    id: 'bus-section-satb',
    category: 'Bus Chains',
    title: '03. Section Buses (Soprano, Alto, Tenor, Bass)',
    subtitle: 'Identical 5-plugin serial chain tailored per voice register',
    body: 'Each SATB choral section receives its own independent 5-slot insert rack. Order of processing follows classic vocal engineering discipline: corrective digital EQ first, harmonic enrichment second, musical passive tube tone-shaping third and fourth, and gentle optical leveling last to smooth dynamic swells before entering the Choir Bus.',
    table: {
      headers: ['Slot', 'Plugin', 'Role on Section Bus', 'Register Starting Points'],
      rows: [
        ['1', 'FabFilter Pro-Q 3', 'High-pass rumble & muddy chest trim', 'HPF: Sop 130 Hz · Alto 105 Hz · Tenor 90 Hz · Bass 55 Hz'],
        ['2', 'FabFilter Saturn 2', 'Harmonic glue & subtle saturation', 'Drive 18–26%, Mix 32–42%; Tape for Sop/Ten, Tube for Alto, Transformer for Bass'],
        ['3', 'Rule Tec EQ1A', 'Pultec passive low sculpture & top air', 'Bass: 60 Hz Boost 3.2 + Atten 2.4; Sop: 10 kHz Boost 2.8'],
        ['4', 'Rule Tec EQ5M', 'Midrange boxiness dip & diction peak', 'Dip 500 Hz (1.5–2.4 pt), lift High Peak 2–3 kHz for vowel clarity'],
        ['5', 'bx_opto', 'Musical optical leveling', 'Peak Reduction 35–42%, Sidechain HPF matched to register, Mix 85–90%'],
      ],
    },
  },
  {
    id: 'bus-soloist-stem',
    category: 'Bus Chains',
    title: '04. Soloist Stem Inserts',
    subtitle: 'Pre-bus corrective EQ and fast FET transient peak control',
    body: 'Before the lead vocal enters the Soloist Bus, stem inserts catch sudden consonant and belted peaks cleanly. Placing FabFilter Pro-Q 3 before MC77 ensures plosives and sub-90 Hz rumble never false-trigger the ultra-fast FET detector.',
    table: {
      headers: ['Slot', 'Plugin', 'Role on Soloist Stem', 'Recommended Settings'],
      rows: [
        ['1', 'FabFilter Pro-Q 3', 'Vocal foundation cleanup & presence prep', 'HPF 95 Hz (auto-adjusted by Voice Analyzer), -1.5 dB at 220 Hz, +1.5 dB Air Shelf'],
        ['2', 'MC77', '1176-style FET transient peak limiter', 'Ratio 4:1, Attack 4.5, Release 5.5, 2–4 dB GR on loudest syllables, Mix 85%'],
      ],
    },
  },
  {
    id: 'bus-soloist',
    category: 'Bus Chains',
    title: '05. Soloist Bus',
    subtitle: '5-plugin lead vocal authority, passive tube contour, and dimension chain',
    body: 'The Soloist Bus transforms a controlled lead stem into a record-ready vocal centerpiece that floats effortlessly above a full choir. Black Box Analog Design HG-2 injects Pentode punch and Triode warmth; Rule Tec EQ1A and EQ5M sculpt velvet lows and forward intelligibility; bx_opto glues phrase-to-phrase dynamics; and ValhallaVintageVerb places the soloist in a tailored plate space with generous predelay.',
    table: {
      headers: ['Slot', 'Plugin', 'Role on Soloist Bus', 'Recommended Settings'],
      rows: [
        ['1', 'Black Box Analog Design HG-2', 'Dual-stage Pentode + Triode tube richness & Air', 'Pentode 38%, Triode 44%, Saturation 32%, Air 38%, Mix 65%'],
        ['2', 'Rule Tec EQ1A', 'Silky 16 kHz tube air & grounded 100 Hz weight', 'Low 100 Hz Boost 2.0 / Atten 1.2; High 16 kHz Boost 3.4'],
        ['3', 'Rule Tec EQ5M', 'Vocal midrange polish', 'Dip 500 Hz 2.2 pt to remove mud; High Peak 3 kHz +3.0 pt for presence'],
        ['4', 'bx_opto', 'Smooth secondary optical sustain', 'Peak Reduction 42%, Speed 50%, SC HPF 120 Hz, Mix 90%'],
        ['5', 'ValhallaVintageVerb', 'Lead vocal depth without washing out lyrics', 'Smooth Plate / Now color, Decay 1.9 s, PreDelay 42 ms, Mix 18%'],
      ],
    },
  },
  {
    id: 'bus-choir',
    category: 'Bus Chains',
    title: '06. Choir Bus',
    subtitle: 'Ensemble cohesion, VCA bus glue, and shared concert hall space',
    body: 'All four section buses (Soprano, Alto, Tenor, Bass) sum into the Choir Bus. Here, FabFilter Pro-Q 3 carves space around 350 Hz so the Soloist can sit effortlessly in front; SSL Native Bus Compressor 2 fuses all four voice parts into a unified ensemble; Rule Tec EQ1A restores collective shimmer; and ValhallaVintageVerb places the entire choir inside a lush Concert Hall.',
    table: {
      headers: ['Slot', 'Plugin', 'Role on Choir Bus', 'Recommended Settings'],
      rows: [
        ['1', 'FabFilter Pro-Q 3', 'Ensemble pocket carving & sub cleanup', 'HPF 65 Hz, -1.5 dB broad dip at 350 Hz to clear space for Soloist'],
        ['2', 'SSL Native Bus Compressor 2', 'Classic VCA choral glue', '4:1 Ratio, 10 ms Attack, Auto Release, SC HPF 95 Hz, 2–3 dB GR'],
        ['3', 'Rule Tec EQ1A', 'Broad choral air & warm low foundation', '60 Hz Boost 1.8 / Atten 1.2; 10 kHz Boost 2.5 (broad bandwidth 6.0)'],
        ['4', 'ValhallaVintageVerb', 'Shared acoustic hall bloom', 'Concert Hall / 1980s color, Decay 2.6 s, PreDelay 32 ms, Low Cut 200 Hz, Mix 24%'],
      ],
    },
  },
  {
    id: 'bus-master',
    category: 'Bus Chains',
    title: '07. Master Bus',
    subtitle: '6-plugin commercial mastering chain from tonal balance to true-peak limiting',
    body: 'The Master Bus combines the Choir Bus, Soloist Bus, and Accompaniment into a commercial-grade stereo master. Every insert serves a distinct mastering stage: subtle macro EQ, gentle 2:1 VCA glue, 4-band dynamic spectral balancing, analog Studer-style tape cohesion, phase-safe stereo widening with mono bass anchoring, and transparent true-peak brickwall limiting.',
    table: {
      headers: ['Slot', 'Plugin', 'Role on Master Bus', 'Recommended Settings'],
      rows: [
        ['1', 'FabFilter Pro-Q 3', 'Sub-30 Hz cleanup & macro tonal balance', 'HPF 30 Hz, -0.5 dB at 320 Hz, +1.0 dB at 10 kHz'],
        ['2', 'SSL Native Bus Compressor 2', 'Mastering bus cohesion', '2:1 Ratio, 30 ms Attack, Auto Release, SC HPF 80 Hz, 1–2 dB GR'],
        ['3', 'FabFilter Pro-MB', '4-band dynamic spectral control', 'Max Range -3.0 dB across <160 Hz, 160–800 Hz, 0.8–4.5 kHz, >4.5 kHz'],
        ['4', 'iZotope Ozone 12 Vintage Tape', 'Analog tape glue & transient rounding', '30 IPS, Input Drive 2.6 dB, Bias 4.5, Harmonics 3.5, Low Emphasis +0.8 dB'],
        ['5', 'A1StereoControl', 'Safe stereo width & mono bass anchor', 'Width 112%, Safe Bass Active at 130 Hz, Balance 0%'],
        ['6', 'FabFilter Pro-L 2', 'True-peak brickwall limiting', 'Ceiling -1.0 dBTP, Transparent style, Lookahead 1.2 ms, Gain +3.8 dB'],
      ],
    },
  },
  {
    id: 'plugin-manual-eq',
    category: 'Plugin Manuals',
    title: '08. Equalizers: Pro-Q 3, Rule Tec EQ1A & EQ5M',
    subtitle: 'Digital surgical precision paired with passive Pultec tube curves',
    body: 'Use FabFilter Pro-Q 3 for subtractive hygiene (high-pass filtering and resonant dips) and Rule Tec EQ1A / EQ5M for additive musical weight and shimmer. On EQ1A, boosting and attenuating the same low frequency (60 Hz or 100 Hz) creates the classic Pultec curve: deep fundamental weight with a clean dip just above it that prevents vocal muddiness. On EQ5M, pair a gentle 500 Hz Dip with a 2–3 kHz High Peak to bring choral lyrics into crystalline focus.',
  },
  {
    id: 'plugin-manual-sat',
    category: 'Plugin Manuals',
    title: '09. Saturation & Tape: Saturn 2, Black Box HG-2 & Ozone 12 Vintage Tape',
    subtitle: 'Harmonic density across section, soloist, and master stages',
    body: 'FabFilter Saturn 2 adds controlled harmonic overtones per vocal section (Warm Tape for Sopranos/Tenors, Clean Tube for Altos, Subtle Transformer for Basses so low notes translate on small speakers). Black Box Analog Design HG-2 sits exclusively at the top of the Soloist Bus—balance Triode (even-order warmth) and Pentode (odd/even punch) with its high-frequency Air circuit to give lead vocals flagship analog depth. iZotope Ozone 12 Vintage Tape rounds digital micro-transients across the full Master Bus at 15 IPS (warmer head-bump) or 30 IPS (wider airy top-end).',
  },
  {
    id: 'plugin-manual-dyn',
    category: 'Plugin Manuals',
    title: '10. Dynamics & Limiting: MC77, bx_opto, SSL Bus Comp 2, Pro-MB & Pro-L 2',
    subtitle: 'Serial compression, VCA glue, multiband control, and true-peak mastering',
    body: 'Serial vocal compression combines MC77 (fast FET peak catcher on the Soloist Stem) with bx_opto (slow, velvety optical leveler on Section and Soloist buses) so neither compressor works hard enough to sound audible. SSL Native Bus Compressor 2 uses a sidechain high-pass filter (80–95 Hz) and Auto release to weld ensemble voices together without bass pumping. FabFilter Pro-MB stabilizes four frequency bands independently during fortissimo swells, while FabFilter Pro-L 2 enforces a strict -1.0 dBTP streaming-safe ceiling.',
  },
  {
    id: 'plugin-manual-space',
    category: 'Plugin Manuals',
    title: '11. Space & Stereo Imaging: ValhallaVintageVerb & A1StereoControl',
    subtitle: 'Depth layering and phase-coherent stereo field control',
    body: 'Use two distinct ValhallaVintageVerb spaces to create front-to-back depth: a longer Concert Hall (2.6 s decay, 32 ms predelay) on the Choir Bus to set the ensemble gracefully behind the soloist, and a tighter Smooth Plate (1.9 s decay, 42 ms predelay) on the Soloist Bus to keep lead lyrics intimate. On the Master Bus, A1StereoControl widens the hall ambience to ~112% while Safe Bass collapses everything below 130 Hz strictly to mono for rock-solid low-end phase coherence.',
  },
  {
    id: 'guide-ai-composer',
    category: 'AI Composer',
    title: '12. AI Song Studio (Suno-Style Composer)',
    subtitle: 'Prompt-to-arrangement songwriting with instant DAW integration',
    body: 'Describe a musical mood, genre, tempo, key, vocal style, and lyrical theme in the AI Song Studio. Cantus Studio invokes Gemini on the server (`POST /api/compose`) to generate structured song sections (verse/chorus lyrics, jazz/choral chord progressions, tempo, and full 5-part SATB + Soloist + Piano voicings). Preview the synthesized arrangement immediately in the browser or click "Load into DAW Timeline" to route every voice part through your active 8-bus plugin chains and broadcast the new song to all collaborators.',
  },
  {
    id: 'guide-voice-analyzer',
    category: 'Voice Analyzer',
    title: '13. Voice & Vocal Type Analyzer',
    subtitle: 'Autocorrelation pitch tracking, spectral timbre analysis, and auto-chain presets',
    body: 'Record directly from your microphone, upload any vocal WAV/MP3/WebM recording, or audition built-in Soprano, Alto, Tenor, and Bass vocal test samples. Cantus Studio runs client-side autocorrelation pitch detection (`F0`), calculates lowest/highest sung notes, comfortable tessitura (20th–80th percentile), spectral centroid brightness, vibrato rate, and dynamic range, then combines those measurements with Gemini vocal coaching (`POST /api/voice/analyze`) to classify your voice fach, recommend your highest-fit musical genres and keys, and apply one-click custom EQ/saturation presets directly to your DAW Soloist & Section buses.',
    table: {
      headers: ['Voice Fach', 'Typical Range', 'Median F0 Zone', 'Assigned DAW Section Bus'],
      rows: [
        ['Soprano', 'C4 – C6 (261–1046 Hz)', '>= 390 Hz', 'Soprano Bus (HPF 130 Hz)'],
        ['Mezzo-Soprano', 'A3 – A5 (220–880 Hz)', '310 – 389 Hz', 'Alto / Soloist Bus (HPF 110 Hz)'],
        ['Alto / Contralto', 'F3 – F5 (175–698 Hz)', '245 – 309 Hz', 'Alto Bus (HPF 100 Hz)'],
        ['Tenor', 'C3 – C5 (131–523 Hz)', '175 – 244 Hz', 'Tenor Bus (HPF 90 Hz)'],
        ['Baritone', 'G2 – G4 (98–392 Hz)', '125 – 174 Hz', 'Bass / Soloist Bus (HPF 75 Hz)'],
        ['Bass', 'E2 – E4 (82–330 Hz)', '< 125 Hz', 'Bass Bus (HPF 55 Hz)'],
      ],
    },
  },
  {
    id: 'guide-collab-api',
    category: 'Collaboration & API',
    title: '14. Real-Time Collaboration & Server API Reference',
    subtitle: 'Authoritative WebSocket rooms, event schemas, and REST endpoints',
    body: 'Cantus Studio runs a unified Express + WebSocket server on port 3000. Each studio room (`?room=<id>`) maintains server-authoritative state for all 8 buses, 26 plugin slots, timeline tracks, BPM/key, and timestamped mix notes. Clients apply optimistic UI updates locally while broadcasting minimal delta events over WebSocket with automatic reconnection and idempotent reconciliation.',
    codeBlock: `WebSocket Endpoint: ws(s)://<host>/ws

Client → Server Events:
  • { type: "room:join", roomId, user: { id, name, role, color } }
  • { type: "presence:update", activeView, selectedBusId }
  • { type: "bus:update", busId, patch: { volumeDb, pan, muted, soloed } }
  • { type: "plugin:update", busId, pluginId, patch: { bypassed, params } }
  • { type: "track:update", trackId, patch: { muted, soloed, gainDb, notes } }
  • { type: "song:load", song }
  • { type: "chat:send", message: { id, text, barMarker, busTag, ... } }

REST API Endpoints:
  • GET  /api/health          → Server status & active room count
  • POST /api/compose         → Gemini AI song, lyrics & SATB arrangement composer
  • POST /api/voice/analyze   → Multimodal vocal fach, genre & plugin preset analyzer`,
  },
];

export function generateFullDocumentationMarkdown(): string {
  const lines: string[] = [
    '# Cantus Studio — Complete Engineering & Platform Documentation',
    '',
    'Collaborative Choral & Vocal DAW · AI Song Composer · Voice Analyzer · Pro Mastering Console',
    '',
  ];

  for (const sec of DOCUMENTATION_SECTIONS) {
    lines.push(`## ${sec.title}`);
    lines.push(`*${sec.category} — ${sec.subtitle}*`);
    lines.push('');
    lines.push(sec.body);
    lines.push('');
    if (sec.codeBlock) {
      lines.push('```text');
      lines.push(sec.codeBlock);
      lines.push('```');
      lines.push('');
    }
    if (sec.table) {
      lines.push(`| ${sec.table.headers.join(' | ')} |`);
      lines.push(`| ${sec.table.headers.map(() => '---').join(' | ')} |`);
      for (const row of sec.table.rows) {
        lines.push(`| ${row.join(' | ')} |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
