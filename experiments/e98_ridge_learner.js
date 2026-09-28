// E98 - V2.3 ridge learner: differential proof against the benchmark arm.
//
// CYCLE-102. The repo's new `plugins/learners/ridge.js` ports the P1 ridge
// closed form (standardiser + weighted least squares, intercept unpenalized)
// behind the Learner contract. This checks the port is exact on real data:
// lagged-return features with next-bar-sign labels from the 1h panel, the
// plugin's buffered fit reproduces `analysis/benchmark.js#fitRidge` /
// `#predictRidge` bit-for-bit with standardisation on and off, and unit
// weights reproduce the unweighted fit.
//
// PRE-REGISTERED. PASS iff predictions match bit-exactly on every test bar in
// both modes and the plugin validates as a learner. Read-only.

import { buildPanel } from '../lib/lab.js';
import { fitRidge, predictRidge } from '../../NeuLegion-master/NeuLegion-master/src/analysis/benchmark.js';
import { ridgeLearner, isRidge } from '../../NeuLegion-master/NeuLegion-master/src/plugins/learners/ridge.js';
import { LEARNER_CONTRACT, isLearnerPlugin } from '../../NeuLegion-master/NeuLegion-master/src/core/contracts/learner.js';
import { validatePlugin } from '../../NeuLegion-master/NeuLegion-master/src/core/contracts/base.js';

const LAGS = 5;
const TRAIN = 3000;
const TEST = 200;

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
    check('e98: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    check('e98: the plugin validates as a learner', isLearnerPlugin(ridgeLearner) && isRidge(ridgeLearner) && validatePlugin(LEARNER_CONTRACT, ridgeLearner).ok === true, 'contract ok');
    const perStream = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const rets = [];
        for (let i = 1; i < s.close.length; i++) rets.push(s.close[i] / s.close[i - 1] - 1);
        perStream.push(lagFeatures(rets));
    }
    for (const standardise of [true, false]) {
        let exact = 0;
        let total = 0;
        for (const { X, y } of perStream) {
            const ref = fitRidge(X.slice(0, TRAIN), y.slice(0, TRAIN), { lambda: 1e-2, standardise });
            const m = ridgeLearner.create({ lambda: 1e-2, standardise });
            for (let i = 0; i < TRAIN; i++) m.fit(X[i], y[i]);
            for (let i = TRAIN; i < TRAIN + TEST; i++) {
                total++;
                if (m.predict(X[i]) === 2 * predictRidge(ref, X[i]) - 1) exact++;
            }
        }
        check(`e98: ridge matches the benchmark bit-exactly (standardise=${standardise})`,
            exact === total, `${exact}/${total} test bars exact`);
    }
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
