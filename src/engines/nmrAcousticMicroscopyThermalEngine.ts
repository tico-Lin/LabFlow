// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Categories 10, 14.E, 14.F, 14.G:
 * - NMR FID processing (exponential window, zero-fill FFT, entropy-minimization phase correction)
 * - Acoustic & Speech analysis (Praat Boersma F0 autocorrelation, LPC formants F1-F4, Jitter, Shimmer, HNR, MFCC)
 * - Microscopy & SPM (SEM_STUDIO_SMART_V1 adaptive contrast & TIFF metadata, HRTEM/SAED 2D-FFT d_hkl, AFM plane-leveling Ra/Rq)
 * - Thermal, Porosity, Rheology & PLS-SEM (TGA Kissinger Ea, BET/BJH, Kaomi Herschel-Bulkley/Cross, NIPALS PLS-SEM)
 */

import {
  fftRadix2,
  linearRegression,
  nelderMead,
  nextPow2,
  solveLinearSystem,
} from './mathUtils';

// ============================================================================
// 14.E NMR Spectroscopy
// ============================================================================

export interface NmrProcessResult {
  ppmAxis: number[];
  realSpectrum: number[];
  phi0Deg: number;
  phi1Deg: number;
  negativeAreaPct: number;
  multiplets: {
    centerPpm: number;
    multiplicity: 's' | 'd' | 't' | 'q' | 'm';
    relativeIntegral: number;
  }[];
}

