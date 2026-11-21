import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Download,
  Sliders,
  Volume2,
  VolumeX,
  ArrowRight,
  Power,
} from 'lucide-react';
import { BUS_ORDER, PLUGIN_DEFINITIONS } from '../audio/pluginCatalog';
import { sharedAudioEngine } from '../audio/dspEngine';
import { BusChannel, BusId, DawTrack, StudioState } from '../types/studio';
import { PluginInspector } from './PluginInspector';

interface DawWorkspaceProps {
  studio: StudioState;
  selectedBusId: BusId;
  selectedPluginId: string;
  onSelectPlugin: (busId: BusId, pluginId: string) => void;
  onUpdateBus: (
    busId: BusId,
    patch: Partial<Pick<BusChannel, 'volumeDb' | 'pan' | 'muted' | 'soloed'>>
  ) => void;
  onUpdatePlugin: (
    busId: BusId,
    pluginId: string,
    patch: { bypassed?: boolean; params?: Record<string, number> }
  ) => void;
  onUpdateTrack: (
    trackId: string,
    patch: Partial<Pick<DawTrack, 'muted' | 'soloed' | 'gainDb'>>
  ) => void;
  onUpdateMeta: (patch: { bpm?: number; musicalKey?: string }) => void;
}

const MUSICAL_KEYS = [
  'C Major',
  'Eb Major',
  'F Major',
  'G Major',
  'Bb Major',
  'A Minor',
  'C Minor',
  'D Minor',
  'E Minor',
];

