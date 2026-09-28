// E94 - W4c HAR-RV challenger on the real panel: does heterogeneity beat AR(1)?
//
// CYCLE-098. The HAR-RV of Corsi (2009) forecasts volatility with trailing
// daily/weekly/monthly averages - the literature's standard heterogeneous
// reference, nesting AR(1) as its daily leg. This drives the repo
// `tournamentHarVolForecastAcrossSplits` (EWMA vs AR(1) vs HAR(1,5,22)) and the
// `tournamentHarVolPanel` rollup on close-close realized vol for every 1h
// stream.
//
// PRE-REGISTERED. PASS iff the three-way tournament is available on all 8
// streams, HAR holds the split majority on every stream, and the panel rollup
// is unanimous for HAR. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentHarVolForecastAcrossSplits, tournamentHarVolPanel } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

const SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7];
const WINDOW = 24;
const HAR = { daily: 1, weekly: 5, monthly: 22 };

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e94: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const byStream = {};
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const id = (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, '');
        byStream[id] = realizedVolatility(barReturns(s.close), WINDOW);
    }
    const per = {};
    for (const [id, vols] of Object.entries(byStream)) {
        per[id] = tournamentHarVolForecastAcrossSplits(vols, { splits: SPLITS, har: HAR });
    }
    check('e94: the three-way tournament is available on every stream',
        Object.values(per).every((t) => t.available),
        Object.entries(per).map(([id, t]) => `${id}:${t.available ? 'ok' : t.reason}`).join(' '));
    check('e94: HAR holds the split majority on every stream',
        Object.values(per).every((t) => t.available && t.harWinFraction > 0.5),
        Object.entries(per).map(([id, t]) => `${id}=${t.available ? `har${t.harWins}/5 ar${t.arWins}/5` : 'n/a'}`).join(' '));
    const margins = [];
    for (const t of Object.values(per)) {
        if (!t.available) continue;
        let m = 0;
        for (const p of t.perSplit) m += p.harSkill - Math.max(p.arSkill, p.ewmaSkill);
        margins.push(m / t.perSplit.length);
    }
    check('e94: the mean HAR skill margin over the best rival is positive on every stream',
        margins.length === 8 && margins.every((m) => m > 0),
        `margins=${margins.map((m) => m.toFixed(4)).join(',')}`);
    const roll = tournamentHarVolPanel(byStream, { splits: SPLITS, har: HAR });
    check('e94: the panel rollup is unanimous for HAR',
        roll.available === true && roll.unanimousHar === true,
        roll.available ? `harMajority=${roll.harMajority}/${roll.streams}` : roll.reason);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