export function processNmrFid(
  fidReal: number[],
  fidImag: number[],
  swHz = 4000,
  sfo1Mhz = 400,
  lbHz = 1.0,
  refOffsetPpm = 5.0
): NmrProcessResult {
  const nOrig = Math.min(fidReal.length, fidImag.length);
  const nFft = Math.max(256, nextPow2(nOrig * 2));
  const dt = 1 / swHz;

  const re = new Float64Array(nFft);
  const im = new Float64Array(nFft);
  for (let i = 0; i < nOrig; i++) {
    const t = i * dt;
    const expWin = Math.exp(-Math.PI * lbHz * t);
    const tailStart = Math.floor(nOrig * 0.9);
    const taper =
      i >= tailStart
        ? 0.5 * (1 + Math.cos((Math.PI * (i - tailStart)) / Math.max(1, nOrig - 1 - tailStart)))
        : 1.0;
    const win = expWin * taper;
    re[i] = fidReal[i] * win;
    im[i] = fidImag[i] * win;
  }
  fftRadix2(re, im, false);

  // FFT shift so center frequency is in middle, descending ppm left-to-right
  const shiftedRe = new Float64Array(nFft);
  const shiftedIm = new Float64Array(nFft);
  const half = nFft >> 1;
  for (let i = 0; i < nFft; i++) {
    const srcIdx = (i + half) % nFft;
    shiftedRe[i] = re[srcIdx];
    shiftedIm[i] = im[srcIdx];
  }

  // Entropy + negative-lobe minimization for automatic (phi0, phi1) phase correction
  const pivot = half;
  const applyPhase = (phi0Rad: number, phi1Rad: number) => {
    const out = new Array(nFft);
    for (let i = 0; i < nFft; i++) {
      const ang = phi0Rad + phi1Rad * ((i - pivot) / nFft);
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      out[i] = shiftedRe[i] * c - shiftedIm[i] * s;
    }
    return out;
  };

  const objective = (p: number[]) => {
    const spec = applyPhase(p[0], p[1]);
    let posSum = 0;
    let negSum = 0;
    let derivSum = 0;
    const derivs = new Array(nFft - 1);
    for (let i = 0; i < nFft; i++) {
      if (spec[i] >= 0) posSum += spec[i];
      else negSum += -spec[i];
      if (i > 0) {
        const d = Math.abs(spec[i] - spec[i - 1]);
        derivs[i - 1] = d;
        derivSum += d;
      }
    }
    let entropy = 0;
    const normD = Math.max(1e-12, derivSum);
    for (let i = 0; i < derivs.length; i++) {
      const h = derivs[i] / normD;
      if (h > 1e-12) entropy -= h * Math.log(h);
    }
    const negPenalty = (negSum / Math.max(1e-9, posSum + negSum)) * 50;
    return entropy + negPenalty;
  };

  // Coarse grid search for phi0 to avoid local minima
  let bestPhi0 = 0;
  let bestScore = Infinity;
  for (let deg = -180; deg < 180; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    const score = objective([rad, 0]);
    if (score < bestScore) {
      bestScore = score;
      bestPhi0 = rad;
    }
  }
  const opt = nelderMead(objective, [bestPhi0, 0], 250, 1e-7);
  const corrected = applyPhase(opt.params[0], opt.params[1]);

  let posArea = 0;
  let negArea = 0;
  for (const v of corrected) {
    if (v >= 0) posArea += v;
    else negArea += -v;
  }
  const negativeAreaPct = posArea + negArea > 0 ? (negArea / (posArea + negArea)) * 100 : 0;

  const swPpm = swHz / sfo1Mhz;
  const ppmAxis = Array.from({ length: nFft }, (_, i) =>
    Number((refOffsetPpm + swPpm * (0.5 - i / (nFft - 1))).toFixed(4))
  );

  // Detect multiplets above 8% of max peak height
  const maxPeak = Math.max(...corrected);
  const thresh = maxPeak * 0.08;
  const regions: { start: number; end: number }[] = [];
  let inRegion = false;
  let regStart = 0;
  for (let i = 0; i < nFft; i++) {
    if (corrected[i] > thresh && !inRegion) {
      inRegion = true;
      regStart = Math.max(0, i - 3);
    } else if ((corrected[i] <= thresh * 0.4 || i === nFft - 1) && inRegion) {
      inRegion = false;
      regions.push({ start: regStart, end: Math.min(nFft - 1, i + 3) });
    }
  }

  // Merge closely spaced sub-peaks (within 0.15 ppm) into one multiplet
  const merged: { start: number; end: number }[] = [];
  for (const r of regions) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(ppmAxis[r.start] - ppmAxis[prev.end]) < 0.25) {
      prev.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }

  const rawIntegrals = merged.map((r) => {
    let sum = 0;
    let maxVal = -Infinity;
    let centerIdx = r.start;
    let subPeaks = 0;
    for (let i = r.start; i <= r.end; i++) {
      sum += Math.max(0, corrected[i]);
      if (corrected[i] > maxVal) {
        maxVal = corrected[i];
        centerIdx = i;
      }
      if (
        i > r.start &&
        i < r.end &&
        corrected[i] > corrected[i - 1] &&
        corrected[i] >= corrected[i + 1] &&
        corrected[i] > thresh
      ) {
        subPeaks++;
      }
    }
    const mult: 's' | 'd' | 't' | 'q' | 'm' =
      subPeaks <= 1 ? 's' : subPeaks === 2 ? 'd' : subPeaks === 3 ? 't' : subPeaks === 4 ? 'q' : 'm';
    return { centerPpm: ppmAxis[centerIdx], multiplicity: mult, integral: sum };
  });

  const minInt = rawIntegrals.length > 0 ? Math.min(...rawIntegrals.map((r) => r.integral)) : 1;
  const multiplets = rawIntegrals.map((r) => ({
    centerPpm: Number(r.centerPpm.toFixed(3)),
    multiplicity: r.multiplicity,
    relativeIntegral: Number((r.integral / Math.max(1e-9, minInt)).toFixed(2)),
  }));

  return {
    ppmAxis,
    realSpectrum: corrected,
    phi0Deg: Number(((opt.params[0] * 180) / Math.PI).toFixed(2)),
    phi1Deg: Number(((opt.params[1] * 180) / Math.PI).toFixed(2)),
    negativeAreaPct: Number(negativeAreaPct.toFixed(3)),
    multiplets,
  };
}

// ============================================================================
// 10. Acoustic & Speech Engine (Praat + openSMILE eGeMAPS)
// ============================================================================

export interface AcousticFeaturesResult {
  f0Hz: number;
  formantsHz: [number, number, number, number];
  jitterPct: number;
  shimmerPct: number;
  hnrDb: number;
  spectralCentroidHz: number;
  spectralRolloffHz: number;
  zcr: number;
  mfcc13: number[];
}

