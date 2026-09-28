// E25 - EXECUTION REALISM: can a passive (maker) fill rescue the short-horizon family? L08. CYCLE-017.
//
// WHY. CYCLE-016 (F-32) closed L13 with a break-even of 0.32-1.31 bps of turnover - dead against the
// project's 5-10 bps taker - and showed smoothing cannot lift it. The L08 falsifier is the last open
// route: a passive (maker) execution. This experiment measures the part of that question the bar data
// CAN answer, and states plainly the part it cannot.
//
// UNITS. Every cost is a fraction of the NOTIONAL TRADED, in bps. The reversal book breaks even at
// ~0.5-1.0 bps of turnover (F-32), so the whole question is whether a passive execution costs < that
// per unit traded.
//
// THREE PARTS.
//
//   0. SPREAD ESTIMATORS, reported as the unusable upper bound they are. A maker earns up to half the
//      effective spread. The two classic OHLCV estimators - Corwin-Schultz (2012) and Roll (1984) -
//      are computed here. On crypto they are VOLATILITY-CONTAMINATED: the CS estimate is 8-42 bps
//      (15m/1h), i.e. 10-100x the break-even, which is obviously not a spread (market makers do not earn
//      20 bps a side on BTC). So the number is reported only to show that **the bar model cannot measure
//      the maker's spread capture at the precision the question needs.** That is a finding, not a gap to
//      paper over.
//
//   1. QUOTE DEPTH AND FILL SELECTION, which IS measurable and model-free. The crux of maker economics
//      is a trade-off: quoting deeper (a better price) fills less often but at a better price, and the
//      fills you get are the ones where the price kept moving against you (adverse selection). For the
//      per-symbol reversal signal (long after a down bar, short after an up bar) we quote at the signal
//      close offset by `depth`, fill if the NEXT bar reaches the quote, and measure the forward return
//      (a) from the reference close - pure selection - and (b) from the actual fill price - selection
//      plus the depth benefit. `netVsTakerBps` is (b) minus the taker's unconditional return: the
//      maker's per-trade edge relative to just taking. Reported across depths 0/1/5/10/20 bps.
//
//   2. MAKER vs TAKER BOOK. The reversal book (F-32's rank-weight, sign -1 construction) is rebuilt
//      under execution models on the same targets:
//        taker      - fill the whole delta at the signal bar's close, always. VALIDATION: its break-even
//                     must reproduce E24's `rank_w1_rev` (0.709 bps at 1h, 0.500 at 15m).
//        maker@D    - quote at the signal close offset by D bps; fill only if the next bar's low (buy) /
//                     high (sell) reaches it, at the quote price; unfilled orders are cancelled and the
//                     exposure is NOT taken.
//        oracle     - filled at the next bar's LOW / HIGH: the best price any execution could get in
//                     that bar. An unachievable UPPER BOUND - if even this is not tradable, nothing is.
//      Each is audited by `e16#audit` (gross Sharpe, turnover, break-even, net ladder).
//
// The decisive outputs: the taker break-even (what a passive execution must beat after its fee), the
// oracle break-even (the unachievable ceiling), and `netVsTakerBps` per depth (whether the fill
// selection eats the depth benefit). If even the ORACLE book does not clear a realistic fee, L08 is
// settled: no maker model can rescue the family.

import { buildPanel, SYMBOLS, PERIODS_PER_YEAR } from '../lib/lab.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';
import { audit } from './e16_cost_capacity.js';
import { rankWeights } from './e17_low_turnover.js';

