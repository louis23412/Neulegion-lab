// E11 - volatility predictability and risk sizing. L09.
//
// Two questions, in order:
//   A. Is realised volatility forecastable OUT OF SAMPLE on this data better than a
//      naive trailing baseline? (HAR vs EWMA vs trailing, fit first half / scored
//      second half - the F-09 discipline.)
//   B. Does causal vol-target sizing improve a *real* sleeve's risk-adjusted return
//      (the honest carry book) without manufacturing return? Sizing is not alpha:
//      the control shows a random series' Sharpe is unchanged by scaling.
//
// The carry book is loaded from `e3_carry.js#loadCarryBook` so there is exactly one
// definition of the sleeve.

import { buildPanel, SYMBOLS, stats, serialDesignEffect, robustDesignEffect } from '../lib/lab.js';
import { trailingVol, ewmaVol, harComponents, volTargetLeverage, olsFit } from '../prototypes/vol.js';
import { loadCarryBook } from './e3_carry.js';

const PERIODS_1H = 252;
const PERIODS_8H = 365 * 3;

function statsOf(rets, periodsPerYear) {
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

const qlike = (fv, rv) => (fv > 0 ? Math.log(fv * fv) + (rv * rv) / (fv * fv) : NaN);
const meanOf = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };

export async function run({ tf = '1h' } = {}) {
    const out = { config: { tf }, forecast: {}, sizing: {} };

    // ---- A. vol forecast skill, per symbol, fit first half / score second half ----
    // HAR is the STANDARD log-RV form (Corsi 2009): y = ln(rv^2_{t+1}),
    // features = ln of the trailing daily/weekly/monthly mean squared returns. A
    // linear fit on |r| (an earlier draft) is a strawman with a much noisier target.
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const perSymbol = {};
    const pooledRows = { baseline: [], ewma: [], har: [], harFixed: [] };
    const EPS = 1e-12;
    for (const s of panel) {
        const r = s.returns;
        const rows = [];
        for (let t = 720; t + 1 < r.length; t++) {
            const hc = harComponents(r, t);
            const y2 = r[t + 1] * r[t + 1];
            if (!(y2 >= 0) || !Number.isFinite(hc.d) || !Number.isFinite(hc.w) || !Number.isFinite(hc.m) || !(hc.d > 0) || !(hc.w > 0) || !(hc.m > 0)) continue;
            rows.push({ t, x: [1, Math.log(hc.d * hc.d + EPS), Math.log(hc.w * hc.w + EPS), Math.log(hc.m * hc.m + EPS)], y: Math.log(y2 + EPS), yAbs: Math.abs(r[t + 1]), base: hc.d, ewma: ewmaVol(r, t) });
        }
        // Fit in log-variance space, but forecast the ARITHMETIC variance: the model
        // is E[ln r^2] = x.b, so the unbiased level is exp(x.b + s2/2) (lognormal
        // mean; s2 = residual variance of the log-fit). Without the s2/2 term the
        // back-transform targets the geometric mean and under-forecasts ~2x, which
        // would make the HAR look far worse than it is.
        const fitOn = (idx) => {
            const X = idx.map((i) => rows[i].x);
            const Y = idx.map((i) => rows[i].y);
            const b = olsFit(X, Y);
            if (!b) return null;
            let s2 = 0;
            for (let k = 0; k < idx.length; k++) { const e = Y[k] - (b[0] + b[1] * X[k][1] + b[2] * X[k][2] + b[3] * X[k][3]); s2 += e * e; }
            return { b, s2: s2 / Math.max(1, idx.length) };
        };
        const predF = (m, q) => {
            const lv = m.b[0] + m.b[1] * q.x[1] + m.b[2] * q.x[2] + m.b[3] * q.x[3];
            return Math.sqrt(Math.exp(Math.max(-40, Math.min(10, lv + m.s2 / 2))));
        };
        const half = Math.floor(rows.length / 2);
        const mFixed = fitOn([...Array(half).keys()]);
        // Rolling-refit HAR (adaptive): refit on all data strictly before the block,
        // every REFIT bars. A single first-half fit is not comparable to an adaptive
        // forecaster across a vol-regime shift, so both are reported.
        const REFIT = 720;
        const harRolling = new Array(rows.length).fill(NaN);
        let mRoll = null;
        for (let i = 0; i < rows.length; i++) {
            if (i % REFIT === 0 && i >= 720) mRoll = fitOn([...Array(i).keys()]);
            if (mRoll) harRolling[i] = predF(mRoll, rows[i]);
        }
        if (!mFixed) continue;
        const oosIdx = [];
        for (let i = half; i < rows.length; i++) if (Number.isFinite(rows[i].ewma) && rows[i].base > 0) oosIdx.push(i);
        const ql = { baseline: [], ewma: [], har: [], harFixed: [] };
        for (const i of oosIdx) {
            const q = rows[i];
            ql.baseline.push(qlike(q.base, q.yAbs));
            ql.ewma.push(qlike(q.ewma, q.yAbs));
            if (Number.isFinite(harRolling[i])) ql.har.push(qlike(harRolling[i], q.yAbs));
            ql.harFixed.push(qlike(predF(mFixed, q), q.yAbs));
        }
        const m = (a) => meanOf(a);
        perSymbol[s.symbol || s.label] = { oos: ql.har.length, qlikeBaseline: m(ql.baseline), qlikeEwma: m(ql.ewma), qlikeHar: m(ql.har), qlikeHarFixed: m(ql.harFixed), harBeatsBaseline: m(ql.har) < m(ql.baseline), harFixedBeatsBaseline: m(ql.harFixed) < m(ql.baseline), ewmaBeatsBaseline: m(ql.ewma) < m(ql.baseline) };
        pooledRows.baseline.push(...ql.baseline);
        pooledRows.ewma.push(...ql.ewma);
        pooledRows.har.push(...ql.har);
        pooledRows.harFixed.push(...ql.harFixed);
    }
    const pm = (a) => meanOf(a);
    out.forecast = {
        perSymbol,
        pooled: { n: pooledRows.har.length, qlikeBaseline: pm(pooledRows.baseline), qlikeEwma: pm(pooledRows.ewma), qlikeHar: pm(pooledRows.har), qlikeHarFixed: pm(pooledRows.harFixed) },
    };

    // ---- B. sizing ----
    const book = await loadCarryBook(SYMBOLS);
    out.sizing = sizingFromBook(book);
    return out;
}

