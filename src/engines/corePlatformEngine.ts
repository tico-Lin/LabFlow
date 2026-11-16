// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Core Platform Engine (Categories 1, 2, 3, 4, 5, 6, 7, 11, 12):
 * - Pure synchronous FIPS 180-4 SHA-256
 * - Reactive Column DAG Spreadsheet & Origin .fdf FitFunc parser
 * - Chemical formula molecular weight & hydrothermal stoichiometry calculator
 * - Lamport CRDT (9 OpKind) & RFC 6902 JSON-Patch + SHA-256 hash chain versioning
 * - LIMS Sample Lineage DAG & DMS COA/Vendor parser
 * - Knowledge Star Map ([[WikiLink]] backlinks, Fruchterman-Reingold, PageRank)
 * - Cloud Linux LaTeX generator/linter (enforcing ../../_common/fonts/ & research-setup)
 * - Hybrid Scientific RAG (BM25 + Cosine + RRF)
 * - Antigraity ToTNode + Critic (MemoryBounds & Physics) 3-retry self-healing loop
 */

import { nelderMead, savgolSmooth } from './mathUtils';
import { pseudoVoigtPeak } from './spectroscopyEngines';

// ============================================================================
// Pure Synchronous SHA-256 (FIPS 180-4)
// ============================================================================

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const padLen = ((bytes.length + 8) >> 6) * 64 + 64;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return Array.from(H).map((x) => x.toString(16).padStart(8, '0')).join('');
}

// ============================================================================
// Category 1: Reactive Column DAG Spreadsheet & Origin .fdf FitFunc Parser
// ============================================================================

export type AxisRole = 'X' | 'Y' | 'Z' | 'yEr±' | 'xEr±' | 'Label';

export interface SpreadsheetColumn {
  id: string;
  longName: string;
  units: string;
  comments: string;
  axisRole: AxisRole;
  formula?: string; // e.g., "np.gradient($Col_B, $Col_A)" or "np.sin($Col_A)"
  values: number[];
}

export class CircularFormulaDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircularFormulaDependencyError';
  }
}

