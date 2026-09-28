// E7 - basis reversion: the one series in E3 that looked like a signal.
//
// E3's honest delta-neutral book (`spotRet - perpRet + funding`) is much less smooth
// than its funding leg alone: the basis leg adds variance. But that basis variance is
// almost perfectly mean-reverting (strongly negative serial design effect), which is
// the signature of a *trading signal* rather than a return stream.
//
// Hypothesis: the perp-vs-spot basis is a stationary spread; a rich basis converges.
// So a position sized on the causal z-score of the basis - and held in the
// delta-neutral book - should strip most of the basis-risk variance that costs the
// naive carry sleeve its Sharpe.
//
// Measured:
//   IC(z_t, next-period basis move)                      - is it predictable at all?
//   Sharpe of the basis-only book, timed by z            - the pure spread trade
//   Sharpe of the funding+basis book, timed by z         - the improved carry sleeve
//   correlation of each with the price basket            - is the independence kept?
//
// CAVEAT (recorded, not hidden): basis is sampled at the 8h funding grid from the
// mark price, which is a smoothed index - so this UNDERSTATES intra-period basis
// spikes and may overstate tradability. A maker/same-venue implementation is the
// test that would settle it; this experiment only says whether the signal exists.
//
// CYCLE-006: the series (marks, funding buckets, spot alignment, history window) now
// comes from `e3_carry.js#loadCarryBook` - one carry book in the lab - so this runs
// over 2020-09..2026-09 instead of the old post-2023-10 window.

import { SYMBOLS, serialDesignEffect, robustDesignEffect } from '../lib/lab.js';
import { loadCarryBook } from './e3_carry.js';

const PERIODS_PER_YEAR = 365 * 3;

function zscores(xs, window) {
    const out = new Array(xs.length).fill(0);
    for (let i = 0; i < xs.length; i++) {
        const from = Math.max(0, i - window + 1);
        const vals = [];
        for (let j = from; j <= i; j++) if (Number.isFinite(xs[j])) vals.push(xs[j]);
        if (vals.length < 8) continue;
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1));
        if (!(sd > 0)) continue;
        out[i] = (xs[i] - m) / sd;
    }
    return out;
}

const sharpe = (s) => {
    const v = s.filter(Number.isFinite);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
    return sd > 0 ? (m / sd) * Math.sqrt(PERIODS_PER_YEAR) : NaN;
};
const mean = (s) => s.filter(Number.isFinite).reduce((a, b) => a + b, 0) / s.filter(Number.isFinite).length;
const clamp = (x) => (x < -1 ? -1 : x > 1 ? 1 : x);