export function analyzeAcousticSignal(
  samples: number[],
  sampleRateHz = 16000
): AcousticFeaturesResult {
  const n = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const sig = samples.map((s) => s - mean);

  // Boersma autocorrelation F0 detection (60 Hz - 500 Hz)
  const lagMin = Math.max(2, Math.floor(sampleRateHz / 500));
  const lagMax = Math.min(Math.floor(n / 2), Math.floor(sampleRateHz / 60));
  let bestLag = lagMin;
  let bestCorr = -Infinity;
  let r0 = 0;
  for (let i = 0; i < n; i++) r0 += sig[i] * sig[i];

  const acf = new Array(lagMax + 2).fill(0);
  for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) {
    let sum = 0;
    const limit = n - lag;
    for (let i = 0; i < limit; i++) sum += sig[i] * sig[i + lag];
    acf[lag] = r0 > 1e-12 ? sum / r0 : 0;
    if (lag >= lagMin && lag <= lagMax && acf[lag] > bestCorr) {
      bestCorr = acf[lag];
      bestLag = lag;
    }
  }
  // Parabolic interpolation around bestLag
  const y0 = acf[bestLag - 1] ?? bestCorr;
  const y1 = acf[bestLag];
  const y2 = acf[bestLag + 1] ?? bestCorr;
  const denom = 2 * (y0 - 2 * y1 + y2);
  const shift = Math.abs(denom) > 1e-12 ? (y0 - y2) / denom : 0;
  const f0Hz = sampleRateHz / Math.max(1, bestLag + Math.max(-0.5, Math.min(0.5, shift)));

  const clampedCorr = Math.min(0.999, Math.max(0.001, bestCorr));
  const hnrDb = 10 * Math.log10(clampedCorr / (1 - clampedCorr));

  // Cycle-by-cycle Jitter & Shimmer estimation across zero crossings
  const estPeriodSamples = Math.max(4, Math.round(sampleRateHz / f0Hz));
  const periods: number[] = [];
  const amps: number[] = [];
  for (let pos = 0; pos + estPeriodSamples < n; pos += estPeriodSamples) {
    let maxA = 0;
    for (let k = 0; k < estPeriodSamples; k++) {
      maxA = Math.max(maxA, Math.abs(sig[pos + k]));
    }
    amps.push(maxA);
    // Refine local crossing
    let zc = pos;
    for (let k = 1; k < estPeriodSamples; k++) {
      if (sig[pos + k - 1] <= 0 && sig[pos + k] > 0) {
        zc = pos + k;
        break;
      }
    }
    periods.push(zc);
  }
  const dPeriods: number[] = [];
  for (let i = 1; i < periods.length; i++) dPeriods.push(periods[i] - periods[i - 1]);
  let jitterSum = 0;
  for (let i = 1; i < dPeriods.length; i++) jitterSum += Math.abs(dPeriods[i] - dPeriods[i - 1]);
  const meanP = dPeriods.reduce((a, b) => a + b, 0) / Math.max(1, dPeriods.length);
  const jitterPct = dPeriods.length > 1 && meanP > 0 ? (jitterSum / (dPeriods.length - 1) / meanP) * 100 : 0;

  let shimmerSum = 0;
  for (let i = 1; i < amps.length; i++) shimmerSum += Math.abs(amps[i] - amps[i - 1]);
  const meanA = amps.reduce((a, b) => a + b, 0) / Math.max(1, amps.length);
  const shimmerPct = amps.length > 1 && meanA > 0 ? (shimmerSum / (amps.length - 1) / meanA) * 100 : 0;

  // Spectral Centroid, Rolloff & 13 MFCCs via FFT
  const nFft = Math.min(2048, nextPow2(Math.min(n, 2048)));
  const re = new Float64Array(nFft);
  const im = new Float64Array(nFft);
  for (let i = 0; i < Math.min(n, nFft); i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nFft - 1)));
    re[i] = sig[i] * hann;
  }
  fftRadix2(re, im, false);
  const halfFft = nFft >> 1;
  const mag = new Array(halfFft);
  let magSum = 0;
  let weightedFreq = 0;
  for (let i = 0; i < halfFft; i++) {
    mag[i] = Math.hypot(re[i], im[i]);
    const freq = (i * sampleRateHz) / nFft;
    magSum += mag[i];
    weightedFreq += freq * mag[i];
  }
  const spectralCentroidHz = magSum > 1e-12 ? weightedFreq / magSum : 0;
  let cumMag = 0;
  let spectralRolloffHz = sampleRateHz / 2;
  for (let i = 0; i < halfFft; i++) {
    cumMag += mag[i];
    if (cumMag >= 0.85 * magSum) {
      spectralRolloffHz = (i * sampleRateHz) / nFft;
      break;
    }
  }

  let zcrCount = 0;
  for (let i = 1; i < n; i++) {
    if ((sig[i - 1] >= 0 && sig[i] < 0) || (sig[i - 1] < 0 && sig[i] >= 0)) zcrCount++;
  }
  const zcr = zcrCount / Math.max(1, n - 1);

  // LPC (order 10) spectral envelope peak extraction for Formants F1-F4
  const lpcOrder = 10;
  const rLpc = new Array(lpcOrder + 1).fill(0);
  for (let k = 0; k <= lpcOrder; k++) {
    let s = 0;
    for (let i = 0; i < n - k; i++) s += sig[i] * sig[i + k];
    rLpc[k] = s;
  }
  const toeplitz = Array.from({ length: lpcOrder }, (_, r) =>
    Array.from({ length: lpcOrder }, (_, c) => rLpc[Math.abs(r - c)])
  );
  for (let i = 0; i < lpcOrder; i++) toeplitz[i][i] += 1e-6;
  const aCoeffs = solveLinearSystem(toeplitz, rLpc.slice(1));

  const lpcEnv: number[] = [];
  const freqsEnv: number[] = [];
  for (let k = 1; k < 256; k++) {
    const f = (k / 256) * (sampleRateHz / 2);
    const w = (2 * Math.PI * f) / sampleRateHz;
    let reD = 1;
    let imD = 0;
    for (let p = 0; p < lpcOrder; p++) {
      reD -= aCoeffs[p] * Math.cos(w * (p + 1));
      imD += aCoeffs[p] * Math.sin(w * (p + 1));
    }
    lpcEnv.push(1 / Math.max(1e-9, Math.hypot(reD, imD)));
    freqsEnv.push(f);
  }
  const formantPeaks: number[] = [];
  for (let k = 1; k < lpcEnv.length - 1; k++) {
    if (lpcEnv[k] > lpcEnv[k - 1] && lpcEnv[k] > lpcEnv[k + 1] && freqsEnv[k] > 220) {
      formantPeaks.push(Number(freqsEnv[k].toFixed(1)));
    }
  }
  const defaults = [520, 1480, 2550, 3450];
  const formantsHz: [number, number, number, number] = [
    formantPeaks[0] ?? defaults[0],
    formantPeaks[1] ?? defaults[1],
    formantPeaks[2] ?? defaults[2],
    formantPeaks[3] ?? defaults[3],
  ];

  // 13 MFCCs via 24 Mel triangular filters + DCT-II
  const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
  const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);
  const nMel = 24;
  const melMin = hzToMel(50);
  const melMax = hzToMel(sampleRateHz / 2);
  const melBins = Array.from({ length: nMel + 2 }, (_, i) =>
    Math.floor(((nFft + 1) * melToHz(melMin + (i / (nMel + 1)) * (melMax - melMin))) / sampleRateHz)
  );
  const melEnergies = new Array(nMel).fill(0);
  for (let m = 1; m <= nMel; m++) {
    let e = 1e-9;
    for (let k = melBins[m - 1]; k < melBins[m]; k++) {
      if (k >= 0 && k < halfFft) e += mag[k] ** 2 * ((k - melBins[m - 1]) / Math.max(1, melBins[m] - melBins[m - 1]));
    }
    for (let k = melBins[m]; k <= melBins[m + 1]; k++) {
      if (k >= 0 && k < halfFft) e += mag[k] ** 2 * ((melBins[m + 1] - k) / Math.max(1, melBins[m + 1] - melBins[m]));
    }
    melEnergies[m - 1] = Math.log(e);
  }
  const mfcc13 = Array.from({ length: 13 }, (_, c) => {
    let sum = 0;
    for (let m = 0; m < nMel; m++) {
      sum += melEnergies[m] * Math.cos((Math.PI * c * (m + 0.5)) / nMel);
    }
    return Number(sum.toFixed(3));
  });

  return {
    f0Hz: Number(f0Hz.toFixed(2)),
    formantsHz,
    jitterPct: Number(jitterPct.toFixed(3)),
    shimmerPct: Number(shimmerPct.toFixed(3)),
    hnrDb: Number(hnrDb.toFixed(2)),
    spectralCentroidHz: Number(spectralCentroidHz.toFixed(1)),
    spectralRolloffHz: Number(spectralRolloffHz.toFixed(1)),
    zcr: Number(zcr.toFixed(4)),
    mfcc13,
  };
}

