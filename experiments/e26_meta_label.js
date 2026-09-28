// E26 - META-LABELLING: is "will this rule's trade pay?" predictable? L06. CYCLE-018.
//
// WHERE THIS CAME FROM. THEORY.md E-D calls this "the reframing that makes the machinery useful":
// the learned layer's only defensible job given G-A (no model class beats the base rate on
// `P(next bar up)`, `NL-BENCH`) is ABSTENTION / SIZING on top of a rule - target
// `P(the rule's trade is profitable)` instead. L06 has been OPEN since CYCLE-001 with a falsifier:
//
//     Brier skill of P(rule's trade profitable) vs the rule's base rate <= 0
//         -> the machinery has no role and NL-BENCH's closure extends to the meta target.
//
// THE POINT OF THIS EXPERIMENT IS THE TARGET, NOT THE MODEL. L06's own "Next actions" say so: before
// touching the architecture, measure whether *the target itself* is predictable at all, out of sample,
// with a deliberately simple causal classifier. So the classifier here is a plain L2 logistic
// regression on the repo's OWN causal feature vector (the eight `analysis/features.js` primitives),
// refit on an expanding (capped-recency) window, purged at the horizon so a training label can never
// resolve after the bar it would be used to predict.
//
// FOUR PARTS.
//
//   0. THE TARGET. For each bar a base rule acts (|position| > 0), the trade's realised P&L over the
//      next H bars is `p[t] * sum_{q=1..H} r[t+q]`, and the primary label is `1[pnl > 0]`. This is
//      LITERALLY the falsifier's target. A secondary label is a DIRECTIONAL triple-barrier outcome
//      (profit-take touched before stop-loss, `ptSl = [1,1]`, trailing-vol scale, vertical `H`): the
//      AFML meta-label. (Directional because `labels.js#tripleBarrierLabels` is side-agnostic; the
//      adaptation is a lab prototype - pure and point-in-time - built on the repo's own vol scale.)
//
//   1. OUT-OF-SAMPLE SKILL. Pooled OOS Brier skill vs the CAUSAL benchmark (the training-window base
//      rate - the best constant predictor you could have known), plus AUC, per stream and per block.
//      A rule whose trade outcome is a coin flip gives skill <= 0; that is the falsifier.
//
//   2. THE NULL IS A DISTRIBUTION, NOT A DRAW (PROTOCOL 3.9). The same pipeline is refit on a
//      label-SHUFFLED training set, `nullSeeds` times, giving the distribution of OOS Brier skill a
//      zero-information classifier achieves. The real skill's z-score in that null is what we quote.
//
//   3. DOES ABSTENTION PAY? Skip the trades the classifier dislikes (p < q) and score the result net
//      of a fee, against (a) the unfiltered rule and (b) a RANDOM filter that keeps the same number
//      of trades - because filtering mechanically cuts exposure and turnover, and only the
//      comparison against the equal-size random filter isolates *information*. Oracle / anti-oracle
//      filters (keep only the trades that actually won / lost) are the F-11 controls: if the
//      abstention machinery cannot turn an oracle filter into a huge Sharpe, it is broken.
//
// Annualisation: the filter readouts use `sharpeRatio(..., periodsPerYear = PERIODS_PER_YEAR = 252)` (the
// ledger convention), so all Sharpes here sit on the same scale as F-01/F-06/F-07 and e2/e24.

