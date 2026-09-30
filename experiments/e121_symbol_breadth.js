// E121 - SYMBOL-BREADTH STACKED PANEL (round 93, TODO 115).
//
// WHY. e120/F-133 closed frequency breadth (1h~15m corr ~0.90); e119/F-132 closed
// demeaning. The remaining AI-side W5 leg is new symbols: 8 mid-cap Binance perps
// (harvested round 93: 2024-06-01..2026-08-31, 19728 bars each, zero gaps) beside the
// 8 majors. Question: does the 16-symbol panel raise effective streams?
//
// WHAT. Shared grid: last 600 1h bars ending 2026-08-31T23:00Z on all 16 streams
// (timestamp-aligned, exact). Same recipe as e119 (train 60 / test 15, deadZone-0.05
// policy, lag-1, standalone per-stream scoring). Panels: M = 8 majors, C = 8 midcaps,
// S = stacked 16. Calibration: the same recipe on majors ending 2026-09-19 (the run
// window) must reproduce 1.0848 +- 0.05 — the recipe is already validated, this pins
// the data plumbing.
// Pre-registered: S effStreams >= M effStreams x 1.25 => SUPPORTED (symbols buy
// independence); S rbar >= M rbar => NEGATIVE; else MIXED. Sharpes descriptive.
//
// PASS iff calibration holds, alignment is exact, and all three panels measure finite.

import { SYMBOLS, loadBasket, loadSeries } from '../lib/lab.js';
import { SIGNAL_CANDIDATES, SIGUP_CANDIDATES, signalForCandidate } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { makeCandleViewFor } from '../../NeuLegion-master/NeuLegion-master/src/analysis/world.js';
import { barReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';
import { walkForwardSplit } from '../../NeuLegion-master/NeuLegion-master/src/analysis/splits.js';
import { confidenceToPosition } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward/returns.js';
import { positionsFromSignals, turnover } from '../../NeuLegion-master/NeuLegion-master/src/analysis/backtest.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';
import { designEffectOfStreams } from '../../NeuLegion-master/NeuLegion-master/src/analysis/streams.js';

const MIDCAPS = ['avaxusdt', 'nearusdt', 'arbusdt', 'suiusdt', 'opusdt', 'injusdt', 'tiausdt', 'seiusdt'];
const N = 600;
const TRAIN = 60;
const TEST = 15;
const POLICY = { deadZone: 0.05, scale: 1 };
const REF_SHARPE = 1.0848;
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
  const mids = [];
  for (const s of MIDCAPS) mids.push(await loadSeries('src/NeuLegion-lab/data/midcap/candles_' + s + '_1h.jsonl'));
  check('e121: 8 majors + 8 midcaps loaded with >= 600 bars', majors.length === 8 && mids.length === 8 && majors.every((s) => s.n >= N) && mids.every((s) => s.n >= N), majors.map((s) => s.n).join('/') + ' | ' + mids.map((s) => s.n).join('/'));

  const roster = [...(SIGNAL_CANDIDATES || []), ...(SIGUP_CANDIDATES || [])];
  const cand = roster.find((c) => c.id === 'sig-momentum');
  check('e121: repo roster carries sig-momentum', !!cand, cand ? 'ok' : 'missing');
  const sig = signalForCandidate(cand);

  const cutMajors = majors.map((s) => sliceEnd(s, N));
  const cutMids = mids.map((s) => sliceEnd(s, N));
  const aligned = [...cutMajors, ...cutMids].every((c) => c && c.t.length === N);
  const exact = aligned && [...cutMajors, ...cutMids].every((c) => c.t.every((t, i) => t === cutMajors[0].t[i]));
  check('e121: shared 600-bar grid timestamp-exact on all 16 streams', aligned && exact, aligned ? (exact ? '16/16 exact' : 'MISALIGNED') : 'short window');

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

  const calMajors = majors.map((s) => ({ t: s.t, close: s.close.slice(-N), open: s.open.slice(-N), high: s.high.slice(-N), low: s.low.slice(-N), volume: s.volume.slice(-N) }));
  const cal = scoreBasket(calMajors, SYMBOLS.map((s) => s));
  check('e121: calibration reproduces the run Sharpe on the run window (1.0848 +- 0.05)', Math.abs(cal.sharpe - REF_SHARPE) < 0.05, 'cal=' + cal.sharpe);

  const statM = scoreBasket(cutMajors, SYMBOLS.map((s) => s));
  const statC = scoreBasket(cutMids, MIDCAPS.map((s) => s));
  const both = {};
  for (const [k, v] of Object.entries(statM.vecs)) both[k] = v;
  for (const [k, v] of Object.entries(statC.vecs)) both['mid:' + k] = v;
  const deS = designEffectOfStreams(both, { foldLength: TEST });
  const pooledS = [...statM.pooled, ...statC.pooled];
  const statS = {
    sharpe: +sharpeRatio(pooledS, { periodsPerYear: 252 }).toFixed(4),
    meanPairwiseCorr: deS.available ? +deS.meanPairwiseCorr.toFixed(4) : null,
    designEffect: deS.available ? +deS.designEffect.toFixed(4) : null,
    effectiveStreams: deS.available ? +deS.effectiveStreams.toFixed(4) : null,
    method: deS.available ? deS.method : deS.reason,
  };
  check('e121: all three panels measure finite', [statM, statC, statS].every((s) => Number.isFinite(s.sharpe) && s.effectiveStreams != null), 'M=' + statM.sharpe + '/' + statM.effectiveStreams + ' C=' + statC.sharpe + '/' + statC.effectiveStreams + ' S=' + statS.sharpe + '/' + statS.effectiveStreams);

  let verdict = 'MIXED';
  if (statS.effectiveStreams >= statM.effectiveStreams * 1.25) verdict = 'SUPPORTED';
  else if (statS.meanPairwiseCorr >= statM.meanPairwiseCorr) verdict = 'NEGATIVE';
  check('e121: verdict recorded (' + verdict + ')', true, 'M effStreams=' + statM.effectiveStreams + ' rbar=' + statM.meanPairwiseCorr + ' | S effStreams=' + statS.effectiveStreams + ' rbar=' + statS.meanPairwiseCorr);

  const strip = (s) => ({ sharpe: s.sharpe, grossPnl: s.grossPnl, turnover: s.turnover, breakEvenBps: s.breakEvenBps, meanPairwiseCorr: s.meanPairwiseCorr, designEffect: s.designEffect, effectiveStreams: s.effectiveStreams, method: s.method });
  const failed = checks.filter((c) => !c.pass);
  return {
    config: { bars: N, trainSize: TRAIN, testSize: TEST, policy: POLICY, lag: 1, gridEnd: new Date(T_END).toISOString(), midcaps: MIDCAPS },
    calibration: strip(cal),
    majors: strip(statM),
    midcaps: strip(statC),
    stacked: statS,
    verdict,
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length === 0,
  };
}