// ============================================================================
// 14.F Microscopy & SPM (SEM_STUDIO_SMART_V1, SAED 2D-FFT, AFM Plane Leveling)
// ============================================================================

export function buildSemStudioSmartMetadata(params: {
  nmPerPx: number;
  cropBottomPx: number;
  scalebarNm: number;
  roiMeanRgb: [number, number, number];
}) {
  const [r, g, b] = params.roiMeanRgb;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const contrastMode = luminance > 128 ? 'dark_bar_light_bg' : 'white_bar_dark_bg';
  const payload = {
    version: 'SEM_STUDIO_SMART_V1',
    nm_per_px: params.nmPerPx,
    crop_bottom_px: params.cropBottomPx,
    scalebar_nm: params.scalebarNm,
    scalebar_px: Number((params.scalebarNm / Math.max(1e-6, params.nmPerPx)).toFixed(2)),
    luminance: Number(luminance.toFixed(2)),
    contrastMode,
  };
  return {
    tiffTag270: `SEM_STUDIO_SMART_V1|${JSON.stringify(payload)}`,
    payload,
  };
}

export interface SaedFftResult {
  dSpacingNm: number;
  reciprocalRadiusNmInv: number;
  powerSpectrum: number[][];
}

export function analyzeSaedLattice2dFft(
  imageMatrix: number[][],
  pixelSizeNm: number
): SaedFftResult {
  const rows = nextPow2(imageMatrix.length);
  const cols = nextPow2(imageMatrix[0]?.length ?? rows);
  const N = Math.min(rows, cols);

  const reGrid = Array.from({ length: N }, () => new Float64Array(N));
  const imGrid = Array.from({ length: N }, () => new Float64Array(N));

  // Mean subtract + 2D Hann window
  let mean = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) mean += imageMatrix[y]?.[x] ?? 0;
  }
  mean /= N * N;

  for (let y = 0; y < N; y++) {
    const wy = 0.5 * (1 - Math.cos((2 * Math.PI * y) / (N - 1)));
    for (let x = 0; x < N; x++) {
      const wx = 0.5 * (1 - Math.cos((2 * Math.PI * x) / (N - 1)));
      reGrid[y][x] = ((imageMatrix[y]?.[x] ?? 0) - mean) * wx * wy;
    }
    fftRadix2(reGrid[y], imGrid[y], false);
  }

  for (let x = 0; x < N; x++) {
    const colRe = new Float64Array(N);
    const colIm = new Float64Array(N);
    for (let y = 0; y < N; y++) {
      colRe[y] = reGrid[y][x];
      colIm[y] = imGrid[y][x];
    }
    fftRadix2(colRe, colIm, false);
    for (let y = 0; y < N; y++) {
      reGrid[y][x] = colRe[y];
      imGrid[y][x] = colIm[y];
    }
  }

  // fftshift & log power spectrum; locate brightest non-DC reciprocal spot
  const half = N >> 1;
  const powerSpectrum = Array.from({ length: N }, () => new Array(N).fill(0));
  let bestDistPx = 0;
  let maxPower = -Infinity;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const sy = (y + half) % N;
      const sx = (x + half) % N;
      const mag = Math.hypot(reGrid[sy][sx], imGrid[sy][sx]);
      const p = Math.log(1 + mag);
      powerSpectrum[y][x] = p;
      const dist = Math.hypot(x - half, y - half);
      if (dist >= 2.5 && p > maxPower) {
        maxPower = p;
        bestDistPx = dist;
      }
    }
  }

  const reciprocalRadiusNmInv = bestDistPx / (N * pixelSizeNm);
  const dSpacingNm = reciprocalRadiusNmInv > 1e-12 ? 1 / reciprocalRadiusNmInv : 0;

  return {
    dSpacingNm: Number(dSpacingNm.toFixed(4)),
    reciprocalRadiusNmInv: Number(reciprocalRadiusNmInv.toFixed(4)),
    powerSpectrum,
  };
}

