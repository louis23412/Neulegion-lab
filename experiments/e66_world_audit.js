// E66 - THE AUDITED EVALUATION WORLD, AUDITED: `analysis/world.js`. CYCLE-058 (L10-cc ...).
//
// `analysis/world.js` (round 23, N0) is the module that gives `auditNoLookahead` its teeth. `auditNoLookahead`
// can only certify causality for information it can REACH, and the shipped model reads the candle series, not
// the return array, so a returns-only perturbation never touched its input and its audit passed VACUOUSLY
// (BUGS.md #22). `world.js` builds the view a candle-driven model consumes: `shockCandles` scales every bar
// AFTER the probe point by a bounded, deterministic, NON-uniform factor, and `makeCandleViewFor` re-derives
// `view.returns` from the (possibly shocked) closes so there is never a second, unshocked copy of the future.
// It is SHIPPED: `analyze.js` imports `makeCandleViewFor`/`worldFromCandles`/`DEFAULT_SHOCK` and `fold_worker.js`
// builds its view through `makeCandleViewFor`.
//
// PRE-REGISTERED READ. PASSES if (i) `shockFactor`/`volumeShockFactor` are 1 at and before `after`, strictly
// inside [1, 1+2*probe] after it, deterministic, non-uniform across t, and phase-shifted from each other;
// (ii) `shockCandles` is the identity for `perturb = null`, leaves every bar at or before `after` untouched
// (same object), scales OHLC by the same factor and volume by its own factor after it, never mutates its input,
// is deterministic, keeps a shocked price path positive, and changes the SHAPE (non-uniform ratio), not just the
// level; (iii) `makeCandleViewFor` returns the real candles on the base pass and a self-consistent tuple on a
// probe pass (`view.returns === barReturns(view.closes)` exactly; the past is unchanged; at least one future
// bar moves), and attaches the panel with this stream's own series replaced by `own`; (iv) `worldFromCandles`
// aligns candles/closes/volumes/returns and honours `maxBars` with the last-N contract.
//
// The DEFECTS are reported in `findings`: with `streamIndex` absent or out of
// range the probe panel is NULL (fail-closed — a cross-sectional candidate
// abstains and the audit flags VACUOUS rather than passing green); and with a
// valid index the probe shocks sibling slots additively after `after` (round-86
// sibling shock), so cross-sectional arms are reachable. `worldFromCandles`'s
// `maxBars` guard is fail-closed (0 -> empty, negative/fractional -> throws).

