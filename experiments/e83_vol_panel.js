// E83 - W4b panel view on the real panel: one call, eight verdicts.
//
// CYCLE-087. Rounds 50–52 built the tournament piece by piece; round 53
// adds the panel rollup (`tournamentVolPanel`). This drives it on the real
// 1h panel and checks it reproduces the e80 verdicts exactly.
//
// PRE-REGISTERED. PASS iff the panel call is available, reports 8 streams,
// unanimous AR majority, unanimous EWMA-positive, and its per-stream cells
// equal the single-stream calls. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentVolForecastAcrossSplits, tournamentVolPanel } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

const SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7];

export async function run({ window = 24, lambda = 0.94, order = 1 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e83: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const volsByStream = {};
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        volsByStream[(s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, '')] = realizedVolatility(barReturns(s.close), window);
    }
    const t = tournamentVolPanel(volsByStream, { splits: SPLITS, lambda, order });
    check('e83: panel call is available over 8 streams',
        t.available === true && t.streams === 8, t.available ? `streams=${t.streams}` : t.reason);
    check('e83: AR majority and EWMA-positive are unanimous',
        t.available === true && t.unanimousAr === true && t.unanimousEwma === true,
        t.available ? `arMajority=${t.arMajority}/8 ewmaClean=${t.ewmaClean}/8` : 'n/a');
    let cellsMatch = t.available === true;
    if (t.available) {
        for (const [id, vols] of Object.entries(volsByStream)) {
            const s = tournamentVolForecastAcrossSplits(vols, { splits: SPLITS, lambda, order });
            if (!s.available || Math.abs(t.perStream[id].arWinFraction - s.arWinFraction) > 1e-12) { cellsMatch = false; break; }
        }
    }
    check('e83: per-stream cells equal the single-stream calls', cellsMatch, cellsMatch ? '8/8 cells match' : 'mismatch');
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
