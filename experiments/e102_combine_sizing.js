// E102 - W4c-z payoff: does OLS-combination sizing beat HAR sizing on the
// carry book, through the repo scaler?
//
// CYCLE-098. E96 showed trailing/AR/HAR sizing cuts the carry-book drawdown
// monotonically (7.92% -> 2.67% -> 2.54% -> 2.45%). F-111 promoted the OLS
// combination to a sizing reference candidate. This wires the repo
// `applyVolTargetScaling` (round 65) into the applied question: trailing-RMS
// vs AR(1) vs HAR(1,5,22) vs frozen-OLS-combination sizing on the honest carry
// book over the same e96 span and parameters. Two phases, all causal: weights
// are OLS-fit once on the first 15% of the span (refit base forecasts), then
// frozen and scored through the repo scaler on the last 85% - never the same
// bars. Sharpe and max drawdown on the scored span.
//
// Split choice (corrected pre-registration, CYCLE-098): the first attempt
// used 40/60 and failed vacuously - the book's 7.96% drawdown troughs at bar
// 2515 (38%), so the last 60% is calm (unsized DD 0.51%) and any vol-target
// scaler levers a calm book instead of taming it. The 15/85 split keeps the
// weights strictly before the scoring span while the span keeps the drawdown
// event; an explicit non-calm guard (unsized DD above 2%) makes the regime
// requirement loud instead of silent.
//
// PRE-REGISTERED (corrected). PASS iff the scoring span is non-calm, all four
// sizings cut the unsized drawdown, HAR is no worse than trailing (the F-106
// payoff preserved through the repo scaler), and combination is no worse than
// trailing. HAR-vs-combination is recorded either way. Read-only.

import { loadCarryBook } from './e3_carry.js';
import { SYMBOLS } from '../lib/lab.js';
import { realizedVolatility, ewmaVolForecast, fitArVolForecast, predictArVolForecast, fitHarVolForecast, predictHarVolForecast, fitCombineWeights, predictCombine, applyVolTargetScaling } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

const PERIODS_PER_YEAR = 1095;
const WARMUP = 500;
const CAP = 4;
const HIST = 500;

function trailingRms(returns, t, window) {
    let sumSq = 0;
    let n = 0;
    for (let k = Math.max(0, t - window); k < t; k++) {
        if (!Number.isFinite(returns[k])) continue;
        sumSq += returns[k] * returns[k];
        n++;
    }
    return n ? Math.sqrt(sumSq / n) : NaN;
}

function bookStats(rets) {
    const n = rets.length;
    const mean = rets.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
    const eq = [1];
    for (const r of rets) eq.push(eq[eq.length - 1] * (1 + r));
    let peak = eq[0];
    let mdd = 0;
    for (const v of eq) { if (v > peak) peak = v; if (peak > 0) mdd = Math.max(mdd, (peak - v) / peak); }
    return { sharpe: std > 0 ? (mean / std) * Math.sqrt(PERIODS_PER_YEAR) : NaN, maxDrawdown: mdd };
}

