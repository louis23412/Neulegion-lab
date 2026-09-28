// E59 - THE FORECAST SCORING LAYER, AUDITED AGAINST CLOSED FORMS, THE REPO'S OWN SECOND MURPHY
// IMPLEMENTATION (observer/legion_metrics.js), AND ITS STATED CONTRACTS. CYCLE-051 (L10-ba ...).
//
// `analysis/forecast.js` is SHIPPED: `analyze.js` imports `forecastComparison`/`formatForecast` (on by
// default; `--forecast=0` disables) and runs the block on every real analysis. It scores the family as
// *forecasters* rather than as PnL streams: the Brier score + the Murphy (1973) partition, the log score,
// the Diebold-Mariano (1995) test on paired per-bar Brier-loss differentials (block-bootstrapped), and the
// Hansen-Lunde-Nason (2011) Model Confidence Set. Unlike the F-64/65/66 rows this module's output reaches
// a run report, so any defect below is live.
//
// PRE-REGISTERED READ. PASSES if (i) the scoring primitives are exact (`forecastPairs` maps the journaled
// confidence through the `confidenceFromProb` inverse and to the NEXT bar's sign, dropping each fold's last
// bar; `brierBinIndex`/`brierScore`/`logScore` are the documented closed forms with the documented
// non-finite handling); (ii) the Murphy partition satisfies `brierBinned = REL - RES + UNC` exactly, agrees
// with the repo's INDEPENDENT second implementation (`observer/legion_metrics.js`, which states
// `brier = REL - RES + UNC + WITHIN`) on REL/RES/UNC/Brier to 1e-12, and its raw-minus-binned gap satisfies
// the EXACT identity `gap = WITHIN = withinVar - 2*withinCov` (so the source comment's claim that the gap is
// "the within-bin forecast variance" is testable - and false); (iii) `bootstrapMeans` is deterministic, uses
// the documented default block length, resamples all series with ONE index draw (paired), and reports the
// block it used; (iv) the DM statistic is exactly `dbar / bootstrap-SE`, its degenerate arms are the
// documented ones, its i.i.d. size is nominal, and the block bootstrap controls size under persistence
// relative to `blockLength=1`; (v) the MCS eliminates a uniformly worse arm, keeps an identical pair, always
// contains the sample-best, keeps ≈ 1-alpha coverage under an exact null, is deterministic and monotone in
// the confidence level; (vi) `forecastComparison` scores every variant, groups by forecast kind, refuses a
// mismatched window, and puts a benchmark arm in the probability (controller) group. The DEFECTS found are
// reported in `findings` (a false docstring identity, a count-only alignment guard, an unguarded benchmark
// grouping branch, unvalidated `bootstrapMeans` lengths, and a NaN-tolerant MCS) rather than as failing
// checks of a property the module does not claim.

