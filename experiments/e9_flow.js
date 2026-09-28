// E9 - order-flow (taker buy/sell imbalance): the one genuinely new input. L07.
//
// The shipped candles carry no order flow. `data/taker_1h.json` supplies the
// Binance taker-buy ratio on the same 1h grid (harvested from data.binance.vision;
// see `data/README.md`). This experiment asks the only question that matters for a
// new data source: does it contain causal, out-of-sample information that the
// OHLCV family does not?
//
// Three reads, in increasing strength of claim:
//   1. univariate IC: corr(feature_t, forward return) per horizon - is there ANY
//      information, before any pipeline?
//   2. pipeline arms: each feature through the SAME causalZScore+clamp pipeline as
//      the shipped family, scored full-history with block stability and break-even.
//   3. panel: dependence of the flow arms and their correlation with the price
//      basket (a flow sleeve is only useful to this project if it is *independent*).
//
// Controls (oracle / random) run in the same session - no negative is believed
// without them (F-11).

import { buildPanel, attachFlow, loadTaker, positionsOfFast, score, netSeries, panelReadout, meanPairwiseCorrelation, pearsonCorrelation, stats, SYMBOLS, PERIODS_PER_YEAR } from '../lib/lab.js';
import { momentum } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { flowImbalance, flowMean, flowChange, flowPressure, flowDivergence, flowXs, flowGatedMomentum } from '../prototypes/taker.js';
import { blockStability } from './e2_arm_sweep.js';

const ARMS = [
    { name: 'flow-1', fn: flowImbalance, note: 'this bar\'s signed taker imbalance' },
    { name: 'flow-8', fn: flowMean, window: 8, note: '8-bar mean imbalance' },
    { name: 'flow-24', fn: flowMean, window: 24, note: '24-bar mean imbalance' },
    { name: 'flow-chg-8', fn: flowChange, window: 8, note: 'flow shock vs trailing mean' },
    { name: 'flow-diverge-8', fn: flowDivergence, window: 8, note: 'price/flow agreement (+1/-1)' },
    { name: 'flow-gate-mom16', fn: flowGatedMomentum, window: 16, params: { flowWindow: 8 }, note: 'momentum, abstain on flow divergence' },
    { name: 'flow-xs-8', fn: flowXs, window: 8, note: 'cross-sectional relative flow' },
    { name: 'flow-xs-24', fn: flowXs, window: 24, note: 'cross-sectional relative flow, slower' },
    { name: 'mom-16', fn: momentum, window: 16, note: 'baseline for comparison' },
];

function rawSeries(panel, fn, opts) {
    return panel.map((s) => {
        const out = new Array(s.returns.length).fill(NaN);
        for (let t = 0; t < out.length; t++) { const v = fn(s, t, opts); if (Number.isFinite(v)) out[t] = v; }
        return out;
    });
}

function icOf(panel, rawByStream, horizon) {
    const xs = [];
    const ys = [];
    for (let i = 0; i < panel.length; i++) {
        const raw = rawByStream[i];
        const r = panel[i].returns;
        for (let t = 0; t + horizon < r.length; t++) {
            if (!Number.isFinite(raw[t])) continue;
            let acc = 0;
            let ok = true;
            for (let h = 1; h <= horizon; h++) { if (!Number.isFinite(r[t + h])) { ok = false; break; } acc += r[t + h]; }
            if (!ok) continue;
            xs.push(raw[t]); ys.push(acc);
        }
    }
    return { n: xs.length, ic: pearsonCorrelation(xs, ys) };
}

