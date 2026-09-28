// E95 - V2.3 base-rate learner: differential proof against the benchmark arm.
//
// CYCLE-099. The repo's new `plugins/learners/base-rate.js` ports the P1
// base-rate arithmetic behind the Learner contract. This checks the port is
// exact on real labels: the plugin's online counts reproduce
// `analysis/benchmark.js#fitBaseRate` bit-for-bit on next-bar-sign labels for
// every 1h stream, and its signed confidence is exactly 2p-1. It also checks
// the composition root carries the plugin UNTESTED and off the default roster.
//
// PRE-REGISTERED. PASS iff the prior matches bit-exactly on all 8 streams,
// the signed mapping is exact, and the registry slot reads UNTESTED/defaultStack
// false with the default roster still exactly the legacy learner. Read-only.

import { buildPanel } from '../lib/lab.js';
import { fitBaseRate, predictBaseRate } from '../../NeuLegion-master/NeuLegion-master/src/analysis/benchmark.js';
import { baseRateLearner, isBaseRate } from '../../NeuLegion-master/NeuLegion-master/src/plugins/learners/base-rate.js';
import { LEARNER_CONTRACT, isLearnerPlugin } from '../../NeuLegion-master/NeuLegion-master/src/core/contracts/learner.js';
import { validatePlugin } from '../../NeuLegion-master/NeuLegion-master/src/core/contracts/base.js';
import { DEFAULT_STACK } from '../../NeuLegion-master/NeuLegion-master/src/plugins/index.js';

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e95: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    check('e95: the plugin validates as a learner', isLearnerPlugin(baseRateLearner) && isBaseRate(baseRateLearner) && validatePlugin(LEARNER_CONTRACT, baseRateLearner).ok === true, 'contract ok');
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const y = [];
        for (let i = 1; i < s.close.length; i++) y.push(s.close[i] > s.close[i - 1] ? 1 : 0);
        const ref = fitBaseRate([], y);
        const m = baseRateLearner.create();
        for (const t of y) m.fit(null, t);
        const d = m.diagnostics();
        rows.push({
            sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''),
            pRef: ref.p, pPlug: d.p, conf: m.predict(null), prob: predictBaseRate(ref),
        });
    }
    check('e95: the online prior matches the benchmark prior bit-exactly on every stream',
        rows.every((r) => r.pPlug === r.pRef),
        rows.map((r) => `${r.sym}=${r.pPlug.toFixed(6)}`).join(' '));
    check('e95: the signed confidence is exactly 2p-1 on every stream',
        rows.every((r) => r.conf === 2 * r.prob - 1 && r.conf >= -1 && r.conf <= 1),
        rows.map((r) => `${r.sym}=${r.conf.toFixed(6)}`).join(' '));
    const slot = DEFAULT_STACK.find((e) => e.kind === 'learner' && e.plugin.id === 'base-rate');
    check('e95: the composition root carries base-rate UNTESTED and off the default roster',
        !!slot && slot.state === 'UNTESTED' && slot.defaultStack === false &&
        DEFAULT_STACK.filter((e) => e.kind === 'learner' && e.defaultStack).map((e) => e.plugin.id).join(',') === 'legacy-hivemind',
        slot ? `${slot.state}/${slot.defaultStack}` : 'missing');
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