import {
    buildPanel, positionsOfFast, SYMBOLS, PERIODS_PER_YEAR,
} from '../lib/lab.js';
import {
    momentum, fracMomentum, volRegime, momentumAgreement, rangeLocation,
    volumeImbalance, autocorr1, acceleration, reversal,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { strategyReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/backtest.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';

const BAR_MS = { '1h': 3_600_000, '15m': 900_000 };

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const stdev = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sigmoid = (z) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The classifier's features: the eight repo primitives (point-in-time by their own audit) plus the
// rule's own clipped position (p[t]) as a ninth column - the rule's conviction is itself information
// the meta-model is allowed to see.
export const FEATURE_SPECS = [
    { name: 'mom16', fn: momentum, args: { window: 16 } },
    { name: 'frac-mom16', fn: fracMomentum, args: { window: 16, d: 0.4 } },
    { name: 'vol-regime', fn: volRegime, args: { window: 8, long: 32 } },
    { name: 'agreement', fn: momentumAgreement, args: { lenses: [4, 8, 16, 32] } },
    { name: 'range-loc', fn: rangeLocation, args: { window: 32 } },
    { name: 'vol-imbalance', fn: volumeImbalance, args: { window: 8, long: 32 } },
    { name: 'autocorr1', fn: autocorr1, args: { window: 32 } },
    { name: 'accel', fn: acceleration, args: { window: 16 } },
];

const BASE_RULES = [
    { id: 'mom16', fn: momentum, window: 16, note: 'shipped sig-momentum (a trend rule)' },
    { id: 'accel16', fn: acceleration, window: 16, note: 'shipped sig-acceleration (a trend-change rule)' },
    { id: 'rev1', fn: reversal, window: 1, note: 'shipped sig-reversal (the only rule with a measured gross edge, F-32)' },
];

// Forward H-bar P&L of a rule's trade at bar t: p[t] * sum_{q=1..H} r[t+q]. NaN if any bar missing.
function tradePnl(returns, t, H, pos) {
    let s = 0;
    for (let q = 1; q <= H; q++) {
        const x = returns[t + q];
        if (!Number.isFinite(x)) return NaN;
        s += x;
    }
    return pos * s;
}

// Directional triple-barrier meta-label: at bar t with direction d = sign(p[t]), walk forward up to
// `H` bars accumulating d*r; profit-take at +ptMult*vol (trailing `volWindow`-bar std, EXCLUDING t),
// stop at -slMult*vol. label = 1 (PT first) | -1 (SL first) | 0 (vertical). "Profitable" = label 1.
// Point-in-time: every read is at an index > t (the outcome) or <= t (the vol scale).
function directionalTripleBarrier(returns, t, d, { ptMult = 1, slMult = 1, volWindow = 32, H = 8 } = {}) {
    const v = stdev(returns.slice(Math.max(0, t - volWindow), t));
    if (!(v > 0)) return null;
    let cum = 0;
    for (let q = 1; q <= H; q++) {
        const x = returns[t + q];
        if (!Number.isFinite(x)) return null;
        cum += d * x;
        if (cum >= ptMult * v) return 1;
        if (cum <= -slMult * v) return -1;
    }
    return 0;
}

// ---- the classifier ---------------------------------------------------------------------------

// Full-batch gradient descent on an L2 logistic loss. `X` is a FLAT Float64Array (N*dim, row-major),
// `y` a Float64Array - flat layouts keep this O(N*dim*iters) loop allocation-free, which is the
// difference between a ~2-minute and a ~30-second pass.
export function fitLogisticFlat(X, y, N, dim, { iters = 8, lr = 0.3, l2 = 1e-3 } = {}) {
    const w = new Float64Array(dim);
    let b = 0;
    if (!N) return { w, b };
    const gw = new Float64Array(dim);
    for (let it = 0; it < iters; it++) {
        gw.fill(0);
        let gb = 0;
        for (let i = 0; i < N; i++) {
            const off = i * dim;
            let z = b;
            for (let j = 0; j < dim; j++) z += w[j] * X[off + j];
            const e = sigmoid(z) - y[i];
            for (let j = 0; j < dim; j++) gw[j] += e * X[off + j];
            gb += e;
        }
        for (let j = 0; j < dim; j++) w[j] -= lr * (gw[j] / N + l2 * w[j]);
        b -= lr * gb / N;
    }
    return { w, b };
}

function standardise(rows, idxs, dim) {
    const mu = new Float64Array(dim);
    const sd = new Float64Array(dim);
    for (let j = 0; j < dim; j++) {
        let s = 0;
        let c = 0;
        for (const i of idxs) { const v = rows[i].x[j]; if (Number.isFinite(v)) { s += v; c++; } }
        mu[j] = c ? s / c : 0;
        let a = 0;
        for (const i of idxs) { const v = rows[i].x[j]; if (Number.isFinite(v)) a += (v - mu[j]) ** 2; }
        sd[j] = c > 1 ? Math.sqrt(a / (c - 1)) : 1;
        if (!(sd[j] > 0)) sd[j] = 1;
    }
    return { mu, sd };
}

// Turn a fitted standardized-space model back into a raw-feature affine form: z = c + sum coef[j]*x[j].
function toRawCoefs(fit, st, dim) {
    const coef = new Float64Array(dim);
    let c = fit.b;
    for (let j = 0; j < dim; j++) { coef[j] = fit.w[j] / st.sd[j]; c -= coef[j] * st.mu[j]; }
    return { coef, c };
}

function brierSkill(preds, ys, bases) {
    let num = 0;
    let den = 0;
    let n = 0;
    for (let i = 0; i < preds.length; i++) {
        if (!Number.isFinite(preds[i]) || !Number.isFinite(ys[i])) continue;
        const base = Number.isFinite(bases[i]) ? bases[i] : 0.5;
        num += (preds[i] - ys[i]) ** 2;
        den += (base - ys[i]) ** 2;
        n++;
    }
    return { skill: den > 0 ? 1 - num / den : NaN, n, brierModel: n ? num / n : NaN, brierBase: n ? den / n : NaN };
}

function auc(preds, ys) {
    const pairs = [];
    for (let i = 0; i < preds.length; i++) if (Number.isFinite(preds[i]) && Number.isFinite(ys[i])) pairs.push([preds[i], ys[i]]);
    pairs.sort((a, b) => a[0] - b[0]);
    let nPos = 0;
    let nNeg = 0;
    for (const [, y] of pairs) (y ? nPos++ : nNeg++);
    if (!nPos || !nNeg) return NaN;
    let sumPosRanks = 0;
    let i = 0;
    while (i < pairs.length) {
        let j = i;
        while (j + 1 < pairs.length && pairs[j + 1][0] === pairs[i][0]) j++;
        const avg = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++) if (pairs[k][1]) sumPosRanks += avg;
        i = j + 1;
    }
    return (sumPosRanks - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

// One stream's causal OOS pass. `rows` is time-ascending: {t, time, x:Float64Array, y, ytb, pos, pnl}.
// Grows the training window one block at a time; purges the horizon (a training row enters only when
// its label is fully resolved before the first predicted bar). Returns predictions + the causal base
// rate used at each prediction, plus the label-shuffled null predictions.
export function causalOos(rows, { H, barMs, step, maxTrain, minTrain, iters, nullSeeds, seed }) {
    const N = rows.length;
    const dim = rows.length ? rows[0].x.length : 0;
    const pred = new Float64Array(N).fill(NaN);
    const predTb = new Float64Array(N).fill(NaN);
    const base = new Float64Array(N).fill(NaN);
    const baseTb = new Float64Array(N).fill(NaN);
    const nullPred = Array.from({ length: nullSeeds }, () => new Float64Array(N).fill(NaN));
    const block = new Int32Array(N).fill(-1);
    let firstPred = -1;
    let blockId = 0;
    for (let start = 0; start < N; start += step, blockId++) {
        const cutoff = rows[start].time - H * barMs;
        let hi = start;
        while (hi > 0 && rows[hi - 1].time > cutoff) hi--;
        const lo = Math.max(0, hi - maxTrain);
        const Ntr = hi - lo;
        if (Ntr < minTrain) continue;
        const idxs = new Int32Array(Ntr);
        for (let a = 0; a < Ntr; a++) idxs[a] = lo + a;
        const st = standardise(rows, idxs, dim);
        const Xtr = new Float64Array(Ntr * dim);
        const ytr = new Float64Array(Ntr);
        const ytbTr = new Float64Array(Ntr);
        let b0 = 0;
        let b1 = 0;
        for (let a = 0; a < Ntr; a++) {
            const row = rows[idxs[a]];
            const off = a * dim;
            for (let j = 0; j < dim; j++) Xtr[off + j] = (row.x[j] - st.mu[j]) / st.sd[j];
            ytr[a] = row.y;
            ytbTr[a] = row.ytb;
            b0 += row.y;
            b1 += row.ytb;
        }
        b0 /= Ntr;
        b1 /= Ntr;
        const fit = fitLogisticFlat(Xtr, ytr, Ntr, dim, { iters });
        const fitTb = fitLogisticFlat(Xtr, ytbTr, Ntr, dim, { iters });
        // null fits on a 1-in-3 subsample of the same training rows (a zero-information model does not
        // need the full sample, and this is a large share of the cost).
        const sub = Math.ceil(Ntr / 3);
        const Xn = new Float64Array(sub * dim);
        const ysub = new Float64Array(sub);
        const rngShuffle = mulberry32((seed + 1013 * (blockId + 1)) >>> 0);
        const perm = new Int32Array(sub);
        for (let a = 0; a < sub; a++) perm[a] = a;
        for (let q = sub - 1; q > 0; q--) { const t2 = Math.floor(rngShuffle() * (q + 1)); const s = perm[q]; perm[q] = perm[t2]; perm[t2] = s; }
        for (let a = 0; a < sub; a++) { const src = a * 3; const off = a * dim; for (let j = 0; j < dim; j++) Xn[off + j] = Xtr[src * dim + j]; ysub[a] = ytr[perm[a]]; }
        const nullCoefs = [];
        for (let s = 0; s < nullSeeds; s++) {
            const rng = mulberry32((seed + 1013 * (blockId + 1) + 7919 * (s + 1)) >>> 0);
            const ys = ysub.slice();
            for (let q = ys.length - 1; q > 0; q--) { const t2 = Math.floor(rng() * (q + 1)); [ys[q], ys[t2]] = [ys[t2], ys[q]]; }
            nullCoefs.push(toRawCoefs(fitLogisticFlat(Xn, ys, sub, dim, { iters }), st, dim));
        }
        const rc = toRawCoefs(fit, st, dim);
        const rcTb = toRawCoefs(fitTb, st, dim);
        const end = Math.min(start + step, N);
        for (let i = start; i < end; i++) {
            const x = rows[i].x;
            let z = rc.c;
            let zt = rcTb.c;
            for (let j = 0; j < dim; j++) { z += rc.coef[j] * x[j]; zt += rcTb.coef[j] * x[j]; }
            pred[i] = sigmoid(z);
            predTb[i] = sigmoid(zt);
            base[i] = b0;
            baseTb[i] = b1;
            block[i] = blockId;
            for (let s = 0; s < nullSeeds; s++) {
                const nco = nullCoefs[s];
                let zn = nco.c;
                for (let j = 0; j < dim; j++) zn += nco.coef[j] * x[j];
                nullPred[s][i] = sigmoid(zn);
            }
        }
        if (firstPred < 0) firstPred = start;
    }
    return { pred, predTb, base, baseTb, nullPred, block, firstPred, dim };
}

export async function run({
    tf = '1h', H = 8, step = null, maxTrain = 2000, minTrain = 1200, iters = 8,
    nullSeeds = 4, thresholds = [0.5, 0.55, 0.6, 0.65], randomSeeds = 8,
    capacityIters = [1, 5, 15, 40], seed = 20261801,
} = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const k = panel.length;
    const n = panel[0].n;
    const times = panel[0].t;
    const barMs = BAR_MS[tf] || 3_600_000;
    // Refit cadence: keep the block count (and hence runtime) roughly constant across timeframes.
    const stepUse = step || Math.max(1500, Math.floor(n / 30));
    const out = {
        config: { tf, bars: n, streams: k, H, step: stepUse, maxTrain, minTrain, iters, nullSeeds, thresholds, randomSeeds, firstBar: new Date(times[0]).toISOString(), lastBar: new Date(times[n - 1]).toISOString() },
        features: FEATURE_SPECS.map((s) => s.name + ':' + JSON.stringify(s.args)),
    };

    const rules = {};
    for (const rule of BASE_RULES) {
        const globalRows = [];
        const perStream = [];
        const positionsForRule = [];
        let probeRows = null;
        for (let j = 0; j < k; j++) {
            const s = panel[j];
            const r = s.returns;
            const pos = positionsOfFast(rule.fn, s, { window: rule.window });
            positionsForRule.push(pos);
            const rows = [];
            for (let t = 0; t + H < n; t++) {
                const p = pos[t];
                if (!Number.isFinite(p) || Math.abs(p) < 1e-9) continue;
                const x = new Float64Array(FEATURE_SPECS.length + 1);
                let ok = true;
                for (let f = 0; f < FEATURE_SPECS.length; f++) {
                    const v = FEATURE_SPECS[f].fn(s, t, FEATURE_SPECS[f].args);
                    if (!Number.isFinite(v)) { ok = false; break; }
                    x[f] = v;
                }
                if (!ok) continue;
                const pnl = tradePnl(r, t, H, p);
                if (!Number.isFinite(pnl)) continue;
                const ytbLab = directionalTripleBarrier(r, t, Math.sign(p), { H });
                if (ytbLab == null) continue;
                x[FEATURE_SPECS.length] = p;
                rows.push({ t, time: times[t], x, y: pnl > 0 ? 1 : 0, ytb: ytbLab === 1 ? 1 : 0, pos: p, pnl, stream: j });
            }
            if (!rows.length) { perStream.push({ stream: SYMBOLS[j], actingRows: 0 }); continue; }
            if (j === 0) probeRows = rows;
            const o = causalOos(rows, { H, barMs, step: stepUse, maxTrain, minTrain, iters, nullSeeds, seed: seed + j * 104729 });
            for (let i = 0; i < rows.length; i++) {
                rows[i].pred = o.pred[i];
                rows[i].predTb = o.predTb[i];
                rows[i].base = o.base[i];
                rows[i].baseTb = o.baseTb[i];
                rows[i].block = o.block[i];
                rows[i].nullPred = o.nullPred.map((a) => a[i]);
            }
            for (const row of rows) globalRows.push(row);
            // per-stream summary
            const pr = rows.filter((x) => Number.isFinite(x.pred));
            const skillS = brierSkill(pr.map((x) => x.pred), pr.map((x) => x.y), pr.map((x) => x.base));
            perStream.push({
                stream: SYMBOLS[j], actingRows: rows.length, predicted: pr.length,
                baseRate: mean(rows.map((x) => x.y)),
                brierSkill: skillS.skill, auc: auc(pr.map((x) => x.pred), pr.map((x) => x.y)),
                brierSkillTb: brierSkill(pr.map((x) => x.predTb), pr.map((x) => x.ytb), pr.map((x) => x.baseTb)).skill,
            });
        }

        const withPred = globalRows.filter((x) => Number.isFinite(x.pred));
        const ys = withPred.map((x) => x.y);
        const bases = withPred.map((x) => x.base);
        const basesTb = withPred.map((x) => x.baseTb);
        const preds = withPred.map((x) => x.pred);
        const pooledSkill = brierSkill(preds, ys, bases);
        const pooledTb = brierSkill(withPred.map((x) => x.predTb), withPred.map((x) => x.ytb), basesTb);

        // per-block distribution (the placebo needs a distribution, and a per-block read shows drift)
        const byBlock = new Map();
        for (const x of withPred) {
            if (!byBlock.has(x.block)) byBlock.set(x.block, { p: [], y: [], b: [] });
            const g = byBlock.get(x.block);
            g.p.push(x.pred); g.y.push(x.y); g.b.push(x.base);
        }
        const blockSkills = [...byBlock.values()].map((g) => brierSkill(g.p, g.y, g.b).skill).filter(Number.isFinite);

        // the null: same pipeline, label-shuffled training. Distribution of OOS skill.
        const nullSkills = [];
        for (let s = 0; s < nullSeeds; s++) {
            const np = withPred.map((x) => x.nullPred[s]);
            nullSkills.push(brierSkill(np, ys, bases).skill);
        }

        rules[rule.id] = {
            note: rule.note,
            actingBars: globalRows.length,
            baseRate: mean(globalRows.map((x) => x.y)),
            oos: {
                predicted: withPred.length,
                brierModel: pooledSkill.brierModel,
                brierBase: pooledSkill.brierBase,
                brierSkill: pooledSkill.skill,
                auc: auc(preds, ys),
                brierSkillTripleBarrier: pooledTb.skill,
                aucTripleBarrier: auc(withPred.map((x) => x.predTb), withPred.map((x) => x.ytb)),
            },
            perStream,
            byBlock: { nBlocks: blockSkills.length, mean: mean(blockSkills), sd: stdev(blockSkills), positiveFraction: blockSkills.length ? blockSkills.filter((s) => s > 0).length / blockSkills.length : NaN },
            null: { skills: nullSkills, mean: mean(nullSkills), sd: stdev(nullSkills), zVsNull: stdev(nullSkills) > 0 ? (pooledSkill.skill - mean(nullSkills)) / stdev(nullSkills) : NaN, seeds: nullSeeds },
        };
        rules[rule.id].abstention = abstention(times, panel.map((s) => s.returns), positionsForRule, globalRows, { thresholds, randomSeeds, nullSeeds, seed: seed + 17 });
        // Capacity probe (first stream only): does more/less fitting ever give OOS skill? The target's
        // predictability must not depend on an unlucky iteration count.
        rules[rule.id].capacityProbe = probeRows ? capacityProbe(probeRows, { H, barMs, step: stepUse, maxTrain, minTrain, nullSeeds, itersList: capacityIters, seed: seed + 5 }) : null;
    }
    out.rules = rules;

    // F-11 controls for the abstention machinery: an oracle filter (keep only winning trades) must
    // produce an explosive Sharpe, its mirror must be explosive-negative.
    out.summary = {
        perRule: Object.fromEntries(Object.entries(rules).map(([id, r]) => [id, {
            baseRate: +r.baseRate.toFixed(4), actingBars: r.actingBars,
            brierSkill: +r.oos.brierSkill.toFixed(4), auc: +r.oos.auc.toFixed(4),
            skillTb: +r.oos.brierSkillTripleBarrier.toFixed(4),
            nullMean: +r.null.mean.toFixed(4), zVsNull: +r.null.zVsNull.toFixed(2),
            blocksPositive: +r.byBlock.positiveFraction.toFixed(2),
            rawNet4: r.abstention.raw.net4Sharpe, bestFilterNet4: r.abstention.bestFilter ? r.abstention.bestFilter.net4Sharpe : null,
            bestFilterNullMean: r.abstention.bestFilter ? r.abstention.bestFilter.nullMean : null,
            bestFilterZVsNull: r.abstention.bestFilter ? +r.abstention.bestFilter.zVsNull.toFixed(2) : null,
            capacityProbe: r.capacityProbe ? r.capacityProbe.map((x) => ({ iters: x.iters, skill: +x.brierSkill.toFixed(4), auc: +x.auc.toFixed(4) })) : null,
        }])),
    };
    out.verdict = {
        note: 'L06 falsifier: pooled OOS Brier skill of P(rule trade profitable) vs the causal base rate <= 0 closes the lead. Abstention must beat the null-model filter (a filter built from a no-information model) to be information, not just exposure/turnover reduction.',
        anyRuleSkillPositive: Object.values(rules).some((r) => r.oos.brierSkill > 0),
        anyRuleBeatsNull: Object.values(rules).some((r) => r.null.zVsNull > 2 && (r.oos.brierSkill - r.null.mean) > 0.005),
        anyFilterBeatsNullModel: Object.values(rules).some((r) => r.abstention.bestFilter && r.abstention.bestFilter.net4Sharpe > r.abstention.bestFilter.nullMean + 0.02),
        oracleFilterWorks: Object.values(rules).every((r) => r.abstention.controlsPass),
        note2: 'oracle/anti-oracle filters are the F-11 control: if keeping only winners does not produce a large positive net@4, the filter machinery is broken and no abstention result is believable.',
    };
    return out;
}

// ---- 3. abstention overlay ----------------------------------------------------------------------

// Capacity probe: rerun the causal OOS pass on one stream's rows at several gradient-descent
// capacities, so the "no OOS skill" verdict is shown not to be an artefact of an unlucky iteration
// count (more fitting overfits a weak target; less underfits).
function capacityProbe(rows, { H, barMs, step, maxTrain, minTrain, nullSeeds, itersList, seed }) {
    const out = [];
    for (const it of itersList) {
        const o = causalOos(rows, { H, barMs, step, maxTrain, minTrain, iters: it, nullSeeds: 0, seed });
        const p = [];
        const y = [];
        const b = [];
        for (let i = 0; i < rows.length; i++) if (Number.isFinite(o.pred[i])) { p.push(o.pred[i]); y.push(rows[i].y); b.push(o.base[i]); }
        const s = brierSkill(p, y, b);
        out.push({ iters: it, brierSkill: s.skill, auc: auc(p, y), n: p.length });
    }
    return out;
}

// Build the filtered position series for one stream, score it over the common OOS region, and compare
// against the unfiltered rule and a null/random filter. `keep` is a predicate on (stream, bar).
//
// Uses `strategyReturns` + `sharpeRatio` (the repo's own backtest arithmetic) rather than the full
// `backtestMetrics`, because this is called ~hundreds of times per rule and only the Sharpe, the gross
// mean and the turnover are read. Break-even is e16's definition: mean(gross) / mean(per-period L1
// turnover) * 1e4.
function scoreFiltered(returnsByStream, posByStream, regionStart, buildKeep) {
    const k = returnsByStream.length;
    const perNet = [];
    const perGross = [];
    const perBE = [];
    const keepFracs = [];
    for (let j = 0; j < k; j++) {
        const r = returnsByStream[j];
        const pos = posByStream[j];
        const n = r.length;
        const sig = new Array(n - regionStart).fill(0);
        let acting = 0;
        let kept = 0;
        for (let t = regionStart; t < n; t++) {
            if (Math.abs(fin(pos[t])) < 1e-9) continue;
            acting++;
            if (buildKeep(j, t)) { sig[t - regionStart] = pos[t]; kept++; }
        }
        keepFracs.push(acting ? kept / acting : NaN);
        const rs = r.slice(regionStart);
        const net = strategyReturns({ returns: rs, signals: sig, costBps: 4 }).returns;
        const gross = strategyReturns({ returns: rs, signals: sig, costBps: 0 });
        const mGross = mean(gross.gross);
        const mTurn = gross.gross.length ? gross.turnover / gross.gross.length : 0;
        perNet.push(sharpeRatio(net, { periodsPerYear: PERIODS_PER_YEAR }));
        perGross.push(sharpeRatio(gross.gross, { periodsPerYear: PERIODS_PER_YEAR }));
        perBE.push(mTurn > 0 ? (mGross / mTurn) * 1e4 : null);
    }
    return { net4Sharpe: mean(perNet), grossSharpe: mean(perGross), breakEvenBps: mean(perBE), keepFraction: mean(keepFracs) };
}

function abstention(times, returnsByStream, posByStream, rows, { thresholds, randomSeeds, nullSeeds, seed }) {
    const k = posByStream.length;
    // prediction maps per stream: bar time -> OOS prob, and -> realised trade P&L
    const predByStream = posByStream.map(() => new Map());
    const pnlByStream = posByStream.map(() => new Map());
    const nullByStream = Array.from({ length: nullSeeds }, () => posByStream.map(() => new Map()));
    let firstPred = Infinity;
    for (const x of rows) {
        if (!Number.isFinite(x.pred)) continue;
        predByStream[x.stream].set(x.t, x.pred);
        pnlByStream[x.stream].set(x.t, x.pnl);
        for (let s = 0; s < nullSeeds; s++) if (Number.isFinite(x.nullPred[s])) nullByStream[s][x.stream].set(x.t, x.nullPred[s]);
        if (x.t < firstPred) firstPred = x.t;
    }
    const regionStart = firstPred === Infinity ? 0 : firstPred;

    const keepBy = (byStream, q) => (j, t) => { const p = byStream[j].get(t); return Number.isFinite(p) && p >= q; };
    const filters = {};
    const nullFilters = {};
    for (const q of thresholds) {
        filters['q' + q] = scoreFiltered(returnsByStream, posByStream, regionStart, keepBy(predByStream, q));
        // NULL: the same filter built from a no-information model (trained on shuffled labels). If the
        // real filter cannot beat this distribution, any apparent gain is machinery, not signal.
        const snaps = [];
        for (let s = 0; s < nullSeeds; s++) snaps.push(scoreFiltered(returnsByStream, posByStream, regionStart, keepBy(nullByStream[s], q)).net4Sharpe);
        nullFilters['q' + q] = { meanNet4: mean(snaps), sdNet4: stdev(snaps), seeds: nullSeeds };
    }
    const oracle = scoreFiltered(returnsByStream, posByStream, regionStart, (j, t) => { const v = pnlByStream[j].get(t); return Number.isFinite(v) && v > 0; });
    const antiOracle = scoreFiltered(returnsByStream, posByStream, regionStart, (j, t) => { const v = pnlByStream[j].get(t); return Number.isFinite(v) && v < 0; });

    // equal-size random control (secondary): keeps the same FRACTION of acting bars at random.
    const best = Object.entries(filters).sort((a, b) => b[1].net4Sharpe - a[1].net4Sharpe)[0];
    const control = {};
    for (const [tag, f] of Object.entries(filters)) {
        const rr = mulberry32(seed);
        const snaps = [];
        for (let s = 0; s < randomSeeds; s++) snaps.push(scoreFiltered(returnsByStream, posByStream, regionStart, (j, t) => rr() < f.keepFraction).net4Sharpe);
        control[tag] = { meanNet4: mean(snaps), sdNet4: stdev(snaps) };
    }
    const raw = scoreFiltered(returnsByStream, posByStream, regionStart, () => true);
    return {
        regionStart: times.length ? new Date(times[regionStart]).toISOString() : null,
        regionBars: k ? (posByStream[0].length - regionStart) : 0,
        raw,
        filters,
        nullFilters,
        bestFilter: best ? {
            tag: best[0], ...best[1],
            nullMean: nullFilters[best[0]].meanNet4, nullSd: nullFilters[best[0]].sdNet4,
            randomMean: control[best[0]].meanNet4,
            zVsNull: nullFilters[best[0]].sdNet4 > 0 ? (best[1].net4Sharpe - nullFilters[best[0]].meanNet4) / nullFilters[best[0]].sdNet4 : NaN,
        } : null,
        randomControl: { thresholds: control, note: 'keeps the same FRACTION of acting bars as the matching filter, chosen at random (secondary; a time-clustered filter can beat this for purely mechanical turnover reasons - the null-model filter is the primary control)' },
        oracle,
        antiOracle,
        controlsPass: oracle.grossSharpe > 1 && antiOracle.grossSharpe < -1 && (oracle.grossSharpe - antiOracle.grossSharpe) > 3,
    };
}
