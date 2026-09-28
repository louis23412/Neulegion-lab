// E24 - SHORT-HORIZON REVERSAL: the repo's P3 family on the full sample, at 1h AND 15m,
// and the one shape nobody has tried - a dollar-neutral cross-sectional reversal book. L13. CYCLE-016.
//
// WHERE THIS CAME FROM. L13 was opened in CYCLE-001 with a single question: the project's P3
// reversal family is PARK on taker cost, and the lab's long-sample readouts put every family's
// break-even at 0.5-2.6 bps against a 5-10 bps taker - so is the *gross* reversal edge alive, and
// at what break-even? THE BOARD SAID "Owner experiments: - (to build)". But E2 ALREADY SCORES the
// shipped `sig-reversal` (`reversal-1`) in both its 1h and 15m sweeps, and `run_all` regenerates
// both - the number has been in `results/e2_arm_sweep_{1h,15m}.json` since CYCLE-001 and simply was
// never surfaced. So part of L13 is already answered; this experiment (a) surfaces and extends it
// (windows 2/4/8, the vol-scaled variant, block/year stability), and (b) tests what is genuinely
// untested.
//
// FOUR PARTS.
//
//   0. MECHANISM, model-free. The lag-k autocorrelation of returns and the variance ratio
//      VR(k) = Var(k-bar return) / (k * Var(1-bar)). VR < 1 is mean reversion. This is the
//      primitive the whole family bets on; if VR(1) ~ 1 and the autocorrelation ~ 0 there is
//      nothing to harvest, whatever the arms read. Also decomposes the repo's claim that "the
//      edge lives in SIGNS rather than magnitudes": the IC of -r[t] vs the IC of -sign(r[t]).
//
//   A. THE REPO'S P3 ARMS, per stream, through the SAME pipeline as `e2`, at 1h and 15m, FULL
//      history: gross Sharpe, break-even bps, block stability, per-year, and the last-600-bar
//      (F-01) reading. Arms: `reversal` (1), `reversalWindow` (2/4/8), `reversalVol` (16),
//      `crossSectionalReversal`, and a pure-sign variant - plus `momentum-16` and `xs-momentum-16`
//      as the mirror/reference. Controls (oracle / anti-oracle / seeded random / always-long) run
//      in the SAME call, so this file is a self-contained negative under the F-11 rule.
//
//   B. THE DOLLAR-NEUTRAL CROSS-SECTIONAL REVERSAL BOOK. F-07 measured cross-sectional MOMENTUM in
//      the repo's per-stream shape (|Sharpe| <= 0.033 at 1h; 15m reads -0.06). It did NOT measure
//      the *book* shape that rescued the carry dispersion (F-24) and the toptrader fade (F-29):
//      weights w_j = -(past-return_j - mean)/sum|.|, sum w = 0, earning the next bar's spot return.
//      That is a different object from the z-scored per-stream arm, and it is the shape the lab's
//      two working cross-sectional sleeves actually use. Windows 1/2/4/8/16, level and rank
//      weights, both signs (reversal and the momentum control), audited by `e16#audit`.
//
//   C. HONESTY GUARDS. The book is scored on the NEXT bar and on the CONTEMPORANEOUS bar: a causal
//      construction reads ~0 (or mildly negative) on the next bar and strongly negative on the
//      contemporaneous one (you are fading a move the book itself is exposed to). If "next" is the
//      larger of the two, the index convention is wrong (the L10-q / e21 trap). A 40-seed
//      cross-sectional signal-shuffle placebo gives the book's position in its own null.
//
// Annualisation note: per-stream arms use `score` (basis 252, the ledger convention - see
// `lib/lab.js`), so their Sharpes are on the SAME scale as F-01/F-06/F-07. Books are audited on the
// 252 basis too for comparability, and their breakout/turnover is ALSO reported on the true
// calendar basis (8760 1h, 35040 15m) where a per-year number is physically meaningful.

