// E54 - THE DEPENDENCE / DSR BACKBONE, AUDITED AGAINST CLOSED FORMS. CYCLE-045 (L10-f, L10-i).
//
// Every pooled verdict the lab reports rides on the repo's `walkforward#dependenceSummary`: it estimates
// the design effect of the pooled Sharpe with a delete-one-cluster jackknife over fold-window clusters
// (`analysis/dependence.js`), feeds `effectiveBars = n/designEffect` into `backtest#backtestMetrics`
// (`psrAdjusted`/`dsrAdjusted`), and gates on `adjustmentNeeded = designEffect > 1`. The lab has only ever
// *used* it (F-02, F-14, F-18, F-20, F-31, F-43, F-47, L10-y) — never checked that it means what it says.
// CYCLE-045 does that with a **synthetic ground truth** (the technique F-61 introduced), and with the
// discipline F-57 taught: a single realisation of a noisy statistic is not a measurement, so every mean
// below is over a seeded ensemble.
//
// The closed forms:
//   * K identical streams      -> the pooled Sharpe's variance is one stream's, but the i.i.d. readout
//     counts n = K*T bars, so the design effect must be **K**.
//   * K equicorrelated streams (pairwise return correlation rho) -> the survey-sampling design effect
//     **1 + (K-1)*rho** (Kish 1965) — what F-02 measures on the real basket (4.92 at rho ~ 0.56).
//   * a negatively correlated pair -> **1 + rho** (below 1: hedging streams).
//   * independent streams / a single i.i.d. series -> **1**.
//
// PRE-REGISTERED READ. PASSES if every ensemble-mean design effect matches its closed form, AND the two
// limits the audit exists to measure are present: (i) the estimator's own spread at the repo's fold counts,
// and (ii) `effectiveBars` is unbounded on a diversifying panel (L10-f) while the DSR path declines to
// adjust (L10-i). A failure means one of those claims is wrong and F-62 must be revised.

import { dependenceSummary } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';
import { backtestMetrics } from '../../NeuLegion-master/NeuLegion-master/src/analysis/backtest.js';
import { serialDesignEffect } from '../lib/lab.js';

const P = 252;            // the repo's default periodsPerYear
const K = 8;              // the shipped basket's stream count

// ---- deterministic standard normals (LCG + Box-Muller), no crypto, no Math.random ----------------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { let u = 0; let v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function iid(n, seed) { const r = rng(seed); const x = []; for (let i = 0; i < n; i++) x.push(0.01 * gauss(r)); return x; }

const r2 = (x, d = 3) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a) => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
function quantiles(a) { const v = [...a].sort((x, y) => x - y); return { p05: v[Math.floor(0.05 * v.length)], p50: v[Math.floor(0.5 * v.length)], p95: v[Math.min(v.length - 1, Math.floor(0.95 * v.length))] }; }

// Equicorrelated streams via the one-factor model: x_k = sqrt(rho)*g + sqrt(1-rho)*e_k (rho >= 0).
function equiPanel(k, n, rho, seed) {
    const r = rng(seed); const out = []; for (let j = 0; j < k; j++) out.push([]);
    for (let i = 0; i < n; i++) {
        const g = gauss(r);
        for (let j = 0; j < k; j++) out[j].push(0.01 * (Math.sqrt(rho) * g + Math.sqrt(1 - rho) * gauss(r)));
    }
    return out;
}
// A pair with correlation rho (works for negative rho): b = rho*a + sqrt(1-rho^2)*e.
function negPair(n, rho, seed) {
    const r = rng(seed); const a = []; const b = [];
    for (let i = 0; i < n; i++) { const x = 0.01 * gauss(r); a.push(x); b.push(rho * x + Math.sqrt(1 - rho * rho) * 0.01 * gauss(r)); }
    return [a, b];
}
const de = (panel, fold) => dependenceSummary({ streamReturns: panel, foldLength: fold, periodsPerYear: P }).designEffect;
const ensemble = (trials, fn) => { const v = []; for (let t = 0; t < trials; t++) v.push(fn(t)); return v; };

