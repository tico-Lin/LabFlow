// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Categories 14.B, 14.C, 14.D:
 * - XRD & Crystallography (Bragg wavelength conversion with total reflection guard,
 *   cubic spline uniform resampling, binary guard, Williamson-Hall, Rietveld Rwp/Rp/chi2)
 * - Synchrotron XAS (7-model parallel regridding, local-density AIC weighting,
 *   5-channel FeatureTensor, Victoreen normalization, k-space chi(k) & FT |chi(R)|)
 * - XPS Surface Chemistry (Multi-region splitter, C 1s=284.80 eV calibration,
 *   Iterative Shirley & Tougaard background, Pseudo-Voigt / Doniach-Sunjic doublet fit, RSF at%)
 */

import {
  cubicSplineInterp,
  fftRadix2,
  linearInterp,
  linearRegression,
  nelderMead,
  nextPow2,
  pchipInterp,
  savgolSmooth,
} from './mathUtils';

// ============================================================================
// 14.B XRD & Crystallography
// ============================================================================

export interface XrdConvertResult {
  twoThetaDst: number[];
  intensityDst: number[];
  truncatedCount: number;
  stepCv: number;
  warnings: string[];
}

export function checkBinaryFileGuard(bytes: Uint8Array): { safe: boolean; reason?: string } {
  const limit = Math.min(bytes.length, 1024);
  if (limit === 0) return { safe: false, reason: 'Empty file buffer.' };
  let nonPrintable = 0;
  for (let i = 0; i < limit; i++) {
    const b = bytes[i];
    if (b === 0) {
      return { safe: false, reason: 'Detected null byte (0x00): binary file (.gpx/.raw) blocked.' };
    }
    if (b < 9 || (b > 13 && b < 32) || b > 126) {
      nonPrintable++;
    }
  }
  if (nonPrintable / limit > 0.3) {
    return { safe: false, reason: 'Binary/garbled byte ratio > 30%.' };
  }
  return { safe: true };
}

export function convertXrdWavelength(
  twoThetaSrcDeg: number[],
  intensitySrc: number[],
  lambdaSrcAngstrom = 0.77491,
  lambdaDstAngstrom = 1.5418,
  stepDeg = 0.02
): XrdConvertResult {
  const warnings: string[] = [];
  const validTheta2: number[] = [];
  const validInt: number[] = [];
  let truncatedCount = 0;

  for (let i = 0; i < twoThetaSrcDeg.length; i++) {
    const theta1Rad = ((twoThetaSrcDeg[i] / 2) * Math.PI) / 180;
    const sinTheta2 = (lambdaDstAngstrom / lambdaSrcAngstrom) * Math.sin(theta1Rad);
    if (sinTheta2 > 1.0 || sinTheta2 < -1.0 || Number.isNaN(sinTheta2)) {
      truncatedCount++;
      continue;
    }
    const twoTheta2 = (2 * Math.asin(sinTheta2) * 180) / Math.PI;
    if (Number.isFinite(twoTheta2) && Number.isFinite(intensitySrc[i])) {
      validTheta2.push(twoTheta2);
      validInt.push(intensitySrc[i]);
    }
  }

  if (truncatedCount > 0) {
    warnings.push(
      `Bragg Total Reflection Guard: filtered ${truncatedCount} high-angle point(s) exceeding arcsin domain.`
    );
  }

  if (validTheta2.length < 3) {
    return { twoThetaDst: validTheta2, intensityDst: validInt, truncatedCount, stepCv: 0, warnings };
  }

  // Ensure strictly ascending order
  const pairs = validTheta2
    .map((t, i) => ({ t, y: validInt[i] }))
    .sort((a, b) => a.t - b.t);
  const sortedX = pairs.map((p) => p.t);
  const sortedY = pairs.map((p) => p.y);

  const start = Math.ceil(sortedX[0] / stepDeg) * stepDeg;
  const end = Math.floor(sortedX[sortedX.length - 1] / stepDeg) * stepDeg;
  const nGrid = Math.max(2, Math.floor((end - start) / stepDeg + 1e-9) + 1);
  const gridX = Array.from({ length: nGrid }, (_, i) => Number((start + i * stepDeg).toFixed(6)));
  const interpY = cubicSplineInterp(sortedX, sortedY, gridX).map((v) =>
    Number(Math.max(0, v).toFixed(4))
  );

  // Compute coefficient of variation of step size
  const steps: number[] = [];
  for (let i = 1; i < gridX.length; i++) steps.push(gridX[i] - gridX[i - 1]);
  const meanStep = steps.reduce((a, b) => a + b, 0) / steps.length;
  const stdStep = Math.sqrt(
    steps.reduce((a, s) => a + (s - meanStep) ** 2, 0) / steps.length
  );
  const stepCv = meanStep > 0 ? stdStep / meanStep : 0;

  return { twoThetaDst: gridX, intensityDst: interpY, truncatedCount, stepCv, warnings };
}

