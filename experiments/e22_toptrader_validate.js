// E22 - VALIDATE L18 (F-29): the cross-sectional toptrader-ratio fade. CYCLE-014.
//
// F-29 (e21) found the first positive signal from new data: a dollar-neutral book that FADES the
// top-trader long/short ratio (short the crowded side) scores gross Sharpe ~1.06, break-even ~15 bps,
// net@4 ~+0.77 on the common 2021-12..2026-08 window. It is a single in-sample history, so before it
// can be a port candidate it needs the four tests the lab applies to every "improvement":
//
//   A. HELD-OUT. The fade direction is a PRIOR (contrarian), not fitted - so the honest split is: fix
//      the sign, confirm the FIRST half earns it, and score the SECOND half on its own. Report both
//      halves gross and net; a book that only works on the half you looked at is a fit (PROTOCOL rule 2).
//   B. COST. F-29's turnover is 126x/yr. Apply the F-24/E17 smoothing machinery (EWMA on the weights)
//      and see whether a cheaper cadence keeps the edge with a higher break-even.
//   C. CONFOUND. Is it just the funding rank? Build the SAME construction from the funding rate (a
//      signal already in the repo's data), same loop, same masking. Report its Sharpe and the return
//      correlation with the toptrader book. (Signal-level: topLS vs funding rank cross-sectional corr.)
//   D. CAPACITY. Use E19's model (e19#capacityOf) for the impact capacity and the per-symbol
//      concentration vs ADV/open interest, exactly as the carry sleeves (F-26/F-27/F-28) were read.
//
// Convention (same as e21, validated by its lag profile): the book grid is `s.times` (= legs.times[.],
// the carry book's bookTimes). A book period `i` uses the signal snapshot at `times[i]` and earns
// `legs.spotRet[i+2]`, the forward return over (times[i], times[i+1]). Missing symbols are masked.

import { SYMBOLS, pearsonCorrelation, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries, statsOf } from './e12_xs_carry.js';
import { rankWeights } from './e17_low_turnover.js';
import { audit, turnoverSeries } from './e16_cost_capacity.js';
import { capacityOf, makeCapacityEnv } from './e19_capacity_impact.js';

const PERIODS_PER_YEAR = 365 * 3;
const NEXT = 2;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sharpeOf = (a) => statsOf(a).sharpe;