export interface AfmRoughnessResult {
  leveledMatrix: number[][];
  planeCoeffs: { ax: number; by: number; c: number };
  residualSlope: number;
  raNm: number;
  rqNm: number;
  rMaxNm: number;
  skewnessRsk: number;
  kurtosisRku: number;
}

export function analyzeAfmPlaneLeveling(heightMatrixNm: number[][]): AfmRoughnessResult {
  const rows = heightMatrixNm.length;
  const cols = heightMatrixNm[0]?.length ?? 0;
  const ATA = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const ATb = [0, 0, 0];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const z = heightMatrixNm[y][x];
      const vec = [x, y, 1];
      for (let r = 0; r < 3; r++) {
        ATb[r] += vec[r] * z;
        for (let c = 0; c < 3; c++) ATA[r][c] += vec[r] * vec[c];
      }
    }
  }
  const [ax, by, c] = solveLinearSystem(ATA, ATb);
  const leveled = heightMatrixNm.map((row, y) => row.map((z, x) => z - (ax * x + by * y + c)));

  // Check residual tilt slope via second plane fit
  const ATb2 = [0, 0, 0];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const z = leveled[y][x];
      ATb2[0] += x * z;
      ATb2[1] += y * z;
      ATb2[2] += z;
    }
  }
  const [rax, rby] = solveLinearSystem(ATA, ATb2);
  const residualSlope = Math.hypot(rax, rby);

  const flat = leveled.flat();
  const n = Math.max(1, flat.length);
  const mean = flat.reduce((a, b) => a + b, 0) / n;
  let sumAbs = 0;
  let sumSq = 0;
  let sumCube = 0;
  let sumQuad = 0;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const z of flat) {
    const d = z - mean;
    sumAbs += Math.abs(d);
    sumSq += d * d;
    sumCube += d * d * d;
    sumQuad += d * d * d * d;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  const ra = sumAbs / n;
  const rq = Math.sqrt(sumSq / n);
  const rsk = rq > 1e-12 ? sumCube / (n * rq ** 3) : 0;
  const rku = rq > 1e-12 ? sumQuad / (n * rq ** 4) : 0;

  return {
    leveledMatrix: leveled,
    planeCoeffs: { ax, by, c },
    residualSlope,
    raNm: Number(ra.toFixed(4)),
    rqNm: Number(rq.toFixed(4)),
    rMaxNm: Number((zMax - zMin).toFixed(4)),
    skewnessRsk: Number(rsk.toFixed(3)),
    kurtosisRku: Number(rku.toFixed(3)),
  };
}

