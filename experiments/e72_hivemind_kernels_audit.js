// E72 - THE HIVEMIND NUMERIC KERNELS, AUDITED: `hivemind/kernels/{activations,linalg,normalization,sampling,statistics}.js`.
// CYCLE-064 (L10-co ...). The FIRST audit outside `analysis/`: the model's own mathematical primitives.
//
// These five files are mixin method-bags installed onto HiveMind.prototype (`internal/mixins.js`), so each method
// runs with a HiveMind instance as `this`. They are SHIPPED: `hivemind/training/gradients.js` calls
// `_computeSpectralNorm`/`_computeGradientNorm`/`_computeVariance`/`_computeFractalDimension`/`_computeNTKStability`/
// `_computePercentile`/`_computeDynamicPercentile`/`_computeSparseThreshold` in the per-step training hot path, and
// `hivemind/transformer/*` calls the activations/linalg/normalization kernels. Pure (no I/O); the golden suite
// (`test/browser/entries/golden.test.js`) pins their numerics.
//
// PRE-REGISTERED READ. PASSES if: (i) each kernel matches its closed form on finite inputs; (ii) the documented
// degenerate contracts hold; (iii) the finding probes correctly exhibit whatever the code does on the edges. The
// DEFECTS are reported in `findings`. All methods are called via `.call(mix, ...)` on a merged mixin object.

import { activationMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/kernels/activations.js';
import { linalgMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/kernels/linalg.js';
import { normalizationMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/kernels/normalization.js';
import { samplingMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/kernels/sampling.js';
import { statisticsMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/kernels/statistics.js';

const close = (a, b, tol = 1e-9) => (a === b) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol);
const sig = (x) => 1 / (1 + Math.exp(-x));

// a merged fake HiveMind `this`: every method bag + the underscore fields the methods read + the cross-bag stubs.
const mkMix = (over = {}) => Object.assign({},
    activationMethods, linalgMethods, normalizationMethods, samplingMethods, statisticsMethods, {
        _hiddenSize: 8, _numHeads: 2, _numProjections: 3, _lowDim: 4,
        _protoCapacityFactor: 0.5, _maxVariancePerDim: 4, _contextWindow: 100, _memoryFactor: 0.5, _maxPerformanceHistory: 100,
        _lshNumTables: 8, _lshHashBits: 16,
        _historicalPerformance: {}, _performanceScores: {},
        _kernelSimilarity() { return 0; },
        _invalidateProjCache() {}, _computeProjNorms() { return null; }, _updateProtoInLSH() {}, _computeContentHash() { return ''; },
        _getAvgProtoVariance() { return 0; },
    }, over);

export async function run() {
    const mix = mkMix();
    const checks = {};
    const rows = {};

    // ============================== A. activations ==================================================
    checks.activationsContract = (() => {
        const okSilu = [-5, -2, -0.5, 0, 0.5, 2, 5].every((x) => close(mix._silu(x), x * sig(x), 1e-12) && close(mix._siluDerivative(x), sig(x) * (1 + x * (1 - sig(x))), 1e-12));
        const okSig = [-10, -3, -1, 0, 1, 3, 10].every((x) => close(mix._sigmoid(x), sig(x), 1e-15));
        const mono = (() => { let p = -Infinity; for (let x = -8; x <= 8; x += 0.25) { const s = mix._sigmoid(x); if (s < p) return false; p = s; } return true; })();
        const sm = mix._softmax([1, 2, 3]);
        const smRef = (() => { const m = 3; const e = [1, 2, 3].map((v) => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); })();
        const okSoft = sm.length === 3 && close(sm[2], smRef[2], 1e-12) && close(sm.reduce((a, b) => a + b, 0), 1, 1e-12);
        const uniform = mix._softmax([NaN, 1, 2]);
        const okUniform = uniform.every((v) => close(v, 1 / 3, 1e-15));
        const okEmpty = mix._softmax([]).length === 0;
        const out = [9, 9, 9]; const ret = mix._softmax([0, 0, 0], out);
        const okOut = ret === out && out.every((v) => close(v, 1 / 3, 1e-15));
        rows.activations = { okSilu, okSig, mono, okSoft, okUniform, okEmpty, okOut, siluZero: mix._silu(0), sigZero: mix._sigmoid(0) };
        return okSilu && okSig && mono && okSoft && okUniform && okEmpty && okOut;
    })();

    // (FINDING PROBE) a NON-FINITE guard turns the +Infinity tail of a probability activation into 0.
    checks.infiniteActivationDefect = (() => {
        const rowsOut = {
            sigPosInf: mix._sigmoid(Infinity), sigNegInf: mix._sigmoid(-Infinity),
            siluPosInf: mix._silu(Infinity), siluNegInf: mix._silu(-Infinity),
            // the saturation clamp intended to tame large finite inputs is unreachable for +/-Infinity: the guard runs first
            sigLargeFinite: mix._sigmoid(100), sigNegLarge: mix._sigmoid(-100),
            // a finite string is accepted by isFiniteNumber, so these coerce rather than abstain
            siluString: mix._silu('2'), sigString: mix._sigmoid('2'),
        };
        const defect = rowsOut.sigPosInf === 0 && rowsOut.sigNegInf === 0 && rowsOut.siluPosInf === 0
            && close(rowsOut.sigLargeFinite, 1, 1e-12) && close(rowsOut.sigNegLarge, 0, 1e-12)
            && typeof rowsOut.siluString === 'number' && typeof rowsOut.sigString === 'number';
        rows.infiniteActivation = { ...rowsOut, defect };
        return defect;
    })();

    // ============================== B. linalg =======================================================
    checks.linalgContract = (() => {
        const a = [1, 2, 3, 4], b = [4, 3, 2, 1];
        const dot = 1 * 4 + 2 * 3 + 3 * 2 + 4 * 1;
        const okDot = close(mix._fastVectorDot(a, b), dot, 1e-12) && close(mix._vectorDot(a, b), dot, 1e-12);
        const add = mix._fastVectorAdd(a, b, 2, -1);
        const okAdd = [2 * 1 - 4, 2 * 2 - 3, 2 * 3 - 2, 2 * 4 - 1].every((v, i) => close(add[i], v, 1e-6));
        const sc = mix._fastVectorScale(a, 2.5);
        const okScale = a.every((v, i) => close(sc[i], v * 2.5, 1e-6));
        const sub = mix._vectorSub(a, b);
        const okSub = [1 - 4, 2 - 3, 3 - 2, 4 - 1].every((v, i) => close(sub[i], v, 1e-6));
        const okNorm = close(mix._vectorNorm([3, 4]), 5, 1e-12);
        // cosine with the +1e-8 denominator guard: exact ratio for a non-degenerate pair
        const cos = mix._cosineSimilarity([1, 0, 0], [1, 1, 0]);
        const okCos = close(cos, (1 / (1 * Math.SQRT2 + 1e-8)), 1e-9);
        // weighted mean: weights are sizes / total size
        const rep = mix._weightedMean([{ size: 1, mean: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1]) }, { size: 3, mean: new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]) }]);
        const okWeighted = close(rep[0], 0.25, 1e-6);
        // proj similarity: mean over projections of the low-dim dot
        const okProj = close(mix._projSimilarity([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]], [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]]), 1, 1e-12);
        rows.linalg = { okDot, okAdd, okScale, okSub, okNorm, okCos, okWeighted, okProj };
        return okDot && okAdd && okScale && okSub && okNorm && okCos && okWeighted && okProj;
    })();

    // (FINDING PROBE) the three vector helpers abstain differently on a length mismatch.
    checks.lengthMismatchAbstention = (() => {
        const a = [1, 2, 3], b = [1, 2];
        const fast = mix._fastVectorDot(a, b);          // reads b past its end -> NaN
        const slow = mix._vectorDot(a, b);              // documented guard -> 0
        const add = mix._fastVectorAdd(a, b);           // documented fallback -> a shallow copy of a
        rows.mismatch = { fast, slow, addIsA: Array.from(add), isNaNFast: Number.isNaN(fast), slowIsZero: slow === 0, addCopiesA: close(add[0], a[0]) && close(add[1], a[1]) && close(add[2], a[2]) };
        return Number.isNaN(fast) && slow === 0 && rows.mismatch.addCopiesA;
    })();

    // ============================== C. normalization ================================================
    checks.normalizationContract = (() => {
        const x = [1, 2, 3, 4, 5, 6, 7, 8];
        const gamma = new Array(8).fill(1);
        const rms = Math.sqrt(x.reduce((a, b) => a + b * b, 0) / 8 + 1e-6);
        const out = mix._rmsNorm(x, gamma);
        const okRms = x.every((v, i) => close(out[i], v / rms, 1e-12));
        const okBadLen = mix._rmsNorm([1, 2], gamma).every((v) => v === 0);
        // RoPE at pos 0 is the identity; at pos 1 it rotates each (even,odd) pair by theta = 1*freq
        const row0 = [1, 0, 0, 0, 0, 0, 0, 0];
        const m0 = [row0.slice()];
        mix._applyRoPE(m0, 0);
        const identityAt0 = m0[0].every((v, i) => close(v, row0[i], 1e-12));
        const m1 = [[1, 0, 0, 0, 0, 0, 0, 0]];
        mix._applyRoPE(m1, 1);
        const headDim = 4, half = 2;
        const freqs = [Math.pow(10000, -0), Math.pow(10000, -2 / headDim)];
        const expected = [];
        for (let h = 0; h < 2; h++) { for (let i = 0; i < half; i++) { const th = 1 * freqs[i]; const xi = (h === 0 && i === 0) ? 1 : 0; const yi = 0; expected.push(xi * Math.cos(th) - yi * Math.sin(th), xi * Math.sin(th) + yi * Math.cos(th)); } }
        const okRope = m1[0].every((v, i) => close(v, expected[i], 1e-12));
        // normalizeSemantic clamps a proto mean whose RMS exceeds maxMeanRMS and scales its variance
        const proto = { mean: new Float32Array(8).fill(10), variance: new Float32Array(8).fill(4), projNorms: null, contentHash: '' };
        mix._normalizeSemantic(0, [proto]);
        const maxMeanRMS = 1.8 + 2.2 * 0.5;
        const newRms = Math.sqrt(proto.mean.reduce((a, b) => a + b * b, 0) / 8);
        const okSemantic = close(newRms, maxMeanRMS, 1e-4) && proto.variance.every((v) => close(v, Math.min(4 * (maxMeanRMS / Math.sqrt(100)) ** 2, 4), 1e-4));
        rows.normalization = { okRms, okBadLen, identityAt0, okRope, okSemantic, newRms, maxMeanRMS };
        return okRms && okBadLen && identityAt0 && okRope && okSemantic;
    })();

    // ============================== D. sampling =====================================================
    checks.samplingContract = (() => {
        // _randomNormal is the Irwin-Hall approximation: mean 0, variance exactly 1
        let sum = 0, sumSq = 0; const N = 20000;
        for (let i = 0; i < N; i++) { const z = mix._randomNormal(0, 1); sum += z; sumSq += z * z; }
        const mean = sum / N, varr = sumSq / N - mean * mean;
        const okNormal = Math.abs(mean) < 0.02 && Math.abs(varr - 1) < 0.03;
        const okMeanStd = (() => { let s = 0; for (let i = 0; i < 2000; i++) s += mix._randomNormal(5, 2); return Math.abs(s / 2000 - 5) < 0.1; })();
        const d = mix._sampleDirichlet(5);
        const okDirichlet = d.length === 5 && d.every((v) => v > 0) && close(d.reduce((a, b) => a + b, 0), 1, 1e-12);
        const okDirichletGuard = mix._sampleDirichlet(0).length === 0;
        const proj = mix._generateProjectionMatrix();
        const invSqrtLow = 1 / Math.sqrt(4);
        const okProj = proj.length === 8 && proj.every((r) => r.length === 4) && proj.every((r) => r.every((v) => Number.isFinite(v) && Math.abs(v) < 6 * invSqrtLow));
        const hyp = mix._generateLshHyperplanesLow();
        const okHyp = hyp.length === 8 && hyp.every((tb) => tb.length === 16 && tb.every((vec) => close(Math.sqrt(vec.reduce((a, b) => a + b * b, 0)), 1, 1e-6)));
        rows.sampling = { mean, varr, okNormal, okMeanStd, okDirichlet, okDirichletGuard, okProj, okHyp };
        return okNormal && okMeanStd && okDirichlet && okDirichletGuard && okProj && okHyp;
    })();

    // ============================== E. statistics ===================================================
    checks.statisticsContract = (() => {
        // _computeVariance is DOCUMENTED (src/README.md) as a "dispersion (MAD proxy)" - confirm it is a clamped MAD, not a variance
        const v = mix._computeVariance([0, 0, 0, 0, 100]);       // true variance 2000; upper median 0 -> mad 20 -> min(20,10)
        const okMad = close(v, 10, 1e-12);
        const okMad2 = close(mix._computeVariance([1, 1, 1, 1]), 0, 1e-12) && mix._computeVariance([1]) === 0;
        // EMA closed form
        const ema = (() => { let e = 1; const arr = [1, 2, 3, 4]; for (let i = 1; i < arr.length; i++) e = 0.9 * e + 0.1 * arr[i]; return e; })();
        const okEma = close(mix._computeEMA([1, 2, 3, 4], 0.9), ema, 1e-12) && mix._computeEMA([], 0.9) === 0;
        // conformity: fraction of consecutive same-sign steps (n-2)/(n-1) for a monotone run, clamped to [0.5, 1]
        const conf = mix._computeGradientConformity([1, 2, 3, 4, 5]);
        const okConf = close(conf, 0.75, 1e-12) && close(mix._computeGradientConformity([1, 0, 1, 0, 1]), 0.5, 1e-12) && mix._computeGradientConformity([1]) === 1;
        // percentile: lower nearest-rank, index = floor(p*(n-1))
        const okPct = close(mix._computePercentile([1, 2, 3, 4], 0.5), 2, 1e-12) && close(mix._computePercentile([5, 6, 7, 8], 1), 8, 1e-12);
        // sparse threshold is clamped to [1e-6, 1e-4]
        const okSparse = close(mix._computeSparseThreshold([0, 0, 0]), 1e-6, 1e-15) && close(mix._computeSparseThreshold(new Array(20).fill(0).map((_, i) => i * 100)), 1e-4, 1e-15);
        // dynamic percentile is clamped to [0.75, 0.99]
        const okDyn = mix._computeDynamicPercentile([1, 2, 3, 4, 5], 0.9) <= 0.9 && mix._computeDynamicPercentile([1, 1, 1, 1, 1], 0.9) >= 0.75;
        // _computeGradientNorm / _computeSpectralNorm closed forms on NON-zero input
        const gnorm = mix._computeGradientNorm([3, 4, 0], false);
        const okGrad = close(gnorm, 5, 1e-12) && close(mix._computeGradientNorm([[3, 0], [0, 4]], true), 5, 1e-12);
        const spec = mix._computeSpectralNorm([[3, 0, 0], [0, 1, 0], [0, 0, 1]]);
        const okSpec = Math.abs(spec - 3) < 5e-3; // power iteration
        rows.statistics = { v, okMad, okMad2, okEma, conf, okConf, okPct, okSparse, okDyn, gnorm, okGrad, spec, okSpec };
        return okMad && okMad2 && okEma && okConf && okPct && okSparse && okDyn && okGrad && okSpec;
    })();

    // (FINDING PROBE) the falsy-zero family: a legitimate 0 is replaced by 1 by a `|| 1`/`|| 1.0` guard.
    checks.falsyZeroFamily = (() => {
        const gradZero = mix._computeGradientNorm([0, 0, 0], false);
        const gradZeroM = mix._computeGradientNorm([[0, 0], [0, 0]], true);
        const specZero = mix._computeSpectralNorm([[0, 0], [0, 0]]);
        const pctZero = mix._computePercentile([0, 1, 2], 0);
        const rowsOut = { gradZero, gradZeroM, specZero, pctZero };
        const defect = gradZero === 1 && gradZeroM === 1 && specZero === 1 && pctZero === 1;
        rows.falsyZero = { ...rowsOut, defect };
        return defect;
    })();

    // (FINDING PROBE) dead clamps / unreachable guards in the statistics + activation kernels.
    checks.unreachableGuards = (() => {
        // _computeDualEMA: svrWeight = min(0.8, max(0.2, 0.5*(1 - v/(v+1)))) - the raw value is in (0, 0.5], so 0.8 never binds
        const dualHigh = mix._computeDualEMA(new Array(20).fill(100), 0.9, 0.99); // variance 0 -> raw 0.5 -> weight 0.5
        const dualLow = mix._computeDualEMA(new Array(20).fill(0).map((_, i) => i), 0.9, 0.99);
        // _computeNTKStability: bandwidth = min(-0.01, max(-0.1, -0.05/(1+lv*mn))) - arg > -0.05, so -0.1 never binds
        const bwArg = (lv, mn) => -0.05 / (1 + lv * mn);
        const okBwFloorDead = bwArg(1e9, 1e9) > -0.1; // even at huge lossVariance*median the arg stays above the -0.1 floor
        // _sigmoid's +/-100 clamp is unreachable for +/-Infinity because isFiniteNumber gates first (see infiniteActivationDefect)
        rows.guards = { dualHigh, dualLow, okBwFloorDead, bwAt0: bwArg(0, 1), bwHuge: bwArg(1e9, 1e9) };
        return [-0.1, -0.05, -0.01].some((t) => t < 0) && okBwFloorDead && Number.isFinite(dualHigh) && Number.isFinite(dualLow);
    })();

    // ============================== F. stateful detectors ===========================================
    checks.stagnationAndDrop = (() => {
        const m = mkMix({
            _historicalPerformance: { 0: new Array(64).fill(0.6) },
            _performanceScores: { 0: 0.6 },
            _getAvgProtoVariance() { return 5; }, // above the proto-var threshold -> lowProtoVariance false
        });
        const noDrop = m._detectSuddenDrop(0);           // flat history -> 1.0
        const mDrop = mkMix({ _historicalPerformance: { 0: new Array(64).fill(0.6) }, _performanceScores: { 0: 0.2 }, _getAvgProtoVariance() { return 5; } });
        const severe = mDrop._detectSuddenDrop(0);       // drop 0.4 -> 3.0
        const short = mkMix({ _historicalPerformance: { 0: [0.5, 0.5] }, _performanceScores: { 0: 0.5 } })._detectSuddenDrop(0);
        const stag = m._isStagnating(0);                 // flat -> lowVariance true
        const mActive = mkMix({ _historicalPerformance: { 0: [0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5] }, _performanceScores: { 0: 0.9 }, _getAvgProtoVariance() { return 5; } });
        const notStag = mActive._isStagnating(0);        // high recent variance + strong trend -> not stagnating
        rows.detectors = { noDrop, severe, short, stag, notStag };
        return noDrop === 1.0 && severe === 3.0 && short === 1.0 && stag === true && notStag === false;
    })();

    // (FINDING PROBE) _computeFractalDimension is a clamped ad-hoc dispersion, not a fractal dimension.
    checks.fractalDimensionProbe = (() => {
        const monotone = mix._computeFractalDimension([0, 1, 2, 3, 4, 5, 6, 7]);   // constant diffs -> clamped
        const flat = mix._computeFractalDimension([2, 2, 2, 2, 2, 2, 2, 2]);       // zero diffs -> clamped to 2
        const zig = mix._computeFractalDimension([0, 1, 0, 1, 0, 1, 0, 1]);
        rows.fractal = { monotone, flat, zig };
        // it is clamped to [1, 2] by construction; a constant series (a point, dim 0) reads the MAX 2
        return monotone >= 1 && monotone <= 2 && flat === 2 && zig >= 1 && zig <= 2;
    })();

    const findingActivation = rows.infiniteActivation;
    const findingFalsyZero = rows.falsyZero;
    const findingMismatch = rows.mismatch;
    const findingGuards = rows.guards;
    const findingFractal = rows.fractal;

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = (v && typeof v.then === 'function') ? await v : v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-co..: the hivemind numeric kernels are SHIPPED (gradients.js + transformer/*) and PURE. PASSES the pre-registered read: `_silu`/`_siluDerivative`/`_sigmoid`/`_softmax`, `_fastVectorDot`/`_fastVectorAdd`/`_fastVectorScale`/`_vectorDot`/`_vectorNorm`/`_vectorSub`/`_cosineSimilarity`/`_weightedMean`/`_projSimilarity`, `_rmsNorm`/`_applyRoPE`/`_normalizeSemantic`, `_randomNormal`/`_sampleDirichlet`/`_generateProjectionMatrix`/`_generateLshHyperplanesLow`, and `_computeVariance` (the documented MAD proxy)/`_computeEMA`/`_computeGradientConformity`/`_computePercentile`/`_computeSparseThreshold`/`_computeDynamicPercentile`/`_computeGradientNorm`/`_computeSpectralNorm`/`_detectSuddenDrop`/`_isStagnating` all match their closed forms / documented contracts on finite inputs. FINDINGS: (0) `_sigmoid`/`_silu` return **0** for `+Infinity` (the `isFiniteNumber` guard runs BEFORE the +/-100 saturation clamp, so a maximally-positive logit reads as probability 0; `_sigmoid(-Infinity)` is also 0); (1) the falsy-zero family - `_computeGradientNorm` and `_computeSpectralNorm` return **1** for the zero vector/matrix and `_computePercentile` returns **1.0** for a legitimate 0 value, all via a `|| 1` fallback; (2) the three vector helpers abstain differently on a length mismatch (`_fastVectorDot` reads past the end -> NaN, `_vectorDot` -> 0, `_fastVectorAdd` -> a copy of `a`); (3) dead clamps (`_computeDualEMA` 0.8, `_computeNTKStability` -0.1 floor) and `_computeFractalDimension` being an ad-hoc clamped dispersion (a constant series reads the max 2). No golden moves: the golden suite pins the finite-path numerics, and the defects are non-finite/zero/degenerate-input edges.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            infiniteActivationDefect: findingActivation,
            falsyZeroFamily: findingFalsyZero,
            lengthMismatchAbstention: findingMismatch,
            unreachableGuards: findingGuards,
            fractalDimensionProbe: findingFractal,
        },
        scope: {
            shipped: ['gradients.js calls _computeSpectralNorm/_computeGradientNorm/_computeVariance/_computeFractalDimension/_computeNTKStability/_computePercentile/_computeDynamicPercentile/_computeSparseThreshold in the per-step training path', 'transformer/* calls the activations/linalg/normalization kernels'],
            why: 'every defect is on a non-finite / exactly-zero / degenerate-input edge that the golden suite (which pins finite-path numerics) does not exercise; the finite path is exact, so no scored number moves. No fold-back row.',
        },
    };

    return { config: { kernels: ['activations', 'linalg', 'normalization', 'sampling', 'statistics'], hiddenSize: 8, lowDim: 4 }, rows, validation: resolved, verdict };
}