const TRUE_PPY = { '1h': 24 * 365, '15m': 4 * 24 * 365 };
const FEE_LADDER = [0, 0.5, 1, 2, 4, 5, 10];
const DEPTHS = [0, 0.0001, 0.0005, 0.001, 0.002]; // 0 / 1 / 5 / 10 / 20 bps below/above the reference

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const fin = (x) => (Number.isFinite(x) ? x : 0);
const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---- 0. spread estimators (volatility-contaminated; upper bounds only) ----------------------
function corwinSchultz(high, low) {
    const k = 3 - 2 * Math.SQRT2;
    let n = 0; let sum = 0;
    for (let t = 0; t + 1 < high.length; t++) {
        if (!(high[t] > 0 && low[t] > 0 && high[t + 1] > 0 && low[t + 1] > 0)) continue;
        const beta = Math.log(high[t] / low[t]) ** 2 + Math.log(high[t + 1] / low[t + 1]) ** 2;
        const H = Math.max(high[t], high[t + 1]);
        const L = Math.min(low[t], low[t + 1]);
        const gamma = Math.log(H / L) ** 2;
        const alpha = (Math.sqrt(2 * beta) - Math.sqrt(beta)) / k - Math.sqrt(gamma / k);
        let s = 2 * (Math.exp(alpha) - 1) / (1 + Math.exp(alpha));
        if (!Number.isFinite(s)) continue;
        if (s < 0) s = 0;
        sum += s; n += 1;
    }
    return n ? (sum / n) * 1e4 : NaN;
}
function rollSpread(returns) {
    const r = returns.filter(Number.isFinite);
    const m = mean(r);
    let c = 0; let n = 0;
    for (let t = 1; t < r.length; t++) { c += (r[t] - m) * (r[t - 1] - m); n += 1; }
    const cov1 = n ? c / n : 0;
    return cov1 < 0 ? 2 * Math.sqrt(-cov1) * 1e4 : 0;
}

// ---- 1. quote depth and fill selection ------------------------------------------------------
// Passive quote at the signal close offset by `depth`; fill if the next bar reaches it; the fill price
// is the quote. `meanFilledFromQuoteBps` isolates SELECTION (forward return measured from the reference
// close); `meanFilledFromFillBps` adds the depth benefit (measured from the actual fill price);
// `netVsTakerBps` = the latter minus the taker's unconditional forward return.
export function fillSelection(close, high, low, returns, { h = 1, depth = 0, side = 'rev', rng = null } = {}) {
    const n = close.length;
    let fill = 0; let miss = 0; let sumFq = 0; let sumFf = 0; let sumM = 0;
    for (let t = 0; t + h + 1 < n; t++) {
        const r = returns[t];
        if (!Number.isFinite(r) || r === 0) continue;
        // `side` is the CONTROL axis: 'rev' is the reversal signal, 'mom' the mirror (a real signal
        // with the opposite selection, which must come out with the opposite sign), 'random' a seeded
        // coin (which must come out ~0 - by symmetry the fill event cannot select a random side).
        const d = side === 'mom' ? Math.sign(r) : side === 'random' ? (rng && rng() < 0.5 ? -1 : 1) : -Math.sign(r);
        const ref = close[t];
        const quote = d > 0 ? ref * (1 - depth) : ref * (1 + depth);
        if (!(quote > 0)) continue;
        const filled = d > 0 ? low[t + 1] <= quote : high[t + 1] >= quote;
        const fwdQ = d * (close[t + h] / ref - 1);   // from the reference close (pure selection)
        const fwdF = d * (close[t + h] / quote - 1); // from the fill price (selection + depth)
        if (!Number.isFinite(fwdQ) || !Number.isFinite(fwdF)) continue;
        if (filled) { fill += 1; sumFq += fwdQ; sumFf += fwdF; } else { miss += 1; sumM += fwdQ; }
    }
    const tot = fill + miss;
    const meanFq = fill ? sumFq / fill : NaN;
    const meanFf = fill ? sumFf / fill : NaN;
    const meanM = miss ? sumM / miss : NaN;
    const meanAll = tot ? (sumFq + sumM) / tot : NaN;
    return {
        n: tot, fillRate: tot ? fill / tot : NaN,
        meanFilledFromQuoteBps: meanFq * 1e4,
        meanFilledFromFillBps: meanFf * 1e4,
        meanNotFilledBps: meanM * 1e4,
        meanAllBps: meanAll * 1e4,
        selectionBps: (meanFq - meanAll) * 1e4,          // measured from the reference close
        netVsTakerBps: (meanFf - meanAll) * 1e4,         // the maker's actual per-fill edge over taking
    };
}

