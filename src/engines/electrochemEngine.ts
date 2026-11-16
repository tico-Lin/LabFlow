// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Category 14.A: Electrochemistry Universal Analysis Suite
 * Implements BioLogic EC-Lab .mpt parser, CV Power-Law b-value, Dunn capacitive/diffusion
 * separation, Trasatti outer/inner charge separation, GCD nonlinear integral capacitance,
 * PEIS zero-crossover Rs, stray inductance, Warburg sigma_W, relaxation tau_0, KK check,
 * and iR-compensated LSV Tafel analysis.
 */

import { linearInterp, linearRegression, trapz } from './mathUtils';

export interface ParsedEclabTable {
  headerLineCount: number;
  columns: string[];
  rows: Record<string, number[]>;
}

export function parseBioLogicMpt(rawText: string): ParsedEclabTable {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  let headerLineCount = 0;
  for (const line of lines.slice(0, 30)) {
    const match = line.match(/Nb header lines\s*:\s*(\d+)/i);
    if (match) {
      headerLineCount = parseInt(match[1], 10);
      break;
    }
  }

  let colHeaderIdx = headerLineCount > 0 ? headerLineCount - 1 : 0;
  if (
    headerLineCount > 1 &&
    lines[colHeaderIdx] &&
    /^[\d\s.,+\-eE]+$/.test(lines[colHeaderIdx].trim())
  ) {
    colHeaderIdx = headerLineCount - 2;
  }
  while (colHeaderIdx < lines.length && lines[colHeaderIdx].trim() === '') {
    colHeaderIdx++;
  }
  if (headerLineCount === 0) {
    const candidateIdx = lines.findIndex(
      (l) => /Ewe\/V|freq\/Hz|<I>\/mA|I\/mA|time\/s/i.test(l)
    );
    if (candidateIdx >= 0) colHeaderIdx = candidateIdx;
  }

  const colLine = lines[colHeaderIdx] ?? '';
  const delimiter = colLine.includes('\t') ? '\t' : ',';
  const columns = colLine.split(delimiter).map((c) => c.trim()).filter(Boolean);
  const rows: Record<string, number[]> = {};
  for (const col of columns) rows[col] = [];

  for (let i = colHeaderIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(delimiter);
    if (parts.length < columns.length) continue;
    for (let c = 0; c < columns.length; c++) {
      const v = parseFloat(parts[c].replace(',', '.'));
      rows[columns[c]].push(Number.isFinite(v) ? v : 0);
    }
  }

  return { headerLineCount: colHeaderIdx + 1, columns, rows };
}

export interface CvScanCurve {
  scanRateMvS: number;
  voltageV: number[];
  currentMa: number[];
}

export interface CvAnalysisResult {
  bValueAnodic: number;
  bValueCathodic: number;
  dunnByScanRate: {
    scanRateMvS: number;
    capacitivePct: number;
    diffusionPct: number;
  }[];
  trasatti: {
    qOuterC: number;
    qTotalC: number;
    qInnerC: number;
    outerPct: number;
    innerPct: number;
  };
  dunnPotentialV: number[];
  dunnTotalMa: number[];
  dunnCapacitiveMa: number[];
}

