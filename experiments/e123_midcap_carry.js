// E123 - CARRY-DISPERSION BREADTH ON WAVE-1 MIDCAPS (W5 sleeve breadth).
//
// Round-95 AI-side. The candle-breadth legs (e121 SUPPORTED, e122 MIXED) cover
// momentum; the sleeves are the banked edge, so breadth must reach them too.
// Funding harvests cleanly from vision monthly zips (durable
// `data/harvest_midcap_funding.js`, vendored `data/midcap_funding/`, 216/216
// months); OI/toptrader history does NOT (API-only, recent-capped, flaky
// through this workspace) and stays DATA-BLOCKED.
//
// PRE-REGISTERED. PASS iff every midcap funding series parses with zero
// invalid rows, every audit shows zero missing periods, and the
// carry-dispersion sleeve reports available:true on the 8-midcap panel.
// Pooled net/turnover/BE are RECORDED descriptively (a 2-year window cannot
// re-bank the sleeve) — the verdict is about data plumbing, not edge.

import { parseFundingJsonl, auditFundingSeries } from '../../NeuLegion-master/NeuLegion-master/src/analysis/carry.js';
import { runSleeveReport } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';

const LAB = 'src/NeuLegion-lab';
const SYMS = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];

export async function run() {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const fundingTexts = [];
  const candleTexts = [];
  let totalInvalid = 0;
  let totalMissing = 0;
  const audits = {};
  for (const s of SYMS) {
    const f = await globalThis.__fs.readTextFile(LAB + '/data/midcap_funding/funding_' + s.toLowerCase() + '_8h.jsonl');
    const c = await globalThis.__fs.readTextFile(LAB + '/data/midcap/candles_' + s.toLowerCase() + '_1h.jsonl');
    fundingTexts.push(f);
    candleTexts.push(c);
    const parsed = parseFundingJsonl(f);
    totalInvalid += parsed.invalid;
    const a = auditFundingSeries(parsed.rows);
    totalMissing += a.missingPeriods;
    audits[s] = { rows: parsed.rows.length, missing: a.missingPeriods, offGrid: a.offGrid, extreme: a.extremeRates, grid: a.intervalHistogram };
  }
  check('e123: all 8 midcap funding series parse with zero invalid rows',
    totalInvalid === 0, 'invalid=' + totalInvalid);
  check('e123: all 8 audits show zero missing funding periods',
    totalMissing === 0, 'missing=' + totalMissing + ' ' + JSON.stringify(audits));
  const mid = runSleeveReport({ sleeveId: 'carry-dispersion', fundingTexts, candleTexts, costBps: 4, symbols: SYMS });
  check('e123: carry-dispersion available on the 8-midcap panel',
    mid.available === true && mid.streams === 8, mid.reason || ('buckets=' + mid.buckets + ' streams=' + mid.streams));
  let majors = null;
  try {
    const REPO = 'src/NeuLegion-master/NeuLegion-master';
    const MAJ = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'dogeusdt', 'linkusdt'];
    const mf = [];
    const mc = [];
    for (const s of MAJ) {
      mf.push(await globalThis.__fs.readTextFile(REPO + '/src/data/funding_' + s + '_8h.jsonl'));
      const name = s === 'btcusdt' ? 'candles.jsonl' : 'candles_' + s + '_1h.jsonl';
      try { mc.push(await globalThis.__fs.readTextFile(REPO + '/src/data/' + name)); }
      catch { mc.push(await globalThis.__fs.readTextFile(REPO + '/src/' + name)); }
    }
    majors = runSleeveReport({ sleeveId: 'carry-dispersion', fundingTexts: mf, candleTexts: mc, costBps: 4, symbols: MAJ.map((s) => s.toUpperCase()) });
  } catch (e) { majors = { available: false, reason: 'majors load failed: ' + String(e).slice(0, 120) }; }
  check('e123: majors carry panel scores as the descriptive baseline',
    majors && majors.available === true, majors && (majors.reason || ('buckets=' + majors.buckets)));
  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: {
      audits,
      midcap: mid.available ? { buckets: mid.buckets, streams: mid.streams, netAnnual: mid.netAnnual, turnoverAnnual: mid.turnoverAnnual, breakEvenCostBps: mid.breakEvenCostBps } : { available: false, reason: mid.reason },
      majors: majors && majors.available ? { buckets: majors.buckets, streams: majors.streams, netAnnual: majors.netAnnual, turnoverAnnual: majors.turnoverAnnual, breakEvenCostBps: majors.breakEvenCostBps } : { available: false },
    },
  };
}
