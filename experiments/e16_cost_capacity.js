// E16 - the cost/turnover audit of the carry complex. CYCLE-008.
//
// Every headline result in the lab is a GROSS return series: basis P&L + funding, with NO trading
// cost. That is defensible for the flat sleeve, which is a delta-neutral position you establish once
// and hold. It is NOT obviously defensible for the two "improvements" - the cross-sectional
// dispersion book (F-17/L12) and the timed reversion book (F-10/L11) - because both RESHUFFLE their
// positions every 8h as funding ranks / basis z-scores move. Their gross edge is ~1 bp per 8h period;
// if they turn over a meaningful fraction of the book each period, a realistic fee eats it.
//
// This is the successor to L14 (F-22). L14 asked "can you trade the price you measured?"; this asks
// "can you trade it every 8h and keep the edge?". It is a falsifier: if the dispersion/reversion books
// die at realistic costs, the lab's best sleeves (and R4/R8) shrink to the flat book.
//
// Units. Each book is a return on 1 unit of gross perp notional (the weights normalize to sum|w| = 1
// for the xs books; the reversion book is in the same per-symbol units divided by the symbol count).
// Changing exposure in symbol i by dw means trading dw of spot AND dw of perp, so `costBps` is the fee
// on ONE (spot + perp) unit = f_spot + f_perp: ~15 bps at Binance base TAKER (10 + 5), ~11 bps mixed
// (maker perp 1 + taker spot 10, plus BNB/spot discounts), ~4 bps at VIP MAKER on both legs. The lab
// reports the break-even and lets the reader place their own fee.
//
// Turnover for a set of exposure vectors: T_t = sum_i |w_i,t - w_i,t-1|, w_-1 = 0 (so the first period
// carries the one-off entry, matching the repo's `turnover` convention). Cross-checked against the
// repo's own `turnover()` on the transposed columns.

import { SYMBOLS, turnover as repoTurnover } from '../lib/lab.js';
import { buildXsSeries, statsOf } from './e12_xs_carry.js';
import { reversionFromBook } from './e7_basis_reversion.js';
import { loadCarryBook } from './e3_carry.js';

const PERIODS_PER_YEAR = 365 * 3;
const COST_LEVELS_BPS = [0, 2, 4, 5, 10, 15, 20, 30];

const fin = (x) => (Number.isFinite(x) ? x : 0);

// Per-period L1 turnover of a weight-vector series.
export function turnoverSeries(weightRows) {
    const k = weightRows[0].length;
    const out = new Array(weightRows.length).fill(0);
    let prev = new Array(k).fill(0);
    for (let t = 0; t < weightRows.length; t++) {
        const w = weightRows[t];
        let s = 0;
        for (let j = 0; j < k; j++) s += Math.abs(fin(w[j]) - fin(prev[j]));
        out[t] = s;
        prev = w;
    }
    return out;
}

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };

