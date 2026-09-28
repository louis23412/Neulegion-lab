// E5 - placebo / oracle controls. The credibility guard for every negative result.
//
// A measurement pipeline that reports "no edge" is only believable if it reports a
// HUGE Sharpe on a signal that has one by construction. These controls are:
//
//   oracle      pos_t = sign(r_{t+1})   -> must be enormous (it sees the future)
//   anti-oracle pos_t = -sign(r_{t+1})  -> must be enormously negative
//   random      pos_t = seeded +/-1     -> must be ~0, and is the null calibration
//   always-long pos_t = 1               -> must equal the data's own drift Sharpe
//
// These are CONTROLS, not strategies: the oracle is deliberately non-causal and is
// never a candidate. If the oracle is not enormous, the harness is broken and no
// negative result in the lab can be trusted.

import { buildPanel, score, netSeries, panelReadout, stats, SYMBOLS } from '../lib/lab.js';

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export async function run({ tf = '1h', seed = 12345 } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const n = panel[0].n;
    const rnd = mulberry32(seed);
    const randomPos = new Array(n).fill(0);
    for (let i = 0; i < n; i++) randomPos[i] = rnd() < 0.5 ? -1 : 1;

    const arms = {
        oracle: panel.map((s) => s.returns.map((r, t) => (t + 1 < s.returns.length ? Math.sign(s.returns[t + 1]) : 0))),
        antiOracle: panel.map((s) => s.returns.map((r, t) => (t + 1 < s.returns.length ? -Math.sign(s.returns[t + 1]) : 0))),
        random: panel.map(() => randomPos.slice()),
        alwaysLong: panel.map((s) => s.returns.map(() => 1)),
        alwaysShort: panel.map((s) => s.returns.map(() => -1)),
    };

    const out = { config: { tf, bars: n, streams: panel.length, seed }, arms: {} };
    for (const [name, sig] of Object.entries(arms)) {
        const per = panel.map((s, i) => score(s.returns, sig[i], { costBps: 0 }));
        const net = panel.map((s, i) => netSeries(s.returns, sig[i], 0));
        out.arms[name] = {
            meanSharpe: stats(per.map((p) => p.netSharpe)),
            meanBreakEvenCostBps: stats(per.map((p) => p.breakEvenCostBps)).mean,
            pooled: panelReadout(net, { label: name }).pooled,
        };
    }
    // The harness is sound iff the oracle is enormous and the anti-oracle mirrors it.
    const o = out.arms.oracle.meanSharpe.mean;
    const a = out.arms.antiOracle.meanSharpe.mean;
    out.verdict = { oracleSharpe: o, antiOracleSharpe: a, randomNearZero: Math.abs(out.arms.random.meanSharpe.mean) < 0.2, pass: Math.abs(o) > 10 && Math.abs(o + a) < 1e-6 };
    return out;
}
