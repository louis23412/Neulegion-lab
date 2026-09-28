// E84 - W4b OLS audit: does the repo AR fit solve the normal equations?
//
// CYCLE-088. Rounds 50–53 added six W4b helpers pinned only on hand
// fixtures and real data — but the lab's standing rule (CYCLE-044 onward)
// is that a claim is audited against a synthetic ground truth. This
// audits `fitArVolForecast` two independent ways: (a) parameter recovery
// on a synthetic AR(1) with known (c, phi); (b) bit-agreement with an
// independent closed-form OLS solve written from the sum formulas (no
// shared code with the repo's Gauss-Jordan path).
//
// PRE-REGISTERED. PASS iff the fit recovers phi within 0.05 / c within
// 0.15 on n=5000 synthetic bars, matches the independent solve to 1e-9,
// and `predictArVolForecast` equals the linear form exactly. A failure is
// a real bug in the shipped W4b stack. Read-only.

import { fitArVolForecast, predictArVolForecast } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function synthAR1({ n = 5000, c = 0.5, phi = 0.7, sigma = 1, seed = 20260930 }) {
    const rnd = mulberry32(seed);
    const out = new Array(n);
    let y = c / (1 - phi);
    for (let t = 0; t < n; t++) {
        const eps = (rnd() + rnd() + rnd() + rnd() - 2) * sigma;
        y = c + phi * y + eps;
        out[t] = y;
    }
    return out;
}

function closedFormAR1(ys) {
    let n = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (let t = 1; t < ys.length; t++) {
        const x = ys[t - 1];
        const y = ys[t];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        n++; sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    const den = n * sxx - sx * sx;
    const slope = (n * sxy - sx * sy) / den;
    return { intercept: (sy - slope * sx) / n, slope, n };
}

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const ys = synthAR1({});
    check('e84: synthetic AR(1) builds at full length', ys.length === 5000 && ys.every(Number.isFinite), `n=${ys.length}`);
    const fit = fitArVolForecast(ys, { order: 1 });
    check('e84: fit is available on the synthetic series', fit.available === true, fit.available ? `rows=${fit.rows}` : fit.reason);
    check('e84: fit recovers phi within 0.05',
        fit.available && Math.abs(fit.coef[1] - 0.7) < 0.05,
        fit.available ? `phi=${fit.coef[1].toFixed(4)}` : 'n/a');
    check('e84: fit recovers c within 0.15',
        fit.available && Math.abs(fit.coef[0] - 0.5) < 0.15,
        fit.available ? `c=${fit.coef[0].toFixed(4)}` : 'n/a');
    const cf = closedFormAR1(ys);
    check('e84: repo fit matches the independent closed form to 1e-9',
        fit.available && Math.abs(fit.coef[0] - cf.intercept) < 1e-9 && Math.abs(fit.coef[1] - cf.slope) < 1e-9,
        fit.available ? `d0=${Math.abs(fit.coef[0] - cf.intercept).toExponential(1)} d1=${Math.abs(fit.coef[1] - cf.slope).toExponential(1)}` : 'n/a');
    const last = ys[ys.length - 1];
    const p = fit.available ? predictArVolForecast(fit, [last]) : NaN;
    check('e84: prediction equals the linear form exactly',
        fit.available && Math.abs(p - (fit.coef[0] + fit.coef[1] * last)) < 1e-12,
        fit.available ? `p=${p.toFixed(6)}` : 'n/a');
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
