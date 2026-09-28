// E15 - L14: does the carry complex survive when the perp leg is the TRADED price?
//
// Every basis-marked number in the lab marks the perp leg at Binance's **mark price**, which is not a
// traded price: it is an index (median of spot across venues) plus a moving average of the basis,
// deliberately smoothed. Two things can go wrong because of that:
//
//   1. A smoothed series is mechanically mean-reverting against the spot it is derived from, so the
//      spread `spot - mark` contains an untradable component. L11's "basis reversion" signal
//      (IC 8/8 positive, convergence Sharpe +9.15) was measured against that spread.
//   2. The delta-neutral book's tail could be understated (a smoothed series has smaller extremes),
//      so the flat book's 7.96 % drawdown and the dispersion book's 2.93 % could both be flattered,
//      or the dispersion advantage could be manufactured by the smoothing.
//
// This experiment re-measures the whole carry complex with the perp leg set to the **traded 8h close**
// from `data/perp_8h.json` (Binance `futures/um` klines — the harvest recipe is in `data/README.md`),
// and reports the mark-minus-traded spread as a series in its own right so the size of the smoothing
// is visible. It shares the code paths exactly: `e3_carry.js#loadCarryBook(symbols, {perp})`,
// `e7#reversionFromBook`, `e12#buildXsSeries`.

import { SYMBOLS, loadMarkPrices, serialDesignEffect, robustDesignEffect, pearsonCorrelation } from '../lib/lab.js';
import { loadFundingBuckets, loadCarryBook } from './e3_carry.js';
import { reversionFromBook } from './e7_basis_reversion.js';
import { buildXsSeries, statsOf, placeboSummary } from './e12_xs_carry.js';
import { sizingFromBook } from './e11_vol.js';

const PERIODS_PER_YEAR = 365 * 3;
const GRID = 28_800_000;

const acf1 = (x) => {
    const v = x.filter(Number.isFinite);
    const n = v.length;
    const m = v.reduce((a, b) => a + b, 0) / n;
    let num = 0; let den = 0;
    for (let i = 0; i < n; i++) { den += (v[i] - m) ** 2; if (i + 1 < n) num += (v[i] - m) * (v[i + 1] - m); }
    return den > 0 ? num / den : NaN;
};

// mark-minus-traded, per symbol, on the grid points where BOTH exist.
async function perpSpread(symbols) {
    const ext = await loadMarkPrices().catch(() => null);
    const traded = await loadMarkPrices('src/NeuLegion-lab/data/perp_8h.json').catch(() => null);
    const per = [];
    for (const s of symbols) {
        const buckets = await loadFundingBuckets(s);
        const arr = [];
        for (const b of buckets) {
            const t = b.t;
            const mk = b.markPrice > 0 ? b.markPrice : (ext && ext[s] ? ext[s].get(t) : undefined);
            const td = traded && traded[s] ? traded[s].get(t) : undefined;
            if (!(mk > 0) || !(td > 0)) continue;
            arr.push({ t, rel: mk / td - 1, abs: mk - td });
        }
        if (arr.length < 200) continue;
        const rel = arr.map((x) => x.rel);
        const mean = rel.reduce((a, b) => a + b, 0) / rel.length;
        const sd = Math.sqrt(rel.reduce((a, b) => a + (b - mean) ** 2, 0) / (rel.length - 1));
        const srt = rel.slice().sort((a, b) => a - b);
        per.push({
            symbol: s, n: arr.length,
            mean, sd, acf1: acf1(rel),
            p01: srt[Math.floor(0.01 * srt.length)], p99: srt[Math.floor(0.99 * srt.length)],
            min: srt[0], max: srt[srt.length - 1],
            fractionNegative: rel.filter((x) => x < 0).length / rel.length,
            first: new Date(arr[0].t).toISOString(), last: new Date(arr[arr.length - 1].t).toISOString(),
        });
    }
    return per;
}

