// E14 - data-integrity tests for the funding/mark/candle joins that every carry
// result depends on. These are REGRESSION tests, not measurements: each one encodes
// a bug that was actually found (CYCLE-005/006) and that would silently corrupt every
// basis-marked number if it returned.
//
// The tests:
//   1. mark_source_agreement - `data/mark_8h.json` must match the shipped funding
//      `markPrice` wherever both exist (they overlap only at the 2023-10-31 seam).
//   2. mark_precision         - the lab marks must not be integer-quantised. The first
//      build stored them as `round(price*100)`, which gave DOGE 67 distinct values and
//      injected ~1% of fake per-period basis noise (Sharpe 4.77 -> 2.14 on the flat book).
//   3. candle_grid            - every candle timestamp on the hour, no duplicates, and the OHLC range
//      invariant `low <= close <= high` (CYCLE-017: e25's passive-fill model reads high/low, so a
//      swapped column would silently corrupt it).
//   4. funding_buckets        - funding rows aggregate into 8h buckets; a bucket may
//      contain at most 4 rows (Binance 2h funding). Only SOLUSDT should have any
//      (2022-11-09..18, i.e. FTX) - a plain Map keyed on the grid silently discards all
//      but one of those payments.
//   5. no_frozen_spot         - the stale-tail detector. The candle files end
//      2026-09-19 but the funding files run to 2026-09-24; an unguarded lookup
//      carry-forwards the last spot price, so spotRet = 0 while the mark keeps moving
//      (fake ±5%/8h basis). Fail if any period has spotRet == 0 and |basis| > 0.5%.
//   6. spot_guard             - no carry return may be stamped after `spotAt.lastClose`.
//   7. series_sanity          - per-symbol basis std and max |basis| within sane bounds.
//   8. perp_source_coverage    - `data/perp_8h.json` (the TRADED perp close, L14) is present and full.
//  11. oi_integrity           - `data/open_interest_8h.json` (L07: 5-min metrics aggregated to the 8h
//      grid) sits on the funding grid, and its USDT notional reconciles with `contracts x perp close`
//      (median ratio ~1). A mis-scaled or timezone-shifted OI series would corrupt every capacity read.
//  10. perp_flow_integrity    - `data/perp_flow_8h.json` (L15: perp quote volume / trade count) sits on
//      the SAME grid as the traded perp closes and its quote volume reconciles with its own base volume
//      (`qv ~= close*vol`, median ratio ~1). A column mix-up or a one-bar grid offset would silently
//      distort every capacity number, so both are asserted here.
//   9. perp_mark_spread_sane   - the mark price must track the traded price (it is a smoothed index,
//      so `mark/traded - 1` should be ~0 with a small sd and no large outliers). A big spread means
//      one of the two series is misaligned, and every mark-vs-traded comparison would be garbage.
//  12. oi_missing_is_null     - the positioning fields have ASYMMETRIC coverage (BTCUSDT 2020-09, the
//      other seven 2021-12) and missing values are stored as null, never 0. A cross-sectional book that
//      zeroes-and-demeans a missing value hands the absent symbol a large weight (L10-r, found in
//      CYCLE-013 while challenging F-28).

import { loadCloseLookup, loadMarkPrices, loadOpenInterest, loadPerpFlow, loadSeries, REPO, SYMBOLS } from '../lib/lab.js';
import { parseFundingJsonl } from '../../NeuLegion-master/NeuLegion-master/src/analysis/carry.js';
import { loadFundingBuckets, loadCarryBook } from './e3_carry.js';

const GRID_MS = 28_800_000;

