// E29 - IS THE SLOW DISPERSION RETUNE A RULE OR A HINDSIGHT PICK? CYCLE-020 (part 2).
//
// E28 (CYCLE-020) found that the EWMA(0.1) dispersion book's decayed cost margin is *repaired* by a
// SLOWER weight policy: `ewma 0.01_norm` clears a 4 bps fee on the recent 24 months with a break-even of
// 27 bps and net@4 Sharpe +3.86, and is net-positive in all 9 named regimes. But that winner was chosen
// by looking at the recent window across 16 policies - exactly the in-sample selection that PROTOCOL
// rule 2 forbids reporting as evidence. E28's own defence is a *gradient*: recent break-even falls
// monotonically as the policy speeds up, which is what F-36's mechanism (turnover rose 75 -> 98x/yr)
// predicts. This experiment turns that defence into a test.
//
// Three questions:
//
//   Q1 (mechanism / gradient). Is "slower clears the fee" true across the regime table, or only in the
//      recent window? For every lambda in the EWMA family, count the regimes whose *net@4* Sharpe is
//      positive and report the per-regime break-even. A gradient that holds in 9/9 independent windows
//      is a mechanism; one that holds only in the window we selected on is a pick.
//
//   Q2 (out-of-sample). Walk-forward lambda selection: every `block` periods, choose the lambda with the
//      best *trailing* net@4 Sharpe (using only data strictly before the block) and trade it through the
//      block. Compare the resulting OOS net@4 series - which the selector never peeked at - to the
//      PINNED F-24 spec (0.1) and the pinned leader (0.01) on the SAME out-of-sample span. A gross-score
//      selector is carried as a control (it should pick a fast lambda and net-poorly).
//
//   Q3 (significance). The slow book's returns are serially correlated (lambda 0.01 => ~100-period
//      memory), so its Sharpe's i.i.d. t is overstated. Report the design-effect-adjusted t and a
//      90-period moving-block bootstrap CI of the recent-24m net@4 Sharpe for the leader and the spec.
//
// FALSIFIER (pre-registered). The retune is NOT a rule if the walk-forward selector - which cannot see
// the recent window when it chooses lambda - fails to beat the pinned F-24 spec out of sample, or if the
// slow book is net-positive in fewer than 7/9 regimes. Either would mean the E28 winner is an artefact
// of selecting lambda on the very window it is credited with fixing.

import { SYMBOLS, pearsonCorrelation, serialDesignEffect, robustDesignEffect } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';
import { REGIMES } from './e13_carry_robustness.js';

