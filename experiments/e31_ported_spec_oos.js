// E31 - THE R8 PORT SPEC, WALK-FORWARD AND FEE-STRESSED. CYCLE-022 (capstone for L12/L15/L16/L17).
//
// CYCLE-020 (F-37) fixed the dispersion book's fee margin with a walk-forward λ; CYCLE-021 (F-38) sized it
// and found the cap compounds (best combined spec `ewma 0.02 + cap12.5 %`, ~$36 M, recent net@4 +4.24).
// But that combination was picked from a frontier, not selected by the rule — so it has two live
// criticisms: (i) a 2-D (λ, cap) spec is a *bigger* selection surface, so the walk-forward test matters
// even more, and (ii) the whole construction assumes a 4 bps fee. This experiment closes both:
//
//   1. JOINT walk-forward: every `block` periods, pick the (λ, cap) pair with the best *trailing* net@4
//      Sharpe (data strictly before the block only), trade it through the block, and compare the
//      never-seen OOS series to the pinned candidates on the same span.
//   2. FEE STRESS: re-score the same OOS return/turnover series at fees 2 / 4 / 6 / 8 / 10 bps (the
//      turnover is the OOS book's own), so the port decision is not hostage to one fee assumption.
//
// FALSIFIER (pre-registered). The spec is not robust enough to port if EITHER (a) the joint walk-forward
// does not beat the pinned F-24 spec out of sample, OR (b) the walk-forward book's OOS recent-24m net@4
// turns ≤ 0 at a 6 bps fee (i.e. the margin is not comfortable).

import { SYMBOLS } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PERIODS_PER_YEAR = 365 * 3;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sd(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PERIODS_PER_YEAR) : NaN; };
const applyCap = (rows, cap) => (cap == null ? rows : rows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x))));

const LAMBDAS = [0.005, 0.0075, 0.01, 0.015, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15];
const CAPS = [null, 0.10, 0.125, 0.15];

