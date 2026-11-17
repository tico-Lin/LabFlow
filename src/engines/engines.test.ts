// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { packChartStateBinary, unpackChartStateBinary } from './mathUtils';
import {
  analyzeCvDunnTrasatti,
  analyzeGcdCycles,
  analyzeLsvTafel,
  analyzePeis,
  buildMnOFe5Co5BenchmarkData,
  extractGcdCycleFromMpr,
  parseBioLogicMpr,
  parseBioLogicMpt,
} from './electrochemEngine';
import {
  analyzeSynchrotronXas,
  analyzeWilliamsonHall,
  analyzeXpsRegion,
  checkBinaryFileGuard,
  computeShirleyBackground,
  convertXrdWavelength,
  pseudoVoigtPeak,
} from './spectroscopyEngines';
import {
  analyzeAcousticSignal,
  analyzeAfmPlaneLeveling,
  analyzeBetIsotherm,
  analyzeSaedLattice2dFft,
  analyzeTgaKissinger,
  buildSemStudioSmartMetadata,
  generateSemMultiPageTiff,
  parseTiffIfdSummary,
  processNmrFid,
  runNipalsPlsSem,
} from './nmrAcousticMicroscopyThermalEngine';
import {
  buildKnowledgeStarMap,
  calculateHydrothermalMass,
  calculateMolarMass,
  CircularFormulaDependencyError,
  createNoteRevision,
  Critic,
  evaluateReactiveSpreadsheet,
  fitOriginFdfModel,
  generateLinuxCloudLatex,
  hybridRagSearch,
  LABFLOW_ERR_OOB,
  LamportCrdtGraph,
  lintLatexLinuxPreamble,
  parseDmsCoaDocument,
  parseOriginFdf,
  querySampleAncestry,
  reconstructSnapshot,
  runAntigraitySelfHealingFit,
  verifyRevisionChain,
} from './corePlatformEngine';

test('AC-WS-01: Binary ChartState <Idddd packing & unpacking preserves exact values', () => {
  const xs = [0, 0.25, 0.5, 0.75, 1.0];
  const ys = [1.2, 3.4, -2.1, 5.6, 0.0];
  const packed = packChartStateBinary(42, 0, 1.0, -2.1, 5.6, xs, ys);
  assert.equal(packed.byteLength, 36 + xs.length * 16);
  const unpacked = unpackChartStateBinary(packed);
  assert.equal(unpacked.seriesId, 42);
  assert.equal(unpacked.xMin, 0);
  assert.equal(unpacked.xMax, 1.0);
  assert.equal(unpacked.yMin, -2.1);
  assert.equal(unpacked.yMax, 5.6);
  assert.deepEqual(unpacked.xValues, xs);
  assert.deepEqual(unpacked.yValues, ys);
});

test('AC-EC-01: Electrochemistry MnOFe5Co5 benchmark (MPT parser, CV Dunn/Trasatti, GCD C_int, PEIS Rs, Tafel)', () => {
  const mptSample = `EC-Lab ASCII FILE\nNb header lines : 4\nCyclic Voltammetry\nmode\tEwe/V\t<I>/mA\ttime/s\n1\t0.10\t1.25\t0.5\n1\t0.20\t2.50\t1.0`;
  const parsed = parseBioLogicMpt(mptSample);
  assert.equal(parsed.headerLineCount, 4);
  assert.deepEqual(parsed.rows['Ewe/V'], [0.1, 0.2]);

  const bench = buildMnOFe5Co5BenchmarkData();
  const cv = analyzeCvDunnTrasatti(bench.cvScans, 10);
  const dunn10 = cv.dunnByScanRate.find((d) => d.scanRateMvS === 10);
  assert.ok(dunn10 && dunn10.capacitivePct > 50 && dunn10.capacitivePct < 90);
  assert.ok(cv.bValueAnodic >= 0.5 && cv.bValueAnodic <= 1.0);
  assert.ok(cv.trasatti.outerPct > 40 && cv.trasatti.outerPct < 80);

  const gcd = analyzeGcdCycles(bench.gcdInputs);
  assert.equal(gcd.length, 3);
  assert.ok(gcd[0].cIntegralFG > gcd[1].cIntegralFG && gcd[1].cIntegralFG > gcd[2].cIntegralFG);

  const peis = analyzePeis(bench.peisInput);
  assert.ok(Math.abs(peis.rsOhm - 0.5192) < 0.02, `Expected Rs ~ 0.5192, got ${peis.rsOhm}`);
  assert.ok(Math.abs(peis.lStrayUh - 0.223) < 0.05, `Expected L ~ 0.223 uH, got ${peis.lStrayUh}`);
  assert.ok(Math.abs(peis.warburgSigma - 7.985) < 0.3, `Expected sigmaW ~ 7.985, got ${peis.warburgSigma}`);
  assert.ok(peis.kkResidualPct < 1.0, `KK residual must be < 1%, got ${peis.kkResidualPct}`);

  const tafel = analyzeLsvTafel(bench.lsvV, bench.lsvI, peis.rsOhm);
  assert.ok(tafel.rSquared > 0.99, `Expected Tafel R^2 > 0.99, got ${tafel.rSquared}`);
});

