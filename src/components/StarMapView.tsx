// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useEffect, useState } from 'react';

export const StarMapView: React.FC = () => {
  const [graph, setGraph] = useState<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('note-ali2-01');
  const [ragQuery, setRagQuery] = useState('TPS 19A Al-I2 Dunn');
  const [ragResults, setRagResults] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/v1/starmap/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.json())
      .then(setGraph);

    runRag('TPS 19A Al-I2 Dunn');
  }, []);

  const runRag = async (q: string) => {
    const r = await fetch('/api/v1/rag/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    });
    const data = await r.json();
    setRagResults(data.results ?? []);
  };

  const selectedNode = graph?.nodes?.find((n: any) => n.id === selectedNodeId);
  const backlinkIds: string[] = graph?.backlinks?.[selectedNodeId] ?? [];

  const kindColor = (kind: string) => {
    if (kind === 'note') return '#2563eb';
    if (kind === 'sample') return '#0891b2';
    if (kind === 'spectrum') return '#d97706';
    return '#475569';
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Zotero · Obsidian · ELN Knowledge Star Map
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fruchterman-Reingold force layout · Bidirectional [[WikiLink]] graph · PageRank centrality
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Blue: Note</span>
            <span>Cyan: Sample</span>
            <span>Amber: Spectrum</span>
            <span>Slate: Zotero</span>
          </div>
        </div>

        {graph && (
          <svg
            viewBox="0 0 760 460"
            className="mt-3 w-full border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
          >
            {graph.edges.map((e: any, idx: number) => {
              const u = graph.nodes.find((n: any) => n.id === e.source);
              const v = graph.nodes.find((n: any) => n.id === e.target);
              if (!u || !v) return null;
              const isHighlighted = u.id === selectedNodeId || v.id === selectedNodeId;
              return (
                <line
                  key={idx}
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke={isHighlighted ? '#2563eb' : '#94a3b8'}
                  strokeOpacity={isHighlighted ? 0.9 : 0.45}
                  strokeWidth={isHighlighted ? 2 : 1.2}
                />
              );
            })}
            {graph.nodes.map((n: any) => {
              const selected = n.id === selectedNodeId;
              const radius = 12 + n.pageRank * 36;
              return (
                <g
                  key={n.id}
                  onClick={() => setSelectedNodeId(n.id)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={radius}
                    fill={kindColor(n.kind)}
                    stroke={selected ? '#0f172a' : '#ffffff'}
                    strokeWidth={selected ? 2.5 : 1.5}
                  />
                  <text
                    x={n.x}
                    y={n.y + radius + 14}
                    textAnchor="middle"
                    className="fill-slate-800 text-[11px] font-medium dark:fill-slate-200"
                  >
                    {n.title}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <aside className="space-y-4 lg:col-span-4">
        <div className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Node & Backlinks Inspector
          </h3>
          {selectedNode ? (
            <div className="mt-3 space-y-2 text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedNode.title}</div>
              <div className="font-mono text-slate-500">
                Type: {selectedNode.kind} · PageRank: {selectedNode.pageRank}
              </div>
              <p className="text-slate-700 dark:text-slate-300">{selectedNode.text}</p>
              <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
                <div className="font-medium text-slate-600 dark:text-slate-400">
                  Incoming Backlinks ({backlinkIds.length}):
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {backlinkIds.map((bid) => {
                    const bNode = graph.nodes.find((x: any) => x.id === bid);
                    return (
                      <button
                        key={bid}
                        type="button"
                        onClick={() => setSelectedNodeId(bid)}
                        className="border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        {bNode?.title ?? bid}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Select a node in the star map.</p>
          )}
        </div>

        <div className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Hybrid Scientific RAG (BM25 + RRF)
          </h3>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              aria-label="Hybrid RAG Search Query"
              value={ragQuery}
              onChange={(e) => setRagQuery(e.target.value)}
              className="flex-1 border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="button"
              onClick={() => runRag(ragQuery)}
              className="bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Search
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {ragResults.map((r, i) => (
              <div key={r.id} className="border border-slate-200 p-2.5 text-xs dark:border-slate-800">
                <div className="flex justify-between font-medium">
                  <span>{i + 1}. {r.title}</span>
                  <span className="font-mono text-cyan-700 dark:text-cyan-400">RRF {r.rrfScore}</span>
                </div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};