export async function run({ symbols = SYMBOLS, perp = 'mark', lookback = 1095, block = 365 } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const k = s.config.symbols;
    const legs = s.legs;
    const n = legs.times.length - 1;
    const bookTimes = legs.times.slice(1);

    // Precompute every (λ, cap) book, causally.
    const combos = [];
    const books = [];
    for (const lam of LAMBDAS) {
        const built = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: lam, normalize: true } });
        for (const cap of CAPS) {
            const rows = applyCap(built.weightRows, cap);
            const rets = cap == null ? built.rets : rows.map((w, t) => { const bp = legs.basisPnl[t + 1]; const fr = legs.fRate[t + 1]; return w.reduce((a, x, j) => a + x * ((Number.isFinite(bp[j]) ? bp[j] : 0) + (Number.isFinite(fr[j]) ? fr[j] : 0)), 0); });
            const T = turnoverSeries(rows);
            const net4 = rets.map((x, i) => x - 4e-4 * T[i]);
            combos.push({ lam, cap, rets, T, net4 });
            books.push({ lam, cap, rets, T, net4 });
        }
    }
    const idx = (lam, cap) => combos.findIndex((c) => c.lam === lam && (c.cap === cap || (c.cap == null && cap == null)));

    // Joint walk-forward: choose (λ, cap) by trailing net@4 Sharpe; no data on/after the block start.
    function walkForward() {
        const oosG = []; const oosT = []; const picks = [];
        let r = lookback;
        while (r + block <= n) {
            let best = null;
            for (const c of combos) {
                const sc = sharpe(c.net4.slice(r - lookback, r));
                if (!Number.isFinite(sc)) continue;
                if (!best || sc > best.sc) best = { c, sc };
            }
            if (!best) break;
            for (let t = r; t < r + block; t++) { oosG.push(best.c.rets[t]); oosT.push(best.c.T[t]); }
            picks.push({ at: new Date(bookTimes[r]).toISOString().slice(0, 10), lambda: best.c.lam, cap: best.c.cap, trailingNet4: +best.sc.toFixed(2) });
            r += block;
        }
        return { start: lookback, span: oosG.length, gross: oosG, T: oosT, picks };
    }
    const wf = walkForward();

    // Fee stress on the SAME OOS return/turnover series.
    const feeStress = {};
    for (const fee of [2, 4, 6, 8, 10]) {
        const net = wf.gross.map((g, i) => g - (fee / 1e4) * wf.T[i]);
        const rec = Math.min(wf.span, 2 * PERIODS_PER_YEAR);
        feeStress[`${fee}bps`] = {
            oosNetSharpe: +sharpe(net).toFixed(2),
            recent24mNetSharpe: +sharpe(net.slice(wf.span - rec)).toFixed(2),
            breakEvenBps: mean(wf.T) > 0 ? +((mean(wf.gross) * 1e4) / mean(wf.T)).toFixed(2) : null,
        };
    }

    // Pinned candidates on the SAME OOS span.
    const pinned = {};
    const pin = (name, lam, cap) => {
        const c = combos[idx(lam, cap)];
        if (!c) return;
        const g = c.rets.slice(wf.start, wf.start + wf.span);
        const T = c.T.slice(wf.start, wf.start + wf.span);
        const rec = Math.min(wf.span, 2 * PERIODS_PER_YEAR);
        const net = (fee) => g.map((x, i) => x - (fee / 1e4) * T[i]);
        pinned[name] = {
            lambda: lam, cap: cap,
            oosNet4Sharpe: +sharpe(net(4)).toFixed(2),
            oosRecent24mNet4: +sharpe(net(4).slice(wf.span - rec)).toFixed(2),
            net4At6bps: +sharpe(net(6)).toFixed(2),
            breakEvenBps: mean(T) > 0 ? +((mean(g) * 1e4) / mean(T)).toFixed(2) : null,
            turnoverAnnual: +(mean(T) * PERIODS_PER_YEAR).toFixed(0),
        };
    };
    pin('F24_spec_lam0.1', 0.1, null);
    pin('lam0.02_plain', 0.02, null);
    pin('lam0.02_cap12.5', 0.02, 0.125);
    pin('lam0.05_cap12.5', 0.05, 0.125);
    pin('lam0.1_cap12.5', 0.1, 0.125);

    // Validation: the pinned λ=0.1/no-cap full-sample recent net@4 + break-even must match F-24/e28.
    const spec = combos[idx(0.1, null)];
    const recFull = 2 * PERIODS_PER_YEAR;
    const specRecentNet4 = sharpe(spec.net4.slice(n - recFull));
    const specRecentBE = mean(spec.T.slice(n - recFull)) > 0 ? (mean(spec.rets.slice(n - recFull)) * 1e4) / mean(spec.T.slice(n - recFull)) : null;
    const validation = {
        specRecentNet4: +specRecentNet4.toFixed(2),
        specRecentBreakEvenBps: +specRecentBE.toFixed(2),
        matchesE28: specRecentNet4 < 0 && specRecentBE < 4.5,
        note: 'the F-24 spec must still read recent net@4 < 0 and break-even < 4.5 bps (e28/F-36).',
    };

    const pickFreq = {};
    for (const p of wf.picks) { const key = `${p.lambda}${p.cap ? '+cap' + p.cap : ''}`; pickFreq[key] = (pickFreq[key] || 0) + 1; }

    const feeKeys = Object.keys(feeStress);
    const minOosNet = Math.min(...feeKeys.map((k) => feeStress[k].oosNetSharpe));
    const minRecentNet = Math.min(...feeKeys.map((k) => feeStress[k].recent24mNetSharpe));
    const verdict = {
        note: 'Falsifier: not robust enough to port if the joint walk-forward fails to beat the pinned F-24 spec OOS, or if its OOS recent-24m net@4 <= 0 at a 6 bps fee.',
        walkForwardOosNet4: feeStress['4bps'].oosNetSharpe,
        walkForwardRecent24mNet4: feeStress['4bps'].recent24mNetSharpe,
        walkForwardBreakEvenBps: feeStress['4bps'].breakEvenBps,
        pinnedSpecOosNet4: pinned['F24_spec_lam0.1'].oosNet4Sharpe,
        bestPinnedOosNet4: Math.max(...Object.values(pinned).map((p) => p.oosNet4Sharpe)),
        oosNet4At2bps: feeStress['2bps'].oosNetSharpe,
        oosNet4At6bps: feeStress['6bps'].oosNetSharpe,
        recent24mNet4At6bps: feeStress['6bps'].recent24mNetSharpe,
        oosNet4At10bps: feeStress['10bps'].oosNetSharpe,
        minOosNetAcrossFees: +minOosNet.toFixed(2),
        minRecent24mNetAcrossFees: +minRecentNet.toFixed(2),
        beatsPinnedSpecOOS: feeStress['4bps'].oosNetSharpe > pinned['F24_spec_lam0.1'].oosNet4Sharpe,
        marginAt6bpsPositive: feeStress['6bps'].recent24mNetSharpe > 0,
        validationPass: validation.matchesE28,
    };
    verdict.portReady = verdict.beatsPinnedSpecOOS && verdict.marginAt6bpsPositive && verdict.validationPass;

    return {
        config: { symbols: k, perp, periods: n, lookback, block, lambdas: LAMBDAS, caps: CAPS, combos: combos.length },
        validation,
        walkForward: { start: wf.start, span: wf.span, picks: wf.picks, pickFrequency: pickFreq },
        feeStress,
        pinned,
        verdict,
    };
}
