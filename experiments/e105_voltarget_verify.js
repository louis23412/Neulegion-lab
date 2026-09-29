// E105 - V2.2 wiring proof: does the vol-target risk plugin carry the
// measured sizing payoff?
//
// CYCLE-101. Round 68 ports the W4c-z scaler behind the RiskPolicy contract
// as `plugins/risk/vol-target.js` (vendored arithmetic — the import law
// forbids analysis/ imports). This proves the port two ways: the plugin's
// sizing is bit-identical to `analysis/forecast.js#applyVolTargetScaling` on
// the honest carry book's trailing-RMS sizing (the F-106 arm), and the
// plugin-sized book reproduces the measured drawdown cut. Read-only.

import { loadCarryBook } from './e3_carry.js';
import { SYMBOLS } from '../lib/lab.js';
import { realizedVolatility, applyVolTargetScaling } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';
import { volTargetRisk, VOL_TARGET_SPECS, isVolTarget } from '../../NeuLegion-master/NeuLegion-master/src/plugins/risk/vol-target.js';
import { RISK_CONTRACT } from '../../NeuLegion-master/NeuLegion-master/src/core/contracts/risk.js';
import { validatePlugin } from '../../NeuLegion-master/NeuLegion-master/src/core/contracts/base.js';

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
    check('e105: vol-target validates as a risk plugin', isVolTarget(volTargetRisk) && validatePlugin(RISK_CONTRACT, volTargetRisk).ok === true, 'contract ok');
    const book = await loadCarryBook(SYMBOLS);
    const pooled = book && book.pooled ? book.pooled : null;
    check('e105: the honest carry book loads', Array.isArray(pooled) && pooled.length > 2000, `n=${pooled ? pooled.length : 0}`);
    if (!pooled) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const vols = realizedVolatility(pooled, window);
    const off = pooled.length - vols.length;
    const rets = [];
    const tvs = [];
    const tgts = [];
    let targetSum = 0;
    let targetN = 0;
    for (let t = WARMUP; t < pooled.length; t++) {
        const tv = trailingRms(pooled, t, window);
        if (!Number.isFinite(tv) || !(tv > 0)) continue;
        targetSum += tv;
        targetN++;
        if (t - off < 0 || t - off >= vols.length) continue;
        rets.push(pooled[t]);
        tvs.push(tv);
        tgts.push(targetSum / targetN);
    }
    check('e105: the sizing span covers 5000+ bars', rets.length > 5000, `n=${rets.length}`);
    const a = applyVolTargetScaling(rets, tvs, { target: tgts, cap: CAP });
    const b = volTargetRisk.sizingForSleeve(rets, tvs, 'carry-dispersion', tgts);
    check('e105: the plugin sizing is bit-identical to the analysis scaler on the book',
        a.available && b.available && JSON.stringify(a.scaled) === JSON.stringify(b.scaled),
        a.available && b.available ? `scored=${b.scored} skipped=${b.skipped} cap=${VOL_TARGET_SPECS['carry-dispersion'].cap}` : 'n/a');
    if (!a.available || !b.available) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const u = bookStats(rets);
    const s = bookStats(b.scaled);
    check('e105: the plugin-sized book cuts the unsized drawdown (F-106 through the plugin)',
        s.maxDrawdown < u.maxDrawdown,
        `unsized=${(u.maxDrawdown * 100).toFixed(3)}% sized=${(s.maxDrawdown * 100).toFixed(3)}% sharpe ${u.sharpe.toFixed(2)}->${s.sharpe.toFixed(2)}`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