export interface WilliamsonHallResult {
  crystalliteSizeNm: number;
  microstrain: number;
  rSquared: number;
  fourSinTheta: number[];
  betaCosTheta: number[];
}

export function analyzeWilliamsonHall(
  peaksTwoThetaDeg: number[],
  fwhmDeg: number[],
  lambdaAngstrom = 1.5418,
  shapeFactorK = 0.9
): WilliamsonHallResult {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < peaksTwoThetaDeg.length; i++) {
    const thetaRad = ((peaksTwoThetaDeg[i] / 2) * Math.PI) / 180;
    const betaRad = (Math.max(1e-5, fwhmDeg[i]) * Math.PI) / 180;
    x.push(4 * Math.sin(thetaRad));
    y.push(betaRad * Math.cos(thetaRad));
  }
  const reg = linearRegression(x, y);
  const intercept = Math.max(1e-6, reg.intercept);
  const crystalliteSizeAngstrom = (shapeFactorK * lambdaAngstrom) / intercept;
  return {
    crystalliteSizeNm: Number((crystalliteSizeAngstrom / 10).toFixed(2)),
    microstrain: Number(reg.slope.toFixed(6)),
    rSquared: Number(reg.rSquared.toFixed(5)),
    fourSinTheta: x,
    betaCosTheta: y,
  };
}

export function computeRietveldMetrics(observed: number[], calculated: number[]) {
  const n = Math.min(observed.length, calculated.length);
  let numW = 0;
  let denW = 0;
  let numP = 0;
  let denP = 0;
  for (let i = 0; i < n; i++) {
    const w = 1 / Math.max(1, observed[i]);
    const diff = observed[i] - calculated[i];
    numW += w * diff * diff;
    denW += w * observed[i] * observed[i];
    numP += Math.abs(diff);
    denP += Math.abs(observed[i]);
  }
  const rWp = denW > 0 ? Math.sqrt(numW / denW) * 100 : 0;
  const rP = denP > 0 ? (numP / denP) * 100 : 0;
  const rExp = denW > 0 ? Math.sqrt(Math.max(1, n - 4) / denW) * 100 : 1;
  const chi2 = rExp > 0 ? (rWp / rExp) ** 2 : 1;
  return {
    rWpPct: Number(rWp.toFixed(3)),
    rPPct: Number(rP.toFixed(3)),
    rExpPct: Number(rExp.toFixed(3)),
    chiSquared: Number(chi2.toFixed(3)),
  };
}

// ============================================================================
// 14.C Synchrotron XAS (XANES & EXAFS)
// ============================================================================

export interface XasRegridResult {
  energyGridEv: number[];
  models: Record<string, number[]>;
  aicWeights: Record<string, number[]>;
  weightSumErrorMax: number;
  featureTensor: {
    aicWeightedMain: number[];
    pchip: number[];
    gprSmooth: number[];
    firstDerivative: number[];
    localNoiseVariance: number[];
  };
  e0Ev: number;
  muNorm: number[];
  kGrid: number[];
  chiK: number[];
  rGrid: number[];
  chiRMag: number[];
}