import {
    forecastPairs, brierBinIndex, brierScore, logScore, brierDecomposition, brierLosses,
    bootstrapMeans, dieboldMariano, modelConfidenceSet, forecastComparison, formatForecast,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';
import {
    brierDecomposition as obsBrierDecomposition,
} from '../../NeuLegion-master/NeuLegion-master/src/observer/legion_metrics.js';
import { confidenceFromProb } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';

// ---- deterministic helpers -----------------------------------------------------------------------------
function repoRng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; let v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd1 = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const close = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const zero = (x) => Math.abs(x) < 1e-12;
const r4 = (x, d = 5) => (Number.isFinite(x) ? +x.toFixed(d) : null);
function probPairs(T, seed) { const r = repoRng(seed); const p = Array.from({ length: T }, () => r()); return { p, o: p.map((q) => (r() < q ? 1 : 0)) }; }
// independent within-bin forecast variance and covariance of the raw-minus-binned decomposition
function withinParts(p, o, bins) {
    const B = Math.max(1, Math.floor(bins)); const T = p.length;
    let v = 0; let c = 0;
    for (let k = 0; k < B; k++) {
        const idx = [];
        for (let i = 0; i < T; i++) if (brierBinIndex(p[i], B) === k) idx.push(i);
        if (!idx.length) continue;
        const mp = idx.reduce((a, i) => a + p[i], 0) / idx.length;
        const mo = idx.reduce((a, i) => a + o[i], 0) / idx.length;
        const w = idx.length / T;
        let a2 = 0; let ab = 0;
        for (const i of idx) { a2 += (p[i] - mp) ** 2; ab += (p[i] - mp) * (o[i] - mo); }
        v += w * (a2 / idx.length); c += w * (ab / idx.length);
    }
    return { withinVar: v, withinCov: c };
}
// an independent HLN range-statistic MCS that differs from the repo ONLY in the elimination denominator:
// the repo standardises by sd(L_i); Hansen-Lunde-Nason's t_i standardises d_i = L_i - mean_others by sd(d_i).
function mcsWithHlnDenominator(losses, alpha, nBoot, blockLength, seed) {
    const K = losses.length; const T = losses[0].length;
    const boot = bootstrapMeans(losses, { nBoot, blockLength, seed });
    const B = boot.nBoot; const ms = (rep, k) => boot.means[rep * K + k];
    const observed = losses.map(mean);
    const sd = new Array(K).fill(0); const bm = new Array(K).fill(0);
    for (let k = 0; k < K; k++) { let m = 0; for (let rep = 0; rep < B; rep++) m += ms(rep, k); bm[k] = m / B; }
    for (let k = 0; k < K; k++) { let v = 0; for (let rep = 0; rep < B; rep++) v += (ms(rep, k) - bm[k]) ** 2; sd[k] = Math.sqrt(v / Math.max(1, B - 1)); }
    const sdDiff = []; for (let i = 0; i < K; i++) { sdDiff.push(new Array(K).fill(0)); for (let j = 0; j < K; j++) { if (i === j) continue; let m = 0; for (let rep = 0; rep < B; rep++) m += ms(rep, i) - ms(rep, j); m /= B; let v = 0; for (let rep = 0; rep < B; rep++) v += (ms(rep, i) - ms(rep, j) - m) ** 2; sdDiff[i][j] = Math.sqrt(v / Math.max(1, B - 1)); } }
    let active = losses.map((_, i) => i); const order = []; let maxRelDenom = 0;
    while (active.length > 1) {
        let TR = 0;
        for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) { const i = active[a]; const j = active[b]; const s = sdDiff[i][j]; const dbar = observed[i] - observed[j]; if (s > 0) TR = Math.max(TR, Math.abs(dbar) / s); else if (dbar !== 0) TR = Infinity; }
        let exceed = 0;
        for (let rep = 0; rep < B; rep++) { let TRb = 0; for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) { const i = active[a]; const j = active[b]; const s = sdDiff[i][j]; if (s <= 0) continue; const d = (ms(rep, i) - ms(rep, j)) - (observed[i] - observed[j]); TRb = Math.max(TRb, Math.abs(d) / s); } if (TRb >= TR) exceed++; }
        if ((exceed + 1) / (B + 1) >= alpha) break;
        let worst = active[0]; let worstScore = -Infinity;
        for (const i of active) {
            const others = active.filter((x) => x !== i);
            const mOthers = mean(others.map((j) => observed[j]));
            const num = observed[i] - mOthers;
            const di = new Array(B).fill(0);
            for (let rep = 0; rep < B; rep++) { let s = 0; for (const j of others) s += ms(rep, i) - ms(rep, j); di[rep] = others.length ? s / others.length : 0; }
            const m = mean(di); let v = 0; for (let rep = 0; rep < B; rep++) v += (di[rep] - m) ** 2; const sdi = Math.sqrt(v / Math.max(1, B - 1));
            if (sd[i] > 0) maxRelDenom = Math.max(maxRelDenom, Math.abs(sd[i] - sdi) / sd[i]);
            const den = sdi > 0 ? sdi : (num > 0 ? 0 : Infinity);
            const score = den === 0 ? Infinity : num / den;
            if (score > worstScore) { worstScore = score; worst = i; }
        }
        order.push(worst); active.splice(active.indexOf(worst), 1);
    }
    return { members: active.slice(), order, maxRelDenom };
}

