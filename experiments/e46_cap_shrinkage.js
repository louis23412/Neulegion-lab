// E46 - WHY DOES CLIPPING HELP? HARD CAP vs SMOOTH SATURATION vs POWER SHRINKAGE. CYCLE-037 (L16 x L17).
//
// F-52/F-53 established that the 12.5 % cap works by *concentration*, not turnover, on BOTH deployable
// sleeves (R8 net@4 4.92 -> 6.18; R7 fade 0.82 -> 1.07; a turnover-matched no-trade band recovers almost
// none of either). That leaves the mechanism question the ledger has carried since F-52: *why* does cutting
// the concentrated extremes raise net Sharpe? This experiment tests the simplest candidate — that the cap
// is just a **concentration** operation, and *any* transform that reduces concentration to the same degree
// would do the same job — against the alternative that a **hard** constraint is special.
//
// Three families, all applied to the R8 λ=0.02 rank-funding weight rows (no renormalisation — matching
// e30#applyCap, which clips and holds):
//
//   hardCap(c)     w' = clip(w, ±c)                       (the F-27/F-50 spec; c = 1/k = 0.125)
//   softCap(c)     w' = c * tanh(w / c)                   (a smooth saturation: ~w when small, -> ±c large)
//   powerShrink(p) w' = sign(w) * |w|^p   (p > 1)          (a smooth concentration shrink, no hard level)
//
// plus a **flat-rank** control: the equal-weight book on the top/bottom k/2 ranks (max|w| = 1/k exactly,
// the least-concentrated book the rank signal admits). If the cap's gain collapses onto a single
// concentration curve — net@4 a function of mean|w| (or max|w|) across hard/soft/power/flat — then the
// mechanism is simply *concentration*, and a hard constraint is not special (a smooth saturation matches).
// If the hard cap sits above the curve, the hard level matters.
//
// Guards: base (`ewma 0.02`) and hardCap(0.125) must reproduce e30 exactly (full net@4 4.92 / 6.18,
// turnover 17 / 10, break-even 39.63 / 46.04, 5%-of-mean-OI $20,415,294 / $35,937,181).
//
// PRE-REGISTERED READ. "The cap's benefit is concentration" is SUPPORTED if softCap(0.125) is within 0.2
// net@4 of hardCap(0.125) (a smooth saturation of the same level does the same job). It is FALSIFIED if
// hardCap(0.125) beats every smooth transform that reaches the same concentration (mean|w| or max|w|).

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

