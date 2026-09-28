// E32 - DOES THE COST-AWARE-SLOWNESS LESSON TRANSFER TO THE FADE? CYCLE-023 (L18 × F-37).
//
// F-37/F-39 found that the carry dispersion book's decayed fee margin is repaired by a *slower, cost-aware*
// EWMA weight policy, and that choosing it walk-forward is a rule (not a hindsight pick). The lab's other
// working sleeve is the L18 toptrader fade (F-29/F-30), whose EWMA(0.1) form is cheap (23×/yr, break-even
// 74 bps) and has NOT decayed (F-36). Two possibilities:
//
//   * the mechanism is general — a slower, cost-aware λ should compound the fade's already-large margin,
//     and a walk-forward should reproduce the choice OOS; OR
//   * the fade is a *different object* (an already-slow positioning signal), so λ barely matters and the
//     transfer is null — also informative, and it would keep the two sleeves honestly distinct.
//
// Reuses `e22#buildMasked` (the exact fade construction, exported in CYCLE-023) and the F-38 capacity
// readout (impact via `e19#capacityOf` + the OI position bound). Guards: `lam0.1` (no cap) must reproduce
// e22's stored `topLS_fade_ewma0.1` numbers exactly.
//
// FALSIFIER (pre-registered). The transfer is NULL if the joint (λ, cap) walk-forward does not beat the
// pinned EWMA(0.1) fade out of sample.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildMasked } from './e22_toptrader_validate.js';
import { turnoverSeries } from './e16_cost_capacity.js';
import { capacityOf, makeCapacityEnv } from './e19_capacity_impact.js';

const PERIODS_PER_YEAR = 365 * 3;
const FEE_BPS = 4;
const NEXT = 2;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };
const applyCap = (rows, cap) => (cap == null ? rows : rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x))));

const LAMBDAS = [0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.25, 0.5];
const CAPS = [null, 0.125];

function winMetrics(rets, T, from, to) {
    const r = rets.slice(from, to);
    const t = T.slice(from, to);
    const net4 = r.map((x, i) => x - (FEE_BPS / 1e4) * t[i]);
    return {
        n: r.length,
        grossSharpe: +sharpe(r).toFixed(2),
        net4Sharpe: +sharpe(net4).toFixed(2),
        turnoverAnnual: +(mean(t) * PERIODS_PER_YEAR).toFixed(0),
        breakEvenBps: mean(t) > 0 ? +((mean(r) * 1e4) / mean(t)).toFixed(2) : null,
    };
}

