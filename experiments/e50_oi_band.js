// E50 - THE OI SLEEVE'S *SMOOTH* COST TOOL: A NO-TRADE BAND. CYCLE-041 (L19). Tests F-56/F-57.
//
// F-56 found a hold-6 cadence lifts the F-46 50/50 OI blend's net@4 0.77 -> 0.87; F-57 then showed the gain is
// a fine-grid SPIKE, not a plateau -- the hold cadence "wins" only at hand-picked N and its curve is jagged.
// The band's own failure mode is exactly that aliasing: a hold ignores fresh information until the clock says
// so, and the resulting Sharpe is a noisy function of N. The lab's *proven* turnover tool is the no-trade band
// (F-52/F-53) -- per symbol, move only when the target has moved more than eps from what is held. It is
// state-dependent (it rebalances exactly when the signal really moves), so it should degrade GRACEFULLY.
//
// This experiment ports the F-52/F-53 band onto the OI sleeve and asks the questions F-56/F-57 raised:
//
//   (1) At the turnover hold-6 achieves (93x/yr), does a band match or beat 0.87 net@4?
//   (2) Is the band's net@4-vs-turnover curve SMOOTH (the construction you would actually deploy), or is it
//       as jagged as hold-N's? (the F-55/F-57 lesson applied to a construction)
//
// Guards: the daily sign+1 book reproduces e21#dLogOI_pos (0.9612 / 1501.11); the renormalised 50/50 blend
// reproduces F-46's e38 ensemble (0.77 / 11.33 / 254) and e48's artefact.
//
// PRE-REGISTERED READ.
//   BAND-ADDS  if some swept eps reads net@4 >= daily + 0.05, is positive every year 2022-26, AND at its
//              turnover the turnover-matched hold-N reads no more than 0.02 above it (band >= matched hold).
//   BAND-SMOOTH if, ordering the band sweep by turnover, net@4 never falls more than 0.05 below a prior
//              peak and then re-rises (no interior spike) -- i.e. the curve is monotone-after-its-peak.
// A `bandWins` count (eps where band >= matched hold + 0.02) summarises the head-to-head.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { xsBookImpl } from './e21_open_interest.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const NEXT = 2;
const LAMBDAS = [0.1, 0.25];
const HOLDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 24, 30, 36];
const EPS_GRID = [0.0005, 0.001, 0.0015, 0.002, 0.003, 0.004, 0.005, 0.006, 0.008, 0.010, 0.013, 0.016, 0.020, 0.025, 0.030, 0.040, 0.060, 0.100];

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sdOf = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sdOf(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null); const r3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null);
const normRow = (v) => { const g = v.reduce((a, x) => a + Math.abs(x), 0) || 1; return v.map((x) => x / g); };
const holdTargets = (rows, N) => { let held = rows[0].slice(); return rows.map((w, i) => { if (i % N === 0) held = w.slice(); return held.slice(); }); };
const applyBand = (weightRows, eps) => { let held = weightRows[0].slice(); return weightRows.map((w) => { const out = w.map((x, j) => (Math.abs(x - held[j]) > eps ? x : held[j])); held = out; return out; }); };

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
    const metrics = (rows) => { const rets = rows.map((w, i) => w.reduce((a, x, j) => a + x * fin(retAt(i)[j]), 0)); const T = turnoverSeries(rows); const net4 = rets.map((r, i) => r - (FEE_BPS / 1e4) * T[i]); const py = perYearFrom(net4, bookTimes); return { grossSharpe: r2(sharpe(rets)), net4: r2(sharpe(net4)), net4Raw: sharpe(net4), turnoverAnnual: Math.round(mean(T) * PPY), breakEvenBps: mean(T) > 0 ? r2((mean(rets) * 1e4) / mean(T)) : null, perYearNet4: py, positiveEveryYear: Object.keys(py).filter((y) => +y >= 2022).every((y) => py[y] > 0) }; };

    // guard: the daily blend reproduces F-46 (e38/e48)
    const base = metrics(blendRows);
    let e48 = null; try { e48 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e48_oi_construction.json')); } catch (e) { e48 = null; }
    const g = e48 ? e48.books.blend_50_50 : null;
    const validation = { e21Gross: +dailyGross.toFixed(4), e21Turnover: dailyTurn, e21Matches: Math.abs(dailyGross - 0.9612203471681686) < 5e-3 && Math.abs(dailyTurn - 1501) < 1, f46Net4: g ? g.net4Sharpe : null, hereNet4: base.net4, f46Turnover: g ? g.turnoverAnnual : null, hereTurnover: base.turnoverAnnual, f46Matches: g ? (Math.abs(base.net4 - g.net4Sharpe) < 0.02 && Math.abs(base.turnoverAnnual - g.turnoverAnnual) < 2) : null, note: 'daily book = e21#dLogOI_pos; 50/50 blend = F-46 (e38/e48).' };

    // ---- the band sweep + the hold grid (the comparison baseline) ----
    const bandSweep = EPS_GRID.map((eps) => { const m = metrics(applyBand(blendRows, eps)); return { eps, ...m }; });
    const holdGrid = HOLDS.map((N) => ({ N, ...metrics(holdTargets(blendRows, N)) }));
    const bestHold = holdGrid.filter((x) => x.N > 1).reduce((a, b) => (b.net4Raw > a.net4Raw ? b : a));
    const matchedHold = (turn) => holdGrid.reduce((a, b) => (Math.abs(b.turnoverAnnual - turn) < Math.abs(a.turnoverAnnual - turn) ? b : a));

    const rows = bandSweep.map((b) => { const h = matchedHold(b.turnoverAnnual); return { eps: b.eps, turn: b.turnoverAnnual, net4: b.net4, net4Raw: b.net4Raw, be: b.breakEvenBps, posEvery: b.positiveEveryYear, holdN: h.N, holdNet4: h.net4, bandMinusHold: r2(b.net4Raw - h.net4Raw) }; });

    const bestBand = bandSweep.reduce((a, b) => (b.net4Raw > a.net4Raw ? b : a));
    const bandAdds = bestBand.net4Raw >= base.net4Raw + 0.05 && bestBand.positiveEveryYear && rows.some((r) => r.eps === bestBand.eps && r.bandMinusHold >= -0.02);
    const bandWins = rows.filter((r) => r.bandMinusHold >= 0.02).length;

    // smoothness: order by turnover (ascending) and count interior "spikes" -- a rise of >0.05 above the
    // running peak after first having fallen, i.e. a re-riser. Fewer = smoother.
    const byTurn = bandSweep.slice().sort((a, b) => a.turnoverAnnual - b.turnoverAnnual);
    let peak = -Infinity; let fell = false; let reRisers = 0; let maxDip = 0;
    for (const b of byTurn) { if (b.net4Raw > peak + 0.05) { if (fell) { reRisers++; } peak = Math.max(peak, b.net4Raw); fell = false; } else if (b.net4Raw < peak - 0.05) { fell = true; maxDip = Math.max(maxDip, peak - b.net4Raw); } }
    const holdByTurn = holdGrid.slice().sort((a, b) => a.turnoverAnnual - b.turnoverAnnual);
    let hpeak = -Infinity; let hfell = false; let hReRisers = 0;
    for (const h of holdByTurn) { if (h.net4Raw > hpeak + 0.05) { if (hfell) { hReRisers++; } hpeak = Math.max(hpeak, h.net4Raw); hfell = false; } else if (h.net4Raw < hpeak - 0.05) { hfell = true; } }
    const bandSmooth = reRisers === 0; const holdSmooth = hReRisers === 0;

    // plateau: how many band eps sit within 0.05 of the best, and are the best's eps-neighbours close?
    const bandPlateauCount = bandSweep.filter((b) => b.net4Raw >= bestBand.net4Raw - 0.05).length;
    const bIdx = bandSweep.findIndex((b) => b.eps === bestBand.eps);
    const bn = [bandSweep[bIdx - 1], bandSweep[bIdx + 1]].filter(Boolean);
    const bandNeighboursClose = bn.length > 0 && bn.every((b) => b.net4Raw >= bestBand.net4Raw - 0.05);
    const bandPlateauRobust = bandPlateauCount >= 3 && bandNeighboursClose;

    const verdict = {
        note: 'Port the no-trade band onto the OI sleeve: at matched turnover does it match/beat hold-6, and is its curve smoother than hold-N?',
        daily: { net4: base.net4, turn: base.turnoverAnnual },
        hold6: { N: bestHold.N, net4: bestHold.net4, turn: bestHold.turnoverAnnual, positiveEveryYear: bestHold.positiveEveryYear },
        bestBand: { eps: bestBand.eps, net4: bestBand.net4, turn: bestBand.turnoverAnnual, be: bestBand.breakEvenBps, positiveEveryYear: bestBand.positiveEveryYear },
        bandWins, bandAdds, bandSmooth, holdSmooth, bandReRisers: reRisers, holdReRisers: hReRisers, bandMaxDip: r2(maxDip),
        bandPlateauCount, bandNeighboursClose, bandPlateauRobust,
        matchedAtBestEps: rows.find((r) => r.eps === bestBand.eps) || null,
        validationPass: (validation.e21Matches === true) && (validation.f46Matches === true),
    };

    return { config: { symbols: k, symbolList: names, periods: blendRows.length, firstOI, holds: HOLDS, eps: EPS_GRID, feeBps: FEE_BPS }, validation, base, bandSweep, holdGrid, rows, verdict };
}