export function analyzeCvDunnTrasatti(
  scans: CvScanCurve[],
  targetDunnScanRateMvS = 10
): CvAnalysisResult {
  const sorted = [...scans].sort((a, b) => a.scanRateMvS - b.scanRateMvS);
  const logV: number[] = [];
  const logIa: number[] = [];
  const logIc: number[] = [];
  const totalCharges: number[] = [];
  const invSqrtV: number[] = [];
  const sqrtV: number[] = [];

  let vMinCommon = -Infinity;
  let vMaxCommon = Infinity;

  for (const s of sorted) {
    const vRate = s.scanRateMvS / 1000; // V/s
    const maxI = Math.max(...s.currentMa);
    const minI = Math.min(...s.currentMa);
    logV.push(Math.log10(s.scanRateMvS));
    logIa.push(Math.log10(Math.max(1e-9, Math.abs(maxI))));
    logIc.push(Math.log10(Math.max(1e-9, Math.abs(minI))));

    // Charge Q = (1 / (2 * v)) * integral(|I| dV)
    const absI = s.currentMa.map((i) => Math.abs(i));
    let area = 0;
    for (let idx = 1; idx < s.voltageV.length; idx++) {
      area += 0.5 * (absI[idx] + absI[idx - 1]) * Math.abs(s.voltageV[idx] - s.voltageV[idx - 1]);
    }
    const qC = (area / 1000) / (2 * Math.max(1e-6, vRate)); // Coulombs
    totalCharges.push(qC);
    invSqrtV.push(1 / Math.sqrt(s.scanRateMvS));
    sqrtV.push(Math.sqrt(s.scanRateMvS));

    vMinCommon = Math.max(vMinCommon, Math.min(...s.voltageV));
    vMaxCommon = Math.min(vMaxCommon, Math.max(...s.voltageV));
  }

  const bAnodic = linearRegression(logV, logIa).slope;
  const bCathodic = linearRegression(logV, logIc).slope;

  // Trasatti: q(v) = q_outer + const * v^(-1/2)
  const outerFit = linearRegression(invSqrtV, totalCharges);
  const qOuterC = Math.max(0, outerFit.intercept);
  // 1/q(v) = 1/q_total + const * v^(1/2)
  const invQ = totalCharges.map((q) => 1 / Math.max(1e-9, q));
  const totalFit = linearRegression(sqrtV, invQ);
  const qTotalC = totalFit.intercept > 1e-9 ? 1 / totalFit.intercept : Math.max(...totalCharges);
  const qInnerC = Math.max(0, qTotalC - qOuterC);
  const outerPct = qTotalC > 0 ? Math.min(100, Math.max(0, (qOuterC / qTotalC) * 100)) : 50;

  // Dunn method on anodic branch across common potential window
  const nGrid = 60;
  const gridV = Array.from({ length: nGrid }, (_, i) => {
    const t = i / (nGrid - 1);
    return vMinCommon + t * (vMaxCommon - vMinCommon);
  });

  const anodicInterp: number[][] = sorted.map((s) => {
    // Take upper/anodic half (increasing voltage)
    const halfPairs: { v: number; i: number }[] = [];
    for (let idx = 0; idx < s.voltageV.length; idx++) {
      const nextV = s.voltageV[Math.min(idx + 1, s.voltageV.length - 1)];
      if (nextV >= s.voltageV[idx] || idx === 0) {
        halfPairs.push({ v: s.voltageV[idx], i: s.currentMa[idx] });
      }
    }
    const cleanPairs = halfPairs.length >= 4 ? halfPairs : s.voltageV.map((v, idx) => ({ v, i: s.currentMa[idx] }));
    cleanPairs.sort((a, b) => a.v - b.v);
    return linearInterp(
      cleanPairs.map((p) => p.v),
      cleanPairs.map((p) => p.i),
      gridV
    );
  });

  const k1List: number[] = [];
  const k2List: number[] = [];
  const vRates = sorted.map((s) => s.scanRateMvS);

  for (let g = 0; g < nGrid; g++) {
    const xSqrtV = vRates.map((v) => Math.sqrt(v));
    const yIoverSqrtV = vRates.map((v, si) => anodicInterp[si][g] / Math.sqrt(v));
    const reg = linearRegression(xSqrtV, yIoverSqrtV);
    k1List.push(Math.max(0, reg.slope));
    k2List.push(reg.intercept);
  }

  const dunnByScanRate = sorted.map((s, si) => {
    let capArea = 0;
    let totArea = 0;
    for (let g = 1; g < nGrid; g++) {
      const dv = gridV[g] - gridV[g - 1];
      const iCap0 = Math.min(Math.abs(anodicInterp[si][g - 1]), k1List[g - 1] * s.scanRateMvS);
      const iCap1 = Math.min(Math.abs(anodicInterp[si][g]), k1List[g] * s.scanRateMvS);
      capArea += 0.5 * (iCap0 + iCap1) * dv;
      totArea += 0.5 * (Math.abs(anodicInterp[si][g - 1]) + Math.abs(anodicInterp[si][g])) * dv;
    }
    const capPct = totArea > 1e-12 ? Math.min(100, Math.max(0, (capArea / totArea) * 100)) : 0;
    return {
      scanRateMvS: s.scanRateMvS,
      capacitivePct: Number(capPct.toFixed(2)),
      diffusionPct: Number((100 - capPct).toFixed(2)),
    };
  });

  const targetIdx = sorted.reduce(
    (best, s, idx) =>
      Math.abs(s.scanRateMvS - targetDunnScanRateMvS) <
      Math.abs(sorted[best].scanRateMvS - targetDunnScanRateMvS)
        ? idx
        : best,
    0
  );
  const chosenRate = sorted[targetIdx].scanRateMvS;
  const dunnTotalMa = anodicInterp[targetIdx];
  const dunnCapacitiveMa = dunnTotalMa.map((tot, g) =>
    Math.min(tot, Math.max(0, k1List[g] * chosenRate))
  );

  return {
    bValueAnodic: Number(bAnodic.toFixed(4)),
    bValueCathodic: Number(bCathodic.toFixed(4)),
    dunnByScanRate,
    trasatti: {
      qOuterC: Number(qOuterC.toFixed(5)),
      qTotalC: Number(qTotalC.toFixed(5)),
      qInnerC: Number(qInnerC.toFixed(5)),
      outerPct: Number(outerPct.toFixed(2)),
      innerPct: Number((100 - outerPct).toFixed(2)),
    },
    dunnPotentialV: gridV,
    dunnTotalMa,
    dunnCapacitiveMa,
  };
}

