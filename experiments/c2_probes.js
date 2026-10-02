// C2 probe battery (harness-runnable third of the C2 queue) — CYCLE-198 DESIGN+EXEC.
// Standalone: NOT in run_all.js. Read-only (repo fns imported, never edited).
//
// Three pre-registered probes on the SAME M1 frame/panel where applicable:
//  A. scorer-robustness: vendored parameterized copy of
//     `_computeMemoryScoreFromProtos` (weights as args); GUARD bit-equality
//     vs the repo fn at default weights; then ±20% single-weight + joint
//     perturbations → keep-half flip rate. RULE: median flip >20% → ARBITRARY
//     (recommend removal/grounding); else ROBUST.
//  B. uniqueness-weighting (#54): overlapping label spans (H=3) on the M1
//     frame; LdP average-uniqueness weights vs unweighted flat ridge.
//     RULE: DM p<0.05 win → USE; else keep default-off.
//  C. synthetic ensemble: 5 online linear members, one pass, arms plain-SGD /
//     AdamW / distill-top30 (repo T=2/scale 0.2) / distill-uniform /
//     laggard-rescue-LR. RULE: ordering recorded; adamw>=sgd supports C2;
//     uniform>=top30 supports deleting teacher KD; laggard<=plain supports
//     removing rescue. Ensemble = member-mean probability.
import { buildPanel, SYMBOLS } from '../lib/lab.js';
import { dieboldMariano } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast/scoring.js';
import { consolidationMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/memory/consolidation.js';
import { linalgMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/kernels/linalg.js';
import { retrievalMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/memory/retrieval.js';

const MAJ8 = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'dogeusdt', 'linkusdt'];
const P = 16, H = 3, LAMBDA = 1.0;
const clip01 = (x) => (x < 0.01 ? 0.01 : x > 0.99 ? 0.99 : x);
const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

function solveRidgeFull(X, y, lam, wgt = null) {
    const n = X.length, p = X[0].length;
    const A = Array.from({ length: p + 1 }, () => new Array(p + 1).fill(0));
    const b = new Array(p + 1).fill(0);
    for (let i = 0; i < n; i++) {
        const wt = wgt ? wgt[i] : 1;
        const xi = [1, ...X[i]];
        for (let a = 0; a <= p; a++) {
            b[a] += wt * xi[a] * y[i];
            for (let c = 0; c <= p; c++) A[a][c] += wt * xi[a] * xi[c];
        }
    }
    for (let j = 1; j <= p; j++) A[j][j] += lam;
    A[0][0] += 1e-9;
    for (let c = 0; c <= p; c++) {
        let piv = c;
        for (let r = c + 1; r <= p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
        for (let r = 0; r <= p; r++) {
            if (r === c) continue;
            const f = A[r][c] / A[c][c];
            for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k];
            b[r] -= f * b[c];
        }
    }
    return b.map((v, i) => v / A[i][i]);
}

function avgUniqueness(spans) {
    const T = Math.max(...spans.map((s) => s[1])) + 1;
    const conc = new Array(T).fill(0);
    for (const [a, bb] of spans) for (let t = a; t <= bb && t < T; t++) conc[t]++;
    return spans.map(([a, bb]) => {
        let s = 0, n = 0;
        for (let t = a; t <= bb && t < T; t++) { s += 1 / conc[t]; n++; }
        return n ? s / n : 0;
    });
}

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });
    const out = {};

    // ---- A. scorer robustness ----
    {
        const rng = mulberry32(193);
        const HD = 16, E = 40;
        const ctx = Object.assign({}, linalgMethods, retrievalMethods, consolidationMethods, {
            _hiddenSize: HD, _inputSize: 64, _performanceScores: [0.5], _specializationScores: [0.5],
            _contextWindow: 64, _memoryFactor: 1,
        });
        const mkProto = (boost) => ({
            mean: Array.from({ length: HD }, () => (rng() - 0.5) * (boost ? 3 : 1)),
            variance: Array.from({ length: HD }, () => 0.1 + rng()),
            size: 1 + Math.floor(rng() * 20), accessCount: Math.floor(rng() * (boost ? 500 : 60)),
            importance: rng(),
        });
        const entries = Array.from({ length: E }, (_, i) => ({ protos: [mkProto(i === 0), mkProto(false), mkProto(false)] }));
        const memList = entries;
        const scoreOf = (entry, idx, wv) => {
            const saved = consolidationMethods._computeMemoryScoreFromProtos;
            return saved.call(ctx, entry.protos, null, 0, idx, memList, false);
        };
        const base = entries.map((e, i) => scoreOf(e, i));
        check('c2a: repo scorer runs on synthetic bank', base.every(Number.isFinite) && new Set(base).size > 5, `finite ${base.filter(Number.isFinite).length}/${E}`);
        const rank = (s) => s.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
        const baseRank = rank(base);
        const keepN = Math.floor(E / 2);
        const baseKeep = new Set(baseRank.slice(0, keepN));
        const flipOf = (scores) => {
            const k = new Set(rank(scores).slice(0, keepN));
            let flip = 0;
            for (const i of baseKeep) if (!k.has(i)) flip++;
            return flip / keepN;
        };
        // Parameterized twin: re-implements the identical arithmetic with
        // term weights as arguments (verified bit-equal below at defaults).
        const twin = (protos, entryIndex, wv, uniqExp, recRate) => {
            const totalSize = protos.reduce((s, p) => s + p.size, 0) || 1;
            const rep = ctx._weightedMean(protos);
            let sqSum = 0, pvar = 0;
            for (let j = 0; j < HD; j++) {
                let wsq = 0, vj = 0;
                for (const p of protos) {
                    const m = p.mean[j], v = Math.max(p.variance[j], 1e-6), d = m - rep[j];
                    vj += p.size * (v + d * d); wsq += p.size * m * m;
                }
                pvar += vj / totalSize; sqSum += wsq;
            }
            const varianceScore = Math.tanh(Math.sqrt(Math.max(0, pvar / HD)));
            let ent = 0;
            if (protos.length > 1) for (const p of protos) { const pr = p.size / totalSize; if (pr > 1e-6) ent -= pr * Math.log(pr + 1e-12); }
            const diversity = ent / Math.log(protos.length + 1);
            let act = 0;
            for (let j = 0; j < HD; j++) { let mx = 0; for (const p of protos) mx = Math.max(mx, Math.abs(p.mean[j])); if (mx > 1e-3) act++; }
            const sparsity = 1 - Math.abs(act / HD - 0.5) * 2;
            const magn = Math.tanh(Math.sqrt(sqSum) / Math.sqrt(totalSize * HD));
            let acc = 0;
            for (const p of protos) acc += p.accessCount;
            const access = Math.tanh(acc / (protos.length * 50));
            const perf = 0.5, spec = 0.5, conf = 0.25 * perf * spec;
            const centroid = new Float32Array(HD);
            let tcs = 0;
            const maxS = Math.min(Math.round(64 * 0.15), memList.length);
            const idxs = [];
            if (memList.length > maxS) for (let i = 0; i < maxS; i++) idxs.push(Math.floor(i * memList.length / maxS));
            else for (let i = 0; i < memList.length; i++) idxs.push(i);
            for (const ii of idxs.filter((x) => x !== entryIndex)) for (const pr of memList[ii].protos) { for (let j = 0; j < HD; j++) centroid[j] += pr.mean[j] * pr.size; tcs += pr.size; }
            let uniq = 1;
            if (tcs > 0) { for (let j = 0; j < HD; j++) centroid[j] /= tcs; uniq = Math.max(0, 1 - ctx._cosineSimilarity(rep, centroid)); }
            let bs = (wv[0] * varianceScore + wv[1] * diversity + wv[2] * sparsity + wv[3] * magn + wv[4] * 0 + wv[5] * access);
            bs = bs * (1 + conf) * Math.pow(uniq + 0.5, uniqExp);
            let df = 1;
            if (memList.length > 5) {
                const mrfd = Math.max(Math.round(3 * 1), Math.round(memList.length * 0.15));
                const rc = Math.max(mrfd, Math.floor(memList.length * 0.2));
                let ds = 0, rc2 = 0;
                for (let r = 1; r <= rc; r++) {
                    const ri = memList.length - r;
                    if (ri < 0 || ri === entryIndex) continue;
                    ds += 1 - ctx._maxPairwiseKernel(protos, memList[ri].protos); rc2++;
                }
                if (rc2 > 0) df = 1 + ds / rc2;
            }
            const age = memList.length - 1 - entryIndex;
            return bs * df * Math.exp(-recRate * age) * (1 + 1 / (1 + age / 5));
        };
        const DEF = [0.25, 0.15, 0.15, 0.15, 0.10, 0.15];
        let maxDiff = 0;
        const twinBase = entries.map((e, i) => twin(e.protos, i, DEF, 1.5, 0.03));
        for (let i = 0; i < E; i++) maxDiff = Math.max(maxDiff, Math.abs(twinBase[i] - base[i]));
        check('c2a: twin bit-equality guard at default weights', maxDiff < 1e-9, `maxAbsDiff ${maxDiff}`);
        const flips = [];
        for (let k = 0; k < 6; k++) for (const f of [0.8, 1.2]) {
            const wv = DEF.slice(); wv[k] *= f;
            flips.push(flipOf(entries.map((e, i) => twin(e.protos, i, wv, 1.5, 0.03))));
        }
        const r2 = mulberry32(194);
        for (let d = 0; d < 20; d++) {
            const wv = DEF.map((x) => x * (0.8 + 0.4 * r2()));
            const ue = 1.5 * (0.8 + 0.4 * r2()), rr = 0.03 * (0.8 + 0.4 * r2());
            flips.push(flipOf(entries.map((e, i) => twin(e.protos, i, wv, ue, rr))));
        }
        flips.sort((a, b) => a - b);
        const med = flips[Math.floor(flips.length / 2)];
        out.scorer = { medianFlip: +med.toFixed(3), maxFlip: +flips[flips.length - 1].toFixed(3), verdict: med > 0.2 ? 'ARBITRARY' : 'ROBUST' };
        check('c2a: scorer robustness measured', true, `medianFlip ${out.scorer.medianFlip} maxFlip ${out.scorer.maxFlip} → ${out.scorer.verdict}`);
    }

    // ---- B + C share the M1 frame ----
    const syms = SYMBOLS.filter((s) => MAJ8.includes(s.toLowerCase()));
    const panel = await buildPanel({ symbols: syms, tf: '1h' });
    const rets = panel.map((series) => {
        const closes = series.closes.filter(Number.isFinite);
        const o = [];
        for (let t = 47; t < closes.length; t += 8) {
            const c0 = closes[t - 8], c1 = closes[t];
            if (c0 > 0 && c1 > 0) o.push(Math.log(c1 / c0));
        }
        return o;
    });
    const T = Math.min(...rets.map((r) => r.length));
    const rows = [];
    for (let j = 0; j < 8; j++) for (let t = P; t < T - 1; t++) rows.push({ x: rets[j].slice(t - P, t), y: rets[j][t + 1] > 0 ? 1 : 0 });

    // ---- B. uniqueness weighting ----
    {
        const spans = rows.map((_, i) => [i, Math.min(i + H - 1, rows.length - 1)]);
        const uw = avgUniqueness(spans);
        const mu = uw.reduce((s, v) => s + v, 0) / uw.length;
        const wn = uw.map((v) => v / mu);
        const X = rows.map((r) => r.x), y = rows.map((r) => r.y);
        const ntr = Math.floor(X.length * 0.7);
        const wU = solveRidgeFull(X.slice(0, ntr), y.slice(0, ntr), LAMBDA);
        const wW = solveRidgeFull(X.slice(0, ntr), y.slice(0, ntr), LAMBDA, wn.slice(0, ntr));
        const lin = (w, x) => clip01(w[0] + w.slice(1).reduce((s, v, j) => s + v * x[j], 0));
        const lU = [], lW = [];
        for (let i = ntr; i < X.length; i++) {
            lU.push((lin(wU, X[i]) - y[i]) ** 2); lW.push((lin(wW, X[i]) - y[i]) ** 2);
        }
        const bU = lU.reduce((s, v) => s + v, 0) / lU.length, bW = lW.reduce((s, v) => s + v, 0) / lW.length;
        let dmW = null;
        try { dmW = dieboldMariano({ lossA: lW, lossB: lU }); } catch (e) { dmW = { error: String(e).slice(0, 80) }; }
        out.unique = { brierUnweighted: +bU.toFixed(5), brierWeighted: +bW.toFixed(5), dmP: dmW && dmW.pValue !== undefined ? +dmW.pValue.toFixed(4) : dmW };
        check('c2b: uniqueness arm scored', true, `unw ${out.unique.brierUnweighted} w ${out.unique.brierWeighted} p ${JSON.stringify(out.unique.dmP).slice(0, 60)}`);
    }

    // ---- C. synthetic ensemble ----
    {
        const M = 5, lr = 0.02, T2 = 2.0, kdScale = 0.2;
        const sig = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
        const mk = (seed) => {
            const r = mulberry32(seed);
            return { w: Array.from({ length: P }, () => (r() - 0.5) * 0.1), b: 0, m: Array.from({ length: P }, () => 0), v: Array.from({ length: P }, () => 0), mb: 0, vb: 0, t: 0 };
        };
        const step = (mem, g, gb, arm) => {
            if (arm === 'adamw') {
                mem.t++;
                const b1 = 0.9, b2 = 0.999, eps = 1e-8, wd = 0.01;
                for (let j = 0; j < P; j++) {
                    mem.m[j] = b1 * mem.m[j] + (1 - b1) * g[j];
                    mem.v[j] = b2 * mem.v[j] + (1 - b2) * g[j] * g[j];
                    const mh = mem.m[j] / (1 - Math.pow(b1, mem.t)), vh = mem.v[j] / (1 - Math.pow(b2, mem.t));
                    mem.w[j] -= lr * (mh / (Math.sqrt(vh) + eps) + wd * mem.w[j]);
                }
                mem.mb = b1 * mem.mb + (1 - b1) * gb; mem.vb = b2 * mem.vb + (1 - b2) * gb * gb;
            } else {
                for (let j = 0; j < P; j++) mem.w[j] -= lr * g[j];
                mem.b -= lr * gb;
            }
        };
        const arms = ['sgd', 'adamw', 'distill-top30', 'distill-uniform', 'laggard'];
        const ens = {};
        for (const a of arms) ens[a] = Array.from({ length: M }, (_, m) => mk(1000 + m));
        const losses = {};
        for (const a of arms) losses[a] = [];
        const ntr = Math.floor(rows.length * 0.7);
        for (let i = 0; i < ntr; i++) {
            const { x, y } = rows[i];
            for (const a of arms) {
                const outs = ens[a].map((mem) => { let s = mem.b; for (let j = 0; j < P; j++) s += mem.w[j] * x[j]; return s; });
                const probs = outs.map(sig);
                const mean = probs.reduce((s, v) => s + v, 0) / M;
                losses[a].push((clip01(mean) - y) ** 2);
                let lrs = ens[a].map(() => 1);
                if (a === 'laggard') {
                    const order = probs.map((p, m) => [Math.abs(p - y), m]).sort((p, q) => p[0] - q[0]).map(([, m]) => m);
                    lrs = ens[a].map(() => 1);
                    order.slice(0, 2).forEach((m) => { lrs[m] = 0.8; });
                    order.slice(2).forEach((m) => { lrs[m] = 1.5; });
                }
                ens[a].forEach((mem, m) => {
                    const e = probs[m] - y;
                    const g = x.map((v) => e * v * lrs[m] / M), gb = e * lrs[m] / M;
                    step(mem, g, gb, a);
                    if (a === 'distill-top30' || a === 'distill-uniform') {
                        const teacher = a === 'distill-uniform' ? 0.5 : (() => {
                            const ord = probs.map((p, k) => [Math.abs(p - y), k]).sort((p, q) => p[0] - q[0]);
                            const top = ord.slice(0, Math.max(1, Math.floor(M * 0.3)));
                            return top.reduce((s, [, k]) => s + probs[k], 0) / top.length;
                        })();
                        const sp = sig(outs[m] / T2), tp = sig(teacher / T2);
                        const kd = (sp - tp) / T2 * kdScale * 0.1;
                        const gk = x.map((v) => kd * v), gkb = kd;
                        step(mem, gk, gkb, 'sgd');
                    }
                });
            }
        }
        // test: frozen members, ensemble-mean Brier on holdout
        const testB = {};
        for (const a of arms) {
            let s = 0, n = 0;
            for (let i = ntr; i < rows.length; i++) {
                const { x, y } = rows[i];
                const ps = ens[a].map((mem) => { let o = mem.b; for (let j = 0; j < P; j++) o += mem.w[j] * x[j]; return sig(o); });
                const mean = ps.reduce((t, v) => t + v, 0) / M;
                s += (clip01(mean) - y) ** 2; n++;
            }
            testB[a] = s / n;
        }
        out.ensemble = Object.fromEntries(Object.entries(testB).map(([k, v]) => [k, +v.toFixed(5)]));
        check('c2c: ensemble arms scored', Object.values(testB).every((v) => v > 0 && v < 1), JSON.stringify(out.ensemble));
    }

    out.pass = checks.every((c) => c.pass);
    out.checks = checks;
    return out;
}
