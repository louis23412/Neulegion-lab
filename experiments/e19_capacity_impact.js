// E19 - capacity / market impact of the carry complex. L15, CYCLE-011.
//
// E16 (F-23) measured the FEE a book pays per unit of turnover, and E17/E18 (F-24/F-25) showed the
// fee is cleared by smoothing weights. But a book that trades D dollars of a symbol that only trades
// V dollars per period also pays IMPACT - the slip between the mid you decide on and the fill you
// get - and impact grows with size while the edge does not. This experiment turns the lab's tradable
// sleeves into a number the project can budget against: the gross notional G at which net (fee +
// impact) return goes to zero, i.e. the book's CAPACITY.
//
// Data: `data/perp_flow_8h.json` (L15 / harvest_perp_flow.js) - the perp 8h kline quote volume (USDT)
// and trade count the repo discards, on the same 8h grid as every other carry input.
//
// Impact model (square-root law, Almgren/Barzykin form):
//   impact_fraction(Q) = Y * sigma * sqrt(Q / V)
// where Q is the dollars traded in the period, V the dollars traded in the SAME period, and sigma the
// per-period (8h) volatility. Y is O(1) (published crypto-perp estimates ~0.5-1.5); the artefact
// reports capacity at Y = 0.5, 1, 2 so a reader can pick their own. For a book with per-symbol trades
// Q_j = |dw_j| * G, the per-period impact cost in bps OF GROSS NOTIONAL G is
//   impactBps_t = 1e4 * Y * sum_j sigma_j * |dw_j|^1.5 * sqrt(G / V_{j,t})  =  c_t * sqrt(G)
// so it is exactly proportional to sqrt(G) - the reason capacity, not Sharpe, bounds a yield sleeve.
//
// Book scalar convention: weights are first scaled so the book's MEAN gross exposure (mean_t sum|w_t|)
// is 1. Then G is the book's gross perp notional (sum of absolute position notionals) and a fee of f
// bps costs f * T_t bps of G. Sharpe is scale-free, so this only affects the LEVEL of the cost ladder,
// but it is the only convention in which "capacity in dollars" is comparable across books (the
// reversion book's raw weights sum to ~0.5).
//
// Cross-check: for the daily rank book (scale 1) the Y=0, G=0 net@4 Sharpe must equal the same book's
// E16 audit, and impact must vanish at G=0 and scale exactly as sqrt(G) in Y. If not, the cost
// bookkeeping here disagrees with F-23 and nothing else counts.

import { SYMBOLS, loadPerpFlow, flowIndexAt, loadMarkPrices } from '../lib/lab.js';
import { buildXsSeries, statsOf } from './e12_xs_carry.js';
import { buildBook, rankWeights, levelWeights } from './e17_low_turnover.js';
import { reversionFromBook } from './e7_basis_reversion.js';
import { applyPolicy } from './e18_reversion_smoothing.js';
import { loadCarryBook } from './e3_carry.js';
import { audit } from './e16_cost_capacity.js';

const PERIODS_PER_YEAR = 365 * 3;
const FEE_LEVELS_BPS = [0, 2, 4, 5, 10, 11, 15];
const Y_LEVELS = [0.5, 1, 2];
const VOL_WINDOW = 30; // trailing 8h bars for sigma (~10 days)

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };

// Per-symbol trailing volatility of 8h returns (perp traded leg), keyed by grid time.
function volMaps(perpMap, window = VOL_WINDOW) {
    const volBySym = {};
    const medianVol = {};
    for (const [sym, m] of Object.entries(perpMap)) {
        const ts = [...m.keys()].sort((a, b) => a - b);
        const rets = new Array(ts.length).fill(NaN);
        for (let i = 1; i < ts.length; i++) { const a = m.get(ts[i - 1]); const b = m.get(ts[i]); if (a > 0 && b > 0) rets[i] = b / a - 1; }
        const vm = new Map();
        const win = [];
        let sum = 0, sumSq = 0, cnt = 0;
        const finite = [];
        for (let i = 0; i < ts.length; i++) {
            const r = rets[i];
            if (Number.isFinite(r)) { win.push(r); sum += r; sumSq += r * r; cnt++; finite.push(r); }
            while (win.length > window) { const o = win.shift(); sum -= o; sumSq -= o * o; cnt--; }
            let sd = NaN;
            if (cnt >= 8) { const mu = sum / cnt; const v = (sumSq - cnt * mu * mu) / (cnt - 1); if (v > 0) sd = Math.sqrt(v); }
            vm.set(ts[i], sd);
        }
        finite.sort((a, b) => a - b);
        volBySym[sym] = vm;
        medianVol[sym] = finite.length ? finite[Math.floor(finite.length / 2)] : 0.01;
    }
    return { volBySym, medianVol };
}

