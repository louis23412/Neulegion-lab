// Durable harvester for mid-cap Binance USDT-M 8h mark-price klines (TODO 118,
// director decision CYCLE-174: honest midcap marks, funding-only pre-reg only
// as fallback).
//
// Binance publishes monthly 8h markPriceKlines zips (no auth):
//   https://data.binance.vision/data/futures/um/monthly/markPriceKlines/<SYM>/8h/<SYM>-8h-<YYYY-MM>.zip
// CSV: open_time,open,high,low,close,volume,... (open_time in ms).
// Output matches the repo marks shape (src/data/marks_8h.json):
//   { builtAt, scale: 1, convention, source, symbols: { <lower>: { t0, stepMs: 28800000, nKlines, v } } }
// where grid time T = kline open_time + 8h and v[i] = close of the 8h kline
// ENDING at T (the mark price at funding time T); missing -> null (never 0:
// 0 is the missing-mark sentinel downstream).
//
// Run with execute_js (transport-injected, retry in the driver):
//   const src = await fs.readTextFile('src/NeuLegion-lab/data/harvest_midcap_marks.js');
//   const mod = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
//   const rows = mod.parseMarkKlinesCsv(csvText); // [{t, cl}]
//   const series = mod.toGridSeries(rows);        // Map(T -> close-last-wins)
//   const file = mod.assemble({ ARBUSDT: series, ... });
// `_nulls` is diagnostics only: the driver deletes it before writing the
// repo file, so the shipped JSON matches the majors shape exactly
// ({builtAt, scale, convention, source, symbols: {sym: {t0, stepMs, nKlines, v}}}).
//   const src = await fs.readTextFile('src/NeuLegion-lab/data/harvest_midcap_marks.js');
//   const mod = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
//   const rows = mod.parseMarkKlinesCsv(csvText); // [{t, cl}]
//   const series = mod.toGridSeries(rows);        // Map(T -> close-last-wins)
//   const file = mod.assemble({ ARBUSDT: series, ... });

export const MARK_SYMS = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];

export const MARK_BUCKET = 'https://data.binance.vision/data/futures/um/monthly/markPriceKlines';

export const STEP_MS = 28_800_000;

export function monthList(startYm, endYm) {
    const out = [];
    let [y, m] = startYm.split('-').map(Number);
    const [ey, em] = endYm.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
        out.push(y + '-' + String(m).padStart(2, '0'));
        m++;
        if (m > 12) { m = 1; y++; }
    }
    return out;
}

export const MARK_MONTHS = monthList('2024-05', '2026-08');
// May 2024 is required, not optional: the kline ENDING at 2024-06-01T00:00
// opens 2024-05-31T16:00, so without the May zips the grid starts one slot
// late (t0 08:00, caught by the driver's t0 assert).

export const monthUrl = (sym, ym) => `${MARK_BUCKET}/${sym}/8h/${sym}-8h-${ym}.zip`;

export function parseMarkKlinesCsv(text) {
    const rows = [];
    for (const line of text.split('\n')) {
        const s = line.trim();
        if (!s || !/^\d/.test(s)) continue;
        const c = s.split(',');
        if (c.length < 5) continue;
        const t = Number(c[0]);
        const cl = Number(c[4]);
        if (!Number.isFinite(t)) continue;
        rows.push({ t, cl: Number.isFinite(cl) && cl > 0 ? cl : null });
    }
    return rows;
}

// Kline open_time -> grid time T = open + 8h; last row wins a grid slot.
export function toGridSeries(rows) {
    const m = new Map();
    for (const r of rows) {
        const T = r.t + STEP_MS;
        if (T % STEP_MS !== 0) continue;
        m.set(T, r.cl);
    }
    return m;
}

export function assemble(seriesBySym, { startT = Date.parse('2024-06-01T00:00:00.000Z') } = {}) {
    let t0 = Infinity;
    for (const sym of Object.keys(seriesBySym)) {
        for (const T of seriesBySym[sym].keys()) {
            if (T >= startT && T < t0) t0 = T;
        }
    }
    let t1 = -Infinity;
    for (const sym of Object.keys(seriesBySym)) {
        for (const T of seriesBySym[sym].keys()) if (T > t1) t1 = T;
    }
    const n = Math.round((t1 - t0) / STEP_MS) + 1;
    const symbols = {};
    const nulls = {};
    for (const sym of Object.keys(seriesBySym)) {
        const s = seriesBySym[sym];
        const v = [];
        let z = 0;
        for (let i = 0; i < n; i++) {
            const c = s.get(t0 + i * STEP_MS);
            v.push(c == null ? null : c);
            if (c == null) z++;
        }
        symbols[sym.toLowerCase()] = { t0, stepMs: STEP_MS, nKlines: n, v };
        nulls[sym] = z;
    }
    return {
        builtAt: new Date().toISOString(),
        scale: 1,
        convention: 'grid time T = kline open_time + 8h; v[i] = close of the 8h markPriceKline ENDING at T (the mark price at funding time T)',
        source: 'data.binance.vision/data/futures/um/monthly/markPriceKlines/<SYM>/8h/',
        symbols,
        _nulls: nulls,
    };
}
