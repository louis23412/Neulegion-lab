// E82 - W4b across timeframes: does AR beat EWMA on 15m too?
//
// CYCLE-086. E79–E81 established the vol tournament on 1h. A result that
// holds on one bar size only is a timeframe artefact until proven
// otherwise (the F-15 lesson). This drives the same REPO across-splits
// tournament on the 15m panel.
//
// PRE-REGISTERED. PASS iff the tournament is available on all 8 streams,
// AR wins the majority of splits on >= 6/8 streams, and EWMA stays
// positive on every split of every stream. A failure is recorded as a
// timeframe boundary, not a bug. Read-only.

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
    const panel = await buildPanel({ tf: '15m' });
    check('e82: the 15m panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const vols = realizedVolatility(barReturns(s.close), window);
        const t = tournamentVolForecastAcrossSplits(vols, { splits: SPLITS, lambda, order });
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), t });
    }
    check('e82: across-splits is available on every stream',
        rows.every((r) => r.t && r.t.available === true),
        rows.map((r) => `${r.sym}:${r.t && r.t.available ? `${r.t.arWins}/5` : (r.t && r.t.reason) || 'n/a'}`).join(' '));
    const winners = rows.filter((r) => r.t && r.t.available && r.t.arWinFraction > 0.5).length;
    check('e82: AR wins the majority of splits on >= 6/8 streams',
        winners >= 6, `arMajority=${winners}/8`);
    check('e82: EWMA stays positive on every split of every stream',
        rows.every((r) => r.t && r.t.available && r.t.ewmaAlwaysPositive === true),
        rows.map((r) => `${r.sym}=${r.t && r.t.available ? r.t.perSplit.map((p) => p.ewmaSkill.toFixed(2)).join('/') : 'n/a'}`).join(' '));
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