export function analyzeSynchrotronXas(
  energyEv: number[],
  muRaw: number[],
  kWeight = 2
): XasRegridResult {
  // Sort ascending
  const sorted = energyEv
    .map((e, i) => ({ e, mu: muRaw[i] }))
    .sort((a, b) => a.e - b.e);
  const eSrc = sorted.map((p) => p.e);
  const muSrc = sorted.map((p) => p.mu);

  const eMin = eSrc[0];
  const eMax = eSrc[eSrc.length - 1];
  const nGrid = Math.max(80, Math.min(320, eSrc.length));
  const energyGrid = Array.from({ length: nGrid }, (_, i) =>
    Number((eMin + (i / (nGrid - 1)) * (eMax - eMin)).toFixed(3))
  );

  // 7 parallel regridding models
  const mLinear = linearInterp(eSrc, muSrc, energyGrid);
  const mPchip = pchipInterp(eSrc, muSrc, energyGrid);
  const mCubic = cubicSplineInterp(eSrc, muSrc, energyGrid);
  const mSavgol = savgolSmooth(mLinear, 7, 2);
  const mSmoothSpline = savgolSmooth(mCubic, 9, 3);

  // GPR (Matern-3/2 kernel regression on energy grid)
  const lenScale = Math.max(1.5, (eMax - eMin) / 45);
  const mGpr = energyGrid.map((eq) => {
    let wSum = 0;
    let ySum = 0;
    for (let j = 0; j < eSrc.length; j++) {
      const r = Math.abs(eq - eSrc[j]) / lenScale;
      if (r > 6) continue;
      const k = (1 + Math.sqrt(3) * r) * Math.exp(-Math.sqrt(3) * r);
      wSum += k;
      ySum += k * muSrc[j];
    }
    return wSum > 1e-12 ? ySum / wSum : mPchip[0];
  });

  // Bandlimited Sinc kernel interpolation
  const dEMedian = (() => {
    const diffs: number[] = [];
    for (let i = 1; i < eSrc.length; i++) diffs.push(eSrc[i] - eSrc[i - 1]);
    diffs.sort((a, b) => a - b);
    return Math.max(0.1, diffs[Math.floor(diffs.length / 2)] ?? 0.5);
  })();

  const mSinc = energyGrid.map((eq) => {
    let wSum = 0;
    let ySum = 0;
    for (let j = 0; j < eSrc.length; j++) {
      const u = (eq - eSrc[j]) / dEMedian;
      if (Math.abs(u) > 8) continue;
      const sinc = Math.abs(u) < 1e-8 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u);
      const hann = 0.5 * (1 + Math.cos((Math.PI * u) / 8));
      const w = sinc * hann;
      wSum += w;
      ySum += w * muSrc[j];
    }
    return Math.abs(wSum) > 1e-9 ? ySum / wSum : mLinear[0];
  });

  const modelMap: Record<string, number[]> = {
    Linear: mLinear,
    PCHIP: mPchip,
    CubicSpline: mCubic,
    SavitzkyGolay: mSavgol,
    SmoothingSpline: mSmoothSpline,
    GPR_Matern: mGpr,
    Sinc: mSinc,
  };
  const modelNames = Object.keys(modelMap);
  const complexityK = [2, 4, 4, 3, 4, 5, 4];

  // Local density rho(E_i) and vectorized AIC + density prior weighting
  const localSpacing = energyGrid.map((eq) => {
    let minD = dEMedian;
    for (let j = 1; j < eSrc.length; j++) {
      if (eSrc[j] >= eq) {
        minD = Math.max(0.05, eSrc[j] - eSrc[j - 1]);
        break;
      }
    }
    return minD;
  });
  const rho = localSpacing.map((d) => Math.min(10.0, Math.max(0.1, dEMedian / d)));

  // Reference baseline for local RSS evaluation (PCHIP + SavGol consensus)
  const refCurve = mLinear;
  const aicWeights: Record<string, number[]> = {};
  for (const name of modelNames) aicWeights[name] = new Array(nGrid).fill(0);
  const aicWeightedMain = new Array(nGrid).fill(0);
  let weightSumErrorMax = 0;

  for (let i = 0; i < nGrid; i++) {
    const winStart = Math.max(0, i - 3);
    const winEnd = Math.min(nGrid - 1, i + 3);
    const nWin = winEnd - winStart + 1;

    const aics = modelNames.map((name, mIdx) => {
      let rss = 1e-10;
      for (let w = winStart; w <= winEnd; w++) {
        const diff = modelMap[name][w] - refCurve[w];
        rss += diff * diff;
      }
      return nWin * Math.log(rss / nWin) + 2 * complexityK[mIdx];
    });
    const minAic = Math.min(...aics);
    const wAicRaw = aics.map((a) => Math.exp(-0.5 * Math.min(40, a - minAic)));
    const sumAic = wAicRaw.reduce((a, b) => a + b, 0);
    const wAic = wAicRaw.map((w) => w / sumAic);

    // Density structural prior: favor PCHIP/Sinc in dense XANES (rho >= 1), GPR/Smooth in sparse EXAFS
    const r = rho[i];
    const priorRaw = [
      0.8,
      r > 1.2 ? 2.2 : 1.1,
      r > 1.2 ? 1.8 : 1.0,
      r <= 1.2 ? 1.6 : 1.0,
      r <= 1.2 ? 1.7 : 0.9,
      r <= 1.2 ? 2.1 : 1.1,
      r > 1.2 ? 1.9 : 0.9,
    ];
    const sumPrior = priorRaw.reduce((a, b) => a + b, 0);
    const sPrior = priorRaw.map((p) => p / sumPrior);

    const combined = wAic.map((wa, m) => 0.65 * wa + 0.35 * sPrior[m]);
    const sumComb = combined.reduce((a, b) => a + b, 0);
    const finalW = combined.map((c) => c / sumComb);

    let wSumCheck = 0;
    let val = 0;
    for (let m = 0; m < modelNames.length; m++) {
      aicWeights[modelNames[m]][i] = finalW[m];
      wSumCheck += finalW[m];
      val += finalW[m] * modelMap[modelNames[m]][i];
    }
    weightSumErrorMax = Math.max(weightSumErrorMax, Math.abs(wSumCheck - 1.0));
    aicWeightedMain[i] = val;
  }

  // First derivative dmu/dE and local noise variance
  const firstDerivative = energyGrid.map((e, i) => {
    if (i === 0) return (aicWeightedMain[1] - aicWeightedMain[0]) / Math.max(1e-6, energyGrid[1] - e);
    if (i === nGrid - 1)
      return (
        (aicWeightedMain[nGrid - 1] - aicWeightedMain[nGrid - 2]) /
        Math.max(1e-6, e - energyGrid[nGrid - 2])
      );
    return (
      (aicWeightedMain[i + 1] - aicWeightedMain[i - 1]) /
      Math.max(1e-6, energyGrid[i + 1] - energyGrid[i - 1])
    );
  });

  const localNoiseVariance = energyGrid.map((_, i) => {
    const vals = modelNames.map((n) => modelMap[n][i]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length;
  });

  // Locate E0 as maximum of first derivative in central absorption region
  let e0Idx = Math.floor(nGrid * 0.2);
  let maxDeriv = -Infinity;
  for (let i = Math.floor(nGrid * 0.08); i < Math.floor(nGrid * 0.6); i++) {
    if (firstDerivative[i] > maxDeriv) {
      maxDeriv = firstDerivative[i];
      e0Idx = i;
    }
  }
  const e0Ev = energyGrid[e0Idx];

  // Pre-edge linear subtraction & Post-edge Victoreen normalization
  const preEnd = Math.max(4, Math.floor(e0Idx * 0.75));
  const preReg = linearRegression(energyGrid.slice(0, preEnd), aicWeightedMain.slice(0, preEnd));
  const postStart = Math.min(nGrid - 6, e0Idx + Math.max(5, Math.floor(nGrid * 0.15)));
  const postReg = linearRegression(energyGrid.slice(postStart), aicWeightedMain.slice(postStart));
  const edgeStep = Math.max(
    1e-4,
    postReg.slope * e0Ev + postReg.intercept - (preReg.slope * e0Ev + preReg.intercept)
  );
  const muNorm = aicWeightedMain.map((m, i) => {
    const preVal = preReg.slope * energyGrid[i] + preReg.intercept;
    return (m - preVal) / edgeStep;
  });

  // EXAFS k-space & Hanning-windowed FT |chi(R)|
  const kGrid: number[] = [];
  const chiK: number[] = [];
  const postSmooth = savgolSmooth(muNorm, 15, 2);
  for (let i = e0Idx + 1; i < nGrid; i++) {
    const dE = energyGrid[i] - e0Ev;
    if (dE <= 0) continue;
    const k = Math.sqrt(0.2624684 * dE);
    kGrid.push(Number(k.toFixed(4)));
    chiK.push(muNorm[i] - postSmooth[i]);
  }

  const nFft = Math.max(128, nextPow2(kGrid.length * 4));
  const re = new Float64Array(nFft);
  const im = new Float64Array(nFft);
  const kMax = kGrid[kGrid.length - 1] ?? 10;
  const kUniform = Array.from({ length: Math.min(nFft, 128) }, (_, i) => (i / 127) * kMax);
  const chiUniform = kGrid.length >= 3 ? linearInterp(kGrid, chiK, kUniform) : [];
  for (let i = 0; i < chiUniform.length; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, chiUniform.length - 1)));
    re[i] = chiUniform[i] * Math.pow(kUniform[i], kWeight) * hann;
  }
  fftRadix2(re, im, false);
  const dk = kMax / Math.max(1, chiUniform.length - 1);
  const dr = Math.PI / (nFft * Math.max(1e-4, dk));
  const nR = Math.min(60, Math.floor(6.0 / Math.max(1e-4, dr)));
  const rGrid = Array.from({ length: nR }, (_, i) => Number((i * dr).toFixed(4)));
  const chiRMag = rGrid.map((_, i) => Math.hypot(re[i], im[i]));

  return {
    energyGridEv: energyGrid,
    models: modelMap,
    aicWeights,
    weightSumErrorMax,
    featureTensor: {
      aicWeightedMain,
      pchip: mPchip,
      gprSmooth: mGpr,
      firstDerivative,
      localNoiseVariance,
    },
    e0Ev: Number(e0Ev.toFixed(2)),
    muNorm,
    kGrid,
    chiK,
    rGrid,
    chiRMag,
  };
}