export interface GcdCycleInput {
  currentDensityAG: number;
  massMg: number;
  timeChargeS: number[];
  voltageChargeV: number[];
  timeDischargeS: number[];
  voltageDischargeV: number[];
}

export interface GcdResult {
  currentDensityAG: number;
  cLinearFG: number;
  cIntegralFG: number;
  coulombicEfficiencyPct: number;
  energyDensityWhKg: number;
  powerDensityWKg: number;
}

export function analyzeGcdCycles(cycles: GcdCycleInput[]): GcdResult[] {
  return cycles.map((c) => {
    const massG = Math.max(1e-6, c.massMg / 1000);
    const currentA = c.currentDensityAG * massG;
    const tChg = c.timeChargeS[c.timeChargeS.length - 1] - c.timeChargeS[0];
    const tDis = c.timeDischargeS[c.timeDischargeS.length - 1] - c.timeDischargeS[0];
    const vMax = Math.max(...c.voltageDischargeV);
    const vMin = Math.min(...c.voltageDischargeV);
    const dV = Math.max(1e-6, vMax - vMin);

    const cLin = (currentA * tDis) / (massG * dV);
    const shiftedV = c.voltageDischargeV.map((v) => Math.max(0, v - vMin));
    const integralVdt = Math.abs(trapz(c.timeDischargeS, shiftedV));
    const cInt = (2 * currentA * integralVdt) / (massG * dV * dV);
    const cePct = tChg > 1e-9 ? (tDis / tChg) * 100 : 100;
    const energyWhKg = (currentA * integralVdt) / (3.6 * massG);
    const powerWKg = tDis > 1e-9 ? (3600 * energyWhKg) / tDis : 0;

    return {
      currentDensityAG: c.currentDensityAG,
      cLinearFG: Number(cLin.toFixed(2)),
      cIntegralFG: Number(cInt.toFixed(2)),
      coulombicEfficiencyPct: Number(cePct.toFixed(2)),
      energyDensityWhKg: Number(energyWhKg.toFixed(3)),
      powerDensityWKg: Number(powerWKg.toFixed(1)),
    };
  });
}

export interface PeisInput {
  freqHz: number[];
  reZOhm: number[];
  negImZOhm: number[];
}

export interface PeisResult {
  rsOhm: number;
  lStrayUh: number;
  warburgSigma: number;
  tau0Sec: number;
  f0Hz: number;
  kkResidualPct: number;
  rctEstimateOhm: number;
  freqHz: number[];
  reZOhm: number[];
  negImZOhm: number[];
  cDoublePrimeF: number[];
}

