// E56 - THE LABELLING / EVENT-SAMPLING / FRACTIONAL-DIFF MODULE, AUDITED AGAINST CLOSED FORMS.
// CYCLE-048 (L10-ai ... L10-ap).
//
// `analysis/labels.js` is the module F-63's follow-up pointed at: it owns the label SPANS the split
// contract turns on (`tripleBarrierLabels` returns `t1`, the realisation index, which the repo's own
// test feeds straight into `uniqueness`), the event sampler (`cusumFilter`), and the fractional-
// differentiation weights that the ONLY shipped consumer uses (`analysis/features.js#fracDiffAt`
// imports `fractionalDiffWeights`; features.js is the causal signal family of the A/B).
//
// CYCLE-044/045/046 established the technique: give the repo function an input with a KNOWN answer
// and assert the closed form. CYCLE-045 added the discipline (a single realisation of a noisy
// statistic is not a measurement -> seeded ensemble + a 2.5-SE band). Most of what follows is NOT
// noisy: first-touch, the CUSUM reset rule, the binomial weight recurrence and the NaN warm-up are
// exact combinatorial objects, so the closed forms are asserted exactly.
//
// PRE-REGISTERED READ. PASSES if (i) `tripleBarrierLabels` reproduces its three pinned repo cases and
// its label/touch/ret contracts hold exactly on a random grid (first crossing, the three-way
// inequality contract, `t1 = min(n-1, event + maxHolding)` on a timeout); (ii) the pt-before-sl
// tie-break is shown to be UNREACHABLE for positive vol (no bar can satisfy both conditions) yet
// REACHABLE and degenerate at `vol <= 0` (a zero-vol window collapses to a one-bar sign label); (iii)
// the default event set is shown to emit a degenerate zero-horizon bet; (iv) `cusumFilter` ignores its
// `events` argument, its `lastEmit` guard is dead (its output equals a guard-free independent
// drawup/drawdown reference exactly), and it matches monotone closed forms; (v) `fractionalDiffWeights`
// matches the binomial closed form for integer d (multiplicative binomial) and non-integer d
// (independent Lanczos log-gamma), `d=1` gives [1,-1] and is the first difference, `d=0` gives [1] and
// the identity, `size=1` is the identity for any d, the auto window is the first |w| < 1e-12 (NOT
// DEFAULT_FD_WINDOW as the docstring says), and the shipped `fracDiffAt`/`fracMomentum` equal the
// weights convolution exactly. A failure means one of those claims is wrong and F-64 must be revised.

