import React from 'react';
import { Power, RotateCcw } from 'lucide-react';
import { PLUGIN_DEFINITIONS, formatParamValue } from '../audio/pluginCatalog';
import { BusChannel, PluginInstance } from '../types/studio';

interface PluginInspectorProps {
  bus: BusChannel;
  plugin: PluginInstance;
  onUpdatePlugin: (patch: { bypassed?: boolean; params?: Record<string, number> }) => void;
}

/**
 * Renders a crisp, domain-authentic visual curve tailored to the active plugin's DSP class
 * (EQ curve, Saturation harmonic transfer, Compression knee, Reverb decay, or Stereo M/S scope).
 */
function PluginCurveDisplay({ plugin }: { plugin: PluginInstance }) {
  const def = PLUGIN_DEFINITIONS[plugin.typeId];
  const p = plugin.params;
  const accent = plugin.bypassed ? '#475569' : def.accentHex;

  if (
    plugin.typeId === 'fabfilter-pro-q-3' ||
    plugin.typeId === 'rule-tec-eq1a' ||
    plugin.typeId === 'rule-tec-eq5m'
  ) {
    // Generate smooth 20Hz -> 20kHz EQ transfer curve
    const points: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const freq = 20 * Math.pow(1000, t);
      let db = 0;

      if (plugin.typeId === 'fabfilter-pro-q-3') {
        const hpf = p.hpfFreq ?? 80;
        if (freq < hpf) {
          db -= Math.min(18, 12 * Math.log2(hpf / Math.max(20, freq)));
        }
        const lowDist = Math.log2(freq / 220);
        db += (p.lowGain ?? 0) * Math.exp(-(lowDist * lowDist) / 0.45);
        const midDist = Math.log2(freq / (p.midFreq ?? 1800));
        db += (p.midGain ?? 0) * Math.exp(-(midDist * midDist) / 0.35);
        if (freq > 4500) {
          const shelfAmt = Math.min(1, Math.log2(freq / 4500) / 1.5);
          db += (p.highShelf ?? 0) * shelfAmt;
        }
      } else if (plugin.typeId === 'rule-tec-eq1a') {
        const lowFreqs = [20, 30, 60, 100];
        const highFreqs = [3000, 5000, 8000, 10000, 16000];
        const lf = lowFreqs[Math.round(p.lowFreq ?? 2)] ?? 60;
        const hf = highFreqs[Math.round(p.highFreq ?? 3)] ?? 10000;
        const lowShelfAmt = 1 / (1 + Math.pow(freq / (lf * 1.4), 2));
        db += (p.lowBoost ?? 0) * 0.9 * lowShelfAmt;
        const attenDist = Math.log2(freq / (lf * 2.3));
        db -= (p.lowAtten ?? 0) * 0.7 * Math.exp(-(attenDist * attenDist) / 0.5);
        const hiDist = Math.log2(freq / hf);
        const bw = 0.25 + (p.bandwidth ?? 5) * 0.08;
        db += (p.highBoost ?? 0) * 0.85 * Math.exp(-(hiDist * hiDist) / bw);
        if (freq > 9000) {
          db -= (p.highAtten ?? 0) * 0.5 * Math.min(1, Math.log2(freq / 9000));
        }
      } else {
        const lpFreqs = [200, 300, 500, 700];
        const dipFreqs = [300, 500, 1000, 2000, 4000];
        const hpFreqs = [1500, 2000, 3000, 4000];
        const f1 = lpFreqs[Math.round(p.lowPeakFreq ?? 1)] ?? 300;
        const f2 = dipFreqs[Math.round(p.dipFreq ?? 1)] ?? 500;
        const f3 = hpFreqs[Math.round(p.highPeakFreq ?? 2)] ?? 3000;
        const d1 = Math.log2(freq / f1);
        const d2 = Math.log2(freq / f2);
        const d3 = Math.log2(freq / f3);
        db += (p.lowPeakGain ?? 0) * 0.75 * Math.exp(-(d1 * d1) / 0.45);
        db -= (p.dipAtten ?? 0) * 0.8 * Math.exp(-(d2 * d2) / 0.4);
        db += (p.highPeakGain ?? 0) * 0.75 * Math.exp(-(d3 * d3) / 0.45);
      }

      const x = 12 + t * 376;
      const y = 60 - Math.max(-14, Math.min(14, db)) * 3.2;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return (
      <svg viewBox="0 0 400 120" className="w-full h-28 rounded bg-[#0B0D11] border border-[#222733]" aria-label={`${plugin.name} frequency response graph`}>
        {[30, 60, 90].map((y) => (
          <line key={y} x1="12" y1={y} x2="388" y2={y} stroke="#1F2430" strokeWidth="1" strokeDasharray={y === 60 ? '0' : '3 3'} />
        ))}
        {[80, 160, 240, 320].map((x) => (
          <line key={x} x1={x} y1="10" x2={x} y2="110" stroke="#181C26" strokeWidth="1" />
        ))}
        <polyline fill="none" stroke={accent} strokeWidth="2.2" points={points.join(' ')} />
        <text x="16" y="112" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono">30 Hz</text>
        <text x="112" y="112" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono">200 Hz</text>
        <text x="210" y="112" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono">1 kHz</text>
        <text x="344" y="112" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono">16 kHz</text>
      </svg>
    );
  }

  if (
    plugin.typeId === 'fabfilter-saturn-2' ||
    plugin.typeId === 'black-box-hg-2' ||
    plugin.typeId === 'ozone-12-vintage-tape'
  ) {
    const drive =
      plugin.typeId === 'fabfilter-saturn-2'
        ? (p.drive ?? 22) / 100
        : plugin.typeId === 'black-box-hg-2'
          ? ((p.pentode ?? 36) + (p.triode ?? 42) + (p.saturation ?? 30)) / 300
          : (p.inputDrive ?? 2.6) / 12;

    const pts: string[] = [];
    for (let i = 0; i <= 50; i++) {
      const xNorm = (i / 50) * 2 - 1;
      const yNorm = Math.tanh(xNorm * (1 + drive * 3.2));
      const x = 40 + (i / 50) * 320;
      const y = 60 - yNorm * 44;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return (
      <svg viewBox="0 0 400 120" className="w-full h-28 rounded bg-[#0B0D11] border border-[#222733]" aria-label={`${plugin.name} harmonic transfer curve`}>
        <line x1="40" y1="60" x2="360" y2="60" stroke="#1F2430" strokeWidth="1" />
        <line x1="200" y1="12" x2="200" y2="108" stroke="#1F2430" strokeWidth="1" />
        <line x1="40" y1="104" x2="360" y2="16" stroke="#252B39" strokeWidth="1" strokeDasharray="4 4" />
        <polyline fill="none" stroke={accent} strokeWidth="2.4" points={pts.join(' ')} />
        <text x="14" y="20" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono">Harmonic Transfer</text>
        <text x="305" y="110" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">Drive {(drive * 100).toFixed(0)}%</text>
      </svg>
    );
  }

  if (plugin.typeId === 'a1-stereo-control') {
    const widthPct = p.width ?? 112;
    const spread = Math.min(140, (widthPct / 200) * 140);
    const safeBass = p.safeBassFreq ?? 130;
    const safeOn = (p.safeBassOn ?? 1) >= 0.5;
    return (
      <svg viewBox="0 0 400 120" className="w-full h-28 rounded bg-[#0B0D11] border border-[#222733]" aria-label="A1StereoControl stereo field display">
        <line x1="200" y1="14" x2="200" y2="106" stroke="#1F2430" strokeWidth="1" />
        <ellipse cx="200" cy="60" rx={Math.max(10, spread)} ry="34" fill={`${accent}18`} stroke={accent} strokeWidth="1.8" />
        {safeOn && <line x1="200" y1="36" x2="200" y2="84" stroke="#22C55E" strokeWidth="3" />}
        <text x="16" y="20" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">M/S Width: {widthPct}%</text>
        <text x="250" y="20" fill={safeOn ? '#22C55E' : '#64748B'} fontSize="9" fontFamily="JetBrains Mono">
          Safe Bass: {safeOn ? `<${safeBass} Hz Mono` : 'Off'}
        </text>
      </svg>
    );
  }

  if (plugin.typeId === 'valhalla-vintage-verb') {
    const decay = p.decay ?? 2.2;
    const predelay = p.predelay ?? 28;
    const preX = 24 + (predelay / 120) * 56;
    const tailLen = Math.min(295, (decay / 6) * 295);
    const pts = [`24,102`, `${preX.toFixed(1)},102`, `${preX.toFixed(1)},24`];
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      const x = preX + t * tailLen;
      const y = 102 - 78 * Math.pow(1 - t, 2.2);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return (
      <svg viewBox="0 0 400 120" className="w-full h-28 rounded bg-[#0B0D11] border border-[#222733]" aria-label="ValhallaVintageVerb decay envelope">
        <line x1="24" y1="102" x2="380" y2="102" stroke="#1F2430" strokeWidth="1" />
        <polyline fill="none" stroke={accent} strokeWidth="2.2" points={pts.join(' ')} />
        <text x="16" y="18" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">RT60: {decay.toFixed(1)}s</text>
        <text x="275" y="18" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">PreDelay: {predelay} ms</text>
      </svg>
    );
  }

  // Dynamics & Limiting transfer curve (bx_opto, MC77, SSL Bus Comp 2, Pro-MB, Pro-L 2)
  const thresholdNorm =
    plugin.typeId === 'bx-opto'
      ? 1 - (p.peakReduction ?? 38) / 115
      : plugin.typeId === 'ssl-bus-comp-2'
        ? 1 + (p.threshold ?? -14) / 36
        : plugin.typeId === 'mc77'
          ? 0.65 - (p.input ?? 6) / 60
          : plugin.typeId === 'fabfilter-pro-l-2'
            ? 0.72 - (p.gain ?? 3.8) / 40
            : 0.55;
  const kneeX = 40 + Math.max(0.2, Math.min(0.85, thresholdNorm)) * 300;
  const kneeY = 104 - Math.max(0.2, Math.min(0.85, thresholdNorm)) * 84;
  const endY = plugin.typeId === 'fabfilter-pro-l-2' ? kneeY : Math.max(18, kneeY - 18);

  return (
    <svg viewBox="0 0 400 120" className="w-full h-28 rounded bg-[#0B0D11] border border-[#222733]" aria-label={`${plugin.name} dynamics transfer curve`}>
      <line x1="40" y1="104" x2="340" y2="20" stroke="#252B39" strokeWidth="1" strokeDasharray="4 4" />
      <polyline fill="none" stroke={accent} strokeWidth="2.4" points={`40,104 ${kneeX.toFixed(1)},${kneeY.toFixed(1)} 340,${endY.toFixed(1)}`} />
      <circle cx={kneeX} cy={kneeY} r="4" fill={accent} />
      <text x="16" y="18" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">
        {plugin.typeId === 'fabfilter-pro-l-2'
          ? `Brickwall Ceiling: ${(p.ceiling ?? -1).toFixed(1)} dBTP`
          : `${def.shortTag} Dynamics Transfer`}
      </text>
    </svg>
  );
}

export const PluginInspector: React.FC<PluginInspectorProps> = ({
  bus,
  plugin,
  onUpdatePlugin,
}) => {
  const def = PLUGIN_DEFINITIONS[plugin.typeId];

  const handleReset = () => {
    const defaults: Record<string, number> = {};
    for (const spec of def.params) {
      defaults[spec.key] = spec.defaultValue;
    }
    onUpdatePlugin({ bypassed: false, params: defaults });
  };

  return (
    <section
      aria-label={`Plugin Inspector: ${plugin.name}`}
      className="bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#272C38] pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-mono">
            <span>{bus.name}</span>
            <span aria-hidden="true">/</span>
            <span>{def.vendor}</span>
            <span aria-hidden="true">·</span>
            <span>{def.category}</span>
          </div>
          <h3 className="text-lg font-semibold text-[#F1F5F9] mt-1 tracking-tight">
            {plugin.name}
          </h3>
          <p className="text-sm text-[#94A3B8] mt-1 max-w-2xl leading-relaxed">
            {def.summary}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onUpdatePlugin({ bypassed: !plugin.bypassed })}
            aria-pressed={!plugin.bypassed}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
              plugin.bypassed
                ? 'bg-[#1C2029] text-[#94A3B8] border-[#2E3444] hover:text-white'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {plugin.bypassed ? 'Bypassed' : 'Active'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#1C2029] text-[#CBD5E1] border border-[#2E3444] hover:border-[#475569] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      <PluginCurveDisplay plugin={plugin} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {def.params.map((spec) => {
          const val = plugin.params[spec.key] ?? spec.defaultValue;
          const controlId = `param-${plugin.id}-${spec.key}`;
          return (
            <div
              key={spec.key}
              className="bg-[#11141A] border border-[#222733] rounded-md p-3 flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={controlId} className="text-xs font-medium text-[#E2E8F0]">
                  {spec.label}
                </label>
                <span className="text-xs font-mono tabular-nums text-amber-400">
                  {formatParamValue(spec, val)}
                </span>
              </div>

              {spec.options ? (
                <div className="flex flex-wrap gap-1 mt-1" role="group" aria-label={spec.label}>
                  {spec.options.map((opt, idx) => {
                    const active = Math.round(val) === idx;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onUpdatePlugin({ params: { [spec.key]: idx } })}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-amber-500 text-[#0E1014]'
                            : 'bg-[#1C2029] text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  id={controlId}
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={val}
                  onChange={(e) =>
                    onUpdatePlugin({ params: { [spec.key]: parseFloat(e.target.value) } })
                  }
                  className="w-full h-1.5 bg-[#272C38] rounded-lg appearance-none cursor-pointer"
                />
              )}

              <p className="text-[11px] text-[#64748B] leading-snug">{spec.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
