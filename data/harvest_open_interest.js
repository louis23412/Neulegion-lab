// Durable harvester for `data/open_interest_8h.json` (L07's open-interest half). CYCLE-013.
//
// Binance publishes 5-MINUTE open interest + positioning under the futures "metrics" dataset, one zip
// per day (288 rows):
//   https://data.binance.vision/data/futures/um/daily/metrics/<SYM>/<SYM>-metrics-<YYYY-MM-DD>.zip
// CSV: create_time,symbol,sum_open_interest,sum_open_interest_value,count_toptrader_long_short_ratio,
//      sum_toptrader_long_short_ratio,count_long_short_ratio,sum_taker_long_short_vol_ratio
// There is no monthly bucket (monthly/metrics -> 404) and no `openInterest` bucket; the REST
// `openInterestHist` endpoint is geo-restricted. So daily zips are the only route. Fetching is cheap
// (~100 ms/file concurrently, ~11 KB) so the whole 2020-09..2026-08 history is ~14 k files / ~2 min.
//
// We keep an 8h-grid snapshot (00:00/08:00/16:00 UTC - the funding grid) rather than the 5-min rows:
//   symbol -> { t0, stepMs, nKlines, oi[], oiVal[], topLS[], takerLS[] }
//   index i = grid time t0 + i*stepMs; the value is the metrics row stamped at exactly that time, or
//   null if the symbol/day is missing. `oiVal` is USDT notional (the capacity-relevant one); `oi` is
//   contracts; `topLS` = sum_toptrader_long_short_ratio (positioning); `takerLS` =
//   sum_taker_long_short_vol_ratio.
//
// Coverage (probed): BTCUSDT from 2020-09-01; the other seven majors from 2021-11-01 (earlier 404s).
// Run with execute_js:
//   const src = await fs.readTextFile('src/NeuLegion-lab/data/harvest_open_interest.js');
//   const mod = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
//   const built = await mod.harvestOpenInterest();
//   await fs.writeTextFile('src/NeuLegion-lab/data/open_interest_8h.json', JSON.stringify(built));

const BUCKET = 'https://data.binance.vision/data/futures/um/daily/metrics';
const STEP = 28_800_000;

const dayList = (start, end) => {
    const out = [];
    let t = Date.parse(start + 'T00:00:00Z');
    const endT = Date.parse(end + 'T00:00:00Z');
    while (t <= endT) { out.push(new Date(t).toISOString().slice(0, 10)); t += 86_400_000; }
    return out;
};

const parseMs = (s) => Date.parse(s.trim().replace(' ', 'T') + 'Z');

// Parse one daily CSV into the 8h-grid rows it contains.
export function parseMetricsCsv(text) {
    const out = [];
    for (const line of text.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        const c = s.split(',');
        if (c.length < 8 || !/^\d/.test(c[0])) continue;
        const t = parseMs(c[0]);
        if (!Number.isFinite(t) || t % STEP !== 0) continue; // keep only the 8h grid
        const oi = Number(c[2]);
        const oiVal = Number(c[3]);
        // Binance's metrics occasionally publish an all-zero row (2022-03-07T16:00, 2024-07-13,
        // 2025-04-15T08:00 ...) as a missing-data sentinel, simultaneously for every symbol. Treat
        // zero as missing so downstream code never sees a 0 open interest.
        if (!(oi > 0) || !(oiVal > 0)) continue;
        out.push({ t, oi, oiVal, topLS: Number(c[5]), takerLS: Number(c[7]) });
    }
    return out;
}

export async function harvestOpenInterest({ symbols, startBySymbol, end = '2026-08-31', concurrency = 12 } = {}) {
    const syms = symbols || ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'dogeusdt', 'linkusdt'];
    const starts = startBySymbol || { btcusdt: '2020-09-01', _default: '2021-11-01' };
    const out = {};
    const missing = [];
    for (const sym of syms) {
        const S = sym.toUpperCase();
        const days = dayList(starts[sym] || starts._default, end);
        const byT = new Map();
        const queue = days.slice();
        const worker = async () => {
            while (queue.length) {
                const d = queue.shift();
                const url = `${BUCKET}/${S}/${S}-metrics-${d}.zip`;
                try {
                    const r = await fetch(url);
                    if (!r.ok) { missing.push({ sym, d, status: r.status }); continue; }
                    const zipjs = await import('https://esm.sh/@zip.js/zip.js');
                    const rd = new zipjs.ZipReader(new zipjs.BlobReader(await r.blob()));
                    const entries = await rd.getEntries();
                    const text = await entries[0].getData(new zipjs.TextWriter());
                    await rd.close();
                    for (const row of parseMetricsCsv(text)) byT.set(row.t, row);
                } catch (e) { missing.push({ sym, d, error: String(e) }); }
            }
        };
        await Promise.all(Array.from({ length: concurrency }, worker));
        const ts = [...byT.keys()].sort((a, b) => a - b);
        if (!ts.length) { out[sym] = null; continue; }
        const t0 = ts[0];
        const nKlines = Math.round((ts[ts.length - 1] - t0) / STEP) + 1;
        const oi = new Array(nKlines).fill(null);
        const oiVal = new Array(nKlines).fill(null);
        const topLS = new Array(nKlines).fill(null);
        const takerLS = new Array(nKlines).fill(null);
        for (const t of ts) {
            const i = Math.round((t - t0) / STEP);
            const r = byT.get(t);
            oi[i] = Math.round(r.oi * 100) / 100;
            oiVal[i] = Math.round(r.oiVal);
            topLS[i] = Math.round(r.topLS * 1e5) / 1e5;
            takerLS[i] = Math.round(r.takerLS * 1e5) / 1e5;
        }
        out[sym] = { t0, stepMs: STEP, nKlines, oi, oiVal, topLS, takerLS };
    }
    return {
        builtAt: new Date().toISOString(),
        gridMs: STEP,
        fields: { oi: 'open interest (contracts)', oiVal: 'open interest (USDT notional)', topLS: 'sum_toptrader_long_short_ratio', takerLS: 'sum_taker_long_short_vol_ratio' },
        convention: 'grid time T = 00:00/08:00/16:00 UTC; value = the metrics row stamped exactly at T (5-min source aggregated to the 8h funding grid); t0 = first available grid time; null = missing',
        source: 'data.binance.vision/data/futures/um/daily/metrics/<SYM>/<SYM>-metrics-<YYYY-MM-DD>.zip',
        missingCount: missing.length,
        missing,
        symbols: out,
    };
}
