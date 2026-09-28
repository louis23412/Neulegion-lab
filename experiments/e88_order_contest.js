// E88 - W4b order contest: does more lags or shrinkage beat AR(1)?
//
// CYCLE-092. The reference is AR(1) because it is the simplest fitted
// model — but simplicity is a choice, not a result, until higher orders
// lose. This seats AR(2), AR(3) and ridge-AR(2) beside OLS AR(1) in the
// REPO three-way (half-split OOS, MSE skill vs the train mean) on the
// real 1h panel.
//
// PRE-REGISTERED. PASS iff the slot runs on all 8 streams and no higher
// order beats OLS AR(1) by more than 0.02 skill on any stream. A failure
// upgrades the reference (order matters) — recorded either way. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, fitArVolForecast, fitRidgeArVolForecast, predictArVolForecast, volForecastSkill } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

export async function run({ window = 24, split = 0.5 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e88: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const vols = realizedVolatility(barReturns(s.close), window);
        const trainN = Math.floor(vols.length * split);
        const train = vols.slice(0, trainN);
        const test = vols.slice(trainN);
        const fits = {
            ar1: fitArVolForecast(train, { order: 1 }),
            ar2: fitArVolForecast(train, { order: 2 }),
            ar3: fitArVolForecast(train, { order: 3 }),
            ridge2: fitRidgeArVolForecast(train, { order: 2, l2: 1 }),
        };
        const mean = train.reduce((a, b) => a + b, 0) / train.length;
        const actual = [];
        const series = { ar1: [], ar2: [], ar3: [], ridge2: [], flat: [] };
        for (let j = 0; j < test.length; j++) {
            const ps = {};
            let ok = true;
            for (const [name, ord] of [['ar1', 1], ['ar2', 2], ['ar3', 3], ['ridge2', 2]]) {
                const hist = vols.slice(trainN + j - ord, trainN + j);
                if (hist.length < ord || !fits[name].available) { ok = false; break; }
                const p = predictArVolForecast(fits[name], hist);
                if (!Number.isFinite(p)) { ok = false; break; }
                ps[name] = p;
            }
            if (!ok) continue;
            actual.push(test[j]);
            for (const name of ['ar1', 'ar2', 'ar3', 'ridge2']) series[name].push(ps[name]);
            series.flat.push(mean);
        }
        const skills = {};
        for (const name of ['ar1', 'ar2', 'ar3', 'ridge2']) {
            const sk = volForecastSkill(actual, series[name], series.flat);
            skills[name] = sk.available ? sk.skill : NaN;
        }
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), skills, n: actual.length });
    }
    check('e88: every order scores a finite skill on every stream',
        rows.every((r) => ['ar1', 'ar2', 'ar3', 'ridge2'].every((name) => Number.isFinite(r.skills[name]))),
        rows.map((r) => `${r.sym}=${['ar1', 'ar2', 'ar3', 'ridge2'].map((name) => Number.isFinite(r.skills[name]) ? r.skills[name].toFixed(3) : 'n/a').join('/')}`).join(' '));
    const violations = rows.filter((r) => ['ar2', 'ar3', 'ridge2'].some((name) => r.skills[name] - r.skills.ar1 > 0.02));
    check('e88: no higher order beats AR(1) by > 0.02 on any stream',
        violations.length === 0, violations.length ? violations.map((r) => r.sym).join(',') : 'simplicity holds 8/8');
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
