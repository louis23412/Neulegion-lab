// NeuLegion research lab - shared measurement harness.
//
// READ-ONLY on the shipped repo. Everything numeric here is the repo's own code:
// the causal signal pipeline (`analysis/features.js`), the honest backtest
// (`analysis/backtest.js`), the dependence-aware inference (`analysis/walkforward.js`,
// `analysis/dependence.js`) and the Sharpe/DSR family (`analysis/performance.js`).
// The lab adds only loading, alignment and panel plumbing - deliberately, so a
// lab number and a report number are computed by the same arithmetic.
//
// Constant of record: `periodsPerYear = 252` is what the A/B uses (`analyze.js`),
// so lab Sharpes are on the same scale as `report.json`.

import { barReturns, dependenceSummary, sharpeStandardError } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';
import { backtestMetrics, strategyReturns, turnover, equityCurve, maxDrawdown } from '../../NeuLegion-master/NeuLegion-master/src/analysis/backtest.js';
import { clusterJackknife, foldWindowClusters, meanPairwiseCorrelation, pearsonCorrelation } from '../../NeuLegion-master/NeuLegion-master/src/analysis/dependence.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';
import { causalZScore, clampPosition, DEFAULT_POSITION, positionAt } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';

export const REPO = 'src/NeuLegion-master/NeuLegion-master';
export const PERIODS_PER_YEAR = 252;

const fsApi = () => {
    const f = globalThis.__fs;
    if (!f || typeof f.readTextFile !== 'function') {
        throw new Error('lab: globalThis.__fs is not set (the harness needs readTextFile)');
    }
    return f;
};

// ---- data loading -----------------------------------------------------------

export async function readJsonl(relPath) {
    const text = await fsApi().readTextFile(String(relPath));
    const out = [];
    for (const line of text.split('\n')) if (line.trim()) out.push(JSON.parse(line));
    return out;
}

// One candle file -> {t (ms), close, volume, high, low, label}.
//
// `relPath` is either a bare file name (resolved under `src/data/`) or a path
// starting with `src/` (resolved from the workspace root). The bare-name form
// falls back to `<repo>/src/<name>` because BTC 1h ships as `src/candles.jsonl`,
// not `src/data/candles_btcusdt_1h.jsonl`.
//
// `high`/`low` are carried as well (CYCLE-017): the stored klines do contain the
// bar range (L10-g), and a passive-fill model needs it. Nothing that predates e25
// reads them, so adding them is result-neutral.
export async function loadSeries(relPath) {
    const candidates = relPath.startsWith('src/')
        ? [relPath]
        : [`${REPO}/src/data/${relPath}`, `${REPO}/src/${relPath}`];
    let rows = null;
    let lastErr = null;
    for (const c of candidates) {
        try { rows = await readJsonl(c); break; } catch (e) { lastErr = e; }
    }
    if (!rows) throw lastErr || new Error(`lab: cannot load ${relPath}`);
    const t = new Array(rows.length);
    const close = new Array(rows.length);
    const volume = new Array(rows.length);
    const high = new Array(rows.length);
    const low = new Array(rows.length);
    const open = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        t[i] = Date.parse(r.timestamp);
        close[i] = Number(r.close);
        volume[i] = Number(r.volume);
        high[i] = Number(r.high);
        low[i] = Number(r.low);
        open[i] = Number(r.open);
    }
    return { t, close, volume, high, low, open, n: rows.length, label: relPath };
}

// Load every symbol of a basket: loadSeries for `candles_<sym>_<tf>.jsonl`.
export async function loadBasket(symbols, tf) {
    const out = [];
    for (const s of symbols) {
        const name = (tf === '1h' && s === 'btcusdt') ? 'candles.jsonl' : `candles_${s}_${tf}.jsonl`;
        out.push(await loadSeries(name));
    }
    return out;
}

