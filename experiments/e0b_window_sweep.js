// E0b - window sweep: is the reported edge a stable property or a window artefact?
//
// The round-29/30 acceptance batch reports `sig-momentum` at +1.08 net Sharpe with a
// 600-bar window. The lab's full-history measurement (E0) is much lower. This
// experiment measures the same arm over a ladder of trailing windows so the
// window-dependence of the headline number is explicit rather than assumed.
//
// Output: per window W - per-stream net Sharpe, mean, break-even, and the pooled
// panel readout (dependence + dsrAdjusted) on that window.

import { buildPanel, positionsOf, score, netSeries, panelReadout, stats, SYMBOLS } from '../lib/lab.js';
import { momentum } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';

export async function run({ tf = '1h', windows = [600, 1200, 2400, 4800, 9600, 0], costBps = 0 } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const signals = panel.map((s) => positionsOf(momentum, s, { window: 16 }));
    const total = panel[0].n;
    const rows = [];
    for (const W of windows) {
        const w = W > 0 ? Math.min(W, total) : total;
        const per = panel.map((s, i) => {
            const ret = s.returns.slice(-w);
            const sig = signals[i].slice(-w);
            const m = score(ret, sig, { costBps });
            return { symbol: s.label.replace('candles_', '').replace('.jsonl', ''), netSharpe: m.netSharpe, breakEvenCostBps: m.breakEvenCostBps, turnoverPerBar: m.turnover / m.bars };
        });
        const netByStream = panel.map((s, i) => netSeries(s.returns.slice(-w), signals[i].slice(-w), costBps));
        const rd = panelReadout(netByStream, { maxBars: Math.min(w, 9600), maxClusters: 192, label: `W=${w}` });
        rows.push({
            window: w,
            meanSharpe: stats(per.map((p) => p.netSharpe)),
            meanBreakEvenCostBps: stats(per.map((p) => p.breakEvenCostBps)).mean,
            turnoverPerBar: stats(per.map((p) => p.turnoverPerBar)).mean,
            positiveStreams: per.filter((p) => p.netSharpe > 0).length,
            dependence: rd.dependence,
            pooled: rd.pooled,
        });
    }
    return { config: { tf, totalBars: total, symbols: SYMBOLS.length, costBps }, rows };
}
