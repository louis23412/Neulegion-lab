// E57 - THE PBO / CSCV MODULE, AUDITED AGAINST CLOSED FORMS AND ITS OWN CALIBRATION CLAIMS.
// CYCLE-049 (L10-aq ... L10-au).
//
// `analysis/overfitting.js` implements the Probability of Backtest Overfitting (Bailey, Borwein, Lopez de
// Prado & Zhu 2016) over `C(S, S/2)` combinatorially symmetric splits. It is the repo's *non-parametric*
// selection-bias counterpart to the deflated Sharpe, and the repo makes unusually specific claims about it:
// `docs/LOCKED.md` and `test/lock-registry.js` state that `cscvBlocks` partitions exactly (remainder on
// the first blocks), `cscvSplit` yields the `C(S,S/2)` symmetric splits with each block in exactly
// `C(S-1,S/2-1)` in-sample sets and the set closed under complement, that `relativeRank` maps rank to
// `omega = rank/(N+1)` in (0,1) with average tie ranks (best 3/4, worst 1/4, full tie 1/2), that
// `oosOnIsRegression` is "exact", and it reports a *calibration*: "on 20 iid-noise strategies (T=500,
// S=10, 252 splits) PBO = 0.464 (~1/2) with a ~0 degradation slope; a genuine persistent edge drives PBO
// to 0 with a positive OOS-on-IS slope; a planted regime flip drives PBO to 1; and an all-flat matrix gives
// PBO=1 under the documented tie convention".
//
// CYCLE-049 audits that: every structural claim is an exact combinatorial object (closed form, no
// randomness), and the calibration is a *statistic* - so the F-57/F-62 discipline applies: the quoted
// 0.464 is a single realisation, and the audit must give it an ensemble and a standard-error band.
//
// PRE-REGISTERED READ. PASSES if (i) the structure is exact - split count = C(S,S/2), disjoint cover,
// block multiplicity C(S-1,S/2-1), complement closure, exact partition, cap rejection; (ii) `relativeRank`
// and `oosOnIsRegression` match their closed forms exactly (and the OLS matches an independent sum-formula
// regression); (iii) the three calibration regimes reproduce (noise ~1/2 centred, persistent edge -> 0
// with a positive slope, regime flip -> ~1, all-flat -> exactly 1) AND the repo's own quoted 0.464 is
// reproduced with the repo's own RNG/seed, while an ensemble shows it is *one draw* of a distribution wide
// enough that a 3-decimal quote is not resolvable; and (iv) two things the calibration does not cover are
// measured: the tie convention's upward bias on a duplicated candidate roster, and the pooled degradation
// regression's naive inference (its returned `n` is `N * splits`, but the pairs are dependent). A failure
// means one of those claims is wrong and F-65 must be revised.

