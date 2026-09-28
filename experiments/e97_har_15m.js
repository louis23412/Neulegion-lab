// E97 - W5 breadth: does the HAR ranking hold at 15m?
//
// CYCLE-101. The vol ranking (AR over EWMA, then HAR over AR) was measured at
// 1h and 4h. Finer bars change the microstructure mix (more noise, stronger
// intraday seasonality), so 15m is the hostile direction for a heterogeneity
// model. This drives the repo three-way tournament (EWMA vs AR(1) vs
// HAR(1,5,22)) on close-close realized vol for every 15m stream plus the panel
// rollup.
//
// PRE-REGISTERED. PASS iff the tournament is available on all 8 streams, HAR
// holds the split majority on every stream, and the panel rollup is unanimous
// for HAR. Read-only.

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
    const panel = await buildPanel({ tf: '15m' });
    check('e97: the 15m panel builds with 8 streams', panel.length === 8, `streams=${panel.length} n=${panel.map((s) => s.close.length).join(',')}`);
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
    check('e97: the three-way tournament is available on every 15m stream',
        Object.values(per).every((t) => t.available),
        Object.entries(per).map(([id, t]) => `${id}:${t.available ? 'ok' : t.reason}`).join(' '));
    check('e97: HAR holds the split majority on every 15m stream',
        Object.values(per).every((t) => t.available && t.harWinFraction > 0.5),
        Object.entries(per).map(([id, t]) => `${id}=${t.available ? `har${t.harWins}/5 ar${t.arWins}/5` : 'n/a'}`).join(' '));
    const roll = tournamentHarVolPanel(byStream, { splits: SPLITS, har: HAR });
    check('e97: the 15m panel rollup is unanimous for HAR',
        roll.available === true && roll.unanimousHar === true,
        roll.available ? `harMajority=${roll.harMajority}/${roll.streams}` : roll.reason);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