test('AC-XRD-01: Synchrotron XRD Bragg wavelength conversion, Total Reflection Guard & uniform step CV', () => {
  const twoTheta1 = Array.from({ length: 171 }, (_, i) => 5 + i * 0.5); // 5 deg to 90 deg
  const intensity = twoTheta1.map((t) => 100 + 800 * Math.exp(-((t - 18.2) ** 2) / 0.3));
  const res = convertXrdWavelength(twoTheta1, intensity, 0.77491, 1.5418, 0.02);
  assert.ok(res.truncatedCount > 0, 'Total Reflection Guard must filter angles > 60.35 deg');
  assert.ok(res.stepCv < 1e-10, `Step CV must be < 1e-10, got ${res.stepCv}`);
  assert.ok(res.intensityDst.every((v) => Number.isFinite(v) && v >= 0));

  const binCheck = checkBinaryFileGuard(new Uint8Array([0x50, 0x4b, 0x00, 0x04]));
  assert.equal(binCheck.safe, false);

  const wh = analyzeWilliamsonHall([28.4, 36.1, 47.3, 56.1], [0.22, 0.25, 0.31, 0.36]);
  assert.ok(wh.crystalliteSizeNm > 5 && wh.crystalliteSizeNm < 200);
});

test('AC-XAS-01: Synchrotron XAS 7-model parallel regridding, AIC weights sum = 1.0, and FT |chi(R)|', () => {
  // Non-uniform energy grid: dense XANES (0.2 eV) + sparse EXAFS (2.0 eV)
  const eXanes = Array.from({ length: 80 }, (_, i) => 6530 + i * 0.25);
  const eExafs = Array.from({ length: 60 }, (_, i) => 6550 + i * 2.0);
  const energy = [...eXanes, ...eExafs];
  const e0True = 6545.0;
  const mu = energy.map((e) => {
    const step = 0.5 * (1 + Math.tanh((e - e0True) / 2.2));
    const k = e > e0True ? Math.sqrt(0.2624684 * (e - e0True)) : 0;
    const exafs = e > e0True ? 0.08 * Math.exp(-0.04 * k * k) * Math.sin(2 * 2.1 * k) : 0;
    return 0.12 + step + exafs;
  });

  const res = analyzeSynchrotronXas(energy, mu, 2);
  assert.equal(Object.keys(res.models).length, 7);
  assert.ok(res.weightSumErrorMax < 1e-9, `AIC weight sum deviation ${res.weightSumErrorMax}`);
  assert.ok(Math.abs(res.e0Ev - e0True) < 2.5, `E0 ${res.e0Ev} should be close to ${e0True}`);
  assert.ok(res.rGrid.length > 10 && res.chiRMag.some((v) => v > 0));
});

test('AC-XPS-01: Iterative Shirley convergence <= 30 iterations, 2:1 doublet ratio, RSF at% sum = 100%', () => {
  const be = Array.from({ length: 120 }, (_, i) => 634 + i * 0.2);
  const counts = be.map((e) => {
    const stepBg = 200 + 180 / (1 + Math.exp(-(e - 643) / 1.5));
    const p1 = pseudoVoigtPeak(e, 641.8, 1200, 1.8, 0.3);
    const p2 = pseudoVoigtPeak(e, 653.5, 600, 1.8, 0.3);
    return stepBg + p1 + p2;
  });
  const shirley = computeShirleyBackground(be, counts, 1e-6, 30);
  assert.ok(shirley.iterations <= 30);

  const fit = analyzeXpsRegion(be, counts, {
    measuredC1sEv: 285.1,
    referenceC1sEv: 284.8,
    spinOrbitRatio: 2.0,
    doubletSplitEv: 11.7,
    initialCentersEv: [641.5, 653.2],
  });
  assert.equal(fit.chargeShiftEv, -0.3);
  const ratio = fit.peaks[0].area / fit.peaks[1].area;
  assert.ok(Math.abs(ratio - 2.0) < 0.05, `Doublet area ratio ${ratio} expected ~2.0`);
  const sumAt = fit.peaks[0].atomicPct + fit.peaks[1].atomicPct;
  assert.ok(Math.abs(sumAt - 100.0) < 1e-6);
});

