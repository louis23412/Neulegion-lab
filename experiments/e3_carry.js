// E3 - the funding/carry sleeve, measured over its FULL history.
//
// The project's P4 hypothesis is that perp funding is a structurally different
// return source (correlation +0.003 with the price basket) that buys independence.
// Its own measurement was one 600-bar run. This experiment measures the sleeve
// where it actually lives: the 8h funding grid, over every funding period the
// shipped files contain.
//
// Three books are reported:
//   (a) per symbol - the delta-neutral carry book (short perp / long spot earns
//       +fundingRate per period);
//   (b) pooled - equal weight across the 8 symbols (the P4 panel stream);
//   (c) cross-sectional - weights proportional to (funding_i - mean funding), i.e.
//       a market-neutral harvest of the funding DISPERSION across the basket.
//
// Caveats recorded with the numbers: funding is autocorrelated (so its Sharpe is a
// raw, not design-effect-adjusted, statement) and the book carries basis/liquidation
// risk that a funding-rate series alone does not show.

import { loadCloseLookup, loadMarkPrices, REPO, serialDesignEffect, robustDesignEffect, SYMBOLS } from '../lib/lab.js';
import { parseFundingJsonl, correlation } from '../../NeuLegion-master/NeuLegion-master/src/analysis/carry.js';

const GRID_MS = 28_800_000;
const PERIODS_PER_YEAR = 365 * 3;

// Snap a funding timestamp to its 8h bucket END. Binance normally charges funding on
// the 8h grid but switches SOME contracts to 1h/2h/4h intervals in extreme regimes -
// SOLUSDT was on 2h/4h funding from 2022-11-09 to 2022-11-18, i.e. straight through
// the FTX crash. A funding row is stamped at the END of its interval, so a row at
// 10:00 belongs to the 8h window closing at 16:00. Tiny timestamp jitter (~13ms) is
// snapped to the exact grid point first, otherwise it would be pushed a whole window.
const snapTo8h = (t) => {
    const nearest = Math.round(t / GRID_MS) * GRID_MS;
    return Math.abs(t - nearest) < 60_000 ? nearest : Math.ceil(t / GRID_MS) * GRID_MS;
};

// Funding rows aggregated into 8h buckets: [{t, fundingSum, markPrice, n, intervalHours}].
// `fundingSum` is what the carry book actually earns over the 8h window - summing (not
// taking the last row, which is what a plain `Map.set(roundGrid(t), rate)` does) is the
// difference between counting one of the four extra SOL payments and counting all four.
export async function loadFundingBuckets(symbol) {
    const text = await globalThis.__fs.readTextFile(`${REPO}/src/data/funding_${symbol}_8h.jsonl`);
    const { rows } = parseFundingJsonl(text);
    const m = new Map();
    for (const r of rows) {
        const t = snapTo8h(r.timestamp);
        const cur = m.get(t) || { t, fundingSum: 0, markPrice: 0, n: 0 };
        cur.fundingSum += r.fundingRate;
        cur.n++;
        if (r.markPrice > 0) cur.markPrice = r.markPrice;
        m.set(t, cur);
    }
    return [...m.values()].sort((a, b) => a.t - b.t).map((b) => ({ ...b, intervalHours: 8 / b.n }));
}

