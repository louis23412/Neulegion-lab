// E23 - COMBINE L12 (carry dispersion) and L18 (toptrader fade). CYCLE-015.
//
// The lab now has two independent cross-sectional positioning streams:
//   * the F-24 carry dispersion book - funding-rank weights on the CARRY P&L (basisPnl + funding),
//     EWMA(0.1)-smoothed, break-even 12.8 bps, net@4 +3.55 (Sharpe ~5);
//   * the L18 toptrader fade - toptrader-ratio weights on the SPOT return, EWMA(0.1)-smoothed,
//     break-even 74 bps, net@4 +0.79 (Sharpe ~0.84).
// They trade different return legs (funding/basis vs spot) and different signals. If they are
// sufficiently uncorrelated, a portfolio of the two has more available Sharpe than either alone - the
// lab's whole thesis (F-02/F-03: power is buyable via construction). This experiment:
//
//   1. builds both smoothed books on ONE loop over the same book grid, so the return streams are aligned
//      to the same calendar interval by construction;
//   2. reports the return correlation, the combined Sharpe at several mixes, the max-Sharpe mix, and the
//      half-sample stability of the combination;
//   3. nets each stream for its own turnover at 4 bps and nets the combination the same way.
//
// Convention (matches e21/e22): book index i uses a signal known at times[i] and earns the forward leg
// over (times[i], times[i+1]) = legs spotRet[i+2] / carry (basisPnl[i+2] + fRate[i+2]). Funding weights
// use fRate[i+1] (stamped at the interval start), the e12/e17 convention.

import { SYMBOLS, pearsonCorrelation, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries, statsOf } from './e12_xs_carry.js';
import { rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sharpeOf = (a) => statsOf(a).sharpe;
const corr = (a, b) => { const n = Math.min(a.length, b.length); const x = a.slice(0, n), y = b.slice(0, n); const mx = mean(x), my = mean(y); let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy); };

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList; const k = names.length;
    const times = s.times; const n = times.length; const legs = s.legs;

    // topLS mask: start where every symbol has the field.
    const oi = await loadOpenInterest();
    const topLS = names.map((nm) => { const o = oi[nm]; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.topLS[idx] : null; } return arr; });
    let firstTop = -1;
    for (let i = 1; i < n - 2; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(topLS[j][i])) all = false; if (all) { firstTop = i; break; } }

    const lam = 0.1;
    let hTop = new Array(k).fill(0); let hCarry = new Array(k).fill(0);
    const retTop = []; const retCarry = []; const retFlat = []; const Wtop = []; const Wcarry = []; const bt = [];
    for (let i = firstTop; i < n - 2; i++) {
        // toptrader signal (masked fade)
        const pres = []; for (let j = 0; j < k; j++) if (Number.isFinite(topLS[j][i])) pres.push(j);
        const tTop = new Array(k).fill(0);
        if (pres.length >= 3) { const sv = pres.map((j) => topLS[j][i]); const m = mean(sv); const z = sv.map((v) => v - m); const g = z.reduce((a, b) => a + Math.abs(b), 0) || 1; pres.forEach((j, q) => { tTop[j] = -z[q] / g; }); }
        hTop = hTop.map((h, j) => (1 - lam) * h + lam * tTop[j]); { const g = hTop.reduce((a, x) => a + Math.abs(x), 0) || 1; hTop = hTop.map((x) => x / g); }

        // funding signal: rank of fRate[i+1] (known at the interval start times[i]).
        const fPrev = legs.fRate[i + 1]; const tCarry = fPrev ? rankWeights(fPrev) : new Array(k).fill(0);
        hCarry = hCarry.map((h, j) => (1 - lam) * h + lam * tCarry[j]); { const g = hCarry.reduce((a, x) => a + Math.abs(x), 0) || 1; hCarry = hCarry.map((x) => x / g); }

        const sr = legs.spotRet[i + 2]; const bp = legs.basisPnl[i + 2]; const fr = legs.fRate[i + 2];
        retTop.push(hTop.reduce((a, w, j) => a + w * (sr ? sr[j] : 0), 0));
        retCarry.push(hCarry.reduce((a, w, j) => a + w * (bp[j] + fr[j]), 0));
        retFlat.push(mean(bp.map((v, j) => v + fr[j])));
        Wtop.push(hTop.slice()); Wcarry.push(hCarry.slice()); bt.push(times[i]);
    }

    const Ttop = turnoverSeries(Wtop); const Tcarry = turnoverSeries(Wcarry);
    const netT = retTop.map((r, i) => r - 4e-4 * Ttop[i]);
    const netC = retCarry.map((r, i) => r - 4e-4 * Tcarry[i]);
    const rho = corr(retTop, retCarry);

    // 2-asset max-Sharpe mix (unconstrained), and a few fixed mixes with net@4.
    const mT = mean(retTop), mC = mean(retCarry);
    const sT = statsOf(retTop).sharpe, sC = statsOf(retCarry).sharpe;
    const vT = retTop.reduce((a, r) => a + (r - mT) ** 2, 0) / (retTop.length - 1);
    const vC = retCarry.reduce((a, r) => a + (r - mC) ** 2, 0) / (retCarry.length - 1);
    const cov = rho * Math.sqrt(vT * vC);
    const optTop = (mT * vC - mC * cov) / (vT * vC - cov * cov);
    const optCarry = (mC * vT - mT * cov) / (vT * vC - cov * cov);
    const optSum = Math.abs(optTop) + Math.abs(optCarry);
    const optMix = { topFrac: optTop / optSum, carryFrac: optCarry / optSum };

    const mix = (a) => {
        const b = 1 - a;
        const gross = retTop.map((r, i) => a * r + b * retCarry[i]);
        const net = retTop.map((r, i) => a * (r - 4e-4 * Ttop[i]) + b * (retCarry[i] - 4e-4 * Tcarry[i]));
        const h = Math.floor(gross.length / 2);
        return { topFrac: a, carryFrac: b, grossSharpe: bal(gross), net4Sharpe: bal(net), h1g: bal(gross.slice(0, h)), h2g: bal(gross.slice(h)), h1n: bal(net.slice(0, h)), h2n: bal(net.slice(h)) };
        function bal(x) { return sharpeOf(x); }
    };

    return {
        config: { symbols: k, periods: retTop.length, windowStart: new Date(bt[0]).toISOString(), smoothing: 'EWMA 0.1, renormalised' },
        topLSFade: { grossSharpe: bal(retTop), net4Sharpe: bal(netT), turnoverAnnual: mean(Ttop) * 365 * 3, breakEvenBps: mean(retTop) * 1e4 / mean(Ttop) },
        carryDispersion: { grossSharpe: bal(retCarry), net4Sharpe: bal(netC), turnoverAnnual: mean(Tcarry) * 365 * 3, breakEvenBps: mean(retCarry) * 1e4 / mean(Tcarry) },
        flatCarry: { grossSharpe: bal(retFlat) },
        correlation_topLS_vs_carry: +rho.toFixed(3),
        correlation_topLS_vs_flat: +corr(retTop, retFlat).toFixed(3),
        correlation_carry_vs_flat: +corr(retCarry, retFlat).toFixed(3),
        maxSharpeMix: optMix,
        mixes: [0, 0.25, 0.5, 0.75, 1].map(mix),
        note: 'Two independent cross-sectional positioning streams. `bal` = annualised Sharpe on the book grid (365*3 periods/yr). Mix fractions are of the two streams\' capital.',
    };
    function bal(a) { return +statsOf(a).sharpe.toFixed(3); }
}