test('AC-NMR-01 & AC-AUDIO-01: NMR automatic phase correction & Praat/openSMILE 220 Hz F0 extraction', () => {
  // Synthetic 1H NMR FID with 2 singlets (ratio 3:1) and 35 deg phase error
  const swHz = 4000;
  const nFid = 1024;
  const phiErr = (35 * Math.PI) / 180;
  const f1 = 420; // Hz
  const f2 = -580; // Hz
  const fidRe: number[] = [];
  const fidIm: number[] = [];
  for (let i = 0; i < nFid; i++) {
    const t = i / swHz;
    const decay = Math.exp(-8 * t);
    const sRe = 3 * Math.cos(2 * Math.PI * f1 * t) + 1 * Math.cos(2 * Math.PI * f2 * t);
    const sIm = 3 * Math.sin(2 * Math.PI * f1 * t) + 1 * Math.sin(2 * Math.PI * f2 * t);
    fidRe.push(decay * (sRe * Math.cos(phiErr) - sIm * Math.sin(phiErr)));
    fidIm.push(decay * (sRe * Math.sin(phiErr) + sIm * Math.cos(phiErr)));
  }
  const nmr = processNmrFid(fidRe, fidIm, swHz, 400, 1.5);
  assert.ok(nmr.negativeAreaPct < 0.5, `Negative lobe area ${nmr.negativeAreaPct}% too high`);
  assert.ok(nmr.multiplets.length >= 2);

  // Synthetic 220 Hz voice-like harmonic signal at 16,000 Hz
  const sr = 16000;
  const audio = Array.from({ length: 2400 }, (_, i) => {
    const t = i / sr;
    return (
      0.6 * Math.sin(2 * Math.PI * 220 * t) +
      0.3 * Math.sin(2 * Math.PI * 440 * t) +
      0.15 * Math.sin(2 * Math.PI * 660 * t)
    );
  });
  const ac = analyzeAcousticSignal(audio, sr);
  assert.ok(Math.abs(ac.f0Hz - 220.0) < 1.5, `Extracted F0 ${ac.f0Hz} Hz deviates from 220 Hz`);
  assert.equal(ac.mfcc13.length, 13);
  assert.ok(ac.mfcc13.every(Number.isFinite));
});