export async function run({ symbols = SYMBOLS, perp = 'mark', lookback = 1095, block = 365 } = {}) {
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
    const env = await makeCapacityEnv(names);
    const oiValBySym = names.map((nm) => { const o = oi[nm]; if (!o) return null; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.oiVal[idx] : null; } return arr; });
    const oiMean = names.map((_, j) => { const v = oiValBySym[j] ? oiValBySym[j].filter((x) => x > 0) : []; return v.length ? mean(v) : NaN; });

    // Build the (λ, cap) grid causally.
    const combos = [];
    for (const lam of LAMBDAS) {
        for (const cap of CAPS) {
            const b = buildMasked(topLS, k, legs, times, { sign: -1, from: firstTop, policy: { kind: 'ewma', lambda: lam, normalize: true } });
            const weightRows = applyCap(b.weightRows, cap);
            const rets = cap == null ? b.rets : weightRows.map((w, t) => { const sr = legs.spotRet[firstTop + t + NEXT]; return w.reduce((a, x, j) => a + x * (sr && Number.isFinite(sr[j]) ? sr[j] : 0), 0); });
            const T = turnoverSeries(weightRows);
            combos.push({ lam, cap, rets, T, net4: rets.map((x, i) => x - (FEE_BPS / 1e4) * T[i]), weightRows, bookTimes: b.bookTimes });
        }
    }
    const P = combos[0].rets.length;
    const find = (lam, cap) => combos.find((c) => c.lam === lam && c.cap === cap);

    // Per-book table.
    const books = {};
    for (const c of combos) {
        const name = `lam${c.lam}${c.cap ? '_cap' + c.cap : ''}`;
        const w24 = Math.round(2 * PERIODS_PER_YEAR);
        const w12 = Math.round(PERIODS_PER_YEAR);
        const capa = capacityOf(name, c.rets, c.weightRows, c.bookTimes, env);
        const meanAbsW = names.map((_, j) => mean(c.weightRows.map((w) => Math.abs(w[j]))));
        let G5 = Infinity; let bind = -1;
        for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && oiMean[j] > 0) G5 = Math.min(G5, (0.05 * oiMean[j]) / meanAbsW[j]);
        for (let j = 0; j < k; j++) if (meanAbsW[j] > 0 && oiMean[j] > 0 && (0.05 * oiMean[j]) / meanAbsW[j] === G5) bind = j;
        books[name] = {
            lambda: c.lam,
            cap: c.cap,
            full: winMetrics(c.rets, c.T, 0, P),
            last24m: winMetrics(c.rets, c.T, P - Math.min(P, w24), P),
            last12m: winMetrics(c.rets, c.T, P - Math.min(P, w12), P),
            capacityUSD_fee4bps_Y1: capa.capacityUSD_fee4bps.Y1,
            oiBound5pct: G5 === Infinity ? null : G5,
            oiBinding: bind >= 0 ? names[bind] : null,
        };
        const capI = capa.capacityUSD_fee4bps.Y1;
        books[name].usableY1 = Math.min(capI, G5);
    }

    // Joint walk-forward: pick (λ, cap) by trailing net@4 (only data before the block).
    const wf = { gross: [], T: [], picks: [] };
    {
        let r = lookback;
        while (r + block <= P) {
            let best = null;
            for (const c of combos) { const sc = sharpe(c.net4.slice(r - lookback, r)); if (!Number.isFinite(sc)) continue; if (!best || sc > best.sc) best = { c, sc }; }
            if (!best) break;
            for (let t = r; t < r + block; t++) { wf.gross.push(best.c.rets[t]); wf.T.push(best.c.T[t]); }
            wf.picks.push({ at: new Date(combos[0].bookTimes[r]).toISOString().slice(0, 10), lambda: best.c.lam, cap: best.c.cap, trailingNet4: +best.sc.toFixed(2) });
            r += block;
        }
    }
    const wfSpan = wf.gross.length;
    const rec = Math.min(wfSpan, 2 * PERIODS_PER_YEAR);
    const feeStress = {};
    for (const fee of [2, 4, 6, 8, 10]) {
        const net = wf.gross.map((g, i) => g - (fee / 1e4) * wf.T[i]);
        feeStress[`${fee}bps`] = { oosNetSharpe: +sharpe(net).toFixed(2), recent24mNetSharpe: +sharpe(net.slice(wfSpan - rec)).toFixed(2) };
    }

    // Pinned candidates on the same OOS span.
    const pinned = {};
    const pin = (name, lam, cap) => {
        const c = find(lam, cap); if (!c) return;
        const g = c.rets.slice(lookback, lookback + wfSpan);
        const T = c.T.slice(lookback, lookback + wfSpan);
        const net = (fee) => g.map((x, i) => x - (fee / 1e4) * T[i]);
        pinned[name] = {
            lambda: lam, cap: cap,
            oosNet4: +sharpe(net(4)).toFixed(2),
            oosRecent24mNet4: +sharpe(net(4).slice(wfSpan - rec)).toFixed(2),
            net4At6bps: +sharpe(net(6)).toFixed(2),
            breakEvenBps: mean(T) > 0 ? +((mean(g) * 1e4) / mean(T)).toFixed(2) : null,
            turnoverAnnual: +(mean(T) * PERIODS_PER_YEAR).toFixed(0),
        };
    };
    pin('ewma0.1_spec', 0.1, null);
    pin('ewma0.1_cap12.5', 0.1, 0.125);
    pin('ewma0.05_cap12.5', 0.05, 0.125);
    pin('ewma0.02_cap12.5', 0.02, 0.125);
    pin('ewma0.02_plain', 0.02, null);

    // Validation: lam0.1/no-cap must match e22's stored topLS_fade_ewma0.1.
    let e22 = null;
    try { e22 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e22_toptrader_validate.json')); } catch (e) { e22 = null; }
    const e22b = e22 ? e22.books['topLS_fade_ewma0.1'] : null;
    const base = books['lam0.1'];
    const validation = e22b ? {
        e22Gross: e22b.grossSharpe, hereGross: base.full.grossSharpe,
        e22Turnover: e22b.turnoverAnnual, hereTurnover: base.full.turnoverAnnual,
        e22BreakEvenBps: e22b.breakEvenBps, hereBreakEvenBps: base.full.breakEvenBps,
        matchesE22: Math.abs(base.full.grossSharpe - e22b.grossSharpe) < 5e-3 && Math.abs(base.full.turnoverAnnual - e22b.turnoverAnnual) < 1,
        note: 'lam0.1/no-cap must reproduce e22; if not, the fade builders diverged.',
    } : null;

    const spec = pinned['ewma0.1_spec'];
    const wfNet = feeStress['4bps'].oosNetSharpe;
    const pickFreq = {};
    for (const p of wf.picks) { const key = `${p.lambda}${p.cap ? '+cap' + p.cap : ''}`; pickFreq[key] = (pickFreq[key] || 0) + 1; }
    const verdict = {
        note: 'Falsifier: transfer is NULL if the joint (λ, cap) walk-forward does not beat the pinned EWMA(0.1) fade out of sample.',
        walkForwardOosNet4: wfNet,
        walkForwardRecent24mNet4: feeStress['4bps'].recent24mNetSharpe,
        walkForwardNet4At6bps: feeStress['6bps'].oosNetSharpe,
        walkForwardNet4At10bps: feeStress['10bps'].oosNetSharpe,
        pinnedSpecOosNet4: spec.oosNet4,
        pinnedSpecRecent24mNet4: spec.oosRecent24mNet4,
        pinnedSpecBreakEvenBps: spec.breakEvenBps,
        bestPinnedOosNet4: Math.max(...Object.values(pinned).map((p) => p.oosNet4)),
        pickFrequency: pickFreq,
        transferConfirmed: wfNet > spec.oosNet4,
        validationPass: validation ? validation.matchesE22 : null,
    };

    return {
        config: { symbols: k, symbolList: names, periods: P, firstTop, lookback, block, feeBps: FEE_BPS, lambdas: LAMBDAS, caps: CAPS },
        validation,
        books,
        walkForward: { span: wfSpan, picks: wf.picks },
        feeStress,
        pinned,
        verdict,
    };
}
