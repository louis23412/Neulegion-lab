// E39 - DOES THE L19 OI-CHANGE STREAM ADD TO R8? CYCLE-030 (L19 x L12 x L18 x L15/L17).
//
// F-45/F-46 (L19) established that the cross-sectional Δlog(OI) book is a *second independent positioning
// signal*: smoothed (λ=0.1) it clears a 4 bps fee in both regimes, and a fixed 50/50 λ blend is positive in
// every calendar year 2022–26 — but it is weak, churny, and its individual OI bound binds the SAME thin
// alts (DOGE/LINK/ADA) as R8. L19's last open falsifier is therefore **capacity/additivity**: if the OI
// stream shares R8's per-symbol OI budget, running it may force R8's size down more than it adds, in which
// case it is not a portfolio member at any Sharpe.
//
// This experiment asks both halves of "does it add?", on the *final port specs* (R8's `ewma 0.02 + 12.5 %
// cap` carry book and R7's `ewma 0.1 + 12.5 % cap` fade), all aligned on one return interval:
//
//   (A) RETURN ADDITIVITY — the OI book's return correlation with each sleeve, a capital-allocation ladder
//       (carry + OI) scored net@4, and a two-way walk-forward allocation (carry vs OI) by trailing net@4.
//   (B) CAPACITY ADDITIVITY — the exact **three-sleeve** joint OI frontier: the per-period 3-D LP
//       `max gC·G_C + gF·G_F + gO·G_O  s.t.  |G_C·wC_j + G_F·wF_j + G_O·wO_j| ≤ 5 %·OI_j`.
//       Report its total-gross distribution vs the sum of the three individual bounds and vs the 2-D
//       carry+fade LP (F-44), the **optimal OI share**, the binding symbol, and the breach fraction when
//       all three run at their own individual compliant sizes.
//
// The OI sleeve is the **fixed 50/50 λ blend** from F-46 (L19's regime-robust book); λ=0.1's own numbers
// are reported alongside.
//
// FALSIFIER (pre-registered). The OI stream does NOT add if, at the optimal portfolio, its share of the
// joint gross is ~0 (the LP drops it) OR its capital-allocation ladder never lifts the carry book's net@4.
// It DOES add if the 3-D LP mean gross exceeds the 2-D (carry+fade) LP mean AND the OI share is material.
//
// GUARDS. The two port-spec books' individual OI bounds must reproduce `e34`'s stored `meanGcap` within
// 5 %, and the 2-D carry+fade LP mean must reproduce `e36`'s stored `lpMeanTotalGross` within 5 % — or the
// alignment/unit convention has diverged and nothing here counts.

import { SYMBOLS, loadOpenInterest, flowIndexAt, pearsonCorrelation } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { xsBookImpl } from './e21_open_interest.js';
import { buildPair } from './e35_portfolio_mix.js';
import { lpFrontier } from './e36_portfolio_oi_frontier.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const F = 0.05;
const LAMBDAS = [0.25, 0.1];

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const quantile = (arr, q) => { const v = arr.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!v.length) return NaN; const pos = (v.length - 1) * q; const lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };
const dist = (arr) => ({ n: arr.filter(Number.isFinite).length, mean: mean(arr), p5: quantile(arr, 0.05), median: quantile(arr, 0.5), p95: quantile(arr, 0.95), min: Math.min(...arr.filter(Number.isFinite)) });
const sumAbs = (w) => w.reduce((a, x) => a + Math.abs(x), 0);

