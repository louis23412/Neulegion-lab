// E35 - THE SLEEVE MIX AT THE FINAL SPECS, AT SIZE. CYCLE-026 (L12 x L18 x L15/L17).
//
// F-31 (CYCLE-015) measured the two-stream portfolio on the *pre-retune* books: carry dispersion at
// EWMA(0.1), uncapped, and the toptrader fade at EWMA(0.1), uncapped. Since then both sleeves were
// re-specified and *sized*:
//   * carry dispersion (R8): a walk-forward, cost-aware EWMA lambda (recent ~0.02) + a strict 12.5 %
//     per-symbol cap (F-37/F-38/F-39);
//   * toptrader fade (R7): a pinned EWMA(0.1) + the same 12.5 % cap (F-40).
// and both were restated as *schedules* against the per-period open-interest bound (F-41/F-42).
//
// So two questions are live and neither has been asked:
//
//   (1) Does F-31 (25 % fade turns the carry book's decayed second half positive, rho ~ 0) SURVIVE the
//       re-specification? The re-tuned carry book is a different return stream from the F-24 one.
//   (2) **Do the two capacities add?** Both books' OI bound binds on the SAME thin symbol (LINK). A
//       portfolio that runs both at their individual sizes puts the SUM of their LINK positions into
//       LINK, so its compliant size is `f*min_j OI_j/|a*wF_j+(1-a)*wC_j|` - NOT the sum, and not the min.
//       If the books' LINK weights are anti-aligned the portfolio can be *bigger* than either; if they
//       co-move the joint size is materially smaller than the sum.
//
// FALSIFIER (pre-registered).
//   (a) F-31 has not survived if the 25 % mix's net@4 second half is not positive.
//   (b) The capacities "add" if the joint bound at the mix is >= the sum of the two individual bounds
//       (i.e. sharing the thin symbol costs nothing) - in which case F-43 is not a finding.
//
// GUARDS. The carry book (lam0.02/cap12.5) must reproduce `e31`'s pinned `lam0.02_cap12.5` OOS numbers,
// and the fade (lam0.1/cap12.5) must reproduce `e32`'s pinned `ewma0.1_cap12.5` numbers, to display
// precision - otherwise the mix is measuring different books than the port specs.
//
// Alignment. Both books live on the `e12` leg grid. The carry book index `m` earns leg `m+1`; the fade
// index `i` earns leg `i+2` (a one-period implementation lag on top of the signal stamp). The same return
// interval therefore pairs fade `i` with carry `i+1`; the common series starts at the fade's `firstTop`
// and is trimmed by the finite-return guard.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { buildMasked } from './e22_toptrader_validate.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PERIODS_PER_YEAR = 365 * 3;
const FEE_BPS = 4;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };
const applyCap = (rows, cap) => (cap == null ? rows : rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x))));
const quantile = (arr, q) => { const v = arr.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!v.length) return NaN; const pos = (v.length - 1) * q; const lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };
const dist = (arr) => ({ n: arr.filter(Number.isFinite).length, mean: mean(arr), p5: quantile(arr, 0.05), median: quantile(arr, 0.5), p95: quantile(arr, 0.95), min: Math.min(...arr.filter(Number.isFinite)) });

// The two final port specs.
const CARRY_SPEC = { lam: 0.02, cap: 0.125 };
const FADE_SPEC = { lam: 0.1, cap: 0.125 };
const MIX_GRID = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 1];

