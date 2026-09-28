// E49 - STRESSING F-56: IS hold-6 A SPIKE, AND DOES THE HOLD GAIN SURVIVE A DRIFT-AWARE BACKTEST? CYCLE-040 (L19).
//
// F-56 (CYCLE-039) found that holding the F-46 50/50 OI blend's target for ~6 periods (2 days) lifts net@4
// 0.77 -> 0.87, because turnover falls 254 -> 93x/yr while the gross Sharpe only falls 1.18 -> 1.03. Two
// things could make that a mirage:
//
//   (1) SPIKE. HOLDS was the five-point grid {3,6,9,18,36}; the best (hold-6) is the max of a coarse grid.
//       A fine grid N in 1..12 (+15/18/24/30/36) shows whether the gain is a plateau or a knife-edge.
//   (2) DRIFT. The lab's turnover measure is `turnoverSeries` = sum_t |target_t - target_{t-1}|. For a HOLD
//       policy the target is unchanged between updates, so that measure is ~0 there -- but a real book that
//       does NOT rebalance lets its weights DRIFT with returns, and must trade the drift back at the next
//       update. This experiment simulates the true hold: weights drift w'_j = w_j(1+r_j)/(1+R), the book is
//       rebalanced to the new target only at updates, and turnover counts the drift correction. It then
//       compares the drift-aware net@4 to the (optimistic) target-change net@4.
//
// Guards: the daily sign+1 book reproduces e21#dLogOI_pos (0.9612 / 1501.11); the renormalised 50/50 blend
// reproduces F-46's e38 ensemble (0.77 / 11.33 / 254) and e48's own artefact.
//
// PRE-REGISTERED READ (both must hold, else F-56 is downgraded):
//   GRID-ROBUST  if >= 3 fine-grid holds (N > 1) beat the daily baseline by >= 0.05 net@4 AND the best hold's
//                immediate grid neighbours are within 0.05 of it (no isolated spike).
//   DRIFT-ROBUST if the best hold's DRIFT-AWARE net@4 still beats the drift-aware daily baseline by >= 0.05
//                and is positive in every calendar year 2022-26.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { xsBookImpl } from './e21_open_interest.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const NEXT = 2;
const LAMBDAS = [0.1, 0.25];
const HOLDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 24, 30, 36];

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sdOf = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sdOf(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null); const r3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null);
const normRow = (v) => { const g = v.reduce((a, x) => a + Math.abs(x), 0) || 1; return v.map((x) => x / g); };
const holdTargets = (rows, N) => { let held = rows[0].slice(); return rows.map((w, i) => { if (i % N === 0) held = w.slice(); return held.slice(); }); };

