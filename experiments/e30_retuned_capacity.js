// E30 - SIZE OF THE RETUNED DISPERSION BOOK. CYCLE-021 (L15/L17 follow-up to F-37).
//
// F-37 (CYCLE-020) showed the dispersion sleeve's decayed cost margin is repaired by a *slower* weight
// policy: `ewma 0.01_norm` clears the fee on the recent 24 months (break-even 27 bps, net@4 +3.86) and a
// walk-forward λ-selection reproduces the fix out of sample. But the F-26/F-27 capacity numbers ($13 M
// -> $27 M with a 12.5 % cap) were measured on the OLD λ=0.1 book and are now stale in the same way the
// F-24 fee economics were. This experiment asks the follow-up the R8 gate needs:
//
//     Does the retuned (slower) book carry MORE size than the λ=0.1 spec, and what actually binds it —
//     the square-root IMPACT (F-26, per-period trade size) or the OPEN-INTEREST position limit (F-28,
//     held size)?
//
// A slower book trades less per period (impact falls), but it also holds a more persistent position
// (OI-participation rises), so the two bounds move in OPPOSITE directions — the answer is not obvious and
// is exactly the "capacity, not just cost" check the lab requires.
//
// Uses the single cost model (e19#capacityOf + e19#makeCapacityEnv) and the single policy implementation
// (e17#buildBook); the OI bound reuses e21's construction. Guards: the λ=0.1 book must reproduce
// e19's stored `xsRank_ewma0.1_norm` capacity ($13.211 M at Y=1, break-even 12.777 bps) or the builders
// have diverged.
//
// FALSIFIER (pre-registered). If the retuned book's *usable* size — min(impact capacity, OI position
// capacity) — does not exceed the λ=0.1 spec's, then F-37's fee recovery does not extend to size and R8
// stays a small-size sleeve.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';
import { capacityOf, makeCapacityEnv } from './e19_capacity_impact.js';

const PERIODS_PER_YEAR = 365 * 3;
const FEE_BPS = 4;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };

// Strict per-symbol cap (F-27): clip and HOLD, no renormalisation.
function applyCap(weightRows, cap) {
    return weightRows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x)));
}

function windowMetrics(rets, T, from, to) {
    const r = rets.slice(from, to);
    const t = T.slice(from, to);
    const net4 = r.map((x, i) => x - (FEE_BPS / 1e4) * t[i]);
    return {
        n: r.length,
        grossSharpe: +sharpe(r).toFixed(2),
        net4Sharpe: +sharpe(net4).toFixed(2),
        turnoverAnnual: +(mean(t) * PERIODS_PER_YEAR).toFixed(0),
        breakEvenBps: mean(t) > 0 ? +((mean(r) * 1e4) / mean(t)).toFixed(2) : null,
    };
}

