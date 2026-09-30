// E116 - BUCKET-LEVEL BIG-MOVE SKILL (TIMED-BOOK GATE SCREEN).
// Round-84 model-track gate (lab-only, no repo change): e115 found 1h big-move
// skill (+0.0246). But the books earn on 8h buckets, and the timed book (e117)
// needs bucket-level skill — aggregation may smooth away the signal. Same
// 24-cell design on the repo view's own 8h spotRet panels (6 lagged
// |bucketRet|x100 features, label = next-bucket |ret| above the TRAIN median,
// trailing-800 train, 500 test, fresh seeded forceMin HiveMind per split).
// Pre-registered: positive-but-weaker than 1h is the working hypothesis;
// null-or-negative screens OUT the timed book without building it. PASS iff
// every cell is finite for both arms. Verdict SUPPORTED iff mean skill > 0.
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
  check('e116: the 6606-bucket 8-stream view parses', parsed.buckets === 6606 && parsed.streams === 8, parsed.buckets + 'x' + parsed.streams);
  const cells = [];
  let fitCounter = 0;
  let nullBars = 0;
  for (let j = 0; j < parsed.streams; j++) {
    const col = parsed.view.spotRet.map((row) => (row[j] === null ? (nullBars++, NaN) : row[j]));
    const mag = col.map((v) => Math.abs(v));
    for (const split of SPLITS) {
      const end = FEATURE_LEN + Math.floor((SPAN - FEATURE_LEN) * split);
      const lo = Math.max(FEATURE_LEN, end - TRAIN_CAP);
      const trainMag = mag.slice(lo, end).filter(Number.isFinite);
      const med = median(trainMag);
      const X = []; const y = [];
      for (let i = lo; i < end && i + 1 < mag.length; i++) {
        if (!Number.isFinite(mag[i + 1])) continue;
        const row = [];
        let okRow = true;
        for (let q = 1; q <= FEATURE_LEN; q++) {
          if (!Number.isFinite(mag[i - q])) { okRow = false; break; }
          row.push(mag[i - q] * 100);
        }
        if (!okRow) continue;
        X.push(row);
        y.push(mag[i + 1] > med ? 1 : 0);
      }
      const Xte = []; const yte = [];
      for (let i = end; i < end + TEST && i + 1 < mag.length; i++) {
        if (!Number.isFinite(mag[i + 1])) continue;
        const row = [];
        let okRow = true;
        for (let q = 1; q <= FEATURE_LEN; q++) {
          if (!Number.isFinite(mag[i - q])) { okRow = false; break; }
          row.push(mag[i - q] * 100);
        }
        if (!okRow) continue;
        Xte.push(row);
        yte.push(mag[i + 1] > med ? 1 : 0);
      }
      const b = baseRateLearner.create();
      for (const t of y) b.fit(null, t);
      const foldSeed = (1 * 131 + end) >>> 0;
      const probs = withSeed(foldSeed, () => {
        const hm = new HiveMind('state/e116/s' + j + '-' + (fitCounter++), 3, FEATURE_LEN, 'E116', true);
        for (let i = 0; i < X.length; i++) hm.train(X[i], y[i]);
        return withSeed((foldSeed + 7777) >>> 0, () => Xte.map((x) => hm.predict(x)));
      });
      const pb = Xte.map(() => (b.predict(null) + 1) / 2);
      const bb = brier(pb, yte);
      const finite = X.length > 100 && Xte.length > 100 && probs.every(Number.isFinite) && Number.isFinite(bb) && bb > 0;
      const bh = finite ? brier(probs, yte) : NaN;
      cells.push({
        sym: SYMS[j], split,
        trainN: X.length, testN: Xte.length,
        skill: finite ? +((1 - bh / bb).toFixed(4)) : NaN,
        ok: finite,
      });
    }
  }
  check('e116: every cell has coverage and finite Briers',
    cells.length === 24 && cells.every((c) => c.ok),
    cells.filter((c) => c.ok).length + '/24 cells finite (null spotRet bars skipped: ' + nullBars + ')');
  const mean = (f) => cells.reduce((a, c) => a + f(c), 0) / cells.length;
  const ms = mean((c) => c.skill);
  check('e116: mean bucket skill recorded (any sign)', Number.isFinite(ms),
    'meanSkill=' + ms.toFixed(4) + ' positive ' + cells.filter((c) => c.skill > 0).length + '/24');
  const failed = checks.filter(c=>!c.pass);
  return { config:{ span: SPAN, trainCap: TRAIN_CAP, test: TEST, splits: SPLITS },
    repo: { meanSkill: Number.isFinite(ms) ? +ms.toFixed(4) : null,
      posCells: cells.filter((c) => c.skill > 0).length, nullBars, cells },
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length===0 };
}
