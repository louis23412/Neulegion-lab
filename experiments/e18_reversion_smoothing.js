// E18 - can the basis-reversion book be made tradable too? L11 analogue of E17. CYCLE-010.
//
// F-24 rescued the cross-sectional dispersion sleeve by smoothing its weights (EWMA lambda=0.1): the
// turnover that made it cost-fragile was an implementation artefact, not the signal. This asks the same
// question of the OTHER cost-fragile book: basis reversion (F-10/L11), whose timed `fade` position is
// re-set from a basis z-score every 8h (465x/yr turnover, break-even 2.82 bps -> dead at any fee).
//
// Method: take the reversion book's own exposure vectors and per-symbol legs from
// `e7#reversionFromBook({includeWeights:true})`, apply a weight policy (daily / hold-N / EWMA /
// deadband), recompute the return on the SAME legs, and audit with the F-23 machinery (`e16#audit`).
// No z-score is re-derived. An alignment guard asserts that the daily policy reproduces E7's own
// `basisOnly` return series exactly -- if it does not, this file is measuring a different book.
//
// NB: this is the *pooled* reversion book (equal-weight across symbols, then smoothed). Smoothing is a
// linear operator and pooling is a mean, so smoothing the pooled weights is identical to smoothing each
// symbol then pooling; the guard checks the reconstruction.

import { SYMBOLS, pearsonCorrelation } from '../lib/lab.js';
import { loadCarryBook } from './e3_carry.js';
import { reversionFromBook } from './e7_basis_reversion.js';
import { audit } from './e16_cost_capacity.js';

const fin = (x) => (Number.isFinite(x) ? x : 0);

// Apply a weight policy to a target-weight series (causal: only held_{t-1} and target_t are used).
export function applyPolicy(targets, policy, normalize = false) {
    const k = targets[0].length;
    let held = new Array(k).fill(0);
    const rows = [];
    let counter = 0;
    for (let t = 0; t < targets.length; t++) {
        const target = targets[t];
        if (policy.kind === 'daily') {
            held = target.slice();
        } else if (policy.kind === 'hold') {
            if (counter % policy.N === 0) held = target.slice();
        } else if (policy.kind === 'ewma') {
            const l = policy.lambda;
            held = held.map((h, j) => (1 - l) * h + l * target[j]);
        } else if (policy.kind === 'deadband') {
            held = held.map((h, j) => (Math.abs(target[j] - h) > policy.eps ? target[j] : h));
        } else {
            throw new Error(`unknown policy ${policy.kind}`);
        }
        if (normalize) {
            const g = held.reduce((a, w) => a + Math.abs(w), 0) || 1;
            held = held.map((w) => w / g);
        }
        counter += 1;
        rows.push(held.slice());
    }
    return rows;
}

const retsFrom = (weightRows, legs) => weightRows.map((w, t) => w.reduce((a, x, j) => a + x * fin(legs[t][j]), 0));

const POLICIES = [
    { name: 'daily', policy: { kind: 'daily' } },
    { name: 'hold3', policy: { kind: 'hold', N: 3 } },
    { name: 'hold9', policy: { kind: 'hold', N: 9 } },
    { name: 'ewma_0.5', policy: { kind: 'ewma', lambda: 0.5 } },
    { name: 'ewma_0.25', policy: { kind: 'ewma', lambda: 0.25 } },
    { name: 'ewma_0.1', policy: { kind: 'ewma', lambda: 0.1 } },
    { name: 'ewma_0.1_norm', policy: { kind: 'ewma', lambda: 0.1 }, normalize: true },
    { name: 'deadband_0.02', policy: { kind: 'deadband', eps: 0.02 } },
    { name: 'deadband_0.05', policy: { kind: 'deadband', eps: 0.05 } },
];

export async function run({ symbols = SYMBOLS, perp = 'mark', zWindow = 60 } = {}) {
    const { perSym } = await loadCarryBook(symbols, { perp });
    const rev = reversionFromBook(perSym, { zWindow, includeWeights: true });
    if (!rev.pooled || !rev.pooledWeights) return { available: false };
    const targets = rev.pooledWeights;
    const legs = rev.pooledLegs;

    // Alignment guard: the daily policy must reconstruct E7's own pooled returns bit-for-bit.
    let maxAbsBasis = 0; let maxAbsCarry = 0;
    const dailyW = applyPolicy(targets, { kind: 'daily' });
    const dailyB = retsFrom(dailyW, legs.basis);
    const dailyC = retsFrom(dailyW, legs.carry);
    for (let t = 0; t < dailyB.length; t++) {
        maxAbsBasis = Math.max(maxAbsBasis, Math.abs(dailyB[t] - rev.pooledReturns.basisOnly[t]));
        maxAbsCarry = Math.max(maxAbsCarry, Math.abs(dailyC[t] - rev.pooledReturns.carryPlus[t]));
    }

    const books = {};
    for (const { name, policy, normalize } of POLICIES) {
        const W = applyPolicy(targets, policy, !!normalize);
        const bR = retsFrom(W, legs.basis);
        const cR = retsFrom(W, legs.carry);
        const ab = audit(`rev_basis_${name}`, bR, W);
        const ac = audit(`rev_carry_${name}`, cR, W);
        const pack = (a, rets) => ({
            grossSharpe: a.gross.sharpe, annualized: a.gross.annualized, maxDrawdown: a.gross.maxDrawdown,
            turnoverAnnual: a.turnover.annualized, breakEvenBps: a.breakEvenBps,
            marketCorr: pearsonCorrelation(rets, rev.pooledReturns.market),
            net: Object.fromEntries(Object.entries(a.net).map(([c, x]) => [c, { sharpe: x.sharpe, annualized: x.annualized }])),
        });
        books[name] = { policy, basisOnly: pack(ab, bR), carryPlus: pack(ac, cR) };
    }

    const frontier = Object.entries(books)
        .map(([name, b]) => ({ name, basisGross: b.basisOnly.grossSharpe, basisTurn: b.basisOnly.turnoverAnnual, basisBE: b.basisOnly.breakEvenBps, basisNet4: b.basisOnly.net['4'] && b.basisOnly.net['4'].sharpe, basisNet10: b.basisOnly.net['10'] && b.basisOnly.net['10'].sharpe, carryNet4: b.carryPlus.net['4'] && b.carryPlus.net['4'].sharpe, carryNet10: b.carryPlus.net['10'] && b.carryPlus.net['10'].sharpe }))
        .sort((a, b) => (b.basisNet4 || -1e9) - (a.basisNet4 || -1e9));

    return {
        config: { symbols: rev.config.symbols, perp, periods: rev.config.periods, zWindow },
        check: { dailyReproducesE7: maxAbsBasis < 1e-12 && maxAbsCarry < 1e-12, maxAbsBasis, maxAbsCarry },
        e7Reference: { basisOnlySharpe: rev.pooled.basisOnly.sharpe, carryPlusSharpe: rev.pooled.carryPlus.sharpe },
        books,
        frontier,
    };
}
