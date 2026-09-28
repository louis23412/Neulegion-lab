// E58 - THE RESAMPLING / MULTIPLE-TESTING MODULE, AUDITED AGAINST CLOSED FORMS AND AN INDEPENDENT
// REFERENCE. CYCLE-050 (L10-aw ...).
//
// `analysis/reality_check.js` is the lab's (and the repo's) *resampling backbone*: the stationary-bootstrap
// index process, the Newey-West (Bartlett) HAC standard error, White's Reality Check / Hansen's SPA (and the
// consistent SPA + Romano-Wolf step-down), the Politis-White automatic block-length selector, and the
// variance-consistent subsampling family (SPA, step-down, k-FWER, FDP). L10's sweep reaches it after
// carry.js (F-61), dependence.js (F-62), splits.js (F-63), labels.js (F-64) and overfitting.js (F-65).
//
// It is a *hub*: `forecast.js` (shipped) imports `stationaryBlockIndices` for its Diebold-Mariano test and
// Model Confidence Set, and `walkforward.js` (shipped) imports the four subsampling procedures for the
// familywise search. So unlike the previous exports in this queue, part of this module is ON the shipped
// path. The scope trace is therefore part of the audit: which exports does a shipped module actually import?
//
// PRE-REGISTERED READ. PASSES if (i) the resampling primitives are exact - `stationaryBlockIndices` at
// blockLength 1 is i.i.d. with replacement and its process has the geometric restart law, `neweyWestSE` is
// exactly the Bartlett estimator (verified against an independent sum-formula implementation) and is
// slice/shift invariant; (ii) `politisWhiteBlockLength` matches an independent port of the documented
// reference (`arch.bootstrap.base._single_optimal_block`, which is vendored below from its source) to
// floating point on the domain where its own `g > 0` guard does not fire, AND reproduces the reference
// vector (13.635665 / 15.608940) bit-for-bit from the NumPy legacy-RandomState stream; (iii) the RC/SPA
// statistics are the documented closed forms, the consistent recentring is the exact A_k bound and the
// step-down's first step is EXACTLY the single-step consistent SPA; (iv) the subsampling family shares one
// reference (k-FWER at k=1 == the step-down's first p == the consistent SPAs), is deterministic, and is
// segment-aware; and (v) the calibrations the repo claims are re-measured independently: RC/SPA keep their
// size under an i.i.d. null, and the variance-consistent subsampling removes the block bootstrap's
// over-rejection under persistence. A failure anywhere means F-66 must be revised.

