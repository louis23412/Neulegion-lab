// E27 - DECAY ON THE TWO WORKING SLEEVES. CYCLE-019.
//
// The lab has exactly two validated cross-sectional sleeves, and both carry an open decay risk:
//
//   * L12 / F-24 carry dispersion (funding-rank weights on the carry P&L, EWMA(0.1)-smoothed) - the
//     full-history number is Sharpe ~5.0 and net@4 +3.55, but F-24 recorded that "the edge has decayed
//     since 2024" (2025/26 ~0 net of fees), and F-31 found its net@4 SECOND HALF is negative (-0.12 on
//     the 2021-12+ aligned grid);
//   * L18 / F-30 toptrader fade (toptrader-ratio weights on the spot return, EWMA(0.1)-smoothed) -
//     validated on the full sample with halves 0.81/0.79 (net@4), i.e. apparently *not* decaying, but
//     that validation never separated a recent window.
//
// This experiment re-builds both books and the F-31 mix on the same aligned grid as `e23_combine.js`
// (so the numbers are directly comparable), and then does what the two earlier cycles did not:
// characterises the decay *explicitly* - per calendar year, in rolling 12-month windows, and with a
// formal, permutation-null test for a monotone trend in block performance.
//
// FALSIFIER (pre-registered). A sleeve has NOT decayed if, on the recent window, its net-of-cost Sharpe
// is statistically indistinguishable from its full-sample value. Concretely: the decay test FAILS
// (no decay) if the last third's block-Sharpe mean is within one block-bootstrap SE of the first
// third's, OR the trend permutation p > 0.05. It CONFIRMS decay if the recent net@4 Sharpe is <= 0 and
// the trend test is significant.
//
// The `e23` cross-check is a validation guard in the e25 style: this must reproduce e23's stored
// `carryDispersion.grossSharpe` and `topLSFade.grossSharpe`, or the book builders have diverged and
// nothing here counts.

import { SYMBOLS, pearsonCorrelation, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries, statsOf } from './e12_xs_carry.js';
import { rankWeights } from './e17_low_turnover.js';
import { turnoverSeries } from './e16_cost_capacity.js';

const PERIODS_PER_YEAR = 365 * 3; // the 8h book grid
const FEE_BPS = 4;

const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sharpe = (a) => statsOf(a).sharpe;
const sd = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Contiguous blocks of `series`, dropping the ragged tail. Returns the per-block Sharpe.
function blockSharpes(series, K) {
    const len = Math.floor(series.length / K);
    const out = [];
    for (let b = 0; b < K; b++) out.push(sharpe(series.slice(b * len, (b + 1) * len)));
    return { len, sharpes: out };
}

// Per-block summary of a book: gross / net@4 Sharpe and the break-even (mean gross / mean L1 turnover).
function blockStats(gross, net, turn, K) {
    const len = Math.floor(gross.length / K);
    const out = [];
    for (let b = 0; b < K; b++) {
        const a = b * len;
        const e = (b + 1) * len;
        const g = gross.slice(a, e);
        const t = turn.slice(a, e);
        out.push({
            start: null,
            grossSharpe: sharpe(g),
            net4Sharpe: sharpe(net.slice(a, e)),
            turnoverAnnual: mean(t) * PERIODS_PER_YEAR,
            breakEvenBps: mean(t) > 0 ? (mean(g) * 1e4) / mean(t) : null,
        });
    }
    return out;
}

const summ = (gross, net, turn) => ({
    grossSharpe: sharpe(gross),
    net4Sharpe: sharpe(net),
    turnoverAnnual: mean(turn) * PERIODS_PER_YEAR,
    breakEvenBps: mean(turn) > 0 ? (mean(gross) * 1e4) / mean(turn) : null,
});

// Permutation test for a monotone trend in block performance. Observed statistic = Pearson correlation
// of block Sharpe with block index; the null permutes the block-Sharpe values across the (fixed) indices.
function trendTest(series, K, seed, draws = 5000) {
    const { sharpes } = blockSharpes(series, K);
    const idx = sharpes.map((_, i) => i);
    const rho = pearsonCorrelation(idx, sharpes);
    const v = sharpes.filter(Number.isFinite);
    const rng = mulberry32(seed);
    let ge = 0;
    const perm = v.slice();
    for (let d = 0; d < draws; d++) {
        for (let q = perm.length - 1; q > 0; q--) { const t = Math.floor(rng() * (q + 1)); const tmp = perm[q]; perm[q] = perm[t]; perm[t] = tmp; }
        if (Math.abs(pearsonCorrelation(idx, perm)) >= Math.abs(rho) - 1e-12) ge++;
    }
    const first = sharpes.slice(0, Math.floor(K / 3));
    const last = sharpes.slice(Math.ceil((2 * K) / 3));
    return {
        rho,
        pPerm: (ge + 1) / (draws + 1),
        firstThirdMean: mean(first),
        lastThirdMean: mean(last),
        delta: mean(last) - mean(first),
        blockSharpes: sharpes.map((x) => +x.toFixed(2)),
    };
}