export function evaluateReactiveSpreadsheet(columns: SpreadsheetColumn[]): SpreadsheetColumn[] {
  const colMap = new Map<string, SpreadsheetColumn>();
  for (const col of columns) colMap.set(col.id, { ...col, values: [...col.values] });

  // Build dependency edges: dep -> col
  const deps = new Map<string, string[]>();
  for (const col of columns) {
    const refs = new Set<string>();
    if (col.formula) {
      const matches = col.formula.match(/\$[A-Za-z0-9_]+/g) ?? [];
      for (const m of matches) {
        const refId = m.slice(1);
        if (colMap.has(refId)) refs.add(refId);
      }
    }
    deps.set(col.id, Array.from(refs));
  }

  // Topological sort with cycle detection (DFS 3-color)
  const state = new Map<string, 'unvisited' | 'visiting' | 'visited'>();
  const order: string[] = [];

  const dfs = (id: string) => {
    const st = state.get(id) ?? 'unvisited';
    if (st === 'visiting') {
      throw new CircularFormulaDependencyError(`Circular dependency detected at column "${id}".`);
    }
    if (st === 'visited') return;
    state.set(id, 'visiting');
    for (const d of deps.get(id) ?? []) dfs(d);
    state.set(id, 'visited');
    order.push(id);
  };
  for (const col of columns) dfs(col.id);

  // Evaluate formulas in topological order
  for (const id of order) {
    const col = colMap.get(id)!;
    if (!col.formula || col.formula.trim() === '') continue;
    const f = col.formula.trim();

    if (f.startsWith('np.gradient(')) {
      const args = f.slice(12, -1).split(',').map((s) => s.trim().replace(/^\$/, ''));
      const yVec = colMap.get(args[0])?.values ?? [];
      const xVec = colMap.get(args[1])?.values ?? yVec.map((_, i) => i);
      const out = yVec.map((_, i) => {
        if (yVec.length < 2) return 0;
        if (i === 0) return (yVec[1] - yVec[0]) / Math.max(1e-12, xVec[1] - xVec[0]);
        if (i === yVec.length - 1) {
          const n = yVec.length;
          return (yVec[n - 1] - yVec[n - 2]) / Math.max(1e-12, xVec[n - 1] - xVec[n - 2]);
        }
        return (yVec[i + 1] - yVec[i - 1]) / Math.max(1e-12, xVec[i + 1] - xVec[i - 1]);
      });
      col.values = out;
    } else if (f.startsWith('scipy.signal.savgol_filter(')) {
      const args = f.slice(27, -1).split(',').map((s) => s.trim());
      const yVec = colMap.get(args[0].replace(/^\$/, ''))?.values ?? [];
      const win = parseInt(args[1] ?? '7', 10);
      const poly = parseInt(args[2] ?? '2', 10);
      col.values = savgolSmooth(yVec, win, poly);
    } else if (f.startsWith('np.sin(')) {
      const refId = f.slice(7, -1).trim().replace(/^\$/, '');
      const xVec = colMap.get(refId)?.values ?? [];
      col.values = xVec.map((v) => Math.sin(v));
    } else if (f.startsWith('np.cos(')) {
      const refId = f.slice(7, -1).trim().replace(/^\$/, '');
      const xVec = colMap.get(refId)?.values ?? [];
      col.values = xVec.map((v) => Math.cos(v));
    } else if (f.startsWith('=AVERAGE(')) {
      const refId = f.slice(9, -1).trim().replace(/^\$/, '').split(':')[0].replace(/\d+$/, '');
      const xVec = colMap.get(refId)?.values ?? [];
      const avg = xVec.length > 0 ? xVec.reduce((a, b) => a + b, 0) / xVec.length : 0;
      col.values = col.values.map(() => Number(avg.toFixed(6)));
    } else if (f.startsWith('=STDEV.S(')) {
      const refId = f.slice(9, -1).trim().replace(/^\$/, '').split(':')[0].replace(/\d+$/, '');
      const xVec = colMap.get(refId)?.values ?? [];
      const avg = xVec.length > 0 ? xVec.reduce((a, b) => a + b, 0) / xVec.length : 0;
      const sd =
        xVec.length > 1
          ? Math.sqrt(xVec.reduce((a, v) => a + (v - avg) ** 2, 0) / (xVec.length - 1))
          : 0;
      col.values = col.values.map(() => Number(sd.toFixed(6)));
    } else {
      // Element-wise arithmetic expression with $Col references
      const refIds = deps.get(id) ?? [];
      const rowCount = Math.max(col.values.length, ...refIds.map((r) => colMap.get(r)?.values.length ?? 0));
      const exprBody = f.replace(/\$[A-Za-z0-9_]+/g, (m) => `ctx["${m.slice(1)}"]`);
      const safeAllow = /^[0-9+\-*/().\s[\]"A-Za-z0-9_ctxMathsincoexlpqwrtab]+$/;
      if (safeAllow.test(exprBody)) {
        const fn = new Function('ctx', 'Math', `return ${exprBody};`);
        const out = new Array(rowCount).fill(0);
        for (let r = 0; r < rowCount; r++) {
          const ctx: Record<string, number> = {};
          for (const rid of refIds) ctx[rid] = colMap.get(rid)?.values[r] ?? 0;
          const val = Number(fn(ctx, Math));
          out[r] = Number.isFinite(val) ? val : 0;
        }
        col.values = out;
      }
    }
  }

  return columns.map((c) => colMap.get(c.id)!);
}

export interface OriginFdfModel {
  name: string;
  parameters: string[];
  formulaExpr: string;
}

export function parseOriginFdf(fdfText: string): OriginFdfModel {
  const lines = fdfText.replace(/\r\n/g, '\n').split('\n');
  let section = '';
  let name = 'CustomFdf';
  let parameters: string[] = [];
  let formulaExpr = '';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    const secMatch = line.match(/^\[([^\]]+)\]$/);
    if (secMatch) {
      section = secMatch[1].toLowerCase();
      continue;
    }
    if (section === 'general information') {
      const m = line.match(/^Function Name\s*=\s*(.+)$/i);
      if (m) name = m[1].trim();
    } else if (section === 'fitting parameters' || section === 'parameters') {
      const m = line.match(/^Names\s*=\s*(.+)$/i);
      if (m) parameters = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    } else if (section === 'formula') {
      const eqIdx = line.indexOf('=');
      formulaExpr = eqIdx >= 0 ? line.slice(eqIdx + 1).trim() : line;
    }
  }

  return { name, parameters, formulaExpr };
}

