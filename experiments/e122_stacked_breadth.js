// E122 - STACKED-24 SYMBOL BREADTH (round 94).
//
// WHY. e121/F-134 showed 8 midcaps buy independence (stacked-16 effStreams 2.35
// vs majors 1.75, rbar 0.51 -> 0.39). Question: does a SECOND wave of 8 symbols
// buy further independence, or is the breadth saturated / redundant?
//
// WHAT. Shared grid: last 600 1h bars ending 2026-08-31T23:00Z on all 24 streams
// (timestamp-aligned, exact). Same recipe as e121 (train 60 / test 15,
// deadZone-0.05 policy, lag-1, standalone per-stream scoring, sig-momentum).
// Panels: M = 8 majors, C = 8 wave-1 midcaps, D = 8 wave-2 midcaps
// (LTC/ETC/UNI/AAVE/ATOM/DOT/FIL/APT, harvested round 94: 2024-06-01..2026-08-31,
// 19728 bars each, zero gaps), S16 = M+C (e121 replication), S24 = M+C+D.
// Calibration: the S16 replication must reproduce e121 (effStreams 2.35 +- 0.15).
// Pre-registered: S24 effStreams >= S16 effStreams x 1.20 => SUPPORTED (the second
// wave buys further independence); S24 rbar >= S16 rbar => NEGATIVE (saturated);
// else MIXED. Sharpes descriptive (F-01 face: ~0.13 on this window).
//
// PASS iff calibration holds, alignment is exact on all 24 streams, and all
// panels measure finite.

