// E108 - feedback-control sizing: the voltarget2603 follow-up.
//
// CYCLE-105. Open-loop vol-targeting scales inversely with a variance forecast
// and suffers turnover/leverage/estimation-error spikes (Devanathan et al.
// 2026, `voltarget2603`); rounds 69-70 shipped the open-loop path
// (`--sleeve-sizing` scalar + `adaptive`). This measures the recorded
// follow-up — CLOSING the loop on trailing drawdown — through the same repo
// composition on the same honest carry book and span. Two feedback sources,
// both strictly-past (causal by construction; proved by a prefix-identity
// check on the real series):
//
//   SELF: the arm's own trailing equity (true feedback — past scales shape
//     the equity the governor reads). The sized book's DD (~3%) never reaches
//     the 5% cap, so this is a PARTIAL governor (g < 1 on most bars, never 0).
//   STRESS: the UNSIZED book's trailing equity (the cash-overlay frame:
//     the overlay reads the risky sleeve, `cashoverlay2606`). Its DD
//     (7.96%) crosses the cap, so the brake and the restart both fire.
//
// Arms (DDCAP = 5%, REENTER = 2.5%, pre-registered from the papers, not the book):
//   self    — smooth g = clamp(1-dd_self/5%) on the adaptive scale (partial).
//   stress  — smooth g = clamp(1-dd_unsized/5%) on the adaptive scale, no restart.
//   restart — stress + the trailing peak restarts at current equity whenever g
//     hits 0 (the data-driven restart, `ddrestart2303`); the stress arm is its
//     no-restart ablation.
//   brake   — hard V-shape crash brake on STRESS equity (`cashoverlay2606`):
//     flat while dd >= 5%, re-enter at dd <= 2.5%, peak never resets —
//     smooth (stress) vs hard (brake) modulation contrast.
// Read-only.

import { loadCarryBook } from './e3_carry.js';
import { SYMBOLS } from '../lib/lab.js';
import { trailingBookVol, adaptiveTargets } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { volTargetRisk } from '../../NeuLegion-master/NeuLegion-master/src/plugins/risk/vol-target.js';

const PERIODS_PER_YEAR = 1095;
const WARMUP = 500;
const WINDOW = 24;
const DD_CAP = 0.05;
const REENTER = 0.025;

function bookStats(rets) {
    const n = rets.length;
    const mean = rets.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
    const eq = [1];
    for (const r of rets) eq.push(eq[eq.length - 1] * (1 + r));
    let peak = eq[0];
    let mdd = 0;
    for (const v of eq) { if (v > peak) peak = v; if (peak > 0) mdd = Math.max(mdd, (peak - v) / peak); }
    return { sharpe: std > 0 ? (mean / std) * Math.sqrt(PERIODS_PER_YEAR) : NaN, maxDrawdown: mdd };
}

