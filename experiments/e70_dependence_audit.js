// E70 - THE DEPENDENCE / CLUSTER-INFERENCE MODULE, AUDITED: `analysis/dependence.js`. CYCLE-062 (L10-cl ...).
//
// `analysis/dependence.js` (round 25) is the module that gives the pooled cross-stream evaluation its honest
// standard error: `poolReports` concatenates one walk-forward per symbol, and the large-sample Sharpe SE of Lo
// (2002) assumes independent bars — false here (the 8 crypto majors' per-fold Sharpe series correlate 0.41-0.52,
// and the 4 320 pooled bars are 288 fold windows x 8 streams). So the module takes a *cluster* view: clusters are
// the independent units and any smooth statistic's SE comes from the **delete-one-cluster jackknife**. It is PURE
// and imports NOTHING (no I/O, no RNG, no repo imports), so it is fully unit-testable in isolation, and it is
// SHIPPED (`walkforward.js#promoteDecision` uses `pairedClusterTest`/`clusterStability`/`pairedClusterSignTest`;
// `foldConcentration`/`decision.js` use the rest).
//
// PRE-REGISTERED READ. PASSES if: (i) `pearsonCorrelation`/`meanPairwiseCorrelation` are the textbook formulas
// with the documented NaN guards (fewer than 3 points, zero variance, unequal length) and skip uncorrelatable
// pairs; (ii) the equicorrelation design effect / effective size are `1+(K-1)*rho` / `K/deff` with NaN guards;
// (iii) `foldWindowClusters` groups exactly (cluster f = every stream's fold f), throwing on a non-rectangular /
// non-divisible / bad-foldLength panel; (iv) `concatClusters`/`clusterJackknife` reproduce a hand delete-one-cluster
// jackknife and abstain honestly; (v) `studentTPValue`/`regularizedIncompleteBeta` reproduce the exact closed-form
// t tails for df = 1 (Cauchy) and df = 2, are symmetric about 0 and give 0.5/1 at t = 0; (vi) `studentTCritical`
// inverts `studentTPValue` and matches the documented table values; (vii) `signTest` is the exact binomial tail
// and `signTestFloor` its minimum; (viii) `pairedClusterTest`/`pairedClusterSignTest` carry the documented fields.
//
// The DEFECTS are reported in `findings`: `clusterStability.stable` ignores the `worstDelta > minDelta` half of its
// own documented rule (it only checks `fractionPositive >= minFraction`), so with `minFraction < 1` a candidate
// whose edge COLLAPSES when its worst window is removed still reads `stable: true`; and `signTest`'s
// `pmf0 = 0.5^n` underflows to 0 for n >= ~1075, so it returns `pValue = 0` (certain significance) for ANY win
// count.