export async function run({ symbols = SYMBOLS, gridMs = GRID_MS } = {}) {
    // ---- load funding on a common 8h grid (bucket-summed, see loadFundingBuckets) ----
    const perSymbol = {};
    for (const s of symbols) {
        let buckets;
        try { buckets = await loadFundingBuckets(s); } catch { continue; }
        const m = new Map();
        for (const b of buckets) m.set(b.t, b.fundingSum);
        perSymbol[s] = m;
    }
    const names = Object.keys(perSymbol);
    // common grid = intersection (all symbols have a row on that period)
    let grid = [...perSymbol[names[0]].keys()].sort((a, b) => a - b);
    for (const n of names.slice(1)) grid = grid.filter((t) => perSymbol[n].has(t));
    // 1h closes aligned to the grid (for the price-correlation check)
    const btcAt = await loadCloseLookup('candles.jsonl', { barMs: 3_600_000 });
    const priceT = grid.filter((t) => btcAt(t) != null);

    const seriesBySymbol = names.map((n) => grid.map((t) => perSymbol[n].get(t)));
    const pooled = grid.map((_, i) => seriesBySymbol.reduce((a, s) => a + s[i], 0) / names.length);

    // ---- (a) per symbol ----
    const rows = names.map((n, k) => {
        const s = seriesBySymbol[k];
        const mean = s.reduce((a, b) => a + b, 0) / s.length;
        const std = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (s.length - 1));
        return {
            symbol: n,
            periods: s.length,
            meanRatePerPeriod: mean,
            annualizedCarryFraction: mean * PERIODS_PER_YEAR,
            sharpe: std > 0 ? (mean / std) * Math.sqrt(PERIODS_PER_YEAR) : NaN,
            negativeFraction: s.filter((v) => v < 0).length / s.length,
            totalFraction: s.reduce((a, b) => a + b, 0),
        };
    });

    // ---- (b) pooled ----
    const pMean = pooled.reduce((a, b) => a + b, 0) / pooled.length;
    const pStd = Math.sqrt(pooled.reduce((a, b) => a + (b - pMean) ** 2, 0) / (pooled.length - 1));

    // ---- (c) cross-sectional dispersion harvest ----
    const xsSeries = grid.map((_, i) => {
        const col = seriesBySymbol.map((s) => s[i]);
        const m = col.reduce((a, b) => a + b, 0) / col.length;
        // weight_i = (f_i - mean) -> book return = sum w_i f_i / N = dispersion
        return col.reduce((a, f) => a + (f - m) * f, 0) / col.length;
    });
    const xMean = xsSeries.reduce((a, b) => a + b, 0) / xsSeries.length;
    const xStd = Math.sqrt(xsSeries.reduce((a, b) => a + (b - xMean) ** 2, 0) / (xsSeries.length - 1));

    // price correlation: equal-weight 8h market return vs the pooled carry
    const priceIdx = grid.map((t, i) => (btcAt(t) != null ? i : -1)).filter((i) => i >= 0);
    const marketRet = [];
    const carryRet = [];
    for (let j = 1; j < priceIdx.length; j++) {
        const a = priceIdx[j - 1];
        const b = priceIdx[j];
        if (b - a > 2) continue; // skip gaps
        marketRet.push(btcAt(grid[b]) / btcAt(grid[a]) - 1);
        carryRet.push(pooled[b]);
    }

    return {
        config: { symbols: names.length, commonPeriods: grid.length, firstPeriod: new Date(grid[0]).toISOString(), lastPeriod: new Date(grid[grid.length - 1]).toISOString(), years: (grid.length / PERIODS_PER_YEAR).toFixed(2) },
        perSymbol: rows,
        pooled: {
            meanRatePerPeriod: pMean,
            annualizedCarryFraction: pMean * PERIODS_PER_YEAR,
            sharpe: pStd > 0 ? (pMean / pStd) * Math.sqrt(PERIODS_PER_YEAR) : NaN,
            negativeFraction: pooled.filter((v) => v < 0).length / pooled.length,
            totalFraction: pooled.reduce((a, b) => a + b, 0),
            serialDesignEffect: serialDesignEffect(pooled, 90),
        },
        crossSectional: {
            meanPerPeriod: xMean,
            annualizedFraction: xMean * PERIODS_PER_YEAR,
            sharpe: xStd > 0 ? (xMean / xStd) * Math.sqrt(PERIODS_PER_YEAR) : NaN,
            sharePositive: xsSeries.filter((v) => v > 0).length / xsSeries.length,
        },
        priceCorrelation: { n: marketRet.length, corr: correlation(marketRet, carryRet) },
        basisBook: await basisBook(symbols),
    };
}

