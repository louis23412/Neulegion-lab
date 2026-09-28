// E0d - L10-c: does the window effect survive the repo's OWN aggregation?
//
// F-01 says the reported `sig-momentum` +1.08 is the last-600-bars number and the
// full history reads +0.11. The lab measured that on a *contiguous* slice. The A/B
// instead scores walk-forward folds and pools them (analyze.js: trainSize=60,
// testSize=15). For a parameter-free signal the two should coincide, but "should"
// is not "measured" - and this is the last way F-01 could be wrong.
//
// This experiment runs the repo's real aggregation path read-only:
//   walkForwardSplit (60/15) -> walkForwardEvaluate (per stream) -> poolReports
// for the shipped `sig-momentum`, on the 600-bar slice and on the full history, and
// prints the pooled Sharpe beside the plain contiguous readout on the same bars.
//
// If the fold+pool number and the contiguous number agree, F-01 holds under the
// repo's own arithmetic. If they diverge, F-01 is about the aggregation, not the
// window, and must be rewritten.

import { buildPanel, positionsOfFast, score, netSeries, panelReadout, stats, SYMBOLS, PERIODS_PER_YEAR } from '../lib/lab.js';
import { momentum } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { walkForwardEvaluate, poolReports } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';
import { walkForwardSplit } from '../../NeuLegion-master/NeuLegion-master/src/analysis/splits.js';

export async function run({ tf = '1h', windows = [600, 2400, 9600, 0], trainSize = 60, testSize = 15, costBps = 0 } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const total = panel[0].n;
    const signals = panel.map((s) => positionsOfFast(momentum, s, { window: 16 }));
    const out = { config: { tf, totalBars: total, streams: panel.length, trainSize, testSize, costBps }, windows: {} };

    for (const W of windows) {
        const n = W > 0 ? Math.min(W, total) : total;
        const rets = panel.map((s) => s.returns.slice(-n));
        const sigs = signals.map((s) => s.slice(-n));

        // (a) the repo's walk-forward + pool path (parameter-free signal, so folds
        // only partition; the audit is off because causality is pinned by E0c).
        const reports = rets.map((r, i) => {
            const folds = walkForwardSplit({ n: r.length, trainSize, testSize });
            const pos = sigs[i];
            const signalForFold = (train, test) => test.map((j) => pos[j]);
            return walkForwardEvaluate({ returns: r, folds, signalForFold, costBps, periodsPerYear: PERIODS_PER_YEAR, trials: 1, audit: false, requireCausal: true });
        });
        const pooled = poolReports(reports, { periodsPerYear: PERIODS_PER_YEAR, trials: 1 });

        // (b) the contiguous readout on the same bars (what E0b reports).
        const contPer = rets.map((r, i) => score(r, sigs[i], { costBps }));
        const netByStream = rets.map((r, i) => netSeries(r, sigs[i], costBps));
        const rd = panelReadout(netByStream, { maxBars: Math.min(n, 9600), maxClusters: 192, label: `contig-${n}` });

        const dep = pooled.dependence && pooled.dependence.available ? pooled.dependence : null;
        out.windows[W === 0 ? 'full' : String(W)] = {
            bars: n,
            foldsPerStream: reports[0].folds.length,
            testBarsPerStream: reports[0].foldLengths.reduce((a, b) => a + b, 0),
            pooledBars: pooled.pooledBars,
            // (a) repo aggregation
            abPooledNetSharpe: pooled.pooledMetrics.netSharpe,
            abMeanFoldSharpe: pooled.meanFoldSharpe,
            abDsrAdjusted: pooled.pooledMetrics.dsrAdjusted,
            abDesignEffect: dep ? dep.designEffect : null,
            abEffectiveStreams: dep ? dep.effectiveStreams : null,
            // (b) contiguous
            contiguousMeanSharpe: stats(contPer.map((p) => p.netSharpe)).mean,
            contiguousPooledNetSharpe: rd.pooled.netSharpe,
            contiguousDesignEffect: rd.dependence && rd.dependence.designEffect != null ? rd.dependence.designEffect : null,
            // the comparison that decides L10-c
            agreement: Math.abs(pooled.pooledMetrics.netSharpe - rd.pooled.netSharpe),
        };
    }
    return out;
}
