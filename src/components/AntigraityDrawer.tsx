// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useState } from 'react';
import { ScientificCanvas } from './ScientificCanvas';

interface AntigraityDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const AntigraityDrawer: React.FC<AntigraityDrawerProps> = ({ open, onClose }) => {
  const [fwhm1, setFwhm1] = useState(-0.5);
  const [testOffset, setTestOffset] = useState(100);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  if (!open) return null;

  const executeTot = async () => {
    setRunning(true);
    try {
      const r = await fetch('/api/v1/antigraity/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fwhm1, fwhm2: 1.5, testOffset, testLimit: 1024 }),
      });
      setResult(await r.json());
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Antigraity Autonomous Tree-of-Thoughts & Critic Guard"
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"
    >
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Antigraity Tree-of-Thoughts & Critic Sandbox
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              MemoryBounds (`-2` OOB guard) · Physics Critic (FWHM &gt; 0, η ∈ [0,1]) · 3-retry self-healing loop
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3 border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
            <label className="block">
              Initial FWHM Proposal (eV) — test negative (-0.5) to trigger Critic prune
              <input
                type="number"
                step="0.1"
                value={fwhm1}
                onChange={(e) => setFwhm1(parseFloat(e.target.value))}
                className="mt-1 block w-full border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="block">
              Arena Write Offset (Limit 1024 B, size 128 B)
              <input
                type="number"
                step="64"
                value={testOffset}
                onChange={(e) => setTestOffset(parseInt(e.target.value, 10) || 0)}
                className="mt-1 block w-full border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={executeTot}
                disabled={running}
                className="bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {running ? 'Running ToT Search...' : 'Execute ToT & Critic Verification'}
              </button>
            </div>
          </div>

          {result && (
            <div className="space-y-4">
              <div className="border border-slate-200 p-3 text-xs dark:border-slate-800">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Arena Memory Guard (`Critic.verify_memory_bounds`)
                </div>
                <div className="mt-1 font-mono">
                  {result.memGuard.valid
                    ? '● LABFLOW_OK (0): Within zero-copy arena bounds'
                    : `✖ ${result.memGuard.reason}`}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  ToT Execution Trace (Attempts Used: {result.tot.attemptsUsed} · Final R²: {result.tot.finalRSquared})
                </h3>
                {result.tot.trace.map((branch: any) => (
                  <div
                    key={branch.branchId}
                    className="border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-semibold">{branch.branchId} (Attempt {branch.attempt})</span>
                      <span
                        className={
                          branch.criticPassed
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }
                      >
                        {branch.status.toUpperCase()} · R²={branch.rSquared}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">{branch.hypothesis}</p>
                    {branch.violations?.length > 0 && (
                      <p className="mt-1 font-mono text-rose-700 dark:text-rose-400">
                        Critic Intercept: {branch.violations.join('; ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {result.tot.converged && (
                <ScientificCanvas
                  title="Self-Healed Doublet Pseudo-Voigt Convergence"
                  xLabel="Binding Energy (eV)"
                  yLabel="Counts (CPS)"
                  height={230}
                  series={[
                    { id: 'raw', label: 'Target Spectrum', x: result.xSpec, y: result.ySpec, color: '#64748b' },
                    { id: 'fit', label: 'Self-Healed Fit', x: result.xSpec, y: result.tot.fittedY, color: '#2563eb', lineWidth: 2 },
                  ]}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