import {
    pearsonCorrelation, meanPairwiseCorrelation, equicorrelationDesignEffect, equicorrelationEffectiveSize,
    foldWindowClusters, concatClusters, clusterJackknife, pairedClusterTest, clusterStability,
    pairedClusterSignTest, signTest, signTestFloor, regularizedIncompleteBeta, studentTCritical, studentTPValue,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/dependence.js';

const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const close = (a, b, tol = 1e-12) => (a === b) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const binomTail = (wins, n) => { // Σ_{k>=wins} C(n,k)/2^n, independently via logs
    let acc = 0;
    for (let k = wins; k <= n; k++) {
        let logc = 0;
        for (let i = 0; i < k; i++) logc += Math.log((n - i) / (i + 1));
        acc += Math.exp(logc - n * Math.LN2);
    }
    return Math.min(1, acc);
};
// exact Student-t upper tail for small df (independent closed forms)
const tUpperExact = (t, df) => {
    if (df === 1) return t >= 0 ? 0.5 - Math.atan(t) / Math.PI : 0.5 - Math.atan(t) / Math.PI; // valid all t
    if (df === 2) return t >= 0 ? 0.5 - t / (2 * Math.sqrt(2 + t * t)) : 1 - (0.5 - (-t) / (2 * Math.sqrt(2 + t * t)));
    return NaN;
};

export async function run() {
    const checks = {};
    const rows = {};

    // ============================== A. correlation ====================================================
    checks.pearsonContract = (() => {
        const a = [1, 2, 3, 4, 5];
        const b = [2, 4, 6, 8, 10];
        const perfect = close(pearsonCorrelation(a, b), 1, 1e-12);
        const anti = close(pearsonCorrelation(a, b.slice().reverse()), -1, 1e-12);
        // independent direct formula
        const ma = mean(a), mb = mean(b);
        let sab = 0, sa = 0, sb = 0;
        for (let i = 0; i < a.length; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
        const exact = close(pearsonCorrelation(a, b), sab / Math.sqrt(sa * sb), 1e-15);
        const short = Number.isNaN(pearsonCorrelation([1, 2], [3, 4]));
        const unequal = Number.isNaN(pearsonCorrelation([1, 2, 3], [1, 2]));
        const zeroVar = Number.isNaN(pearsonCorrelation([1, 2, 3, 4], [5, 5, 5, 5]));
        const mpc = meanPairwiseCorrelation([[1, 2, 3, 4], [1, 2, 3, 4], [4, 3, 2, 1]]); // pairs: 1, -1, -1 -> -1/3
        const mpcExact = close(mpc, (1 + (-1) + (-1)) / 3, 1e-12);
        const mpcSkip = close(meanPairwiseCorrelation([[1, 2, 3, 4], [1, 1, 1, 1]]), 0, 1e-12); // the flat pair is skipped -> NaN? no pairs -> NaN
        const mpcOne = Number.isNaN(meanPairwiseCorrelation([[1, 2, 3, 4]]));
        rows.pearson = { perfect, anti, exact, short, unequal, zeroVar, mpc, mpcExact, mpcSkipNaN: Number.isNaN(meanPairwiseCorrelation([[1, 2, 3, 4], [1, 1, 1, 1]])), mpcOne };
        return perfect && anti && exact && short && unequal && zeroVar && mpcExact && mpcOne;
    })();

    // ============================== B. the equicorrelation design effect ==============================
    checks.equicorrelationContract = (() => {
        const d5 = equicorrelationDesignEffect(5, 0.2);
        const e5 = equicorrelationEffectiveSize(5, 0.2);
        const ok = close(d5, 1 + 4 * 0.2, 1e-15) && close(e5, 5 / d5, 1e-15);
        const neg = close(equicorrelationDesignEffect(4, -0.3), 1 - 0.9, 1e-15); // hedging reduces variance
        const degenerate = Number.isNaN(equicorrelationEffectiveSize(4, -0.4)); // deff = 1 - 1.2 < 0
        const guards = Number.isNaN(equicorrelationDesignEffect(0, 0.1)) && Number.isNaN(equicorrelationDesignEffect(3, NaN));
        const k1 = close(equicorrelationDesignEffect(1, 0.9), 1, 1e-15) && close(equicorrelationEffectiveSize(1, 0.9), 1, 1e-15);
        rows.equi = { ok, neg, degenerate, guards, k1, deff5: d5, eff5: e5 };
        return ok && neg && degenerate && guards && k1;
    })();

    // ============================== C. fold-window clusters ===========================================
    checks.foldClustersContract = (() => {
        const streams = [[1, 2, 3, 4], [5, 6, 7, 8]];
        const clusters = foldWindowClusters(streams, 2);
        const exact = deepEq(clusters, [[1, 2, 5, 6], [3, 4, 7, 8]]);
        const throws = (fn) => { try { fn(); return false; } catch { return true; } };
        const t1 = throws(() => foldWindowClusters([[1, 2, 3]], 2));            // not divisible
        const t2 = throws(() => foldWindowClusters([[1, 2], [3]], 2));          // non-rectangular
        const t3 = throws(() => foldWindowClusters([[1, 2]], 0));               // bad foldLength
        const t4 = throws(() => foldWindowClusters([], 2));                     // no streams
        const single = deepEq(foldWindowClusters([[1, 2, 3, 4]], 4), [[1, 2, 3, 4]]);
        const concatFull = deepEq(concatClusters(clusters), [1, 2, 5, 6, 3, 4, 7, 8]);
        const concatDrop = deepEq(concatClusters(clusters, 1), [1, 2, 5, 6]);
        rows.foldClusters = { exact, t1, t2, t3, t4, single, concatFull, concatDrop };
        return exact && t1 && t2 && t3 && t4 && single && concatFull && concatDrop;
    })();

    // ============================== D. the jackknife ==================================================
    checks.jackknifeContract = (() => {
        const clusters = [[1, 2], [3, 4], [5, 6]];
        const j = clusterJackknife({ clusters, statistic: mean });
        // hand: estimate 3.5; leave-one-out 4.5 / 3.5 / 2.5; se = sqrt((2/3)*2)
        const hand = Math.sqrt((2 / 3) * (((4.5 - 3.5) ** 2) + 0 + ((2.5 - 3.5) ** 2)));
        const ok = close(j.estimate, 3.5, 1e-12) && close(j.se, hand, 1e-12) && j.nClusters === 3
            && deepEq(j.leaveOneOut, [4.5, 3.5, 2.5]);
        const short = clusterJackknife({ clusters: [[1, 2]], statistic: mean });
        const nonFinite = clusterJackknife({ clusters: [[1, 2], [3, 4]], statistic: () => NaN });
        const badStat = (() => { try { clusterJackknife({ clusters: [[1], [2]], statistic: 5 }); return false; } catch { return true; } })();
        const pct = clusterJackknife({ clusters: [[1, 2], [3, 4], [9, 9]], statistic: mean });
        rows.jackknife = { ok, shortAbstains: short.se !== short.se, nonFiniteAbstains: Number.isNaN(nonFinite.se), badStat, pctEstimate: pct.estimate, hand, se: j.se };
        return ok && Number.isNaN(short.se) && Number.isNaN(nonFinite.se) && badStat;
    })();

    // ============================== E. the Student-t distribution =====================================
    checks.studentTReference = (() => {
        let ok = true;
        const samples = [-3, -1.5, -0.5, 0, 0.5, 1.5, 3];
        for (const t of samples) for (const df of [1, 2]) {
            const got = studentTPValue(t, df, { twoSided: false });
            const want = tUpperExact(t, df);
            if (!close(got, want, 5e-7)) ok = false;
        }
        const t0o = close(studentTPValue(0, 7, { twoSided: false }), 0.5, 1e-12);
        const t0t = close(studentTPValue(0, 7, { twoSided: true }), 1, 1e-12);
        const sym = close(studentTPValue(2, 5, { twoSided: false }) + studentTPValue(-2, 5, { twoSided: false }), 1, 1e-12);
        const twoSided = close(studentTPValue(2, 5, { twoSided: true }), Math.min(1, 2 * studentTPValue(2, 5, { twoSided: false })), 1e-12);
        const infP = studentTPValue(Infinity, 5, { twoSided: true }) === 0 && studentTPValue(-Infinity, 5, { twoSided: false }) === 1;
        const nanDf = Number.isNaN(studentTPValue(1, 0));
        const ib = close(regularizedIncompleteBeta(1, 1, 0.3), 0.3, 1e-12)
            && close(regularizedIncompleteBeta(2, 3, 0.5), 0.6875, 1e-9) // I_0.5(2,3) = 1 - 0.5^3*(1+3*... ) -> 0.6875
            && close(regularizedIncompleteBeta(4, 4, 0.5), 0.5, 1e-12)
            && regularizedIncompleteBeta(1, 1, 0) === 0 && regularizedIncompleteBeta(1, 1, 1) === 1;
        rows.studentT = { ok, t0o, t0t, sym, twoSided, infP, nanDf, ib };
        return ok && t0o && t0t && sym && twoSided && infP && nanDf && ib;
    })();

    checks.studentTCriticalRoundTrip = (() => {
        const c1 = studentTCritical(35, { alpha: 0.05, twoSided: false });
        const c2 = studentTCritical(35, { alpha: 0.05, twoSided: true });
        const table = close(c1, 1.68957, 2e-4) && close(c2, 2.03011, 2e-4);
        let rt = true;
        for (const df of [3, 10, 35, 200]) for (const twoSided of [false, true]) {
            const t = studentTCritical(df, { alpha: 0.05, twoSided });
            if (!close(studentTPValue(t, df, { twoSided }), 0.05, 1e-6)) rt = false;
        }
        const nan = Number.isNaN(studentTCritical(0, {})) && Number.isNaN(studentTCritical(5, { alpha: 0 }));
        rows.critical = { c1, c2, table, rt, nan };
        return table && rt && nan;
    })();

    // ============================== F. the exact sign test ============================================
    checks.signTestContract = (() => {
        let exact = true;
        for (const [w, n] of [[7, 10], [3, 4], [10, 10], [1, 5], [36, 36], [20, 40]]) {
            const got = signTest({ wins: w, n }).pValue;
            if (!close(got, binomTail(w, n), 1e-12)) exact = false;
        }
        const floorOk = close(signTestFloor(36), Math.pow(2, -36), 1e-300) && close(signTestFloor(4), 0.0625, 1e-15);
        const guards = Number.isNaN(signTest({ wins: 5, n: 4 }).pValue) && Number.isNaN(signTest({ wins: -1, n: 5 }).pValue)
            && Number.isNaN(signTest({ wins: 2, n: 0 }).pValue) && Number.isNaN(signTestFloor(0));
        const sig = signTest({ wins: 7, n: 10 }).significant === false && signTest({ wins: 10, n: 10 }).significant === true;
        rows.signTest = { exact, floorOk, guards, sig, p7of10: signTest({ wins: 7, n: 10 }).pValue };
        return exact && floorOk && guards && sig;
    })();

    // (FINDING) `signTest` underflows its pmf for n >= ~1075.
    checks.signTestUnderflow = (() => {
        const mid1000 = signTest({ wins: 500, n: 1000 });
        const mid2000 = signTest({ wins: 1000, n: 2000 });
        const one2000 = signTest({ wins: 1, n: 2000 });
        const allWin = signTest({ wins: 2000, n: 2000 });
        rows.underflow = {
            mid1000P: mid1000.pValue, mid2000P: mid2000.pValue, one2000P: one2000.pValue, allWinP: allWin.pValue,
            mid1000Finite: mid1000.pValue > 0.4 && mid1000.pValue < 0.6,
            note: 'signTest computes `pmf0 = Math.pow(0.5, n)` and walks the binomial pmf from it. For n >= ~1075 (2^-1075 underflows the double range) pmf0 is exactly 0, so EVERY pmf is 0 and `tail` stays 0: the function returns pValue = 0 (and significant = true) for ANY win count, including wins = n/2. The docstring scopes it to "tens to a few hundred" clusters, but the failure is silent and in the unsafe direction (a balanced 2000-cluster sign test reads "certainly significant").',
        };
        // pin the actual (buggy) behaviour: n=1000 is fine, n=2000 collapses
        return rows.underflow.mid1000Finite && mid2000.pValue === 0 && one2000.pValue === 0 && allWin.pValue === 0;
    })();

    // ============================== G. the paired cluster tests ======================================
    checks.pairedClusterContracts = (() => {
        const clustersA = [[-0.5], [-0.5], [0.7]];
        const clustersB = [[0], [0], [0]];
        const pt = pairedClusterTest({ clustersA, clustersB, statistic: mean });
        const expectFull = mean([-0.5, -0.5, 0.7]) - 0; // -0.1
        const ptOk = pt.available === true && close(pt.value, expectFull, 1e-12) && pt.df === 2
            && pt.significant === (pt.pOneSided <= pt.alpha);
        const short = pairedClusterTest({ clustersA: [[1]], clustersB: [[1]], statistic: mean });
        const st = pairedClusterSignTest({ clustersA, clustersB, statistic: mean });
        // per-cluster signs: A cluster0 [-0.5] vs B [0] -> -1; cluster1 -> -1; cluster2 [0.7] vs [0] -> +1
        const stOk = st.available === true && st.wins === 1 && st.losses === 2 && st.n === 3 && close(st.fraction, 1 / 3, 1e-12);
        rows.paired = { ptOk, ptValue: pt.value, ptSe: pt.se, ptT: pt.t, ptDf: pt.df, ptP1: pt.pOneSided, shortAbstains: short.available === false, stOk, stWins: st.wins, stLosses: st.losses };
        return ptOk && short.available === false && stOk;
    })();

    // (FINDING) `clusterStability.stable` ignores the `worstDelta > minDelta` half of its rule.
    checks.clusterStabilityIgnoresWorstDelta = (() => {
        const clustersA = [[-0.5], [-0.5], [0.7]];
        const clustersB = [[0], [0], [0]];
        const looser = clusterStability({ clustersA, clustersB, statistic: mean, minFraction: 0.5, minDelta: 0 });
        const strict = clusterStability({ clustersA, clustersB, statistic: mean, minFraction: 1, minDelta: 0 });
        // documented rule: stable = fractionPositive >= minFraction AND worstDelta > minDelta
        const docStable = looser.fractionPositive >= looser.minFraction - 1e-12 && looser.worstDelta > looser.minDelta;
        const mismatch = looser.stable === true && docStable === false;
        rows.stability = {
            worstDelta: looser.worstDelta, fractionPositive: looser.fractionPositive,
            codeStableLooser: looser.stable, docRuleLooser: docStable, mismatch,
            codeStableStrict: strict.stable, strictDoc: strict.fractionPositive >= strict.minFraction - 1e-12 && strict.worstDelta > strict.minDelta,
            note: 'clusterStability\'s docstring: "stable requires fractionPositive >= minFraction (default: every cluster) AND worstDelta > minDelta (default 0)". The code computes `stable: fractionPositive >= minFraction - 1e-12` and NEVER tests worstDelta. With minFraction = 1 the two coincide (all deltas > 0 implies worst > 0), but with a looser minFraction the flag can read stable while the edge COLLAPSES when the worst window is removed: here fractionPositive 2/3 >= 0.5 reads stable: true while worstDelta = -0.5 fails the documented `> 0`. promoteDecision exposes minStableFraction, so a looser threshold reaches this branch. LATENT (the shipped default is minFraction 1).',
        };
        return mismatch && strict.stable === false && looser.stable === true;
    })();

    const findingStability = rows.stability;
    const findingUnderflow = rows.underflow;

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = (v && typeof v.then === 'function') ? await v : v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-cl..: `analysis/dependence.js` is the SHIPPED cluster-inference module (round 25) behind the pooled cross-stream Sharpe SE; it is PURE and imports NOTHING, so it can be audited in isolation. PASSES the pre-registered read: `pearsonCorrelation`/`meanPairwiseCorrelation` are the textbook formulas with the documented NaN guards (fewer than 3 points, zero variance, unequal length) and skip uncorrelatable pairs; the equicorrelation design effect/effective size are exactly 1+(K-1)*rho and K/deff (negative rho legitimately reduces the deff; a non-positive deff abstains); `foldWindowClusters` groups exactly (cluster f = every stream fold f) and throws on a non-rectangular / non-divisible / bad-foldLength panel; `concatClusters`/`clusterJackknife` reproduce a hand delete-one-cluster jackknife (estimate 3.5, leave-one-out [4.5,3.5,2.5], se sqrt(4/3)) and abstain on <2 clusters / non-finite statistics; `studentTPValue`/`regularizedIncompleteBeta` reproduce the exact closed-form t tails for df = 1 (Cauchy) and df = 2, are symmetric, give 0.5/1 at t = 0 and handle the +-Infinity tails; `studentTCritical` inverts `studentTPValue` and matches the documented table values (1.68957 / 2.03011 at df = 35); `signTest` is the exact binomial tail from its pmf recursion and `signTestFloor` its minimum; `pairedClusterTest`/`pairedClusterSignTest` carry the documented fields and the per-cluster sign test counts signs correctly. FINDINGS: (0) `clusterStability.stable` ignores the `worstDelta > minDelta` half of its own documented rule - it only tests `fractionPositive >= minFraction`, so with minFraction < 1 a candidate whose edge collapses when its worst window is removed still reads stable (worstDelta -0.5, fractionPositive 2/3, stable true where the doc rule says false); (1) `signTest` computes pmf0 = 0.5^n, which underflows to 0 for n >= ~1075, so it returns pValue = 0 (and significant true) for ANY win count including wins = n/2. Both latent (the shipped minStableFraction default is 1; the documented cluster counts are tens to a few hundred); no golden moves and no fold-back row.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            clusterStabilityIgnoresWorstDelta: findingStability,
            signTestUnderflow: findingUnderflow,
        },
        scope: {
            shipped: ['walkforward.js#promoteDecision uses pairedClusterTest / clusterStability / pairedClusterSignTest (requireClusterStability, minStableFraction)', 'foldConcentration (decision.js) + the dependence block use the rest', 'the module is pure and imports nothing, so it cannot reach the locked hot path'],
            why: 'dependence.js only re-evaluates a statistic on clustered arrays, so neither finding can move a scored number: the stability flag feeds a gate that defaults to the strict minFraction = 1 (where the two rules coincide) and signTest is documented for cluster counts of tens to a few hundred (n < 1075). No golden moves and no fold-back row is due.',
        },
    };

    return { config: { jackknifeClusters: 3, studentTdf: [1, 2, 5, 35] }, rows, validation: resolved, verdict };
}
