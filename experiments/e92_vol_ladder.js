// E92 - W4b ladder on the real panel: one call, three windows.
//
// CYCLE-096. Round 57 folds the window ladder into one repo call.
// This drives `tournamentVolLadder` on every 1h stream and checks it
// reproduces the e87 verdicts (AR majority at 12/24/48) cell by cell.
//
// PRE-REGISTERED. PASS iff the ladder is available on all 8 streams,
// unanimous at every window, and every cell equals the single-window
// call. Read-only.

import { buildPanel } from '../lib/lab.js';
import { tournamentVolLadder, realizedVolatility, tournamentVolForecastAcrossSplits } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

const WINDOWS = [12, 24, 48];
const SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7];

export async function run({ lambda = 0.94, order = 1 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e92: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const rets = barReturns(s.close);
        const t = tournamentVolLadder(rets, { windows: WINDOWS, splits: SPLITS, lambda, order });
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), rets, t });
    }
    check('e92: ladder is available on every stream',
        rows.every((r) => r.t.available),
        rows.map((r) => `${r.sym}:${r.t.available ? 'ok' : r.t.reason}`).join(' '));
    check('e92: AR is unanimous at every window on every stream',
        rows.every((r) => r.t.available && r.t.unanimousAr === true),
        rows.map((r) => `${r.sym}=${r.t.available ? r.t.arCleanFraction.toFixed(2) : 'n/a'}`).join(','));
    let cellsMatch = rows.every((r) => r.t.available);
    if (cellsMatch) {
        for (const r of rows) {
            for (const w of WINDOWS) {
                const v = realizedVolatility(r.rets, w);
                const s = tournamentVolForecastAcrossSplits(v, { splits: SPLITS, lambda, order });
                if (!s.available || Math.abs(r.t.perWindow[w].arWinFraction - s.arWinFraction) > 1e-12) { cellsMatch = false; break; }
            }
            if (!cellsMatch) break;
        }
    }
    check('e92: every ladder cell equals the single-window call', cellsMatch, cellsMatch ? '24/24 cells match' : 'mismatch');
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