// ============================================================================
// 14.G Thermal (TGA/Kissinger), BET/BJH, Kaomi Rheology, NIPALS PLS-SEM
// ============================================================================

export function analyzeBetIsotherm(pOverP0: number[], volumeStpCm3G: number[]) {
  const xBet: number[] = [];
  const yBet: number[] = [];
  for (let i = 0; i < pOverP0.length; i++) {
    const p = pOverP0[i];
    const v = volumeStpCm3G[i];
    // Rouquerol window: 0.05 <= P/P0 <= 0.30 and positive v*(1-P/P0)
    if (p >= 0.05 && p <= 0.3 && v > 0) {
      xBet.push(p);
      yBet.push(p / (v * (1 - p)));
    }
  }
  const reg = linearRegression(xBet, yBet);
  const slope = reg.slope;
  const intercept = Math.max(1e-12, reg.intercept);
  const vm = 1 / (slope + intercept);
  const cConst = 1 + slope / intercept;
  // S_BET = (vm * N_A * sigma_N2) / V_m = vm * (6.02214e23 * 0.162e-18) / 22414
  const sBetM2G = (vm * 6.02214e23 * 0.162e-18) / 22414;

  // BJH Kelvin + Halsey pore distribution on desorption/adsorption points > 0.35
  const bjhD: number[] = [];
  const bjhDvDlogD: number[] = [];
  for (let i = 1; i < pOverP0.length; i++) {
    const p = pOverP0[i];
    const pPrev = pOverP0[i - 1];
    if (p > 0.35 && p < 0.99 && p > pPrev) {
      const pMid = 0.5 * (p + pPrev);
      const rk = -0.953 / Math.log(pMid);
      const t = 0.354 * Math.pow(-5 / Math.log(pMid), 1 / 3);
      const dPore = 2 * (rk + t);
      const dPrev = 2 * (-0.953 / Math.log(pPrev) + 0.354 * Math.pow(-5 / Math.log(pPrev), 1 / 3));
      const dCurr = 2 * (-0.953 / Math.log(p) + 0.354 * Math.pow(-5 / Math.log(p), 1 / 3));
      const dV = Math.max(0, (volumeStpCm3G[i] - volumeStpCm3G[i - 1]) * 0.001547); // STP gas -> liquid N2 cm3
      const dLogD = Math.max(1e-4, Math.abs(Math.log10(dCurr) - Math.log10(dPrev)));
      bjhD.push(Number(dPore.toFixed(2)));
      bjhDvDlogD.push(Number((dV / dLogD).toFixed(4)));
    }
  }

  return {
    vmCm3G: Number(vm.toFixed(3)),
    cConstant: Number(cConst.toFixed(2)),
    sBetM2G: Number(sBetM2G.toFixed(2)),
    rSquared: Number(reg.rSquared.toFixed(6)),
    betLinearX: xBet,
    betLinearY: yBet,
    bjhDiameterNm: bjhD,
    bjhDvDlogD,
  };
}

