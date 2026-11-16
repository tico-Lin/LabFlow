// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useEffect, useState } from 'react';
import { SpreadsheetColumn } from '../engines/corePlatformEngine';
import { ScientificCanvas } from './ScientificCanvas';

const DEFAULT_COLUMNS: SpreadsheetColumn[] = [
  {
    id: 'Col_A',
    longName: 'Binding Energy Shift',
    units: 'eV',
    comments: 'Calibrated C 1s ref',
    axisRole: 'X',
    values: Array.from({ length: 24 }, (_, i) => Number((i * 0.3).toFixed(2))),
  },
  {
    id: 'Col_B',
    longName: 'Gaussian Intensity',
    units: 'CPS',
    comments: '1.0 + 12*exp(-0.5*((x-3.6)/0.85)^2)',
    axisRole: 'Y',
    values: Array.from({ length: 24 }, (_, i) => {
      const x = i * 0.3;
      return Number((1.0 + 12.0 * Math.exp(-0.5 * ((x - 3.6) / 0.85) ** 2)).toFixed(4));
    }),
  },
  {
    id: 'Col_C',
    longName: 'First Derivative dI/dE',
    units: 'CPS/eV',
    comments: 'Auto DAG reactive column',
    axisRole: 'Y',
    formula: 'np.gradient($Col_B, $Col_A)',
    values: [],
  },
];

const DEFAULT_FDF = `[General Information]
Function Name = GaussAmp
[Fitting Parameters]
Names = y0, A, xc, w
[Formula]
y = y0 + A*exp(-0.5*((x-xc)/w)^2)`;

function SparklineSvg({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="font-mono text-[10px] text-slate-400">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 72;
  const h = 20;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="inline-block overflow-visible">
      <polyline fill="none" stroke="#0891b2" strokeWidth="1.4" points={pts} />
    </svg>
  );
}