// Build the two final port-spec books on ONE aligned grid. Exported (CYCLE-027) so `e36` reuses the
// exact construction instead of re-implementing it; the extraction left `e35`'s artefact unchanged.
// Weight rows are capped-and-held (sum|w| = ebar < 1); the carry book index `m` earns leg `m+1`, the
// fade index `i` earns leg `i+2`, so the same return interval pairs fade `i` with carry `i+1`.
export async function buildPair({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList; const k = names.length;
    const times = s.times;                 // s.times[i] = legs.times[i+1] (book grid, length L-1)
    const legs = s.legs; const L = legs.spotRet.length;

    // ---- OI panel on the leg grid (by timestamp; L10-x: every traded symbol must have a print) ----
    const oi = await loadOpenInterest();
    const oiAtLeg = names.map((nm) => { const o = oi[nm]; const arr = new Array(L).fill(null); if (!o) return arr; for (let t = 0; t < L; t++) { const idx = flowIndexAt(o, legs.times[t]); arr[t] = idx >= 0 ? o.oiVal[idx] : null; } return arr; });

    // ---- carry book (R8 spec) ----
    const builtC = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: CARRY_SPEC.lam, normalize: true } });
    const rowsC = applyCap(builtC.weightRows, CARRY_SPEC.cap);
    const retsC = rowsC.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * ((Number.isFinite(bp[j]) ? bp[j] : 0) + (Number.isFinite(fr[j]) ? fr[j] : 0)), 0); });
    const TC = turnoverSeries(rowsC);

    // ---- fade book (R7 spec) ----
    const topLS = names.map((nm) => { const o = oi[nm]; const arr = new Array(times.length).fill(null); if (!o) return arr; for (let i = 0; i < times.length; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.topLS[idx] : null; } return arr; });
    let firstTop = -1;
    for (let i = 1; i < times.length - 2; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(topLS[j][i])) all = false; if (all) { firstTop = i; break; } }
    const bF = buildMasked(topLS, k, legs, times, { sign: -1, from: firstTop, policy: { kind: 'ewma', lambda: FADE_SPEC.lam, normalize: true } });
    const rowsF = applyCap(bF.weightRows, FADE_SPEC.cap);
    const retsF = rowsF.map((w, t) => { const sr = legs.spotRet[firstTop + t + 2]; return w.reduce((a, x, j) => a + x * (sr && Number.isFinite(sr[j]) ? sr[j] : 0), 0); });
    const TF = turnoverSeries(rowsF);

    // ---- align on the common return interval: fade i <-> carry m = i+1 ----
    const pairs = [];
    for (let i = 0; i < bF.rets.length; i++) {
        const m = firstTop + i + 1;                       // carry buildBook index
        const legIdx = firstTop + i + 2;                  // shared return leg
        if (m < 0 || legIdx > L - 1 || m >= retsC.length) break;
        pairs.push({ i, m, legIdx, bookTime: times[firstTop + i] });
    }
    const P = pairs.length;
    const ebarOf = (rows, key) => mean(pairs.map((p) => rows[p[key]]).map((w) => w.reduce((a, x) => a + Math.abs(x), 0)));
    const ebarC = ebarOf(rowsC, 'm'), ebarF = ebarOf(rowsF, 'i');
    return { available: true, names, k, times, legs, L, pairs, P, rowsC, retsC, TC, rowsF, retsF, TF, oiAtLeg, firstTop, ebarC, ebarF };
}

