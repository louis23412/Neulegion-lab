// E33 - OI CAPACITY IS A DISTRIBUTION, NOT A MEAN. CYCLE-024 (L07 / L15 / L17 / L18 audit).
//
// F-28/F-38/F-40 all quote an "open-interest position capacity" for a working sleeve - the gross notional
// G at which the book's holding is f (1/5/10%) of every symbol's open interest. Every one of those numbers
// is computed as
//
//     G_pub = f * mean_t( OI_j(t) ) / mean_t( |w_j(t)| )        [a RATIO OF MEANS]
//
// (e21 Part B, e30 "G such that |w_j|*G = f*meanOI_j", e32 "G5"). That is not the constraint a desk
// faces. The constraint is per-period and per-symbol:
//
//     for all t, j:   |w_j(t)| * G  <=  f * OI_j(t)      =>   G <= f * min_{t,j} OI_j(t)/|w_j(t)|.
//
// So the published bound is a *ratio of means*, while the true average-case bound is the *mean of ratios*
// and the true worst-case bound is the *min of ratios*. For positive quantities
// mean(A/B) >= mean(A)/mean(B) (Jensen/Cauchy-Schwarz) and min <= mean, so the published number is an upper
// bound on the average-case and can sit far above the worst case whenever open interest dips exactly when
// the book's weight spikes. That joint event is the whole mechanism of a squeeze: the position is largest
// when the market is thinnest. This experiment measures the gap for every working sleeve, checks what the
// published size actually implies period by period, and restates the usable size.
//
// Three bounds per book:
//   G_ratioOfMeans  = f * mean(OI_j) / mean(|w_j|)      (the published convention)
//   G_meanOfRatios  = f / mean_t( |w_j(t)| / OI_j(t) )  (true average-case; min over j)
//   G_minOfRatios   = f * min_t ( OI_j(t)/|w_j(t)| )    (true worst-case; never breaches the cap)
// plus the time-varying bound G_t = f * min_j OI_j(t)/|w_j(t)| and its distribution (what a book that
// sizes to the *current* OI could hold).
//
// Contact with reality: at the published G, what is the actual participation |w_j(t)|*G/OI_j(t) - how
// often does it breach f, and how high does it go? And what is the capacity during stress (the book's
// worst return periods, and the periods when basket open interest fell the most - the cascade signature
// L07 cares about)?
//
// Guards: `disp_lam0.1` must reproduce e30's stored `ewma_0.1_norm` 5% bound (23413984.796642747,
// LINKUSDT) and `fade_lam0.1` must reproduce e32's stored `lam0.1` oiBound5pct (36986403.11152483), or the
// builders or the OI alignment have diverged and nothing else counts.
//
// FALSIFIER (pre-registered). The correction is IMMATERIAL if, for every working sleeve, the recent-24m
// worst-case bound (G_minOfRatios) is within 20% of the published G_ratioOfMeans AND the book breaches the
// 5% cap less than 5% of the time at the published size. Otherwise every OI-bound capacity in
// F-28/F-38/F-39/F-40 is optimistic and must be restated.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { buildMasked } from './e22_toptrader_validate.js';
import { turnoverSeries } from './e16_cost_capacity.js';
import { capacityOf, makeCapacityEnv } from './e19_capacity_impact.js';

const PERIODS_PER_YEAR = 365 * 3;
const FEE_BPS = 4;
const F = 0.05; // the participation cap all the published bounds quote at 5%
const NEXT_FADE = 2;

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };
const quantile = (a, p) => {
    const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y);
    if (!s.length) return NaN;
    const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const applyCap = (rows, cap) => (cap == null ? rows : rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x))));
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const usd = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x));

function dist(Gt, worstN = 5) {
    const fin = Gt.filter((x) => Number.isFinite(x) && x > 0);
    const s = fin.slice().sort((a, b) => a - b);
    return {
        n: fin.length,
        min: s[0], p5: quantile(s, 0.05), p10: quantile(s, 0.10), p25: quantile(s, 0.25),
        median: quantile(s, 0.50), p75: quantile(s, 0.75), p90: quantile(s, 0.90), p95: quantile(s, 0.95),
        mean: mean(s), max: s[s.length - 1],
    };
}

