// E114 - THE SHIPPED MODEL'S DIRECTIONAL SKILL, WALK-FORWARD, 24 CELLS.
// Round-84 model baseline (lab-only, no repo change): does a live HiveMind —
// fresh per split, seeded init, FEATURE_LEN-12 causal featureVector, 0/1
// next-bar-sign labels, exactly the walkforward.test.js recipe — beat the
// causal base rate on next-bar sign over 8 1h streams x 3 splits (train =
// trailing 800, test = next 500, all causal; the e100 cell design)?
// Pre-registered: the literature (2603.16886: directional accuracy ~50% for
// ALL MSE-trained models at hourly resolution; 2502.09079: crypto ~= Brownian
// noise univariate, naive beats complex) and the slot (F-110: ridge +0.0036,
// mlp -0.0222) all say the skill lands <= 0. PASS iff every cell scores a
// finite Brier; the verdict reads SUPPORTED iff mean skill > 0 (the model has
// directional skill — big news), else NEGATIVE (the honest model baseline,
// motivating the vol-target upgrade, not a failure).
import { buildPanel } from '../lib/lab.js';
import { featureVector, FEATURE_LEN } from '../../NeuLegion-master/NeuLegion-master/src/analyze.js';
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

export async function run() {
  const checks = [];
  const check = (name, pass, detail='') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const shim = await import('../../NeuLegion-master/NeuLegion-master/test/browser/shims/better-sqlite3.js');
  if (shim.__ensureSql) await shim.__ensureSql();
  const panel = await buildPanel({ tf: '1h' });
  check('e114: the 1h panel builds with 8 streams', panel.length === 8, 'streams='+panel.length);
  const cells = [];
  let fitCounter = 0;
  for (let k = 0; k < panel.length; k++) {
    const s = panel[k];
    const rets = [];
    for (let i = 1; i < s.close.length; i++) rets.push(s.close[i] / s.close[i - 1] - 1);
    const X = []; const y = [];
    for (let i = FEATURE_LEN; i < FEATURE_LEN + SPAN && i + 1 < rets.length; i++) {
      X.push(featureVector(rets, i));
      y.push(rets[i + 1] > 0 ? 1 : 0);
    }
    for (const split of SPLITS) {
      const tn = Math.floor(X.length * split);
      const lo = Math.max(0, tn - TRAIN_CAP);
      const Xtr = X.slice(lo, tn); const ytr = y.slice(lo, tn);
      const Xte = X.slice(tn, tn + TEST); const yte = y.slice(tn, tn + TEST);
      const b = baseRateLearner.create();
      for (const t of ytr) b.fit(null, t);
      const foldSeed = (1 * 131 + tn) >>> 0;
      const probs = withSeed(foldSeed, () => {
        const hm = new HiveMind('state/e114/s' + k + '-' + (fitCounter++), 3, FEATURE_LEN, 'E114', true);
        for (let i = 0; i < Xtr.length; i++) hm.train(Xtr[i], ytr[i]);
        return withSeed((foldSeed + 7777) >>> 0, () => Xte.map((x) => hm.predict(x)));
      });
      const pb = Xte.map(() => (b.predict(null) + 1) / 2);
      const bb = brier(pb, yte);
      const finite = probs.every(Number.isFinite) && Number.isFinite(bb) && bb > 0;
      const bh = finite ? brier(probs, yte) : NaN;
      cells.push({
        sym: (s.label || ('stream' + k)).replace(/^candles_/, '').replace(/\.jsonl$/, ''),
        split,
        baseRate: finite ? +((b.predict(null) + 1) / 2).toFixed(4) : NaN,
        brierBase: finite ? +bb.toFixed(5) : NaN,
        brierHm: finite ? +bh.toFixed(5) : NaN,
        skill: finite ? +((1 - bh / bb).toFixed(4)) : NaN,
        ok: finite,
      });
    }
  }
  check('e114: every cell scores a finite Brier for both arms',
    cells.length === 24 && cells.every((c) => c.ok), cells.filter((c) => c.ok).length + '/' + cells.length + ' cells finite');
  const mean = (f) => cells.reduce((a, c) => a + f(c), 0) / cells.length;
  const ms = mean((c) => c.skill);
  check('e114: mean skill recorded (any sign)', Number.isFinite(ms), 'meanSkill hivemind=' + ms.toFixed(4));
  const posFrac = cells.filter((c) => c.skill > 0).length / cells.length;
  check('e114: positive-cell fraction recorded', Number.isFinite(posFrac), 'positive ' + cells.filter((c) => c.skill > 0).length + '/24 cells');
  const failed = checks.filter(c=>!c.pass);
  return { config:{ span: SPAN, trainCap: TRAIN_CAP, test: TEST, splits: SPLITS },
    repo: { meanSkill: +ms.toFixed(4), positiveCells: cells.filter((c) => c.skill > 0).length, cells },
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length===0 };
}
