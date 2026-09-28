// E4 - edge hunt: long-horizon trend, funding-as-a-price-signal, and a combined book.
//
// E2 said the short-horizon arms have no full-sample edge and that the verdict
// window is a regime artefact. This experiment asks three questions the shipped
// roster does not ask:
//
//   1. TREND AT THE PUBLISHED HORIZON. The momentum literature's robust effect is
//      at 1-12 MONTH horizons (`1404.3274`, `2009.12155`); the shipped `sig-momentum`
//      is a 16-bar (16h) arm. Does a slower arm carry a stable full-sample edge?
//   2. FUNDING AS A PRICE PREDICTOR. Funding is a crowding gauge. If extreme funding
//      marks crowded positioning, the *contrarian* price bet on funding should have
//      an edge - and it is a different state variable from price (E3's corr 0.08).
//      This is a hypothesis the repo has never tested (P4 uses carry as a RETURN
//      stream, not as a signal).
//   3. A COMBINED BOOK. Equal-risk combination of the most stable arms; does the
//      combination beat the best single arm on full-sample Sharpe AND stability?
//
// Everything is point-in-time: the funding position at bar t uses only funding
// observations with timestamp <= t.

import { buildPanel, loadSeries, positionsOfFast, score, netSeries, panelReadout, serialDesignEffect, stats, SYMBOLS, REPO, PERIODS_PER_YEAR } from '../lib/lab.js';
import { momentum, acceleration } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { xsMomentum } from '../prototypes/signals.js';
import { parseFundingJsonl } from '../../NeuLegion-master/NeuLegion-master/src/analysis/carry.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';
import { blockStability } from './e2_arm_sweep.js';

const clamp = (x) => (x < -1 ? -1 : x > 1 ? 1 : x);

// Causal z-score of each funding observation, forward-filled onto the bar grid.
// `mode: 'contrarian'` -> position = -z/sat (fade crowded funding);
// `mode: 'momentum'`   -> position = +z/sat (follow it).
export function fundingPositions(fundingRows, barT, { zWindow = 90, sat = 2, mode = 'contrarian' } = {}) {
    const obs = fundingRows.map((r) => ({ t: typeof r.timestamp === 'number' ? r.timestamp : Date.parse(r.timestamp), v: r.fundingRate }));
    const zed = new Array(obs.length).fill(0);
    for (let i = 0; i < obs.length; i++) {
        const from = Math.max(0, i - zWindow + 1);
        const vals = [];
        for (let j = from; j <= i; j++) if (Number.isFinite(obs[j].v)) vals.push(obs[j].v);
        if (vals.length < 8) continue;
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1));
        if (!(sd > 0)) continue;
        const z = (obs[i].v - m) / sd;
        zed[i] = clamp((mode === 'contrarian' ? -z : z) / sat);
    }
    const out = new Array(barT.length).fill(0);
    let oi = -1;
    for (let t = 0; t < barT.length; t++) {
        while (oi + 1 < obs.length && obs[oi + 1].t <= barT[t]) oi += 1;
        out[t] = oi >= 0 ? zed[oi] : 0;
    }
    return out;
}

export async function run({ tf = '1h', blocks = 6, costBps = 0 } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const barT = panel[0].t;
    const out = { config: { tf, bars: panel[0].n, streams: panel.length, costBps, blocks }, arms: {} };

    const armDefs = [
        { name: 'mom-168', fn: momentum, window: 168 },
        { name: 'mom-336', fn: momentum, window: 336 },
        { name: 'accel-336', fn: acceleration, window: 336 },
        { name: 'xs-mom-336', fn: xsMomentum, window: 336 },
        { name: 'xs-mom-720', fn: xsMomentum, window: 720 },
    ];

    const signalBook = {};
    for (const arm of armDefs) {
        const sig = panel.map((s) => positionsOfFast(arm.fn, s, { window: arm.window }));
        signalBook[arm.name] = sig;
        const per = panel.map((s, i) => score(s.returns, sig[i], { costBps }));
        const netByStream = panel.map((s, i) => netSeries(s.returns, sig[i], costBps));
        out.arms[arm.name] = {
            meanSharpe: stats(per.map((p) => p.netSharpe)),
            meanBreakEvenCostBps: stats(per.map((p) => p.breakEvenCostBps)).mean,
            positiveStreams: per.filter((p) => p.netSharpe > 0).length,
            stability: blockStability(netByStream, blocks),
            pooled: panelReadout(netByStream, { label: arm.name }).pooled,
        };
    }

    // ---- funding as a price signal ----
    for (const mode of ['contrarian', 'momentum']) {
        const sig = [];
        const ok = [];
        for (let i = 0; i < panel.length; i++) {
            const text = await globalThis.__fs.readTextFile(`${REPO}/src/data/funding_${SYMBOLS[i]}_8h.jsonl`);
            const { rows } = parseFundingJsonl(text);
            sig.push(fundingPositions(rows, barT, { mode }));
            ok.push(true);
        }
        const per = panel.map((s, i) => score(s.returns, sig[i], { costBps }));
        const netByStream = panel.map((s, i) => netSeries(s.returns, sig[i], costBps));
        const name = mode === 'contrarian' ? 'fund-contra' : 'fund-follow';
        signalBook[name] = sig;
        out.arms[name] = {
            meanSharpe: stats(per.map((p) => p.netSharpe)),
            meanBreakEvenCostBps: stats(per.map((p) => p.breakEvenCostBps)).mean,
            positiveStreams: per.filter((p) => p.netSharpe > 0).length,
            turnoverPerBar: stats(per.map((p) => p.turnover / p.bars)).mean,
            stability: blockStability(netByStream, blocks),
            pooled: panelReadout(netByStream, { label: name }).pooled,
        };
    }

    // ---- combined book: equal weight of the three most stable/most orthogonal arms ----
    const combine = ['accel-336', 'xs-mom-336', 'fund-contra'];
    const combo = panel.map((s, i) => combine.map((n) => signalBook[n][i]));
    const comboPos = combo.map((set) => {
        const n = set[0].length;
        const o = new Array(n).fill(0);
        for (let t = 0; t < n; t++) {
            let a = 0;
            for (const v of set) a += v[t];
            o[t] = a / set.length;
        }
        return o;
    });
    const cper = panel.map((s, i) => score(s.returns, comboPos[i], { costBps }));
    const cnet = panel.map((s, i) => netSeries(s.returns, comboPos[i], costBps));
    out.arms['combo-3'] = {
        members: combine,
        meanSharpe: stats(cper.map((p) => p.netSharpe)),
        meanBreakEvenCostBps: stats(cper.map((p) => p.breakEvenCostBps)).mean,
        turnoverPerBar: stats(cper.map((p) => p.turnover / p.bars)).mean,
        positiveStreams: cper.filter((p) => p.netSharpe > 0).length,
        stability: blockStability(cnet, blocks),
        pooled: panelReadout(cnet, { label: 'combo-3' }).pooled,
    };

    return out;
}
