// E120 - MULTI-FREQUENCY PANEL DECORRELATION (round 92, W5.4).
//
// WHY. Dependence is the binding constraint on every 1h arm (round 90: the network arm pays
// most, DE 5.38; e119/F-132: demeaning kills the edge with the correlation). W5.4 asks whether
// a second frequency buys independence: does stacking 15m momentum beside 1h momentum raise
// effective streams?
//
// WHAT. Same window/grid/policy as e119 (8x1h last-600, train 60 / test 15, deadZone-0.05,
// lag-1), plus a 15m momentum arm with matched TIME lookbacks (window 64 = 16h, zWindow 128 =
// 32h) scored on the SAME 1h test-bar grid: for each 1h test bar opening at T, the 15m
// confidence reads the last 15m bar with t < T (strictly causal — the :00 bar's close is not
// known at T). Arms: A = 1h momentum (reference, must reproduce 1.0848); F = 15m momentum
// held on the 1h grid (descriptive ONLY — not the native 15m edge); S = stacked 16-stream
// panel (A+F return vectors).
// Pre-registered: S effStreams >= A effStreams x 1.25 => SUPPORTED (frequency buys
// independence); S rbar >= A rbar => NEGATIVE (same factor, no gain); else MIXED.
//
// PASS iff the rebuild calibrates and the stacked panel measures finite.

import { SYMBOLS, loadBasket } from '../lib/lab.js';
import { SIGNAL_CANDIDATES, SIGUP_CANDIDATES, signalForCandidate, positionAt, momentum } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
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
const CAND15 = { id: 'e120-mom15m', kind: 'signal', fn: momentum, window: 64, zWindow: 128 };