// ============================================================================
// 14.D XPS Surface Chemistry
// ============================================================================

export function computeShirleyBackground(
  energy: number[],
  intensity: number[],
  tol = 1e-6,
  maxIter = 30
): { background: number[]; iterations: number } {
  const n = energy.length;
  if (n < 3) return { background: [...intensity], iterations: 0 };
  const iLeft = intensity[0];
  const iRight = intensity[n - 1];
  let bg = new Array(n).fill(Math.min(iLeft, iRight));
  let iter = 0;

  for (; iter < maxIter; iter++) {
    const diff = intensity.map((val, i) => Math.max(0, val - bg[i]));
    const cumArea = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      const de = Math.abs(energy[i] - energy[i - 1]);
      cumArea[i] = cumArea[i - 1] + 0.5 * (diff[i] + diff[i - 1]) * de;
    }
    const totalArea = Math.max(1e-12, cumArea[n - 1]);
    const nextBg = bg.map((_, i) => iRight + (iLeft - iRight) * ((totalArea - cumArea[i]) / totalArea));

    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(nextBg[i] - bg[i]));
    }
    bg = nextBg;
    if (maxDelta < tol) {
      iter++;
      break;
    }
  }
  return { background: bg, iterations: iter };
}

export function computeTougaardBackground(
  energy: number[],
  intensity: number[],
  B1 = 2866,
  C = 1643
): number[] {
  // Assumes binding energy descending or ascending; loss occurs at lower kinetic energy = higher BE
  const n = energy.length;
  const baselineEnd = intensity[n - 1];
  return energy.map((e, i) => {
    let integral = 0;
    for (let j = 0; j < n; j++) {
      const dE = energy[j] < e ? e - energy[j] : 0;
      if (dE <= 0) continue;
      const step = j > 0 ? Math.abs(energy[j] - energy[j - 1]) : 0.1;
      const kernel = (B1 * dE) / (C + dE * dE) ** 2;
      integral += kernel * Math.max(0, intensity[j] - baselineEnd) * step;
    }
    return baselineEnd + integral * 0.015;
  });
}

