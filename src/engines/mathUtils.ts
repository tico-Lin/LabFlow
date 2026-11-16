// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Core numerical methods for LabFlow Scientific OS:
 * Linear algebra, splines, Savitzky-Golay, Radix-2 1D/2D FFT,
 * Levenberg-Marquardt / Nelder-Mead optimization, and binary ChartState packing.
 */

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

export function linearRegression(x: number[], y: number[]): LinearRegressionResult {
  const n = Math.min(x.length, y.length);
  if (n < 2) {
    return { slope: 0, intercept: y[0] ?? 0, rSquared: 0 };
  }
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXX += x[i] * x[i];
    sumXY += x[i] * y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  const denom = sumXX - n * meanX * meanX;
  const slope = Math.abs(denom) < 1e-18 ? 0 : (sumXY - n * meanX * meanY) / denom;
  const intercept = meanY - slope * meanX;

  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * x[i] + intercept;
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - meanY) ** 2;
  }
  const rSquared = ssTot < 1e-18 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, rSquared };
}

/** Solves A * x = b using Gaussian elimination with partial pivoting. */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      const tmp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = tmp;
    }
    const pivot = Math.abs(M[col][col]) < 1e-15 ? 1e-15 : M[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    const diag = Math.abs(M[i][i]) < 1e-15 ? 1e-15 : M[i][i];
    x[i] = sum / diag;
  }
  return x;
}

export function trapz(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  let area = 0;
  for (let i = 1; i < n; i++) {
    area += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1]);
  }
  return area;
}

export function linearInterp(xArr: number[], yArr: number[], xQuery: number[]): number[] {
  const n = xArr.length;
  if (n === 0) return xQuery.map(() => 0);
  if (n === 1) return xQuery.map(() => yArr[0]);
  return xQuery.map((xq) => {
    if (xq <= xArr[0]) return yArr[0];
    if (xq >= xArr[n - 1]) return yArr[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xArr[mid] <= xq) lo = mid;
      else hi = mid;
    }
    const dx = xArr[hi] - xArr[lo];
    if (Math.abs(dx) < 1e-18) return yArr[lo];
    const t = (xq - xArr[lo]) / dx;
    return yArr[lo] + t * (yArr[hi] - yArr[lo]);
  });
}

/** Natural Cubic Spline interpolation on strictly increasing xArr. */
export function cubicSplineInterp(xArr: number[], yArr: number[], xQuery: number[]): number[] {
  const n = xArr.length;
  if (n < 3) return linearInterp(xArr, yArr, xQuery);

  const h = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = Math.max(1e-12, xArr[i + 1] - xArr[i]);
  }

  const alpha = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    alpha[i] =
      (3 / h[i]) * (yArr[i + 1] - yArr[i]) -
      (3 / h[i - 1]) * (yArr[i] - yArr[i - 1]);
  }

  const l = new Array(n).fill(1);
  const mu = new Array(n).fill(0);
  const z = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xArr[i + 1] - xArr[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  const c = new Array(n).fill(0);
  const b = new Array(n - 1).fill(0);
  const d = new Array(n - 1).fill(0);
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (yArr[j + 1] - yArr[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  return xQuery.map((xq) => {
    if (xq <= xArr[0]) return yArr[0];
    if (xq >= xArr[n - 1]) return yArr[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xArr[mid] <= xq) lo = mid;
      else hi = mid;
    }
    const dx = xq - xArr[lo];
    return yArr[lo] + b[lo] * dx + c[lo] * dx * dx + d[lo] * dx * dx * dx;
  });
}

/** Monotone Piecewise Cubic Hermite Interpolating Polynomial (PCHIP). */
export function pchipInterp(xArr: number[], yArr: number[], xQuery: number[]): number[] {
  const n = xArr.length;
  if (n < 3) return linearInterp(xArr, yArr, xQuery);

  const h = new Array(n - 1);
  const delta = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = Math.max(1e-12, xArr[i + 1] - xArr[i]);
    delta[i] = (yArr[i + 1] - yArr[i]) / h[i];
  }

  const d = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      d[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    } else {
      d[i] = 0;
    }
  }
  d[0] = ((2 * h[0] + h[1]) * delta[0] - h[0] * delta[1]) / (h[0] + h[1]);
  if (d[0] * delta[0] <= 0) d[0] = 0;
  else if (Math.abs(d[0]) > 3 * Math.abs(delta[0])) d[0] = 3 * delta[0];

  d[n - 1] =
    ((2 * h[n - 2] + h[n - 3]) * delta[n - 2] - h[n - 2] * delta[n - 3]) /
    (h[n - 2] + h[n - 3]);
  if (d[n - 1] * delta[n - 2] <= 0) d[n - 1] = 0;
  else if (Math.abs(d[n - 1]) > 3 * Math.abs(delta[n - 2])) d[n - 1] = 3 * delta[n - 2];

  return xQuery.map((xq) => {
    if (xq <= xArr[0]) return yArr[0];
    if (xq >= xArr[n - 1]) return yArr[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xArr[mid] <= xq) lo = mid;
      else hi = mid;
    }
    const t = (xq - xArr[lo]) / h[lo];
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * yArr[lo] + h10 * h[lo] * d[lo] + h01 * yArr[hi] + h11 * h[lo] * d[hi];
  });
}

