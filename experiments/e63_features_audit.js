// E63 - THE CAUSAL SIGNAL FAMILY, AUDITED: `analysis/features.js`. CYCLE-055 (L10-bs ...).
//
// `analysis/features.js` is the shipped signal family the walk-forward A/B scores: 8 features reduced to
// positions by one causal z-score -> clamp pipeline (`SIGNAL_CANDIDATES`), plus two OPT-IN families sharing
// the same pipeline (`REVERSAL_CANDIDATES`, round 29/30 P3; `SIGUP_CANDIDATES`, round-30 pre-registered
// momentum upgrades, gate G-H). `analyze.js` builds every `sig:*` variant from these arrays, so this module is
// where the A/B's "which feature family carries an edge" question is decided. Its header makes the strongest
// claim in the tree: every feature is a PURE POINT-IN-TIME function, and `auditNoLookahead` over the audited
// candle view *proves* it — perturbing every bar after t must leave the position at t unchanged.
//
// PRE-REGISTERED READ. PASSES if (i) the causality claim holds for EVERY candidate in all three families:
// perturbing closes/returns/volumes/panel after t leaves the position at t EXACTLY unchanged, and the
// perturbation is non-vacuous (a later position really does move, so the family reads the perturbed data);
// (ii) a view missing `closes`/`volumes`/`panel` makes the affected features ABSTAIN (position 0), never
// throw; (iii) the pipeline is exact (clamp bounds and non-finite handling; the z-score over the trailing
// `zWindow` FINITE values with the sample std and the `minObs` floor; zWindow/minObs honoured); (iv) every
// one of the 16 features reproduces an INDEPENDENT reference on the same series (incl. `fracDiffAt` against
// an independent binomial-weight recursion AND the shipped `labels.js` convolution); (v) the cross-sectional
// contracts hold (`crossSectionalReversal` = minus the deviation from the finite cross-section mean;
// `networkMomentum` skips `panel.streamIndex` and abstains without a panel); and (vi) the `closes` contract
// of L10-e holds (a `{close}`-only series abstains; a `{closes}` series works).
//
// The DEFECTS are reported in `findings`: the two internal-window helpers disagree on an empty range
// (`finiteSum` returns 0 where `meanOf` returns NaN, so a zero-width feature window reads a valid "no
// momentum" instead of abstaining); `networkMomentum` does NOT skip its own stream when
// `panel.streamIndex` is absent (the docstring says it does); and `regimeGatedMomentum`'s crash gate
// standardises the gate window's SUM by the MOMENTUM window's variance, so when the two windows differ the
// gate is mis-scaled by sqrt(v_window / v_gateWindow).

import { fractionalDiffWeights, fractionalDiff } from '../../NeuLegion-master/NeuLegion-master/src/analysis/labels.js';
import {
    DEFAULT_POSITION, clampPosition, momentum, fracDiffAt, fracMomentum, volRegime,
    momentumAgreement, rangeLocation, volumeImbalance, autocorr1, acceleration,
    causalZScore, positionAt, signalForCandidate, SIGNAL_CANDIDATES,
    reversal, reversalWindow, reversalVol, crossSectionalReversal, REVERSAL_CANDIDATES,
    volScaledMomentum, blendedMomentum, networkMomentum, regimeGatedMomentum, SIGUP_CANDIDATES,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const close = (a, b, tol = 1e-12) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= tol;

// Independent binomial weights: w0 = 1, wk = w(k-1)*(k-1-d)/k.
function refWeights(d, size) {
    const w = [1];
    for (let k = 1; k < size; k++) w.push(w[k - 1] * (k - 1 - d) / k);
    return w;
}
const sum = (s, a, b) => { let x = 0; for (let i = a; i <= b; i++) x += s[i]; return x; };
const avg = (s, a, b) => { let x = 0; for (let i = a; i <= b; i++) x += s[i]; return x / (b - a + 1); };
function varS(s, a, b) {
    const m = avg(s, a, b);
    let acc = 0;
    for (let i = a; i <= b; i++) acc += (s[i] - m) * (s[i] - m);
    return acc / (b - a);
}

const ALL = [...SIGNAL_CANDIDATES, ...REVERSAL_CANDIDATES, ...SIGUP_CANDIDATES];

// A deterministic series with all three channels populated and a cross-section.
function mkSeries(n = 140, seed = 5) {
    const rnd = mulberry32(seed);
    const returns = new Array(n).fill(0);
    const closes = new Array(n).fill(100);
    const volumes = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        returns[i] = 0.01 * Math.sin(i * 0.7) + 0.006 * Math.cos(i * 1.3) + 0.004 * (rnd() - 0.5);
        if (i > 0) closes[i] = closes[i - 1] * (1 + returns[i]);
        volumes[i] = 1000 + 500 * Math.sin(i * 0.31) + 300 * (i % 5) + 100 * (rnd() - 0.5);
    }
    const rA = returns.map((v, i) => v * 0.7 + 0.001 * Math.sin(i * 1.1));
    const rC = returns.map((v, i) => -v * 0.4 + 0.002 * Math.cos(i * 0.5));
    // world.js replaces THIS stream's array with the view's own returns; streamIndex = 1 here.
    const panel = { streamIndex: 1, label: 'S', labels: null, returnsByStream: [rA, returns, rC] };
    return { closes, returns, volumes, panel };
}
const seriesOf = (v) => ({ closes: v.closes || null, returns: v.returns || null, volumes: v.volumes || null, panel: v.panel || null });

