// SPDX-License-Identifier: GPL-3.0-or-later
import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

import { packChartStateBinary } from './src/engines/mathUtils';
import {
  analyzeCvDunnTrasatti,
  analyzeGcdCycles,
  analyzeLsvTafel,
  analyzePeis,
  buildMnOFe5Co5BenchmarkData,
  parseBioLogicMpt,
} from './src/engines/electrochemEngine';
import {
  analyzeSynchrotronXas,
  analyzeWilliamsonHall,
  analyzeXpsRegion,
  convertXrdWavelength,
  pseudoVoigtPeak,
} from './src/engines/spectroscopyEngines';
import {
  analyzeAcousticSignal,
  analyzeAfmPlaneLeveling,
  analyzeBetIsotherm,
  analyzeSaedLattice2dFft,
  analyzeTgaKissinger,
  buildSemStudioSmartMetadata,
  processNmrFid,
  runNipalsPlsSem,
} from './src/engines/nmrAcousticMicroscopyThermalEngine';
import {
  buildKnowledgeStarMap,
  calculateHydrothermalMass,
  CircularFormulaDependencyError,
  createNoteRevision,
  Critic,
  evaluateReactiveSpreadsheet,
  fitOriginFdfModel,
  generateLinuxCloudLatex,
  hybridRagSearch,
  LamportCrdtGraph,
  LimsSampleNode,
  lintLatexLinuxPreamble,
  NoteRevision,
  NoteSnapshot,
  parseDmsCoaDocument,
  parseOriginFdf,
  querySampleAncestry,
  reconstructSnapshot,
  runAntigraitySelfHealingFit,
  StarMapDoc,
  verifyRevisionChain,
} from './src/engines/corePlatformEngine';

interface StoredNote {
  id: string;
  revisions: NoteRevision[];
  current: NoteSnapshot;
}

const crdtGraph = new LamportCrdtGraph();

// Seed deterministic ELN notes (with genuine SHA-256 hash chain)
function seedInitialNotes(): Map<string, StoredNote> {
  const map = new Map<string, StoredNote>();
  const s1: NoteSnapshot = {
    title: 'NSTC-2027 Al-I2 DES Battery — MIL-100(Fe)@CC Cathode Run #01',
    blocks: [
      {
        id: 'blk-1',
        type: 'markdown',
        content:
          'Hydrothermal synthesis of [[MIL-100(Fe)]] on acid-treated Carbon Cloth (150 °C, 12 h) using Fe(NO3)3·9H2O and H3BTC. Linked to [[TPS 19A XAS]] and [[MnOFe5Co5 Benchmark]].',
      },
      {
        id: 'blk-2',
        type: 'latex_math',
        content: 'C_{\\text{int}} = \\frac{2 I \\int (V(t) - V_{\\min})\\,dt}{m (\\Delta V)^2}',
      },
    ],
  };
  const rev1 = createNoteRevision([], null, s1, 'tico0321');
  const s2: NoteSnapshot = {
    title: s1.title,
    blocks: [
      ...s1.blocks,
      {
        id: 'blk-3',
        type: 'markdown',
        content:
          'PEIS zero-crossover Rs = 0.5192 Ohm; 10 mV/s Dunn capacitive contribution = 74.5%; iR-compensated Tafel R^2 = 0.9999.',
      },
    ],
  };
  const rev2 = createNoteRevision([rev1], s1, s2, 'tico0321');
  map.set('note-ali2-01', { id: 'note-ali2-01', revisions: [rev1, rev2], current: s2 });
  return map;
}

const notesStore = seedInitialNotes();