export function fitOriginFdfModel(
  model: OriginFdfModel,
  x: number[],
  y: number[],
  initialGuess: number[]
) {
  const jsExpr = model.formulaExpr
    .replace(/\^/g, '**')
    .replace(/\bexp\(/g, 'Math.exp(')
    .replace(/\bln\(/g, 'Math.log(')
    .replace(/\bsqrt\(/g, 'Math.sqrt(')
    .replace(/\bpow\(/g, 'Math.pow(');

  const evaluator = new Function(
    'x',
    ...model.parameters,
    'Math',
    `return ${jsExpr};`
  ) as (xVal: number, ...args: unknown[]) => number;

  const opt = nelderMead((p) => {
    let sse = 0;
    for (let i = 0; i < x.length; i++) {
      const pred = evaluator(x[i], ...p, Math);
      if (!Number.isFinite(pred)) return 1e18;
      sse += (y[i] - pred) ** 2;
    }
    return sse;
  }, initialGuess, 500, 1e-10);

  const yPred = x.map((xi) => evaluator(xi, ...opt.params, Math));
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < y.length; i++) {
    ssTot += (y[i] - meanY) ** 2;
    ssRes += (y[i] - yPred[i]) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;
  const dof = Math.max(1, y.length - model.parameters.length);
  const adjR2 = 1 - ((1 - r2) * (y.length - 1)) / dof;
  const reducedChi2 = ssRes / dof;

  return {
    modelName: model.name,
    fittedParams: Object.fromEntries(
      model.parameters.map((p, idx) => [p, Number(opt.params[idx].toFixed(6))])
    ),
    rSquared: Number(r2.toFixed(6)),
    adjustedRSquared: Number(adjR2.toFixed(6)),
    reducedChiSquared: Number(reducedChi2.toFixed(6)),
    yPred,
  };
}

// ============================================================================
// Category 6: Stoichiometry & Chemical Formula Molecular Weight Parser
// ============================================================================

const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998, Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45,
  K: 39.098, Ca: 40.078, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933,
  Ni: 58.693, Cu: 63.546, Zn: 65.38, Br: 79.904, Ag: 107.87, I: 126.904, Pt: 195.08, Au: 196.97,
};

function parseSingleFormulaSegment(segment: string): number {
  let idx = 0;
  const parseGroup = (): number => {
    let mass = 0;
    while (idx < segment.length) {
      const ch = segment[idx];
      if (ch === '(' || ch === '[') {
        idx++;
        const inner = parseGroup();
        let numStr = '';
        while (idx < segment.length && /\d/.test(segment[idx])) {
          numStr += segment[idx++];
        }
        mass += inner * (numStr ? parseInt(numStr, 10) : 1);
      } else if (ch === ')' || ch === ']') {
        idx++;
        return mass;
      } else if (/[A-Z]/.test(ch)) {
        let sym = segment[idx++];
        if (idx < segment.length && /[a-z]/.test(segment[idx])) {
          sym += segment[idx++];
        }
        let numStr = '';
        while (idx < segment.length && /\d/.test(segment[idx])) {
          numStr += segment[idx++];
        }
        const aw = ATOMIC_MASS[sym];
        if (!aw) throw new Error(`Unknown chemical element "${sym}" in "${segment}".`);
        mass += aw * (numStr ? parseInt(numStr, 10) : 1);
      } else {
        idx++;
      }
    }
    return mass;
  };
  return parseGroup();
}

export function calculateMolarMass(formula: string): number {
  const parts = formula.split(/[·.*]/).map((s) => s.trim()).filter(Boolean);
  let total = 0;
  for (const part of parts) {
    const match = part.match(/^(\d+)(.*)$/);
    const coeff = match ? parseInt(match[1], 10) : 1;
    const expr = match ? match[2] : part;
    total += coeff * parseSingleFormulaSegment(expr);
  }
  return Number(total.toFixed(4));
}

export function calculateHydrothermalMass(params: {
  formula: string;
  targetMolarityMolL: number;
  volumeMl: number;
  purityPct: number;
}) {
  const mw = calculateMolarMass(params.formula);
  const pureGrams = params.targetMolarityMolL * (params.volumeMl / 1000) * mw;
  const actualGrams = pureGrams / (Math.max(1, params.purityPct) / 100);
  return {
    formula: params.formula,
    molarMassGmol: Number(mw.toFixed(2)),
    pureMassMg: Number((pureGrams * 1000).toFixed(3)),
    actualWeighMassMg: Number((actualGrams * 1000).toFixed(3)),
    actualWeighMassG: Number(actualGrams.toFixed(6)),
  };
}

// ============================================================================
// Category 2 & 4: Lamport CRDT (9 OpKind) & RFC 6902 JSON-Patch Hash Chain
// ============================================================================

export type OpKind =
  | 'InsertNode'
  | 'UpdateNode'
  | 'DeleteNode'
  | 'LinkNodes'
  | 'DeleteLink'
  | 'DeltaMutation'
  | 'InsertText'
  | 'DeleteText'
  | 'UndoOperation';

export interface CrdtOperation {
  opId: string;
  nodeId: string;
  actorId: string;
  lamportTs: number;
  kind: OpKind;
  targetId: string;
  payload: Record<string, unknown>;
}

export class LamportCrdtGraph {
  clock = 0;
  nodes = new Map<string, { title: string; content: string; ts: number; actor: string; deleted?: boolean }>();
  links = new Map<string, { source: string; target: string; ts: number; deleted?: boolean }>();
  appliedOps: CrdtOperation[] = [];

  apply(op: CrdtOperation): void {
    this.clock = Math.max(this.clock, op.lamportTs) + 1;
    this.appliedOps.push(op);

    const compareLww = (existingTs: number, existingActor: string) =>
      op.lamportTs > existingTs || (op.lamportTs === existingTs && op.actorId > existingActor);

    switch (op.kind) {
      case 'InsertNode':
      case 'UpdateNode':
      case 'DeltaMutation': {
        const cur = this.nodes.get(op.targetId);
        if (!cur || compareLww(cur.ts, cur.actor)) {
          this.nodes.set(op.targetId, {
            title: String(op.payload.title ?? cur?.title ?? op.targetId),
            content: String(op.payload.content ?? cur?.content ?? ''),
            ts: op.lamportTs,
            actor: op.actorId,
            deleted: false,
          });
        }
        break;
      }
      case 'DeleteNode': {
        const cur = this.nodes.get(op.targetId);
        if (!cur || compareLww(cur.ts, cur.actor)) {
          this.nodes.set(op.targetId, {
            title: cur?.title ?? op.targetId,
            content: cur?.content ?? '',
            ts: op.lamportTs,
            actor: op.actorId,
            deleted: true,
          });
        }
        break;
      }
      case 'LinkNodes': {
        const key = `${op.payload.source}->${op.payload.target}`;
        const cur = this.links.get(key);
        if (!cur || op.lamportTs >= cur.ts) {
          this.links.set(key, {
            source: String(op.payload.source),
            target: String(op.payload.target),
            ts: op.lamportTs,
            deleted: false,
          });
        }
        break;
      }
      case 'DeleteLink': {
        const key = `${op.payload.source}->${op.payload.target}`;
        const cur = this.links.get(key);
        if (!cur || op.lamportTs >= cur.ts) {
          this.links.set(key, {
            source: String(op.payload.source),
            target: String(op.payload.target),
            ts: op.lamportTs,
            deleted: true,
          });
        }
        break;
      }
      case 'InsertText':
      case 'DeleteText': {
        const cur = this.nodes.get(op.targetId);
        if (cur && compareLww(cur.ts, cur.actor)) {
          const text = String(op.payload.text ?? '');
          cur.content = op.kind === 'InsertText' ? `${cur.content}${text}` : cur.content.replace(text, '');
          cur.ts = op.lamportTs;
          cur.actor = op.actorId;
        }
        break;
      }
      case 'UndoOperation': {
        const targetOpId = String(op.payload.targetOpId ?? '');
        const orig = this.appliedOps.find((o) => o.opId === targetOpId);
        if (orig && orig.kind === 'InsertNode') {
          const cur = this.nodes.get(orig.targetId);
          if (cur) cur.deleted = true;
        }
        break;
      }
    }
  }
}

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

export interface NoteBlock {
  id: string;
  type: 'markdown' | 'latex_math' | 'code_cell' | 'live_chart' | 'spreadsheet_embed' | 'chem_sketch' | 'slide_deck';
  content: string;
}

export interface NoteSnapshot {
  title: string;
  blocks: NoteBlock[];
}

export interface NoteRevision {
  revisionNumber: number;
  authorId: string;
  timestamp: string;
  parentHash: string;
  commitHash: string;
  patch: JsonPatchOp[];
}

export function makeJsonPatch(prev: NoteSnapshot, curr: NoteSnapshot): JsonPatchOp[] {
  const ops: JsonPatchOp[] = [];
  if (prev.title !== curr.title) {
    ops.push({ op: 'replace', path: '/title', value: curr.title });
  }
  const minLen = Math.min(prev.blocks.length, curr.blocks.length);
  for (let i = 0; i < minLen; i++) {
    if (JSON.stringify(prev.blocks[i]) !== JSON.stringify(curr.blocks[i])) {
      ops.push({ op: 'replace', path: `/blocks/${i}`, value: curr.blocks[i] });
    }
  }
  for (let i = minLen; i < curr.blocks.length; i++) {
    ops.push({ op: 'add', path: `/blocks/${i}`, value: curr.blocks[i] });
  }
  for (let i = prev.blocks.length - 1; i >= minLen; i--) {
    ops.push({ op: 'remove', path: `/blocks/${i}` });
  }
  return ops;
}

export function applyJsonPatch(snapshot: NoteSnapshot, patch: JsonPatchOp[]): NoteSnapshot {
  const next: NoteSnapshot = {
    title: snapshot.title,
    blocks: snapshot.blocks.map((b) => ({ ...b })),
  };
  for (const p of patch) {
    if (p.path === '/title' && p.op === 'replace') {
      next.title = String(p.value ?? '');
    } else if (p.path.startsWith('/blocks/')) {
      const idx = parseInt(p.path.slice(8), 10);
      if (p.op === 'replace') next.blocks[idx] = { ...(p.value as NoteBlock) };
      else if (p.op === 'add') next.blocks.splice(idx, 0, { ...(p.value as NoteBlock) });
      else if (p.op === 'remove') next.blocks.splice(idx, 1);
    }
  }
  return next;
}

export function createNoteRevision(
  prevRevisions: NoteRevision[],
  prevSnapshot: NoteSnapshot | null,
  currSnapshot: NoteSnapshot,
  authorId: string
): NoteRevision {
  const parentHash =
    prevRevisions.length > 0 ? prevRevisions[prevRevisions.length - 1].commitHash : '0'.repeat(64);
  const patch = prevSnapshot
    ? makeJsonPatch(prevSnapshot, currSnapshot)
    : [
        { op: 'replace' as const, path: '/title', value: currSnapshot.title },
        ...currSnapshot.blocks.map((b, idx) => ({
          op: 'add' as const,
          path: `/blocks/${idx}`,
          value: b,
        })),
      ];
  const canonical = JSON.stringify(currSnapshot);
  const commitHash = sha256Hex(`${parentHash}${canonical}`);
  return {
    revisionNumber: prevRevisions.length + 1,
    authorId,
    timestamp: new Date().toISOString(),
    parentHash,
    commitHash,
    patch,
  };
}

export function reconstructSnapshot(revisions: NoteRevision[], targetRev: number): NoteSnapshot {
  let state: NoteSnapshot = { title: '', blocks: [] };
  const limit = Math.min(targetRev, revisions.length);
  for (let i = 0; i < limit; i++) {
    state = applyJsonPatch(state, revisions[i].patch);
  }
  return state;
}

export function verifyRevisionChain(revisions: NoteRevision[]): boolean {
  let state: NoteSnapshot = { title: '', blocks: [] };
  let expectedParent = '0'.repeat(64);
  for (const rev of revisions) {
    if (rev.parentHash !== expectedParent) return false;
    state = applyJsonPatch(state, rev.patch);
    const expectedCommit = sha256Hex(`${rev.parentHash}${JSON.stringify(state)}`);
    if (rev.commitHash !== expectedCommit) return false;
    expectedParent = rev.commitHash;
  }
  return true;
}

// ============================================================================
// Category 3 & 4: DMS COA Parser & LIMS Sample Lineage DAG
// ============================================================================

export function parseDmsCoaDocument(text: string) {
  const sha256 = sha256Hex(text);
  const casMatch = text.match(/\b(\d{2,7}-\d{2}-\d)\b/);
  const vendorMatch = text.match(/(Uni-Onward|Rocker Scientific|Sciket|Sigma-Aldrich|Alfa Aesar|友和貿易|洛科儀器|科研市集)/i);
  const lotMatch = text.match(/(?:Lot\s*(?:No\.?|#)?|批號)\s*[:：]?\s*([A-Z0-9-]{4,})/i);
  const purityMatch = text.match(/(?:Purity|Assay|純度)\s*[:：]?\s*(\d{2,3}(?:\.\d+)?)\s*%/i);
  return {
    sha256,
    casNumber: casMatch ? casMatch[1] : null,
    vendor: vendorMatch ? vendorMatch[1] : 'Unclassified Vendor',
    lotNumber: lotMatch ? lotMatch[1] : null,
    purityPct: purityMatch ? parseFloat(purityMatch[1]) : null,
  };
}

export interface LimsSampleNode {
  sampleCode: string;
  name: string;
  parentCodes: string[];
  reagentLot?: string;
  protocolSummary: string;
  facilityBeamline?: string;
  status: 'synthesized' | 'characterizing' | 'archived';
}

export function querySampleAncestry(samples: LimsSampleNode[], targetCode: string): LimsSampleNode[] {
  const map = new Map(samples.map((s) => [s.sampleCode, s]));
  const visited = new Set<string>();
  const lineage: LimsSampleNode[] = [];
  const walk = (code: string) => {
    if (visited.has(code)) return;
    visited.add(code);
    const node = map.get(code);
    if (!node) return;
    for (const p of node.parentCodes) walk(p);
    lineage.push(node);
  };
  walk(targetCode);
  return lineage;
}

// ============================================================================
// Category 7: Knowledge Star Map (WikiLinks + Fruchterman-Reingold + PageRank)
// ============================================================================

export interface StarMapDoc {
  id: string;
  title: string;
  kind: 'note' | 'zotero' | 'sample' | 'spectrum';
  text: string;
}

export function buildKnowledgeStarMap(docs: StarMapDoc[], width = 800, height = 500) {
  const titleToId = new Map<string, string>();
  for (const d of docs) {
    titleToId.set(d.title.toLowerCase(), d.id);
    titleToId.set(d.id.toLowerCase(), d.id);
  }

  const edges: { source: string; target: string }[] = [];
  const edgeSet = new Set<string>();
  const backlinks: Record<string, string[]> = Object.fromEntries(docs.map((d) => [d.id, []]));

  for (const d of docs) {
    const matches = d.text.matchAll(/\[\[([^\]|#]+)(?:#[^\]]+)?\]\]/g);
    for (const m of matches) {
      const targetKey = m[1].trim().toLowerCase();
      const targetId = titleToId.get(targetKey);
      if (targetId && targetId !== d.id) {
        const key = `${d.id}->${targetId}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: d.id, target: targetId });
          backlinks[targetId].push(d.id);
        }
      }
    }
  }

  // Deterministic circular initialization + Fruchterman-Reingold force iterations
  const n = Math.max(1, docs.length);
  const k = Math.sqrt((width * height) / n) * 0.85;
  const pos = docs.map((_, i) => ({
    x: width / 2 + Math.cos((2 * Math.PI * i) / n) * Math.min(width, height) * 0.34,
    y: height / 2 + Math.sin((2 * Math.PI * i) / n) * Math.min(width, height) * 0.34,
  }));
  const idToIdx = new Map(docs.map((d, i) => [d.id, i]));

  let temp = Math.min(width, height) * 0.12;
  for (let iter = 0; iter < 45; iter++) {
    const disp = docs.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const f = (k * k) / dist;
        disp[i].x += (dx / dist) * f;
        disp[i].y += (dy / dist) * f;
        disp[j].x -= (dx / dist) * f;
        disp[j].y -= (dy / dist) * f;
      }
    }
    for (const e of edges) {
      const u = idToIdx.get(e.source);
      const v = idToIdx.get(e.target);
      if (u === undefined || v === undefined) continue;
      const dx = pos[u].x - pos[v].x;
      const dy = pos[u].y - pos[v].y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const f = (dist * dist) / k;
      disp[u].x -= (dx / dist) * f;
      disp[u].y -= (dy / dist) * f;
      disp[v].x += (dx / dist) * f;
      disp[v].y += (dy / dist) * f;
    }
    for (let i = 0; i < n; i++) {
      // Gentle center gravity
      disp[i].x += (width / 2 - pos[i].x) * 0.04;
      disp[i].y += (height / 2 - pos[i].y) * 0.04;
      const mag = Math.max(1e-6, Math.hypot(disp[i].x, disp[i].y));
      pos[i].x = Math.min(width - 95, Math.max(95, pos[i].x + (disp[i].x / mag) * Math.min(mag, temp)));
      pos[i].y = Math.min(height - 56, Math.max(44, pos[i].y + (disp[i].y / mag) * Math.min(mag, temp)));
    }
    temp *= 0.92;
  }

  // PageRank (damping = 0.85)
  const outDeg = new Array(n).fill(0);
  const adjIn: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    const u = idToIdx.get(e.source);
    const v = idToIdx.get(e.target);
    if (u !== undefined && v !== undefined) {
      outDeg[u]++;
      adjIn[v].push(u);
      // Treat WikiLinks bidirectionally for symmetric star-map centrality
      outDeg[v]++;
      adjIn[u].push(v);
    }
  }
  let pr = new Array(n).fill(1 / n);
  for (let it = 0; it < 20; it++) {
    const next = new Array(n).fill(0.15 / n);
    for (let v = 0; v < n; v++) {
      for (const u of adjIn[v]) {
        next[v] += 0.85 * (pr[u] / Math.max(1, outDeg[u]));
      }
    }
    pr = next;
  }

  const nodes = docs.map((d, i) => ({
    ...d,
    x: Number(pos[i].x.toFixed(1)),
    y: Number(pos[i].y.toFixed(1)),
    pageRank: Number(pr[i].toFixed(4)),
    isOrphan: outDeg[i] === 0,
  }));

  return { nodes, edges, backlinks };
}

// ============================================================================
// Category 5: Cloud Linux LaTeX Compiler & Relative Font Mandate Linter
// ============================================================================

export function generateLinuxCloudLatex(params: {
  title: string;
  author: string;
  abstractText: string;
  tableCaption: string;
  tableHeaders: string[];
  tableRows: (string | number)[][];
}): string {
  const colSpec = params.tableHeaders.map((_, i) => (i === 0 ? 'l' : 'r')).join('');
  const headerLine = params.tableHeaders.join(' & ') + ' \\\\';
  const bodyLines = params.tableRows.map((r) => r.join(' & ') + ' \\\\').join('\n    ');

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage{../../_common/styles/research-setup}
\\setmainfont[Path=../../_common/fonts/]{times.ttf}
\\setCJKmainfont[Path=../../_common/fonts/, AutoFakeBold=true, AutoFakeSlant=true]{pmingliu.ttc}
\\usepackage{booktabs}
\\usepackage{siunitx}

\\title{${params.title}}
\\author{${params.author}}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
${params.abstractText}
\\end{abstract}

\\begin{table}[htbp]
  \\centering
  \\caption{${params.tableCaption}}
  \\begin{tabular}{${colSpec}}
    \\toprule
    ${headerLine}
    \\midrule
    ${bodyLines}
    \\bottomrule
  \\end{tabular}
\\end{table}

\\end{document}
`;
}

export function lintLatexLinuxPreamble(texSource: string): {
  compliant: boolean;
  missingDirectives: string[];
} {
  const required = [
    '\\usepackage{../../_common/styles/research-setup}',
    '\\setmainfont[Path=../../_common/fonts/]{times.ttf}',
    '\\setCJKmainfont[Path=../../_common/fonts/, AutoFakeBold=true, AutoFakeSlant=true]{pmingliu.ttc}',
  ];
  const missing = required.filter((r) => !texSource.includes(r));
  return { compliant: missing.length === 0, missingDirectives: missing };
}

// ============================================================================
// Category 11: Hybrid Scientific RAG (BM25 + Cosine + RRF)
// ============================================================================

export interface RagDocument {
  id: string;
  title: string;
  text: string;
}

export function hybridRagSearch(docs: RagDocument[], query: string, topK = 3) {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .split(/[^a-z0-9_.\-]+/)
      .filter(Boolean);
  const qTokens = tokenize(query);
  const docTokens = docs.map((d) => tokenize(`${d.title} ${d.text}`));
  const avgLen = docTokens.reduce((a, t) => a + t.length, 0) / Math.max(1, docs.length);

  // BM25 ranking
  const k1 = 1.5;
  const b = 0.75;
  const bm25Scores = docs.map((_, di) => {
    const toks = docTokens[di];
    const tfMap = new Map<string, number>();
    for (const t of toks) tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
    let score = 0;
    for (const qt of qTokens) {
      const df = docTokens.filter((dt) => dt.includes(qt)).length;
      if (df === 0) continue;
      const idf = Math.log((docs.length - df + 0.5) / (df + 0.5) + 1);
      const tf = tfMap.get(qt) ?? 0;
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (toks.length / Math.max(1, avgLen)))));
    }
    return { idx: di, score };
  });
  const bm25Ranked = [...bm25Scores].sort((a, b) => b.score - a.score);

  // Character-trigram TF-IDF dense-proxy Cosine similarity
  const trigrams = (s: string) => {
    const clean = s.toLowerCase();
    const map = new Map<string, number>();
    for (let i = 0; i <= clean.length - 3; i++) {
      const g = clean.slice(i, i + 3);
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  };
  const qVec = trigrams(query);
  const cosScores = docs.map((d, di) => {
    const dVec = trigrams(`${d.title} ${d.text}`);
    let dot = 0;
    let qNorm = 0;
    let dNorm = 0;
    for (const [, v] of qVec) qNorm += v * v;
    for (const [, v] of dVec) dNorm += v * v;
    for (const [k, v] of qVec) dot += v * (dVec.get(k) ?? 0);
    const cos = qNorm > 0 && dNorm > 0 ? dot / (Math.sqrt(qNorm) * Math.sqrt(dNorm)) : 0;
    return { idx: di, score: cos };
  });
  const cosRanked = [...cosScores].sort((a, b) => b.score - a.score);

  // Reciprocal Rank Fusion RRF(d) = sum 1/(60 + rank_i)
  const rrfScores = docs.map((d, di) => {
    const rBm25 = bm25Ranked.findIndex((x) => x.idx === di) + 1;
    const rCos = cosRanked.findIndex((x) => x.idx === di) + 1;
    const rrf = 1 / (60 + rBm25) + 1 / (60 + rCos);
    return { ...d, rrfScore: Number(rrf.toFixed(6)) };
  });

  return rrfScores.sort((a, b) => b.rrfScore - a.rrfScore).slice(0, topK);
}

// ============================================================================
// Category 12: Antigraity ToTNode & Critic (MemoryBounds + Physics Self-Healing)
// ============================================================================

export const LABFLOW_OK = 0;
export const LABFLOW_ERR_NULL = -1;
export const LABFLOW_ERR_OOB = -2;

export const Critic = {
  verifyMemoryBounds(
    ptrAddress: number,
    offset: number,
    size: number,
    maxLimit: number
  ): { valid: boolean; code: number; reason?: string } {
    if (ptrAddress <= 0) {
      return { valid: false, code: LABFLOW_ERR_NULL, reason: 'Null or invalid arena base pointer.' };
    }
    if (offset < 0 || size < 0 || offset + size > maxLimit) {
      return {
        valid: false,
        code: LABFLOW_ERR_OOB,
        reason: `LABFLOW_ERR_OOB (-2): offset(${offset}) + size(${size}) exceeds arena limit(${maxLimit}).`,
      };
    }
    return { valid: true, code: LABFLOW_OK };
  },

  verifyPhysics(params: {
    fwhm?: number[];
    eta?: number[];
    rsOhm?: number;
    rctOhm?: number;
    capacitivePct?: number;
    braggSinTheta?: number;
  }): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    for (const w of params.fwhm ?? []) {
      if (!(w > 1e-9)) violations.push(`Non-positive FWHM (${w}) violates physical linewidth > 0.`);
    }
    for (const e of params.eta ?? []) {
      if (e < 0 || e > 1) violations.push(`Pseudo-Voigt mixing factor eta (${e}) out of [0, 1].`);
    }
    if (params.rsOhm !== undefined && !(params.rsOhm > 0)) {
      violations.push(`Series resistance Rs (${params.rsOhm}) must be > 0 Ohm.`);
    }
    if (params.rctOhm !== undefined && !(params.rctOhm > 0)) {
      violations.push(`Charge-transfer resistance Rct (${params.rctOhm}) must be > 0 Ohm.`);
    }
    if (
      params.capacitivePct !== undefined &&
      (params.capacitivePct < 0 || params.capacitivePct > 100)
    ) {
      violations.push(`Capacitive ratio (${params.capacitivePct}%) must lie in [0%, 100%].`);
    }
    if (params.braggSinTheta !== undefined && params.braggSinTheta > 1.0) {
      violations.push(`Bragg sin(theta2) = ${params.braggSinTheta} > 1.0 triggers total reflection guard.`);
    }
    return { valid: violations.length === 0, violations };
  },
};

export interface ToTNode {
  branchId: string;
  hypothesis: string;
  attempt: number;
  status: 'pruned' | 'converged';
  criticPassed: boolean;
  violations: string[];
  rSquared: number;
  fittedParams?: { center1: number; amp1: number; fwhm1: number; center2: number; amp2: number; fwhm2: number; eta: number };
}

export function runAntigraitySelfHealingFit(
  x: number[],
  y: number[],
  initialProposal: { center1: number; amp1: number; fwhm1: number; center2: number; amp2: number; fwhm2: number; eta: number }
): {
  converged: boolean;
  attemptsUsed: number;
  trace: ToTNode[];
  finalRSquared: number;
  fittedY: number[];
} {
  const trace: ToTNode[] = [];
  let proposal = { ...initialProposal };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const check = Critic.verifyPhysics({
      fwhm: [proposal.fwhm1, proposal.fwhm2],
      eta: [proposal.eta],
    });

    if (!check.valid) {
      trace.push({
        branchId: `ToT-Branch-${attempt}`,
        hypothesis: `Direct proposal with FWHM=(${proposal.fwhm1}, ${proposal.fwhm2})`,
        attempt,
        status: 'pruned',
        criticPassed: false,
        violations: check.violations,
        rSquared: 0,
      });
      // Self-heal initial guesses to strictly positive physical domain
      let peakIdx = 0;
      for (let i = 1; i < y.length; i++) if (y[i] > y[peakIdx]) peakIdx = i;
      const span = Math.abs(x[x.length - 1] - x[0]);
      // Find secondary distinct local maximum
      let secondIdx = Math.min(y.length - 1, peakIdx + Math.max(1, Math.floor(y.length * 0.12)));
      let secondVal = -Infinity;
      for (let i = 1; i < y.length - 1; i++) {
        if (Math.abs(x[i] - x[peakIdx]) > span * 0.1 && y[i] > secondVal) {
          secondVal = y[i];
          secondIdx = i;
        }
      }
      proposal = {
        center1: x[peakIdx],
        amp1: Math.max(1, y[peakIdx] * 0.9),
        fwhm1: Math.max(0.8, Math.abs(proposal.fwhm1) * 2),
        center2: x[secondIdx],
        amp2: Math.max(1, y[secondIdx] * 0.85),
        fwhm2: Math.max(0.8, Math.abs(proposal.fwhm2)),
        eta: Math.min(1, Math.max(0, proposal.eta)),
      };
      continue;
    }

    // Run bounded Nelder-Mead 2-peak Pseudo-Voigt optimization
    const opt = nelderMead(
      (p) => {
        const [c1, a1, w1, c2, a2, w2, eta] = p;
        if (w1 <= 0.1 || w2 <= 0.1 || a1 <= 0 || a2 <= 0 || eta < 0 || eta > 1) return 1e18;
        let sse = 0;
        for (let i = 0; i < x.length; i++) {
          const pred =
            pseudoVoigtPeak(x[i], c1, a1, w1, eta) + pseudoVoigtPeak(x[i], c2, a2, w2, eta);
          sse += (y[i] - pred) ** 2;
        }
        return sse;
      },
      [proposal.center1, proposal.amp1, proposal.fwhm1, proposal.center2, proposal.amp2, proposal.fwhm2, proposal.eta],
      1400,
      1e-9
    );

    const [c1, a1, w1, c2, a2, w2, eta] = opt.params;
    const fittedY = x.map((xi) => pseudoVoigtPeak(xi, c1, a1, w1, eta) + pseudoVoigtPeak(xi, c2, a2, w2, eta));
    const meanY = y.reduce((a, b) => a + b, 0) / y.length;
    let ssTot = 0;
    let ssRes = 0;
    for (let i = 0; i < y.length; i++) {
      ssTot += (y[i] - meanY) ** 2;
      ssRes += (y[i] - fittedY[i]) ** 2;
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;

    trace.push({
      branchId: `ToT-Branch-${attempt}`,
      hypothesis: 'Positive-definite Pseudo-Voigt constrained optimization',
      attempt,
      status: r2 >= 0.99 ? 'converged' : 'pruned',
      criticPassed: true,
      violations: [],
      rSquared: Number(r2.toFixed(6)),
      fittedParams: {
        center1: Number(c1.toFixed(3)),
        amp1: Number(a1.toFixed(2)),
        fwhm1: Number(w1.toFixed(3)),
        center2: Number(c2.toFixed(3)),
        amp2: Number(a2.toFixed(2)),
        fwhm2: Number(w2.toFixed(3)),
        eta: Number(eta.toFixed(3)),
      },
    });

    if (r2 >= 0.99) {
      return {
        converged: true,
        attemptsUsed: attempt,
        trace,
        finalRSquared: Number(r2.toFixed(6)),
        fittedY,
      };
    }
  }

  const last = trace[trace.length - 1];
  return {
    converged: false,
    attemptsUsed: trace.length,
    trace,
    finalRSquared: last?.rSquared ?? 0,
    fittedY: x.map(() => 0),
  };
}