export async function run({ symbols = SYMBOLS } = {}) {
    const checks = [];
    const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

    const ext = await loadMarkPrices();
    const extRaw = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/data/mark_8h.json'));

    // ---- 1. mark source agreement on the overlap ----
    const agreement = {};
    let agreementOk = true;
    for (const s of symbols) {
        const { rows } = parseFundingJsonl(await globalThis.__fs.readTextFile(`${REPO}/src/data/funding_${s}_8h.jsonl`));
        const map = ext[s];
        let maxRel = 0;
        let n = 0;
        for (const r of rows) {
            if (!(r.markPrice > 0) || !map) continue;
            const nearest = Math.round(r.timestamp / GRID_MS) * GRID_MS;
            const tt = Math.abs(r.timestamp - nearest) < 60_000 ? nearest : Math.ceil(r.timestamp / GRID_MS) * GRID_MS;
            const e = map.get(tt);
            if (e == null) continue;
            maxRel = Math.max(maxRel, Math.abs(e - r.markPrice) / r.markPrice);
            n++;
        }
        agreement[s] = { compared: n, maxRelDiff: maxRel };
        if (n < 1 || maxRel > 1e-3) agreementOk = false;
    }
    add('mark_source_agreement', agreementOk, agreement);

    // ---- 2. mark precision (not integer-quantised) ----
    const precision = {};
    let precisionOk = true;
    for (const s of symbols) {
        const v = extRaw.symbols[s] ? extRaw.symbols[s].v.filter((x) => x != null) : [];
        const uniq = new Set(v).size;
        const ratio = v.length ? uniq / v.length : 0;
        const intFrac = v.length ? v.filter(Number.isInteger).length / v.length : 1;
        precision[s] = { nonNull: v.length, unique: uniq, uniqueRatio: +ratio.toFixed(3), integerFraction: +intFrac.toFixed(4) };
        if (ratio < 0.5 || intFrac > 0.5) precisionOk = false;
    }
    add('mark_precision', precisionOk, precision);

    // ---- 3. candle grid ----
    const grid = {};
    let gridOk = true;
    for (const s of symbols) {
        const name = s === 'btcusdt' ? 'candles.jsonl' : `candles_${s}_1h.jsonl`;
        let series;
        try { series = await loadSeries(name); } catch { grid[s] = { available: false }; continue; }
        let offHour = 0;
        let dup = 0;
        let badRange = 0;
        for (let i = 0; i < series.t.length; i++) {
            if (series.t[i] % 3_600_000 !== 0) offHour++;
            if (i > 0 && series.t[i] === series.t[i - 1]) dup++;
            // OHLC range invariant (CYCLE-017): the passive-fill model (e25) reads high/low, so a
            // swapped or mis-parsed column would silently corrupt it. low <= close <= high must hold.
            const { high: hi, low: lo, close: cl } = series;
            if (!(Number.isFinite(hi[i]) && Number.isFinite(lo[i]) && Number.isFinite(cl[i])) || lo[i] > cl[i] || cl[i] > hi[i]) badRange++;
        }
        grid[s] = { bars: series.n, offHour, duplicateTimestamps: dup, badRange, lastClose: new Date(series.t[series.n - 1] + 3_600_000).toISOString() };
        if (offHour > 0 || dup > 0 || badRange > 0) gridOk = false;
    }
    add('candle_grid', gridOk, grid);

    // ---- 4. funding buckets ----
    const buckets = {};
    let bucketsOk = true;
    for (const s of symbols) {
        let b;
        try { b = await loadFundingBuckets(s); } catch { buckets[s] = { available: false }; continue; }
        const maxN = b.reduce((a, x) => Math.max(a, x.n), 0);
        const multi = b.filter((x) => x.n > 1);
        buckets[s] = { buckets: b.length, maxRowsPerBucket: maxN, multiRowBuckets: multi.length, multiFirst: multi.length ? new Date(multi[0].t).toISOString() : null, multiLast: multi.length ? new Date(multi[multi.length - 1].t).toISOString() : null };
        if (maxN > 4) bucketsOk = false;
        if (s !== 'solusdt' && multi.length > 0) bucketsOk = false;
    }
    add('funding_buckets', bucketsOk, buckets);

    // ---- 5/6/7. carry series invariants ----
    const book = await loadCarryBook(symbols);
    const frozen = [];
    let frozenOk = true;
    let guardOk = true;
    const sane = {};
    let saneOk = true;
    for (const p of book.perSym) {
        const spotAt = await loadCloseLookup(p.symbol === 'btcusdt' ? 'candles.jsonl' : `candles_${p.symbol}_1h.jsonl`, { barMs: 3_600_000 });
        if (p.times.length && p.times[p.times.length - 1] > spotAt.lastClose) guardOk = false;
        for (let i = 0; i < p.rets.length; i++) {
            if (p.spot[i] === 0 && Math.abs(p.basis[i]) > 0.005) {
                frozenOk = false;
                if (frozen.length < 5) frozen.push({ symbol: p.symbol, at: new Date(p.times[i]).toISOString(), basis: p.basis[i] });
            }
        }
        const mean = p.basis.reduce((a, b) => a + b, 0) / p.basis.length;
        const sd = Math.sqrt(p.basis.reduce((a, b) => a + (b - mean) ** 2, 0) / (p.basis.length - 1));
        const maxAbs = Math.max(...p.basis.map(Math.abs));
        sane[p.symbol] = { periods: p.rets.length, basisStd: sd, maxAbsBasis: maxAbs, tailSkipped: p.tailSkipped, raggedSkipped: p.raggedSkipped, noMark: p.noMark, sub8hBuckets: p.sub8hBuckets };
        if (!(sd < 0.01) || !(maxAbs < 0.35)) saneOk = false;
    }
    add('no_frozen_spot', frozenOk, { violations: frozen.length, examples: frozen });
    add('spot_guard', guardOk, { note: 'no carry return stamped after the last candle close' });
    add('series_sanity', saneOk, sane);

    const pooledMax = Math.max(...book.pooled.map(Math.abs));
    add('pooled_no_huge_returns', pooledMax < 0.1, { pooledPeriods: book.pooled.length, maxAbsPooledReturn: pooledMax });

    // ---- 8. the traded-perp source (L14) is present, fresh and consistent with the mark ----
    const perpRaw = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/data/perp_8h.json'));
    const traded = await loadMarkPrices('src/NeuLegion-lab/data/perp_8h.json');
    const extMarks = await loadMarkPrices();
    const perpCov = {};
    let perpOk = true;
    let spreadOk = true;
    for (const s of symbols) {
        const td = traded[s];
        const mk = extMarks[s];
        if (!td || !mk) { perpCov[s] = { available: false }; perpOk = false; continue; }
        const tvals = [...td.entries()].filter(([, v]) => v != null);
        let n = 0;
        let sum = 0;
        let sumSq = 0;
        let maxAbs = 0;
        for (const [t, v] of tvals) {
            const m = mk.get(t);
            if (m == null || !(m > 0)) continue;
            const rel = m / v - 1;
            n++;
            sum += rel;
            sumSq += rel * rel;
            if (Math.abs(rel) > maxAbs) maxAbs = Math.abs(rel);
        }
        const mean = n ? sum / n : NaN;
        const sd = n > 1 ? Math.sqrt(Math.max(0, sumSq / n - mean * mean)) : NaN;
        perpCov[s] = { nonNull: tvals.length, first: new Date(tvals[0][0]).toISOString(), last: new Date(tvals[tvals.length - 1][0]).toISOString(), comparedToMark: n, spreadMean: mean, spreadSd: sd, spreadMaxAbs: maxAbs };
        // The traded series must cover the 2020-07..2023-11 gap the mark file fills, and the
        // mark-vs-traded spread must be small: > 0.5 % sd would mean one of the two is misaligned.
        if (tvals.length < 6000) perpOk = false;
        if (!(Math.abs(mean) < 0.001) || !(sd < 0.005) || !(maxAbs < 0.05)) spreadOk = false;
    }
    add('perp_source_coverage', perpOk, { source: perpRaw.source, builtAt: perpRaw.builtAt, symbols: perpCov });
    add('perp_mark_spread_sane', spreadOk, { note: 'mark/traded - 1 must be ~0 (smoothed index tracks the traded price)', symbols: Object.fromEntries(Object.entries(perpCov).map(([k, v]) => [k, { mean: v.spreadMean, sd: v.spreadSd, maxAbs: v.spreadMaxAbs }])) });

    // ---- 10. perp flow (L15) is on the traded-perp grid and reconciles qv ~= close*vol ----
    const flowRaw = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/data/perp_flow_8h.json'));
    const flow = await loadPerpFlow();
    const flowDet = {};
    let flowOk = true;
    for (const s of symbols) {
        const f = flow[s];
        const td = traded[s];
        const pRow = perpRaw.symbols[s];
        if (!f || !td || !pRow) { flowDet[s] = { available: false }; flowOk = false; continue; }
        // same grid: flow t0 is the traded perp's first non-null grid time (= perp t0 + step), and both step by 8h.
        const tvals = [...td.entries()].filter(([, v]) => v != null).sort((a, b) => a[0] - b[0]);
        const firstCloseTime = tvals.length ? tvals[0][0] : NaN;
        const gridOk = f.t0 === firstCloseTime && f.t0 % GRID_MS === 0 && f.stepMs === GRID_MS;
        // reconcile: qv / (close*vol) should sit at 1 (VWAP ~= close) with a tight distribution.
        const ratios = [];
        let badVals = 0;
        for (let i = 0; i < f.nKlines; i++) {
            const qv = f.qv[i]; const vol = f.vol[i]; const cnt = f.cnt[i];
            if ((qv != null && !(qv >= 0)) || (vol != null && !(vol >= 0)) || (cnt != null && !(cnt >= 0))) badVals++;
            if (qv == null && vol == null && cnt == null) continue;
            if (qv != null && !(cnt > 0)) badVals++;
            const close = td.get(f.t0 + i * f.stepMs);
            if (close > 0 && vol > 0 && qv > 0) ratios.push(qv / (close * vol));
        }
        ratios.sort((a, b) => a - b);
        const med = ratios.length ? ratios[Math.floor(ratios.length / 2)] : NaN;
        const nonNull = f.qv.filter((x) => x != null).length;
        flowDet[s] = { nKlines: f.nKlines, nonNullQv: nonNull, gridMatchesTradedClose: gridOk, ratioMedian: med, ratioMin: ratios[0], ratioMax: ratios[ratios.length - 1], badValues: badVals };
        if (!gridOk || !(med > 0.95 && med < 1.05) || !(ratios[0] > 0.4) || !(ratios[ratios.length - 1] < 4) || badVals > 0 || nonNull < 6000) flowOk = false;
    }
    add('perp_flow_integrity', flowOk, { source: flowRaw.source, builtAt: flowRaw.builtAt, symbols: flowDet });

    // ---- 11. open interest (L07) is on the 8h grid and reconciles oiVal ~= oi x perp close ----
    const oiRaw = JSON.parse(await globalThis.__fs.readTextFile('src/NeuLegion-lab/data/open_interest_8h.json'));
    const oiAll = await loadOpenInterest();
    const tradedForOi = await loadMarkPrices('src/NeuLegion-lab/data/perp_8h.json');
    const oiDet = {};
    let oiOk = true;
    for (const s of symbols) {
        const o = oiAll[s];
        const td = tradedForOi[s];
        if (!o || !td) { oiDet[s] = { available: false }; oiOk = false; continue; }
        const ratios = [];
        let badVals = 0;
        let nn = 0;
        for (let i = 0; i < o.nKlines; i++) {
            const t = o.t0 + i * o.stepMs;
            const oi = o.oi[i]; const val = o.oiVal[i];
            if (oi == null && val == null) continue;
            nn++;
            if (!(oi > 0) || !(val > 0)) { badVals++; continue; }
            const close = td.get(t);
            if (close > 0) ratios.push(val / (oi * close));
        }
        ratios.sort((a, b) => a - b);
        const med = ratios.length ? ratios[Math.floor(ratios.length / 2)] : NaN;
        const gridOk = o.t0 % GRID_MS === 0 && o.stepMs === GRID_MS && o.oi.length === o.nKlines;
        oiDet[s] = { nKlines: o.nKlines, nonNull: nn, gridOk, ratioMedian: med, ratioMin: ratios[0], ratioMax: ratios[ratios.length - 1], badValues: badVals, first: new Date(o.t0).toISOString().slice(0, 10) };
        if (!gridOk || badVals > 0 || nn < 5000 || !(med > 0.9 && med < 1.1) || !(ratios[0] > 0.5) || !(ratios[ratios.length - 1] < 2)) oiOk = false;
    }
    add('oi_integrity', oiOk, { source: oiRaw.source, builtAt: oiRaw.builtAt, symbols: oiDet });

    // ---- 12. positioning coverage asymmetry + missing-is-null (L10-r precondition) ----
    // The OI/toptrader fields do NOT cover all symbols from day one (BTCUSDT 2020-09, the other seven
    // 2021-12). A cross-sectional book MUST mask the absent symbols; if a missing value were stored as 0
    // instead of null, demeaning would hand the absent symbols a large weight (L10-r). Assert both: the
    // coverage truly is asymmetric, and no missing value is stored as a bare 0.
    const cov = symbols.map((s) => ({ s, n: oiAll[s] ? oiAll[s].oiVal.filter((x) => x != null).length : 0 }));
    const covMin = Math.min(...cov.map((c) => c.n));
    const covMax = Math.max(...cov.map((c) => c.n));
    let zeroStored = 0;
    let topLsBad = 0;
    for (const s of symbols) {
        const o = oiAll[s]; if (!o) continue;
        for (let i = 0; i < o.nKlines; i++) {
            if (o.oiVal[i] === 0 || o.oi[i] === 0 || o.topLS[i] === 0) zeroStored++;
            if (o.topLS[i] != null && !(o.topLS[i] > 0 && o.topLS[i] < 100)) topLsBad++;
        }
    }
    const asymOk = covMax - covMin >= 1000;
    const coverageOk = asymOk && zeroStored === 0 && topLsBad === 0;
    add('oi_missing_is_null', coverageOk, { coveragePeriods: Object.fromEntries(cov.map((c) => [c.s, c.n])), coverageSpread: covMax - covMin, zeroStored, topLsOutOfRange: topLsBad, note: 'coverage is asymmetric (masking required); missing stored as null, never 0' });

    // ---- 13. sub-8h sleeve equality (L10-d / F-61, CYCLE-044) ----
    // The repo's `carryOnBarGrid` spreads every funding row over the DEFAULT 8h bar count regardless of
    // the interval it actually covers, so SOLUSDT's four 2h payments in an 8h window collapse to ONE 8h
    // rate (a 4x understatement; `e53_carry_grid_audit.js` measures it). The lab's loader sums rows into
    // 8h buckets FIRST (check 4 above), so the aggregation must be lossless and the bucket total over
    // SOL's FTX window must be the true sleeve total. This check pins the lab side: a regression to the
    // repo's per-row scaling would make the bucket-projected sleeve ~1x the raw-row projection instead of
    // ~3x, and would break the lossless sum.
    {
        const solText = await globalThis.__fs.readTextFile(`${REPO}/src/data/funding_solusdt_8h.jsonl`);
        const solRows = parseFundingJsonl(solText).rows;
        const solBuckets = await loadFundingBuckets('solusdt');
        const rawTotal = solRows.reduce((a, x) => a + x.fundingRate, 0);
        const bktTotal = solBuckets.reduce((a, x) => a + x.fundingSum, 0);
        const FTX0 = Date.parse('2022-11-09T00:00:00Z');
        const FTX1 = Date.parse('2022-11-20T00:00:00Z');
        const inFtx = (t) => t >= FTX0 && t < FTX1;
        const ftxRaw = solRows.filter((x) => inFtx(x.timestamp)).reduce((a, x) => a + x.fundingRate, 0);
        const ftxFtxBuckets = solBuckets.filter((x) => inFtx(x.t));
        const ftxBkt = ftxFtxBuckets.reduce((a, x) => a + x.fundingSum, 0);
        const multiRow = ftxFtxBuckets.filter((x) => x.n > 1).length;
        const lossless = Math.abs(rawTotal - bktTotal) < 1e-9;
        const ftxSummed = Math.abs(ftxRaw - ftxBkt) < 1e-9;
        const sub8hPresent = multiRow > 0;
        add('sub_8h_sleeve_equality', lossless && ftxSummed && sub8hPresent, {
            solRows: solRows.length, solBuckets: solBuckets.length,
            rawTotal: +rawTotal.toFixed(6), bucketTotal: +bktTotal.toFixed(6),
            ftxMultiRowBuckets: multiRow, ftxRawSum: +ftxRaw.toFixed(6), ftxFtxBucketSum: +ftxBkt.toFixed(6),
            note: 'the lab buckets rows into 8h sums (lossless); the repo per-row projection understates this window ~3x (F-61/L10-d)',
        });
    }

    const pass = checks.every((c) => c.pass);
    return { at: new Date().toISOString(), pass, checks };
}
