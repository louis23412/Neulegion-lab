// E79 - W4b tournament on the real panel: EWMA vs AR(1) on realized vol.
//
// CYCLE-083. Round 50 added the repo tournament (fitArVolForecast /
// tournamentVolForecast) but only pinned it on synthetic fixtures. This
// experiment drives the REPO helpers on the real 1h panel (window 24,
// split 0.5) and checks EWMA stays the reference: positive skill on every
// stream and pooled, AR finite everywhere.
//
// PRE-REGISTERED. PASS iff EWMA skill > 0 on all 8 streams + pooled, AR
// skill finite on all streams, and the tournament reports a winner on
// every stream. A failure means the tournament does not transfer to real
// data. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentVolForecast } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

export async function run({ window = 24, lambda = 0.94, order = 1 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e79: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const rets = s.close ? barReturns(s.close) : s.returns;
        const vols = realizedVolatility(rets, window);
        const t = tournamentVolForecast(vols, { split: 0.5, lambda, order });
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), t, n: vols.length });
    }
    check('e79: tournament is available on every stream',
        rows.every((r) => r.t && r.t.available === true),
        rows.map((r) => `${r.sym}:${r.t && r.t.available ? 'ok' : (r.t && r.t.reason) || 'n/a'}`).join(' '));
    check('e79: EWMA skill is positive on every stream',
        rows.every((r) => r.t && r.t.available && r.t.ewmaSkill > 0),
        rows.map((r) => `${r.sym}=${r.t && r.t.available ? r.t.ewmaSkill.toFixed(3) : 'n/a'}`).join(','));
    check('e79: AR skill is finite on every stream',
        rows.every((r) => r.t && r.t.available && Number.isFinite(r.t.arSkill)),
        rows.map((r) => `${r.sym}=${r.t && r.t.available ? r.t.arSkill.toFixed(3) : 'n/a'}`).join(','));
    const wins = rows.map((r) => (r.t && r.t.available ? r.t.winner : '?')).join(',');
    check('e79: every stream reports a winner', rows.every((r) => r.t && r.t.available && (r.t.winner === 'ar' || r.t.winner === 'ewma')), `winners=${wins}`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