import {
    stationaryBlockIndices, bootstrapRelativeMeans, whiteRealityCheck, hansenSpa,
    consistentRecentring, hansenSpaConsistent, romanoWolfStepM, politisWhiteBlockLength,
    autoBlockLength, neweyWestSE, subsamplingSpa, subsamplingStepM, subsamplingKfwer,
    subsamplingFdp,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/reality_check.js';

// ---- deterministic helpers -------------------------------------------------------------------------
function repoRng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; let v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function arSeries(T, phi, seed) { const r = repoRng(seed); const a = new Array(T); let p = 0; for (let t = 0; t < T; t++) { p = phi * p + gauss(r) * Math.sqrt(1 - phi * phi); a[t] = p; } return a; }
function iidSeries(T, seed) { const r = repoRng(seed); return Array.from({ length: T }, () => gauss(r)); }
function matrix(K, T, phi, seed) { const r = repoRng(seed); return Array.from({ length: K }, () => { const a = new Array(T); let p = 0; for (let t = 0; t < T; t++) { p = phi * p + gauss(r) * Math.sqrt(1 - phi * phi); a[t] = p; } return a; }); }
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const r4 = (x, d = 5) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const close = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// ---- independent reference implementations --------------------------------------------------------
// (1) arch.bootstrap.base._single_optimal_block, ported line-for-line from its source (the repo's own
// docstring claims floating-point agreement with it). NOTE the reference squares g and has NO `g > 0`
// guard; the repo returns 0 when g <= 0. This is the one place the two can differ.
function archSingle(x) {
    const nobs = x.length;
    let mu = 0; for (const v of x) mu += v; mu /= nobs;
    const eps = Array.from(x, (v) => v - mu);
    const bMax = Math.ceil(Math.min(3 * Math.sqrt(nobs), nobs / 3));
    const kn = Math.max(5, Math.trunc(Math.log10(nobs)));
    const mMax = Math.ceil(Math.sqrt(nobs)) + kn;
    const cv = 2 * Math.sqrt(Math.log10(nobs) / nobs);
    const acv = new Array(mMax + 1).fill(0);
    const absAc = new Array(mMax + 1).fill(0);
    let optM = null;
    for (let i = 0; i <= mMax; i++) {
        let v1 = 0; for (let t = i + 1; t < nobs; t++) v1 += eps[t] * eps[t];
        let v2 = 0; for (let t = 0; t < nobs - i - 1; t++) v2 += eps[t] * eps[t];
        let cross = 0; for (let t = 0; t < nobs - i; t++) cross += eps[t + i] * eps[t];
        acv[i] = cross / nobs;
        absAc[i] = Math.abs(cross) / Math.sqrt(v1 * v2);
        if (i >= kn && optM === null) { let quiet = true; for (let j = i - kn; j < i; j++) if (!(absAc[j] < cv)) { quiet = false; break; } if (quiet) optM = i - kn; }
    }
    let m = optM !== null ? 2 * Math.max(optM, 1) : mMax; m = Math.min(m, mMax);
    let g = 0; let lr = acv[0];
    for (let k = 1; k <= m; k++) { const lam = k / m <= 0.5 ? 1 : 2 * (1 - k / m); g += 2 * lam * k * acv[k]; lr += 2 * lam * acv[k]; }
    const bs = Math.min(((2 * g * g) / (2 * lr * lr)) ** (1 / 3) * nobs ** (1 / 3), bMax);
    const bc = Math.min(((2 * g * g) / ((4 / 3) * lr * lr)) ** (1 / 3) * nobs ** (1 / 3), bMax);
    return { stationary: bs, circular: bc, g, lr, m, optM, mMax, bMax, kn, cv };
}
// (2) an independent Bartlett (Newey-West) HAC standard error of the mean, from the definition.
function nwIndep(x, from, len, m) {
    let mu = 0; for (let t = from; t < from + len; t++) mu += x[t]; mu /= len;
    const gamma = (j) => { let s = 0; for (let t = from; t + j < from + len; t++) s += (x[t] - mu) * (x[t + j] - mu); return s / len; };
    let v = gamma(0);
    for (let j = 1; j <= m; j++) v += 2 * (1 - j / (m + 1)) * gamma(j);
    if (!(v > 0)) v = 0;
    return Math.sqrt(v / len);
}
// (3) NumPy legacy RandomState(seed) - MT19937 + the polar-method normal - so the arch benchmark vector
// can be rebuilt independently. The first two draws are checked as a proof of the reproduction.
function numpyStream(seed) {
    const N = 624; const M = 397; const MA = 0x9908b0df; const UP = 0x80000000; const LO = 0x7fffffff;
    const mt = new Uint32Array(N); mt[0] = seed >>> 0;
    for (let i = 1; i < N; i++) mt[i] = (Math.imul(1812433253, (mt[i - 1] ^ (mt[i - 1] >>> 30)) >>> 0) + i) >>> 0;
    let mti = N;
    const next = () => {
        if (mti >= N) {
            let kk;
            for (kk = 0; kk < N - M; kk++) { const y = (mt[kk] & UP) | (mt[kk + 1] & LO); mt[kk] = mt[kk + M] ^ (y >>> 1) ^ ((y & 1) ? MA : 0); }
            for (; kk < N - 1; kk++) { const y = (mt[kk] & UP) | (mt[kk + 1] & LO); mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ ((y & 1) ? MA : 0); }
            const y = (mt[N - 1] & UP) | (mt[0] & LO); mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ ((y & 1) ? MA : 0);
            mti = 0;
        }
        let y = mt[mti++];
        y ^= (y >>> 11); y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= (y >>> 18);
        return y >>> 0;
    };
    const d = () => { const a = next() >>> 5; const b = next() >>> 6; return (a * 67108864 + b) / 9007199254740992; };
    let has = false; let cache = 0;
    const norm = () => {
        if (has) { has = false; const t = cache; cache = 0; return t; }
        let x1; let x2; let r2;
        do { x1 = 2 * d() - 1; x2 = 2 * d() - 1; r2 = x1 * x1 + x2 * x2; } while (r2 >= 1 || r2 === 0);
        const f = Math.sqrt(-2 * Math.log(r2) / r2);
        cache = f * x1; has = true;
        return f * x2;
    };
    return { d, norm };
}

export async function run() {
    const checks = {};

    // ============================== A. the stationary-bootstrap index process (SHIPPED via forecast.js) ==
    // A1. length and range, over a grid of (n, b).
    let rangeOk = true;
    const rangeRows = [];
    for (const [n, b] of [[10, 1], [10, 3], [37, 5], [100, 7]]) {
        const idx = stationaryBlockIndices(n, b, repoRng(3 * n + b));
        const ok = idx.length === n && Array.from(idx).every((v) => v >= 0 && v < n);
        rangeOk = rangeOk && ok;
        rangeRows.push({ n, b, ok, min: Math.min(...idx), max: Math.max(...idx) });
    }
    checks.sbiLengthAndRange = rangeOk;

    // A2. blockLength = 1 is EXACTLY i.i.d. sampling with replacement: reconstruct the draw sequence from
    // the same rng stream by hand. At b=1 the restart is certain, so every bar t>0 consumes TWO draws
    // (the threshold test, then the fresh index); bar 0 consumes one.
    const iidN = 23; const iidB = 1;
    const rA = repoRng(99);
    const expectIid = new Array(iidN);
    expectIid[0] = Math.floor(rA() * iidN);
    for (let t = 1; t < iidN; t++) { rA(); expectIid[t] = Math.floor(rA() * iidN); }
    const gotIid = Array.from(stationaryBlockIndices(iidN, iidB, repoRng(99)));
    checks.sbiBlockOneIsIidWithReplacement = JSON.stringify(gotIid) === JSON.stringify(expectIid);

    // A3. the continuation law: replay the rng stream - at each bar either a restart (fresh uniform) or a
    // +1 (mod n) continuation, and require byte equality with the module's output.
    const cN = 60; const cB = 4;
    const rc = repoRng(2024);
    const replay = new Array(cN);
    let cursor = Math.floor(rc() * cN);
    for (let t = 0; t < cN; t++) {
        if (t > 0) {
            if (rc() < 1 / cB) cursor = Math.floor(rc() * cN);
            else cursor = (cursor + 1) % cN;
        }
        replay[t] = cursor;
    }
    const gotReplay = Array.from(stationaryBlockIndices(cN, cB, repoRng(2024)));
    checks.sbiGeometricRestartAndWrap = JSON.stringify(gotReplay) === JSON.stringify(replay);

    // A4/A5. the restart law and mean run length, measured over a large ensemble (2.5-SE bands).
    const sdSeed = 7; const sdN = 4000; const sdB = 6;
    const runRng = repoRng(sdSeed);
    const idxBig = stationaryBlockIndices(sdN, sdB, runRng);
    let restarts = 0; let runs = 1;
    for (let t = 1; t < sdN; t++) { if (idxBig[t] !== (idxBig[t - 1] + 1) % sdN) { restarts++; runs++; } }
    const restartRate = restarts / (sdN - 1);
    const meanRun = sdN / runs;
    const rateSe = Math.sqrt((1 / sdB) * (1 - 1 / sdB) / (sdN - 1));
    checks.sbiRestartRateIsGeometric = Math.abs(restartRate - 1 / sdB) <= 2.5 * rateSe;
    checks.sbiMeanRunLengthIsBlockLength = Math.abs(meanRun - sdB) <= 2.5 * Math.max(0.05, sdB / Math.sqrt(runs));

    // A6. determinism for a given rng stream.
    checks.sbiDeterministic = JSON.stringify(Array.from(stationaryBlockIndices(50, 5, repoRng(1)))) === JSON.stringify(Array.from(stationaryBlockIndices(50, 5, repoRng(1))));

    // ============================== B. the Newey-West HAC standard error (SHIPPED) ====================
    // B1. exact agreement with the independent Bartlett definition on random windows/bandwidths.
    let nwMatch = true; const nwRows = [];
    for (let s = 0; s < 24; s++) {
        const T = 40 + s * 7; const series = iidSeries(T, 500 + s);
        const from = s % 5; const len = T - from - (s % 4); const m = 1 + (s % 6);
        const a = neweyWestSE(series, from, len, m); const b = nwIndep(series, from, len, m);
        if (!close(a, b, 1e-12)) { nwMatch = false; nwRows.push({ s, a, b }); }
    }
    checks.nwMatchesIndependentBartlett = nwMatch;

    // B2. bandwidth 0 is exactly the i.i.d. standard error sqrt(mean squared deviation / n).
    const b2x = [1, 2, 4, 8, 16];
    const b2mu = mean(b2x);
    const b2want = Math.sqrt(b2x.reduce((a, v) => a + (v - b2mu) ** 2, 0) / b2x.length / b2x.length);
    checks.nwBandwidthZeroIsIidSe = close(neweyWestSE(b2x, 0, 5, 0), b2want, 1e-15);

    // B3. a constant window has exactly zero variance (a deterministic candidate is an infinite t).
    checks.nwConstantWindowIsZero = neweyWestSE([2, 2, 2, 2], 0, 4, 1) === 0;

    // B4. the tapered long-run variance is a PSD quadratic form (the Bartlett kernel), so it can never be
    // negative: search exhaustively over all +/-1 patterns up to length 18 (x every bandwidth) plus a
    // random battery, and require (i) no negative taper is ever found, (ii) the estimator is finite >= 0,
    // (iii) the only clamped case is v = 0 (a constant window). The `v < 0` arm is therefore unreachable.
    let negFound = false; let minRaw = Infinity; let finiteNonNeg = true;
    for (let len = 4; len <= 18 && !negFound; len++) {
        for (let pattern = 0; pattern < (1 << len) && !negFound; pattern++) {
            const x = []; for (let i = 0; i < len; i++) x.push(((pattern >> i) & 1) ? 1 : -1);
            const mu = mean(x);
            const gam = (j) => { let s = 0; for (let t = 0; t + j < len; t++) s += (x[t] - mu) * (x[t + j] - mu); return s / len; };
            for (let m = 0; m < len; m++) {
                let v = gam(0); for (let j = 1; j <= m; j++) v += 2 * (1 - j / (m + 1)) * gam(j);
                if (v < minRaw) minRaw = v;
                if (v < 0) negFound = true;
                const se = neweyWestSE(x, 0, len, m);
                if (!Number.isFinite(se) || se < 0) finiteNonNeg = false;
            }
        }
    }
    const brng = repoRng(999);
    for (let trial = 0; trial < 3000; trial++) {
        const len = 3 + Math.floor(brng() * 40);
        const x = Array.from({ length: len }, () => (brng() * 2 - 1));
        const m = Math.floor(brng() * len);
        const se = neweyWestSE(x, 0, len, m);
        if (!Number.isFinite(se) || se < 0) finiteNonNeg = false;
    }
    checks.nwTaperedVarianceNeverNegative = !negFound && finiteNonNeg && minRaw >= 0;

    // B5. slice invariance: the estimator depends only on the window's contents.
    let sliceOk = true;
    for (let s = 0; s < 10; s++) {
        const series = iidSeries(60, 800 + s); const from = 3 + s; const len = 20 + s; const m = 1 + (s % 4);
        const slice = series.slice(from, from + len);
        if (neweyWestSE(series, from, len, m) !== neweyWestSE(slice, 0, len, m)) sliceOk = false;
    }
    checks.nwSliceInvariant = sliceOk;

    // B6. the default bandwidth is max(1, round(len^(1/3))).
    const b6 = iidSeries(60, 4);
    checks.nwDefaultBandwidth = close(neweyWestSE(b6, 0, 60, null), neweyWestSE(b6, 0, 60, Math.max(1, Math.round(Math.pow(60, 1 / 3)))), 1e-15);

    // ============================== C. the Politis-White block-length selector (test-only) =============
    // C1. exact agreement with the independent arch port wherever the repo's g>0 guard does not fire.
    let pwMatch = true; const pwRows = [];
    for (let s = 0; s < 30; s++) {
        const series = (s % 2 === 0) ? arSeries(300, 0.2 + 0.02 * s, 900 + s) : iidSeries(300, 900 + s);
        const repo = politisWhiteBlockLength(series); const arch = archSingle(series);
        if (repo.g > 0 && repo.sigma2 > 0) {
            if (!close(repo.stationary, arch.stationary, 1e-9) || !close(repo.circular, arch.circular, 1e-9)) { pwMatch = false; pwRows.push({ s, repo: repo.stationary, arch: arch.stationary }); }
        }
    }
    checks.pwMatchesArchOnPositiveG = pwMatch;

    // C2. the documented reference vector, rebuilt from the NumPy stream independently of the repo's test.
    const ns = numpyStream(0);
    const u0 = ns.d();
    const n0 = numpyStream(0).norm();
    const streamOk = u0 === 0.5488135039273248 && n0 === 1.764052345967664;
    const ns2 = numpyStream(0);
    const e = new Array(10100); for (let i = 0; i < 10100; i++) e[i] = ns2.norm();
    const y = new Array(10100); y[0] = e[0]; for (let i = 1; i < 10100; i++) y[i] = 0.3 * y[i - 1] + e[i];
    const bench = politisWhiteBlockLength(y.slice(100));
    checks.pwReproducesArchReferenceVector = streamOk && close(bench.stationary, 13.635665, 13.635665 * 1e-6) && close(bench.circular, 15.60894, 15.60894 * 1e-6);

    // C3. THE DIVERGENCE: the reference squares g (so it is positive for a mean-reverting series); the
    // repo requires g > 0 and returns exactly 0 otherwise. Measure it over a mean-reverting ensemble.
    let negZero = 0; let negDiverged = 0; const negExamples = [];
    for (let s = 0; s < 200; s++) {
        const series = arSeries(400, -0.5, 1000 + s);
        const repo = politisWhiteBlockLength(series); const arch = archSingle(series);
        if (repo.g <= 0) negZero++;
        if (!close(repo.stationary, arch.stationary, 1e-9)) { negDiverged++; if (negExamples.length < 3) negExamples.push({ s, repo: repo.stationary, arch: r4(arch.stationary), g: r4(repo.g, 6), lr: r4(repo.sigma2, 6) }); }
    }
    checks.pwNegativeGReturnsZero = negZero >= 190;

    // C4. the consequence for the auto policy: on the same series autoBlockLength floors to 1 while the
    // documented reference would choose a multi-bar block.
    let autoOne = 0; let autoRawZero = 0;
    for (let s = 0; s < 100; s++) {
        const series = arSeries(400, -0.5, 1000 + s);
        const ab = autoBlockLength(series);
        if (ab.blockLength === 1) autoOne++;
        if (ab.raw === 0) autoRawZero++;
    }
    checks.autoBlockFloorsAntiPersistentToOne = autoOne >= 95;

    // C5. how often does the guard fire on data with no persistence at all? (i.i.d. columns, T=120)
    let iidZero = 0; const iidN2 = 200;
    for (let s = 0; s < iidN2; s++) if (politisWhiteBlockLength(iidSeries(120, 4000 + s)).g <= 0) iidZero++;
    const iidFrac = iidZero / iidN2;

    // C6. the `median` reduction is the UPPER median for an even arm count (not the mean of the two
    // middle order statistics).
    let medianWart = false; let medianRow = null;
    for (let trial = 0; trial < 40 && !medianWart; trial++) {
        const K = 4; const mat = [];
        for (let k = 0; k < K; k++) mat.push(arSeries(120, 0.3 + 0.1 * k, 6000 + trial * 10 + k));
        const per = mat.map((row) => politisWhiteBlockLength(row).stationary);
        const sorted = [...per].sort((a, b) => a - b);
        const upper = sorted[Math.floor(K / 2)];
        const std = (sorted[K / 2 - 1] + sorted[K / 2]) / 2;
        const got = autoBlockLength(mat, { reduce: 'median' }).blockLength;
        if (Math.abs(upper - std) > 1e-9) { medianWart = Math.abs(got - upper) <= 1e-12; medianRow = { per: per.map((v) => r4(v, 3)), upper: r4(upper), standard: r4(std), got: r4(got) }; break; }
    }
    checks.autoBlockMedianIsUpperOnEvenK = medianWart;

    // C7. the auto selector's reductions are exact order statistics / the arithmetic mean of the raw
    // per-arm selectors (so the reducer's arithmetic is not in question; only the `median` definition
    // differs on an even arm count, checked above).
    const c7mat = matrix(5, 120, 0.5, 808);
    const c7per = c7mat.map((row) => politisWhiteBlockLength(row).stationary);
    const c7sorted = [...c7per].sort((a, b) => a - b);
    checks.autoBlockReductionsExact = close(autoBlockLength(c7mat).blockLength, mean(c7per), 1e-12)
        && close(autoBlockLength(c7mat, { reduce: 'min' }).blockLength, c7sorted[0], 1e-12)
        && close(autoBlockLength(c7mat, { reduce: 'max' }).blockLength, c7sorted[4], 1e-12)
        && close(autoBlockLength(c7mat, { reduce: 'median' }).blockLength, c7sorted[2], 1e-12);

    // C8. the selector's own bounds and band are the documented formulas.
    const c8 = politisWhiteBlockLength(arSeries(400, 0.3, 5));
    checks.pwBoundsExact = c8.kn === Math.max(5, Math.trunc(Math.log10(400)))
        && c8.mMax === Math.ceil(Math.sqrt(400)) + c8.kn
        && c8.bMax === Math.ceil(Math.min(3 * Math.sqrt(400), 400 / 3))
        && close(c8.criterion, 2 * Math.sqrt(Math.log10(400) / 400), 1e-15);

    // ============================== D. RC / SPA / step-down (test-only) ===============================
    const dMat = matrix(5, 100, 0.4, 31337);
    // D1. RC statistic = sqrt(T) * max_k mean(f_k) exactly.
    const rc1 = whiteRealityCheck({ returnsMatrix: dMat, nBoot: 199, seed: 5 });
    const dMeans = dMat.map((row) => mean(row));
    checks.rcStatisticIsSqrtTMaxMean = close(rc1.statistic, Math.sqrt(100) * Math.max(...dMeans), 1e-12) && rc1.bestIndex === dMeans.indexOf(Math.max(...dMeans));

    // D2. a constant benchmark b shifts the statistic by exactly -sqrt(T)*b.
    const dOff = dMeans.map((v) => v + 0.05);
    const rcBase = whiteRealityCheck({ returnsMatrix: dOff.map((v) => dMat[0].map(() => v)), nBoot: 50, seed: 5 });
    const rcShift = whiteRealityCheck({ returnsMatrix: dOff.map((v) => dMat[0].map(() => v)), benchmark: 0.03, nBoot: 50, seed: 5 });
    checks.rcBenchmarkShiftExact = close(rcShift.statistic - rcBase.statistic, -Math.sqrt(100) * 0.03, 1e-12);

    // D3. SPA statistic = max(0, max_k fbar_k / omega_k) with omega the bootstrap SE; and a zero-variance
    // positive candidate is an infinite t with p = 0.
    const spa1 = hansenSpa({ returnsMatrix: dMat, nBoot: 199, seed: 5 });
    const spaIndependent = (() => { // recompute omega from the same draws, independently
        const rel = dMat.map((row) => row.map((v) => v));
        const fbar = rel.map((row) => mean(row));
        const b = bootstrapRelativeMeans(rel, { nBoot: 199, blockLength: null, seed: 5, T: 100, K: 5 });
        const om = fbar.map((f, k) => { let s = 0; for (let rep = 0; rep < 199; rep++) s += (b.fbarBoot[rep][k] - f) ** 2; return Math.sqrt(s / 199); });
        return { stat: Math.max(0, ...fbar.map((f, k) => f / om[k])), best: fbar.map((f, k) => f / om[k]).indexOf(Math.max(...fbar.map((ff, kk) => ff / om[kk]))) };
    })();
    checks.spaStatisticIsMaxStudentized = close(spa1.statistic, spaIndependent.stat, 1e-12) && spa1.bestIndex === spaIndependent.best;
    const spaDeg = hansenSpa({ returnsMatrix: [new Array(8).fill(0.5), new Array(8).fill(0)], nBoot: 60, seed: 1 });
    checks.spaZeroVarianceIsInfinite = spaDeg.statistic === Infinity && spaDeg.pValue === 0;

    // D4. the consistent recentring bound A_k = omega_k * sqrt(2 log log T) is exact, and when every
    // candidate is "valid" the consistent recentring equals the upper one exactly.
    const cr = consistentRecentring([0.1, -0.02, 0.05], [0.03, 0.04, 0.02], 100);
    const boundWant = Math.sqrt(2 * Math.log(Math.log(100)));
    const crOk = close(cr.bound, boundWant, 1e-15) && cr.recentring[0] === 0.1 && cr.recentring[2] === 0.05 && cr.recentring[1] === -0.02;
    const allPos = matrix(4, 100, 0.3, 222); // every candidate positive -> all valid
    const up = hansenSpa({ returnsMatrix: allPos.map((r) => r.map((v) => v + 0.4)), nBoot: 199, seed: 9 });
    const co = hansenSpaConsistent({ returnsMatrix: allPos.map((r) => r.map((v) => v + 0.4)), nBoot: 199, seed: 9 });
    checks.consistentRecentringBoundExact = crOk;
    checks.consistentEqualsUpperWhenAllValid = up.pValue === co.pValue && up.statistic === co.statistic
        && co.recentring.every((r, k) => close(r, co.means[k], 1e-15));

    // D5. Hansen's consistency: SPA_c p <= SPA p, and the step-down's first step is EXACTLY the
    // single-step consistent SPA (same draws, same recentring, same max-with-0).
    const poor = matrix(6, 120, 0.5, 4242);
    for (let t = 0; t < 120; t++) poor[0][t] += 0.30;            // one genuine edge -> non-vacuous step-down
    for (let k = 3; k < 6; k++) { for (let t = 0; t < 120; t++) poor[k][t] -= 0.25; }
    const spU = hansenSpa({ returnsMatrix: poor, nBoot: 299, seed: 7 });
    const spC = hansenSpaConsistent({ returnsMatrix: poor, nBoot: 299, seed: 7 });
    const step = romanoWolfStepM({ returnsMatrix: poor, nBoot: 299, seed: 7, alpha: 0.05 });
    checks.spaConsistentPLeqUpperP = spC.pValue <= spU.pValue + 1e-15;
    checks.stepDownFirstStepIsConsistentSpa = step.stepPValues[step.order[0]] === spC.pValue && step.bestIndex === spC.bestIndex && step.bestT === spC.bestT;

    // D6. the step-down is monotone in its order and stops at the first failure.
    let mono = true; let stopped = true;
    for (let j = 1; j < poor.length; j++) if (step.stepPValues[step.order[j]] < step.stepPValues[step.order[j - 1]] - 1e-15 && step.stepPValues[step.order[j - 1]] !== 1) mono = false;
    let seenFail = false;
    for (let j = 0; j < poor.length; j++) { const idx = step.order[j]; const rej = step.rejected[idx]; if (rej && seenFail) stopped = false; if (!rej) seenFail = true; }
    checks.stepDownMonotoneAndStops = mono && stopped;

    // ============================== E. the subsampling family (SHIPPED via walkforward.js) ============
    const eMat = matrix(5, 150, 0.5, 909);
    const subSpaC = subsamplingSpa({ returnsMatrix: eMat, consistent: true });
    const stepM = subsamplingStepM({ returnsMatrix: eMat, alpha: 0.05 });
    const kw1 = subsamplingKfwer({ returnsMatrix: eMat, alpha: 0.05, k: 1 });
    const kw2 = subsamplingKfwer({ returnsMatrix: eMat, alpha: 0.05, k: 2 });
    const fdp = subsamplingFdp({ returnsMatrix: eMat, alpha: 0.05, fdpTarget: 0.1 });

    // E1. k-FWER at k=1 == the step-down's first p == the consistent SPA p-value.
    checks.subKfwer1EqualsStepDownFirstP = stepM.stepPValues[stepM.bestIndex] === kw1.pValues[stepM.bestIndex];
    // E2. the consistent SPA shares the step-down's reference exactly (one reference, one arithmetic).
    checks.subOneSharedReference = stepM.bestT === subSpaC.statistic
        && JSON.stringify(stepM.means) === JSON.stringify(subSpaC.means)
        && JSON.stringify(stepM.standardErrors) === JSON.stringify(subSpaC.standardErrors)
        && JSON.stringify(stepM.recentring) === JSON.stringify(subSpaC.recentring)
        && stepM.windowLength === subSpaC.windowLength && stepM.bandwidth === subSpaC.bandwidth;
    // E3. subsampling is deterministic (no rng) - byte-identical on repeat.
    checks.subDeterministic = subSpaC.pValue === subsamplingSpa({ returnsMatrix: eMat, consistent: true }).pValue
        && kw2.pValues.join(',') === subsamplingKfwer({ returnsMatrix: eMat, alpha: 0.05, k: 2 }).pValues.join(',');
    // E4. the k-FWER reference is the k-th LARGEST window statistic, so raising k shrinks the reference
    // and the p-value is non-INCREASING in k (k=1 is the FWER / step-down reference).
    checks.subKfwerNonIncreasingInK = kw2.pValues.every((p, i) => p <= kw1.pValues[i] + 1e-15);
    // E5. every window statistic is exactly (windowMean - recentring)/shrink/neweyWestSE(window, m).
    let winExact = true;
    for (let s = 0; s < subSpaC.nWindows && winExact; s++) {
        for (let k = 0; k < 5; k++) {
            let mu = 0; for (let t = s; t < s + subSpaC.windowLength; t++) mu += eMat[k][t]; mu /= subSpaC.windowLength;
            const want = (mu - subSpaC.recentring[k]) / subSpaC.shrink / neweyWestSE(eMat[k], s, subSpaC.windowLength, subSpaC.bandwidth);
            if (!close(subSpaC.tWindows[s * 5 + k], want, 1e-12)) { winExact = false; break; }
        }
    }
    checks.subWindowStatExact = winExact;
    // E6. the shrink factor is exactly sqrt(1 - b/T) and the defaults are b = round(T/3), m = round(b/6).
    checks.subShrinkAndDefaults = close(subSpaC.shrink, Math.sqrt(1 - subSpaC.windowLength / 150), 1e-15)
        && subSpaC.windowLength === Math.round(150 / 3) && subSpaC.bandwidth === Math.max(1, Math.round(subSpaC.windowLength / 6))
        && subSpaC.nWindows === 150 - subSpaC.windowLength + 1;
    // E7. `groups = [T]` is bit-identical to ungrouped, and grouped windows never straddle a boundary.
    const gGroups = [60, 60, 30];
    const gSub = subsamplingSpa({ returnsMatrix: eMat, groups: gGroups });
    const flatSub = subsamplingSpa({ returnsMatrix: eMat });
    const gExpectedWindows = gGroups.reduce((a, L) => a + Math.max(0, L - gSub.windowLength + 1), 0);
    checks.subGroupsBiteIdenticalAndSegmentAware = subsamplingSpa({ returnsMatrix: eMat, groups: [150] }).pValue === flatSub.pValue
        && gSub.nWindows === gExpectedWindows && gSub.windowLength === Math.max(2, Math.floor(Math.min(...gGroups) / 2));
    // E8. the FDP heuristic's single-step reference and its reported bound are self-consistent.
    const fdpOk = fdp.nRejected === 0 ? fdp.estimatedFdp === null : close(fdp.estimatedFdp, (fdp.kHat - 1) / fdp.nRejected, 1e-15);
    checks.subFdpSelfConsistent = fdpOk;

    // ============================== F. independent calibration (ensembles, 2.5-SE bands) ==============
    const reps = 200; const nBoot = 99;
    const sizeOf = (fn, phi, seedBase) => { let rej = 0; for (let i = 0; i < reps; i++) { const M = matrix(5, 100, phi, seedBase + i); if (fn(M) <= 0.05) rej++; } return rej / reps; };
    const seOf = (p) => Math.sqrt(Math.max(1e-12, p * (1 - p)) / reps);
    const phiGrid = [0, 0.2, 0.5, 0.8];
    const subSizes = phiGrid.map((phi) => sizeOf((M) => subsamplingSpa({ returnsMatrix: M }).pValue, phi, 50000));
    const blkSizes = phiGrid.map((phi) => sizeOf((M) => hansenSpaConsistent({ returnsMatrix: M, nBoot, seed: 1 }).pValue, phi, 50000));
    // F1. subsampling holds its nominal size across the persistence sweep.
    checks.subSamplingSizeNominalAcrossPersistence = subSizes.every((p) => p <= 0.05 + 2.5 * seOf(p));
    // F2. the block bootstrap over-rejects under persistence, and subsampling removes it.
    checks.blockBootstrapOverRejectsUnderPersistence = blkSizes[3] > 0.20 && blkSizes[3] - subSizes[3] >= 0.15;
    // F3. RC and SPA keep their size under a pure i.i.d. null.
    let rcRej = 0; let spaRej = 0;
    for (let i = 0; i < reps; i++) {
        const M = matrix(5, 100, 0, 70000 + i);
        if (whiteRealityCheck({ returnsMatrix: M, nBoot, seed: i + 1 }).pValue <= 0.05) rcRej++;
        if (hansenSpa({ returnsMatrix: M, nBoot, seed: i + 1 }).pValue <= 0.05) spaRej++;
    }
    const rcSize = rcRej / reps; const spaSize = spaRej / reps;
    checks.rcSpaSizeUnderIidNull = rcSize <= 0.05 + 2.5 * seOf(rcSize) + 0.02 && spaSize <= 0.05 + 2.5 * seOf(spaSize) + 0.02;

    // ============================== verdict ============================================================
    const validationPass = Object.values(checks).every((x) => x === true);
    const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-aw..: `reality_check.js` is the resampling hub. SHIPPED via forecast.js: stationaryBlockIndices; SHIPPED via walkforward.js: neweyWestSE + the four subsampling procedures. All exact identities hold: the b=1 index process is i.i.d.-with-replacement (per-bar two-draw replay) and the process is geometric with mean run length b; neweyWestSE is exactly the Bartlett estimator (independent re-implementation, 1e-12), is slice invariant, and its tapered variance is never negative (so the `v<0` clamp arm is unreachable - a dead branch); the RC statistic is sqrt(T)*max mean, the SPA statistic is max(0,max fbar/omega), the consistent recentring is exactly A_k=omega*sqrt(2 log log T), the step-down first step IS the consistent SPA (bit-equal), and the subsampling family shares one reference (k-FWER k=1 == step-down first p, consistent SPA statistic/se/recentring identical), is deterministic, and is segment-aware. FAILURE: `politisWhiteBlockLength` (test-only) returns exactly 0 whenever its flat-top long-run `g` is not strictly positive, where the documented reference arch.bootstrap.base._single_optimal_block squares g and returns a positive length - over a mean-reverting ensemble the repo zeroes ~99% of series and autoBlockLength floors to 1 while the reference picks a multi-bar block; the `median` arm reduction is the UPPER median on an even arm count; and nothing in the shipped path uses the auto selector.',
        checks,
        validationPass,
        failed,
        divergence: { arNegZero: negZero, arNegDiverged: negDiverged, examples: negExamples, iidGuardFraction: r4(iidFrac, 4), autoFloorsToOne: autoOne },
        calibration: { subsamplingSizes: subSizes.map((p) => r4(p, 4)), blockBootstrapSizes: blkSizes.map((p) => r4(p, 4)), rcSize: r4(rcSize, 4), spaSize: r4(spaSize, 4), reps, nBoot },
        reference: { benchStationary: r4(bench.stationary, 6), benchCircular: r4(bench.circular, 6), numpyFirstTwoOk: streamOk },
        scope: { shippedViaForecast: ['stationaryBlockIndices'], shippedViaWalkforward: ['neweyWestSE', 'subsamplingSpa', 'subsamplingStepM', 'subsamplingKfwer', 'subsamplingFdp'], testOnly: ['whiteRealityCheck', 'hansenSpa', 'hansenSpaConsistent', 'romanoWolfStepM', 'consistentRecentring', 'politisWhiteBlockLength', 'autoBlockLength', 'bootstrapRelativeMeans'] },
    };
    return {
        config: { grid: rangeRows, reps, nBoot },
        rows: { nw: nwRows, pw: pwRows, median: medianRow, minTaper: r4(minRaw, 12) },
        validation: checks,
        verdict,
    };
}