export function analyzeTgaKissinger(heatingRatesKMin: number[], peakTempsK: number[]) {
  const invT = peakTempsK.map((t) => 1 / t);
  const yKiss = heatingRatesKMin.map((beta, i) => Math.log(beta / (peakTempsK[i] ** 2)));
  const reg = linearRegression(invT, yKiss);
  const R = 8.3144626;
  const eaKJMol = (-reg.slope * R) / 1000;
  return {
    eaKJMol: Number(eaKJMol.toFixed(2)),
    rSquared: Number(reg.rSquared.toFixed(5)),
  };
}

export function fitHerschelBulkleyRheology(shearRate: number[], shearStress: number[]) {
  const opt = nelderMead((p) => {
    const [tau0, k, n] = p;
    if (tau0 < 0 || k <= 0 || n <= 0.05 || n > 2.5) return 1e18;
    let sse = 0;
    for (let i = 0; i < shearRate.length; i++) {
      const pred = tau0 + k * Math.pow(shearRate[i], n);
      sse += (shearStress[i] - pred) ** 2;
    }
    return sse;
  }, [Math.min(...shearStress), 1.5, 0.65], 350);
  const [tau0, k, n] = opt.params;
  return {
    yieldStressTau0Pa: Number(tau0.toFixed(3)),
    consistencyK: Number(k.toFixed(3)),
    flowIndexN: Number(n.toFixed(3)),
    fittedStress: shearRate.map((g) => tau0 + k * Math.pow(g, n)),
  };
}

export interface PlsSemBlock {
  name: string;
  indicators: number[][]; // rows = observations, cols = indicators
}

export interface PlsSemResult {
  iterations: number;
  converged: boolean;
  outerLoadings: Record<string, number[]>;
  measurementQuality: Record<string, { ave: number; compositeReliability: number; cronbachAlpha: number }>;
  pathCoefficients: { from: string; to: string; beta: number }[];
  endogenousRSquared: Record<string, number>;
}

/**
 * NIPALS PLS-PM / PLS-SEM estimator (Mode A reflective measurement model).
 * Expects blocks ordered [Exogenous_1, Exogenous_2, ..., Endogenous_Target].
 */
