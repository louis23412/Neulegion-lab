// E107 - the adaptive sizing payoff through the repo path.
//
// CYCLE-103. Round 70 wires the trailing-mean (`adaptive`) target into
// `--sleeve-sizing` as a first-class mode. F-116 showed scalar targets lever
// the carry book to the cap; this proves the adaptive mode restores the F-115
// payoff through the exact repo composition (`trailingBookVol` +
// `adaptiveTargets` + `sizingForSleeve` + gate re-score) on the same honest
// carry book and span — including a causality read on the real series and a
// check that the payoff is not an accumulation-window artefact (the repo mean
// runs over every bar; e105's ran over bars past its WARMUP cutoff).
// Read-only.

import { loadCarryBook } from './e3_carry.js';
import { SYMBOLS } from '../lib/lab.js';
import { trailingBookVol, adaptiveTargets } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { volTargetRisk } from '../../NeuLegion-master/NeuLegion-master/src/plugins/risk/vol-target.js';

const PERIODS_PER_YEAR = 1095;
const WARMUP = 500;
const WINDOW = 24;

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

function sizeWith(rets, tvs, tgts) {
    const s = volTargetRisk.sizingForSleeve(rets, tvs, 'carry-dispersion', tgts);
    if (!s.available) return null;
    const meanScale = s.scales.reduce((a, v) => a + v, 0) / s.scales.length;
    return { stats: bookStats(s.scaled), meanScale, scored: s.scored, skipped: s.skipped };
}

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const book = await loadCarryBook(SYMBOLS);
    const pooled = book && book.pooled ? book.pooled : null;
    check('e107: the honest carry book loads over the full span', Array.isArray(pooled) && pooled.length > 2000, `n=${pooled ? pooled.length : 0}`);
    if (!pooled) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const vols = trailingBookVol(pooled, { window: WINDOW });
    const tgts = adaptiveTargets(vols);
    const causal = vols.every((_, t) => {
        const pre = adaptiveTargets(vols.slice(0, t + 1))[t];
        const full = tgts[t];
        return (Number.isNaN(pre) && Number.isNaN(full)) || pre === full;
    });
    check('e107: the repo adaptive targets are causal on the real series (prefix identity)', causal, `n=${vols.length}`);
    const rets = [];
    const tvs = [];
    const tgs = [];
    for (let t = WARMUP; t < pooled.length; t++) {
        if (!Number.isFinite(tgts[t]) || !(tgts[t] > 0) || !Number.isFinite(vols[t]) || !(vols[t] > 0)) continue;
        rets.push(pooled[t]);
        tvs.push(vols[t]);
        tgs.push(tgts[t]);
    }
    check('e107: the adaptive span covers 5000+ bars', rets.length > 5000, `n=${rets.length}`);
    const u = bookStats(rets);
    const repo = sizeWith(rets, tvs, tgs);
    check('e107: the repo adaptive path restores the drawdown cut (F-115 through the CLI mode)',
        !!repo && repo.stats.maxDrawdown < u.maxDrawdown && repo.stats.maxDrawdown < 0.04,
        repo ? `unsized=${(u.maxDrawdown * 100).toFixed(2)}% adaptive=${(repo.stats.maxDrawdown * 100).toFixed(2)}% sharpe ${u.sharpe.toFixed(2)}->${repo.stats.sharpe.toFixed(2)} meanScale=${repo.meanScale.toFixed(3)}` : 'n/a');
    let keptSum = 0;
    let keptN = 0;
    const keptTgts = [];
    for (let i = 0; i < tvs.length; i++) {
        keptSum += tvs[i];
        keptN++;
        keptTgts.push(keptSum / keptN);
    }
    const kept = sizeWith(rets, tvs, keptTgts);
    check('e107: the cut is not an accumulation-window artefact (kept-bars mean agrees)',
        !!repo && !!kept && kept.stats.maxDrawdown < u.maxDrawdown && kept.stats.maxDrawdown < 0.04,
        kept ? `kept-mean DD=${(kept.stats.maxDrawdown * 100).toFixed(2)}% vs repo DD=${(repo.stats.maxDrawdown * 100).toFixed(2)}%` : 'n/a');
    const failed = checks.filter((c) => !c.pass);
    return {
        total: checks.length, failed: failed.length, failures: failed, checks,
        unsized: { sharpe: u.sharpe, maxDrawdown: u.maxDrawdown },
        adaptive: repo ? { sharpe: repo.stats.sharpe, maxDrawdown: repo.stats.maxDrawdown, meanScale: repo.meanScale } : null,
        keptMean: kept ? { sharpe: kept.stats.sharpe, maxDrawdown: kept.stats.maxDrawdown } : null,
    };
}