import {
    buildPanel, positionsOfFast, score, netSeries, panelReadout, stats, pearsonCorrelation,
    SYMBOLS, PERIODS_PER_YEAR,
} from '../lib/lab.js';
import {
    reversal, reversalWindow, reversalVol, crossSectionalReversal, momentum,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { xsMomentum } from '../prototypes/signals.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';
import { blockStability } from './e2_arm_sweep.js';
import { audit } from './e16_cost_capacity.js';
import { rankWeights, levelWeights } from './e17_low_turnover.js';

const TRUE_PPY = { '1h': 24 * 365, '15m': 4 * 24 * 365 };

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const stdev = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const fin = (x) => (Number.isFinite(x) ? x : 0);
const clamp = (x) => (x < -1 ? -1 : x > 1 ? 1 : x);
const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// Sign reversal: -sign(r[t]). The repo's note claims the edge lives in SIGNS rather than
// magnitudes, so this variant exists to test that claim against `reversal` (-r[t]).
export function signReversal(series, t) {
    const r = series.returns;
    if (!r || t < 1) return NaN;
    return Number.isFinite(r[t]) ? -Math.sign(r[t]) : NaN;
}

// ---- 0. mechanism --------------------------------------------------------------------------
// Lag-k autocorrelation of one return series (sample, overlapping), and the variance ratio
// VR(k) = Var(k-bar sum) / (k Var(1-bar)). VR < 1 -> mean reversion; VR > 1 -> trend.
function autocorr(r, k) {
    const a = [];
    const b = [];
    for (let t = 0; t + k < r.length; t++) { if (Number.isFinite(r[t]) && Number.isFinite(r[t + k])) { a.push(r[t]); b.push(r[t + k]); } }
    return pearsonCorrelation(a, b);
}
function varianceRatio(r, k) {
    const one = [];
    for (let t = 0; t < r.length; t++) if (Number.isFinite(r[t])) one.push(r[t]);
    const v1 = stdev(one) ** 2;
    if (!(v1 > 0)) return NaN;
    const ks = [];
    for (let t = 0; t + k - 1 < r.length; t++) { let s = 0; let ok = true; for (let j = 0; j < k; j++) { if (!Number.isFinite(r[t + j])) { ok = false; break; } s += r[t + j]; } if (ok) ks.push(s); }
    const vk = stdev(ks) ** 2;
    return vk / (k * v1);
}

// Cross-sectional DECAY PROFILE. For each forward horizon h, the average per-period
// cross-sectional correlation between the past `w`-bar return vector and the forward h-bar return
// vector. Positive -> the laggards keep lagging (momentum); negative -> reversal. This is the
// mechanism curve the book bets on, and its half-life is what decides whether a slower (cheaper)
// construction could still harvest it - the question F-25 answered NO for the fast basis leg.
function xsDecay(returns, k, { w = 1, horizons = [1, 2, 4, 8, 16, 32, 64] } = {}) {
    const n = returns[0].length;
    const out = {};
    for (const h of horizons) {
        let sum = 0; let cnt = 0;
        for (let i = w; i + h < n; i++) {
            const x = []; const y = [];
            for (let j = 0; j < k; j++) {
                let s = 0; for (let q = 0; q < w; q++) s += returns[j][i - q];
                let f = 0; for (let q = 1; q <= h; q++) f += returns[j][i + q];
                if (!Number.isFinite(s) || !Number.isFinite(f)) continue;
                x.push(s); y.push(f);
            }
            if (x.length < 4) continue;
            const c = pearsonCorrelation(x, y);
            if (Number.isFinite(c)) { sum += c; cnt += 1; }
        }
        out[h] = cnt ? sum / cnt : NaN;
    }
    return out;
}

// ---- B. the dollar-neutral cross-sectional book --------------------------------------------
// Signal at book period i: raw_j = sum of the last `w` returns of stream j ending AT i (causal -
// r[i] is known when bar i closes). Weights from the CROSS-SECTION of raw (missing symbols masked);
// the book earns the NEXT bar's return, sum_j w_j r_j[i+1]. `sign = -1` fades the past move
// (reversal), `+1` follows it (momentum - the control). Returns the return series + weight rows.
function xsReversalBook(returns, k, { w = 1, scheme = 'level', sign = -1, start = null, ewma = null } = {}) {
    const n = returns[0].length;
    const rets = [];
    const weightRows = [];
    const bookTimes = [];
    const from = start == null ? w : start;
    const build = scheme === 'rank' ? rankWeights : levelWeights;
    let held = new Array(k).fill(0);
    for (let i = from; i < n - 1; i++) {
        const raw = [];
        for (let j = 0; j < k; j++) {
            const r = returns[j];
            let s = 0;
            for (let q = 0; q < w; q++) s += r[i - q];
            raw.push(Number.isFinite(s) ? s : NaN);
        }
        const present = [];
        for (let j = 0; j < k; j++) if (Number.isFinite(raw[j])) present.push(j);
        if (present.length < 3) { continue; }
        const sv = present.map((j) => raw[j]);
        const wv = build(sv);
        const row = new Array(k).fill(0);
        present.forEach((j, q) => { row[j] = fin(sign * wv[q]); });
        // Optional EWMA smoothing of the WEIGHT VECTOR (the F-24 trick): held = (1-l)*held + l*target,
        // renormalised to sum|w| = 1 so a smoothed book stays fully invested (it under-invests otherwise,
        // which would flatter the break-even by shrinking the effective position without shrinking the P&L).
        let use = row;
        if (ewma != null) {
            held = held.map((h, j) => (1 - ewma) * h + ewma * row[j]);
            const g0 = held.reduce((a, x) => a + Math.abs(x), 0) || 1;
            use = held.map((x) => x / g0);
        } else {
            const g = row.reduce((a, x) => a + Math.abs(x), 0) || 1;
            use = row.map((x) => x / g); // sum|w| = 1 exactly (scale-free break-even)
        }
        let ret = 0;
        for (let j = 0; j < k; j++) ret += use[j] * fin(returns[j][i + 1]);
        rets.push(ret);
        weightRows.push(use);
        bookTimes.push(i);
    }
    // contiguous-indexed return series on the full bar grid (NaN outside), so per-year and
    // next-vs-contemporaneous reads can share one index space.
    const full = new Array(n).fill(NaN);
    for (let q = 0; q < rets.length; q++) full[bookTimes[q]] = rets[q];
    return { rets, weightRows, bookTimes, full };
}

// Contemporaneous twin: the SAME weights, earning the bar they were computed from (r[i] not r[i+1]).
// A causal construction must be far MORE negative here than on the next bar (you fade a move you
// are, by construction, on the wrong side of in the same instant).
function contemporaneousBook(returns, k, opts) {
    const n = returns[0].length;
    const b = xsReversalBook(returns, k, opts);
    const rets = [];
    for (let q = 0; q < b.bookTimes.length; q++) {
        const i = b.bookTimes[q];
        let ret = 0;
        const row = b.weightRows[q];
        for (let j = 0; j < k; j++) ret += row[j] * fin(returns[j][i]);
        rets.push(ret);
    }
    return rets;
}

// Per-calendar-year Sharpes of a {time,ret} series on the bar grid.
function perYear(series, times, tf) {
    const by = {};
    for (let i = 0; i < series.length; i++) {
        if (!Number.isFinite(series[i])) continue;
        const y = new Date(times[i]).getUTCFullYear();
        (by[y] = by[y] || []).push(series[i]);
    }
    return Object.fromEntries(Object.entries(by).map(([y, a]) => [y, +sharpeRatio(a, { periodsPerYear: PERIODS_PER_YEAR }).toFixed(2)]));
}

export async function run({ tf = '1h', blocks = 8, placeboSeeds = 40 } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const k = panel.length;
    const n = panel[0].n;
    const times = panel[0].t;
    const tpy = TRUE_PPY[tf] || PERIODS_PER_YEAR;
    const out = {
        config: { tf, bars: n, streams: k, blocks, placeboSeeds, periodCount: n, truePeriodsPerYear: tpy, firstBar: new Date(times[0]).toISOString(), lastBar: new Date(times[n - 1]).toISOString() },
    };

    // ---- 0. mechanism ------------------------------------------------------------------------
    const perSymbol = {};
    for (let j = 0; j < k; j++) {
        const r = panel[j].returns;
        const h = Math.floor(n / 2);
        perSymbol[SYMBOLS[j]] = {
            n: r.filter(Number.isFinite).length,
            ac1: autocorr(r, 1), ac2: autocorr(r, 2), ac5: autocorr(r, 5),
            vr2: varianceRatio(r, 2), vr4: varianceRatio(r, 4), vr8: varianceRatio(r, 8), vr16: varianceRatio(r, 16),
            ac1_h1: autocorr(r.slice(0, h), 1), ac1_h2: autocorr(r.slice(h), 1),
        };
    }
    // Pooled sign-vs-magnitude: the repo's claim is that reversal lives in SIGNS. Compare the
    // per-symbol IC of -r[t] against r[t+1] with that of -sign(r[t]) against r[t+1].
    const icMag = [];
    const icSign = [];
    for (let j = 0; j < k; j++) {
        const r = panel[j].returns;
        const a = []; const b = [];
        for (let t = 0; t + 1 < n; t++) { if (Number.isFinite(r[t]) && Number.isFinite(r[t + 1])) { a.push(-r[t]); b.push(r[t + 1]); } }
        const c = []; const d = [];
        for (let t = 0; t + 1 < n; t++) { if (Number.isFinite(r[t])) { c.push(-Math.sign(r[t])); d.push(r[t + 1]); } }
        icMag.push(pearsonCorrelation(a, b));
        icSign.push(pearsonCorrelation(c, d));
    }
    // Average per-symbol ICs only (magnitudes are not comparable across symbols pooled raw).
    out.mechanism = {
        note: 'acK = lag-K autocorrelation of returns; vrK = variance ratio Var(K-bar)/(K*Var(1-bar)); <=1 is mean reversion. icMag = IC of the raw reversal -r[t] on r[t+1]; icSign = IC of -sign(r[t]) on r[t+1] (the repo claims the edge lives in signs).',
        perSymbol,
        meanAcrossSymbols: {
            ac1: mean(Object.values(perSymbol).map((p) => p.ac1)),
            ac1NegativeCount: Object.values(perSymbol).filter((p) => p.ac1 < 0).length,
            vr2: mean(Object.values(perSymbol).map((p) => p.vr2)),
            vr4: mean(Object.values(perSymbol).map((p) => p.vr4)),
            vr8: mean(Object.values(perSymbol).map((p) => p.vr8)),
            vr16: mean(Object.values(perSymbol).map((p) => p.vr16)),
            icMagnitude: mean(icMag),
            icSign: mean(icSign),
            ac1Half1: mean(Object.values(perSymbol).map((p) => p.ac1_h1)),
            ac1Half2: mean(Object.values(perSymbol).map((p) => p.ac1_h2)),
        },
        xsDecayByWindow: { 'w1': xsDecay(panel.map((s) => s.returns), k, { w: 1 }), 'w4': xsDecay(panel.map((s) => s.returns), k, { w: 4 }) },
    };

    // ---- A. the repo's P3 arms, per stream ---------------------------------------------------
    const armDefs = [
        { name: 'rev-1', fn: reversal, window: 1, note: 'shipped sig-reversal: -r[t]' },
        { name: 'rev-2', fn: reversalWindow, window: 2, note: 'minus the trailing 2-bar mean return' },
        { name: 'rev-4', fn: reversalWindow, window: 4, note: 'shipped sig-reversal-4' },
        { name: 'rev-8', fn: reversalWindow, window: 8, note: 'minus the trailing 8-bar mean return' },
        { name: 'rev-vol16', fn: reversalVol, window: 16, note: 'shipped sig-reversal-vol: -r[t]/trailing vol' },
        { name: 'rev-sign1', fn: signReversal, window: 1, note: 'NEW pure-sign variant: -sign(r[t])' },
        { name: 'rev-xs', fn: crossSectionalReversal, window: 1, note: 'shipped sig-reversal-xs: -r[t] net of the cross-section' },
        { name: 'mom-16', fn: momentum, window: 16, note: 'reference: shipped sig-momentum' },
        { name: 'xs-mom-16', fn: xsMomentum, window: 16, note: 'reference: cross-sectional momentum (F-07)' },
    ];
    const arms = {};
    for (const arm of armDefs) {
        const sig = panel.map((s) => positionsOfFast(arm.fn, s, { window: arm.window }));
        const per = panel.map((s, i) => {
            const m = score(s.returns, sig[i], { costBps: 0 });
            return { netSharpe: m.netSharpe, breakEvenCostBps: m.breakEvenCostBps, turnoverPerBar: m.turnover / m.bars };
        });
        const net = panel.map((s, i) => netSeries(s.returns, sig[i], 0));
        const rc = Math.min(600, n);
        const recent = panel.map((s, i) => score(s.returns.slice(-rc), sig[i].slice(-rc), { costBps: 0 }));
        // pooled net series (equal-weight across streams) for a per-year read of the family
        const pooledNet = new Array(n).fill(0);
        for (let t = 0; t < n; t++) { let s2 = 0; for (let j = 0; j < k; j++) s2 += fin(net[j][t]); pooledNet[t] = s2 / k; }
        arms[arm.name] = {
            note: arm.note,
            meanSharpe: stats(per.map((p) => p.netSharpe)),
            meanBreakEvenCostBps: mean(per.map((p) => p.breakEvenCostBps)),
            turnoverPerBar: mean(per.map((p) => p.turnoverPerBar)),
            positiveStreams: per.filter((p) => p.netSharpe > 0).length,
            stability: blockStability(net, blocks),
            pooled: panelReadout(net, { label: arm.name }).pooled,
            verdictWindow600: { meanSharpe: stats(recent.map((p) => p.netSharpe)).mean, meanBreakEvenCostBps: mean(recent.map((p) => p.breakEvenCostBps)) },
            pooledPerYear: perYear(pooledNet, times, tf),
        };
    }
    out.arms = arms;

    // ---- controls (F-11), same session --------------------------------------------------------
    const rnd = mulberry32(20261601);
    const randomPos = new Array(n).fill(0);
    for (let i = 0; i < n; i++) randomPos[i] = rnd() < 0.5 ? -1 : 1;
    const controlDefs = {
        oracle: (r) => r.map((x, t) => (t + 1 < r.length ? Math.sign(r[t + 1]) : 0)),
        antiOracle: (r) => r.map((x, t) => (t + 1 < r.length ? -Math.sign(r[t + 1]) : 0)),
        random: () => randomPos.slice(),
        alwaysLong: (r) => r.map(() => 1),
    };
    const controls = {};
    for (const [name, f] of Object.entries(controlDefs)) {
        const sig = panel.map((s) => f(s.returns));
        const per = panel.map((s, i) => score(s.returns, sig[i], { costBps: 0 }));
        controls[name] = { meanSharpe: stats(per.map((p) => p.netSharpe)).mean };
    }
    const ctrlPass = Math.abs(controls.oracle.meanSharpe) > 10 && Math.abs(controls.oracle.meanSharpe + controls.antiOracle.meanSharpe) < 1e-6 && Math.abs(controls.random.meanSharpe) < 0.2;
    out.controls = { ...controls, pass: ctrlPass };

    // ---- B. the dollar-neutral cross-sectional reversal book ----------------------------------
    const returns = panel.map((s) => s.returns);
    const marketNext = []; // equal-weight spot return at i+1, for a market-corr read
    for (let i = 0; i < n; i++) { let s2 = 0; for (let j = 0; j < k; j++) s2 += fin(returns[j][i]); marketNext.push(s2 / k); }

    const books = {};
    for (const scheme of ['level', 'rank']) {
        for (const w of [1, 2, 4, 8, 16]) {
            for (const sign of [-1, 1]) {
                const tag = `${scheme}_w${w}_${sign < 0 ? 'rev' : 'mom'}`;
                const b = xsReversalBook(returns, k, { w, scheme, sign });
                if (!b.rets.length) continue;
                const a = audit(tag, b.rets, b.weightRows, { periodsPerYear: PERIODS_PER_YEAR });
                const h = Math.floor(b.rets.length / 2);
                const years = {};
                for (let q = 0; q < b.rets.length; q++) { const y = new Date(times[b.bookTimes[q]]).getUTCFullYear(); (years[y] = years[y] || []).push(b.rets[q]); }
                const contemp = contemporaneousBook(returns, k, { w, scheme, sign });
                const netMkt = b.bookTimes.map((i) => marketNext[i + 1]);
                books[tag] = {
                    scheme, window: w, sign,
                    grossSharpe: a.gross.sharpe,
                    sharpeTrueCalendar: a.gross.sharpe * Math.sqrt(tpy / PERIODS_PER_YEAR),
                    breakEvenBps: a.breakEvenBps,
                    turnoverPerBar: a.turnover.meanPerPeriod,
                    turnoverAnnualTrue: a.turnover.meanPerPeriod * tpy,
                    net4Sharpe: a.net['4'] ? a.net['4'].sharpe : null,
                    net10Sharpe: a.net['10'] ? a.net['10'].sharpe : null,
                    halves: [+sharpeRatio(b.rets.slice(0, h), { periodsPerYear: PERIODS_PER_YEAR }).toFixed(3), +sharpeRatio(b.rets.slice(h), { periodsPerYear: PERIODS_PER_YEAR }).toFixed(3)],
                    contemporaneousSharpe: +sharpeRatio(contemp, { periodsPerYear: PERIODS_PER_YEAR }).toFixed(3),
                    marketCorr: pearsonCorrelation(b.rets, netMkt),
                    perYear: Object.fromEntries(Object.entries(years).map(([y, arr]) => [y, +sharpeRatio(arr, { periodsPerYear: PERIODS_PER_YEAR }).toFixed(2)])),
                    periods: b.rets.length,
                };
            }
        }
    }
    out.books = books;

    // Cost rescue attempt (the F-24 / F-25 pattern). Smoothing the WEIGHT VECTOR cut the carry
    // dispersion book's turnover ~9x at no gross cost (F-24) but DESTROYED the fast basis-convergence
    // leg (F-25: 9.15 -> 2.66). Reversal is the other intrinsically-fast signal in the lab, so it
    // decides which one reversal resembles - and whether ANY reversal book can clear a fee.
    const revTagsSorted = Object.keys(books).filter((t) => books[t].sign < 0).sort((x, y) => books[y].grossSharpe - books[x].grossSharpe);
    const smoothing = {};
    for (const base of revTagsSorted.slice(0, 3)) {
        const cfg = books[base];
        smoothing[base] = { unsmoothed: { grossSharpe: cfg.grossSharpe, breakEvenBps: cfg.breakEvenBps, turnoverAnnualTrue: cfg.turnoverAnnualTrue } };
        for (const lam of [0.5, 0.25, 0.1, 0.05]) {
            const b = xsReversalBook(returns, k, { w: cfg.window, scheme: cfg.scheme, sign: -1, ewma: lam });
            const a = audit(`${base}_ewma${lam}`, b.rets, b.weightRows, { periodsPerYear: PERIODS_PER_YEAR });
            smoothing[base][`ewma_${lam}`] = { grossSharpe: a.gross.sharpe, breakEvenBps: a.breakEvenBps, turnoverAnnualTrue: a.turnover.meanPerPeriod * tpy, net4Sharpe: a.net['4'] ? a.net['4'].sharpe : null, net10Sharpe: a.net['10'] ? a.net['10'].sharpe : null };
        }
    }
    out.smoothing = smoothing;

    // The strongest reversal book (by gross Sharpe) gets the placebo distribution and the
    // causality index check, so the one shape that could carry the family is stress-tested.
    const revTags = Object.keys(books).filter((t) => books[t].sign < 0);
    const bestTag = revTags.sort((x, y) => books[y].grossSharpe - books[x].grossSharpe)[0];
    const placebo = [];
    const rp = mulberry32(20261602);
    for (let s2 = 0; s2 < placeboSeeds; s2++) {
        // shuffle the per-stream signal across symbols each period (keeps the weight multiset, kills
        // the cross-sectional ordering - a valid null with zero information)
        const rets = [];
        const rows = [];
        const w = books[bestTag].window;
        for (let i = w; i < n - 1; i++) {
            const raw = [];
            for (let j = 0; j < k; j++) { let s3 = 0; for (let q = 0; q < w; q++) s3 += returns[j][i - q]; raw.push(s3); }
            const perm = raw.slice();
            for (let q = perm.length - 1; q > 0; q--) { const t2 = Math.floor(rp() * (q + 1)); [perm[q], perm[t2]] = [perm[t2], perm[q]]; }
            const sv = perm.filter(Number.isFinite);
            if (sv.length < 3) continue;
            const wv = (books[bestTag].scheme === 'rank' ? rankWeights : levelWeights)(sv);
            const row = new Array(k).fill(0);
            let q2 = 0;
            for (let j = 0; j < k; j++) { if (!Number.isFinite(perm[j])) continue; row[j] = -fin(wv[q2++]); }
            const g = row.reduce((a2, x) => a2 + Math.abs(x), 0) || 1;
            for (let j = 0; j < k; j++) row[j] /= g;
            let ret = 0;
            for (let j = 0; j < k; j++) ret += row[j] * fin(returns[j][i + 1]);
            rets.push(ret); rows.push(row);
        }
        placebo.push(sharpeRatio(rets, { periodsPerYear: PERIODS_PER_YEAR }));
    }
    out.bookRobustness = {
        bestTag,
        placebo: { mean: mean(placebo), sd: stdev(placebo), z: (books[bestTag].grossSharpe - mean(placebo)) / (stdev(placebo) || 1), seeds: placeboSeeds },
        causality: {
            nextSharpe: books[bestTag].grossSharpe,
            contemporaneousSharpe: books[bestTag].contemporaneousSharpe,
            magnitudeRatio: Math.abs(books[bestTag].grossSharpe / books[bestTag].contemporaneousSharpe),
            causal: Math.abs(books[bestTag].grossSharpe) < Math.abs(books[bestTag].contemporaneousSharpe) / 5,
            note: 'a causal book earns the NEXT bar and is far smaller in magnitude than its contemporaneous twin (which fades the move it is itself exposed to); the e21 look-ahead trap flips this ratio above 1.',
        },
        halfIs: books[bestTag].halves,
    };

    // Which shape is best at each sign, for the readout.
    out.summary = {
        bestReversalBook: revTags.slice().sort((x, y) => books[y].grossSharpe - books[x].grossSharpe).slice(0, 3).map((t) => ({ tag: t, grossSharpe: books[t].grossSharpe, breakEvenBps: books[t].breakEvenBps, turnoverAnnualTrue: books[t].turnoverAnnualTrue, net4: books[t].net4Sharpe })),
        bestMomentumBook: Object.keys(books).filter((t) => books[t].sign > 0).sort((x, y) => books[y].grossSharpe - books[x].grossSharpe).slice(0, 3).map((t) => ({ tag: t, grossSharpe: books[t].grossSharpe, breakEvenBps: books[t].breakEvenBps })),
        perStreamReversal: Object.fromEntries(['rev-1', 'rev-2', 'rev-4', 'rev-8', 'rev-vol16', 'rev-sign1', 'rev-xs'].map((a) => [a, { meanSharpe: arms[a].meanSharpe.mean, breakEvenBps: arms[a].meanBreakEvenCostBps, positiveStreams: arms[a].positiveStreams, stability: arms[a].stability.positiveFraction, verdict600: arms[a].verdictWindow600.meanSharpe }])),
    };
    return out;
}