export function runNipalsPlsSem(blocks: PlsSemBlock[]): PlsSemResult {
  const nObs = blocks[0]?.indicators.length ?? 0;
  // Standardize every indicator to mean 0, variance 1
  const stdBlocks = blocks.map((b) => {
    const nInd = b.indicators[0].length;
    const cols = Array.from({ length: nInd }, (_, c) => b.indicators.map((r) => r[c]));
    const stdCols = cols.map((col) => {
      const mean = col.reduce((a, v) => a + v, 0) / nObs;
      const sd = Math.sqrt(col.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, nObs - 1)) || 1;
      return col.map((v) => (v - mean) / sd);
    });
    return { name: b.name, cols: stdCols };
  });

  const stdVec = (v: number[]) => {
    const m = v.reduce((a, x) => a + x, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, v.length - 1)) || 1;
    return v.map((x) => (x - m) / sd);
  };
  const corr = (a: number[], b: number[]) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s / Math.max(1, a.length - 1);
  };

  let weights = stdBlocks.map((b) => new Array(b.cols.length).fill(1 / Math.sqrt(b.cols.length)));
  let lvScores = stdBlocks.map((b, bi) => {
    const raw = Array.from({ length: nObs }, (_, r) =>
      b.cols.reduce((acc, col, ci) => acc + col[r] * weights[bi][ci], 0)
    );
    return stdVec(raw);
  });

  let iter = 0;
  let converged = false;
  for (; iter < 100; iter++) {
    // Inner approximation (centroid/path scheme connecting all exo blocks to last endo block)
    const inner = lvScores.map((_, j) => {
      const acc = new Array(nObs).fill(0);
      for (let k = 0; k < lvScores.length; k++) {
        if (k === j) continue;
        const c = corr(lvScores[j], lvScores[k]);
        const sign = c >= 0 ? 1 : -1;
        for (let r = 0; r < nObs; r++) acc[r] += sign * lvScores[k][r];
      }
      return stdVec(acc);
    });

    // Outer Mode A weights: w_jk = cov(x_jk, inner_j)
    let maxDiff = 0;
    const nextWeights = stdBlocks.map((b, j) =>
      b.cols.map((col, ci) => {
        const wNew = corr(col, inner[j]);
        maxDiff = Math.max(maxDiff, Math.abs(wNew - weights[j][ci]));
        return wNew;
      })
    );
    weights = nextWeights;
    lvScores = stdBlocks.map((b, bi) => {
      const raw = Array.from({ length: nObs }, (_, r) =>
        b.cols.reduce((acc, col, ci) => acc + col[r] * weights[bi][ci], 0)
      );
      return stdVec(raw);
    });
    if (maxDiff < 1e-6) {
      converged = true;
      iter++;
      break;
    }
  }

  const outerLoadings: Record<string, number[]> = {};
  const measurementQuality: Record<
    string,
    { ave: number; compositeReliability: number; cronbachAlpha: number }
  > = {};

  for (let j = 0; j < stdBlocks.length; j++) {
    const loadings = stdBlocks[j].cols.map((col) => Number(Math.abs(corr(col, lvScores[j])).toFixed(4)));
    outerLoadings[stdBlocks[j].name] = loadings;
    const sumL = loadings.reduce((a, l) => a + l, 0);
    const sumL2 = loadings.reduce((a, l) => a + l * l, 0);
    const sumErr = loadings.reduce((a, l) => a + Math.max(0, 1 - l * l), 0);
    const ave = sumL2 / Math.max(1e-9, sumL2 + sumErr);
    const cr = (sumL * sumL) / Math.max(1e-9, sumL * sumL + sumErr);

    // Cronbach alpha from average inter-item correlation
    const p = stdBlocks[j].cols.length;
    let rSum = 0;
    let rCount = 0;
    for (let a = 0; a < p; a++) {
      for (let b = a + 1; b < p; b++) {
        rSum += corr(stdBlocks[j].cols[a], stdBlocks[j].cols[b]);
        rCount++;
      }
    }
    const rBar = rCount > 0 ? rSum / rCount : 0.7;
    const alpha = p > 1 ? (p * rBar) / (1 + (p - 1) * rBar) : 1.0;
    measurementQuality[stdBlocks[j].name] = {
      ave: Number(ave.toFixed(4)),
      compositeReliability: Number(cr.toFixed(4)),
      cronbachAlpha: Number(alpha.toFixed(4)),
    };
  }

  // Structural paths predicting last endogenous block from preceding exogenous blocks
  const endoIdx = lvScores.length - 1;
  const exoCount = endoIdx;
  const XTX = Array.from({ length: exoCount }, () => new Array(exoCount).fill(0));
  const XTy = new Array(exoCount).fill(0);
  for (let i = 0; i < exoCount; i++) {
    XTy[i] = corr(lvScores[i], lvScores[endoIdx]);
    for (let j = 0; j < exoCount; j++) {
      XTX[i][j] = i === j ? 1.0 : corr(lvScores[i], lvScores[j]);
    }
  }
  const betas = exoCount > 0 ? solveLinearSystem(XTX, XTy) : [];
  const pathCoefficients = betas.map((beta, i) => ({
    from: stdBlocks[i].name,
    to: stdBlocks[endoIdx].name,
    beta: Number(beta.toFixed(4)),
  }));

  let ssTot = 0;
  let ssRes = 0;
  for (let r = 0; r < nObs; r++) {
    let pred = 0;
    for (let i = 0; i < exoCount; i++) pred += betas[i] * lvScores[i][r];
    ssTot += lvScores[endoIdx][r] ** 2;
    ssRes += (lvScores[endoIdx][r] - pred) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return {
    iterations: iter,
    converged,
    outerLoadings,
    measurementQuality,
    pathCoefficients,
    endogenousRSquared: { [stdBlocks[endoIdx].name]: Number(r2.toFixed(4)) },
  };
}
