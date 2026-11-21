import { BusChannel, BusId, DawTrack, PluginInstance } from '../types/studio';
import { midiToFreq } from './pitchDetection';

function dbToGain(db: number): number {
  if (db <= -59) return 0;
  return Math.pow(10, db / 20);
}

function makeSaturationCurve(amount: number, mode: 'tape' | 'tube' | 'pentode' | 'transformer'): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const k = Math.max(0.01, amount);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    if (mode === 'tube') {
      // Asymmetric even-order tube warmth
      curve[i] = Math.tanh((x + 0.08 * k * x * x) * (1 + k * 2.5));
    } else if (mode === 'pentode') {
      // Richer odd/even harmonic drive
      curve[i] = ((1 + k * 4) * x) / (1 + k * 4 * Math.abs(x));
    } else if (mode === 'transformer') {
      curve[i] = Math.tanh(x * (1 + k * 1.8)) * 0.96 + 0.04 * Math.sin(x * Math.PI);
    } else {
      // Soft magnetic tape saturation
      curve[i] = Math.tanh(x * (1 + k * 2.2));
    }
  }
  return curve;
}

function buildReverbImpulse(
  ctx: BaseAudioContext,
  decaySec: number,
  predelayMs: number,
  highCutHz: number
): AudioBuffer {
  const rate = ctx.sampleRate;
  const preSamples = Math.floor((predelayMs / 1000) * rate);
  const length = Math.min(rate * 6, Math.max(rate * 0.5, Math.floor(decaySec * rate) + preSamples));
  const impulse = ctx.createBuffer(2, length, rate);
  const dampFactor = Math.max(0.15, Math.min(0.95, highCutHz / 16000));

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = preSamples; i < length; i++) {
      const t = (i - preSamples) / Math.max(1, length - preSamples);
      const env = Math.pow(1 - t, 2.6);
      const white = (Math.random() * 2 - 1) * env;
      lp = lp * (1 - dampFactor) + white * dampFactor;
      data[i] = lp * 0.55;
    }
  }
  return impulse;
}

interface BusNodeChain {
  input: GainNode;
  output: GainNode;
  fader: GainNode;
  panner: StereoPannerNode;
  analyser: AnalyserNode;
  pluginUpdaters: Map<string, (p: PluginInstance) => void>;
}

/**
 * Full Web Audio DSP multi-bus mixer & synthesizer engine implementing:
 * - Section buses (Soprano, Alto, Tenor, Bass) -> Choir Bus -> Master Bus
 * - Soloist Stem -> Soloist Bus -> Master Bus
 * - Real-time DSP nodes for all 13 requested audio plugins
 */
export class CantusAudioEngine {
  private ctx: AudioContext | null = null;
  private busNodes: Partial<Record<BusId, BusNodeChain>> = {};
  private isPlaying = false;
  private currentBeat = 0;
  private bpm = 84;
  private totalBeats = 32;
  private tracks: DawTrack[] = [];
  private buses: Record<BusId, BusChannel> | null = null;
  private timerId: number | null = null;
  private lastStepTime = 0;
  private activeOscillators: Set<AudioNode> = new Set();
  private beatListeners: Set<(beat: number, playing: boolean) => void> = new Set();

  public onBeat(cb: (beat: number, playing: boolean) => void): () => void {
    this.beatListeners.add(cb);
    return () => this.beatListeners.delete(cb);
  }

  private emitBeat(): void {
    for (const cb of this.beatListeners) {
      cb(this.currentBeat, this.isPlaying);
    }
  }