// The reversion book computed from ANY perp source's carry book, so E15 (L14) can run it on the
// traded leg without a second copy of the logic — a copy is exactly how this file accumulated three
// of the four F-18 bugs.
export function reversionFromBook(perSym, { zWindow = 60, includeWeights = false } = {}) {
    const per = [];
    for (const p of perSym) {
        const len = p.rets.length;
        if (len < 200) continue;
        const z = zscores(p.basisLevel, zWindow);
        // Positions: the CONVERGENCE bet (the stated hypothesis). A positive causal
        // z-score means the basis is rich (perp above spot); convergence then shows
        // up as a positive `basisPnl` (long-spot/short-perp), so the fitted position
        // is pos = +z. The IC below is measured against this orientation. `follow`
        // (pos = -z) is the mirror, reported so the artefact cannot be misread.
        //
        // AUDIT NOTE (CYCLE-002): an earlier revision used `pos = -z` here, i.e. the
        // MIRROR of its own stated hypothesis, and so reported the losing sign
        // (-2.07) against a positive IC. The sign is now explicit; the verdict is
        // unchanged (the design effect kills it either way).
        const fade = z.map((v) => clamp(v / 2));
        const follow = fade.map((v) => -v);
        const basisOnly = [];
        const followOnly = [];
        const carryPlus = [];
        const market = [];
        // IC: does the z-score at period i predict period i+1's basis move?
        const zz = [];
        const db = [];
        for (let i = 0; i + 1 < len; i++) {
            basisOnly.push(fade[i] * p.basis[i + 1]);
            followOnly.push(follow[i] * p.basis[i + 1]);
            carryPlus.push(fade[i] * (p.basis[i + 1] + p.f[i + 1]));
            market.push(p.spot[i + 1]);
            zz.push(z[i]);
            db.push(p.basis[i + 1]);
        }
        const mz = mean(zz);
        const md = mean(db);
        let num = 0; let dz = 0; let dd = 0;
        for (let i = 0; i < zz.length; i++) { num += (zz[i] - mz) * (db[i] - md); dz += (zz[i] - mz) ** 2; dd += (db[i] - md) ** 2; }
        const ic = (dz > 0 && dd > 0) ? num / Math.sqrt(dz * dd) : NaN;
        per.push({ symbol: p.symbol, periods: len, ic, basisOnlySharpe: sharpe(basisOnly), followSharpe: sharpe(followOnly), carryPlusSharpe: sharpe(carryPlus), basisOnlyMean: mean(basisOnly), carryPlusMean: mean(carryPlus), basisOnlyDE: serialDesignEffect(basisOnly, 90).designEffect, rets: { basisOnly, followOnly, carryPlus, market }, _fade: fade, _basis: p.basis, _f: p.f, _times: p.times });
    }
    if (!per.length) return { available: false };
    const n = Math.min(...per.map((p) => p.rets.basisOnly.length));
    const pool = (k) => { const out = []; for (let i = 0; i < n; i++) { let a = 0; for (const p of per) a += p.rets[k][p.rets[k].length - n + i]; out.push(a / per.length); } return out; };
    const bo = pool('basisOnly');
    const fo = pool('followOnly');
    const cp = pool('carryPlus');
    const mk = pool('market');
    const corr = (a, b) => { const ma = mean(a); const mb = mean(b); let num = 0; let da = 0; let db = 0; for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return (da > 0 && db > 0) ? num / Math.sqrt(da * db) : NaN; };
    // Pooled exposure vectors (aligned exactly with the pooled return series above): used by E16 to
    // measure turnover. `_fade[j][m]` pairs with `p.rets.basisOnly[m]`, so the pooled index is the
    // same `p.rets.basisOnly.length - n + i` used by `pool`.
    let pooledWeights = null;
    let pooledLegs = null;
    let pooledTimes = null;
    if (includeWeights) {
        pooledWeights = [];
        pooledLegs = { basis: [], carry: [] };
        pooledTimes = [];
        for (let i = 0; i < n; i++) {
            const wi = [];
            const lb = [];
            const lc = [];
            for (const p of per) {
                const m = p._fade.length - 1 - n + i;
                wi.push(p._fade[m] / per.length);
                // The return earned by that weight is `basis[m+1]` (see `basisOnly` above), so the
                // aligned leg vector is at index m+1. This lets E18 smooth the weights and recompute
                // the return on the SAME legs, rather than re-deriving the z-score.
                lb.push(p._basis[m + 1]);
                lc.push(p._basis[m + 1] + p._f[m + 1]);
            }
            pooledWeights.push(wi);
            // The weight `fade[m]` is set at `times[m]` and the return it earns is realised at
            // `times[m+1]`, so the rebalance trades inside the 8h bar ENDING at `times[m+1]` - the bar
            // E19 pairs with this period's turnover for its impact volume. Times agree across symbols
            // on the aligned tail (the pool takes the last `n` of every symbol).
            pooledTimes.push(per[0]._times[per[0]._times.length - n + i]);
            pooledLegs.basis.push(lb);
            pooledLegs.carry.push(lc);
        }
    }
    return {
        config: { symbols: per.length, symbolList: per.map((p) => p.symbol), periods: n, zWindow },
        perSymbol: per.map(({ rets, _fade, _basis, _f, ...rest }) => rest),
        pooled: {
            basisOnly: { sharpe: sharpe(bo), annualized: mean(bo) * PERIODS_PER_YEAR, serialDesignEffect: serialDesignEffect(bo, 90).designEffect, robustDesignEffect: robustDesignEffect(bo) },
            followOnly: { sharpe: sharpe(fo), annualized: mean(fo) * PERIODS_PER_YEAR, serialDesignEffect: serialDesignEffect(fo, 90).designEffect, robustDesignEffect: robustDesignEffect(fo) },
            carryPlus: { sharpe: sharpe(cp), annualized: mean(cp) * PERIODS_PER_YEAR, serialDesignEffect: serialDesignEffect(cp, 90).designEffect, robustDesignEffect: robustDesignEffect(cp) },
            marketCorr: corr(cp, mk),
        },
        pooledWeights,
        pooledTimes: includeWeights ? pooledTimes : null,
        pooledLegs: includeWeights ? pooledLegs : null,
        pooledReturns: includeWeights ? { basisOnly: bo, followOnly: fo, carryPlus: cp, market: mk } : null,
    };
}

export async function run({ symbols = SYMBOLS, zWindow = 60, perp = 'mark' } = {}) {
    const { perSym } = await loadCarryBook(symbols, { perp });
    return reversionFromBook(perSym, { zWindow });
}