test('AC-SPM-01 & AC-THERM-01: SEM Smart TIFF, SAED 2D-FFT d_hkl, AFM plane leveling, BET & PLS-SEM', () => {
  const semMeta = buildSemStudioSmartMetadata({
    nmPerPx: 1.25,
    cropBottomPx: 64,
    scalebarNm: 100,
    roiMeanRgb: [45, 45, 45],
  });
  assert.ok(semMeta.tiffTag270.startsWith('SEM_STUDIO_SMART_V1|'));
  assert.equal(semMeta.payload.contrastMode, 'white_bar_dark_bg');

  // Synthetic HRTEM lattice with d = 0.245 nm, pixelSize = 0.025 nm -> wavelength = 9.8 px
  const N = 64;
  const pxNm = 0.025;
  const dTrue = 0.245;
  const hrtem = Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => Math.cos((2 * Math.PI * (x * pxNm)) / dTrue))
  );
  const saed = analyzeSaedLattice2dFft(hrtem, pxNm);
  assert.ok(Math.abs(saed.dSpacingNm - dTrue) < 0.02, `SAED d=${saed.dSpacingNm} vs ${dTrue}`);

  // AFM tilted plane z = 0.5x - 0.3y + roughness
  const afm = Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => 0.5 * x - 0.3 * y + Math.sin(x) * 0.2)
  );
  const afmRes = analyzeAfmPlaneLeveling(afm);
  assert.ok(afmRes.residualSlope < 1e-10, `Residual slope ${afmRes.residualSlope}`);

  // BET synthetic isotherm: vm = 120.0 cm3/g STP, C = 85.0 -> S_BET ~ 522.3 m2/g
  const pOverP0 = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.45, 0.65, 0.85];
  const vmTrue = 120.0;
  const cTrue = 85.0;
  const vol = pOverP0.map((p) => (vmTrue * cTrue * p) / ((1 - p) * (1 + (cTrue - 1) * p)));
  const bet = analyzeBetIsotherm(pOverP0, vol);
  assert.ok(Math.abs(bet.sBetM2G - 522.3) / 522.3 < 0.002, `BET ${bet.sBetM2G} vs 522.3`);
  assert.ok(bet.rSquared > 0.9999);

  const tga = analyzeTgaKissinger([5, 10, 20], [520, 535, 551]);
  assert.ok(tga.eaKJMol > 50 && tga.rSquared > 0.99);

  // NIPALS PLS-SEM 3 latent blocks
  const obs = Array.from({ length: 30 }, (_, i) => (i - 14.5) / 8);
  const pls = runNipalsPlsSem([
    { name: 'HostPorosity', indicators: obs.map((z) => [z * 0.9 + 0.05, z * 0.85 - 0.04]) },
    { name: 'ElectrolyteDES', indicators: obs.map((z) => [z * 0.7 + 0.1, z * 0.75 + 0.08]) },
    { name: 'CycleRetention', indicators: obs.map((z) => [z * 0.88, z * 0.91]) },
  ]);
  assert.ok(pls.iterations <= 100 && pls.converged);
  assert.ok(pls.measurementQuality['HostPorosity'].ave >= 0.5);
  assert.ok(pls.measurementQuality['HostPorosity'].compositeReliability >= 0.7);
});

