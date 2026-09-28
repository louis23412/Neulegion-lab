// E47 - IS THE "FROZEN λ MATCHES THE PINNED BOOK" CONCLUSION SPLIT-POINT ROBUST? CYCLE-038 (L12 x L16).
//
// F-49 and F-50 rest on a **five-point** split ladder (S = 1095 / 1825 / 2555 / 3285 / 4380): a λ frozen on
// `[0, S)` matches the walk-forward, and the joint (λ, cap) rule loses to the pinned book. Five hand-picked
// split points is exactly the kind of choice a reviewer would challenge, so this experiment replaces the
// hand-picked ladder with a **dense grid** of split points and asks whether the conclusion survives.
//
// For each split S (every 365 periods), on the R8 λ=0.02 rank-funding family *with the structural 12.5 %
// cap* (the F-50 final spec):
//   * `frozen(S)`  = the λ with the best trailing net@4 on `[S-3y, S)`, scored net@4 on `[S, end)`;
//   * `pinned(S)`  = the fixed λ=0.02 (+cap) book, scored on `[S, end)`;
//   * `bestFull(S)`= the λ with the best FULL-history net@4 (the in-sample-best book), scored on `[S, end)`.
// The same is done for the uncapped family (the F-49 setting) for contrast.
//
// PRE-REGISTERED READ. F-49/F-50's "a frozen λ on ≥ ~2–3 y matches the pinned book" is ROBUST if, over the
// dense split grid, `frozen(S)` is within 0.2 net@4 of `bestFull(S)` at **>= 80 %** of splits and its median
// gap is >= −0.2. The "the λ choice barely matters" corollary (F-49) is ROBUST if the picked λ is one of the
// slow scales (<= 0.05) at a strong majority of splits.
//
// GUARD. The capped λ=0.02 book must reproduce e30#ewma_0.02_norm_cap12.5 (full net@4 6.18, turnover 10,
// break-even 46.04, OI@5% $35,937,181), and the uncapped λ=0.02 e30#ewma_0.02_norm (4.92 / 17 / 39.63 /
// $20,415,294).

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const F_PART = 0.05;
const CAP = 0.125;
const TRAIN = 1095; // 3 years of trailing data for the freeze
const LAMBDAS = [0.005, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1];

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sdOf = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sdOf(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const applyCap = (rows, cap) => (cap == null ? rows : rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x))));

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const names = s.config.symbolList;
    const legs = s.legs;
    const bookTimes = legs.times.slice(1);
    const n = bookTimes.length;

    const oi = await loadOpenInterest();
    const oiValBySym = names.map((nm) => { const o = oi[nm]; if (!o) return null; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, bookTimes[i]); arr[i] = idx >= 0 ? o.oiVal[idx] : null; } return arr; });
    const oiMean = names.map((_, j) => { const v = oiValBySym[j] ? oiValBySym[j].filter((x) => x > 0) : []; return v.length ? mean(v) : NaN; });

    const retsFor = (rows) => rows.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * (fin(bp[j]) + fin(fr[j])), 0); });
    const build = (lam, cap) => { const b = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: lam, normalize: true } }); const rows = applyCap(b.weightRows, cap); const T = turnoverSeries(rows); const rets = cap == null ? b.rets : retsFor(rows); const net4 = rets.map((r, i) => r - (FEE_BPS / 1e4) * T[i]); return { lam, cap, rets, T, net4, rows }; };
    const fullStats = (bk) => { const meanAbsW = names.map((_, j) => mean(bk.rows.map((w) => Math.abs(w[j])))); let G5 = Infinity; for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && oiMean[j] > 0) G5 = Math.min(G5, (F_PART * oiMean[j]) / meanAbsW[j]); return { net4Sharpe: r2(sharpe(bk.net4)), turnoverAnnual: Math.round(mean(bk.T) * PPY), breakEvenBps: mean(bk.T) > 0 ? r2((mean(bk.rets) * 1e4) / mean(bk.T)) : null, oi5: Number.isFinite(G5) ? Math.round(G5) : null }; };

    const capped = {}; const uncapped = {};
    for (const lam of LAMBDAS) { capped[lam] = build(lam, CAP); uncapped[lam] = build(lam, null); }

    // guard
    let e30 = null;
    try { e30 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e30_retuned_capacity.json')); } catch (e) { e30 = null; }
    const g1 = fullStats(capped[0.02]); const g0 = fullStats(uncapped[0.02]);
    const e30c = e30 && e30.books['ewma_0.02_norm_cap12.5']; const e30b = e30 && e30.books['ewma_0.02_norm'];
    const near = (a, b, t) => a != null && b != null && Math.abs(a - b) <= t;
    const validation = (e30c && e30b) ? {
        capped002: { e30Net4: e30c.windows.full.net4Sharpe, here: g1.net4Sharpe, e30Turnover: e30c.windows.full.turnoverAnnual, hereTurnover: g1.turnoverAnnual, e30BreakEven: e30c.windows.full.breakEvenBps, hereBreakEven: g1.breakEvenBps, e30Oi5: Math.round(e30c.oiPositionCapacity_at_5pct), hereOi5: g1.oi5 },
        uncapped002: { e30Net4: e30b.windows.full.net4Sharpe, here: g0.net4Sharpe, e30Turnover: e30b.windows.full.turnoverAnnual, hereTurnover: g0.turnoverAnnual, e30Oi5: Math.round(e30b.oiPositionCapacity_at_5pct), hereOi5: g0.oi5 },
        matchesE30: near(g1.net4Sharpe, e30c.windows.full.net4Sharpe, 0.02) && near(g1.turnoverAnnual, e30c.windows.full.turnoverAnnual, 1) && near(g1.breakEvenBps, e30c.windows.full.breakEvenBps, 0.05) && near(g1.oi5, Math.round(e30c.oiPositionCapacity_at_5pct), 1)
            && near(g0.net4Sharpe, e30b.windows.full.net4Sharpe, 0.02) && near(g0.turnoverAnnual, e30b.windows.full.turnoverAnnual, 1) && near(g0.oi5, Math.round(e30b.oiPositionCapacity_at_5pct), 1),
        note: 'the capped and uncapped λ=0.02 books must reproduce e30 exactly.',
    } : null;

    // the five-point reference ladder (F-49/F-50's splits) vs a dense grid
    const handPicked = [1095, 1825, 2555, 3285, 4380];
    const dense = []; for (let S = TRAIN; S + 365 <= n; S += 365) dense.push(S);

    const runGrid = (family, splits) => splits.map((S) => {
        const pickOn = (a, b) => { let best = null; for (const lam of LAMBDAS) { const sc = sharpe(family[lam].net4.slice(a, b)); if (!Number.isFinite(sc)) continue; if (!best || sc > best.sc) best = { lam, sc }; } return best; };
        const pickRoll = pickOn(S - TRAIN, S);      // rolling 1-year trailing freeze
        const pickExp = pickOn(0, S);               // expanding [0,S) freeze (F-49's construction)
        const oos = (bk) => sharpe(bk.net4.slice(S, n));
        // in-sample-best pinned book (best FULL-history net@4)
        let bestFullLam = LAMBDAS[0]; let bestFullSc = -Infinity;
        for (const lam of LAMBDAS) { const fs = sharpe(family[lam].net4); if (fs > bestFullSc) { bestFullSc = fs; bestFullLam = lam; } }
        const frozenRoll = pickRoll ? oos(family[pickRoll.lam]) : null;
        const frozenExp = pickExp ? oos(family[pickExp.lam]) : null;
        const pinned = oos(family[0.02]);
        const bestFull = oos(family[bestFullLam]);
        return {
            S, start: new Date(bookTimes[S]).toISOString().slice(0, 10), pinnedNet4: r2(pinned), bestFullLambda: bestFullLam, bestFullNet4: r2(bestFull),
            rollLambda: pickRoll ? pickRoll.lam : null, rollNet4: r2(frozenRoll), rollMinusBestFull: r2((frozenRoll ?? NaN) - (bestFull ?? NaN)),
            expLambda: pickExp ? pickExp.lam : null, expNet4: r2(frozenExp), expMinusBestFull: r2((frozenExp ?? NaN) - (bestFull ?? NaN)),
        };
    });

    const quantile = (arr, q) => { const v = arr.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!v.length) return NaN; const pos = (v.length - 1) * q; const lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };
    const summarise = (rows, mode) => {
        const gapKey = mode === 'roll' ? 'rollMinusBestFull' : 'expMinusBestFull';
        const lamKey = mode === 'roll' ? 'rollLambda' : 'expLambda';
        const gaps = rows.map((x) => x[gapKey]).filter(Number.isFinite);
        const within = gaps.filter((g) => g >= -0.2).length;
        const slowPicks = rows.filter((x) => x[lamKey] != null && x[lamKey] <= 0.05).length;
        const picks = {}; rows.forEach((x) => { if (x[lamKey] != null) picks[x[lamKey]] = (picks[x[lamKey]] || 0) + 1; });
        const fails = rows.filter((x) => Number.isFinite(x[gapKey]) && x[gapKey] < -0.2).map((x) => ({ S: x.S, pick: x[lamKey], gap: x[gapKey] }));
        return { n: rows.length, medianGapVsBestFull: r2(quantile(gaps, 0.5)), fractionsWithin0p2: rows.length ? r2(within / rows.length) : null, slowPickShare: rows.length ? r2(slowPicks / rows.length) : null, picks, failingSplits: fails };
    };

    const cappedHand = runGrid(capped, handPicked); const cappedDense = runGrid(capped, dense);
    const uncappedHand = runGrid(uncapped, handPicked); const uncappedDense = runGrid(uncapped, dense);
    const sCappedRoll = summarise(cappedDense, 'roll'); const sCappedExp = summarise(cappedDense, 'exp');
    const sUncappedRoll = summarise(uncappedDense, 'roll'); const sUncappedExp = summarise(uncappedDense, 'exp');

    const verdict = {
        note: 'Split-point robustness of F-49/F-50, over a DENSE split grid, for two freeze constructions: a rolling 1-year trailing window and the expanding [0,S) window. ROBUST if the frozen λ is within 0.2 of the in-sample-best pinned book at >= 80 % of splits.',
        denseSplits: dense.length, handPickedSplits: handPicked.length,
        cappedRoll_fractionsWithin0p2: sCappedRoll.fractionsWithin0p2, cappedRoll_medianGap: sCappedRoll.medianGapVsBestFull, cappedRoll_failingSplits: sCappedRoll.failingSplits,
        cappedExp_fractionsWithin0p2: sCappedExp.fractionsWithin0p2, cappedExp_medianGap: sCappedExp.medianGapVsBestFull, cappedExp_failingSplits: sCappedExp.failingSplits,
        uncappedRoll_fractionsWithin0p2: sUncappedRoll.fractionsWithin0p2, uncappedRoll_medianGap: sUncappedRoll.medianGapVsBestFull,
        uncappedExp_fractionsWithin0p2: sUncappedExp.fractionsWithin0p2, uncappedExp_medianGap: sUncappedExp.medianGapVsBestFull,
        cappedExpPicks: sCappedExp.picks, cappedRollPicks: sCappedRoll.picks,
        robustCappedRoll: sCappedRoll.fractionsWithin0p2 != null && sCappedRoll.fractionsWithin0p2 >= 0.8,
        robustCappedExp: sCappedExp.fractionsWithin0p2 != null && sCappedExp.fractionsWithin0p2 >= 0.8,
        robustUncappedExp: sUncappedExp.fractionsWithin0p2 != null && sUncappedExp.fractionsWithin0p2 >= 0.8,
        validationPass: validation ? validation.matchesE30 : null,
    };

    return {
        config: { symbols: k, symbolList: names, periods: n, lambdas: LAMBDAS, cap: CAP, train: TRAIN, feeBps: FEE_BPS, f: F_PART },
        validation,
        cappedHand, cappedDense, uncappedHand, uncappedDense,
        summary: { cappedRoll: sCappedRoll, cappedExp: sCappedExp, uncappedRoll: sUncappedRoll, uncappedExp: sUncappedExp },
        verdict,
    };
}
