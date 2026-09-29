// E106 - the --sleeve-sizing payoff through the repo path.
//
// CYCLE-102. Round 69 wires the W4c-z/F-115 sizing payoff into the `--sleeve`
// run mode as `scoreSleeveSized` (repo trailing-RMS vols + vol-target plugin
// sizing + gate re-score, scalar caller-supplied target). This proves the
// payoff survives the CLI semantics: e105's adaptive trailing-mean target is
// NOT available to a CLI caller, so this measures the scalar-target grid
// (0.005/0.01/0.02, window 24) on the same honest carry book and span, plus
// the bit-identity of the repo forecast against the lab RMS. Read-only.

import { loadCarryBook } from './e3_carry.js';
import { SYMBOLS } from '../lib/lab.js';
import { applyVolTargetScaling } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';
import { trailingBookVol } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { volTargetRisk } from '../../NeuLegion-master/NeuLegion-master/src/plugins/risk/vol-target.js';
import { scoreBookReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const PERIODS_PER_YEAR = 1095;
const WARMUP = 500;
const WINDOW = 24;
const TARGETS = [0.005, 0.01, 0.02];

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

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const book = await loadCarryBook(SYMBOLS);
    const pooled = book && book.pooled ? book.pooled : null;
    check('e106: the honest carry book loads', Array.isArray(pooled) && pooled.length > 2000, `n=${pooled ? pooled.length : 0}`);
    if (!pooled) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const repoVols = trailingBookVol(pooled, { window: WINDOW });
    const labVols = pooled.map((_, t) => trailingRms(pooled, t, WINDOW));
    const sameForecast = repoVols.length === labVols.length && repoVols.every((v, t) =>
        (Number.isNaN(v) && Number.isNaN(labVols[t])) || v === labVols[t]);
    check('e106: the repo trailingBookVol is bit-identical to the lab trailing-RMS', sameForecast, `n=${repoVols.length}`);
    const rets = [];
    const tvs = [];
    for (let t = WARMUP; t < pooled.length; t++) {
        const tv = repoVols[t];
        if (!Number.isFinite(tv) || !(tv > 0)) continue;
        rets.push(pooled[t]);
        tvs.push(tv);
    }
    check('e106: the sizing span covers 5000+ bars', rets.length > 5000, `n=${rets.length}`);
    const ref = applyVolTargetScaling(rets, tvs, { target: 0.01, cap: 4 });
    const got = volTargetRisk.sizingForSleeve(rets, tvs, 'carry-dispersion', 0.01);
    check('e106: the plugin sizing matches the analysis scaler bar-for-bar on the span',
        ref.available && got.available && JSON.stringify(ref.scaled) === JSON.stringify(got.scaled),
        got.available ? `scored=${got.scored} skipped=${got.skipped}` : 'n/a');
    const u = bookStats(rets);
    const spanBookVol = tvs.reduce((a, v) => a + v, 0) / tvs.length;
    const perTarget = [];
    for (const target of TARGETS) {
        const s = volTargetRisk.sizingForSleeve(rets, tvs, 'carry-dispersion', target);
        if (!s.available) { perTarget.push({ target, available: false }); continue; }
        const byIndex = new Map(s.index.map((bar, i) => [bar, s.scales[i]]));
        const eg = rets.map((r, bar) => (byIndex.has(bar) ? byIndex.get(bar) : 0) * r);
        const ew = rets.map((_, bar) => [(byIndex.has(bar) ? byIndex.get(bar) : 0)]);
        const rescored = scoreBookReturns(eg, ew, { costBps: 0 });
        const st = bookStats(s.scaled);
        const maxScale = Math.max(...s.scales);
        const meanScale = s.scales.reduce((a, v) => a + v, 0) / s.scales.length;
        perTarget.push({
            target, available: true, scored: s.scored, skipped: s.skipped,
            sharpe: st.sharpe, maxDrawdown: st.maxDrawdown,
            rescoredSharpe: rescored ? rescored.netSharpe : null,
            turnover: rescored ? rescored.turnover : null, maxScale, meanScale,
        });
    }
    check('e106: at plugin-scale scalar targets the book rides the cap (leverage, not timing)',
        perTarget.every((p) => p.available && p.maxScale === 4 && p.meanScale > 1),
        perTarget.map((p) => `${p.target}:max=${p.available ? p.maxScale.toFixed(3) : 'n/a'} mean=${p.available ? p.meanScale.toFixed(3) : 'n/a'}`).join(' ') +
        ` bookVol=${spanBookVol.toExponential(2)}`);
    check('e106: scalar sizing lifts Sharpe but worsens drawdown (the payoff is adaptive-target-specific)',
        perTarget.every((p) => p.available && p.sharpe > u.sharpe && p.maxDrawdown > u.maxDrawdown),
        `unsized DD=${(u.maxDrawdown * 100).toFixed(2)}% S=${u.sharpe.toFixed(2)} :: ` +
        perTarget.map((p) => `${p.target}:DD=${(p.maxDrawdown * 100).toFixed(2)}% S=${p.sharpe.toFixed(2)}`).join(' '));
    check('e106: sizing stays leverage-bounded (the open-loop spike guard holds)',
        perTarget.every((p) => p.available && p.maxScale <= 4 && Number.isFinite(p.turnover) && p.turnover > 0),
        perTarget.map((p) => `${p.target}:maxScale=${p.available ? p.maxScale.toFixed(3) : 'n/a'}`).join(' '));
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks, perTarget, unsized: { sharpe: u.sharpe, maxDrawdown: u.maxDrawdown }, spanBookVol };
}