// Drift-aware simulation. `retAt(i)` gives the per-asset return aligned to the target row i. At an update
// (i % N === 0) the book trades from its DRIFTED prior weights to the new target; between updates it holds,
// so the weights drift with returns. Turnover = sum of the absolute trade at each period (0 between updates).
const driftSim = (targets, N, retAt) => {
    const rets = []; const T = [];
    let w = null; let wEnd = null;
    for (let i = 0; i < targets.length; i++) {
        const tgt = targets[i];
        if (i % N === 0 || w === null) {
            const trade = wEnd === null ? tgt : tgt.map((x, j) => x - wEnd[j]);
            T.push(trade.reduce((a, x) => a + Math.abs(x), 0));
            w = tgt.slice();
        } else { T.push(0); }
        const rv = retAt(i);
        let R = 0; for (let j = 0; j < w.length; j++) R += w[j] * (Number.isFinite(rv[j]) ? rv[j] : 0);
        rets.push(R);
        const denom = 1 + R;
        wEnd = w.map((wj, j) => (denom !== 0 ? (wj * (1 + (Number.isFinite(rv[j]) ? rv[j] : 0))) / denom : wj));
        w = wEnd;
    }
    return { rets, T };
};

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
    const b1 = mk(0.1); const b25 = mk(0.25);
    const blendRows = b1.weightRows.map((w, i) => normRow(w.map((x, j) => 0.5 * x + 0.5 * b25.weightRows[i][j])));
    const bookTimes = b1.bookTimes;
    const retAt = (i) => legs.spotRet[loopStart + NEXT + i] || new Array(k).fill(0);

    const dailyBook = xsBookImpl(dOI, { k, n, times, legs, NEXT }, { sign: 1, from: firstOI, policy: { kind: 'daily' } });
    const dailyGross = sharpe(dailyBook.rets); const dailyTurn = Math.round(mean(turnoverSeries(dailyBook.weightRows)) * PPY);

    const perYearFrom = (net, bt) => { const by = {}; bt.forEach((t, i) => { const y = new Date(t).getUTCFullYear(); (by[y] = by[y] || []).push(net[i]); }); const out = {}; for (const [y, a] of Object.entries(by)) out[y] = r2(sharpe(a)); return out; };
    const labMetrics = (rows) => { const rets = rows.map((w, i) => w.reduce((a, x, j) => a + x * fin(retAt(i)[j]), 0)); const T = turnoverSeries(rows); const net4 = rets.map((r, i) => r - (FEE_BPS / 1e4) * T[i]); const py = perYearFrom(net4, bookTimes); return { grossSharpe: r2(sharpe(rets)), net4: r2(sharpe(net4)), net4Raw: sharpe(net4), turnoverAnnual: Math.round(mean(T) * PPY), breakEvenBps: mean(T) > 0 ? r2((mean(rets) * 1e4) / mean(T)) : null, perYearNet4: py, positiveEveryYear: Object.keys(py).filter((y) => +y >= 2022).every((y) => py[y] > 0) }; };
    const driftMetrics = (rows, N) => { const d = driftSim(rows, N, retAt); const net4 = d.rets.map((r, i) => r - (FEE_BPS / 1e4) * d.T[i]); const py = perYearFrom(net4, bookTimes); return { grossSharpe: r2(sharpe(d.rets)), net4: r2(sharpe(net4)), net4Raw: sharpe(net4), turnoverAnnual: Math.round(mean(d.T) * PPY), breakEvenBps: mean(d.T) > 0 ? r2((mean(d.rets) * 1e4) / mean(d.T)) : null, perYearNet4: py, positiveEveryYear: Object.keys(py).filter((y) => +y >= 2022).every((y) => py[y] > 0) }; };

    // guard 1: blend_50_50 lab metrics vs F-46 (e38) / e48
    const base50 = labMetrics(blendRows);
    let e48 = null; try { e48 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e48_oi_construction.json')); } catch (e) { e48 = null; }
    const g = e48 ? e48.books.blend_50_50 : null;
    const validation = { e21Gross: +dailyGross.toFixed(4), e21Turnover: dailyTurn, e21Matches: Math.abs(dailyGross - 0.9612203471681686) < 5e-3 && Math.abs(dailyTurn - 1501) < 1, f46Net4: g ? g.net4Sharpe : null, hereNet4: base50.net4, f46Turnover: g ? g.turnoverAnnual : null, hereTurnover: base50.turnoverAnnual, f46Matches: g ? (Math.abs(base50.net4 - g.net4Sharpe) < 0.02 && Math.abs(base50.turnoverAnnual - g.turnoverAnnual) < 2) : null, note: 'daily book = e21#dLogOI_pos; 50/50 blend = F-46 (e38/e48).' };

    const grid = {};
    for (const N of HOLDS) { const rows = holdTargets(blendRows, N); grid[N] = { lab: labMetrics(rows), drift: driftMetrics(rows, N) }; }

    const dailyLabNet = grid[1].lab.net4Raw; const dailyDriftNet = grid[1].drift.net4Raw;
    const holdsGt1 = HOLDS.filter((N) => N > 1);
    const bestLab = holdsGt1.reduce((a, N) => (grid[N].lab.net4Raw > grid[a].lab.net4Raw ? N : a), holdsGt1[0]);
    const bestDrift = holdsGt1.reduce((a, N) => (grid[N].drift.net4Raw > grid[a].drift.net4Raw ? N : a), holdsGt1[0]);
    const beaters = holdsGt1.filter((N) => grid[N].lab.net4Raw >= dailyLabNet + 0.05);
    const driftBeaters = holdsGt1.filter((N) => grid[N].drift.net4Raw >= dailyDriftNet + 0.05);
    const present = new Set(HOLDS);
    const neigh = [bestLab - 1, bestLab + 1].filter((N) => present.has(N));
    const neighClose = neigh.length > 0 && neigh.every((N) => grid[N].lab.net4Raw >= grid[bestLab].lab.net4Raw - 0.05);
    const gridRobust = beaters.length >= 3 && neighClose;
    const driftRobust = grid[bestDrift].drift.net4Raw >= dailyDriftNet + 0.05 && grid[bestDrift].drift.positiveEveryYear;
    const spikeGap = neigh.length ? r2(grid[bestLab].lab.net4Raw - Math.max(...neigh.map((N) => grid[N].lab.net4Raw))) : null;
    const short = HOLDS.filter((N) => N >= 2 && N <= 9); const longN = HOLDS.filter((N) => N >= 10 && N <= 24);
    const shortMean = r2(mean(short.map((N) => grid[N].lab.net4Raw))); const longMean = r2(mean(longN.map((N) => grid[N].lab.net4Raw)));
    const driftCurve = HOLDS.map((N) => ({ N, lab: grid[N].lab.net4, drift: grid[N].drift.net4 }));

    const verdict = {
        note: 'F-56 stress: is the hold gain a plateau, and does it survive a drift-aware (true-hold) backtest?',
        daily: { labNet4: grid[1].lab.net4, labTurn: grid[1].lab.turnoverAnnual, driftNet4: grid[1].drift.net4, driftTurn: grid[1].drift.turnoverAnnual, driftDrag: r2(grid[1].drift.net4Raw - dailyLabNet) },
        bestLabHold: { N: bestLab, net4: grid[bestLab].lab.net4, turn: grid[bestLab].lab.turnoverAnnual, breakEven: grid[bestLab].lab.breakEvenBps, positiveEveryYear: grid[bestLab].lab.positiveEveryYear },
        gridBeaters: beaters, driftBeaters, neighbours: neigh, neighboursClose: neighClose, spikeGap, gridRobust,
        shortHoldMean: shortMean, longHoldMean: longMean,
        bestDriftHold: { N: bestDrift, net4: grid[bestDrift].drift.net4, turn: grid[bestDrift].drift.turnoverAnnual, breakEven: grid[bestDrift].drift.breakEvenBps, positiveEveryYear: grid[bestDrift].drift.positiveEveryYear },
        driftRobust,
        driftTurnoverMatches: HOLDS.every((N) => Math.abs(grid[N].drift.turnoverAnnual - grid[N].lab.turnoverAnnual) <= 2),
        driftCurve,
        validationPass: (validation.e21Matches === true) && (validation.f46Matches === true) && Number.isFinite(grid[1].drift.net4Raw),
    };

    return { config: { symbols: k, symbolList: names, periods: blendRows.length, firstOI, holds: HOLDS, feeBps: FEE_BPS }, validation, daily: { gross: r3(dailyGross), turnover: dailyTurn }, grid, verdict };
}