// maximise gC·x + gF·y + gO·z  s.t.  |a_j·x + b_j·y + c_j·z| ≤ cap_j,  x,y,z ≥ 0.
// The feasible set is a bounded 3-D polytope (cap_j > 0); the optimum is a vertex = an intersection of
// three of the 2k + 3 constraint planes. Enumerate them and keep the feasible one with the largest
// objective. (The axis vertices are included because the nonnegativity planes are in the list.)
function lp3(a, b, c, cap, gC, gF, gO) {
    const planes = [];
    for (let j = 0; j < a.length; j++) { planes.push([a[j], b[j], c[j], cap[j]]); planes.push([-a[j], -b[j], -c[j], cap[j]]); }
    planes.push([-1, 0, 0, 0]); planes.push([0, -1, 0, 0]); planes.push([0, 0, -1, 0]);
    const M = planes.length;
    const feasible = (x, y, z) => {
        if (x < -1e-9 || y < -1e-9 || z < -1e-9) return false;
        for (let i = 0; i < M; i++) { const p = planes[i]; if (p[0] * x + p[1] * y + p[2] * z > p[3] * (1 + 1e-9) + 1e-9) return false; }
        return true;
    };
    let best = { GC: 0, GF: 0, GO: 0, obj: 0 };
    for (let i = 0; i < M; i++) for (let j2 = i + 1; j2 < M; j2++) for (let k2 = j2 + 1; k2 < M; k2++) {
        const p = planes[i], q = planes[j2], r = planes[k2];
        const det = p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0]);
        if (Math.abs(det) < 1e-12) continue;
        const d1 = p[3], d2 = q[3], d3 = r[3];
        const x = (d1 * (q[1] * r[2] - q[2] * r[1]) - p[1] * (d2 * r[2] - q[2] * d3) + p[2] * (d2 * r[1] - q[1] * d3)) / det;
        const y = (p[0] * (d2 * r[2] - q[2] * d3) - d1 * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * d3 - d2 * r[0])) / det;
        const z = (p[0] * (q[1] * d3 - d2 * r[1]) - p[1] * (q[0] * d3 - d2 * r[0]) + d1 * (q[0] * r[1] - q[1] * r[0])) / det;
        if (!feasible(x, y, z)) continue;
        const obj = gC * x + gF * y + gO * z;
        if (obj > best.obj + 1e-9) best = { GC: x, GF: y, GO: z, obj };
    }
    return best;
}