import { SYMBOLS, loadBasket, loadSeries } from '../lib/lab.js';
import { SIGNAL_CANDIDATES, SIGUP_CANDIDATES, signalForCandidate } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { makeCandleViewFor } from '../../NeuLegion-master/NeuLegion-master/src/analysis/world.js';
import { barReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';
import { walkForwardSplit } from '../../NeuLegion-master/NeuLegion-master/src/analysis/splits.js';
import { confidenceToPosition } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward/returns.js';
import { positionsFromSignals, turnover } from '../../NeuLegion-master/NeuLegion-master/src/analysis/backtest.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';
import { designEffectOfStreams } from '../../NeuLegion-master/NeuLegion-master/src/analysis/streams.js';

const MIDCAPS1 = ['avaxusdt', 'nearusdt', 'arbusdt', 'suiusdt', 'opusdt', 'injusdt', 'tiausdt', 'seiusdt'];
const MIDCAPS2 = ['ltcusdt', 'etcusdt', 'uniusdt', 'aaveusdt', 'atomusdt', 'dotusdt', 'filusdt', 'aptusdt'];
const N = 600;
const TRAIN = 60;
const TEST = 15;
const POLICY = { deadZone: 0.05, scale: 1 };
const REF_S16_EFF = 2.35;
const T_END = Date.parse('2026-08-31T23:00:00.000Z');

function sliceEnd(s, n) {
  const idx = s.t.lastIndexOf(T_END);
  if (idx < n - 1) return null;
  const cut = (arr) => arr.slice(idx - n + 1, idx + 1);
  return { t: cut(s.t), close: cut(s.close), open: cut(s.open), high: cut(s.high), low: cut(s.low), volume: cut(s.volume) };
}

export async function run({} = {}) {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });

  const majors = await loadBasket(SYMBOLS, '1h');
  const mids1 = [];
  for (const s of MIDCAPS1) mids1.push(await loadSeries('src/NeuLegion-lab/data/midcap/candles_' + s + '_1h.jsonl'));
  const mids2 = [];
  for (const s of MIDCAPS2) mids2.push(await loadSeries('src/NeuLegion-lab/data/midcap2/candles_' + s + '_1h.jsonl'));
  check('e122: 8 majors + 8 wave-1 + 8 wave-2 loaded with >= 600 bars', majors.length === 8 && mids1.length === 8 && mids2.length === 8 && majors.every((s) => s.n >= N) && mids1.every((s) => s.n >= N) && mids2.every((s) => s.n >= N), majors.map((s) => s.n).join('/') + ' | ' + mids1.map((s) => s.n).join('/') + ' | ' + mids2.map((s) => s.n).join('/'));

  const roster = [...(SIGNAL_CANDIDATES || []), ...(SIGUP_CANDIDATES || [])];
  const cand = roster.find((c) => c.id === 'sig-momentum');
  check('e122: repo roster carries sig-momentum', !!cand, cand ? 'ok' : 'missing');
  const sig = signalForCandidate(cand);

  const cutMajors = majors.map((s) => sliceEnd(s, N));
  const cutMids1 = mids1.map((s) => sliceEnd(s, N));
  const cutMids2 = mids2.map((s) => sliceEnd(s, N));
  const all = [...cutMajors, ...cutMids1, ...cutMids2];
  const aligned = all.every((c) => c && c.t.length === N);
  const exact = aligned && all.every((c) => c.t.every((t, i) => t === cutMajors[0].t[i]));
  check('e122: shared 600-bar grid timestamp-exact on all 24 streams', aligned && exact, aligned ? (exact ? '24/24 exact' : 'MISALIGNED') : 'short window');

  const scoreBasket = (cut, labels) => {
    const rets = cut.map((c) => barReturns(c.close));
    const folds = walkForwardSplit({ n: N, trainSize: TRAIN, testSize: TEST });
    const vecs = {};
    const pooled = [];
    let gross = 0; let turn = 0;
    cut.forEach((c, si) => {
      const candles = c.close.map((close, i) => ({ open: c.open[i], high: c.high[i], low: c.low[i], close, volume: c.volume[i] }));
      const panelBase = { streamIndex: si, label: labels[si], labels, returnsByStream: rets.map((r) => r.slice()) };
      const vbase = makeCandleViewFor(candles, { panel: panelBase })(rets[si], null);
      const vec = [];
      for (const f of folds) {
        const pos = sig(vbase, f.test).map((x) => confidenceToPosition(x, POLICY));
        const held = positionsFromSignals(pos, { lag: 1 });
        turn += turnover(held);
        held.forEach((h, k) => {
          const r = h * rets[si][f.test[k]];
          vec.push(r); pooled.push(r); gross += r;
        });
      }
      vecs[labels[si]] = vec;
    });
    const sharpe = sharpeRatio(pooled, { periodsPerYear: 252 });
    const de = designEffectOfStreams(vecs, { foldLength: TEST });
    return {
      vecs, pooled,
      sharpe: +sharpe.toFixed(4),
      grossPnl: +gross.toFixed(6),
      turnover: +turn.toFixed(3),
      breakEvenBps: turn > 0 ? +(1e4 * gross / turn).toFixed(2) : null,
      meanPairwiseCorr: de.available ? +de.meanPairwiseCorr.toFixed(4) : null,
      designEffect: de.available ? +de.designEffect.toFixed(4) : null,
      effectiveStreams: de.available ? +de.effectiveStreams.toFixed(4) : null,
      method: de.available ? de.method : de.reason,
    };
  };

  const stackStats = (parts) => {
    const both = {};
    for (const [prefix, stat] of parts) for (const [k, v] of Object.entries(stat.vecs)) both[prefix + k] = v;
    const deS = designEffectOfStreams(both, { foldLength: TEST });
    const pooledS = parts.flatMap(([, stat]) => stat.pooled);
    return {
      sharpe: +sharpeRatio(pooledS, { periodsPerYear: 252 }).toFixed(4),
      meanPairwiseCorr: deS.available ? +deS.meanPairwiseCorr.toFixed(4) : null,
      designEffect: deS.available ? +deS.designEffect.toFixed(4) : null,
      effectiveStreams: deS.available ? +deS.effectiveStreams.toFixed(4) : null,
      method: deS.available ? deS.method : deS.reason,
    };
  };

  const statM = scoreBasket(cutMajors, SYMBOLS.map((s) => s));
  const statC = scoreBasket(cutMids1, MIDCAPS1.map((s) => s));
  const statD = scoreBasket(cutMids2, MIDCAPS2.map((s) => s));
  const statS16 = stackStats([['', statM], ['mid:', statC]]);
  const statS24 = stackStats([['', statM], ['mid:', statC], ['w2:', statD]]);
  check('e122: S16 replication reproduces e121 (effStreams 2.35 +- 0.15)', Math.abs(statS16.effectiveStreams - REF_S16_EFF) < 0.15, 'S16 effStreams=' + statS16.effectiveStreams);
  check('e122: all five panels measure finite', [statM, statC, statD, statS16, statS24].every((s) => Number.isFinite(s.sharpe) && s.effectiveStreams != null), 'M=' + statM.sharpe + '/' + statM.effectiveStreams + ' C=' + statC.sharpe + '/' + statC.effectiveStreams + ' D=' + statD.sharpe + '/' + statD.effectiveStreams + ' S16=' + statS16.sharpe + '/' + statS16.effectiveStreams + ' S24=' + statS24.sharpe + '/' + statS24.effectiveStreams);

  let verdict = 'MIXED';
  if (statS24.effectiveStreams >= statS16.effectiveStreams * 1.20) verdict = 'SUPPORTED';
  else if (statS24.meanPairwiseCorr >= statS16.meanPairwiseCorr) verdict = 'NEGATIVE';
  check('e122: verdict recorded (' + verdict + ')', true, 'S16 effStreams=' + statS16.effectiveStreams + ' rbar=' + statS16.meanPairwiseCorr + ' | S24 effStreams=' + statS24.effectiveStreams + ' rbar=' + statS24.meanPairwiseCorr);

  const strip = (s) => ({ sharpe: s.sharpe, grossPnl: s.grossPnl, turnover: s.turnover, breakEvenBps: s.breakEvenBps, meanPairwiseCorr: s.meanPairwiseCorr, designEffect: s.designEffect, effectiveStreams: s.effectiveStreams, method: s.method });
  const failed = checks.filter((c) => !c.pass);
  return {
    config: { bars: N, trainSize: TRAIN, testSize: TEST, policy: POLICY, lag: 1, gridEnd: new Date(T_END).toISOString(), wave1: MIDCAPS1, wave2: MIDCAPS2 },
    majors: strip(statM),
    wave1: strip(statC),
    wave2: strip(statD),
    stacked16: statS16,
    stacked24: statS24,
    verdict,
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length === 0,
  };
}
