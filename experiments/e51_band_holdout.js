// E51 - IS THE OI SLEEVE'S BAND ROBUST OUT OF SAMPLE? THE F-49/F-55 DENSE-SPLIT TREATMENT FOR eps vs N. CYCLE-042 (L19).
//
// F-58 found the no-trade band (eps=0.03) lifts the OI blend's net@4 to 0.92 as a smooth plateau, beating the
// hold cadence's spike. But both were chosen looking at the FULL curve -- and F-49/F-55 taught the lab that a
// parameter chosen on a trailing window must be *frozen* and scored forward, and PROTOCOL §3 rule 10 says a
// construction chosen from a grid needs a fine-grid + neighbours pass. This experiment runs the dense-split
// holdout for BOTH tools on the OI sleeve:
//
//   for each split S: pick eps* (band) and N* (hold) by in-sample [0,S) net@4, then score [S,end).
//   baselines: fixed eps=0.03, fixed hold-6, and the daily blend.
//
// It answers: when you are NOT allowed to look at the OOS span, does the band still beat the cadence and the
// daily book? Is the band's chosen eps stable, or does it wander (the sign of a fitted pick)?
//
// Guards: daily sign+1 = e21#dLogOI_pos (0.9612 / 1501.11); the renormalised 50/50 blend = F-46 (0.77 /
// 11.33 / 254) and e48's artefact.
//
// PRE-REGISTERED READ.
//   BAND-ROBUST if (a) the frozen-eps band's OOS net@4 >= the frozen-N hold's at >= 60% of splits, (b) it is
//   >= the daily blend at >= 60% of splits, and (c) the chosen eps takes at most 3 distinct values across the
//   grid (a stable pick). Otherwise the band's advantage is itself a full-sample artefact.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { xsBookImpl } from './e21_open_interest.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const NEXT = 2;
const LAMBDAS = [0.1, 0.25];
const EPS_GRID = [0.005, 0.010, 0.016, 0.020, 0.025, 0.030, 0.040, 0.060, 0.100];
const HOLD_GRID = [1, 2, 3, 6, 9, 12, 18, 36];
const SPLITS = [1095, 1460, 1825, 2190, 2555, 2920, 3285, 3650, 4015, 4380, 4745, 5110];

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sdOf = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sdOf(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
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
    const bookTimes = b1.bookTimes; const m = blendRows.length;
    const retAt = (i) => legs.spotRet[loopStart + NEXT + i] || new Array(k).fill(0);

    const dailyBook = xsBookImpl(dOI, { k, n, times, legs, NEXT }, { sign: 1, from: firstOI, policy: { kind: 'daily' } });
    const dailyGross = sharpe(dailyBook.rets); const dailyTurn = Math.round(mean(turnoverSeries(dailyBook.weightRows)) * PPY);

    const net4Series = (rows) => { const T = turnoverSeries(rows); return rows.map((w, i) => w.reduce((a, x, j) => a + x * fin(retAt(i)[j]), 0) - (FEE_BPS / 1e4) * T[i]); };
    const fullNet4 = (rows) => r2(sharpe(net4Series(rows)));

    // guard
    const baseFull = fullNet4(blendRows);
    let e48 = null; try { e48 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e48_oi_construction.json')); } catch (e) { e48 = null; }
    const g = e48 ? e48.books.blend_50_50 : null;
    const baseTurn = Math.round(mean(turnoverSeries(blendRows)) * PPY);
    const validation = { e21Gross: +dailyGross.toFixed(4), e21Turnover: dailyTurn, e21Matches: Math.abs(dailyGross - 0.9612203471681686) < 5e-3 && Math.abs(dailyTurn - 1501) < 1, f46Net4: g ? g.net4Sharpe : null, hereNet4: baseFull, f46Turnover: g ? g.turnoverAnnual : null, hereTurnover: baseTurn, f46Matches: g ? (Math.abs(baseFull - g.net4Sharpe) < 0.02 && Math.abs(baseTurn - g.turnoverAnnual) < 2) : null, note: 'daily book = e21#dLogOI_pos; 50/50 blend = F-46 (e38/e48).' };

    // precompute each candidate's net4 series once
    const bandSeries = {}; for (const eps of EPS_GRID) bandSeries[eps] = net4Series(applyBand(blendRows, eps));
    const holdSeries = {}; for (const N of HOLD_GRID) holdSeries[N] = net4Series(holdTargets(blendRows, N));
    const dailySeries = net4Series(blendRows.slice()); // daily = rebalanced target each period (rows are the daily targets)

    const inAfter = (ser, S) => sharpe(ser.slice(S));
    const perSplit = SPLITS.filter((S) => S < m - 365).map((S) => {
        const epsPick = EPS_GRID.reduce((a, e) => (inAfter(bandSeries[e], 0) === inAfter(bandSeries[e], 0) && sharpe(bandSeries[e].slice(0, S)) > sharpe(bandSeries[a].slice(0, S)) ? e : a), EPS_GRID[0]);
        const nPick = HOLD_GRID.reduce((a, N) => (sharpe(holdSeries[N].slice(0, S)) > sharpe(holdSeries[a].slice(0, S)) ? N : a), HOLD_GRID[0]);
        return {
            S,
            epsPick, nPick,
            oosBand: r2(sharpe(bandSeries[epsPick].slice(S))),
            oosHold: r2(sharpe(holdSeries[nPick].slice(S))),
            oosFixedBand: r2(sharpe(bandSeries[0.03].slice(S))),
            oosFixedHold6: r2(sharpe(holdSeries[6].slice(S))),
            oosDaily: r2(sharpe(dailySeries.slice(S))),
        };
    });

    const bandBeatsHold = perSplit.filter((p) => p.oosBand >= p.oosHold).length;
    const bandBeatsDaily = perSplit.filter((p) => p.oosBand >= p.oosDaily).length;
    const epsPicks = [...new Set(perSplit.map((p) => p.epsPick))];
    const nPicks = [...new Set(perSplit.map((p) => p.nPick))];
    const epsPicksLate = [...new Set(perSplit.filter((p) => p.S >= 2555).map((p) => p.epsPick))];
    const epsPicksLate2 = [...new Set(perSplit.filter((p) => p.S >= 3650).map((p) => p.epsPick))];
    const fixedBandBeatsFixedHold6 = perSplit.filter((p) => p.oosFixedBand >= p.oosFixedHold6).length;
    const fixedBandBeatsDaily = perSplit.filter((p) => p.oosFixedBand >= p.oosDaily).length;
    const frac = (c) => +(c / perSplit.length).toFixed(2);

    const verdict = {
        note: 'Dense-split holdout for the OI sleeve: frozen-eps band vs frozen-N hold vs daily (F-49/F-55 treatment).',
        splits: perSplit.length,
        bandBeatsHoldFrac: frac(bandBeatsHold), bandBeatsDailyFrac: frac(bandBeatsDaily),
        fixedBandBeatsFixedHold6Frac: frac(fixedBandBeatsFixedHold6), fixedBandBeatsDailyFrac: frac(fixedBandBeatsDaily),
        epsPicks, nPicks, epsPickStable: epsPicks.length <= 3,
        epsPicksLate2555: epsPicksLate, epsPicksLate2_3650: epsPicksLate2,
        epsPickStableLate: epsPicksLate.length <= 3,
        bandDominatesHold: bandBeatsHold === perSplit.length,
        bandRobust: frac(bandBeatsHold) >= 0.6 && frac(bandBeatsDaily) >= 0.6 && epsPicks.length <= 3,
        validationPass: (validation.e21Matches === true) && (validation.f46Matches === true),
    };

    return { config: { symbols: k, symbolList: names, periods: m, firstOI, eps: EPS_GRID, holds: HOLD_GRID, splits: SPLITS, feeBps: FEE_BPS }, validation, perSplit, verdict };
}