// The feedback loop over one aligned span: rets[i] the book return, base[i]
// the open-loop adaptive scale (0 on skipped bars), refEq an equity curve the
// STRESS-sourced arms read (the unsized book's equity, aligned to the span).
// Mode 'self' | 'stress' | 'restart' | 'brake'.
function govern(rets, base, refEq, mode) {
    const n = rets.length;
    const out = new Array(n);
    const gTrace = new Array(n);
    let eq = 1;
    let peak = 1;
    let refPeak = refEq[0];
    let flat = false;
    let restarts = 0;
    let activeBars = 0;
    let zeroBars = 0;
    for (let t = 0; t < n; t++) {
        let g;
        if (mode === 'self') {
            const dd = peak > 0 ? (peak - eq) / peak : 0;
            g = Math.min(1, Math.max(0, 1 - dd / DD_CAP));
        } else if (mode === 'brake') {
            const rv = refEq[t];
            if (rv > refPeak) refPeak = rv;
            const dd = refPeak > 0 ? (refPeak - rv) / refPeak : 0;
            if (!flat && dd >= DD_CAP) flat = true;
            else if (flat && dd <= REENTER) flat = false;
            g = flat ? 0 : 1;
        } else {
            const rv = refEq[t];
            if (rv > refPeak) refPeak = rv;
            const dd = refPeak > 0 ? (refPeak - rv) / refPeak : 0;
            g = Math.min(1, Math.max(0, 1 - dd / DD_CAP));
            if (mode === 'restart' && g === 0) { refPeak = rv; restarts++; }
        }
        gTrace[t] = g;
        if (g < 1) activeBars++;
        if (g === 0) zeroBars++;
        const s = (Number.isFinite(base[t]) ? base[t] : 0) * g;
        const r = Number.isFinite(rets[t]) ? s * rets[t] : 0;
        out[t] = r;
        eq = eq * (1 + r);
        if (eq > peak) peak = eq;
    }
    return { series: out, gTrace, restarts, activeBars, zeroBars };
}

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const book = await loadCarryBook(SYMBOLS);
    const pooled = book && book.pooled ? book.pooled : null;
    check('e108: the honest carry book loads over the full span', Array.isArray(pooled) && pooled.length > 2000, `n=${pooled ? pooled.length : 0}`);
    if (!pooled) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const vols = trailingBookVol(pooled, { window: WINDOW });
    const tgts = adaptiveTargets(vols);
    const rets = [];
    const tvs = [];
    const tgs = [];
    for (let t = WARMUP; t < pooled.length; t++) {
        if (!Number.isFinite(tgts[t]) || !(tgts[t] > 0) || !Number.isFinite(vols[t]) || !(vols[t] > 0)) continue;
        rets.push(pooled[t]);
        tvs.push(vols[t]);
        tgs.push(tgts[t]);
    }
    check('e108: the kept span covers 5000+ bars', rets.length > 5000, `n=${rets.length}`);
    const sized = volTargetRisk.sizingForSleeve(rets, tvs, 'carry-dispersion', tgs);
    check('e108: the repo adaptive path scores', !!sized && sized.available, sized ? `scored=${sized.scored} skipped=${sized.skipped}` : 'n/a');
    if (!sized || !sized.available) {
        const failed = checks.filter((c) => !c.pass);
        return { total: checks.length, failed: failed.length, failures: failed, checks };
    }
    const byIndex = new Map(sized.index.map((bar, i) => [bar, sized.scales[i]]));
    const base = rets.map((_, i) => (byIndex.has(i) ? byIndex.get(i) : 0));
    const u = bookStats(rets);
    const adp = bookStats(sized.scaled);
    check('e108: the adaptive baseline replicates F-117 (DD cut vs unsized)',
        adp.maxDrawdown < u.maxDrawdown && adp.maxDrawdown < 0.04,
        `unsized=${(u.maxDrawdown * 100).toFixed(2)}% adaptive=${(adp.maxDrawdown * 100).toFixed(2)}%`);
    const refEq = [1];
    for (const r of rets) refEq.push(refEq[refEq.length - 1] * (1 + (Number.isFinite(r) ? r : 0)));
    const ref = refEq.slice(0, rets.length);
    const modes = ['self', 'stress', 'restart', 'brake'];
    const arms = {};
    for (const mode of modes) arms[mode] = govern(rets, base, ref, mode);
    const stats = {};
    for (const mode of modes) stats[mode] = bookStats(arms[mode].series);
    const prefixOk = modes.every((mode) => {
        const half = Math.floor(rets.length / 2);
        const pre = govern(rets.slice(0, half), base.slice(0, half), ref.slice(0, half), mode);
        return pre.gTrace.every((g, t) => g === arms[mode].gTrace[t]) &&
            pre.series.every((r, t) => r === arms[mode].series[t]);
    });
    check('e108: every governor is causal on the real series (half-prefix identity)', prefixOk);
    const trace = modes.map((m) => `${m}:active=${arms[m].activeBars},zero=${arms[m].zeroBars},restarts=${arms[m].restarts}`).join(' ');
    check('e108: the stress-sourced governors bind (non-vacuous)', arms.stress.activeBars > 0 && arms.brake.zeroBars > 0, trace);
    check('e108: the restart fires on the stress equity (restart isolated)', arms.restart.restarts > 0, trace);
    const half = Math.floor(rets.length / 2);
    const arm = {};
    for (const mode of modes) {
        arm[mode] = {
            sharpe: stats[mode].sharpe, maxDrawdown: stats[mode].maxDrawdown,
            activeBars: arms[mode].activeBars, zeroBars: arms[mode].zeroBars, restarts: arms[mode].restarts,
            firstDD: bookStats(arms[mode].series.slice(0, half)).maxDrawdown,
            secondDD: bookStats(arms[mode].series.slice(half)).maxDrawdown,
        };
    }
    const failed = checks.filter((c) => !c.pass);
    return {
        total: checks.length, failed: failed.length, failures: failed, checks,
        unsized: { sharpe: u.sharpe, maxDrawdown: u.maxDrawdown },
        adaptive: { sharpe: adp.sharpe, maxDrawdown: adp.maxDrawdown },
        arms: arm,
    };
}