const hardCap = (rows, c) => rows.map((w) => w.map((x) => (x > c ? c : x < -c ? -c : x)));
const softCap = (rows, c) => rows.map((w) => w.map((x) => c * Math.tanh(x / c)));
const powerShrink = (rows, p) => rows.map((w) => w.map((x) => Math.sign(x) * Math.pow(Math.abs(x), p)));

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const names = s.config.symbolList;
    const legs = s.legs;
    const bookTimes = legs.times.slice(1);
    const n = bookTimes.length;
    const invK = 1 / k; // the structural equal-weight magnitude (0.125 for k=8)

    const oi = await loadOpenInterest();
    const oiValBySym = names.map((nm) => { const o = oi[nm]; if (!o) return null; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, bookTimes[i]); arr[i] = idx >= 0 ? o.oiVal[idx] : null; } return arr; });
    const oiMean = names.map((_, j) => { const v = oiValBySym[j] ? oiValBySym[j].filter((x) => x > 0) : []; return v.length ? mean(v) : NaN; });

    const retsFor = (weightRows) => weightRows.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * (fin(bp[j]) + fin(fr[j])), 0); });

    const metricsOf = (weightRows) => {
        const rets = retsFor(weightRows);
        const T = turnoverSeries(weightRows);
        const net4 = rets.map((r, i) => r - (FEE_BPS / 1e4) * T[i]);
        const meanAbsW = names.map((_, j) => mean(weightRows.map((w) => Math.abs(w[j]))));
        const maxAbsW = Math.max(...weightRows.map((w) => Math.max(...w.map((x) => Math.abs(x)))));
        let G5 = Infinity; let bind = -1;
        for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && oiMean[j] > 0) { const g = (F_PART * oiMean[j]) / meanAbsW[j]; if (g < G5) { G5 = g; bind = j; } }
        return {
            grossSharpe: r2(sharpe(rets)),
            net4Sharpe: r2(sharpe(net4)),
            turnoverAnnual: Math.round(mean(T) * PPY),
            breakEvenBps: mean(T) > 0 ? r2((mean(rets) * 1e4) / mean(T)) : null,
            meanAbsW: +mean(meanAbsW).toFixed(4),
            maxAbsW: +maxAbsW.toFixed(4),
            oi5RatioOfMeansUSD: Number.isFinite(G5) ? Math.round(G5) : null,
            oi5Binding: bind >= 0 ? names[bind] : null,
        };
    };

    const baseBuilt = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: LAMBDA, normalize: true } });
    const baseRows = baseBuilt.weightRows;

    const variants = {};
    variants.base = { kind: 'base', rows: baseRows };
    for (const c of [0.10, 0.125, 0.15, 0.20, 0.30]) variants[`hard_${c}`] = { kind: 'hard', level: c, rows: hardCap(baseRows, c) };
    for (const c of [0.10, 0.125, 0.15, 0.20, 0.30]) variants[`soft_${c}`] = { kind: 'soft', level: c, rows: softCap(baseRows, c) };
    for (const p of [1.25, 1.5, 2, 3]) variants[`power_${p}`] = { kind: 'power', level: p, rows: powerShrink(baseRows, p) };
    // flat-rank control: equal weight (±1/k) on the top/bottom k/2 ranks, zero in the middle, every period.
    const flatRows = baseRows.map((w) => {
        const ord = w.map((x, j) => [x, j]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
        const out = new Array(k).fill(0);
        ord.forEach((j, rank) => { out[j] = rank < k / 2 ? -invK : rank >= k / 2 ? invK : 0; });
        return out;
    });
    variants.flat_rank = { kind: 'flat', level: invK, rows: flatRows };

    const table = {};
    for (const [name, v] of Object.entries(variants)) table[name] = { kind: v.kind, level: v.level, ...metricsOf(v.rows) };

    // guard against e30
    let e30 = null;
    try { e30 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e30_retuned_capacity.json')); } catch (e) { e30 = null; }
    const e30b = e30 ? e30.books['ewma_0.02_norm'] : null;
    const e30c = e30 ? e30.books['ewma_0.02_norm_cap12.5'] : null;
    const b = table.base; const h = table['hard_0.125'];
    const near = (a, bb, tol) => a != null && bb != null && Math.abs(a - bb) <= tol;
    const validation = (e30b && e30c) ? {
        base: { e30Net4: e30b.windows.full.net4Sharpe, here: b.net4Sharpe, e30Turnover: e30b.windows.full.turnoverAnnual, hereTurnover: b.turnoverAnnual, e30Oi5: Math.round(e30b.oiPositionCapacity_at_5pct), hereOi5: b.oi5RatioOfMeansUSD },
        'hard_0.125': { e30Net4: e30c.windows.full.net4Sharpe, here: h.net4Sharpe, e30Turnover: e30c.windows.full.turnoverAnnual, hereTurnover: h.turnoverAnnual, e30Oi5: Math.round(e30c.oiPositionCapacity_at_5pct), hereOi5: h.oi5RatioOfMeansUSD },
        matchesE30: near(b.net4Sharpe, e30b.windows.full.net4Sharpe, 0.02) && near(b.turnoverAnnual, e30b.windows.full.turnoverAnnual, 1) && near(b.oi5RatioOfMeansUSD, Math.round(e30b.oiPositionCapacity_at_5pct), 1)
            && near(h.net4Sharpe, e30c.windows.full.net4Sharpe, 0.02) && near(h.turnoverAnnual, e30c.windows.full.turnoverAnnual, 1) && near(h.oi5RatioOfMeansUSD, Math.round(e30c.oiPositionCapacity_at_5pct), 1),
        note: 'base and hard_0.125 must reproduce e30 exactly.',
    } : null;

    // Does net@4 collapse onto a concentration curve? Compare each transform's net to the hard cap's at
    // matched max|w| and matched mean|w|.
    const hardNet = h.net4Sharpe;
    const smooth = Object.entries(table).filter(([, t]) => t.kind === 'soft' || t.kind === 'power');
    const sameConcentrationNeighbours = smooth
        .map(([name, t]) => ({ name, kind: t.kind, level: t.level, net4: t.net4Sharpe, maxAbsW: t.maxAbsW, meanAbsW: t.meanAbsW, maxWDiff: r2(t.maxAbsW - h.maxAbsW), netGapVsHard: r2((t.net4Sharpe ?? -1e9) - hardNet) }))
        .sort((a, b2) => Math.abs(a.maxWDiff) - Math.abs(b2.maxWDiff));
    const closestMax = sameConcentrationNeighbours[0] || null;
    const soft125 = table['soft_0.125'];
    const softMatchesHard = soft125 && Math.abs((soft125.net4Sharpe ?? -1e9) - hardNet) <= 0.2;
    const anySmoothBeatsHard = sameConcentrationNeighbours.some((x) => x.net4 != null && x.net4 > hardNet + 0.05);

    const verdict = {
        note: 'Why does clipping help? If a smooth saturation (softCap) or a smooth power shrink at matched concentration matches the hard cap, the mechanism is concentration; if the hard cap is special, it is not.',
        hardCapNet4: hardNet,
        softCap0p125Net4: soft125 ? soft125.net4Sharpe : null,
        softMatchesHard,
        closestConcentrationSmooth: closestMax,
        anySmoothBeatsHard,
        flatRankNet4: table.flat_rank.net4Sharpe,
        flatRankMaxAbsW: table.flat_rank.maxAbsW,
        hardCapMaxAbsW: h.maxAbsW,
        validationPass: validation ? validation.matchesE30 : null,
    };

    return {
        config: { symbols: k, symbolList: names, periods: n, lambda: LAMBDA, cap: CAP, invK, feeBps: FEE_BPS, f: F_PART },
        validation,
        table,
        sameConcentrationNeighbours,
        verdict,
    };
}