// The HONEST delta-neutral PnL: long spot + short perp earns the funding but also
// carries the spot-minus-perp (basis) return, which the raw funding series hides.
//   ret(t) = spotRet(t) - perpRet(t) + fundingRate(t)
// `perp` is the funding row's `markPrice`. The SHIPPED funding files carry
// `markPrice = 0` before 2023-10-31, which would confine every basis-marked result
// to a benign ~2.9-year window (CYCLE-005); for those periods we substitute the
// repo-independent mark prices in `data/mark_8h.json` (Binance `futures/um`
// markPriceKlines, 2020-07 onward — see `data/README.md`). This extends the carry
// complex back through the 2021-05 and 2022 crashes.
//
// `loadCarryBook` returns the per-symbol series and the end-aligned equal-weight
// pool, WITHOUT statistics - so E11's vol-sizing and E12's cross-section can reuse
// the exact series rather than re-derive it. Each per-symbol entry carries the four
// aligned legs: `rets` (the book), `basis` (spot - perp), `f` (funding) and `spot`.
// `basisBook` is the thin statistics wrapper.
// `perp` selects the perp leg:
//   'mark'   (default) - the repo's `markPrice` where present, else `data/mark_8h.json`.
//                        This is the lab's historical definition, and the mark is a SMOOTHED INDEX.
//   'traded' - the actual traded 8h close from `data/perp_8h.json` (Binance `futures/um` klines).
//                        L14: the falsifier for every carry result, because you cannot trade the mark.
export async function loadCarryBook(symbols, { perp = 'mark' } = {}) {
    const ext = await loadMarkPrices().catch(() => null);
    const traded = perp === 'traded' ? await loadMarkPrices('src/NeuLegion-lab/data/perp_8h.json').catch(() => null) : null;
    const perSym = [];
    for (const s of symbols) {
        const name = s === 'btcusdt' ? 'candles.jsonl' : `candles_${s}_1h.jsonl`;
        let spotAt;
        try { spotAt = await loadCloseLookup(name, { barMs: 3_600_000 }); } catch { continue; }
        const buckets = await loadFundingBuckets(s);
        const rets = [];
        const basis = [];
        const basisLevel = [];
        const fArr = [];
        const spot = [];
        const times = [];
        let prev = null;
        let tailSkipped = 0;
        let raggedSkipped = 0;
        let noMark = 0;
        let sub8hBuckets = 0;
        for (const b of buckets) {
            const t = b.t;
            // Guard against the funding file running past the candle history: beyond
            // `spotAt.lastClose` the lookup carry-forwards a frozen price, so the spot
            // leg stops moving while the mark leg keeps moving - a fake ±5% "basis"
            // move per period (CYCLE-006). Skip, and only count it as stale if the
            // mark was otherwise available.
            if (t > spotAt.lastClose) {
                const hasPerp = perp === 'traded'
                    ? (traded && traded[s] && traded[s].has(t))
                    : (b.markPrice > 0 || (ext && ext[s] && ext[s].has(t)));
                if (hasPerp) tailSkipped++;
                continue;
            }
            // Exact 8h-aligned closes only: a missing 1h bar would otherwise stretch
            // the return into 9h/10h and mispair it against the 8h mark leg.
            const sp = spotAt.exact(t);
            const mk = perp === 'traded'
                ? (traded && traded[s] ? traded[s].get(t) : undefined)
                : ((b.markPrice > 0) ? b.markPrice : (ext && ext[s] ? ext[s].get(t) : undefined));
            if (sp == null) { prev = null; raggedSkipped++; continue; }
            if (!(mk > 0)) { prev = null; noMark++; continue; }
            if (prev) {
                const sr = sp / prev.sp - 1;
                const pr = mk / prev.mk - 1;
                const br = sr - pr;
                rets.push(br + b.fundingSum);
                basis.push(br);
                basisLevel.push(mk / sp - 1);
                fArr.push(b.fundingSum);
                spot.push(sr);
                times.push(t);
                if (b.n > 1) sub8hBuckets++;
            }
            prev = { sp, mk };
        }
        if (rets.length > 50) perSym.push({ symbol: s, rets, basis, basisLevel, f: fArr, spot, times, tailSkipped, raggedSkipped, noMark, sub8hBuckets });
    }
    const n = perSym.length ? Math.min(...perSym.map((p) => p.rets.length)) : 0;
    const pooled = [];
    for (let i = 0; i < n; i++) { let a = 0; for (const p of perSym) a += p.rets[p.rets.length - n + i]; pooled.push(a / perSym.length); }
    return { perSym, pooled };
}

function carryStats(rets) {
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const std = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
    const eq = [1];
    for (const r of rets) eq.push(eq[eq.length - 1] * (1 + r));
    let peak = eq[0];
    let mdd = 0;
    for (const v of eq) { if (v > peak) peak = v; if (peak > 0) mdd = Math.max(mdd, (peak - v) / peak); }
    return { annualized: mean * PERIODS_PER_YEAR, sharpe: std > 0 ? (mean / std) * Math.sqrt(PERIODS_PER_YEAR) : NaN, maxDrawdown: mdd, totalReturn: eq[eq.length - 1] - 1 };
}

async function basisBook(symbols) {
    const { perSym, pooled } = await loadCarryBook(symbols);
    if (!perSym.length) return { available: false };
    const p = carryStats(pooled);
    return {
        available: true,
        periods: pooled.length,
        perSymbol: perSym.map(({ symbol, rets }) => ({ symbol, periods: rets.length, ...carryStats(rets), sharpeBasis: carryStats(rets).sharpe })),
        pooled: {
            ...p,
            negativeFraction: pooled.filter((v) => v < 0).length / pooled.length,
            serialDesignEffect: serialDesignEffect(pooled, 90),
            robustDesignEffect: robustDesignEffect(pooled),
        },
    };
}
