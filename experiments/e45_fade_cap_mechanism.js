// E45 - DOES THE CAP-MECHANISM RESULT (F-52) TRANSFER TO THE FADE? CYCLE-036 (L18 x L17, tests F-51/F-52).
//
// CYCLE-035 (F-52) showed that on the R8 carry-dispersion book the 12.5 % cap works by *concentration*,
// not by reducing churn: a no-trade band swept to the cap's exact turnover recovers only +0.13 of the cap's
// +1.26 net@4 gain, and the band leaves OI capacity a 1.00x multiple of base while the cap is 1.70-1.76x.
// The cap also *stacks* with a band (R8: net@4 6.36 at 6x/yr vs 6.18 at 10).
//
// F-51 showed the cap also transfers to the lab's other deployable sleeve, R7 (the toptrader fade): at
// λ=0.1 it lifts the full net@4 0.79 -> 1.00 and the OI bound $36.99 M -> $53.84 M, but on the OOS span it
// costs recent-24 m Sharpe (0.84 -> 0.47). This experiment asks whether the *mechanism* is the same —
// concentration, not churn — on the fade, and whether a band stacks there too. The fade is a different
// animal (Sharpe ~0.8, weak signal, already cheap at 14-23x/yr), so a null transfer is also informative.
//
// Rebuilds the fade λ=0.05 book (`e22#buildMasked`, sign -1) and guards `e32` exactly: base
// (`lam0.05`) full net@4 0.82 / turnover 14 / break-even 118.38 / OI@5% $37,378,256; capped
// (`lam0.05_cap0.125`) full net@4 1.07 / turnover 8 / break-even 182.59 / OI@5% $54,782,334.
//
// PRE-REGISTERED READ (same as F-52).
//   * "The fade cap's NET benefit is a turnover effect" is SUPPORTED if the turnover-matched banded
//     uncapped fade's net@4 is within 0.2 Sharpe of the capped fade's.
//   * "The fade cap's CAPACITY benefit is a concentration effect" is SUPPORTED if the turnover-matched
//     banded uncapped fade's OI capacity is materially below the capped fade's (>= 1.3x).

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildMasked } from './e22_toptrader_validate.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const F_PART = 0.05;
const NEXT = 2;
const LAMBDA = 0.05; // the F-51 pinned fade scale
const CAP = 0.125;

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sdOf = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sdOf(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const quantile = (arr, q) => { const v = arr.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!v.length) return NaN; const pos = (v.length - 1) * q; const lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };

const applyCap = (rows, cap) => rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x)));
function applyBand(weightRows, eps) {
    const k = weightRows[0].length;
    let held = new Array(k).fill(0);
    return weightRows.map((w) => { const out = w.map((x, j) => (Math.abs(x - held[j]) > eps ? x : held[j])); held = out; return out; });
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList;
    const k = names.length;
    const times = s.times;
    const n = times.length;
    const legs = s.legs;

    const oi = await loadOpenInterest();
    const topLS = names.map((nm) => { const o = oi[nm]; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.topLS[idx] : null; } return arr; });
    let firstTop = -1;
    for (let i = 1; i < n - 2; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(topLS[j][i])) all = false; if (all) { firstTop = i; break; } }
    const oiValBySym = names.map((nm) => { const o = oi[nm]; if (!o) return null; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.oiVal[idx] : null; } return arr; });
    const oiMean = names.map((_, j) => { const v = oiValBySym[j] ? oiValBySym[j].filter((x) => x > 0) : []; return v.length ? mean(v) : NaN; });

    const built = buildMasked(topLS, k, legs, times, { sign: -1, from: firstTop, policy: { kind: 'ewma', lambda: LAMBDA, normalize: true } });
    const bookTimes = built.bookTimes;
    const P = built.weightRows.length;
    const oiAt = (t) => names.map((nm) => { const o = oi[nm]; if (!o) return null; const idx = flowIndexAt(o, bookTimes[t]); return idx >= 0 ? o.oiVal[idx] : null; });

    const retsFor = (weightRows) => weightRows.map((w, t) => { const sr = legs.spotRet[firstTop + t + NEXT]; return w.reduce((a, x, j) => a + x * (sr && Number.isFinite(sr[j]) ? sr[j] : 0), 0); });

    const metricsOf = (weightRows) => {
        const rets = retsFor(weightRows);
        const T = turnoverSeries(weightRows);
        const net4 = rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i]);
        const meanAbsW = names.map((_, j) => mean(weightRows.map((w) => Math.abs(w[j]))));
        const maxAbsW = Math.max(...weightRows.map((w) => Math.max(...w.map((x) => Math.abs(x)))));
        let G5 = Infinity; let bind = -1;
        for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && oiMean[j] > 0) { const g = (F_PART * oiMean[j]) / meanAbsW[j]; if (g < G5) { G5 = g; bind = j; } }
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

    const baseRows = built.weightRows;
    const capRows = applyCap(baseRows, CAP);
    const base = metricsOf(baseRows);
    const capped = metricsOf(capRows);

    let e32 = null;
    try { e32 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e32_fade_retune.json')); } catch (e) { e32 = null; }
    const e32b = e32 ? e32.books['lam0.05'] : null;
    const e32c = e32 ? e32.books['lam0.05_cap0.125'] : null;
    const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
    const validation = (e32b && e32c) ? {
        base: { e32Net4: e32b.full.net4Sharpe, hereNet4: base.net4Sharpe, e32Turnover: e32b.full.turnoverAnnual, hereTurnover: base.turnoverAnnual, e32BreakEven: e32b.full.breakEvenBps, hereBreakEven: base.breakEvenBps, e32Oi5: Math.round(e32b.oiBound5pct), hereOi5: base.oi5RatioOfMeansUSD },
        capped: { e32Net4: e32c.full.net4Sharpe, hereNet4: capped.net4Sharpe, e32Turnover: e32c.full.turnoverAnnual, hereTurnover: capped.turnoverAnnual, e32BreakEven: e32c.full.breakEvenBps, hereBreakEven: capped.breakEvenBps, e32Oi5: Math.round(e32c.oiBound5pct), hereOi5: capped.oi5RatioOfMeansUSD },
        matchesE32: near(base.net4Sharpe, e32b.full.net4Sharpe, 0.02) && near(base.turnoverAnnual, e32b.full.turnoverAnnual, 1) && near(base.breakEvenBps, e32b.full.breakEvenBps, 0.05)
            && near(capped.net4Sharpe, e32c.full.net4Sharpe, 0.02) && near(capped.turnoverAnnual, e32c.full.turnoverAnnual, 1) && near(capped.breakEvenBps, e32c.full.breakEvenBps, 0.05)
            && near(base.oi5RatioOfMeansUSD, Math.round(e32b.oiBound5pct), 1) && near(capped.oi5RatioOfMeansUSD, Math.round(e32c.oiBound5pct), 1),
        note: 'base/capped must reproduce e32#lam0.05(+cap0.125) full-window net@4 / turnover / break-even and the 5%-of-mean-OI bound.',
    } : null;

    const capCost = mean(turnoverSeries(capRows));
    const epsGrid = [0.001, 0.002, 0.003, 0.004, 0.005, 0.007, 0.010, 0.015, 0.020, 0.030, 0.050, 0.080];
    const bandSweep = epsGrid.map((eps) => { const m = metricsOf(applyBand(baseRows, eps)); return { eps, ...m }; });
    let best = null; let bestD = Infinity;
    for (const b of bandSweep) { const d = Math.abs(mean(turnoverSeries(applyBand(baseRows, b.eps))) - capCost); if (d < bestD) { bestD = d; best = b; } }
    const bandMatched = best;

    const capBandSweep = epsGrid.filter((e) => e <= 0.010).map((eps) => { const m = metricsOf(applyBand(capRows, eps)); return { eps, ...m }; });
    const capBandBest = capBandSweep.slice().sort((a, b) => (b.net4Sharpe || -1e9) - (a.net4Sharpe || -1e9))[0] || null;

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
        note: 'F-52 applied to R7: turnover-matched no-trade band vs the cap, for the fade.',
        baseNet4: base.net4Sharpe, cappedNet4: capped.net4Sharpe, capNetGain,
        matchedBandEps: bandMatched ? bandMatched.eps : null,
        matchedBandTurnover: bandMatched ? bandMatched.turnoverAnnual : null, cappedTurnover: capped.turnoverAnnual,
        matchedBandNet4: bandMatched ? bandMatched.net4Sharpe : null, bandNetGain,
        netGainIsTurnover,
        baseMaxAbsW: base.maxAbsW, cappedMaxAbsW: capped.maxAbsW, bandMaxAbsW: bandMatched ? bandMatched.maxAbsW : null,
        baseOi5RM: base.oi5RatioOfMeansUSD, cappedOi5RM: capped.oi5RatioOfMeansUSD, bandOi5RM: bandMatched ? bandMatched.oi5RatioOfMeansUSD : null,
        baseOiMinMean: base.oiMinRatioMeanUSD, cappedOiMinMean: capped.oiMinRatioMeanUSD, bandOiMinMean: bandMatched ? bandMatched.oiMinRatioMeanUSD : null,
        capCapacityGainRM, bandCapacityGainRM, capCapacityGainMin, bandCapacityGainMin,
        capacityGainIsConcentration,
        capBandBestEps: capBandBest ? capBandBest.eps : null, capBandBestNet4: capBandBest ? capBandBest.net4Sharpe : null, capBandBestTurnover: capBandBest ? capBandBest.turnoverAnnual : null,
        stackingHelps,
        validationPass: validation ? validation.matchesE32 : null,
    };

    return {
        config: { symbols: k, symbolList: names, periods: P, firstTop, lambda: LAMBDA, cap: CAP, feeBps: FEE_BPS, f: F_PART },
        validation, base, capped, bandSweep, capBandSweep, verdict,
    };
}