// Audit one book: gross return series + aligned exposure vectors -> turnover, break-even, net curve.
//
// `periodsPerYear` is the ANNUALISATION BASIS (see `e12#statsOf`). The default `365*3` is the true
// number of 8h periods and matches the carry complex; `e24` passes 252 (the ledger's convention, so
// its bar books are on the same Sharpe scale as `e2`), 8760 (1h) or 35040 (15m) to get physically
// meaningful turnover. Existing callers omit it and are byte-identical.
export function audit(name, grossRets, weightRows, { periodsPerYear = PERIODS_PER_YEAR } = {}) {
    const t = turnoverSeries(weightRows);
    const T = mean(t);
    const meanGross = mean(grossRets);
    const sumTurnover = t.reduce((a, b) => a + b, 0);
    const breakEvenBps = sumTurnover > 0 ? (meanGross / T) * 1e4 : null;
    const curve = {};
    for (const c of COST_LEVELS_BPS) {
        const net = grossRets.map((r, i) => (Number.isFinite(r) ? r - (c / 1e4) * t[i] : r));
        const st = statsOf(net, periodsPerYear);
        curve[c] = { sharpe: st.sharpe, annualized: st.annualized, maxDrawdown: st.maxDrawdown };
    }
    return {
        name,
        periods: grossRets.length,
        symbols: weightRows[0].length,
        gross: { sharpe: statsOf(grossRets, periodsPerYear).sharpe, annualized: statsOf(grossRets, periodsPerYear).annualized, maxDrawdown: statsOf(grossRets, periodsPerYear).maxDrawdown },
        turnover: {
            totalL1: sumTurnover,
            meanPerPeriod: T,
            annualized: T * periodsPerYear,
            medianPerPeriod: t.slice().sort((a, b) => a - b)[Math.floor(t.length / 2)],
            p90PerPeriod: t.slice().sort((a, b) => a - b)[Math.floor(0.9 * t.length)],
            nonzeroFraction: t.filter((x) => x > 1e-12).length / t.length,
        },
        breakEvenBps,
        net: curve,
    };
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;

    // Flat book: constant 1/k exposure, i.e. a buy-and-hold delta-neutral position (turnover = entry).
    const flatWeights = s.books.flat.map(() => new Array(k).fill(1 / k));

    const flat = audit('flatEqualWeight', s.books.flat, flatWeights);
    const xsLevel = audit('xsFundingLevel', s.books.xsLevel, s.weightSeries.xsLevel);
    const xsRank = audit('xsFundingRank', s.books.xsRank, s.weightSeries.xsRank);

    // Cross-check the rank book's turnover against the repo's own `turnover()` on transposed columns.
    const cols = [];
    for (let j = 0; j < k; j++) cols.push(s.weightSeries.xsRank.map((w) => w[j]));
    const repoSum = cols.reduce((a, col) => a + repoTurnover(col), 0);

    const { perSym } = await loadCarryBook(symbols, { perp });
    const rev = reversionFromBook(perSym, { zWindow: 60, includeWeights: true });
    const revBasis = audit('reversionBasisOnly', rev.pooledReturns.basisOnly, rev.pooledWeights);
    const revCarryPlus = audit('reversionCarryPlus', rev.pooledReturns.carryPlus, rev.pooledWeights);

    // The flat book's target weights never change, but the *delta* of a held spot+perp leg drifts by
    // that period's basisPnl. If you re-establish the hedge every period, that drift is extra turnover:
    // sum_i |w_i * basisPnl_i| with w_i = 1/k, which equals the mean per-symbol |basisPnl| (k terms).
    const flatRehedgePerPeriod = mean(perSym.map((p) => mean(p.basis.map(Math.abs))));
    const flatRehedgeAnnual = flatRehedgePerPeriod * PERIODS_PER_YEAR;

    return {
        config: { symbols: k, perp, periods: s.config.periods, years: s.config.years, costLevelsBps: COST_LEVELS_BPS },
        note: 'costBps = fee on one (spot + perp) unit; reference tiers taker ~15, mixed ~11, VIP maker ~4 bps',
        books: {
            flat,
            xsLevel,
            xsRank,
            reversionBasisOnly: revBasis,
            reversionCarryPlus: revCarryPlus,
        },
        flatRehedge: {
            note: 'delta-maintenance turnover for the flat hold IF the hedge is re-established each period (approximate; not included in `flat`)',
            perPeriod: flatRehedgePerPeriod,
            annualized: flatRehedgeAnnual,
            breakEvenIfRehedgedBps: flatRehedgePerPeriod > 0 ? (mean(s.books.flat) / flatRehedgePerPeriod) * 1e4 : null,
        },
        crossCheck: { xsRankRepoSum: repoSum, xsRankL1: xsRank.turnover.totalL1, agree: Math.abs(repoSum - xsRank.turnover.totalL1) < 1e-9 },
    };
}