const PERIODS_PER_YEAR = 365 * 3;
const FEE_BPS = 4;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Moving-block bootstrap of the Sharpe over `block`-period resamples (the e13#sharpeCI construction).
function sharpeBootstrap(rets, { block = 90, iters = 1000, seed = 20260920 } = {}) {
    const n = rets.length;
    const nb = Math.floor(n / block);
    if (nb < 4) return { lo: NaN, hi: NaN, se: NaN };
    const rnd = mulberry32(seed);
    const pick = (x) => { const m = mean(x); const s = sd(x); return s > 0 ? (m / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };
    const bx = [];
    for (let i = 0; i < iters; i++) {
        const x = [];
        for (let k = 0; k < nb; k++) { const j = Math.floor(rnd() * nb) * block; for (let z = 0; z < block; z++) x.push(rets[j + z]); }
        bx.push(pick(x));
    }
    bx.sort((a, b) => a - b);
    const q = (p) => bx[Math.min(bx.length - 1, Math.max(0, Math.round(p * (bx.length - 1))))];
    return { lo: +q(0.025).toFixed(2), hi: +q(0.975).toFixed(2), se: +((q(0.975) - q(0.025)) / 3.92).toFixed(2) };
}

function windowMetrics(rets, T, from, to) {
    const r = rets.slice(from, to);
    const t = T.slice(from, to);
    const net4 = r.map((x, i) => x - (FEE_BPS / 1e4) * t[i]);
    return {
        n: r.length,
        grossSharpe: +sharpe(r).toFixed(2),
        net4Sharpe: +sharpe(net4).toFixed(2),
        turnoverAnnual: +(mean(t) * PERIODS_PER_YEAR).toFixed(0),
        breakEvenBps: mean(t) > 0 ? +((mean(r) * 1e4) / mean(t)).toFixed(2) : null,
    };
}

const LAMBDAS = [0.005, 0.0075, 0.01, 0.015, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3];
const fmtLambda = (l) => (l < 0.01 ? l.toFixed(4) : l.toFixed(3)).replace(/0+$/, '').replace(/\.$/, '');

export async function run({ symbols = SYMBOLS, perp = 'mark', lookback = 1095, block = 365 } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const legs = s.legs;
    const n = legs.times.length - 1;
    const bookTimes = legs.times.slice(1);

    // Build the whole EWMA(lambda) family once, causally.
    const lamBooks = {};
    for (const lam of LAMBDAS) {
        const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: lam, normalize: true } });
        const T = turnoverSeries(built.weightRows);
        lamBooks[lam] = {
            rets: built.rets,
            T,
            net4: built.rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i]),
        };
    }
    const marketCorr = {};
    for (const lam of LAMBDAS) marketCorr[lam] = +pearsonCorrelation(lamBooks[lam].rets, s.books.market).toFixed(3);

    // ---- Q1: does the gradient hold across regimes? --------------------------------------------
    const regimeTable = {};
    const positiveRegimesByLambda = {};
    for (const lam of LAMBDAS) {
        const m = {};
        let pos = 0;
        for (const rg of REGIMES) {
            const mask = [];
            const from = rg.from; const to = rg.to;
            for (let i = 0; i < n; i++) if (bookTimes[i] >= from && bookTimes[i] < to) mask.push(i);
            if (mask.length < 30) { m[rg.name] = { n: mask.length, available: false }; continue; }
            const r = mask.map((i) => lamBooks[lam].rets[i]);
            const tt = mask.map((i) => lamBooks[lam].T[i]);
            const net4 = r.map((x, i) => x - (FEE_BPS / 1e4) * tt[i]);
            const net = +sharpe(net4).toFixed(2);
            if (net > 0) pos++;
            m[rg.name] = { n: mask.length, net4Sharpe: net, turnoverAnnual: +(mean(tt) * PERIODS_PER_YEAR).toFixed(0), breakEvenBps: mean(tt) > 0 ? +((mean(r) * 1e4) / mean(tt)).toFixed(2) : null };
        }
        regimeTable[fmtLambda(lam)] = m;
        positiveRegimesByLambda[fmtLambda(lam)] = { positive: pos, of: REGIMES.length };
    }

    // ---- Q2: walk-forward lambda selection (out of sample) --------------------------------------
    // Score each lambda on the trailing `lookback` net@4 series and trade the argmax through the block.
    // No data on or after the block start is used, so the resulting series is genuinely out of sample.
    function walkForward(scoreOf, lb = lookback, blk = block) {
        const picks = [];
        const oos = { net: [], gross: [], turn: [] };
        let r = lb;
        while (r + blk <= n) {
            let best = null;
            for (const lam of LAMBDAS) {
                const sc = scoreOf(lam, r, lb);
                if (!Number.isFinite(sc)) continue;
                if (!best || sc > best.sc) best = { lam, sc };
            }
            if (!best) break;
            for (let t = r; t < r + blk; t++) { oos.net.push(lamBooks[best.lam].net4[t]); oos.gross.push(lamBooks[best.lam].rets[t]); oos.turn.push(lamBooks[best.lam].T[t]); }
            picks.push({ at: new Date(bookTimes[r]).toISOString().slice(0, 10), lambda: fmtLambda(best.lam), trailingScore: +best.sc.toFixed(2) });
            r += blk;
        }
        const start = lb;
        const span = oos.net.length;
        const REC = Math.min(span, Math.round(2 * PERIODS_PER_YEAR));
        const res = {
            lookback: lb,
            block: blk,
            start,
            span,
            net4Sharpe: +sharpe(oos.net).toFixed(2),
            turnoverAnnual: +(mean(oos.turn) * PERIODS_PER_YEAR).toFixed(0),
            breakEvenBps: mean(oos.turn) > 0 ? +((mean(oos.gross) * 1e4) / mean(oos.turn)).toFixed(2) : null,
            recent24mNet4Sharpe: +sharpe(oos.net.slice(span - REC)).toFixed(2),
            recent24mBreakEvenBps: mean(oos.turn.slice(span - REC)) > 0 ? +((mean(oos.gross.slice(span - REC)) * 1e4) / mean(oos.turn.slice(span - REC))).toFixed(2) : null,
            picks,
        };
        const freq = {};
        for (const p of picks) freq[p.lambda] = (freq[p.lambda] || 0) + 1;
        res.pickFrequency = freq;
        return res;
    }
    const wfNet = walkForward((lam, r, lb) => sharpe(lamBooks[lam].net4.slice(r - lb, r)));
    const wfGross = walkForward((lam, r, lb) => sharpe(lamBooks[lam].rets.slice(r - lb, r)));

    // Parameter sensitivity: the "is it a rule?" answer must not depend on one (lookback, block) choice.
    const sensitivity = [];
    for (const lb of [365, 730, 1095, 1560]) {
        for (const blk of [180, 365, 730]) {
            const wf = walkForward((lam, r, L) => sharpe(lamBooks[lam].net4.slice(r - L, r)), lb, blk);
            sensitivity.push({ lookback: lb, block: blk, span: wf.span, net4Sharpe: wf.net4Sharpe, recent24mNet4Sharpe: wf.recent24mNet4Sharpe, breakEvenBps: wf.breakEvenBps });
        }
    }

    // Pinned policies on the SAME out-of-sample span (so the comparison is like-for-like).
    const pinnedOnSpan = {};
    for (const lam of [0.01, 0.02, 0.05, 0.1]) {
        pinnedOnSpan[fmtLambda(lam)] = windowMetrics(lamBooks[lam].rets, lamBooks[lam].T, wfNet.start, wfNet.start + wfNet.span);
    }
    // And the recent 24m of that span (the window the falsifier is really about).
    const spanEnd = wfNet.start + wfNet.span;
    const pinnedRecentOnSpan = {};
    for (const lam of [0.01, 0.02, 0.05, 0.1]) {
        pinnedRecentOnSpan[fmtLambda(lam)] = windowMetrics(lamBooks[lam].rets, lamBooks[lam].T, spanEnd - 2 * PERIODS_PER_YEAR, spanEnd);
    }

    // ---- Q3: autocorrelation-honest significance of the recent window ---------------------------
    const RECENT = Math.round(2 * PERIODS_PER_YEAR);
    const significance = {};
    for (const lam of [0.01, 0.02, 0.05, 0.1]) {
        const b = lamBooks[lam];
        const from = n - RECENT;
        const net = b.net4.slice(from, n);
        const de = serialDesignEffect(net, 90).designEffect;
        const der = robustDesignEffect(net, { fold: 90, k: 3 });
        const sh = sharpe(net);
        const years = net.length / PERIODS_PER_YEAR;
        const tRaw = sh * Math.sqrt(years);
        significance[fmtLambda(lam)] = {
            recentNet4Sharpe: +sh.toFixed(2),
            turnoverAnnual: +(mean(b.T.slice(from, n)) * PERIODS_PER_YEAR).toFixed(0),
            breakEvenBps: mean(b.T.slice(from, n)) > 0 ? +((mean(b.rets.slice(from, n)) * 1e4) / mean(b.T.slice(from, n))).toFixed(2) : null,
            tRaw: +tRaw.toFixed(2),
            designEffect: +de.toFixed(1),
            tAdjusted: Number.isFinite(de) && de > 0 ? +(tRaw / Math.sqrt(de)).toFixed(2) : null,
            designEffectWinsor3: +der.toFixed(1),
            tAdjustedWinsor3: Number.isFinite(der) && der > 0 ? +(tRaw / Math.sqrt(der)).toFixed(2) : null,
            bootstrapCI: sharpeBootstrap(b.net4.slice(from, n)),
        };
    }

    // ---- verdict --------------------------------------------------------------------------------
    const leader = '0.01';
    const spec = '0.1';
    const slowPositiveRegimes = positiveRegimesByLambda[leader] ? positiveRegimesByLambda[leader].positive : 0;
    const wfBeatsSpec = wfNet.net4Sharpe > pinnedOnSpan[spec].net4Sharpe;
    const wfBeatsSpecRecent = wfNet.recent24mNet4Sharpe > pinnedRecentOnSpan[spec].net4Sharpe;
    const sensAllBeatSpec = sensitivity.every((x) => Number.isFinite(x.net4Sharpe) && x.net4Sharpe > 0 && Number.isFinite(x.recent24mNet4Sharpe) && x.recent24mNet4Sharpe > 0);
    const verdict = {
        note: 'Falsifier: retune is NOT a rule if the walk-forward selector fails to beat the pinned F-24 spec out of sample, or if the slow book nets positive in <7/9 regimes.',
        walkForwardNet4Sharpe: wfNet.net4Sharpe,
        walkForwardTurnoverAnnual: wfNet.turnoverAnnual,
        walkForwardBreakEvenBps: wfNet.breakEvenBps,
        walkForwardRecent24mNet4Sharpe: wfNet.recent24mNet4Sharpe,
        walkForwardPickFrequency: wfNet.pickFrequency,
        pinnedSpecNet4SharpeOnSameSpan: pinnedOnSpan[spec].net4Sharpe,
        pinnedLeaderNet4SharpeOnSameSpan: pinnedOnSpan[leader].net4Sharpe,
        pinnedSpecRecent24mNet4Sharpe: pinnedRecentOnSpan[spec].net4Sharpe,
        pinnedLeaderRecent24mNet4Sharpe: pinnedRecentOnSpan[leader].net4Sharpe,
        grossBlindSelectorNet4Sharpe: wfGross.net4Sharpe,
        grossBlindSelectorPickFrequency: wfGross.pickFrequency,
        slowBookPositiveRegimes: `${slowPositiveRegimes}/${REGIMES.length}`,
        sensitivityAllPositive: sensAllBeatSpec,
        wfBeatsSpecOutOfSample: wfBeatsSpec,
        wfBeatsSpecRecent: wfBeatsSpecRecent,
        slowBookRobustAcrossRegimes: slowPositiveRegimes >= 7,
        retuneIsARule: wfBeatsSpec && wfBeatsSpecRecent && sensAllBeatSpec && slowPositiveRegimes >= 7,
    };

    return {
        config: { symbols: k, perp, periods: n, lookback, block, feeBps: FEE_BPS, lambdas: LAMBDAS.map(fmtLambda), recentWindow: RECENT },
        regimeTable,
        positiveRegimesByLambda,
        marketCorr,
        walkForward: wfNet,
        walkForwardGrossControl: wfGross,
        sensitivity,
        pinnedOnSpan,
        pinnedRecentOnSpan,
        significance,
        verdict,
    };
}
