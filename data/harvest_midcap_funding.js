// Durable harvester for mid-cap Binance USDT-M funding rates (round 95, W5 sleeve breadth).
//
// Binance publishes monthly funding-rate zips (no auth):
//   https://data.binance.vision/data/futures/um/monthly/fundingRate/<SYM>/<SYM>-fundingRate-<YYYY-MM>.zip
// CSV: calc_time,funding_interval_hours,last_funding_rate (calc_time in ms).
// Output rows match the repo funding shape (`parseFundingJsonl`):
//   { timestamp ISO, fundingRate, markPrice: null }
// (vision files carry no mark; `markPrice` is parsed-but-unused in carry.js.)
//
// Run with execute_js (transport-injected, retry in the driver):
//   const src = await fs.readTextFile('src/NeuLegion-lab/data/harvest_midcap_funding.js');
//   const mod = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
//   const raw = await mod.fetchMonth(fetchZip, 'AVAXUSDT', '2026-08'); // Uint8Array -> rows
//   const jsonl = mod.rowsToJsonl(raw);

export const FUND_SYMS = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];

export const BUCKET = 'https://data.binance.vision/data/futures/um/monthly/fundingRate';

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

export const FUND_MONTHS = monthList('2024-06', '2026-08');

export const monthUrl = (sym, ym) => `${BUCKET}/${sym}/${sym}-fundingRate-${ym}.zip`;

export function parseFundingCsv(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || !/^\d/.test(s)) continue;
    const c = s.split(',');
    if (c.length < 3) continue;
    const t = Number(c[0]);
    const rate = Number(c[2]);
    if (!Number.isFinite(t) || !Number.isFinite(rate)) continue;
    rows.push({ t, rate });
  }
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

export function rowsToJsonl(rows) {
  return rows.map((r) => JSON.stringify({
    timestamp: new Date(r.t).toISOString(),
    fundingRate: r.rate,
    markPrice: null,
  })).join('\n') + '\n';
}

export async function fetchMonth(fetchZip, sym, ym) {
  const raw = await fetchZip(monthUrl(sym, ym));
  const { ZipReader, Uint8ArrayReader, TextWriter } = await import('https://esm.sh/@zip.js/zip.js');
  const reader = new ZipReader(new Uint8ArrayReader(raw));
  const entries = await reader.getEntries();
  const entry = entries.find((e) => e.filename.endsWith('.csv')) || entries[0];
  const text = await entry.getData(new TextWriter());
  await reader.close();
  return parseFundingCsv(text);
}