export async function run({ tf = '1h', blocks = 6, takerPath = null } = {}) {
    const rawPanel = await buildPanel({ symbols: SYMBOLS, tf });
    const defaultTaker = tf === '15m' ? 'src/NeuLegion-lab/data/taker_15m.json' : 'src/NeuLegion-lab/data/taker_1h.json';
    const taker = await loadTaker(takerPath || defaultTaker);
    let panel = attachFlow(rawPanel, SYMBOLS, taker);

    // Restrict to the bars where order flow exists (drops the last few weeks: the
    // current month's Binance file is not published yet).
    let end = panel[0].t.length;
    for (const s of panel) { for (let k = s.t.length - 1; k >= 0; k--) if (Number.isFinite(s.flow[k])) { end = Math.min(end, k + 1); break; } }
    panel = panel.map((s) => ({ ...s, t: s.t.slice(0, end), close: s.close.slice(0, end), closes: s.closes.slice(0, end), volume: s.volume.slice(0, end), volumes: s.volumes.slice(0, end), returns: s.returns.slice(0, end), flow: s.flow.slice(0, end), n: end }));
    const flowByStream = panel.map((s) => s.flow);
    panel = panel.map((s, i) => ({ ...s, streamIndex: i, panel: { ...(s.panel || {}), flowByStream, streamIndex: i } }));

    const n = panel[0].returns.length;
    const coverage = panel.map((s) => s.flow.filter(Number.isFinite).length / n);
    const market = new Array(n).fill(0);
    for (let t = 0; t < n; t++) { let a = 0; for (const s of panel) a += s.returns[t]; market[t] = a / panel.length; }

    const out = {
        config: { tf, symbols: panel.length, bars: n, blocks, flowNote: 'taker-buy ratio from data.binance.vision, 2020-08 .. 2026-08' },
        coverage: { mean: stats(coverage).mean, min: stats(coverage).min, max: stats(coverage).max },
        panel: {
            meanPairwiseReturnCorr: meanPairwiseCorrelation(panel.map((s) => s.returns.map((v, i) => (i ? v : 0)))),
            meanPairwiseFlowCorr: (() => { try { return meanPairwiseCorrelation(panel.map((s) => Array.from(s.flow).map((v) => (Number.isFinite(v) ? v : 0)))); } catch { return null; } })(),
        },
        ic: {},
        arms: {},
        controls: {},
    };

    for (const arm of ARMS) {
        const opts = { window: arm.window, ...(arm.params || {}) };
        const raw = rawSeries(panel, arm.fn, opts);
        const ic1 = icOf(panel, raw, 1);
        const ic4 = icOf(panel, raw, 4);
        out.ic[arm.name] = { h1: ic1.ic, h4: ic4.ic, n: ic1.n };
        const signals = panel.map((s, i) => positionsOfFast(arm.fn, s, opts));
        const per = panel.map((s, i) => score(s.returns, signals[i], { costBps: 0 }));
        const netByStream = panel.map((s, i) => netSeries(s.returns, signals[i], 0));
        const rd = panelReadout(netByStream, { maxBars: 9600, maxClusters: 192, label: arm.name });
        const pooled = netByStream[0].map((_, t) => netByStream.reduce((a, x) => a + x[t], 0) / netByStream.length);
        out.arms[arm.name] = {
            note: arm.note,
            meanSharpe: stats(per.map((p) => p.netSharpe)).mean,
            meanBreakEvenCostBps: stats(per.map((p) => p.breakEvenCostBps)).mean,
            positiveStreams: per.filter((p) => p.netSharpe > 0).length,
            turnoverPerBar: stats(per.map((p) => p.turnover / p.bars)).mean,
            stability: blockStability(netByStream, blocks),
            dependence: rd.dependence,
            pooled: rd.pooled,
            marketCorr: pearsonCorrelation(pooled, market),
        };
    }

    // Controls: oracle / anti-oracle / seeded random on the same flow window.
    const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const rnd = mulberry32(12345);
    const rand = new Array(n).fill(0).map(() => (rnd() < 0.5 ? -1 : 1));
    for (const [name, mk] of Object.entries({
        oracle: (s) => s.returns.map((r, t) => (t + 1 < s.returns.length ? Math.sign(s.returns[t + 1]) : 0)),
        random: () => rand.slice(),
    })) {
        const sig = panel.map((s) => mk(s));
        const per = panel.map((s, i) => score(s.returns, sig[i], { costBps: 0 }));
        const anti = panel.map((s, i) => score(s.returns, sig[i].map((v) => -v), { costBps: 0 }));
        out.controls[name] = { meanSharpe: stats(per.map((p) => p.netSharpe)).mean, antiSharpe: stats(anti.map((p) => p.netSharpe)).mean };
    }
    out.controls.pass = Math.abs(out.controls.oracle.meanSharpe) > 10 && Math.abs(out.controls.oracle.meanSharpe + out.controls.oracle.antiSharpe) < 1e-6 && Math.abs(out.controls.random.meanSharpe) < 0.2;
    return out;
}