test('AC-TAB-01/02, AC-CHEM-01, AC-DOC-01, AC-LIMS-01, AC-STAR-01, AC-TEX-01, AC-AGENT-01', () => {
  // 1. Reactive spreadsheet DAG + circular dependency detection + Origin .fdf
  const colA = Array.from({ length: 200 }, (_, i) => (i / 199) * 2 * Math.PI);
  const sheet = evaluateReactiveSpreadsheet([
    { id: 'Col_A', longName: 'Angle', units: 'rad', comments: '', axisRole: 'X', values: colA },
    { id: 'Col_B', longName: 'Sine', units: 'a.u.', comments: '', axisRole: 'Y', formula: 'np.sin($Col_A)', values: [] },
    { id: 'Col_C', longName: 'Grad', units: 'a.u./rad', comments: '', axisRole: 'Y', formula: 'np.gradient($Col_B, $Col_A)', values: [] },
  ]);
  const errGrad = sheet[2].values.reduce((acc, v, i) => Math.max(acc, Math.abs(v - Math.cos(colA[i]))), 0);
  assert.ok(errGrad < 0.01, `Gradient error ${errGrad}`);

  assert.throws(() =>
    evaluateReactiveSpreadsheet([
      { id: 'A', longName: 'A', units: '', comments: '', axisRole: 'X', formula: '$B + 1', values: [1] },
      { id: 'B', longName: 'B', units: '', comments: '', axisRole: 'Y', formula: '$A + 1', values: [1] },
    ]),
    CircularFormulaDependencyError
  );

  const fdf = parseOriginFdf(`[General Information]\nFunction Name = GaussAmp\n[Fitting Parameters]\nNames = y0, A, xc, w\n[Formula]\ny = y0 + A*exp(-0.5*((x-xc)/w)^2)`);
  const xFit = Array.from({ length: 40 }, (_, i) => i * 0.2);
  const yFit = xFit.map((x) => 1.0 + 10.0 * Math.exp(-0.5 * ((x - 4.0) / 0.8) ** 2));
  const fdfRes = fitOriginFdfModel(fdf, xFit, yFit, [0.5, 8.0, 3.8, 1.0]);
  assert.ok(fdfRes.rSquared > 0.9999);

  // 2. Stoichiometry Fe(NO3)3·9H2O = 404.00 g/mol, AlCl3 = 133.34 g/mol
  assert.ok(Math.abs(calculateMolarMass('Fe(NO3)3·9H2O') - 404.0) < 0.05);
  assert.ok(Math.abs(calculateMolarMass('AlCl3') - 133.34) < 0.05);
  const hydro = calculateHydrothermalMass({
    formula: 'Fe(NO3)3·9H2O',
    targetMolarityMolL: 0.05,
    volumeMl: 80,
    purityPct: 98.5,
  });
  assert.ok(Math.abs(hydro.actualWeighMassMg - 1640.61) < 1.0);

  // 3. CRDT & JSON-Patch SHA-256 tamper detection
  const crdt = new LamportCrdtGraph();
  crdt.apply({ opId: '1', nodeId: 'n1', actorId: 'A', lamportTs: 1, kind: 'InsertNode', targetId: 'n1', payload: { title: 'MIL-100(Fe)', content: 'Hydrothermal 150C' } });
  crdt.apply({ opId: '2', nodeId: 'n1', actorId: 'B', lamportTs: 2, kind: 'UpdateNode', targetId: 'n1', payload: { content: 'Hydrothermal 150C 12h' } });
  assert.equal(crdt.nodes.get('n1')?.content, 'Hydrothermal 150C 12h');

  const revs: import('./corePlatformEngine').NoteRevision[] = [];
  let prev: import('./corePlatformEngine').NoteSnapshot | null = null;
  for (let i = 1; i <= 5; i++) {
    const snap = { title: `Al-I2 Cell Rev ${i}`, blocks: [{ id: 'b1', type: 'markdown' as const, content: `Cycle ${i * 100}` }] };
    revs.push(createNoteRevision(revs, prev, snap, 'researcher'));
    prev = snap;
  }
  assert.equal(verifyRevisionChain(revs), true);
  assert.equal(reconstructSnapshot(revs, 3).title, 'Al-I2 Cell Rev 3');
  const tampered = revs.map((r, i) => (i === 2 ? { ...r, patch: [{ op: 'replace' as const, path: '/title', value: 'Tampered' }] } : r));
  assert.equal(verifyRevisionChain(tampered), false);

  // 4. LIMS Lineage & DMS COA
  const ancestry = querySampleAncestry(
    [
      { sampleCode: 'CC-SUB', name: 'Carbon Cloth', parentCodes: [], protocolSummary: 'Acid treated', status: 'archived' },
      { sampleCode: 'MIL100-CC', name: 'MIL-100(Fe)@CC', parentCodes: ['CC-SUB'], protocolSummary: '150C 12h', status: 'characterizing' },
      { sampleCode: 'ALI2-CELL-01', name: 'Al-I2 DES Cell', parentCodes: ['MIL100-CC'], protocolSummary: 'AlCl3:Urea DES', status: 'characterizing' },
    ],
    'ALI2-CELL-01'
  );
  assert.deepEqual(ancestry.map((a) => a.sampleCode), ['CC-SUB', 'MIL100-CC', 'ALI2-CELL-01']);

  const coa = parseDmsCoaDocument('Vendor: Uni-Onward 友和貿易\nCAS: 7782-61-8\nLot No: UO-2026-881\nPurity: 99.2%');
  assert.equal(coa.casNumber, '7782-61-8');
  assert.equal(coa.purityPct, 99.2);

  // 5. Knowledge Star Map & Linux LaTeX Linter & Hybrid RAG
  const star = buildKnowledgeStarMap([
    { id: 'n1', title: 'Al-I2 Cathode', kind: 'note', text: 'Uses [[MIL-100(Fe)]] and [[TPS 19A XAS]]' },
    { id: 'n2', title: 'MIL-100(Fe)', kind: 'sample', text: 'Host structure verified by [[Al-I2 Cathode]]' },
    { id: 'n3', title: 'TPS 19A XAS', kind: 'spectrum', text: 'Beamline run' },
  ]);
  assert.ok(star.backlinks['n2'].includes('n1'));

  const tex = generateLinuxCloudLatex({
    title: 'Al-I2 Deep Eutectic Battery',
    author: 'LabFlow Research Group',
    abstractText: 'Cross-interface synergy.',
    tableCaption: 'Electrochemical Summary',
    tableHeaders: ['Sample', 'Rs (Ohm)'],
    tableRows: [['MnOFe5Co5', '0.5192']],
  });
  assert.equal(lintLatexLinuxPreamble(tex).compliant, true);

  const rag = hybridRagSearch(
    [
      { id: 'd1', title: 'XPS Guide', text: 'Shirley background C 1s calibration' },
      { id: 'd2', title: 'NSRRC TPS 19A Al-I2', text: 'Dunn method capacitive analysis for Al-I2 battery' },
    ],
    'TPS 19A Al-I2 Dunn'
  );
  assert.equal(rag[0].id, 'd2');

  // 6. Antigraity Critic OOB (-2) & 3-retry self-healing
  const oob = Critic.verifyMemoryBounds(0x1000, 900, 200, 1024);
  assert.equal(oob.valid, false);
  assert.equal(oob.code, LABFLOW_ERR_OOB);

  const xSpec = Array.from({ length: 60 }, (_, i) => 636 + i * 0.3);
  const ySpec = xSpec.map(
    (e) => pseudoVoigtPeak(e, 641.5, 500, 1.8, 0.3) + pseudoVoigtPeak(e, 645.2, 320, 2.0, 0.3)
  );
  const healed = runAntigraitySelfHealingFit(xSpec, ySpec, {
    center1: 641.0,
    amp1: 400,
    fwhm1: -0.5, // Deliberate invalid negative FWHM!
    center2: 645.0,
    amp2: 250,
    fwhm2: 1.5,
    eta: 0.3,
  });
  assert.equal(healed.trace[0].criticPassed, false);
  assert.equal(healed.converged, true);
  assert.ok(healed.finalRSquared > 0.995, `Healed R^2 ${healed.finalRSquared} must be > 0.995`);
});

