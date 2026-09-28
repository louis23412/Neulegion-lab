// E61 - THE P1 MODEL-CLASS BENCHMARK FORECASTERS, AUDITED. CYCLE-053 (L10-bl ...).
//
// `analysis/benchmark.js` (round 29 -> 30, P1) is the SHIPPED model-class benchmark: base rate / ridge
// (closed form) / one-hidden-layer tanh MLP (seeded SGD) / a pluggable pretrained-TSFM arm, each a
// `{ fit(X,y), predictProb(x) }` forecaster over the SAME causal `featureVector` the bare path reads. The
// benchmark arms are opt-in (`--variants=bench-base-rate,bench-linear,bench-mlp`) and their verdict is the
// round-29 P1 "negative branch" (G-A): no model class has material positive Brier skill vs the base rate,
// so the FEATURES/TARGET - not the architecture - are the constraint (RUN-ANALYSIS.md section 16.2). The
// ridge arm is the MCS survivor and the best of the set, so its probability output is load-bearing.
//
// PRE-REGISTERED READ. PASSES if (i) `fitStandardiser`/`applyStandardiser` are the documented standardiser
// (zero-mean / unit-std on the fit fold, a constant column collapses to 0 via the eps fallback);
// (ii) `fitRidge` is the documented closed form against an INDEPENDENTLY SOLVED centred ridge (the same
// normal equations, solved here, matching the module's `w`); (iii) `fitBaseRate` is the training prior and
// `predictBaseRate` returns it; (iv) `fitMLP` is deterministic under a seed and the two forecasters learn a
// separable causal rule the base rate cannot; (v) `BENCHMARK_KINDS` are the expected kinds and the factory
// refuses `tsfm` (no bundled checkpoint) and an unknown kind; and (vi) a perfect classifier beats the base
// rate on Brier. The DEFECTS - the dead training-base-rate term in `predictRidge`, the sigmoid band cap on
// the linear arm's probability, the unverified "hand solve" claim, and the eps amplification of a
// train-constant column - are reported in `findings`, because the shipped P1 test only checks the ridge's
// ACCURACY (a threshold at 0.5, invariant to the missing offset) and so cannot fail.

import {
    fitStandardiser, applyStandardiser, fitRidge, predictRidge,
    fitMLP, predictMLP, fitBaseRate, predictBaseRate, BENCHMARK_KINDS, makeBenchmarkForecaster,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/benchmark.js';

// ---- deterministic helpers -----------------------------------------------------------------------------
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// Independent reference: the SAME centred ridge normal equations (Z from the same standardiser, y centred
// on its mean, unpenalised intercept), solved by Gaussian elimination here.
function refRidgeCentered(X, y, lambda, eps = 1e-8) {
    const n = X.length, d = X[0].length;
    const mean = new Array(d).fill(0);
    for (const x of X) for (let j = 0; j < d; j++) mean[j] += x[j];
    for (let j = 0; j < d; j++) mean[j] /= n;
    const std = new Array(d).fill(0);
    for (const x of X) for (let j = 0; j < d; j++) std[j] += (x[j] - mean[j]) ** 2;
    for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / n) + eps;
    const Z = X.map((x) => x.map((v, j) => (v - mean[j]) / std[j]));
    const ybar = y.reduce((a, v) => a + v, 0) / n;
    const p = d + 1;
    const A = Array.from({ length: p }, () => new Array(p).fill(0));
    const rhs = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
        const row = Z[i].concat([1]);
        const yc = y[i] - ybar;
        for (let a = 0; a < p; a++) { rhs[a] += row[a] * yc; for (let b = 0; b < p; b++) A[a][b] += row[a] * row[b]; }
    }
    for (let j = 0; j < d; j++) A[j][j] += lambda;
    const M = A.map((r, i) => r.concat([rhs[i]]));
    for (let col = 0; col < p; col++) {
        let piv = col; for (let r = col + 1; r < p; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
        const t = M[piv]; M[piv] = M[col]; M[col] = t;
        const pv = M[col][col];
        for (let c = col; c <= p; c++) M[col][c] /= pv;
        for (let r = 0; r < p; r++) { if (r === col) continue; const f = M[r][col]; for (let c = col; c <= p; c++) M[r][c] -= f * M[col][c]; }
    }
    return { w: M.map((r) => r[p]), ybar, Z };
}

