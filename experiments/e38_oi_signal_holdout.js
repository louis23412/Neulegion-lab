// E38 - IS THE OI-CHANGE SIGNAL A 2024-26 REGIME ARTEFACT? CYCLE-029 (L19's live falsifier).
//
// CYCLE-028 (F-45) re-opened F-28: the Δlog(OI) cross-sectional book is churned to death *daily*
// (1501×/yr, break-even 1.89 bps) but EWMA-smoothed it clears a 4 bps fee (λ=0.25 → break-even 8.93 bps,
// net@4 +0.65; λ=0.1 → 14.73 bps, +0.52). So F-28's blanket "do not port OI as a directional stream" was
// corrected to "weak, churny, recent-regime". But "recent-regime" was the load-bearing caveat:
//
//   * net-by-year at λ=0.25 was 2022 +0.52, 2023 −0.86, 2024 +1.56, 2025 +0.96, 2026 +2.30;
//   * net halves were 0.07 / 1.47 — the edge is almost entirely in the SECOND half;
//   * the F-37 walk-forward λ rule UNDERPERFORMED pinning (+0.44 vs +0.76/+0.99), the F-40 signature of a
//     weak signal.
//
// L19's own falsifier (b) is therefore live: "the edge is a 2024–26 artefact — a held-out split or a
// pre-2024 read with the sign fixed would kill it." This experiment runs exactly that, with the sign (+1,
// F-28's pooled-IC prior) and the λ window (0.1, 0.25) fixed A PRIORI (the CYCLE-028 candidates — nothing
// is re-fitted here):
//
//   1. CALENDAR SPLIT. Score the pre-2024 (≤ 2023) and post-2024 (≥ 2024) sub-periods of each book on the
//      same net@4 scale as the full window. This is the falsifier test.
//   2. REGIME λ-SELECTION. Choose λ by trailing net@4 on pre-2024 only and trade it through post-2024
//      (and the reverse), so the "winner" is not chosen on the window it is credited with (PROTOCOL §3.2).
//   3. DECAY. The F-36 block-trend test (8 contiguous blocks, permutation null) on the net@4 series.
//   4. CONSTRUCTION. Is the LEVEL form (demeaned ΔlogOI, what e21/e37 trade) the right one, or does the
//      RANK form help (the funding book's rank form beat its level form, F-17)? Same book builder, the
//      signal pre-transformed to per-period centered ranks.
//   5. CONFOUND. Return correlation with the L18 toptrader fade book; the raw signal's cross-sectional
//      correlation with the toptrader ratio; and whether the OI change merely echoes the PRICE move over
//      its own measurement interval (the "crowding vs momentum-proxy" question).
//   6. CAPACITY. The book's OI bound as a SCHEDULE (F-41/F-42) — the min-of-ratio G_t distribution and
//      its binding symbol — as a first read on whether it shares R8's thin-alt constraint (F-43/F-44).
//
// FALSIFIER (pre-registered). L19 is a REGIME ARTEFACT (falsifier fires) if, for BOTH λ∈{0.1, 0.25} with
// sign +1, the pre-2024 net@4 Sharpe is ≤ 0 — i.e. the book made no money at a realistic fee before the
// window the rescue was credited with. If instead it is positive pre-2024 for at least one λ, the signal
// has a genuine out-of-holdout read and L19 stays open (still not port-ready).
//
// DECISIVE ROBUSTNESS READ (also pre-registered, no fitting): because a *single* λ turned out to be
// regime-dependent (the CYCLE-028 "best" λ=0.25 dies pre-2024; λ=0.1 dies in 2024), the experiment also
// builds a FIXED 50/50 blend of the two pre-registered λ — no parameter is chosen on any window. If that
// unfitted blend is positive in EVERY calendar year, the *phenomenon* is robust even though the best single
// smoothing scale is not.
//
// GUARD. The daily sign+1 book must reproduce e21#dLogOI_pos (gross 0.9612 / turnover 1501.11), or the
// extracted builder has diverged and nothing here counts.

