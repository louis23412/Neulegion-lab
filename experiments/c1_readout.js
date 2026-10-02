// C1 readout A/B/C — does position aggregation matter? (CYCLE-197 DESIGN+EXEC, pre-CYCLE-198 verdict).
// Standalone: NOT in run_all.js. Read-only. Minutes via the harness.
//
// DESIGN (director, CYCLE-193/194/196). SAME panel/target/folds/probe as M1
// phase-1 (8 majors, 1h→8h log returns, P=16 lookback, 6 blocks, expanding
// train, repo forecast/scoring.js Brier+DM+MCS). ONLY the position
// aggregation differs; every arm predicts through the SAME 1-feature ridge
// probe fit on train (L10-bl avoidance: own intercept):
//   base      train prior (control)
//   meanpool  ridge on mean(x) — the repo's current head behaviour (control)
//   lastpos   ridge on x[P-1] — the ordered-head candidate
//   learned   ridge on softmax(v)·x, v fit on train by GD on Brier
//   flatridge ridge on full x — M1 reference (calibration, expect ≈0.24906)
// RULE (pre-registered): last/learned beats meanpool on Brier with DM p<0.05
// AND MCS keeps it while dropping meanpool → ORDER MATTERS → C1b repo edit
// implements the winner. None beats base (MCS keeps base alone) → TARGET
// constraint → close C1, proceed C2. learned<=meanpool is a result (per
// 2610.01831), not a failure — record and implement the best ordered form.
import { buildPanel, SYMBOLS } from '../lib/lab.js';
import { brierScore, dieboldMariano, modelConfidenceSet } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast/scoring.js';

const MAJ8 = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'dogeusdt', 'linkusdt'];
const P = 16, BLOCKS = 6, LAMBDA = 1.0;

const clip01 = (x) => (x < 0.01 ? 0.01 : x > 0.99 ? 0.99 : x);

function solveRidge1(xs, y, lam) {
    let s1 = 0, sx = 0, sxx = 0, sy = 0, sxy = 0;
    const n = xs.length;
    for (let i = 0; i < n; i++) { const x = xs[i], t = y[i]; s1 += 1; sx += x; sxx += x * x; sy += t; sxy += x * t; }
    const A00 = s1 + 1e-9, A01 = sx, A11 = sxx + lam;
    const det = A00 * A11 - A01 * A01;
    const b = (A11 * sy - A01 * sxy) / det;
    const w = (-A01 * sy + A00 * sxy) / det;
    return [b, w];
}