  public init(buses: Record<BusId, BusChannel>, tracks: DawTrack[], bpm: number, totalBeats: number): void {
    this.buses = buses;
    this.tracks = tracks;
    this.bpm = bpm;
    this.totalBeats = totalBeats;

    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.rebuildAudioGraph(buses);
    } else if (this.ctx) {
      this.syncBuses(buses);
    }
  }

  public updateTransportMeta(tracks: DawTrack[], bpm: number, totalBeats: number): void {
    this.tracks = tracks;
    this.bpm = bpm;
    this.totalBeats = totalBeats;
  }

  private createPluginStage(ctx: AudioContext, plugin: PluginInstance): {
    input: AudioNode;
    output: AudioNode;
    update: (p: PluginInstance) => void;
  } {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dryBypass = ctx.createGain();
    const wetStageIn = ctx.createGain();
    const wetStageOut = ctx.createGain();

    input.connect(dryBypass);
    dryBypass.connect(output);
    input.connect(wetStageIn);
    wetStageOut.connect(output);

    const setBypass = (bypassed: boolean) => {
      const now = ctx.currentTime;
      dryBypass.gain.setTargetAtTime(bypassed ? 1 : 0, now, 0.015);
      wetStageOut.gain.setTargetAtTime(bypassed ? 0 : 1, now, 0.015);
    };

    switch (plugin.typeId) {
      case 'fabfilter-pro-q-3': {
        const hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        const low = ctx.createBiquadFilter();
        low.type = 'peaking';
        low.frequency.value = 220;
        low.Q.value = 1.1;
        const mid = ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.Q.value = 1.4;
        const high = ctx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 10000;
        const trim = ctx.createGain();

        wetStageIn.connect(hpf);
        hpf.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(trim);
        trim.connect(wetStageOut);

        const update = (p: PluginInstance) => {
          setBypass(p.bypassed);
          const now = ctx.currentTime;
          hpf.frequency.setTargetAtTime(p.params.hpfFreq ?? 80, now, 0.02);
          low.gain.setTargetAtTime(p.params.lowGain ?? 0, now, 0.02);
          mid.frequency.setTargetAtTime(p.params.midFreq ?? 1800, now, 0.02);
          mid.gain.setTargetAtTime(p.params.midGain ?? 0, now, 0.02);
          high.gain.setTargetAtTime(p.params.highShelf ?? 0, now, 0.02);
          trim.gain.setTargetAtTime(dbToGain(p.params.outputGain ?? 0), now, 0.02);
        };
        update(plugin);
        return { input, output, update };
      }

      case 'rule-tec-eq1a': {
        const lowBoost = ctx.createBiquadFilter();
        lowBoost.type = 'lowshelf';
        const lowAtten = ctx.createBiquadFilter();
        lowAtten.type = 'peaking';
        lowAtten.Q.value = 1.2;
        const highBoost = ctx.createBiquadFilter();
        highBoost.type = 'peaking';
        const highAtten = ctx.createBiquadFilter();
        highAtten.type = 'highshelf';
        highAtten.frequency.value = 14000;

        wetStageIn.connect(lowBoost);
        lowBoost.connect(lowAtten);
        lowAtten.connect(highBoost);
        highBoost.connect(highAtten);
        highAtten.connect(wetStageOut);

        const lowFreqMap = [20, 30, 60, 100];
        const highFreqMap = [3000, 5000, 8000, 10000, 16000];

        const update = (p: PluginInstance) => {
          setBypass(p.bypassed);
          const now = ctx.currentTime;
          const lf = lowFreqMap[Math.round(p.params.lowFreq ?? 2)] ?? 60;
          const hf = highFreqMap[Math.round(p.params.highFreq ?? 3)] ?? 10000;
          lowBoost.frequency.setTargetAtTime(lf, now, 0.02);
          lowBoost.gain.setTargetAtTime((p.params.lowBoost ?? 0) * 0.9, now, 0.02);
          lowAtten.frequency.setTargetAtTime(lf * 2.2, now, 0.02);
          lowAtten.gain.setTargetAtTime(-(p.params.lowAtten ?? 0) * 0.65, now, 0.02);
          highBoost.frequency.setTargetAtTime(hf, now, 0.02);
          highBoost.Q.setTargetAtTime(Math.max(0.4, 2.2 - (p.params.bandwidth ?? 5) * 0.16), now, 0.02);
          highBoost.gain.setTargetAtTime((p.params.highBoost ?? 0) * 0.85, now, 0.02);
          highAtten.gain.setTargetAtTime(-(p.params.highAtten ?? 0) * 0.7, now, 0.02);
        };
        update(plugin);
        return { input, output, update };
      }

      case 'rule-tec-eq5m': {
        const lowPeak = ctx.createBiquadFilter();
        lowPeak.type = 'peaking';
        lowPeak.Q.value = 1.1;
        const midDip = ctx.createBiquadFilter();
        midDip.type = 'peaking';
        midDip.Q.value = 1.3;
        const highPeak = ctx.createBiquadFilter();
        highPeak.type = 'peaking';
        highPeak.Q.value = 1.1;

        wetStageIn.connect(lowPeak);
        lowPeak.connect(midDip);
        midDip.connect(highPeak);
        highPeak.connect(wetStageOut);

        const lpFreqs = [200, 300, 500, 700];
        const dipFreqs = [300, 500, 1000, 2000, 4000];
        const hpFreqs = [1500, 2000, 3000, 4000];

        const update = (p: PluginInstance) => {
          setBypass(p.bypassed);
          const now = ctx.currentTime;
          lowPeak.frequency.setTargetAtTime(lpFreqs[Math.round(p.params.lowPeakFreq ?? 1)] ?? 300, now, 0.02);
          lowPeak.gain.setTargetAtTime((p.params.lowPeakGain ?? 0) * 0.75, now, 0.02);
          midDip.frequency.setTargetAtTime(dipFreqs[Math.round(p.params.dipFreq ?? 1)] ?? 500, now, 0.02);
          midDip.gain.setTargetAtTime(-(p.params.dipAtten ?? 0) * 0.8, now, 0.02);
          highPeak.frequency.setTargetAtTime(hpFreqs[Math.round(p.params.highPeakFreq ?? 2)] ?? 3000, now, 0.02);
          highPeak.gain.setTargetAtTime((p.params.highPeakGain ?? 0) * 0.75, now, 0.02);
        };
        update(plugin);
        return { input, output, update };
      }

      case 'fabfilter-saturn-2':
      case 'black-box-hg-2':
      case 'ozone-12-vintage-tape': {
        const shaper = ctx.createWaveShaper();
        shaper.oversample = '2x';
        const tone = ctx.createBiquadFilter();
        tone.type = 'highshelf';
        tone.frequency.value = 6500;
        const lowBump = ctx.createBiquadFilter();
        lowBump.type = 'lowshelf';
        lowBump.frequency.value = 110;
        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();
        const outTrim = ctx.createGain();

        wetStageIn.connect(shaper);
        shaper.connect(lowBump);
        lowBump.connect(tone);
        tone.connect(wetGain);
        wetGain.connect(outTrim);
        wetStageIn.connect(dryGain);
        dryGain.connect(outTrim);
        outTrim.connect(wetStageOut);

        const update = (p: PluginInstance) => {
          setBypass(p.bypassed);
          const now = ctx.currentTime;
          if (p.typeId === 'fabfilter-saturn-2') {
            const drive = (p.params.drive ?? 20) / 100;
            const modes: Array<'tape' | 'tube' | 'transformer'> = ['tape', 'tube', 'transformer'];
            shaper.curve = makeSaturationCurve(drive, modes[Math.round(p.params.style ?? 0)] ?? 'tape');
            tone.gain.setTargetAtTime((p.params.tone ?? 0) * 0.5, now, 0.02);
            const mix = (p.params.mix ?? 40) / 100;
            wetGain.gain.setTargetAtTime(mix, now, 0.02);
            dryGain.gain.setTargetAtTime(1 - mix, now, 0.02);
            outTrim.gain.setTargetAtTime(dbToGain(p.params.level ?? 0), now, 0.02);
          } else if (p.typeId === 'black-box-hg-2') {
            const combinedDrive = ((p.params.pentode ?? 35) + (p.params.triode ?? 40) + (p.params.saturation ?? 30)) / 300;
            shaper.curve = makeSaturationCurve(combinedDrive, 'pentode');
            tone.frequency.setTargetAtTime(10000, now, 0.02);
            tone.gain.setTargetAtTime(((p.params.air ?? 30) / 100) * 4.5, now, 0.02);
            const mix = (p.params.mix ?? 65) / 100;
            wetGain.gain.setTargetAtTime(mix, now, 0.02);
            dryGain.gain.setTargetAtTime(1 - mix, now, 0.02);
            outTrim.gain.setTargetAtTime(dbToGain(p.params.output ?? 0), now, 0.02);
          } else {
            // Ozone 12 Vintage Tape
            const drive = (p.params.inputDrive ?? 2.5) / 14;
            shaper.curve = makeSaturationCurve(drive, 'tape');
            lowBump.gain.setTargetAtTime(p.params.lowEmphasis ?? 0.8, now, 0.02);
            tone.gain.setTargetAtTime((p.params.highEmphasis ?? 0.5) - (p.params.speed === 0 ? 0.6 : 0), now, 0.02);
            wetGain.gain.setTargetAtTime(0.85, now, 0.02);
            dryGain.gain.setTargetAtTime(0.15, now, 0.02);
            outTrim.gain.setTargetAtTime(1, now, 0.02);
          }
        };
        update(plugin);
        return { input, output, update };
      }

      case 'bx-opto':
      case 'ssl-bus-comp-2':
      case 'mc77':
      case 'fabfilter-pro-l-2': {
        const comp = ctx.createDynamicsCompressor();
        const makeup = ctx.createGain();
        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();

        wetStageIn.connect(comp);
        comp.connect(makeup);
        makeup.connect(wetGain);
        wetGain.connect(wetStageOut);
        wetStageIn.connect(dryGain);
        dryGain.connect(wetStageOut);

        const update = (p: PluginInstance) => {
          setBypass(p.bypassed);
          const now = ctx.currentTime;
          if (p.typeId === 'bx-opto') {
            const pr = p.params.peakReduction ?? 38;
            comp.threshold.setTargetAtTime(-4 - pr * 0.34, now, 0.02);
            comp.ratio.setTargetAtTime(3.2, now, 0.02);
            comp.knee.setTargetAtTime(18, now, 0.02);
            const speed = (p.params.speed ?? 45) / 100;
            comp.attack.setTargetAtTime(0.035 - speed * 0.028, now, 0.02);
            comp.release.setTargetAtTime(0.42 - speed * 0.28, now, 0.02);
            makeup.gain.setTargetAtTime(dbToGain(p.params.gain ?? 2), now, 0.02);
            const mix = (p.params.mix ?? 85) / 100;
            wetGain.gain.setTargetAtTime(mix, now, 0.02);
            dryGain.gain.setTargetAtTime(1 - mix, now, 0.02);
          } else if (p.typeId === 'ssl-bus-comp-2') {
            const ratios = [2, 4, 10];
            const attacks = [0.0001, 0.001, 0.003, 0.01, 0.03];
            const releases = [0.1, 0.3, 0.6, 1.2, 0.35];
            comp.threshold.setTargetAtTime(p.params.threshold ?? -14, now, 0.02);
            comp.ratio.setTargetAtTime(ratios[Math.round(p.params.ratio ?? 1)] ?? 4, now, 0.02);
            comp.knee.setTargetAtTime(6, now, 0.02);
            comp.attack.setTargetAtTime(attacks[Math.round(p.params.attack ?? 3)] ?? 0.01, now, 0.02);
            comp.release.setTargetAtTime(releases[Math.round(p.params.release ?? 4)] ?? 0.35, now, 0.02);
            makeup.gain.setTargetAtTime(dbToGain(p.params.makeup ?? 1.5), now, 0.02);
            const mix = (p.params.mix ?? 100) / 100;
            wetGain.gain.setTargetAtTime(mix, now, 0.02);
            dryGain.gain.setTargetAtTime(1 - mix, now, 0.02);
          } else if (p.typeId === 'mc77') {
            const ratios = [4, 8, 12, 20];
            const drive = p.params.input ?? 6;
            comp.threshold.setTargetAtTime(-12 - drive * 0.8, now, 0.02);
            comp.ratio.setTargetAtTime(ratios[Math.round(p.params.ratio ?? 0)] ?? 4, now, 0.02);
            comp.knee.setTargetAtTime(4, now, 0.02);
            comp.attack.setTargetAtTime(Math.max(0.0002, (8 - (p.params.attack ?? 4.5)) * 0.001), now, 0.02);
            comp.release.setTargetAtTime(Math.max(0.05, (8 - (p.params.release ?? 5.5)) * 0.08), now, 0.02);
            makeup.gain.setTargetAtTime(dbToGain((p.params.output ?? -2) + drive * 0.35), now, 0.02);
            const mix = (p.params.mix ?? 85) / 100;
            wetGain.gain.setTargetAtTime(mix, now, 0.02);
            dryGain.gain.setTargetAtTime(1 - mix, now, 0.02);
          } else {
            // FabFilter Pro-L 2 brickwall true-peak limiter
            const ceiling = p.params.ceiling ?? -1.0;
            const gainDb = p.params.gain ?? 3.8;
            comp.threshold.setTargetAtTime(ceiling - 1.0, now, 0.02);
            comp.ratio.setTargetAtTime(20, now, 0.02);
            comp.knee.setTargetAtTime(0, now, 0.02);
            comp.attack.setTargetAtTime(0.001, now, 0.02);
            comp.release.setTargetAtTime((p.params.release ?? 420) / 1000, now, 0.02);
            makeup.gain.setTargetAtTime(dbToGain(Math.min(8, gainDb * 0.35) + ceiling), now, 0.02);
            wetGain.gain.setTargetAtTime(1, now, 0.02);
            dryGain.gain.setTargetAtTime(0, now, 0.02);
          }
        };
        update(plugin);
        return { input, output, update };
      }

      case 'fabfilter-pro-mb': {
        // 4-band split crossover multiband compression
        const lowFilter = ctx.createBiquadFilter();
        lowFilter.type = 'lowpass';
        lowFilter.frequency.value = 160;
        const lowMidFilter = ctx.createBiquadFilter();
        lowMidFilter.type = 'bandpass';
        lowMidFilter.frequency.value = 420;
        lowMidFilter.Q.value = 0.7;
        const highMidFilter = ctx.createBiquadFilter();
        highMidFilter.type = 'bandpass';
        highMidFilter.frequency.value = 2100;
        highMidFilter.Q.value = 0.7;
        const highFilter = ctx.createBiquadFilter();
        highFilter.type = 'highpass';
        highFilter.frequency.value = 4500;

        const c1 = ctx.createDynamicsCompressor();
        const c2 = ctx.createDynamicsCompressor();
        const c3 = ctx.createDynamicsCompressor();
        const c4 = ctx.createDynamicsCompressor();
        const sumOut = ctx.createGain();

        const pairs: Array<[BiquadFilterNode, DynamicsCompressorNode]> = [
          [lowFilter, c1],
          [lowMidFilter, c2],
          [highMidFilter, c3],
          [highFilter, c4],
        ];
        for (const [flt, cmp] of pairs) {
          cmp.ratio.value = 2.5;
          cmp.knee.value = 10;
          wetStageIn.connect(flt);
          flt.connect(cmp);
          cmp.connect(sumOut);
        }
        sumOut.connect(wetStageOut);

        const update = (p: PluginInstance) => {
          setBypass(p.bypassed);
          const now = ctx.currentTime;
          c1.threshold.setTargetAtTime(p.params.lowThresh ?? -18, now, 0.02);
          c2.threshold.setTargetAtTime(p.params.lowMidThresh ?? -16, now, 0.02);
          c3.threshold.setTargetAtTime(p.params.highMidThresh ?? -15, now, 0.02);
          c4.threshold.setTargetAtTime(p.params.highThresh ?? -16, now, 0.02);
          sumOut.gain.setTargetAtTime(dbToGain(p.params.output ?? 0.5), now, 0.02);
        };
        update(plugin);
        return { input, output, update };
      }

      case 'a1-stereo-control': {
        // True Mid/Side width matrix + Safe Bass mono crossover
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        const midGain = ctx.createGain();
        const sideGain = ctx.createGain();
        const lToMid = ctx.createGain();
        const rToMid = ctx.createGain();
        const lToSide = ctx.createGain();
        const rToSide = ctx.createGain();
        const sideInvert = ctx.createGain();
        lToMid.gain.value = 0.5;
        rToMid.gain.value = 0.5;
        lToSide.gain.value = 0.5;
        rToSide.gain.value = -0.5;
        sideInvert.gain.value = -1;

        const safeBassHp = ctx.createBiquadFilter();
        safeBassHp.type = 'highpass';

        wetStageIn.connect(splitter);
        // Mid = (L + R) / 2
        splitter.connect(lToMid, 0);
        splitter.connect(rToMid, 1);
        lToMid.connect(midGain);
        rToMid.connect(midGain);
        // Side = HPF((L - R) / 2) -> Safe Bass removes stereo width below crossover
        splitter.connect(lToSide, 0);
        splitter.connect(rToSide, 1);
        lToSide.connect(safeBassHp);
        rToSide.connect(safeBassHp);
        safeBassHp.connect(sideGain);

        // Recombine: L = Mid + Side, R = Mid - Side
        midGain.connect(merger, 0, 0);
        sideGain.connect(merger, 0, 0);
        midGain.connect(merger, 0, 1);
        sideGain.connect(sideInvert);
        sideInvert.connect(merger, 0, 1);

        const balance = ctx.createStereoPanner();
        merger.connect(balance);
        balance.connect(wetStageOut);

        const update = (p: PluginInstance) => {
          setBypass(p.bypassed);
          const now = ctx.currentTime;
          const width = (p.params.width ?? 112) / 100;
          sideGain.gain.setTargetAtTime(width, now, 0.02);
          safeBassHp.frequency.setTargetAtTime(
            (p.params.safeBassOn ?? 1) >= 0.5 ? (p.params.safeBassFreq ?? 130) : 10,
            now,
            0.02
          );
          balance.pan.setTargetAtTime((p.params.pan ?? 0) / 50, now, 0.02);
        };
        update(plugin);
        return { input, output, update };
      }

      case 'valhalla-vintage-verb': {
        const convolver = ctx.createConvolver();
        const lowCut = ctx.createBiquadFilter();
        lowCut.type = 'highpass';
        const highCut = ctx.createBiquadFilter();
        highCut.type = 'lowpass';
        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();

        wetStageIn.connect(lowCut);
        lowCut.connect(convolver);
        convolver.connect(highCut);
        highCut.connect(wetGain);
        wetGain.connect(wetStageOut);
        wetStageIn.connect(dryGain);
        dryGain.connect(wetStageOut);

        let lastDecay = -1;
        let lastPredelay = -1;

        const update = (p: PluginInstance) => {
          setBypass(p.bypassed);
          const now = ctx.currentTime;
          const decay = p.params.decay ?? 2.2;
          const predelay = p.params.predelay ?? 28;
          const hc = p.params.highCut ?? 7500;
          if (Math.abs(decay - lastDecay) > 0.05 || Math.abs(predelay - lastPredelay) > 1) {
            convolver.buffer = buildReverbImpulse(ctx, decay, predelay, hc);
            lastDecay = decay;
            lastPredelay = predelay;
          }
          lowCut.frequency.setTargetAtTime(p.params.lowCut ?? 180, now, 0.02);
          highCut.frequency.setTargetAtTime(hc, now, 0.02);
          const mix = (p.params.mix ?? 22) / 100;
          wetGain.gain.setTargetAtTime(mix, now, 0.02);
          dryGain.gain.setTargetAtTime(1 - mix * 0.45, now, 0.02);
        };
        update(plugin);
        return { input, output, update };
      }
    }
  }

  private rebuildAudioGraph(buses: Record<BusId, BusChannel>): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.busNodes = {};

    // Create each bus node strip with all its plugins in exact serial order
    (Object.keys(buses) as BusId[]).forEach((busId) => {
      const bus = buses[busId];
      const input = ctx.createGain();
      const fader = ctx.createGain();
      const panner = ctx.createStereoPanner();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const output = ctx.createGain();
      const pluginUpdaters = new Map<string, (p: PluginInstance) => void>();

      let cursor: AudioNode = input;
      for (const plugin of bus.plugins) {
        const stage = this.createPluginStage(ctx, plugin);
        cursor.connect(stage.input);
        cursor = stage.output;
        pluginUpdaters.set(plugin.id, stage.update);
      }

      cursor.connect(fader);
      fader.connect(panner);
      panner.connect(analyser);
      analyser.connect(output);

      this.busNodes[busId] = { input, output, fader, panner, analyser, pluginUpdaters };
    });

    // Wire routing topology: Section -> Choir -> Master; Soloist Stem -> Soloist Bus -> Master; Master -> Destination
    (Object.keys(buses) as BusId[]).forEach((busId) => {
      const bus = buses[busId];
      const node = this.busNodes[busId];
      if (!node) return;
      if (bus.routesTo === 'output') {
        node.output.connect(ctx.destination);
      } else {
        const dest = this.busNodes[bus.routesTo];
        if (dest) {
          node.output.connect(dest.input);
        }
      }
    });

    this.syncBuses(buses);
  }

  public syncBuses(buses: Record<BusId, BusChannel>): void {
    this.buses = buses;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const anySectionSolo = (['soprano', 'alto', 'tenor', 'bass'] as BusId[]).some(
      (id) => buses[id]?.soloed
    );
    const anyTopSolo = (['choir-bus', 'soloist-bus'] as BusId[]).some(
      (id) => buses[id]?.soloed
    );

    (Object.keys(buses) as BusId[]).forEach((busId) => {
      const bus = buses[busId];
      const chain = this.busNodes[busId];
      if (!chain) return;

      let effectiveMuted = bus.muted;
      if (bus.group === 'section' && anySectionSolo && !bus.soloed) {
        effectiveMuted = true;
      }
      if ((busId === 'choir-bus' || busId === 'soloist-bus') && anyTopSolo && !bus.soloed) {
        effectiveMuted = true;
      }

      chain.fader.gain.setTargetAtTime(effectiveMuted ? 0 : dbToGain(bus.volumeDb), now, 0.02);
      chain.panner.pan.setTargetAtTime(bus.pan, now, 0.02);

      for (const plugin of bus.plugins) {
        const updater = chain.pluginUpdaters.get(plugin.id);
        if (updater) updater(plugin);
      }
    });
  }

  private triggerVoiceNote(
    targetBus: BusId,
    freq: number,
    durationSec: number,
    velocity: number,
    waveformType: DawTrack['waveformType'],
    trackGainDb: number
  ): void {
    if (!this.ctx) return;
    const busNode = this.busNodes[targetBus];
    if (!busNode) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const env = ctx.createGain();
    const peakGain = velocity * dbToGain(trackGainDb) * (waveformType === 'warm-piano' ? 0.16 : 0.2);

    if (waveformType === 'vocal-formant' || waveformType === 'choir-pad') {
      // Synthesize natural choral/vocal vowel ("Ah"/"Oh") via dual formant bandpass + gentle vibrato
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 1.003, now);

      // Subtle vocal vibrato LFO
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = waveformType === 'vocal-formant' ? 5.4 : 4.8;
      lfoGain.gain.value = waveformType === 'vocal-formant' ? freq * 0.008 : freq * 0.004;
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);

      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = freq > 350 ? 780 : 620;
      f1.Q.value = 3.2;

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = freq > 350 ? 1350 : 1080;
      f2.Q.value = 3.6;

      const body = ctx.createBiquadFilter();
      body.type = 'lowpass';
      body.frequency.value = waveformType === 'vocal-formant' ? 3600 : 2400;

      osc1.connect(f1);
      osc1.connect(f2);
      osc2.connect(body);
      f1.connect(env);
      f2.connect(env);
      body.connect(env);
      env.connect(busNode.input);

      const attack = waveformType === 'vocal-formant' ? 0.07 : 0.22;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(peakGain, now + attack);
      env.gain.setTargetAtTime(peakGain * 0.85, now + attack, 0.15);
      env.gain.setTargetAtTime(0.0001, now + Math.max(attack + 0.05, durationSec - 0.14), 0.08);

      osc1.start(now);
      osc2.start(now);
      lfo.start(now);
      const stopAt = now + durationSec + 0.25;
      osc1.stop(stopAt);
      osc2.stop(stopAt);
      lfo.stop(stopAt);

      this.activeOscillators.add(osc1);
      osc1.onended = () => this.activeOscillators.delete(osc1);
    } else {
      // Warm felt grand piano / accompaniment
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200, now);
      lp.frequency.exponentialRampToValueAtTime(650, now + durationSec);

      osc.connect(lp);
      lp.connect(env);
      env.connect(busNode.input);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(peakGain, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0008, now + durationSec + 0.2);

      osc.start(now);
      osc.stop(now + durationSec + 0.25);
      this.activeOscillators.add(osc);
      osc.onended = () => this.activeOscillators.delete(osc);
    }
  }

  public async play(): Promise<void> {
    if (!this.ctx && this.buses) {
      this.init(this.buses, this.tracks, this.bpm, this.totalBeats);
    }
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastStepTime = performance.now();
    this.triggerNotesAtBeat(this.currentBeat);
    this.emitBeat();

    const stepMs = 40;
    this.timerId = window.setInterval(() => {
      if (!this.isPlaying) return;
      const now = performance.now();
      const elapsedSec = (now - this.lastStepTime) / 1000;
      this.lastStepTime = now;
      const prevBeat = this.currentBeat;
      const beatsDelta = elapsedSec * (this.bpm / 60);
      this.currentBeat = (this.currentBeat + beatsDelta) % this.totalBeats;

      this.triggerNotesBetween(prevBeat, this.currentBeat);
      this.emitBeat();
    }, stepMs);
  }

  private triggerNotesAtBeat(beat: number): void {
    const anyTrackSolo = this.tracks.some((t) => t.soloed);
    const secPerBeat = 60 / this.bpm;
    for (const track of this.tracks) {
      if (track.muted || (anyTrackSolo && !track.soloed)) continue;
      for (const note of track.notes) {
        if (Math.abs(note.startBeat - beat) < 0.08) {
          this.triggerVoiceNote(
            track.targetBus,
            midiToFreq(note.pitch),
            note.durationBeats * secPerBeat,
            note.velocity,
            track.waveformType,
            track.gainDb
          );
        }
      }
    }
  }

  private triggerNotesBetween(prevBeat: number, nextBeat: number): void {
    const anyTrackSolo = this.tracks.some((t) => t.soloed);
    const secPerBeat = 60 / this.bpm;
    const wrapped = nextBeat < prevBeat;

    for (const track of this.tracks) {
      if (track.muted || (anyTrackSolo && !track.soloed)) continue;
      for (const note of track.notes) {
        const hit = wrapped
          ? note.startBeat > prevBeat || note.startBeat <= nextBeat
          : note.startBeat > prevBeat && note.startBeat <= nextBeat;
        if (hit) {
          this.triggerVoiceNote(
            track.targetBus,
            midiToFreq(note.pitch),
            note.durationBeats * secPerBeat,
            note.velocity,
            track.waveformType,
            track.gainDb
          );
        }
      }
    }
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.emitBeat();
  }

  public stop(): void {
    this.pause();
    this.currentBeat = 0;
    this.emitBeat();
  }

  public seek(beat: number): void {
    this.currentBeat = Math.max(0, Math.min(this.totalBeats - 0.1, beat));
    this.emitBeat();
  }

  public getBusLevels(): Record<BusId, number> {
    const result = {} as Record<BusId, number>;
    const ids: BusId[] = [
      'soprano',
      'alto',
      'tenor',
      'bass',
      'choir-bus',
      'soloist-stem',
      'soloist-bus',
      'master-bus',
    ];
    for (const id of ids) {
      const chain = this.busNodes[id];
      if (!chain || !this.isPlaying) {
        result[id] = 0;
        continue;
      }
      const data = new Float32Array(chain.analyser.fftSize);
      chain.analyser.getFloatTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
      result[id] = Math.min(1, peak * 2.4);
    }
    return result;
  }

  /**
   * Renders a short stereo WAV mixdown of the current arrangement for download.
   */
  public async renderMixToWavBlob(): Promise<Blob> {
    const sampleRate = 44100;
    const secPerBeat = 60 / this.bpm;
    const durationSec = Math.min(26, this.totalBeats * secPerBeat + 1.5);
    const offline = new OfflineAudioContext(2, Math.floor(sampleRate * durationSec), sampleRate);
    const masterGain = offline.createGain();
    masterGain.gain.value = 0.85;
    masterGain.connect(offline.destination);

    const anyTrackSolo = this.tracks.some((t) => t.soloed);
    for (const track of this.tracks) {
      if (track.muted || (anyTrackSolo && !track.soloed)) continue;
      for (const note of track.notes) {
        const startTime = note.startBeat * secPerBeat;
        const dur = note.durationBeats * secPerBeat;
        const osc = offline.createOscillator();
        osc.type = track.waveformType === 'warm-piano' ? 'triangle' : 'sawtooth';
        osc.frequency.setValueAtTime(midiToFreq(note.pitch), startTime);

        const flt = offline.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.value = track.waveformType === 'vocal-formant' ? 2400 : 1600;

        const env = offline.createGain();
        const peak = note.velocity * dbToGain(track.gainDb) * 0.14;
        env.gain.setValueAtTime(0.0001, startTime);
        env.gain.linearRampToValueAtTime(peak, startTime + 0.08);
        env.gain.setTargetAtTime(0.0001, startTime + Math.max(0.1, dur - 0.1), 0.08);

        osc.connect(flt);
        flt.connect(env);
        env.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + dur + 0.25);
      }
    }

    const rendered = await offline.startRendering();
    return audioBufferToWavBlob(rendered);
  }
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Generates deterministic vocal test PCM buffers for instant Voice Analyzer testing without a mic.
 */
