// E28 - RE-TUNING THE DISPERSION BOOK FOR THE DECAYED REGIME. CYCLE-020.
//
// F-36 (CYCLE-019) showed the EWMA(0.1) dispersion book's *recent* break-even fell to 2.9–3.4 bps (below a
// 4 bps fee) while its gross Sharpe trend stayed flat, because the per-period gross edge shrank and
// turnover rose 75 → 98×/yr. F-24 chose the weight policy by *full-sample* net@4; that objective is now
// stale. This experiment asks the regime-conditional question the earlier cycles did not:
//
//     is there a weight policy whose break-even clears a realistic fee ON THE RECENT WINDOW
//     (and keeps a positive recent net Sharpe)?
//
// It reuses `e17#buildBook` (the single implementation of every policy) and audits each book on three
// windows — full, last 24 months, last 12 months — reporting gross Sharpe, turnover, the break-even and
// net@4. It adds TWO levers F-24 did not sweep: much slower smoothing (`ewma 0.05 / 0.02`), longer holds
// (`hold 27/54/108`), and a **strict per-symbol cap** (F-27's construction) applied to the held weights.
//
// FALSIFIER (pre-registered). If NO policy has (recent-24m break-even ≥ 4 bps AND recent-24m net@4 > 0),
// then the dispersion family is conclusively dead as a tradable object in the current regime — stronger
// than F-36's "the F-24 spec decayed", because it rules out the *policy* as the cause.
//
// Validation (e25/e27 style): `rank_ewma_0.1_norm` here must reproduce F-36/e27's recent break-even
// (2.9–3.4 bps) and its full-sample gross Sharpe (~4.4 on the 2021-12+ aligned grid; ~5.18 on the full
// 6-year grid). If it does not, the builders have diverged.

import { SYMBOLS, pearsonCorrelation } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights, levelWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';
import { windowStats, REGIMES } from './e13_carry_robustness.js';

const PERIODS_PER_YEAR = 365 * 3;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const fin = (x) => (Number.isFinite(x) ? x : 0);

// Strict per-symbol cap (F-27): clip |w_j| to `cap` and HOLD it — no renormalisation (renormalising
// re-inflates the clipped position and buys nothing, per F-27).
function applyCap(weightRows, cap) {
    return weightRows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x)));
}

// Recompute the book return + turnover from held weight rows and the legs.
function retsFromWeights(weightRows, legs, startIdx) {
    const rets = [];
    for (let q = 0; q < weightRows.length; q++) {
        const i = startIdx + q;
        const w = weightRows[q];
        const b = legs.basisPnl[i];
        const f = legs.fRate[i];
        rets.push(w.reduce((a, x, j) => a + x * (fin(b[j]) + fin(f[j])), 0));
    }
    return { rets, T: turnoverSeries(weightRows) };
}

// Window metrics for one book.
function winMetrics(rets, T, from, to, label) {
    const r = rets.slice(from, to);
    const t = T.slice(from, to);
    const net4 = r.map((x, i) => x - 4e-4 * t[i]);
    return {
        label,
        periods: r.length,
        grossSharpe: +statsSh(r).toFixed(2),
        net4Sharpe: +statsSh(net4).toFixed(2),
        meanGrossBps: +(mean(r) * 1e4).toFixed(3),
        turnoverAnnual: +(mean(t) * PERIODS_PER_YEAR).toFixed(0),
        breakEvenBps: mean(t) > 0 ? +(mean(r) * 1e4 / mean(t)).toFixed(2) : null,
    };
}
const statsSh = (a) => {
    const v = a.filter(Number.isFinite);
    if (v.length < 3) return NaN;
    const m = mean(v);
    const sd = Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1));
    return sd > 0 ? (m / sd) * Math.sqrt(PERIODS_PER_YEAR) : NaN;
};

const POLICIES = [
    { name: 'rank_daily', target: 'rank', policy: { kind: 'daily' } },
    { name: 'ewma_0.1_norm (F-24 spec)', target: 'rank', policy: { kind: 'ewma', lambda: 0.1, normalize: true } },
    { name: 'ewma_0.05_norm', target: 'rank', policy: { kind: 'ewma', lambda: 0.05, normalize: true } },
    { name: 'ewma_0.02_norm', target: 'rank', policy: { kind: 'ewma', lambda: 0.02, normalize: true } },
    { name: 'ewma_0.01_norm', target: 'rank', policy: { kind: 'ewma', lambda: 0.01, normalize: true } },
    { name: 'hold9_norm', target: 'rank', policy: { kind: 'hold', N: 9, normalize: true } },
    { name: 'hold27_norm', target: 'rank', policy: { kind: 'hold', N: 27, normalize: true } },
    { name: 'hold54_norm', target: 'rank', policy: { kind: 'hold', N: 54, normalize: true } },
    { name: 'hold108_norm', target: 'rank', policy: { kind: 'hold', N: 108, normalize: true } },
    { name: 'tail2', target: 'rank', policy: { kind: 'tail', m: 2 } },
    { name: 'tail3', target: 'rank', policy: { kind: 'tail', m: 3 } },
    { name: 'level_ewma_0.1_norm', target: 'level', policy: { kind: 'ewma', lambda: 0.1, normalize: true } },
    { name: 'ewma_0.1_norm + cap12.5%', target: 'rank', policy: { kind: 'ewma', lambda: 0.1, normalize: true }, cap: 0.125 },
    { name: 'ewma_0.05_norm + cap12.5%', target: 'rank', policy: { kind: 'ewma', lambda: 0.05, normalize: true }, cap: 0.125 },
    { name: 'hold27_norm + cap12.5%', target: 'rank', policy: { kind: 'hold', N: 27, normalize: true }, cap: 0.125 },
    { name: 'tail2 + cap12.5%', target: 'rank', policy: { kind: 'tail', m: 2 }, cap: 0.125 },
];

