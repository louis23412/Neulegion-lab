// E41 - IS F-48'S "FIXED BLEND REPLACES THE λ RULE" ROBUST, OR DOES IT NEED HINDSIGHT? CYCLE-032 (tests F-48).
//
// F-48 (CYCLE-031) found that a fixed two-scale blend (λ = 0.01 + 0.02, equal capital) matches R8's
// walk-forward λ out of sample, so the port spec can drop the fitted selection rule. Two holes in that:
//   (1) only ONE of five pre-registered blends cleared the 0.2-Sharpe falsifier bar (pair0102); the others
//       were 0.55-0.89 below. So "a fixed blend matches" may be a statement about one hand-picked set —
//       i.e. hindsight among a menu.
//   (2) the pinned λ=0.02 is in-sample; a SINGLE λ chosen before the span has not been tested.
// This experiment closes both, on the same construction and the same shared OOS span as e40:
//
//   A. a FROZEN-λ ladder: for split points S, pick λ once on the data before S, freeze it, score [S, end).
//      Also fixed-length trailing trains ("how much history do you need"). Against a pinned λ=0.02.
//   B. a NO-HINDSIGHT BLEND MENU (9 pre-registered sets, annotated by which prior each needs) — count how
//      many clear the 0.2 bar. This measures the multiple-testing risk of the F-48 headline.
//   C. a BLEND-SELECTION WALK-FORWARD: pick the best blend SET each block by trailing net@4 and trade it.
//      If a forward-learnable blend selection reaches the λ rule, the simplification is choice-free.
//
// FALSIFIER / read (pre-registered). F-48's simplification is ROBUST if (i) at least one *no-hindsight*
// blend — a set whose membership follows only from prior findings (F-37's cost-aware slow range), not from
// OOS performance — clears the 0.2-Sharpe bar, AND (ii) the frozen-λ selection does not land on the
// F-37-broken fast λ on short trains. It is MENU-DEPENDENT (F-48 scoped down) if only the cherry-picked
// pair0102 clears the bar while the no-hindsight sets fail it.
//
// GUARDS. Rebuilds the whole λ family, so it must reproduce e40's stored numbers exactly: the λ-only
// walk-forward OOS (6.63), the pinned λ=0.02 OOS (6.86) and the pair0102 blend OOS (6.66). Absolute 0.01
// (e40/e31 store Sharpe to 2 dp — see L10-z). Also reproduces e30/e31 for the pinned full-history book.

import { SYMBOLS } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const CAP = 0.125;
const LAMBDAS = [0.005, 0.01, 0.02, 0.05, 0.1];
const LOOKBACK = 1095, BLOCK = 365;

