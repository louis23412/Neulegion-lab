// E99 - V2.3 mlp learner: differential proof against the benchmark arm.
//
// CYCLE-103. The repo's new `plugins/learners/mlp.js` ports the P1 MLP
// (seeded SGD, one tanh hidden layer, sigmoid head) behind the Learner
// contract. This checks the port is exact on real data: lagged-return
// features with next-bar-sign labels from the 1h panel, the plugin's buffered
// fit reproduces `analysis/benchmark.js#fitMLP` / `#predictMLP` bit-for-bit at
// identical options, full-batch and mini-batch.
//
// PRE-REGISTERED. PASS iff predictions match bit-exactly on every test bar in
// both modes and the plugin validates as a learner. Read-only.

import { buildPanel } from '../lib/lab.js';
import { fitMLP, predictMLP } from '../../NeuLegion-master/NeuLegion-master/src/analysis/benchmark.js';
import { mlpLearner, isMlp } from '../../NeuLegion-master/NeuLegion-master/src/plugins/learners/mlp.js';
import { LEARNER_CONTRACT, isLearnerPlugin } from '../../NeuLegion-master/NeuLegion-master/src/core/contracts/learner.js';
import { validatePlugin } from '../../NeuLegion-master/NeuLegion-master/src/core/contracts/base.js';

const LAGS = 5;
const TRAIN = 800;
const TEST = 100;

function lagFeatures(rets) {
    const X = [];
    const y = [];
    for (let i = LAGS; i < rets.length; i++) {
        const row = [];
        for (let k = 1; k <= LAGS; k++) row.push(rets[i - k]);
        X.push(row);
        y.push(rets[i] > 0 ? 1 : 0);
    }
    return { X, y };
}

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e99: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    check('e99: the plugin validates as a learner', isLearnerPlugin(mlpLearner) && isMlp(mlpLearner) && validatePlugin(LEARNER_CONTRACT, mlpLearner).ok === true, 'contract ok');
    const perStream = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const rets = [];
        for (let i = 1; i < s.close.length; i++) rets.push(s.close[i] / s.close[i - 1] - 1);
        perStream.push(lagFeatures(rets));
    }
    const modes = [
        { hidden: 4, epochs: 50, lr: 0.1, seed: 1, batch: 0, l2: 1e-5, standardise: true },
        { hidden: 3, epochs: 30, lr: 0.05, seed: 3, batch: 32, l2: 0, standardise: false },
    ];
    for (const opts of modes) {
        let exact = 0;
        let total = 0;
        for (const { X, y } of perStream) {
            const ref = fitMLP(X.slice(0, TRAIN), y.slice(0, TRAIN), opts);
            const m = mlpLearner.create(opts);
            for (let i = 0; i < TRAIN; i++) m.fit(X[i], y[i]);
            for (let i = TRAIN; i < TRAIN + TEST; i++) {
                total++;
                if (m.predict(X[i]) === 2 * predictMLP(ref, X[i]) - 1) exact++;
            }
        }
        check(`e99: mlp matches the benchmark bit-exactly (batch=${opts.batch}, standardise=${opts.standardise})`,
            exact === total, `${exact}/${total} test bars exact`);
    }
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
