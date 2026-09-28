// E44 - WHAT IS THE CAP ACTUALLY DOING? CONCENTRATION LIMIT OR NO-TRADE BAND? CYCLE-035 (L17 x L16).
//
// F-27/F-50 establish that a strict per-symbol cap (|w_j| <= 1/k = 0.125) *helps* the R8 dispersion
// book: at λ=0.02 it lifts the full-window net@4 Sharpe 4.92 -> 6.18 (F-50's OOS read was 6.63 -> 6.86)
// and cuts turnover 17 -> 10×/yr, and it roughly doubles the OI position capacity ($20.4 M -> $35.9 M,
// F-41/F-27). F-50 treats the cap as a *capacity* add and a *structural plateau*. But the cap changes
// TWO things at once:
//
//   (1) CONCENTRATION — it clips the largest positions (max |w| 0.438 -> 0.125), which is what raises the
//       per-symbol OI capacity; and
//   (2) TURNOVER — clipping large moves also shortens the weight path, cutting turnover (17 -> 10×/yr),
//       which is what raises the *net* Sharpe (a gross-blind improvement cannot come from Sharpe alone).
//
// A no-trade band (only rebalance symbol j when |target_j - held_j| > eps) is a *pure* turnover tool: it
// does NOT change the target's concentration, so it should cut turnover without lifting capacity. If a
// turnover-matched banded book reproduces the capped book's *net* gain, then the cap's Sharpe benefit was
// really a turnover effect (F-50's "the cap helps" is a *net* claim that a cheaper construction can match),
// while its capacity benefit remains genuinely about concentration. That would refine the port spec:
// the cap is needed for size, and a band can be stacked for cost.
//
// This experiment rebuilds the R8 λ=0.02 rank-funding book (guarding e30 exactly: base net@4 4.92 /
// turnover 17 / break-even 39.63 / OI@5% $20.415 M; capped net@4 6.18 / turnover 10 / break-even 46.04 /
// OI@5% $35.937 M), then compares, at MATCHED TURNOVER:
//
//   base            ewma 0.02, no cap                     (the e30/F-24 spec)
//   capped          base + strict 12.5 % clip             (the F-27/F-50 spec)
//   band(eps)       base + no-trade band, eps swept       (turnover tool, concentration unchanged)
//   capped+band     capped + no-trade band                (can the two stack?)
//
// for each book: gross/net@4 Sharpe, turnover, break-even, mean|w| and max|w| (concentration), the
// ratio-of-means OI capacity (e30's convention) and the honest **min-of-ratio** schedule (F-41/F-42).
//
// PRE-REGISTERED READ.
//   * "The cap's NET benefit is a turnover effect" is SUPPORTED if the turnover-matched banded uncapped
//     book's net@4 is within 0.2 Sharpe of the capped book's.
//   * "The cap's CAPACITY benefit is a concentration effect" is SUPPORTED if the turnover-matched banded
//     uncapped book's OI capacity is materially below the capped book's (the band does not lift max|w|,
//     so it cannot lift the min-of-ratio bound) — say the capped capacity is >= 1.3× the banded one.
//
// GUARD. base and capped must reproduce e30's stored `ewma_0.02_norm` / `ewma_0.02_norm_cap12.5` full-window
// reads (net@4 / turnover / break-even) and the 5 %-of-mean-OI position capacity, or the builders diverged
// and nothing here counts.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const F_PART = 0.05;
const LAMBDA = 0.02;
const CAP = 0.125;

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sdOf = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sdOf(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const quantile = (arr, q) => { const v = arr.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!v.length) return NaN; const pos = (v.length - 1) * q; const lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };
const usdM = (x) => (Number.isFinite(x) ? +(x / 1e6).toFixed(2) : null);