// The sizing block, extracted so that a DIFFERENT perp source (e.g. the traded close, E15) can be
// scored through the identical code path. Returns the shape assigned to `out.sizing`.
export function sizingFromBook({ perSym, pooled }, { periodsPerYear = PERIODS_8H } = {}) {
    const sizing = {};
    // Causal EWMA vol of the carry series, and a vol-target leverage.
    const vols = new Array(pooled.length).fill(NaN);
    for (let t = 0; t < pooled.length; t++) vols[t] = ewmaVol(pooled, t - 1, { lambda: 0.94, minObs: 30 });
    const valid = vols.filter((v) => Number.isFinite(v) && v > 0);
    const target = valid.length ? stats(valid).mean : NaN;
    const sized = pooled.map((r, t) => volTargetLeverage(vols[t], target, { cap: 4 }) * r);
    const levs = pooled.map((r, t) => volTargetLeverage(vols[t], target, { cap: 4 }));
    const sizedCap2 = pooled.map((r, t) => volTargetLeverage(vols[t], target, { cap: 2 }) * r);
    const sortedLev = levs.slice().sort((a, b) => a - b);
    sizing.carryPooled = {
        unsized: statsOf(pooled, periodsPerYear),
        sized: statsOf(sized, periodsPerYear),
        sizedCap2: statsOf(sizedCap2, periodsPerYear),
        meanLeverage: stats(levs).mean,
        leverageMedian: sortedLev[Math.floor(sortedLev.length / 2)],
        leverageMax: sortedLev[sortedLev.length - 1],
        unsizedDesignEffect: serialDesignEffect(pooled, 90).designEffect,
        sizedDesignEffect: serialDesignEffect(sized, 90).designEffect,
        unsizedDesignEffectRobust: robustDesignEffect(pooled),
        sizedDesignEffectRobust: robustDesignEffect(sized),
        target,
    };
    sizing.carryPerSymbol = {};
    for (const p of perSym) sizing.carryPerSymbol[p.symbol] = { unsized: statsOf(p.rets, periodsPerYear) };

    // Inverse-vol across symbols vs equal weight (causal EWMA per symbol).
    const n = Math.min(...perSym.map((p) => p.rets.length));
    const volBySym = perSym.map((p) => { const a = new Array(p.rets.length).fill(NaN); for (let t = 0; t < p.rets.length; t++) a[t] = ewmaVol(p.rets, t - 1, { lambda: 0.94, minObs: 30 }); return a; });
    const eqW = [];
    const ivW = [];
    for (let i = 0; i < n; i++) {
        let se = 0, si = 0, sw = 0;
        for (let j = 0; j < perSym.length; j++) {
            const kk = perSym[j].rets.length - n + i;
            const r = perSym[j].rets[kk];
            const v = volBySym[j][kk];
            if (!Number.isFinite(r)) continue;
            se += r;
            if (Number.isFinite(v) && v > 0) { si += r / v; sw += 1 / v; }
        }
        eqW.push(se / perSym.length);
        ivW.push(sw > 0 ? si / sw : 0);
    }
    sizing.carryCrossSection = { equalWeight: statsOf(eqW, periodsPerYear), inverseVol: statsOf(ivW, periodsPerYear) };

    // Control: sizing a seeded random ±1 series must not create a Sharpe.
    const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const rnd = mulberry32(999);
    const randPos = pooled.map(() => (rnd() < 0.5 ? -1 : 1));
    const randSized = randPos.map((p, t) => p * volTargetLeverage(vols[t], target, { cap: 4 }));
    sizing.controlRandom = { unsized: statsOf(pooled.map((r, t) => randPos[t] * r), periodsPerYear), sized: statsOf(pooled.map((r, t) => randSized[t] * r), periodsPerYear) };
    return sizing;
}
