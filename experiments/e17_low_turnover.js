// E17 - low-turnover dispersion: can the rank signal be harvested cheaply? L16, CYCLE-009.
//
// F-23 (e16) killed the cross-sectional dispersion book AS TRADED: the daily rank reshuffle turns over
// 803x gross notional/yr and breaks even at 1.87 bps. But the SIGNAL is slow (funding ranks persist);
// it is the IMPLEMENTATION that is fast, because recomputing exact ranks (and renormalising sum|w|=1)
// every 8h turns tiny rank swaps into real trades. This experiment asks whether a cheaper cadence keeps
// the edge:
//
//   daily        recompute the target every period (the e16 baseline)
//   holdN(N)     recompute the target every N periods, hold it in between
//   ewma(l)      held_t = (1-l)*held_{t-1} + l*target_t   (rebalance slowly toward the daily target)
//   deadband(e)  trade symbol j only if |target_j - held_j| > e, else keep held_j
//   tail(m)      rank weights but only on the m highest and m lowest funding symbols (0 in the middle)
//
// Every variant is scored by the SAME audit as e16 (`audit`), so gross Sharpe, turnover/yr, break-even
// bps and the net-of-fee ladder are directly comparable to F-23's table.
//
// Causality: the target at book-period k is built from funding at f_{t-1} (the row indexed k-1 in the
// full leg arrays), and the held weight at k earns period k's P&L. No period-k funding is used to trade
// period k. A reproducibility check asserts that `daily` on rank weights reproduces e12's xsRank book
// to the last digit; if that fails, this file is measuring a different book and nothing else counts.

import { SYMBOLS, pearsonCorrelation } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { audit, turnoverSeries } from './e16_cost_capacity.js';
import { windowStats, REGIMES } from './e13_carry_robustness.js';

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };

