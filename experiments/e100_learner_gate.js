// E100 - V2.3 learner gate probe: do ridge/mlp beat the base rate walk-forward?
//
// CYCLE-104. The learner slot now holds four plugins (legacy + three P1
// ports). The slot-level question is whether the ports beat the prior they
// are measured against: walk-forward Brier skill of ridge and mlp against the
// base rate on lagged-return features with next-bar-sign labels, three splits
// per 1h stream (train = trailing 800 bars, test = next 500, all causal).
//
// PRE-REGISTERED. PASS iff every learner scores a finite Brier on every
// stream x split cell. Skills are recorded either way — a negative is the
// G-A thesis holding in the slot, not a failure. Read-only.

import { buildPanel } from '../lib/lab.js';
import { baseRateLearner } from '../../NeuLegion-master/NeuLegion-master/src/plugins/learners/base-rate.js';
import { ridgeLearner } from '../../NeuLegion-master/NeuLegion-master/src/plugins/learners/ridge.js';
import { mlpLearner } from '../../NeuLegion-master/NeuLegion-master/src/plugins/learners/mlp.js';

const LAGS = 5;
const SPAN = 5000;
const TRAIN_CAP = 800;
const TEST = 500;
const SPLITS = [0.5, 0.6, 0.7];
const MLP_OPTS = { hidden: 4, epochs: 50, lr: 0.1, seed: 1, batch: 0, l2: 1e-5, standardise: true };

function brier(probs, y) {
    let s = 0;
    for (let i = 0; i < y.length; i++) { const d = probs[i] - y[i]; s += d * d; }
    return s / y.length;
}

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e100: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const cells = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const rets = [];
        for (let i = 1; i < s.close.length; i++) rets.push(s.close[i] / s.close[i - 1] - 1);
        const X = [];
        const y = [];
        for (let i = LAGS; i < LAGS + SPAN; i++) {
            const row = [];
            for (let j = 1; j <= LAGS; j++) row.push(rets[i - j]);
            X.push(row);
            y.push(rets[i] > 0 ? 1 : 0);
        }
        for (const split of SPLITS) {
            const tn = Math.floor(X.length * split);
            const lo = Math.max(0, tn - TRAIN_CAP);
            const Xtr = X.slice(lo, tn);
            const ytr = y.slice(lo, tn);
            const Xte = X.slice(tn, tn + TEST);
            const yte = y.slice(tn, tn + TEST);
            const b = baseRateLearner.create();
            for (const t of ytr) b.fit(null, t);
            const r = ridgeLearner.create({});
            for (let i = 0; i < Xtr.length; i++) r.fit(Xtr[i], ytr[i]);
            const m = mlpLearner.create(MLP_OPTS);
            for (let i = 0; i < Xtr.length; i++) m.fit(Xtr[i], ytr[i]);
            const pb = Xte.map(() => (b.predict(null) + 1) / 2);
            const pr = Xte.map((x) => (r.predict(x) + 1) / 2);
            const pm = Xte.map((x) => (m.predict(x) + 1) / 2);
            const bb = brier(pb, yte);
            const br = brier(pr, yte);
            const bm = brier(pm, yte);
            const ok = [bb, br, bm].every(Number.isFinite) && bb > 0;
            cells.push({
                sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''),
                split,
                skillRidge: ok ? 1 - br / bb : NaN,
                skillMlp: ok ? 1 - bm / bb : NaN,
                ok,
            });
        }
    }
    check('e100: every learner scores a finite Brier on every stream x split cell',
        cells.every((c) => c.ok), `${cells.filter((c) => c.ok).length}/${cells.length} cells finite`);
    const mean = (f) => cells.reduce((a, c) => a + f(c), 0) / cells.length;
    const mr = mean((c) => c.skillRidge);
    const mm = mean((c) => c.skillMlp);
    check('e100: mean skills are recorded (any sign)',
        Number.isFinite(mr) && Number.isFinite(mm),
        `meanSkill ridge=${mr.toFixed(4)} mlp=${mm.toFixed(4)} over ${cells.length} cells`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