import { SYMBOLS, loadOpenInterest, flowIndexAt, pearsonCorrelation } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { xsBookImpl } from './e21_open_interest.js';
import { buildMasked } from './e22_toptrader_validate.js';
import { audit, turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const F = 0.05; // the participation cap the OI bounds quote
const LAMBDAS = [0.25, 0.1]; // pre-registered (CYCLE-028 candidates) — NOT re-fitted here
const SPLIT_YEAR = 2024; // pre = year < 2024, post = year >= 2024

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sdOf = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sdOf(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const r3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null);
const quantile = (arr, q) => { const v = arr.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!v.length) return NaN; const pos = (v.length - 1) * q; const lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };
const usd = (x) => (Number.isFinite(x) ? Math.round(x) : null);

const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// F-36 block-trend test (reused from e27): Pearson corr of block Sharpe with block index vs a
// permutation null. A NEGATIVE rho is the decay direction.
function trendTest(series, K, seed, draws = 5000) {
    const len = Math.floor(series.length / K);
    const sharpes = [];
    for (let b = 0; b < K; b++) sharpes.push(sharpe(series.slice(b * len, (b + 1) * len)));
    const idx = sharpes.map((_, i) => i);
    const rho = pearsonCorrelation(idx, sharpes);
    const v = sharpes.filter(Number.isFinite);
    const rng = mulberry32(seed);
    let ge = 0;
    const perm = v.slice();
    for (let d = 0; d < draws; d++) {
        for (let q = perm.length - 1; q > 0; q--) { const t = Math.floor(rng() * (q + 1)); const tmp = perm[q]; perm[q] = perm[t]; perm[t] = tmp; }
        if (Math.abs(pearsonCorrelation(idx, perm)) >= Math.abs(rho) - 1e-12) ge++;
    }
    const first = sharpes.slice(0, Math.floor(K / 3));
    const last = sharpes.slice(Math.ceil((2 * K) / 3));
    return { rho: r3(rho), pPerm: +((ge + 1) / (draws + 1)).toFixed(4), firstThirdMean: r2(mean(first)), lastThirdMean: r2(mean(last)), delta: r2(mean(last) - mean(first)), blockSharpes: sharpes.map(r2) };
}

