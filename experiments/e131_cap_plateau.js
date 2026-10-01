// E131 - CAP PLATEAU (is the pinned 12.5% cap on a plateau, not a pinnacle?).
//
// Round-103 AI-side. The R8 pinned spec caps cleaned book weights at 12.5%;
// F-50 showed the cap is a plateau on the old path and e130 showed lambda 0.02
// sits mid-plateau on the shipped path — but whether the 12.5% cap itself is
// plateau (not-tuned) vs pinnacle (tuned) was never measured on the shipped
// path. This runs the cap ladder through the repo's own book construction
// (buildFundingBook at the pinned lambda 0.02 + cleanBook cap + the sleeve's
// returns + scoreBookReturns @ 4bps).
//
// PRE-REGISTERED. SUPPORTED iff on majors-full: the 0.0625–0.25 net-Sharpe
// range <= 0.5 (plateau), the pinned 0.125 is within 0.1 below the best of its
// neighbors (on the plateau, not off it), and the cap binds monotonically
// (tighter cap -> smaller mean per-row max weight, the clipping mechanism).
// Midcap window is reported, gated only on finiteness. Else NEGATIVE.

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
    if (isFunding) {
      return globalThis.__fs.readTextFile(b === REPO
        ? REPO + '/src/data/funding_' + sl + '_8h.jsonl'
        : LAB + '/data/midcap_funding/funding_' + sl + '_8h.jsonl');
    }
    if (b === REPO) {
      const name = sl === 'btcusdt' ? 'candles.jsonl' : 'candles_' + sl + '_1h.jsonl';
      try { return await globalThis.__fs.readTextFile(REPO + '/src/data/' + name); }
      catch { return await globalThis.__fs.readTextFile(REPO + '/src/' + name); }
    }
    return globalThis.__fs.readTextFile(LAB + '/data/midcap/candles_' + sl + '_1h.jsonl');
  };
  const panels = {};
  for (const [key, syms, b] of [['majors', MAJ, REPO], ['midcap', MID, 'LAB']]) {
    const f = [];
    const c = [];
    for (const s of syms) { f.push(await load(b, s, true)); c.push(await load(b, s, false)); }
    const { view } = parseSleeveInputs({ fundingTexts: f, candleTexts: c });
    const ladder = {};
    for (const cp of CAPS) {
      const s = scoreCap(view, cp);
      ladder[String(cp)] = { netSharpe: s.netSharpe, breakEvenCostBps: s.breakEvenCostBps, turnover: s.turnover, meanMaxAbs: s.meanMaxAbs };
    }
    panels[key] = { buckets: view.times.length, ladder };
  }
  const M = panels.majors;
  const D = panels.midcap;
  const finite = (p) => p.buckets >= 1000 && CAPS.every((cp) => Number.isFinite(p.ladder[String(cp)].netSharpe));
  check('e131: full cap ladder scores finite on both panels', finite(M) && finite(D),
    'majors=' + M.buckets + ' midcap=' + D.buckets);
  const near = [0.0625, 0.125, 0.25].map((cp) => M.ladder[String(cp)].netSharpe);
  const range = Math.max(...near) - Math.min(...near);
  check('e131: 0.0625–0.25 net-Sharpe range <= 0.5 on majors-full (plateau, not pinnacle)', range <= 0.5,
    'lanes=' + near.map((v) => v.toFixed(2)).join('/') + ' range=' + range.toFixed(2));
  const pinned = M.ladder['0.125'].netSharpe;
  const bestNbr = Math.max(M.ladder['0.0625'].netSharpe, M.ladder['0.25'].netSharpe);
  check('e131: pinned 0.125 within 0.1 below the best neighbor on majors-full', pinned >= bestNbr - 0.1,
    'pinned=' + pinned.toFixed(2) + ' bestNbr=' + bestNbr.toFixed(2));
  check('e131: cap binds monotonically on majors-full (tighter cap -> smaller mean max weight)',
    M.ladder['0.0625'].meanMaxAbs < M.ladder['0.25'].meanMaxAbs,
    'mm0.0625=' + M.ladder['0.0625'].meanMaxAbs.toFixed(4) + ' mm0.25=' + M.ladder['0.25'].meanMaxAbs.toFixed(4));
  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: { verdict: failed.length === 0 ? 'SUPPORTED' : 'NEGATIVE', majors: M, midcap: D },
  };
}
