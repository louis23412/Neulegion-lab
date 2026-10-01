// E130 - LAMBDA PLATEAU (is the pinned 0.02 on a plateau, not a pinnacle?).
//
// Round-102 AI-side. The R8 pinned spec smooths with EWMA(lambda 0.02); F-50
// showed the CAP is a plateau, and CYCLE-032 showed a frozen lambda picked on
// >= 2.3y of trailing data reproduces the walk-forward rule — but whether
// 0.02 itself sits on a plateau (not-tuned) vs a pinnacle (tuned) was never
// measured on the shipped path. This runs the lambda ladder through the
// repo's own book construction (buildFundingBook + cleanBook at the pinned
// 12.5% cap + the sleeve's returns + scoreBookReturns @ 4bps).
//
// PRE-REGISTERED. SUPPORTED iff on majors-full: the 0.01–0.03 net-Sharpe
// range <= 0.5 (plateau), the pinned 0.02 is within 0.1 below the best of its
// neighbors (on the plateau, not off it), and turnover falls from 0.005 to
// 0.05 (the speed mechanism). Midcap window is reported, gated only on
// finiteness. Else NEGATIVE.

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import { carryDispersionSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/carry-dispersion.js';
import { buildFundingBook, rowRankWeights } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { cleanBook } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { scoreBookReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];
const LAMBDAS = [0.005, 0.01, 0.02, 0.03, 0.05];

function scoreLambda(view, lambda) {
  const base = buildFundingBook({
    fRate: view.fRate,
    basisPnl: view.basisPnl,
    times: view.times,
    targetFn: rowRankWeights,
    policy: { kind: 'ewma', lambda, normalize: true },
    n: null,
  });
  const rows = cleanBook(base.weightRows, { cap: 0.125, bandEps: null });
  return scoreBookReturns(carryDispersionSleeve.returns(view, rows), rows, { costBps: 4 });
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
    for (const l of LAMBDAS) {
      const s = scoreLambda(view, l);
      ladder[String(l)] = { netSharpe: s.netSharpe, breakEvenCostBps: s.breakEvenCostBps, turnover: s.turnover };
    }
    panels[key] = { buckets: view.times.length, ladder };
  }
  const M = panels.majors;
  const D = panels.midcap;
  const finite = (p) => p.buckets >= 1000 && LAMBDAS.every((l) => Number.isFinite(p.ladder[String(l)].netSharpe));
  check('e130: full lambda ladder scores finite on both panels', finite(M) && finite(D),
    'majors=' + M.buckets + ' midcap=' + D.buckets);
  const near = [0.01, 0.02, 0.03].map((l) => M.ladder[String(l)].netSharpe);
  const range = Math.max(...near) - Math.min(...near);
  check('e130: 0.01–0.03 net-Sharpe range <= 0.5 on majors-full (plateau, not pinnacle)', range <= 0.5,
    'lanes=' + near.map((v) => v.toFixed(2)).join('/') + ' range=' + range.toFixed(2));
  const pinned = M.ladder['0.02'].netSharpe;
  const bestNbr = Math.max(M.ladder['0.01'].netSharpe, M.ladder['0.03'].netSharpe);
  check('e130: pinned 0.02 within 0.1 below the best neighbor on majors-full', pinned >= bestNbr - 0.1,
    'pinned=' + pinned.toFixed(2) + ' bestNbr=' + bestNbr.toFixed(2));
  check('e130: turnover falls from lambda 0.005 to 0.05 on majors-full (speed mechanism)',
    M.ladder['0.005'].turnover > M.ladder['0.05'].turnover,
    't0.005=' + M.ladder['0.005'].turnover.toFixed(1) + ' t0.05=' + M.ladder['0.05'].turnover.toFixed(1));
  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: { verdict: failed.length === 0 ? 'SUPPORTED' : 'NEGATIVE', majors: M, midcap: D },
  };
}
