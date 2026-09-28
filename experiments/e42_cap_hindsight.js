// E42 - IS R8'S CAP RULE REMOVABLE TOO? FROZEN (λ, CAP) VS THE JOINT WALK-FORWARD. CYCLE-033 (tests F-39, F-49).
//
// F-48/F-49 (CYCLE-031/032) removed R8's fitted λ rule: a λ frozen on >= ~2.3 y of trailing data matches the
// λ-only walk-forward out of sample, and the rule's value is confined to the first ~2 y. That leaves ONE
// fitted object in the R8 port spec: the **cap**. F-39/e31 reached "port-ready" with a JOINT (λ, cap)
// walk-forward over a 40-book grid, but e31's stored picks are telling: it selects cap=null through
// 2021-2023 and cap=0.1 from 2024 on, and never the pinned 0.125 — while the *best pinned* book
// (λ=0.02, cap=0.125) reads OOS net@4 6.86, ABOVE the joint walk-forward's 6.13. Same pattern as F-48/F-49:
// the rule beats the *broken* F-24 spec, not a well-chosen pinned one.
//
// This experiment asks whether R8's ENTIRE spec can be made fitted-object-free:
//
//   A. FROZEN combined (λ, cap): pick the pair once on [0, S), freeze, score [S, end) — vs the joint
//      walk-forward and vs the pinned books on the SAME span.
//   B. FROZEN λ with the cap FIXED at the structural 1/k = 0.125: pick λ once on [0, S) inside the capped
//      family, freeze. (The cap = 1/k is F-27's equal-weight choice, not a tuned value.)
//   C. FROZEN cap with λ fixed at 0.02.
//   D. CAP SENSITIVITY at the frozen λ: OOS / recent / turnover across the cap grid, and whether the cap
//      binds — is 0.125 a knife-edge or a plateau?
//
// FALSIFIER / read (pre-registered). The cap rule EARNS ITS KEEP if the joint (λ, cap) walk-forward beats the
// best pinned single book on the shared OOS span. Otherwise the cap (and λ) should be pinned/frozen: R8 has
// no fitted-object rule left. Freezing the *joint* spec is only usable if a frozen (λ, cap) chosen on
// >= ~2.3 y matches the walk-forward OOS.
//
// GUARDS. Reproduces e31 exactly (joint WF OOS 6.13; pinned λ=0.02/no-cap 6.63, λ=0.02/cap0.125 6.86,
// λ=0.1/cap0.125 1.93) — the same construction, absolute 0.01 (L10-z). The pinned λ=0.02/no-cap book is
// e40's own pinned comparator (6.63), so this also re-checks the F-48/F-49 line.