// Perturb everything strictly AFTER `after`, on every channel (and every panel stream).
function perturbed(s, after) {
    const scale = (i) => 1.5 + (i % 3);
    const shock = (v, i) => (i > after ? -1.7 * v + 0.03 : v);
    return {
        closes: s.closes.map((c, i) => (i > after ? c * scale(i) : c)),
        returns: s.returns.map(shock),
        volumes: s.volumes.map((v, i) => (i > after ? v * 2.5 : v)),
        panel: { ...s.panel, returnsByStream: s.panel.returnsByStream.map((rs) => rs.map(shock)) },
    };
}
const viewOf = (s) => ({ closes: s.closes, returns: s.returns, volumes: s.volumes, panel: s.panel });

export async function run() {
    const checks = {};
    const rows = {};
    const base = mkSeries();
    const N = base.returns.length;

    // ============================== A. the causality claim (the module's headline) ====================
    checks.candidateRoster = (() => {
        const ids = ALL.map((c) => c.id);
        const unique = new Set(ids).size === ids.length;
        const fns = [momentum, fracMomentum, volRegime, momentumAgreement, rangeLocation, volumeImbalance, autocorr1, acceleration, reversal, reversalWindow, reversalVol, crossSectionalReversal, volScaledMomentum, blendedMomentum, networkMomentum, regimeGatedMomentum];
        rows.roster = { counts: { signal: SIGNAL_CANDIDATES.length, reversal: REVERSAL_CANDIDATES.length, sigup: SIGUP_CANDIDATES.length }, ids, crossSectional: ALL.filter((c) => c.crossSectional).map((c) => c.id) };
        return SIGNAL_CANDIDATES.length === 8 && REVERSAL_CANDIDATES.length === 4 && SIGUP_CANDIDATES.length === 4
            && unique && ALL.every((c) => c.kind === 'signal' && typeof c.fn === 'function' && Number.isFinite(c.window) && c.window >= 1 && fns.includes(c.fn))
            && rows.roster.crossSectional.join(',') === 'sig-reversal-xs,sig-network-momentum';
    })();

    checks.causalityUnderFuturePerturbation = (() => {
        const test = Array.from({ length: N - 40 }, (_, i) => 40 + i);
        const res = {};
        let totalMismatch = 0;
        let vacuous = [];
        for (const c of ALL) {
            const sig = (v, ts) => ts.map((t) => positionAt(c, seriesOf(v), t));
            const basePos = sig(viewOf(base), test);
            let mismatches = 0;
            for (const t of test) {
                const p = sig(viewOf(perturbed(base, t)), [t])[0];
                if (p !== basePos[t - 40]) mismatches++;
            }
            totalMismatch += mismatches;
            // non-vacuity: the perturbation must move a LATER position of the SAME candidate
            const after = 60;
            const pertPos = sig(viewOf(perturbed(base, after)), Array.from({ length: N - after - 1 }, (_, i) => after + 1 + i));
            const later = pertPos.filter((p, i) => p !== basePos[after + 1 + i - 40]).length;
            const nonZero = basePos.filter((p) => p !== 0).length;
            res[c.id] = { mismatches, laterMoved: later, nonZero, bars: test.length };
            if (later === 0) vacuous.push(c.id);
        }
        rows.causality = res;
        rows.causalityNonVacuous = vacuous;
        return totalMismatch === 0 && vacuous.length === 0 && Object.values(res).every((r) => r.nonZero > 0);
    })();

    // ============================== B. abstain contracts ==============================================
    checks.abstainInsteadOfThrow = (() => {
        const returnsOnly = { returns: base.returns, closes: null, volumes: null, panel: null };
        const test = Array.from({ length: 20 }, (_, i) => 100 + i);
        const out = {};
        for (const c of ALL) {
            let pos = null;
            try { pos = test.map((t) => positionAt(c, seriesOf(returnsOnly), t)); } catch (e) { return false; }
            out[c.id] = { allZero: pos.every((p) => p === 0), nonzero: pos.filter((p) => p !== 0).length, sample: pos.slice(0, 4) };
        }
        // the candidates that provably need another channel: closes (frac-momentum, range),
        // volumes (volume), panel (the two cross-sectional ones)
        const needOther = ['sig-frac-momentum', 'sig-range', 'sig-volume', 'sig-reversal-xs', 'sig-network-momentum'];
        rows.abstainReturnsOnly = out;
        rows.abstainNeedOtherChannel = needOther;
        const shorts = [[], base.returns.slice(0, 3), null];
        const shortZero = shorts.every((r) => ALL.every((c) => {
            try { return [0, 1, 2].every((t) => positionAt(c, seriesOf({ returns: r, closes: r ? base.closes.slice(0, r.length) : null, volumes: null, panel: null }), t) === 0); } catch { return false; }
        }));
        return shortZero && needOther.every((id) => out[id].allZero) && out['sig-momentum'].nonzero > 0;
    })();
    checks.neverThrowsOnDegenerateSeries = (() => {
        const bad = [
            { closes: [NaN, NaN], returns: [NaN, NaN], volumes: [NaN, NaN], panel: null },
            { closes: [0, 0, 0], returns: [0, 0, 0], volumes: [0, 0, 0], panel: null },
            { closes: [1, -1, 1], returns: [Infinity, -Infinity, NaN], volumes: [1, 1, 1], panel: null },
        ];
        try {
            const ok = bad.every((s) => ALL.every((c) => [0, 1, 2].every((t) => {
                const p = positionAt(c, seriesOf(s), t);
                return Number.isFinite(p) && p >= -1 && p <= 1;
            })));
            return ok;
        } catch { return false; }
    })();

    // ============================== C. the pipeline ==================================================
    checks.clampPositionExact = (() => {
        rows.clamp = {
            z0: clampPosition(0), z2: clampPosition(2), zNeg2: clampPosition(-2), z3: clampPosition(3), zNeg3: clampPosition(-3),
            nan: clampPosition(NaN), inf: clampPosition(Infinity),
            sat0: clampPosition(1, { saturation: 0 }), sat1: clampPosition(1.5, { saturation: 1 }), satNeg: clampPosition(1, { saturation: -2 }),
            docs: DEFAULT_POSITION,
        };
        return clampPosition(0) === 0 && clampPosition(2) === 1 && clampPosition(-2) === -1 && clampPosition(3) === 1 && clampPosition(-3) === -1
            && clampPosition(NaN) === 0 && clampPosition(Infinity) === 0 && clampPosition(-Infinity) === 0
            && clampPosition(1, { saturation: 0 }) === 0 && clampPosition(1.5, { saturation: 1 }) === 1 && clampPosition(1, { saturation: -2 }) === 0
            && DEFAULT_POSITION.saturation === 2 && DEFAULT_POSITION.zWindow === 32 && DEFAULT_POSITION.minObs === 8;
    })();
    checks.zScorePipelineExact = (() => {
        // a synthetic candidate whose feature I control, so the pipeline can be recomputed by hand
        const cand = { id: 'x', fn: (s, t, a) => (t % 4 === 0 ? NaN : s.returns[t]), window: 1, zWindow: 8, minObs: 4, saturation: 2 };
        const t = 110;
        const raw = cand.fn(seriesOf(viewOf(base)), t, { window: 1 });
        const vals = [];
        for (let i = t - 8 + 1; i <= t; i++) { const v = cand.fn(seriesOf(viewOf(base)), i, { window: 1 }); if (Number.isFinite(v)) vals.push(v); }
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) * (b - m), 0) / (vals.length - 1));
        const ref = clampPosition((raw - m) / sd, { saturation: 2 });
        const z = causalZScore(cand.fn, seriesOf(viewOf(base)), t, { window: 1, zWindow: 8, minObs: 4 });
        rows.zScoreHandCheck = { raw, nVals: vals.length, mean: m, sd, z, ref, pos: positionAt(cand, seriesOf(viewOf(base)), t) };
        // a not-yet-populated window abstains; a minObs floor larger than the finite count abstains;
        // a non-finite raw abstains
        const s = seriesOf(viewOf(base));
        const early = [0, 1, 5].every((i) => positionAt({ id: 'm', fn: momentum, window: 16 }, s, i) === 0);
        const minObsHigh = causalZScore(cand.fn, s, t, { window: 1, zWindow: 8, minObs: 9 }) === 0;
        const nanRaw = causalZScore((ss, tt) => NaN, s, t, { window: 1 }) === 0;
        rows.zScoreGuards = { earlyAllZero: early, minObsHighZero: minObsHigh, nanRawZero: nanRaw };
        return close(rows.zScoreHandCheck.pos, ref, 1e-12) && close(z, (raw - m) / sd, 1e-12)
            && early && minObsHigh && nanRaw;
    })();
    // The zero-dispersion guard is defeated by rounding: an EXACTLY-constant feature window does not
    // produce std = 0, it produces a denormal std from the mean's rounding error, and the z it returns has
    // a closed form. This pins the actual arithmetic (the finding below explains why it is wrong).
    checks.constantWindowClosedForm = (() => {
        const cases = [];
        let ok = true;
        let sawNonZero = false;
        for (const [val, n] of [[0.001, 8], [0.001, 16], [0.001, 32], [0.1, 16], [0.1, 32], [0.07, 20]]) {
            const flat = { closes: new Array(80).fill(5), returns: new Array(80).fill(val), volumes: new Array(80).fill(7), panel: null };
            const t = 70;
            const z = causalZScore(momentum, flat, t, { window: n, zWindow: n, minObs: 8 });
            const expectedAbs = Math.sqrt((n - 1) / n); // the feature window = zWindow = n -> exactly n finite readings
            const okHere = (z === 0) || close(Math.abs(z), expectedAbs, 1e-9);
            if (z !== 0) sawNonZero = true;
            cases.push({ val, n, z, expectedAbs, okHere });
            if (!okHere) ok = false;
        }
        rows.constantWindowZ = cases;
        // and a value whose mean IS exactly representable abstains (0.5 x 16 -> mean exactly 0.5)
        const exact = { closes: new Array(80).fill(5), returns: new Array(80).fill(0.5 / 16), volumes: new Array(80).fill(7), panel: null };
        const exactZ = causalZScore(momentum, exact, 70, { window: 16, zWindow: 16, minObs: 8 });
        rows.constantWindowExactMean = { returns: 0.5 / 16, z: exactZ };
        return ok && sawNonZero && exactZ === 0;
    })();

    // ============================== D. feature references ============================================
    checks.featureReferencesExact = (() => {
        const s = base; const t = 110;
        const got = {};
        const ref = {};
        got.momentum = momentum(s, t, { window: 16 });
        ref.momentum = sum(s.returns, t - 15, t);
        const w = refWeights(0.4, 16);
        got.fracDiffAt = fracDiffAt(s.closes, t, { d: 0.4, window: 16 });
        ref.fracDiffAt = w.reduce((a, wk, k) => a + wk * Math.log(s.closes[t - k]), 0);
        got.fracMomentum = fracMomentum(s, t, { window: 16, d: 0.4 });
        ref.fracMomentum = ref.fracDiffAt - w.reduce((a, wk, k) => a + wk * Math.log(s.closes[t - 1 - k]), 0);
        got.volRegime = volRegime(s, t, { window: 8, long: 32 });
        ref.volRegime = Math.sqrt(varS(s.returns, t - 7, t) / varS(s.returns, t - 31, t)) - 1;
        got.agreement = momentumAgreement(s, t, {});
        ref.agreement = [4, 8, 16, 32].map((L) => Math.sign(sum(s.returns, t - L + 1, t))).reduce((a, b) => a + b, 0) / 4;
        got.range = rangeLocation(s, t, { window: 32 });
        ref.range = (() => { let lo = Infinity, hi = -Infinity; for (let i = t - 31; i <= t; i++) { if (s.closes[i] < lo) lo = s.closes[i]; if (s.closes[i] > hi) hi = s.closes[i]; } return (s.closes[t] - lo) / (hi - lo) - 0.5; })();
        got.volume = volumeImbalance(s, t, { window: 8, long: 32 });
        ref.volume = avg(s.volumes, t - 7, t) / avg(s.volumes, t - 31, t) - 1;
        got.autocorr = autocorr1(s, t, { window: 32 });
        ref.autocorr = (() => { const m = avg(s.returns, t - 31, t); let num = 0, den = 0; for (let i = t - 31; i <= t; i++) { num += (s.returns[i] - m) * (s.returns[i - 1] - m); den += (s.returns[i] - m) ** 2; } return num / den; })();
        got.accel = acceleration(s, t, { window: 16 });
        ref.accel = sum(s.returns, t - 15, t) - sum(s.returns, t - 31, t - 16);
        got.reversal = reversal(s, t);
        ref.reversal = -s.returns[t];
        got.reversalWindow = reversalWindow(s, t, { window: 4 });
        ref.reversalWindow = -avg(s.returns, t - 3, t);
        got.reversalVol = reversalVol(s, t, { window: 16 });
        ref.reversalVol = -s.returns[t] / Math.sqrt(varS(s.returns, t - 16, t - 1));
        got.volScaled = volScaledMomentum(s, t, { window: 16 });
        ref.volScaled = sum(s.returns, t - 15, t) / Math.sqrt(varS(s.returns, t - 15, t));
        got.blended = blendedMomentum(s, t, { lenses: [8, 16, 32] });
        ref.blended = [8, 16, 32].reduce((a, L) => a + sum(s.returns, t - L + 1, t) / Math.sqrt(varS(s.returns, t - L + 1, t)), 0) / 3;
        rows.featureReferences = Object.fromEntries(Object.keys(got).map((k) => [k, { got: got[k], ref: ref[k] }]));
        const mismatches = Object.keys(got).filter((k) => !close(got[k], ref[k], 1e-12));
        rows.featureReferenceMismatches = mismatches;
        // cross-module: fracDiffAt must equal the SHIPPED labels.js convolution on the same closes
        const conv = fractionalDiff(s.closes.map(Math.log), 0.4, 16);
        const wShipped = fractionalDiffWeights(0.4, 16);
        return mismatches.length === 0
            && close(got.fracDiffAt, conv[t], 1e-12)
            && wShipped.length === w.length && wShipped.every((v, k) => close(v, w[k], 1e-15));
    })();

    // ============================== E. cross-section + the gate ======================================
    checks.crossSectionReferences = (() => {
        const s = base; const t = 110;
        const finites = s.panel.returnsByStream.map((rs) => rs[t]).filter(Number.isFinite);
        const xsRef = -(s.returns[t] - finites.reduce((a, b) => a + b, 0) / finites.length);
        const gotXs = crossSectionalReversal(s, t);
        const end = t - 1;
        const others = s.panel.returnsByStream.map((rs, i) => (i === s.panel.streamIndex ? null : rs)).filter(Boolean);
        const netRef = others.reduce((a, rs) => a + sum(rs, end - 15, end) / Math.sqrt(varS(rs, end - 15, end)), 0) / others.length;
        const gotNet = networkMomentum(s, t, { window: 16, lag: 1 });
        rows.crossSection = { gotXs, xsRef, gotNet, netRef, others: others.length };
        const noPanel = { ...seriesOf(viewOf(s)), panel: null };
        return close(gotXs, xsRef, 1e-12) && close(gotNet, netRef, 1e-12)
            && Number.isNaN(crossSectionalReversal(noPanel, t)) && Number.isNaN(networkMomentum(noPanel, t, {}));
    })();
    checks.regimeGateReference = (() => {
        const s = base;
        const cases = [];
        let mismatch = 0;
        for (const t of [80, 110, 130]) {
            const m = sum(s.returns, t - 15, t);
            const v = varS(s.returns, t - 15, t);
            const gate = sum(s.returns, t - 31, t);
            const gated = gate <= -2 * Math.sqrt(v) * Math.sqrt(32);
            const ref = gated ? NaN : m;
            const got = regimeGatedMomentum(s, t, { window: 16, gateWindow: 32, gateZ: 2 });
            cases.push({ t, gate, threshold: -2 * Math.sqrt(v) * Math.sqrt(32), gated, got, ref, agree: (Number.isNaN(got) && Number.isNaN(ref)) || close(got, ref, 1e-12) });
            if (!cases[cases.length - 1].agree) mismatch++;
        }
        rows.regimeGate = cases;
        return mismatch === 0;
    })();

    // ============================== F. the L10-e `closes` contract ===================================
    checks.closesContract = (() => {
        const s = base;
        const singular = { close: s.closes, returns: s.returns, volumes: s.volumes, panel: null };
        const plural = { closes: s.closes, returns: s.returns, volumes: s.volumes, panel: null };
        const t = 110;
        rows.closesContract = {
            rangeOnPlural: rangeLocation(seriesOf(plural), t, { window: 32 }),
            rangeOnSingular: rangeLocation(seriesOf(singular), t, { window: 32 }),
            posOnSingular: positionAt({ id: 'sig-range', fn: rangeLocation, window: 32 }, seriesOf(singular), t),
            fracOnSingular: fracMomentum(seriesOf(singular), t, { window: 16, d: 0.4 }),
        };
        return Number.isFinite(rangeLocation(seriesOf(plural), t, { window: 32 }))
            && Number.isNaN(rangeLocation(seriesOf(singular), t, { window: 32 }))
            && positionAt({ id: 'sig-range', fn: rangeLocation, window: 32 }, seriesOf(singular), t) === 0
            && Number.isNaN(fracMomentum(seriesOf(singular), t, { window: 16, d: 0.4 }));
    })();

    // (1b) the zero-dispersion guard is defeated by floating-point rounding: an exactly-constant feature
    // window returns z = ±sqrt((n-1)/n), not 0.
    const findingConstantWindowZ = {
        claim: 'causalZScore abstains when the window has no dispersion — the module header says the position is "0 while the window is not full, or std is 0", and the docstring says it "Returns 0 (abstain) when ... the std is 0"',
        closedForm: 'for n exactly-equal finite readings v, the sample mean m = (sum v)/n is not bit-equal to v, so every deviation is the SAME d = m - v != 0; acc = n*d^2, std = |d|*sqrt(n/(n-1)) (a denormal positive number), and the returned z = (v - m)/std = -sign(d)*sqrt((n-1)/n).',
        witness: rows.constantWindowZ,
        exactlyRepresentableMeanAbstains: rows.constantWindowExactMean,
        note: 'An exactly-constant feature over the trailing window yields |z| = sqrt((n-1)/n) whenever the sample mean is not bit-equal to the value — measured exactly at -sqrt(15/16) = -0.9682458365518544 (n=16), -sqrt(31/32) = -0.9842509842514764 (n=32) and -sqrt(19/20) = -0.9746794344808966 (n=20). Where the sum and quotient happen to be exact (n=8 and n=32 on a 0.001 constant; the 0.03125 fixture) the guard DOES fire and returns 0, so the bug is a rounding-boundary effect, not a universally-firing branch. At the default saturation 2 the spurious |z| = 0.935 … 0.984 is a position of 0.468 … 0.492 — nearly a half-size book, from a feature carrying no information (the intended value is exactly 0, so this is the largest possible error on this branch). The guard `if (!(std > 0)) return 0` cannot fire there because the computed std is a denormal positive number. Real-valued features (frac-momentum, range location, vol-regime, volume imbalance, autocorrelation, and the recomputed momentum of a bit-constant return series) can all trip it; discrete-valued `momentumAgreement` cannot (its mean is exact). LATENT for live market data (a bit-constant window is measure-zero there), but reachable on the flat/constant series this project uses as CONTROLS, and in production through a coarse/rounded price feed — the L10-l class (prices stored as round(price*100) gave 67 distinct values over 3621 bars, i.e. long runs of exactly-equal returns). A relative tolerance (std <= |mean|*1e-12) or a max-min == 0 test would fix it.',
    };

    // ============================== G. findings =====================================================
    // (1) the two internal window helpers disagree on an EMPTY range
    const emptyRange = (() => {
        const s = base;
        const w0 = momentum(s, 100, { window: 0 });
        const a0 = acceleration(s, 100, { window: 0 });
        const v0 = volRegime(s, 100, { window: 0, long: 0 });
        const rev0 = reversalWindow(s, 100, { window: 0 });
        return {
            momentumWindow0: w0, accelerationWindow0: a0, volRegimeWindow0: v0, reversalWindowWindow0: rev0,
            meanOfWindow0: volumeImbalance(s, 100, { window: 0, long: 32 }),
            note: 'finiteSum guards `a < 0` but NOT `b < a`, so an empty range sums to 0; meanOf guards `b < a` and returns NaN. A 0-width window therefore reads a valid-looking 0 from every finiteSum-based feature (momentum, acceleration, and the volatility-scaled/blended/network/gated upgrades via their sums) while every meanOf-based feature abstains.',
        };
    })();
    const findingEmptyRange = {
        claim: 'the feature helpers never manufacture a value: a feature that cannot be computed abstains (NaN)',
        witness: emptyRange,
        note: 'LATENT: every shipped candidate fixes window >= 1, so the empty range is reachable only through the exported API (a custom candidate or a direct call). It matters because 0 is a FINITE, plausible reading ("no momentum"), so it flows through causalZScore as a real observation rather than abstaining — the opposite of the module header\'s "a feature ... abstains" discipline, and an inconsistency between two helpers in the same file.',
    };

    // (2) networkMomentum does not skip its own stream without panel.streamIndex
    const netSelf = (() => {
        const s = base; const t = 110;
        const withIdx = networkMomentum(s, t, { window: 16, lag: 1 });
        const noIdx = networkMomentum({ ...s, panel: { ...s.panel, streamIndex: undefined } }, t, { window: 16, lag: 1 });
        const own = sum(s.returns, t - 1 - 15, t - 1) / Math.sqrt(varS(s.returns, t - 1 - 15, t - 1));
        const othersArr = s.panel.returnsByStream.filter((_, i) => i !== 1);
        const otherOnly = othersArr.reduce((a, rs) => a + sum(rs, t - 1 - 15, t - 1) / Math.sqrt(varS(rs, t - 1 - 15, t - 1)), 0) / othersArr.length;
        const allThree = s.panel.returnsByStream.reduce((a, rs) => a + sum(rs, t - 1 - 15, t - 1) / Math.sqrt(varS(rs, t - 1 - 15, t - 1)), 0) / 3;
        return { withStreamIndex: withIdx, othersOnly: otherOnly, missingStreamIndex: noIdx, allThreeIncludingSelf: allThree, ownLaggedMomentum: own, equalsAllThree: close(noIdx, allThree, 1e-12), equalsOthers: close(withIdx, otherOnly, 1e-12) };
    })();
    const findingNetSelf = {
        claim: 'networkMomentum "skips this stream by `panel.streamIndex`"',
        witness: netSelf,
        note: 'the skip is `if (i === p.streamIndex) continue` — with `streamIndex` absent (undefined) the comparison is never true, so the feature silently folds the stream\'s OWN lagged momentum into its "network" average and reports a non-abstaining position. LATENT: `analyze.js` always sets `streamIndex`, so the shipped path is correct; the exported API is not, and the failure mode is silent (a plausible number, not a NaN).',
    };

    // (3) the regime gate standardises the gate window's sum by the MOMENTUM window's variance
    const gateScale = (() => {
        const s = base; const t = 130;
        const vMomentum = varS(s.returns, t - 15, t);
        const vGate = varS(s.returns, t - 31, t);
        return {
            momentumWindow: 16, gateWindow: 32,
            varianceUsed: vMomentum, varianceOfGateWindow: vGate, ratio: vGate / vMomentum,
            thresholdUsed: -2 * Math.sqrt(vMomentum) * Math.sqrt(32),
            thresholdIfGateWindowScaled: -2 * Math.sqrt(vGate) * Math.sqrt(32),
            note: 'the gate compares sum(returns, gateWindow) against -gateZ*sqrt(v_window)*sqrt(gateWindow), where v_window is the MOMENTUM window\'s variance. Under the i.i.d. reading the sum over the gate window has variance gateWindow*v_gateWindow, so the threshold is mis-scaled by sqrt(v_window/v_gateWindow) = 1/sqrt(vGate/vMomentum). With the shipped windows (16 vs 32) a hot short-term regime (vGate > vMomentum) makes the crash gate too LOOSE, i.e. it fires less often than the documented "-gateZ standard deviations of its own causal vol estimate".',
        };
    })();
    const findingGateScale = {
        claim: 'regimeGatedMomentum abstains while the trailing gateWindow-bar return "sits below -gateZ standard deviations of its own causal vol estimate"',
        witness: gateScale,
        note: 'LATENT and opt-in (`SIGUP_CANDIDATES`, gate G-H): the mis-scale is only visible when gateWindow != window, and the shipped candidate uses 32 vs 16. It does not fire at all when the two windows coincide. Worth recording because the feature is pre-registered as a *causal crash gate*, so a mis-scaled threshold changes how often the arm de-risks — a behavioural, not cosmetic, difference.',
    };

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = await v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-bs..: `analysis/features.js` is the SHIPPED causal signal family the walk-forward A/B scores (8 features in `SIGNAL_CANDIDATES` + two opt-in families on the same pipeline: `REVERSAL_CANDIDATES`, `SIGUP_CANDIDATES`). PASSES the pre-registered read, including the module header\'s strongest claim: for ALL 16 candidates and every t, perturbing closes/returns/volumes (and every panel stream) strictly AFTER t leaves `positionAt(candidate, series, t)` EXACTLY unchanged (0 mismatches over 16 candidates x 100 bars), and the perturbation is non-vacuous (a later position moves for every candidate, so the family really reads the perturbed data). A view missing `closes`/`volumes`/`panel` makes the affected features abstain (0) rather than throw; degenerate series (all-NaN, all-zero, Infinity) stay finite and in [-1,1]; `clampPosition` is exact (bounds, non-finite -> 0, degenerate saturation -> 0) and the documented defaults are exact; the z-score pipeline reproduces a hand recomputation over the trailing `zWindow` FINITE values with the sample std and the `minObs` floor, and abstains for a not-yet-populated window or a zero-dispersion series; all 16 features reproduce independent references exactly (fracDiffAt against an independent binomial-weight recursion AND the shipped `labels.js` convolution; the cross-section and the gate likewise); the cross-sectional candidates abstain without a panel; and the L10-e `closes` contract holds (a `{close}`-only series abstains, a `{closes}` series works). FINDINGS: (0) the zero-dispersion guard is defeated by floating-point rounding — an exactly-constant feature window returns z = ±sqrt((n-1)/n) (measured exactly: -0.9682458365518544 at n=16, -0.9842509842514764 at n=32, -0.9746794344808966 at n=20), i.e. a 0.47-0.49 position at the default saturation 2, where the module header and the docstring both promise 0 (the computed std is a denormal positive number, so `std > 0` passes; only an exactly-representable mean abstains); (1) the two internal helpers disagree on an EMPTY range — `finiteSum` returns 0 where `meanOf` returns NaN, so a zero-width window reads a valid-looking "no momentum" from every finiteSum-based feature instead of abstaining (latent: all shipped candidates fix window >= 1); (2) `networkMomentum` does not skip its own stream when `panel.streamIndex` is absent (`i === undefined` is never true), silently folding the stream\'s own lagged momentum into the "network" average (latent: analyze.js always sets it); (3) `regimeGatedMomentum`\'s crash gate standardises the gate window\'s SUM by the MOMENTUM window\'s variance, mis-scaling the threshold by sqrt(v_window/v_gateWindow) whenever the two windows differ (latent, opt-in G-H). Scope: SHIPPED family, but every finding is export-level/latent and no finding can move a golden.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            constantWindowSpuriousZ: findingConstantWindowZ,
            emptyRangeSum: findingEmptyRange,
            networkSelfInclusion: findingNetSelf,
            regimeGateWindowScale: findingGateScale,
        },
        scope: {
            shipped: ['SIGNAL_CANDIDATES (8 features)', 'causalZScore/positionAt/signalForCandidate', 'clampPosition', 'fracDiffAt/fracMomentum', 'momentum/volRegime/momentumAgreement/rangeLocation/volumeImbalance/autocorr1/acceleration'],
            testOnly: ['REVERSAL_CANDIDATES (opt-in --variants)', 'SIGUP_CANDIDATES (opt-in, gate G-H)'],
            why: 'analyze.js imports SIGNAL_CANDIDATES/REVERSAL_CANDIDATES/SIGUP_CANDIDATES + signalForCandidate to build every `sig:*` variant, and the default roster scores {baseline, sig-momentum, sig-accel}; walkforward.js\'s audit runs over the same `viewFor`. The three findings are all latent (a fixed window, a driver always setting streamIndex, an opt-in family), so nothing here moves a report and no fold-back row is due.',
        },
    };

    return { config: { n: N, testBars: N - 40, candidates: ALL.length, perturbation: 'closes x(1.5+i%3), returns -> -1.7r+0.03, volumes x2.5' }, rows, validation: resolved, verdict };
}
