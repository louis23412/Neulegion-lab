// E86 - W4b gate on the real panel: persistence parks everywhere.
//
// CYCLE-090. Round 55 added the full G4 harness (model across splits +
// the promote/park decision). This seats naive persistence in the model
// chair on the real 1h panel: the gate must run, rank persistence below
// the fitted AR, and park it on every stream.
//
// PRE-REGISTERED. PASS iff the harness is available on all 8 streams and
// the decision is park on all 8. A promote is recorded as a gate failure.
// Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentVolModelAcrossSplits, decideVolPromotion } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

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
    check('e86: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const persistFn = (train, hist) => hist[hist.length - 1];
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const vols = realizedVolatility(barReturns(s.close), window);
        const t = tournamentVolModelAcrossSplits(vols, { splits: SPLITS, lambda, order, modelFn: persistFn });
        const d = decideVolPromotion(t, { minModelMajority: 0.6 });
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), t, d });
    }
    check('e86: harness is available on every stream',
        rows.every((r) => r.t.available),
        rows.map((r) => `${r.sym}:${r.t.available ? `${r.t.modelWins}/5` : r.t.reason}`).join(' '));
    check('e86: persistence reaches a majority on no stream',
        rows.every((r) => r.t.available && r.t.modelWins < 3),
        rows.map((r) => `${r.sym}=${r.t.available ? r.t.modelWins : 'n/a'}`).join(','));
    check('e86: decision parks persistence on every stream',
        rows.every((r) => r.d.decision === 'park'),
        rows.map((r) => `${r.sym}=${r.d.decision}`).join(','));
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
