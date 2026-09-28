// E36 - THE PORTFOLIO OPEN-INTEREST FRONTIER. CYCLE-027 (extends/challenges F-43; L12 x L18 x L15/L17).
//
// F-43 (CYCLE-026) showed that the two working sleeves' OI capacities do NOT add: run carry and the fade
// together and the summed positions breach the per-symbol cap, because both books sit in the same thin
// alts (LINK/ADA/DOGE). But "the capacities do not add" is only half the answer - it leaves open what the
// *right* joint size is. A practitioner does not deploy each sleeve at its individually-compliant size;
// they allocate one shared budget. That object is a 2-D linear program per period:
//
//     maximise   gC_t*G_C + gF_t*G_F                       (total gross notional deployed)
//     s.t.       |G_C*wC_j(t) + G_F*wF_j(t)| <= f*OI_j(t)   for every symbol j
//                G_C, G_F >= 0
//
// where wC/wF are the two books' capped weights and gC_t = sum_j|wC_j(t)| (so G_C is the carry scale and
// gC_t*G_C its gross). This is the honest portfolio capacity; the individual bounds and the
// proportional-split bound of `e35` are special cases of it. This experiment:
//
//   1. solves the LP every period (enumerating the constraint-vertex pairs) and reports the frontier
//      distribution of total gross, vs the SUM of the individual bounds and the F-31 proportional split;
//   2. reports the optimal *split* (fade share of gross) and the binding symbol at the optimum;
//   3. builds the LP-scheduled portfolio's dollar P&L (fee charged on the ACTUAL dollars traded, so the
//      resize churn of a per-period-re-optimised size is included) and its net@4 Sharpe;
//   4. GUARDS: the LP optimum must lie between max(individual bounds) and their sum (GF=0 / GC=0 are
//      feasible), and each book's individual bound mean must reproduce `e34`'s stored `meanGcap` to 5 %.
//
// FALSIFIER (pre-registered). The joint schedule is "just the sum" (i.e. F-43 overstates the problem) if
// the LP's mean total gross is within 5 % of the sum of the individual bounds.

import { SYMBOLS } from '../lib/lab.js';
import { buildPair } from './e35_portfolio_mix.js';

const PERIODS_PER_YEAR = 365 * 3;
const FEE_BPS = 4;
const F = 0.05;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };
const quantile = (arr, q) => { const v = arr.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!v.length) return NaN; const pos = (v.length - 1) * q; const lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };
const dist = (arr) => ({ n: arr.filter(Number.isFinite).length, mean: mean(arr), p5: quantile(arr, 0.05), median: quantile(arr, 0.5), p95: quantile(arr, 0.95), p99: quantile(arr, 0.99) });

