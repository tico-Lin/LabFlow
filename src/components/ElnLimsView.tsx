// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useEffect, useState } from 'react';

export const ElnLimsView: React.FC = () => {
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNoteIdx, setSelectedNoteIdx] = useState(0);
  const [draftBlockText, setDraftBlockText] = useState('');
  const [reconstructedSnap, setReconstructedSnap] = useState<any>(null);

  // LIMS & Stoichiometry
  const [samples, setSamples] = useState<any[]>([]);
  const [ancestry, setAncestry] = useState<any[]>([]);
  const [targetSample, setTargetSample] = useState('LF-20261114-ALI2-001');

  const [formula, setFormula] = useState('Fe(NO3)3·9H2O');
  const [molarity, setMolarity] = useState(0.05);
  const [volumeMl, setVolumeMl] = useState(80);
  const [purityPct, setPurityPct] = useState(98.5);
  const [stoichResult, setStoichResult] = useState<any>(null);

  // DMS COA Parser
  const [coaText, setCoaText] = useState(
    'Vendor: Uni-Onward 友和貿易\nProduct: Iron(III) nitrate nonahydrate\nCAS: 7782-61-8\nLot No: UO-2026-881\nPurity: 98.5%'
  );
  const [coaParsed, setCoaParsed] = useState<any>(null);

  const fetchNotes = async () => {
    const r = await fetch('/api/v1/notes');
    const data = await r.json();
    setNotes(data.notes ?? []);
    if (data.notes?.[0]?.blocks?.[0]) {
      setDraftBlockText(data.notes[0].blocks[data.notes[0].blocks.length - 1].content);
    }
  };

  const fetchLims = async (code: string) => {
    const r = await fetch(`/api/v1/lims/samples?ancestryOf=${encodeURIComponent(code)}`);
    const data = await r.json();
    setSamples(data.samples ?? []);
    setAncestry(data.ancestry ?? []);
  };

  const runStoichiometry = async () => {
    const r = await fetch('/api/v1/chem/stoichiometry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formula, targetMolarityMolL: molarity, volumeMl, purityPct }),
    });
    if (r.ok) setStoichResult(await r.json());
  };

  const runCoaParse = async () => {
    const r = await fetch('/api/v1/dms/parse-coa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: coaText }),
    });
    if (r.ok) setCoaParsed(await r.json());
  };

  useEffect(() => {
    fetchNotes();
    fetchLims(targetSample);
    runStoichiometry();
    runCoaParse();
  }, []);

  const currentNote = notes[selectedNoteIdx];

  const commitNoteRevision = async () => {
    if (!currentNote || !draftBlockText.trim()) return;
    const updatedBlocks = [
      ...currentNote.blocks,
      { id: `blk-${Date.now()}`, type: 'markdown', content: draftBlockText.trim() },
    ];
    const r = await fetch(`/api/v1/notes/${currentNote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: currentNote.title, blocks: updatedBlocks, authorId: 'tico0321' }),
    });
    if (r.ok) {
      await fetchNotes();
      setDraftBlockText('');
    }
  };

  const inspectRevision = async (revNum: number) => {
    if (!currentNote) return;
    const r = await fetch(`/api/v1/notes/${currentNote.id}/reconstruct/${revNum}`);
    if (r.ok) setReconstructedSnap(await r.json());
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left 7 cols: Block ELN + RFC 6902 Hash Chain Versioning */}
      <section className="space-y-4 border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {currentNote?.title ?? 'Experiment Notebook'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              RFC 6902 JSON-Patch Differential Storage · SHA-256 Chain:{' '}
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                {currentNote?.integrityValid ? 'Verified' : 'Tampered'}
              </span>
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">
            Revisions: {currentNote?.revisions?.length ?? 0}
          </span>
        </div>

        <div className="space-y-3">
          {currentNote?.blocks?.map((b: any) => (
            <div key={b.id} className="border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                {b.type} · {b.id}
              </div>
              <p className="mt-1 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                {b.content}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Append Observation Block & Commit Revision
            <textarea
              rows={2}
              value={draftBlockText}
              onChange={(e) => setDraftBlockText(e.target.value)}
              placeholder="Enter new experimental observation or [[WikiLink]]..."
              className="mt-1.5 block w-full border border-slate-300 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <button
            type="button"
            onClick={commitNoteRevision}
            className="bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            Commit RFC 6902 Revision
          </button>
        </div>

        {/* Revision History Chain */}
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            SHA-256 Revision History (Time-Travel Reconstruction)
          </h3>
          <div className="mt-2 space-y-1.5">
            {currentNote?.revisions?.map((rev: any) => (
              <div
                key={rev.revisionNumber}
                className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
              >
                <div className="font-mono">
                  <span className="font-semibold">Rev #{rev.revisionNumber}</span> ·{' '}
                  <span className="text-slate-500">{rev.commitHash.slice(0, 14)}…</span> ·{' '}
                  <span className="text-slate-500">{rev.patch.length} patch ops</span>
                </div>
                <button
                  type="button"
                  onClick={() => inspectRevision(rev.revisionNumber)}
                  className="border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Inspect Rev #{rev.revisionNumber}
                </button>
              </div>
            ))}
          </div>
          {reconstructedSnap && (
            <div className="mt-3 border border-cyan-300 bg-cyan-50/50 p-3 text-xs dark:border-cyan-800 dark:bg-cyan-950/30">
              <div className="font-mono font-semibold text-cyan-800 dark:text-cyan-300">
                Reconstructed Snapshot Rev #{reconstructedSnap.revisionNumber} ({reconstructedSnap.snapshot.blocks.length} blocks)
              </div>
              <div className="mt-1 text-slate-700 dark:text-slate-300">
                Latest block: {reconstructedSnap.snapshot.blocks[reconstructedSnap.snapshot.blocks.length - 1]?.content}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Right 5 cols: LIMS Sample Lineage DAG + Hydrothermal Stoichiometry + DMS COA */}
      <aside className="space-y-4 lg:col-span-5">
        <div className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              LIMS Sample Lineage DAG
            </h3>
            <select
              aria-label="Target sample ancestry"
              value={targetSample}
              onChange={(e) => {
                setTargetSample(e.target.value);
                fetchLims(e.target.value);
              }}
              className="border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
            >
              {samples.map((s) => (
                <option key={s.sampleCode} value={s.sampleCode}>
                  {s.sampleCode}
                </option>
              ))}
            </select>
          </div>
          <ol className="mt-3 space-y-2">
            {ancestry.map((node, idx) => (
              <li key={node.sampleCode} className="border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950">
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {idx + 1}. {node.sampleCode} — {node.name}
                </div>
                <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                  {node.protocolSummary} {node.facilityBeamline ? `· ${node.facilityBeamline}` : ''}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Hydrothermal Stoichiometry Calculator
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
            <label className="col-span-2 block">
              Chemical Formula (Hydrates supported)
              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                className="mt-1 block w-full border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block">
              Molarity (M)
              <input
                type="number"
                step="0.01"
                value={molarity}
                onChange={(e) => setMolarity(parseFloat(e.target.value) || 0.05)}
                className="mt-1 block w-full border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block">
              Autoclave Vol (mL)
              <input
                type="number"
                value={volumeMl}
                onChange={(e) => setVolumeMl(parseFloat(e.target.value) || 80)}
                className="mt-1 block w-full border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block">
              Purity (%)
              <input
                type="number"
                step="0.1"
                value={purityPct}
                onChange={(e) => setPurityPct(parseFloat(e.target.value) || 98.5)}
                className="mt-1 block w-full border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={runStoichiometry}
                className="w-full bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
              >
                Compute Mass
              </button>
            </div>
          </div>
          {stoichResult && (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-2.5 font-mono text-xs dark:border-slate-800">
              <div>MW: <span className="font-semibold">{stoichResult.molarMassGmol} g/mol</span></div>
              <div>Weigh: <span className="font-semibold text-blue-600 dark:text-blue-400">{stoichResult.actualWeighMassMg} mg</span></div>
            </div>
          )}
        </div>

        <div className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            DMS COA / Vendor OCR Extractor
          </h3>
          <textarea
            rows={3}
            aria-label="COA document text"
            value={coaText}
            onChange={(e) => setCoaText(e.target.value)}
            className="mt-2 block w-full border border-slate-300 bg-slate-50 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="button"
            onClick={runCoaParse}
            className="mt-2 border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Extract CAS & SHA-256 Hash
          </button>
          {coaParsed && (
            <div className="mt-2 space-y-1 font-mono text-xs text-slate-600 dark:text-slate-400">
              <div>Vendor: {coaParsed.vendor} · CAS: {coaParsed.casNumber}</div>
              <div>Lot: {coaParsed.lotNumber} · Purity: {coaParsed.purityPct}%</div>
              <div className="truncate">CAS SHA-256: {coaParsed.sha256}</div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
