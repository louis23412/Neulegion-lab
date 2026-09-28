// E87 - W4b window-robustness: does AR beat EWMA at other vol windows?
//
// CYCLE-091. The lab's founding lesson (F-01) is that a result at one
// window is a regime until proven otherwise. E79–E86 all use realized-vol
// window 24. This re-runs the across-splits tournament at windows 12 and
// 48 on the real 1h panel with the REPO helpers unchanged.
//
// PRE-REGISTERED. PASS iff AR wins the majority of splits on >= 6/8
// streams at BOTH windows. A window that flips is recorded as a
// boundary. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentVolForecastAcrossSplits } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

const SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7];

export async function run({ lambda = 0.94, order = 1 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e87: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    for (const window of [12, 48]) {
        const rows = [];
        for (let k = 0; k < panel.length; k++) {
            const s = panel[k];
            const vols = realizedVolatility(barReturns(s.close), window);
            const t = tournamentVolForecastAcrossSplits(vols, { splits: SPLITS, lambda, order });
            rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), t });
        }
        const avail = rows.every((r) => r.t.available);
        check(`e87: window-${window} tournament available on every stream`, avail,
            rows.map((r) => `${r.sym}:${r.t.available ? `${r.t.arWins}/5` : r.t.reason}`).join(' '));
        const winners = rows.filter((r) => r.t.available && r.t.arWinFraction > 0.5).length;
        check(`e87: window-${window} AR majority on >= 6/8 streams`, winners >= 6, `arMajority=${winners}/8`);
    }
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