function lastBefore(ts, T) {
  let lo = 0; let hi = ts.length - 1; let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] < T) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export async function run({} = {}) {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });

  const basket1 = await loadBasket(SYMBOLS, '1h');
  const basket15 = await loadBasket(SYMBOLS, '15m');
  check('e120: 8x1h and 8x15m loaded', basket1.length === 8 && basket15.length === 8, basket1.map((s) => s.n).join('/') + ' | ' + basket15.map((s) => s.n).join('/'));

  const closes1 = basket1.map((s) => s.close.slice(-N));
  const t1 = basket1.map((s) => s.t.slice(-N));
  const winStart = Math.min(...t1.map((t) => t[0]));
  const covers = basket15.every((s) => s.t[0] <= winStart - 128 * 15 * 60 * 1000);
  check('e120: 15m history covers the 1h window plus z-lookback', covers, 'window from ' + new Date(winStart).toISOString().slice(0, 10));

  const roster = [...(SIGNAL_CANDIDATES || []), ...(SIGUP_CANDIDATES || [])];
  const cand = roster.find((c) => c.id === 'sig-momentum');
  check('e120: repo roster carries sig-momentum', !!cand, cand ? 'ok' : 'missing');
  const sig = signalForCandidate(cand);

  const candles1 = closes1.map((c, j) => {
    const s = basket1[j];
    const o = s.open.slice(-N); const h = s.high.slice(-N); const l = s.low.slice(-N); const v = s.volume.slice(-N);
    return c.map((close, i) => ({ open: o[i], high: h[i], low: l[i], close, volume: v[i] }));
  });
  const rets1 = closes1.map((c) => barReturns(c));
  const rets15 = basket15.map((s) => barReturns(s.close));
  const labels = SYMBOLS.map((s) => s);
  const folds = walkForwardSplit({ n: N, trainSize: TRAIN, testSize: TEST });

  const vecA = {}; const vecF = {};
  const pooledA = []; const pooledF = [];
  let grossA = 0; let turnA = 0; let grossF = 0; let turnF = 0;
  const crossCorr = [];
  for (let si = 0; si < 8; si++) {
    const panelBase = { streamIndex: si, label: labels[si], labels, returnsByStream: rets1.map((r) => r.slice()) };
    const vbase = makeCandleViewFor(candles1[si], { panel: panelBase })(rets1[si], null);
    const a = []; const f = [];
    for (const fold of folds) {
      const confA = sig(vbase, fold.test);
      const posA = confA.map((c) => confidenceToPosition(c, POLICY));
      const confF = fold.test.map((tbar) => {
        const i15 = lastBefore(basket15[si].t, t1[si][tbar]);
        if (i15 < 64 + 128) return 0;
        return positionAt(CAND15, { returns: rets15[si] }, i15);
      });
      const posF = confF.map((c) => confidenceToPosition(c, POLICY));
      const heldA = positionsFromSignals(posA, { lag: 1 });
      const heldF = positionsFromSignals(posF, { lag: 1 });
      turnA += turnover(heldA);
      turnF += turnover(heldF);
      heldA.forEach((h, k) => {
        const r = h * rets1[si][fold.test[k]];
        a.push(r); pooledA.push(r); grossA += r;
      });
      heldF.forEach((h, k) => {
        const r = h * rets1[si][fold.test[k]];
        f.push(r); pooledF.push(r); grossF += r;
      });
    }
    vecA[labels[si]] = a;
    vecF[labels[si] + ':15m'] = f;
    const ma = a.reduce((x, y) => x + y, 0) / a.length;
    const mf = f.reduce((x, y) => x + y, 0) / f.length;
    let cov = 0; let va = 0; let vf = 0;
    for (let k = 0; k < a.length; k++) { cov += (a[k] - ma) * (f[k] - mf); va += (a[k] - ma) * (a[k] - ma); vf += (f[k] - mf) * (f[k] - mf); }
    crossCorr.push(va > 0 && vf > 0 ? cov / Math.sqrt(va * vf) : null);
  }

  const panel = (vecs) => {
    const sharpe = sharpeRatio(Object.values(vecs).flat(), { periodsPerYear: 252 });
    const de = designEffectOfStreams(vecs, { foldLength: TEST });
    return {
      sharpe: +sharpe.toFixed(4),
      meanPairwiseCorr: de.available ? +de.meanPairwiseCorr.toFixed(4) : null,
      designEffect: de.available ? +de.designEffect.toFixed(4) : null,
      effectiveStreams: de.available ? +de.effectiveStreams.toFixed(4) : null,
      method: de.available ? de.method : de.reason,
    };
  };
  const statA = panel(vecA);
  const statF = panel(vecF);
  const statS = panel({ ...vecA, ...vecF });

  check('e120: arm A reproduces the run Sharpe (1.0848 +- 0.05)', Math.abs(statA.sharpe - REF_SHARPE) < 0.05, 'A=' + statA.sharpe);
  check('e120: same-stream cross-frequency return corr measured on all 8', crossCorr.every((c) => c != null && Number.isFinite(c)), crossCorr.map((c) => c == null ? 'null' : c.toFixed(2)).join('/'));
  check('e120: stacked panel measures finite', statS.effectiveStreams != null && Number.isFinite(statS.effectiveStreams), 'S effStreams=' + statS.effectiveStreams + ' rbar=' + statS.meanPairwiseCorr);

  let verdict = 'MIXED';
  if (statS.effectiveStreams >= statA.effectiveStreams * 1.25) verdict = 'SUPPORTED';
  else if (statS.meanPairwiseCorr >= statA.meanPairwiseCorr) verdict = 'NEGATIVE';
  check('e120: verdict recorded (' + verdict + ')', true, 'A effStreams=' + statA.effectiveStreams + ' rbar=' + statA.meanPairwiseCorr + ' | S effStreams=' + statS.effectiveStreams + ' rbar=' + statS.meanPairwiseCorr);

  const failed = checks.filter((c) => !c.pass);
  return {
    config: { bars: N, trainSize: TRAIN, testSize: TEST, policy: POLICY, lag: 1, mom15m: { window: 64, zWindow: 128 }, causal: 'last 15m bar with t < 1h open' },
    arms: {
      A: { ...statA, grossPnl: +grossA.toFixed(6), turnover: +turnA.toFixed(3), breakEvenBps: turnA > 0 ? +(1e4 * grossA / turnA).toFixed(2) : null },
      F: { ...statF, grossPnl: +grossF.toFixed(6), turnover: +turnF.toFixed(3), breakEvenBps: turnF > 0 ? +(1e4 * grossF / turnF).toFixed(2) : null, note: 'descriptive only: 15m momentum held on the 1h grid, not the native 15m edge' },
    },
    stacked: statS,
    sameStreamCrossFreqCorr: crossCorr.map((c) => (c == null ? null : +c.toFixed(4))),
    verdict,
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length === 0,
  };
}