// ---- 2. execution models on the reversal book -----------------------------------------------
// Target = F-32's `rank_w1_rev`: rank weights of the trailing `w`-bar return, sign -1, sum|w| = 1.
const EPS = 1e-12;
function simBook(close, high, low, returns, k, { w = 1, sign = -1, mode = 'taker', feeBps = 0, depth = 0 } = {}) {
    const n = returns[0].length;
    const rets = [];
    const weightRows = [];
    let held = new Array(k).fill(0);
    for (let i = w; i < n - 2; i++) {
        const raw = [];
        for (let j = 0; j < k; j++) { let s = 0; for (let q = 0; q < w; q++) s += returns[j][i - q]; raw.push(Number.isFinite(s) ? s : NaN); }
        const present = [];
        for (let j = 0; j < k; j++) if (Number.isFinite(raw[j])) present.push(j);
        if (present.length < 3) continue;
        const tgt = new Array(k).fill(0);
        const wv = rankWeights(present.map((j) => raw[j]));
        present.forEach((j, q) => { tgt[j] = fin(sign * wv[q]); });
        const g0 = tgt.reduce((a, x) => a + Math.abs(x), 0) || 1;
        for (let j = 0; j < k; j++) tgt[j] /= g0;
        let execCost = 0; let feeCost = 0;
        for (let j = 0; j < k; j++) {
            const d = tgt[j] - held[j];
            if (Math.abs(d) < EPS) continue;
            const C = close[j][i];
            let P = C; let filled = true;
            if (mode === 'taker') { P = C; filled = true; }
            else if (mode === 'maker') {
                const quote = d > 0 ? C * (1 - depth) : C * (1 + depth);
                filled = d > 0 ? low[j][i + 1] <= quote : high[j][i + 1] >= quote;
                P = quote;
            } else if (mode === 'oracle') {
                P = d > 0 ? low[j][i + 1] : high[j][i + 1]; // the best price in the executing bar
            }
            if (!filled) continue;
            execCost += d * (P / C - 1);              // positive = we executed worse than the reference
            feeCost += (feeBps / 1e4) * Math.abs(d);
            held[j] = tgt[j];
        }
        const gross = (() => { let s = 0; for (let j = 0; j < k; j++) s += held[j] * fin(returns[j][i + 1]); return s; })();
        rets.push(gross - execCost - feeCost);
        weightRows.push(held.slice());
    }
    return { rets, weightRows };
}

