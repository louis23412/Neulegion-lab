// E21 - OPEN INTEREST + TOPTRADER POSITIONING: L07's positioning half. CYCLE-013.
//
// The lab has exhausted OHLCV + funding (F-05..F-09, F-12) and the one free flow field (F-15: taker
// imbalance is independent but directionless). THEORY E-C ranked POSITIONING as the highest-prior
// remaining mechanism: it is *who is levered and where*, mechanically distinct from order flow, and
// Binance publishes it (5-min) in the free `futures/um` daily metrics bucket. This experiment:
//
//   A. probes the OI *change* as a signal - the information coefficient against the next 8h return and
//      the next funding rate, per symbol and pooled.
//   A2. builds causal, dollar-neutral cross-sectional books on the positioning fields - the OI change
//      and the toptrader long/short ratio - and audits each with e16 (gross/cost/break-even/net).
//      RESULT: Δlog(OI) is directionless (F-28), but the TOPTRADER RATIO, used cross-sectionally, is a
//      modest contrarian signal - fade the crowded side (F-29). That is the opposite of the naive
//      level-IC read, and is F-03's lesson (demeaning is the power lever) applied to a new field.
//   B. prices the FLAT carry book's size from positioning: the flat book is short perp, held for
//      months, so its real limit is not impact (F-26) but what fraction of open interest it *is*.
//      F-26 could not measure this; OI can.
//
// TWO HONESTY GUARDS, both learned the hard way this cycle:
//   1. INDEX CONVENTION (F-11 class look-ahead). buildXsSeries pushes `bookTimes[m] = legs.times[m+1]`,
//      so book period `i` ends at `times[i]` and its return is `legs.spotRet[i+1]` - CONTEMPORANEOUS with
//      the signal at `i`. The NEXT period's return is `legs.spotRet[i+2]`. Using [i+1] gave IC 0.60 /
//      Sharpe 17 (OI notional embeds its own window's price move). `NEXT = 2`; the artefact carries the
//      contemporaneous IC beside the next-period one precisely to expose this.
//   2. MISSING DATA. The fields start at different dates (BTCUSDT OI 2020-09, the other seven 2021-12);
//      before that a symbol's value is null. Treating null as 0 and then demeaning gives the *absent*
//      symbols a large weight (0 - mean) - a silent concentrated bet. The books below MASK absent
//      symbols (weight 0, excluded from the demean) and start at the first book period where every
//      symbol is present.
//
// Coverage: BTCUSDT 2020-09, the other seven 2021-12 (earlier metrics days 404). Part A/A2 run on the
// common window; Part B uses each symbol's full OI history.

import { SYMBOLS, pearsonCorrelation, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { audit } from './e16_cost_capacity.js';

const PERIODS_PER_YEAR = 365 * 3;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const stdev = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const pearson = (xs, ys) => { const p = []; for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) p.push([xs[i], ys[i]]); if (p.length < 8) return { n: p.length, ic: NaN }; const a = p.map((q) => q[0]); const b = p.map((q) => q[1]); return { n: p.length, ic: pearsonCorrelation(a, b) }; };
const sharpe = (a) => { const v = a.filter(Number.isFinite); return v.length > 1 ? mean(v) / stdev(v) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };
// Seeded RNG so the placebo and bootstrap are REPRODUCIBLE (the lab's rule: anything not reproducible
// is not a finding). mulberry32.
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function blockBootstrapSharpe(rets, { block = 30, reps = 200, rand = Math.random } = {}) {
    const out = [];
    for (let s = 0; s < reps; s++) { const r = []; while (r.length < rets.length) { const st = Math.floor(rand() * (rets.length - block)); for (let i = 0; i < block; i++) r.push(rets[st + i]); } out.push(sharpe(r)); }
    out.sort((a, b) => a - b);
    return { p5: out[Math.floor(reps * 0.05)], p50: out[Math.floor(reps * 0.5)], p95: out[Math.floor(reps * 0.95)] };
}