// A price lookup that respects BAR LABELS. Candle files label a bar by its OPEN
// time, so the close of the bar labelled `L` is only known at `L + barMs`. Using
// `close(L)` as "the price at time L" is a one-bar look-ahead - it silently
// manufactured a Sharpe of -17 in the first E7 draft. `lookup(t)` returns the close
// of the last bar that has COMPLETED at or before `t` (null before the first).
export async function loadCloseLookup(relPath, { barMs = 3_600_000 } = {}) {
    const s = await loadSeries(relPath);
    const end = s.t.map((x) => x + barMs);
    const idxAt = (t) => {
        let lo = 0;
        let hi = end.length - 1;
        let best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (end[mid] <= t) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        return best;
    };
    const lookup = (t) => { const i = idxAt(t); return i >= 0 ? s.close[i] : null; };
    // The time the LAST bar closes. `lookup(t)` carry-forwards the last close for
    // every t beyond this, which is fine for "what was the price then?" but is a
    // silent trap when a caller pairs a data source that extends FURTHER than the
    // candles: the spot leg freezes while the other leg keeps moving, manufacturing
    // huge fake returns at the tail (CYCLE-006: funding_*.jsonl runs to 2026-09-24
    // but the candles stop 2026-09-19, which produced ±5%/8h fake "basis" moves).
    // Callers that care must guard with `t <= lookup.lastClose`.
    lookup.lastClose = end.length ? end[end.length - 1] : -Infinity;
    lookup.firstClose = end.length ? end[0] : Infinity;
    // Strict variant: the close of a bar that ENDS EXACTLY at `t`, else null. The
    // lenient lookup silently bridges missing bars (the alt 1h files have a few dozen
    // gaps), which stretches an 8h return into 9h/10h and mispairs it with an 8h
    // funding/mark leg. Anything that compares two legs must use `exact`.
    lookup.exact = (t) => { const i = idxAt(t); return (i >= 0 && end[i] === t) ? s.close[i] : null; };
    return lookup;
}

// Intersect several series on timestamp. Returns equal-length, timestamp-aligned
// copies (ascending). The 15m basket is already aligned; the 1h basket is not.
export function alignPanel(seriesList) {
    if (!seriesList.length) return [];
    const maps = seriesList.map((s) => {
        const m = new Map();
        for (let i = 0; i < s.t.length; i++) m.set(s.t[i], i);
        return m;
    });
    const shortest = seriesList.reduce((a, s) => (s.t.length < a.t.length ? s : a));
    const keep = [];
    for (const ts of shortest.t) if (maps.every((m) => m.has(ts))) keep.push(ts);
    return seriesList.map((s, m) => ({
        t: keep.slice(),
        close: keep.map((ts) => s.close[maps[m].get(ts)]),
        volume: keep.map((ts) => s.volume[maps[m].get(ts)]),
        high: keep.map((ts) => s.high[maps[m].get(ts)]),
        low: keep.map((ts) => s.low[maps[m].get(ts)]),
        open: keep.map((ts) => s.open[maps[m].get(ts)]),
        n: keep.length,
        label: s.label,
    }));
}

// Take the last `n` bars of every aligned series.
//
// Safe on RAW series (what buildPanel passes) and on PREPARED series: if the
// derived arrays (`returns`/`closes`/`volumes`, which `prepare` attaches) are
// present they are sliced too. Without the guard, `tail` on a prepared panel would
// leave full-length `returns` beside a sliced `close` - a silent length mismatch.
export function tail(seriesList, n) {
    return seriesList.map((s) => {
        const out = {
            ...s,
            t: s.t.slice(-n),
            close: s.close.slice(-n),
            volume: s.volume.slice(-n),
            high: s.high.slice(-n),
            low: s.low.slice(-n),
            open: s.open.slice(-n),
            n: Math.min(n, s.n),
        };
        if (Array.isArray(s.returns)) out.returns = s.returns.slice(-n);
        if (Array.isArray(s.closes)) out.closes = s.closes.slice(-n);
        if (Array.isArray(s.volumes)) out.volumes = s.volumes.slice(-n);
        return out;
    });
}

