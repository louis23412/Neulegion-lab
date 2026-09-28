// E81 - W4b model slot on the real panel: fitted AR(1) vs naive persistence.
//
// CYCLE-085. Rounds 50–51 showed a fitted AR(1) beats EWMA everywhere, but a
// tournament with no model proves no gate. This drives the REPO model slot
// (`tournamentVolModel`) on the real 1h panel with a naive persistence
// forecast (prev-bar vol) in the model seat: the slot must run, rank the
// three, and prefer the fitted AR over the naive lag.
//
// PRE-REGISTERED. PASS iff the slot is available on all 8 streams, every
// skill is finite, and fitted AR beats naive persistence on >= 6/8 streams.
// A failure means the slot does not discriminate on real data. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, ewmaVolForecast, fitArVolForecast, predictArVolForecast, tournamentVolModel } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

export async function run({ window = 24, split = 0.5, lambda = 0.94, order = 1 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e81: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const vols = realizedVolatility(barReturns(s.close), window);
        const n = vols.length;
        const trainN = Math.floor(n * split);
        const train = vols.slice(0, trainN);
        const test = vols.slice(trainN);
        const fit = fitArVolForecast(train, { order });
        const ewmaFull = ewmaVolForecast(vols, { lambda });
        const actual = [];
        const ewma = [];
        const ar = [];
        const persist = [];
        for (let j = 0; j < test.length; j++) {
            const g = trainN + j;
            const hist = vols.slice(g - order, g);
            if (hist.length < order) continue;
            const p = fit.available ? predictArVolForecast(fit, hist) : NaN;
            if (!Number.isFinite(p)) continue;
            actual.push(test[j]);
            ewma.push(ewmaFull[g]);
            ar.push(p);
            persist.push(j === 0 ? train[train.length - 1] : test[j - 1]);
        }
        const t = tournamentVolModel(actual, { ewma, ar, model: persist });
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), t });
    }
    check('e81: model slot is available on every stream',
        rows.every((r) => r.t && r.t.available === true),
        rows.map((r) => `${r.sym}:${r.t && r.t.available ? r.t.winner : (r.t && r.t.reason) || 'n/a'}`).join(' '));
    check('e81: every skill is finite on every stream',
        rows.every((r) => r.t && r.t.available && Number.isFinite(r.t.skillEwma) && Number.isFinite(r.t.skillAr) && Number.isFinite(r.t.skillModel)),
        rows.map((r) => `${r.sym}=${r.t && r.t.available ? `${r.t.skillEwma.toFixed(2)}/${r.t.skillAr.toFixed(2)}/${r.t.skillModel.toFixed(2)}` : 'n/a'}`).join(' '));
    const arBeats = rows.filter((r) => r.t && r.t.available && r.t.skillAr > r.t.skillModel).length;
    check('e81: fitted AR beats naive persistence on >= 6/8 streams',
        arBeats >= 6, `arBeatsPersist=${arBeats}/8`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
