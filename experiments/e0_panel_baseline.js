// E0 - the baseline panel, measured by the repo's own statistics.
//
// Question: what does the data actually look like, and what is the shipped
// momentum arm worth on it *as a panel* (not as an average of standalone streams)?
//
// This is the anchor experiment: it reproduces the project's frontier numbers
// (momentum Sharpe, cross-stream correlation, design effect, effective streams /
// effective bars) on the shipped candles, so every later lab claim is comparable.
//
// Output: per-stream metrics + the pooled panel readout (dependence + pooled DSR),
// for (a) buy-and-hold (the market factor), (b) shipped `sig-momentum`.

import { buildPanel, positionsOf, score, netSeries, panelReadout, meanPairwiseCorrelation, stats, SYMBOLS } from '../lib/lab.js';
import { momentum } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';

function perStreamTable(panel, signalsByStream, costBps) {
    const rows = panel.map((s, i) => {
        const m = score(s.returns, signalsByStream[i], { costBps });
        return {
            symbol: s.label.replace('candles_', '').replace('.jsonl', ''),
            netSharpe: m.netSharpe,
            grossSharpe: m.grossSharpe,
            breakEvenCostBps: m.breakEvenCostBps,
            turnover: m.turnover,
            tradeCount: m.tradeCount,
            nonZeroFraction: m.nonZeroFraction,
            meanAbsPosition: m.meanAbsPosition,
            maxDrawdown: m.maxDrawdown,
            hitRate: m.hitRate,
            bars: m.bars,
        };
    });
    const sharpes = rows.map((r) => r.netSharpe);
    return { rows, sharpe: stats(sharpes), meanBreakEvenCostBps: stats(rows.map((r) => r.breakEvenCostBps)).mean };
}

export async function run({ tf = '15m', maxBars = 9600, maxClusters = 192, costBps = 0 } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const aligned = panel[0].n;
    const returnsByStream = panel.map((s) => s.returns);

    // Whole-series cross-stream return correlation (the raw pricing factor).
    const wholeSeriesCorr = meanPairwiseCorrelation(returnsByStream.map((r) => r.slice(1)));

    const out = {
        config: { tf, symbols: SYMBOLS.length, alignedBars: aligned, windowBars: maxBars, maxClusters, costBps },
        panel: {
            streams: panel.length,
            wholeSeriesMeanPairwiseReturnCorr: wholeSeriesCorr,
        },
        arms: {},
    };

    // (a) buy-and-hold: the market factor itself.
    const ones = panel.map((s) => s.returns.map(() => 1));
    const bh = perStreamTable(panel, ones, 0);
    out.arms.buyAndHold = {
        perStream: bh.rows,
        meanSharpe: bh.sharpe,
        panelReadout: panelReadout(panel.map((s) => netSeries(s.returns, s.returns.map(() => 1), 0)), { maxBars, maxClusters, label: 'buy-and-hold' }),
    };

    // (b) shipped sig-momentum (window 16, saturation 2, zWindow 32).
    const momSignals = panel.map((s) => positionsOf(momentum, s, { window: 16 }));
    const mom = perStreamTable(panel, momSignals, costBps);
    out.arms.momentum = {
        perStream: mom.rows,
        meanSharpe: mom.sharpe,
        meanBreakEvenCostBps: mom.meanBreakEvenCostBps,
        panelReadout: panelReadout(panel.map((s, i) => netSeries(s.returns, momSignals[i], costBps)), { maxBars, maxClusters, label: 'sig-momentum' }),
        coverage: {
            nonZeroFraction: stats(mom.rows.map((r) => r.nonZeroFraction)).mean,
            turnoverPerBar: stats(mom.rows.map((r) => r.turnover / r.bars)).mean,
        },
    };

    return out;
}