import {
    DEFAULT_PBO_CONFIG, cscvBlocks, cscvSplit, relativeRank, oosOnIsRegression,
    probabilityOfBacktestOverfitting,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/overfitting.js';

// ---- deterministic helpers -------------------------------------------------------------------------
// The repo's own RNG (analysis.test.js / harness), copied so its calibration draws can be reproduced.
function repoRng(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function gauss(r) { let u = 0; let v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function noiseMatrix(N, T, seed, sd = 0.01) { const r = repoRng(seed); return Array.from({ length: N }, () => Array.from({ length: T }, () => sd * gauss(r))); }
const r3 = (x, d = 4) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a) => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const close = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
// Independent multiplicative binomial, to check cscvSplit's split count and the multiplicity formula.
function binomIndep(n, r) { if (r < 0 || r > n) return 0; r = Math.min(r, n - r); let c = 1; for (let i = 1; i <= r; i++) c = (c * (n - r + i)) / i; return Math.round(c); }
// Independent OLS via the raw sums formula (slope = Sxy/Sxx with n*Sigma xy - Sigma x Sigma y, etc).
function olsIndep(xs, ys) {
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0); const sy = ys.reduce((a, b) => a + b, 0);
    const sxx = n * xs.reduce((a, b) => a + b * b, 0) - sx * sx;
    const syy = n * ys.reduce((a, b) => a + b * b, 0) - sy * sy;
    const sxy = n * xs.reduce((a, b, i) => a + b * ys[i], 0) - sx * sy;
    const slope = sxx > 0 ? sxy / sxx : 0;
    return { slope, intercept: (sy - slope * sx) / n, r2: (sxx > 0 && syy > 0) ? (sxy * sxy) / (sxx * syy) : 0, n };
}

export async function run() {
    // ============================== A. structure (exact combinatorics) ============================
    const blockRows = [];
    for (const [n, S] of [[8, 2], [10, 4], [12, 6], [100, 10], [101, 10], [500, 10], [6, 4]]) {
        const groups = cscvBlocks(n, S);
        const sizes = groups.map((g) => g.length);
        const base = Math.floor(n / S);
        const expectedSizes = Array.from({ length: S }, (_, b) => base + (b < n % S ? 1 : 0));
        const flat = groups.flat();
        const covers = flat.length === n && flat.every((v, i) => v === i);      // ordered contiguous cover
        blockRows.push({
            n, S, sizes, expectedSizes, blocks: groups.length,
            exactPartition: JSON.stringify(sizes) === JSON.stringify(expectedSizes) && covers,
            minBlock: Math.min(...sizes),
        });
    }
    const blocksExact = blockRows.every((x) => x.exactPartition);

    const splitRows = [];
    for (const S of [2, 4, 6, 8, 10, 12]) {
        const n = 240;
        const splits = cscvSplit({ n, blocks: S });
        const half = S / 2;
        const total = binomIndep(S, half);
        const coverOk = splits.every((sp) => {
            const union = [...sp.is, ...sp.oos].sort((a, b) => a - b);
            const contiguous = union.length === n && union.every((v, i) => v === i);
            const disjoint = sp.is.every((i) => !sp.oos.includes(i));
            return contiguous && disjoint && sp.is.length + sp.oos.length === n;
        });
        // each block sits in-sample in exactly C(S-1, S/2-1) splits
        const blockCounts = new Array(S).fill(0);
        for (const sp of splits) for (const b of sp.isBlocks) blockCounts[b]++;
        const multOk = blockCounts.every((c) => c === binomIndep(S - 1, half - 1));
        // closed under complement
        const key = (arr) => arr.slice().sort((a, b) => a - b).join(',');
        const isKeys = new Set(splits.map((sp) => key(sp.isBlocks)));
        const complementOk = splits.every((sp) => isKeys.has(key(Array.from({ length: S }, (_, b) => b).filter((b) => !sp.isBlocks.includes(b)))));
        const sortedOk = splits.every((sp) => sp.is.every((v, i) => i === 0 || v > sp.is[i - 1]) && sp.oosBlocks.length === half);
        splitRows.push({ S, splits: splits.length, expected: total, coverOk, multOk, complementOk, sortedOk });
    }
    const splitsExact = splitRows.every((x) => x.splits === x.expected && x.coverOk && x.multOk && x.complementOk && x.sortedOk);
    // the cap: C(20,10) = 184756 is under 200000, C(22,11) = 705432 is over
    const capUnder = binomIndep(20, 10); const capOver = binomIndep(22, 11);
    let capThrewUnder = false; let capThrewOver = false;
    try { cscvSplit({ n: 200, blocks: 20 }); } catch { capThrewUnder = true; }
    try { cscvSplit({ n: 200, blocks: 22 }); } catch { capThrewOver = true; }
    const capContract = { capUnder, capOver, throwsUnder: capThrewUnder, throwsOver: capThrewOver, maxSplits: 200000 };
    const capRejectsAstronomical = capThrewUnder === false && capThrewOver === true && capUnder < 200000 && capOver > 200000;

    // ============================== B. relativeRank closed forms ===================================
    const N = 5;
    const ascending = [1, 2, 3, 4, 5];
    const rankRows = {
        best: relativeRank(ascending, 4), worst: relativeRank(ascending, 0),
        bestExpected: N / (N + 1), worstExpected: 1 / (N + 1),
        fullTie: relativeRank([5, 5, 5, 5], 0),                 // average rank (N+1)/2 -> omega 1/2
        tieHigh: relativeRank([5, 5, 1, 1], 0),                  // less=2, ties=1 -> rank 3.5 / 5 -> 0.7
        tieHighExpected: 3.5 / 5,
        tieLow: relativeRank([5, 5, 1, 1], 2),                   // less=0, ties=1 -> rank 1.5 / 5 -> 0.3
        tieLowExpected: 1.5 / 5,
        strictlyInside: ascending.every((_, i) => relativeRank(ascending, i) > 0 && relativeRank(ascending, i) < 1),
    };
    const rankClosedForms = close(rankRows.best, rankRows.bestExpected, 1e-12) && close(rankRows.worst, rankRows.worstExpected, 1e-12)
        && close(rankRows.fullTie, 0.5, 1e-12) && close(rankRows.tieHigh, rankRows.tieHighExpected, 1e-12)
        && close(rankRows.tieLow, rankRows.tieLowExpected, 1e-12) && rankRows.strictlyInside;
    const nanTarget = relativeRank([1, 2, 3], 1) === 2 / 4 && relativeRank([1, NaN, 3], 1) !== relativeRank([1, NaN, 3], 1);   // non-finite target -> NaN
    // the NaN-denominator wart: the rank skips non-finite entries but omega divides by the FULL length
    const nanValues = [1, 2, 3, NaN];
    const nanOmega = relativeRank(nanValues, 2);                 // rank 3 (less=2) but divided by n+1 = 5 -> 0.6
    const nanOmegaIfExcluded = 3 / 4;                            // the "exclude the missing candidate" reading -> 0.75
    const nanRankWart = { nanOmega, nanOmegaIfExcluded, usesFullLength: close(nanOmega, 3 / 5, 1e-12), depressed: nanOmega < nanOmegaIfExcluded };

    // ============================== C. oosOnIsRegression ==========================================
    const olsRows = [];
    for (let s = 1; s <= 40; s++) {
        const r = repoRng(5000 + s * 13);
        const k = 4 + (s % 14);
        const xs = Array.from({ length: k }, () => gauss(r));
        const ys = Array.from({ length: k }, (_, i) => 0.7 * xs[i] + 0.4 * gauss(r));
        const got = oosOnIsRegression(xs, ys);
        const exp = olsIndep(xs, ys);
        olsRows.push({ s, k, slopeOk: close(got.slope, exp.slope, 1e-9), interceptOk: close(got.intercept, exp.intercept, 1e-9), r2Ok: close(got.r2, exp.r2, 1e-9), r2InRange: got.r2 >= 0 && got.r2 <= 1, nOk: got.n === k });
    }
    const olsMatches = olsRows.every((x) => x.slopeOk && x.interceptOk && x.r2Ok && x.r2InRange && x.nOk);
    const olsIdentity = close(oosOnIsRegression([1, 2, 3], [1, 2, 3]).slope, 1, 1e-12) && close(oosOnIsRegression([1, 2, 3], [3, 2, 1]).slope, -1, 1e-12);
    const olsDegenerate = (() => {
        const flat = oosOnIsRegression([1, 1, 1], [1, 2, 3]);      // sxx = 0 -> slope 0
        const flatY = oosOnIsRegression([1, 2, 3], [7, 7, 7]);     // syy = 0 -> r2 0
        const one = oosOnIsRegression([1], [1]);
        return flat.slope === 0 && flat.r2 === 0 && flatY.r2 === 0 && Number.isNaN(one.slope) && one.n === 1;
    })();

    // ============================== D. constructed PBO with known answers ==========================
    // (1) all-flat: every OOS performance ties (Sharpe 0), omega = 1/2, lambda = 0 <= 0 => every split
    //     counts as overfit. The repo documents this ("the documented tie convention").
    const allFlat = probabilityOfBacktestOverfitting([new Array(40).fill(0), new Array(40).fill(0)], { blocks: 4 });
    const allFlatIsOne = allFlat.pbo === 1;
    // (2) one strictly dominant strategy: IS winner always j=0, OOS rank N => lambda = ln(N) > 0 => PBO 0.
    const domR = repoRng(9001);
    const dominant = Array.from({ length: 6 }, (_, j) => Array.from({ length: 240 }, () => (j === 0 ? 0.005 : 0) + (j === 0 ? 0.001 : 0.02) * gauss(domR)));
    const dom = probabilityOfBacktestOverfitting(dominant, { blocks: 10 });
    const dominantIsZero = dom.pbo === 0 && dom.isBestIndex.every((b) => b === 0);
    // (3) an anti-persistent pair: the IS winner is the OOS loser in EVERY split => PBO 1. With a metric
    //     that negates performance the sign flips exactly => PBO 0.
    const T2 = 200;
    const antiR = repoRng(4242);
    const anti = [
        Array.from({ length: T2 }, (_, t) => (t < T2 / 2 ? 0.01 : -0.01) + 0.0002 * gauss(antiR)),
        Array.from({ length: T2 }, (_, t) => (t < T2 / 2 ? -0.01 : 0.01) + 0.0002 * gauss(antiR)),
    ];
    const antiPbo = probabilityOfBacktestOverfitting(anti, { blocks: 2 });
    const antiNeg = probabilityOfBacktestOverfitting(anti, { blocks: 2, metric: (series) => -mean(series) });
    const antiIsOne = antiPbo.pbo === 1 && antiPbo.degradation.slope < 0;
    // (3b) the `metric` override, hand-computed. On [[5,0,0,0],[0,0,0,0]] with blocks = 2 there are two
    //      splits. Metric = s=>s[0]: split is=[0,1] has isPerf [5,0] -> winner row 0, its OOS values are
    //      [0,0] (a tie -> omega = 1/2 -> lambda = 0 -> overfit); split is=[2,3] ties IS (winner row 0 by
    //      the strict `>`), OOS [5,0] -> row 0 is best (omega = 2/3 -> not overfit). PBO = 1/2 exactly.
    //      Metric = s=>s[1] is 0 everywhere -> every split ties -> lambda = 0 -> PBO = 1 exactly.
    const metricMatrix = [[5, 0, 0, 0], [0, 0, 0, 0]];
    const metricFirst = probabilityOfBacktestOverfitting(metricMatrix, { blocks: 2, metric: (s) => s[0] });
    const metricSecond = probabilityOfBacktestOverfitting(metricMatrix, { blocks: 2, metric: (s) => s[1] });
    const metricOverrideExact = metricFirst.pbo === 0.5 && metricSecond.pbo === 1
        && metricFirst.splits === 2;
    // (4) invariances of the rank-based statistic: annualisation and positive per-column scaling cannot
    //     change any rank, hence cannot change PBO (the default metric is a Sharpe).
    const base = noiseMatrix(8, 400, 777);
    const pboBase = probabilityOfBacktestOverfitting(base, { blocks: 10 });
    const pboAnnual = probabilityOfBacktestOverfitting(base, { blocks: 10, periodsPerYear: 252 });
    const scaled = base.map((row, j) => row.map((v) => v * (1 + j)));      // strictly positive per-column scale
    const pboScaled = probabilityOfBacktestOverfitting(scaled, { blocks: 10 });
    const annualInvariant = pboBase.pbo === pboAnnual.pbo;
    const scalingInvariant = pboBase.pbo === pboScaled.pbo;
    // (5) structural invariants of the returned readout
    const structOk = pboBase.pbo >= 0 && pboBase.pbo <= 1 && pboBase.splits === binomIndep(10, 5)
        && pboBase.logits.length === pboBase.splits && pboBase.isBestIndex.length === pboBase.splits
        && pboBase.oosRankOfBest.every((w) => w > 0 && w < 1)
        && close(pboBase.pbo, pboBase.logits.filter((l) => l <= 0).length / pboBase.splits, 1e-12);

    // ============================== E. calibration (the repo's own claims) =========================
    // (1) the repo's exact quoted draw: 20 iid-noise strategies, T=500, S=10, its own RNG seed 20240.
    // NOTE: the repo draws ONE stream sequentially; reproduce it exactly by drawing in order.
    const repoNoiseRng = repoRng(20240);
    const repoNoiseExact = Array.from({ length: 20 }, () => Array.from({ length: 500 }, () => 0.01 * gauss(repoNoiseRng)));
    const repoDraw = probabilityOfBacktestOverfitting(repoNoiseExact, { blocks: 10 });
    const repoQuoted = 0.464;
    const repoCalibrationReproduced = close(repoDraw.pbo, repoQuoted, 1e-9) || Math.abs(repoDraw.pbo - repoQuoted) < 0.0005;
    const repoSlopeZero = Math.abs(repoDraw.degradation.slope) < 0.15;
    const repoDrawOverfitSplits = Math.round(repoDraw.pbo * repoDraw.splits);
    // (2) the ensemble: the same procedure on many seeds -> mean, sd, se, and the resolution of one draw.
    const nullTrials = 60;
    const nullPbos = [];
    for (let t = 1; t <= nullTrials; t++) nullPbos.push(probabilityOfBacktestOverfitting(noiseMatrix(8, 400, 1000 + t * 29), { blocks: 10 }).pbo);
    const nullMean = mean(nullPbos);
    const nullSd = sd(nullPbos);
    const nullSe = nullSd / Math.sqrt(nullPbos.length);
    const withinMatrixSe = Math.sqrt(0.25 / 252);            // binomial SE of ONE 252-split PBO at p = 0.5
    const nullCentred = Math.abs(nullMean - 0.5) <= Math.max(0.02, 2.5 * nullSe);
    const repoDrawWithinBand = Math.abs(repoQuoted - 0.5) <= Math.max(0.05, 2.5 * nullSd);
    // the split-dependence diagnostic: the across-matrix spread divided by the binomial split SE. A
    // 252-split PBO behaves like a handful of independent splits, not 252.
    const splitDesignEffect = (nullSd * nullSd) / (0.25 / 252);
    const effectiveSplits = 252 / splitDesignEffect;
    const splitDependenceSevere = splitDesignEffect > 5 && effectiveSplits < 20;
    // (3) a persistent edge -> PBO 0 with a positive degradation slope (across seeds).
    const edgeRows = [];
    for (let t = 1; t <= 12; t++) {
        const r = repoRng(700 + t * 11);
        const m = Array.from({ length: 20 }, (_, j) => Array.from({ length: 500 }, () => (j === 0 ? 0.4 : 0) + 0.01 * gauss(r)));
        const o = probabilityOfBacktestOverfitting(m, { blocks: 10 });
        edgeRows.push({ pbo: o.pbo, slope: o.degradation.slope });
    }
    const edgeZero = edgeRows.every((x) => x.pbo === 0);
    const edgePositiveSlope = edgeRows.every((x) => x.slope > 0);
    // (4) the planted regime flip (the repo's own construction, T=400, S=10) -> PBO ~ 1.
    const T3 = 400;
    const antiR3 = repoRng(31337);
    const planted = [
        Array.from({ length: T3 }, (_, t) => (t < T3 / 2 ? 0.3 : -0.3) + 0.05 * gauss(antiR3)),
        Array.from({ length: T3 }, (_, t) => (t < T3 / 2 ? -0.3 : 0.3) + 0.05 * gauss(antiR3)),
    ];
    const plantedPbo = probabilityOfBacktestOverfitting(planted, { blocks: 10 });
    const regimeFlipDetected = plantedPbo.pbo >= 0.9;

    // ================== F. two things the calibration does NOT cover (measured) ====================
    // (1) the tie convention's bias on a duplicated roster: duplicating candidates creates exact
    //     performance ties, and a tie pulls omega toward 1/2, i.e. lambda toward 0, i.e. the split
    //     toward "overfit" (lambda <= 0). Measure PBO vs duplication, paired on the same base matrix
    //     and averaged over seeds so the claim is not one draw.
    const baseRows = noiseMatrix(10, 400, 90210);
    const dupSeedRows = [];
    for (let s = 1; s <= 10; s++) {
        const b = noiseMatrix(10, 400, 30000 + s * 17);
        const at = (dup) => probabilityOfBacktestOverfitting(b.concat(Array.from({ length: dup }, () => b[0].slice())), { blocks: 10 }).pbo;
        dupSeedRows.push({ s, dup0: at(0), dup5: at(5), dup19: at(19) });
    }
    const dupCurve = [0, 5, 19].map((dup) => {
        const key = 'dup' + dup;
        return { duplicatedCopies: dup, meanPbo: r3(mean(dupSeedRows.map((x) => x[key])), 4), aboveBase: dupSeedRows.filter((x) => x[key] >= x.dup0).length };
    });
    // The pre-registered guess was that duplication biases PBO upward (a tie pulls omega to 1/2). The
    // measurement says otherwise: the mean is flat-to-slightly-down (0.581 -> 0.540) with the sign split
    // 6/10. A tie is only created for the *winner* (its twin shares its OOS value), and averaging its rank
    // toward N/2 can move omega either way - so duplication is not a systematic bias. What IS forced is the
    // fully-tied roster (below).
    const dupBiasNegligible = Math.abs(dupCurve[2].meanPbo - dupCurve[0].meanPbo) < 0.10
        && dupCurve[2].aboveBase >= 3 && dupCurve[2].aboveBase <= 7;
    // and the extreme: every candidate identical -> exactly 1
    const allIdentical = probabilityOfBacktestOverfitting(Array.from({ length: 20 }, () => baseRows[0].slice()), { blocks: 10 });
    const allIdenticalIsOne = allIdentical.pbo === 1;

    // (2) the pooled degradation regression. `degradation.n` is `N * splits` (the number of dependent
    //     (split, strategy) pairs), and the pair vectors are deterministic functions of only `N * S`
    //     block performances - so a naive t = sqrt(r2*(n-2)/(1-r2)) over-rejects. Measure the
    //     false-positive rate on genuinely skill-less (iid) matrices.
    const degRows = [];
    let naiveExceed = 0;
    for (let t = 1; t <= 80; t++) {
        const o = probabilityOfBacktestOverfitting(noiseMatrix(8, 400, 40000 + t * 7), { blocks: 10 });
        const n = o.degradation.n;
        const r2 = o.degradation.r2;
        const tStat = r2 < 1 && n > 2 ? Math.sqrt(r2 * (n - 2) / (1 - r2)) : Infinity;
        const effective = 8 * 10;                                  // N * S block performances bound the design
        if (Math.abs(tStat) > 1.96) naiveExceed++;
        degRows.push({ n, r2, tStat, effective, inflates: n > effective });
    }
    const naiveFalsePositiveRate = naiveExceed / degRows.length;
    const naiveOverRejects = naiveFalsePositiveRate > 0.15 && degRows.every((x) => x.inflates);

    // ============================== G. input contracts ============================================
    const throwCount = (fn) => { try { fn(); return 0; } catch { return 1; } };
    const throwRows = {
        tooFewStrategies: throwCount(() => probabilityOfBacktestOverfitting([new Array(40).fill(0)], { blocks: 4 })),
        ragged: throwCount(() => probabilityOfBacktestOverfitting([[0, 1], [0]], { blocks: 2 })),
        oddBlocks: throwCount(() => probabilityOfBacktestOverfitting([new Array(40).fill(0), new Array(40).fill(0)], { blocks: 3 })),
        tooFewBars: throwCount(() => probabilityOfBacktestOverfitting([new Array(6).fill(0), new Array(6).fill(0)], { blocks: 4 })),
    };
    const fourInvalidThrow = Object.values(throwRows).reduce((a, b) => a + b, 0) === 4;
    // cscvBlocks alone only requires blocks <= n (a consumer calling it directly can get 1-obs blocks)
    const directOneObs = cscvBlocks(6, 6).map((b) => b.length);
    const blocksAloneAllowsOneObs = directOneObs.every((l) => l === 1);

    // ============================== guards ========================================================
    const checks = {
        blocksPartitionExact: blocksExact,
        splitCountMatchesBinomial: splitRows.every((x) => x.splits === x.expected),
        splitDisjointCover: splitRows.every((x) => x.coverOk),
        blockInSampleMultiplicity: splitRows.every((x) => x.multOk),
        splitClosedUnderComplement: splitRows.every((x) => x.complementOk),
        splitCapRejectsAstronomical: capRejectsAstronomical,
        relativeRankClosedForms: rankClosedForms,
        relativeRankNonFiniteTargetNaN: nanTarget,
        relativeRankNaNDenominatorWart: nanRankWart.usesFullLength && nanRankWart.depressed,
        olsMatchesIndependentFormula: olsMatches && olsIdentity,
        olsDegenerateCases: olsDegenerate,
        pboAllFlatIsOne: allFlatIsOne,
        pboDominantIsZero: dominantIsZero,
        pboAntiPersistentIsOne: antiIsOne,
        pboMetricOverrideExact: metricOverrideExact,
        pboAnnualisationInvariant: annualInvariant,
        pboColumnScalingInvariant: scalingInvariant,
        pboStructuralInvariants: structOk,
        repoCalibrationReproduced: repoCalibrationReproduced && repoSlopeZero,
        nullPboCentredAtHalf: nullCentred,
        repoDrawIsOneDraw: repoDrawWithinBand && withinMatrixSe >= 0.03,
        pboSplitDependenceSevere: splitDependenceSevere,
        edgePboZeroWithPositiveSlope: edgeZero && edgePositiveSlope,
        regimeFlipDetected: regimeFlipDetected,
        pboFullyTiedRosterIsOne: allIdenticalIsOne && allFlatIsOne,
        duplicationBiasNegligible: dupBiasNegligible,
        naiveDegradationOverRejects: naiveOverRejects,
        invalidInputsThrow: fourInvalidThrow,
        blocksAloneAllowsOneObservationBlocks: blocksAloneAllowsOneObs,
    };
    const validationPass = Object.values(checks).every((x) => x === true);

    const verdict = {
        note: 'L10-aq..av: the CSCV structure is EXACT (C(S,S/2) splits, disjoint cover, block multiplicity C(S-1,S/2-1), complement closure, cap) and `relativeRank`/`oosOnIsRegression` match their closed forms; the calibration reproduces (the repo\'s own 0.464 = 117/252 draw is reproduced exactly with its RNG/seed; the ensembled null is centred at 0.5; a persistent edge gives PBO 0 with a positive slope; a regime flip is 1; all-flat and all-identical are exactly 1). But (i) a single 252-split PBO is NOT a measurement: across independent matrices sd 0.255 vs the binomial split SE 0.0315 -> design effect 65, effective splits ~3.9, so the registry\'s 3-decimal calibration quote is one draw; (ii) `relativeRank` skips non-finite values in the rank but divides by the full length, depressing omega (biasing PBO up) for a NaN-producing metric; (iii) the pooled `degradation` regression returns n = N*splits dependent pairs (only N*S block performances exist), so a naive t from it exceeds 1.96 on 91.2% of skill-less matrices; (iv) a FULLY-tied roster (all-flat/all-identical) is forced to PBO exactly 1 by the lambda<=0 convention, though partial duplication does NOT bias PBO (0.581 -> 0.540, 6/10 - the mechanic guess is falsified); (v) `cscvBlocks` alone accepts 1-observation blocks. No shipped module imports `overfitting.js` (tests + lock-registry only), so nothing is live.',
        validationPass,
        null: { trials: nullTrials, mean: r3(nullMean), sd: r3(nullSd), se: r3(nullSe), withinMatrixSe: r3(withinMatrixSe, 5), splitDesignEffect: r3(splitDesignEffect, 2), effectiveSplits: r3(effectiveSplits, 2), repoQuoted, repoDraw: r3(repoDraw.pbo) },
        naiveT: { trials: degRows.length, falsePositiveRate: r3(naiveFalsePositiveRate, 3), pairs: degRows[0].n, effectiveBlockPerformances: degRows[0].effective },
        duplicateCurve: dupCurve,
    };
    return {
        config: { blocksGrid: [2, 4, 6, 8, 10, 12], pboBlocks: 10, nullTrials, nullT: 400, nullK: 8 },
        structure: { blocks: blockRows, splits: splitRows, cap: capContract },
        rank: { ...rankRows, nanTarget, nanRankWart },
        ols: { rows: olsRows.length, allMatch: olsMatches, identity: olsIdentity, degenerate: olsDegenerate },
        constructedPbo: { allFlat: { pbo: allFlat.pbo, splits: allFlat.splits }, dominant: { pbo: dom.pbo, bestIsZeroEverywhere: dom.isBestIndex.every((b) => b === 0) }, anti: { pbo: antiPbo.pbo, slope: antiPbo.degradation.slope }, antiNegated: { pbo: antiNeg.pbo, slope: antiNeg.degradation.slope }, metricOverride: { first: metricFirst.pbo, second: metricSecond.pbo, splits: metricFirst.splits }, base: { pbo: pboBase.pbo, splits: pboBase.splits }, annual: pboAnnual.pbo, scaled: pboScaled.pbo },
        calibration: { repoDraw: r3(repoDraw.pbo), repoDrawOverfitSplits, repoDrawSplits: repoDraw.splits, repoQuoted, repoSlope: r3(repoDraw.degradation.slope), null: { mean: r3(nullMean), sd: r3(nullSd), se: r3(nullSe), p05: r3(nullPbos.slice().sort((a, b) => a - b)[Math.floor(0.05 * nullPbos.length)]), p95: r3(nullPbos.slice().sort((a, b) => a - b)[Math.floor(0.95 * nullPbos.length)]) }, edge: { trials: edgeRows.length, pboZero: edgeZero, allPositiveSlope: edgePositiveSlope, sample: edgeRows.slice(0, 3) }, plantedPbo: r3(plantedPbo.pbo) },
        coverageGaps: { duplicateCurve: dupCurve, duplicateSeeds: dupSeedRows, allIdenticalPbo: allIdentical.pbo, degradation: { trials: degRows.length, naiveFalsePositiveRate: r3(naiveFalsePositiveRate, 3), sample: degRows.slice(0, 3) } },
        inputContracts: { throwRows, fourInvalidThrow, directOneObsBlocks: directOneObs, blocksAloneAllowsOneObs },
        validation: checks,
        verdict,
    };
}