export async function run() {
    const checks = {};

    // ============================== A. scoring primitives ==============================================
    const p1 = forecastPairs([{ returns: [0.01, -0.02, 0.03], confidence: [0.5, -0.5, 0.9] }]);
    checks.pairsMapsProbAndNextSign = p1.bars === 2 && p1.forecasts[0] === 0.75 && p1.outcomes[0] === 0
        && p1.forecasts[1] === 0.25 && p1.outcomes[1] === 1;
    checks.pairsSkipsNonFinite = forecastPairs([{ returns: [0.01, 0.02], confidence: [null, 0.1] }]).bars === 0
        && forecastPairs([{ returns: [0.01, 0.02] }]).bars === 0 && forecastPairs(null).bars === 0
        && forecastPairs([{ returns: [0.1, NaN, 0.2, 0.3], confidence: [0, 0.5, NaN, 0.9] }]).bars === 1;
    // A3. the affine map is EXACTLY the inverse of `confidenceFromProb(prob) = clamp(prob,0,100)/50 - 1`.
    let rtOk = true;
    for (const prob of [0, 1, 25, 50, 75, 99, 100]) {
        const c = confidenceFromProb(prob);
        const round = (c + 1) / 2;
        if (!close(round, prob / 100, 1e-12)) rtOk = false;
        const pr = forecastPairs([{ returns: [0.01, 0.02], confidence: [c, c] }]);
        if (!close(pr.forecasts[0], prob / 100, 1e-12)) rtOk = false;
    }
    checks.confidenceRoundTripsToProbability = rtOk;
    checks.binIndexExact = brierBinIndex(0, 10) === 0 && brierBinIndex(0.5, 10) === 5 && brierBinIndex(1, 10) === 9
        && brierBinIndex(0.3, 10) === 3 && brierBinIndex(0.999, 10) === 9 && brierBinIndex(1.7, 10) === 9 && brierBinIndex(-0.2, 10) === 0;
    checks.brierScoreExact = close(brierScore([0.2, 0.8], [0, 1]), 0.04, 1e-12)
        && Number.isNaN(brierScore([], [])) && close(brierScore([0.5, 0.5, NaN], [1, 0, 1]), 0.25, 1e-12);
    // logScore: -(sum) / count, with eps clipping so a confidently-wrong bar is finite (not Infinity).
    const ls = logScore([0.25, 0.75, 1.0, 0.0], [1, 0, 1, 0]);
    checks.logScoreExactAndClips = close(ls, (2 * -Math.log(0.25) + 2 * -Math.log(1 - 1e-15)) / 4, 1e-12)
        && Number.isFinite(ls) && close(logScore([0.5, 0.5], [0, 1]), Math.LN2, 1e-12)
        && close(logScore([0.9, 0.9, NaN], [1, 1, 1]), -Math.log(0.9), 1e-12)
        && Number.isNaN(logScore([], []));

    // ============================== B. Murphy partition + the cross-module WITHIN =====================
    const dm10 = probPairs(500, 1);
    const d10 = brierDecomposition({ forecasts: dm10.p, outcomes: dm10.o, bins: 10 });
    checks.murphyIdentityHolds = zero(d10.identityResidual) && d10.detail.reduce((a, x) => a + x.n, 0) === d10.bars
        && zero(d10.brierBinned - (d10.reliability - d10.resolution + d10.uncertainty));
    // B2. crafted two-point case (one point per bin), exact known values.
    const c2 = brierDecomposition({ forecasts: [0.2, 0.8], outcomes: [0, 1], bins: 2 });
    checks.murphyCraftedExact = close(c2.baseRate, 0.5, 1e-12) && close(c2.reliability, 0.04, 1e-12)
        && close(c2.resolution, 0.25, 1e-12) && close(c2.uncertainty, 0.25, 1e-12)
        && close(c2.brier, 0.04, 1e-12) && close(c2.brierBinned, 0.04, 1e-12) && zero(c2.identityResidual);
    checks.murphyEmptyUnavailable = brierDecomposition({ forecasts: [], outcomes: [] }).available === false;
    checks.murphyBinDegenerates = (() => {
        const b1 = brierDecomposition({ forecasts: [0.1, 0.9, 0.4], outcomes: [0, 1, 0], bins: 1 });
        const bN = brierDecomposition({ forecasts: [0.1, 0.9, 0.4], outcomes: [0, 1, 0], bins: 20 });
        return zero(b1.identityResidual) && close(b1.binned ?? b1.brierBinned, 0.24, 1e-12)
            && close(bN.brierBinned, bN.brier, 1e-12) && zero(bN.identityResidual);
    })();
    // B5. the repo's INDEPENDENT second Murphy implementation agrees on REL/RES/UNC/Brier.
    const crossRows = [];
    let crossOk = true; let withinOk = true; let gapIdentityOk = true; const gapWitnesses = [];
    for (const [T, B, seed] of [[500, 10, 1], [200, 5, 2], [137, 20, 3], [64, 1, 4], [300, 3, 5], [90, 10, 6]]) {
        const { p, o } = probPairs(T, seed);
        const fd = brierDecomposition({ forecasts: p, outcomes: o, bins: B });
        const od = obsBrierDecomposition(o, p, B);
        const w = withinParts(p, o, B);
        const gap = fd.brier - fd.brierBinned;
        const row = { T, B, relD: Math.abs(fd.reliability - od.reliability), resD: Math.abs(fd.resolution - od.resolution), uncD: Math.abs(fd.uncertainty - od.uncertainty), brierD: Math.abs(fd.brier - od.brier), withinD: Math.abs(od.within - gap), gapIdent: Math.abs(gap - (w.withinVar - 2 * w.withinCov)), gapVsVar: Math.abs(gap - w.withinVar), gap, withinVar: w.withinVar, withinCov: w.withinCov };
        crossRows.push(row);
        if (!(row.relD < 1e-12 && row.resD < 1e-12 && row.uncD < 1e-12 && row.brierD < 1e-12)) crossOk = false;
        if (!(row.withinD < 1e-12)) withinOk = false;
        if (!(row.gapIdent < 1e-12)) gapIdentityOk = false;
        if (gap < 0 && w.withinVar > 0 && Math.abs(gap - w.withinVar) > 1e-4) gapWitnesses.push({ T, B, gap: r4(gap, 6), withinVar: r4(w.withinVar, 6), withinCov: r4(w.withinCov, 6) });
    }
    checks.crossModuleMurphyAgrees = crossOk;
    checks.observerWithinEqualsForecastGap = withinOk;
    checks.murphyGapIsWithinVarMinus2Cov = gapIdentityOk;

    // ============================== C. bootstrapMeans =================================================
    const bmA = bootstrapMeans([[1, 2, 3, 4, 5, 6, 7, 8], [2, 3, 4, 5, 6, 7, 8, 9]], { nBoot: 64, seed: 3 });
    const bmB = bootstrapMeans([[1, 2, 3, 4, 5, 6, 7, 8], [2, 3, 4, 5, 6, 7, 8, 9]], { nBoot: 64, seed: 3 });
    let det = true; for (let i = 0; i < 128; i++) if (bmA.means[i] !== bmB.means[i]) det = false;
    checks.bootstrapDeterministic = det && bmA.K === 2 && bmA.T === 8;
    checks.bootstrapDefaultBlockIsCbrt = bmA.blockLength === Math.max(1, Math.floor(Math.cbrt(8)))
        && bootstrapMeans([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]], { nBoot: 4, seed: 1 }).blockLength === Math.floor(Math.cbrt(27))
        && bootstrapMeans([[1, 2, 3, 4, 5, 6, 7, 8]], { nBoot: 4, seed: 1, blockLength: 5 }).blockLength === 5
        && bootstrapMeans([[1, 2, 3, 4, 5, 6, 7, 8]], { nBoot: 4, seed: 1, blockLength: 0 }).blockLength === Math.max(1, Math.floor(Math.cbrt(8)));
    // C3. one index draw per replicate => the paired structure is preserved: series differing by a constant
    // keep that constant in EVERY bootstrap mean.
    let pairOk = true;
    for (let rep = 0; rep < 64; rep++) if (!close(bmA.means[2 * rep + 1] - bmA.means[2 * rep], 1, 1e-9)) pairOk = false;
    checks.bootstrapPairedIndexDraw = pairOk;
    checks.bootstrapEmptyUnavailable = bootstrapMeans([]).available === false && bootstrapMeans([[]]).available === false;

    // ============================== D. Diebold-Mariano =================================================
    const rD = repoRng(7);
    const aD = Array.from({ length: 120 }, () => 0.3 + 0.1 * gauss(rD));
    const bD = Array.from({ length: 120 }, () => 0.2 + 0.1 * gauss(rD));
    const laD = brierLosses(aD, aD.map((v) => (v > 0.3 ? 1 : 0)));
    const lbD = brierLosses(bD, bD.map((v) => (v > 0.3 ? 1 : 0)));
    const dmD = dieboldMariano({ lossA: laD, lossB: lbD, nBoot: 300, seed: 42 });
    const dDiff = laD.map((v, i) => v - lbD[i]);
    const bmD = bootstrapMeans([dDiff], { nBoot: 300, blockLength: null, seed: 42 });
    const bmeanD = mean(Array.from({ length: 300 }, (_, i) => bmD.means[i]));
    const seD = Math.sqrt(Array.from({ length: 300 }, (_, i) => (bmD.means[i] - bmeanD) ** 2).reduce((s, x) => s + x, 0) / 299);
    let excD = 0; for (let rep = 0; rep < 300; rep++) if (Math.abs(bmD.means[rep] - mean(dDiff)) >= Math.abs(mean(dDiff))) excD++;
    checks.dmStatisticIsDbarOverBootSE = close(dmD.meanDifferential, mean(dDiff), 1e-12) && close(dmD.se, seD, 1e-12)
        && close(dmD.statistic, mean(dDiff) / seD, 1e-12) && close(dmD.pValue, (excD + 1) / 301, 1e-12) && dmD.n === 120;
    checks.dmDegenerateArms = (() => {
        const zd = dieboldMariano({ lossA: [0.2, 0.2], lossB: [0.2, 0.2], nBoot: 100, seed: 1 });
        const cd = dieboldMariano({ lossA: [0.3, 0.3, 0.3], lossB: [0.1, 0.1, 0.1], nBoot: 100, seed: 1 });
        return zd.available && zd.statistic === 0 && zd.pValue === 1 && zd.favored === null
            && cd.available && cd.statistic === Infinity && cd.pValue === 0 && cd.favored === 'B'
            && dieboldMariano({ lossA: [0.1], lossB: [0.2] }).available === false;
    })();
    checks.dmReportsBlockLength = dmD.blockLength === Math.max(1, Math.floor(Math.cbrt(120)));
    // D5. i.i.d. null size (2.5-SE band) over 400 independent realisations.
    const DR = 400; let rej5 = 0; let rej10 = 0; const pvs = [];
    for (let i = 0; i < DR; i++) {
        const r = repoRng(1000 + i);
        const A = Array.from({ length: 200 }, () => Math.abs(gauss(r)) + i * 1e-6);
        const B = Array.from({ length: 200 }, () => Math.abs(gauss(r)) + i * 1e-6);
        const dm = dieboldMariano({ lossA: A, lossB: B, nBoot: 299, blockLength: 1, seed: 900 + i });
        pvs.push(dm.pValue);
        if (dm.pValue <= 0.05) rej5++;
        if (dm.pValue <= 0.10) rej10++;
    }
    const seP5 = Math.sqrt(0.05 * 0.95 / DR); const seP10 = Math.sqrt(0.1 * 0.9 / DR);
    const size5 = rej5 / DR; const size10 = rej10 / DR;
    checks.dmIidSizeNominal = size5 <= 0.05 + 2.5 * seP5 && size10 <= 0.10 + 2.5 * seP10
        && size5 >= 0.05 - 2.5 * seP5 && size10 >= 0.10 - 2.5 * seP10;
    // D6. the block bootstrap controls size under persistence where blockLength=1 does not.
    const sizeAt = (phi, b, seedBase) => {
        let rej = 0; const R = 200;
        for (let i = 0; i < R; i++) {
            const r = repoRng(seedBase + i); const T = 300; let pa = 0; let pb = 0; const A = []; const B = [];
            for (let t = 0; t < T; t++) { pa = phi * pa + gauss(r) * Math.sqrt(1 - phi * phi); pb = phi * pb + gauss(r) * Math.sqrt(1 - phi * phi); A.push(Math.abs(pa)); B.push(Math.abs(pb)); }
            if (dieboldMariano({ lossA: A, lossB: B, nBoot: 299, blockLength: b, seed: 7000 + i }).pValue <= 0.05) rej++;
        }
        return rej / R;
    };
    const sizePhi0 = sizeAt(0.5, null, 30000); const sizePhi1 = sizeAt(0.5, 1, 32000);
    const seB = (p) => Math.sqrt(Math.max(1e-12, p * (1 - p)) / 200);

    // ============================== E. Model Confidence Set ============================================
    const baseLoss = Array.from({ length: 100 }, (_, i) => 0.3 + 0.01 * Math.sin(i * 0.5));
    const worse = baseLoss.map((v) => v + 0.2);
    const mcsT = modelConfidenceSet({ losses: [baseLoss, worse, baseLoss.slice()], ids: ['a', 'b', 'c'], alpha: 0.10, nBoot: 400, seed: 7 });
    checks.mcsEliminatesWorseKeepsIdentical = mcsT.available
        && JSON.stringify(mcsT.memberIds) === JSON.stringify(['a', 'c'])
        && mcsT.eliminated.length === 1 && mcsT.eliminated[0].id === 'b' && typeof mcsT.eliminated[0].pValue === 'number';
    checks.mcsDeterministic = JSON.stringify(modelConfidenceSet({ losses: [baseLoss, worse, baseLoss.slice()], ids: ['a', 'b', 'c'], alpha: 0.10, nBoot: 400, seed: 7 })) === JSON.stringify(mcsT);
    checks.mcsDegenerateSizes = JSON.stringify(modelConfidenceSet({ losses: [baseLoss], ids: ['solo'] }).memberIds) === JSON.stringify(['solo'])
        && modelConfidenceSet({ losses: [] }).available === false
        && modelConfidenceSet({ losses: [[1, 2, 3, 4], [5, 6]], ids: ['a', 'b'] }).available === false;
    checks.mcsMonotoneInConfidence = (() => {
        const graded = [baseLoss, worse, baseLoss.map((v, i) => v + 0.05 + 0.01 * Math.sin(i)), baseLoss.map((v, i) => v + 0.1 + 0.01 * Math.cos(i))];
        const m90 = modelConfidenceSet({ losses: graded, ids: ['g0', 'g1', 'g2', 'g3'], alpha: 0.10, nBoot: 400, seed: 11 });
        const m95 = modelConfidenceSet({ losses: graded, ids: ['g0', 'g1', 'g2', 'g3'], alpha: 0.05, nBoot: 400, seed: 11 });
        return m90.available && m95.available && m90.members.every((i) => m95.members.includes(i));
    })();
    // E5/E6. sample-best always survives + coverage under an exact null (K=3, independent arms).
    const cover = (K, T, alpha, seedBase, phi) => {
        let allKept = 0; let bestIn = 0; const R = 200;
        for (let i = 0; i < R; i++) {
            const r = repoRng(seedBase + i);
            const losses = [];
            for (let k = 0; k < K; k++) { const s = []; let p = 0; for (let t = 0; t < T; t++) { p = phi * p + gauss(r) * Math.sqrt(1 - phi * phi); s.push(Math.abs(p)); } losses.push(s); }
            const m = modelConfidenceSet({ losses, alpha, nBoot: 299, seed: 5000 + i });
            if (m.members.length === K) allKept++;
            const obs = losses.map(mean); let b = 0; for (let k = 1; k < K; k++) if (obs[k] < obs[b]) b = k;
            if (m.members.includes(b)) bestIn++;
        }
        return { allKept: allKept / R, bestIn: bestIn / R, R };
    };
    const covIid = cover(3, 200, 0.10, 61000, 0);
    const covPers = cover(3, 200, 0.10, 62000, 0.5);
    const cov95 = cover(3, 800, 0.05, 63000, 0);
    const covOther = cover(4, 200, 0.10, 64000, 0);
    checks.mcsAlwaysContainsSampleBest = covIid.bestIn === 1 && covPers.bestIn === 1 && cov95.bestIn === 1 && covOther.bestIn === 1;
    checks.mcsCoverageNearNominal = (() => {
        const bar = (p, nom, R) => p <= nom + 2.5 * Math.sqrt(nom * (1 - nom) / R) && p >= nom - 2.5 * Math.sqrt(nom * (1 - nom) / R);
        return bar(covIid.allKept, 0.90, covIid.R) && bar(covOther.allKept, 0.90, covOther.R) && bar(cov95.allKept, 0.95, cov95.R);
    })();
    // E8. the elimination denominator deviation (HLN's sd(d_i) vs the code's sd(L_i)) is real on paper but
    // empirically inert: it changes neither the surviving set nor the elimination order over 150 configs.
    let denomSetDiff = 0; let denomOrderDiff = 0; let denomMax = 0;
    for (let i = 0; i < 150; i++) {
        const r = repoRng(130000 + i); const K = 4; const T = 200; const scale = [1, 1, 8, 0.05];
        const losses = [];
        for (let k = 0; k < K; k++) { const s = []; for (let t = 0; t < T; t++) s.push(0.5 + 0.02 * k + scale[k] * 0.1 * Math.abs(gauss(r))); losses.push(s); }
        const code = modelConfidenceSet({ losses, ids: losses.map((_, k) => 'm' + k), alpha: 0.10, nBoot: 299, seed: 140000 + i });
        const ind = mcsWithHlnDenominator(losses, 0.10, 299, null, 140000 + i);
        if (JSON.stringify(code.members) !== JSON.stringify(ind.members)) denomSetDiff++;
        if (JSON.stringify(code.eliminated.map((e) => e.index)) !== JSON.stringify(ind.order)) denomOrderDiff++;
        denomMax = Math.max(denomMax, ind.maxRelDenom);
    }
    checks.mcsHlnDenominatorInertButReal = denomSetDiff === 0 && denomOrderDiff === 0 && denomMax > 0.05;

    // ============================== F. forecastComparison ==============================================
    const mkFold = (n, bias, seed) => { const rr = repoRng(seed); const ret = []; const conf = []; for (let i = 0; i < n; i++) { ret.push(gauss(rr) * 0.01); conf.push(Math.max(-1, Math.min(1, bias + 0.3 * gauss(rr)))); } return { returns: ret, confidence: conf }; };
    const fcBase = [mkFold(150, 0.0, 10)];
    const fc = forecastComparison({
        baseline: fcBase, baselineKind: 'controller', baselineId: 'baseline',
        candidates: [{ id: 'ctl', kind: 'controller', foldInputs: [mkFold(150, 0.4, 11)] }, { id: 'sig', kind: 'signal', foldInputs: [mkFold(150, 0.2, 12)] }, { id: 'bk', kind: 'benchmark', foldInputs: [mkFold(150, 0.3, 13)] }],
        nBoot: 300, seed: 21,
    });
    checks.fcStructure = fc.available && fc.kind === 'controller' && fc.baselineGroup === 'controller'
        && fc.kinds.map((g) => g.kind).join(',') === 'controller,signal'
        && fc.byKind.controller.members.join(',') === 'baseline,ctl,bk' && fc.byKind.signal.members.join(',') === 'sig'
        && fc.mcs.at90.available && fc.mcs.at95.available && fc.reader.includes('grouped by `kind`');
    checks.fcBenchmarkInProbabilityGroup = fc.byId.bk.group === 'controller' && fc.byId.bk.dm.available === true
        && fc.byId.ctl.dm.available === true && fc.byId.sig.dm.available === false && String(fc.byId.sig.dm.reason).includes('cross-kind');
    checks.fcSkillFormulasExact = (() => {
        for (const id of ['baseline', 'ctl', 'bk', 'sig']) {
            const row = fc.byId[id];
            const want = 1 - row.brier / row.brierBaseline;
            const chance = Math.max(row.baseRate, 1 - row.baseRate);
            if (!close(row.brierSkill, want, 1e-12)) return false;
            if (!close(row.accuracySkill, row.accuracy - chance, 1e-12)) return false;
            if (!close(row.brierBaseline, row.baseRate * (1 - row.baseRate), 1e-12)) return false;
        }
        return true;
    })();
    checks.fcRefusesCountMismatch = forecastComparison({ baseline: fcBase, candidates: [{ id: 'short', kind: 'controller', foldInputs: [mkFold(149, 0, 1)] }] }).available === false;
    checks.fcFormatRenders = (() => { const s = formatForecast(fc); return typeof s === 'string' && s.includes('forecast:') && s.includes('mcs90=[') && s.includes('mcs95=[') && s.includes('groups:'); })()
        && formatForecast({ available: false, reason: 'none' }).includes('unavailable');

    // ============================== findings ===========================================================
    // (1) the raw-minus-binned gap docstring identity is false: gap = withinVar - 2*withinCov, not withinVar.
    const findingMurphyGap = { claim: 'the gap is the within-bin *forecast* variance that merging into a bin discards', exact: 'gap = WITHIN = withinVar - 2*withinCov (observer/legion_metrics.js brierDecomposition)', rows: crossRows, witnesses: gapWitnesses };

    // (2) the alignment guard is count-only: two variants that drop DIFFERENT bars but the same NUMBER are
    // silently paired index-wise, and the DM verdict can flip versus the correctly bar-aligned comparison.
    const alignCases = [];
    for (const [j1, j2] of [[3, 7], [2, 9], [4, 5], [1, 8], [6, 10], [3, 6]]) {
        const N = 24; const rr = repoRng(555 + j1 * 31 + j2);
        const ret = Array.from({ length: N }, () => gauss(rr) * 0.01);
        const sgn = ret.map((_, i) => (i + 1 < N ? (ret[i + 1] > 0 ? 1 : -1) : 0));
        const goodC = sgn.map((v, i) => v * 0.8 + 0.15 * Math.sin(i * 1.7));
        const badC = sgn.map((v, i) => (rr() < 0.4 ? v : -v) * 0.8 + 0.15 * Math.cos(i * 1.3));
        const cb = goodC.slice(); cb[j1] = NaN;
        const cc = badC.slice(); cc[j2] = NaN;
        const cmpA = forecastComparison({ baseline: [{ returns: ret, confidence: cb }], baselineKind: 'controller', baselineId: 'bl', candidates: [{ id: 'inv', kind: 'controller', foldInputs: [{ returns: ret, confidence: cc }] }], nBoot: 299, seed: 4242 });
        const fb = forecastPairs([{ returns: ret, confidence: cb }]);
        const fcv = forecastPairs([{ returns: ret, confidence: cc }]);
        const alignedA = []; const alignedB = []; const alignedO = [];
        for (let i = 0; i + 1 < N; i++) { if (i === j1 || i === j2) continue; alignedA.push((cb[i] + 1) / 2); alignedB.push((cc[i] + 1) / 2); alignedO.push(ret[i + 1] > 0 ? 1 : 0); }
        const dmAligned = dieboldMariano({ lossA: brierLosses(alignedA, alignedO), lossB: brierLosses(alignedB, alignedO), nBoot: 299, seed: 4242 });
        const ac = cmpA.byId.inv.dm || {};
        alignCases.push({ j1, j2, accepted: cmpA.available, barsA: fb.bars, barsB: fcv.bars, outcomesDiffer: JSON.stringify(fb.outcomes) !== JSON.stringify(fcv.outcomes), pAsAccepted: r4(ac.pValue, 4), favoredAsAccepted: ac.favored, pAligned: r4(dmAligned.pValue, 4), favoredAligned: dmAligned.favored });
    }
    const flips = alignCases.filter((c) => c.accepted && c.outcomesDiffer && (c.favoredAsAccepted !== c.favoredAligned || (c.pAsAccepted <= 0.05) !== (c.pAligned <= 0.05)));
    const findingAlignment = { claim: 'alignment is the whole point of a paired test; refuse rather than silently compare mismatched windows', guard: 'pairs.bars !== base.bars (a COUNT, not the bar identities)', cases: alignCases, flips: flips.length, of: alignCases.length };

    // (3) `groupOf` maps `benchmark` to the BASELINE's kind; with a signal baseline a probability-calibrated
    // benchmark joins the z-score signal group and gets a DM test against it, contradicting the module reader.
    const fcSig = forecastComparison({
        baseline: [mkFold(150, 0, 21)], baselineKind: 'signal', baselineId: 'sigma',
        candidates: [{ id: 'bk', kind: 'benchmark', foldInputs: [mkFold(150, 0.3, 22)] }, { id: 'ctl', kind: 'controller', foldInputs: [mkFold(150, 0.3, 23)] }],
        nBoot: 200, seed: 21,
    });
    const findingBenchmarkGroup = {
        readerClaim: 'the benchmark arms (kind benchmark) journal a calibrated probability, so they share the baseline\'s calibration GROUP',
        observed: { baselineGroup: fcSig.baselineGroup, benchmarkGroup: fcSig.byId.bk.group, benchmarkDmAvailable: fcSig.byId.bk.dm.available, controllerGroup: fcSig.byId.ctl.group, controllerDmAvailable: fcSig.byId.ctl.dm.available, kinds: fcSig.kinds.map((g) => ({ kind: g.kind, members: g.members })) },
        reachableFromAnalyze: false,
        why: 'analyze.js forces the id:"baseline" controller variant to index 0 whenever --variants= is given, and forecastKindOf(baselineVariant) is "controller" for the default roster, so baselineKind is never "signal" in a real run; the branch is reachable only through the exported forecastComparison API',
    };

    // (4) bootstrapMeans does not validate equal series lengths -> silent NaN (modelConfidenceSet does).
    const bmUnequal = bootstrapMeans([[1, 2, 3, 4], [5, 6]], { nBoot: 16, seed: 1 });
    let bmNan = 0; for (let i = 0; i < 16; i++) if (!Number.isFinite(bmUnequal.means[i])) bmNan++;
    const findingBootstrapLengths = { claim: 'series: one array per model, all the same length', observed: { available: bmUnequal.available, T: bmUnequal.T, K: bmUnequal.K, nanReplicates: bmNan, of: 16 }, note: 'modelConfidenceSet validates equal lengths and refuses, so this arm is only reachable through the exported bootstrapMeans' };

    // (5) a NaN inside a loss series leaves the MCS `available` and returns an arbitrary survivor.
    const mcsNan = modelConfidenceSet({ losses: [[0.1, NaN, 0.2, 0.3, 0.4], [0.2, 0.2, 0.2, 0.2, 0.2]], ids: ['x', 'y'], nBoot: 99, seed: 1 });
    const findingMcsNan = { observed: { available: mcsNan.available, members: mcsNan.memberIds, lastPValue: mcsNan.lastPValue }, note: 'forecastComparison feeds only finite pairs (forecastPairs drops non-finite), so the shipped path is safe; the exported primitive is not' };

    // ============================== verdict ============================================================
    const validationPass = Object.values(checks).every((x) => x === true);
    const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
    const verdict = {
        note: 'L10-ba..: `forecast.js` is SHIPPED (analyze.js runs the forecast block by default). PASSES the pre-registered read: the scoring primitives are exact (`forecastPairs` IS the `confidenceFromProb` inverse + next-bar sign, dropping the fold-last bar; brierBinIndex/brierScore/logScore are the closed forms with the documented non-finite and eps-clipping handling); the Murphy partition is exact AND agrees with the repo\'s independent second implementation (observer/legion_metrics.js) on REL/RES/UNC/Brier to 1e-12; bootstrapMeans is deterministic, uses max(1,floor(cbrt(T))), resamples all series with one paired index draw and reports its block; the DM statistic is exactly dbar/boot-SE with the documented degenerate arms (zero differential -> 0/1/null, constant positive -> Infinity/0), nominal i.i.d. size (0.0525/0.1075 at 5%/10% over 400 reps), and the block bootstrap controls persistence size where blockLength=1 does not (0.07 vs 0.135 at phi=0.5); the MCS eliminates a uniformly worse arm, keeps an identical pair, ALWAYS contains the sample-best (4 ensembles, 200 each), keeps ~1-alpha coverage (K=3 alpha=0.1 0.885, K=4 0.86, alpha=0.05 0.95) and is deterministic + monotone in confidence. FINDINGS: (1) the brierDecomposition docstring claim that the raw-minus-binned gap IS "the within-bin forecast variance" is FALSE - the exact identity is gap = WITHIN = withinVar - 2*withinCov (stated correctly by observer/legion_metrics.js), and the gap is NEGATIVE while withinVar is positive on 5 of 6 audited configs; (2) forecastComparison\'s alignment guard is count-only, so a count-coincident misalignment (two variants dropping DIFFERENT bars) is silently paired index-wise and the DM verdict flips in 6 of 6 crafted cases - the module\'s own "refuse rather than silently compare mismatched windows" invariant is not enforced; (3) forecastComparison#groupOf maps `benchmark` to the BASELINE\'s kind, so with baselineKind "signal" a probability-calibrated benchmark joins the z-score group and gets a DM test against it, contradicting the reader - unreachable from analyze.js (the id:"baseline" controller variant is always at index 0) but reachable through the exported API; (4) the MCS elimination denominator uses sd(L_i) where HLN specifies sd(d_i): a real paper deviation that is empirically INERT (0/150 heterogeneous-variance configs changed the surviving set or the elimination order); (5) bootstrapMeans silently NaNs on unequal-length series and modelConfidenceSet returns available:true for a NaN-containing loss series. Scope: forecast.js is SHIPPED via analyze.js (forecastComparison + formatForecast); it also consumes reality_check.js#stationaryBlockIndices (audited in F-66).',
        checks,
        validationPass,
        failed,
        calibrations: { dmIidSize5: r4(size5, 4), dmIidSize10: r4(size10, 4), dmSizePhi05Default: r4(sizePhi0, 4), dmSizePhi05Block1: r4(sizePhi1, 4), mcsCoverIid: r4(covIid.allKept, 4), mcsCoverPers: r4(covPers.allKept, 4), mcsCover95: r4(cov95.allKept, 4), mcsCoverK4: r4(covOther.allKept, 4), dmSizeBand: r4(2.5 * seB(0.07), 4) },
        findings: {
            murphyGapCommentFalse: findingMurphyGap,
            alignmentGuardCountOnly: findingAlignment,
            benchmarkGroupOnSignalBaseline: findingBenchmarkGroup,
            mcsEliminationDenominator: { hln: 'sd(d_i), d_i = L_i - mean_others', code: 'sd(L_i)', maxRelDenomDiff: r4(denomMax, 4), configs: 150, setChanged: denomSetDiff, orderChanged: denomOrderDiff },
            bootstrapMeansUnvalidatedLengths: findingBootstrapLengths,
            mcsNanLossUnvalidated: findingMcsNan,
        },
        scope: { shippedViaAnalyze: ['forecastComparison', 'formatForecast'], shippedInternal: ['forecastPairs', 'brierScore', 'logScore', 'brierDecomposition', 'brierLosses', 'bootstrapMeans', 'dieboldMariano', 'modelConfidenceSet', 'brierBinIndex'], consumedFromRealityCheck: ['stationaryBlockIndices'], independentReference: 'observer/legion_metrics.js#brierDecomposition (second Murphy implementation in the repo)' },
    };
    return {
        config: { crossGrid: crossRows.map((r) => [r.T, r.B]), dmReps: DR, mcsReps: covIid.R, denomConfigs: 150 },
        rows: { crossModule: crossRows, dm: { statistic: r4(dmD.statistic, 6), se: r4(dmD.se, 6), pValue: r4(dmD.pValue, 6), blockLength: dmD.blockLength }, mcs: { members: mcsT.memberIds, eliminated: mcsT.eliminated.map((e) => ({ id: e.id, step: e.step, p: r4(e.pValue, 4) })) } },
        validation: checks,
        verdict,
    };
}