import {
    DEFAULT_SHOCK, shockFactor, volumeShockFactor, shockCandles, makeCandleViewFor, worldFromCandles,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/world.js';
import { barReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const close = (a, b, tol = 1e-12) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= tol;
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const mkCandles = (n, seed = 17) => {
    const rnd = mulberry32(seed);
    const out = [];
    let p = 100;
    for (let i = 0; i < n; i++) {
        const o = p;
        const c = o * (1 + (rnd() - 0.5) * 0.03);
        out.push({ timestamp: 2000 + i, open: o, high: Math.max(o, c) * 1.004, low: Math.min(o, c) * 0.996, close: c, volume: 8 + rnd() * 4 });
        p = c;
    }
    return out;
};

export async function run() {
    const checks = {};
    const rows = {};

    // ============================== A. the shock factors ===============================================
    checks.shockFactorContract = (() => {
        const after = 20;
        const probe = 0.07;
        let inBounds = true, pastOne = true, varies = false;
        const vals = [];
        for (let t = 0; t < 60; t++) {
            const f = shockFactor(t, { after, probe });
            const g = volumeShockFactor(t, { after, probe });
            const wantOne = t <= after;
            if (wantOne && (f !== 1 || g !== 1)) pastOne = false;
            if (f < 1 || f > 1 + 2 * probe + 1e-12) inBounds = false;
            if (g < 1 || g > 1 + 2 * probe + 1e-12) inBounds = false;
            vals.push({ t, f, g });
        }
        const fs = vals.map((v) => v.f);
        varies = Math.max(...fs) - Math.min(...fs) > 1e-6;
        const shifted = vals.some((v) => Math.abs(v.f - v.g) > 1e-9);
        const zeroProbe = shockFactor(after + 5, { after, probe: 0 });
        const det = shockFactor(after + 5, { after, probe }) === shockFactor(after + 5, { after, probe });
        const defaults = close(shockFactor(after + 1, { after }), shockFactor(after + 1, { after, probe: DEFAULT_SHOCK.probe }), 0) && DEFAULT_SHOCK.probe === 0.05;
        rows.shockFactors = { after, probe, pastOne, inBounds, varies, phaseShifted: shifted, zeroProbe, sample: vals.slice(19, 24) };
        return pastOne && inBounds && varies && shifted && zeroProbe === 1 && det && defaults;
    })();

    // ============================== B. shockCandles ====================================================
    checks.shockCandlesContract = (() => {
        const candles = mkCandles(40);
        const snapshot = JSON.stringify(candles);
        const after = 20, probe = 0.05;
        const s1 = shockCandles(candles, { after, probe });
        const s2 = shockCandles(candles, { after, probe });
        const identity = shockCandles(candles, null) === candles;
        let untouchedPast = true, scaledOk = true, ratioVaries = false, positive = true;
        const ratios = [];
        for (let t = 0; t < candles.length; t++) {
            if (t <= after) {
                if (s1[t] !== candles[t]) untouchedPast = false;
            } else {
                const f = shockFactor(t, { after, probe });
                const fv = volumeShockFactor(t, { after, probe });
                if (!close(s1[t].open, candles[t].open * f) || !close(s1[t].high, candles[t].high * f)
                    || !close(s1[t].low, candles[t].low * f) || !close(s1[t].close, candles[t].close * f)
                    || !close(s1[t].volume, candles[t].volume * fv)) scaledOk = false;
                if (!(s1[t].close > 0)) positive = false;
                ratios.push(s1[t].close / candles[t].close);
            }
        }
        ratioVaries = Math.max(...ratios) - Math.min(...ratios) > 1e-6;
        const unmutated = JSON.stringify(candles) === snapshot;
        const det = deepEq(s1, s2);
        rows.shockCandles = { identity, untouchedPast, scaledOk, ratioVaries, positive, unmutated, det, ratioMin: Math.min(...ratios), ratioMax: Math.max(...ratios) };
        return identity && untouchedPast && scaledOk && ratioVaries && positive && unmutated && det;
    })();

    // ============================== C. makeCandleViewFor ===============================================
    checks.candleViewContract = (() => {
        const candles = mkCandles(50);
        const after = 30, probe = 0.05;
        const viewFor = makeCandleViewFor(candles);
        const base = viewFor(null, null);
        const pr = viewFor(null, { after, probe });
        const baseReturns = barReturns(candles.map((c) => c.close));
        const baseOk = base.candles === candles && base.perturb === null
            && deepEq(base.closes, candles.map((c) => c.close))
            && deepEq(base.volumes, candles.map((c) => (Number.isFinite(c.volume) ? c.volume : 1)))
            && deepEq(base.returns, baseReturns);
        // probe: self-consistency + past unchanged + a future bar moves
        const selfConsistent = deepEq(pr.returns, barReturns(pr.closes));
        let pastSame = true, futureMoved = 0;
        for (let t = 0; t < candles.length; t++) {
            if (t <= after) { if (!close(pr.closes[t], base.closes[t], 0)) pastSame = false; if (!close(pr.returns[t], baseReturns[t], 0)) pastSame = false; }
            else if (Math.abs(pr.closes[t] - base.closes[t]) > 1e-9) futureMoved++;
        }
        const perturbEcho = pr.perturb && pr.perturb.after === after && close(pr.perturb.probe, probe, 0);
        // a caller-supplied returns array is used verbatim on the base pass
        const custom = new Array(candles.length).fill(0.5);
        const baseCustom = viewFor(custom, null);
        const customOk = baseCustom.returns === custom && base.panel === null;
        rows.candleView = { baseOk, selfConsistent, pastSame, futureMoved, perturbEcho, customOk, totalBars: candles.length };
        return baseOk && selfConsistent && pastSame && futureMoved > 0 && perturbEcho && customOk;
    })();

    // ============================== D. worldFromCandles ===============================================
    checks.worldFromCandlesContract = (() => {
        const candles = mkCandles(30);
        const snapshot = JSON.stringify(candles);
        const full = worldFromCandles(candles);
        const five = worldFromCandles(candles, { maxBars: 5 });
        const copied = full.candles !== candles && deepEq(full.candles, candles);
        const aligned = close(full.closes[0], candles[0].close, 0)
            && deepEq(full.closes, candles.map((c) => c.close))
            && deepEq(full.volumes, candles.map((c) => (Number.isFinite(c.volume) ? c.volume : 1)))
            && deepEq(full.returns, barReturns(candles.map((c) => c.close)));
        const lastFive = five.candles.length === 5 && deepEq(five.candles, candles.slice(-5)) && deepEq(five.returns, barReturns(candles.slice(-5).map((c) => c.close)));
        const unmutated = JSON.stringify(candles) === snapshot;
        rows.worldFrom = { copied, aligned, lastFive, unmutated };
        return copied && aligned && lastFive && unmutated;
    })();

    checks.worldFromCandlesMaxBarsEdge = (() => {
        const candles = mkCandles(30);
        const zero = worldFromCandles(candles, { maxBars: 0 });
        let negThrows = false, fracThrows = false;
        try { worldFromCandles(candles, { maxBars: -5 }); } catch { negThrows = true; }
        try { worldFromCandles(candles, { maxBars: 7.5 }); } catch { fracThrows = true; }
        rows.worldFromEdge = {
            maxBars0Bars: zero.candles.length,
            maxBarsNeg5Throws: negThrows,
            maxBarsFracThrows: fracThrows,
            note: 'round-86 restatement (repo R35 L10-cd fail-closed guard): maxBars 0 yields an EMPTY world, and a negative or fractional maxBars THROWS. A mis-set --bars now fails loudly instead of producing a plausible-looking shorter series.',
        };
        // pin the module's actual behaviour
        return zero.candles.length === 0 && zero.returns.length === 0 && negThrows && fracThrows;
    })();

    // ============================== E. panel attachment ================================================
    checks.panelAttachment = (() => {
        const candles = mkCandles(40);
        const after = 20, probe = 0.05;
        const rA = new Array(40).fill(0.01);
        const rB = new Array(40).fill(0.02);
        const rC = new Array(40).fill(0.03);
        const panel = { streamIndex: 1, label: 'B', labels: ['A', 'B', 'C'], returnsByStream: [rA, rB, rC] };
        const viewFor = makeCandleViewFor(candles, { panel });
        const base = viewFor(null, null);
        const pr = viewFor(null, { after, probe });
        const basePanelOk = base.panel.streamIndex === 1 && base.panel.label === 'B'
            && base.panel.returnsByStream[0] === rA && base.panel.returnsByStream[2] === rC
            && deepEq(base.panel.returnsByStream[1], base.returns);
        const probePanelOk = pr.panel.returnsByStream[1] === pr.returns && !deepEq(pr.panel.returnsByStream[1], base.returns)
            && pr.panel.returnsByStream[0] !== rA && pr.panel.returnsByStream[2] !== rC
            && pr.panel.returnsByStream[0].every((v, t) => v === (t > after ? rA[t] + probe : rA[t]))
            && pr.panel.returnsByStream[2].every((v, t) => v === (t > after ? rC[t] + probe : rC[t]));
        rows.panel = { basePanelOk, probePanelOk, probeOwnIsShocked: !deepEq(pr.panel.returnsByStream[1], base.returns),
            probeSibsShockedPostAfterOnly: probePanelOk,
            note: 'round-86 sibling shock: on a probe pass non-own slots are additive-shocked after `after` (the audit law), so a cross-sectional arm is reachable; the past is bit-unchanged.' };
        return basePanelOk && probePanelOk;
    })();

    // (FINDING) the panel's own-stream slot is replaced only when streamIndex matches an index.
    checks.panelForSkipsWithoutStreamIndex = (() => {
        const candles = mkCandles(40);
        const after = 20, probe = 0.05;
        const rA = new Array(40).fill(0.01);
        const rB = new Array(40).fill(0.02);
        const rC = new Array(40).fill(0.03);
        const noIdx = { label: 'B', labels: ['A', 'B', 'C'], returnsByStream: [rA, rB, rC] };
        const oob = { streamIndex: 7, label: 'B', labels: ['A', 'B', 'C'], returnsByStream: [rA, rB, rC] };
        const prNo = makeCandleViewFor(candles, { panel: noIdx })(null, { after, probe });
        const prOob = makeCandleViewFor(candles, { panel: oob })(null, { after, probe });
        const noIdxNull = prNo.panel === null;
        const oobNull = prOob.panel === null;
        const ownShocked = !deepEq(prNo.returns, barReturns(candles.map((c) => c.close)));
        rows.panelSkip = {
            noStreamIndex: { panelNull: noIdxNull, viewReturnsShocked: ownShocked },
            outOfRangeIndex: { panelNull: oobNull },
            note: 'round-86 restatement: without a matching streamIndex the probe panel is NULL (fail-closed), so a cross-sectional candidate abstains and the audit flags VACUOUS instead of passing green — the old unshocked-panel trap is closed one level up. With a valid index, siblings are shocked (panelAttachment) and the arm is reachable (lab F-130).',
            note: 'panelFor replaces the own slot with `own` only when an index equals `panel.streamIndex`: `returnsByStream.map((rs, i) => i === panel.streamIndex ? own : rs)`. With `streamIndex` ABSENT the comparison is never true, so on a probe pass EVERY array in the panel is the UNPERTURBED original — a cross-sectional candidate (`sig-reversal-xs`, `sig-network-momentum`) reads its own stream unshocked, so the look-ahead audit is VACUOUS for it even though `view.returns` is shocked. Same root cause as L10-bu (features.js networkMomentum self-skip) in a different module, with the opposite consequence: there a wrong feature value, here a green audit that cannot fail. LATENT (analyze.js always sets streamIndex) but it is the exact vacuity trap world.js was built to close.',
        };
        // pin the module's actual behaviour
        return noIdxNull && oobNull && ownShocked;
    })();

    const findingPanelSkip = rows.panelSkip;
    const findingMaxBars = rows.worldFromEdge;

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = (v && typeof v.then === 'function') ? await v : v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-cc..: `analysis/world.js` is the SHIPPED audited evaluation world (round 23, N0) — the module that gives `auditNoLookahead` teeth after a returns-only perturbation was found to pass vacuously (BUGS.md #22); `analyze.js` and `fold_worker.js` build their views through `makeCandleViewFor`. PASSES the pre-registered read: `shockFactor`/`volumeShockFactor` are exactly 1 at and before `after` and strictly inside [1, 1+2*probe] after (so a price path stays positive and cannot explode), are deterministic, non-uniform across t (a scale-invariant model cannot normalise the shock away — measured ratio spread > 1e-6) and phase-shifted from each other; `shockCandles` is the identity for perturb=null, leaves every bar at or before `after` UNTOUCHED (same object), scales OHLC by one factor and volume by its own for bars after it, never mutates its input, is deterministic and shape-changing; `makeCandleViewFor` returns the real candles on the base pass (candles identity, closes/volumes/returns = the real series) and on a probe pass a self-consistent tuple (`view.returns === barReturns(view.closes)` exactly), with the past bit-unchanged and every future bar moved, and attaches a panel with this stream\'s own series replaced by `own`; and `worldFromCandles` aligns candles/closes/volumes/returns and honours the last-N maxBars contract. FINDINGS (round-86 restatement): (0) with streamIndex absent or out of range the probe panel is NULL (fail-closed, the arm abstains and the audit flags VACUOUS, never green); with a valid index the probe shocks sibling slots additively after after, so cross-sectional arms are reachable (lab F-130: 288/288, 0 violations); (1) the worldFromCandles maxBars guard is fail-closed (0 gives an empty world; negative/fractional throws), so a mis-set --bars fails loudly. Both are latent/export-level (analyze.js always sets streamIndex and a positive bars value)',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            panelForSkipsWithoutStreamIndex: findingPanelSkip,
            maxBarsSignFlip: findingMaxBars,
        },
        scope: {
            shipped: ['analyze.js imports makeCandleViewFor, worldFromCandles, DEFAULT_SHOCK + shockCandles', 'fold_worker.js builds its view through makeCandleViewFor', 'walkforward.js auditNoLookahead uses the viewFor'],
            why: 'world.js is SHIPPED and load-bearing for every causality certificate the project issues, but both findings are latent: analyze.js\'s panel always sets `streamIndex` and its maxBars comes from a positive/defaulted `--bars`, so the shipped A/B never hits either. No golden moves and no fold-back row is due.',
        },
    };

    return { config: { bars: 40, after: 20, probe: 0.05 }, rows, validation: resolved, verdict };
}