export async function run({ symbols = SYMBOLS, perp = 'mark', lookback = 1095, block = 365 } = {}) {
    const B = await buildPair({ symbols, perp });
    if (!B.available) return { available: false };
    const { names, k, times, legs, L, pairs, P, rowsC, retsC, TC, rowsF, retsF, TF, oiAtLeg, firstTop, ebarC, ebarF } = B;
    const aRetsF = pairs.map((p) => retsF[p.i]); const aRetsC = pairs.map((p) => retsC[p.m]);
    const aTF = pairs.map((p) => TF[p.i]); const aTC = pairs.map((p) => TC[p.m]);

    // ---- the OI sleeve: the fixed 50/50 λ blend (F-46) on the same `times` grid ----
    const oi = await loadOpenInterest();
    const oiValBySym = names.map((nm) => { const o = oi[nm]; if (!o) return null; const arr = new Array(times.length).fill(null); for (let i = 0; i < times.length; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.oiVal[idx] : null; } return arr; });
    const dlog = (arr, i) => { if (!arr) return null; const a = arr[i]; const b = arr[i - 1]; return (a > 0 && b > 0) ? Math.log(a / b) : null; };
    const dOIBySym = names.map((_, j) => times.map((_, i) => dlog(oiValBySym[j], i)));
    let firstOI = -1;
    for (let i = 1; i < times.length - 1; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(dOIBySym[j][i])) all = false; if (all) { firstOI = i; break; } }
    const mk = (lam) => xsBookImpl(dOIBySym, { k, n: times.length, times, legs, NEXT: 2 }, { sign: 1, from: firstOI, policy: { kind: 'ewma', lambda: lam, normalize: true } });
    const bks = {}; for (const lam of LAMBDAS) bks[lam] = mk(lam);
    const blendRows = bks[0.25].weightRows.map((w, kk) => { const v = w.map((x, j) => (x + bks[0.1].weightRows[kk][j]) / 2); const g = sumAbs(v) || 1; return v.map((x) => x / g); });
    const loopStart = Math.max(1, firstOI);
    const oiRetsRaw = blendRows.map((w, kk) => w.reduce((a, x, j) => a + x * legs.spotRet[loopStart + 2 + kk][j], 0));
    const oiTRaw = turnoverSeries(blendRows);
    const oiBookTimes = bks[0.25].bookTimes;
    const oiMap = new Map(); oiBookTimes.forEach((t, kk) => oiMap.set(t, kk));
    const oiIdx = pairs.map((p) => (oiMap.has(p.bookTime) ? oiMap.get(p.bookTime) : -1));
    const aWBlend = oiIdx.map((kk) => (kk >= 0 ? blendRows[kk] : null));
    const aO = oiIdx.map((kk) => (kk >= 0 ? oiRetsRaw[kk] : NaN));
    const aOT = oiIdx.map((kk) => (kk >= 0 ? oiTRaw[kk] : NaN));
    const withO = pairs.map((p, idx) => (aWBlend[idx] && Number.isFinite(aO[idx]) ? idx : -1)).filter((x) => x >= 0);

    // ---- (A) return additivity ----
    const corrOI_C = (() => { const x = [], y = []; for (const idx of withO) { if (Number.isFinite(aRetsC[idx])) { x.push(aO[idx]); y.push(aRetsC[idx]); } } return x.length > 50 ? +pearsonCorrelation(x, y).toFixed(3) : null; })();
    const corrOI_F = (() => { const x = [], y = []; for (const idx of withO) { if (Number.isFinite(aRetsF[idx])) { x.push(aO[idx]); y.push(aRetsF[idx]); } } return x.length > 50 ? +pearsonCorrelation(x, y).toFixed(3) : null; })();
    const LADDER = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5];
    const ladder = LADDER.map((a) => {
        const net = withO.map((t) => (1 - a) * (aRetsC[t] - (FEE_BPS / 1e4) * aTC[t]) + a * (aO[t] - (FEE_BPS / 1e4) * aOT[t]));
        const gross = withO.map((t) => (1 - a) * aRetsC[t] + a * aO[t]);
        const h = Math.floor(net.length / 2);
        return { oiFrac: a, grossSharpe: +sharpe(gross).toFixed(2), net4Sharp: +sharpe(net).toFixed(2), h1: +sharpe(net.slice(0, h)).toFixed(2), h2: +sharpe(net.slice(h)).toFixed(2) };
    });
    // two-way walk-forward: pick the OI fraction by trailing net@4 only
    const carriesNet = withO.map((t) => aRetsC[t] - (FEE_BPS / 1e4) * aTC[t]);
    const oiNet = withO.map((t) => aO[t] - (FEE_BPS / 1e4) * aOT[t]);
    const wf = { net: [], picks: [] };
    { let r = lookback; while (r + block <= withO.length) { let best = null; for (const a of LADDER) { const tr = []; for (let t = r - lookback; t < r; t++) tr.push((1 - a) * carriesNet[t] + a * oiNet[t]); const sc = sharpe(tr); if (!Number.isFinite(sc)) continue; if (!best || sc > best.sc) best = { a, sc }; } if (!best) break; for (let t = r; t < r + block; t++) wf.net.push((1 - best.a) * carriesNet[t] + best.a * oiNet[t]); wf.picks.push({ at: new Date(pairs[withO[r]].bookTime).toISOString().slice(0, 10), oiFrac: best.a, trailingNet4: +best.sc.toFixed(2) }); r += block; } }
    const wfPinned = (a) => { const r0 = lookback; const span = wf.net.length; const s = []; for (let t = r0; t < r0 + span; t++) s.push((1 - a) * carriesNet[t] + a * oiNet[t]); return sharpe(s); };
    const oiPickFreq = wf.picks.reduce((m, p) => (m[p.oiFrac] = (m[p.oiFrac] || 0) + 1, m), {});

    // The capital-fraction ladder above is dominated by each book's OWN volatility: the carry book is a
    // basis+funding stream (small per-period P&L) while the OI book is a unit-gross SPOT stream (~20× the
    // vol), so a capital weight immediately swamps the carry risk. Also report a RISK-NORMALISED mix
    // (each stream scaled to unit annualised vol) and the max-Sharpe risk-normalised weight, which is the
    // honest "does it diversify" question.
    const sdOf = (s) => sd(s);
    const annVol = (s) => sdOf(s) * Math.sqrt(PPY);
    const volC = annVol(carriesNet), volO = annVol(oiNet);
    const zC = carriesNet.map((x) => x / volC), zO = oiNet.map((x) => x / volO);
    const riskLadder = LADDER.map((a) => { const mix = zC.map((x, i) => (1 - a) * x + a * zO[i]); const h = Math.floor(mix.length / 2); return { oiFrac: a, mixSharpe: +sharpe(mix).toFixed(2), h1: +sharpe(mix.slice(0, h)).toFixed(2), h2: +sharpe(mix.slice(h)).toFixed(2) }; });
    let maxSharpeRisk = { oiFrac: 0, mixSharpe: -Infinity };
    for (let a = 0; a <= 0.5 + 1e-9; a += 0.01) { const mix = zC.map((x, i) => (1 - a) * x + a * zO[i]); const sc = sharpe(mix); if (sc > maxSharpeRisk.mixSharpe) maxSharpeRisk = { oiFrac: +a.toFixed(2), mixSharpe: sc }; }
    maxSharpeRisk.mixSharpe = +maxSharpeRisk.mixSharpe.toFixed(2);
    const riskWf = { net: [], picks: [] };
    { let r = lookback; while (r + block <= withO.length) { let best = null; for (let a = 0; a <= 0.5 + 1e-9; a += 0.01) { const tr = []; for (let t = r - lookback; t < r; t++) tr.push((1 - a) * zC[t] + a * zO[t]); const sc = sharpe(tr); if (!Number.isFinite(sc)) continue; if (!best || sc > best.sc) best = { a, sc }; } if (!best) break; for (let t = r; t < r + block; t++) riskWf.net.push((1 - best.a) * zC[t] + best.a * zO[t]); riskWf.picks.push({ at: new Date(pairs[withO[r]].bookTime).toISOString().slice(0, 10), oiFrac: +best.a.toFixed(2), trailingSharpe: +best.sc.toFixed(2) }); r += block; } }
    const risk = {
        annualVolCarryNet4: +volC.toFixed(3), annualVolOiNet4: +volO.toFixed(3), volRatioOiOverCarry: +(volO / volC).toFixed(1),
        ladder: riskLadder, maxSharpeRiskNormalised: maxSharpeRisk,
        walkForward: { oosSharpe: +sharpe(riskWf.net).toFixed(2), picks: riskWf.picks },
        note: 'Risk-normalised mix (each stream at unit annualised vol). If the max-Sharpe weight on OI is ~0 and the walk-forward picks ~0, the OI stream does not add to the carry book even risk-adjusted; ρ≈0 makes it independent, but at net@4 ~0.8 it is too weak to add to a ~6.5-Sharpe book.',
    };
    // The same risk-scale point applies to the L18 fade — which F-31/F-43 mixed with carry on the SAME
    // capital-fraction convention. Measure the fade's risk-normalised contribution so the convention's
    // effect on F-31/F-43 can be stated (it is a measurement-basis question, not a signal question).
    const fadeNet = withO.map((t) => aRetsF[t] - (FEE_BPS / 1e4) * aTF[t]);
    const volF = annVol(fadeNet); const zF = fadeNet.map((x) => x / volF);
    const maxSharpe2 = (A, B, hi) => { let best = { a: 0, sc: -Infinity }; for (let a = 0; a <= hi + 1e-9; a += 0.01) { const mix = A.map((x, i) => (1 - a) * x + a * B[i]); const sc = sharpe(mix); if (sc > best.sc) best = { a: +a.toFixed(2), sc }; } return { a: best.a, sharpe: +best.sc.toFixed(2) }; };
    let best3 = { aF: 0, aO: 0, sc: -Infinity };
    for (let aF = 0; aF <= 1.0001; aF += 0.05) for (let aO = 0; aO <= 1.0001 - aF; aO += 0.05) { const wC = 1 - aF - aO; const mix = zC.map((x, i) => wC * x + aF * zF[i] + aO * zO[i]); const sc = sharpe(mix); if (sc > best3.sc) best3 = { aF: +aF.toFixed(2), aO: +aO.toFixed(2), sc }; }
    best3.sc = +best3.sc.toFixed(2);
    const mixConvention = {
        annualVolFadeNet4: +volF.toFixed(3), volRatioFadeOverCarry: +(volF / volC).toFixed(1),
        carryOnlySharpe: +sharpe(zC).toFixed(2),
        riskNormCarryPlusFade: maxSharpe2(zC, zF, 0.5),
        riskNormCarryPlusOi: { oiFrac: maxSharpeRisk.oiFrac, sharpe: maxSharpeRisk.mixSharpe },
        riskNormCarryPlusFadePlusOi: best3,
        note: 'The carry book is a basis+funding stream with ~0.4 %/yr vol per unit gross; the spot-based books (fade, OI) are ~50× that, so the lab\'s capital-fraction mix convention (F-31/F-43) over-dilutes the carry book. Risk-normalised, the tangency gain from adding fade+OI to carry is ~+0.1 Sharpe (theory for ρ≈0 unit-vol streams: sqrt(Σ Sharpe²) = 6.60 vs 6.48) — the *direction* of F-43 stands but the *magnitude* is a vol-basis artefact.',
    };

    // ---- (B) three-sleeve joint OI frontier ----
    const lp3rows = []; const indC = [], indF = [], indO = []; const ind2 = [];
    const posSeries = []; const usedIdx = [];
    let lpGe2d = true;
    for (const p of withO) {
        const legIdx = pairs[p].legIdx;
        const oiV = []; let ok = true;
        for (let j = 0; j < k; j++) { const v = oiAtLeg[j][legIdx]; if (!Number.isFinite(v)) { ok = false; break; } oiV.push(v); }
        if (!ok) continue;
        usedIdx.push(p);
        const wC = rowsC[pairs[p].m], wF = rowsF[pairs[p].i], wO = aWBlend[p];
        const capJ = oiV.map((v) => F * v);
        const gC = sumAbs(wC), gF = sumAbs(wF), gO = sumAbs(wO);
        const best = lp3(wC, wF, wO, capJ, gC, gF, gO);
        const b2 = lpFrontier(wC, wF, capJ, gC, gF);
        const indOf = (w, g) => { let m = Infinity; for (let j = 0; j < k; j++) { const aw = Math.abs(w[j]); if (aw > 1e-12) m = Math.min(m, capJ[j] / aw); } return m === Infinity ? 0 : m * g; };
        indC.push(indOf(wC, gC)); indF.push(indOf(wF, gF)); indO.push(indOf(wO, gO)); ind2.push(b2.obj);
        if (best.obj < b2.obj * (1 - 1e-6)) lpGe2d = false;
        let bind = -1, worst = -1;
        for (let j = 0; j < k; j++) { const part = Math.abs(best.GC * wC[j] + best.GF * wF[j] + best.GO * wO[j]) / oiV[j]; if (part > worst) { worst = part; bind = j; } }
        lp3rows.push({ GC: best.GC, GF: best.GF, GO: best.GO, gross: best.obj, oiShare: best.obj > 0 ? (gO * best.GO) / best.obj : 0, bind: names[bind] });
        posSeries.push(wC.map((x, j) => best.GC * x + best.GF * wF[j] + best.GO * wO[j]));
    }
    // LP-scheduled 3-book P&L: fee on actual dollars traded (so per-period re-optimisation is charged)
    const pnl = [], traded = [];
    const retsCommon = usedIdx; // parallel to lp3rows
    for (let t = 0; t < lp3rows.length; t++) {
        const idx = retsCommon[t];
        pnl.push(lp3rows[t].GC * aRetsC[idx] + lp3rows[t].GF * aRetsF[idx] + lp3rows[t].GO * aO[idx]);
        let tr = 0; for (let j = 0; j < k; j++) { const prev = t > 0 ? posSeries[t - 1][j] : 0; tr += Math.abs(posSeries[t][j] - prev); }
        traded.push(tr);
    }
    const net4 = pnl.map((x, t) => x - (FEE_BPS / 1e4) * traded[t]);
    const grossMean = mean(lp3rows.map((r) => r.gross));
    const turnFracGross = mean(traded) / grossMean * PPY;
    const oiShareMean = mean(lp3rows.map((r) => r.oiShare));
    const bindCount = {}; for (const r of lp3rows) bindCount[r.bind] = (bindCount[r.bind] || 0) + 1;
    const d3 = dist(lp3rows.map((r) => r.gross)); const d2 = dist(ind2);
    const indCd = dist(indC), indFd = dist(indF), indOd = dist(indO);
    const sum3 = indCd.mean + indFd.mean + indOd.mean;
    // all three at their individual compliant sizes: how badly does the combined book breach the cap?
    const bothAll = (() => {
        const parts = []; const binds = {};
        for (let t = 0; t < lp3rows.length; t++) {
            const p = retsCommon[t]; const legIdx = pairs[p].legIdx;
            const wC = rowsC[pairs[p].m], wF = rowsF[pairs[p].i], wO = aWBlend[p];
            const GC = indC[t], GF = indF[t], GO = indO[t];
            let peak = 0, bind = -1;
            for (let j = 0; j < k; j++) { const oiv = oiAtLeg[j][legIdx]; const pos = GC * wC[j] + GF * wF[j] + GO * wO[j]; const part = Math.abs(pos) / oiv; if (part > peak) { peak = part; bind = j; } }
            parts.push(peak); if (bind >= 0) binds[names[bind]] = (binds[names[bind]] || 0) + 1;
        }
        return { periods: parts.length, breachFrac: +(parts.filter((x) => x > F).length / parts.length).toFixed(3), peakParticipation: +Math.max(...parts).toFixed(3), bindingSymbols: binds };
    })();

    // ---- guards ----
    let e34 = null, e36 = null;
    try { e34 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e34_oi_scaled_sizing.json')); } catch (e) { e34 = null; }
    try { e36 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e36_portfolio_oi_frontier.json')); } catch (e) { e36 = null; }
    const e34C = e34 && e34.books ? e34.books['disp_lam0.02_cap12.5'].oiBoundSchedule.meanGcap : null;
    const e34F = e34 && e34.books ? e34.books['fade_lam0.1_cap12.5'].oiBoundSchedule.meanGcap : null;
    const e36Lp = e36 ? e36.verdict.lpMeanTotalGross : null;
    const rel = (a, b) => (a != null && b != null && b !== 0 ? Math.abs(a - b) / b : null);
    const relC = rel(indCd.mean, e34C), relF = rel(indFd.mean, e34F), rel2 = rel(d2.mean, e36Lp);
    const validation = {
        e34CarryOiMean: e34C, e34FadeOiMean: e34F, hereCarryOiMean: indCd.mean, hereFadeOiMean: indFd.mean,
        carryOiMeanRelDiff: relC == null ? null : +relC.toFixed(4), fadeOiMeanRelDiff: relF == null ? null : +relF.toFixed(4),
        e36LpMean: e36Lp, here2dLpMean: d2.mean, lp2dRelDiff: rel2 == null ? null : +rel2.toFixed(4),
        matchesE34: relC != null && relF != null && relC < 0.05 && relF < 0.05,
        matchesE36Lp: rel2 != null && rel2 < 0.05,
        lp3dAtLeastLp2d: lpGe2d,
        note: 'The two port-spec books must reproduce e34 meanGcap within 5 %, and the 2-D carry+fade LP mean e36 lpMean within 5 %. It is the same alignment grid, so the tolerance is only for float/rounding. The 3-D optimum must be >= the 2-D one (G_O = 0 is feasible).',
    };
    validation.validationPass = validation.matchesE34 && validation.matchesE36Lp && validation.lp3dAtLeastLp2d;

    const verdict = {
        note: 'Falsifier: the OI stream does NOT add if the optimal 3-D-LP OI share is ~0, or the carry+OI ladder never lifts net@4. It DOES add if the 3-D LP mean beats the 2-D LP mean with a material OI share.',
        periods: lp3rows.length,
        returnCorrWithCarry: corrOI_C, returnCorrWithFade: corrOI_F,
        bestLadderStep: ladder.reduce((b, x) => (x.net4Sharp > b.net4Sharp ? x : b), ladder[0]),
        ladderLiftsCarry: ladder[0].net4Sharp != null && ladder.some((x) => x.oiFrac > 0 && x.net4Sharp > ladder[0].net4Sharp + 1e-9),
        walkForwardOosNet4: +sharpe(wf.net).toFixed(2),
        pinnedCarryOnlyOosNet4: +wfPinned(0).toFixed(2), pinnedOI25OosNet4: +wfPinned(0.25).toFixed(2),
        oiPickedFractionFreq: oiPickFreq,
        lp3dMeanTotalGross: +grossMean.toFixed(0), lp3dMedianTotalGross: +d3.median.toFixed(0),
        lp2dMeanTotalGross: +d2.mean.toFixed(0),
        lp3dOverLp2dMean: +(grossMean / d2.mean).toFixed(3),
        sumOfThreeIndividualMeans: +sum3.toFixed(0),
        lp3dOverSum3: +(grossMean / sum3).toFixed(3),
        individualMeans: { carry: +indCd.mean.toFixed(0), fade: +indFd.mean.toFixed(0), oi: +indOd.mean.toFixed(0) },
        optimalOiShareMean: +oiShareMean.toFixed(3), optimalOiShareMedian: +quantile(lp3rows.map((r) => r.oiShare), 0.5).toFixed(3),
        oiShareOftenZero: lp3rows.filter((r) => r.oiShare < 1e-6).length / lp3rows.length,
        lp3dScheduledNet4: +sharpe(net4).toFixed(2), lp3dScheduledTurnoverFracOfGross: +turnFracGross.toFixed(1),
        allThreeAtIndividualBreach: bothAll,
        oiAdds: grossMean > d2.mean * 1.0001 && oiShareMean > 0.02,
        oiAddsRiskNormalised: maxSharpeRisk.oiFrac > 0.02,
        maxSharpeRiskNormalised: maxSharpeRisk,
        riskNormalisedMaxSharpeGainOverCarry: +(maxSharpeRisk.mixSharpe - sharpe(zC)).toFixed(2),
        riskNormalisedWalkForwardOosSharpe: +sharpe(riskWf.net).toFixed(2),
        carryOnlyRiskNormalisedFullSharpe: +sharpe(zC).toFixed(2),
        mixConventionVolRatioFadeOverCarry: +(volF / volC).toFixed(1),
        validationPass: validation.validationPass,
    };

    return {
        config: { symbols: k, symbolList: names, periods: lp3rows.length, pairPeriods: P, firstTop, firstOI, lookback, block, feeBps: FEE_BPS, f: F, oiSleeve: 'fixed 50/50 λ blend (F-46)', ebarCarry: +ebarC.toFixed(4), ebarFade: +ebarF.toFixed(4) },
        validation,
        returnAdditivity: { corrWithCarry: corrOI_C, corrWithFade: corrOI_F, ladder, risk, mixConvention, walkForward: { span: wf.net.length, oosNet4: +sharpe(wf.net).toFixed(2), picks: wf.picks, pickFrequency: oiPickFreq, pinnedCarryOnly: +wfPinned(0).toFixed(2), pinnedOI25: +wfPinned(0.25).toFixed(2) } },
        capacityAdditivity: {
            lp3dTotalGross: d3, lp2dTotalGross: d2,
            individualCarry: indCd, individualFade: indFd, individualOi: indOd,
            optimalShare: { mean: +oiShareMean.toFixed(3), median: +quantile(lp3rows.map((r) => r.oiShare), 0.5).toFixed(3), p5: +quantile(lp3rows.map((r) => r.oiShare), 0.05).toFixed(3), p95: +quantile(lp3rows.map((r) => r.oiShare), 0.95).toFixed(3) },
            bindingSymbols: bindCount, allThreeAtIndividual: bothAll,
            schedule: { net4Sharpe: +sharpe(net4).toFixed(2), grossSharpe: +sharpe(pnl).toFixed(2), turnoverFracOfGross: +turnFracGross.toFixed(1) },
        },
        verdict,
    };
}
