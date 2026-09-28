// E43 - IS R7 (THE FADE) ALSO A PINNED SPEC? THE F-48/49/50 CHAIN ON THE FADE. CYCLE-034 (tests F-40; extends F-48/F-49/F-50).
//
// R8 is now a fully pinned book (F-48/F-49/F-50: λ frozen on >=2 y + cap = 1/k, no walk-forward). R7 — the
// L18 toptrader fade — is the lab's other port spec. F-40 already found that the fade's walk-forward rule
// is *worse* than pinning (+0.70 vs +0.94 OOS; e32), which is exactly the F-48/F-49 pattern, but it left
// the same two questions F-48/F-49 asked of R8: (i) does the *cap* rule add anything, and (ii) is the λ
// choice even load-bearing (the fade's λ surface is far flatter than the carry book's)?
//
// Rebuilds e32's fade (λ, cap) grid exactly (guarding e32's stored pinned + walk-forward numbers), then:
//   A. joint (λ, cap) walk-forward vs the pinned books, on the shared OOS span.
//   B. FROZEN-λ ladder: pick λ once on [0, S) (cap fixed at 1/k, and separately cap = null), freeze, score.
//   C. λ-FLATNESS: the fade's OOS net@4 across λ at cap=1/k and no-cap — is λ load-bearing at all?
//   D. CAP sensitivity at the fade's pinned λ.
//
// FALSIFIER / read (pre-registered). The fade is rule-free if the joint (λ, cap) walk-forward does NOT beat
// the best pinned book (the F-40/F-50 pattern), and a frozen λ chosen on >= ~2 y is within 0.2 Sharpe of the
// walk-forward (or above it). If instead the walk-forward wins, the fade needs its rule.
//
// GUARDS. Reproduces e32 exactly (joint WF OOS 0.70; pinned ewma0.1 0.94, ewma0.1+cap 1.11,
// ewma0.05+cap 1.14, ewma0.02 0.69, ewma0.02+cap 1.03) — absolute 0.01.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildMasked } from './e22_toptrader_validate.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const NEXT = 2;
const LOOKBACK = 1095, BLOCK = 365;
const KC = 0.125;

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const applyCap = (rows, cap) => (cap == null ? rows : rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x))));
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const key = (c) => `lam${c.lam}${c.cap ? '+cap' + c.cap : ''}`;