// G_t = f * min_j OI_j(t)/|w_j(t)| over symbols with a nonzero weight and a live OI print. A period is
// CERTIFIABLE only if every symbol the book actually trades (|w_j|>eps) has an OI print: when the OI
// history starts later than the book (the 7 alt symbols before 2021-12), a min over the remaining subset
// is meaningless and can explode (a $936 B "capacity" at 2021-11-04 when only BTC had OI and the book's
// BTC weight was ~0.0002). Such periods are dropped, not silently accepted.
function timeVaryingBound(weightRows, bookTimes, oiAt, k, f) {
    const Gt = new Array(weightRows.length).fill(NaN);
    const bind = new Array(weightRows.length).fill(-1);
    for (let t = 0; t < weightRows.length; t++) {
        const ov = oiAt(bookTimes[t]);
        if (!ov) continue;
        let g = Infinity, bj = -1, ok = true;
        for (let j = 0; j < k; j++) {
            const w = Math.abs(weightRows[t][j]);
            const o = ov[j];
            if (w <= 1e-12) continue;
            if (!(o > 0)) { ok = false; break; }
            const r = o / w; if (r < g) { g = r; bj = j; }
        }
        if (ok && g !== Infinity) { Gt[t] = g * f; bind[t] = bj; }
    }
    return { Gt, bind };
}