const VARIANTS = [];
for (const lam of [0.005, 0.01, 0.02, 0.05, 0.1]) VARIANTS.push({ name: `ewma_${lam}_norm`, lambda: lam, cap: null });
for (const lam of [0.02, 0.05, 0.1]) VARIANTS.push({ name: `ewma_${lam}_norm_cap12.5`, lambda: lam, cap: 0.125 });

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const names = s.config.symbolList;
    const legs = s.legs;
    const bookTimes = legs.times.slice(1);
    const n = bookTimes.length;
    const env = await makeCapacityEnv(names);

    // OI aligned to book times, for the position limit (e21's construction).
    const oi = await loadOpenInterest();
    const oiValBySym = names.map((nm) => {
        const o = oi[nm];
        if (!o) return null;
        const arr = new Array(n).fill(null);
        for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, bookTimes[i]); arr[i] = idx >= 0 ? o.oiVal[idx] : null; }
        return arr;
    });
    const oiMean = names.map((_, j) => { const v = oiValBySym[j] ? oiValBySym[j].filter((x) => x > 0) : []; return v.length ? mean(v) : NaN; });

    const books = {};
    for (const v of VARIANTS) {
        const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: v.lambda, normalize: true } });
        let weightRows = built.weightRows;
        if (v.cap) weightRows = applyCap(weightRows, v.cap);
        const fin = (x) => (Number.isFinite(x) ? x : 0);
        const rets = v.cap
            ? weightRows.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * (fin(bp[j]) + fin(fr[j])), 0); })
            : built.rets;
        const T = turnoverSeries(weightRows);
        // e19 used the FULL times array (volume at the START of the holding period); keep that convention
        // so the λ=0.1 book reproduces the stored artefact exactly.
        const cap = capacityOf(v.name, rets, weightRows, s.times, env);
        const w24 = Math.min(n, Math.round(2 * PERIODS_PER_YEAR));
        const w12 = Math.min(n, Math.round(PERIODS_PER_YEAR));

        // OI position capacity: G such that |w_j|*G = f * meanOI_j for the binding symbol.
        const meanAbsW = names.map((_, j) => mean(weightRows.map((w) => Math.abs(w[j]))));
        const oiCapacity = {};
        for (const f of [0.01, 0.05, 0.10]) {
            let G = Infinity; let binding = -1;
            for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && oiMean[j] > 0) G = Math.min(G, (f * oiMean[j]) / meanAbsW[j]);
            for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && oiMean[j] > 0 && (f * oiMean[j]) / meanAbsW[j] === G) binding = j;
            oiCapacity[`at_${f * 100}pct_of_meanOI`] = G === Infinity ? null : { USD: G, bindingSymbol: names[binding] };
        }

        books[v.name] = {
            lambda: v.lambda,
            cap: v.cap,
            grossSharpe: cap.gross.sharpe,
            turnoverAnnual: cap.turnover.annualized,
            breakEvenBps: cap.breakEvenBps,
            capacityUSD_fee4bps: cap.capacityUSD_fee4bps,
            impactBpsAt10M_Y1: cap.impactBpsAt10M_Y1,
            bindingAtImpactCapacity: cap.participationAtCapacity_fee4_Y1 ? { symbol: cap.participationAtCapacity_fee4_Y1.symbol, participation: cap.participationAtCapacity_fee4_Y1.max } : null,
            windows: {
                full: windowMetrics(rets, T, 0, n),
                last24m: windowMetrics(rets, T, n - w24, n),
                last12m: windowMetrics(rets, T, n - w12, n),
            },
            oiPositionCapacity_at_5pct: oiCapacity.at_5pct_of_meanOI ? oiCapacity.at_5pct_of_meanOI.USD : null,
            oiPositionCapacity: oiCapacity,
        };
        books[v.name].usableSizeY1_fee4bps = Math.min(cap.capacityUSD_fee4bps.Y1, oiCapacity.at_5pct_of_meanOI ? oiCapacity.at_5pct_of_meanOI.USD : Infinity);
    }

    // Guard: λ=0.1 must reproduce e19's stored xsRank_ewma0.1_norm capacity.
    let e19 = null;
    try { e19 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e19_capacity_impact.json')); } catch (e) { e19 = null; }
    const e19b = e19 ? e19.books['xsRank_ewma0.1_norm'] : null;
    const base = books['ewma_0.1_norm'];
    const validation = e19b ? {
        e19CapacityY1: e19b.capacityUSD_fee4bps.Y1,
        e19BreakEvenBps: e19b.breakEvenBps,
        hereCapacityY1: base.capacityUSD_fee4bps.Y1,
        hereBreakEvenBps: base.breakEvenBps,
        matchesE19: Math.abs(base.capacityUSD_fee4bps.Y1 / e19b.capacityUSD_fee4bps.Y1 - 1) < 1e-9 && Math.abs(base.breakEvenBps - e19b.breakEvenBps) < 1e-6,
        note: 'λ=0.1 must reproduce e19; if not, the cost model or builders diverged and nothing else counts.',
    } : null;

    const frontier = Object.entries(books)
        .map(([name, b]) => ({
            name,
            turnoverAnnual: Math.round(b.turnoverAnnual),
            breakEvenBps: b.breakEvenBps,
            capacityY05: b.capacityUSD_fee4bps['Y0.5'],
            capacityY1: b.capacityUSD_fee4bps.Y1,
            capacityY2: b.capacityUSD_fee4bps.Y2,
            oiBound5pct: b.oiPositionCapacity_at_5pct,
            usableY1: b.usableSizeY1_fee4bps,
            binding: b.bindingAtImpactCapacity && b.bindingAtImpactCapacity.symbol,
            recentNet4: b.windows.last24m.net4Sharpe,
            recentBreakEven: b.windows.last24m.breakEvenBps,
        }))
        .sort((a, b) => b.capacityY1 - a.capacityY1);

    const slowest = books['ewma_0.01_norm'];
    const spec = books['ewma_0.1_norm'];
    const verdict = {
        note: 'Falsifier: if the retuned book\'s usable size does not exceed the λ=0.1 spec\'s, F-37\'s recovery does not extend to size.',
        specCapacityY1: spec.capacityUSD_fee4bps.Y1,
        slowestCapacityY1: slowest.capacityUSD_fee4bps.Y1,
        specUsableY1: spec.usableSizeY1_fee4bps,
        slowestUsableY1: slowest.usableSizeY1_fee4bps,
        specOIbound5pct: spec.oiPositionCapacity_at_5pct,
        slowestOIbound5pct: slowest.oiPositionCapacity_at_5pct,
        slowerRaisesImpactCapacity: slowest.capacityUSD_fee4bps.Y1 > spec.capacityUSD_fee4bps.Y1,
        slowerLowersOIBound: slowest.oiPositionCapacity_at_5pct < spec.oiPositionCapacity_at_5pct,
        usableSizeRises: slowest.usableSizeY1_fee4bps > spec.usableSizeY1_fee4bps,
        validationPass: validation ? validation.matchesE19 : null,
    };

    return {
        config: { symbols: k, symbolList: names, periods: n, perp, feeBps: FEE_BPS, variants: VARIANTS.length },
        validation,
        books,
        frontier,
        verdict,
    };
}
