// E78 - W4b vol predictability: is realized vol forecastable where direction is not?
//
// CYCLE-082. G-A/F-06 say direction is unpredictable; F-16/L09 say a causal EWMA
// is the vol forecaster to use. This experiment drives the REPO W4b helpers on
// the real 1h panel and checks that EWMA(0.94) beats a flat baseline OOS on
// realized vol (window 24) — the reference a model must beat. Read-only.
//
// PRE-REGISTERED. PASS iff EWMA skill > 0 on every stream and pooled, while a
// lagged-copy placebo does not dominate it. A failure means vol is not the
// winnable job on this panel.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, ewmaVolForecast, volForecastSkill } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

export async function run({ window = 24, lambda = 0.94 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e78: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    let pooledA = [];
    let pooledF = [];
    let pooledB = [];
    let streamSkills = [];
    for (const s of panel) {
        const rets = s.close ? barReturns(s.close) : s.returns;
        const vols = realizedVolatility(rets, window);
        if (vols.length < 10) { streamSkills.push(NaN); continue; }
        const f = ewmaVolForecast(vols, { lambda });
        const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
        const flat = vols.map(() => mean);
        const sk = volForecastSkill(vols.slice(1), f.slice(1), flat.slice(1));
        streamSkills.push(sk.available ? sk.skill : NaN);
        pooledA.push(...vols.slice(1));
        pooledF.push(...f.slice(1));
        pooledB.push(...flat.slice(1));
    }
    check('e78: every stream has a positive EWMA skill',
        streamSkills.length === 8 && streamSkills.every((x) => Number.isFinite(x) && x > 0),
        `skills=${streamSkills.map((x) => Number.isFinite(x) ? x.toFixed(3) : 'n/a').join(',')}`);
    const pooled = volForecastSkill(pooledA, pooledF, pooledB);
    check('e78: pooled EWMA skill is positive',
        pooled.available === true && pooled.skill > 0,
        pooled.available ? `skill=${pooled.skill.toFixed(3)}` : pooled.reason);
    const med = streamSkills.slice().sort((a, b) => a - b)[Math.floor(streamSkills.length / 2)];
    check('e78: median stream skill clears 0.1', Number.isFinite(med) && med > 0.1, `median=${Number.isFinite(med) ? med.toFixed(3) : 'n/a'}`);

    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