function solveRidgeFull(X, y, lam) {
    const n = X.length, p = X[0].length;
    const A = Array.from({ length: p + 1 }, () => new Array(p + 1).fill(0));
    const b = new Array(p + 1).fill(0);
    for (let i = 0; i < n; i++) {
        const xi = [1, ...X[i]];
        for (let a = 0; a <= p; a++) {
            b[a] += xi[a] * y[i];
            for (let c = 0; c <= p; c++) A[a][c] += xi[a] * xi[c];
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

function fitPoolWeights(X, y) {
    let v = new Array(P).fill(0);
    const lr = 0.5, steps = 200;
    for (let s = 0; s < steps; s++) {
        const g = new Array(P).fill(0);
        for (let i = 0; i < X.length; i++) {
            let mx = -Infinity;
            for (let j = 0; j < P; j++) if (v[j] > mx) mx = v[j];
            let se = 0;
            for (let j = 0; j < P; j++) se += Math.exp(v[j] - mx);
            let pool = 0;
            const w = new Array(P);
            for (let j = 0; j < P; j++) { w[j] = Math.exp(v[j] - mx) / se; pool += w[j] * X[i][j]; }
            const p = clip01(pool * 0.5 + 0.5);
            const e = (p - y[i]) / (X.length * 4);
            for (let j = 0; j < P; j++) g[j] += e * (X[i][j] - pool) * w[j];
        }
        for (let j = 0; j < P; j++) v[j] -= lr * g[j];
    }
    let mx = -Infinity;
    for (let j = 0; j < P; j++) if (v[j] > mx) mx = v[j];
    let se = 0;
    for (let j = 0; j < P; j++) se += Math.exp(v[j] - mx);
    return v.map((x) => Math.exp(x - mx) / se);
}

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });
    const syms = SYMBOLS.filter((s) => MAJ8.includes(s.toLowerCase()));
    const panel = await buildPanel({ symbols: syms, tf: '1h' });
    const rets = panel.map((series) => {
        const closes = series.closes.filter(Number.isFinite);
        const out = [];
        for (let t = 47; t < closes.length; t += 8) {
            const c0 = closes[t - 8], c1 = closes[t];
            if (c0 > 0 && c1 > 0) out.push(Math.log(c1 / c0));
        }
        return out;
    });
    const T = Math.min(...rets.map((r) => r.length));
    check('c1: panel loads, all 8 majors, T>2000 8h bars', syms.length === 8 && T > 2000, `syms ${syms.length} T ${T}`);
    const rows = [];
    for (let j = 0; j < 8; j++) for (let t = P; t < T - 1; t++) rows.push({ x: rets[j].slice(t - P, t), y: rets[j][t + 1] > 0 ? 1 : 0 });
    const B = Math.floor(rows.length / BLOCKS);
    const armLoss = { base: [], meanpool: [], lastpos: [], learned: [], flatridge: [] };
    const wLearnedLast = [];
    for (let blk = 0; blk < BLOCKS; blk++) {
        const te = rows.slice(blk * B, (blk + 1) * B);
        const tr = rows.slice(0, blk * B + Math.floor(B / 2));
        if (tr.length < 500) continue;
        const prior = tr.reduce((s, r) => s + r.y, 0) / tr.length;
        const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
        const trMean = tr.map((r) => mean(r.x)), trLast = tr.map((r) => r.x[P - 1]);
        const w = fitPoolWeights(tr.map((r) => r.x), tr.map((r) => r.y));
        if (blk === BLOCKS - 1) wLearnedLast.push(...w.map((v) => +v.toFixed(4)));
        const trPool = tr.map((r) => r.x.reduce((s, v, j) => s + w[j] * v, 0));
        const X = tr.map((r) => r.x), y = tr.map((r) => r.y);
        const [bM, wM] = solveRidge1(trMean, y, LAMBDA);
        const [bL, wL] = solveRidge1(trLast, y, LAMBDA);
        const [bP, wP] = solveRidge1(trPool, y, LAMBDA);
        const wF = solveRidgeFull(X, y, LAMBDA);
        for (const r of te) {
            const m = mean(r.x), l = r.x[P - 1], pl = r.x.reduce((s, v, j) => s + w[j] * v, 0);
            const probs = {
                base: clip01(prior),
                meanpool: clip01(bM + wM * m),
                lastpos: clip01(bL + wL * l),
                learned: clip01(bP + wP * pl),
                flatridge: clip01(wF[0] + wF.slice(1).reduce((s, v, j) => s + v * r.x[j], 0)),
            };
            for (const k of Object.keys(probs)) armLoss[k].push((probs[k] - r.y) ** 2);
        }
    }
    check('c1: all arms scored', Object.values(armLoss).every((a) => a.length > 1000), Object.entries(armLoss).map(([k, a]) => `${k}:${a.length}`).join(' '));
    const brier = {};
    for (const k of Object.keys(armLoss)) brier[k] = armLoss[k].reduce((s, v) => s + v, 0) / armLoss[k].length;
    const dm = {};
    for (const [a, bb] of [['meanpool', 'base'], ['lastpos', 'base'], ['learned', 'base'], ['lastpos', 'meanpool'], ['learned', 'meanpool'], ['flatridge', 'base']]) {
        try { dm[`${a}_vs_${bb}`] = dieboldMariano({ lossA: armLoss[a], lossB: armLoss[bb] }); }
        catch (e) { dm[`${a}_vs_${bb}`] = { error: String(e).slice(0, 120) }; }
    }
    let mcs = null;
    try { mcs = modelConfidenceSet({ losses: Object.keys(armLoss).map((k) => armLoss[k]), ids: Object.keys(armLoss) }); }
    catch (e) { mcs = { error: String(e).slice(0, 120) }; }
    const rB = (v) => (typeof v === 'number' ? +v.toFixed(5) : v);
    return {
        pass: checks.every((c) => c.pass), checks, n: rows.length, T8h: T,
        brier: Object.fromEntries(Object.entries(brier).map(([k, v]) => [k, rB(v)])),
        brierSkillVsBase: Object.fromEntries(Object.keys(armLoss).filter((k) => k !== 'base').map((k) => [k, rB(1 - brier[k] / brier.base)])),
        dm, mcs, learnedWeightsLastBlock: wLearnedLast,
    };
}
