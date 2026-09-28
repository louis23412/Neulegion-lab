// E40 - DOES A FIXED CROSS-SCALE BLEND BEAT R8'S WALK-FORWARD λ? CYCLE-031 (L12 x L16, tests F-37/F-39).
//
// F-46 (CYCLE-029) found a NEW way to remove a window-fit parameter: when a single smoothing λ is
// regime-specific (the OI book's λ=0.25 died pre-2024) a FIXED blend across scales is positive in every
// year, with no selection rule at all. The port-ready R8 spec (F-37/F-39) instead uses a **walk-forward,
// cost-aware λ-selection** — which F-39 showed beats the pinned F-24 spec out of sample (+6.13 vs +2.76).
// So the natural question: is the *selection rule* still needed, or does a fixed blend of the λ family
// match it? A blend needs no rule, no lookback, no block — if it matches the walk-forward out of sample it
// is a strictly simpler port spec.
//
// This experiment builds the R8 spec family — rank-funding weights, EWMA(λ), a strict 12.5 % per-symbol cap
// — for a pre-registered cost-aware λ grid, forms **fixed equal-capital blends** over several pre-registered
// sub-sets, and compares them with the λ-only walk-forward on one out-of-sample span (lookback 1095, block
// 365: the rule never sees the block it trades).
//
// FALSIFIER (pre-registered). The blend does NOT replace the rule if, on the OOS span, the best fixed blend's
// net@4 is more than 0.2 Sharpe below the walk-forward's, or if every blend is negative in the recent 24 m.
// The blend DOES replace it if some blend is within 0.2 Sharpe of the walk-forward and positive recently.
//
// GUARDS. The pinned λ=0.02 + 12.5 % cap book must reproduce `e30`'s stored
// `books['ewma_0.02_norm_cap12.5'].windows.full` net@4 and gross Sharpe (full history) and `e31`'s stored
// `pinned['lam0.02_cap12.5'].oosNet4Sharpe` (on the OOS span). Those artefacts store Sharpe to 2 dp, so the
// guard is an ABSOLUTE 0.01 tolerance (half-ULP scale), not a relative one.

import { SYMBOLS } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const CAP = 0.125; // the R8 spec cap
const LAMBDAS = [0.005, 0.01, 0.02, 0.05, 0.1]; // the cost-aware range (e28/e29 family)
const BLEND_SETS = {
    all5: [0.005, 0.01, 0.02, 0.05, 0.1],
    mid3: [0.01, 0.02, 0.05],
    slow3: [0.005, 0.01, 0.02],
    pair0102: [0.01, 0.02],
    slow4: [0.005, 0.01, 0.02, 0.05],
};

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const applyCap = (rows, cap) => rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x)));
const fmt = (lam) => String(lam);