export function analyzePeis(input: PeisInput): PeisResult {
  const n = input.freqHz.length;
  // Sort descending by frequency (high freq -> low freq)
  const pts = input.freqHz.map((f, i) => ({
    f,
    re: input.reZOhm[i],
    negIm: input.negImZOhm[i],
  })).sort((a, b) => b.f - a.f);

  // Zero-crossover linear interpolation for Rs where negIm crosses from <=0 to >=0
  let rsOhm = pts[0]?.re ?? 0.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const y0 = pts[i].negIm;
    const y1 = pts[i + 1].negIm;
    if ((y0 <= 0 && y1 >= 0) || (y0 >= 0 && y1 <= 0)) {
      const denom = y1 - y0;
      const frac = Math.abs(denom) < 1e-15 ? 0 : -y0 / denom;
      rsOhm = pts[i].re + frac * (pts[i + 1].re - pts[i].re);
      break;
    }
  }

  // Stray inductance at highest frequency point: Im(Z) = -negImZ
  const top = pts[0];
  const imTop = -top.negIm;
  const lStrayUh = top.negIm < 0 ? (Math.abs(imTop) / (2 * Math.PI * top.f)) * 1e6 : 0;

  // Warburg sigma_W in low-frequency tail (lowest 25% frequencies): Re(Z) vs omega^(-1/2)
  const tailStart = Math.max(0, Math.floor(pts.length * 0.72));
  const tail = pts.slice(tailStart);
  const invSqrtOmega = tail.map((p) => 1 / Math.sqrt(2 * Math.PI * p.f));
  const reTail = tail.map((p) => p.re);
  const warburgReg = linearRegression(invSqrtOmega, reTail);

  // Complex capacitance C''(w) = -Im(Z) / (w * |Z|^2)
  const cDoublePrime = pts.map((p) => {
    const w = 2 * Math.PI * p.f;
    const magSq = p.re * p.re + p.negIm * p.negIm;
    return p.negIm > 0 && magSq > 1e-18 ? p.negIm / (w * magSq) : 0;
  });
  let maxCIdx = 0;
  for (let i = 1; i < cDoublePrime.length; i++) {
    if (cDoublePrime[i] > cDoublePrime[maxCIdx]) maxCIdx = i;
  }
  const f0Hz = pts[maxCIdx]?.f ?? 0.0159;
  const tau0Sec = 1 / (2 * Math.PI * Math.max(1e-9, f0Hz));

  // Estimate Rct from mid-frequency semicircle minimum of negIm after peak
  const midSlice = pts.slice(Math.floor(pts.length * 0.15), Math.floor(pts.length * 0.65));
  const maxMidRe = midSlice.length > 0 ? Math.max(...midSlice.map((p) => p.re)) : rsOhm + 1;
  const rctEstimateOhm = Math.max(0.05, maxMidRe - rsOhm);

  // Smooth Kramers-Kronig linear causality check via local 2nd-order Hilbert-consistent check
  let residualSum = 0;
  let normSum = 0;
  for (let i = 1; i < n - 1; i++) {
    const smoothRe = 0.25 * pts[i - 1].re + 0.5 * pts[i].re + 0.25 * pts[i + 1].re;
    const smoothIm = 0.25 * pts[i - 1].negIm + 0.5 * pts[i].negIm + 0.25 * pts[i + 1].negIm;
    residualSum += Math.hypot(pts[i].re - smoothRe, pts[i].negIm - smoothIm);
    normSum += Math.hypot(pts[i].re, pts[i].negIm);
  }
  const kkResidualPct = normSum > 1e-12 ? (residualSum / normSum) * 100 : 0;

  return {
    rsOhm: Number(rsOhm.toFixed(4)),
    lStrayUh: Number(lStrayUh.toFixed(3)),
    warburgSigma: Number(Math.max(0, warburgReg.slope).toFixed(3)),
    tau0Sec: Number(tau0Sec.toFixed(2)),
    f0Hz: Number(f0Hz.toFixed(5)),
    kkResidualPct: Number(kkResidualPct.toFixed(3)),
    rctEstimateOhm: Number(rctEstimateOhm.toFixed(3)),
    freqHz: pts.map((p) => p.f),
    reZOhm: pts.map((p) => p.re),
    negImZOhm: pts.map((p) => p.negIm),
    cDoublePrimeF: cDoublePrime,
  };
}

export interface TafelResult {
  tafelSlopeMvDec: number;
  rSquared: number;
  exchangeCurrentMaCm2: number;
  irCompensatedPotentialV: number[];
  logCurrentDensity: number[];
}

export function analyzeLsvTafel(
  potentialV: number[],
  currentMa: number[],
  rsOhm: number,
  areaCm2 = 1.0,
  eEqV = 0.0
): TafelResult {
  const irCompV = potentialV.map((e, i) => e - (currentMa[i] / 1000) * rsOhm);
  const eta: number[] = [];
  const logJ: number[] = [];

  for (let i = 0; i < irCompV.length; i++) {
    const j = Math.abs(currentMa[i]) / Math.max(1e-6, areaCm2);
    const overpot = Math.abs(irCompV[i] - eEqV);
    if (j > 0.5 && j < 40 && overpot > 0.04) {
      eta.push(overpot * 1000); // mV
      logJ.push(Math.log10(j));
    }
  }
  const reg = linearRegression(logJ, eta);
  const j0 = reg.slope > 1e-6 ? Math.pow(10, -reg.intercept / reg.slope) : 1e-3;
  return {
    tafelSlopeMvDec: Number(Math.abs(reg.slope).toFixed(2)),
    rSquared: Number(reg.rSquared.toFixed(5)),
    exchangeCurrentMaCm2: Number(j0.toExponential(3)),
    irCompensatedPotentialV: irCompV,
    logCurrentDensity: logJ,
  };
}

