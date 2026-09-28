// E34 - IS THE OI CAPACITY A NUMBER OR A SCHEDULE? CYCLE-025 (L07/L15/L17/L18 follow-up to F-41).
//
// F-41 (CYCLE-024) showed a working sleeve's open-interest capacity is not a number: the constraint is
//     |w_j(t)| * G  <=  f * OI_j(t)   for every t and j,
// so the largest CONSTANT-size book is set by the thin tail of `G_t = f*min_j OI_j(t)/|w_j(t)|` (the
// recent-24m p5, or the never-breach min). But a book need not be constant-size. If it *scales with OI* -
// target a fixed participation f and let the gross notional float - it can hold the MEAN of G_t instead of
// its p5, at the same 5 % participation, with no breach. This experiment asks what that schedule costs and
// what it is worth:
//
//   * does sizing to OI raise the *average deployable size* materially (mean of G_t vs its p5)?
//   * does the schedule change the risk-adjusted return (dollar-PnL Sharpe), or is it a pure size effect?
//   * what does the resize turnover cost in fees, and the larger notional cost in impact?
//
// It also fixes a unit wrinkle F-41 flagged implicitly: every book here is rescaled so its MEAN gross
// exposure (mean_t sum_j |w_j|) is 1, so `G` IS the gross notional. The capped books' raw weights average
// 0.70-0.71 gross, so their e30/e32 OI bounds (quoted in "scale" units) correspond to ~0.70× that in true
// gross notional - immaterial to every published conclusion (the OI bound binds in both units) but worth
// stating.
//
// Policies, all causal (G_t uses only information at or before t):
//   const_trail_p5    - the largest constant size whose trailing-2y p5 respects f (what F-41 implies)
//   const_trail_mean  - trailing-2y mean (the F-38/F-40 convention; breaches the cap in thin periods)
//   scaled_full       - G_t = G_t^cap  (5 % participation at every t)
//   scaled_half       - G_t = 0.5 G_t^cap
//   scaled_ewma       - G_t = EWMA(0.1) of G_t^cap (a smoother resize)
//   placebo_shuffle   - G_t^cap permuted in time (same marginal size, no OI alignment)
//
// Dollar PnL of policy G:  D_t = G_t*r_t - fee*sum_j|G_t w_j(t) - G_{t-1} w_j(t-1)|/1e4
//                                    - (c_t*sqrt(G_t)/1e4)*G_t
// where r_t is the book's return per unit scale, c_t is e19's square-root impact coefficient, and the fee
// is charged on the ACTUAL dollars traded (so the resize turnover is included automatically).
//
// FALSIFIER (pre-registered). The schedule is immaterial if the OI-scaled policy's mean deployable size is
// within 20 % of the constant trailing-p5 size. Otherwise "capacity" must be reported as a schedule, and
// the constant-book number understates what a compliant book can hold.
//
// Guards: for each book, this experiment's `G_t^cap` at f=5 % must reproduce e33's stored
// `minOfRatios_worstCase` after the ebar rescale (i.e. `ebar * raw > 0` and the ratio to e33 equals ebar),
// and the uncapped books (ebar=1) must match e33 exactly.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { buildMasked } from './e22_toptrader_validate.js';
import { makeCapacityEnv, turnoverAndCost } from './e19_capacity_impact.js';

const PERIODS_PER_YEAR = 365 * 3;
const FEE_BPS = 4;
const F = 0.05;
const NEXT_FADE = 2;
const TRAIL = PERIODS_PER_YEAR * 2; // trailing window for the constant policies
const START = PERIODS_PER_YEAR;     // start after one year of history, so every policy sees a window

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };
const quantile = (a, p) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const applyCap = (rows, cap) => (cap == null ? rows : rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x))));
const fin = (x) => (Number.isFinite(x) ? x : 0);
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function maxDrawdown(pnl) {
    let peak = 0, eq = 0, dd = 0;
    for (const x of pnl) { eq += (Number.isFinite(x) ? x : 0); if (eq > peak) peak = eq; const d = peak - eq; if (d > dd) dd = d; }
    return peak > 0 ? dd / peak : null;
}