// Attach the derived series the lab's signal functions read.
//
// NAMING CONTRACT (matches the repo's `signalForCandidate`): a series carries
// `closes`, `returns`, `volumes` (PLURAL). Several shipped features read `closes`
// (`rangeLocation`, `fracDiffAt`, `volRegime` uses returns) - aliasing them here is
// what makes a lab arm identical to an A/B arm.
export function prepare(seriesList) {
    return seriesList.map((s, i) => {
        const returns = barReturns(s.close);
        return {
            ...s,
            closes: s.close,
            volumes: s.volume,
            returns,
            streamIndex: i,
            panel: { returnsByStream: null, streamIndex: i },
        };
    });
}

// Wire the cross-section: every prepared series gets the SAME panel object whose
// `returnsByStream` is the list of every stream's returns array.
export function withCrossSection(seriesList) {
    const returnsByStream = seriesList.map((s) => s.returns);
    return seriesList.map((s, i) => ({ ...s, streamIndex: i, panel: { returnsByStream, streamIndex: i } }));
}

// Extended perp mark prices on the 8h grid (`data/mark_8h.json`, from Binance
// `futures/um` markPriceKlines). The repo's funding files carry `markPrice = 0`
// before 2023-10, which confines every basis-marked carry result to ~2.9 years
// (CYCLE-005); this file restores 2020-07 onward so the carry complex can be tested
// through the 2021-05 and 2022 crashes. Returns { symbol: Map<openTimeMs, price> }.
export async function loadMarkPrices(relPath = 'src/NeuLegion-lab/data/mark_8h.json') {
    const raw = JSON.parse(await fsApi().readTextFile(relPath));
    const scale = raw.scale || 100;
    const out = {};
    for (const [sym, s] of Object.entries(raw.symbols)) {
        const m = new Map();
        for (let i = 0; i < s.v.length; i++) if (s.v[i] != null) m.set(s.t0 + i * s.stepMs, s.v[i] / scale);
        out[sym] = m;
    }
    return out;
}

// Perp market-activity on the 8h grid (`data/perp_flow_8h.json`, from Binance `futures/um`
// klines). Complements the price files: the raw kline payload carries the base volume, the USDT
// quote volume and the trade count, none of which the repo keeps. L15 uses `qv` (dollars traded
// per 8h) for an ADV and `cnt` for a trade-size sanity check.
//
// Returns { symbol: { t0, stepMs, nKlines, vol, qv, cnt } } where flow[i] is the 8h perp kline
// ENDING at `t0 + i*stepMs` (t0 = first available grid time; no leading null - unlike the price
// files, whose t0 is the first kline's OPEN time and whose v[0] is therefore null). qv is USDT.
export async function loadPerpFlow(relPath = 'src/NeuLegion-lab/data/perp_flow_8h.json') {
    const raw = JSON.parse(await fsApi().readTextFile(relPath));
    return raw.symbols;
}

// Index of the 8h grid slot that ENDS at `t`, or -1.
export function flowIndexAt(symFlow, t) {
    if (!symFlow) return -1;
    const i = Math.round((t - symFlow.t0) / symFlow.stepMs);
    return i >= 0 && i < symFlow.nKlines ? i : -1;
}

// Perp OPEN INTEREST on the 8h grid (`data/open_interest_8h.json`, from Binance `futures/um` daily
// metrics - 5-min source aggregated to the funding grid; see data/harvest_open_interest.js). L07's
// positioning half: OI is *who is levered and where*, mechanically distinct from order flow.
//
// Returns { symbol: { t0, stepMs, nKlines, oi, oiVal, topLS, takerLS } }; index i = grid time
// t0 + i*stepMs (00:00/08:00/16:00 UTC), null where the day is missing. `oiVal` is USDT notional.
export async function loadOpenInterest(relPath = 'src/NeuLegion-lab/data/open_interest_8h.json') {
    const raw = JSON.parse(await fsApi().readTextFile(relPath));
    return raw.symbols;
}

