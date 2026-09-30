// E117 - DOES THE MODEL BEAT THE LINEAR VOL REFERENCE? (HAR-RESIDUAL SKILL)
// Round-84 model-track closer (lab-only, no repo change): e115's 1h skill is
// not book-actionable (e116: bucket skill -0.0105). The remaining
// book-actionable model question: does the HiveMind predict what the LINEAR
// reference cannot? Design: per stream, an 8h-analogue HAR(1,3,21) on bucket
// |ret| (8h/day/week — the 8h analogues of HAR's 1d/1w/1m), OLS-fit on the
// TRAIN slice only, forecast each test bucket; the label is a positive
// residual (|r[i+1]| - HAR_pred > train-median residual). HiveMind features
// are the same 6 lagged mags x100 as e115/e116 (fresh seeded forceMin model
// per split). Baseline: the train positive-residual rate. Same 24 cells
// (800/500). Pre-registered: NEGATIVE is the working hypothesis (F-104: HAR
// is the sizing reference; linear vol dynamics leave little nonlinear
// residue) — a POSITIVE here is the only result that justifies the V2.3
// vol-learner port. PASS iff every cell is finite for both arms.
import { SYMBOLS } from '../lib/lab.js';
import { FEATURE_LEN } from '../../NeuLegion-master/NeuLegion-master/src/analyze.js';
import { parseSleeveInputs, parseOiJson } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import HiveMind from '../../NeuLegion-master/NeuLegion-master/src/hivemind/hiveMind.js';
import { baseRateLearner } from '../../NeuLegion-master/NeuLegion-master/src/plugins/learners/base-rate.js';

const REPO = 'src/NeuLegion-master/NeuLegion-master';
const SYMS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','LINKUSDT'];
const SPAN = 5000;
const TRAIN_CAP = 800;
const TEST = 500;
const SPLITS = [0.5, 0.6, 0.7];
const HAR_LAGS = [1, 3, 21];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withSeed(seed, fn) {
  const real = Math.random;
  Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = real; }
}

function brier(probs, y) {
  let s = 0;
  for (let i = 0; i < y.length; i++) { const d = probs[i] - y[i]; s += d * d; }
  return s / y.length;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : 0.5 * (s[n / 2 - 1] + s[n / 2]);
}

function meanOf(xs, lo, hi, lag) {
  let s = 0;
  for (let k = lo; k < hi; k++) s += xs[k - lag] !== undefined ? xs[k - lag] : NaN;
  return s / (hi - lo);
}

// OLS HAR fit on the train slice (rows with full lag coverage + finite mags).
// Returns { w (3 coeffs), c } via normal equations on the 3 regressors.
function fitHar(mag, lo, end) {
  const rows = [];
  const maxLag = Math.max(...HAR_LAGS);
  for (let i = lo + maxLag; i < end; i++) {
    if (!Number.isFinite(mag[i])) continue;
    const f = HAR_LAGS.map((L) => {
      let s = 0;
      let n = 0;
      for (let k = 0; k < L; k++) { if (Number.isFinite(mag[i - 1 - k])) { s += mag[i - 1 - k]; n++; } }
      return n === L ? s / L : NaN;
    });
    if (f.every(Number.isFinite)) rows.push({ f, y: mag[i] });
  }
  const p = 4;
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (const r of rows) {
    const v = [1, ...r.f];
    for (let a = 0; a < p; a++) {
      Xty[a] += v[a] * r.y;
      for (let b = 0; b < p; b++) XtX[a][b] += v[a] * v[b];
    }
  }
  // 4x4 solve by Gaussian elimination with partial pivot; null on singularity.
  const M = XtX.map((row, i) => [...row, Xty[i]]);
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= p; k++) M[r][k] -= f * M[c][k];
    }
  }
  const w = M.map((row, i) => row[p] / M[i][i]);
  if (!w.every(Number.isFinite)) return null;
  return { c: w[0], w: w.slice(1), trainN: rows.length };
}

function harPred(har, mag, i) {
  const f = HAR_LAGS.map((L) => {
    let s = 0;
    for (let k = 0; k < L; k++) {
      if (!Number.isFinite(mag[i - 1 - k])) return NaN;
      s += mag[i - 1 - k];
    }
    return s / L;
  });
  if (!f.every(Number.isFinite)) return NaN;
  return har.c + har.w[0] * f[0] + har.w[1] * f[1] + har.w[2] * f[2];
}