export const DawWorkspace: React.FC<DawWorkspaceProps> = ({
  studio,
  selectedBusId,
  selectedPluginId,
  onSelectPlugin,
  onUpdateBus,
  onUpdatePlugin,
  onUpdateTrack,
  onUpdateMeta,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [busLevels, setBusLevels] = useState<Partial<Record<BusId, number>>>({});
  const [isExporting, setIsExporting] = useState(false);

  // Keep Web Audio engine synchronized with studio buses & tracks
  useEffect(() => {
    sharedAudioEngine.updateTransportMeta(studio.tracks, studio.bpm, studio.totalBeats);
    sharedAudioEngine.syncBuses(studio.buses);
  }, [studio.buses, studio.tracks, studio.bpm, studio.totalBeats]);

  useEffect(() => {
    const unsub = sharedAudioEngine.onBeat((beat, playing) => {
      setCurrentBeat(beat);
      setIsPlaying(playing);
    });
    return () => unsub();
  }, []);

  // Poll live audio peak meters only while playing
  useEffect(() => {
    if (!isPlaying) {
      setBusLevels({});
      return;
    }
    const id = window.setInterval(() => {
      setBusLevels(sharedAudioEngine.getBusLevels());
    }, 80);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      sharedAudioEngine.pause();
    } else {
      sharedAudioEngine.init(studio.buses, studio.tracks, studio.bpm, studio.totalBeats);
      await sharedAudioEngine.play();
    }
  };

  const handleStop = () => {
    sharedAudioEngine.stop();
  };

  const handleExportWav = async () => {
    try {
      setIsExporting(true);
      sharedAudioEngine.init(studio.buses, studio.tracks, studio.bpm, studio.totalBeats);
      const blob = await sharedAudioEngine.renderMixToWavBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${studio.projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-mixdown.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const activeBus = studio.buses[selectedBusId] ?? studio.buses['soloist-bus'];
  const activePlugin =
    activeBus.plugins.find((p) => p.id === selectedPluginId) ?? activeBus.plugins[0];

  const barNum = Math.floor(currentBeat / 4) + 1;
  const beatNum = Math.floor(currentBeat % 4) + 1;
  const subBeat = Math.floor((currentBeat % 1) * 4) + 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Transport & Project Control Bar */}
      <section
        aria-label="DAW Transport Controls"
        className="bg-[#15181F] border border-[#272C38] rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label={isPlaying ? 'Pause playback' : 'Play arrangement'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-amber-500 text-[#0E1014] hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play Mix'}
          </button>

          <button
            type="button"
            onClick={handleStop}
            aria-label="Stop playback and return to Bar 1"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-[#1C2029] text-[#CBD5E1] border border-[#2E3444] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>

          <div
            className="px-3 py-1.5 rounded bg-[#0B0D11] border border-[#222733] font-mono tabular-nums text-sm text-amber-400 tracking-wider"
            aria-label="Playhead position"
          >
            {String(barNum).padStart(2, '0')}:{beatNum}:{subBeat}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#64748B]">Arrangement:</span>
            <span className="font-semibold text-[#F1F5F9]">{studio.projectTitle}</span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="daw-bpm" className="text-[#94A3B8]">
              Tempo
            </label>
            <input
              id="daw-bpm"
              type="number"
              min={56}
              max={180}
              value={studio.bpm}
              onChange={(e) => {
                const v = Math.max(56, Math.min(180, Number(e.target.value) || 84));
                onUpdateMeta({ bpm: v });
              }}
              className="w-16 px-2 py-1 rounded bg-[#0B0D11] border border-[#272C38] font-mono tabular-nums text-[#F1F5F9] text-center"
            />
            <span className="text-[#64748B] font-mono">BPM</span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="daw-key" className="text-[#94A3B8]">
              Key
            </label>
            <select
              id="daw-key"
              value={studio.musicalKey}
              onChange={(e) => onUpdateMeta({ musicalKey: e.target.value })}
              className="px-2.5 py-1 rounded bg-[#0B0D11] border border-[#272C38] text-[#F1F5F9] text-xs"
            >
              {MUSICAL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportWav}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#1C2029] text-[#E2E8F0] border border-[#2E3444] hover:border-amber-500/50 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'Rendering WAV...' : 'Export WAV'}
          </button>
        </div>
      </section>

      {/* Multi-Track Choral & Soloist Timeline */}
      <section
        aria-label="Multi-Track Arrangement Timeline"
        className="bg-[#15181F] border border-[#272C38] rounded-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#272C38]">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9]">Multi-Track Arrangement</h2>
            <span className="text-xs text-[#64748B] font-mono">
              {studio.tracks.length} Stems · 8 Bars · Click timeline ruler to scrub
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#94A3B8] font-mono">
            <span>SATB Sections</span>
            <ArrowRight className="w-3 h-3 text-[#64748B]" />
            <span>Choir Bus</span>
            <span aria-hidden="true">·</span>
            <span>Soloist Stem</span>
            <ArrowRight className="w-3 h-3 text-[#64748B]" />
            <span>Soloist Bus</span>
            <ArrowRight className="w-3 h-3 text-[#64748B]" />
            <span className="text-amber-400">Master Bus</span>
          </div>
        </div>

        {/* Bar Ruler */}
        <div className="grid grid-cols-[220px_1fr] border-b border-[#222733] bg-[#11141A]">
          <div className="px-4 py-2 text-[11px] font-mono text-[#64748B] border-r border-[#222733]">
            Track / Target Bus
          </div>
          <div
            className="relative grid grid-cols-8 cursor-pointer select-none"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              sharedAudioEngine.seek(ratio * studio.totalBeats);
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="px-2 py-2 text-[11px] font-mono tabular-nums text-[#64748B] border-r border-[#1E232E] last:border-r-0"
              >
                Bar {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Track Rows */}
        <div className="divide-y divide-[#1E232E]">
          {studio.tracks.map((track) => {
            const destBus = studio.buses[track.targetBus];
            return (
              <div key={track.id} className="grid grid-cols-[220px_1fr] items-stretch min-h-[54px]">
                {/* Track Header */}
                <div className="px-4 py-2.5 border-r border-[#222733] flex items-center justify-between gap-2 bg-[#13161D]">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#F1F5F9] truncate">{track.name}</div>
                    <div className="text-[11px] text-[#64748B] font-mono truncate">
                      → {destBus?.shortName ?? track.targetBus}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
                      aria-label={`Mute ${track.name}`}
                      aria-pressed={track.muted}
                      className={`w-6 h-6 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                        track.muted
                          ? 'bg-red-500/25 text-red-300 border border-red-500/40'
                          : 'bg-[#1C2029] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateTrack(track.id, { soloed: !track.soloed })}
                      aria-label={`Solo ${track.name}`}
                      aria-pressed={track.soloed}
                      className={`w-6 h-6 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                        track.soloed
                          ? 'bg-amber-500 text-[#0E1014]'
                          : 'bg-[#1C2029] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      S
                    </button>
                  </div>
                </div>

                {/* Track Note Lane */}
                <div className="relative bg-[#0E1116] overflow-hidden">
                  {/* Bar grid lines */}
                  <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="border-r border-[#181C26] last:border-r-0" />
                    ))}
                  </div>

                  {/* MIDI Note Regions */}
                  {track.notes.map((note) => {
                    const leftPct = (note.startBeat / studio.totalBeats) * 100;
                    const widthPct = Math.max(2.2, (note.durationBeats / studio.totalBeats) * 100);
                    const normalizedPitch = Math.max(0, Math.min(1, (note.pitch - 40) / 40));
                    const topPct = 14 + (1 - normalizedPitch) * 58;
                    return (
                      <div
                        key={note.id}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          top: `${topPct}%`,
                          backgroundColor: track.muted ? '#334155' : `${track.color}38`,
                          borderColor: track.muted ? '#475569' : track.color,
                        }}
                        className="absolute h-4 rounded-sm border px-1 flex items-center overflow-hidden pointer-events-none"
                      >
                        {note.lyric && (
                          <span className="text-[10px] font-medium text-[#F8FAFC] truncate">
                            {note.lyric}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Playhead */}
                  <div
                    style={{ left: `${(currentBeat / studio.totalBeats) * 100}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Full 8-Bus Routing & Plugin Rack Console */}
      <section aria-label="8-Bus Mixing Console and Plugin Insert Chains" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#F1F5F9]">
              Routing Console &amp; Full Plugin Chains
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Select any insert slot across Section Buses (SATB), Choir Bus, Soloist Stem, Soloist Bus, or Master Bus to inspect and sculpt its DSP chain.
            </p>
          </div>
          <div className="text-xs font-mono text-[#94A3B8] tabular-nums">
            8 Buses · 26 Active Insert Slots · 13 Pro Plugins
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {BUS_ORDER.map((busId) => {
            const bus = studio.buses[busId];
            const isSelectedBus = busId === selectedBusId;
            const level = busLevels[busId] ?? 0;

            return (
              <div
                key={busId}
                className={`rounded-lg border p-3.5 flex flex-col gap-3 transition-colors ${
                  isSelectedBus
                    ? 'bg-[#181C25] border-amber-500/60'
                    : 'bg-[#15181F] border-[#272C38]'
                }`}
              >
                {/* Bus Header */}
                <div className="flex items-start justify-between gap-2 border-b border-[#222733] pb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-mono font-semibold"
                        style={{ color: bus.color }}
                      >
                        {bus.shortName}
                      </span>
                      <span className="text-xs text-[#64748B] font-mono">
                        → {bus.routesTo === 'output' ? 'OUT' : studio.buses[bus.routesTo]?.shortName}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#F1F5F9] truncate mt-0.5">
                      {bus.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateBus(busId, { muted: !bus.muted })}
                      aria-label={`Mute ${bus.name}`}
                      aria-pressed={bus.muted}
                      className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                        bus.muted
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-[#1C2029] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {bus.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    {busId !== 'master-bus' && busId !== 'soloist-stem' && (
                      <button
                        type="button"
                        onClick={() => onUpdateBus(busId, { soloed: !bus.soloed })}
                        aria-label={`Solo ${bus.name}`}
                        aria-pressed={bus.soloed}
                        className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                          bus.soloed
                            ? 'bg-amber-500 text-[#0E1014]'
                            : 'bg-[#1C2029] text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        S
                      </button>
                    )}
                  </div>
                </div>

                {/* Plugin Insert Rack List */}
                <div className="flex flex-col gap-1.5 flex-1">
                  {bus.plugins.map((plugin, idx) => {
                    const def = PLUGIN_DEFINITIONS[plugin.typeId];
                    const isSelected = isSelectedBus && activePlugin?.id === plugin.id;
                    return (
                      <div
                        key={plugin.id}
                        className={`flex items-center gap-1.5 rounded border px-2 py-1.5 transition-colors ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60'
                            : 'bg-[#101319] border-[#222733] hover:border-[#363E50]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onUpdatePlugin(busId, plugin.id, { bypassed: !plugin.bypassed })
                          }
                          aria-label={`${plugin.bypassed ? 'Enable' : 'Bypass'} ${plugin.name} on ${bus.name}`}
                          className={`p-1 rounded transition-colors shrink-0 cursor-pointer ${
                            plugin.bypassed
                              ? 'text-[#475569] hover:text-[#94A3B8]'
                              : 'text-emerald-400 hover:text-emerald-300'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectPlugin(busId, plugin.id)}
                          className="flex-1 min-w-0 text-left flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span
                            className={`text-xs truncate ${
                              plugin.bypassed
                                ? 'text-[#64748B] line-through'
                                : isSelected
                                  ? 'text-amber-200 font-medium'
                                  : 'text-[#E2E8F0]'
                            }`}
                          >
                            {idx + 1}. {plugin.name}
                          </span>
                          <span className="text-[10px] font-mono text-[#64748B] shrink-0">
                            {def.category}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Bus Fader, Pan & Live Meter */}
                <div className="border-t border-[#222733] pt-2.5 flex flex-col gap-2">
                  {/* Live Peak Meter */}
                  <div className="h-1.5 w-full bg-[#0B0D11] rounded overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, Math.round(level * 100))}%` }}
                      className={`h-full transition-all duration-75 ${
                        level > 0.88 ? 'bg-red-500' : level > 0.65 ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <label htmlFor={`fader-${busId}`} className="text-[#94A3B8]">
                      Gain
                    </label>
                    <input
                      id={`fader-${busId}`}
                      type="range"
                      min={-36}
                      max={6}
                      step={0.5}
                      value={bus.volumeDb}
                      onChange={(e) =>
                        onUpdateBus(busId, { volumeDb: parseFloat(e.target.value) })
                      }
                      className="flex-1 h-1 bg-[#272C38] rounded cursor-pointer"
                    />
                    <span className="w-14 text-right font-mono tabular-nums text-[#E2E8F0]">
                      {bus.volumeDb > 0 ? `+${bus.volumeDb.toFixed(1)}` : bus.volumeDb.toFixed(1)} dB
                    </span>
                  </div>

                  {bus.group === 'section' && (
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <label htmlFor={`pan-${busId}`} className="text-[#94A3B8]">
                        Pan
                      </label>
                      <input
                        id={`pan-${busId}`}
                        type="range"
                        min={-1}
                        max={1}
                        step={0.05}
                        value={bus.pan}
                        onChange={(e) => onUpdateBus(busId, { pan: parseFloat(e.target.value) })}
                        className="flex-1 h-1 bg-[#272C38] rounded cursor-pointer"
                      />
                      <span className="w-14 text-right font-mono tabular-nums text-[#94A3B8]">
                        {Math.abs(bus.pan) < 0.03
                          ? 'Center'
                          : bus.pan < 0
                            ? `L${Math.round(Math.abs(bus.pan) * 100)}`
                            : `R${Math.round(bus.pan * 100)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active Plugin Inspector Rack */}
      {activePlugin && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Active Plugin Inspector</span>
          </div>
          <PluginInspector
            bus={activeBus}
            plugin={activePlugin}
            onUpdatePlugin={(patch) => onUpdatePlugin(activeBus.id, activePlugin.id, patch)}
          />
        </div>
      )}
    </div>
  );
};