export async function run({ symbols = SYMBOLS, perp = 'mark', lookback = 1095, block = 365 } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const legs = s.legs;
    const n = legs.times.length - 1;
    const bookTimes = legs.times.slice(1);
    const pnlOf = (rows) => rows.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * ((Number.isFinite(bp[j]) ? bp[j] : 0) + (Number.isFinite(fr[j]) ? fr[j] : 0)), 0); });

    // ---- the R8 spec family: rank weights, EWMA(λ), strict 12.5 % cap ----
    const books = {};
    for (const lam of LAMBDAS) {
        const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: lam, normalize: true } });
        const rows = applyCap(built.weightRows, CAP);
        const rets = pnlOf(rows);
        const T = turnoverSeries(rows);
        books[lam] = { rows, rets, T, net4: rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i]) };
    }

    // ---- fixed equal-capital blends ----
    const blendOf = (set) => {
        const rows = [];
        for (let t = 0; t < n; t++) { const w = new Array(k).fill(0); for (const lam of set) for (let j = 0; j < k; j++) w[j] += books[lam].rows[t][j] / set.length; rows.push(w); }
        const rets = pnlOf(rows); const T = turnoverSeries(rows);
        return { rows, rets, T, net4: rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i]) };
    };
    const blends = {}; for (const [name, set] of Object.entries(BLEND_SETS)) blends[name] = blendOf(set);

    // ---- λ-only cost-aware walk-forward (cap fixed at 12.5 %) ----
    const wf = { net: [], gross: [], turn: [], picks: [] };
    { let r = lookback; while (r + block <= n) { let best = null; for (const lam of LAMBDAS) { const sc = sharpe(books[lam].net4.slice(r - lookback, r)); if (!Number.isFinite(sc)) continue; if (!best || sc > best.sc) best = { lam, sc }; } if (!best) break; for (let t = r; t < r + block; t++) { wf.net.push(books[best.lam].net4[t]); wf.gross.push(books[best.lam].rets[t]); wf.turn.push(books[best.lam].T[t]); } wf.picks.push({ at: new Date(bookTimes[r]).toISOString().slice(0, 10), lambda: best.lam, trailingNet4: +best.sc.toFixed(2) }); r += block; } }
    const wfFreq = {}; for (const p of wf.picks) wfFreq[fmt(p.lambda)] = (wfFreq[fmt(p.lambda)] || 0) + 1;
    const start = lookback, span = wf.net.length, end = start + span;
    const rec = Math.min(span, Math.round(2 * PPY));

    const statsOver = (rets, T) => {
        const oos = []; for (let t = start; t < end; t++) oos.push(rets[t] - (FEE_BPS / 1e4) * T[t]);
        const recent = oos.slice(span - rec);
        return {
            oosNet4: +sharpe(oos).toFixed(2),
            recent24mNet4: +sharpe(recent).toFixed(2),
            turnoverAnnual: +(mean(T.slice(start, end)) * PPY).toFixed(0),
            breakEvenBps: mean(T.slice(start, end)) > 0 ? +((mean(rets.slice(start, end)) * 1e4) / mean(T.slice(start, end))).toFixed(2) : null,
        };
    };
    const fullNet4 = (rets, T) => +sharpe(rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i])).toFixed(3);
    const fullGross4 = (rets) => +sharpe(rets).toFixed(3);

    const wfStats = { span, start, oosNet4: +sharpe(wf.net).toFixed(2), recent24mNet4: +sharpe(wf.net.slice(span - rec)).toFixed(2), turnoverAnnual: +(mean(wf.turn) * PPY).toFixed(0), breakEvenBps: mean(wf.turn) > 0 ? +((mean(wf.gross) * 1e4) / mean(wf.turn)).toFixed(2) : null, picks: wf.picks, pickFrequency: wfFreq };
    const pinned0202 = { lambda: 0.02, cap: CAP, fullNet4: fullNet4(books[0.02].rets, books[0.02].T), fullGross: fullGross4(books[0.02].rets), ...statsOver(books[0.02].rets, books[0.02].T) };
    const blendStats = {};
    for (const [name, b] of Object.entries(blends)) blendStats[name] = { set: BLEND_SETS[name], fullNet4: fullNet4(b.rets, b.T), ...statsOver(b.rets, b.T) };

    // ---- guards ----
    let e30 = null, e31 = null;
    try { e30 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e30_retuned_capacity.json')); } catch (e) { e30 = null; }
    try { e31 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e31_ported_spec_oos.json')); } catch (e) { e31 = null; }
    const e30W = e30 && e30.books && e30.books['ewma_0.02_norm_cap12.5'] ? e30.books['ewma_0.02_norm_cap12.5'].windows.full : null;
    const e31Oos = e31 && e31.pinned ? e31.pinned['lam0.02_cap12.5'].oosNet4Sharpe : null;
    const absDiff = (a, b) => (a != null && b != null ? Math.abs(a - b) : null);
    const dFullNet = absDiff(pinned0202.fullNet4, e30W ? e30W.net4Sharpe : null);
    const dFullGross = absDiff(pinned0202.fullGross, e30W ? e30W.grossSharpe : null);
    const dOos = absDiff(pinned0202.oosNet4, e31Oos);
    const validation = {
        e30FullNet4: e30W ? e30W.net4Sharpe : null, hereFullNet4: pinned0202.fullNet4, fullNetAbsDiff: dFullNet == null ? null : +dFullNet.toFixed(4),
        e30FullGross: e30W ? e30W.grossSharpe : null, hereFullGross: pinned0202.fullGross, fullGrossAbsDiff: dFullGross == null ? null : +dFullGross.toFixed(4),
        e31PinnedOosNet4: e31Oos, hereOosNet4: pinned0202.oosNet4, oosAbsDiff: dOos == null ? null : +dOos.toFixed(4),
        matchesE30: dFullNet != null && dFullGross != null && dFullNet < 0.01 && dFullGross < 0.01,
        matchesE31: dOos != null && dOos < 0.01,
        note: 'The pinned λ=0.02 + 12.5 % cap book must reproduce e30 ewma_0.02_norm_cap12.5.windows.full (net4Sharpe + grossSharpe, full history) and e31 lam0.02_cap12.5.oosNet4Sharpe (OOS span) — same construction. e30/e31 store Sharpe to 2 dp, so the guard is an absolute 0.01 tolerance.',
    };
    validation.validationPass = validation.matchesE30 && validation.matchesE31;

    // ---- verdict ----
    const bestBlendName = Object.keys(blendStats).reduce((best, nm) => (blendStats[nm].oosNet4 > blendStats[best].oosNet4 ? nm : best), Object.keys(blendStats)[0]);
    const bestBlend = blendStats[bestBlendName];
    const verdict = {
        note: 'Falsifier: the fixed blend replaces the walk-forward rule if its OOS net@4 is within 0.2 Sharpe of the rule AND positive over the recent 24 m.',
        walkForwardOosNet4: wfStats.oosNet4, walkForwardRecent24mNet4: wfStats.recent24mNet4, walkForwardTurnoverAnnual: wfStats.turnoverAnnual,
        pinned0202OosNet4: pinned0202.oosNet4,
        bestBlendSet: bestBlendName, bestBlendOosNet4: bestBlend.oosNet4, bestBlendRecent24mNet4: bestBlend.recent24mNet4, bestBlendTurnoverAnnual: bestBlend.turnoverAnnual,
        blendWithin02OfWf: bestBlend.oosNet4 >= wfStats.oosNet4 - 0.2,
        blendBeatsPinned: bestBlend.oosNet4 > pinned0202.oosNet4,
        anyBlendPositiveRecent: Object.values(blendStats).some((b) => b.recent24mNet4 > 0),
        allBlendsPositiveRecent: Object.values(blendStats).every((b) => b.recent24mNet4 > 0),
        blendReplacesRule: bestBlend.oosNet4 >= wfStats.oosNet4 - 0.2 && Object.values(blendStats).some((b) => b.recent24mNet4 > 0),
        validationPass: validation.validationPass,
    };

    return {
        config: { symbols: k, periods: n, lookback, block, feeBps: FEE_BPS, cap: CAP, lambdas: LAMBDAS, blendSets: BLEND_SETS, oosSpan: { start, end, span } },
        validation,
        walkForward: wfStats,
        pinned0202,
        blends: blendStats,
        verdict,
    };
}
