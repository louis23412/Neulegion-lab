// Durable harvester for `data/perp_flow_8h.json` (L15 capacity/impact). CYCLE-011.
//
// Why a script in the lab and not scratch: scratch is wiped between sessions. This file states the
// exact recipe and can rebuild the derived series byte-for-identically; a future iteration runs it
// with execute_js (no Node in this workspace):
//
//   const src = await fs.readTextFile('src/NeuLegion-lab/data/harvest_perp_flow.js');
//   const mod = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
//   const built = await mod.harvestPerpFlow();          // fetches + parses
//   await fs.writeTextFile('src/NeuLegion-lab/data/perp_flow_8h.json', JSON.stringify(built));
//
// Source (public dataset bucket; the REST API is geo-restricted/451; direct fetch works, the bucket
// sends Access-Control-Allow-Origin: *):
//   https://data.binance.vision/data/futures/um/monthly/klines/<SYM>/8h/<SYM>-8h-<YYYY-MM>.zip
// CSV columns (futures klines, 12): open_time, open, high, low, close, volume, close_time,
//   quote_volume, count, taker_buy_volume, taker_buy_quote_volume, ignore
//   -> base volume col 5, quote_volume (USDT) col 7, count col 8.
// Gotchas (same family as the other Binance harvests, see data/README.md):
//   * from 2025-01 `open_time` is in MICROSECONDS, not ms -> normalise by /1000 until < 1e14.
//   * SOLUSDT 2020-07/08 files 404 (contract listed 2020-09-14) - expected, skipped.
//   * the current month is unpublished once it has begun; the last full month is 2026-08.

const BUCKET = 'https://data.binance.vision/data/futures/um/monthly/klines';

const MONTHS = (() => {
    const out = [];
    for (let y = 2020, m = 7; y < 2027; y++, m = 1) {
        for (; m <= 12; m++) {
            const tag = `${y}-${String(m).padStart(2, '0')}`;
            if (tag > '2026-08') return out;
            out.push(tag);
        }
    }
    return out;
})();

const normaliseTime = (raw) => {
    let t = Number(raw);
    while (t > 1e14) t = Math.round(t / 1000);
    return t;
};

async function readZipCsv(url) {
    const zipjs = await import('https://esm.sh/@zip.js/zip.js');
    const res = await fetch(url);
    if (!res.ok) return { ok: false, status: res.status };
    const blob = await res.blob();
    const reader = new zipjs.ZipReader(new zipjs.BlobReader(blob));
    const entries = await reader.getEntries();
    const text = await entries[0].getData(new zipjs.TextWriter());
    await reader.close();
    return { ok: true, text };
}

// Parse one monthly CSV into rows of { t, vol, qv, cnt } with t already offset to the grid time the
// kline ENDS at (open_time + 8h) - the funding/mark convention (see data/README.md).
export function parseFlowCsv(text) {
    const rows = [];
    for (const line of text.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        const c = s.split(',');
        if (c.length < 9 || !/^\d/.test(c[0])) continue; // header / malformed
        const t = normaliseTime(c[0]) + 28_800_000;
        rows.push({ t, vol: Number(c[5]), qv: Number(c[7]), cnt: Number(c[8]) });
    }
    return rows;
}

// Harvest every symbol; returns the on-disk JSON object.
export async function harvestPerpFlow({ symbols, concurrency = 6 } = {}) {
    const syms = symbols || ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'dogeusdt', 'linkusdt'];
    const symbolsOut = {};
    const missing = [];
    for (const sym of syms) {
        const S = sym.toUpperCase();
        const byT = new Map();
        let done = 0;
        const queue = MONTHS.slice();
        const worker = async () => {
            while (queue.length) {
                const month = queue.shift();
                const url = `${BUCKET}/${S}/8h/${S}-8h-${month}.zip`;
                try {
                    const r = await readZipCsv(url);
                    if (!r.ok) { missing.push({ sym, month, status: r.status }); continue; }
                    for (const row of parseFlowCsv(r.text)) byT.set(row.t, row);
                } catch (e) { missing.push({ sym, month, error: String(e) }); }
                done++;
            }
        };
        await Promise.all(Array.from({ length: concurrency }, worker));
        const ts = [...byT.keys()].sort((a, b) => a - b);
        if (!ts.length) { symbolsOut[sym] = null; continue; }
        const t0 = ts[0];
        const stepMs = 28_800_000;
        const nKlines = Math.round((ts[ts.length - 1] - t0) / stepMs) + 1;
        const vol = new Array(nKlines).fill(null);
        const qv = new Array(nKlines).fill(null);
        const cnt = new Array(nKlines).fill(null);
        for (const t of ts) {
            const i = Math.round((t - t0) / stepMs);
            const r = byT.get(t);
            vol[i] = Math.round(r.vol * 1e6) / 1e6;
            qv[i] = Math.round(r.qv);
            cnt[i] = r.cnt;
        }
        symbolsOut[sym] = { t0, stepMs, nKlines, vol, qv, cnt };
    }
    return {
        builtAt: new Date().toISOString(),
        gridMs: 28_800_000,
        fields: { vol: 'base-asset volume of the 8h kline', qv: 'USDT quote volume of the 8h kline', cnt: 'number of trades' },
        convention: 'grid time T = kline open_time + 8h; flow[i] is the flow of the 8h perp kline ENDING at t0 + i*stepMs (t0 = the first available grid time; no leading null)',
        source: 'data.binance.vision/data/futures/um/monthly/klines/<SYM>/8h/ (futures klines: vol=col5, qv=col7, cnt=col8)',
        missing,
        symbols: symbolsOut,
    };
}