// A cross-sectional book on the book grid with missing symbols MASKED (L10-r) and a weight policy.
// sig[j][i] = the signal for symbol j at book time times[i]; absent = null.
//
// Exported (CYCLE-023) with the book-grid `times` passed EXPLICITLY (it used to read a module-level `s`),
// so E32 can reuse the exact fade construction instead of re-implementing it. The extraction was verified
// byte-identical by re-running this experiment and diffing `results/e22_toptrader_validate.json`.
export function buildMasked(sig, k, legs, times, { sign = -1, from = 0, policy = { kind: 'daily' } } = {}) {
    const n = legs.spotRet.length;
    const rets = []; const weightRows = []; const bookTimes = [];
    let held = new Array(k).fill(0);
    for (let i = Math.max(1, from); i < n - 1; i++) {
        const pres = [];
        for (let j = 0; j < k; j++) if (Number.isFinite(sig[j][i])) pres.push(j);
        const target = new Array(k).fill(0);
        if (pres.length >= 3) {
            const sv = pres.map((j) => sig[j][i]);
            const m = mean(sv);
            const z = sv.map((v) => v - m);
            const g = z.reduce((a, b) => a + Math.abs(b), 0) || 1;
            pres.forEach((j, q) => { target[j] = sign * z[q] / g; });
        }
        let w;
        if (policy.kind === 'daily') w = target.slice();
        else if (policy.kind === 'ewma') w = held.map((h, j) => (1 - policy.lambda) * h + policy.lambda * target[j]);
        else throw new Error(`unknown policy ${policy.kind}`);
        if (policy.normalize) { const g = w.reduce((a, x) => a + Math.abs(x), 0) || 1; w = w.map((x) => x / g); }
        held = w;
        const sr2 = legs.spotRet[i + NEXT];
        weightRows.push(w.slice());
        rets.push(w.reduce((a, wj, j) => a + wj * (sr2 ? sr2[j] : 0), 0));
        bookTimes.push(times[i]);
    }
    return { rets, weightRows, bookTimes };
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList; const k = names.length;
    const times = s.times; const n = times.length; const legs = s.legs;
    const oi = await loadOpenInterest();
    const align = (field) => names.map((nm) => { const o = oi[nm]; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o[field][idx] : null; } return arr; });
    const topLS = align('topLS'); const oiVal = align('oiVal');
    const firstAll = (sig) => { for (let i = 1; i < n - 2; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(sig[j][i])) all = false; if (all) return i; } return -1; };
    const firstTop = firstAll(topLS);
    // funding (the confound signal): use the funding stamped one period BEFORE the return start =
    // fRate[i+1] is stamped at legs.times[i+2] (the return end) so it is NOT allowed; fRate[i] is stamped
    // at legs.times[i+1] = the return start, which is causal but contemporaneous - be conservative and use
    // fRate[i], matching the "previous period's funding" convention of e12/e17.
    const fund = names.map((_, j) => times.map((_, i) => (legs.fRate[i] ? legs.fRate[i][j] : null)));
    const dOI = names.map((_, j) => times.map((_, i) => { const a = oiVal[j][i], b = oiVal[j][i - 1]; return (a > 0 && b > 0) ? Math.log(a / b) : null; }));

    const env = await makeCapacityEnv(names);

    const variants = [
        { name: 'topLS_fade_daily', sig: topLS, sign: -1, policy: { kind: 'daily' } },
        { name: 'topLS_fade_ewma0.5', sig: topLS, sign: -1, policy: { kind: 'ewma', lambda: 0.5, normalize: true } },
        { name: 'topLS_fade_ewma0.25', sig: topLS, sign: -1, policy: { kind: 'ewma', lambda: 0.25, normalize: true } },
        { name: 'topLS_fade_ewma0.1', sig: topLS, sign: -1, policy: { kind: 'ewma', lambda: 0.1, normalize: true } },
        { name: 'topLS_fade_ewma0.05', sig: topLS, sign: -1, policy: { kind: 'ewma', lambda: 0.05, normalize: true } },
        { name: 'topLS_fade_ewma0.1_nonorm', sig: topLS, sign: -1, policy: { kind: 'ewma', lambda: 0.1 } },
        { name: 'fundFade_daily', sig: fund, sign: -1, policy: { kind: 'daily' } },
        { name: 'fundFade_ewma0.1', sig: fund, sign: -1, policy: { kind: 'ewma', lambda: 0.1, normalize: true } },
        { name: 'dOI_daily', sig: dOI, sign: 1, policy: { kind: 'daily' } },
        { name: 'topLS_momentum_daily', sig: topLS, sign: 1, policy: { kind: 'daily' } },
    ];

    const books = {};
    const raw = {};
    for (const v of variants) {
        const b = buildMasked(v.sig, k, legs, times, { sign: v.sign, from: firstTop, policy: v.policy });
        const a = audit(v.name, b.rets, b.weightRows);
        const half = Math.floor(b.rets.length / 2);
        const T = turnoverSeries(b.weightRows);
        const net4 = b.rets.map((r, i) => r - 4e-4 * T[i]);
        const byYear = {}; { const yrs = {}; for (let i = 0; i < b.rets.length; i++) { const y = new Date(b.bookTimes[i]).getUTCFullYear(); (yrs[y] = yrs[y] || []).push(b.rets[i]); } for (const [y, x] of Object.entries(yrs)) byYear[y] = +sharpeOf(x).toFixed(2); }
        const capa = capacityOf(v.name, b.rets, b.weightRows, b.bookTimes, env);
        raw[v.name] = { rets: b.rets, W: b.weightRows, bt: b.bookTimes, net4 };
        books[v.name] = {
            grossSharpe: a.gross.sharpe, annualized: a.gross.annualized, maxDrawdown: a.gross.maxDrawdown,
            turnoverAnnual: a.turnover.annualized, breakEvenBps: a.breakEvenBps,
            net4Sharpe: sharpeOf(net4),
            net: Object.fromEntries(Object.entries(a.net).map(([c, x]) => [c, { sharpe: x.sharpe }])),
            firstHalfGross: +sharpeOf(b.rets.slice(0, half)).toFixed(3),
            secondHalfGross: +sharpeOf(b.rets.slice(half)).toFixed(3),
            firstHalfNet4: +sharpeOf(net4.slice(0, half)).toFixed(3),
            secondHalfNet4: +sharpeOf(net4.slice(half)).toFixed(3),
            perYear: byYear,
            capacityUSD_fee4bps: capa.capacityUSD_fee4bps,
            impactBpsAt10M_Y1: capa.impactBpsAt10M_Y1,
            meanGrossExposure: mean(b.weightRows.map((w) => w.reduce((x, y) => x + Math.abs(y), 0))),
        };
    }

    const daily = raw['topLS_fade_daily'];
    const ewma = raw['topLS_fade_ewma0.1'];
    const fundD = raw['fundFade_daily'];

    // D. concentration: mean |w| per symbol, and the book-size G at which the biggest position is 1%/5%/10%
    // of that symbol's mean open interest (F-28's convention).
    const oiMean = names.map((nm) => { const o = oi[nm]; if (!o) return NaN; const v = o.oiVal.map((x, i) => flowIndexAt(o, times[i]) >= 0 ? x : null).filter((x) => x > 0); return mean(v); });
    const meanAbsWof = (W) => names.map((_, j) => mean(W.map((w) => Math.abs(w[j]))));
    const concentration = {};
    for (const [tag, W] of [['daily', daily.W], ['ewma0.1', ewma.W]]) {
        const mw = meanAbsWof(W);
        const table = {};
        for (const f of [0.01, 0.05, 0.10]) { let G = Infinity; let bind = 0; for (let j = 0; j < k; j++) if (mw[j] > 0) { const g = (f * oiMean[j]) / mw[j]; if (g < G) { G = g; bind = j; } } table[`at_${f * 100}pct`] = { USD: G, bindingSymbol: names[bind] }; }
        concentration[tag] = { meanAbsWeight: Object.fromEntries(names.map((nm, j) => [nm, mw[j]])), oiMean, oiFracCapacity: table };
    }

    return {
        config: { symbols: k, symbolList: names, periods: daily.rets.length, windowStart: new Date(times[firstTop]).toISOString(), next: NEXT, note: 'book grid = s.times (carry bookTimes); signal snapshot at times[i], earns legs.spotRet[i+2] = forward (times[i], times[i+1]); missing masked.' },
        books,
        fundConfound: { signalXSecCorr_topLS_vs_fund: +mean(times.map((_, i) => { const p = []; for (let j = 0; j < k; j++) if (Number.isFinite(topLS[j][i]) && Number.isFinite(fund[j][i])) p.push([topLS[j][i], fund[j][i]]); return p.length >= 3 ? pearsonCorrelation(p.map((q) => q[0]), p.map((q) => q[1])) : NaN; })).toFixed(3), returnCorr_topLS_vs_fundFade: +pearsonCorrelation(daily.rets, fundD.rets).toFixed(3) },
        concentration,
        note: 'A held-out split of the parameter-free fade, a smoothing sweep (F-24 trick), the funding confound, and E19 capacity — the four tests L18 must pass before R7 is revisited.',
    };
}
