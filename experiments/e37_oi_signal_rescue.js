// E37 - CAN THE OI-CHANGE CROSS-SECTIONAL SIGNAL BE RESCUED? CYCLE-028 (L07, challenges F-28).
//
// F-28 closed open interest as a directional signal on TWO reads: the pooled next-8h IC of Δlog(OI) is
// 0.020 (≈ 0), and the cross-sectional book built in `e21` is churned to death — gross Sharpe **+0.96**
// but turnover **1501×/yr**, break-even **1.89 bps**, net@4 **−1.07**. So the lab has carried the line
// "do not port OI as a directional stream" (FOLD-BACK R7, THEORY §3).
//
// But the lab made exactly this mistake once before and corrected it: F-23 killed the funding-rank
// dispersion book on its *daily* 803×/yr turnover (break-even 1.87 bps), and F-24 showed that was the
// IMPLEMENTATION, not the signal — EWMA(0.1) weights cut turnover to 85×/yr and lifted the break-even to
// 12.78 bps (net@4 +3.55). The OI book's daily numbers (1501×/yr, 1.89 bps) are almost exactly the F-23
// pattern. This experiment gives the OI signal the F-24/F-37 treatment: the SAME book (`e21#xsBookImpl`,
// extracted this cycle and verified byte-identical) under an EWMA weight policy, swept from fast (0.5) to
// slow (0.01), and audited by `e16#audit` so gross/turnover/break-even/net are directly comparable.
//
// FALSIFIER (pre-registered, mirrors F-24/F-25/F-32). The OI signal is **unrescuable** if no smoothing
// policy reaches a break-even of 4 bps (i.e. net@4 > 0). If instead it clears the fee, F-28's "do not
// port OI as a directional stream" is FALSE for the smoothed construction, exactly as F-23 was for carry.
//
// GUARD. The daily (λ absent) sign +1 book must reproduce `e21`'s stored `dLogOI_pos` gross Sharpe and
// turnover to display precision. Sign is a PRIOR here, not a fit: F-28's pooled IC was +0.020, so sign +1
// is pre-registered; sign −1 is reported only as the control.

import { SYMBOLS, loadOpenInterest, flowIndexAt, pearsonCorrelation } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { xsBookImpl } from './e21_open_interest.js';
import { audit, turnoverSeries } from './e16_cost_capacity.js';

const PERIODS_PER_YEAR = 365 * 3;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const m = mean(v); const sd = Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); return sd > 0 ? (m / sd) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };

const LAMBDAS = [0.5, 0.25, 0.1, 0.05, 0.02, 0.01];

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList; const k = names.length;
    const times = s.times; const n = times.length; const legs = s.legs;
    const oi = await loadOpenInterest();

    const fieldBySym = (field) => names.map((nm) => { const o = oi[nm]; if (!o) return null; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o[field][idx] : null; } return arr; });
    const oiValBySym = fieldBySym('oiVal');
    const dlog = (arr, i) => { if (!arr) return null; const a = arr[i]; const b = arr[i - 1]; return (a > 0 && b > 0) ? Math.log(a / b) : null; };
    const dOIBySym = names.map((_, j) => times.map((_, i) => dlog(oiValBySym[j], i)));
    const firstAll = (sig) => { for (let i = 1; i < n - 1; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(sig[j][i])) all = false; if (all) return i; } return -1; };
    const firstOI = firstAll(dOIBySym);

    // ---- daily baseline (sign +1) reproduces e21#dLogOI_pos ----
    const daily = xsBookImpl(dOIBySym, { k, n, times, legs }, { sign: 1, from: firstOI, policy: { kind: 'daily' } });
    const dailyAudit = audit('dLogOI_daily', daily.rets, daily.weightRows);
    let e21 = null;
    try { e21 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e21_open_interest.json')); } catch (e) { e21 = null; }
    const e21b = e21 ? e21.signalBooks.dLogOI_pos : null;
    const validation = e21b ? {
        e21GrossSharpe: e21b.grossSharpe, hereGrossSharpe: dailyAudit.gross.sharpe,
        e21Turnover: e21b.turnoverAnnual, hereTurnover: dailyAudit.turnover.annualized,
        matchesE21: Math.abs(dailyAudit.gross.sharpe - e21b.grossSharpe) < 5e-3 && Math.abs(dailyAudit.turnover.annualized - e21b.turnoverAnnual) < 1,
        note: 'daily/sign+1 must reproduce e21#dLogOI_pos to display precision (xsBookImpl extraction).',
    } : null;

    // ---- smoothing ladder + sign control ----
    const auditOf = (b, tag) => {
        const a = audit(tag, b.rets, b.weightRows);
        const h = Math.floor(b.rets.length / 2);
        return {
            grossSharpe: +a.gross.sharpe.toFixed(3), turnoverAnnual: +a.turnover.annualized.toFixed(1),
            breakEvenBps: +a.breakEvenBps.toFixed(2),
            net4: +a.net['4'].sharpe.toFixed(2), net10: +a.net['10'] ? +a.net['10'].sharpe.toFixed(2) : null,
            halves: [+sharpe(b.rets.slice(0, h)).toFixed(2), +sharpe(b.rets.slice(h)).toFixed(2)],
        };
    };
    const ladder = {};
    const series = {};
    for (const lam of LAMBDAS) {
        const b = xsBookImpl(dOIBySym, { k, n, times, legs }, { sign: 1, from: firstOI, policy: { kind: 'ewma', lambda: lam, normalize: true } });
        ladder[`ewma_${lam}`] = auditOf(b, `dLogOI_ewma_${lam}`);
        const T = turnoverSeries(b.weightRows);
        series[lam] = { rets: b.rets, T, net4: b.rets.map((x, i) => x - 4e-4 * T[i]), bookTimes: b.bookTimes };
    }
    const signControl = auditOf(xsBookImpl(dOIBySym, { k, n, times, legs }, { sign: -1, from: firstOI, policy: { kind: 'daily' } }), 'dLogOI_neg');

    // Walk-forward λ selection (the F-37 test): choose λ by TRAILING net@4 only, trade it forward, and
    // compare the never-seen series to the pinned winners. This is the guard against picking λ=0.25 on
    // the window it is credited with.
    const P = series[LAMBDAS[0]].rets.length;
    const LOOKBACK = 1095, BLOCK = 365;
    const wf = { net4: [], picks: [] };
    { let r = LOOKBACK; while (r + BLOCK <= P) { let best = null; for (const lam of LAMBDAS) { const sc = sharpe(series[lam].net4.slice(r - LOOKBACK, r)); if (!Number.isFinite(sc)) continue; if (!best || sc > best.sc) best = { lam, sc }; } if (!best) break; for (let t = r; t < r + BLOCK; t++) wf.net4.push(series[best.lam].net4[t]); wf.picks.push({ at: new Date(series[LAMBDAS[0]].bookTimes[r]).toISOString().slice(0, 10), lambda: best.lam, trailingNet4: +best.sc.toFixed(2) }); r += BLOCK; } }
    const pinnedOos = (lam) => { const s = series[lam].net4.slice(LOOKBACK, LOOKBACK + wf.net4.length); return +sharpe(s).toFixed(2); };
    const wfSpan = wf.net4.length;
    const rec = Math.min(wfSpan, 2 * PERIODS_PER_YEAR);
    const feeStress = {};
    for (const fee of [4, 6, 8]) {
        const net = series[0.25].rets.slice(LOOKBACK, LOOKBACK + wfSpan).map((x, i) => x - (fee / 1e4) * series[0.25].T[i]);
        feeStress[`${fee}bps`] = { pinned025OosNet: +sharpe(net).toFixed(2), recent24m: +sharpe(net.slice(wfSpan - rec)).toFixed(2) };
    }

    // ---- per-year (best smoothing policy) + correlation with the funding-rank dispersion book ----
    const bestLam = LAMBDAS.reduce((best, lam) => (ladder[`ewma_${lam}`].net4 > ladder[`ewma_${best}`].net4 ? lam : best), LAMBDAS[0]);
    const bestBook = xsBookImpl(dOIBySym, { k, n, times, legs }, { sign: 1, from: firstOI, policy: { kind: 'ewma', lambda: bestLam, normalize: true } });
    const perYear = {}; const perYearNet4 = {}; { const by = {}; const byN = {}; for (let i = 0; i < bestBook.rets.length; i++) { const y = new Date(bestBook.bookTimes[i]).getUTCFullYear(); (by[y] = by[y] || []).push(bestBook.rets[i]); (byN[y] = byN[y] || []).push(series[bestLam].net4[i]); } for (const [y, a] of Object.entries(by)) perYear[y] = +sharpe(a).toFixed(2); for (const [y, a] of Object.entries(byN)) perYearNet4[y] = +sharpe(a).toFixed(2); }
    const bestH = Math.floor(bestBook.rets.length / 2);
    const netHalves = [+sharpe(series[bestLam].net4.slice(0, bestH)).toFixed(2), +sharpe(series[bestLam].net4.slice(bestH)).toFixed(2)];
    // correlation with the funding-rank (carry dispersion) book on the common grid (same `times[i]` index)
    const idxOf = new Map(); times.forEach((t, i) => idxOf.set(t, i));
    const xr = s.books.xsRank; const xrTimes = times.slice(1); // xsRank book period m ends at times[m+1]
    const xsByTime = new Map(); for (let m = 0; m < xr.length; m++) xsByTime.set(xrTimes[m], xr[m]);
    const a1 = [], a2 = [];
    for (let i = 0; i < bestBook.rets.length; i++) { const v = xsByTime.get(bestBook.bookTimes[i]); if (v !== undefined && Number.isFinite(bestBook.rets[i])) { a1.push(bestBook.rets[i]); a2.push(v); } }
    const corrWithCarry = a1.length > 50 ? +pearsonCorrelation(a1, a2).toFixed(3) : null;

    const best = ladder[`ewma_${bestLam}`];
    const rescue = LAMBDAS.reduce((n, lam) => n + (ladder[`ewma_${lam}`].breakEvenBps > 4 ? 1 : 0), 0);
    const verdict = {
        note: 'Falsifier: unrescuable if no smoothing policy reaches break-even 4 bps (net@4 > 0).',
        dailyBreakEvenBps: +dailyAudit.breakEvenBps.toFixed(2), dailyNet4: +dailyAudit.net['4'].sharpe.toFixed(2),
        bestLambda: bestLam, bestBreakEvenBps: best.breakEvenBps, bestNet4: best.net4, bestTurnoverAnnual: best.turnoverAnnual,
        policiesClearing4bps: rescue,
        rescued: rescue > 0,
        f28StandsForSmoothedBook: rescue === 0,
        walkForwardOosNet4: +sharpe(wf.net4).toFixed(2),
        pinned025OosNet4: pinnedOos(0.25), pinned01OosNet4: pinnedOos(0.1),
        signControlNet4: signControl.net4,
        validationPass: validation ? validation.matchesE21 : null,
    };

    return {
        config: { symbols: k, symbolList: names, firstOI, periods: daily.rets.length, lambdas: LAMBDAS, sign: '+1 (prior from F-28 pooled IC 0.020)', feeBps: 4, lookback: LOOKBACK, block: BLOCK },
        validation,
        daily: { grossSharpe: +dailyAudit.gross.sharpe.toFixed(3), turnoverAnnual: +dailyAudit.turnover.annualized.toFixed(1), breakEvenBps: +dailyAudit.breakEvenBps.toFixed(2), net4: +dailyAudit.net['4'].sharpe.toFixed(2) },
        ladder,
        signControl,
        best: { lambda: bestLam, ...best, netHalves, perYear, perYearNet4, correlationWithCarry: corrWithCarry },
        walkForward: { span: wfSpan, oosNet4: +sharpe(wf.net4).toFixed(2), picks: wf.picks, pickFrequency: wf.picks.reduce((m, p) => (m[p.lambda] = (m[p.lambda] || 0) + 1, m), {}) },
        feeStress,
        verdict,
    };
}