function perYear(times, series) {
    const by = {};
    for (let i = 0; i < series.length; i++) {
        if (!Number.isFinite(series[i])) continue;
        const y = new Date(times[i]).getUTCFullYear();
        (by[y] = by[y] || []).push(series[i]);
    }
    return Object.fromEntries(Object.entries(by).map(([y, a]) => [y, { sharpe: +sharpe(a).toFixed(2), n: a.length }]));
}

function rolling(times, series, windowPeriods, stepPeriods) {
    const out = [];
    for (let s = 0; s + windowPeriods <= series.length; s += stepPeriods) {
        out.push({ at: new Date(times[s]).toISOString().slice(0, 10), sharpe: +sharpe(series.slice(s, s + windowPeriods)).toFixed(2) });
    }
    return out;
}

export async function run({ symbols = SYMBOLS, perp = 'mark', mixTop = 0.25 } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList;
    const k = names.length;
    const times = s.times;
    const n = times.length;
    const legs = s.legs;

    // topLS mask: start where every symbol has the field (the e23 convention).
    const oi = await loadOpenInterest();
    const topLS = names.map((nm) => { const o = oi[nm]; const arr = new Array(n).fill(null); for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.topLS[idx] : null; } return arr; });
    let firstTop = -1;
    for (let i = 1; i < n - 2; i++) { let all = true; for (let j = 0; j < k; j++) if (!Number.isFinite(topLS[j][i])) all = false; if (all) { firstTop = i; break; } }

    const lam = 0.1;
    let hTop = new Array(k).fill(0);
    let hCarry = new Array(k).fill(0);
    const retTop = [];
    const retCarry = [];
    const retFlat = [];
    const Wtop = [];
    const Wcarry = [];
    const bt = [];
    for (let i = firstTop; i < n - 2; i++) {
        const pres = [];
        for (let j = 0; j < k; j++) if (Number.isFinite(topLS[j][i])) pres.push(j);
        const tTop = new Array(k).fill(0);
        if (pres.length >= 3) {
            const sv = pres.map((j) => topLS[j][i]);
            const m = mean(sv);
            const z = sv.map((v) => v - m);
            const g = z.reduce((a, b) => a + Math.abs(b), 0) || 1;
            pres.forEach((j, q) => { tTop[j] = -z[q] / g; });
        }
        hTop = hTop.map((h, j) => (1 - lam) * h + lam * tTop[j]);
        { const g = hTop.reduce((a, x) => a + Math.abs(x), 0) || 1; hTop = hTop.map((x) => x / g); }

        const fPrev = legs.fRate[i + 1];
        const tCarry = fPrev ? rankWeights(fPrev) : new Array(k).fill(0);
        hCarry = hCarry.map((h, j) => (1 - lam) * h + lam * tCarry[j]);
        { const g = hCarry.reduce((a, x) => a + Math.abs(x), 0) || 1; hCarry = hCarry.map((x) => x / g); }

        const sr = legs.spotRet[i + 2];
        const bp = legs.basisPnl[i + 2];
        const fr = legs.fRate[i + 2];
        retTop.push(hTop.reduce((a, w, j) => a + w * (sr ? sr[j] : 0), 0));
        retCarry.push(hCarry.reduce((a, w, j) => a + w * (bp[j] + fr[j]), 0));
        retFlat.push(mean(bp.map((v, j) => v + fr[j])));
        Wtop.push(hTop.slice());
        Wcarry.push(hCarry.slice());
        bt.push(times[i]);
    }

    const Ttop = turnoverSeries(Wtop);
    const Tcarry = turnoverSeries(Wcarry);
    const fee = FEE_BPS / 1e4;
    const netTop = retTop.map((r, i) => r - fee * Ttop[i]);
    const netCarry = retCarry.map((r, i) => r - fee * Tcarry[i]);
    const grossMix = retTop.map((r, i) => mixTop * r + (1 - mixTop) * retCarry[i]);
    const netMix = retTop.map((r, i) => mixTop * (r - fee * Ttop[i]) + (1 - mixTop) * (retCarry[i] - fee * Tcarry[i]));

    const streams = {
        carryDispersion: { gross: retCarry, net: netCarry, turnover: Tcarry },
        topLSFade: { gross: retTop, net: netTop, turnover: Ttop },
        mix25: { gross: grossMix, net: netMix, turnover: retTop.map((r, i) => mixTop * Ttop[i] + (1 - mixTop) * Tcarry[i]) },
    };

    // Cross-check against e23's stored artefact.
    let e23 = null;
    try { e23 = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/results/e23_combine.json')); } catch (e) { e23 = null; }
    const validation = e23 ? {
        e23CarryGross: e23.carryDispersion.grossSharpe,
        e23TopGross: e23.topLSFade.grossSharpe,
        carryGross: +sharpe(retCarry).toFixed(3),
        topGross: +sharpe(retTop).toFixed(3),
        matchesE23: Math.abs(sharpe(retCarry) - e23.carryDispersion.grossSharpe) < 5e-3 && Math.abs(sharpe(retTop) - e23.topLSFade.grossSharpe) < 5e-3,
        note: 'e27 rebuilds e23 books; if this is false the builders diverge and nothing else counts.',
    } : null;

    const out = {
        config: { symbols: k, periods: retTop.length, windowStart: new Date(bt[0]).toISOString(), windowEnd: new Date(bt[bt.length - 1]).toISOString(), smoothing: 'EWMA 0.1, renormalised', feeBps: FEE_BPS, mixTop },
        validation,
        streams: {},
    };

    for (const [name, st] of Object.entries(streams)) {
        const h = Math.floor(st.gross.length / 2);
        const w12 = Math.round(PERIODS_PER_YEAR);
        const last12 = st.net.slice(-w12);
        const last24 = st.net.slice(-2 * w12);
        const blocks = blockStats(st.gross, st.net, st.turnover, 8);
        const len8 = Math.floor(st.gross.length / 8);
        for (let b = 0; b < blocks.length; b++) blocks[b].start = new Date(bt[b * len8]).toISOString().slice(0, 10);
        out.streams[name] = {
            full: summ(st.gross, st.net, st.turnover),
            halves: {
                h1: summ(st.gross.slice(0, h), st.net.slice(0, h), st.turnover.slice(0, h)),
                h2: summ(st.gross.slice(h), st.net.slice(h), st.turnover.slice(h)),
                h2MeanNet4: mean(st.net.slice(h)),
                h2Positive: mean(st.net.slice(h)) > 0,
            },
            blocks,
            perYearGross: perYear(bt, st.gross),
            perYearNet4: perYear(bt, st.net),
            recent: { last12mNet4: sharpe(last12), last12mMean: mean(last12), last24mNet4: sharpe(last24), last24mMean: mean(last24) },
            rolling12mNet4: rolling(bt, st.net, w12, Math.round(w12 / 4)),
            decayTest: trendTest(st.net, 8, 20261901),
            decayTestGross: trendTest(st.gross, 8, 20261902),
        };
    }

    // The practical question: does the mix still have a positive recent net, and is its decay less
    // severe than the carry book's?
    const cw = out.streams.carryDispersion;
    const mw = out.streams.mix25;
    const tw = out.streams.topLSFade;
    out.verdict = {
        note: 'Falsifier: no decay if last-third block Sharpe is within one SE of first-third and trend p > 0.05; decay if recent net@4 <= 0 and the trend test is significant.',
        carryDecayed: cw.halves.h2.net4Sharpe <= 0 && cw.recent.last12mNet4 <= 0,
        topDecayed: tw.halves.h2.net4Sharpe <= 0 && tw.recent.last12mNet4 <= 0,
        mixDecayed: mw.halves.h2.net4Sharpe <= 0 && mw.recent.last12mNet4 <= 0,
        carryLast12Net4: cw.recent.last12mNet4,
        topLast12Net4: tw.recent.last12mNet4,
        mixLast12Net4: mw.recent.last12mNet4,
        carryH2BreakEvenBps: cw.halves.h2.breakEvenBps,
        carryH1BreakEvenBps: cw.halves.h1.breakEvenBps,
        carryTrendP: cw.decayTest.pPerm,
        topTrendP: tw.decayTest.pPerm,
        mixTrendP: mw.decayTest.pPerm,
        validationPass: validation ? validation.matchesE23 : null,
    };
    return out;
}