// ---- order-flow data (L07) --------------------------------------------------
//
// The shipped candles carry only OHLCV. `data/taker_1h.json` holds the Binance
// `takerBuyBaseVolume / volume` ratio (scaled by 10000) per symbol, aligned to the
// same 1h open-time grid - harvested from `data.binance.vision` monthly klines and
// stored in the lab so it survives scratch being wiped (see `data/README.md`).
//
// `loadTaker()` returns { symbol: Map<openTimeMs, ratio> }, ratio in [0,1].
export async function loadTaker(relPath = 'src/NeuLegion-lab/data/taker_1h.json') {
    const raw = JSON.parse(await fsApi().readTextFile(relPath));
    const scale = raw.scale || 10000;
    const out = {};
    for (const [sym, s] of Object.entries(raw.symbols)) {
        const m = new Map();
        for (let i = 0; i < s.v.length; i++) if (s.v[i] != null) m.set(s.t0 + i * s.stepMs, s.v[i] / scale);
        out[sym] = m;
    }
    return out;
}

// Attach `series.flow[k] = 2*ratio - 1` (signed order-flow imbalance, in [-1,1];
// NaN where there is no bar) to every stream, and wire the cross-section
// (`panel.flowByStream`) so cross-sectional flow features work like the repo's
// `crossSectionalReversal`. `symbols` must align with `seriesList` (SYMBOLS order).
export function attachFlow(seriesList, symbols, taker) {
    const withFlow = seriesList.map((s, i) => {
        const m = taker[symbols[i]];
        const flow = new Float64Array(s.t.length);
        for (let k = 0; k < s.t.length; k++) {
            const v = m ? m.get(s.t[k]) : undefined;
            flow[k] = v == null ? NaN : (2 * v - 1);
        }
        return { ...s, symbol: symbols[i], flow };
    });
    const flowByStream = withFlow.map((s) => s.flow);
    return withFlow.map((s, i) => ({ ...s, streamIndex: i, panel: { ...(s.panel || {}), flowByStream, streamIndex: i } }));
}

// ---- positions --------------------------------------------------------------

// The repo's causal z-score + clamp pipeline, vectorised over t. `fn(series, t, args)`
// must read only indices <= t (every shipped/prototype feature does).
export function positionsOf(fn, series, { window = 16, params = null, saturation, zWindow, minObs } = {}) {
    const n = series.returns.length;
    const out = new Array(n).fill(0);
    const opts = {
        window,
        zWindow: zWindow == null ? DEFAULT_POSITION.zWindow : zWindow,
        minObs: minObs == null ? DEFAULT_POSITION.minObs : minObs,
        params: params || null,
    };
    const sat = saturation == null ? DEFAULT_POSITION.saturation : saturation;
    for (let t = 0; t < n; t++) out[t] = clampPosition(causalZScore(fn, series, t, opts), { saturation: sat });
    return out;
}

// ---- scoring ----------------------------------------------------------------

// Net strategy metrics for one stream. `effectiveBars` feeds dsrAdjusted.
export function score(returns, signals, { costBps = 0, effectiveBars = null, trials = 1 } = {}) {
    return backtestMetrics({ returns, signals, costBps, periodsPerYear: PERIODS_PER_YEAR, trials, effectiveBars });
}

export function netSeries(returns, signals, costBps = 0) {
    return strategyReturns({ returns, signals, costBps }).returns;
}

// Slice a strategy-return series into equal folds.
export function folds(series, foldLength) {
    const out = [];
    for (let i = 0; i + foldLength <= series.length; i += foldLength) out.push(series.slice(i, i + foldLength));
    return out;
}

