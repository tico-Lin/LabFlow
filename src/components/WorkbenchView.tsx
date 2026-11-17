// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useEffect, useState } from 'react';
import { ChartSeries, ScientificCanvas } from './ScientificCanvas';
import { unpackChartStateBinary } from '../engines/mathUtils';

type DomainTab = 'electrochem' | 'xrd' | 'xas' | 'xps' | 'nmr_audio' | 'sem_spm' | 'thermal_bet';

interface WorkbenchViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({ isDark, onToggleTheme }) => {
  const [domain, setDomain] = useState<DomainTab>('electrochem');
  const [loading, setLoading] = useState(false);

  // Electrochemistry state
  const [ecDataset, setEcDataset] = useState<'benchmark' | 'example_mpt'>('benchmark');
  const [ecMode, setEcMode] = useState<'cv_dunn' | 'gcd' | 'nyquist' | 'tafel' | 'ws_stream'>('cv_dunn');
  const [ecData, setEcData] = useState<any>(null);
  const [ecNotice, setEcNotice] = useState<string | null>(null);
  const [wsFrame, setWsFrame] = useState<{ seriesId: number; x: number[]; y: number[] } | null>(null);

  // XRD state
  const [lambdaSrc, setLambdaSrc] = useState(0.77491);
  const [lambdaDst, setLambdaDst] = useState(1.5418);
  const [xrdData, setXrdData] = useState<any>(null);

  // XAS state
  const [kWeight, setKWeight] = useState(2);
  const [xasView, setXasView] = useState<'xanes' | 'chiR'>('xanes');
  const [xasData, setXasData] = useState<any>(null);

  // XPS state
  const [xpsBg, setXpsBg] = useState<'shirley' | 'tougaard'>('shirley');
  const [c1sMeasured, setC1sMeasured] = useState(285.1);
  const [xpsData, setXpsData] = useState<any>(null);

  // NMR + Acoustic state
  const [nmrLb, setNmrLb] = useState(1.5);
  const [f0Target, setF0Target] = useState(220);
  const [nmrData, setNmrData] = useState<any>(null);
  const [audioData, setAudioData] = useState<any>(null);

  // Microscopy state
  const [dLatticeNm, setDLatticeNm] = useState(0.245);
  const [semData, setSemData] = useState<any>(null);

  // Thermal / BET / PLS state
  const [thermData, setThermData] = useState<any>(null);