// Per-period centered ranks of a masked signal: replaces each present symbol's value by its rank
// (0..m-1) minus (m-1)/2, absent stays null. Feeding that to xsBookImpl gives the rank form of the book.
function rankTransform(sig, k, n) {
    const out = sig.map(() => new Array(n).fill(null));
    for (let i = 0; i < n; i++) {
        const pres = [];
        for (let j = 0; j < k; j++) if (Number.isFinite(sig[j][i])) pres.push(j);
        if (pres.length < 3) continue;
        const ord = pres.map((j) => [sig[j][i], j]).sort((a, b) => a[0] - b[0]);
        ord.forEach(([, j], rank) => { out[j][i] = rank - (pres.length - 1) / 2; });
    }
    return out;
}

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList; const k = names.length;
    const times = s.times; const n = times.length; const legs = s.legs;
    const oi = await loadOpenInterest();

    const fieldBySym = (field) => names.map((nm) => { const o = oi[nm]; if (!o) return null; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o[field][idx] : null; } return arr; });
    const oiValBySym = fieldBySym('oiVal');
    const topLSBySym = fieldBySym('topLS');
    const dlog = (arr, i) => { if (!arr) return null; const a = arr[i]; const b = arr[i - 1]; return (a > 0 && b > 0) ? Math.log(a / b) : null; };
    const dOIBySym = names.map((_, j) => times.map((_, i) => dlog(oiValBySym[j], i)));
    const firstAll = (sig) => { for (let i = 1; i < n - 1; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(sig[j][i])) all = false; if (all) return i; } return -1; };
    const firstOI = firstAll(dOIBySym);
    const firstTop = firstAll(topLSBySym);

    const lk = (lam) => 'lam_' + String(lam).replace('.', 'p');
    const mk = (sig, sign, lam, from) => xsBookImpl(sig, { k, n, times, legs, NEXT: 2 }, { sign, from, policy: lam == null ? { kind: 'daily' } : { kind: 'ewma', lambda: lam, normalize: true } });
    const withNet = (b) => { const T = turnoverSeries(b.weightRows); return { b, T, net4: b.rets.map((r, i) => r - (FEE_BPS / 1e4) * T[i]) }; };

    // ---- guard: daily sign+1 reproduces e21#dLogOI_pos ----
    const dailyW = withNet(mk(dOIBySym, 1, null, firstOI));
    const dailyAudit = audit('dLogOI_daily', dailyW.b.rets, dailyW.b.weightRows);
    let e21 = null;
    try { e21 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e21_open_interest.json')); } catch (e) { e21 = null; }
    const e21b = e21 ? e21.signalBooks.dLogOI_pos : null;
    const validation = e21b ? {
        e21GrossSharpe: e21b.grossSharpe, hereGrossSharpe: +dailyAudit.gross.sharpe.toFixed(4),
        e21Turnover: e21b.turnoverAnnual, hereTurnover: +dailyAudit.turnover.annualized.toFixed(3),
        matchesE21: Math.abs(dailyAudit.gross.sharpe - e21b.grossSharpe) < 5e-3 && Math.abs(dailyAudit.turnover.annualized - e21b.turnoverAnnual) < 1,
        note: 'daily/sign+1 must reproduce e21#dLogOI_pos to display precision (xsBookImpl extraction).',
    } : null;

    // ---- book set: level (pre-registered) + rank, λ∈{0.25,0.1}, daily reference, sign control ----
    const level = { daily: dailyW };
    for (const lam of LAMBDAS) level[lk(lam)] = withNet(mk(dOIBySym, 1, lam, firstOI));
    level.signNeg_lam_0p25 = withNet(mk(dOIBySym, -1, 0.25, firstOI));
    const sigRank = rankTransform(dOIBySym, k, n);
    const rank = {};
    for (const lam of LAMBDAS) rank[lk(lam)] = withNet(mk(sigRank, 1, lam, firstOI));

    // Fixed 50/50 ENSEMBLE of the two pre-registered λ (no fitting): average the weight vectors and
    // renormalise. e21/e37 showed the two λ are anti-phase year-to-year; if a fixed blend of the two
    // pre-registered scales is positive in EVERY calendar year, the *phenomenon* is robust even though the
    // single best λ is regime-dependent.
    const ensRows = level[lk(0.25)].b.weightRows.map((w, kk) => {
        const v = w.map((x, j) => (x + level[lk(0.1)].b.weightRows[kk][j]) / 2);
        const g = v.reduce((a, x) => a + Math.abs(x), 0) || 1;
        return v.map((x) => x / g);
    });
    const loopStart = Math.max(1, firstOI);
    const ensRets = ensRows.map((w, kk) => w.reduce((a, x, j) => a + x * legs.spotRet[loopStart + 2 + kk][j], 0));
    const ensemble = withNet({ rets: ensRets, weightRows: ensRows, bookTimes: level[lk(0.25)].b.bookTimes });

    const yearOf = (t) => new Date(t).getUTCFullYear();
    const subset = (w, idx) => {
        const g = idx.map((i) => w.b.rets[i]); const turn = idx.map((i) => w.T[i]); const nt = idx.map((i) => w.net4[i]);
        const bt = idx.map((i) => w.b.bookTimes[i]);
        return {
            n: idx.length,
            start: bt.length ? new Date(bt[0]).toISOString().slice(0, 10) : null,
            end: bt.length ? new Date(bt[bt.length - 1]).toISOString().slice(0, 10) : null,
            grossSharpe: r2(sharpe(g)), turnoverAnnual: Number.isFinite(mean(turn)) ? Math.round(mean(turn) * PPY) : null,
            breakEvenBps: mean(turn) > 0 ? r2((mean(g) * 1e4) / mean(turn)) : null,
            net4: r2(sharpe(nt)),
        };
    };
    const statsOf = (w, which) => {
        const all = w.b.bookTimes.map((_, i) => i);
        const pre = w.b.bookTimes.map((t, i) => [t, i]).filter(([t]) => yearOf(t) < SPLIT_YEAR).map(([, i]) => i);
        const post = w.b.bookTimes.map((t, i) => [t, i]).filter(([t]) => yearOf(t) >= SPLIT_YEAR).map(([, i]) => i);
        const yearNet = {}, yearGross = {};
        const by = {};
        w.b.bookTimes.forEach((t, i) => { const y = yearOf(t); (by[y] = by[y] || []).push(i); });
        for (const [y, ix] of Object.entries(by)) { yearGross[y] = r2(sharpe(ix.map((i) => w.b.rets[i]))); yearNet[y] = r2(sharpe(ix.map((i) => w.net4[i]))); }
        return { full: subset(w, all), pre2024: subset(w, pre), post2024: subset(w, post), perYearGross: yearGross, perYearNet4: yearNet };
    };
    const splits = { level: {}, rank: {} };
    for (const [name, w] of Object.entries(level)) splits.level[name] = statsOf(w, name);
    for (const [name, w] of Object.entries(rank)) splits.rank[name] = statsOf(w, name);
    splits.ensemble = { lam_50_50: statsOf(ensemble, 'ens') };

    // ---- regime λ-selection: choose on one regime, score on the other ----
    const idxPre = level.lam_0p25.b.bookTimes.map((t, i) => [t, i]).filter(([t]) => yearOf(t) < SPLIT_YEAR).map(([, i]) => i);
    const idxPost = level.lam_0p25.b.bookTimes.map((t, i) => [t, i]).filter(([t]) => yearOf(t) >= SPLIT_YEAR).map(([, i]) => i);
    const net4On = (w, idx) => sharpe(idx.map((i) => w.net4[i]));
    const pickLambda = (idx) => LAMBDAS.map((lam) => ({ lam, sc: net4On(level[lk(lam)], idx) })).filter((x) => Number.isFinite(x.sc)).sort((a, b) => b.sc - a.sc)[0] || null;
    const regimeSelection = {
        selectOnPre2024: (() => { const p = pickLambda(idxPre); return p ? { pickedLambda: p.lam, trainingNet4: r2(p.sc), oosPost2024Net4: r2(net4On(level[lk(p.lam)], idxPost)) } : null; })(),
        selectOnPost2024: (() => { const p = pickLambda(idxPost); return p ? { pickedLambda: p.lam, trainingNet4: r2(p.sc), oosPre2024Net4: r2(net4On(level[lk(p.lam)], idxPre)) } : null; })(),
        signSelectOnPre2024: (() => { const pos = net4On(level.lam_0p25, idxPre), neg = net4On(level.signNeg_lam_0p25, idxPre); const pick = pos >= neg ? 1 : -1; return { pickedSign: pick, trainingNet4: r2(Math.max(pos, neg)), oosPost2024Net4: r2(net4On(pick > 0 ? level.lam_0p25 : level.signNeg_lam_0p25, idxPost)) }; })(),
        note: 'λ and sign chosen by TRAILING net@4 on one regime only, then scored on the never-used regime. If the picked value loses out-of-regime, the rescue was a window fit.',
    };

    // ---- decay ----
    const decay = {
        lam_0p25: { net4: trendTest(level.lam_0p25.net4, 8, 20261101), gross: trendTest(level.lam_0p25.b.rets, 8, 20261102) },
        lam_0p1: { net4: trendTest(level.lam_0p1.net4, 8, 20261103), gross: trendTest(level.lam_0p1.b.rets, 8, 20261104) },
    };

    // ---- confound: L18 fade, signal-level toptrader corr, momentum echo ----
    const fade = buildMasked(topLSBySym, k, legs, times, { sign: -1, from: firstTop, policy: { kind: 'ewma', lambda: 0.1, normalize: true } });
    const alignCorr = (A, B) => { const mB = new Map(); B.bookTimes.forEach((t, i) => mB.set(t, B.rets[i])); const a = [], b = []; A.bookTimes.forEach((t, i) => { const v = mB.get(t); if (v !== undefined && Number.isFinite(A.rets[i]) && Number.isFinite(v)) { a.push(A.rets[i]); b.push(v); } }); return a.length > 50 ? r3(pearsonCorrelation(a, b)) : null; };
    let xsecSum = 0, xsecCnt = 0;
    for (let i = 0; i < n; i++) {
        const p = [];
        for (let j = 0; j < k; j++) if (Number.isFinite(dOIBySym[j][i]) && Number.isFinite(topLSBySym[j][i])) p.push([dOIBySym[j][i], topLSBySym[j][i]]);
        if (p.length >= 4) { const c = pearsonCorrelation(p.map((q) => q[0]), p.map((q) => q[1])); if (Number.isFinite(c)) { xsecSum += c; xsecCnt++; } }
    }
    const pooledCorr = (sig, target) => { const a = [], b = []; for (let i = 1; i < n - 1; i++) for (let j = 0; j < k; j++) { const x = sig[j][i]; const y = target[i] ? target[i][j] : null; if (Number.isFinite(x) && Number.isFinite(y)) { a.push(x); b.push(y); } } return a.length > 50 ? r3(pearsonCorrelation(a, b)) : null; };
    const confound = {
        returnCorr_withL18Fade: alignCorr(level.lam_0p25.b, fade),
        signalXsecCorr_withTopLS: xsecCnt ? r3(xsecSum / xsecCnt) : null,
        dOI_vs_priorIntervalSpotReturn: pooledCorr(dOIBySym, legs.spotRet.map((r, i) => legs.spotRet[i + 1])), // past move (causal)
        dOI_vs_forwardSpotReturn: pooledCorr(dOIBySym, legs.spotRet.map((r, i) => legs.spotRet[i + 2])), // the pooled IC 0.020
        note: 'If the OI change merely echoes the price move over its own interval, the causal past-move corr would be large; the forward corr is the (≈0.02) IC. Return-level independence from L18 is what keeps this a distinct stream.',
    };

    // ---- capacity: the OI bound as a schedule (F-41/F-42) ----
    const oiAt = (t) => names.map((nm) => { const o = oi[nm]; if (!o) return null; const idx = flowIndexAt(o, t); return idx >= 0 ? o.oiVal[idx] : null; });
    const scheduleOf = (book) => {
        const rows = [];
        for (let t = 0; t < book.weightRows.length; t++) {
            const ov = oiAt(book.bookTimes[t]);
            if (!ov) continue;
            let g = Infinity, bj = -1, ok = true;
            for (let j = 0; j < k; j++) { const w = Math.abs(book.weightRows[t][j]); if (w <= 1e-12) continue; const o = ov[j]; if (!(o > 0)) { ok = false; break; } const r = o / w; if (r < g) { g = r; bj = j; } }
            if (ok && g !== Infinity) rows.push({ g: g * F, bind: bj });
        }
        const Gt = rows.map((x) => x.g);
        const s2 = Gt.slice().sort((a, b) => a - b);
        const tail = rows.slice().sort((a, b) => a.g - b.g).slice(0, Math.max(1, Math.round(0.05 * rows.length)));
        const bc = {}; for (const x of tail) { const nm = names[x.bind]; bc[nm] = (bc[nm] || 0) + 1; }
        return { n: Gt.length, meanUSD: usd(mean(Gt)), p5USD: usd(quantile(Gt, 0.05)), medianUSD: usd(quantile(Gt, 0.5)), minUSD: usd(s2[0]), tailBindingSymbols: bc };
    };
    const capacity = { lam_0p25: scheduleOf(level.lam_0p25.b), lam_0p1: scheduleOf(level.lam_0p1.b), note: 'G_t = 0.05·min_j OI_j(t)/|w_j(t)| over certifiable periods (every traded symbol has an OI print). A third stream on the same thin alts shares R8\'s constraint (F-43/F-44) — this is the individual bound, not the joint one.' };

    // ---- verdict ----
    const pre25 = splits.level.lam_0p25.pre2024.net4;
    const pre01 = splits.level.lam_0p1.pre2024.net4;
    const post25 = splits.level.lam_0p25.post2024.net4;
    const post01 = splits.level.lam_0p1.post2024.net4;
    const ensYearNet = splits.ensemble.lam_50_50.perYearNet4;
    const ensFullYears = Object.keys(ensYearNet).filter((y) => +y >= 2022);
    const ensemblePositiveEveryYear = ensFullYears.length > 0 && ensFullYears.every((y) => ensYearNet[y] > 0);
    const verdict = {
        note: 'Falsifier (L19-b): a 2024-26 artefact if BOTH pre-registered λ have pre-2024 net@4 <= 0 with sign +1.',
        pre2024Net4: { lam_0p25: pre25, lam_0p1: pre01 },
        post2024Net4: { lam_0p25: post25, lam_0p1: post01 },
        holdoutFiresForBothLambdas: pre25 != null && pre01 != null && pre25 <= 0 && pre01 <= 0,
        holdoutFiresForAnyLambda: (pre25 != null && pre25 <= 0) || (pre01 != null && pre01 <= 0),
        lambda_0p25_isPost2024Artefact: pre25 != null && pre25 <= 0 && post25 != null && post25 > 0,
        lambda_0p1_regimeRobust: pre01 != null && pre01 > 0 && post01 != null && post01 > 0,
        ensemblePre2024Net4: splits.ensemble.lam_50_50.pre2024.net4,
        ensemblePost2024Net4: splits.ensemble.lam_50_50.post2024.net4,
        ensemblePositiveEveryYear: ensemblePositiveEveryYear,
        ensemblePerYearNet4: ensYearNet,
        regimeSelectedPickedLambda: regimeSelection.selectOnPre2024 ? regimeSelection.selectOnPre2024.pickedLambda : null,
        regimeSelectedOosNet4: regimeSelection.selectOnPre2024 ? regimeSelection.selectOnPre2024.oosPost2024Net4 : null,
        decayTrendP_lam_0p25: decay.lam_0p25.net4.pPerm,
        decayRho_lam_0p25: decay.lam_0p25.net4.rho,
        rankPre2024Net4_lam_0p25: splits.rank.lam_0p25.pre2024.net4,
        rankPost2024Net4_lam_0p25: splits.rank.lam_0p25.post2024.net4,
        rankBeatsLevelHoldout: (splits.rank.lam_0p25.pre2024.net4 || -1e9) > (splits.level.lam_0p25.pre2024.net4 || -1e9),
        returnCorrWithL18Fade: confound.returnCorr_withL18Fade,
        validationPass: validation ? validation.matchesE21 : null,
    };

    return {
        config: { symbols: k, symbolList: names, periods: level.daily.b.rets.length, firstOI, lambdas: LAMBDAS, sign: '+1 (prior, F-28 pooled IC 0.020)', splitYear: SPLIT_YEAR, feeBps: FEE_BPS, f: F },
        validation,
        daily: { grossSharpe: r3(dailyAudit.gross.sharpe), turnoverAnnual: +dailyAudit.turnover.annualized.toFixed(1), breakEvenBps: r2(dailyAudit.breakEvenBps), net4: r2(dailyAudit.net['4'].sharpe) },
        splits,
        regimeSelection,
        decay,
        confound,
        capacity,
        verdict,
    };
}