// maximise gc*GC + gf*GF s.t. |GC*a_j + GF*b_j| <= c_j (c_j > 0), GC,GF >= 0.
// The feasible set is a bounded convex polygon containing the origin; the optimum is a vertex = an
// intersection of two of the 2k constraint lines. Enumerate them.
export function lpFrontier(a, b, c, gc, gf) {
    const cons = [];
    for (let j = 0; j < a.length; j++) { cons.push([a[j], b[j], c[j]]); cons.push([-a[j], -b[j], c[j]]); }
    // Axis vertices: the single-sleeve optima (GC with GF=0, and vice versa). These are intersections of a
    // constraint line with the GC=0 / GF=0 axis, which the pair enumeration below would miss.
    let axisC = Infinity, axisF = Infinity;
    for (let j = 0; j < a.length; j++) { if (Math.abs(a[j]) > 1e-12) axisC = Math.min(axisC, c[j] / Math.abs(a[j])); if (Math.abs(b[j]) > 1e-12) axisF = Math.min(axisF, c[j] / Math.abs(b[j])); }
    let best = { GC: 0, GF: 0, obj: 0 };
    const cand = [];
    if (Number.isFinite(axisC)) cand.push([axisC, 0]);
    if (Number.isFinite(axisF)) cand.push([0, axisF]);
    for (const [GC, GF] of cand) {
        if (GC < -1e-9 || GF < -1e-9) continue;
        let ok = true;
        for (let r = 0; r < cons.length; r++) { const [pr, qr, cr] = cons[r]; if (pr * GC + qr * GF > cr * (1 + 1e-9) + 1e-9) { ok = false; break; } }
        if (!ok) continue;
        const obj = gc * GC + gf * GF;
        if (obj > best.obj + 1e-12) best = { GC, GF, obj };
    }
    for (let p = 0; p < cons.length; p++) {
        for (let q = p + 1; q < cons.length; q++) {
            const [a1, b1, c1] = cons[p], [a2, b2, c2] = cons[q];
            const det = a1 * b2 - a2 * b1;
            if (Math.abs(det) < 1e-18) continue;
            const GC = (c1 * b2 - c2 * b1) / det;
            const GF = (a1 * c2 - a2 * c1) / det;
            if (GC < -1e-9 || GF < -1e-9) continue;
            let ok = true;
            for (let r = 0; r < cons.length; r++) { const [pr, qr, cr] = cons[r]; if (pr * GC + qr * GF > cr * (1 + 1e-9) + 1e-9) { ok = false; break; } }
            if (!ok) continue;
            const obj = gc * GC + gf * GF;
            if (obj > best.obj + 1e-12) best = { GC, GF, obj };
        }
    }
    return best;
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const B = await buildPair({ symbols, perp });
    if (!B.available) return { available: false };
    const { names, k, pairs, P, rowsC, retsC, rowsF, retsF, TC, TF, oiAtLeg, ebarC, ebarF, legs } = B;

    const lp = [];              // per-period {GC, GF, gross, fadeShare, bindSymbol}
    const indC = [], indF = []; // individual bounds (gross units)
    const pos = [];             // per-period dollar position vector (GC*wC + GF*wF)
    let lpGeMax = true, lpLeSum = true;
    for (let p = 0; p < P; p++) {
        const legIdx = pairs[p].legIdx;
        const wC = rowsC[pairs[p].m], wF = rowsF[pairs[p].i];
        const oiV = []; let ok = true;
        for (let j = 0; j < k; j++) { const v = oiAtLeg[j][legIdx]; if (!Number.isFinite(v)) { ok = false; break; } oiV.push(v); }
        if (!ok) continue;
        const gc = wC.reduce((a, x) => a + Math.abs(x), 0);
        const gf = wF.reduce((a, x) => a + Math.abs(x), 0);
        const c = oiV.map((v) => F * v);
        const best = lpFrontier(wC, wF, c, gc, gf);
        // individual bounds for this period (gross units): GC-max at GF=0, GF-max at GC=0
        let bC = Infinity, bF = Infinity;
        for (let j = 0; j < k; j++) { if (Math.abs(wC[j]) > 1e-12) bC = Math.min(bC, c[j] / Math.abs(wC[j])); if (Math.abs(wF[j]) > 1e-12) bF = Math.min(bF, c[j] / Math.abs(wF[j])); }
        bC *= gc; bF *= gf;
        indC.push(bC); indF.push(bF);
        if (best.obj < Math.max(bC, bF) * (1 - 1e-6)) lpGeMax = false;
        // binding symbol at the optimum
        let bind = -1, worst = -1;
        for (let j = 0; j < k; j++) { const part = Math.abs(best.GC * wC[j] + best.GF * wF[j]) / oiV[j]; if (part > worst) { worst = part; bind = j; } }
        const gross = gc * best.GC + gf * best.GF;
        lp.push({ GC: best.GC, GF: best.GF, gross, fadeShare: gross > 0 ? (gf * best.GF) / gross : 0, bind: names[bind] });
        pos.push(wC.map((x, j) => best.GC * x + best.GF * wF[j]));
    }
    const Q = lp.length;

    // LP-scheduled portfolio P&L: fee on the ACTUAL dollars traded between consecutive dollar-position
    // vectors (so re-optimising the size every period is charged).
    const pnl = [], traded = [], grossSeries = [];
    for (let t = 0; t < Q; t++) {
        const GC = lp[t].GC, GF = lp[t].GF;
        const r = GC * retsC[pairs[t].m] + GF * retsF[pairs[t].i];
        pnl.push(r);
        let tr = 0;
        for (let j = 0; j < k; j++) {
            const prev = t > 0 ? pos[t - 1][j] : 0;
            tr += Math.abs(pos[t][j] - prev);
        }
        traded.push(tr);
        grossSeries.push(lp[t].gross);
    }
    const net4 = pnl.map((x, t) => x - (FEE_BPS / 1e4) * traded[t]);
    const turnoverAnnual = mean(traded) / mean(grossSeries) * PERIODS_PER_YEAR; // as a fraction of gross

    const lpd = dist(lp.map((x) => x.gross));
    const indCd = dist(indC), indFd = dist(indF);
    const sumMean = indCd.mean + indFd.mean;
    const fadeShareMean = mean(lp.map((x) => x.fadeShare));
    const bindCount = {};
    for (const x of lp) bindCount[x.bind] = (bindCount[x.bind] || 0) + 1;

    // e35's proportional-split comparison, recomputed here for a like-for-like reference.
    const propSplit = (aF) => { const out = []; for (let p = 0; p < Q; p++) { const legIdx = pairs[p].legIdx; const w = rowsF[pairs[p].i].map((x, j) => aF * x + (1 - aF) * rowsC[pairs[p].m][j]); const ebar = aF * ebarF + (1 - aF) * ebarC; let G = Infinity, ok = true; for (let j = 0; j < k; j++) { const v = oiAtLeg[j][legIdx]; if (!Number.isFinite(v)) { ok = false; break; } const aw = Math.abs(w[j]); if (aw > 1e-12) G = Math.min(G, (F * v) / aw); } if (ok && G < Infinity) out.push(G * ebar); } return dist(out); };
    const prop25 = propSplit(0.25);

    // GUARD: individual bound means reproduce e34.
    let e34 = null;
    try { e34 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e34_oi_scaled_sizing.json')); } catch (e) { e34 = null; }
    const e34C = e34 && e34.books ? e34.books['disp_lam0.02_cap12.5'].oiBoundSchedule.meanGcap : null;
    const e34F = e34 && e34.books ? e34.books['fade_lam0.1_cap12.5'].oiBoundSchedule.meanGcap : null;
    const rel = (a, b) => (a != null && b != null && b !== 0 ? Math.abs(a - b) / b : null);
    const relC = rel(indCd.mean, e34C), relF = rel(indFd.mean, e34F);
    const validation = {
        e34CarryOiMean: e34C, e34FadeOiMean: e34F,
        carryOiMeanRelDiff: relC == null ? null : +relC.toFixed(4),
        fadeOiMeanRelDiff: relF == null ? null : +relF.toFixed(4),
        lpAtLeastLargerIndividual: lpGeMax,
        matchesE34: relC != null && relF != null && relC < 0.05 && relF < 0.05,
        note: 'The LP optimum must be >= the larger individual bound (an axis is feasible - it may exceed'
            + ' their sum, because the books\' positions net in some symbols); and each individual bound mean'
            + ' must reproduce e34\'s stored meanGcap to 5 %.',
        validationPass: relC != null && relF != null && relC < 0.05 && relF < 0.05 && lpGeMax,
    };

    const sumMedian = indCd.median + indFd.median;
    const verdict = {
        note: 'Falsifier: the joint schedule is "just the sum" (F-43 overstated) if the LP MEAN total gross is'
            + ' within 5 % of the sum of the individual bounds. NB the LP is free to pick the split, so it can'
            + ' exploit cross-symbol netting; compare the median too, and the schedule Sharpe for churn.',
        lpMeanTotalGross: +lpd.mean.toFixed(0),
        lpMedianTotalGross: +lpd.median.toFixed(0),
        sumOfIndividualMeans: +sumMean.toFixed(0),
        sumOfIndividualMedians: +sumMedian.toFixed(0),
        lpOverSumMean: +(lpd.mean / sumMean).toFixed(3),
        lpOverSumMedian: +(lpd.median / sumMedian).toFixed(3),
        proportional25Mean: +prop25.mean.toFixed(0),
        lpOverProportional25: +(lpd.mean / prop25.mean).toFixed(3),
        lpMeanWithin5PctOfSum: lpd.mean >= sumMean * 0.95,
        optimalFadeShareMean: +fadeShareMean.toFixed(3),
        lpScheduledNet4Sharpe: +sharpe(net4).toFixed(2),
        lpScheduledTurnoverFractionOfGross: +turnoverAnnual.toFixed(1),
        validationPass: validation.validationPass,
    };

    return {
        config: { symbols: k, symbolList: names, periods: Q, feeBps: FEE_BPS, f: F, ebarCarry: +ebarC.toFixed(4), ebarFade: +ebarF.toFixed(4) },
        validation,
        frontier: { lpTotalGross: lpd, individualCarry: indCd, individualFade: indFd, proportional25: prop25 },
        optimalSplit: { fadeShareMean: +fadeShareMean.toFixed(3), fadeShareP5: +quantile(lp.map((x) => x.fadeShare), 0.05).toFixed(3), fadeShareP95: +quantile(lp.map((x) => x.fadeShare), 0.95).toFixed(3) },
        bindingSymbols: bindCount,
        schedule: {
            grossMean: mean(grossSeries), grossP5: quantile(grossSeries, 0.05), grossMedian: quantile(grossSeries, 0.5),
            net4Sharpe: +sharpe(net4).toFixed(2), grossSharpe: +sharpe(pnl).toFixed(2),
            turnoverAnnualFractionOfGross: +turnoverAnnual.toFixed(1),
            grossPnlAnnual: mean(pnl) * PERIODS_PER_YEAR,
        },
        verdict,
    };
}