  // WebSocket binary ChartState receiver
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/v1/stream`);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        const unpacked = unpackChartStateBinary(new Uint8Array(ev.data));
        setWsFrame({ seriesId: unpacked.seriesId, x: unpacked.xValues, y: unpacked.yValues });
      }
    };
    return () => ws.close();
  }, []);

  const runDomainAnalysis = async (target: DomainTab, datasetOverride?: 'benchmark' | 'example_mpt') => {
    setLoading(true);
    try {
      if (target === 'electrochem') {
        const chosenDataset = datasetOverride ?? ecDataset;
        setEcNotice(null);
        const r = await fetch('/api/v1/electrochem/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset: chosenDataset }),
        });
        const payload = await r.json();
        if (!r.ok) {
          setEcNotice(payload.detail ?? payload.title ?? 'Electrochemistry analysis error');
        } else {
          setEcData(payload);
        }
      } else if (target === 'xrd') {
        const r = await fetch('/api/v1/xrd/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lambdaSrc, lambdaDst, stepDeg: 0.02 }),
        });
        setXrdData(await r.json());
      } else if (target === 'xas') {
        const r = await fetch('/api/v1/xas/regrid-tensor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kWeight }),
        });
        setXasData(await r.json());
      } else if (target === 'xps') {
        const r = await fetch('/api/v1/xps/deconvolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backgroundMethod: xpsBg, measuredC1sEv: c1sMeasured }),
        });
        setXpsData(await r.json());
      } else if (target === 'nmr_audio') {
        const [r1, r2] = await Promise.all([
          fetch('/api/v1/nmr/process-fid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lbHz: nmrLb }),
          }),
          fetch('/api/v1/audio/extract-features', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ f0Target }),
          }),
        ]);
        setNmrData(await r1.json());
        setAudioData(await r2.json());
      } else if (target === 'sem_spm') {
        const r = await fetch('/api/v1/sem-spm/standardize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dLatticeNm }),
        });
        setSemData(await r.json());
      } else if (target === 'thermal_bet') {
        const r = await fetch('/api/v1/thermal-porosity/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        setThermData(await r.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDomainAnalysis(domain);
  }, [domain]);

  const handleEcFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setEcNotice(null);
    try {
      const isBinaryMpr = file.name.toLowerCase().endsWith('.mpr');
      let bodyPayload: Record<string, string>;
      if (isBinaryMpr) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        bodyPayload = { rawMprBase64: btoa(bin), fileName: file.name };
      } else {
        const text = await file.text();
        bodyPayload = { rawMpt: text, fileName: file.name };
      }
      const r = await fetch('/api/v1/electrochem/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const payload = await r.json();
      if (!r.ok) {
        setEcNotice(payload.detail ?? payload.title ?? `Failed to parse ${file.name}`);
      } else {
        setEcData(payload);
        setEcNotice(`Parsed ${file.name} (${payload.activeUpload?.pointCount ?? payload.parsedMpt?.columns?.length ?? 'ok'} records)`);
      }
    } catch (err) {
      setEcNotice(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSemTiff = () => {
    if (!semData?.tiffBase64) return;
    const bin = atob(semData.tiffBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/tiff' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'labflow_sem_dual_frame.tif';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const domainTabs: { id: DomainTab; label: string }[] = [
    { id: 'electrochem', label: 'Electrochemistry' },
    { id: 'xrd', label: 'XRD & Bragg' },
    { id: 'xas', label: 'Synchrotron XAS' },
    { id: 'xps', label: 'XPS Surface' },
    { id: 'nmr_audio', label: 'NMR & Acoustic' },
    { id: 'sem_spm', label: 'SEM / SAED / AFM' },
    { id: 'thermal_bet', label: 'BET / TGA / PLS' },
  ];

  // Build chart series for active domain
  const getChartConfig = (): { title: string; xLabel: string; yLabel: string; invertX?: boolean; series: ChartSeries[] } => {
    if (domain === 'electrochem' && ecData) {
      if (ecMode === 'ws_stream' && wsFrame) {
        return {
          title: 'WebSocket Binary ChartState Stream (<Idddd 36B Header)',
          xLabel: 'Potential / Coordinate',
          yLabel: 'Streamed Amplitude',
          series: [{ id: 'ws', label: `Series #${wsFrame.seriesId}`, x: wsFrame.x, y: wsFrame.y, color: '#0891b2' }],
        };
      }
      if (ecMode === 'gcd' && Array.isArray(ecData.gcdCurves)) {
        const palette = ['#2563eb', '#0891b2', '#d97706', '#7c3aed'];
        const srcTag =
          ecData.datasetSource === 'example_eclab' || ecData.datasetSource === 'example_mpt'
            ? 'Real BioLogic .mpr (/Example/EcLab)'
            : ecData.activeUpload?.fileName ?? 'MnOFe5Co5 Benchmark';
        return {
          title: `GCD Nonlinear Charge/Discharge — ${srcTag}`,
          xLabel: 'Time (s)',
          yLabel: 'Potential Ewe (V)',
          series: ecData.gcdCurves.map((c: any, idx: number) => ({
            id: `gcd-${c.currentDensityAG}`,
            label: `${c.currentDensityAG} A/g (${ecData.gcd[idx]?.cIntegralFG ?? '—'} F/g)`,
            x: c.timeS,
            y: c.voltageV,
            color: palette[idx % palette.length],
            lineWidth: 2,
          })),
        };
      }
      if (ecMode === 'nyquist') {
        const srcTag =
          ecData.datasetSource === 'example_eclab' || ecData.datasetSource === 'example_mpt'
            ? 'Real BioLogic .mpr (/Example/EcLab)'
            : ecData.activeUpload?.fileName ?? 'MnOFe5Co5 Benchmark';
        const nyqSeries: ChartSeries[] = [
          { id: 'nyq', label: 'PEIS Experimental', x: ecData.peis.reZOhm, y: ecData.peis.negImZOhm, color: '#2563eb', lineWidth: 2 },
        ];
        if (Array.isArray(ecData.peis.kkReFitOhm) && Array.isArray(ecData.peis.kkNegImFitOhm)) {
          nyqSeries.push({
            id: 'linkk',
            label: 'Lin-KK Voigt Fit',
            x: ecData.peis.kkReFitOhm,
            y: ecData.peis.kkNegImFitOhm,
            color: '#d97706',
            dashed: true,
          });
        }
        return {
          title: `PEIS Nyquist & Lin-KK Validation — ${srcTag}`,
          xLabel: "Z' Re(Z) (Ohm)",
          yLabel: "-Z'' -Im(Z) (Ohm)",
          series: nyqSeries,
        };
      }
      if (ecMode === 'tafel') {
        return {
          title: 'LSV iR-Compensated Tafel Analysis',
          xLabel: 'log10(|j| / mA cm⁻²)',
          yLabel: 'Overpotential η (mV)',
          series: [{ id: 'taf', label: 'iR-Corrected Tafel', x: ecData.tafel.logCurrentDensity, y: ecData.tafel.logCurrentDensity.map((lj: number) => ecData.tafel.tafelSlopeMvDec * lj + 120), color: '#d97706' }],
        };
      }
      const cvTag =
        ecData.datasetSource === 'example_eclab' || ecData.datasetSource === 'example_mpt'
          ? 'Real .mpr 10 & 20 mV/s'
          : 'MnOFe5Co5_20261112';
      return {
        title: `CV Dunn Separation — ${cvTag}`,
        xLabel: 'Potential (V vs. Ag/AgCl)',
        yLabel: 'Current (mA)',
        series: [
          { id: 'tot', label: 'Total Anodic Current', x: ecData.cv.dunnPotentialV, y: ecData.cv.dunnTotalMa, color: '#2563eb', lineWidth: 2 },
          { id: 'cap', label: 'Capacitive Contribution', x: ecData.cv.dunnPotentialV, y: ecData.cv.dunnCapacitiveMa, color: '#0891b2', fillAlpha: 0.2, dashed: true },
        ],
      };
    }
    if (domain === 'xrd' && xrdData) {
      return {
        title: `Synchrotron XRD Wavelength Conversion (${lambdaSrc} Å → ${lambdaDst} Å)`,
        xLabel: '2θ (Degrees)',
        yLabel: 'Intensity (a.u.)',
        series: [
          { id: 'src', label: `Source (${lambdaSrc} Å)`, x: xrdData.srcX, y: xrdData.srcY, color: '#94a3b8', dashed: true },
          { id: 'dst', label: `Cu Kα Uniform Resampled`, x: xrdData.converted.twoThetaDst, y: xrdData.converted.intensityDst, color: '#2563eb', lineWidth: 2 },
        ],
      };
    }
    if (domain === 'xas' && xasData) {
      if (xasView === 'chiR') {
        return {
          title: `EXAFS Radial Structure Function |χ(R)| (k^${kWeight} Weighted)`,
          xLabel: 'Radial Distance R (Å)',
          yLabel: '|χ(R)| Magnitude',
          series: [{ id: 'chir', label: 'FT |χ(R)|', x: xasData.rGrid, y: xasData.chiRMag, color: '#0891b2', lineWidth: 2, fillAlpha: 0.14 }],
        };
      }
      return {
        title: 'Synchrotron XAS 7-Model Parallel Regridding & AIC Fusion',
        xLabel: 'Photon Energy (eV)',
        yLabel: 'Normalized μ(E)',
        series: [
          { id: 'aic', label: 'AIC-Weighted Consensus', x: xasData.energyGridEv, y: xasData.featureTensor.aicWeightedMain, color: '#2563eb', lineWidth: 2.2 },
          { id: 'pchip', label: 'PCHIP Model', x: xasData.energyGridEv, y: xasData.featureTensor.pchip, color: '#0891b2', dashed: true },
          { id: 'gpr', label: 'GPR Matern-3/2', x: xasData.energyGridEv, y: xasData.featureTensor.gprSmooth, color: '#d97706', dashed: true },
        ],
      };
    }
    if (domain === 'xps' && xpsData) {
      return {
        title: `XPS Mn 2p Deconvolution (${xpsBg.toUpperCase()} Background, C 1s Ref = 284.80 eV)`,
        xLabel: 'Binding Energy (eV)',
        yLabel: 'Intensity (CPS)',
        invertX: true,
        series: [
          { id: 'raw', label: 'Raw Counts', x: xpsData.bindingEnergyCalibrated, y: xpsData.rawCounts, color: '#64748b' },
          { id: 'fit', label: 'Fitted Envelope', x: xpsData.bindingEnergyCalibrated, y: xpsData.fittedTotal, color: '#2563eb', lineWidth: 2 },
          { id: 'bg', label: `${xpsBg} Background`, x: xpsData.bindingEnergyCalibrated, y: xpsData.background, color: '#94a3b8', dashed: true },
          { id: 'p1', label: xpsData.peakCurves[0].label, x: xpsData.bindingEnergyCalibrated, y: xpsData.peakCurves[0].y, color: '#0891b2', fillAlpha: 0.15 },
          { id: 'p2', label: xpsData.peakCurves[1].label, x: xpsData.bindingEnergyCalibrated, y: xpsData.peakCurves[1].y, color: '#d97706', fillAlpha: 0.15 },
        ],
      };
    }
    if (domain === 'nmr_audio' && nmrData) {
      return {
        title: '1H NMR Phase-Corrected Absorption Spectrum (Entropy Minimization)',
        xLabel: 'Chemical Shift δ (ppm)',
        yLabel: 'Intensity (a.u.)',
        invertX: true,
        series: [{ id: 'nmr', label: `Phased 1H (φ0=${nmrData.phi0Deg}°)`, x: nmrData.ppmAxis, y: nmrData.realSpectrum, color: '#2563eb' }],
      };
    }
    if (domain === 'sem_spm' && semData) {
      const row = semData.afm.leveledMatrix[Math.floor(semData.afm.leveledMatrix.length / 2)] ?? [];
      const xPx = row.map((_: number, i: number) => i);
      return {
        title: 'AFM Line Profile After 2D Least-Squares Plane Leveling',
        xLabel: 'Lateral Scan Position (px)',
        yLabel: 'Height Z (nm)',
        series: [{ id: 'afm', label: `Leveled Profile (Rq=${semData.afm.rqNm} nm)`, x: xPx, y: row, color: '#0891b2', fillAlpha: 0.15 }],
      };
    }
    if (domain === 'thermal_bet' && thermData) {
      return {
        title: 'N2 Adsorption Isotherm & Rouquerol BET Fit',
        xLabel: 'Relative Pressure P / P0',
        yLabel: 'Volume Adsorbed (cm³/g STP)',
        series: [{ id: 'bet', label: `N2 Isotherm (S_BET=${thermData.bet.sBetM2G} m²/g)`, x: thermData.pOverP0, y: thermData.volumeStp, color: '#2563eb', lineWidth: 2 }],
      };
    }
    return { title: 'Loading Scientific Engine...', xLabel: 'X', yLabel: 'Y', series: [] };
  };

  const chart = getChartConfig();

  return (
    <div className="space-y-4">
      {/* Secondary Workspace Toolbar (below header per Top Bar Contract) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 dark:bg-slate-900">
          {domainTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDomain(t.id)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                domain === t.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Active Sample: MnOFe5Co5_20261112</span>
          <span aria-hidden="true">·</span>
          <span>Al-I2 Cathode</span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {isDark ? 'Light Lab Mode' : 'Dark Beamline Mode'}
          </button>
        </div>
      </div>

      {/* Asymmetric Split Console: Left Parameter Column (320px) + Main Viewport (Flex-1) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <aside className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4 xl:col-span-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Calibration & Parameters
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Adjust physical bounds and re-run deterministic computation.
          </p>

          <div className="mt-4 space-y-4">
            {domain === 'electrochem' && (
              <>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Data Source
                  <select
                    value={ecDataset}
                    onChange={(e) => {
                      const next = e.target.value as 'benchmark' | 'example_mpt';
                      setEcDataset(next);
                      runDomainAnalysis('electrochem', next);
                    }}
                    className="mt-1.5 block w-full border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="benchmark">MnOFe5Co5 Synthetic Benchmark</option>
                    <option value="example_mpt">Uploaded /Example/EcLab Real .mpr</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Plot Mode
                  <select
                    value={ecMode}
                    onChange={(e) => setEcMode(e.target.value as any)}
                    className="mt-1.5 block w-full border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="cv_dunn">CV Dunn Separation (10 mV/s)</option>
                    <option value="gcd">GCD Charge / Discharge</option>
                    <option value="nyquist">PEIS Nyquist &amp; Lin-KK Fit</option>
                    <option value="tafel">LSV iR-Compensated Tafel</option>
                    <option value="ws_stream">WebSocket Binary ChartState</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Upload BioLogic (.mpr / .mpt)
                  <input
                    type="file"
                    accept=".mpr,.mpt"
                    onChange={handleEcFileUpload}
                    className="mt-1.5 block w-full border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 file:mr-2 file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:file:bg-slate-800"
                  />
                </label>

                {ecNotice && (
                  <p className="border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {ecNotice}
                  </p>
                )}

                {ecData && (
                  <div className="space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500">CV Power-Law b (Anodic)</span>
                      <span className="font-mono font-semibold">{ecData.cv.bValueAnodic}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Trasatti Outer Charge</span>
                      <span className="font-mono font-semibold">{ecData.cv.trasatti.outerPct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">PEIS Zero-Cross Rs</span>
                      <span className="font-mono font-semibold">{ecData.peis.rsOhm} Ω</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Warburg σW</span>
                      <span className="font-mono font-semibold">{ecData.peis.warburgSigma} Ω·s⁻¹/²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">KK Method</span>
                      <span className="font-mono font-semibold">{ecData.peis.kkMethod ?? 'Lin-KK-Voigt'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lin-KK RMS / Max</span>
                      <span
                        className={`font-mono font-semibold ${
                          ecData.peis.kkResidualPct < 1
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : ecData.peis.kkResidualPct < 5
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {ecData.peis.kkResidualPct}% / {ecData.peis.kkMaxResidualPct}%
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {domain === 'xrd' && (
              <>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Source Wavelength λ₁ (Å)
                  <input
                    type="number"
                    step="0.0001"
                    value={lambdaSrc}
                    onChange={(e) => setLambdaSrc(parseFloat(e.target.value) || 0.77491)}
                    className="mt-1 block w-full border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Target Anode λ₂ (Å)
                  <input
                    type="number"
                    step="0.0001"
                    value={lambdaDst}
                    onChange={(e) => setLambdaDst(parseFloat(e.target.value) || 1.5418)}
                    className="mt-1 block w-full border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => runDomainAnalysis('xrd')}
                  className="w-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Convert λ & Resample
                </button>
              </>
            )}

            {domain === 'xas' && (
              <>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  EXAFS k-Weighting (k^w)
                  <select
                    value={kWeight}
                    onChange={(e) => setKWeight(parseInt(e.target.value, 10))}
                    className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value={1}>k¹ Weighting</option>
                    <option value={2}>k² Weighting</option>
                    <option value={3}>k³ Weighting</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Spectrum View
                  <select
                    value={xasView}
                    onChange={(e) => setXasView(e.target.value as any)}
                    className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="xanes">7-Model XANES AIC Consensus</option>
                    <option value="chiR">EXAFS Radial FT |χ(R)|</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => runDomainAnalysis('xas')}
                  className="w-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Recompute FeatureTensor
                </button>
              </>
            )}

            {domain === 'xps' && (
              <>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Background Algorithm
                  <select
                    value={xpsBg}
                    onChange={(e) => setXpsBg(e.target.value as any)}
                    className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="shirley">Iterative Shirley (tol &lt; 10⁻⁶)</option>
                    <option value="tougaard">Tougaard Universal Cross-Section</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Measured C 1s Adventitious Peak (eV)
                  <input
                    type="number"
                    step="0.1"
                    value={c1sMeasured}
                    onChange={(e) => setC1sMeasured(parseFloat(e.target.value) || 284.8)}
                    className="mt-1 block w-full border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => runDomainAnalysis('xps')}
                  className="w-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Run Doublet Fit (2:1 Locked)
                </button>
              </>
            )}

            {domain === 'nmr_audio' && (
              <>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  NMR Line Broadening LB (Hz)
                  <input
                    type="number"
                    step="0.5"
                    value={nmrLb}
                    onChange={(e) => setNmrLb(parseFloat(e.target.value) || 1.0)}
                    className="mt-1 block w-full border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Acoustic Test Pitch F0 (Hz)
                  <input
                    type="number"
                    step="10"
                    value={f0Target}
                    onChange={(e) => setF0Target(parseFloat(e.target.value) || 220)}
                    className="mt-1 block w-full border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => runDomainAnalysis('nmr_audio')}
                  className="w-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Process FID & Praat Features
                </button>
              </>
            )}

            {domain === 'sem_spm' && (
              <>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Target HRTEM d-Spacing (nm)
                  <input
                    type="number"
                    step="0.005"
                    value={dLatticeNm}
                    onChange={(e) => setDLatticeNm(parseFloat(e.target.value) || 0.245)}
                    className="mt-1 block w-full border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => runDomainAnalysis('sem_spm')}
                  className="w-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Run SAED 2D-FFT &amp; AFM Leveling
                </button>
                {semData?.tiffBase64 && (
                  <button
                    type="button"
                    onClick={handleDownloadSemTiff}
                    className="w-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Download Dual-Frame .tif ({semData.tiffByteLength} B)
                  </button>
                )}
              </>
            )}

            {domain === 'thermal_bet' && (
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <p>Computes Rouquerol BET surface area, BJH Kelvin-Halsey mesopore size, Kissinger TGA activation energy, and NIPALS PLS-SEM path loadings.</p>
                <button
                  type="button"
                  onClick={() => runDomainAnalysis('thermal_bet')}
                  className="w-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Recompute Thermal & PLS-SEM
                </button>
              </div>
            )}

            {loading && <p className="font-mono text-xs text-cyan-700 dark:text-cyan-400">Computing matrix transform...</p>}
          </div>
        </aside>

        <section className="space-y-4 lg:col-span-8 xl:col-span-9">
          <ScientificCanvas
            title={chart.title}
            xLabel={chart.xLabel}
            yLabel={chart.yLabel}
            series={chart.series}
            invertX={chart.invertX}
            height={360}
          />

          {/* Bottom Telemetry & Quantitative Metrics Strip */}
          <div className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {domain === 'electrochem' && ecData && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">Dunn Capacitive (10 mV/s)</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {ecData.cv.dunnByScanRate.find((d: any) => d.scanRateMvS === 10)?.capacitivePct}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">PEIS Zero-Cross Rs</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {ecData.peis.rsOhm} <span className="text-xs font-normal text-slate-400">Ω</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">
                    GCD Integral C_int ({ecData.gcd[0]?.currentDensityAG ?? 1} A/g)
                  </div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {ecData.gcd[0]?.cIntegralFG} <span className="text-xs font-normal text-slate-400">F/g</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">iR-Corrected Tafel Slope</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {ecData.tafel.tafelSlopeMvDec} <span className="text-xs font-normal text-slate-400">mV/dec</span>
                  </div>
                </div>
              </div>
            )}

            {domain === 'xrd' && xrdData && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">Uniform Grid Step CV</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {xrdData.converted.stepCv.toExponential(1)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Total Reflection Guarded</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {xrdData.converted.truncatedCount} <span className="text-xs font-normal text-slate-400">pts</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Williamson-Hall Size D</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {xrdData.williamsonHall.crystalliteSizeNm} <span className="text-xs font-normal text-slate-400">nm</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Microstrain ε</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {xrdData.williamsonHall.microstrain}
                  </div>
                </div>
              </div>
            )}

            {domain === 'xas' && xasData && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">Absorption Edge E₀</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {xasData.e0Ev} <span className="text-xs font-normal text-slate-400">eV</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Parallel Models Fused</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">7</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Max AIC Weight Sum Error</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {xasData.weightSumErrorMax.toExponential(1)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">FeatureTensor Channels</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">5</div>
                </div>
              </div>
            )}

            {domain === 'xps' && xpsData && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">Charge Correction ΔE</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {xpsData.chargeShiftEv} <span className="text-xs font-normal text-slate-400">eV</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Shirley Convergence</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {xpsData.backgroundIterations} <span className="text-xs font-normal text-slate-400">iters</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Doublet Area Ratio</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {(xpsData.peaks[0].area / xpsData.peaks[1].area).toFixed(3)} : 1
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Fit R²</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">{xpsData.rSquared}</div>
                </div>
              </div>
            )}

            {domain === 'nmr_audio' && nmrData && audioData && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">NMR Negative Area</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">{nmrData.negativeAreaPct}%</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Praat Pitch F₀</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {audioData.features.f0Hz} <span className="text-xs font-normal text-slate-400">Hz</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Harmonic-to-Noise (HNR)</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {audioData.features.hnrDb} <span className="text-xs font-normal text-slate-400">dB</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Formants F1 / F2</div>
                  <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {audioData.features.formantsHz[0]} / {audioData.features.formantsHz[1]} Hz
                  </div>
                </div>
              </div>
            )}

            {domain === 'sem_spm' && semData && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">SAED 2D-FFT d_hkl</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {semData.saed.dSpacingNm} <span className="text-xs font-normal text-slate-400">nm</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">AFM Roughness Ra / Rq</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {semData.afm.raNm} / {semData.afm.rqNm} <span className="text-xs font-normal text-slate-400">nm</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Dual-Frame Multi-Page TIFF</div>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums">
                    {semData.frameCount ?? 2} IFDs · {semData.tiffByteLength ?? 0} B
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">TIFF Tag 270 Mode</div>
                  <div className="mt-1 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                    {semData.semMeta.payload.contrastMode}
                  </div>
                </div>
              </div>
            )}

            {domain === 'thermal_bet' && thermData && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">BET Surface Area</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {thermData.bet.sBetM2G} <span className="text-xs font-normal text-slate-400">m²/g</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">BET Linear R²</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">{thermData.bet.rSquared}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Kissinger TGA Ea</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {thermData.tga.eaKJMol} <span className="text-xs font-normal text-slate-400">kJ/mol</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">PLS-SEM Cycle R²</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {thermData.pls.endogenousRSquared.CycleRetention}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