export async function run() {
  const checks = [];
  const check = (name, pass, detail='') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const shim = await import('../../NeuLegion-master/NeuLegion-master/test/browser/shims/better-sqlite3.js');
  if (shim.__ensureSql) await shim.__ensureSql();
  const fundingTexts = [];
  const candleTexts = [];
  for (const s of SYMBOLS) {
    fundingTexts.push(await globalThis.__fs.readTextFile(REPO + '/src/data/funding_' + s + '_8h.jsonl'));
    const name = s === 'btcusdt' ? 'candles.jsonl' : 'candles_' + s + '_1h.jsonl';
    try { candleTexts.push(await globalThis.__fs.readTextFile(REPO + '/src/data/' + name)); }
    catch { candleTexts.push(await globalThis.__fs.readTextFile(REPO + '/src/' + name)); }
  }
  const oiText = await globalThis.__fs.readTextFile(REPO + '/src/data/oi_8h.json');
  const parsed = parseSleeveInputs({ fundingTexts, candleTexts, gridMs: 28800000, barMs: 3600000, marks: null, symbols: SYMS, oi: parseOiJson(oiText) });
  check('e117: the 6606-bucket 8-stream view parses', parsed.buckets === 6606 && parsed.streams === 8, parsed.buckets + 'x' + parsed.streams);
  const cells = [];
  let fitCounter = 0;
  for (let j = 0; j < parsed.streams; j++) {
    const mag = parsed.view.spotRet.map((row) => (row[j] === null ? NaN : Math.abs(row[j])));
    for (const split of SPLITS) {
      const end = FEATURE_LEN + Math.floor((SPAN - FEATURE_LEN) * split);
      const lo = Math.max(FEATURE_LEN + Math.max(...HAR_LAGS), end - TRAIN_CAP);
      const har = fitHar(mag, lo, end);
      const trainRes = [];
      for (let i = lo + Math.max(...HAR_LAGS); i < end; i++) {
        if (!Number.isFinite(mag[i])) continue;
        const p = har ? harPred(har, mag, i) : NaN;
        if (Number.isFinite(p)) trainRes.push(mag[i] - p);
      }
      const med = median(trainRes);
      const X = []; const y = [];
      for (let i = lo + Math.max(...HAR_LAGS); i < end && i + 1 < mag.length; i++) {
        if (!Number.isFinite(mag[i + 1])) continue;
        const p = har ? harPred(har, mag, i + 1) : NaN;
        if (!Number.isFinite(p)) continue;
        const row = [];
        let okRow = true;
        for (let q = 1; q <= FEATURE_LEN; q++) {
          if (!Number.isFinite(mag[i - q])) { okRow = false; break; }
          row.push(mag[i - q] * 100);
        }
        if (!okRow) continue;
        X.push(row);
        y.push(mag[i + 1] - p > med ? 1 : 0);
      }
      const Xte = []; const yte = [];
      for (let i = end; i < end + TEST && i + 1 < mag.length; i++) {
        if (!Number.isFinite(mag[i + 1])) continue;
        const p = har ? harPred(har, mag, i + 1) : NaN;
        if (!Number.isFinite(p)) continue;
        const row = [];
        let okRow = true;
        for (let q = 1; q <= FEATURE_LEN; q++) {
          if (!Number.isFinite(mag[i - q])) { okRow = false; break; }
          row.push(mag[i - q] * 100);
        }
        if (!okRow) continue;
        Xte.push(row);
        yte.push(mag[i + 1] - p > med ? 1 : 0);
      }
      const b = baseRateLearner.create();
      for (const t of y) b.fit(null, t);
      const foldSeed = (1 * 131 + end) >>> 0;
      const probs = withSeed(foldSeed, () => {
        const hm = new HiveMind('state/e117/s' + j + '-' + (fitCounter++), 3, FEATURE_LEN, 'E117', true);
        for (let i = 0; i < X.length; i++) hm.train(X[i], y[i]);
        return withSeed((foldSeed + 7777) >>> 0, () => Xte.map((x) => hm.predict(x)));
      });
      const pb = Xte.map(() => (b.predict(null) + 1) / 2);
      const bb = brier(pb, yte);
      const finite = har !== null && X.length > 100 && Xte.length > 100 &&
        probs.every(Number.isFinite) && Number.isFinite(bb) && bb > 0;
      const bh = finite ? brier(probs, yte) : NaN;
      cells.push({
        sym: SYMS[j], split,
        harN: har ? har.trainN : 0, trainN: X.length, testN: Xte.length,
        skill: finite ? +((1 - bh / bb).toFixed(4)) : NaN,
        ok: finite,
      });
    }
  }
  check('e117: HAR fits and every cell is finite for both arms',
    cells.length === 24 && cells.every((c) => c.ok), cells.filter((c) => c.ok).length + '/24 cells finite');
  const mean = (f) => cells.reduce((a, c) => a + f(c), 0) / cells.length;
  const ms = mean((c) => c.skill);
  check('e117: mean HAR-residual skill recorded (any sign)', Number.isFinite(ms),
    'meanSkill=' + ms.toFixed(4) + ' positive ' + cells.filter((c) => c.skill > 0).length + '/24');
  const failed = checks.filter(c=>!c.pass);
  return { config:{ span: SPAN, trainCap: TRAIN_CAP, test: TEST, splits: SPLITS, harLags: HAR_LAGS },
    repo: { meanSkill: Number.isFinite(ms) ? +ms.toFixed(4) : null,
      posCells: cells.filter((c) => c.skill > 0).length, cells },
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length===0 };
}
