import React, { useState } from 'react';
import { Copy, Check, Send, Users, Radio } from 'lucide-react';
import { BUS_ORDER } from '../audio/pluginCatalog';
import { Collaborator, StudioState } from '../types/studio';

interface CollaborationHubProps {
  roomId: string;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  localUser: { id: string; name: string; role: string; color: string };
  collaborators: Collaborator[];
  studio: StudioState;
  onSwitchRoom: (roomId: string) => void;
  onUpdateProfile: (name: string, role: string) => void;
  onSendMessage: (text: string, barMarker?: number, busTag?: string) => void;
}

export const CollaborationHub: React.FC<CollaborationHubProps> = ({
  roomId,
  connectionStatus,
  localUser,
  collaborators,
  studio,
  onSwitchRoom,
  onUpdateProfile,
  onSendMessage,
}) => {
  const [roomInput, setRoomInput] = useState(roomId);
  const [nameInput, setNameInput] = useState(localUser.name);
  const [roleInput, setRoleInput] = useState(localUser.role);
  const [noteText, setNoteText] = useState('');
  const [barMarker, setBarMarker] = useState<string>('1');
  const [busTag, setBusTag] = useState<string>('Soloist Bus');
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`
      : `?room=${roomId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim()) return;
    onSwitchRoom(roomInput.trim());
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(nameInput, roleInput);
  };

  const handleSendNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    onSendMessage(noteText, Number(barMarker) || undefined, busTag || undefined);
    setNoteText('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Session Room, Profile & Active Presence */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <section
          aria-label="Live Studio Room Settings"
          className="bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-[#F1F5F9]">Real-Time Studio Room</h1>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-mono ${
                connectionStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {connectionStatus === 'connected' ? 'WebSocket Connected' : 'Connecting...'}
            </span>
          </div>

          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Every fader move, plugin parameter adjustment, bypass toggle, song load, and timestamped mix note syncs live over WebSockets to everyone in the same room.
          </p>

          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <label htmlFor="collab-room-id" className="sr-only">
              Room ID
            </label>
            <input
              id="collab-room-id"
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="studio-main"
              className="flex-1 rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-2 text-sm font-mono text-[#F1F5F9] focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-md text-xs font-semibold bg-amber-500 text-[#0E1014] hover:bg-amber-400 transition-colors whitespace-nowrap cursor-pointer"
            >
              Switch Room
            </button>
          </form>

          <div className="bg-[#0E1014] border border-[#222733] rounded-md p-3 flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-[#94A3B8] truncate">{shareUrl}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-[#1C2029] text-[#E2E8F0] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </section>

        {/* Producer Profile */}
        <section
          aria-label="Collaborator Identity"
          className="bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold text-[#F1F5F9]">Your Studio Identity</h2>
          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-name" className="text-xs text-[#94A3B8]">
                Display Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-1.5 text-sm text-[#F1F5F9]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-role" className="text-xs text-[#94A3B8]">
                Role
              </label>
              <input
                id="profile-role"
                type="text"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                className="rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-1.5 text-sm text-[#F1F5F9]"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[#1C2029] text-[#E2E8F0] border border-[#2E3444] hover:border-amber-500/50 hover:text-white transition-colors cursor-pointer"
              >
                Update Identity
              </button>
            </div>
          </form>
        </section>

        {/* Connected Collaborators */}
        <section
          aria-label="Connected Collaborators"
          className="bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F1F5F9] flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Active in Room ({collaborators.length})
            </h2>
            <span className="text-xs font-mono text-[#64748B]">{roomId}</span>
          </div>

          <div className="divide-y divide-[#222733]">
            {collaborators.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-[#F1F5F9]" style={{ color: c.color }}>
                    {c.name}
                  </span>
                  {c.id === localUser.id && <span className="text-[#64748B] ml-1.5">(You)</span>}
                  <div className="text-[#94A3B8] mt-0.5">{c.role}</div>
                </div>
                <div className="font-mono text-[#64748B] text-right">
                  <div>View: {c.activeView}</div>
                  {c.selectedBusId && <div>Bus: {c.selectedBusId}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right Column: Timestamped Mix Notes & Live Activity Log */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        <section
          aria-label="Timestamped Mix Notes and Session Chat"
          className="bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b border-[#222733] pb-3">
            <h2 className="text-sm font-semibold text-[#F1F5F9]">Timestamped Mix Notes</h2>
            <span className="text-xs font-mono text-[#64748B] tabular-nums">
              {studio.messages.length} Notes
            </span>
          </div>

          <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-1">
            {studio.messages.map((m) => (
              <div
                key={m.id}
                className="bg-[#101319] border border-[#222733] rounded-md p-3.5 flex flex-col gap-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: m.authorColor }}>
                      {m.authorName}
                    </span>
                    {m.barMarker && (
                      <span className="font-mono text-[#94A3B8]">Bar {m.barMarker}</span>
                    )}
                    {m.busTag && (
                      <span className="font-mono text-amber-400">· {m.busTag}</span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-[#E2E8F0] leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendNote} className="border-t border-[#222733] pt-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="note-bar" className="text-xs text-[#94A3B8]">
                  Bar Marker
                </label>
                <select
                  id="note-bar"
                  value={barMarker}
                  onChange={(e) => setBarMarker(e.target.value)}
                  className="rounded-md bg-[#0E1014] border border-[#272C38] px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9]"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((b) => (
                    <option key={b} value={String(b)}>
                      Bar {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="note-bus" className="text-xs text-[#94A3B8]">
                  Target Bus
                </label>
                <select
                  id="note-bus"
                  value={busTag}
                  onChange={(e) => setBusTag(e.target.value)}
                  className="rounded-md bg-[#0E1014] border border-[#272C38] px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                >
                  {BUS_ORDER.map((id) => (
                    <option key={id} value={studio.buses[id].name}>
                      {studio.buses[id].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <label htmlFor="mix-note-input" className="sr-only">
                Mix note message
              </label>
              <input
                id="mix-note-input"
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write a mix note (e.g. Lift HG-2 Air +5% on chorus soloist)..."
                className="flex-1 rounded-md bg-[#0E1014] border border-[#272C38] px-3 py-2 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-amber-500 text-[#0E1014] hover:bg-amber-400 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Post Note
              </button>
            </div>
          </form>
        </section>

        {/* Live Session Activity Feed */}
        <section
          aria-label="Live Console Activity Feed"
          className="bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold text-[#F1F5F9]">Real-Time Session Log</h2>
          <div className="divide-y divide-[#222733] max-h-[220px] overflow-y-auto">
            {studio.activity.map((ev) => (
              <div key={ev.id} className="py-2 flex items-center justify-between gap-4 text-xs">
                <span className="text-[#CBD5E1]">
                  <strong className="text-[#F1F5F9] font-medium">{ev.actor}</strong> {ev.summary}
                </span>
                <span className="font-mono text-[11px] text-[#64748B] tabular-nums shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
