// E12 - cross-sectional carry dispersion. L12.
//
// F-04 (E3) trades carry per asset: every symbol is long its own funding. But funding
// is also a positioning/crowding variable, and the informative part of a crowded
// book is usually the RELATIVE crowding. This experiment demeans the funding rate
// across the basket and trades the dispersion: long the carry book on the
// highest-funding symbols, short it on the lowest, dollar-neutral.
//
// The carry book's per-period P&L on symbol i is  basisPnl_i + fundingRate_i
//   basisPnl_i = spotRet_i - perpRet_i   (the delta-neutral basis leg, from markup).
// A cross-sectional book with weights w_i (sum 0) earns  sum_i w_i (basisPnl_i + f_i).
// Weights use f_{t-1} (causal): today's funding is not known when the position is set.
//
// The per-symbol legs come from `e3_carry.js#loadCarryBook`, i.e. the SAME sleeve
// definition as F-04/F-16 - including the extended mark history (`data/mark_8h.json`)
// that lifts the whole basis-marked complex out of the ~2.9-year post-2023-10 window
// (CYCLE-005/006). There is deliberately only one carry book in the lab.
//
// Controls: the flat equal-weight carry book (the E3 baseline), a SHUFFLED-weight
// placebo (same weight distribution, no information) reported as a DISTRIBUTION over
// many permutation seeds - a single placebo draw is worthless evidence, and its
// realised Sharpe can be arbitrarily far from its zero mean - and the price-basket
// correlation of each book (a dispersion book is only useful if it is independent).

import { SYMBOLS, serialDesignEffect, pearsonCorrelation } from '../lib/lab.js';
import { loadCarryBook } from './e3_carry.js';

const PERIODS_PER_YEAR = 365 * 3;
const PLACEBO_SEEDS = 40;

const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

const sharpe8h = (r) => { const n = r.length; const m = r.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd > 0 ? (m / sd) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };

// P&L of a dollar-neutral weight vector on one period: sum_i w_i (basisPnl_i + f_i).
const pnl0 = (basisRow, fRow, w) => w.reduce((a, x, j) => a + x * (basisRow[j] + fRow[j]), 0);

// `periodsPerYear` is an ANNUALISATION BASIS, not a data property: the lab's ledger
// convention is 252 (what the repo's A/B uses, `lib/lab.js`), and `e12` ignores it for
// the carry book because `PPY = 365*3` is the true count of 8h periods. Experiments on
// a different calendar grid (e24: 1h/15m bars) pass their own basis so their Sharpes are
// on the SAME scale as the rest of the ledger. Default is unchanged, so every existing
// caller is byte-identical.
export function statsOf(rets, periodsPerYear = PERIODS_PER_YEAR) {
    const v = rets.filter(Number.isFinite);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const std = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
    const eq = [1];
    for (const r of v) eq.push(eq[eq.length - 1] * (1 + r));
    let peak = eq[0];
    let mdd = 0;
    for (const x of eq) { if (x > peak) peak = x; if (peak > 0) mdd = Math.max(mdd, (peak - x) / peak); }
    return { n: v.length, annualized: mean * periodsPerYear, sharpe: std > 0 ? (mean / std) * Math.sqrt(periodsPerYear) : NaN, maxDrawdown: mdd, totalReturn: eq[eq.length - 1] - 1, negativeFraction: v.filter((x) => x < 0).length / v.length };
}