export async function run({ symbols = SYMBOLS, perp = 'mark', lookback = 1095, block = 365 } = {}) {
    const B = await buildPair({ symbols, perp });
    if (!B.available) return { available: false };
    const { names, k, times, legs, L, pairs, P, rowsC, retsC, TC, rowsF, retsF, TF, oiAtLeg, firstTop, ebarC, ebarF } = B;
    const aRetsF = pairs.map((p) => retsF[p.i]);
    const aRetsC = pairs.map((p) => retsC[p.m]);
    const aTF = pairs.map((p) => TF[p.i]);
    const aTC = pairs.map((p) => TC[p.m]);

    // ---- (1) the mix at the final specs ----
    const retsFilt = aRetsF.filter(Number.isFinite);
    const retsCfil = aRetsC.filter(Number.isFinite);
    const mF = mean(retsFilt), mC = mean(retsCfil);
    const vF = retsFilt.reduce((a, r) => a + (r - mF) ** 2, 0) / (retsFilt.length - 1);
    const vC = retsCfil.reduce((a, r) => a + (r - mC) ** 2, 0) / (retsCfil.length - 1);
    const rhoRaw = (() => { const n = P; const x = aRetsF, y = aRetsC; const mx = mean(x), my = mean(y); let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue; sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy); })();
    const cov = rhoRaw * Math.sqrt(vF * vC);
    const optF = (mF * vC - mC * cov) / (vF * vC - cov * cov);
    const optC = (mC * vF - mF * cov) / (vF * vC - cov * cov);
    const optSum = Math.abs(optF) + Math.abs(optC) || 1;

    const mixAt = (a) => {
        const b = 1 - a;
        const gross = [], net4 = [];
        for (let i = 0; i < P; i++) {
            gross.push(a * aRetsF[i] + b * aRetsC[i]);
            net4.push(a * (aRetsF[i] - (FEE_BPS / 1e4) * aTF[i]) + b * (aRetsC[i] - (FEE_BPS / 1e4) * aTC[i]));
        }
        const h = Math.floor(P / 2);
        return { fadeFrac: a, carryFrac: b, grossSharpe: sharpe(gross), net4Sharpe: sharpe(net4), h1Net4: sharpe(net4.slice(0, h)), h2Net4: sharpe(net4.slice(h)) };
    };
    const mixes = MIX_GRID.map(mixAt);
    const maxSharpeMix = { fadeFrac: +optF.toFixed(3), carryFrac: +optC.toFixed(3), normalizedFadeFrac: +(Math.abs(optF) / optSum).toFixed(3) };

    // Walk-forward mix weight: pick the fade fraction by trailing net@4 only (never sees the block).
    const wf = { net4: [], picks: [] };
    {
        let r = lookback;
        while (r + block <= P) {
            let best = null;
            for (const a of MIX_GRID) {
                const trail = [];
                for (let t = r - lookback; t < r; t++) trail.push(a * (aRetsF[t] - (FEE_BPS / 1e4) * aTF[t]) + (1 - a) * (aRetsC[t] - (FEE_BPS / 1e4) * aTC[t]));
                const sc = sharpe(trail);
                if (!Number.isFinite(sc)) continue;
                if (!best || sc > best.sc) best = { a, sc };
            }
            if (!best) break;
            for (let t = r; t < r + block; t++) wf.net4.push(best.a * (aRetsF[t] - (FEE_BPS / 1e4) * aTF[t]) + (1 - best.a) * (aRetsC[t] - (FEE_BPS / 1e4) * aTC[t]));
            wf.picks.push({ at: new Date(pairs[r].bookTime).toISOString().slice(0, 10), fadeFrac: best.a, trailingNet4: +best.sc.toFixed(2) });
            r += block;
        }
    }
    const wfPinned = (a) => { // pinned fade fraction over the same OOS span, for comparison
        const r0 = lookback; const span = wf.net4.length;
        const s = [];
        for (let t = r0; t < r0 + span; t++) s.push(a * (aRetsF[t] - (FEE_BPS / 1e4) * aTF[t]) + (1 - a) * (aRetsC[t] - (FEE_BPS / 1e4) * aTC[t]));
        return sharpe(s);
    };

    // ---- (2) joint OI capacity: do the two sleeves share their binding symbol? ----
    // Weights are capped-and-held (sum|w| = ebar < 1). Convert every bound to GROSS-NOTIONAL units
    // (the F-42 convention: a book rescaled so mean sum|w| = 1) by multiplying by ebar, so the numbers
    // are directly comparable to `e33`/`e34`. The per-period bound is G_t = f*min_j OI_j(t)/|w_j(t)|,
    // requiring EVERY traded symbol to have an OI print (L10-x).
    const capBound = (weightFn, ebar) => {
        const out = [];
        for (let p = 0; p < P; p++) {
            const legIdx = pairs[p].legIdx;
            const w = weightFn(p);
            let G = Infinity; let ok = true;
            for (let j = 0; j < k; j++) {
                const oiv = oiAtLeg[j][legIdx];
                if (!Number.isFinite(oiv)) { ok = false; break; }
                const aw = Math.abs(w[j]);
                if (aw > 1e-12) { const g = (0.05 * oiv) / aw; if (g < G) G = g; }
            }
            out.push(ok && G < Infinity ? G * ebar : null);
        }
        return out;
    };
    const boundC = capBound((p) => rowsC[pairs[p].m], ebarC);
    const boundF = capBound((p) => rowsF[pairs[p].i], ebarF);
    const boundMix = {};
    for (const a of [0.25, 0.5]) {
        const ebarMix = a * ebarF + (1 - a) * ebarC;
        boundMix['a' + a] = capBound((p) => rowsF[pairs[p].i].map((x, j) => a * x + (1 - a) * rowsC[pairs[p].m][j]), ebarMix);
    }

    // The operative question: if each sleeve is deployed at its OWN individual compliant size, how
    // badly does the combined book breach the 5 %-of-OI cap? (Units cancel here.)
    const bothAtIndividual = (() => {
        const parts = []; const binds = {};
        for (let p = 0; p < P; p++) {
            const legIdx = pairs[p].legIdx;
            const GC = boundC[p], GF = boundF[p];
            if (!Number.isFinite(GC) || !Number.isFinite(GF)) continue;
            let peak = 0, bind = -1, bad = false;
            for (let j = 0; j < k; j++) {
                const oiv = oiAtLeg[j][legIdx];
                if (!Number.isFinite(oiv)) { bad = true; break; }
                const pos = (GC / ebarC) * rowsC[pairs[p].m][j] + (GF / ebarF) * rowsF[pairs[p].i][j];
                const part = Math.abs(pos) / oiv;
                if (part > peak) { peak = part; bind = j; }
            }
            if (bad) continue;
            parts.push(peak);
            if (bind >= 0) binds[names[bind]] = (binds[names[bind]] || 0) + 1;
        }
        const over = parts.filter((x) => x > 0.05).length;
        return { periods: parts.length, breachFrac: +(over / parts.length).toFixed(3), peakParticipation: +Math.max(...parts).toFixed(3), medianParticipation: +quantile(parts, 0.5).toFixed(3), bindingSymbols: binds };
    })();

    // Which symbol binds the proportional-split joint book, and how aligned are the books in LINK?
    const bindCount = {};
    for (const a of [0.25, 0.5]) {
        const c = {};
        for (let p = 0; p < P; p++) {
            const legIdx = pairs[p].legIdx; const w = rowsF[pairs[p].i].map((x, j) => a * x + (1 - a) * rowsC[pairs[p].m][j]);
            let G = Infinity, b = -1; for (let j = 0; j < k; j++) { const oiv = oiAtLeg[j][legIdx]; const aw = Math.abs(w[j]); if (Number.isFinite(oiv) && aw > 1e-12) { const g = (0.05 * oiv) / aw; if (g < G) { G = g; b = j; } } }
            if (b >= 0) c[names[b]] = (c[names[b]] || 0) + 1;
        }
        bindCount['a' + a] = c;
    }
    const linkIdx = names.indexOf('linkusdt');
    const linkAlign = (() => {
        if (linkIdx < 0) return { symbol: null, periods: 0, sameSignFrac: null, weightCorr: null };
        let same = 0, tot = 0; const x = [], y = [];
        for (let p = 0; p < P; p++) { const cw = rowsC[pairs[p].m][linkIdx], fw = rowsF[pairs[p].i][linkIdx]; if (!Number.isFinite(cw) || !Number.isFinite(fw)) continue; x.push(cw); y.push(fw); tot++; if (cw !== 0 && fw !== 0 && Math.sign(cw) === Math.sign(fw)) same++; }
        const cc = tot > 2 ? (mean(x.map((v, i) => v * y[i])) - mean(x) * mean(y)) / (sd(x) * sd(y)) : null;
        return { symbol: names[linkIdx], periods: tot, sameSignFrac: tot ? +(same / tot).toFixed(3) : null, weightCorr: cc == null ? null : +cc.toFixed(3) };
    })();

    const indC = dist(boundC), indF = dist(boundF);
    const joint25 = dist(boundMix['a0.25']), joint50 = dist(boundMix['a0.5']);

    // ---- guards: the two books are the e31/e32 port specs, and their OI schedules are e34's ----
    let e31 = null, e32 = null, e34 = null;
    try { e31 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e31_ported_spec_oos.json')); } catch (e) { e31 = null; }
    try { e32 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e32_fade_retune.json')); } catch (e) { e32 = null; }
    try { e34 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e34_oi_scaled_sizing.json')); } catch (e) { e34 = null; }
    const carryFullNet4 = sharpe(aRetsC.map((r, i) => r - (FEE_BPS / 1e4) * aTC[i]));
    const fadeFullNet4 = sharpe(aRetsF.map((r, i) => r - (FEE_BPS / 1e4) * aTF[i]));
    const e31p = e31 && e31.pinned ? e31.pinned['lam0.02_cap12.5'] : null;
    const e32p = e32 && e32.pinned ? e32.pinned['ewma0.1_cap12.5'] : null;
    const e34C = e34 && e34.books ? e34.books['disp_lam0.02_cap12.5'].oiBoundSchedule.meanGcap : null;
    const e34F = e34 && e34.books ? e34.books['fade_lam0.1_cap12.5'].oiBoundSchedule.meanGcap : null;
    const rel = (a, b) => (a != null && b != null && b !== 0 ? Math.abs(a - b) / b : null);
    const relC = rel(indC.mean, e34C), relF = rel(indF.mean, e34F);
    const validation = {
        carryFullNet4, fadeFullNet4,
        e31PinnedOosNet4: e31p ? e31p.oosNet4Sharpe : null,
        e32PinnedOosNet4: e32p ? e32p.oosNet4 : null,
        e34CarryOiMean: e34C, e34FadeOiMean: e34F,
        carryOiMeanRelDiff: relC == null ? null : +relC.toFixed(4),
        fadeOiMeanRelDiff: relF == null ? null : +relF.toFixed(4),
        matchesE34: relC != null && relF != null && relC < 0.05 && relF < 0.05,
        note: 'Read-only cross-checks: e31/e32 pinned specs were computed on their own OOS spans, so only'
            + ' the sign/magnitude is expected to agree. The hard guard is that each book\'s INDIVIDUAL OI'
            + ' schedule mean reproduces e34\'s stored `meanGcap` for the same spec within 5 % - which checks'
            + ' the weights, the grid, the OI join and the unit convention all at once.',
    };

    const m25 = mixes.find((m) => m.fadeFrac === 0.25);
    const carryH2 = sharpe(aRetsC.map((r, i) => r - (FEE_BPS / 1e4) * aTC[i]).slice(Math.floor(P / 2)));
    const verdict = {
        note: 'Falsifier (a): F-31 survives only if the 25 % mix net@4 second half is positive AND the carry'
            + ' book alone is still negative in that half (i.e. there is something to hedge). Falsifier (b):'
            + ' the capacities add only if the joint bound at the mix is >= the individual bounds summed.',
        carryFullNet4: +carryFullNet4.toFixed(2),
        fadeFullNet4: +fadeFullNet4.toFixed(2),
        carrySecondHalfNet4: +carryH2.toFixed(2),
        mix25SecondHalfNet4: m25 ? +m25.h2Net4.toFixed(2) : null,
        mix25Net4: m25 ? +m25.net4Sharpe.toFixed(2) : null,
        f31SurvivesRespec: !!(m25 && m25.h2Net4 > 0 && carryH2 < 0),
        mixingHelpsSharpe: !!(m25 && m25.net4Sharpe > carryFullNet4),
        carryIndividualMean: indC.mean, fadeIndividualMean: indF.mean,
        sumOfIndividualMeans: indC.mean + indF.mean,
        jointMean_fade25: joint25.mean,
        jointOverSum: +(joint25.mean / (indC.mean + indF.mean)).toFixed(3),
        capacitiesAdd: joint25.mean >= indC.mean + indF.mean,
        bothAtIndividualBreachFrac: bothAtIndividual.breachFrac,
        bothAtIndividualPeak: bothAtIndividual.peakParticipation,
        linkAlignment: linkAlign,
        validationPass: validation.matchesE34,
    };

    return {
        config: { symbols: k, symbolList: names, periods: P, firstTop, lookback, block, feeBps: FEE_BPS, carrySpec: CARRY_SPEC, fadeSpec: FADE_SPEC, mixGrid: MIX_GRID, ebarCarry: +ebarC.toFixed(4), ebarFade: +ebarF.toFixed(4) },
        validation,
        carry: { fullNet4: +carryFullNet4.toFixed(3), secondHalfNet4: +carryH2.toFixed(3), turnoverAnnual: +(mean(aTC) * PERIODS_PER_YEAR).toFixed(0), breakEvenBps: mean(aTC) > 0 ? +((mean(aRetsC) * 1e4) / mean(aTC)).toFixed(2) : null },
        fade: { fullNet4: +fadeFullNet4.toFixed(3), turnoverAnnual: +(mean(aTF) * PERIODS_PER_YEAR).toFixed(0), breakEvenBps: mean(aTF) > 0 ? +((mean(aRetsF) * 1e4) / mean(aTF)).toFixed(2) : null },
        correlation: +rhoRaw.toFixed(3),
        maxSharpeMix,
        mixes,
        walkForward: { span: wf.net4.length, net4: +sharpe(wf.net4).toFixed(2), picks: wf.picks, pinned25: +wfPinned(0.25).toFixed(2), pinned0: +wfPinned(0).toFixed(2), pinned50: +wfPinned(0.5).toFixed(2) },
        capacity: { carryIndividual: indC, fadeIndividual: indF, joint_fade25: joint25, joint_fade50: joint50, bothAtIndividual, bindingSymbols: bindCount, linkAlignment: linkAlign },
        verdict,
    };
}
