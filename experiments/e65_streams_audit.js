// E65 - THE STREAM DESIGN LAYER, AUDITED: `analysis/streams.js`. CYCLE-057 (L10-ca ...).
//
// `analysis/streams.js` is the shipped "buying effective independence, not bars" layer (round 26, R26-6):
// `resampleCandles` builds a second bar interval without a second dataset; `designEffectOfStreams` measures the
// panel's Kish (1965) design effect from the streams' own returns (or their per-fold Sharpe series); and
// `selectStreams` greedily orders candidates by their marginal effective bars per raw bar. `analyze.js` imports
// all four (incl. `formatStreamSelection`) and prints them in the run report. It is a DIAGNOSTIC/DESIGN layer —
// the docstring says the numbers never enter the scored arithmetic — but it is shipped and it is what the
// report says about the panel's breadth.
//
// PRE-REGISTERED READ. PASSES if (i) `resampleCandles` reproduces a hand recompute and the OHLCV invariants
// (open = first open, close = last close, high = max, low = min, volume = sum) exactly, never mutates its
// input, is a shallow copy at factor 1, drops a trailing partial group unless `keepIncomplete`, honours the
// documented non-finite fallbacks, and rejects a bad factor; (ii) `designEffectOfStreams` satisfies the Kish
// identities (`rawBars = K*T`, `designEffect = 1+(K-1)*rbar`, `effectiveBars = rawBars/DE`,
// `effectiveStreams = K/DE`, `effectiveBarsPerBar = 1/DE`), reports K=1 as the trivial panel, two identical
// streams as one bet (rbar 1, DE 2, effectiveStreams 1), aligns different-length streams on their most recent
// T = min length bars, and abstains on the documented degenerate panels; (iii) the fold-Sharpe method is chosen
// iff the fold tiles T, and the rbar equals an independent segmentation + mean pairwise correlation;
// (iv) `selectStreams` is deterministic, tie-breaks by label, returns `order` = the curve labels, is monotone
// in effective bars, computes `marginalEfficiency = marginalBars/addedBars` exactly, keeps a diversifying
// stream over a redundant copy, stops on a fully redundant pool, and honours `maxStreams`.
//
// The DEFECTS are reported in `findings`: a zero-variance (constant) stream is skipped from every correlation
// pair but still counted in K and rawBars, so the panel's reported effective breadth counts a stream that
// carries no information; and `maxStreams <= 0` is treated as "unlimited" rather than "none".

import {
    resampleCandles, designEffectOfStreams, selectStreams, formatStreamSelection,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/streams.js';
import { pearsonCorrelation, meanPairwiseCorrelation } from '../../NeuLegion-master/NeuLegion-master/src/analysis/dependence.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';

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

const mkCandles = (n, seed = 11) => {
    const rnd = mulberry32(seed);
    const out = [];
    let p = 100;
    for (let i = 0; i < n; i++) {
        const o = p;
        const c = o * (1 + (rnd() - 0.5) * 0.02);
        const h = Math.max(o, c) * (1 + rnd() * 0.005);
        const l = Math.min(o, c) * (1 - rnd() * 0.005);
        out.push({ timestamp: 1000 + i, open: o, high: h, low: l, close: c, volume: 10 + rnd() * 5 });
        p = c;
    }
    return out;
};

// Independent hand recompute of the resampled OHLCV from the ORIGINAL bars (a different code path: it reads
// the source bars directly instead of the module's group loop).
function refResample(candles, factor, keepIncomplete = false) {
    const groups = [];
    const n = keepIncomplete ? Math.ceil(candles.length / factor) : Math.floor(candles.length / factor);
    for (let g = 0; g < n; g++) {
        const from = g * factor;
        const to = Math.min(from + factor, candles.length);
        const slice = candles.slice(from, to);
        const highs = slice.map((c) => c.high).filter(Number.isFinite);
        const lows = slice.map((c) => c.low).filter(Number.isFinite);
        const o = slice[0];
        const cL = slice[slice.length - 1];
        groups.push({
            timestamp: o.timestamp,
            open: Number.isFinite(o.open) ? o.open : o.close,
            close: cL.close,
            high: highs.length ? Math.max(...highs) : Math.max(Number.isFinite(o.open) ? o.open : o.close, cL.close),
            low: lows.length ? Math.min(...lows) : Math.min(Number.isFinite(o.open) ? o.open : o.close, cL.close),
            volume: slice.reduce((a, x) => a + (Number.isFinite(x.volume) ? x.volume : 1), 0),
        });
    }
    return groups;
}

// Independent mean pairwise Pearson correlation (bookstrapped from `pearsonCorrelation` over the same pairs).
function refMeanPairwise(list) {
    const rs = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const r = pearsonCorrelation(list[i], list[j]);
        if (Number.isFinite(r)) rs.push(r);
    }
    return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : NaN;
}