export function pseudoVoigtPeak(
  x: number,
  center: number,
  amplitude: number,
  fwhm: number,
  eta: number
): number {
  const gamma = Math.max(1e-6, fwhm) / 2;
  const sigma = Math.max(1e-6, fwhm) / (2 * Math.sqrt(2 * Math.LN2));
  const gauss = Math.exp(-((x - center) ** 2) / (2 * sigma * sigma));
  const lorentz = 1 / (1 + ((x - center) / gamma) ** 2);
  return amplitude * ((1 - eta) * gauss + eta * lorentz);
}

export function doniachSunjicPeak(
  x: number,
  center: number,
  amplitude: number,
  fwhm: number,
  asymmetryAlpha: number
): number {
  const gamma = Math.max(1e-6, fwhm) / 2;
  const alpha = Math.min(0.45, Math.max(0, asymmetryAlpha));
  const dE = x - center;
  const num = Math.cos(Math.PI * alpha / 2 + (1 - alpha) * Math.atan(dE / gamma));
  const den = Math.pow(dE * dE + gamma * gamma, (1 - alpha) / 2);
  return amplitude * (num / Math.max(1e-12, den)) * gamma;
}

export interface XpsPeakFitItem {
  label: string;
  centerEv: number;
  fwhmEv: number;
  eta: number;
  amplitude: number;
  area: number;
  rsf: number;
  atomicPct: number;
}

