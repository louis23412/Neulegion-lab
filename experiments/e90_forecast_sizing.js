// E90 - W4b payoff: does AR-forecast sizing beat trailing sizing?
//
// CYCLE-094. E89 showed AR beats EWMA forecasting carry-book vol. The
// applied question is whether that turns into a better sized book:
// trailing-RMS sizing vs expanding-refit AR(1)-forecast sizing on the
// honest carry book (both causal, cap 4, same target) — Sharpe, max
// drawdown and serial design effect on the scored span.
//
// PRE-REGISTERED. PASS iff both sized books cut the unsized drawdown and
// the AR-sized drawdown is no worse than the trailing-sized one. Sharpe
// is recorded either way (F-16: sizing is a risk result). Read-only.

import { loadCarryBook } from './e3_carry.js';
import { SYMBOLS } from '../lib/lab.js';
import { realizedVolatility, fitArVolForecast, predictArVolForecast } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

const PERIODS_PER_YEAR = 1095;
const WARMUP = 500;
const CAP = 4;

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
    check('e90: the honest carry book loads', Array.isArray(pooled) && pooled.length > 2000, `n=${pooled ? pooled.length : 0}`);
    if (!pooled) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const vols = realizedVolatility(pooled, window);
    const off = pooled.length - vols.length;
    const scored = [];
    const trail = [];
    const arf = [];
    let targetSum = 0;
    let targetN = 0;
    for (let t = WARMUP; t < pooled.length; t++) {
        const tv = trailingRms(pooled, t, window);
        if (!Number.isFinite(tv) || !(tv > 0)) continue;
        targetSum += tv;
        targetN++;
        const target = targetSum / targetN;
        const histV = vols.slice(Math.max(0, t - off - 500), t - off);
        const fit = fitArVolForecast(histV, { order: 1 });
        if (!fit.available) continue;
        const pv = predictArVolForecast(fit, histV.slice(-1));
        if (!Number.isFinite(pv) || !(pv > 0)) continue;
        scored.push(pooled[t]);
        trail.push(Math.min(CAP, target / tv) * pooled[t]);
        arf.push(Math.min(CAP, target / pv) * pooled[t]);
    }
    check('e90: scored span covers 5000+ bars', scored.length > 5000, `n=${scored.length}`);
    const u = bookStats(scored);
    const sTrail = bookStats(trail);
    const sAr = bookStats(arf);
    check('e90: both sizings cut the unsized drawdown',
        sTrail.maxDrawdown < u.maxDrawdown && sAr.maxDrawdown < u.maxDrawdown,
        `unsized=${(u.maxDrawdown * 100).toFixed(2)}% trail=${(sTrail.maxDrawdown * 100).toFixed(2)}% ar=${(sAr.maxDrawdown * 100).toFixed(2)}%`);
    check('e90: AR sizing drawdown is no worse than trailing sizing',
        sAr.maxDrawdown <= sTrail.maxDrawdown,
        `ar=${(sAr.maxDrawdown * 100).toFixed(3)}% vs trail=${(sTrail.maxDrawdown * 100).toFixed(3)}% | sharpe u=${u.sharpe.toFixed(2)} trail=${sTrail.sharpe.toFixed(2)} ar=${sAr.sharpe.toFixed(2)}`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
