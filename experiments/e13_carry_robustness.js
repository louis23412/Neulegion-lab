// E13 - carry robustness: does the sleeve survive the regimes that the old window
// never contained?
//
// CYCLE-005 found that every basis-marked carry number in the repo was measured on
// 2023-10-31 -> now (~2.9y), because the shipped funding files carry `markPrice = 0`
// before then. CYCLE-006 restored 2020-07 onward from Binance markPriceKlines
// (`data/mark_8h.json`) and repaired the measurement bugs that surfaced (mark
// quantisation, a frozen-spot tail, sub-8h funding buckets, ragged 1h bars - see
// E14). This experiment asks the question that window could not answer: is the carry
// complex still there through the 2021-05, LUNA and FTX dislocations?
//
// Reports, for the flat delta-neutral book and the cross-sectional dispersion books
// (E12):
//   1. windowSensitivity - full history vs the old post-2023-10 window vs pre-2023-11,
//      so the size of the old-window bias is explicit rather than implied;
//   2. byYear - per calendar-year Sharpe / maxDD / annualised;
//   3. regimes - named crash/melt-up windows;
//   4. significance - the raw t, the design-effect-adjusted t (the honest one), and a
//      block-bootstrap CI of the Sharpe.
//
// Sharpe here is on the 8h grid: annualised = mean/std * sqrt(365*3).

import { SYMBOLS, serialDesignEffect, robustDesignEffect } from '../lib/lab.js';
import { buildXsSeries, statsOf, placeboSummary } from './e12_xs_carry.js';

const PERIODS_PER_YEAR = 365 * 3;
const BOOK_NAMES = ['flat', 'xsLevel', 'xsRank', 'xsFundingOnly', 'shuffled'];

function sharpeCI(rets, { block = 90, iters = 1000, seed = 20260601 } = {}) {
    const n = rets.length;
    const nb = Math.floor(n / block);
    if (nb < 4) return { lo: NaN, hi: NaN, se: NaN };
    const rnd = (() => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
    const base = rets.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - base) ** 2, 0) / (n - 1));
    const sharpe = (x) => { const m = x.reduce((a, b) => a + b, 0) / x.length; const s = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1)); return s > 0 ? (m / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };
    const bx = [];
    for (let i = 0; i < iters; i++) {
        const x = [];
        for (let k = 0; k < nb; k++) { const j = Math.floor(rnd() * nb) * block; for (let z = 0; z < block; z++) x.push(rets[j + z]); }
        bx.push(sharpe(x));
    }
    bx.sort((a, b) => a - b);
    const q = (p) => bx[Math.min(bx.length - 1, Math.max(0, Math.round(p * (bx.length - 1))))];
    return { lo: q(0.025), hi: q(0.975), se: (q(0.975) - q(0.025)) / 3.92, raw: sd > 0 ? (base / sd) * Math.sqrt(PERIODS_PER_YEAR) : NaN };
}

export function windowStats(rets, times, from, to) {
    const keep = [];
    for (let i = 0; i < rets.length; i++) if (times[i] >= from && times[i] < to) keep.push(rets[i]);
    if (keep.length < 30) return { n: keep.length, available: false };
    const s = statsOf(keep);
    const years = keep.length / PERIODS_PER_YEAR;
    const tRaw = s.sharpe * Math.sqrt(years);
    const de = serialDesignEffect(keep, 90).designEffect;
    return { n: keep.length, years: +years.toFixed(2), annualized: s.annualized, sharpe: s.sharpe, maxDrawdown: s.maxDrawdown, totalReturn: s.totalReturn, negativeFraction: s.negativeFraction, tRaw, designEffect: de, tAdjusted: Number.isFinite(de) && de > 0 ? tRaw / Math.sqrt(de) : NaN, available: true };
}

