// E115 - CAN THE SHIPPED MODEL TIME BIG MOVES? (VOL-TARGET UPGRADE PROBE)
// Round-84 model follow-up (lab-only, no repo change): e114 closed the
// directional door (mean skill -0.0069, 6/24). The literature says magnitude
// is predictable (vol clustering; HAR; 2508.15922 linear-on-log-vol). Same
// 24-cell design (8 1h streams x 3 splits, trailing-800 train, 500 test), but
// the target is a big-move label: |r[i+1]| > median(|r|) over the TRAIN slice
// only (causal). Features are 6 lagged |r|x100 (the analyze x100 return scale).
// Arms: live HiveMind (fresh per split, seeded, forceMin) vs the train big-move
// rate vs a naive one-step persistence forecast (predict the previous bar's
// realized big-move state — the trivially-causal clustering baseline).
// Pre-registered: persistence should beat the base rate (clustering is real);
// the question is whether the MODEL beats persistence. PASS iff every cell is
// finite for all three arms. Verdict SUPPORTED iff mean HiveMind skill > 0 AND
// above persistence (a genuine model timing edge); MIXED iff above base rate
// but below persistence; NEGATIVE iff below base rate.
import { buildPanel } from '../lib/lab.js';
import { FEATURE_LEN } from '../../NeuLegion-master/NeuLegion-master/src/analyze.js';
import HiveMind from '../../NeuLegion-master/NeuLegion-master/src/hivemind/hiveMind.js';
import { baseRateLearner } from '../../NeuLegion-master/NeuLegion-master/src/plugins/learners/base-rate.js';

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
  const panel = await buildPanel({ tf: '1h' });
  check('e115: the 1h panel builds with 8 streams', panel.length === 8, 'streams='+panel.length);
  const cells = [];
  let fitCounter = 0;
  for (let k = 0; k < panel.length; k++) {
    const s = panel[k];
    const rets = [];
    for (let i = 1; i < s.close.length; i++) rets.push(s.close[i] / s.close[i - 1] - 1);
    const mag = rets.map((r) => Math.abs(r));
    for (const split of SPLITS) {
      const end = FEATURE_LEN + Math.floor((SPAN - FEATURE_LEN) * split);
      const lo = Math.max(FEATURE_LEN, end - TRAIN_CAP);
      const med = median(mag.slice(lo, end));
      const X = []; const y = [];
      for (let i = lo; i < end && i + 1 < mag.length; i++) {
        const row = [];
        for (let j = 1; j <= FEATURE_LEN; j++) row.push(mag[i - j] * 100);
        X.push(row);
        y.push(mag[i + 1] > med ? 1 : 0);
      }
      const Xte = []; const yte = [];
      for (let i = end; i < end + TEST && i + 1 < mag.length; i++) {
        const row = [];
        for (let j = 1; j <= FEATURE_LEN; j++) row.push(mag[i - j] * 100);
        Xte.push(row);
        yte.push(mag[i + 1] > med ? 1 : 0);
      }
      const b = baseRateLearner.create();
      for (const t of y) b.fit(null, t);
      const foldSeed = (1 * 131 + end) >>> 0;
      const probs = withSeed(foldSeed, () => {
        const hm = new HiveMind('state/e115/s' + k + '-' + (fitCounter++), 3, FEATURE_LEN, 'E115', true);
        for (let i = 0; i < X.length; i++) hm.train(X[i], y[i]);
        return withSeed((foldSeed + 7777) >>> 0, () => Xte.map((x) => hm.predict(x)));
      });
      const pb = Xte.map(() => (b.predict(null) + 1) / 2);
      const lastState = y.length ? y[y.length - 1] : 0;
      const pp = Xte.map((_, i) => (i === 0 ? lastState : yte[i - 1]));
      const bb = brier(pb, yte);
      const finite = probs.every(Number.isFinite) && Number.isFinite(bb) && bb > 0 && yte.length === TEST;
      const bh = finite ? brier(probs, yte) : NaN;
      const bp = finite ? brier(pp, yte) : NaN;
      cells.push({
        sym: (s.label || ('stream' + k)).replace(/^candles_/, '').replace(/\.jsonl$/, ''),
        split,
        trainRate: finite ? +((b.predict(null) + 1) / 2).toFixed(4) : NaN,
        skillHm: finite ? +((1 - bh / bb).toFixed(4)) : NaN,
        skillPersist: finite ? +((1 - bp / bb).toFixed(4)) : NaN,
        ok: finite,
      });
    }
  }
  check('e115: every cell finite for all three arms',
    cells.length === 24 && cells.every((c) => c.ok), cells.filter((c) => c.ok).length + '/' + cells.length + ' cells finite');
  const mean = (f) => cells.reduce((a, c) => a + f(c), 0) / cells.length;
  const mh = mean((c) => c.skillHm); const mp = mean((c) => c.skillPersist);
  check('e115: mean skills recorded (any sign)', Number.isFinite(mh) && Number.isFinite(mp),
    'hivemind=' + mh.toFixed(4) + ' persistence=' + mp.toFixed(4));
  check('e115: one-step persistence recorded (sign informative: states anti-persist at 1h)', Number.isFinite(mp), 'persistence=' + mp.toFixed(4));
  check('e115: model-vs-persistence gap recorded', Number.isFinite(mh - mp),
    'gap=' + (mh - mp).toFixed(4) + ' (SUPPORTED iff > 0 with hivemind > 0)');
  const failed = checks.filter(c=>!c.pass);
  return { config:{ span: SPAN, trainCap: TRAIN_CAP, test: TEST, splits: SPLITS },
    repo: { meanHm: +mh.toFixed(4), meanPersist: +mp.toFixed(4),
      posHm: cells.filter((c) => c.skillHm > 0).length, cells },
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length===0 };
}