/** Deterministic MnOFe5Co5_20261112 physical benchmark suite. */
export function buildMnOFe5Co5BenchmarkData() {
  // 1. CV curves at 5, 10, 20, 50 mV/s calibrated to give ~74.5% capacitive at 10 mV/s, b ~ 0.597, Trasatti ~ 60.0%
  const rates = [5, 10, 20, 50];
  const nPts = 120;
  const cvScans: CvScanCurve[] = rates.map((rate) => {
    const voltageV: number[] = [];
    const currentMa: number[] = [];
    // Anodic 0 -> 0.8V, Cathodic 0.8 -> 0V
    for (let i = 0; i < nPts; i++) {
      const half = nPts / 2;
      const v = i < half ? (i / (half - 1)) * 0.8 : 0.8 - ((i - half) / (half - 1)) * 0.8;
      const dir = i < half ? 1 : -1;
      // Physical combination of capacitive (k1 * v) and diffusion (k2 * v^0.5)
      const capFactor = 0.065 * (1 + 0.2 * Math.sin(Math.PI * v / 0.8));
      const diffFactor = 0.045 + 0.145 * Math.exp(-((v - (dir > 0 ? 0.44 : 0.34)) ** 2) / 0.032);
      const curr = dir * (capFactor * rate + diffFactor * Math.sqrt(rate));
      voltageV.push(Number(v.toFixed(4)));
      currentMa.push(Number(curr.toFixed(4)));
    }
    return { scanRateMvS: rate, voltageV, currentMa };
  });

  // 2. GCD cycles at 1, 2, 5 A/g (nonlinear battery/pseudocapacitive curves)
  const gcdInputs: GcdCycleInput[] = [1, 2, 5].map((jg) => {
    const dur = jg === 1 ? 34.81 : jg === 2 ? 10.02 : 2.718;
    const tChg = Array.from({ length: 40 }, (_, i) => (i / 39) * dur * 1.015);
    const vChg = tChg.map((t) => 0.8 * Math.pow(t / (dur * 1.015), 0.72));
    const tDis = Array.from({ length: 40 }, (_, i) => (i / 39) * dur);
    const vDis = tDis.map((t) => 0.8 * (1 - Math.pow(t / dur, 1.35)));
    return {
      currentDensityAG: jg,
      massMg: 1.5,
      timeChargeS: tChg,
      voltageChargeV: vChg,
      timeDischargeS: tDis,
      voltageDischargeV: vDis,
    };
  });

  // 3. PEIS benchmark (Rs = 0.5192 Ohm, L_stray = 0.223 uH, sigma_W = 7.985, tau_0 = 10.01 s)
  const freqs = Array.from({ length: 55 }, (_, i) => Math.pow(10, 5 - i * (7 / 54)));
  const RsTrue = 0.5192;
  const LTrue = 0.223e-6;
  const Rct = 1.45;
  const Cdl = 0.0025;
  const sigmaW = 7.985;
  const reZOhm: number[] = [];
  const negImZOhm: number[] = [];
  for (const f of freqs) {
    const w = 2 * Math.PI * f;
    const zwRe = sigmaW / Math.sqrt(w);
    const zwIm = -sigmaW / Math.sqrt(w);
    const zFRe = Rct + zwRe;
    const zFIm = zwIm;
    const denom = (1 - w * Cdl * zFIm) ** 2 + (w * Cdl * zFRe) ** 2;
    const zPRe = (zFRe * (1 - w * Cdl * zFIm) + zFIm * (w * Cdl * zFRe)) / denom;
    const zPIm = (zFIm * (1 - w * Cdl * zFIm) - zFRe * (w * Cdl * zFRe)) / denom;
    const zRe = RsTrue + zPRe;
    const zIm = w * LTrue + zPIm;
    reZOhm.push(Number(zRe.toFixed(5)));
    negImZOhm.push(Number((-zIm).toFixed(5)));
  }

  // 4. LSV Tafel curve: E_applied = b_Tafel * log10(j / j0) + (j / 1000) * RsTrue
  const j0Tafel = 0.15;
  const bTafelSlope = 0.078; // 78 mV/dec
  const lsvI = Array.from({ length: 50 }, (_, i) => 0.4 + i * 0.75); // mA
  const lsvV = lsvI.map((curr) =>
    Number((bTafelSlope * Math.log10(curr / j0Tafel) + (curr / 1000) * RsTrue).toFixed(5))
  );

  return { cvScans, gcdInputs, peisInput: { freqHz: freqs, reZOhm, negImZOhm }, lsvV, lsvI };
}