// Cross-stream dependence + pooled metrics over a *panel* of per-stream net
// strategy returns (the A/B's pooled readout, mirrored).
//
// `maxBars` bounds the window (the dependence jackknife costs O(clusters x bars));
// `maxClusters` sets the fold-window granularity. The panel is truncated (from the
// END, i.e. the most recent bars) to a multiple of the cluster length so the fold
// grid is rectangular - `dependenceSummary` rejects a ragged grid by design.
export function panelReadout(netByStream, { maxBars = 9600, maxClusters = 192, label = null } = {}) {
    const len0 = Math.min(...netByStream.map((s) => s.length));
    const len = Math.min(len0, maxBars);
    const q = Math.max(2, Math.ceil(len / maxClusters));
    const rows = Math.floor(len / q);
    const use = rows * q;
    const trimmed = netByStream.map((s) => s.slice(s.length - use));
    const dep = dependenceSummary({ streamReturns: trimmed, foldLength: q, periodsPerYear: PERIODS_PER_YEAR });
    const pooled = [];
    for (const s of trimmed) for (const v of s) pooled.push(v);
    const eff = dep && dep.available && Number.isFinite(dep.effectiveBars) ? dep.effectiveBars : null;
    const m = backtestMetrics({ returns: pooled, signals: pooled.map(() => 1), costBps: 0, periodsPerYear: PERIODS_PER_YEAR, effectiveBars: eff });
    return {
        label,
        streams: trimmed.length,
        barsPerStream: len,
        foldLength: q,
        dependence: dep && dep.available ? {
            streams: dep.streams,
            nClusters: dep.nClusters,
            meanPairwiseStreamCorr: dep.meanPairwiseStreamCorr,
            designEffect: dep.designEffect,
            effectiveStreams: dep.effectiveStreams,
            effectiveBars: dep.effectiveBars,
            adjustmentNeeded: dep.adjustmentNeeded,
            seCluster: dep.seCluster,
            seIid: dep.seIid,
        } : { available: false, reason: dep && dep.reason },
        pooled: {
            netSharpe: m.netSharpe,
            dsr: m.dsr,
            dsrAdjusted: m.dsrAdjusted,
            effectiveBars: m.effectiveBars,
            psrAdjusted: m.psrAdjusted,
        },
    };
}

// The serial (in-time) design effect of ONE return series: (jackknife SE / i.i.d.
// SE)^2 over fold-window clusters. >1 means the i.i.d. readout over-states
// significance; <1 means the series is *less* variable than i.i.d. (mean-reverting
// / diversifying in time).
export function serialDesignEffect(returns, foldLength) {
    const q = Math.max(2, Math.floor(foldLength));
    const use = Math.floor(returns.length / q) * q;
    const r = returns.slice(returns.length - use);
    const clusters = foldWindowClusters([r], q);
    const statistic = (a) => sharpeRatio(a, { periodsPerYear: PERIODS_PER_YEAR });
    const jk = clusterJackknife({ clusters, statistic });
    const s = statistic(r);
    const seIid = sharpeStandardError(s, r.length, PERIODS_PER_YEAR);
    const de = Number.isFinite(seIid) && seIid > 0 && Number.isFinite(jk.se) ? (jk.se / seIid) ** 2 : NaN;
    return { designEffect: de, seCluster: jk.se, seIid, nClusters: jk.nClusters, effectiveBars: Number.isFinite(de) && de > 0 ? r.length / de : null };
}

// ---- small helpers ----------------------------------------------------------

// Design effect of a series after winsorising at +/- k sigma.
//
// `serialDesignEffect` jackknifes the SHARPE over fold-window clusters, and a Sharpe
// is a ratio: one extreme observation inflates the jackknife SE far more than it
// inflates the true long-run variance. On the carry book the single FTX observation
// (SOL basis -19.5% in one 8h period) pushed the raw design effect to 99.5, while
// winsorising at 3 sigma gives 11.8 and simply dropping the FTX month gives 11.0
// (CYCLE-006). So: report BOTH. A large gap between them means "fat tail", not
// "genuinely autocorrelated".
export function robustDesignEffect(rets, { fold = 90, k = 3 } = {}) {
    const n = rets.length;
    const m = rets.reduce((a, x) => a + x, 0) / n;
    const sd = Math.sqrt(rets.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1));
    const lo = m - k * sd;
    const hi = m + k * sd;
    return serialDesignEffect(rets.map((x) => Math.max(lo, Math.min(hi, x))), fold).designEffect;
}