// Causal, dollar-neutral cross-sectional book on a masked signal, with an optional weight policy.
// `sig[j][i]` = the signal for symbol j at book time `times[i]`; absent = null (excluded from the demean,
// never zeroed - L10-r). `policy` is `daily` (the original behaviour) or `{kind:'ewma',lambda,normalize}`.
// Exported (CYCLE-028) so `e37` reuses the exact construction instead of re-implementing it.
export function xsBookImpl(sig, { k, n, times, legs, NEXT = 2 }, { sign = 1, from = 0, policy = { kind: 'daily' } } = {}) {
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
        let w = target;
        if (policy.kind === 'ewma') w = held.map((h, j) => (1 - policy.lambda) * h + policy.lambda * target[j]);
        else if (policy.kind !== 'daily') throw new Error(`unknown policy ${policy.kind}`);
        if (policy.normalize) { const g = w.reduce((a, x) => a + Math.abs(x), 0) || 1; w = w.map((x) => x / g); }
        held = w;
        weightRows.push(w.slice());
        rets.push(w.reduce((a, wj, j) => a + wj * legs.spotRet[i + NEXT][j], 0));
        bookTimes.push(times[i]);
    }
    return { rets, weightRows, bookTimes };
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList;
    const k = names.length;
    const times = s.times; // book-period grid, length n
    const n = times.length;
    const legs = s.legs;
    const oi = await loadOpenInterest();

    // OI (USDT notional) and toptrader ratio aligned to every book-period grid time.
    const fieldBySym = (field) => names.map((nm) => {
        const o = oi[nm];
        if (!o) return null;
        const arr = new Array(n).fill(null);
        for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o[field][idx] : null; }
        return arr;
    });
    const oiValBySym = fieldBySym('oiVal');
    const topLSBySym = fieldBySym('topLS');
    const dlog = (arr, i) => { if (!arr) return null; const a = arr[i]; const b = arr[i - 1]; return (a > 0 && b > 0) ? Math.log(a / b) : null; };
    const dOIBySym = names.map((_, j) => times.map((_, i) => dlog(oiValBySym[j], i)));

    // ---- A. information coefficients (target = NEXT period's return / funding) ----
    const NEXT = 2; // see guard 1 above
    const icBySym = {};
    for (let j = 0; j < k; j++) {
        const x = []; const yr = []; const yf = [];
        for (let i = 1; i < n - 1; i++) { x.push(dlog(oiValBySym[j], i)); yr.push(legs.spotRet[i + NEXT][j]); yf.push(legs.fRate[i + NEXT][j]); }
        const icRet = pearson(x, yr);
        const icFund = pearson(x, yf);
        const xt = []; const yrt = [];
        for (let i = 1; i < n - 1; i++) { xt.push(topLSBySym[j] ? topLSBySym[j][i] : null); yrt.push(legs.spotRet[i + NEXT][j]); }
        icBySym[names[j]] = { n: icRet.n, ic_dLogOI_nextRet: icRet.ic, ic_dLogOI_nextFunding: icFund.ic, ic_topLS_nextRet: pearson(xt, yrt).ic };
    }
    const px = []; const pr = []; const pf = []; const p0 = [];
    for (let i = 1; i < n - 1; i++) for (let j = 0; j < k; j++) {
        const d = dlog(oiValBySym[j], i);
        if (Number.isFinite(d)) { px.push(d); pr.push(legs.spotRet[i + NEXT][j]); pf.push(legs.fRate[i + NEXT][j]); p0.push(legs.spotRet[i + 1][j]); }
    }
    const pooled = { n: px.length, ic_dLogOI_nextRet: pearson(px, pr).ic, ic_dLogOI_nextFunding: pearson(px, pf).ic, ic_dLogOI_contemporaneousRet: pearson(px, p0).ic };

    // ---- A2. causal dollar-neutral cross-sectional books (missing symbols MASKED, not zeroed) ----
    const firstAll = (sig) => { for (let i = 1; i < n - 1; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(sig[j][i])) all = false; if (all) return i; } return -1; };
    // The book builder lives at module scope (exported in CYCLE-028) so `e37` can reuse it with a weight
    // policy; the thin wrapper keeps this file's call sites unchanged and its artefact byte-identical.
    const xsBook = (sig, opts) => xsBookImpl(sig, { k, n, times, legs, NEXT }, opts);
    const firstOI = firstAll(dOIBySym);
    const firstTop = firstAll(topLSBySym);

    const books = {};
    const bookStats = (tag, b) => {
        const a = audit(tag, b.rets, b.weightRows);
        const q = []; const sz = Math.floor(b.rets.length / 4);
        for (let i = 0; i < 4; i++) q.push(+sharpe(b.rets.slice(i * sz, (i + 1) * sz)).toFixed(2));
        const h = Math.floor(b.rets.length / 2);
        return {
            grossSharpe: a.gross.sharpe, annualized: a.gross.annualized, maxDrawdown: a.gross.maxDrawdown,
            turnoverAnnual: a.turnover.annualized, breakEvenBps: a.breakEvenBps,
            net: Object.fromEntries(Object.entries(a.net).map(([c, x]) => [c, { sharpe: x.sharpe }])),
            periods: b.rets.length, firstBookTime: new Date(b.bookTimes[0]).toISOString(),
            halves: [+sharpe(b.rets.slice(0, h)).toFixed(3), +sharpe(b.rets.slice(h)).toFixed(3)],
            quartileSharpes: q,
        };
    };
    for (const [tag, arr, from] of [['dLogOI', dOIBySym, firstOI], ['topLS', topLSBySym, firstTop]]) {
        for (const sign of [1, -1]) books[`${tag}_${sign > 0 ? 'pos' : 'neg'}`] = bookStats(`${tag}_${sign > 0 ? 'pos' : 'neg'}`, xsBook(arr, { sign, from }));
    }

    // F-29 robustness: the winner (topLS fade) gets a bootstrap, a placebo distribution and per-year
    // Sharpe. It is a MODEST edge, so it must show up in most sub-samples, not on average.
    const bTop = xsBook(topLSBySym, { sign: -1, from: firstTop });
    const perYear = {}; { const by = {}; for (let i = 0; i < bTop.rets.length; i++) { const y = new Date(bTop.bookTimes[i]).getUTCFullYear(); (by[y] = by[y] || []).push(bTop.rets[i]); } for (const [y, a] of Object.entries(by)) perYear[y] = +sharpe(a).toFixed(2); }
    const pl = []; const randPlacebo = mulberry32(20261301); const placebBook = () => { const sig = names.map(() => times.map((_, i) => { const p = Math.floor(randPlacebo() * k); return topLSBySym[p][i]; })); return sharpe(xsBook(sig, { sign: -1, from: firstTop }).rets); };
    for (let s2 = 0; s2 < 40; s2++) pl.push(placebBook());
    const topLSRobustness = {
        perYear, blockBootstrap: blockBootstrapSharpe(bTop.rets, { rand: mulberry32(20261302) }),
        placebo: { mean: +mean(pl).toFixed(3), sd: +stdev(pl).toFixed(3), z: +((sharpe(bTop.rets) - mean(pl)) / stdev(pl)).toFixed(2) },
        note: 'topLS (position-weighted toptrader long/short ratio) cross-sectional FADE. Positive in 4/4 quartiles and 5/6 years, bootstrap p5 > 0, z vs a cross-sectional label-shuffle ~2.1 (seeded, reproducible), uncorrelated with the funding-rank carry book.',
    };

    // ---- B. the flat book's size limit from open interest ----
    const oiStats = {};
    for (let j = 0; j < k; j++) {
        const vv = oiValBySym[j] ? oiValBySym[j].filter((x) => x > 0) : [];
        oiStats[names[j]] = { periods: vv.length, meanOI_USD: mean(vv), minOI_USD: vv.length ? Math.min(...vv) : null, maxOI_USD: vv.length ? Math.max(...vv) : null };
    }
    const oiMean = names.map((nm) => oiStats[nm].meanOI_USD);
    const oiMin = names.map((nm) => oiStats[nm].minOI_USD);
    const flatPositionCapacity = {};
    for (const f of [0.01, 0.05, 0.10]) {
        flatPositionCapacity[`at_${f * 100}pct_of_minOI`] = f * Math.min(...oiMin) * k;
        flatPositionCapacity[`at_${f * 100}pct_of_meanOI`] = f * Math.min(...oiMean) * k;
    }
    const xs = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: 0.1, normalize: true } });
    const meanAbsW = names.map((_, j) => mean(xs.weightRows.map((w) => Math.abs(w[j]))));
    const xsPositionCapacity = {};
    for (const f of [0.01, 0.05, 0.10]) {
        let G = Infinity; let binding = 0;
        for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && oiMean[j] / meanAbsW[j] < oiMean[binding] / (meanAbsW[binding] || 1)) binding = j;
        for (let j = 0; j < k; j++) if (meanAbsW[j] > 0) G = Math.min(G, (f * oiMean[j]) / meanAbsW[j]);
        xsPositionCapacity[`at_${f * 100}pct_of_meanOI`] = { USD: G, bindingSymbol: names[binding] };
    }

    return {
        config: {
            symbols: k, symbolList: names, periods: n, years: s.config.years,
            oiCoverage: Object.fromEntries(names.map((nm) => [nm, oiStats[nm].periods])),
            signalWindowStart: new Date(times[Math.max(firstOI, firstTop)]).toISOString(),
            note: 'OI + toptrader positioning from data/open_interest_8h.json (5-min metrics aggregated to the 8h grid). Signal books run on the common window (missing symbols masked); Part B uses each symbol\'s own OI history.',
        },
        infoCoef: { pooled, bySymbol: icBySym },
        signalBooks: books,
        topLSRobustness,
        positioningCapacity: {
            note: 'G = notional at which the holding is f of mean (or min) open interest; the flat book holds G/k per symbol, the dispersion book mean|w_j|*G. Compare with the impact capacity (F-26/F-27).',
            oiStats, flatBook: flatPositionCapacity, dispersionBook: xsPositionCapacity,
            dispersionMeanAbsWeight: Object.fromEntries(names.map((nm, j) => [nm, meanAbsW[j]])),
        },
    };
}