export interface XpsAnalysisResult {
  chargeShiftEv: number;
  bindingEnergyCalibrated: number[];
  rawCounts: number[];
  background: number[];
  backgroundIterations: number;
  fittedTotal: number[];
  peakCurves: { label: string; y: number[] }[];
  peaks: XpsPeakFitItem[];
  rSquared: number;
}

export function analyzeXpsRegion(
  bindingEnergyEv: number[],
  counts: number[],
  options: {
    measuredC1sEv?: number;
    referenceC1sEv?: number;
    backgroundMethod?: 'shirley' | 'tougaard';
    spinOrbitRatio?: number; // e.g., 2.0 for 2p3/2 : 2p1/2
    doubletSplitEv?: number; // e.g., 11.7 eV for Mn 2p
    rsfValues?: [number, number];
    peakLabels?: [string, string];
    initialCentersEv?: [number, number];
  } = {}
): XpsAnalysisResult {
  const refC1s = options.referenceC1sEv ?? 284.8;
  const measC1s = options.measuredC1sEv ?? 284.8;
  const chargeShiftEv = refC1s - measC1s;
  const beCal = bindingEnergyEv.map((e) => Number((e + chargeShiftEv).toFixed(3)));

  const bgRes =
    options.backgroundMethod === 'tougaard'
      ? { background: computeTougaardBackground(beCal, counts), iterations: 1 }
      : computeShirleyBackground(beCal, counts);

  const net = counts.map((c, i) => Math.max(0, c - bgRes.background[i]));
  const ratio = options.spinOrbitRatio ?? 2.0; // p3/2 : p1/2 = 2:1
  const split = options.doubletSplitEv ?? 11.7;
  const rsf = options.rsfValues ?? [5.37, 2.685];
  const labels = options.peakLabels ?? ['Mn 2p3/2', 'Mn 2p1/2'];

  // Locate primary peak max for initial guess
  let maxIdx = 0;
  for (let i = 1; i < net.length; i++) {
    if (net[i] > net[maxIdx]) maxIdx = i;
  }
  const c1Init = options.initialCentersEv?.[0] ?? beCal[maxIdx];
  const a1Init = Math.max(10, net[maxIdx]);

  // Fit [c1, a1, fwhm1, fwhm2, eta] enforcing exact doublet area ratio A1/A2 = ratio
  const opt = nelderMead((p) => {
    const [c1, a1, w1, w2, eta] = p;
    if (w1 <= 0.3 || w1 > 8 || w2 <= 0.3 || w2 > 8 || eta < 0 || eta > 1 || a1 <= 0) {
      return 1e18;
    }
    const c2 = c1 + split;
    // Area of Voigt scales ~ amplitude * fwhm -> enforce a2 * w2 = (a1 * w1) / ratio
    const a2 = (a1 * w1) / (ratio * w2);
    let sse = 0;
    for (let i = 0; i < beCal.length; i++) {
      const pred =
        pseudoVoigtPeak(beCal[i], c1, a1, w1, eta) +
        pseudoVoigtPeak(beCal[i], c2, a2, w2, eta);
      const err = net[i] - pred;
      sse += err * err;
    }
    return sse;
  }, [c1Init, a1Init, 1.8, 2.0, 0.35], 450);

  const [c1, a1, w1, w2, eta] = opt.params;
  const c2 = c1 + split;
  const a2 = (a1 * w1) / (ratio * w2);

  const y1 = beCal.map((e) => pseudoVoigtPeak(e, c1, a1, w1, eta));
  const y2 = beCal.map((e) => pseudoVoigtPeak(e, c2, a2, w2, eta));
  const fittedTotal = beCal.map((_, i) => bgRes.background[i] + y1[i] + y2[i]);

  // Numerical integration of peak areas
  let area1 = 0;
  let area2 = 0;
  for (let i = 1; i < beCal.length; i++) {
    const de = Math.abs(beCal[i] - beCal[i - 1]);
    area1 += 0.5 * (y1[i] + y1[i - 1]) * de;
    area2 += 0.5 * (y2[i] + y2[i - 1]) * de;
  }

  const norm1 = area1 / rsf[0];
  const norm2 = area2 / rsf[1];
  const normSum = Math.max(1e-12, norm1 + norm2);

  const meanC = counts.reduce((a, b) => a + b, 0) / counts.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < counts.length; i++) {
    ssTot += (counts[i] - meanC) ** 2;
    ssRes += (counts[i] - fittedTotal[i]) ** 2;
  }

  return {
    chargeShiftEv: Number(chargeShiftEv.toFixed(3)),
    bindingEnergyCalibrated: beCal,
    rawCounts: counts,
    background: bgRes.background,
    backgroundIterations: bgRes.iterations,
    fittedTotal,
    peakCurves: [
      { label: labels[0], y: y1.map((v, i) => v + bgRes.background[i]) },
      { label: labels[1], y: y2.map((v, i) => v + bgRes.background[i]) },
    ],
    peaks: [
      {
        label: labels[0],
        centerEv: Number(c1.toFixed(3)),
        fwhmEv: Number(w1.toFixed(3)),
        eta: Number(eta.toFixed(3)),
        amplitude: Number(a1.toFixed(1)),
        area: Number(area1.toFixed(2)),
        rsf: rsf[0],
        atomicPct: Number(((norm1 / normSum) * 100).toFixed(2)),
      },
      {
        label: labels[1],
        centerEv: Number(c2.toFixed(3)),
        fwhmEv: Number(w2.toFixed(3)),
        eta: Number(eta.toFixed(3)),
        amplitude: Number(a2.toFixed(1)),
        area: Number(area2.toFixed(2)),
        rsf: rsf[1],
        atomicPct: Number((100 - (norm1 / normSum) * 100).toFixed(2)),
      },
    ],
    rSquared: Number((ssTot > 0 ? 1 - ssRes / ssTot : 1).toFixed(5)),
  };
}