export async function run({ symbols = SYMBOLS, perp = 'mark', barPerYear = PERIODS_PER_YEAR } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const legs = s.legs;
    const targetFns = { rank: rankWeights, level: levelWeights };

    const books = {};
    for (const v of POLICIES) {
        const built = buildBook(legs, k, { targetFn: targetFns[v.target], policy: v.policy });
        let weightRows = built.weightRows;
        let rets = built.rets;
        if (v.cap) {
            weightRows = applyCap(weightRows, v.cap);
            const rr = retsFromWeights(weightRows, legs, 1);
            rets = rr.rets;
        }
        const T = turnoverSeries(weightRows);
        const n = rets.length;
        const w24 = Math.min(n, Math.round(2 * barPerYear));
        const w12 = Math.min(n, Math.round(barPerYear));
        books[v.name] = {
            target: v.target,
            policy: v.policy,
            cap: v.cap || null,
            marketCorr: pearsonCorrelation(rets, s.books.market),
            windows: {
                full: winMetrics(rets, T, 0, n, 'full'),
                last24m: winMetrics(rets, T, n - w24, n, 'last24m'),
                last12m: winMetrics(rets, T, n - w12, n, 'last12m'),
            },
        };
    }

    // Validation: the F-24 spec must reproduce e27's recent break-even (2.9–3.4 bps) structure.
    const spec = books['ewma_0.1_norm (F-24 spec)'];
    const validation = {
        specFullGrossSharpe: spec.windows.full.grossSharpe,
        specLast24BreakEvenBps: spec.windows.last24m.breakEvenBps,
        specLast24Net4: spec.windows.last24m.net4Sharpe,
        note: 'must match e27/F-36: recent break-even ~2.9–3.4 bps, recent net@4 negative.',
        matchesF36: spec.windows.last24m.breakEvenBps != null && spec.windows.last24m.breakEvenBps < 4.5 && spec.windows.last24m.net4Sharpe < 0,
    };

    // The decisive table: recent-window tradability, sorted by recent break-even.
    const recentTable = Object.entries(books)
        .map(([name, b]) => ({ name, ...b.windows.last24m, fullGross: b.windows.full.grossSharpe, mktCorr: +b.marketCorr.toFixed(3) }))
        .sort((a, b) => (b.breakEvenBps || -1e9) - (a.breakEvenBps || -1e9));

    const clearsFee = recentTable.filter((r) => r.breakEvenBps >= 4 && r.net4Sharpe > 0);
    const clearsSafety = recentTable.filter((r) => r.breakEvenBps >= 6 && r.net4Sharpe > 0);
    const verdict = {
        note: 'Falsifier: if no policy has (recent-24m break-even >= 4 bps AND recent-24m net@4 > 0), the dispersion family is dead as a tradable object in the current regime and the policy is not the cause.',
        policiesClearingFeeRecent: clearsFee.map((r) => r.name),
        policiesClearing6bpsRecent: clearsSafety.map((r) => r.name),
        bestRecentBreakEven: recentTable[0] ? { name: recentTable[0].name, breakEvenBps: recentTable[0].breakEvenBps, net4: recentTable[0].net4Sharpe } : null,
        anyClearsFee: clearsFee.length > 0,
        validationPass: validation.matchesF36,
    };

    // Regime table for the leading low-turnover candidates (gross + net4), on E13's exact windows — this
    // is the check that a re-tuned policy is still the crash-surviving dispersion book.
    const bookTimes = legs.times.slice(1);
    const candidates = recentTable.slice(0, 4).map((r) => r.name);
    const regimes = {};
    for (const name of candidates) {
        const b = books[name];
        const built = buildBook(legs, k, { targetFn: targetFns[b.target], policy: b.policy });
        let weightRows = built.weightRows;
        if (b.cap) weightRows = applyCap(weightRows, b.cap);
        const { rets, T } = retsFromWeights(weightRows, legs, 1);
        const net4 = rets.map((x, i) => x - 4e-4 * T[i]);
        regimes[name] = {};
        for (const rg of REGIMES) {
            regimes[name][rg.name] = {
                grossSharpe: windowStats(rets, bookTimes, rg.from, rg.to).sharpe,
                net4Sharpe: windowStats(net4, bookTimes, rg.from, rg.to).sharpe,
            };
        }
    }

    return {
        config: { symbols: k, perp, periods: legs.times.length - 1, windows: { full: 'all', last24m: Math.round(2 * barPerYear) + ' periods', last12m: Math.round(barPerYear) + ' periods' }, feeBps: 4 },
        validation,
        books,
        recentTable,
        verdict,
        regimes,
    };
}
