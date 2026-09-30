// E119 - CROSS-SECTIONALLY-DEMEANED 1H MOMENTUM (round 91, TODO 111-adjacent breadth).
//
// WHY. Round 90 (`20260930T154333-seed1`) shows dependence is the binding constraint and the
// cross-sectional arm pays most for it (network DE 5.38, 802 effective bars), while the 15m
// `sig-reversal-xs` proves demeaning collapses the design effect (0.361) with no edge. Open
// question: does demeaned 1h momentum keep an edge while collapsing the effect?
//
// WHAT. Rebuild `sig-momentum` lab-side on the run's exact window (8x1h last-600, train 60 /
// test 15, deadZone-0.05 policy, lag-1 timing) plus two causal cross-sectional arms built from
// the same per-bar confidences (demean/z-score across streams within each test bar — no future
// info, same timing family as the network arm):
//   A: raw momentum (reference; must reproduce the run: Sharpe 1.0848, rbar 0.5196).
//   B: confidence minus cross-sectional mean, then the run policy.
//   C: cross-sectional z-score of confidence, then the run policy.
// Pre-registered: B Sharpe >= 0.5 with DE <= 2.0 => SUPPORTED (shape worth a native variant);
// B Sharpe < 0.25 => NEGATIVE (the edge was market); else MIXED. C is mechanism direction only.
//
// PASS iff the rebuild calibrates (checks 3-4) and B/C measure finite.

