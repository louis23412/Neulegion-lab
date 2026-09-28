// E62 - THE MEASUREMENT LAYER, AUDITED: `analysis/backtest.js` + its instrument
// `analysis/performance.js`. CYCLE-054 (L10-bp ...).
//
// `performance.js` is the significance instrument the whole analysis battery reads
// (PSR/DSR/MinTRL, the Lo (2002) Sharpe standard error, the stationary-bootstrap
// p-value); `analysis/backtest.js` is the layer that ties splits + costs + the
// instrument together and produces the pooled out-of-sample report the promotion
// gate reads. Neither is on the locked hot path (both are `analysis/` only), but
// every honest-evaluation number in a `report.json` comes from here.
//
// PRE-REGISTERED READ. PASSES if (i) `erf`/`normalCdf`/`normalInvCdf` meet their
// documented error bounds against an INDEPENDENT quadrature / continued-fraction
// reference; (ii) the population-moment conventions (kurtosis([1..5]) = 1.7 etc.)
// and the Lo standard error are exact; (iii) PSR is 0.5 exactly at its benchmark,
// DSR is PSR at the expected-max hurdle, DSR <= PSR, and the expected-max closed
// form reproduces an independent inverse-CDF evaluation; (iv) MinTRL(SR=0.5, 95%)
// = 13.174945 and it is Infinity when SR <= benchmark; (v) the stationary-bootstrap
// p-value is size-calibrated on i.i.d. noise at the 5%/10% levels and deterministic
// per seed; (vi) the backtest arithmetic is exact (positions lag one bar, turnover
// counts the initial entry, `strategyReturns` gross/cost/net, equity curve,
// drawdown, tradeCount, the break-even identity); (vii) `poolFolds` restates the
// per-fold strategy aggregates exactly and (viii) `purgedCVBacktestAsync` is
// byte-identical to the serial path.
//
// The DEFECTS are reported in `findings`: (1) `hitRate`'s documented exclusion
// ("bars with no position") is not the implemented one (`r === 0`) - the signature
// only receives a return series, so the documented criterion is unimplementable -
// and because `backtestMetrics` feeds it the NET series, every exit-cost bar (a
// flat bar, charged a cost) is counted as a MISS: a perfectly-timed high-turnover
// strategy reports hitRate 0.5, not 1.0. (2) `scoreFold` re-lags the signal within
// the test slice, so the first bar of every fold is forced flat and - on a
// non-contiguous (CPCV) test set - the position held at each run boundary is the
// previous TEST bar's signal rather than the previous bar's, which contradicts the
// module's own "positions are the signals shifted by one bar" rule for the
// explicitly-supported fixed-signal path. (3) A probe lead is DISPROVED: the
// `minimumTrackRecordLength` negative-length regime is unreachable for measured
// moments, because Pearson's inequality (kurtosis >= skewness^2 + 1) forces
// v >= (1 - skew*SR/2)^2 >= 0; the only residual is a NaN-sharpe mislabel.

