// E80 - W4b split-robustness: is AR's win over EWMA split-specific?
//
// CYCLE-084. E79 showed a fitted AR(1) beats EWMA(0.94) 8/8 at a half
// split — but the lab's own F-55 lesson is that single-split wins can be
// split artefacts. This drives the REPO across-splits tournament (five
// splits 0.3–0.7) on the real 1h panel.
//
// PRE-REGISTERED. PASS iff AR wins the majority of splits on every stream
// and EWMA stays positive on every split of every stream. A failure means
// the E79 headline was a split pick. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentVolForecastAcrossSplits } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

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
    check('e80: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const vols = realizedVolatility(barReturns(s.close), window);
        const t = tournamentVolForecastAcrossSplits(vols, { splits: SPLITS, lambda, order });
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), t });
    }
    check('e80: across-splits is available on every stream',
        rows.every((r) => r.t && r.t.available === true),
        rows.map((r) => `${r.sym}:${r.t && r.t.available ? `${r.t.arWins}/5` : (r.t && r.t.reason) || 'n/a'}`).join(' '));
    check('e80: AR wins the majority of splits on every stream',
        rows.every((r) => r.t && r.t.available && r.t.arWinFraction > 0.5),
        rows.map((r) => `${r.sym}=${r.t && r.t.available ? r.t.arWinFraction.toFixed(2) : 'n/a'}`).join(','));
    check('e80: EWMA stays positive on every split of every stream',
        rows.every((r) => r.t && r.t.available && r.t.ewmaAlwaysPositive === true),
        rows.map((r) => `${r.sym}=${r.t && r.t.available ? r.t.perSplit.map((p) => p.ewmaSkill.toFixed(2)).join('/') : 'n/a'}`).join(' '));
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
