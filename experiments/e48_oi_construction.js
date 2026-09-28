// E48 - L19's LAST CONSTRUCTION THREAD: hold-N CADENCE AND NON-EQUAL TWO-SCALE BLENDS. CYCLE-039 (L19).
//
// L19's remaining open action was a *construction* question (not another fitted rule): "a `hold-N` cadence
// and a cost-optimal two-scale blend — does a fixed non-equal mix beat 50/50, still without selecting a
// single λ?" F-45 found the OI-change book needs smoothing (EWMA); F-46 found the two pre-registered scales
// λ∈{0.1, 0.25} are anti-phase year-to-year and a fixed 50/50 blend is positive every year 2022–26
// (net@4 +0.77 full, break-even 11.33 bps). This experiment asks whether a *construction* improves on that:
//
//   holdN     recompute the EWMA weights only every N periods, hold in between (a cheaper cadence)
//   blend(w)  a fixed weight w on λ=0.1 and (1−w) on λ=0.25 (the F-46 blend is w=0.5)
//   volblend  w chosen by inverse trailing vol on [0,S) only, then scored [S,end) — a NO-HINDSIGHT blend
//
// Guard: the daily sign+1 book must reproduce e21#dLogOI_pos (gross 0.9612 / turnover 1501.11).
//
// PRE-REGISTERED READ. The construction ADDS if it beats the F-46 50/50 blend's full net@4 (+0.77) while
// keeping break-even >= 8 bps and staying positive in every calendar year — under a rule that is either
// unfitted (hold-N) or fitted only on [0, S) (inverse-vol blend). A null result closes the construction
// thread with the honest answer: F-46's fixed 50/50 blend is the best the signal supports.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { xsBookImpl } from './e21_open_interest.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const NEXT = 2;
const LAMBDAS = [0.1, 0.25];
const HOLDS = [3, 6, 9, 18, 36];
const BLEND_WEIGHTS = [0.3, 0.4, 0.5, 0.6, 0.7];

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sdOf = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sdOf(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);