// The six headline readings for one perp source.
async function sourceSummary(perp, symbols) {
    const book = await loadCarryBook(symbols, { perp });
    const flat = {};
    for (const p of book.perSym) {
        const st = statsOf(p.rets);
        const bm = p.basis.reduce((a, b) => a + b, 0) / p.basis.length;
        const bsd = Math.sqrt(p.basis.reduce((a, b) => a + (b - bm) ** 2, 0) / (p.basis.length - 1));
        flat[p.symbol] = { periods: p.rets.length, sharpe: st.sharpe, annualized: st.annualized, maxDrawdown: st.maxDrawdown, basisStd: bsd, maxAbsBasis: Math.max(...p.basis.map(Math.abs)), noMark: p.noMark, raggedSkipped: p.raggedSkipped };
    }
    const pooled = statsOf(book.pooled);
    const xs = await buildXsSeries(symbols, { perp });
    const xsBooks = xs.available ? {
        flat: statsOf(xs.books.flat), xsLevel: statsOf(xs.books.xsLevel), xsRank: statsOf(xs.books.xsRank),
        xsFundingOnly: statsOf(xs.books.xsFundingOnly),
        marketCorr: { xsLevel: pearsonCorrelation(xs.books.xsLevel, xs.books.market), xsRank: pearsonCorrelation(xs.books.xsRank, xs.books.market) },
        placebo: placeboSummary(xs.placeboSharpes, statsOf(xs.books.xsLevel).sharpe, statsOf(xs.books.xsRank).sharpe),
        first: new Date(xs.times[0]).toISOString(), last: new Date(xs.times[xs.times.length - 1]).toISOString(), periods: xs.times.length,
    } : null;
    const rev = reversionFromBook(book.perSym, { zWindow: 60 });
    const revOk = !!(rev && rev.pooled);
    const perIc = revOk ? rev.perSymbol.map((x) => x.ic).filter(Number.isFinite) : [];
    // Sizing, through the *identical* code path as E11 (L09): does the vol/inverse-vol result also
    // survive the perp-source swap? This is the claim L09's doc makes, so measure it rather than infer.
    const sz = sizingFromBook(book);
    return {
        perp,
        pooled: { ...pooled, designEffect: serialDesignEffect(book.pooled, 90).designEffect, robustDesignEffect: robustDesignEffect(book.pooled) },
        perSymbol: flat,
        xs: xsBooks,
        sizing: {
            unsized: { sharpe: sz.carryPooled.unsized.sharpe, maxDrawdown: sz.carryPooled.unsized.maxDrawdown },
            volTarget: { sharpe: sz.carryPooled.sized.sharpe, maxDrawdown: sz.carryPooled.sized.maxDrawdown, designEffect: sz.carryPooled.sizedDesignEffect },
            inverseVol: { sharpe: sz.carryCrossSection.inverseVol.sharpe, maxDrawdown: sz.carryCrossSection.inverseVol.maxDrawdown },
            equalWeight: { sharpe: sz.carryCrossSection.equalWeight.sharpe },
            controlRandom: { unsizedSharpe: sz.controlRandom.unsized.sharpe, sizedSharpe: sz.controlRandom.sized.sharpe },
        },
        reversion: revOk ? {
            icMin: Math.min(...perIc), icMedian: perIc.slice().sort((a, b) => a - b)[Math.floor(perIc.length / 2)], icMax: Math.max(...perIc), icPositive: perIc.filter((x) => x > 0).length, icN: perIc.length,
            basisOnlySharpe: rev.pooled.basisOnly.sharpe, basisOnlyAnnualized: rev.pooled.basisOnly.annualized,
            basisOnlyDE: rev.pooled.basisOnly.serialDesignEffect, basisOnlyDERobust: rev.pooled.basisOnly.robustDesignEffect,
            followOnlySharpe: rev.pooled.followOnly.sharpe,
            carryPlusSharpe: rev.pooled.carryPlus.sharpe,
            marketCorr: rev.pooled.marketCorr,
        } : { available: false },
    };
}

export async function run({ symbols = SYMBOLS } = {}) {
    const spread = await perpSpread(symbols);
    const mark = await sourceSummary('mark', symbols);
    const traded = await sourceSummary('traded', symbols);

    const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o ? o[k] : null]));
    const cmp = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && a !== 0 ? b / a : NaN);

    const comparison = {
        pooledFlatSharpe: { mark: mark.pooled.sharpe, traded: traded.pooled.sharpe, ratio: cmp(mark.pooled.sharpe, traded.pooled.sharpe) },
        pooledFlatDrawdown: { mark: mark.pooled.maxDrawdown, traded: traded.pooled.maxDrawdown },
        xsRankSharpe: { mark: mark.xs && mark.xs.xsRank.sharpe, traded: traded.xs && traded.xs.xsRank.sharpe, ratio: cmp(mark.xs && mark.xs.xsRank.sharpe, traded.xs && traded.xs.xsRank.sharpe) },
        xsRankDrawdown: { mark: mark.xs && mark.xs.xsRank.maxDrawdown, traded: traded.xs && traded.xs.xsRank.maxDrawdown },
        reversionIcMedian: { mark: mark.reversion.icMedian, traded: traded.reversion.icMedian },
        reversionBasisOnlySharpe: { mark: mark.reversion.basisOnlySharpe, traded: traded.reversion.basisOnlySharpe, ratio: cmp(mark.reversion.basisOnlySharpe, traded.reversion.basisOnlySharpe) },
        reversionRobustDE: { mark: mark.reversion.basisOnlyDERobust, traded: traded.reversion.basisOnlyDERobust },
        xsRankVsFlatDrawdownAdvantage: {
            mark: mark.xs ? mark.xs.flat.maxDrawdown - mark.xs.xsRank.maxDrawdown : null,
            traded: traded.xs ? traded.xs.flat.maxDrawdown - traded.xs.xsRank.maxDrawdown : null,
        },
        sizingVolTargetSharpe: { mark: mark.sizing.volTarget.sharpe, traded: traded.sizing.volTarget.sharpe, ratio: cmp(mark.sizing.volTarget.sharpe, traded.sizing.volTarget.sharpe) },
        sizingVolTargetDrawdown: { mark: mark.sizing.volTarget.maxDrawdown, traded: traded.sizing.volTarget.maxDrawdown },
        sizingInverseVolSharpe: { mark: mark.sizing.inverseVol.sharpe, traded: traded.sizing.inverseVol.sharpe, ratio: cmp(mark.sizing.inverseVol.sharpe, traded.sizing.inverseVol.sharpe) },
        sizingInverseVolDrawdown: { mark: mark.sizing.inverseVol.maxDrawdown, traded: traded.sizing.inverseVol.maxDrawdown },
    };

    return {
        config: { symbols: symbols.length, markPooledPeriods: mark.pooled.n, tradedPooledPeriods: traded.pooled.n, markXsPeriods: mark.xs && mark.xs.periods, tradedXsPeriods: traded.xs && traded.xs.periods },
        perpSpread: {
            perSymbol: spread,
            note: 'mark/traded - 1 at the funding grid; a smoothed mark should be small, mean-reverting (acf1 < 0) and rarely large',
        },
        mark, traded, comparison,
    };
}
