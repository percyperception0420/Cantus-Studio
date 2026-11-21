/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { useStudioSocket } from './hooks/useStudioSocket';
import { DawWorkspace } from './components/DawWorkspace';
import { AiSongStudio } from './components/AiSongStudio';
import { VoiceAnalyzer } from './components/VoiceAnalyzer';
import { CollaborationHub } from './components/CollaborationHub';
import { DocumentationHub } from './components/DocumentationHub';
import { AiSong, BusId, VoicePluginRecommendation } from './types/studio';

type WorkspaceTab = 'daw' | 'ai-studio' | 'voice' | 'collaborate' | 'docs';

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'daw', label: 'DAW & Mixer' },
  { id: 'ai-studio', label: 'AI Song Studio' },
  { id: 'voice', label: 'Voice Analyzer' },
  { id: 'collaborate', label: 'Collaborate' },
  { id: 'docs', label: 'Documentation' },
];

export default function App() {
  const {
    roomId,
    localUser,
    studio,
    collaborators,
    connectionStatus,
    switchRoom,
    updateUserProfile,
    updateBus,
    updatePlugin,
    updateTrack,
    loadSongIntoDaw,
    updateProjectMeta,
    sendMixNote,
    updatePresence,
  } = useStudioSocket();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('daw');
  const [selectedBusId, setSelectedBusId] = useState<BusId>('soloist-bus');
  const [selectedPluginId, setSelectedPluginId] = useState<string>(
    'soloist-bus-0-black-box-hg-2'
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    updatePresence(activeTab, selectedBusId);
  }, [activeTab, selectedBusId, updatePresence]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleSelectPlugin = (busId: BusId, pluginId: string) => {
    setSelectedBusId(busId);
    setSelectedPluginId(pluginId);
  };

  const handleLoadSongToDaw = (song: AiSong) => {
    loadSongIntoDaw(song);
    setActiveTab('daw');
    showToast(`Loaded "${song.title}" (${song.bpm} BPM, ${song.musicalKey}) into DAW timeline.`);
  };

  const handleApplyVocalChain = (
    recs: VoicePluginRecommendation[],
    voiceLabel: string
  ) => {
    for (const rec of recs) {
      const bus = studio.buses[rec.busId];
      const plugin = bus?.plugins.find((p) => p.typeId === rec.pluginTypeId);
      if (plugin) {
        updatePlugin(rec.busId, plugin.id, {
          bypassed: false,
          params: rec.suggestedParams,
        });
      }
    }
    showToast(`Tuned Soloist & Section buses for ${voiceLabel}.`);
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`
      : `?room=${roomId}`;

  return (
    <div className="min-h-screen bg-[#0E1014] text-[#F1F5F9] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#0E1014]/95 backdrop-blur border-b border-[#222733] px-4 sm:px-6 py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('daw')}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-[#F1F5F9] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cantus Studio
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav
            aria-label="Primary workspaces"
            className="flex items-center gap-4 sm:gap-6 overflow-x-auto text-xs sm:text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`py-1 border-b-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:text-amber-300 ${
                    active
                      ? 'border-amber-500 text-[#F1F5F9]'
                      : 'border-transparent text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="px-3 sm:px-4 py-2 rounded-md text-xs font-semibold bg-amber-500 text-[#0E1014] hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Share Session
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Canvas */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 py-6">
        {activeTab === 'daw' && (
          <DawWorkspace
            studio={studio}
            selectedBusId={selectedBusId}
            selectedPluginId={selectedPluginId}
            onSelectPlugin={handleSelectPlugin}
            onUpdateBus={updateBus}
            onUpdatePlugin={updatePlugin}
            onUpdateTrack={updateTrack}
            onUpdateMeta={updateProjectMeta}
          />
        )}

        {activeTab === 'ai-studio' && (
          <AiSongStudio
            songs={studio.savedSongs}
            buses={studio.buses}
            onSongCreated={(song) => {
              loadSongIntoDaw(song);
              showToast(`Composed "${song.title}" and added to Studio Arrangements.`);
            }}
            onLoadToDaw={handleLoadSongToDaw}
          />
        )}

        {activeTab === 'voice' && (
          <VoiceAnalyzer onApplyVocalChain={handleApplyVocalChain} />
        )}

        {activeTab === 'collaborate' && (
          <CollaborationHub
            roomId={roomId}
            connectionStatus={connectionStatus}
            localUser={localUser}
            collaborators={collaborators}
            studio={studio}
            onSwitchRoom={switchRoom}
            onUpdateProfile={updateUserProfile}
            onSendMessage={sendMixNote}
          />
        )}

        {activeTab === 'docs' && <DocumentationHub />}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[#1D222D] px-6 py-4 text-xs text-[#64748B]">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <span>Cantus Studio — Choral &amp; Vocal Production Platform</span>
          <span>
            Room: <span className="font-mono text-[#94A3B8]">{roomId}</span> · {collaborators.length} active collaborator{collaborators.length === 1 ? '' : 's'}
          </span>
        </div>
      </footer>

      {/* Share Session Modal (opens only when user clicks Share Session) */}
      {shareOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-dialog-title"
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div className="bg-[#15181F] border border-[#272C38] rounded-lg max-w-md w-full p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 id="share-dialog-title" className="text-base font-semibold text-[#F1F5F9]">
                Invite Collaborators to Room
              </h2>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                aria-label="Close share dialog"
                className="p-1 text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Share this session link so singers, arrangers, and mix engineers can join room{' '}
              <span className="font-mono text-[#F1F5F9]">{roomId}</span> and edit buses, plugins, and mix notes in real time.
            </p>

            <div className="flex items-center gap-2 bg-[#0E1014] border border-[#272C38] rounded-md p-2.5">
              <span className="text-xs font-mono text-[#CBD5E1] truncate flex-1">{shareUrl}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopiedShare(true);
                    window.setTimeout(() => setCopiedShare(false), 2000);
                  } catch {
                    // ignore
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-amber-500 text-[#0E1014] hover:bg-amber-400 whitespace-nowrap cursor-pointer"
              >
                {copiedShare ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedShare ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShareOpen(false);
                  setActiveTab('collaborate');
                }}
                className="px-3.5 py-2 rounded-md text-xs font-medium bg-[#1C2029] text-[#E2E8F0] hover:text-white cursor-pointer"
              >
                Open Collaboration Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transient Confirmation Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-40 bg-[#181C25] border border-amber-500/50 text-[#F1F5F9] text-xs px-4 py-2.5 rounded-md shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
