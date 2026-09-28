// E85 - W4b second skill: do the vol rankings survive QLIKE?
//
// CYCLE-089. Every W4b tournament so far scores MSE skill, but the vol
// literature (and the lab's own F-16) prefers QLIKE for variance
// forecasts — a ranking that flips under QLIKE is a loss-function
// artefact. This drives the REPO `volForecastQlike` on the real 1h panel
// (EWMA(0.94) vs fitted AR(1), half-split OOS vs the train mean).
//
// PRE-REGISTERED. PASS iff EWMA QLIKE-skill is positive on all 8 streams
// and AR beats EWMA under QLIKE on >= 6/8 streams. A flip is recorded as
// a loss-function boundary. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, ewmaVolForecast, fitArVolForecast, predictArVolForecast, volForecastQlike } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

export async function run({ window = 24, split = 0.5, lambda = 0.94, order = 1 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e85: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const vols = realizedVolatility(barReturns(s.close), window);
        const trainN = Math.floor(vols.length * split);
        const train = vols.slice(0, trainN);
        const test = vols.slice(trainN);
        const fit = fitArVolForecast(train, { order });
        const ewmaFull = ewmaVolForecast(vols, { lambda });
        const mean = train.reduce((a, b) => a + b, 0) / train.length;
        const actual = [];
        const ewma = [];
        const ar = [];
        const flat = [];
        for (let j = 0; j < test.length; j++) {
            const g = trainN + j;
            const hist = vols.slice(g - order, g);
            if (hist.length < order) continue;
            const p = fit.available ? predictArVolForecast(fit, hist) : NaN;
            if (!Number.isFinite(p) || !(p > 0)) continue;
            actual.push(test[j]);
            ewma.push(ewmaFull[g]);
            ar.push(p);
            flat.push(mean);
        }
        const se = volForecastQlike(actual, ewma, flat);
        const sa = volForecastQlike(actual, ar, flat);
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), se, sa });
    }
    check('e85: QLIKE is available on every stream',
        rows.every((r) => r.se.available && r.sa.available),
        rows.map((r) => `${r.sym}:${r.se.available && r.sa.available ? 'ok' : 'missing'}`).join(' '));
    check('e85: EWMA QLIKE-skill is positive on every stream',
        rows.every((r) => r.se.available && r.se.skill > 0),
        rows.map((r) => `${r.sym}=${r.se.available ? r.se.skill.toFixed(3) : 'n/a'}`).join(','));
    const arWins = rows.filter((r) => r.sa.available && r.se.available && r.sa.skill > r.se.skill).length;
    check('e85: AR beats EWMA under QLIKE on >= 6/8 streams',
        arWins >= 6, `arWinsQlike=${arWins}/8 ` + rows.map((r) => `${r.sym}=${r.sa.available ? r.sa.skill.toFixed(3) : 'n/a'}`).join(','));
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