const holdN = (rows, N) => { let held = rows[0].slice(); return rows.map((w, i) => { if (i % N === 0) held = w.slice(); return held.slice(); }); };
const normRow = (v) => { const g = v.reduce((a, x) => a + Math.abs(x), 0) || 1; return v.map((x) => x / g); };
const blendRows = (A, B, wA) => A.map((w, i) => normRow(w.map((x, j) => wA * x + (1 - wA) * B[i][j])));

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList;
    const k = names.length;
    const times = s.times;
    const n = times.length;
    const legs = s.legs;

    const oi = await loadOpenInterest();
    const oiValBySym = names.map((nm) => { const o = oi[nm]; if (!o) return null; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.oiVal[idx] : null; } return arr; });
    const dlog = (arr, i) => { if (!arr) return null; const a = arr[i]; const b = arr[i - 1]; return (a > 0 && b > 0) ? Math.log(a / b) : null; };
    const dOI = names.map((_, j) => times.map((_, i) => dlog(oiValBySym[j], i)));
    let firstOI = -1; for (let i = 1; i < n - 1; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(dOI[j][i])) all = false; if (all) { firstOI = i; break; } }
    const loopStart = Math.max(1, firstOI);

    const mk = (lam) => xsBookImpl(dOI, { k, n, times, legs, NEXT }, { sign: 1, from: firstOI, policy: { kind: 'ewma', lambda: lam, normalize: true } });

    const retsFor = (rows) => rows.map((w, i) => w.reduce((a, x, j) => a + x * (legs.spotRet[loopStart + NEXT + i] && Number.isFinite(legs.spotRet[loopStart + NEXT + i][j]) ? legs.spotRet[loopStart + NEXT + i][j] : 0), 0));
    const metricsOf = (rows, bookTimes) => { const rets = retsFor(rows); const T = turnoverSeries(rows); const net4 = rets.map((r, i) => r - (FEE_BPS / 1e4) * T[i]); const byYear = {}; bookTimes.forEach((t, i) => { const y = new Date(t).getUTCFullYear(); (byYear[y] = byYear[y] || []).push(i); }); const perYearNet4 = {}; for (const [y, idx] of Object.entries(byYear)) perYearNet4[y] = r2(sharpe(idx.map((i) => net4[i]))); return { grossSharpe: r2(sharpe(rets)), net4Sharpe: r2(sharpe(net4)), turnoverAnnual: Math.round(mean(T) * PPY), breakEvenBps: mean(T) > 0 ? r2((mean(rets) * 1e4) / mean(T)) : null, perYearNet4, positiveEveryYear: Object.keys(perYearNet4).filter((y) => +y >= 2022).every((y) => perYearNet4[y] > 0) }; };

    // guard: daily sign+1 reproduces e21#dLogOI_pos
    const dailyBook = xsBookImpl(dOI, { k, n, times, legs, NEXT }, { sign: 1, from: firstOI, policy: { kind: 'daily' } });
    const dailyAudit = metricsOf(dailyBook.weightRows, dailyBook.bookTimes);
    let e21 = null; try { e21 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e21_open_interest.json')); } catch (e) { e21 = null; }
    const e21b = e21 ? e21.signalBooks.dLogOI_pos : null;
    const validation = e21b ? { e21Gross: e21b.grossSharpe, hereGross: dailyAudit.grossSharpe, e21Turnover: e21b.turnoverAnnual, hereTurnover: dailyAudit.turnoverAnnual, matchesE21: Math.abs(dailyAudit.grossSharpe - e21b.grossSharpe) < 5e-3 && Math.abs(dailyAudit.turnoverAnnual - e21b.turnoverAnnual) < 1, note: 'daily/sign+1 must reproduce e21#dLogOI_pos.' } : null;

    const books = {};
    const base = {}; for (const lam of LAMBDAS) { const b = mk(lam); base[lam] = b; books[`ewma_${lam}`] = { kind: 'base', lam, ...metricsOf(b.weightRows, b.bookTimes) }; }
    // F-46 50/50 blend baseline
    const blend50Rows = blendRows(base[0.1].weightRows, base[0.25].weightRows, 0.5);
    books['blend_50_50'] = { kind: 'blend', wD1: 0.5, ...metricsOf(blend50Rows, base[0.1].bookTimes) };
    // hold-N on each λ and on the 50/50 blend
    for (const lam of LAMBDAS) for (const N of HOLDS) books[`ewma_${lam}_hold${N}`] = { kind: 'hold', lam, N, ...metricsOf(holdN(base[lam].weightRows, N), base[lam].bookTimes) };
    for (const N of HOLDS) books[`blend50_hold${N}`] = { kind: 'hold', blend: 0.5, N, ...metricsOf(holdN(blend50Rows, N), base[0.1].bookTimes) };
    // fixed non-equal blends
    for (const w of BLEND_WEIGHTS) books[`blend_${w}_${+(1 - w).toFixed(1)}`] = { kind: 'blend', wD1: w, ...metricsOf(blendRows(base[0.1].weightRows, base[0.25].weightRows, w), base[0.1].bookTimes) };

    // no-hindsight inverse-vol blend: choose w on [0,S) by inverse trailing vol of the two λ, score [S,end)
    const S = 2555; // ~2.3 y, the freeze boundary F-49/F-55 identified
    const volOf = (bk) => sdOf(bk.rets.slice(0, S));
    const v1 = volOf(base[0.1]); const v25 = volOf(base[0.25]);
    const wInv = (1 / v1) / ((1 / v1) + (1 / v25));
    const volBlendRows = blendRows(base[0.1].weightRows, base[0.25].weightRows, wInv);
    const volBlendM = metricsOf(volBlendRows, base[0.1].bookTimes);
    const retsVol = retsFor(volBlendRows).slice(S); const rets50 = retsFor(blend50Rows).slice(S);
    const oos = { S, wChosen: r2(wInv), volBlendOosNet4: r2(sharpe(retsVol.map((r, i) => r - (FEE_BPS / 1e4) * turnoverSeries(volBlendRows).slice(S)[i]))), blend50OosNet4: r2(sharpe(rets50.map((r, i) => r - (FEE_BPS / 1e4) * turnoverSeries(blend50Rows).slice(S)[i]))) };
    books['volblend_nohindsight'] = { kind: 'volblend', wChosen: r2(wInv), ...volBlendM };

    const b50 = books['blend_50_50'];
    // guard #2: the renormalised 50/50 blend must reproduce F-46's e38 ensemble (0.77 / 11.33 / 254)
    let e38 = null; try { e38 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e38_oi_signal_holdout.json')); } catch (e) { e38 = null; }
    const f46 = e38 ? e38.splits.ensemble.lam_50_50.full : null;
    const blendGuard = f46 ? { f46Net4: f46.net4, hereNet4: b50.net4Sharpe, f46Turnover: f46.turnoverAnnual, hereTurnover: b50.turnoverAnnual, f46BreakEven: f46.breakEvenBps, hereBreakEven: b50.breakEvenBps, matchesF46: Math.abs(b50.net4Sharpe - f46.net4) < 0.02 && Math.abs(b50.turnoverAnnual - f46.turnoverAnnual) < 2 && Math.abs(b50.breakEvenBps - f46.breakEvenBps) < 0.3, note: 'renormalised 50/50 lambda blend must reproduce F-46 (e38 ensemble.lam_50_50.full).' } : null;
    const holdBest = Object.entries(books).filter(([nm, x]) => x.kind === 'hold').sort((a, b) => (b[1].net4Sharpe || -1e9) - (a[1].net4Sharpe || -1e9))[0];
    const blendBest = Object.entries(books).filter(([nm, x]) => x.kind === 'blend').sort((a, b) => (b[1].net4Sharpe || -1e9) - (a[1].net4Sharpe || -1e9))[0];

    const verdict = {
        note: 'L19 construction: does a hold-N cadence or a non-equal two-scale blend beat the F-46 50/50 blend, without a fitted rule?',
        blend50_net4: b50.net4Sharpe, blend50_breakEven: b50.breakEvenBps, blend50_positiveEveryYear: b50.positiveEveryYear,
        bestHold: holdBest ? { name: holdBest[0], net4: holdBest[1].net4Sharpe, breakEven: holdBest[1].breakEvenBps, turnover: holdBest[1].turnoverAnnual } : null,
        holdAdds: holdBest ? (holdBest[1].net4Sharpe > b50.net4Sharpe + 0.05 && holdBest[1].breakEvenBps >= 8 && holdBest[1].positiveEveryYear) : false,
        bestBlend: blendBest ? { name: blendBest[0], net4: blendBest[1].net4Sharpe, breakEven: blendBest[1].breakEvenBps } : null,
        blendAdds: blendBest ? (blendBest[1].net4Sharpe > b50.net4Sharpe + 0.05) : false,
        noHindsightBlend: oos,
        noHindsightBeats50: oos.volBlendOosNet4 > oos.blend50OosNet4 + 0.05,
        blend50_matchesF46: blendGuard ? blendGuard.matchesF46 : null,
        validationPass: (validation ? validation.matchesE21 === true : true) && (blendGuard ? blendGuard.matchesF46 === true : true),
    };

    return { config: { symbols: k, symbolList: names, periods: base[0.1].weightRows.length, firstOI, lambdas: LAMBDAS, holds: HOLDS, split: S, feeBps: FEE_BPS }, validation, blendGuard, books, verdict };
}