// Named crash / melt-up / bull windows. Exported so E17 can score a NEW book (e.g. a low-turnover
// dispersion variant) on exactly the same regime definitions instead of inventing its own.
export const REGIMES = [
    { name: 'meltup_2021H1', from: Date.UTC(2021, 0, 1), to: Date.UTC(2021, 5, 1) },
    { name: 'crash_2021_05', from: Date.UTC(2021, 4, 10), to: Date.UTC(2021, 6, 1) },
    { name: 'bear_2022', from: Date.UTC(2022, 0, 1), to: Date.UTC(2022, 11, 1) },
    { name: 'luna_2022_05', from: Date.UTC(2022, 4, 1), to: Date.UTC(2022, 6, 1) },
    { name: 'ftx_2022_11', from: Date.UTC(2022, 10, 1), to: Date.UTC(2022, 11, 1) },
    { name: 'recovery_2023', from: Date.UTC(2023, 0, 1), to: Date.UTC(2024, 0, 1) },
    { name: 'bull_2024', from: Date.UTC(2024, 0, 1), to: Date.UTC(2025, 0, 1) },
    { name: 'y2025', from: Date.UTC(2025, 0, 1), to: Date.UTC(2026, 0, 1) },
    { name: 'y2026', from: Date.UTC(2026, 0, 1), to: Infinity },
];

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const { times } = s;
    const books = s.books;

    const WINDOWS = [
        { name: 'full_history', from: -Infinity, to: Infinity },
        { name: 'old_window_post_2023_10', from: Date.UTC(2023, 9, 31, 8), to: Infinity },
        { name: 'pre_2023_11', from: -Infinity, to: Date.UTC(2023, 9, 31, 8) },
    ];
    const windowSensitivity = {};
    for (const b of BOOK_NAMES) {
        windowSensitivity[b] = {};
        for (const w of WINDOWS) windowSensitivity[b][w.name] = windowStats(books[b], times, w.from, w.to);
    }

    const byYear = {};
    for (const b of BOOK_NAMES) {
        byYear[b] = {};
        for (let y = 2020; y <= 2026; y++) byYear[b][y] = windowStats(books[b], times, Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1));
    }

    const REGIMES_OUT = REGIMES;
    const regimes = {};
    for (const b of BOOK_NAMES) {
        regimes[b] = {};
        for (const r of REGIMES_OUT) regimes[b][r.name] = windowStats(books[b], times, r.from, r.to);
    }

    const significance = {};
    for (const b of BOOK_NAMES) {
        const full = windowSensitivity[b].full_history;
        const ci = sharpeCI(books[b]);
        const r = books[b];
        const n = r.length;
        const m = r.reduce((a, x) => a + x, 0) / n;
        const sd = Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1));
        let maxAbs = 0; let maxAt = null;
        for (let i = 0; i < n; i++) if (Math.abs(r[i]) > maxAbs) { maxAbs = Math.abs(r[i]); maxAt = times[i]; }
        let s4 = 0; let s2 = 0;
        for (const x of r) { s2 += (x - m) ** 2; s4 += (x - m) ** 4; }
        s2 /= n; s4 /= n;
        // Outlier-robust design effect: `serialDesignEffect` jackknifes the Sharpe, and
        // on a fat-tailed carry series ONE FTX-scale observation inflates it by ~10x
        // (flat: 99.5 raw -> 11.8 winsorised at 3 sigma -> 11.0 ex-FTX). Report both.
        const deRobust = robustDesignEffect(r, { fold: 90, k: 3 });
        significance[b] = {
            n, years: full.years, sharpe: full.sharpe, tRaw: full.tRaw,
            designEffect: full.designEffect, tAdjusted: full.tAdjusted,
            designEffectWinsor3: deRobust, tAdjustedWinsor3: Number.isFinite(deRobust) && deRobust > 0 ? full.tRaw / Math.sqrt(deRobust) : NaN,
            bootstrapSharpeCI: [ci.lo, ci.hi], bootstrapSe: ci.se,
            kurtosis: s4 / (s2 * s2), maxAbsReturn: maxAbs, maxAbsReturnAt: maxAt ? new Date(maxAt).toISOString() : null,
        };
    }

    // Cross-regime consistency: the per-calendar-year Sharpes are (approximately)
    // independent at yearly scale, so the year-to-year mean and its standard error are
    // a robust read on "does this hold in more than one regime?" - far less sensitive
    // to a single crash-bar than an 8h-grid Sharpe t-stat.
    const yearlyConsistency = {};
    for (const b of BOOK_NAMES) {
        const yrs = Object.entries(byYear[b]).filter(([, v]) => v.available && v.n > 1000).map(([y, v]) => ({ y: +y, sharpe: v.sharpe, annualized: v.annualized }));
        const s = yrs.map((x) => x.sharpe);
        const meanSharpe = s.reduce((a, x) => a + x, 0) / s.length;
        const sdSharpe = Math.sqrt(s.reduce((a, x) => a + (x - meanSharpe) ** 2, 0) / Math.max(1, s.length - 1));
        yearlyConsistency[b] = {
            years: yrs.map((x) => x.y),
            annualizedByYear: yrs.map((x) => x.annualized),
            sharpeByYear: s,
            positiveYears: s.filter((x) => x > 0).length,
            totalYears: s.length,
            meanSharpe,
            seOfMeanSharpe: sdSharpe / Math.sqrt(s.length),
            tAcrossYears: sdSharpe > 0 ? meanSharpe / (sdSharpe / Math.sqrt(s.length)) : NaN,
        };
    }

    return {
        config: { symbols: s.config.symbols, periods: times.length, first: new Date(times[0]).toISOString(), last: new Date(times[times.length - 1]).toISOString(), years: +(times.length / PERIODS_PER_YEAR).toFixed(2), periodsPerYear: PERIODS_PER_YEAR, perp },
        windowSensitivity,
        byYear,
        regimes,
        significance,
        yearlyConsistency,
        placeboDistribution: placeboSummary(s.placeboSharpes, windowSensitivity.xsLevel.full_history.sharpe, windowSensitivity.xsRank.full_history.sharpe),
    };
}