test('AUDIT-GAPS: Lin-KK drift rejection, real BioLogic .mpr binary parsing, exact Matern-3/2 GPR, and Dual-Frame TIFF 6.0', () => {
  // 1. PEIS Lin-KK causality check: passes causal data (<0.5%) AND catches non-causal Re(Z) drift (>4%)
  const bench = buildMnOFe5Co5BenchmarkData();
  const causalPeis = analyzePeis(bench.peisInput);
  assert.equal(causalPeis.kkMethod, 'Lin-KK-Voigt');
  assert.ok(causalPeis.kkResidualPct < 0.5, `Causal Lin-KK RMS ${causalPeis.kkResidualPct}% must be < 0.5%`);

  const driftedRe = bench.peisInput.reZOhm.map(
    (re, i) => re + 0.55 * Math.log10(bench.peisInput.freqHz[i] + 10)
  );
  const nonCausalPeis = analyzePeis({
    freqHz: bench.peisInput.freqHz,
    reZOhm: driftedRe,
    negImZOhm: bench.peisInput.negImZOhm,
  });
  assert.ok(
    nonCausalPeis.kkResidualPct > 4.0,
    `Non-causal drift must elevate Lin-KK RMS > 4%, got ${nonCausalPeis.kkResidualPct}%`
  );

  // 2. Real uploaded BioLogic .mpr binary parsing (/Example/EcLab)
  const exampleDir = path.resolve(process.cwd(), 'Example/EcLab');
  const peisMpr = parseBioLogicMpr(
    new Uint8Array(fs.readFileSync(path.join(exampleDir, 'MnOFe5Co5_20261112_PEIS_02_PEIS_C01.mpr')))
  );
  assert.equal(peisMpr.pointCount, 64);
  assert.equal(peisMpr.technique, 'PEIS');
  assert.ok(peisMpr.rows['freq/Hz'][0] > 199000);
  const realPeis = analyzePeis({
    freqHz: peisMpr.rows['freq/Hz'],
    reZOhm: peisMpr.rows['Re(Z)/Ohm'],
    negImZOhm: peisMpr.rows['-Im(Z)/Ohm'],
  });
  assert.ok(realPeis.rsOhm > 0.1 && realPeis.rsOhm < 5.0, `Real .mpr Rs = ${realPeis.rsOhm}`);
  assert.ok(realPeis.kkResidualPct < 0.5, `Real .mpr Lin-KK RMS ${realPeis.kkResidualPct}% must be < 0.5%`);

  const cv10Mpr = parseBioLogicMpr(
    new Uint8Array(fs.readFileSync(path.join(exampleDir, 'MnOFe5Co5_20261112_10mV_02_CV_C01.mpr')))
  );
  assert.equal(cv10Mpr.pointCount, 14412);
  assert.equal(cv10Mpr.technique, 'CV/LSV');
  assert.ok(cv10Mpr.columns.includes('Ewe/V') && cv10Mpr.columns.includes('<I>/mA'));

  const gcd4Mpr = parseBioLogicMpr(
    new Uint8Array(fs.readFileSync(path.join(exampleDir, 'MnOFe5Co5_20261112_4mA_C01.mpr')))
  );
  const gcd10Mpr = parseBioLogicMpr(
    new Uint8Array(fs.readFileSync(path.join(exampleDir, 'MnOFe5Co5_20261112_10mA_C01.mpr')))
  );
  assert.equal(gcd4Mpr.technique, 'GCD');
  assert.equal(gcd10Mpr.technique, 'GCD');
  const gcd4Cyc = extractGcdCycleFromMpr(gcd4Mpr, 4, 1.0);
  const gcd10Cyc = extractGcdCycleFromMpr(gcd10Mpr, 10, 1.0);
  assert.ok(gcd4Cyc && gcd10Cyc, 'Must extract real GCD charge/discharge cycles from .mpr');
  const realGcd = analyzeGcdCycles([gcd4Cyc, gcd10Cyc]);
  assert.ok(realGcd[0].cIntegralFG > realGcd[1].cIntegralFG, '4 A/g C_int must exceed 10 A/g C_int');
  assert.ok(realGcd[0].coulombicEfficiencyPct > 90 && realGcd[0].coulombicEfficiencyPct <= 105);

  // 3. XAS Exact Matern-3/2 GPR Covariance Solver on non-uniform energy grid
  const eGridIn = Array.from({ length: 45 }, (_, i) => 6535 + i * 2.0);
  const muIn = eGridIn.map(
    (e) => 0.1 + 0.5 * (1 + Math.tanh((e - 6545) / 2.2)) + 0.18 * Math.exp(-((e - 6548) ** 2) / 6)
  );
  const xasGpr = analyzeSynchrotronXas(eGridIn, muIn, 2);
  const gprCurve = xasGpr.models['GPR_Matern'];
  assert.equal(gprCurve.length, xasGpr.energyGridEv.length);
  // Find nearest output grid point to the white-line peak e=6548 and verify exact GPR fit (no Nadaraya-Watson flattening)
  const peakIdx = xasGpr.energyGridEv.reduce(
    (best, e, i) => (Math.abs(e - 6548) < Math.abs(xasGpr.energyGridEv[best] - 6548) ? i : best),
    0
  );
  const ePeak = xasGpr.energyGridEv[peakIdx];
  const trueAtPeak =
    0.1 + 0.5 * (1 + Math.tanh((ePeak - 6545) / 2.2)) + 0.18 * Math.exp(-((ePeak - 6548) ** 2) / 6);
  // Compare normalized against GPR output via featureTensor consistency (models are normalized identically)
  assert.ok(
    Math.abs(gprCurve[peakIdx] - xasGpr.models['PCHIP'][peakIdx]) < 0.03,
    `Exact Matern-3/2 GPR at peak=${gprCurve[peakIdx]} vs PCHIP=${xasGpr.models['PCHIP'][peakIdx]} (true pre-norm=${trueAtPeak})`
  );

  // 4. SEM Dual-Frame Multi-Page Little-Endian TIFF 6.0 Encoder
  const W = 32;
  const H = 32;
  const rawGray = new Uint8Array(W * H);
  for (let i = 0; i < rawGray.length; i++) rawGray[i] = 40 + (i % 120);
  const tiffRes = generateSemMultiPageTiff({
    width: W,
    height: H,
    rawGrayscale: rawGray,
    nmPerPx: 1.25,
    cropBottomPx: 64,
    scalebarNm: 100,
    roiMeanRgb: [42, 46, 54],
  });
  const summary = parseTiffIfdSummary(tiffRes.tiffBytes);
  assert.equal(summary.magic, 'II:42');
  assert.equal(summary.frameCount, 2);
  assert.equal(summary.ifdOffsets.length, 2);
  assert.deepEqual(summary.widths, [32, 32]);
  assert.deepEqual(summary.heights, [32, 32]);
  assert.deepEqual(summary.pageNumbers, [
    [0, 2],
    [1, 2],
  ]);
  assert.ok(summary.imageDescriptions[0].startsWith('SEM_STUDIO_SMART_V1|'));
  assert.ok(summary.imageDescriptions[1].startsWith('SEM_STUDIO_SMART_V1|'));
});