const LAMBDAS = [0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.25, 0.5];
const CAPS = [null, 0.125];

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList;
    const k = names.length;
    const times = s.times;
    const n = times.length;
    const legs = s.legs;
    const oi = await loadOpenInterest();
    const topLS = names.map((nm) => { const o = oi[nm]; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.topLS[idx] : null; } return arr; });
    let firstTop = -1;
    for (let i = 1; i < n - 2; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(topLS[j][i])) all = false; if (all) { firstTop = i; break; } }

    const combos = [];
    for (const lam of LAMBDAS) {
        for (const cap of CAPS) {
            const b = buildMasked(topLS, k, legs, times, { sign: -1, from: firstTop, policy: { kind: 'ewma', lambda: lam, normalize: true } });
            const weightRows = applyCap(b.weightRows, cap);
            const rets = cap == null ? b.rets : weightRows.map((w, t) => { const sr = legs.spotRet[firstTop + t + NEXT]; return w.reduce((a, x, j) => a + x * (sr && Number.isFinite(sr[j]) ? sr[j] : 0), 0); });
            const T = turnoverSeries(weightRows);
            combos.push({ lam, cap, rets, T, net4: rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i]), bookTimes: b.bookTimes });
        }
    }
    const P = combos[0].rets.length;
    const find = (lam, cap) => combos.find((c) => c.lam === lam && c.cap === cap);

    const blockStarts = []; { let r = LOOKBACK; while (r + BLOCK <= P) { blockStarts.push(r); r += BLOCK; } }
    const end = blockStarts[blockStarts.length - 1] + BLOCK;
    const oosStart = LOOKBACK;

    // joint (λ, cap) walk-forward (e32 construction)
    const jointWF = (() => {
        const net = [], picks = [];
        for (const r of blockStarts) {
            let best = null;
            for (const c of combos) { const sc = sharpe(c.net4.slice(r - LOOKBACK, r)); if (!Number.isFinite(sc)) continue; if (!best || sc > best.sc) best = { c, sc }; }
            if (!best) break;
            for (let t = r; t < r + BLOCK; t++) net.push(best.c.net4[t]);
            picks.push({ at: new Date(combos[0].bookTimes[r]).toISOString().slice(0, 10), key: key(best.c), trailingNet4: r2(best.sc) });
        }
        return { net, picks };
    })();

    const testTail = (series, S) => { const out = []; for (let t = S; t < end; t++) out.push(series[t]); return out; };
    const sc = (arr) => r2(sharpe(arr));
    const pm = (c, S) => sc(testTail(c.net4, S));
    const wfSlice = (S) => sc(jointWF.net.slice(((S - LOOKBACK) / BLOCK) * BLOCK));

    const splits = [1095, 1825, 2555, 3285, 4380].filter((S) => S < end);
    const frozenCapFixed = splits.map((S) => { const cand = combos.filter((c) => c.cap === KC); const pick = cand.map((c) => ({ c, tr: sharpe(c.net4.slice(0, S)) })).filter((x) => Number.isFinite(x.tr)).reduce((a, b) => (b.tr > a.tr ? b : a)); return { S, pick: key(pick.c), frozenNet4: pm(pick.c, S), jointWfNet4: wfSlice(S), pin01cap: pm(find(0.1, KC), S) }; });
    const frozenNoCap = splits.map((S) => { const cand = combos.filter((c) => c.cap == null); const pick = cand.map((c) => ({ c, tr: sharpe(c.net4.slice(0, S)) })).filter((x) => Number.isFinite(x.tr)).reduce((a, b) => (b.tr > a.tr ? b : a)); return { S, pick: key(pick.c), frozenNet4: pm(pick.c, S), jointWfNet4: wfSlice(S) }; });
    const frozenJoint = splits.map((S) => { const pick = combos.map((c) => ({ c, tr: sharpe(c.net4.slice(0, S)) })).filter((x) => Number.isFinite(x.tr)).reduce((a, b) => (b.tr > a.tr ? b : a)); return { S, pick: key(pick.c), frozenNet4: pm(pick.c, S), jointWfNet4: wfSlice(S) }; });

    // λ-flatness + cap sensitivity at the fade's pinned λ
    const lamFlatCap = LAMBDAS.map((lam) => ({ lam, oosNet4: pm(find(lam, KC), oosStart), recent24mNet4: sc(find(lam, KC).net4.slice(end - 2 * PPY, end)), turnoverAnnual: +(mean(find(lam, KC).T.slice(oosStart, end)) * PPY).toFixed(0) }));
    const lamFlatNoCap = LAMBDAS.map((lam) => ({ lam, oosNet4: pm(find(lam, null), oosStart), recent24mNet4: sc(find(lam, null).net4.slice(end - 2 * PPY, end)), turnoverAnnual: +(mean(find(lam, null).T.slice(oosStart, end)) * PPY).toFixed(0) }));
    const capSens = CAPS.map((cap) => ({ cap, oosNet4: pm(find(0.1, cap), oosStart), recent24mNet4: sc(find(0.1, cap).net4.slice(end - 2 * PPY, end)), turnoverAnnual: +(mean(find(0.1, cap).T.slice(oosStart, end)) * PPY).toFixed(0) }));

    // guards vs e32
    let e32 = null;
    try { e32 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e32_fade_retune.json')); } catch (e) { e32 = null; }
    const abs = (a, b) => (a != null && b != null ? Math.abs(a - b) : null);
    const e32p = e32 ? e32.pinned : null;
    const here = { ewma01: pm(find(0.1, null), oosStart), ewma01cap: pm(find(0.1, KC), oosStart), ewma005cap: pm(find(0.05, KC), oosStart), ewma002: pm(find(0.02, null), oosStart), ewma002cap: pm(find(0.02, KC), oosStart) };
    const checks = {
        e32JointWf: e32 ? e32.verdict.walkForwardOosNet4 : null, hereJointWf: sc(jointWF.net), jointWfAbsDiff: r2(abs(sc(jointWF.net), e32 ? e32.verdict.walkForwardOosNet4 : null)),
        e32Ewma01: e32p ? e32p['ewma0.1_spec'].oosNet4 : null, hereEwma01: here.ewma01, dEwma01: r2(abs(here.ewma01, e32p ? e32p['ewma0.1_spec'].oosNet4 : null)),
        e32Ewma005cap: e32p ? e32p['ewma0.05_cap12.5'].oosNet4 : null, hereEwma005cap: here.ewma005cap, dEwma005cap: r2(abs(here.ewma005cap, e32p ? e32p['ewma0.05_cap12.5'].oosNet4 : null)),
        e32Ewma01cap: e32p ? e32p['ewma0.1_cap12.5'].oosNet4 : null, hereEwma01cap: here.ewma01cap, dEwma01cap: r2(abs(here.ewma01cap, e32p ? e32p['ewma0.1_cap12.5'].oosNet4 : null)),
        note: 'Rebuild must reproduce e32 (joint WF 0.70; pinned ewma0.1 0.94, +cap 1.11, ewma0.05+cap 1.14) — same construction, absolute 0.01.',
    };
    checks.matches = ['jointWfAbsDiff', 'dEwma01', 'dEwma005cap', 'dEwma01cap'].every((x) => checks[x] != null && checks[x] < 0.01);

    const bestPinnedOos = Math.max(here.ewma01, here.ewma01cap, here.ewma005cap, here.ewma002, here.ewma002cap);
    const late = frozenCapFixed.filter((x) => x.S >= 2555);
    const verdict = {
        note: 'The fade is rule-free if the joint (λ, cap) walk-forward does not beat the best pinned book AND a frozen λ on >=2 y is within 0.2 of the walk-forward.',
        oosSpan: { start: oosStart, end, span: end - oosStart },
        jointWfOos: sc(jointWF.net), bestPinnedOos,
        jointWfBeatsBestPinned: sc(jointWF.net) > bestPinnedOos,
        pinned01Oos: here.ewma01, pinnedBest: bestPinnedOos,
        frozenCapFixedLateMatchesWf: late.length > 0 && late.every((x) => x.frozenNet4 >= x.jointWfNet4 - 0.2),
        frozenCapFixedPicks: frozenCapFixed.map((x) => ({ S: x.S, pick: x.pick, frozenNet4: x.frozenNet4, jointWfNet4: x.jointWfNet4 })),
        frozenNoCapPicks: frozenNoCap.map((x) => ({ S: x.S, pick: x.pick, frozenNet4: x.frozenNet4, jointWfNet4: x.jointWfNet4 })),
        frozenJointPicks: frozenJoint.map((x) => ({ S: x.S, pick: x.pick, frozenNet4: x.frozenNet4 })),
        lambdaSpreadCap: +(Math.max(...lamFlatCap.map((x) => x.oosNet4)) - Math.min(...lamFlatCap.map((x) => x.oosNet4))).toFixed(2),
        lambdaSpreadNoCap: +(Math.max(...lamFlatNoCap.map((x) => x.oosNet4)) - Math.min(...lamFlatNoCap.map((x) => x.oosNet4))).toFixed(2),
        jointWfPickFreq: (() => { const f = {}; for (const p of jointWF.picks) f[p.key] = (f[p.key] || 0) + 1; return f; })(),
        validationPass: checks.matches,
    };
    verdict.fadeRuleFree = !verdict.jointWfBeatsBestPinned && verdict.frozenCapFixedLateMatchesWf;

    return {
        config: { symbols: k, symbolList: names, periods: P, firstTop, lookback: LOOKBACK, block: BLOCK, feeBps: FEE_BPS, kcap: KC, lambdas: LAMBDAS, caps: CAPS, oosSpan: { start: oosStart, end, span: end - oosStart } },
        checks,
        jointWalkForward: { oosNet4: sc(jointWF.net), recent24mNet4: sc(jointWF.net.slice(jointWF.net.length - 2 * PPY)), picks: jointWF.picks },
        frozenCapFixed, frozenNoCap, frozenJoint,
        lambdaFlatnessCap: lamFlatCap, lambdaFlatnessNoCap: lamFlatNoCap, capSensitivity: capSens,
        verdict,
    };
}