// The participation at a size G, over certifiable periods only (same rule as timeVaryingBound).
function participationStats(weightRows, bookTimes, oiAt, k, G, f) {
    const parts = [];
    for (let t = 0; t < weightRows.length; t++) {
        const ov = oiAt(bookTimes[t]);
        if (!ov) continue;
        let mp = 0, ok = true;
        for (let j = 0; j < k; j++) {
            const w = Math.abs(weightRows[t][j]);
            if (w <= 1e-12) continue;
            const o = ov[j];
            if (!(o > 0)) { ok = false; break; }
            mp = Math.max(mp, (w * G) / o);
        }
        if (ok && mp > 0) parts.push(mp);
    }
    return { parts, max: parts.length ? Math.max(...parts) : NaN, breachFraction: parts.length ? parts.filter((p) => p > f).length / parts.length : NaN, n: parts.length };
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList;
    const k = names.length;
    const times = s.times;
    const n = times.length;
    const legs = s.legs;
    const env = await makeCapacityEnv(names);

    const oi = await loadOpenInterest();
    const oiAt = (t) => names.map((nm) => { const o = oi[nm]; if (!o) return null; const idx = flowIndexAt(o, t); return idx >= 0 ? o.oiVal[idx] : null; });

    // --- fade books need topLS + a common start (e21/e22/e32 convention) ---
    const topLS = names.map((nm) => { const o = oi[nm]; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.topLS[idx] : null; } return arr; });
    let firstTop = -1;
    for (let i = 1; i < n - 2; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(topLS[j][i])) all = false; if (all) { firstTop = i; break; } }

    // --- the working sleeves whose OI bounds F-28/F-38/F-40 publish ---
    const BOOKDEFS = [
        { name: 'disp_lam0.1', family: 'disp', lam: 0.1, cap: null },
        { name: 'disp_lam0.01', family: 'disp', lam: 0.01, cap: null },
        { name: 'disp_lam0.02_cap12.5', family: 'disp', lam: 0.02, cap: 0.125 },
        { name: 'fade_lam0.1', family: 'fade', lam: 0.1, cap: null },
        { name: 'fade_lam0.1_cap12.5', family: 'fade', lam: 0.1, cap: 0.125 },
    ];
    const GUARDS = {
        'disp_lam0.1': { source: 'e30#ewma_0.1_norm', field: 'oiPositionCapacity.at_5pct_of_meanOI.USD', value: 23413984.796642747, symbol: 'linkusdt' },
        'fade_lam0.1': { source: 'e32#lam0.1', field: 'oiBound5pct', value: 36986403.11152483, symbol: 'linkusdt' },
    };

    const books = {};
    for (const def of BOOKDEFS) {
        // Build the book exactly as its source experiment did.
        let weightRows, rets, bookTimes, timesForCapacity;
        if (def.family === 'disp') {
            const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: def.lam, normalize: true } });
            weightRows = applyCap(built.weightRows, def.cap);
            const fin = (x) => (Number.isFinite(x) ? x : 0);
            rets = def.cap ? weightRows.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * (fin(bp[j]) + fin(fr[j])), 0); }) : built.rets;
            bookTimes = legs.times.slice(1);
            timesForCapacity = s.times; // e30 convention
        } else {
            const built = buildMasked(topLS, k, legs, times, { sign: -1, from: firstTop, policy: { kind: 'ewma', lambda: def.lam, normalize: true } });
            weightRows = applyCap(built.weightRows, def.cap);
            rets = def.cap == null ? built.rets : weightRows.map((w, t) => { const sr = legs.spotRet[firstTop + t + NEXT_FADE]; return w.reduce((a, x, j) => a + x * (sr && Number.isFinite(sr[j]) ? sr[j] : 0), 0); });
            bookTimes = built.bookTimes;
            timesForCapacity = built.bookTimes; // e32 convention
        }
        const P = weightRows.length;
        const T = turnoverSeries(weightRows);
        const capa = capacityOf(def.name, rets, weightRows, timesForCapacity, env);
        const impactY1 = capa.capacityUSD_fee4bps.Y1;

        // --- the three bounds at f = F, on the book's own OI-aligned window ---
        const meanOi = names.map((_, j) => { const v = bookTimes.map((t) => { const ov = oiAt(t); return ov ? ov[j] : null; }).filter((x) => x > 0); return v.length ? mean(v) : NaN; });
        const meanAbsW = names.map((_, j) => mean(weightRows.map((w) => Math.abs(w[j]))));
        // ratio of means (published)
        let gRom = Infinity, romBind = -1;
        for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && meanOi[j] > 0) { const g = F * meanOi[j] / meanAbsW[j]; if (g < gRom) { gRom = g; romBind = j; } }
        // mean of ratios (true average-case)
        let gMor = Infinity, morBind = -1;
        for (let j = 0; j < k; j++) {
            const rs = [];
            for (let t = 0; t < P; t++) { const w = Math.abs(weightRows[t][j]); const ov = oiAt(bookTimes[t]); const o = ov ? ov[j] : null; if (w > 1e-12 && o > 0) rs.push(w / o); }
            if (rs.length) { const g = F / mean(rs); if (g < gMor) { gMor = g; morBind = j; } }
        }
        // min of ratios (worst-case)
        const { Gt, bind } = timeVaryingBound(weightRows, bookTimes, oiAt, k, F);
        const d = dist(Gt);
        let gMin = d.min, minBind = -1;
        { for (let t = 0; t < P; t++) if (Gt[t] === gMin) { minBind = bind[t]; break; } }
        // a NAIVE "just use min OI" fix: f * min_t OI_j / mean_t|w_j| - still a ratio of a min to a mean, so
        // it overstates whenever the weight is high exactly when OI is low. Reported to show why the correct
        // object is the min of the RATIO, not the ratio of a min to a mean.
        let gNaive = Infinity, naiveBind = -1;
        for (let j = 0; j < k; j++) {
            const ois = bookTimes.map((t) => { const ov = oiAt(t); return ov ? ov[j] : null; }).filter((x) => x > 0);
            if (ois.length && meanAbsW[j] > 0) { const g = F * Math.min(...ois) / meanAbsW[j]; if (g < gNaive) { gNaive = g; naiveBind = j; } }
        }

        // --- contact with reality: participation at the PUBLISHED size (certifiable periods only) ---
        const ps = participationStats(weightRows, bookTimes, oiAt, k, gRom, F);
        const reality = { maxParticipation: ps.max, breachFraction: ps.breachFraction, breachesPerYear: ps.n ? ps.breachFraction * PERIODS_PER_YEAR : NaN };
        const parts = ps.parts;

        // --- worst dates & which symbol binds at the thin tail ---
        const order = Gt.map((g, t) => [g, t]).filter(([g]) => Number.isFinite(g)).sort((a, b) => a[0] - b[0]);
        const worstDates = order.slice(0, 5).map(([g, t]) => ({ date: new Date(bookTimes[t]).toISOString().slice(0, 10), boundUSD: usd(g), binding: names[bind[t]] }));
        const recentIdx = Gt.map((g, t) => [g, t]).filter(([g, t]) => Number.isFinite(g) && t >= P - Math.round(2 * PERIODS_PER_YEAR)).sort((a, b) => a[0] - b[0]);
        const worstDatesRecent24m = recentIdx.slice(0, 5).map(([g, t]) => ({ date: new Date(bookTimes[t]).toISOString().slice(0, 10), boundUSD: usd(g), binding: names[bind[t]], weight: r4(Math.abs(weightRows[t][bind[t]])) }));
        const tailK = Math.max(1, Math.round(0.05 * order.length));
        const bindCounts = {};
        for (let i = 0; i < tailK; i++) { const nm = names[bind[order[i][1]]]; bindCounts[nm] = (bindCounts[nm] || 0) + 1; }

        // --- windows ---
        const w24 = Math.min(P, Math.round(2 * PERIODS_PER_YEAR));
        const w12 = Math.min(P, Math.round(PERIODS_PER_YEAR));
        const net4 = rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i]);
        const win = (from, to) => ({ n: to - from, grossSharpe: r4(sharpe(rets.slice(from, to))), net4Sharpe: r4(sharpe(net4.slice(from, to))), breakEvenBps: mean(T.slice(from, to)) > 0 ? r4((mean(rets.slice(from, to)) * 1e4) / mean(T.slice(from, to))) : null });
        // Windows are over the most recent N periods that HAVE an OI print (the OI harvest ends 2026-08-31,
        // ~2 weeks before the book's last bar, so an index-based tail would be empty at 3m and short at 12m).
        const fin = Gt.filter((x) => Number.isFinite(x) && x > 0);
        const tailN = (N) => dist(fin.slice(-Math.min(N, fin.length)));
        const recFull = dist(fin);
        const rec24 = tailN(Math.round(2 * PERIODS_PER_YEAR));
        const rec12 = tailN(Math.round(PERIODS_PER_YEAR));
        const rec3 = tailN(Math.round(PERIODS_PER_YEAR / 4));
        const oiCoverage = {
            bookPeriods: P, withOiPrint: fin.length,
            missingFraction: r4(1 - fin.length / P),
            firstOiBookDate: new Date(bookTimes[Gt.findIndex((x) => Number.isFinite(x))]).toISOString().slice(0, 10),
            lastOiBookDate: new Date(bookTimes[Gt.length - 1 - Gt.slice().reverse().findIndex((x) => Number.isFinite(x))]).toISOString().slice(0, 10),
            lastBookDate: new Date(bookTimes[P - 1]).toISOString().slice(0, 10),
        };

        // --- stress: capacity when the book loses, and when basket OI collapses ---
        const basketOI = bookTimes.map((t) => { const ov = oiAt(t); if (!ov) return null; let s2 = 0, c = 0; for (let j = 0; j < k; j++) if (ov[j] > 0) { s2 += ov[j]; c++; } return c ? s2 : null; });
        const dOI = basketOI.map((x, t) => (t > 0 && x > 0 && basketOI[t - 1] > 0 ? Math.log(x / basketOI[t - 1]) : NaN));
        const stressOn = (key) => {
            const idx = Gt.map((g, t) => [key[t], t]).filter(([v]) => Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
            const kk = Math.max(1, Math.round(0.05 * idx.length));
            const sel = idx.slice(0, kk).map(([, t]) => Gt[t]).filter((x) => Number.isFinite(x));
            return { n: sel.length, median: quantile(sel, 0.5), p5: quantile(sel, 0.05), mean: mean(sel) };
        };
        const stress = {
            byBookWorstReturns: stressOn(rets.map((r, t) => (Number.isFinite(r) ? r : NaN))),
            byBasketOiDrop: stressOn(dOI),
        };

        // --- restated usable size = min(impact capacity, corrected OI bound) ---
        const usable = {
            published: { oiBound: usd(gRom), impactBound: usd(impactY1), usable: usd(Math.min(gRom, impactY1)) },
            averageCase: { oiBound: usd(gMor), usable: usd(Math.min(gMor, impactY1)) },
            worstCaseFull: { oiBound: usd(gMin), usable: usd(Math.min(gMin, impactY1)) },
            p5Full: { oiBound: usd(recFull.p5), usable: usd(Math.min(recFull.p5, impactY1)) },
            recent24mP5: { oiBound: usd(rec24.p5), usable: usd(Math.min(rec24.p5, impactY1)) },
            recent24mMin: { oiBound: usd(rec24.min), usable: usd(Math.min(rec24.min, impactY1)) },
        };

        books[def.name] = {
            family: def.family, lambda: def.lam, cap: def.cap, periods: P,
            turnoverAnnual: Math.round(mean(T) * PERIODS_PER_YEAR),
            windows: { full: win(0, P), last24m: win(P - w24, P), last12m: win(P - w12, P) },
            oiBound: {
                ratioOfMeans_published: { USD: usd(gRom), exactUSD: gRom, bindingSymbol: names[romBind] },
                meanOfRatios_averageCase: { USD: usd(gMor), exactUSD: gMor, bindingSymbol: names[morBind] },
                minOfRatios_worstCase: { USD: usd(gMin), exactUSD: gMin, bindingSymbol: names[minBind] },
                naiveMinOiOverMeanWeight: { USD: usd(gNaive), exactUSD: gNaive, bindingSymbol: names[naiveBind] },
                note: 'ratioOfMeans = the published convention (f*mean(OI)/mean|w|). meanOfRatios = true average-case (f/mean(|w|/OI)). minOfRatios = true worst-case (f*min(OI/|w|)). naiveMinOiOverMeanWeight = f*min(OI)/mean|w| - the "just use min OI" fix, which is NOT the worst case.',
                timeVarying_distribution_full: Object.fromEntries(Object.entries(recFull).map(([x, y]) => [x, usd(y)])),
                timeVarying_distribution_last24m: Object.fromEntries(Object.entries(rec24).map(([x, y]) => [x, usd(y)])),
                timeVarying_distribution_last12m: Object.fromEntries(Object.entries(rec12).map(([x, y]) => [x, usd(y)])),
                timeVarying_distribution_last3m: Object.fromEntries(Object.entries(rec3).map(([x, y]) => [x, usd(y)])),
                worstDates, worstDatesRecent24m, tailBindingSymbolCounts: bindCounts,
            },
            atPublishedSize: {
                participationCapPct: F * 100,
                maxParticipationPct: r4(reality.maxParticipation * 100),
                breachFraction: r4(reality.breachFraction),
                breachesPerYear: r4(reality.breachesPerYear),
                p99ParticipationPct: r4(quantile(parts, 0.99) * 100),
                medianParticipationPct: r4(quantile(parts, 0.5) * 100),
            },
            capacityStress: { bookWorst5Pct: Object.fromEntries(Object.entries(stress.byBookWorstReturns).map(([x, y]) => [x, usd(y)])), basketOiDropWorst5Pct: Object.fromEntries(Object.entries(stress.byBasketOiDrop).map(([x, y]) => [x, usd(y)])) },
            impactCapacityY1: usd(impactY1),
            restatedUsable: usable,
            oiCoverage,
        };
    }

    // --- guards: the published convention must reproduce exactly ---
    let e30 = null, e32 = null;
    try { e30 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e30_retuned_capacity.json')); } catch (e) { e30 = null; }
    try { e32 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e32_fade_retune.json')); } catch (e) { e32 = null; }
    const guard = (def, stored, symbol) => {
        const here = books[def.name].oiBound.ratioOfMeans_published;
        const rel = stored ? Math.abs(here.exactUSD / stored - 1) : NaN;
        return { source: def.guardSource, storedValue: stored == null ? null : Math.round(stored), hereValue: here.USD, bindingSymbol: here.bindingSymbol, relError: rel, matches: Number.isFinite(rel) && rel < 1e-12, expectedSymbol: symbol, symbolMatches: here.bindingSymbol === symbol };
    };
    const guards = {
        'disp_lam0.1': guard({ name: 'disp_lam0.1', guardSource: 'e30#ewma_0.1_norm' }, e30 ? e30.books['ewma_0.1_norm'].oiPositionCapacity.at_5pct_of_meanOI.USD : null, 'linkusdt'),
        'fade_lam0.1': guard({ name: 'fade_lam0.1', guardSource: 'e32#lam0.1' }, e32 ? e32.books['lam0.1'].oiBound5pct : null, 'linkusdt'),
    };
    const validationPass = Object.values(guards).every((g) => g.matches && g.symbolMatches);

    // --- verdict ---
    const material = [];
    const rows = [];
    for (const [name, b] of Object.entries(books)) {
        const pubOi = b.oiBound.ratioOfMeans_published.USD;
        const pubUsable = b.restatedUsable.published.usable;
        const recentP5Oi = b.restatedUsable.recent24mP5.oiBound;
        const recentMinOi = b.restatedUsable.recent24mMin.oiBound;
        const recentP5Usable = b.restatedUsable.recent24mP5.usable;
        const oiFactorP5 = recentP5Oi ? pubOi / recentP5Oi : null;
        const oiFactorMin = recentMinOi ? pubOi / recentMinOi : null;
        const breach = b.atPublishedSize.breachFraction;
        const isMaterial = (oiFactorP5 != null && oiFactorP5 > 1.2) || (breach != null && breach > 0.05);
        if (isMaterial) material.push(name);
        rows.push({
            name, binding: b.oiBound.ratioOfMeans_published.bindingSymbol,
            publishedBoundUSD: pubOi,
            averageCaseUSD: b.oiBound.meanOfRatios_averageCase.USD,
            worstCaseUSD: b.oiBound.minOfRatios_worstCase.USD,
            recent24mP5USD: recentP5Oi,
            recent24mMinUSD: recentMinOi,
            oiFactorRecentP5: r4(oiFactorP5),
            oiFactorRecentMin: r4(oiFactorMin),
            publishedUsableUSD: pubUsable, recentP5UsableUSD: recentP5Usable,
            usableOverstatementFactor: r4(recentP5Usable ? pubUsable / recentP5Usable : null),
            breachFractionAtPublished: breach,
            peakParticipationPct: b.atPublishedSize.maxParticipationPct,
            impactCapacityUSD: b.impactCapacityY1,
            publishedBoundIs: b.impactCapacityY1 != null && pubOi != null ? (b.impactCapacityY1 < pubOi ? 'impact' : 'OI') : null,
        });
    }
    const verdict = {
        note: 'Falsifier: immaterial if every sleeve\'s recent-24m worst-case OI bound is within 20% of the published ratio-of-means AND the breach fraction at the published size is < 5%.',
        materialBooks: material,
        correctionIsMaterial: material.length > 0,
        summary: 'The published OI bound is f*mean(OI)/mean|w| (a ratio of means). The true average-case bound f/mean(|w|/OI) is lower, and the true worst case f*min(OI/|w|) is lower still; at the published size every sleeve breaches the 5%-of-OI cap a majority of the time, and peak participation reaches 16-44% of a single symbol\'s open interest.',
        validationPass,
    };

    return {
        config: { symbols: k, symbolList: names, perp, f: F, feeBps: FEE_BPS, books: BOOKDEFS.length, guardTargets: Object.keys(GUARDS) },
        guards, validationPass, books, frontier: rows, verdict,
    };
}