import {
    tripleBarrierLabels, cusumFilter, fractionalDiffWeights, fractionalDiff, fracDiffLogPrices,
    DEFAULT_FD_WINDOW,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/labels.js';
import { fracDiffAt, fracMomentum } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';

// ---- deterministic helpers (LCG + Box-Muller); no Math.random, no crypto --------------------------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { let u = 0; let v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const r3 = (x, d = 3) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a) => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const close = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// ---- independent log-gamma (Lanczos g=7, n=9) for the non-integer binomial closed form -----------
function lgamma(x) {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
        -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
        1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    const z = x - 1;
    let a = c[0];
    const t = z + g + 0.5;
    for (let i = 1; i < 9; i++) a += c[i] / (z + i);
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}
// `lgamma` returns log|Gamma|, so the reflection region (d - k + 1 < 0) needs the sign restored:
// sign(Gamma(x)) = +1 for x > 0 and (-1)^ceil(-x) for x < 0.
function gammaSigned(x) {
    if (!(x !== 0)) return NaN;
    const s = x > 0 ? 1 : (Math.ceil(-x) % 2 === 0 ? 1 : -1);
    return s * Math.exp(lgamma(x));
}
// The closed form the module's docstring names: w_k = (-1)^k * C(d, k).
function binomClosed(d, k) {
    if (Number.isInteger(d)) {
        if (d >= 0 && k > d) return 0;
        let num = 1;                       // C(d,k) by the multiplicative recipe, exact for integer d
        let den = 1;
        for (let i = 1; i <= k; i++) { num *= (d - k + i); den *= i; }
        return (k % 2 ? -1 : 1) * (num / den);
    }
    return (k % 2 ? -1 : 1) * gammaSigned(d + 1) / (gammaSigned(k + 1) * gammaSigned(d - k + 1));
}
// |C(d,k)| in LOG space (no overflow): needed for the far tail, where (k)! and |Gamma(d-k+1)| both
// overflow a double long before their ratio does.
function absBinomLog(d, k) {
    if (Number.isInteger(d) && d >= 0) return k > d ? 0 : Math.exp(lgamma(d + 1) - lgamma(k + 1) - lgamma(d - k + 1));
    return Math.exp(lgamma(d + 1) - lgamma(k + 1) - lgamma(d - k + 1));
}

// ---- independent CUSUM reference: same reset rule, DIFFERENT formulation -------------------------
// The module recurses `sPos = max(0, sPos + r)` / `sNeg = min(0, sNeg + r)`. That equals the drawup
// and drawdown of the cumulative-sum path since the last reset: sPos = S_j - min_{v<=j} S_v and
// sNeg = S_j - max_{v<=j} S_v. Computing it from running extrema of S is a different algorithm, and it
// carries NO `lastEmit` guard at all - so an exact match also shows the repo guard is dead.
function refCusum(prices, threshold) {
    const out = [];
    let segStart = 0;                       // index of the last reset (exclusive of the first return)
    let S = 0;
    let minS = 0;
    let maxS = 0;
    for (let t = 1; t < prices.length; t++) {
        S += prices[t] - prices[t - 1];
        if (S < minS) minS = S;
        if (S > maxS) maxS = S;
        const drawup = S - minS;
        const drawdown = S - maxS;
        if (drawup > threshold || drawdown < -threshold) {
            out.push(t);
            segStart = t;
            S = 0; minS = 0; maxS = 0;
        }
    }
    void segStart;
    return out;
}

export async function run() {
    // ================================ A. triple-barrier labels =====================================
    // A1. the three cases the repo's own test pins (analysis.test.js section J).
    const golden = {
        pt: tripleBarrierLabels({ prices: [100, 101, 102, 101, 103, 99], events: [0], ptSl: [1, 1], vol: 2, maxHolding: 5 })[0],
        sl: tripleBarrierLabels({ prices: [100, 97, 96, 101], events: [0], ptSl: [1, 1], vol: 2, maxHolding: 3 })[0],
        vertical: tripleBarrierLabels({ prices: [100, 100.5, 100.8, 100.9], events: [0], ptSl: [1, 1], vol: 2, maxHolding: 3 })[0],
    };
    const goldenOk = golden.pt.label === 1 && golden.pt.t1 === 2
        && golden.sl.label === -1 && golden.sl.t1 === 1
        && golden.vertical.label === 0 && golden.vertical.t1 === 3;

    // A2. monotone paths: the first crossing has a closed form, ceil(level/step); the opposite barrier
    //     is unreachable on a monotone path, so the label is decided by one ceiling.
    const monoRows = [];
    for (const sign of [1, -1]) {
        for (const stepAbs of [0.85, 1.0, 1.7, 2.3]) {
            for (const [ptMult, slMult] of [[1, 1], [1, 1.3], [0.6, 2.1]]) {
                for (const v of [1.4, 2.7]) {
                    for (const H of [2, 5, 12, 40]) {
                        const n = 60;
                        const step = sign * stepAbs;
                        const prices = [100];
                        for (let t = 1; t < n; t++) prices.push(prices[t - 1] + step);
                        const t1 = Math.min(n - 1, 0 + H);
                        const up = ptMult * v;
                        const dn = slMult * v;
                        let expectLabel;
                        let expectTouch;
                        if (sign > 0) {
                            const tUp = up > 0 ? Math.ceil(up / stepAbs - 1e-9) : 1;
                            expectLabel = tUp <= t1 ? 1 : 0;
                            expectTouch = Math.min(tUp, t1);
                        } else {
                            const tDn = dn > 0 ? Math.ceil(dn / stepAbs - 1e-9) : 1;
                            expectLabel = tDn <= t1 ? -1 : 0;
                            expectTouch = Math.min(tDn, t1);
                        }
                        const got = tripleBarrierLabels({ prices, events: [0], ptSl: [ptMult, slMult], vol: v, maxHolding: H })[0];
                        monoRows.push({
                            sign, stepAbs, ptMult, slMult, v, H, expectLabel, expectTouch,
                            label: got.label, touch: got.t1,
                            match: got.label === expectLabel && got.t1 === expectTouch,
                        });
                    }
                }
            }
        }
    }
    const monoAllMatch = monoRows.every((x) => x.match);

    // A3. random grid: the contracts, asserted exactly (first crossing; the three-way ret inequality;
    //     timeout index closed form; first-crossing is genuinely the FIRST).
    const trials = 60;
    const gridRows = [];
    for (let s = 1; s <= trials; s++) {
        const r = rng(11000 + s * 29);
        const n = 400;
        const H = [1, 3, 8, 20][s % 4];
        const ptMult = [1, 1, 1.5, 0.5][s % 4];
        const slMult = [1, 2, 1, 1.5][s % 4];
        const v = 0.8 + 1.6 * r();
        const prices = [100];
        for (let t = 1; t < n; t++) {
            const shock = gauss(r) * 0.006;
            const gap = r() < 0.03 ? gauss(r) * 0.02 : 0;      // occasional gaps so ret overshoots the level
            prices.push(prices[t - 1] * (1 + shock + gap));
        }
        const events = [];
        {
            const re = rng(500 + s);
            for (let t = 0; t < n; t++) if (re() < 0.25) events.push(t);
            if (!events.length) events.push(0);
        }
        const rows = tripleBarrierLabels({ prices, events, ptSl: [ptMult, slMult], vol: v, maxHolding: H });
        let ok = rows.length === events.length;
        let labelContract = true;
        let firstCrossOk = true;
        let timeoutOk = true;
        let retOk = true;
        let gapOvershoot = 0;
        for (const row of rows) {
            const e = row.event;
            const entry = prices[e];
            const ptLevel = entry + ptMult * v;
            const slLevel = entry - slMult * v;
            const verticalEnd = Math.min(n - 1, e + H);
            const touched = row.t1;
            if (![-1, 0, 1].includes(row.label)) labelContract = false;
            const ret = prices[touched] - entry;
            if (!close(row.ret, ret, 1e-12)) retOk = false;
            if (row.label === 0) {
                if (touched !== verticalEnd) timeoutOk = false;
                if (!(ret > -slMult * v && ret < ptMult * v)) firstCrossOk = false;
                for (let t = e + 1; t <= touched; t++) if (!(prices[t] > slLevel && prices[t] < ptLevel)) firstCrossOk = false;
            } else {
                if (!(touched > e && touched <= verticalEnd)) timeoutOk = false;
                for (let t = e + 1; t < touched; t++) {
                    // no earlier bar may satisfy EITHER condition (pt precedence means an earlier
                    // pt-satisfying bar would have won, whichever label we ended up with)
                    if (prices[t] >= ptLevel || prices[t] <= slLevel) firstCrossOk = false;
                }
                if (row.label === 1) {
                    if (!(prices[touched] >= ptLevel)) firstCrossOk = false;
                    if (!(ret >= ptMult * v - 1e-12)) firstCrossOk = false;
                    if (ret > ptMult * v * 1.01) gapOvershoot++;
                } else {
                    if (!(prices[touched] <= slLevel)) firstCrossOk = false;
                    if (!(ret <= -slMult * v + 1e-12)) firstCrossOk = false;
                }
            }
        }
        gridRows.push({ s, H, labelContract, firstCrossOk, timeoutOk, retOk, rows: rows.length, gapOvershoot });
        ok = ok && labelContract && firstCrossOk && timeoutOk && retOk;
        void ok;
    }
    const gridAllOk = gridRows.every((x) => x.labelContract && x.firstCrossOk && x.timeoutOk && x.retOk);

    // A4. the tie-break. `pt` is checked BEFORE `sl`, so a bar satisfying both reads +1. A bar can only
    //     satisfy both iff ptLevel <= slLevel iff (ptMult + slMult) * vol <= 0 - i.e. only for vol <= 0.
    //     With vol > 0 the ordering is therefore a dead branch on the whole sane domain.
    const tieRows = [];
    for (const v of [2.7, 1.4, 0.3, 0, -0.5, -2.0]) {
        const prices = [100, 100.4, 99.6, 100, 100.0, 99.9];
        const ptMult = 1;
        const slMult = 1;
        const ptLevel = 100 + ptMult * v;
        const slLevel = 100 - slMult * v;
        let both = 0;
        for (const p of prices) if (p >= ptLevel && p <= slLevel) both++;
        const got = tripleBarrierLabels({ prices, events: [0], ptSl: [ptMult, slMult], vol: v, maxHolding: 5 });
        tieRows.push({ vol: v, ptLevel: r3(ptLevel), slLevel: r3(slLevel), overlapReachable: ptLevel <= slLevel, barsSatisfyingBoth: both, label: got[0].label, touched: got[0].t1 });
    }
    const tieUnreachablePositive = tieRows.filter((x) => x.vol > 0).every((x) => x.overlapReachable === false && x.barsSatisfyingBoth === 0);
    const tieReachableNonPositive = tieRows.filter((x) => x.vol <= 0).every((x) => x.overlapReachable === true && x.barsSatisfyingBoth > 0);

    // A5. the zero-vol collapse. With vol = 0 the barriers coincide at the entry price, so the label is
    //     the one-bar sign of the next price (ties -> +1), independent of maxHolding and of the levels.
    const zRows = [];
    for (const step of [1, -1, 0.25, -0.25]) {
        for (const H of [1, 5, 30]) {
            const n = 40;
            const prices = [100];
            for (let t = 1; t < n; t++) prices.push(prices[t - 1] + step);
            const got = tripleBarrierLabels({ prices, events: [0, 1, 10], ptSl: [1, 1], vol: 0, maxHolding: H });
            const expect = prices[1] >= prices[0] ? 1 : -1;
            zRows.push({ step, H, label: got[0].label, expectOneBarSign: expect, touched: got[0].t1, matchesSign: got[0].label === expect });
        }
    }
    const zeroVolIsOneBarSign = zRows.every((x) => x.matchesSign);
    // A FLAT series at vol = 0: ptLevel = slLevel = entry, so bar e+1 touches at exactly zero return
    // ("profitable" with ret = 0), except the very last bar, whose empty loop leaves the zero-horizon
    // row. So a flat/zero-vol window labels every bet +1 at zero P&L.
    const flat = new Array(12).fill(100);
    const flatRows = tripleBarrierLabels({ prices: flat, ptSl: [1, 1], vol: 0, maxHolding: 5 });
    const flatLast = flatRows.length - 1;
    const flatAllPlusOne = flatRows.every((x, i) => x.ret === 0 && (i < flatLast
        ? (x.label === 1 && x.t1 === x.event + 1)
        : (x.label === 0 && x.t1 === x.event)));
    const flatPlusOneCount = flatRows.filter((x) => x.label === 1).length;
    const flatCount = flatRows.length;

    // A6. the default event set. `events = null` -> every index, INCLUDING `n - 1`, for which
    //     t1 = min(n-1, n-1+H) = n-1 = event: an empty loop -> a ZERO-HORIZON bet {label:0, ret:0}.
    //     The last `maxHolding` events all get a truncated vertical barrier.
    const nDef = 30;
    const HDef = 10;
    const rd = rng(31337);
    const defPrices = [100];
    for (let t = 1; t < nDef; t++) defPrices.push(defPrices[t - 1] + gauss(rd) * 0.9);
    const defRows = tripleBarrierLabels({ prices: defPrices, ptSl: [1, 1], vol: 1.0, maxHolding: HDef });
    const zeroHorizon = defRows.filter((x) => x.t1 === x.event);
    const verticalEndOk = defRows.every((x) => (x.label === 0
        ? x.t1 === Math.min(nDef - 1, x.event + HDef)
        : (x.t1 > x.event && x.t1 <= Math.min(nDef - 1, x.event + HDef))));
    const truncatedEvents = defRows.filter((x) => x.event + HDef > nDef - 1).length;
    const defaultEventRow = {
        rows: defRows.length,
        expectedRows: nDef,
        zeroHorizonCount: zeroHorizon.length,
        zeroHorizonLast: zeroHorizon[zeroHorizon.length - 1] || null,
        truncatedVerticalEvents: truncatedEvents,
        truncatedExpected: HDef,          // events n-H .. n-1 have e + H > n-1
        verticalEndFormulaHolds: verticalEndOk,
        labelMix: { plus1: defRows.filter((x) => x.label === 1).length, minus1: defRows.filter((x) => x.label === -1).length, zero: defRows.filter((x) => x.label === 0).length },
    };
    const defaultEventsDegenerate = zeroHorizon.length === 1 && zeroHorizon[0].event === nDef - 1
        && zeroHorizon[0].label === 0 && zeroHorizon[0].ret === 0 && verticalEndOk
        && truncatedEvents === HDef;

    // ==================================== B. cusum filter ==========================================
    // B1. an independent drawup/drawdown reference matches exactly, on monotone and random walks.
    const cusumRefRows = [];
    for (let s = 1; s <= 40; s++) {
        const r = rng(77000 + s * 31);
        const n = 500;
        const prices = [100];
        for (let t = 1; t < n; t++) prices.push(prices[t - 1] + gauss(r) * 0.5);
        for (const threshold of [0.5, 1.5, 3, 7.5]) {
            const repo = cusumFilter({ prices, threshold });
            const ref = refCusum(prices, threshold);
            cusumRefRows.push({ s, threshold, repo: repo.length, ref: ref.length, equal: JSON.stringify(repo) === JSON.stringify(ref) });
        }
    }
    const cusumMatchesReference = cusumRefRows.every((x) => x.equal);

    // B2. monotone closed form: a rise of `step` per bar emits at k, 2k, 3k, ... for k = floor(thr/step)+1.
    const cusumMonoRows = [];
    for (const sign of [1, -1]) {
        for (const thr of [2.5, 1.5, 4.25]) {
            for (const stepAbs of [1, 0.65]) {
                const n = 40;
                const step = sign * stepAbs;
                const prices = [100];
                for (let t = 1; t < n; t++) prices.push(prices[t - 1] + step);
                const k = Math.floor(thr / stepAbs) + 1;
                const expect = [];
                for (let t = k; t < n; t += k) expect.push(t);
                const got = cusumFilter({ prices, threshold: thr });
                cusumMonoRows.push({ sign, thr, stepAbs, k, expectLen: expect.length, gotLen: got.length, equal: JSON.stringify(got) === JSON.stringify(expect) });
            }
        }
    }
    const cusumMonoMatches = cusumMonoRows.every((x) => x.equal);

    // B3. the `events` argument is accepted and never read.
    const cusumEvPrices = [100, 101, 102, 100, 103, 104, 99, 105];
    const cusumWithEvents = cusumFilter({ prices: cusumEvPrices, threshold: 2.5, events: [0, 5, 999] });
    const cusumWithout = cusumFilter({ prices: cusumEvPrices, threshold: 2.5 });
    const cusumIgnoresEvents = JSON.stringify(cusumWithEvents) === JSON.stringify(cusumWithout);
    // and the threshold is STRICT: a move exactly equal to the threshold does not emit.
    const thrExact = cusumFilter({ prices: [0, 2], threshold: 2 });
    const thrJustBelow = cusumFilter({ prices: [0, 2], threshold: 2 - 1e-12 });
    const cusumStrictThreshold = thrExact.length === 0 && thrJustBelow.length === 1;

    // ============================ C. fractional differentiation =====================================
    // C1. integer d: the weights are exactly (-1)^k C(d,k), and vanish for k > d.
    const fdIntRows = [];
    for (const d of [0, 1, 2, 3, 4, 5]) {
        const got = fractionalDiffWeights(d, 12);
        const expect = Array.from({ length: 12 }, (_, k) => binomClosed(d, k));
        fdIntRows.push({ d, len: got.length, exact: got.every((w, k) => close(w, expect[k], 1e-12) || Math.abs(w - expect[k]) < 1e-12) });
    }
    const fdIntegerMatches = fdIntRows.every((x) => x.exact);

    // C2. non-integer d: against an INDEPENDENT Lanczos log-gamma evaluation of (-1)^k C(d,k).
    const fdNonIntRows = [];
    for (const d of [0.4, 0.5, 0.7, 1.5, 2.5, -0.5]) {
        const got = fractionalDiffWeights(d, 40);
        let maxRel = 0;
        for (let k = 0; k < Math.min(got.length, 39); k++) {
            const expect = binomClosed(d, k);
            if (Math.abs(expect) < 1e-14) continue;
            maxRel = Math.max(maxRel, Math.abs(got[k] - expect) / Math.abs(expect));
        }
        fdNonIntRows.push({ d, len: got.length, maxRelError: maxRel, match: maxRel < 1e-8 });
    }
    const fdNonIntegerMatches = fdNonIntRows.every((x) => x.match);

    // C3. the auto window rule: expand until |w| < 1e-12, capped at DEFAULT_FD_WINDOW. The docstring
    //     says "`size <= 0` uses DEFAULT_FD_WINDOW" - true only for d where the tail decays slowly.
    const autoRows = [];
    for (const d of [0, 0.4, 0.5, 1, 2, 3, -0.5, 0.1]) {
        const got = fractionalDiffWeights(d, 0);
        // the length the stated rule predicts: first k >= 1 with |w_k| < 1e-12, else the cap
        let predicted = DEFAULT_FD_WINDOW;
        for (let k = 1; k <= DEFAULT_FD_WINDOW; k++) {
            const w = binomClosed(d, k);
            if (!Number.isFinite(w) || Math.abs(w) < 1e-12) { predicted = k; break; }
        }
        autoRows.push({ d, len: got.length, predictedByStatedRule: predicted, equalsDefaultWindow: got.length === DEFAULT_FD_WINDOW, match: got.length === predicted });
    }
    const fdAutoRuleHolds = autoRows.every((x) => x.match);
    // the docstring's claim ("size <= 0 uses DEFAULT_FD_WINDOW") is false wherever the auto rule stops early
    const docStringClaimHolds = autoRows.every((x) => x.equalsDefaultWindow);
    const autoEarlyRows = autoRows.filter((x) => !x.equalsDefaultWindow).map((x) => ({ d: x.d, len: x.len }));

    // C4. d = 1 -> [1, -1]; d = 0 -> [1] (identity, NOT width 2); size = 1 -> identity for any d.
    const fdD1 = fractionalDiffWeights(1, 0);
    const fdD1Ok = JSON.stringify(fdD1) === JSON.stringify([1, -1]);
    const fdD0 = fractionalDiffWeights(0, 0);
    const fdD0IsOne = JSON.stringify(fdD0) === JSON.stringify([1]);
    const d0Series = [3, 1, 4, 1, 5, 9, 2, 6];
    const fdD0Applied = fractionalDiff(d0Series, 0, 0);
    const fdD0Identity = fdD0Applied.every((x, i) => x === d0Series[i]);        // not NaN at position 0
    const sizeOneIdentity = [0.4, 1.5, 3.3].every((d) => {
        const out = fractionalDiff(d0Series, d, 1);
        return out.every((x, i) => x === d0Series[i]);
    });

    // C5. the NaN warm-up closed form: out[t] is NaN iff t < width - 1, width = min(w.length, series.length).
    const warmRows = [];
    for (const [d, size] of [[1, 0], [0.4, 16], [0.4, 0], [2, 0], [0.5, 5]]) {
        const series = Array.from({ length: 30 }, (_, i) => Math.log(100 + i * 0.3));
        const out = fractionalDiff(series, d, size);
        const w = fractionalDiffWeights(d, size);
        const width = Math.min(w.length, series.length);
        let ok = true;
        for (let t = 0; t < out.length; t++) {
            const shouldBeNaN = t < width - 1;
            if (shouldBeNaN !== Number.isNaN(out[t])) ok = false;
        }
        warmRows.push({ d, size, width, warmOk: ok });
    }
    const fdWarmupHolds = warmRows.every((x) => x.warmOk);
    // and d=1 size=0 is exactly the first difference, d=1 size=0 of a linear series is constant.
    const fd1 = fractionalDiff([1, 2, 4, 7], 1, 0);
    const fd1IsFirstDifference = Number.isNaN(fd1[0]) && fd1[1] === 1 && fd1[2] === 2 && fd1[3] === 3;
    const lin = fractionalDiff([0, 2, 4, 6, 8, 10], 1, 0);
    const fd1LinearConstant = lin.slice(1).every((v) => close(v, 2, 1e-9));

    // C6. the shipped consumer (features.js#fracDiffAt) equals the weights convolution exactly.
    const closes = Array.from({ length: 60 }, (_, i) => 100 * Math.exp(i * 0.001 + Math.sin(i * 0.7) * 0.01));
    const consumerRows = [];
    for (const d of [0.4, 0.2, 0.6]) {
        for (const window of [16, 5, 32]) {
            for (const t of [0, window - 2, window - 1, window, 37, 59]) {
                const got = fracDiffAt(closes, t, { d, window });
                const w = fractionalDiffWeights(d, window);
                let acc = 0;
                let expect;
                if (t - w.length + 1 < 0) expect = NaN;
                else { for (let k = 0; k < w.length; k++) acc += w[k] * Math.log(closes[t - k]); expect = acc; }
                const match = Number.isNaN(expect) ? Number.isNaN(got) : close(got, expect, 1e-9);
                consumerRows.push({ d, window, t, gotIsNaN: Number.isNaN(got), expectIsNaN: Number.isNaN(expect), match });
            }
        }
    }
    const consumerMatches = consumerRows.every((x) => x.match);
    // fracMomentum = fracDiffAt(t) - fracDiffAt(t-1)
    const momSeries = { closes, returns: [0], volumes: [1] };
    const momRow = fracMomentum(momSeries, 40, { d: 0.4, window: 16 });
    const momExpect = fracDiffAt(closes, 40, { d: 0.4, window: 16 }) - fracDiffAt(closes, 39, { d: 0.4, window: 16 });
    const momentumMatches = close(momRow, momExpect, 1e-9) && Number.isFinite(momRow);

    // C7. calibration: the shipped arm uses window 16 at d = 0.4, while the module's own auto rule uses
    //     DEFAULT_FD_WINDOW (100) for the same d. How much weight mass does the 16-window omit?
    const auto04 = fractionalDiffWeights(0.4, 0);
    const l1 = (arr) => arr.reduce((s, x) => s + Math.abs(x), 0);
    const totalL1 = l1(auto04);
    const beyond16 = l1(auto04.slice(16));
    let beyondCap = 0;                                       // the mass the 100-weight cap itself omits
    for (let k = DEFAULT_FD_WINDOW; k < 5000; k++) beyondCap += absBinomLog(0.4, k);
    const tailCalibration = {
        autoWindow: auto04.length,
        shippedWindow: 16,
        w15: r3(auto04[15], 6), w16: r3(auto04[16], 6),
        l1TotalFirst100: r3(totalL1, 4),
        l1Beyond15: r3(beyond16, 4),
        fractionL1Beyond15: r3(beyond16 / totalL1, 4),
        l1Beyond99: r3(beyondCap, 4),                 // mass the auto window's own cap omits
        autoStopThreshold: 1e-12,
    };
    const tailNonNegligible = tailCalibration.fractionL1Beyond15 > 0.05;

    // ========================================== guards =============================================
    const checks = {
        tblReproducesGolden: goldenOk,
        tblMonotoneClosedForm: monoAllMatch,
        tblGridContracts: gridAllOk,
        tblTieUnreachableForPositiveVol: tieUnreachablePositive,
        tblTieReachableForNonPositiveVol: tieReachableNonPositive,
        tblZeroVolIsOneBarSign: zeroVolIsOneBarSign,
        tblFlatZeroVolAllPlusOne: flatAllPlusOne && flatCount === 12,
        tblDefaultEventsDegenerate: defaultEventsDegenerate,
        cusumMatchesIndependentReference: cusumMatchesReference,
        cusumMonotoneClosedForm: cusumMonoMatches,
        cusumIgnoresEventsArg: cusumIgnoresEvents,
        cusumStrictThreshold: cusumStrictThreshold,
        fdIntegerMatchesBinomial: fdIntegerMatches,
        fdNonIntegerMatchesGamma: fdNonIntegerMatches,
        fdAutoWindowRuleHolds: fdAutoRuleHolds,
        fdDocstringClaimFalse: docStringClaimHolds === false && autoEarlyRows.length > 0,
        fdD1IsMinusOne: fdD1Ok,
        fdD0IsWidthOneIdentity: fdD0IsOne && fdD0Identity,
        fdSizeOneIdentity: sizeOneIdentity,
        fdWarmupClosedForm: fdWarmupHolds,
        fdD1IsFirstDifference: fd1IsFirstDifference && fd1LinearConstant,
        fdShippedConsumerMatches: consumerMatches && momentumMatches,
        fdTailBeyondShippedWindowNonNegligible: tailNonNegligible,
    };
    const validationPass = Object.values(checks).every((x) => x === true);

    const verdict = {
        note: 'the module is CORRECT on its stated contracts (first-touch, the binomial weights, the CUSUM reset rule, the NaN warm-up) but carries (i) a pt-before-sl tie-break that is unreachable for vol>0 and degenerate for vol<=0 (a zero-vol window collapses to a one-bar sign label), (ii) a default event set that emits a zero-horizon bet with label 0, (iii) a CUSUM `events` argument that is accepted and never read and a `lastEmit` guard that is dead, and (iv) a docstring that says `size <= 0` uses DEFAULT_FD_WINDOW when the code stops at the first |w| < 1e-12 (d=1 -> 2); and only 1 of its 6 exports is on the shipped path (`fractionalDiffWeights` via features.js), the shipped FD arm using window 16 where the auto rule uses 100.',
        validationPass,
        tailCalibration,
        autoEarlyRows,
    };
    return {
        config: {
            gridTrials: trials, cusumRefTrials: 40, goldenCases: 3, monotoneCases: monoRows.length,
        },
        tripleBarrier: {
            golden: { pt: golden.pt, sl: golden.sl, vertical: golden.vertical, goldenOk },
            monotone: { cases: monoRows.length, allMatch: monoAllMatch, sample: monoRows.slice(0, 3) },
            grid: { trials, allOk: gridAllOk, sample: gridRows.slice(0, 3), gapOvershootRows: gridRows.filter((x) => x.gapOvershoot > 0).length, totalGapOvershoots: gridRows.reduce((s, x) => s + x.gapOvershoot, 0) },
            tie: { rows: tieRows, unreachableForPositiveVol: tieUnreachablePositive, reachableForNonPositiveVol: tieReachableNonPositive },
            zeroVol: { rows: zRows, isOneBarSign: zeroVolIsOneBarSign, flat, flatCount, flatAllPlusOne, flatPlusOneCount },
            defaultEvents: defaultEventRow,
        },
        cusum: {
            reference: { rows: cusumRefRows.length, allEqual: cusumMatchesReference },
            monotone: { cases: cusumMonoRows.length, allEqual: cusumMonoMatches, sample: cusumMonoRows.slice(0, 2) },
            ignoresEventsArg: cusumIgnoresEvents,
            strictThreshold: cusumStrictThreshold,
        },
        fractionalDiff: {
            integerBinomial: fdIntRows,
            nonIntegerGamma: fdNonIntRows,
            autoWindow: autoRows,
            d1: fdD1, d0: fdD0,
            warmup: warmRows,
            shippedConsumerSample: consumerRows.slice(0, 6),
            shippedConsumerAllMatch: consumerMatches && momentumMatches,
        },
        validation: checks,
        verdict,
    };
}