// Build the aligned per-period legs for the cross-sectional experiment from the single
// carry book (E3). End-aligned to the common window. Exported so E13's regime
// breakdown reads the SAME books rather than re-deriving them.
export async function buildXsSeries(symbols, { perp = 'mark' } = {}) {
    const { perSym } = await loadCarryBook(symbols, { perp });
    if (!perSym.length) return { available: false };
    const n = Math.min(...perSym.map((p) => p.rets.length));
    const off = perSym.map((p) => p.rets.length - n);
    const spotRet = [];
    const basisPnl = [];
    const fRate = [];
    const times = [];
    for (let i = 0; i < n; i++) {
        const sr = []; const bp = []; const fr = [];
        for (let k = 0; k < perSym.length; k++) {
            sr.push(perSym[k].spot[off[k] + i]);
            bp.push(perSym[k].basis[off[k] + i]);
            fr.push(perSym[k].f[off[k] + i]);
        }
        spotRet.push(sr); basisPnl.push(bp); fRate.push(fr);
        times.push(perSym[0].times[off[0] + i]);
    }

    // price basket return (equal-weight spot) over the same grid, aligned to the book
    // periods (the books start at index 1, so the market series is sliced to match).
    const market = spotRet.map((sr) => sr.reduce((a, b) => a + b, 0) / sr.length).slice(1);

    const flat = [];
    const xsLevel = [];
    const xsRank = [];
    const xsFundingOnly = [];
    const bookTimes = [];
    const weights = [];
    const rankWeights = [];
    let shuffled = null;
    for (let i = 1; i < n; i++) {
        const fPrev = fRate[i - 1];
        const m = fPrev.reduce((a, b) => a + b, 0) / fPrev.length;
        const sd = Math.sqrt(fPrev.reduce((a, b) => a + (b - m) ** 2, 0) / fPrev.length) || 1;
        const z = fPrev.map((v) => (v - m) / sd);
        const norm = z.reduce((a, b) => a + Math.abs(b), 0) || 1;
        const w = z.map((v) => v / norm);
        // rank weights, demeaned
        const order = fPrev.map((v, j) => [v, j]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
        const rw = new Array(fPrev.length).fill(0);
        order.forEach((j, rank) => { rw[j] = rank - (fPrev.length - 1) / 2; });
        const rn = rw.reduce((a, b) => a + Math.abs(b), 0) || 1;
        const wRank = rw.map((v) => v / rn);
        const pnl = (ww, includeFunding) => ww.reduce((a, x, j) => a + x * (basisPnl[i][j] + (includeFunding ? fRate[i][j] : 0)), 0);
        flat.push(basisPnl[i].reduce((a, v, j) => a + (v + fRate[i][j]), 0) / fRate[i].length);
        xsLevel.push(pnl(w, true));
        xsRank.push(pnl(wRank, true));
        xsFundingOnly.push(w.reduce((a, x, j) => a + x * fRate[i][j], 0));
        bookTimes.push(times[i]);
        weights.push(w);
        rankWeights.push(wRank);
    }

    // Placebo distribution: permute the level weights across symbols, keeping the exact
    // weight multiset, so every permutation is a valid dollar-neutral book with ZERO
    // information. Report the whole distribution of seed Sharpes, not one draw.
    const placeboSharpes = [];
    for (let seed = 1; seed <= PLACEBO_SEEDS; seed++) {
        const rnd = mulberry32(seed * 7919);
        const pnl = [];
        for (let i = 1; i < n; i++) {
            const w = weights[i - 1].slice();
            for (let k = w.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [w[k], w[j]] = [w[j], w[k]]; }
            pnl.push(pnl0(basisPnl[i], fRate[i], w));
        }
        placeboSharpes.push(sharpe8h(pnl));
        if (seed === 1) shuffled = pnl;
    }
    return { available: true, config: { symbols: perSym.length, symbolList: perSym.map((p) => p.symbol), periods: n, years: (n / PERIODS_PER_YEAR).toFixed(2) }, books: { flat, xsLevel, xsRank, xsFundingOnly, shuffled, market }, weightSeries: { xsLevel: weights, xsRank: rankWeights }, placeboSharpes, times: bookTimes, legs: { basisPnl, fRate, spotRet, times } };
}

// Summarise the permutation-placebo distribution and where the real books sit in it.
export function placeboSummary(sharpes, xsLevelSharpe, xsRankSharpe) {
    const v = sharpes.filter(Number.isFinite);
    if (!v.length) return { available: false };
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, v.length - 1));
    const sorted = v.slice().sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
    return {
        seeds: v.length,
        mean: mean,
        sd: sd,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        q025: q(0.025),
        q975: q(0.975),
        xsLevelSharpe,
        xsRankSharpe,
        xsLevelZ: sd > 0 ? (xsLevelSharpe - mean) / sd : NaN,
        xsRankZ: sd > 0 ? (xsRankSharpe - mean) / sd : NaN,
    };
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const { flat, xsLevel, xsRank, xsFundingOnly, shuffled, market } = s.books;
    return {
        config: s.config,
        books: {
            flatEqualWeight: { ...statsOf(flat), designEffect: serialDesignEffect(flat, 90).designEffect, marketCorr: pearsonCorrelation(flat, market) },
            xsFundingLevel: { ...statsOf(xsLevel), designEffect: serialDesignEffect(xsLevel, 90).designEffect, marketCorr: pearsonCorrelation(xsLevel, market) },
            xsFundingRank: { ...statsOf(xsRank), designEffect: serialDesignEffect(xsRank, 90).designEffect, marketCorr: pearsonCorrelation(xsRank, market) },
            xsFundingOnlyNoBasis: { ...statsOf(xsFundingOnly), designEffect: serialDesignEffect(xsFundingOnly, 90).designEffect, marketCorr: pearsonCorrelation(xsFundingOnly, market) },
            shuffledPlacebo: { ...statsOf(shuffled), designEffect: serialDesignEffect(shuffled, 90).designEffect, marketCorr: pearsonCorrelation(shuffled, market) },
        },
        crossCorr: { xsLevel_vs_flat: pearsonCorrelation(xsLevel, flat), xsRank_vs_flat: pearsonCorrelation(xsRank, flat) },
        placeboDistribution: placeboSummary(s.placeboSharpes, statsOf(xsLevel).sharpe, statsOf(xsRank).sharpe),
    };
}