const meanFlow = (f) => {
    if (!f) return NaN;
    const v = f.qv.filter((x) => x != null && x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};

// Trade volume V_{j,t} used for symbol j at book period t (dollars traded in the bar the rebalance
// executes in), falling back to the symbol's mean ADV when the bar is absent.
function volumeAt(flow, sym, time, adv) {
    const f = flow[sym];
    const idx = f ? flowIndexAt(f, time) : -1;
    const V = idx >= 0 ? f.qv[idx] : null;
    return V > 0 ? V : adv;
}

// Per-period turnover T_t and the sqrt(G) impact coefficient c_t for a scaled weight-vector series.
// Impact is charged on the PERP leg; the spot hedge carries a second, typically smaller, term, so this
// is a LOWER bound on cost / an UPPER bound on capacity (stated, not hidden).
// Per-period turnover and the square-root impact coefficient c (impact_bps(G) = c_t * sqrt(G)) for a book.
// Exported (CYCLE-025) so a sizing study can price its own trades with the SAME model e19 measures.
export function turnoverAndCost(weights, times, syms, flow, volBySym, medianVol, adv, Y) {
    const k = syms.length;
    const P = weights.length;
    const T = new Array(P).fill(0);
    const c = new Array(P).fill(0);
    const traded = syms.map(() => new Array(P).fill(0));
    const vols = syms.map(() => new Array(P).fill(0));
    let volMissing = 0;
    for (let t = 0; t < P; t++) {
        const w = weights[t];
        const wp = t > 0 ? weights[t - 1] : null;
        for (let j = 0; j < k; j++) {
            const adw = Math.abs(fin(w[j]) - (wp ? fin(wp[j]) : 0));
            traded[j][t] = adw;
            T[t] += adw;
            const V = volumeAt(flow, syms[j], times[t], adv[j]);
            if (!(V > 0)) volMissing++;
            vols[j][t] = V;
            if (adw === 0) continue;
            const vm = volBySym[syms[j]];
            let sigma = vm ? vm.get(times[t]) : NaN;
            if (!(sigma > 0)) sigma = medianVol[syms[j]] || 0.01;
            c[t] += 1e4 * Y * sigma * Math.pow(adw, 1.5) / Math.sqrt(V);
        }
    }
    return { T, c, traded, vols, volMissing };
}

// Load the flow / vol / ADV environment a capacity readout needs, for a given symbol column order.
// Exported so E20 (capacity-aware weighting) measures capacity with the SAME model, not a copy.
export async function makeCapacityEnv(syms) {
    const flow = await loadPerpFlow();
    const perpMap = await loadMarkPrices('src/NeuLegion-lab/data/perp_8h.json');
    const { volBySym, medianVol } = volMaps(perpMap);
    const adv = syms.map((x) => meanFlow(flow[x]));
    return { syms, flow, volBySym, medianVol, adv };
}

// Full capacity readout for one raw book.
export function capacityOf(name, rawRets, rawWeightRows, times, env, { targetFeeBps = 4 } = {}) {
    const { syms, flow, volBySym, medianVol, adv } = env;
    const ebar = mean(rawWeightRows.map((w) => w.reduce((a, x) => a + Math.abs(fin(x)), 0)));
    const scale = ebar > 0 ? 1 / ebar : 1;
    const weights = rawWeightRows.map((w) => w.map((x) => fin(x) * scale));
    const rets = rawRets.map((r) => fin(r) * scale);
    const P = weights.length;

    const y1 = turnoverAndCost(weights, times, syms, flow, volBySym, medianVol, adv, 1);
    const grossMeanBps = mean(rets) * 1e4;
    const Tbar = mean(y1.T);
    const cbarY1 = mean(y1.c);
    const breakEvenBps = Tbar > 0 ? grossMeanBps / Tbar : null;

    const netSeries = (G, feeBps, c) => rets.map((r, t) => r - (feeBps / 1e4) * y1.T[t] - (c[t] * Math.sqrt(G)) / 1e4);

    const capacityTable = {};
    for (const Y of Y_LEVELS) {
        const imp = Y === 1 ? y1 : turnoverAndCost(weights, times, syms, flow, volBySym, medianVol, adv, Y);
        const cb = mean(imp.c);
        const row = {};
        for (const fee of FEE_LEVELS_BPS) {
            const e = grossMeanBps - fee * Tbar;
            row[`fee${fee}`] = e > 0 && cb > 0 ? ((e / cb) ** 2) : (e > 0 ? null : 0);
        }
        capacityTable[`Y${Y}`] = row;
    }

    const ladder = {};
    for (const G of [1e6, 1e7, 1e8, 1e9, 1e10]) {
        const row = { G, impactBps: cbarY1 * Math.sqrt(G) };
        for (const [tag, fee] of [['fee4bps', 4], ['fee11bps', 11]]) {
            const st = statsOf(netSeries(G, fee, y1.c));
            row[tag] = { netSharpe: st.sharpe, netAnnual: st.annualized };
        }
        ladder[String(G)] = row;
    }

    const participationAt = (G) => {
        const perSym = syms.map((_, j) => mean(y1.traded[j].map((x, t) => (x * G) / y1.vols[j][t])));
        let bi = 0;
        for (let j = 1; j < perSym.length; j++) if (perSym[j] > perSym[bi]) bi = j;
        return { max: perSym[bi], symbol: syms[bi], perSym, atUSD: G };
    };

    const cap4 = capacityTable.Y1.fee4;
    return {
        name,
        periods: P,
        weightScale: scale,
        meanGrossExposureRaw: ebar,
        gross: { sharpe: statsOf(rets).sharpe, annualized: mean(rets) * PERIODS_PER_YEAR, meanBpsPerPeriod: grossMeanBps },
        turnover: { meanPerPeriod: Tbar, annualized: Tbar * PERIODS_PER_YEAR },
        breakEvenBps,
        netAtZeroSize: { fee4bpsSharpe: statsOf(netSeries(0, 4, y1.c)).sharpe, fee11bpsSharpe: statsOf(netSeries(0, 11, y1.c)).sharpe },
        impactBpsAt10M_Y1: cbarY1 * Math.sqrt(1e7),
        impactBpsAt1B_Y1: cbarY1 * Math.sqrt(1e9),
        capacityUSD_fee4bps: Object.fromEntries(Y_LEVELS.map((Y) => [`Y${Y}`, capacityTable[`Y${Y}`].fee4])),
        capacityTable,
        ladder,
        participationAtCapacity_fee4_Y1: cap4 > 0 && Number.isFinite(cap4) ? participationAt(cap4) : null,
    };
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const syms = s.config.symbolList && s.config.symbolList.length === k ? s.config.symbolList : symbols.slice(0, k);
    const legs = s.legs;
    const env = await makeCapacityEnv(syms);
    const { flow, volBySym, medianVol, adv } = env;

    // The books, all sharing the E16/E17/E18 builders so a number here is the same sleeve as F-23/F-24.
    const flatW = s.books.flat.map(() => new Array(k).fill(1 / k));
    const xsRankDaily = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'daily' } });
    const xsRankEwma = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: 0.1, normalize: true } });
    const xsLevelEwma = buildBook(legs, k, { targetFn: levelWeights, policy: { kind: 'ewma', lambda: 0.1, normalize: true } });

    const { perSym } = await loadCarryBook(symbols, { perp });
    const rev = reversionFromBook(perSym, { zWindow: 60, includeWeights: true });
    if (!rev.pooled || !rev.pooledWeights || !rev.pooledTimes) return { available: false };
    const revDailyW = applyPolicy(rev.pooledWeights, { kind: 'daily' });
    const revEwmaW = applyPolicy(rev.pooledWeights, { kind: 'ewma', lambda: 0.1 }, true);
    const retsFrom = (W, leg) => W.map((w, t) => w.reduce((a, x, j) => a + fin(x) * fin(leg[t][j]), 0));
    const revDailyR = retsFrom(revDailyW, rev.pooledLegs.carry);
    const revEwmaR = retsFrom(revEwmaW, rev.pooledLegs.carry);

    const BOOKS = [
        { name: 'flat', rets: s.books.flat, weights: flatW, times: s.times },
        { name: 'xsRank_daily', rets: xsRankDaily.rets, weights: xsRankDaily.weightRows, times: s.times },
        { name: 'xsRank_ewma0.1_norm', rets: xsRankEwma.rets, weights: xsRankEwma.weightRows, times: s.times },
        { name: 'xsLevel_ewma0.1_norm', rets: xsLevelEwma.rets, weights: xsLevelEwma.weightRows, times: s.times },
        { name: 'revCarry_daily', rets: revDailyR, weights: revDailyW, times: rev.pooledTimes },
        { name: 'revCarry_ewma0.1_norm', rets: revEwmaR, weights: revEwmaW, times: rev.pooledTimes },
    ];

    const books = {};
    for (const b of BOOKS) books[b.name] = capacityOf(b.name, b.rets, b.weights, b.times, env);

    // ---- self-tests on the cost bookkeeping ----
    const ref = audit('ref', xsRankDaily.rets, xsRankDaily.weightRows);
    const xs = books.xsRank_daily;
    const imp0 = turnoverAndCost(xsRankDaily.weightRows, s.times, syms, flow, volBySym, medianVol, adv, 0);
    const imp1 = turnoverAndCost(xsRankDaily.weightRows, s.times, syms, flow, volBySym, medianVol, adv, 1);
    const imp2 = turnoverAndCost(xsRankDaily.weightRows, s.times, syms, flow, volBySym, medianVol, adv, 2);
    const c1 = mean(imp1.c);
    const c2 = mean(imp2.c);
    const impY1 = imp1;
    const gridAligned = rev.pooledTimes.every((t) => t % 28_800_000 === 0);

    return {
        config: {
            symbols: k,
            symbolList: syms,
            periods: s.config.periods,
            years: s.config.years,
            feeLevelsBps: FEE_LEVELS_BPS,
            YLevels: Y_LEVELS,
            // Recoverable without the model: impactBps_t(G) = c_t*sqrt(G), c_t = 1e4*Y*sum_j sigma_j |dw_j|^1.5 / sqrt(V_jt).
            // So each book's capacity = ((grossMeanBps - fee*Tbar) / mean(c))^2, exactly the reported table.
            model: 'impact_fraction = Y * sigma_8h * sqrt(Q/V); costBps_t(G) = c_t*sqrt(G)',
            note: 'G = book gross perp notional (weights scaled so mean sum|w| = 1). Impact on the perp leg only -> upper bound on capacity; the flat book is a hold, so its "capacity" reflects only the one-off entry impact (its real limit is open interest / position size, L07).',
        },
        check: {
            e16Agree: Math.abs(xs.netAtZeroSize.fee4bpsSharpe - ref.net['4'].sharpe) < 1e-9 && Math.abs(xs.breakEvenBps - ref.breakEvenBps) < 1e-6,
            e16BreakEvenBps: ref.breakEvenBps,
            e19BreakEvenBps: xs.breakEvenBps,
            impactZeroAtY0: Math.abs(mean(imp0.c)) < 1e-15,
            impactScalesWithY: Math.abs(c2 - 2 * c1) / (2 * c1) < 1e-9,
            reversionTimesOn8hGrid: gridAligned,
            flowTermMissingFraction: impY1.volMissing / (xsRankDaily.weightRows.length * k),
        },
        advUSD: Object.fromEntries(syms.map((x, j) => [x, adv[j]])),
        books,
    };
}
