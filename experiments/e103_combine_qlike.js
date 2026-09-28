// E103 - W4c-yq second opinion: does the seven-way ranking survive QLIKE?
//
// CYCLE-099. F-111 ranked OLS-combination first under MSE-skill; Patton
// (2011) shows MSE can mis-rank vol forecasts when the proxy is noisy, and
// QLIKE is the robust second skill (already the repo's `volForecastQlike`).
// This drives the repo seven-way tournament's QLIKE block (same weight-train
// / weight-test split, scored on the all-positive intersection so every arm
// reads the same bars) across splits on close-close realized vol for every 1h
// stream.
//
// PRE-REGISTERED. PASS iff the QLIKE block is available on all 8 streams.
// Per-stream QLIKE winners and the OLS-vs-HAR QLIKE margin sign are recorded
// with ANY sign: agreement with MSE promotes the ranking to skill-robust;
// disagreement keeps MSE's ranking provisional and says which skill moves it.
// Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentCombineVolForecastAcrossSplits, tournamentCombineVolPanel } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

const SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7];
const WINDOW = 24;
const HAR = { daily: 1, weekly: 5, monthly: 22 };
const LASSO = { l1: 0.01, iters: 50 };

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e103: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const byStream = {};
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const id = (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, '');
        byStream[id] = realizedVolatility(barReturns(s.close), WINDOW);
    }
    const per = {};
    for (const [id, vols] of Object.entries(byStream)) {
        per[id] = tournamentCombineVolForecastAcrossSplits(vols, { splits: SPLITS, har: HAR, lasso: LASSO });
    }
    check('e103: the tournament is available on every stream',
        Object.values(per).every((t) => t.available),
        Object.entries(per).map(([id, t]) => `${id}:${t.available ? 'ok' : t.reason}`).join(' '));
    const qAvail = {};
    for (const [id, t] of Object.entries(per)) {
        qAvail[id] = t.available ? t.perSplit.filter((p) => p.qlikeWinner !== null).length : -1;
    }
    check('e103: the QLIKE block is decided on all 5 splits of every stream',
        Object.values(qAvail).every((n) => n === 5),
        Object.entries(qAvail).map(([id, n]) => `${id}=${n}/5`).join(' '));
    const winners = {};
    const margins = [];
    for (const [id, t] of Object.entries(per)) {
        if (!t.available) continue;
        const w = {};
        let m = 0;
        let n = 0;
        for (const p of t.perSplit) {
            if (p.qlikeWinner === null || !p.qlikeSkills) continue;
            w[p.qlikeWinner] = (w[p.qlikeWinner] || 0) + 1;
            const best = Math.max(p.qlikeSkills.eq, p.qlikeSkills.inv, p.qlikeSkills.ols, p.qlikeSkills.lasso);
            m += best - p.qlikeSkills.har;
            n++;
        }
        winners[id] = w;
        margins.push(n ? m / n : NaN);
    }
    check('e103: every stream names a per-split QLIKE winner',
        Object.values(winners).every((w) => Object.values(w).reduce((a, b) => a + b, 0) === 5),
        Object.entries(winners).map(([id, w]) => `${id}={${Object.entries(w).map(([k, v]) => `${k}${v}`).join(',')}}`).join(' '));
    check('e103: the mean best-combine QLIKE margin over HAR is recorded on every stream (any sign)',
        margins.length === 8 && margins.every((m) => Number.isFinite(m)),
        `margins=${margins.map((m) => m.toFixed(4)).join(',')}`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