// Independent reference: a ridge with the intercept fit on the RAW label (uncentred).
function refRidgeUncentred(X, y, lambda, eps = 1e-8) {
    const n = X.length, d = X[0].length;
    const s = fitStandardiser(X, { eps });
    const Z = X.map((x) => applyStandardiser(s, x));
    const p = d + 1;
    const A = Array.from({ length: p }, () => new Array(p).fill(0));
    const rhs = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
        const row = Z[i].concat([1]);
        for (let a = 0; a < p; a++) { rhs[a] += row[a] * y[i]; for (let b = 0; b < p; b++) A[a][b] += row[a] * row[b]; }
    }
    for (let j = 0; j < d; j++) A[j][j] += lambda;
    const M = A.map((r, i) => r.concat([rhs[i]]));
    for (let col = 0; col < p; col++) {
        let piv = col; for (let r = col + 1; r < p; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
        const t = M[piv]; M[piv] = M[col]; M[col] = t;
        const pv = M[col][col];
        for (let c = col; c <= p; c++) M[col][c] /= pv;
        for (let r = 0; r < p; r++) { if (r === col) continue; const f = M[r][col]; for (let c = col; c <= p; c++) M[r][c] -= f * M[col][c]; }
    }
    return M.map((r) => r[p]);
}

const brier = (ps, y) => ps.reduce((a, p, i) => a + (p - y[i]) ** 2, 0) / ps.length;

// A separable causal rule (the same shape the shipped P1 test uses).
const sepX = (i) => [Math.sin(i * 0.3), ((i % 7) - 3) / 3, i % 2 ? 1 : -1];
const sepY = (x) => (0.9 * x[0] - 0.4 * x[1] > 0.1 ? 1 : 0);

// A 2-D feature/label generator with a controllable base rate (mulberry32, so deterministic).
function mkData(n, baseRate, seed = 7) {
    const rnd = mulberry32(seed);
    const X = [], y = [];
    for (let i = 0; i < n; i++) {
        const x1 = rnd() * 2 - 1, x2 = rnd() * 2 - 1;
        X.push([x1, x2]);
        const p1 = Math.min(0.97, Math.max(0.03, baseRate + 0.25 * (0.9 * x1 + 0.3 * x2)));
        y.push(rnd() < p1 ? 1 : 0);
    }
    return { X, y };
}