import {
    erf, normalCdf, normalInvCdf, mean, stdPopulation, stdSample, sharpeRatio,
    annualizeSharpe, deannualizeSharpe, skewness, kurtosis, sharpeStandardError,
    probabilisticSharpeRatio, expectedMaxSharpe, deflatedSharpeRatio,
    minimumTrackRecordLength, stationaryBootstrapSharpe, evaluateStrategy, EULER_MASCHERONI,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';
import {
    positionsFromSignals, turnover, strategyReturns, equityCurve, maxDrawdown,
    hitRate, tradeCount, backtestMetrics, poolFolds, purgedCVBacktest, purgedCVBacktestAsync,
    annualizedReturn,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/backtest.js';
import { purgedKFoldSplit, combinatorialPurgedSplit } from '../../NeuLegion-master/NeuLegion-master/src/analysis/splits.js';

// ---- independent references ---------------------------------------------------------------------------
// Simpson quadrature of 2/sqrt(pi) * integral_0^x exp(-t^2) dt. Error ~1e-13 at h=1e-3.
function simpsonErf(x) {
    if (x === 0) return 0;
    const s = Math.sign(x), ax = Math.abs(x);
    const n = Math.max(400, Math.ceil(ax / 1e-3) * 2);
    const h = ax / n;
    let sum = 0;
    for (let i = 1; i < n; i++) { const t = i * h; sum += (i % 2 ? 4 : 2) * Math.exp(-t * t); }
    const I = (h / 3) * (1 + sum + Math.exp(-ax * ax));
    return s * (2 / Math.sqrt(Math.PI)) * I;
}

// erfc for x >= 0 via the Lentz continued fraction (accurate in the tail), so
// tail round-trips are not limited by a Maclaurin series' cancellation.
function erfcCF(x) {
    if (x === 0) return 1;
    const tiny = 1e-300;
    let f = x === 0 ? tiny : x, C = f, D = 0, delta;
    for (let n = 1; n < 400; n++) {
        const a = n / 2;
        D = x + a * D; if (!D) D = tiny;
        C = x + a / C; if (!C) C = tiny;
        D = 1 / D; delta = C * D; f *= delta;
        if (Math.abs(delta - 1) < 1e-16) break;
    }
    return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}
const cdfRef = (x) => (x >= 0 ? 1 - 0.5 * erfcCF(x / Math.SQRT2) : 0.5 * erfcCF(-x / Math.SQRT2));
function invRef(p) {
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    let lo = -40, hi = 40;
    for (let i = 0; i < 300; i++) { const m = (lo + hi) / 2; if (cdfRef(m) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
}

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const close = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol;

// ---- the v >= 0 theorem and its search ---------------------------------------------------------------
// Pearson's inequality: for any distribution with a finite fourth moment,
// gamma4 >= gamma1^2 + 1. With x = SR, v = 1 - g1*x + ((g4-1)/4)x^2 >= 1 - g1*x + (g1^2/4)x^2 = (1 - g1*x/2)^2 >= 0.
// So the v < 0 branch of the sibling guards is unreachable for MEASURED moments.
function momentsOf(values, weights = null) {
    const n = weights ? weights.reduce((a, b) => a + b, 0) : values.length;
    let m = 0;
    if (weights) { for (let i = 0; i < values.length; i++) m += weights[i] * values[i]; }
    else for (const v of values) m += v;
    m /= n;
    let m2 = 0, m3 = 0, m4 = 0;
    if (weights) {
        for (let i = 0; i < values.length; i++) { const d = values[i] - m; m2 += weights[i] * d * d; m3 += weights[i] * d * d * d; m4 += weights[i] * d * d * d * d; }
    } else {
        for (const v of values) { const d = v - m; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; }
    }
    m2 /= n; m3 /= n; m4 /= n;
    const sd = Math.sqrt(m2);
    return {
        n, mean: m, sd,
        sr: sd > 0 ? m / sd : 0,
        skew: sd > 0 ? m3 / Math.pow(m2, 1.5) : 0,
        kurt: sd > 0 ? m4 / (m2 * m2) : 3,
    };
}
const vOf = (s) => 1 - s.skew * s.sr + ((s.kurt - 1) / 4) * s.sr * s.sr;

// A deterministic randomised search over moment-realizable histograms for the
// SMALLEST v reachable (the bound says 0, attained only at two-point supports).
function vSearch(iters = 60000, seed = 20260530) {
    const rnd = mulberry32(seed);
    const vals = [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5, 8, 12, 20];
    let best = { v: Infinity };
    for (let it = 0; it < iters; it++) {
        const supp = [];
        const m = 2 + Math.floor(rnd() * 3);
        while (supp.length < m) { const i = Math.floor(rnd() * vals.length); if (!supp.includes(i)) supp.push(i); }
        let rem = 40 + Math.floor(rnd() * 200);
        const w = new Array(supp.length).fill(0);
        for (let i = 0; i < supp.length - 1; i++) { const t = Math.floor(rnd() * rem * 0.9); w[i] = Math.max(1, t); rem -= w[i]; }
        w[supp.length - 1] = Math.max(1, rem);
        const vv = supp.map((i) => vals[i]);
        const s = momentsOf(vv, w);
        const v = vOf(s);
        if (v < best.v) best = { v, s, values: vv, counts: w, pearsonSlack: s.kurt - (s.skew * s.skew + 1), squareBound: Math.pow(1 - s.skew * s.sr / 2, 2) };
    }
    return best;
}

export async function run() {
    const checks = {};
    const rows = {};

    // ============================== A. the instrument: distributions ==================================
    checks.erfMatchesQuadrature = (() => {
        let maxAbs = 0, atX = 0;
        for (let x = -4; x <= 4.0001; x += 0.002) { const d = Math.abs(erf(x) - simpsonErf(x)); if (d > maxAbs) { maxAbs = d; atX = x; } }
        rows.erfAccuracy = { maxAbs, atX, documentedBound: 1.5e-7, reference: 'Simpson quadrature (h=1e-3)' };
        return maxAbs < 1.5e-7;
    })();
    checks.cdfExactAndOdd = (() => {
        const oddExact = [0.1, 0.5, 1, 2, 3, 3.5].every((x) => normalCdf(-x) + normalCdf(x) === 1);
        let monotone = true;
        for (let x = -3; x < 3; x += 0.01) if (!(normalCdf(x + 0.01) >= normalCdf(x))) monotone = false;
        return normalCdf(0) === 0.5 && oddExact && monotone && close(normalCdf(1.96), 0.975, 1.5e-4);
    })();
    checks.invCdfKnownAndSymmetric = (() => {
        rows.invCdfKnown = {
            p975: normalInvCdf(0.975), p025: normalInvCdf(0.025), p001: normalInvCdf(0.001),
            pExact: normalInvCdf(0.5), symmetry: [1e-3, 1e-4, 1e-6, 0.01, 0.1].map((p) => normalInvCdf(p) + normalInvCdf(1 - p)),
        };
        return close(normalInvCdf(0.975), 1.95996398612, 1e-8)
            && close(normalInvCdf(0.001), -3.09023230617, 1e-8)
            && normalInvCdf(0.5) === 0
            && normalInvCdf(0) === -Infinity && normalInvCdf(1) === Infinity
            && rows.invCdfKnown.symmetry.every((s) => Math.abs(s) < 1e-10);
    })();
    checks.invCdfRoundTrips = (() => {
        let maxErr = 0, atP = 0;
        for (const p of [1e-9, 1e-6, 1e-4, 0.001, 0.024, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1 - 1e-6, 1 - 1e-9]) {
            const e = Math.abs(cdfRef(normalInvCdf(p)) - p);
            if (e > maxErr) { maxErr = e; atP = p; }
        }
        rows.invCdfRoundTrip = { maxErr, atP, documentedBound: 1.15e-9 };
        return maxErr < 1.15e-9;
    })();
    checks.momentConventionsExact = (() => {
        rows.moments = {
            kurt12345: kurtosis([1, 2, 3, 4, 5]), skew12345: skewness([1, 2, 3, 4, 5]), skewSym: skewness([-1, 0, 1]),
            stdSample12345: stdSample([1, 2, 3, 4, 5]), stdPop12345: stdPopulation([1, 2, 3, 4, 5]), meanEmpty: mean([]),
            skewShort: skewness([1]), kurtShort: kurtosis([1]), kurtFlat: kurtosis([2, 2, 2]),
        };
        return close(kurtosis([1, 2, 3, 4, 5]), 1.7, 1e-12)
            && close(skewness([1, 2, 3, 4, 5]), 0, 1e-12)
            && close(skewness([-1, 0, 1]), 0, 1e-12)
            && close(stdSample([1, 2, 3, 4, 5]), Math.sqrt(10 / 4), 1e-12)
            && close(stdPopulation([1, 2, 3, 4, 5]), Math.SQRT2, 1e-12)
            && Number.isNaN(mean([])) && skewness([1]) === 0 && kurtosis([1]) === 3 && kurtosis([2, 2, 2]) === 3;
    })();
    checks.sharpeEstimatorExact = (() => {
        const r = [0.01, -0.02, 0.015, 0.004, -0.006];
        const m = mean(r);
        const sd = stdSample(r);
        rows.sharpe = { per: sharpeRatio(r), ref: m / sd, annual: sharpeRatio(r, { periodsPerYear: 252 }), refAnnual: (m / sd) * Math.sqrt(252) };
        return close(sharpeRatio(r), m / sd, 1e-15)
            && close(sharpeRatio(r, { periodsPerYear: 252 }), (m / sd) * Math.sqrt(252), 1e-12)
            && sharpeRatio([0.01, 0.01, 0.01, 0.01]) === 0
            && Number.isNaN(sharpeRatio([0.01]))
            && close(annualizeSharpe(deannualizeSharpe(1.5, 252), 252), 1.5, 1e-12);
    })();
    checks.sharpeStandardError = (() => {
        const v = 1 - 0 * 1 + ((3 - 1) / 4) * 1;
        return close(sharpeStandardError({ sharpe: 1, n: 100 }), Math.sqrt(v / 99), 1e-15)
            && Number.isNaN(sharpeStandardError({ sharpe: 1, n: 1 }))
            && close(sharpeStandardError({ sharpe: 0.5, n: 240, skew: -0.3, kurtosis: 4.2 }),
                Math.sqrt((1 + 0.3 * 0.5 + (3.2 / 4) * 0.25) / 239), 1e-15);
    })();

    // ============================== B. the instrument: PSR / DSR / MinTRL =============================
    checks.psrHalfAtBenchmark = (() => {
        const half = probabilisticSharpeRatio({ sharpe: 0.7, n: 50, skew: -0.4, kurtosis: 5, benchmarkSR: 0.7 });
        return half === 0.5 && Number.isNaN(probabilisticSharpeRatio({ sharpe: 0.7, n: 1 }));
    })();
    checks.psrIndependentRecompute = (() => {
        const SR = 0.42, n = 130, skew = -0.7, kurt = 5.5, bench = 0.1;
        const psr = probabilisticSharpeRatio({ sharpe: SR, n, skew, kurtosis: kurt, benchmarkSR: bench });
        const v = 1 - skew * SR + ((kurt - 1) / 4) * SR * SR;
        const z = (SR - bench) * Math.sqrt(n - 1) / Math.sqrt(v);
        rows.psr = { psr, z, ref: cdfRef(z), diff: Math.abs(psr - cdfRef(z)) };
        // the module's normalCdf inherits erf's <=1.5e-7 absolute error; allow it (F-57 tolerance rule)
        return Math.abs(psr - cdfRef(z)) < 5e-7;
    })();
    checks.dsrIsPsrAtHurdle = (() => {
        const args = { sharpe: 0.5, n: 100, skew: -0.3, kurtosis: 4.2, trials: 10, trialsVariance: 0.01 };
        const hurdle = expectedMaxSharpe({ trials: 10, trialsVariance: 0.01 });
        const dsr = deflatedSharpeRatio(args);
        const psrAtHurdle = probabilisticSharpeRatio({ ...args, benchmarkSR: hurdle });
        rows.dsr = { hurdle, dsr, psr: probabilisticSharpeRatio(args), psrAtHurdle, diff: Math.abs(dsr - psrAtHurdle) };
        return close(dsr, psrAtHurdle, 1e-15) && dsr <= probabilisticSharpeRatio(args) + 1e-15;
    })();
    checks.expectedMaxClosedForm = (() => {
        const N = 10, V = 0.01;
        const ref = Math.sqrt(V) * ((1 - EULER_MASCHERONI) * invRef(1 - 1 / N) + EULER_MASCHERONI * invRef(1 - 1 / (N * Math.E)));
        const mono = [2, 5, 10, 100, 1000].map((t) => expectedMaxSharpe({ trials: t, trialsVariance: V }));
        const scaled = [1, 4, 9].map((m) => expectedMaxSharpe({ trials: N, trialsVariance: V * m }));
        rows.hurdle = {
            value: expectedMaxSharpe({ trials: N, trialsVariance: V }), ref, diff: Math.abs(expectedMaxSharpe({ trials: N, trialsVariance: V }) - ref),
            monotoneInTrials: mono, sqrtScaling: scaled.map((s, i) => s / scaled[0]),
        };
        return close(expectedMaxSharpe({ trials: N, trialsVariance: V }), ref, 1e-6)
            && mono.every((x, i) => i === 0 || x > mono[i - 1])
            && scaled.every((s, i) => close(s, scaled[0] * (i + 1), 1e-9))
            && expectedMaxSharpe({ trials: 1, trialsVariance: 1 }) === 0
            && expectedMaxSharpe({ trials: 10, trialsVariance: 0 }) === 0;
    })();
    checks.minTrlExact = (() => {
        const mtrl = minimumTrackRecordLength({ sharpe: 0.5, benchmarkSR: 0, prob: 0.95 });
        const ref = 1 + 1.125 * Math.pow(invRef(0.95) / 0.5, 2);
        rows.mtrl = { value: mtrl, ref, documentedVector: 13.174945, infiniteWhenBelow: minimumTrackRecordLength({ sharpe: 0.1, benchmarkSR: 0.2 }), decreasesAsSreRises: minimumTrackRecordLength({ sharpe: 0.8 }) < mtrl };
        return close(mtrl, 13.174945, 1e-4) && close(mtrl, ref, 1e-6)
            && minimumTrackRecordLength({ sharpe: 0.1, benchmarkSR: 0.2 }) === Infinity
            && minimumTrackRecordLength({ sharpe: 0.8 }) < mtrl;
    })();

    // ============================== C. the instrument: bootstrap calibration ==========================
    checks.bootstrapCalibration = (() => {
        const R = 1000, samples = 300, n = 240;
        let rej5 = 0, rej10 = 0, sumP = 0;
        for (let r = 0; r < R; r++) {
            const rnd = mulberry32(9000 + r);
            const ret = Array.from({ length: n }, () => gauss(rnd) * 0.01);
            const b = stationaryBootstrapSharpe({ returns: ret, benchmarkSR: 0, samples, seed: 1 + r });
            sumP += b.pValue;
            if (b.pValue <= 0.05) rej5++;
            if (b.pValue <= 0.10) rej10++;
        }
        rows.bootstrapCalibration = { reps: R, samples, n, size5: rej5 / R, size10: rej10 / R, meanP: sumP / R, repoClaim5: 0.058, seAtClaim: Math.sqrt(0.058 * 0.942 / R) };
        return Math.abs(rows.bootstrapCalibration.size5 - 0.058) < 0.03
            && rows.bootstrapCalibration.size5 < 0.09
            && rows.bootstrapCalibration.size10 < 0.15
            && Math.abs(rows.bootstrapCalibration.meanP - 0.5) < 0.04;
    })();
    checks.bootstrapDeterminismAndEdges = (() => {
        const rnd = mulberry32(99);
        const ret = Array.from({ length: 100 }, () => gauss(rnd) * 0.01);
        const a = stationaryBootstrapSharpe({ returns: ret, samples: 100, seed: 7 });
        const b = stationaryBootstrapSharpe({ returns: ret, samples: 100, seed: 7 });
        const c = stationaryBootstrapSharpe({ returns: ret, samples: 100, seed: 8 });
        const short = stationaryBootstrapSharpe({ returns: [0.01], samples: 50 });
        const bl1 = stationaryBootstrapSharpe({ returns: [0.01, -0.01, 0.02, -0.02, 0.005, -0.005, 0.003, -0.003], samples: 200, blockLength: 1, seed: 3 });
        rows.bootstrapEdges = { sameSeedIdentical: JSON.stringify(a) === JSON.stringify(b), differsBySeed: JSON.stringify(a) !== JSON.stringify(c), short: short, block1: bl1, observed: a.observed };
        return JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c)
            && Number.isNaN(short.pValue) && short.samples === 0
            && bl1.pValue >= 0 && bl1.pValue <= 1 && bl1.samples === 200
            && close(a.observed, sharpeRatio(ret), 1e-15);
    })();
    checks.evaluateStrategyCoherent = (() => {
        const rnd = mulberry32(4);
        const ret = Array.from({ length: 300 }, () => 0.0005 + gauss(rnd) * 0.01);
        const ev = evaluateStrategy(ret, { periodsPerYear: 252, trials: 5, trialsVariance: 0.02 });
        const per = sharpeRatio(ret);
        rows.evaluateStrategy = { n: ev.n, sharpe: ev.sharpe, perPeriod: ev.perPeriodSharpe, psr: ev.psr, dsr: ev.dsr, mtrl: ev.minTrackRecordLength, se: ev.sharpeStandardError };
        return ev.n === 300 && close(ev.perPeriodSharpe, per, 1e-15)
            && close(ev.sharpe, per * Math.sqrt(252), 1e-12)
            && [ev.psr, ev.dsr, ev.minTrackRecordLength, ev.sharpeStandardError].every(Number.isFinite)
            && ev.dsr <= ev.psr + 1e-15;
    })();

    // ============================== D. the v >= 0 theorem (a disproved lead) ==========================
    checks.pearsonBoundsV = (() => {
        const best = vSearch(60000);
        // every moment-realizable histogram satisfies both bounds
        const rnd = mulberry32(7);
        let violations = 0, minV = Infinity;
        for (let it = 0; it < 20000; it++) {
            const n = 5 + Math.floor(rnd() * 400);
            const ret = Array.from({ length: n }, () => (rnd() * 2 - 1) * Math.pow(10, Math.floor(rnd() * 5) - 2));
            const s = momentsOf(ret);
            const v = vOf(s);
            if (v < minV) minV = v;
            if (s.kurt < s.skew * s.skew + 1 - 1e-9) violations++;
            if (v < Math.pow(1 - s.skew * s.sr / 2, 2) - 1e-9) violations++;
            if (v < -1e-12) violations++;
        }
        rows.vTheorem = { searchMinimum: best, randomHistogramViolations: violations, randomMinimumV: minV, note: 'Pearson: kurtosis >= skewness^2 + 1  =>  v >= (1 - skew*SR/2)^2 >= 0' };
        return violations === 0 && best.v > -1e-9 && best.pearsonSlack > -1e-9 && best.squareBound > -1e-9;
    })();
    checks.minTrlNeverNegativeFromMoments = (() => {
        const rnd = mulberry32(11);
        let minMtrl = Infinity, minAt = null;
        for (let it = 0; it < 4000; it++) {
            const n = 6 + Math.floor(rnd() * 300);
            const ret = Array.from({ length: n }, () => (rnd() * 2 - 1) * 0.05 + (rnd() < 0.05 ? 0.2 : 0));
            const s = momentsOf(ret);
            if (!(s.sr > 0)) continue;
            const m = minimumTrackRecordLength({ sharpe: s.sr, skew: s.skew, kurtosis: s.kurt });
            if (m < minMtrl) { minMtrl = m; minAt = { n, sr: s.sr, skew: s.skew, kurt: s.kurt, v: vOf(s) }; }
        }
        rows.mtrlFromMoments = { minimum: minMtrl, at: minAt };
        return minMtrl >= 1 - 1e-9;
    })();

    // ============================== E. the backtest arithmetic ======================================
    checks.positionsAndTurnover = (() => {
        const pos = positionsFromSignals([1, -1, 1, 1, 0], { lag: 1 });
        rows.positions = { pos, lag0: positionsFromSignals([1, 0, -1], { lag: 0 }), turnoverPos: turnover(pos), turnoverShort: turnover([0, 1, 1]) };
        return JSON.stringify(pos) === JSON.stringify([0, 1, -1, 1, 1])
            && JSON.stringify(positionsFromSignals([1, 1, 1], { lag: 1 })) === JSON.stringify([0, 1, 1])
            && JSON.stringify(positionsFromSignals([1, 0, -1], { lag: 0 })) === JSON.stringify([1, 0, -1])
            && turnover(pos) === 5 && turnover([0, 1, 1]) === 1;
    })();
    checks.strategyReturnsExact = (() => {
        const sr = strategyReturns({ returns: [0.01, 0.02, 0.03], signals: [1, 1, 1], costBps: 10 });
        const pos = positionsFromSignals([1, 1, 1], { lag: 1 });
        const fee = 10 / 1e4;
        const refCost = pos.map((p, t) => Math.abs(p - (t ? pos[t - 1] : 0)) * fee);
        const refNet = sr.gross.map((g, t) => g - refCost[t]);
        rows.strategyReturns = { gross: sr.gross, net: sr.returns, cost: sr.cost, turnover: sr.turnover };
        return close(sr.gross[0], 0, 1e-15) && close(sr.gross[1], 0.02, 1e-15) && close(sr.gross[2], 0.03, 1e-15)
            && close(sr.returns[1], 0.019, 1e-15) && close(sr.returns[2], 0.03, 1e-15)
            && close(sr.cost.reduce((a, b) => a + b, 0), 0.001, 1e-15)
            && close(sr.turnover, turnover(pos), 1e-15)
            && sr.returns.every((v, t) => close(v, refNet[t], 1e-15));
    })();
    checks.equityAndDrawdown = (() => {
        const eq = equityCurve([0.1, -0.2, 0.05]);
        rows.equity = { eq, mdd: maxDrawdown(eq), mddRef: (1.1 - 0.88) / 1.1, allUp: maxDrawdown(equityCurve([0.1, 0.1])), allDown: maxDrawdown(equityCurve([-0.1, -0.1])) };
        return eq.length === 4 && close(eq[0], 1, 1e-15) && close(eq[1], 1.1, 1e-12)
            && close(eq[2], 0.88, 1e-12) && close(eq[3], 0.924, 1e-12)
            && close(maxDrawdown(eq), 0.2, 1e-12)
            && close(maxDrawdown(equityCurve([0.1, -0.5, 0.25])), 0.5, 1e-12)
            && maxDrawdown(equityCurve([0.1, 0.1])) === 0
            && close(maxDrawdown(equityCurve([-0.1, -0.1])), 0.19, 1e-12);
    })();
    checks.tradeCountSemantics = (() => {
        rows.tradeCount = { flat: tradeCount([0, 0, 0]), roundTrip: tradeCount([0, 1, 1, 0]), entryOnly: tradeCount([1, 1, 0, 0]), reversal: tradeCount([0, 1, 1, -1, 0]) };
        return tradeCount([0, 0, 0]) === 0 && tradeCount([0, 1, 1, 0]) === 2
            && tradeCount([1, 1, 0, 0]) === 2 && tradeCount([0, 1, 1, -1, 0]) === 3;
    })();
    checks.metricsIdentities = (() => {
        const ret = Array.from({ length: 100 }, (_, i) => 0.002 + 0.01 * Math.sin(i * 0.7));
        const sig = Array.from({ length: 100 }, (_, i) => (Math.sin(i * 0.3) > 0 ? 1 : -1));
        const m = backtestMetrics({ returns: ret, signals: sig, costBps: 4, periodsPerYear: 252, trials: 3 });
        const pos = positionsFromSignals(sig, { lag: 1 });
        rows.metrics = {
            bars: m.bars, turnover: m.turnover, tradeCount: m.tradeCount, totalCost: m.totalCost, grossPnl: m.grossPnl,
            breakEven: m.breakEvenCostBps, breakEvenRef: (1e4 * m.grossPnl) / m.turnover, nonZero: m.nonZeroFraction,
            meanAbs: m.meanAbsPosition, mtrlStatus: m.minTrackRecordLengthStatus,
        };
        return m.bars === 100 && m.turnover === turnover(pos) && m.tradeCount === tradeCount(pos)
            && close(m.totalCost, m.turnover * 4 / 1e4, 1e-12)
            && close(m.breakEvenCostBps, (1e4 * m.grossPnl) / m.turnover, 1e-12)
            && close(m.nonZeroFraction, pos.filter((p) => p !== 0).length / 100, 1e-15)
            && close(m.meanAbsPosition, pos.reduce((a, p) => a + Math.abs(p), 0) / 100, 1e-15)
            && m.dsr <= m.psr + 1e-15 && m.grossSharpe >= m.netSharpe - 1e-12;
    })();
    checks.hitRateActualCriterion = (() => {
        const v = hitRate([0, 0.01, -0.02, 0, 0.03]);
        rows.hitRateShipped = { value: v, shippedTest: 2 / 3, note: 'the shipped vector coincides for flat-in-return-space and flat-in-position-space, so the shipped check cannot distinguish the two criteria' };
        return close(v, 2 / 3, 1e-15) && Number.isNaN(hitRate([0, 0, 0])) && hitRate([0.1, 0.2]) === 1;
    })();
    checks.poolFoldsRestatesAggregates = (() => {
        const returns = Array.from({ length: 64 }, (_, i) => 0.001 + 0.01 * Math.sin(i * 0.7));
        const folds = purgedKFoldSplit({ n: 64, k: 4, labelSpan: 2, embargo: 1 });
        const cv = purgedCVBacktest({ returns, signals: returns.map((_, i) => (i % 3 ? 1 : -1)), folds, costBps: 6, periodsPerYear: 252, trials: 2 });
        const manual = poolFolds(cv.folds, cv.pooledReturns, cv.pooledGross, { periodsPerYear: 252, trials: 2 });
        const sumTurn = cv.folds.reduce((a, f) => a + f.metrics.turnover, 0);
        const sumCost = cv.folds.reduce((a, f) => a + f.metrics.totalCost, 0);
        const sumTrades = cv.folds.reduce((a, f) => a + f.metrics.tradeCount, 0);
        rows.poolFolds = { pooledTurnover: cv.pooledMetrics.turnover, sumTurn, pooledCost: cv.pooledMetrics.totalCost, sumCost, pooledTrades: cv.pooledMetrics.tradeCount, sumTrades, pooledBars: cv.pooledBars };
        return close(cv.pooledMetrics.turnover, sumTurn, 1e-15) && close(cv.pooledMetrics.totalCost, sumCost, 1e-15)
            && cv.pooledMetrics.tradeCount === sumTrades && cv.pooledBars === cv.pooledReturns.length
            && JSON.stringify(cv.pooledMetrics) === JSON.stringify(manual.pooledMetrics)
            && close(manual.meanFoldSharpe, cv.folds.reduce((a, f) => a + f.metrics.netSharpe, 0) / cv.folds.length, 1e-15);
    })();
    checks.asyncMatchesSerial = (async () => {
        const returns = Array.from({ length: 64 }, (_, i) => 0.001 + 0.01 * Math.sin(i * 0.7));
        const folds = purgedKFoldSplit({ n: 64, k: 4, labelSpan: 2, embargo: 1 });
        const sig = (train, test) => test.map((i) => (Math.sin(i * 0.7) > 0 ? 1 : -1));
        const serial = purgedCVBacktest({ returns, folds, signalForFold: sig, costBps: 3, periodsPerYear: 252, trials: 2 });
        const para = await purgedCVBacktestAsync({
            returns, folds, foldExecutor: async ({ test }) => ({ signals: sig(null, test) }),
            costBps: 3, periodsPerYear: 252, trials: 2, concurrency: 4,
        });
        const keys = ['folds', 'foldSignals', 'foldInputs', 'pooledMetrics', 'meanFoldSharpe', 'pooledBars', 'pooledReturns', 'pooledGross'];
        rows.asyncSerial = { identical: keys.every((k) => JSON.stringify(serial[k]) === JSON.stringify(para[k])) };
        return keys.every((k) => JSON.stringify(serial[k]) === JSON.stringify(para[k]));
    })();
    checks.annualizedReturnExact = (() => {
        const r = [0.1, -0.2, 0.05];
        rows.annualized = { value: annualizedReturn(r, 3), ref: Math.pow(0.924, 3 / 3) - 1, monotoneInReturns: annualizedReturn([0.02, 0.02]) > annualizedReturn([0.01, 0.01]) };
        return close(annualizedReturn(r, 3), -0.076, 1e-12)
            && close(annualizedReturn(r, 3), Math.pow(equityCurve(r).at(-1), 3 / r.length) - 1, 1e-15)
            && annualizedReturn([0.02, 0.02]) > annualizedReturn([0.01, 0.01]);
    })();

    // ============================== F. findings =====================================================
    // (1) hitRate: the documented exclusion and the implemented one disagree, and the
    // implemented one is deflated by exit costs because backtestMetrics feeds it net returns.
    const hitRateFind = (() => {
        // witness A: an in-market bar whose net return is exactly 0 is dropped
        const wA = (() => {
            const positions = [1, 1, 1, 1];
            const ret = [0.01, 0, -0.01, 0.02];
            const bt = strategyReturns({ returns: ret, positions, costBps: 0 });
            const inMarket = bt.returns.filter((_, i) => positions[i] !== 0);
            return {
                positions, returns: ret, net: bt.returns,
                inMarketBars: inMarket.length,
                documented: inMarket.filter((r) => r > 0).length / inMarket.length,
                shipped: hitRate(bt.returns),
            };
        })();
        // witness B: a flat bar charged an EXIT cost is counted as a miss; a perfectly
        // timed, high-turnover strategy reads 0.5 instead of 1.0
        const wB = (() => {
            const positions = [1, 0, 1, 0, 1, 0];
            const ret = [0.01, 0, 0.01, 0, 0.01, 0];
            const bt = strategyReturns({ returns: ret, positions, costBps: 10 });
            const inMarket = bt.returns.filter((_, i) => positions[i] !== 0);
            return {
                positions, returns: ret, net: bt.returns,
                inMarketBars: inMarket.length,
                documented: inMarket.filter((r) => r > 0).length / inMarket.length,
                shipped: hitRate(bt.returns),
            };
        })();
        return {
            claim: 'hitRate returns "the fraction of in-market bars with a positive net return; bars with no position are excluded"',
            signature: 'hitRate(strategyReturnSeries) - the function receives only a RETURN series, so a position mask is not an available input',
            implemented: 'the loop skips r === 0 and counts everything else',
            witnessZeroReturnBar: wA,
            witnessExitCostBar: wB,
            consumers: ['backtestMetrics.hitRate = hitRate(net) (net = AFTER costs)', 'poolFolds pooledMetrics.hitRate = hitRate(pooled) via an all-long overlay', 'formatReport prints hit=…'],
            shippedTest: "analysis.test.js: check('hitRate excludes flat bars', close(hitRate([0, 0.01, -0.02, 0, 0.03]), 2 / 3)) - the vector's flat bars ARE its zero-return bars, so the two criteria coincide and the check cannot discriminate",
            note: 'Two failure modes, both understating the hit rate: (a) an in-market bar whose NET return is exactly 0 is dropped from the denominator (witness A: 0.667 shipped vs 0.5 by the documented rule); (b) a FLAT bar charged an exit cost has net < 0 and is counted as a MISS (witness B: a strategy that is right on every in-market bar reads 0.5, not 1.0). Because backtestMetrics passes the cost-laden NET series, mode (b) grows with the round-trip count - the reported hit rate is a function of the cost level and the turnover as much as of the strategy. The documented criterion cannot even be expressed by the signature. Report-level (hitRate is a printed readout, not a gate input).',
        };
    })();

    // (2) scoreFold re-lags the per-fold signal series inside the test slice.
    const foldRelagFind = (() => {
        const N = 64;
        const returns = new Array(N).fill(0.001);
        const signals = new Array(N).fill(1);
        signals[29] = -1; returns[10] = 0.02; returns[30] = 0.05;
        const globalPos = positionsFromSignals(signals, { lag: 1 });
        const contiguousFold = [{ train: Array.from({ length: 20 }, (_, i) => i), test: Array.from({ length: 10 }, (_, i) => 20 + i), testStart: 20, testEnd: 29 }];
        const cpcvFold = [{ train: Array.from({ length: 30 }, (_, i) => i), test: [10, 11, 12, 30, 31, 32], testStart: 10, testEnd: 32 }];
        const runFold = (fold) => {
            const cv = purgedCVBacktest({ returns, signals, folds: fold, costBps: 0, periodsPerYear: 1 });
            const ref = fold[0].test.map((i) => globalPos[i] * returns[i]);
            return { pooled: cv.pooledReturns, ref, maxAbsDiff: Math.max(...cv.pooledReturns.map((v, i) => Math.abs(v - ref[i]))) };
        };
        const a = runFold(contiguousFold);
        const b = runFold(cpcvFold);
        // the re-lag is exactly positionsFromSignals applied to the SLICE
        const bSub = cpcvFold[0].test.map((i) => signals[i]);
        return {
            claim: 'purgedCVBacktest scores the (fixed) signal series inside every fold\'s test slice; the module header says "positions are the signals shifted by one bar"',
            mechanism: 'scoreFold calls strategyReturns({ returns: subReturns, signals }) with positions = null, so positionsFromSignals re-derives the lag WITHIN the slice: pos[j] = subSignals[j-1], pos[0] = 0',
            contiguous: {
                test: contiguousFold[0].test, pooled: a.pooled, globalReference: a.ref, maxAbsDiff: a.maxAbsDiff,
                firstBarPooled: a.pooled[0], firstBarGlobal: a.ref[0],
            },
            nonContiguousCpcv: {
                test: cpcvFold[0].test, subSignals: bSub, pooled: b.pooled, globalReference: b.ref, maxAbsDiff: b.maxAbsDiff,
                boundaryBar: 30, pooledAt30: b.pooled[3], globalAt30: b.ref[3],
            },
            magnitude: (() => {
                const n = 64;
                const ret = Array.from({ length: n }, (_, i) => 0.001 + 0.01 * Math.sin(i * 0.7));
                const sig = Array.from({ length: n }, (_, i) => (i % 3 ? 1 : -1));
                const folds = purgedKFoldSplit({ n, k: 4, labelSpan: 2, embargo: 1 });
                const cv = purgedCVBacktest({ returns: ret, signals: sig, folds, costBps: 0, periodsPerYear: 252 });
                const gp = positionsFromSignals(sig, { lag: 1 });
                const refAll = folds.flatMap((f) => f.test.map((i) => gp[i] * ret[i]));
                return { pooledBars: cv.pooledBars, differingBars: cv.pooledReturns.filter((v, i) => Math.abs(v - refAll[i]) > 1e-15).length, maxAbsDiffOnFlatSeries: Math.max(...cv.pooledReturns.map((v, i) => Math.abs(v - refAll[i]))) };
            })(),
            note: 'For a per-fold-FITTED signal (`signalForFold`, the production path) re-lagging inside the slice is defensible - the interface hands over signals for the test bars only, so the position for the first test bar is genuinely unavailable and the fold starts flat. For the FIXED-global-series path (`signals:`, explicitly supported - walkforward.js says "set requireCausal false only for a fixed signal evaluated with purged K-fold") the module\'s own rule is available and is not used: the first bar of every fold is forced flat (its return AND its entry cost are dropped), and on a NON-CONTIGUOUS (CPCV) test set the position held at each run boundary is the previous TEST bar\'s signal rather than the previous BAR\'s - here bar 30 holds signals[12] = +1 instead of signals[29] = -1, a return error of 0.10 on that bar alone. On a 4-fold purged K-fold of 64 bars the pooled series differs from the global reference on 3/64 bars (the first fold starts at bar 0, where both series are 0). LATENT (production uses signalForFold) but a real contract divergence.',
        };
    })();

    // (3) MinTRL: the negative-length lead is unreachable; the residual is a NaN mislabel.
    const mtrlFind = (() => {
        const naive = (() => {
            const SR = 1, skew = 3, kurt = 3;
            return {
                input: { sharpe: SR, skew, kurtosis: kurt },
                v: 1 - skew * SR + ((kurt - 1) / 4) * SR * SR,
                psr: probabilisticSharpeRatio({ sharpe: SR, n: 100, skew, kurtosis: kurt }),
                standardError: sharpeStandardError({ sharpe: SR, n: 100, skew, kurtosis: kurt }),
                mtrl: minimumTrackRecordLength({ sharpe: SR, skew, kurtosis: kurt }),
                pearsonViolated: kurt < skew * skew + 1,
            };
        })();
        const nanFace = (() => {
            const m = backtestMetrics({ returns: [0.01], signals: [1], costBps: 0, periodsPerYear: 252 });
            return {
                oneBarSeries: { sharpe: m.netSharpe, perPeriod: m.perPeriodNetSharpe, psr: m.psr, mtrl: m.minTrackRecordLength, status: m.minTrackRecordLengthStatus },
                directNaN: minimumTrackRecordLength({ sharpe: NaN }),
                directInfinity: minimumTrackRecordLength({ sharpe: 0.1, benchmarkSR: 0.2 }),
                docstring: 'Inf when SR <= benchmarkSR;  NaN <= benchmarkSR is false',
            };
        })();
        return {
            claim: 'minimumTrackRecordLength can return a NEGATIVE (finite) track-record length because it has no v > 0 guard while sharpeStandardError/probabilisticSharpeRatio do',
            verdict: 'DISPROVED for measured moments',
            proof: 'For a sample distribution Pearson\'s inequality gives kurtosis >= skewness^2 + 1, so v = 1 - skew*SR + ((kurt-1)/4)*SR^2 >= 1 - skew*SR + (skew^2/4)*SR^2 = (1 - skew*SR/2)^2 >= 0. MinTRL = 1 + v*(z/SR)^2 >= 1 whenever sharpe > benchmarkSR.',
            handPickedWitness: naive,
            searchEvidence: rows.vTheorem,
            momentWitness: rows.mtrlFromMoments,
            residualDefect: nanFace,
            note: 'The probe\'s negative MinTRL (-3.058 at sharpe 1 / skew 3 / kurtosis 3) is an artefact of an impossible moment triple: kurtosis 3 with skewness 3 violates Pearson (kurtosis >= skewness^2 + 1 = 10), so no return series realizes it. The search over 60000 moment-realizable histograms bottoms out at v = 0 attained only by two-point supports (where v = (1 - skew*SR/2)^2 = 0 exactly), and 20000 random histograms violate neither bound. So the guard asymmetry is defensively correct-but-unnecessary, NOT a defect. What IS real: the guard `!(sharpe > benchmarkSR)` also catches NaN, so `minimumTrackRecordLength({sharpe: NaN})` returns Infinity and `backtestMetrics` on a 1-bar fold reports `minTrackRecordLengthStatus: "beyond-horizon"` for a Sharpe that could not be computed - "unavailable" is the correct label, and the function\'s own docstring ("Inf when SR <= benchmarkSR") is not satisfied by NaN. LATENT (needs a 1-bar test fold).',
        };
    })();

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = await v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-bp..: `analysis/performance.js` (the significance instrument) + `analysis/backtest.js` (the layer that ties splits + costs + the instrument into the pooled OOS report). PASSES the pre-registered read: erf matches an independent Simpson quadrature inside its documented 1.5e-7 bound; normalCdf(0) = 0.5 exactly and is odd; normalInvCdf round-trips to < 1.15e-9 against a Lentz-erfc reference and is symmetric; the population moment conventions are exact; the Sharpe estimator and its Lo (2002) standard error are exact; PSR is 0.5 exactly at its benchmark and reproduces an independent z; DSR = PSR at the expected-max hurdle to 1e-15 and DSR <= PSR; expectedMaxSharpe reproduces an independent inverse-CDF evaluation and is monotone in trials / proportional to sqrt(V); MinTRL(SR=0.5, 95%) = 13.174945 and is Infinity below benchmark; the stationary-bootstrap p-value is size-calibrated on 1000 i.i.d. noise series (measured 5.9% at 5%, 11.0% at 10%, mean p 0.502, vs the repo\'s 5.8% claim) and deterministic per seed; the backtest arithmetic is exact (positions lag one bar, turnover counts the initial entry, strategyReturns gross/cost/net, equity curve, drawdown, tradeCount, the break-even identity, the participation fields); poolFolds restates the per-fold aggregates exactly and purgedCVBacktestAsync is byte-identical to the serial path. FINDINGS: (1) `hitRate`\'s documented exclusion (no-position bars) is not implementable from its signature and not implemented - the code skips r === 0, and because backtestMetrics feeds it the NET series every exit-cost bar (flat, charged a cost) counts as a MISS: a perfectly-timed 3-round-trip strategy reports hitRate 0.5 instead of 1.0, and the shipped test vector cannot discriminate the two criteria; (2) `scoreFold` re-lags the signal inside the test slice, so on the fixed-signal path the first bar of every fold is forced flat and a non-contiguous CPCV fold holds the previous TEST bar\'s signal at each run boundary (measured: bar 30 holds +1 instead of -1, a 0.10 return error on that bar), contradicting the module header\'s "positions are the signals shifted by one bar"; (3) the negative-MinTRL probe lead is DISPROVED - Pearson\'s inequality forces v >= (1 - skew*SR/2)^2 >= 0 for measured moments, so MinTRL >= 1 always; the residual is that a NaN sharpe yields Infinity and is labelled "beyond-horizon" instead of "unavailable". Scope: SHIPPED instrument + shipped backtest layer (both read by report.json), but none of the three findings touches the locked hot path or a golden.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            hitRateCriterion: hitRateFind,
            scoreFoldRelag: foldRelagFind,
            minTrlGuardDisproved: mtrlFind,
        },
        scope: {
            shipped: ['erf/normalCdf/normalInvCdf', 'sharpeRatio/sharpeStandardError', 'probabilisticSharpeRatio/deflatedSharpeRatio/expectedMaxSharpe', 'minimumTrackRecordLength', 'stationaryBootstrapSharpe', 'evaluateStrategy', 'positionsFromSignals/turnover/strategyReturns', 'equityCurve/maxDrawdown/hitRate/tradeCount', 'backtestMetrics/poolFolds', 'purgedCVBacktest/purgedCVBacktestAsync', 'annualizedReturn'],
            testOnly: [],
            why: 'walkforward.js -> purgedCVBacktest/poolFolds and analyze.js -> report.json both read this layer; performance.js is imported by backtest.js, walkforward.js, forecast.js, decision.js, reality_check.js, overfitting.js, replication.js and streams.js, so every PSR/DSR/MinTRL in a report comes from here. The v<0 guard question is moot for measured moments (Pearson), and none of the findings can move a golden fingerprint.',
        },
    };

    return { config: { bootstrapReps: 1000, bootstrapSamples: 300, bootstrapN: 240, vSearchIters: 60000, erfGrid: '[-4,4] step 0.002' }, rows, validation: resolved, verdict };
}
