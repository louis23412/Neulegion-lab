// E20 - capacity-aware weighting: can the dispersion sleeve's capacity be raised without losing the
// edge? L17, CYCLE-012.
//
// F-26 (e19) showed the F-24 dispersion book has a capacity of ~$13 M (Y=1, 4 bps) and that the binding
// symbol is DOGE at ~1 % of ADV: the demeaned *rank* weight is largest in whichever alt has the most
// extreme funding, and the thin alts are exactly where impact bites. That concentration is a property of
// the WEIGHTING SCHEME, not of the funding signal - so it should be reducible.
//
// This experiment applies capacity-aware transforms to the F-24 construction (rank target + EWMA(0.1)
// smoothing + renorm) and re-measures BOTH the F-24 audit (gross Sharpe, turnover, break-even, net
// ladders, crash-window survival) AND the F-26 capacity, on the SAME legs and with the SAME model:
//
//   baseline    the F-24 winner (no transform)                       - must reproduce e17 exactly
//   cap(m)      clip each |w_j| <= m after smoothing, renormalise    (m > 1/k for a live book)
//   dropThin(q) zero the q thinnest-ADV symbols in the target, renorm
//   advTilt(p)  scale the target by ADV_j^p, renormalise             (p>0 favours liquid names)
//
// The output is a capacity/Sharpe frontier: which transform buys the most capacity per unit of gross
// Sharpe, and whether the crash-survival (F-21) survives the transform.
//
// Guards: `baseline` reproduces e17's `rank_ewma0.1_norm` to maxAbsDiff = 0; a cap >= max|w| reproduces
// the baseline; every variant's capacity is computed by e19#capacityOf (no second cost model).

import { SYMBOLS, pearsonCorrelation, serialDesignEffect } from '../lib/lab.js';
import { buildXsSeries, statsOf } from './e12_xs_carry.js';
import { buildBook, rankWeights, levelWeights } from './e17_low_turnover.js';
import { audit, turnoverSeries } from './e16_cost_capacity.js';
import { capacityOf, makeCapacityEnv } from './e19_capacity_impact.js';
import { windowStats, REGIMES } from './e13_carry_robustness.js';

const PERIODS_PER_YEAR = 365 * 3;
const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const norm = (w) => { const g = w.reduce((a, x) => a + Math.abs(fin(x)), 0) || 1; return w.map((x) => fin(x) / g); };

// Build a book from the E12 legs with a rank/level target, an optional target tilt, EWMA(λ) smoothing,
// and an optional post-smoothing per-symbol cap. All causal: the target at period i uses funding at i-1.
// `cap` = a soft cap (clip then renormalise; keeps the book fully invested). `capStrict` = a TRUE
// position limit (clip and do NOT renormalise, so clipped periods are under-invested) - the
// economically meaningful capacity-aware construction, since it genuinely reduces thin-symbol exposure.
function buildVariant(legs, k, { base = 'rank', lambda = 0.1, tilt = null, cap = null, capStrict = null, noNorm = false } = {}) {
    const baseFn = base === 'rank' ? rankWeights : levelWeights;
    const n = legs.times.length;
    let held = new Array(k).fill(0);
    const rets = [];
    const weightRows = [];
    const leverage = []; // the per-period rescaling factor applied to the EWMA state (1 if none)
    let maxAbsWeight = 0;
    let clipCount = 0;
    let entries = 0;
    let grossSum = 0;
    for (let i = 1; i < n; i++) {
        let target = baseFn(legs.fRate[i - 1]);
        if (tilt) target = norm(tilt(target, i - 1));
        held = held.map((h, j) => (1 - lambda) * h + lambda * target[j]);
        if (noNorm) {
            if (cap != null) { let cl = 0; held = held.map((w) => { if (Math.abs(w) > cap) cl++; return Math.max(-cap, Math.min(cap, w)); }); clipCount += cl; }
            leverage.push(1);
        } else {
            const g = held.reduce((a, w) => a + Math.abs(fin(w)), 0) || 1;
            held = held.map((w) => fin(w) / g);
            let lev = 1 / g;
            if (cap != null) {
                let cl = 0;
                const c = held.map((w) => { if (Math.abs(w) > cap) cl++; return Math.max(-cap, Math.min(cap, w)); });
                if (cl > 0) { const g2 = c.reduce((a, w) => a + Math.abs(w), 0) || 1; held = c.map((w) => w / g2); lev *= 1 / g2; clipCount += cl; }
            }
            if (capStrict != null) {
                let cl = 0;
                held = held.map((w) => { if (Math.abs(w) > capStrict) cl++; return Math.max(-capStrict, Math.min(capStrict, w)); });
                clipCount += cl;
            }
            leverage.push(lev);
        }
        for (let j = 0; j < k; j++) { maxAbsWeight = Math.max(maxAbsWeight, Math.abs(held[j])); entries++; }
        grossSum += held.reduce((a, w) => a + Math.abs(w), 0);
        weightRows.push(held.slice());
        const b = legs.basisPnl[i];
        const f = legs.fRate[i];
        rets.push(held.reduce((a, w, j) => a + w * (fin(b[j]) + fin(f[j])), 0));
    }
    return { rets, weightRows, maxAbsWeight, clipFraction: entries ? clipCount / entries : 0, meanGross: grossSum / (n - 1), leverage };
}