// Strict per-symbol cap (F-27): clip and HOLD, no renormalisation (exactly e30#applyCap).
function applyCap(weightRows, cap) {
    return weightRows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x)));
}
// No-trade band: move symbol j only if the target weight has moved more than eps from what is held.
// A pure turnover tool — it never changes the target's concentration, only when it is adopted.
function applyBand(weightRows, eps) {
    const k = weightRows[0].length;
    let held = new Array(k).fill(0);
    return weightRows.map((w) => { const out = w.map((x, j) => (Math.abs(x - held[j]) > eps ? x : held[j])); held = out; return out; });
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const names = s.config.symbolList;
    const legs = s.legs;
    const bookTimes = legs.times.slice(1);
    const n = bookTimes.length;

    const oi = await loadOpenInterest();
    const oiValBySym = names.map((nm) => {
        const o = oi[nm];
        if (!o) return null;
        const arr = new Array(n).fill(null);
        for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, bookTimes[i]); arr[i] = idx >= 0 ? o.oiVal[idx] : null; }
        return arr;
    });
    const oiMean = names.map((_, j) => { const v = oiValBySym[j] ? oiValBySym[j].filter((x) => x > 0) : []; return v.length ? mean(v) : NaN; });
    const oiAt = (t) => names.map((nm) => { const o = oi[nm]; if (!o) return null; const idx = flowIndexAt(o, bookTimes[t]); return idx >= 0 ? o.oiVal[idx] : null; });

    const retsFor = (weightRows) => weightRows.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * (fin(bp[j]) + fin(fr[j])), 0); });

    // ---- metric bundle for one weight path ----
    const metricsOf = (weightRows) => {
        const rets = retsFor(weightRows);
        const T = turnoverSeries(weightRows);
        const net4 = rets.map((r, i) => r - (FEE_BPS / 1e4) * T[i]);
        const meanAbsW = names.map((_, j) => mean(weightRows.map((w) => Math.abs(w[j]))));
        const maxAbsW = Math.max(...weightRows.map((w) => Math.max(...w.map((x) => Math.abs(x)))));
        // ratio-of-means OI capacity (e30's convention)
        let G5 = Infinity; let bind = -1;
        for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && oiMean[j] > 0) { const g = (F_PART * oiMean[j]) / meanAbsW[j]; if (g < G5) { G5 = g; bind = j; } }
        // honest min-of-ratio schedule (F-41/F-42): G_t = f * min_j OI_j(t)/|w_j(t)|
        const Gt = [];
        for (let t = 0; t < weightRows.length; t++) {
            const ov = oiAt(t);
            if (!ov) continue;
            let g = Infinity; let ok = true;
            for (let j = 0; j < k; j++) { const w = Math.abs(weightRows[t][j]); if (w <= 1e-12) continue; const o = ov[j]; if (!(o > 0)) { ok = false; break; } const r = o / w; if (r < g) g = r; }
            if (ok && g !== Infinity) Gt.push(F_PART * g);
        }
        return {
            n: rets.length,
            grossSharpe: r2(sharpe(rets)),
            net4Sharpe: r2(sharpe(net4)),
            turnoverAnnual: Math.round(mean(T) * PPY),
            breakEvenBps: mean(T) > 0 ? r2((mean(rets) * 1e4) / mean(T)) : null,
            meanAbsW: +mean(meanAbsW).toFixed(4),
            maxAbsW: +maxAbsW.toFixed(4),
            oi5RatioOfMeansUSD: Number.isFinite(G5) ? Math.round(G5) : null,
            oi5RatioOfMeansBinding: bind >= 0 ? names[bind] : null,
            oiMinRatioMeanUSD: Number.isFinite(mean(Gt)) ? Math.round(mean(Gt)) : null,
            oiMinRatioMedianUSD: Number.isFinite(quantile(Gt, 0.5)) ? Math.round(quantile(Gt, 0.5)) : null,
            oiMinRatioP5USD: Number.isFinite(quantile(Gt, 0.05)) ? Math.round(quantile(Gt, 0.05)) : null,
        };
    };

    const baseBuilt = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: LAMBDA, normalize: true } });
    const baseRows = baseBuilt.weightRows;
    const capRows = applyCap(baseRows, CAP);

    const base = metricsOf(baseRows);
    const capped = metricsOf(capRows);

    // ---- guard against e30 ----
    let e30 = null;
    try { e30 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e30_retuned_capacity.json')); } catch (e) { e30 = null; }
    const e30b = e30 ? e30.books['ewma_0.02_norm'] : null;
    const e30c = e30 ? e30.books['ewma_0.02_norm_cap12.5'] : null;
    const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
    const validation = (e30b && e30c) ? {
        base: { e30Net4: e30b.windows.full.net4Sharpe, hereNet4: base.net4Sharpe, e30Turnover: e30b.windows.full.turnoverAnnual, hereTurnover: base.turnoverAnnual, e30BreakEven: e30b.windows.full.breakEvenBps, hereBreakEven: base.breakEvenBps, e30Oi5: Math.round(e30b.oiPositionCapacity_at_5pct), hereOi5: base.oi5RatioOfMeansUSD },
        capped: { e30Net4: e30c.windows.full.net4Sharpe, hereNet4: capped.net4Sharpe, e30Turnover: e30c.windows.full.turnoverAnnual, hereTurnover: capped.turnoverAnnual, e30BreakEven: e30c.windows.full.breakEvenBps, hereBreakEven: capped.breakEvenBps, e30Oi5: Math.round(e30c.oiPositionCapacity_at_5pct), hereOi5: capped.oi5RatioOfMeansUSD },
        matchesE30: near(base.net4Sharpe, e30b.windows.full.net4Sharpe, 0.02) && near(base.turnoverAnnual, e30b.windows.full.turnoverAnnual, 1) && near(base.breakEvenBps, e30b.windows.full.breakEvenBps, 0.05)
            && near(capped.net4Sharpe, e30c.windows.full.net4Sharpe, 0.02) && near(capped.turnoverAnnual, e30c.windows.full.turnoverAnnual, 1) && near(capped.breakEvenBps, e30c.windows.full.breakEvenBps, 0.05)
            && near(base.oi5RatioOfMeansUSD, Math.round(e30b.oiPositionCapacity_at_5pct), 1) && near(capped.oi5RatioOfMeansUSD, Math.round(e30c.oiPositionCapacity_at_5pct), 1),
        note: 'base and capped must reproduce e30#ewma_0.02_norm(+cap12.5) full-window net@4 / turnover / break-even and the 5%-of-mean-OI capacity.',
    } : null;

    // ---- the band sweep: find eps matching the capped book's net-of-fee turnover cost ----
    const capCost = mean(turnoverSeries(capRows));
    const epsGrid = [0.001, 0.0015, 0.002, 0.003, 0.004, 0.005, 0.006, 0.008, 0.010, 0.015, 0.020, 0.030];
    const bandSweep = epsGrid.map((eps) => { const m = metricsOf(applyBand(baseRows, eps)); return { eps, ...m }; });
    let best = null; let bestD = Infinity;
    for (const b of bandSweep) { const d = Math.abs(mean(turnoverSeries(applyBand(baseRows, b.eps))) - capCost); if (d < bestD) { bestD = d; best = b; } }
    const matchedEps = best ? best.eps : null;
    const bandMatchedRows = best ? applyBand(baseRows, best.eps) : null;
    const bandMatched = best;

    // ---- can a band stack on the cap? ----
    const capBandSweep = epsGrid.filter((e) => e <= 0.006).map((eps) => { const m = metricsOf(applyBand(capRows, eps)); return { eps, ...m }; });
    const capBandBest = capBandSweep.slice().sort((a, b) => (b.net4Sharpe || -1e9) - (a.net4Sharpe || -1e9))[0] || null;
    const capBandMatched = capBandSweep.slice().sort((a, b) => Math.abs(a.turnoverAnnual - 8) - Math.abs(b.turnoverAnnual - 8))[0] || null;

    // ---- verdict ----
    const capNetGain = r2((capped.net4Sharpe ?? 0) - (base.net4Sharpe ?? 0));
    const bandNetGain = bandMatched ? r2((bandMatched.net4Sharpe ?? 0) - (base.net4Sharpe ?? 0)) : null;
    const netGainIsTurnover = bandMatched != null && Math.abs((bandMatched.net4Sharpe ?? -1e9) - (capped.net4Sharpe ?? -1e9)) <= 0.2;
    const capCapacityGainRM = (capped.oi5RatioOfMeansUSD && base.oi5RatioOfMeansUSD) ? r2(capped.oi5RatioOfMeansUSD / base.oi5RatioOfMeansUSD) : null;
    const bandCapacityGainRM = (bandMatched && bandMatched.oi5RatioOfMeansUSD && base.oi5RatioOfMeansUSD) ? r2(bandMatched.oi5RatioOfMeansUSD / base.oi5RatioOfMeansUSD) : null;
    const capCapacityGainMin = (capped.oiMinRatioMeanUSD && base.oiMinRatioMeanUSD) ? r2(capped.oiMinRatioMeanUSD / base.oiMinRatioMeanUSD) : null;
    const bandCapacityGainMin = (bandMatched && bandMatched.oiMinRatioMeanUSD && base.oiMinRatioMeanUSD) ? r2(bandMatched.oiMinRatioMeanUSD / base.oiMinRatioMeanUSD) : null;
    const capacityGainIsConcentration = bandMatched != null && (capped.oiMinRatioMeanUSD ?? 0) >= 1.3 * (bandMatched.oiMinRatioMeanUSD ?? Infinity);
    const stackingHelps = capBandBest != null && (capBandBest.net4Sharpe ?? -1e9) > (capped.net4Sharpe ?? -1e9) + 0.1;

    const verdict = {
        note: 'Decompose the cap: a turnover-matched no-trade band (pure turnover tool) vs the cap (turnover + concentration).',
        baseNet4: base.net4Sharpe, cappedNet4: capped.net4Sharpe,
        capNetGain,
        matchedBandEps: matchedEps,
        matchedBandTurnover: bandMatched ? bandMatched.turnoverAnnual : null,
        cappedTurnover: capped.turnoverAnnual,
        matchedBandNet4: bandMatched ? bandMatched.net4Sharpe : null,
        bandNetGain,
        netGainIsTurnover,
        baseMaxAbsW: base.maxAbsW, cappedMaxAbsW: capped.maxAbsW, bandMaxAbsW: bandMatched ? bandMatched.maxAbsW : null,
        baseOi5RM: base.oi5RatioOfMeansUSD, cappedOi5RM: capped.oi5RatioOfMeansUSD, bandOi5RM: bandMatched ? bandMatched.oi5RatioOfMeansUSD : null,
        baseOiMinMean: base.oiMinRatioMeanUSD, cappedOiMinMean: capped.oiMinRatioMeanUSD, bandOiMinMean: bandMatched ? bandMatched.oiMinRatioMeanUSD : null,
        capCapacityGainRM, bandCapacityGainRM, capCapacityGainMin, bandCapacityGainMin,
        capacityGainIsConcentration,
        capBandBestEps: capBandBest ? capBandBest.eps : null,
        capBandBestNet4: capBandBest ? capBandBest.net4Sharpe : null,
        capBandBestTurnover: capBandBest ? capBandBest.turnoverAnnual : null,
        stackingHelps,
        validationPass: validation ? validation.matchesE30 : null,
    };

    return {
        config: { symbols: k, symbolList: names, periods: n, lambda: LAMBDA, cap: CAP, feeBps: FEE_BPS, f: F_PART },
        validation,
        base,
        capped,
        bandSweep,
        capBandSweep,
        verdict,
    };
}