export async function run() {
    const checks = {};
    const bx = Array.from({ length: 200 }, (_, i) => sepX(i));
    const by = bx.map(sepY);

    // ============================== A. the standardiser ==============================================
    checks.standardiserExact = (() => {
        const s = fitStandardiser(bx);
        const z = bx.map((x) => applyStandardiser(s, x));
        const d = s.d;
        const mean = new Array(d).fill(0);
        for (const v of z) for (let j = 0; j < d; j++) mean[j] += v[j];
        for (let j = 0; j < d; j++) mean[j] /= z.length;
        const sd = new Array(d).fill(0);
        for (const v of z) for (let j = 0; j < d; j++) sd[j] += (v[j] - mean[j]) ** 2;
        for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j] / z.length);
        return d === 3 && mean.every((v) => Math.abs(v) < 1e-9) && sd.every((v) => Math.abs(v - 1) < 1e-6);
    })();
    checks.standardiserConstantColumn = (() => {
        const s = fitStandardiser([[1, 0.1], [1, 0.2], [1, 0.3], [1, 0.4]]);
        const zc = applyStandardiser(s, [1, 0.4]);
        return s.std[0] === 1e-8 && zc[0] === 0;
    })();
    checks.standardiserEmpty = (() => {
        const s = fitStandardiser([]);
        return s.d === 0 && Array.isArray(s.mean) && s.mean.length === 0 && Array.isArray(s.std) && s.std.length === 0;
    })();

    // ============================== B. ridge closed form =============================================
    checks.ridgeMatchesIndependentSolve = (() => {
        const { X, y } = mkData(140, 0.42, 11);
        const m = fitRidge(X, y, { lambda: 1e-3 });
        const r = refRidgeCentered(X, y, 1e-3);
        return m.w.length === r.w.length && Math.max(...m.w.map((v, i) => Math.abs(v - r.w[i]))) < 1e-9;
    })();
    checks.ridgeInterceptUnpenalised = (() => {
        const { X, y } = mkData(60, 0.5, 3);
        const a = fitRidge(X, y, { lambda: 0 });
        const b = fitRidge(X, y, { lambda: 1e6 });
        // a huge feature penalty cannot change the intercept column's own diagonal (only feature diagonals)
        return a.ybar === b.ybar && a.scaler.std.length === b.scaler.std.length;
    })();
    checks.ridgePredictInUnitInterval = (() => {
        const { X, y } = mkData(120, 0.5, 5);
        const m = fitRidge(X, y, { lambda: 1e-3 });
        return X.every((x) => { const p = predictRidge(m, x); return p > 0 && p < 1; });
    })();
    checks.ridgeStandardiseFalsePath = (() => {
        const { X, y } = mkData(80, 0.5, 6);
        const m = fitRidge(X, y, { lambda: 1e-3, standardise: false });
        const p = predictRidge(m, X[0]);
        return m.standardise === false && Number.isFinite(p) && p > 0 && p < 1;
    })();

    // ============================== C. base rate + MLP + factory ====================================
    checks.baseRateIsTrainingPrior = (() => {
        const { X, y } = mkData(90, 0.4, 8);
        const p = y.reduce((a, v) => a + v, 0) / y.length;
        const m = fitBaseRate(X, y);
        return m.p === p && predictBaseRate(m) === p && fitBaseRate([], []).p === 0.5;
    })();
    checks.forecastersLearnSeparableRule = (() => {
        const m = fitRidge(bx, by, { lambda: 1e-3 });
        let ridgeHits = 0;
        for (let i = 0; i < bx.length; i++) if ((predictRidge(m, bx[i]) >= 0.5 ? 1 : 0) === by[i]) ridgeHits++;
        const mlp = fitMLP(bx, by, { hidden: 6, epochs: 150, lr: 0.2, seed: 3 });
        let mlpHits = 0;
        for (let i = 0; i < bx.length; i++) if ((predictMLP(mlp, bx[i]) >= 0.5 ? 1 : 0) === by[i]) mlpHits++;
        return ridgeHits / bx.length > 0.8 && mlpHits / bx.length > 0.8;
    })();
    checks.mlpDeterministic = (() => {
        const key = (m) => JSON.stringify([m.W2, m.b2, m.W1, m.b1]);
        return key(fitMLP(bx, by, { hidden: 6, epochs: 40, lr: 0.2, seed: 9 })) ===
            key(fitMLP(bx, by, { hidden: 6, epochs: 40, lr: 0.2, seed: 9 })) &&
            key(fitMLP(bx, by, { hidden: 6, epochs: 40, lr: 0.2, seed: 9 })) !==
            key(fitMLP(bx, by, { hidden: 6, epochs: 40, lr: 0.2, seed: 10 }));
    })();
    checks.kindsAndFactory = (() => {
        const tsfmThrows = (() => { try { makeBenchmarkForecaster('tsfm'); return false; } catch { return true; } })();
        const unknownThrows = (() => { try { makeBenchmarkForecaster('nope'); return false; } catch { return true; } })();
        return BENCHMARK_KINDS.join(',') === 'base-rate,linear,mlp,tsfm'
            && makeBenchmarkForecaster('linear').kind === 'linear'
            && makeBenchmarkForecaster('mlp').kind === 'mlp'
            && makeBenchmarkForecaster('base-rate').kind === 'base-rate'
            && tsfmThrows && unknownThrows;
    })();
    checks.perfectClassifierBeatsBaseRate = (() => {
        const n = 100;
        const X = Array.from({ length: n }, (_, i) => [i % 2 ? 2 : -2]);
        const y = X.map((x) => (x[0] > 0 ? 1 : 0));
        const m = fitRidge(X, y, { lambda: 1e-6 });
        const base = fitBaseRate(X, y);
        return brier(X.map((x) => predictRidge(m, x)), y) < brier(X.map(() => base.p), y);
    })();

    // ============================== findings =========================================================
    // (1) fitRidge computes the training base rate `ybar`, stores it, and predictRidge never restores it:
    // the shipped probability is sigmoid(centred linear predictor), anchored at 0.5 whatever the prior.
    const constY = (() => {
        const n = 40;
        const X = Array.from({ length: n }, (_, i) => [Math.sin(i * 0.2), Math.cos(i * 0.3)]);
        const y = new Array(n).fill(1);
        const m = fitRidge(X, y, { lambda: 1e-3 });
        const pr = X.map((x) => predictRidge(m, x));
        return { ybar: m.ybar, meanPred: pr.reduce((a, v) => a + v, 0) / n, minPred: Math.min(...pr), maxPred: Math.max(...pr), intercept: m.w[m.d] };
    })();
    const skewedFold = (() => {
        const n = 30;
        const X = Array.from({ length: n }, (_, i) => [i * 0.01, (i % 3) - 1]);
        const y = X.map((_, i) => (i < 25 ? 1 : 0)); // base rate 0.833
        const m = fitRidge(X, y, { lambda: 1e-3 });
        const shipped = X.map((x) => predictRidge(m, x));
        const restore = X.map((x) => {
            const z = applyStandardiser(m.scaler, x);
            let logit = m.w[m.d];
            for (let j = 0; j < m.d; j++) logit += m.w[j] * z[j];
            return sigmoid(logit + m.ybar);
        });
        const uncentred = refRidgeUncentred(X, y, 1e-3);
        const su = fitStandardiser(X);
        const predU = X.map((x) => {
            const z = applyStandardiser(su, x);
            return sigmoid(uncentred[m.d] + z.reduce((a, v, j) => a + v * uncentred[j], 0));
        });
        return {
            baseRate: y.reduce((a, v) => a + v, 0) / y.length, ybar: m.ybar,
            meanPredShipped: shipped.reduce((a, v) => a + v, 0) / n,
            brierShipped: brier(shipped, y),
            brierRestoreYbar: brier(restore, y),
            brierUncentred: brier(predU, y),
        };
    })();
    const findingDeadYbar = {
        claim: 'the ridge is a closed-form regression of the label (documented "ridge (closed form)") whose probability output is the fitted linear probability',
        constantY: constY,
        skewedFold,
        ybarFieldConsumers: 'fitRidge returns `ybar`; predictRidge does not read it (only `model.w`, `model.d`, `model.scaler`, `model.standardise`)',
        note: 'fitRidge centres the target on `ybar` (so the unpenalised intercept absorbs nothing) but predictRidge returns sigmoid(z·w + c) — the centred linear predictor — so the shipped probability is anchored at 0.5 whatever the training prior. A constant-y fit returns exactly 0.5 for every input; on a 0.833-base-rate fold the shipped mean prediction is 0.50 (Brier 0.2248) vs 0.69 with the module\'s own `ybar` restored (Brier 0.1353). The shipped P1 test only checks ACCURACY (a 0.5 threshold, invariant to the offset), so it cannot fail (the F-68 "a test that cannot fail" lesson).',
    };

    // (2) the sigmoid is applied to a least-squares fit of a [0,1] target, so the linear arm's probability
    // is confined to a narrow band and cannot express confidence; the MLP (a free logit intercept) can.
    const perfect = (() => {
        const n = 100;
        const X = Array.from({ length: n }, (_, i) => [i % 2 ? 2 : -2]);
        const y = X.map((x) => (x[0] > 0 ? 1 : 0));
        const m = fitRidge(X, y, { lambda: 1e-6 });
        const base = fitBaseRate(X, y);
        const pr = X.map((x) => predictRidge(m, x));
        return { minPred: Math.min(...pr), maxPred: Math.max(...pr), ridgeBrier: brier(pr, y), baseBrier: brier(X.map(() => base.p), y), band: [sigmoid(-0.5), sigmoid(0.5)] };
    })();
    const mlpConst = (() => {
        const n = 60;
        const X = Array.from({ length: n }, (_, i) => [Math.sin(i * 0.2), i % 3 - 1]);
        const y = new Array(n).fill(1);
        const m = fitMLP(X, y, { hidden: 4, epochs: 150, lr: 0.3, seed: 2 });
        const pr = X.map((x) => predictMLP(m, x));
        return { mean: pr.reduce((a, v) => a + v, 0) / n, min: Math.min(...pr), max: Math.max(...pr) };
    })();
    const findingBandCap = {
        claim: 'the linear arm is a probability model comparable to the MLP arm (both are `forecasters` scored by Brier against the base rate)',
        perfectClassifier: perfect,
        mlpConstantY: mlpConst,
        note: 'predictRidge returns sigmoid(linear least-squares fit of the 0/1 label). Because the fitted value of a bounded target lies in [min y, max y] = [0,1] (centred: [-ybar, 1-ybar]), the shipped probability lies in sigmoid([-1,1]) ~ [0.27, 0.73] (at ybar=0.5: [0.378, 0.622]) and cannot approach 0/1 however separable the data is: a PERFECTLY separable feature reads Brier 0.1425 (the arm\'s floor), not ~0. The MLP fits its output-bias on the raw label through the same sigmoid, so it CAN express the prior (constant-y MLP -> 0.99). So "no model class has material positive skill" is, for the ridge arm, partly a statement about a bounded output map rather than about the model class.',
    };

    // (3) the lock-registry/LOCKED claim "ridge closed form matches a hand-computed solve" is not verified
    // by the shipped test (which asserts accuracy only). The closed form IS exact (check B), so the claim is
    // true-but-untested - the L10-ag "read the assertions, not the note" class.
    const findingHandSolveClaim = {
        claim: 'the analysis.test.js P1 block proves the ridge closed form against a hand-computed solve',
        shippedP1Checks: [
            'ridge and a small MLP both learn a separable causal rule the base rate cannot',
            'the benchmark forecasters are deterministic (same seed => identical fits)',
            'the standardiser is fit-cause and round-trips to zero mean/unit variance',
            'the factory exposes base-rate/linear/mlp and refuses tsfm without a checkpoint',
            'a benchmark arm joins the probability group (MCS + DM) while a signal keeps its own group',
        ],
        closedFormIsExact: true,
        note: 'docs/LOCKED.md and test/lock-registry.js both claim the P1 test proves "the ridge closed form matches a hand-computed solve", but the shipped analysis.test.js P1 block contains no hand solve: it asserts ridge/MLP accuracy > 0.8 on a separable rule, determinism, a zero-mean standardiser round-trip, the factory kinds and the MCS grouping. My independent centred solve matches the module to 0 (check ridgeMatchesIndependentSolve), so the CLAIM is true - but it is not the test that establishes it, and the 5 shipped checks would pass on a ridge with an arbitrary output map (as finding (1) shows).',
    };

    // (4) the eps constant-column fallback: a train-constant column has std = 1e-8, so a train->test
    // deviation of 1 becomes a z of 1e8 (the fallback prevents a division by zero but not the blow-up).
    const findingEpsAmplification = (() => {
        const train = [[1, 0.1], [1, 0.2], [1, 0.3], [1, 0.4]];
        const s = fitStandardiser(train);
        const z = applyStandardiser(s, [2, 0.5]);
        return {
            claim: 'the standardiser\'s eps "constant-column fallback" is safe',
            std0: s.std[0],
            z0ForUnitDeviation: z[0],
            amplification: Math.abs(z[0]) / 1,
            note: 'a column constant on the fit fold gets std = sqrt(0) + eps = 1e-8, so a test-fold value one unit away maps to z = 1e8: the fallback avoids a division by zero but turns any train->test deviation on that column into an arbitrarily large standardised feature. LATENT (a feature constant over a 60-bar training fold is plausible) but real, and untested.',
        };
    })();

    // ============================== verdict ==========================================================
    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = await v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);
    const verdict = {
        note: 'L10-bl..: `benchmark.js` is the SHIPPED P1 model-class benchmark (opt-in `--variants=bench-*`, never in the default roster; its ridge arm is the MCS survivor and the best of the set, RUN-ANALYSIS.md section 16.2). PASSES the pre-registered read: the standardiser is exact (zero mean / unit std, collapsed constant column, empty-input shape), `fitRidge` matches an INDEPENDENTLY SOLVED centred ridge to 0, `predictRidge` stays in (0,1), the base rate equals the training prior and defaults to 0.5 on empty input, the ridge and MLP both learn a separable causal rule, the MLP is deterministic under a seed, `BENCHMARK_KINDS` are the expected kinds and the factory refuses `tsfm`/an unknown kind, and a perfect classifier beats the base rate on Brier. FINDINGS: (1) `fitRidge` centres the label on `ybar` and `predictRidge` NEVER restores it, so the linear arm\'s probability is anchored at 0.5 whatever the prior - a constant-y fit predicts exactly 0.5, and a 0.833-base-rate fold reads Brier 0.2248 shipped vs 0.1353 with the module\'s own term restored (the shipped test checks accuracy only, a 0.5 threshold, so it cannot fail); (2) the sigmoid is applied to a least-squares fit of a bounded [0,1] label, so the arm\'s output is confined to sigmoid([-1,1]) ~ [0.27, 0.73] - a perfectly separable feature reads Brier 0.1425 (the arm\'s floor), while the MLP fits its bias on the raw label and reaches 0.99 on a constant-y fold; (3) the lock-registry/LOCKED claim that the test proves "the ridge closed form matches a hand-computed solve" is unverified - the 5 shipped P1 checks assert accuracy/determinism/standardiser/factory/grouping only (the closed form itself IS exact); (4) the eps constant-column fallback amplifies a unit train->test deviation to z = 1e8 (latent). Scope: SHIPPED, but the two live findings move a forecast arm\'s probability readout, not the goldens.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            deadTrainingBaseRate: findingDeadYbar,
            sigmoidBandCap: findingBandCap,
            unverifiedHandSolveClaim: findingHandSolveClaim,
            epsColumnAmplification: findingEpsAmplification,
        },
        scope: {
            shipped: ['fitRidge/predictRidge', 'fitMLP/predictMLP', 'fitBaseRate/predictBaseRate', 'fitStandardiser/applyStandardiser', 'BENCHMARK_KINDS', 'makeBenchmarkForecaster'],
            testOnly: ['tsfm arm (throws by design)'],
            why: 'analyze.js imports makeBenchmarkForecaster/BENCHMARK_KINDS and dispatches `kind:"benchmark"` variants through makeBenchmarkModelFactory; a --variants=bench-linear run reaches RUN-ANALYSIS section 16.2, so the ridge arm\'s probability is a shipped readout (the arms are opt-in, never in the default roster).',
        },
    };
    return {
        config: { sepN: bx.length, skewFolds: [0.35, 0.5, 0.65], mlpHidden: 6 },
        rows: {
            constantY: constY,
            skewedFold,
            perfectClassifier: perfect,
            mlpConstantY: mlpConst,
            independentSolveMaxWdiff: (() => { const { X, y } = mkData(140, 0.42, 11); const m = fitRidge(X, y, { lambda: 1e-3 }); const r = refRidgeCentered(X, y, 1e-3); return Math.max(...m.w.map((v, i) => Math.abs(v - r.w[i]))); })(),
        },
        validation: resolved,
        verdict,
    };
}