export function stats(xs) {
    const v = xs.filter((x) => Number.isFinite(x));
    if (!v.length) return { n: 0, mean: NaN, std: NaN, min: NaN, max: NaN };
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const std = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, v.length - 1));
    return { n: v.length, mean, std, min: Math.min(...v), max: Math.max(...v) };
}

export function meanPairwise(vectors) {
    return meanPairwiseCorrelation(vectors);
}

export { pearsonCorrelation, meanPairwiseCorrelation, sharpeRatio, turnover, equityCurve, maxDrawdown, positionAt };

export const SYMBOLS = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'dogeusdt', 'linkusdt'];

// Convenience: a full prepared, cross-sectioned panel for a basket+timeframe.
export async function buildPanel({ symbols = SYMBOLS, tf = '15m', n = null } = {}) {
    let raw = await loadBasket(symbols, tf);
    raw = alignPanel(raw);
    if (n) raw = tail(raw, n);
    const prepared = prepare(raw);
    return withCrossSection(prepared);
}

// The SAME pipeline, computed in O(n) instead of O(n * zWindow * window) by
// evaluating the raw feature once per bar and then z-scoring it with trailing
// rolling sums. Numerically this can differ from `positionsOf` in the last few
// ulps (a rolling sum is not a fresh sum); `validatePositions` measures that, and
// E0c asserts it is below 1e-9 on real data before any sweep relies on it.
//
// NaN handling matches `causalZScore` exactly: non-finite raws are SKIPPED (not
// treated as zero) when forming the trailing mean/std, and the bar abstains when
// fewer than `minObs` finite raws are in the window or the std is 0.
export function positionsOfFast(fn, series, { window = 16, params = null, saturation, zWindow, minObs } = {}) {
    const n = series.returns.length;
    const zw = zWindow == null ? DEFAULT_POSITION.zWindow : zWindow;
    const mo = minObs == null ? DEFAULT_POSITION.minObs : minObs;
    const sat = saturation == null ? DEFAULT_POSITION.saturation : saturation;
    const args = { window, ...(params || {}) };
    const raw = new Float64Array(n);
    const finite = new Uint8Array(n);
    for (let t = 0; t < n; t++) {
        const v = fn(series, t, args);
        if (Number.isFinite(v)) { raw[t] = v; finite[t] = 1; }
    }
    const out = new Array(n).fill(0);
    let sum = 0;
    let sumSq = 0;
    let cnt = 0;
    for (let t = 0; t < n; t++) {
        if (finite[t]) { sum += raw[t]; sumSq += raw[t] * raw[t]; cnt++; }
        const drop = t - zw;
        if (drop >= 0 && finite[drop]) { sum -= raw[drop]; sumSq -= raw[drop] * raw[drop]; cnt--; }
        if (cnt < mo || cnt < 2) continue;
        const m = sum / cnt;
        let acc = sumSq - cnt * m * m;
        if (!(acc > 0)) continue;
        const std = Math.sqrt(acc / (cnt - 1));
        if (!(std > 0)) continue;
        out[t] = clampPosition((raw[t] - m) / std, { saturation: sat });
    }
    return out;
}

// Max absolute difference between the faithful and fast pipelines over `n` bars.
export function validatePositions(fn, series, opts = {}, n = 4000) {
    const a = positionsOf(fn, series, opts);
    const b = positionsOfFast(fn, series, opts);
    let maxDiff = 0;
    let firstDiff = -1;
    const take = Math.min(n, a.length);
    for (let i = 0; i < take; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (d > maxDiff) { maxDiff = d; if (firstDiff < 0 && d > 0) firstDiff = i; }
    }
    return { n: take, maxAbsDiff: maxDiff, firstDiffIndex: firstDiff };
}
