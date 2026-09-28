// E96 - W4c payoff: does HAR-forecast sizing beat AR sizing on the carry book?
//
// CYCLE-100. E90 showed AR-forecast sizing beats trailing sizing (DD 2.70% ->
// 2.57%). F-104 promoted HAR over AR(1) as the reference. The applied question
// is whether the HAR edge compounds into sizing: trailing-RMS vs AR(1) vs
// HAR(1,5,22) sizing on the honest carry book (all causal, cap 4, same target,
// same e90 span and parameters) — Sharpe and max drawdown on the scored span.
//
// PRE-REGISTERED. PASS iff all three sizings cut the unsized drawdown and the
// HAR-sized drawdown is no worse than the trailing-sized one. Sharpe is
// recorded either way (F-16: sizing is a risk result). Read-only.

import { loadCarryBook } from './e3_carry.js';
import { SYMBOLS } from '../lib/lab.js';
import { realizedVolatility, fitArVolForecast, predictArVolForecast, fitHarVolForecast, predictHarVolForecast } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

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
    check('e96: the honest carry book loads', Array.isArray(pooled) && pooled.length > 2000, `n=${pooled ? pooled.length : 0}`);
    if (!pooled) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const vols = realizedVolatility(pooled, window);
    const off = pooled.length - vols.length;
    const scored = [];
    const trail = [];
    const arf = [];
    const harf = [];
    let targetSum = 0;
    let targetN = 0;
    for (let t = WARMUP; t < pooled.length; t++) {
        const tv = trailingRms(pooled, t, window);
        if (!Number.isFinite(tv) || !(tv > 0)) continue;
        targetSum += tv;
        targetN++;
        const target = targetSum / targetN;
        const histV = vols.slice(Math.max(0, t - off - HIST), t - off);
        const fa = fitArVolForecast(histV, { order: 1 });
        const fh = fitHarVolForecast(histV, { daily: 1, weekly: 5, monthly: 22 });
        if (!fa.available || !fh.available) continue;
        const pa = predictArVolForecast(fa, histV.slice(-1));
        const ph = predictHarVolForecast(fh, histV.slice(-22));
        if (!Number.isFinite(pa) || !(pa > 0) || !Number.isFinite(ph) || !(ph > 0)) continue;
        scored.push(pooled[t]);
        trail.push(Math.min(CAP, target / tv) * pooled[t]);
        arf.push(Math.min(CAP, target / pa) * pooled[t]);
        harf.push(Math.min(CAP, target / ph) * pooled[t]);
    }
    check('e96: scored span covers 5000+ bars', scored.length > 5000, `n=${scored.length}`);
    const u = bookStats(scored);
    const sTrail = bookStats(trail);
    const sAr = bookStats(arf);
    const sHar = bookStats(harf);
    const dd = (x) => `${(x.maxDrawdown * 100).toFixed(3)}%`;
    check('e96: all three sizings cut the unsized drawdown',
        sTrail.maxDrawdown < u.maxDrawdown && sAr.maxDrawdown < u.maxDrawdown && sHar.maxDrawdown < u.maxDrawdown,
        `unsized=${dd(u)} trail=${dd(sTrail)} ar=${dd(sAr)} har=${dd(sHar)}`);
    check('e96: HAR sizing drawdown is no worse than trailing sizing',
        sHar.maxDrawdown <= sTrail.maxDrawdown,
        `har=${dd(sHar)} vs trail=${dd(sTrail)} vs ar=${dd(sAr)} | sharpe u=${u.sharpe.toFixed(2)} trail=${sTrail.sharpe.toFixed(2)} ar=${sAr.sharpe.toFixed(2)} har=${sHar.sharpe.toFixed(2)}`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