const limsSamples: LimsSampleNode[] = [
  {
    sampleCode: 'REAG-FE-7782',
    name: 'Fe(NO3)3·9H2O (98.5%, Uni-Onward)',
    parentCodes: [],
    reagentLot: 'UO-2026-881',
    protocolSummary: 'Precursor salt CAS 7782-61-8',
    status: 'archived',
  },
  {
    sampleCode: 'CC-ACID-01',
    name: 'HNO3-Treated Carbon Cloth Substrate',
    parentCodes: [],
    protocolSummary: 'Refluxed 3M HNO3 80°C 4h, DI/EtOH washed',
    status: 'archived',
  },
  {
    sampleCode: 'MIL100-CC-01',
    name: 'MIL-100(Fe)@CC Hierarchical Host',
    parentCodes: ['REAG-FE-7782', 'CC-ACID-01'],
    protocolSummary: '80 mL autoclave 150°C 12h, vacuum dried 80°C',
    facilityBeamline: 'NSRRC TPS 19A / XPS',
    status: 'characterizing',
  },
  {
    sampleCode: 'LF-20261114-ALI2-001',
    name: 'Al-I2 Fluorine-Free DES Full Cell',
    parentCodes: ['MIL100-CC-01'],
    protocolSummary: 'AlCl3:Urea (1.3:1) DES + KI redox mediator, 500 cycles',
    facilityBeamline: 'NSRRC TPS 44A1 In-Situ XAS',
    status: 'characterizing',
  },
  {
    sampleCode: 'MnOFe5Co5_20261112',
    name: 'MnO-Fe5-Co5@Ni Foam Reference Electrode',
    parentCodes: ['CC-ACID-01'],
    protocolSummary: 'EC-Lab v11.61 CV/GCD/PEIS/LSV Benchmark',
    facilityBeamline: 'BioLogic VSP-300',
    status: 'characterizing',
  },
];

const starMapSeedDocs: StarMapDoc[] = [
  {
    id: 'note-ali2-01',
    title: 'Al-I2 DES Cathode',
    kind: 'note',
    text: 'Host [[MIL-100(Fe)]] evaluated with [[TPS 19A XAS]] and [[MnOFe5Co5 Benchmark]] plus [[NSTC 2027 Proposal]].',
  },
  {
    id: 'sample-mil100',
    title: 'MIL-100(Fe)',
    kind: 'sample',
    text: 'Hydrothermal MOF host for [[Al-I2 DES Cathode]] and [[XPS Mn/Fe 2p Fit]].',
  },
  {
    id: 'spec-xas-19a',
    title: 'TPS 19A XAS',
    kind: 'spectrum',
    text: '7-model AIC regridding and EXAFS FT for [[Al-I2 DES Cathode]] and [[MIL-100(Fe)]].',
  },
  {
    id: 'spec-ec-bench',
    title: 'MnOFe5Co5 Benchmark',
    kind: 'spectrum',
    text: 'Dunn capacitive + PEIS Rs=0.5192 Ohm reference linked to [[Al-I2 DES Cathode]].',
  },
  {
    id: 'zotero-nstc-2027',
    title: 'NSTC 2027 Proposal',
    kind: 'zotero',
    text: 'Fluorine-free Al-I2 deep eutectic battery architecture citing [[Al-I2 DES Cathode]] and [[Zotero: Dunn 2007]].',
  },
  {
    id: 'zotero-dunn-2007',
    title: 'Zotero: Dunn 2007',
    kind: 'zotero',
    text: 'Quantitative capacitive vs diffusion-controlled current separation cited by [[MnOFe5Co5 Benchmark]].',
  },
  {
    id: 'spec-xps-fit',
    title: 'XPS Mn/Fe 2p Fit',
    kind: 'spectrum',
    text: 'Shirley background + 2:1 doublet fit for [[MIL-100(Fe)]].',
  },
];