export async function run() {
    // ---------- A. closed-form design effects (ensemble means) ----------
    const equiRows = [];
    for (const rho of [0, 0.25, 0.5, 0.75, 0.95]) {
        const vals = ensemble(25, (t) => de(equiPanel(K, 3000, rho, 7000 + t * 17), 60));
        const closed = 1 + (K - 1) * rho;
        const se = sd(vals) / Math.sqrt(vals.length);      // standard error of the ensemble mean
        equiRows.push({ rho, meanDE: r2(mean(vals)), sdDE: r2(sd(vals)), se: r2(se), tol: r2(Math.max(0.2, 2.5 * se)), closedForm: r2(closed, 2), gap: r2(mean(vals) - closed) });
    }
    const identical = [];
    for (const k of [2, 4, 8]) {
        for (const fold of [40, 100]) {
            const vals = ensemble(25, (t) => { const base = iid(2400, 400 + t * 31 + k); return de(Array.from({ length: k }, () => base.slice()), fold); });
            const se = sd(vals) / Math.sqrt(vals.length);
            identical.push({ K: k, fold, meanDE: r2(mean(vals)), sdDE: r2(sd(vals)), se: r2(se), tol: r2(Math.max(0.2, 2.5 * se)), closedForm: k, gap: r2(mean(vals) - k) });
        }
    }
    const negative = [];
    for (const rho of [-0.2, -0.5, -0.8]) {
        const vals = ensemble(25, (t) => de(negPair(1500, rho, 5000 + t * 7), 50));
        const closed = 1 + rho;
        const se = sd(vals) / Math.sqrt(vals.length);
        negative.push({ rho, meanDE: r2(mean(vals)), sdDE: r2(sd(vals)), se: r2(se), tol: r2(Math.max(0.15, 2.5 * se)), closedForm: r2(closed, 2), gap: r2(mean(vals) - closed) });
    }
    // "no detectable bias": each ensemble mean is within its own 2.5-standard-error band of the closed form.
    const biased = [...equiRows, ...identical, ...negative].filter((row) => Math.abs(row.gap) > row.tol).map((row) => ({ closedForm: row.closedForm, meanDE: row.meanDE, gap: row.gap, tol: row.tol }));
    const maxGap = Math.max(
        ...equiRows.map((x) => Math.abs(x.gap)),
        ...identical.map((x) => Math.abs(x.gap)),
        ...negative.map((x) => Math.abs(x.gap)),
    );

    // ---------- B. the estimator's own noise at realistic fold counts ----------
    function spread(C, trials, nPer) {
        const vals = ensemble(trials, (t) => {
            const panel = []; for (let k = 0; k < K; k++) panel.push(iid(nPer, 31000 + t * 37 + k));
            return de(panel, Math.round(nPer / C));
        });
        const q = quantiles(vals);
        return { C, trials, meanDE: r2(mean(vals)), sdDE: r2(sd(vals)), p05: r2(q.p05), p50: r2(q.p50), p95: r2(q.p95), band90: r2(q.p95 - q.p05) };
    }
    const noise36 = spread(36, 120, 3600);
    const noise288 = spread(288, 40, 5760);

    // the lab's single-series mirror on i.i.d. data (its mean must also be ~1)
    const serial = [];
    for (const fold of [50, 100, 250]) {
        const vals = ensemble(25, (t) => serialDesignEffect(iid(6000, 900 + t * 13), fold).designEffect);
        serial.push({ fold, meanDE: r2(mean(vals)), sdDE: r2(sd(vals)) });
    }

    // ---------- C. L10-f / L10-i: the bounds ----------
    // (i) the ensemble mean of a diversifying pair is below 1 (hedging streams buy effective bars);
    //     a specific realisation shows effectiveBars > rawBars.
    const negExceed = ensemble(25, (t) => {
        const panel = negPair(1200, -0.5, 6000 + t * 11);
        const d = dependenceSummary({ streamReturns: panel, foldLength: 50, periodsPerYear: P });
        return { DE: d.designEffect, eff: d.effectiveBars, raw: panel.length * panel[0].length };
    });
    const diversifying = {
        meanDE: r2(mean(negExceed.map((x) => x.DE))),
        rawBars: negExceed[0].raw,
        exceedFraction: r2(negExceed.filter((x) => x.eff > x.raw).length / negExceed.length, 2),
        maxEffectiveBars: r2(Math.max(...negExceed.map((x) => x.eff)), 1),
    };
    // (ii) a perfectly hedged pair: the pooled Sharpe is 0, the jackknife SE ~0, and DE = (jk.se/seIid)^2 -> 0.
    // DE is a SQUARED ratio, so it is never negative: the `designEffect > 0` guard passes at DE ~ 1e-32 and
    // `effectiveBars = n/DE` explodes. The code's own comment anticipates DE < 1 ("can EXCEED the bar
    // count") — it does not anticipate 1e34.
    const base = iid(800, 4242);
    const hedged = [base.slice(), base.map((x) => -x)];
    const dh = dependenceSummary({ streamReturns: hedged, foldLength: 50, periodsPerYear: P });
    const hedgedExact = { designEffect: dh.designEffect, effectiveBars: dh.effectiveBars, rawBars: hedged[0].length * 2, adjustmentNeeded: dh.adjustmentNeeded };

    // (iii) does the DSR path contain it? `backtestMetrics` requires 2 <= effectiveBars < n.
    const pooled = hedged.flat();
    const signals = pooled.map((_, i) => (i % 2 ? 1 : -1));
    const bmAdj = backtestMetrics({ returns: pooled, signals, periodsPerYear: P, trials: 1, effectiveBars: hedgedExact.effectiveBars });
    const dsrPath = { acceptsEffectiveBars: bmAdj.effectiveBars != null, effectiveBarsUsed: bmAdj.effectiveBars, dsrAdjusted: bmAdj.dsrAdjusted, rawBars: bmAdj.bars, note: 'backtestMetrics requires 2 <= effectiveBars < n, so an exploded n/DE is declined (L10-i)' };

    // ---------- guards ----------
    const inBand = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
    const checks = {
        // every ensemble mean is within its own 2.5-SE band of its closed form (no detectable bias)
        noDetectableBias: biased.length === 0,
        equicorrelationMatches: equiRows.every((row) => Math.abs(row.gap) <= row.tol),
        identicalMatchesK: identical.every((row) => Math.abs(row.gap) <= row.tol),
        negativeMatchesForm: negative.every((row) => Math.abs(row.gap) <= row.tol),
        noiseCentred: inBand(noise36.meanDE, 0.92, 1.08) && inBand(noise288.meanDE, 0.92, 1.08),
        labMirrorCentred: serial.every((x) => inBand(x.meanDE, 0.92, 1.08)),
        noiseBandShrinks: noise36.band90 > noise288.band90,
        noiseBandBounded: inBand(noise36.sdDE, 0.15, 0.45) && inBand(noise288.sdDE, 0.03, 0.20),
        diversifyingBelowOne: diversifying.meanDE < 1 && diversifying.exceedFraction > 0.5,
        hedgedExplodes: hedgedExact.designEffect < 1e-9 && hedgedExact.effectiveBars > 1e20 && hedgedExact.adjustmentNeeded === false,
        dsrDeclinesToAdjust: dsrPath.acceptsEffectiveBars === false && dsrPath.dsrAdjusted === null,
    };
    const validationPass = Object.values(checks).every((x) => x === true);

    const verdict = {
        note: 'L10-f/L10-i: the dependence estimator is UNBIASED (ensemble means match 1+(K-1)*rho, K, 1+rho and 1 to within 2.5 SE; no detectable bias) but carries ~±25% ensemble noise at C=36 folds, and `effectiveBars = n/DE` is UNBOUNDED on a hedged panel (DE is a squared ratio, so the `> 0` guard passes at DE~1e-32); the DSR path declines to adjust.',
        maxClosedFormGap: maxGap,
        biasedRows: biased,
        checks,
        validationPass,
    };
    return {
        config: { K, periodsPerYear: P, equiTrials: 25, identicalTrials: 25, negativeTrials: 25, noise36Trials: noise36.trials, noise288Trials: noise288.trials },
        closedForm: { equicorrelation: equiRows, identicalStreams: identical, negativePairs: negative, maxGap, biased },
        noise: { c36: noise36, c288: noise288, labSerialIid: serial },
        bounds: { diversifying, hedgedExact, dsrPath },
        validation: checks,
        verdict,
    };
}