export async function run({ window = 24 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const book = await loadCarryBook(SYMBOLS);
    const pooled = book && book.pooled ? book.pooled : null;
    check('e102: the honest carry book loads', Array.isArray(pooled) && pooled.length > 2000, `n=${pooled ? pooled.length : 0}`);
    if (!pooled) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const vols = realizedVolatility(pooled, window);
    const off = pooled.length - vols.length;
    const rows = [];
    let targetSum = 0;
    let targetN = 0;
    for (let t = WARMUP; t < pooled.length; t++) {
        const tv = trailingRms(pooled, t, window);
        if (!Number.isFinite(tv) || !(tv > 0)) continue;
        targetSum += tv;
        targetN++;
        const target = targetSum / targetN;
        const histV = vols.slice(Math.max(0, t - off - HIST), t - off);
        if (histV.length < 23) continue;
        const fa = fitArVolForecast(histV, { order: 1 });
        const fh = fitHarVolForecast(histV, { daily: 1, weekly: 5, monthly: 22 });
        if (!fa.available || !fh.available) continue;
        const pa = predictArVolForecast(fa, histV.slice(-1));
        const ph = predictHarVolForecast(fh, histV.slice(-22));
        const pe = ewmaVolForecast(histV, { lambda: 0.94 })[histV.length - 1];
        if (!Number.isFinite(pa) || !(pa > 0) || !Number.isFinite(ph) || !(ph > 0)) continue;
        if (!Number.isFinite(pe) || !(pe > 0)) continue;
        const actual = vols[t - off];
        if (!Number.isFinite(actual)) continue;
        rows.push({ r: pooled[t], tv, target, pe, pa, ph, actual });
    }
    check('e102: the refit span covers 5000+ bars', rows.length > 5000, `n=${rows.length}`);
    if (rows.length <= 5000) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const cut = Math.floor(rows.length * 0.15);
    const W = rows.slice(0, cut);
    const S = rows.slice(cut);
    const wfit = fitCombineWeights(W.map((x) => x.actual), [W.map((x) => x.pe), W.map((x) => x.pa), W.map((x) => x.ph)]);
    check('e102: OLS combination weights fit on the first span only', wfit.available === true, wfit.available ? `w=[${wfit.weights.map((w) => w.toFixed(3)).join(',')}] rows=${wfit.rows}` : wfit.reason);
    if (!wfit.available) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const rets = S.map((x) => x.r);
    const targets = S.map((x) => x.target);
    const arms = {
        trail: S.map((x) => x.tv),
        ar: S.map((x) => x.pa),
        har: S.map((x) => x.ph),
        combine: S.map((x) => predictCombine([x.pe, x.pa, x.ph], wfit.weights)),
    };
    const sized = {};
    for (const [k, v] of Object.entries(arms)) {
        const s = applyVolTargetScaling(rets, v, { target: targets, cap: CAP });
        sized[k] = s.available ? s : null;
    }
    check('e102: the repo scaler scores every arm on the second span',
        Object.values(sized).every((s) => s && s.scored > 1000),
        Object.entries(sized).map(([k, s]) => `${k}=${s ? s.scored : 'n/a'}`).join(' '));
    if (!Object.values(sized).every((s) => s && s.scored > 1000)) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const ci = sized.combine.index;
    const aligned = {};
    for (const [k, s] of Object.entries(sized)) {
        aligned[k] = k === 'combine' ? s.scaled : ci.map((i) => s.scaled[i]);
    }
    const u = bookStats(ci.map((i) => rets[i]));
    const stats = {};
    for (const [k, s] of Object.entries(aligned)) stats[k] = bookStats(s);
    const dd = (x) => `${(x.maxDrawdown * 100).toFixed(3)}%`;
    const sh = (x) => Number.isFinite(x.sharpe) ? x.sharpe.toFixed(2) : 'n/a';
    check('e102: the scoring span is non-calm (unsized DD above 2%)',
        u.maxDrawdown > 0.02, `unsized=${dd(u)} scored=${ci.length}`);
    check('e102: all four sizings cut the unsized drawdown',
        stats.trail.maxDrawdown < u.maxDrawdown && stats.ar.maxDrawdown < u.maxDrawdown &&
        stats.har.maxDrawdown < u.maxDrawdown && stats.combine.maxDrawdown < u.maxDrawdown,
        `unsized=${dd(u)} trail=${dd(stats.trail)} ar=${dd(stats.ar)} har=${dd(stats.har)} combine=${dd(stats.combine)}`);
    check('e102: HAR and combination sizing are no worse than trailing sizing',
        stats.har.maxDrawdown <= stats.trail.maxDrawdown && stats.combine.maxDrawdown <= stats.trail.maxDrawdown,
        `har=${dd(stats.har)} combine=${dd(stats.combine)} vs trail=${dd(stats.trail)} vs ar=${dd(stats.ar)} | sharpe u=${sh(u)} trail=${sh(stats.trail)} ar=${sh(stats.ar)} har=${sh(stats.har)} combine=${sh(stats.combine)} | w=[${wfit.weights.map((w) => w.toFixed(3)).join(',')}]`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