function sendProblem(res: Response, status: number, title: string, detail: string, instance: string) {
  res.status(status).json({
    type: 'https://labflow.science/errors/validation',
    title,
    status,
    detail,
    instance,
    trace_id: `lf-${Date.now().toString(36)}`,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', version: '4.0.0', engines: 14 });
  });

  // 14.A Electrochemistry
  app.post('/api/v1/electrochem/analyze', (req: Request, res: Response) => {
    try {
      const { rawMpt } = req.body ?? {};
      const bench = buildMnOFe5Co5BenchmarkData();
      const parsedMpt = typeof rawMpt === 'string' && rawMpt.trim() ? parseBioLogicMpt(rawMpt) : null;
      const cv = analyzeCvDunnTrasatti(bench.cvScans, 10);
      const gcd = analyzeGcdCycles(bench.gcdInputs);
      const peis = analyzePeis(bench.peisInput);
      const tafel = analyzeLsvTafel(bench.lsvV, bench.lsvI, peis.rsOhm);
      const physicsCheck = Critic.verifyPhysics({
        rsOhm: peis.rsOhm,
        rctOhm: peis.rctEstimateOhm,
        capacitivePct: cv.dunnByScanRate.find((d) => d.scanRateMvS === 10)?.capacitivePct,
      });
      res.json({ parsedMpt, cv, gcd, peis, tafel, cvScans: bench.cvScans, critic: physicsCheck });
    } catch (err) {
      sendProblem(res, 400, 'Electrochemistry Error', String(err), req.path);
    }
  });

  // 14.B XRD
  app.post('/api/v1/xrd/convert', (req: Request, res: Response) => {
    try {
      const {
        twoTheta,
        intensity,
        lambdaSrc = 0.77491,
        lambdaDst = 1.5418,
        stepDeg = 0.02,
      } = req.body ?? {};
      const srcX: number[] =
        Array.isArray(twoTheta) && twoTheta.length >= 3
          ? twoTheta
          : Array.from({ length: 171 }, (_, i) => 5 + i * 0.5);
      const srcY: number[] =
        Array.isArray(intensity) && intensity.length === srcX.length
          ? intensity
          : srcX.map(
              (t) =>
                80 +
                950 * Math.exp(-((t - 14.1) ** 2) / 0.14) +
                640 * Math.exp(-((t - 21.6) ** 2) / 0.18) +
                420 * Math.exp(-((t - 28.9) ** 2) / 0.22)
            );
      const converted = convertXrdWavelength(srcX, srcY, lambdaSrc, lambdaDst, stepDeg);
      const wh = analyzeWilliamsonHall([28.4, 36.1, 47.3, 56.1], [0.22, 0.25, 0.31, 0.36], lambdaDst);
      res.json({ srcX, srcY, converted, williamsonHall: wh });
    } catch (err) {
      sendProblem(res, 400, 'XRD Conversion Error', String(err), req.path);
    }
  });

  // 14.C XAS
  app.post('/api/v1/xas/regrid-tensor', (req: Request, res: Response) => {
    try {
      const { kWeight = 2 } = req.body ?? {};
      const eXanes = Array.from({ length: 80 }, (_, i) => 6530 + i * 0.25);
      const eExafs = Array.from({ length: 60 }, (_, i) => 6550 + i * 2.0);
      const energy = [...eXanes, ...eExafs];
      const e0True = 6545.0;
      const muRaw = energy.map((e) => {
        const step = 0.5 * (1 + Math.tanh((e - e0True) / 2.2));
        const whiteLine = 0.42 * Math.exp(-((e - (e0True + 3.2)) ** 2) / 5.5);
        const k = e > e0True ? Math.sqrt(0.2624684 * (e - e0True)) : 0;
        const exafs = e > e0True ? 0.08 * Math.exp(-0.035 * k * k) * Math.sin(2 * 2.08 * k) : 0;
        return 0.14 + step + whiteLine + exafs;
      });
      const result = analyzeSynchrotronXas(energy, muRaw, kWeight);
      res.json({ energyRaw: energy, muRaw, ...result });
    } catch (err) {
      sendProblem(res, 400, 'XAS Tensor Error', String(err), req.path);
    }
  });

  // 14.D XPS
  app.post('/api/v1/xps/deconvolve', (req: Request, res: Response) => {
    try {
      const { backgroundMethod = 'shirley', measuredC1sEv = 285.1 } = req.body ?? {};
      const be = Array.from({ length: 120 }, (_, i) => 634 + i * 0.2);
      const counts = be.map((e) => {
        const stepBg = 220 + 180 / (1 + Math.exp(-(e - 643) / 1.5));
        const p1 = pseudoVoigtPeak(e, 641.8, 1200, 1.8, 0.3);
        const p2 = pseudoVoigtPeak(e, 653.5, 600, 1.8, 0.3);
        return stepBg + p1 + p2;
      });
      const result = analyzeXpsRegion(be, counts, {
        measuredC1sEv,
        referenceC1sEv: 284.8,
        backgroundMethod,
        spinOrbitRatio: 2.0,
        doubletSplitEv: 11.7,
        initialCentersEv: [641.5, 653.2],
      });
      res.json(result);
    } catch (err) {
      sendProblem(res, 400, 'XPS Deconvolution Error', String(err), req.path);
    }
  });

  // 14.E NMR
  app.post('/api/v1/nmr/process-fid', (req: Request, res: Response) => {
    try {
      const { lbHz = 1.5 } = req.body ?? {};
      const swHz = 4000;
      const nFid = 1024;
      const phiErr = (35 * Math.PI) / 180;
      const fidRe: number[] = [];
      const fidIm: number[] = [];
      for (let i = 0; i < nFid; i++) {
        const t = i / swHz;
        const decay = Math.exp(-8 * t);
        const sRe = 3 * Math.cos(2 * Math.PI * 420 * t) + 1 * Math.cos(2 * Math.PI * -580 * t);
        const sIm = 3 * Math.sin(2 * Math.PI * 420 * t) + 1 * Math.sin(2 * Math.PI * -580 * t);
        fidRe.push(decay * (sRe * Math.cos(phiErr) - sIm * Math.sin(phiErr)));
        fidIm.push(decay * (sRe * Math.sin(phiErr) + sIm * Math.cos(phiErr)));
      }
      const nmr = processNmrFid(fidRe, fidIm, swHz, 400, lbHz);
      res.json(nmr);
    } catch (err) {
      sendProblem(res, 400, 'NMR Error', String(err), req.path);
    }
  });

  // 10 Acoustic
  app.post('/api/v1/audio/extract-features', (req: Request, res: Response) => {
    try {
      const { f0Target = 220 } = req.body ?? {};
      const sr = 16000;
      const audio = Array.from({ length: 2400 }, (_, i) => {
        const t = i / sr;
        return (
          0.6 * Math.sin(2 * Math.PI * f0Target * t) +
          0.3 * Math.sin(2 * Math.PI * f0Target * 2 * t) +
          0.15 * Math.sin(2 * Math.PI * f0Target * 3 * t)
        );
      });
      res.json({ features: analyzeAcousticSignal(audio, sr), waveformPreview: audio.slice(0, 320) });
    } catch (err) {
      sendProblem(res, 400, 'Acoustic Error', String(err), req.path);
    }
  });

  // 14.F SEM / SAED / AFM
  app.post('/api/v1/sem-spm/standardize', (req: Request, res: Response) => {
    try {
      const { nmPerPx = 1.25, scalebarNm = 100, dLatticeNm = 0.245 } = req.body ?? {};
      const semMeta = buildSemStudioSmartMetadata({
        nmPerPx,
        cropBottomPx: 64,
        scalebarNm,
        roiMeanRgb: [42, 46, 54],
      });
      const N = 64;
      const pxNm = 0.025;
      const hrtem = Array.from({ length: N }, (_, y) =>
        Array.from({ length: N }, (_, x) => Math.cos((2 * Math.PI * (x * pxNm)) / dLatticeNm))
      );
      const saed = analyzeSaedLattice2dFft(hrtem, pxNm);
      const afmRaw = Array.from({ length: 24 }, (_, y) =>
        Array.from({ length: 24 }, (_, x) => 0.45 * x - 0.28 * y + 1.8 * Math.sin(x * 0.5) * Math.cos(y * 0.4))
      );
      const afm = analyzeAfmPlaneLeveling(afmRaw);
      res.json({ semMeta, saed, afm });
    } catch (err) {
      sendProblem(res, 400, 'Microscopy Error', String(err), req.path);
    }
  });

  // 14.G Thermal / BET / PLS-SEM
  app.post('/api/v1/thermal-porosity/analyze', (_req: Request, res: Response) => {
    const pOverP0 = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.45, 0.65, 0.85, 0.94];
    const vmTrue = 120.0;
    const cTrue = 85.0;
    const vol = pOverP0.map((p) => (vmTrue * cTrue * p) / ((1 - p) * (1 + (cTrue - 1) * p)));
    const bet = analyzeBetIsotherm(pOverP0, vol);
    const tga = analyzeTgaKissinger([5, 10, 20], [520, 535, 551]);
    const obs = Array.from({ length: 30 }, (_, i) => (i - 14.5) / 8);
    const pls = runNipalsPlsSem([
      { name: 'HostPorosity', indicators: obs.map((z) => [z * 0.9 + 0.05, z * 0.85 - 0.04]) },
      { name: 'ElectrolyteDES', indicators: obs.map((z) => [z * 0.7 + 0.1, z * 0.75 + 0.08]) },
      { name: 'CycleRetention', indicators: obs.map((z) => [z * 0.88, z * 0.91]) },
    ]);
    res.json({ pOverP0, volumeStp: vol, bet, tga, pls });
  });

  // 1. Reactive Spreadsheet & Origin .fdf
  app.post('/api/v1/spreadsheet/evaluate', (req: Request, res: Response) => {
    try {
      const { columns, fdfText, fitXCol, fitYCol } = req.body ?? {};
      const evaluated = evaluateReactiveSpreadsheet(columns);
      let fdfFit = null;
      if (typeof fdfText === 'string' && fdfText.trim()) {
        const model = parseOriginFdf(fdfText);
        const xCol = evaluated.find((c) => c.id === fitXCol) ?? evaluated[0];
        const yCol = evaluated.find((c) => c.id === fitYCol) ?? evaluated[1];
        if (xCol && yCol && xCol.values.length >= 4) {
          const maxY = Math.max(...yCol.values);
          const minY = Math.min(...yCol.values);
          const xAtMax = xCol.values[yCol.values.indexOf(maxY)] ?? 0;
          fdfFit = fitOriginFdfModel(model, xCol.values, yCol.values, [minY, maxY - minY, xAtMax, 0.8]);
        }
      }
      res.json({ columns: evaluated, fdfFit });
    } catch (err) {
      if (err instanceof CircularFormulaDependencyError) {
        return sendProblem(res, 422, 'Circular Formula Dependency', err.message, req.path);
      }
      sendProblem(res, 400, 'Spreadsheet Error', String(err), req.path);
    }
  });

  // 2 & 4. Notes & Versioning + LIMS
  app.get('/api/v1/notes', (_req: Request, res: Response) => {
    const list = Array.from(notesStore.values()).map((n) => ({
      id: n.id,
      title: n.current.title,
      blocks: n.current.blocks,
      revisions: n.revisions,
      integrityValid: verifyRevisionChain(n.revisions),
    }));
    res.json({ notes: list });
  });

  app.post('/api/v1/notes', (req: Request, res: Response) => {
    const { title, blocks, authorId = 'researcher' } = req.body ?? {};
    if (!title) return sendProblem(res, 400, 'Missing Title', 'title is required', req.path);
    const id = `note-${Date.now().toString(36)}`;
    const snap: NoteSnapshot = { title, blocks: Array.isArray(blocks) ? blocks : [] };
    const rev = createNoteRevision([], null, snap, authorId);
    notesStore.set(id, { id, revisions: [rev], current: snap });
    res.status(201).json({ id, current: snap, revisions: [rev], integrityValid: true });
  });

  app.patch('/api/v1/notes/:id', (req: Request, res: Response) => {
    const note = notesStore.get(req.params.id);
    if (!note) return sendProblem(res, 404, 'Not Found', `Note ${req.params.id} not found`, req.path);
    const { title, blocks, authorId = 'researcher' } = req.body ?? {};
    const nextSnap: NoteSnapshot = {
      title: title ?? note.current.title,
      blocks: Array.isArray(blocks) ? blocks : note.current.blocks,
    };
    const rev = createNoteRevision(note.revisions, note.current, nextSnap, authorId);
    note.revisions.push(rev);
    note.current = nextSnap;
    res.json({
      id: note.id,
      current: note.current,
      revisions: note.revisions,
      integrityValid: verifyRevisionChain(note.revisions),
    });
  });

  app.get('/api/v1/notes/:id/reconstruct/:rev', (req: Request, res: Response) => {
    const note = notesStore.get(req.params.id);
    if (!note) return sendProblem(res, 404, 'Not Found', 'Note not found', req.path);
    const revNum = parseInt(req.params.rev, 10);
    res.json({
      revisionNumber: revNum,
      snapshot: reconstructSnapshot(note.revisions, revNum),
      integrityValid: verifyRevisionChain(note.revisions),
    });
  });

  app.get('/api/v1/lims/samples', (req: Request, res: Response) => {
    const target = typeof req.query.ancestryOf === 'string' ? req.query.ancestryOf : 'LF-20261114-ALI2-001';
    res.json({ samples: limsSamples, ancestry: querySampleAncestry(limsSamples, target) });
  });

  app.post('/api/v1/chem/stoichiometry', (req: Request, res: Response) => {
    try {
      const { formula = 'Fe(NO3)3·9H2O', targetMolarityMolL = 0.05, volumeMl = 80, purityPct = 98.5 } = req.body ?? {};
      res.json(calculateHydrothermalMass({ formula, targetMolarityMolL, volumeMl, purityPct }));
    } catch (err) {
      sendProblem(res, 400, 'Chemistry Formula Error', String(err), req.path);
    }
  });

  app.post('/api/v1/dms/parse-coa', (req: Request, res: Response) => {
    const { text = '' } = req.body ?? {};
    if (!text.trim()) return sendProblem(res, 400, 'Empty Document', 'COA text is required', req.path);
    res.json(parseDmsCoaDocument(text));
  });

  // 7. Star Map
  app.post('/api/v1/starmap/build', (req: Request, res: Response) => {
    const docs: StarMapDoc[] = Array.isArray(req.body?.docs) ? req.body.docs : starMapSeedDocs;
    res.json(buildKnowledgeStarMap(docs, 760, 460));
  });

  // 5. Linux LaTeX
  app.post('/api/v1/latex/generate', (req: Request, res: Response) => {
    const {
      title = 'Fluorine-Free Deep Eutectic Al-I2 Battery with MIL-100(Fe) Host',
      author = 'LabFlow Research Group',
      abstractText = 'Cross-interface synergistic kinetics validated by CV Dunn separation (74.5%), PEIS zero-crossover (Rs = 0.5192 Ohm), and synchrotron XAS 7-model AIC fusion.',
      tableCaption = 'Electrochemical Performance Summary (MnOFe5Co5 & Al-I2)',
      tableHeaders = ['Sample', 'Rs (Ohm)', 'Cap@10mV/s (%)', 'C_int (F/g)'],
      tableRows = [
        ['MnOFe5Co5', '0.5192', '74.5', '43.51'],
        ['MIL-100(Fe)@CC', '0.6840', '68.2', '51.20'],
      ],
    } = req.body ?? {};
    const tex = generateLinuxCloudLatex({ title, author, abstractText, tableCaption, tableHeaders, tableRows });
    const lint = lintLatexLinuxPreamble(tex);
    res.json({ tex, lint });
  });

  // 11 & 12. Hybrid RAG & Antigraity ToT + Critic
  app.post('/api/v1/rag/search', (req: Request, res: Response) => {
    const { query = 'TPS 19A Al-I2 Dunn' } = req.body ?? {};
    const corpus = starMapSeedDocs.map((d) => ({ id: d.id, title: d.title, text: d.text }));
    res.json({ results: hybridRagSearch(corpus, query, 4) });
  });

  app.post('/api/v1/antigraity/solve', (req: Request, res: Response) => {
    const { fwhm1 = -0.5, fwhm2 = 1.5, testOffset = 100, testLimit = 1024 } = req.body ?? {};
    const xSpec = Array.from({ length: 60 }, (_, i) => 636 + i * 0.3);
    const ySpec = xSpec.map(
      (e) => pseudoVoigtPeak(e, 641.5, 500, 1.8, 0.3) + pseudoVoigtPeak(e, 645.2, 320, 2.0, 0.3)
    );
    const memGuard = Critic.verifyMemoryBounds(0x1000, testOffset, 128, testLimit);
    const tot = runAntigraitySelfHealingFit(xSpec, ySpec, {
      center1: 641.0,
      amp1: 400,
      fwhm1,
      center2: 645.0,
      amp2: 250,
      fwhm2,
      eta: 0.3,
    });
    res.json({ xSpec, ySpec, memGuard, tot });
  });

  // Vite middleware or static dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // WebSocket Hub (/ws/v1/stream) supporting Binary ChartState (<Idddd) & CRDT JSON
  const wss = new WebSocketServer({ server, path: '/ws/v1/stream' });
  wss.on('connection', (ws: WebSocket) => {
    // Send an initial binary ChartState calibration frame
    const xs = Array.from({ length: 64 }, (_, i) => (i / 63) * 0.8);
    const ys = xs.map((v) => Math.sin((Math.PI * v) / 0.8) * 1.45);
    ws.send(packChartStateBinary(1, 0, 0.8, 0, 1.45, xs, ys));

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        ws.send(data, { binary: true });
        return;
      }
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'crdt_op' && msg.op) {
          crdtGraph.apply(msg.op);
          ws.send(JSON.stringify({ type: 'crdt_ack', clock: crdtGraph.clock }));
        } else if (msg.type === 'request_binary_frame') {
          const phase = Number(msg.phase ?? 0);
          const xs2 = Array.from({ length: 64 }, (_, i) => (i / 63) * 10);
          const ys2 = xs2.map((x) => Math.sin(x + phase) * Math.exp(-0.08 * x));
          ws.send(packChartStateBinary(2, 0, 10, -1, 1, xs2, ys2));
        }
      } catch {
        // Ignore malformed frame
      }
    });
  });

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LabFlow Scientific OS listening on http://localhost:${PORT}`);
  });
}

startServer();