export const SpreadsheetView: React.FC = () => {
  const [columns, setColumns] = useState<SpreadsheetColumn[]>(DEFAULT_COLUMNS);
  const [fdfText, setFdfText] = useState(DEFAULT_FDF);
  const [fitResult, setFitResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const evaluateSheet = async (cols: SpreadsheetColumn[], fdf?: string) => {
    setErrorMsg(null);
    const res = await fetch('/api/v1/spreadsheet/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        columns: cols,
        fdfText: fdf ?? fdfText,
        fitXCol: cols[0]?.id,
        fitYCol: cols[1]?.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.detail || 'Formula evaluation failed');
      return;
    }
    setColumns(data.columns);
    setFitResult(data.fdfFit);
  };

  useEffect(() => {
    evaluateSheet(DEFAULT_COLUMNS, DEFAULT_FDF);
  }, []);

  const updateCell = (colIdx: number, rowIdx: number, raw: string) => {
    const val = parseFloat(raw);
    if (!Number.isFinite(val)) return;
    const next = columns.map((c, ci) =>
      ci === colIdx ? { ...c, values: c.values.map((v, ri) => (ri === rowIdx ? val : v)) } : c
    );
    evaluateSheet(next);
  };

  const updateFormula = (colIdx: number, formula: string) => {
    const next = columns.map((c, ci) => (ci === colIdx ? { ...c, formula } : c));
    setColumns(next);
  };

  const rowCount = Math.max(...columns.map((c) => c.values.length), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Origin-Grist Reactive Scientific Spreadsheet
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-tier metadata headers · Topological Python DAG formulas · Origin .fdf nonlinear curve fitting
          </p>
        </div>
        <button
          type="button"
          onClick={() => evaluateSheet(columns, fdfText)}
          className="bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
        >
          Recalculate DAG & Fit .fdf
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Data Grid with Origin Multi-Tier Header */}
        <div className="overflow-x-auto border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
                <th className="w-24 whitespace-nowrap border-r border-slate-200 px-3 py-1.5 font-mono text-slate-500 dark:border-slate-800">Row</th>
                {columns.map((c) => (
                  <th key={c.id} className="border-r border-slate-200 px-3 py-1.5 font-mono font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-200">
                    {c.id} ({c.axisRole})
                  </th>
                ))}
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <td className="whitespace-nowrap border-r border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-800">Long Name</td>
                {columns.map((c) => (
                  <td key={c.id} className="border-r border-slate-200 px-3 py-1 text-slate-700 dark:border-slate-800 dark:text-slate-300">
                    {c.longName}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <td className="border-r border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-800">Units</td>
                {columns.map((c) => (
                  <td key={c.id} className="border-r border-slate-200 px-3 py-1 font-mono text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    {c.units}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <td className="border-r border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-800">Sparkline</td>
                {columns.map((c) => (
                  <td key={c.id} className="border-r border-slate-200 px-3 py-1 dark:border-slate-800">
                    <SparklineSvg values={c.values} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <td className="border-r border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-800">Formula</td>
                {columns.map((c, ci) => (
                  <td key={c.id} className="border-r border-slate-200 p-1 dark:border-slate-800">
                    <input
                      type="text"
                      aria-label={`Formula for ${c.id}`}
                      value={c.formula ?? ''}
                      placeholder="Raw numeric values"
                      onChange={(e) => updateFormula(ci, e.target.value)}
                      className="w-full border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-cyan-400"
                    />
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.min(rowCount, 12) }, (_, rIdx) => (
                <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800/70 dark:hover:bg-slate-800/40">
                  <td className="border-r border-slate-200 px-2 py-1 font-mono text-slate-400 dark:border-slate-800">
                    {rIdx + 1}
                  </td>
                  {columns.map((c, ci) => (
                    <td key={c.id} className="border-r border-slate-200 p-0.5 dark:border-slate-800">
                      <input
                        type="number"
                        step="0.01"
                        disabled={Boolean(c.formula && c.formula.trim())}
                        aria-label={`${c.id} row ${rIdx + 1}`}
                        value={Number((c.values[rIdx] ?? 0).toFixed(4))}
                        onChange={(e) => updateCell(ci, rIdx, e.target.value)}
                        className="w-full bg-transparent px-2 py-1 text-right font-mono tabular-nums text-slate-800 disabled:text-slate-500 dark:text-slate-200"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Origin .fdf FitFunc Editor + Plot */}
        <div className="space-y-4 lg:col-span-5">
          <div className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <label className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
              Origin FitFunc Definition (.fdf)
              <textarea
                rows={6}
                value={fdfText}
                onChange={(e) => setFdfText(e.target.value)}
                className="mt-2 block w-full border border-slate-300 bg-slate-50 p-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            {fitResult && (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 font-mono text-xs dark:border-slate-800">
                <div>R²: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{fitResult.rSquared}</span></div>
                <div>Adj R²: <span className="font-semibold">{fitResult.adjustedRSquared}</span></div>
                {Object.entries(fitResult.fittedParams).map(([k, v]) => (
                  <div key={k}>{k}: <span className="font-semibold">{String(v)}</span></div>
                ))}
              </div>
            )}
          </div>

          <ScientificCanvas
            title="Origin .fdf Nonlinear Fit & Derivative Overlay"
            xLabel={`${columns[0]?.longName} (${columns[0]?.units})`}
            yLabel={columns[1]?.longName ?? 'Y'}
            height={250}
            series={[
              { id: 'raw', label: columns[1]?.longName ?? 'Data', x: columns[0]?.values ?? [], y: columns[1]?.values ?? [], color: '#64748b' },
              ...(fitResult ? [{ id: 'fit', label: `${fitResult.modelName} Fit`, x: columns[0]?.values ?? [], y: fitResult.yPred, color: '#2563eb', lineWidth: 2 }] : []),
              { id: 'grad', label: columns[2]?.longName ?? 'Gradient', x: columns[0]?.values ?? [], y: columns[2]?.values ?? [], color: '#0891b2', dashed: true },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