import { SYMBOLS, loadBasket } from '../lib/lab.js';
import { SIGNAL_CANDIDATES, SIGUP_CANDIDATES, signalForCandidate } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { makeCandleViewFor } from '../../NeuLegion-master/NeuLegion-master/src/analysis/world.js';
import { barReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';
import { walkForwardSplit } from '../../NeuLegion-master/NeuLegion-master/src/analysis/splits.js';
import { confidenceToPosition } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward/returns.js';
import { positionsFromSignals, turnover } from '../../NeuLegion-master/NeuLegion-master/src/analysis/backtest.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';
import { designEffectOfStreams } from '../../NeuLegion-master/NeuLegion-master/src/analysis/streams.js';

const N = 600;
const TRAIN = 60;
const TEST = 15;
const POLICY = { deadZone: 0.05, scale: 1 };
const REF_SHARPE = 1.0848;
const REF_RBAR = 0.5196;
const REF_EFFSTREAMS = 1.7252;

function scoreArm(posByStream) {
  const pooled = [];
  const perStream = {};
  let gross = 0;
  let turn = 0;
  for (const si of Object.keys(posByStream).filter((k) => k !== '__rets' && k !== '__idx')) {
    const vec = [];
    for (const pos of posByStream[si]) {
      const held = positionsFromSignals(pos, { lag: 1 });
      turn += turnover(held);
      held.forEach((h, k) => {
        const r = h * posByStream['__rets'][si][posByStream['__idx'][si].shift()];
        vec.push(r);
        pooled.push(r);
        gross += r;
      });
    }
    perStream[si] = vec;
  }
  return { pooled, perStream, gross, turn };
}

export async function run({} = {}) {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });

  const basket = await loadBasket(SYMBOLS, '1h');
  check('e119: 8x1h series loaded with >= 600 bars', basket.length === 8 && basket.every((s) => s.n >= N), basket.map((s) => s.n).join('/'));
  const closes = basket.map((s) => s.close.slice(-N));
  check('e119: last-600 slice aligned on all streams', closes.every((c) => c.length === N), closes.map((c) => c.length).join('/'));

  const roster = [...(SIGNAL_CANDIDATES || []), ...(SIGUP_CANDIDATES || [])];
  const cand = roster.find((c) => c.id === 'sig-momentum');
  check('e119: repo roster carries sig-momentum', !!cand && typeof cand.fn === 'function', cand ? cand.note.slice(0, 80) : 'missing');
  const sig = signalForCandidate(cand);

  const candles = closes.map((c, j) => {
    const s = basket[j];
    const o = s.open.slice(-N); const h = s.high.slice(-N); const l = s.low.slice(-N); const v = s.volume.slice(-N);
    return c.map((close, i) => ({ open: o[i], high: h[i], low: l[i], close, volume: v[i] }));
  });
  const rets = closes.map((c) => barReturns(c));
  const labels = SYMBOLS.map((s) => s);
  const folds = walkForwardSplit({ n: N, trainSize: TRAIN, testSize: TEST });
  check('e119: 36 folds of 15 test bars', folds.length === 36 && folds.every((f) => f.test.length === TEST), 'folds=' + folds.length);

  const conf = [];
  for (let si = 0; si < 8; si++) {
    const panelBase = { streamIndex: si, label: labels[si], labels, returnsByStream: rets.map((r) => r.slice()) };
    const viewFor = makeCandleViewFor(candles[si], { panel: panelBase });
    const vbase = viewFor(rets[si], null);
    conf.push(folds.map((f) => sig(vbase, f.test)));
  }
  const confOk = conf.every((perFold) => perFold.every((c) => Array.isArray(c) && c.length === TEST && c.every(Number.isFinite)));
  check('e119: confidences finite on every fold/stream', confOk, confOk ? '8x36x15' : 'NON-FINITE');

  const posA = {}; const posB = {}; const posC = {};
  const idxA = {}; const idxB = {}; const idxC = {};
  for (let si = 0; si < 8; si++) {
    posA[si] = []; posB[si] = []; posC[si] = [];
    idxA[si] = []; idxB[si] = []; idxC[si] = [];
  }
  folds.forEach((f, fi) => {
    const perBar = [];
    for (let k = 0; k < TEST; k++) {
      const cs = [];
      for (let si = 0; si < 8; si++) cs.push(conf[si][fi][k]);
      perBar.push(cs);
    }
    for (let si = 0; si < 8; si++) {
      const a = conf[si][fi].map((c) => confidenceToPosition(c, POLICY));
      posA[si].push(a);
      const b = perBar.map((cs, k) => {
        const m = cs.reduce((x, y) => x + y, 0) / cs.length;
        return confidenceToPosition(conf[si][fi][k] - m, POLICY);
      });
      posB[si].push(b);
      const c = perBar.map((cs, k) => {
        const m = cs.reduce((x, y) => x + y, 0) / cs.length;
        const sd = Math.sqrt(cs.reduce((x, y) => x + (y - m) * (y - m), 0) / cs.length);
        return confidenceToPosition(sd > 1e-12 ? (conf[si][fi][k] - m) / sd : 0, POLICY);
      });
      posC[si].push(c);
      for (const [pos, idx] of [[a, idxA], [b, idxB], [c, idxC]]) idx[si].push(...f.test);
    }
  });

  const arms = {};
  for (const [key, pos, idx] of [['A', posA, idxA], ['B', posB, idxB], ['C', posC, idxC]]) {
    const bag = { ...pos, __rets: rets, __idx: Object.fromEntries(Object.entries(idx).map(([si, v]) => [si, v.slice()])) };
    const { pooled, perStream, gross, turn } = scoreArm(bag);
    const sharpe = sharpeRatio(pooled, { periodsPerYear: 252 });
    const byLabel = {};
    labels.forEach((lab, si) => { byLabel[lab] = perStream[si]; });
    const de = designEffectOfStreams(byLabel, { foldLength: TEST });
    arms[key] = {
      sharpe: +sharpe.toFixed(4),
      bars: pooled.length,
      grossPnl: +gross.toFixed(6),
      turnover: +turn.toFixed(3),
      breakEvenBps: turn > 0 ? +(1e4 * gross / turn).toFixed(2) : null,
      meanPairwiseCorr: de.available ? +de.meanPairwiseCorr.toFixed(4) : null,
      designEffect: de.available ? +de.designEffect.toFixed(4) : null,
      effectiveStreams: de.available ? +de.effectiveStreams.toFixed(4) : null,
      effectiveBars: de.available ? Math.round(de.effectiveBars) : null,
      method: de.available ? de.method : de.reason,
    };
  }

  check('e119: arm A reproduces the run Sharpe (1.0848 +- 0.05)', Math.abs(arms.A.sharpe - REF_SHARPE) < 0.05, 'A=' + arms.A.sharpe + ' n=' + arms.A.bars);
  check('e119: arm A reproduces the run panel correlation (rbar 0.5196 +- 0.02, effStreams 1.7252 +- 0.1)', arms.A.meanPairwiseCorr != null && Math.abs(arms.A.meanPairwiseCorr - REF_RBAR) < 0.02 && Math.abs(arms.A.effectiveStreams - REF_EFFSTREAMS) < 0.1, 'rbar=' + arms.A.meanPairwiseCorr + ' effStreams=' + arms.A.effectiveStreams + ' (Kish DE=' + arms.A.designEffect + ' vs run composite 3.6239, which folds in serial dependence)');
  check('e119: arms B/C measure finite', Number.isFinite(arms.B.sharpe) && Number.isFinite(arms.C.sharpe), 'B=' + arms.B.sharpe + ' C=' + arms.C.sharpe);

  let verdict = 'MIXED';
  if (arms.B.sharpe >= 0.5 && arms.B.designEffect != null && arms.B.designEffect <= 2.0) verdict = 'SUPPORTED';
  else if (arms.B.sharpe < 0.25) verdict = 'NEGATIVE';
  check('e119: verdict recorded (' + verdict + ')', true, 'B Sharpe=' + arms.B.sharpe + ' DE=' + arms.B.designEffect + ' | C Sharpe=' + arms.C.sharpe + ' DE=' + arms.C.designEffect);

  const failed = checks.filter((c) => !c.pass);
  return {
    config: { bars: N, trainSize: TRAIN, testSize: TEST, policy: POLICY, lag: 1 },
    arms,
    ref: { sharpe: REF_SHARPE, meanPairwiseCorr: REF_RBAR, effectiveStreams: REF_EFFSTREAMS },
    verdict,
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length === 0,
  };
}