export async function run({ tf = '1h', w = 1, horizons = [1, 2, 4] } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const k = panel.length;
    const n = panel[0].n;
    const tpy = TRUE_PPY[tf] || PERIODS_PER_YEAR;
    const close = panel.map((s) => s.close);
    const high = panel.map((s) => s.high);
    const low = panel.map((s) => s.low);
    const returns = panel.map((s) => s.returns);

    const out = {
        config: { tf, bars: n, streams: k, window: w, truePeriodsPerYear: tpy, firstBar: new Date(panel[0].t[0]).toISOString(), lastBar: new Date(panel[0].t[n - 1]).toISOString() },
    };

    // ---- 0. spread estimators ------------------------------------------------------------------
    const spreads = {};
    for (let j = 0; j < k; j++) spreads[SYMBOLS[j]] = { corwinSchultzBps: +corwinSchultz(high[j], low[j]).toFixed(3), rollBps: +rollSpread(returns[j]).toFixed(3) };
    out.spreadEstimates = {
        note: 'Half of these is the most a passive fill could earn. Both estimators are VOLATILITY-contaminated on crypto (a real BTC perp spread is ~1 bp, not 20), so they are unusable upper bounds and cannot resolve a 0.5-1.0 bps break-even. That is the point: the bar model cannot measure the maker\'s spread capture.',
        perSymbol: spreads,
        meanCsBps: +mean(Object.values(spreads).map((s) => s.corwinSchultzBps)).toFixed(3),
        meanRollBps: +mean(Object.values(spreads).map((s) => s.rollBps)).toFixed(3),
    };

    // ---- 1. quote depth and fill selection -----------------------------------------------------
    const pooledByDepth = {};
    const perSymbol = {};
    for (const depth of DEPTHS) {
        const key = `d${(depth * 1e4).toFixed(0)}bp`;
        const agg = { fill: 0, miss: 0, sFq: 0, sFf: 0, sM: 0 };
        for (let j = 0; j < k; j++) {
            const s = fillSelection(close[j], high[j], low[j], returns[j], { h: 1, depth });
            agg.fill += s.fillRate * s.n; agg.miss += (1 - s.fillRate) * s.n;
            agg.sFq += s.meanFilledFromQuoteBps * s.fillRate * s.n;
            agg.sFf += s.meanFilledFromFillBps * s.fillRate * s.n;
            agg.sM += s.meanNotFilledBps * (1 - s.fillRate) * s.n;
            if (depth === DEPTHS[0] || depth === 0.0005) {
                perSymbol[`${SYMBOLS[j]}_${key}`] = { fillRate: +s.fillRate.toFixed(4), selectionBps: +s.selectionBps.toFixed(3), netVsTakerBps: +s.netVsTakerBps.toFixed(3) };
            }
        }
        const tot = agg.fill + agg.miss;
        const meanFq = agg.sFq / agg.fill; const meanFf = agg.sFf / agg.fill; const meanM = agg.sM / agg.miss;
        const meanAll = (agg.sFq + agg.sM) / tot;
        pooledByDepth[key] = {
            depthBps: +(depth * 1e4).toFixed(2), fillRate: +(agg.fill / tot).toFixed(4),
            meanFilledFromQuoteBps: +meanFq.toFixed(3), meanFilledFromFillBps: +meanFf.toFixed(3),
            meanNotFilledBps: +meanM.toFixed(3), meanAllBps: +meanAll.toFixed(3),
            selectionBps: +(meanFq - meanAll).toFixed(3), netVsTakerBps: +(meanFf - meanAll).toFixed(3),
        };
    }
    // Horizons at depth 0, to show the selection's decay.
    const byHorizon = {};
    for (const h of horizons) {
        const agg = { fill: 0, miss: 0, sFq: 0, sFf: 0, sM: 0 };
        for (let j = 0; j < k; j++) {
            const s = fillSelection(close[j], high[j], low[j], returns[j], { h, depth: 0 });
            agg.fill += s.fillRate * s.n; agg.miss += (1 - s.fillRate) * s.n;
            agg.sFq += s.meanFilledFromQuoteBps * s.fillRate * s.n; agg.sFf += s.meanFilledFromFillBps * s.fillRate * s.n; agg.sM += s.meanNotFilledBps * (1 - s.fillRate) * s.n;
        }
        const tot = agg.fill + agg.miss; const meanAll = (agg.sFq + agg.sM) / tot;
        byHorizon[`h${h}`] = { fillRate: +(agg.fill / tot).toFixed(4), meanAllBps: +meanAll.toFixed(3), selectionBps: +(agg.sFq / agg.fill - meanAll).toFixed(3) };
    }
    // CONTROLS for the selection measurement: the mirror (momentum) side is a real signal with the
    // opposite sign of selection, and a seeded random side must measure ~0 (the fill event cannot
    // select a coin). If both behave, the reversal selection is a property of the signal, not of the
    // measurement.
    const sideControls = {};
    for (const side of ['mom', 'random']) {
        const key = side;
        sideControls[key] = {};
        for (const depth of [0, 0.0005]) {
            const rng = side === 'random' ? mulberry32(20261701) : null;
            const agg = { fill: 0, miss: 0, sFq: 0, sFf: 0, sM: 0 };
            for (let j = 0; j < k; j++) {
                const s = fillSelection(close[j], high[j], low[j], returns[j], { h: 1, depth, side, rng });
                agg.fill += s.fillRate * s.n; agg.miss += (1 - s.fillRate) * s.n;
                agg.sFq += s.meanFilledFromQuoteBps * s.fillRate * s.n; agg.sFf += s.meanFilledFromFillBps * s.fillRate * s.n; agg.sM += s.meanNotFilledBps * (1 - s.fillRate) * s.n;
            }
            const tot = agg.fill + agg.miss; const meanAll = (agg.sFq + agg.sM) / tot;
            sideControls[key][`d${(depth * 1e4).toFixed(0)}bp`] = { fillRate: +(agg.fill / tot).toFixed(4), meanAllBps: +meanAll.toFixed(3), selectionBps: +(agg.sFq / agg.fill - meanAll).toFixed(3), netVsTakerBps: +(agg.sFf / agg.fill - meanAll).toFixed(3) };
        }
    }
    out.fillSelection = {
        note: 'Per-symbol reversal signal (long after a down bar, short after an up bar), passive quote at the signal close offset by `depth`, filled if the next bar reaches it. meanFilledFromQuoteBps isolates SELECTION (return measured from the reference close); netVsTakerBps = return from the actual fill price minus the taker\'s unconditional return. NEGATIVE selection = adverse. At depth 0 the fill rate is ~99% (quoting at the last price is almost always reached), so a maker there is a fee-discounted taker with the worse half of the signal.',
        byDepth: pooledByDepth, byHorizon, perSymbol, sideControls,
    };

    // ---- 2. maker vs taker book ----------------------------------------------------------------
    const modelDefs = [
        { tag: 'taker', mode: 'taker', depth: 0 },
        { tag: 'maker_d0', mode: 'maker', depth: 0 },
        { tag: 'maker_d1bp', mode: 'maker', depth: 0.0001 },
        { tag: 'maker_d5bp', mode: 'maker', depth: 0.0005 },
        { tag: 'maker_d10bp', mode: 'maker', depth: 0.001 },
        { tag: 'maker_d20bp', mode: 'maker', depth: 0.002 },
        { tag: 'oracle', mode: 'oracle', depth: 0 },
    ];
    const books = {};
    for (const def of modelDefs) {
        const b0 = simBook(close, high, low, returns, k, { w, sign: -1, mode: def.mode, feeBps: 0, depth: def.depth });
        const a = audit(def.tag, b0.rets, b0.weightRows, { periodsPerYear: PERIODS_PER_YEAR });
        const ladder = {};
        for (const f of FEE_LADDER) {
            const bf = simBook(close, high, low, returns, k, { w, sign: -1, mode: def.mode, feeBps: f, depth: def.depth });
            ladder[f] = +sharpeRatio(bf.rets, { periodsPerYear: PERIODS_PER_YEAR }).toFixed(3);
        }
        books[def.tag] = {
            model: def.mode, depthBps: +(def.depth * 1e4).toFixed(2),
            grossSharpe252: +a.gross.sharpe.toFixed(4),
            turnoverAnnualTrue: +(a.turnover.meanPerPeriod * tpy).toFixed(0),
            fractionOfTakerTurnover: null,
            breakEvenBps: a.breakEvenBps == null ? null : +a.breakEvenBps.toFixed(3),
            netSharpeByFeeBps: ladder,
        };
    }
    for (const tag of Object.keys(books)) if (books.taker.turnoverAnnualTrue) books[tag].fractionOfTakerTurnover = +(books[tag].turnoverAnnualTrue / books.taker.turnoverAnnualTrue).toFixed(3);
    out.books = books;

    // ---- validation (the guard that caught the `n` bug in the first draft) ---------------------
    // E24's `rank_w1_rev` (w = 1) at each timeframe - the identical construction.
    const e24Ref = tf === '1h'
        ? { grossSharpe252: 0.41433128097876265, breakEvenBps: 0.7089322071725292 }
        : { grossSharpe252: 0.5342746531107176, breakEvenBps: 0.32345750802944306 };
    out.validation = {
        tag: 'taker',
        takerGrossSharpe252: books.taker.grossSharpe252,
        takerBreakEvenBps: books.taker.breakEvenBps,
        e24Reference: e24Ref,
        matchesE24: Math.abs(books.taker.grossSharpe252 - e24Ref.grossSharpe252) < 5e-3 && Math.abs(books.taker.breakEvenBps - e24Ref.breakEvenBps) < 5e-3,
        note: 'taker uses the identical target and return path as E24 rank_w1_rev; if it does not reproduce that artefact, the execution model is measuring a different book and nothing else counts.',
    };

    // ---- decisive numbers -----------------------------------------------------------------------
    out.conclusion = {
        note: 'Financial-per-trade view. takerBreakEvenBps is what a passive execution must beat after its fee. oracleBreakEvenBps is the UNACHIEVABLE ceiling (filled at the bar extreme). netVsTakerBps per depth is the maker\'s per-fill edge over taking, from the actual fill price. If even `oracle` does not clear a realistic fee, no maker model can save the family.',
        takerBreakEvenBps: books.taker.breakEvenBps,
        oracleBreakEvenBps: books.oracle.breakEvenBps,
        oracleNetAt1bps: books.oracle.netSharpeByFeeBps[1],
        oracleNetAt4bps: books.oracle.netSharpeByFeeBps[4],
        maker_d0_breakEvenBps: books.maker_d0.breakEvenBps,
        maker_d5bp_breakEvenBps: books.maker_d5bp.breakEvenBps,
        maker_d0_netAt1bps: books.maker_d0.netSharpeByFeeBps[1],
        maker_d0_tradesFractionOfTaker: books.maker_d0.fractionOfTakerTurnover,
        spreadCaptureUnusableBps: out.spreadEstimates.meanCsBps,
        deepestTested: { depthBps: pooledByDepth[`d${(DEPTHS[DEPTHS.length - 1] * 1e4).toFixed(0)}bp`].depthBps, fillRate: pooledByDepth[`d${(DEPTHS[DEPTHS.length - 1] * 1e4).toFixed(0)}bp`].fillRate, netVsTakerBps: pooledByDepth[`d${(DEPTHS[DEPTHS.length - 1] * 1e4).toFixed(0)}bp`].netVsTakerBps },
    };
    return out;
}