export function synthesizeVocalTestSample(
  profile: 'soprano' | 'alto' | 'tenor' | 'bass'
): { samples: Float32Array; sampleRate: number } {
  const sampleRate = 44100;
  const durationSec = 3.2;
  const length = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(length);

  const profiles = {
    soprano: { notes: [440, 523.25, 659.25, 783.99, 659.25], brightness: 0.55 },
    alto: { notes: [220, 261.63, 329.63, 349.23, 293.66], brightness: 0.3 },
    tenor: { notes: [164.81, 220, 293.66, 329.63, 246.94], brightness: 0.45 },
    bass: { notes: [98, 110, 146.83, 164.81, 123.47], brightness: 0.22 },
  };
  const cfg = profiles[profile];
  const noteLen = Math.floor(length / cfg.notes.length);

  for (let i = 0; i < length; i++) {
    const idx = Math.min(cfg.notes.length - 1, Math.floor(i / noteLen));
    const baseFreq = cfg.notes[idx];
    const t = i / sampleRate;
    const vibrato = 1 + 0.008 * Math.sin(2 * Math.PI * 5.5 * t);
    const f = baseFreq * vibrato;
    const localT = (i % noteLen) / noteLen;
    const env = Math.sin(Math.PI * Math.min(1, localT)) * 0.45;
    const fundamental = Math.sin(2 * Math.PI * f * t);
    const h2 = 0.4 * Math.sin(2 * Math.PI * f * 2 * t);
    const h3 = cfg.brightness * Math.sin(2 * Math.PI * f * 3 * t);
    const h4 = cfg.brightness * 0.45 * Math.sin(2 * Math.PI * f * 4 * t);
    samples[i] = env * (fundamental + h2 + h3 + h4) * 0.5;
  }

  return { samples, sampleRate };
}

export const sharedAudioEngine = new CantusAudioEngine();
