// E124 - THE 16-WIDE CROSS-SECTIONAL CARRY BOOK (sleeve-family breadth).
//
// Round-96 AI-side. carry-dispersion ranks funding ACROSS the basket
// (rowRankWeights, R8/F-50), so a majors+midcaps stacked panel is a genuinely
// different book from either leg — not a concatenation of two books. e123
// proved the midcap leg's plumbing (4/4); this tests whether the stacked
// 16-stream book diversifies the sleeve family.
//
// Method: window-match all inputs to the midcap window (>= 2024-06-01, the
// only grid both legs share), score maj8w + mid8 + stack16 through the same
// `runSleeveReport` path, and read the cross-leg net-return correlation as
// the independence verdict (F-125 precedent: carry×fade +0.02).
//
// PRE-REGISTERED. PASS iff all three books report available:true with the
// expected stream counts (8/8/16). SUPPORTED iff corr(mid8, maj8w) < 0.50
// (independent dispersion); MIXED if 0.50-0.70; NEGATIVE if >= 0.70 (same
// trade). Pooled net/turnover/BE are RECORDED descriptively — a 2-year window
// cannot promote anything.

import { pearsonCorrelation } from '../../NeuLegion-master/NeuLegion-master/src/analysis/dependence.js';
import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import { scoreSleeve } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/scoring.js';
import { runSleeveReport } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];
const FLOOR_MS = Date.parse('2024-06-01T00:00:00.000Z');

function windowMatch(text) {
  const kept = [];
  for (const line of String(text).split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      const row = JSON.parse(s);
      const t = typeof row.timestamp === 'number' ? row.timestamp : Date.parse(row.timestamp);
      if (Number.isFinite(t) && t >= FLOOR_MS) kept.push(s);
    } catch { /* drop malformed, exactly like the repo reader */ }
  }
  return kept.join('\n') + '\n';
}

export async function run() {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const majF = [];
  const majC = [];
  for (const s of MAJ) {
    const sl = s.toLowerCase();
    majF.push(windowMatch(await globalThis.__fs.readTextFile(REPO + '/src/data/funding_' + sl + '_8h.jsonl')));
    const name = sl === 'btcusdt' ? 'candles.jsonl' : 'candles_' + sl + '_1h.jsonl';
    try { majC.push(windowMatch(await globalThis.__fs.readTextFile(REPO + '/src/data/' + name))); }
    catch { majC.push(windowMatch(await globalThis.__fs.readTextFile(REPO + '/src/' + name))); }
  }
  const midF = [];
  const midC = [];
  for (const s of MID) {
    const sl = s.toLowerCase();
    midF.push(windowMatch(await globalThis.__fs.readTextFile(LAB + '/data/midcap_funding/funding_' + sl + '_8h.jsonl')));
    midC.push(windowMatch(await globalThis.__fs.readTextFile(LAB + '/data/midcap/candles_' + sl + '_1h.jsonl')));
  }
  const maj = runSleeveReport({ sleeveId: 'carry-dispersion', fundingTexts: majF, candleTexts: majC, costBps: 4, symbols: MAJ });
  const mid = runSleeveReport({ sleeveId: 'carry-dispersion', fundingTexts: midF, candleTexts: midC, costBps: 4, symbols: MID });
  const stack = runSleeveReport({ sleeveId: 'carry-dispersion', fundingTexts: majF.concat(midF), candleTexts: majC.concat(midC), costBps: 4, symbols: MAJ.concat(MID) });
  check('e124: majors-windowed leg available with 8 streams',
    maj.available === true && maj.streams === 8, maj.reason || ('buckets=' + maj.buckets));
  check('e124: midcap leg available with 8 streams on the shared window',
    mid.available === true && mid.streams === 8, mid.reason || ('buckets=' + mid.buckets));
  check('e124: stacked book available with 16 streams',
    stack.available === true && stack.streams === 16, stack.reason || ('buckets=' + stack.buckets));
  let corr = NaN;
  let nCommon = 0;
  try {
    const legSeries = (fTexts, cTexts) => {
      const { view } = parseSleeveInputs({ fundingTexts: fTexts, candleTexts: cTexts });
      const scored = scoreSleeve('carry-dispersion', view, { costBps: 4 });
      if (!scored.available || !Array.isArray(scored.net)) return null;
      const times = view.times.slice(1, 1 + scored.net.length);
      if (times.length !== scored.net.length) return null;
      return { times, net: scored.net };
    };
    const a = legSeries(majF, majC);
    const b = legSeries(midF, midC);
    if (a && b) {
      const mapA = new Map();
      for (let i = 0; i < a.times.length; i++) mapA.set(a.times[i], a.net[i]);
      const x = [];
      const y = [];
      for (let i = 0; i < b.times.length; i++) {
        if (mapA.has(b.times[i]) && Number.isFinite(b.net[i]) && Number.isFinite(mapA.get(b.times[i]))) {
          x.push(mapA.get(b.times[i]));
          y.push(b.net[i]);
        }
      }
      nCommon = x.length;
      if (nCommon >= 100) corr = pearsonCorrelation(x, y);
    }
  } catch { /* correlation stays NaN, recorded below */ }
  check('e124: cross-leg return correlation is measurable on a common grid',
    Number.isFinite(corr), 'corr=' + (Number.isFinite(corr) ? corr.toFixed(4) : 'n/a') + ' nCommon=' + nCommon);
  const verdict = !Number.isFinite(corr) ? 'INCONCLUSIVE' : corr < 0.5 ? 'SUPPORTED' : corr < 0.7 ? 'MIXED' : 'NEGATIVE';
  const failed = checks.filter((c) => !c.pass);
  const pack = (r) => (r.available ? { buckets: r.buckets, streams: r.streams, netAnnual: r.netAnnual, turnoverAnnual: r.turnoverAnnual, breakEvenCostBps: r.breakEvenCostBps } : { available: false, reason: r.reason });
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: { corr, verdict, majors: pack(maj), midcap: pack(mid), stacked: pack(stack) },
  };
}