/** Savitzky-Golay smoothing via local least-squares polynomial fit. */
export function savgolSmooth(y: number[], windowSize = 7, polyOrder = 2): number[] {
  const n = y.length;
  if (n < 5) return [...y];
  const half = Math.max(1, Math.floor(windowSize / 2));
  const order = Math.min(polyOrder, half * 2);
  const out = new Array(n);

  for (let i = 0; i < n; i++) {
    const left = Math.max(0, i - half);
    const right = Math.min(n - 1, i + half);
    const m = right - left + 1;
    const dim = Math.min(order + 1, m);
    const ATA = Array.from({ length: dim }, () => new Array(dim).fill(0));
    const ATb = new Array(dim).fill(0);

    for (let j = left; j <= right; j++) {
      const u = j - i;
      let pow = 1;
      const row = new Array(dim);
      for (let p = 0; p < dim; p++) {
        row[p] = pow;
        pow *= u;
      }
      for (let r = 0; r < dim; r++) {
        ATb[r] += row[r] * y[j];
        for (let c = 0; c < dim; c++) {
          ATA[r][c] += row[r] * row[c];
        }
      }
    }
    for (let r = 0; r < dim; r++) ATA[r][r] += 1e-12;
    const coeffs = solveLinearSystem(ATA, ATb);
    out[i] = coeffs[0];
  }
  return out;
}

/** Nelder-Mead derivative-free optimizer for nonlinear spectral/rheology fitting. */
export function nelderMead(
  fn: (params: number[]) => number,
  initial: number[],
  maxIter = 400,
  tol = 1e-8
): { params: number[]; value: number; iterations: number } {
  const n = initial.length;
  const simplex: { x: number[]; fx: number }[] = [];
  simplex.push({ x: [...initial], fx: fn(initial) });
  for (let i = 0; i < n; i++) {
    const x = [...initial];
    x[i] = x[i] === 0 ? 0.05 : x[i] * 1.08;
    simplex.push({ x, fx: fn(x) });
  }

  let iter = 0;
  for (; iter < maxIter; iter++) {
    simplex.sort((a, b) => a.fx - b.fx);
    const best = simplex[0];
    const worst = simplex[n];
    if (Math.abs(worst.fx - best.fx) < tol) break;

    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) centroid[k] += simplex[i].x[k] / n;
    }

    const reflect = centroid.map((c, k) => c + 1.0 * (c - worst.x[k]));
    const fReflect = fn(reflect);

    if (fReflect < simplex[n - 1].fx && fReflect >= best.fx) {
      simplex[n] = { x: reflect, fx: fReflect };
      continue;
    }

    if (fReflect < best.fx) {
      const expand = centroid.map((c, k) => c + 2.0 * (reflect[k] - c));
      const fExpand = fn(expand);
      simplex[n] = fExpand < fReflect ? { x: expand, fx: fExpand } : { x: reflect, fx: fReflect };
      continue;
    }

    const contract =
      fReflect < worst.fx
        ? centroid.map((c, k) => c + 0.5 * (reflect[k] - c))
        : centroid.map((c, k) => c + 0.5 * (worst.x[k] - c));
    const fContract = fn(contract);
    if (fContract < Math.min(fReflect, worst.fx)) {
      simplex[n] = { x: contract, fx: fContract };
      continue;
    }

    for (let i = 1; i <= n; i++) {
      simplex[i].x = simplex[i].x.map((xi, k) => best.x[k] + 0.5 * (xi - best.x[k]));
      simplex[i].fx = fn(simplex[i].x);
    }
  }
  simplex.sort((a, b) => a.fx - b.fx);
  return { params: simplex[0].x, value: simplex[0].fx, iterations: iter };
}

/** In-place Radix-2 Cooley-Tukey complex FFT. Length must be a power of 2. */
export function fftRadix2(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n <= 1) return;

  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI * sign) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + half] * wRe - im[i + k + half] * wIm;
        const vIm = re[i + k + half] * wIm + im[i + k + half] * wRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;
        const nextRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Packs a ChartState packet matching Python struct.pack("<Idddd", ...)
 * 36-byte header (uint32 seriesId + 4 * float64 bounds) + float64 XY interleaved points.
 */
export function packChartStateBinary(
  seriesId: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  xValues: number[],
  yValues: number[]
): Uint8Array {
  const count = Math.min(xValues.length, yValues.length);
  const buffer = new ArrayBuffer(36 + count * 16);
  const view = new DataView(buffer);
  view.setUint32(0, seriesId >>> 0, true);
  view.setFloat64(4, xMin, true);
  view.setFloat64(12, xMax, true);
  view.setFloat64(20, yMin, true);
  view.setFloat64(28, yMax, true);
  for (let i = 0; i < count; i++) {
    view.setFloat64(36 + i * 16, xValues[i], true);
    view.setFloat64(36 + i * 16 + 8, yValues[i], true);
  }
  return new Uint8Array(buffer);
}

export function unpackChartStateBinary(bytes: Uint8Array): {
  seriesId: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xValues: number[];
  yValues: number[];
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const seriesId = view.getUint32(0, true);
  const xMin = view.getFloat64(4, true);
  const xMax = view.getFloat64(12, true);
  const yMin = view.getFloat64(20, true);
  const yMax = view.getFloat64(28, true);
  const count = Math.floor((bytes.byteLength - 36) / 16);
  const xValues: number[] = new Array(count);
  const yValues: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    xValues[i] = view.getFloat64(36 + i * 16, true);
    yValues[i] = view.getFloat64(36 + i * 16 + 8, true);
  }
  return { seriesId, xMin, xMax, yMin, yMax, xValues, yValues };
}