// ---- weighting schemes (replicating e12#buildXsSeries exactly) ----
export function rankWeights(fPrev) {
    const order = fPrev.map((v, j) => [v, j]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const rw = new Array(fPrev.length).fill(0);
    order.forEach((j, rank) => { rw[j] = rank - (fPrev.length - 1) / 2; });
    const rn = rw.reduce((a, b) => a + Math.abs(b), 0) || 1;
    return rw.map((v) => v / rn);
}
export function levelWeights(fPrev) {
    const m = fPrev.reduce((a, b) => a + b, 0) / fPrev.length;
    const sd = Math.sqrt(fPrev.reduce((a, b) => a + (b - m) ** 2, 0) / fPrev.length) || 1;
    const z = fPrev.map((v) => (v - m) / sd);
    const norm = z.reduce((a, b) => a + Math.abs(b), 0) || 1;
    return z.map((v) => v / norm);
}
function tailWeights(target, m) {
    const idx = target.map((v, j) => [v, j]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const keep = new Set([...idx.slice(0, m), ...idx.slice(idx.length - m)]);
    const w = target.map((v, j) => (keep.has(j) ? v : 0));
    const n = w.reduce((a, b) => a + Math.abs(b), 0) || 1;
    return w.map((v) => v / n);
}

// ---- a weight policy applied causally over the aligned legs ----
// legs: {basisPnl, fRate, times} at full length; book periods are i = 1 .. n-1.
export function buildBook(legs, k, { targetFn, policy }) {
    const n = legs.times.length;
    const rets = [];
    const weightRows = [];
    let held = new Array(k).fill(0);
    let counter = 0;
    const grossExposure = [];
    const netExposure = [];
    for (let i = 1; i < n; i++) {
        const target = targetFn(legs.fRate[i - 1]);
        const kind = policy.kind;
        if (kind === 'daily') {
            held = target;
        } else if (kind === 'hold') {
            if (counter % policy.N === 0) held = target;
        } else if (kind === 'ewma') {
            const l = policy.lambda;
            held = held.map((h, j) => (1 - l) * h + l * target[j]);
        } else if (kind === 'deadband') {
            held = held.map((h, j) => (Math.abs(target[j] - h) > policy.eps ? target[j] : h));
        } else if (kind === 'tail') {
            held = tailWeights(target, policy.m);
        } else {
            throw new Error(`unknown policy ${kind}`);
        }
        // Optional renormalisation to a fully-invested book (sum|w| = 1). Without it a smoothing
        // filter under-invests; the break-even is scale-free either way, but the exposure is reported.
        if (policy.normalize) {
            const g = held.reduce((a, w) => a + Math.abs(w), 0) || 1;
            held = held.map((w) => w / g);
        }
        counter += 1;
        weightRows.push(held.slice());
        const b = legs.basisPnl[i];
        const f = legs.fRate[i];
        rets.push(held.reduce((a, w, j) => a + w * (fin(b[j]) + fin(f[j])), 0));
        grossExposure.push(held.reduce((a, w) => a + Math.abs(w), 0));
        netExposure.push(held.reduce((a, w) => a + w, 0));
    }
    return { rets, weightRows, meanGrossExposure: mean(grossExposure), meanNetExposure: mean(netExposure), lastGrossExposure: grossExposure[grossExposure.length - 1] };
}

const VARIANTS = [
    { name: 'rank_daily', target: 'rank', policy: { kind: 'daily' } },
    { name: 'rank_hold3', target: 'rank', policy: { kind: 'hold', N: 3 } },
    { name: 'rank_hold9', target: 'rank', policy: { kind: 'hold', N: 9 } },
    { name: 'rank_hold27', target: 'rank', policy: { kind: 'hold', N: 27 } },
    { name: 'rank_ewma_0.5', target: 'rank', policy: { kind: 'ewma', lambda: 0.5 } },
    { name: 'rank_ewma_0.25', target: 'rank', policy: { kind: 'ewma', lambda: 0.25 } },
    { name: 'rank_ewma_0.1', target: 'rank', policy: { kind: 'ewma', lambda: 0.1 } },
    { name: 'rank_deadband_0.05', target: 'rank', policy: { kind: 'deadband', eps: 0.05 } },
    { name: 'rank_deadband_0.10', target: 'rank', policy: { kind: 'deadband', eps: 0.10 } },
    { name: 'rank_tail2', target: 'rank', policy: { kind: 'tail', m: 2 } },
    { name: 'rank_tail3', target: 'rank', policy: { kind: 'tail', m: 3 } },
    { name: 'level_daily', target: 'level', policy: { kind: 'daily' } },
    { name: 'level_hold9', target: 'level', policy: { kind: 'hold', N: 9 } },
    { name: 'level_ewma_0.1', target: 'level', policy: { kind: 'ewma', lambda: 0.1 } },
    { name: 'rank_ewma_0.1_norm', target: 'rank', policy: { kind: 'ewma', lambda: 0.1, normalize: true } },
    { name: 'rank_hold9_norm', target: 'rank', policy: { kind: 'hold', N: 9, normalize: true } },
];

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const legs = s.legs;
    const targetFns = { rank: rankWeights, level: levelWeights };

    const books = {};
    const raw = {};
    for (const v of VARIANTS) {
        const built = buildBook(legs, k, { targetFn: targetFns[v.target], policy: v.policy });
        const a = audit(v.name, built.rets, built.weightRows);
        raw[v.name] = { rets: built.rets, T: turnoverSeries(built.weightRows) };
        books[v.name] = {
            target: v.target,
            policy: v.policy,
            gross: { sharpe: a.gross.sharpe, annualized: a.gross.annualized, maxDrawdown: a.gross.maxDrawdown },
            turnover: { meanPerPeriod: a.turnover.meanPerPeriod, annualized: a.turnover.annualized },
            breakEvenBps: a.breakEvenBps,
            meanGrossExposure: built.meanGrossExposure,
            meanNetExposure: built.meanNetExposure,
            marketCorr: pearsonCorrelation(built.rets, s.books.market),
            net: Object.fromEntries(Object.entries(a.net).map(([c, x]) => [c, { sharpe: x.sharpe, annualized: x.annualized }])),
        };
    }

    // Reproducibility check: rank_daily must equal e12's xsRank book exactly.
    const base = books.rank_daily;
    let maxAbsDiff = 0;
    {
        const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'daily' } });
        for (let t = 0; t < s.books.xsRank.length; t++) maxAbsDiff = Math.max(maxAbsDiff, Math.abs(built.rets[t] - s.books.xsRank[t]));
    }

    // Frontier summary: which variants clear a realistic fee, ordered by net Sharpe at 4 bps.
    const frontier = Object.entries(books)
        .map(([name, b]) => ({ name, grossSharpe: b.gross.sharpe, turnoverAnnual: b.turnover.annualized, breakEvenBps: b.breakEvenBps, marketCorr: b.marketCorr, netExposure: b.meanNetExposure, net4: b.net['4'] && b.net['4'].sharpe, net5: b.net['5'] && b.net['5'].sharpe, net10: b.net['10'] && b.net['10'].sharpe }))
        .sort((a, b) => (b.net4 || -1e9) - (a.net4 || -1e9));

    // Regime survival of the leading low-turnover candidates (gross AND net at 4 bps), on E13's exact
    // windows. This is the check that the smoothed book is still the crash-surviving dispersion book,
    // not a different (directional) animal.
    const bookTimes = legs.times.slice(1);
    const REGIME_SUBSET = ['rank_daily', 'rank_ewma_0.1_norm', 'rank_ewma_0.1', 'level_ewma_0.1'];
    const regimes = {};
    const flatNet = s.books.flat; // flat turnover ~0, so net ≈ gross
    regimes.flat = {};
    for (const rg of REGIMES) regimes.flat[rg.name] = { grossSharpe: windowStats(flatNet, bookTimes, rg.from, rg.to).sharpe, net4Sharpe: windowStats(flatNet, bookTimes, rg.from, rg.to).sharpe };
    for (const name of REGIME_SUBSET) {
        const { rets, T } = raw[name];
        const net4 = rets.map((r, i) => r - 4e-4 * T[i]);
        regimes[name] = {};
        for (const rg of REGIMES) {
            const g = windowStats(rets, bookTimes, rg.from, rg.to);
            const n = windowStats(net4, bookTimes, rg.from, rg.to);
            regimes[name][rg.name] = { grossSharpe: g.sharpe, net4Sharpe: n.sharpe };
        }
    }
    const regimeScore = {};
    for (const name of Object.keys(regimes)) {
        const vals = REGIMES.map((r) => regimes[name][r.name].net4Sharpe).filter(Number.isFinite);
        regimeScore[name] = { positiveRegimesNet4: vals.filter((v) => v > 0).length, of: vals.length };
    }

    return {
        config: { symbols: k, perp, periods: s.config.periods, years: s.config.years },
        check: { rankDailyMatchesE12XsRank: maxAbsDiff < 1e-12, maxAbsDiff },
        books,
        frontier,
        regimes,
        regimeScore,
    };
}