// 9 pre-registered blends. `prior` names the earlier finding that justifies the membership (a *no-hindsight*
// set is one justified by F-37 alone, i.e. "the cost-aware slow range" — it never looks at OOS Sharpe).
const BLEND_SETS = {
    all5: { set: [0.005, 0.01, 0.02, 0.05, 0.1], prior: 'naive: blend the whole grid (includes the F-37-broken λ=0.1)' },
    slow4: { set: [0.005, 0.01, 0.02, 0.05], prior: 'no-hindsight: the cost-aware slow range (F-37), fast end dropped' },
    slow3: { set: [0.005, 0.01, 0.02], prior: 'no-hindsight: slow range minus the top' },
    mid3: { set: [0.01, 0.02, 0.05], prior: 'slow range minus the bottom' },
    p005_01: { set: [0.005, 0.01], prior: 'pair (slowest two)' },
    p005_02: { set: [0.005, 0.02], prior: 'pair' },
    p005_05: { set: [0.005, 0.05], prior: 'pair (widest)' },
    p01_02: { set: [0.01, 0.02], prior: 'pair — the F-48 winner (straddles F-38 recent λ≈0.02)' },
    p01_05: { set: [0.01, 0.05], prior: 'pair' },
    p02_05: { set: [0.02, 0.05], prior: 'pair' },
};
const NO_HINDSIGHT = ['slow4', 'slow3']; // membership follows from F-37 alone

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const applyCap = (rows, cap) => rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x)));
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const legs = s.legs;
    const n = legs.times.length - 1;
    const bookTimes = legs.times.slice(1);
    const pnlOf = (rows) => rows.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * ((Number.isFinite(bp[j]) ? bp[j] : 0) + (Number.isFinite(fr[j]) ? fr[j] : 0)), 0); });
    const net4Of = (rets, T) => rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i]);

    // ---- the λ family (rank funding, EWMA(λ), strict 12.5 % cap) ----
    const books = {};
    for (const lam of LAMBDAS) {
        const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: lam, normalize: true } });
        const rows = applyCap(built.weightRows, CAP);
        const rets = pnlOf(rows);
        const T = turnoverSeries(rows);
        books[lam] = { rows, rets, T, net4: net4Of(rets, T) };
    }

    // ---- fixed equal-capital blends ----
    const blendOf = (set) => {
        const rows = [];
        for (let t = 0; t < n; t++) { const w = new Array(k).fill(0); for (const lam of set) for (let j = 0; j < k; j++) w[j] += books[lam].rows[t][j] / set.length; rows.push(w); }
        const rets = pnlOf(rows); const T = turnoverSeries(rows);
        return { rets, T, net4: net4Of(rets, T) };
    };
    const blends = {}; for (const [name, def] of Object.entries(BLEND_SETS)) { const b = blendOf(def.set); blends[name] = { ...b, set: def.set, prior: def.prior }; }

    // ---- walk-forwards (block starts are multiples of BLOCK; the first is LOOKBACK) ----
    const blockStarts = []; { let r = LOOKBACK; while (r + BLOCK <= n) { blockStarts.push(r); r += BLOCK; } }
    const wfRun = (seriesByKey, keys) => {
        const net = [], gross = [], turn = [], picks = [];
        for (const r of blockStarts) {
            let best = null;
            for (const key of keys) { const sc = sharpe(seriesByKey[key].net4.slice(r - LOOKBACK, r)); if (!Number.isFinite(sc)) continue; if (!best || sc > best.sc) best = { key, sc }; }
            if (!best) break;
            const b = seriesByKey[best.key];
            for (let t = r; t < r + BLOCK; t++) { net.push(b.net4[t]); gross.push(b.rets[t]); turn.push(b.T[t]); }
            picks.push({ at: new Date(bookTimes[r]).toISOString().slice(0, 10), key: best.key, trailingNet4: r2(best.sc) });
        }
        return { net, gross, turn, picks };
    };
    const lamWf = wfRun(books, LAMBDAS);
    const blendWf = wfRun(blends, Object.keys(BLEND_SETS));

    // ---- per-split evaluation over a common test tail ----
    const end = blockStarts[blockStarts.length - 1] + BLOCK;
    const testTail = (series, S) => { const out = []; for (let t = S; t < end; t++) out.push(series[t]); return out; };
    const sc = (arr) => r2(sharpe(arr));

    // A. frozen-λ ladder: pick λ once on [0, S), freeze, score [S, end).
    const splits = [1095, 1825, 2555, 3285, 4380].filter((S) => S < end);
    const frozen = splits.map((S) => {
        const rows = LAMBDAS.map((lam) => ({ lam, train: sharpe(books[lam].net4.slice(0, S)) })).filter((x) => Number.isFinite(x.train));
        const best = rows.reduce((a, b) => (b.train > a.train ? b : a), rows[0]);
        const frozenNet4 = sc(testTail(books[best.lam].net4, S));
        const blendPick = Object.entries(blends).map(([nm, b]) => ({ nm, train: sharpe(b.net4.slice(0, S)) })).filter((x) => Number.isFinite(x.train)).reduce((a, b) => (b.train > a.train ? b : a));
        // walk-forward series is a flat list of BLOCK-sized blocks starting at LOOKBACK; slice by block index
        const lamWfSlice = sc(lamWf.net.slice(((S - LOOKBACK) / BLOCK) * BLOCK));
        const blendWfSlice = sc(blendWf.net.slice(((S - LOOKBACK) / BLOCK) * BLOCK));
        const pair0102Slice = sc(testTail(blends.p01_02.net4, S));
        const pinnedSlice = sc(testTail(books[0.02].net4, S));
        return { S, periods: end - S, frozenLambda: best.lam, frozenTrainNet4: r2(best.train), frozenNet4, frozenBlend: blendPick.nm, frozenBlendNet4: sc(testTail(blends[blendPick.nm].net4, S)), lambdaWfNet4: lamWfSlice, blendWfNet4: blendWfSlice, pair0102Net4: pair0102Slice, pinned0202Net4: pinnedSlice };
    });

    // A'. fixed-length trailing trains ending at S (how much history is needed?)
    const lens = [365, 730, 1095, 2190];
    const trailing = splits.map((S) => ({ S, byLen: lens.filter((L) => L <= S).map((L) => { const rows = LAMBDAS.map((lam) => ({ lam, train: sharpe(books[lam].net4.slice(S - L, S)) })).filter((x) => Number.isFinite(x.train)); const best = rows.reduce((a, b) => (b.train > a.train ? b : a), rows[0]); return { trainLen: L, lambda: best.lam, frozenNet4: sc(testTail(books[best.lam].net4, S)) }; }) }));

    // B. no-hindsight blend menu, on the full OOS span [LOOKBACK, end)
    const oosStart = LOOKBACK;
    const wfOos = sc(lamWf.net);
    const menu = Object.entries(blends).map(([nm, b]) => ({ name: nm, set: b.set, prior: b.prior, oosNet4: sc(testTail(b.net4, oosStart)), recent24mNet4: sc(b.net4.slice(end - 2 * PPY, end)), turnoverAnnual: +(mean(b.T.slice(oosStart, end)) * PPY).toFixed(0) }))
        .map((x) => ({ ...x, clears02: x.oosNet4 >= wfOos - 0.2 }));
    const clears = menu.filter((x) => x.clears02).map((x) => x.name);
    const noHindsightClears = menu.filter((x) => NO_HINDSIGHT.includes(x.name) && x.clears02).map((x) => x.name);

    // C. blend-selection walk-forward
    const blendWfOos = sc(blendWf.net), lamWfRecent = sc(lamWf.net.slice(lamWf.net.length - 2 * PPY));
    const blendWfRecent = sc(blendWf.net.slice(blendWf.net.length - 2 * PPY));
    const blendWfFreq = {}; for (const p of blendWf.picks) blendWfFreq[p.key] = (blendWfFreq[p.key] || 0) + 1;

    // full-history (in-sample) references
    const fullBestLambda = LAMBDAS.reduce((a, lam) => { const v = sharpe(books[lam].net4); return v > a.v ? { lam, v } : a; }, { lam: null, v: -Infinity });

    // ---- guards: reproduce e40 ----
    let e40 = null, e30 = null, e31 = null;
    try { e40 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e40_retune_blend.json')); } catch (e) { e40 = null; }
    try { e30 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e30_retuned_capacity.json')); } catch (e) { e30 = null; }
    try { e31 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e31_ported_spec_oos.json')); } catch (e) { e31 = null; }
    const e40Wf = e40 ? e40.walkForward.oosNet4 : null;
    const e40Pair = e40 && e40.blends && e40.blends.pair0102 ? e40.blends.pair0102.oosNet4 : null;
    const e40Pinned = e40 ? e40.pinned0202.oosNet4 : null;
    const e30W = e30 && e30.books && e30.books['ewma_0.02_norm_cap12.5'] ? e30.books['ewma_0.02_norm_cap12.5'].windows.full : null;
    const e31Oos = e31 && e31.pinned ? e31.pinned['lam0.02_cap12.5'].oosNet4Sharpe : null;
    const abs = (a, b) => (a != null && b != null ? Math.abs(a - b) : null);
    const hereFullNet = +sharpe(books[0.02].net4).toFixed(3);
    const checks = {
        e40WalkForwardOos: e40Wf, hereWalkForwardOos: wfOos, wfAbsDiff: r2(abs(wfOos, e40Wf)),
        e40Pair0102Oos: e40Pair, herePair0102Oos: sc(blends.p01_02.net4.slice(oosStart, end)), pairAbsDiff: r2(abs(sc(blends.p01_02.net4.slice(oosStart, end)), e40Pair)),
        e40PinnedOos: e40Pinned, herePinnedOos: sc(books[0.02].net4.slice(oosStart, end)), pinnedOosAbsDiff: r2(abs(sc(books[0.02].net4.slice(oosStart, end)), e40Pinned)),
        e30FullNet4: e30W ? e30W.net4Sharpe : null, hereFullNet4: hereFullNet, fullNetAbsDiff: r2(abs(hereFullNet, e30W ? e30W.net4Sharpe : null)),
        e31PinnedOosNet4: e31Oos, oosMatch: r2(abs(sc(books[0.02].net4.slice(oosStart, end)), e31Oos)),
        note: 'The rebuild must reproduce e40 (λ-only WF OOS 6.63, pinned λ=0.02 6.86, pair0102 6.66) and e30/e31 on the pinned book — same construction, absolute 0.01 (L10-z).',
    };
    checks.matches = ['wfAbsDiff', 'pairAbsDiff', 'pinnedOosAbsDiff', 'fullNetAbsDiff', 'oosMatch'].every((k) => checks[k] != null && checks[k] < 0.01);

    // ---- verdict ----
    const verdict = {
        note: 'Robust if a no-hindsight blend clears the 0.2 bar AND the frozen-λ ladder does not pick the F-37-broken fast λ on short trains; menu-dependent if only the cherry-picked pair clears it.',
        oosSpan: { start: oosStart, end, span: end - oosStart },
        lambdaWfOos: wfOos, lambdaWfRecent24m: lamWfRecent,
        blendsClearing02: clears, blendsInMenu: menu.length, noHindsightBlendsClearing02: noHindsightClears,
        onlyCherryPickedClears: clears.length === 1 && clears[0] === 'p01_02',
        blendWfOos, blendWfRecent24m: blendWfRecent, blendWfBeatsLambdaWf: blendWfOos >= wfOos - 0.2, blendWfPickFreq: blendWfFreq,
        frozenPicks: frozen.map((x) => ({ S: x.S, lambda: x.frozenLambda, testNet4: x.frozenNet4 })),
        frozenPicksBrokenFast: frozen.filter((x) => x.frozenLambda === 0.1).map((x) => x.S),
        fullHistoryBestLambda: fullBestLambda.lam,
        validationPass: checks.matches,
    };
    verdict.robust = noHindsightClears.length > 0 && verdict.frozenPicksBrokenFast.length === 0;

    return {
        config: { symbols: k, periods: n, lookback: LOOKBACK, block: BLOCK, feeBps: FEE_BPS, cap: CAP, lambdas: LAMBDAS, oosSpan: { start: oosStart, end, span: end - oosStart } },
        checks,
        menu,
        walkForwards: { lambda: { oosNet4: wfOos, recent24mNet4: lamWfRecent, picks: lamWf.picks }, blend: { oosNet4: blendWfOos, recent24mNet4: blendWfRecent, picks: blendWf.picks } },
        frozenLambdaLadder: frozen,
        trailingTrainSensitivity: trailing,
        verdict,
    };
}
