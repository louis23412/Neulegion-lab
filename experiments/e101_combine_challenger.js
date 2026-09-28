// E101 - W4c-y combination challenger on the real panel: does any combination
// beat HAR(1,5,22)?
//
// CYCLE-097. Bates & Granger (1969) say a combination usually beats every
// rival; Timmermann (2006) says the equal-weight average is the reference to
// beat because estimated weights add estimation error (the combination
// puzzle); Audrino & Knaus (2016, arXiv 1610.02653) say lasso-regularised
// combinations win on realized-variance panels. This drives the repo
// `tournamentCombineVolForecastAcrossSplits` (ewma/ar/har + eq/inv-MSE/OLS/
// lasso) and the `tournamentCombineVolPanel` rollup on close-close realized
// vol for every 1h stream. Weights are fit on the first half of each split's
// OOS span and scored on the second half - never the same bars.
//
// PRE-REGISTERED. PASS iff the seven-way tournament is available on all 8
// streams and the panel rollup is available. Winner majorities and the mean
// best-combine margin over HAR are recorded with ANY sign: a combination
// majority would promote combination to the reference; a HAR majority keeps
// HAR and records the puzzle holding on this data. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentCombineVolForecastAcrossSplits, tournamentCombineVolPanel } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

const SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7];
const WINDOW = 24;
const HAR = { daily: 1, weekly: 5, monthly: 22 };
const LASSO = { l1: 0.01, iters: 50 };

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e101: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const byStream = {};
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const id = (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, '');
        byStream[id] = realizedVolatility(barReturns(s.close), WINDOW);
    }
    const per = {};
    for (const [id, vols] of Object.entries(byStream)) {
        per[id] = tournamentCombineVolForecastAcrossSplits(vols, { splits: SPLITS, har: HAR, lasso: LASSO });
    }
    check('e101: the seven-way tournament is available on every stream',
        Object.values(per).every((t) => t.available),
        Object.entries(per).map(([id, t]) => `${id}:${t.available ? 'ok' : t.reason}`).join(' '));
    const winners = {};
    for (const [id, t] of Object.entries(per)) {
        if (!t.available) continue;
        const w = {};
        for (const p of t.perSplit) w[p.winner] = (w[p.winner] || 0) + 1;
        winners[id] = w;
    }
    check('e101: every stream names a per-split winner for all 5 splits',
        Object.values(winners).every((w) => Object.values(w).reduce((a, b) => a + b, 0) === 5),
        Object.entries(winners).map(([id, w]) => `${id}={${Object.entries(w).map(([k, v]) => `${k}${v}`).join(',')}}`).join(' '));
    const margins = [];
    for (const t of Object.values(per)) {
        if (!t.available) continue;
        let m = 0;
        for (const p of t.perSplit) {
            const best = Math.max(p.skills.eq, p.skills.inv, p.skills.ols, p.skills.lasso);
            m += best - p.skills.har;
        }
        margins.push(m / t.perSplit.length);
    }
    check('e101: the mean best-combine margin over HAR is recorded on every stream (any sign)',
        margins.length === 8 && margins.every((m) => Number.isFinite(m)),
        `margins=${margins.map((m) => m.toFixed(4)).join(',')}`);
    const roll = tournamentCombineVolPanel(byStream, { splits: SPLITS, har: HAR, lasso: LASSO });
    check('e101: the panel rollup is available with combine and HAR majorities counted',
        roll.available === true && Number.isInteger(roll.combineMajority) && Number.isInteger(roll.harMajority),
        roll.available ? `combine=${roll.combineMajority}/${roll.streams} har=${roll.harMajority}/${roll.streams}` : roll.reason);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