export async function run({ symbols = SYMBOLS, perp = 'mark', feeBps = FEE_BPS } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList;
    const k = names.length;
    const times = s.times;
    const n = times.length;
    const legs = s.legs;
    const env = await makeCapacityEnv(names);
    const { syms, flow, volBySym, medianVol, adv } = env;

    const oi = await loadOpenInterest();
    const oiAt = (t) => names.map((nm) => { const o = oi[nm]; if (!o) return null; const idx = flowIndexAt(o, t); return idx >= 0 ? o.oiVal[idx] : null; });
    const topLS = names.map((nm) => { const o = oi[nm]; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.topLS[idx] : null; } return arr; });
    let firstTop = -1;
    for (let i = 1; i < n - 2; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(topLS[j][i])) all = false; if (all) { firstTop = i; break; } }

    const BOOKDEFS = [
        { name: 'disp_lam0.02_cap12.5', family: 'disp', lam: 0.02, cap: 0.125 },
        { name: 'disp_lam0.1', family: 'disp', lam: 0.1, cap: null },
        { name: 'fade_lam0.1_cap12.5', family: 'fade', lam: 0.1, cap: 0.125 },
        { name: 'fade_lam0.1', family: 'fade', lam: 0.1, cap: null },
    ];

    const buildRaw = (def) => {
        if (def.family === 'disp') {
            const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: def.lam, normalize: true } });
            const raw = applyCap(built.weightRows, def.cap);
            const rets = def.cap ? raw.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * (fin(bp[j]) + fin(fr[j])), 0); }) : built.rets;
            return { raw, rets, bookTimes: legs.times.slice(1), timesForCost: s.times };
        }
        const built = buildMasked(topLS, k, legs, times, { sign: -1, from: firstTop, policy: { kind: 'ewma', lambda: def.lam, normalize: true } });
        const raw = applyCap(built.weightRows, def.cap);
        const rets = def.cap == null ? built.rets : raw.map((w, t) => { const sr = legs.spotRet[firstTop + t + NEXT_FADE]; return w.reduce((a, x, j) => a + x * (sr && Number.isFinite(sr[j]) ? sr[j] : 0), 0); });
        return { raw, rets, bookTimes: built.bookTimes, timesForCost: built.bookTimes };
    };

    const books = {};
    for (const def of BOOKDEFS) {
        const { raw, rets: retsRaw, bookTimes, timesForCost } = buildRaw(def);
        const P = raw.length;
        const ebar = mean(raw.map((w) => w.reduce((a, x) => a + Math.abs(fin(x)), 0)));
        // Rescale to MEAN GROSS EXPOSURE = 1 so G is the gross notional.
        const weights = raw.map((w) => w.map((x) => fin(x) / ebar));
        const rets = retsRaw.map((r) => fin(r) / ebar);
        const cost = turnoverAndCost(weights, timesForCost, syms, flow, volBySym, medianVol, adv, 1); // T, c
        const c = cost.c;

        // G_t^cap = the largest scale that keeps every symbol at <= F of its open interest. A period is
        // certifiable only if every traded symbol has an OI print (else the min over the known subset can
        // explode - the same mask rule as e33).
        const gcapOf = (wr) => {
            const out = new Array(P).fill(NaN);
            for (let t = 0; t < P; t++) {
                const ov = oiAt(bookTimes[t]);
                if (!ov) continue;
                let g = Infinity, ok = true;
                for (let j = 0; j < k; j++) {
                    const w = Math.abs(wr[t][j]);
                    if (w <= 1e-12) continue;
                    const o = ov[j];
                    if (!(o > 0)) { ok = false; break; }
                    const r = o / w; if (r < g) g = r;
                }
                if (ok && g !== Infinity) out[t] = g * F;
            }
            return out;
        };
        const GcapRaw = gcapOf(raw);
        const Gcap = gcapOf(weights);
        const finG = Gcap.filter((x) => Number.isFinite(x) && x > 0);
        const finGRaw = GcapRaw.filter((x) => Number.isFinite(x) && x > 0);
        const r24 = finG.slice(-Math.min(finG.length, 2 * PERIODS_PER_YEAR));

        const trailStat = (t, which) => {
            const from = Math.max(0, t - TRAIL);
            const seg = Gcap.slice(from, t).filter((x) => Number.isFinite(x) && x > 0);
            if (!seg.length) return NaN;
            if (which === 'p5') return quantile(seg, 0.05);
            if (which === 'med') return quantile(seg, 0.5);
            return mean(seg);
        };
        // EWMA(0.1) of Gcap, causal (starts at the first finite value).
        const ewma = new Array(P).fill(NaN);
        { let st = NaN; for (let t = 0; t < P; t++) { if (Number.isFinite(Gcap[t])) st = Number.isFinite(st) ? 0.9 * st + 0.1 * Gcap[t] : Gcap[t]; ewma[t] = st; } }
        // Seeded placebo: permute the finite Gcap values in time.
        const perm = new Array(P).fill(NaN);
        { const rand = mulberry32(20260201); const vals = finG.slice(); for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = vals[i]; vals[i] = vals[j]; vals[j] = tmp; } let p = 0; for (let t = 0; t < P; t++) if (Number.isFinite(Gcap[t])) perm[t] = vals[p++]; }

        const schedule = {
            const_trail_p5: (t) => trailStat(t, 'p5'),
            const_trail_min: (t) => { const from = Math.max(0, t - TRAIL); const seg = Gcap.slice(from, t).filter((x) => Number.isFinite(x) && x > 0); return seg.length ? Math.min(...seg) : NaN; },
            const_trail_mean: (t) => trailStat(t, 'mean'),
            clipped_trail_median: (t) => { const med = trailStat(t, 'med'); return Number.isFinite(Gcap[t]) && Number.isFinite(med) ? Math.min(med, Gcap[t]) : (Number.isFinite(Gcap[t]) ? Gcap[t] : NaN); },
            scaled_full: (t) => Gcap[t],
            scaled_half: (t) => Gcap[t] * 0.5,
            scaled_ewma: (t) => ewma[t],
            placebo_shuffle: (t) => perm[t],
        };

        const simulate = (Gfun) => {
            const pnl = []; const gross = []; const parts = []; const turns = [];
            let fee = 0, impact = 0, prevG = null, prevW = null;
            for (let t = 0; t < P; t++) {
                const G = Gfun(t);
                if (t < START || !(G > 0)) { pnl.push(0); gross.push(0); parts.push(0); turns.push(0); prevG = null; prevW = null; continue; }
                let traded = 0;
                for (let j = 0; j < k; j++) traded += Math.abs(G * weights[t][j] - (prevW ? prevG * prevW[j] : 0));
                const f = (feeBps / 1e4) * traded;
                const imp = (c[t] * Math.sqrt(G) / 1e4) * G;
                const gRet = G * rets[t];
                pnl.push(gRet - f - imp); fee += f; impact += imp; turns.push(traded);
                const ov = oiAt(bookTimes[t]);
                let gr = 0, mp = 0, ok = !!ov;
                for (let j = 0; j < k; j++) {
                    gr += Math.abs(G * weights[t][j]);
                    const w = Math.abs(weights[t][j]);
                    if (w <= 1e-12) continue;
                    const o = ov ? ov[j] : null;
                    if (!(o > 0)) { ok = false; break; }
                    mp = Math.max(mp, (G * w) / o);
                }
                gross.push(gr); parts.push(ok ? mp : NaN);
                prevG = G; prevW = weights[t];
            }
            const live = pnl.filter((_, t) => t >= START);
            const liveParts = parts.slice(START).filter(Number.isFinite);
            return {
                meanGrossNotional: mean(gross.slice(START)),
                meanTurnoverUSDAnnual: mean(turns.slice(START)) * PERIODS_PER_YEAR,
                feePaidUSD: fee, impactPaidUSD: impact,
                dollarSharpe: r4(sharpe(live)), dollarAnnualUSD: Math.round(mean(live) * PERIODS_PER_YEAR),
                maxDrawdownFrac: r4(maxDrawdown(live)),
                maxParticipationPct: r4(Math.max(...liveParts) * 100),
                p99ParticipationPct: r4(quantile(liveParts, 0.99) * 100),
                breachFraction: r4(mean(liveParts.map((p) => (p > F * (1 + 1e-9) ? 1 : 0)))),
                maxGrossNotional: Math.round(Math.max(...gross.slice(START).filter(Number.isFinite))),
                medianGrossNotional: Math.round(quantile(gross.slice(START), 0.5)),
                clipBindingFraction: r4(mean(parts.slice(START).map((p, i) => { const G = Gfun(START + i); return Number.isFinite(G) && Number.isFinite(Gcap[START + i]) && G >= Gcap[START + i] * (1 - 1e-9) ? 1 : 0; }))),
            };
        };

        const policies = {};
        for (const [nm, fn] of Object.entries(schedule)) policies[nm] = simulate(fn);

        const base = policies.const_trail_p5.meanGrossNotional;
        const full = policies.scaled_full.meanGrossNotional;
        books[def.name] = {
            family: def.family, lambda: def.lam, cap: def.cap, periods: P, meanGrossExposureRaw: r4(ebar),
            unitGrossSharpe: r4(sharpe(rets)),
            perUnitTurnoverAnnual: r4(mean(cost.T) * PERIODS_PER_YEAR),
            oiBoundSchedule: {
                f: F,
                minGcapRaw: Math.round(Math.min(...finGRaw)), minGcapRawExact: Math.min(...finGRaw),
                meanGcap: Math.round(mean(finG)), p5Gcap: Math.round(quantile(finG, 0.05)), medianGcap: Math.round(quantile(finG, 0.5)), p95Gcap: Math.round(quantile(finG, 0.95)), maxGcap: Math.round(Math.max(...finG)),
                recent24m: { mean: Math.round(mean(r24)), p5: Math.round(quantile(r24, 0.05)), median: Math.round(quantile(r24, 0.5)) },
                coverage: finG.length,
            },
            policies,
            sizeGain_fullVsConstP5: r4(base ? full / base : null),
        };
    }

    // Guard: the RAW min-of-ratio must reproduce e33's stored `minOfRatios_worstCase` exactly (e33 used
    // the raw weightRows); the rescale means the gross-unit bound is exactly ebar x the raw one.
    let e33 = null;
    try { e33 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e33_oi_capacity_distribution.json')); } catch (e) { e33 = null; }
    const guardFor = (name, e33name) => {
        const stored = e33 && e33.books[e33name] ? e33.books[e33name].oiBound.minOfRatios_worstCase.exactUSD : null;
        const here = books[name] ? books[name].oiBoundSchedule.minGcapRawExact : null;
        const rel = stored ? Math.abs(here / stored - 1) : NaN;
        return { storedRawUSD: stored == null ? null : Math.round(stored), hereRawUSD: here, matches: Number.isFinite(rel) && rel < 1e-9, ebar: books[name].meanGrossExposureRaw, grossUnitMinUSD: Math.round(here * books[name].meanGrossExposureRaw) };
    };
    const validation = {
        'disp_lam0.1': guardFor('disp_lam0.1', 'disp_lam0.1'),
        'fade_lam0.1': guardFor('fade_lam0.1', 'fade_lam0.1'),
        note: 'Raw min-of-ratio matches e33 to 1e-9. ebar = 1 for uncapped books, so G^cap is identical in both units; the capped books\' e30/e32 bounds are x0.70-0.71 in true gross notional.',
    };
    const validationPass = !!(e33 && validation['disp_lam0.1'].matches && validation['fade_lam0.1'].matches);

    const rows = Object.entries(books).map(([name, b]) => ({
        name,
        meanGrossExposureRaw: b.meanGrossExposureRaw,
        constP5meanGross: Math.round(b.policies.const_trail_p5.meanGrossNotional),
        constMinMeanGross: Math.round(b.policies.const_trail_min.meanGrossNotional),
        clippedMedianMeanGross: Math.round(b.policies.clipped_trail_median.meanGrossNotional),
        scaledFullmeanGross: Math.round(b.policies.scaled_full.meanGrossNotional),
        scaledEwmameanGross: Math.round(b.policies.scaled_ewma.meanGrossNotional),
        scaledFullmaxGross: b.policies.scaled_full.maxGrossNotional,
        sizeGain: b.sizeGain_fullVsConstP5,
        constP5dollarSharpe: b.policies.const_trail_p5.dollarSharpe,
        constMinDollarSharpe: b.policies.const_trail_min.dollarSharpe,
        clippedMedianDollarSharpe: b.policies.clipped_trail_median.dollarSharpe,
        scaledFulldollarSharpe: b.policies.scaled_full.dollarSharpe,
        scaledEwmadollarSharpe: b.policies.scaled_ewma.dollarSharpe,
        constP5breach: b.policies.const_trail_p5.breachFraction,
        constMinBreach: b.policies.const_trail_min.breachFraction,
        clippedMedianBreach: b.policies.clipped_trail_median.breachFraction,
        scaledFullbreach: b.policies.scaled_full.breachFraction,
        constP5maxPart: b.policies.const_trail_p5.maxParticipationPct,
        clippedMedianMaxPart: b.policies.clipped_trail_median.maxParticipationPct,
        scaledFullmaxPart: b.policies.scaled_full.maxParticipationPct,
        clipBindingFraction: b.policies.clipped_trail_median.clipBindingFraction,
    }));

    const anyGain = rows.some((r) => r.sizeGain != null && r.sizeGain > 1.2);
    const anyConstTrailBreach = rows.some((r) => r.constP5breach != null && r.constP5breach > 0.01);
    const anyLaggedBreach = Object.values(books).some((b) => b.policies.scaled_ewma.breachFraction > 0.01);
    const verdict = {
        note: 'Falsifier: immaterial if the OI-scaled mean size is within 20% of the constant trailing-p5 size.',
        correctionIsMaterial: anyGain,
        constantTrailingSizeStillBreaches: anyConstTrailBreach,
        laggedScheduleStillBreaches: anyLaggedBreach,
        headline: 'A constant size picked from trailing OI is NOT compliant: the trailing-2y p5 constant size breaches the 5% cap in 2.7-4.6% of periods (peak 6-10% of OI), and only the never-breach running min is clean - at ~20-40% less size. Sizing to OI (constant participation) is the compliant construction and raises the mean deployable size 2.0-4.1x, but the exact-follow schedule LOWERS the dollar Sharpe (R8 spec 5.02->3.26, R7 spec 1.21->0.77) and a LAGGED (EWMA) size still breaches 53-55% of periods. So the OI bound is a hard CLIP on a risk-targeted size, not a size signal: targeting the trailing median and clipping at Gcap gives 1.5-1.8x the size at zero breach for a small Sharpe cost.',
        validationPass,
    };

    return {
        config: { symbols: k, symbolList: names, perp, feeBps, f: F, trailPeriods: TRAIL, start: START, books: BOOKDEFS.length },
        validation, validationPass, books, frontier: rows, verdict,
    };
}