const mkSeries = (n, seed, freq = 0.3, phase = 0) => {
    const rnd = mulberry32(seed);
    return Array.from({ length: n }, (_, i) => 0.01 * Math.sin(i * freq + phase) + 0.004 * (rnd() - 0.5));
};

export async function run() {
    const checks = {};
    const rows = {};

    // ============================== A. the resampler ===================================================
    checks.resampleExact = (() => {
        const candles = mkCandles(23, 5);
        const snapshot = JSON.stringify(candles);
        const cases = [];
        let ok = true;
        for (const factor of [2, 3, 4, 7]) {
            for (const keep of [false, true]) {
                const got = resampleCandles(candles, { factor, keepIncomplete: keep });
                const ref = refResample(candles, factor, keep);
                const matches = got.length === ref.length && got.every((g, i) => close(g.open, ref[i].open) && close(g.close, ref[i].close) && close(g.high, ref[i].high) && close(g.low, ref[i].low) && close(g.volume, ref[i].volume) && g.timestamp === ref[i].timestamp);
                // invariants against the ORIGINAL bars
                let inv = true;
                for (let g = 0; g < got.length; g++) {
                    const slice = candles.slice(g * factor, Math.min((g + 1) * factor, candles.length));
                    const hs = slice.map((c) => c.high).filter(Number.isFinite);
                    const ls = slice.map((c) => c.low).filter(Number.isFinite);
                    if (hs.length && !close(got[g].high, Math.max(...hs))) inv = false;
                    if (ls.length && !close(got[g].low, Math.min(...ls))) inv = false;
                    if (!close(got[g].open, slice[0].open) || !close(got[g].close, slice[slice.length - 1].close)) inv = false;
                }
                if (!matches || !inv) ok = false;
                cases.push({ factor, keepIncomplete: keep, len: got.length, matches, inv });
            }
        }
        const unmutated = JSON.stringify(candles) === snapshot;
        const f1 = resampleCandles(candles, { factor: 1 });
        const shallow = f1 !== candles && f1.length === candles.length && f1[0] === candles[0];
        rows.resample = { cases, unmutated, shallowCopy: shallow };
        return ok && unmutated && shallow;
    })();

    checks.resampleEdges = (() => {
        const candles = mkCandles(10, 9);
        const ten = resampleCandles(candles, { factor: 4 });
        const tenKeep = resampleCandles(candles, { factor: 4, keepIncomplete: true });
        // degenerate bars: missing high/low fall back to max/min(open, close) when NO bar in the group supplies
        // one; a missing open falls back to close; a missing volume counts as 1 (the documented world.js rule)
        const allMissingHL = [
            { timestamp: 0, open: 10, high: undefined, low: undefined, close: 12, volume: 5 },
            { timestamp: 1, open: undefined, high: undefined, low: undefined, close: 11, volume: undefined },
        ];
        const aggHL = resampleCandles(allMissingHL, { factor: 2 });
        // one bar DOES supply high/low -> the extreme is taken from it (no fallback)
        const oneFinite = [
            { timestamp: 0, open: 10, high: undefined, low: undefined, close: 12, volume: 5 },
            { timestamp: 1, open: undefined, high: 15, low: 9, close: 11, volume: undefined },
        ];
        const aggOne = resampleCandles(oneFinite, { factor: 2 });
        const throws = [0, -1, 1.5, NaN, '2'].every((f) => { try { resampleCandles(candles, { factor: f }); return false; } catch { return true; } });
        const arrThrows = (() => { try { resampleCandles('nope', { factor: 2 }); return false; } catch { return true; } })();
        const shortKeep = resampleCandles(candles.slice(0, 3), { factor: 4, keepIncomplete: true });
        const shortDrop = resampleCandles(candles.slice(0, 3), { factor: 4 });
        rows.resampleEdges = {
            tenLen: ten.length, tenKeepLen: tenKeep.length,
            allMissingHL: aggHL[0], oneFiniteGroup: aggOne[0],
            throws, arrThrows, shortKeepLen: shortKeep.length, shortDropLen: shortDrop.length,
        };
        return ten.length === 2 && tenKeep.length === 3 && throws && arrThrows
            && close(aggHL[0].open, 10, 1e-12) && close(aggHL[0].close, 11, 1e-12)
            && close(aggHL[0].high, 11, 1e-12) && close(aggHL[0].low, 10, 1e-12) && close(aggHL[0].volume, 6, 1e-12)
            && close(aggOne[0].high, 15, 1e-12) && close(aggOne[0].low, 9, 1e-12) && close(aggOne[0].volume, 6, 1e-12)
            && shortKeep.length === 1 && shortDrop.length === 0;
    })();

    // ============================== B. the design effect ===============================================
    checks.designEffectIdentities = (() => {
        const a = mkSeries(240, 1);
        const b = mkSeries(240, 2);
        const c = mkSeries(240, 3);
        const res = designEffectOfStreams({ a, b, c });
        const rbarRef = refMeanPairwise([a, b, c]);
        const identities = res.available
            && close(res.rawBars, res.K * res.T, 1e-12)
            && close(res.designEffect, 1 + (res.K - 1) * res.meanPairwiseCorr, 1e-12)
            && close(res.effectiveBars, res.rawBars / res.designEffect, 1e-12)
            && close(res.effectiveStreams, res.K / res.designEffect, 1e-12)
            && close(res.effectiveBarsPerBar, 1 / res.designEffect, 1e-12);
        const rbarMatch = close(res.meanPairwiseCorr, rbarRef, 1e-15);
        rows.designEffect = { K: res.K, T: res.T, rbar: res.meanPairwiseCorr, rbarRef, designEffect: res.designEffect, effectiveStreams: res.effectiveStreams, effectiveBars: res.effectiveBars, rawBars: res.rawBars, identities, rbarMatch };
        return identities && rbarMatch;
    })();

    checks.designEffectClosedForms = (() => {
        const a = mkSeries(200, 4);
        const single = designEffectOfStreams({ a });
        const identical = designEffectOfStreams({ a, b: a.slice() });
        // three identical streams -> rbar 1, DE 3, effectiveStreams 1
        const tri = designEffectOfStreams({ a, b: a.slice(), c: a.slice() });
        // alignment: different lengths -> T = min
        const short = mkSeries(120, 5);
        const aligned = designEffectOfStreams({ long: a, short });
        // hedging pair -> DE <= 0 -> unavailable
        const hedge = designEffectOfStreams({ a, anti: a.map((v) => -v) });
        const tooShort = designEffectOfStreams({ a: [1, 2], b: [3, 4] });
        const notArray = designEffectOfStreams({ a, b: 'nope' });
        const empty = designEffectOfStreams({});
        rows.designEffectForms = {
            single: { available: single.available, DE: single.designEffect, effStreams: single.effectiveStreams, effBars: single.effectiveBars, rawBars: single.rawBars, T: single.T },
            identical: { rbar: identical.meanPairwiseCorr, DE: identical.designEffect, effStreams: identical.effectiveStreams, effBars: identical.effectiveBars, rawBars: identical.rawBars, T: identical.T },
            triple: { rbar: tri.meanPairwiseCorr, DE: tri.designEffect, effStreams: tri.effectiveStreams, effBars: tri.effectiveBars },
            aligned: { T: aligned.T, K: aligned.K, rawBars: aligned.rawBars },
            hedgeAvailable: hedge.available, hedgeReason: hedge.reason,
            tooShortReason: tooShort.reason, notArrayReason: notArray.reason, emptyReason: empty.reason,
        };
        return single.available && single.designEffect === 1 && single.effectiveStreams === 1 && close(single.effectiveBars, single.T, 1e-12) && close(single.rawBars, single.T, 1e-12)
            && close(identical.meanPairwiseCorr, 1, 1e-15) && close(identical.designEffect, 2, 1e-15) && close(identical.effectiveStreams, 1, 1e-15)
            && close(tri.designEffect, 3, 1e-15) && close(tri.effectiveStreams, 1, 1e-15)
            && aligned.T === 120 && close(aligned.rawBars, 2 * 120, 1e-12)
            && hedge.available === false && tooShort.available === false && notArray.available === false && empty.available === false;
    })();

    checks.designEffectFoldSharpe = (() => {
        const a = mkSeries(200, 6);
        const b = mkSeries(200, 7);
        const foldLength = 20; // tiles 200
        const res = designEffectOfStreams({ a, b }, { foldLength });
        const seg = (s) => { const out = []; for (let f = 0; f < s.length; f += foldLength) out.push(sharpeRatio(s.slice(f, f + foldLength), { periodsPerYear: 252 })); return out; };
        const ref = refMeanPairwise([seg(a), seg(b)]);
        const raw = designEffectOfStreams({ a, b }); // no fold length -> raw returns
        const noTile = designEffectOfStreams({ a, b }, { foldLength: 21 }); // does not tile 200
        rows.foldSharpe = { method: res.method, rbar: res.meanPairwiseCorr, ref, rawMethod: raw.method, noTileMethod: noTile.method, foldLength: res.foldLength };
        return res.method === 'fold-sharpe' && close(res.meanPairwiseCorr, ref, 1e-12) && raw.method === 'raw-returns' && noTile.method === 'raw-returns';
    })();

    // ============================== C. the selector ====================================================
    checks.selectStreamsContract = (() => {
        const a = mkSeries(240, 11);
        const b = mkSeries(240, 12);
        const c = mkSeries(240, 13);
        const d = mkSeries(240, 14);
        const sel = selectStreams({ seriesByLabel: { a, b, c, d } });
        const det = deepEq(selectStreams({ seriesByLabel: { a, b, c, d } }), sel);
        const orderMatches = deepEq(sel.order, sel.curve.map((e) => e.label));
        let monotone = true, marginalOk = true, prev = 0, prevRaw = 0;
        for (const e of sel.curve) {
            if (e.effectiveBars < prev - 1e-9) monotone = false;
            const added = e.rawBars - prevRaw;
            if (added > 0 && !close(e.marginalEfficiency, (e.effectiveBars - prev) / added, 1e-12)) marginalOk = false;
            if (!close(e.marginalBars, e.effectiveBars - prev, 1e-12)) marginalOk = false;
            prev = e.effectiveBars; prevRaw = e.rawBars;
        }
        // redundant pool: three copies of one stream -> one pick (ties by label)
        const redundant = selectStreams({ seriesByLabel: { z: a, x: a.slice(), y: a.slice() } });
        // diversifying kept over a redundant copy
        const dup = selectStreams({ seriesByLabel: { copy: a, other: b } });
        // maxStreams honored
        const capped = selectStreams({ seriesByLabel: { a, b, c, d }, maxStreams: 2 });
        rows.selector = {
            chosen: sel.chosen, order: sel.order, curveLabels: sel.curve.map((e) => e.label),
            det, orderMatches, monotone, marginalOk,
            redundantChosen: redundant.chosen, dupChosen: dup.chosen, cappedChosen: capped.chosen,
        };
        return det && orderMatches && monotone && marginalOk
            && deepEq(redundant.chosen, ['x']) && capped.chosen.length === 2 && dup.chosen.length === 2;
    })();

    checks.selectStreamsEdges = (() => {
        const a = mkSeries(240, 21);
        const b = mkSeries(240, 22);
        const zero = selectStreams({ seriesByLabel: { a, b }, maxStreams: 0 });
        const neg = selectStreams({ seriesByLabel: { a, b }, maxStreams: -3 });
        const avail = selectStreams({ seriesByLabel: { a: [1, 2], b: [3, 4] } });
        const minEff = selectStreams({ seriesByLabel: { a, b }, minMarginalEfficiency: 10 });
        rows.selectorEdges = {
            maxStreams0Chosen: zero.chosen, maxStreamsNegChosen: neg.chosen,
            unavailable: avail.available, minEffChosen: minEff.chosen,
        };
        return avail.available === false && zero.chosen.length > 0 && neg.chosen.length > 0 && minEff.chosen.length === 0;
    })();

    checks.formatStreamSelection = (() => {
        const a = mkSeries(200, 31);
        const b = mkSeries(200, 32);
        const sel = selectStreams({ seriesByLabel: { a, b } });
        const s = formatStreamSelection(sel);
        const un = formatStreamSelection({ available: false, reason: 'x' });
        const nul = formatStreamSelection(null);
        rows.format = { hasHeader: /^streams: 2 streams, rbar=/.test(s), hasDesign: /designEffect=/.test(s), lines: s.split('\n').length, un, nul };
        return s.startsWith('streams: 2 streams') && s.includes('designEffect=') && s.includes('effectiveStreams=') && un === 'streams: unavailable (x)' && nul === null;
    })();

    // ============================== D. findings ========================================================
    // (FINDING 1) a zero-variance (constant) stream is skipped from rbar but still counted in K and rawBars.
    checks.constantStreamCountedInK = (() => {
        // two genuinely independent streams (different deterministic components AND noise) + one constant
        const a = mkSeries(240, 41, 0.13, 0.0);
        const b = mkSeries(240, 42, 0.29, 2.1);
        const c = new Array(240).fill(0); // constant: carries no information
        const two = designEffectOfStreams({ a, b });
        const three = designEffectOfStreams({ a, b, c });
        rows.constantStream = {
            two: { rbar: two.meanPairwiseCorr, K: two.K, T: two.T, designEffect: two.designEffect, effectiveStreams: two.effectiveStreams, effectiveBars: two.effectiveBars, rawBars: two.rawBars },
            three: { rbar: three.meanPairwiseCorr, K: three.K, T: three.T, designEffect: three.designEffect, effectiveStreams: three.effectiveStreams, effectiveBars: three.effectiveBars, rawBars: three.rawBars },
            note: 'the constant stream cannot be correlated with anything, so every pair involving it is skipped by meanPairwiseCorrelation — yet it is still counted in K and in rawBars = K*T. `e65` (two independent streams + one constant, T = 240): rbar is BIT-IDENTICAL with and without the constant stream (-0.0133166822 both), rawBars goes 480 -> 720, and effectiveStreams goes 2.027 -> 3.082 (a full extra unit, slightly MORE than one because the noise-set rbar is negative). So a no-information stream buys a full unit of "effective breadth" in the printed report, while the selector DOES skip it (its candidate is unavailable: rbar with a constant partner is NaN), so `designEffectOfStreams` and `selectStreams` disagree about whether it is a stream. LATENT (a flat/halted stream in the panel — the L10-l class) and diagnostic-only.',
        };
        // pin the module's actual behaviour (the finding is the inflation): rbar is BIT-IDENTICAL with and
        // without the constant stream (its pairs are all skipped), yet effectiveStreams/effectiveBars each gain
        // a full stream's worth.
        return three.rawBars === 3 * three.T && two.rawBars === 2 * two.T
            && three.meanPairwiseCorr === two.meanPairwiseCorr
            && three.effectiveStreams > two.effectiveStreams + 0.9
            && three.designEffect < 1.05;
    })();

    const findingConstantStream = rows.constantStream;
    const findingMaxStreamsZero = {
        claim: 'the selector "stop[s] when the best remaining candidate cannot improve effective bars" and honours `maxStreams`',
        witness: rows.selectorEdges,
        note: '`maxStreams <= 0` is silently treated as UNLIMITED: the limit is `Number.isFinite(maxStreams) && maxStreams > 0 ? Math.floor(maxStreams) : all.length`, so `maxStreams: 0` and `maxStreams: -3` both select streams instead of none. The shipped check only exercises `maxStreams: 2`, so it cannot see this. LATENT (analyze.js passes a positive/Infinity value), but it is an API contract gap of the same class as L10-bj (`successiveHalving` not validating `eta`/`minBudget`).',
    };

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = (v && typeof v.then === 'function') ? await v : v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-ca..: `analysis/streams.js` is the SHIPPED stream design layer (round 26, R26-6) that analyze.js prints in every run report: `resampleCandles` (a second bar interval without a second dataset), `designEffectOfStreams` (Kish 1965 design effect), `selectStreams` (greedy marginal-breadth selection) and `formatStreamSelection`. PASSES the pre-registered read: the resampler reproduces a hand recompute and the OHLCV invariants exactly, never mutates its input, is a shallow copy at factor 1, drops a trailing partial group unless `keepIncomplete`, honours the documented non-finite fallbacks (high/low -> max/min(open, close); a missing volume counts as 1) and rejects a bad factor/array; the design effect satisfies every Kish identity (rawBars = K*T; DE = 1+(K-1)*rbar; effectiveBars = rawBars/DE; effectiveStreams = K/DE; effectiveBarsPerBar = 1/DE), reports K=1 as the trivial panel, two/three identical streams as one bet (rbar 1, DE 2/3, effectiveStreams 1), aligns different-length streams on their most recent T = min-length bars, selects the fold-Sharpe method iff the fold tiles T (with rbar equal to an independent segmentation), and abstains on the documented degenerate panels; and `selectStreams` is deterministic, tie-breaks by label, returns order = the curve labels, is monotone in effective bars, computes marginalBars/marginalEfficiency exactly, keeps a diversifying stream over a redundant copy, stops on a fully redundant pool, and honours a positive maxStreams. FINDINGS: (0) a zero-variance (constant) stream is skipped from every correlation pair (so it never raises rbar) yet is still counted in K and in rawBars = K*T — a no-information stream buys a full unit of "effective breadth" in the printed report (a 3-stream panel where one is constant reads effectiveStreams ~3, rawBars 3T); the selector does skip it, so `designEffectOfStreams` and `selectStreams` disagree; (1) maxStreams <= 0 is silently treated as UNLIMITED rather than none. Both are diagnostic-layer/latent: the docstring says the numbers never enter the scored arithmetic, and analyze.js passes a positive maxStreams, so no golden moves.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            constantStreamCountedInK: findingConstantStream,
            maxStreamsZeroMeansUnlimited: findingMaxStreamsZero,
        },
        scope: {
            shipped: ['analyze.js imports resampleCandles, designEffectOfStreams, selectStreams, formatStreamSelection', 'world.js imports barReturns only'],
            diagnosticOnly: true,
            why: 'The module is shipped but the docstring and the lock registry both say the design numbers are a DIAGNOSTIC/DESIGN quantity that never enters the scored arithmetic (the deflated Sharpe keeps trials=K). Both findings are latent (a flat stream in the panel; a non-positive maxStreams that analyze.js never passes), so no golden moves and no fold-back row is due.',
        },
    };

    return { config: { resampleFixtures: 4, series: 240 }, rows, validation: resolved, verdict };
}
