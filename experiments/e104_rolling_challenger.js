// E104 - W4c-w online challenger: do rolling weights beat frozen weights?
//
// CYCLE-100. F-111 fit OLS weights once (frozen) on the first OOS half.
// Stationarity of the best blend is an assumption, not a measurement: online
// combination re-fits on a trailing window (the rolling analogue of Bates &
// Granger 1969; Gibbs arm from arXiv 2608.28116; frozen-vs-rolling frame from
// arXiv 2609.29096). This drives the repo
// `tournamentRollingCombineVolForecastAcrossSplits` (ewma/ar/har/eq + frozen
// OLS + rolling OLS/inverse-MSE/Gibbs, all scored on identical bars) on
// close-close realized vol for every 1h stream.
//
// PRE-REGISTERED. PASS iff the rolling tournament is available on all 8
// streams. Winner majorities and the mean best-rolling margin over frozen are
// recorded with ANY sign: a rolling majority says the blend is non-stationary
// and frozen weights are stale (which would explain F-112's combine≈trailing);
// a frozen majority says the blend is stable and F-112's gap is structural.
// Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentRollingCombineVolForecastAcrossSplits, tournamentRollingCombineVolPanel } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

const SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7];
const WINDOW = 24;
const HAR = { daily: 1, weekly: 5, monthly: 22 };
const ROLL_WINDOW = 60;

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e104: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const byStream = {};
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const id = (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, '');
        byStream[id] = realizedVolatility(barReturns(s.close), WINDOW);
    }
    const per = {};
    for (const [id, vols] of Object.entries(byStream)) {
        per[id] = tournamentRollingCombineVolForecastAcrossSplits(vols, { splits: SPLITS, window: ROLL_WINDOW, har: HAR });
    }
    check('e104: the rolling tournament is available on every stream',
        Object.values(per).every((t) => t.available),
        Object.entries(per).map(([id, t]) => `${id}:${t.available ? 'ok' : t.reason}`).join(' '));
    const winners = {};
    for (const [id, t] of Object.entries(per)) {
        if (!t.available) continue;
        const w = {};
        for (const p of t.perSplit) w[p.winner] = (w[p.winner] || 0) + 1;
        winners[id] = w;
    }
    check('e104: every stream names a per-split winner for all 5 splits',
        Object.values(winners).every((w) => Object.values(w).reduce((a, b) => a + b, 0) === 5),
        Object.entries(winners).map(([id, w]) => `${id}={${Object.entries(w).map(([k, v]) => `${k}${v}`).join(',')}}`).join(' '));
    const margins = [];
    for (const t of Object.values(per)) {
        if (!t.available) continue;
        let m = 0;
        for (const p of t.perSplit) {
            const best = Math.max(p.skills.rols, p.skills.rinv, p.skills.rgibbs);
            m += best - p.skills.frozen;
        }
        margins.push(m / t.perSplit.length);
    }
    check('e104: the mean best-rolling margin over frozen is recorded on every stream (any sign)',
        margins.length === 8 && margins.every((m) => Number.isFinite(m)),
        `margins=${margins.map((m) => m.toFixed(4)).join(',')}`);
    const roll = tournamentRollingCombineVolPanel(byStream, { splits: SPLITS, window: ROLL_WINDOW, har: HAR });
    check('e104: the panel rollup is available with rolling and frozen majorities counted',
        roll.available === true && Number.isInteger(roll.rollingMajority) && Number.isInteger(roll.frozenMajority),
        roll.available ? `rolling=${roll.rollingMajority}/${roll.streams} frozen=${roll.frozenMajority}/${roll.streams}` : roll.reason);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