// The thinnest-ADV symbols (for dropThin), from e19's ADV.
const thinRank = (env) => env.syms.map((s, j) => [s, j, env.adv[j]]).sort((a, b) => a[2] - b[2]).map((x) => x[1]);

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const syms = s.config.symbolList;
    const legs = s.legs;
    const times = legs.times.slice(1);
    const env = await makeCapacityEnv(syms);
    const thin = thinRank(env);

    // tilt = scale the target toward liquid names: ADV_j^p, renormalised. p=0 is a no-op.
    const advOf = Object.fromEntries(syms.map((x, j) => [j, env.adv[j]]));
    const meanAdv = mean(env.adv);
    const advTilt = (p) => (w) => w.map((x, j) => x * Math.pow(fin(advOf[j]) / meanAdv, p));
    // drop the q thinnest symbols from the target.
    const dropThin = (q) => (w) => w.map((x, j) => (thin.slice(0, q).includes(j) ? 0 : x));

    const VARIANTS = [
        { name: 'baseline_F24', opts: {} },
        { name: 'ewma_raw_nonorm', opts: { noNorm: true } },
        { name: 'cap_raw_0.30', opts: { noNorm: true, cap: 0.30 } },
        { name: 'cap_0.125_equal', opts: { cap: 0.125 } },
        ...['0.13', '0.14', '0.15', '0.16', '0.17', '0.18', '0.19', '0.20', '0.22'].map((m) => ({ name: `cap_${m}`, opts: { cap: Number(m) } })),
        ...['0.08', '0.10', '0.11', '0.12', '0.125', '0.13', '0.14', '0.15', '0.175', '0.20'].map((m) => ({ name: `capStrict_${m}`, opts: { capStrict: Number(m) } })),
        { name: 'dropThin2', opts: { tilt: dropThin(2) } },
        { name: 'dropThin3', opts: { tilt: dropThin(3) } },
        { name: 'advTilt_0.5', opts: { tilt: advTilt(0.5) } },
        { name: 'advTilt_1', opts: { tilt: advTilt(1) } },
        { name: 'advTilt_1_cap_0.16', opts: { tilt: advTilt(1), cap: 0.16 } },
    ];

    // Reference (F-24) for the reproducibility guard.
    const ref = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: 0.1, normalize: true } });

    const books = {};
    const raw = {};
    for (const v of VARIANTS) {
        const built = buildVariant(legs, k, v.opts);
        const a = audit(v.name, built.rets, built.weightRows);
        const capa = capacityOf(v.name, built.rets, built.weightRows, times, env);
        const T = turnoverSeries(built.weightRows);
        const net4 = built.rets.map((r, i) => r - 4e-4 * T[i]);
        // crash-window survival on E13's exact regimes (gross and net@4)
        const regimes = {};
        for (const rg of REGIMES) regimes[rg.name] = { gross: windowStats(built.rets, times, rg.from, rg.to).sharpe, net4: windowStats(net4, times, rg.from, rg.to).sharpe };
        const posNet4 = REGIMES.filter((rg) => Number.isFinite(regimes[rg.name].net4) && regimes[rg.name].net4 > 0).length;
        // Half-sample and per-year stability: a "capacity-aware" transform that only lifts the
        // full-sample Sharpe is a fit (PROTOCOL rule 2), so every variant carries its split-sample read.
        const half = Math.floor(built.rets.length / 2);
        const halves = { first: statsOf(built.rets.slice(0, half)).sharpe, second: statsOf(built.rets.slice(half)).sharpe };
        const byYear = {};
        for (const y of [2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
            const ws = windowStats(built.rets, times, Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1));
            byYear[y] = ws.available ? ws.sharpe : null;
        }
        const designEffect = serialDesignEffect(built.rets, 90).designEffect;
        raw[v.name] = { rets: built.rets, T };
        books[v.name] = {
            opts: v.opts,
            gross: { sharpe: a.gross.sharpe, annualized: a.gross.annualized, maxDrawdown: a.gross.maxDrawdown },
            turnover: { meanPerPeriod: a.turnover.meanPerPeriod, annualized: a.turnover.annualized },
            breakEvenBps: a.breakEvenBps,
            netAtZeroSize: { fee4bps: a.net['4'] && a.net['4'].sharpe, fee10bps: a.net['10'] && a.net['10'].sharpe },
            capacityUSD_fee4bps: capa.capacityUSD_fee4bps,
            impactBpsAt10M_Y1: capa.impactBpsAt10M_Y1,
            bindingAtCapacity: capa.participationAtCapacity_fee4_Y1 ? { symbol: capa.participationAtCapacity_fee4_Y1.symbol, participation: capa.participationAtCapacity_fee4_Y1.max } : null,
            marketCorr: pearsonCorrelation(built.rets, s.books.market),
            meanGrossExposureRaw: capa.meanGrossExposureRaw,
            weightStats: { maxAbsWeight: built.maxAbsWeight, clipFraction: built.clipFraction, meanGross: built.meanGross, leverageReturnCorr: pearsonCorrelation(built.rets, built.leverage) },
            stability: { halves, byYear, designEffect },
            regimesNet4Positive: posNet4,
            regimes,
        };
    }

    // Guards.
    let maxAbsDiff = 0;
    for (let i = 0; i < ref.rets.length; i++) maxAbsDiff = Math.max(maxAbsDiff, Math.abs(raw.baseline_F24.rets[i] - ref.rets[i]));
    const capHigh = buildVariant(legs, k, { cap: 10 });
    let capHighDiff = 0;
    for (let i = 0; i < ref.rets.length; i++) capHighDiff = Math.max(capHighDiff, Math.abs(capHigh.rets[i] - ref.rets[i]));

    // Frontier: capacity vs gross Sharpe.
    const frontier = Object.entries(books)
        .map(([name, b]) => ({
            name,
            grossSharpe: b.gross.sharpe,
            turnoverAnnual: b.turnover.annualized,
            breakEvenBps: b.breakEvenBps,
            net4: b.netAtZeroSize.fee4bps,
            capY05: b.capacityUSD_fee4bps['Y0.5'],
            capY1: b.capacityUSD_fee4bps.Y1,
            capY2: b.capacityUSD_fee4bps.Y2,
            binding: b.bindingAtCapacity && b.bindingAtCapacity.symbol,
            participation: b.bindingAtCapacity && b.bindingAtCapacity.participation,
            regimesNet4Positive: b.regimesNet4Positive,
            marketCorr: b.marketCorr,
        }))
        .sort((a, b) => (b.capY1 || 0) - (a.capY1 || 0));

    return {
        config: {
            symbols: k,
            symbolList: syms,
            periods: s.config.periods,
            years: s.config.years,
            advUSD: Object.fromEntries(syms.map((x, j) => [x, env.adv[j]])),
            thinOrder: thin.map((j) => syms[j]),
            regimeCount: REGIMES.length,
            note: 'capacity from e19 (square-root impact, Y=1 default); gross Sharpe/turnover from e16#audit. Same legs throughout.',
        },
        check: {
            baselineReproducesE17: maxAbsDiff < 1e-12,
            baselineMaxAbsDiff: maxAbsDiff,
            highCapReproducesBaseline: capHighDiff < 1e-12,
            highCapMaxAbsDiff: capHighDiff,
        },
        e17Baseline: { grossSharpe: statsOf(ref.rets).sharpe, turnoverAnnual: mean(turnoverSeries(ref.weightRows)) * PERIODS_PER_YEAR },
        books,
        frontier,
    };
}
