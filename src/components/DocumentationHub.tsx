import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import {
  DOCUMENTATION_SECTIONS,
  DocSection,
  generateFullDocumentationMarkdown,
} from '../data/documentation';

const CATEGORIES: Array<'All' | DocSection['category']> = [
  'All',
  'Architecture',
  'Bus Chains',
  'Plugin Manuals',
  'AI Composer',
  'Voice Analyzer',
  'Collaboration & API',
];

export const DocumentationHub: React.FC = () => {
  const [category, setCategory] = useState<'All' | DocSection['category']>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOCUMENTATION_SECTIONS.filter((sec) => {
      if (category !== 'All' && sec.category !== category) return false;
      if (!q) return true;
      const inTable =
        sec.table?.rows.some((r) => r.some((cell) => cell.toLowerCase().includes(q))) ?? false;
      return (
        sec.title.toLowerCase().includes(q) ||
        sec.subtitle.toLowerCase().includes(q) ||
        sec.body.toLowerCase().includes(q) ||
        (sec.codeBlock?.toLowerCase().includes(q) ?? false) ||
        inTable
      );
    });
  }, [category, query]);

  const handleDownloadMarkdown = () => {
    const md = generateFullDocumentationMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cantus-studio-documentation.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Documentation Header & Filter Toolbar */}
      <section className="bg-[#15181F] border border-[#272C38] rounded-lg p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
              Complete Platform &amp; Audio Engineering Documentation
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1 leading-relaxed">
              Full technical reference for Cantus Studio: signal routing topology, all 8 choral/soloist/master bus chains, individual manuals for all 13 audio plugins, AI Song Studio prompting, Voice Analyzer DSP acoustics, and WebSocket collaboration API.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-amber-500 text-[#0E1014] hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Full Docs (.md)
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#222733]">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Documentation categories">
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-[#0E1014]'
                      : 'bg-[#1C2029] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="doc-search" className="sr-only">
              Search documentation
            </label>
            <input
              id="doc-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins, buses, or APIs..."
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#0E1014] border border-[#272C38] text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </section>

      {/* Sections List */}
      {filtered.length === 0 ? (
        <div className="bg-[#15181F] border border-[#272C38] rounded-lg p-8 text-center">
          <p className="text-sm text-[#94A3B8]">
            No documentation sections match &ldquo;{query}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('All');
            }}
            className="mt-3 px-4 py-1.5 rounded-md text-xs font-medium bg-[#1C2029] text-[#E2E8F0] hover:text-white cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {filtered.map((sec) => (
            <article
              key={sec.id}
              className="bg-[#15181F] border border-[#272C38] rounded-lg p-6 flex flex-col gap-4"
            >
              <div>
                <div className="text-xs font-mono text-amber-400">{sec.category}</div>
                <h2 className="text-lg font-semibold text-[#F1F5F9] mt-1">{sec.title}</h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">{sec.subtitle}</p>
              </div>

              <p className="text-sm text-[#CBD5E1] leading-relaxed max-w-4xl">{sec.body}</p>

              {sec.codeBlock && (
                <pre className="bg-[#0B0D11] border border-[#222733] rounded-md p-4 text-xs font-mono text-[#E2E8F0] overflow-x-auto leading-relaxed">
                  {sec.codeBlock}
                </pre>
              )}

              {sec.table && (
                <div className="overflow-x-auto border border-[#222733] rounded-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#101319] border-b border-[#222733]">
                        {sec.table.headers.map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 font-semibold text-[#E2E8F0] whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E232E]">
                      {sec.table.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#191D27]/60">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={`px-4 py-2.5 ${
                                cIdx === 0 || cIdx === 1
                                  ? 'font-medium text-[#F1F5F9]'
                                  : 'text-[#94A3B8]'
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
