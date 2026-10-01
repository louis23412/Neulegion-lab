// E132 - STACKED-16 CAP LADDER (does the 16-wide book want a different cap?).
//
// Round-104 AI-side. e131 measured the cap plateau on the majors-full (6606)
// and midcap-window (2466) panels separately — but the native 16-panel
// (TODO 116/118) ranks funding ACROSS all 16 streams (e124: a genuinely
// different book, cross-leg corr -0.02), so the pinned 12.5% cap must be
// re-checked on the stacked panel itself. This runs the cap ladder through
// the repo's own book construction on the window-matched stacked-16 grid
// (e124 plumbing: every input floored at 2024-06-01, the only shared grid).
//
// PRE-REGISTERED. SUPPORTED iff on stacked-16: the cap ladder scores finite,
// the 0.0625–0.25 net-Sharpe range <= 0.5 (plateau), the pinned 0.125 is
// within 0.1 below the best of its neighbors (ports unchanged), and the cap
// binds monotonically (tighter cap -> smaller mean per-row max weight).
// Else NEGATIVE (and the native port takes the winning cap, not the pinned).

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import { carryDispersionSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/carry-dispersion.js';
import { buildFundingBook, rowRankWeights } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { cleanBook } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { scoreBookReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];
const CAPS = [0.0625, 0.125, 0.25, 0.5];
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

function meanMaxAbs(rows) {
  let acc = 0;
  for (const r of rows) {
    let m = 0;
    for (const x of r) { const a = Math.abs(x) || 0; if (a > m) m = a; }
    acc += m;
  }
  return rows.length ? acc / rows.length : NaN;
}

function scoreCap(view, cap) {
  const base = buildFundingBook({
    fRate: view.fRate,
    basisPnl: view.basisPnl,
    times: view.times,
    targetFn: rowRankWeights,
    policy: { kind: 'ewma', lambda: 0.02, normalize: true },
    n: null,
  });
  const rows = cleanBook(base.weightRows, { cap, bandEps: null });
  const s = scoreBookReturns(carryDispersionSleeve.returns(view, rows), rows, { costBps: 4 });
  return { netSharpe: s.netSharpe, breakEvenCostBps: s.breakEvenCostBps, turnover: s.turnover, meanMaxAbs: meanMaxAbs(rows) };
}

export async function run() {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const load = async (b, s, isFunding) => {
    const sl = s.toLowerCase();
    let text;
    if (isFunding) {
      text = await globalThis.__fs.readTextFile(b === REPO
        ? REPO + '/src/data/funding_' + sl + '_8h.jsonl'
        : LAB + '/data/midcap_funding/funding_' + sl + '_8h.jsonl');
    } else if (b === REPO) {
      const name = sl === 'btcusdt' ? 'candles.jsonl' : 'candles_' + sl + '_1h.jsonl';
      try { text = await globalThis.__fs.readTextFile(REPO + '/src/data/' + name); }
      catch { text = await globalThis.__fs.readTextFile(REPO + '/src/' + name); }
    } else {
      text = await globalThis.__fs.readTextFile(LAB + '/data/midcap/candles_' + sl + '_1h.jsonl');
    }
    return windowMatch(text);
  };
  const f = [];
  const c = [];
  for (const s of MAJ) { f.push(await load(REPO, s, true)); c.push(await load(REPO, s, false)); }
  for (const s of MID) { f.push(await load('LAB', s, true)); c.push(await load('LAB', s, false)); }
  const { view } = parseSleeveInputs({ fundingTexts: f, candleTexts: c });
  const ladder = {};
  for (const cp of CAPS) {
    const s = scoreCap(view, cp);
    ladder[String(cp)] = { netSharpe: s.netSharpe, breakEvenCostBps: s.breakEvenCostBps, turnover: s.turnover, meanMaxAbs: s.meanMaxAbs };
  }
  const buckets = view.times.length;
  const finite = buckets >= 1000 && CAPS.every((cp) => Number.isFinite(ladder[String(cp)].netSharpe));
  check('e132: full cap ladder scores finite on stacked-16 (16 streams)', finite,
    'buckets=' + buckets);
  const near = [0.0625, 0.125, 0.25].map((cp) => ladder[String(cp)].netSharpe);
  const range = Math.max(...near) - Math.min(...near);
  check('e132: 0.0625–0.25 net-Sharpe range <= 0.5 on stacked-16 (plateau, not pinnacle)', range <= 0.5,
    'lanes=' + near.map((v) => v.toFixed(2)).join('/') + ' range=' + range.toFixed(2));
  const pinned = ladder['0.125'].netSharpe;
  const bestNbr = Math.max(ladder['0.0625'].netSharpe, ladder['0.25'].netSharpe);
  check('e132: pinned 0.125 within 0.1 below the best neighbor on stacked-16', pinned >= bestNbr - 0.1,
    'pinned=' + pinned.toFixed(2) + ' bestNbr=' + bestNbr.toFixed(2));
  check('e132: cap binds monotonically on stacked-16 (tighter cap -> smaller mean max weight)',
    ladder['0.0625'].meanMaxAbs < ladder['0.25'].meanMaxAbs,
    'mm0.0625=' + ladder['0.0625'].meanMaxAbs.toFixed(4) + ' mm0.25=' + ladder['0.25'].meanMaxAbs.toFixed(4));
  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: { verdict: failed.length === 0 ? 'SUPPORTED' : 'NEGATIVE', buckets, ladder },
  };
}