import { SYMBOLS } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const LAMBDAS = [0.005, 0.0075, 0.01, 0.015, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15];
const CAPS = [null, 0.1, 0.125, 0.15];
const LOOKBACK = 1095, BLOCK = 365;
const KCAP = 0.125; // 1/k for k = 8 — the structural cap, F-27.

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const applyCap = (rows, cap) => (cap == null ? rows : rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x))));
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const key = (c) => `${c.lam}${c.cap ? '+cap' + c.cap : ''}`;

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const legs = s.legs;
    const n = legs.times.length - 1;
    const bookTimes = legs.times.slice(1);
    const pnlOf = (rows) => rows.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * ((Number.isFinite(bp[j]) ? bp[j] : 0) + (Number.isFinite(fr[j]) ? fr[j] : 0)), 0); });

    // ---- the 40-book (λ, cap) grid ----
    const combos = [];
    for (const lam of LAMBDAS) {
        const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: lam, normalize: true } });
        for (const cap of CAPS) {
            const rows = applyCap(built.weightRows, cap);
            const rets = pnlOf(rows);
            const T = turnoverSeries(rows);
            combos.push({ lam, cap, rets, T, net4: rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i]) });
        }
    }
    const at = (lam, cap) => combos.find((c) => c.lam === lam && (c.cap === cap));

    const blockStarts = []; { let r = LOOKBACK; while (r + BLOCK <= n) { blockStarts.push(r); r += BLOCK; } }
    const end = blockStarts[blockStarts.length - 1] + BLOCK;
    const oosStart = LOOKBACK;

    // ---- joint (λ, cap) walk-forward (e31 construction) ----
    const jointWF = (() => {
        const net = [], gross = [], turn = [], picks = [];
        for (const r of blockStarts) {
            let best = null;
            for (const c of combos) { const sc = sharpe(c.net4.slice(r - LOOKBACK, r)); if (!Number.isFinite(sc)) continue; if (!best || sc > best.sc) best = { c, sc }; }
            if (!best) break;
            for (let t = r; t < r + BLOCK; t++) { net.push(best.c.net4[t]); gross.push(best.c.rets[t]); turn.push(best.c.T[t]); }
            picks.push({ at: new Date(bookTimes[r]).toISOString().slice(0, 10), key: key(best.c), trailingNet4: r2(best.sc) });
        }
        return { net, gross, turn, picks };
    })();
    const jointWfOos = r2(sharpe(jointWF.net));

    // ---- frozen / pinned helpers on a test tail [S, end) ----
    const testTail = (series, S) => { const out = []; for (let t = S; t < end; t++) out.push(series[t]); return out; };
    const sc = (arr) => r2(sharpe(arr));
    const splits = [1095, 1825, 2555, 3285, 4380].filter((S) => S < end);

    const frozenJoint = splits.map((S) => {
        const pick = combos.map((c) => ({ c, tr: sharpe(c.net4.slice(0, S)) })).filter((x) => Number.isFinite(x.tr)).reduce((a, b) => (b.tr > a.tr ? b : a));
        return { S, periods: end - S, pick: key(pick.c), frozenNet4: sc(testTail(pick.c.net4, S)), jointWfNet4: sc(jointWF.net.slice(((S - LOOKBACK) / BLOCK) * BLOCK)), pin02cap125: sc(testTail(at(0.02, KCAP).net4, S)), pin02plain: sc(testTail(at(0.02, null).net4, S)) };
    });
    const frozenLambdaCapFixed = splits.map((S) => {
        const capped = combos.filter((c) => c.cap === KCAP);
        const pick = capped.map((c) => ({ c, tr: sharpe(c.net4.slice(0, S)) })).filter((x) => Number.isFinite(x.tr)).reduce((a, b) => (b.tr > a.tr ? b : a));
        return { S, pick: key(pick.c), frozenNet4: sc(testTail(pick.c.net4, S)), jointWfNet4: sc(jointWF.net.slice(((S - LOOKBACK) / BLOCK) * BLOCK)) };
    });
    const frozenCapLambdaFixed = splits.map((S) => {
        const lam02 = combos.filter((c) => c.lam === 0.02);
        const pick = lam02.map((c) => ({ c, tr: sharpe(c.net4.slice(0, S)) })).filter((x) => Number.isFinite(x.tr)).reduce((a, b) => (b.tr > a.tr ? b : a));
        return { S, pick: key(pick.c), frozenNet4: sc(testTail(pick.c.net4, S)), jointWfNet4: sc(jointWF.net.slice(((S - LOOKBACK) / BLOCK) * BLOCK)) };
    });

    // ---- cap sensitivity at λ=0.02 on the full OOS span ----
    const rec = 2 * PPY;
    const capSensitivity = CAPS.map((cap) => { const c = at(0.02, cap); const oos = testTail(c.net4, oosStart); return { cap, oosNet4: sc(oos), recent24mNet4: sc(oos.slice(oos.length - rec)), turnoverAnnual: +(mean(c.T.slice(oosStart, end)) * PPY).toFixed(0) }; });
    // does the cap bind at λ=0.02? fraction of (period, symbol) weight entries clipped.
    const capBinds = (() => { const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: 0.02, normalize: true } }); let tot = 0, clipped = 0, maxAbs = 0; for (const row of built.weightRows) for (const x of row) { tot++; if (Math.abs(x) > maxAbs) maxAbs = Math.abs(x); if (Math.abs(x) > KCAP) clipped++; } return { clippedFrac: +(clipped / tot).toFixed(3), maxAbsWeight: +maxAbs.toFixed(3) }; })();

    // ---- guards ----
    let e31 = null;
    try { e31 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e31_ported_spec_oos.json')); } catch (e) { e31 = null; }
    const abs = (a, b) => (a != null && b != null ? Math.abs(a - b) : null);
    const here02plain = sc(testTail(at(0.02, null).net4, oosStart));
    const here02cap125 = sc(testTail(at(0.02, KCAP).net4, oosStart));
    const here01cap125 = sc(testTail(at(0.1, KCAP).net4, oosStart));
    const checks = {
        e31JointWf: e31 ? e31.verdict.walkForwardOosNet4 : null, hereJointWf: jointWfOos, jointWfAbsDiff: r2(abs(jointWfOos, e31 ? e31.verdict.walkForwardOosNet4 : null)),
        e31Pin02plain: e31 && e31.pinned['lam0.02_plain'] ? e31.pinned['lam0.02_plain'].oosNet4Sharpe : null, here02plain, diff02plain: r2(abs(here02plain, e31 && e31.pinned['lam0.02_plain'] ? e31.pinned['lam0.02_plain'].oosNet4Sharpe : null)),
        e31Pin02cap125: e31 && e31.pinned['lam0.02_cap12.5'] ? e31.pinned['lam0.02_cap12.5'].oosNet4Sharpe : null, here02cap125, diff02cap125: r2(abs(here02cap125, e31 && e31.pinned['lam0.02_cap12.5'] ? e31.pinned['lam0.02_cap12.5'].oosNet4Sharpe : null)),
        e31Pin01cap125: e31 && e31.pinned['lam0.1_cap12.5'] ? e31.pinned['lam0.1_cap12.5'].oosNet4Sharpe : null, here01cap125, diff01cap125: r2(abs(here01cap125, e31 && e31.pinned['lam0.1_cap12.5'] ? e31.pinned['lam0.1_cap12.5'].oosNet4Sharpe : null)),
        note: 'Rebuild must reproduce e31 (joint WF 6.13; pinned 0.02 6.63 / 0.02+cap 6.86 / 0.1+cap 1.93) — same construction, absolute 0.01 (L10-z).',
    };
    checks.matches = ['jointWfAbsDiff', 'diff02plain', 'diff02cap125', 'diff01cap125'].every((k2) => checks[k2] != null && checks[k2] < 0.01);

    // ---- verdict ----
    const bestPinnedOos = Math.max(here02plain, here02cap125, here01cap125);
    const late = frozenJoint.filter((x) => x.S >= 2555);
    const verdict = {
        note: 'The cap rule EARNS its keep only if the joint (λ, cap) walk-forward beats the best pinned single book OOS. Otherwise the spec should be pinned/frozen.',
        oosSpan: { start: oosStart, end, span: end - oosStart },
        jointWfOos, bestPinnedOos, pinned02cap125Oos: here02cap125, pinned02plainOos: here02plain,
        jointWfBeatsBestPinned: jointWfOos > bestPinnedOos,
        jointWfRecent24m: sc(jointWF.net.slice(jointWF.net.length - rec)),
        frozenJointLateMatchesWf: late.length > 0 && late.every((x) => x.frozenNet4 >= x.jointWfNet4 - 0.2),
        frozenJointPicks: frozenJoint.map((x) => ({ S: x.S, pick: x.pick, frozenNet4: x.frozenNet4, jointWfNet4: x.jointWfNet4 })),
        frozenLambdaCapFixedPicks: frozenLambdaCapFixed.map((x) => ({ S: x.S, pick: x.pick, frozenNet4: x.frozenNet4 })),
        frozenCapLambdaFixedPicks: frozenCapLambdaFixed.map((x) => ({ S: x.S, pick: x.pick, frozenNet4: x.frozenNet4 })),
        jointWfPickFreq: (() => { const f = {}; for (const p of jointWF.picks) f[p.key] = (f[p.key] || 0) + 1; return f; })(),
        capBinds,
        validationPass: checks.matches,
    };
    verdict.entireSpecFreezable = !verdict.jointWfBeatsBestPinned && verdict.frozenJointLateMatchesWf;

    return {
        config: { symbols: k, periods: n, lookback: LOOKBACK, block: BLOCK, feeBps: FEE_BPS, kcap: KCAP, lambdas: LAMBDAS, caps: CAPS, oosSpan: { start: oosStart, end, span: end - oosStart } },
        checks,
        jointWalkForward: { oosNet4: jointWfOos, recent24mNet4: sc(jointWF.net.slice(jointWF.net.length - rec)), picks: jointWF.picks },
        frozenJoint,
        frozenLambdaCapFixed,
        frozenCapLambdaFixed,
        capSensitivity,
        verdict,
    };
}
