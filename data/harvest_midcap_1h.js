// Durable harvester for mid-cap Binance USDT-M 1h klines (TODO 115, W5 symbol breadth).
//
// Binance publishes monthly 1h klines zips (no auth):
//   https://data.binance.vision/data/futures/um/monthly/klines/<SYM>/1h/<SYM>-1h-<YYYY-MM>.zip
// CSV: open_time,open,high,low,close,volume,close_time,quote_volume,count,
//      taker_buy_volume,taker_buy_quote_volume,ignore (open_time in ms).
// Output rows match the repo candle shape:
//   { timestamp ISO, open, high, low, close, volume }
//
// Run with execute_js (transport-injected, retry in the driver):
//   const src = await fs.readTextFile('src/NeuLegion-lab/data/harvest_midcap_1h.js');
//   const mod = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
//   const raw = await mod.fetchMonth(fetchZip, 'AVAXUSDT', '2026-08'); // Uint8Array -> rows
//   const jsonl = mod.rowsToJsonl(raw);

export const MIDCAP_SYMS = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];

export const BUCKET = 'https://data.binance.vision/data/futures/um/monthly/klines';

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

export const MIDCAP_MONTHS = monthList('2024-06', '2026-08');

export const monthUrl = (sym, ym) => `${BUCKET}/${sym}/1h/${sym}-1h-${ym}.zip`;

export function parseKlinesCsv(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || !/^\d/.test(s)) continue;
    const c = s.split(',');
    if (c.length < 6) continue;
    const t = Number(c[0]);
    const o = Number(c[1]); const h = Number(c[2]); const l = Number(c[3]); const cl = Number(c[4]); const v = Number(c[5]);
    if (![t, o, h, l, cl, v].every(Number.isFinite)) continue;
    rows.push({ t, o, h, l, cl, v });
  }
  return rows;
}

export function rowsToJsonl(rows) {
  return rows.map((r) => JSON.stringify({
    timestamp: new Date(r.t).toISOString(),
    open: r.o, high: r.h, low: r.l, close: r.cl, volume: r.v,
  })).join('\n') + '\n';
}

export function continuity(rows) {
  let gaps = 0;
  let maxGapH = 0;
  for (let i = 1; i < rows.length; i++) {
    const d = (rows[i].t - rows[i - 1].t) / 3600000;
    if (d > 1) { gaps++; maxGapH = Math.max(maxGapH, d); }
  }
  return { n: rows.length, gaps, maxGapH, first: rows.length ? new Date(rows[0].t).toISOString() : null, last: rows.length ? new Date(rows[rows.length - 1].t).toISOString() : null };
}
