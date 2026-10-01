// E134 - PINNED-BOOK COST LADDER (where does cost eat the carry book?).
//
// Round-106 AI-side. Every sleeve number so far is scored at one cost level
// (4 bps), and BE is reported but the net-vs-cost curve itself was never
// traced on the shipped path. This scores the pinned book (lambda 0.02,
// cap 12.5%) at 0/2/4/10/25 bps on majors-full (6606) and the window-matched
// stacked-16 (2466, e132 plumbing) through the repo's own construction +
// scoreBookReturns.
//
// PRE-REGISTERED. SUPPORTED iff: the ladder scores finite on both panels,
// net falls monotonically with cost on both panels (the cost mechanism), the
// 4bps lanes cohere with the recorded pinned lanes (e131 majors 0.3404 /
// e132 stacked 0.4008 net, BE 42.88/24.11 — same path, must reproduce), and
// the zero-crossing cost is finite on both panels (the book is cost-sensitive
// inside the ladder, not cost-immune). The curve itself is RECORDED
// descriptively for future tradeability reference. Else NEGATIVE.

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import { carryDispersionSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/carry-dispersion.js';
import { buildFundingBook, rowRankWeights } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { cleanBook } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { scoreBookReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];
const COSTS = [0, 2, 4, 10, 25];
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

function pinnedRows(view) {
  const base = buildFundingBook({
    fRate: view.fRate,
    basisPnl: view.basisPnl,
    times: view.times,
    targetFn: rowRankWeights,
    policy: { kind: 'ewma', lambda: 0.02, normalize: true },
    n: null,
  });
  return cleanBook(base.weightRows, { cap: 0.125, bandEps: null });
}

export async function run() {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const loadFull = async (b, s, isFunding) => {
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
  const loadWin = async (t) => windowMatch(t);
  // majors-full panel (no window floor).
  const majF = [];
  const majC = [];
  for (const s of MAJ) { majF.push(await loadFull(REPO, s, true)); majC.push(await loadFull(REPO, s, false)); }
  // stacked-16 panel (every input window-matched, e132 plumbing).
  const stF = [];
  const stC = [];
  for (const s of MAJ) { stF.push(await loadWin(await loadFull(REPO, s, true))); stC.push(await loadWin(await loadFull(REPO, s, false))); }
  for (const s of MID) { stF.push(await loadWin(await loadFull('LAB', s, true))); stC.push(await loadWin(await loadFull('LAB', s, false))); }
  const panels = {};
  for (const [key, f, c] of [['majors', majF, majC], ['stacked16', stF, stC]]) {
    const { view } = parseSleeveInputs({ fundingTexts: f, candleTexts: c });
    const rows = pinnedRows(view);
    const rets = carryDispersionSleeve.returns(view, rows);
    const ladder = {};
    for (const cp of COSTS) {
      const s = scoreBookReturns(rets, rows, { costBps: cp });
      ladder[String(cp)] = { netSharpe: s.netSharpe, breakEvenCostBps: s.breakEvenCostBps, turnover: s.turnover };
    }
    panels[key] = { buckets: view.times.length, ladder };
  }
  const M = panels.majors;
  const S = panels.stacked16;
  const finite = (p) => p.buckets >= 1000 && COSTS.every((c) => Number.isFinite(p.ladder[String(c)].netSharpe));
  check('e134: full cost ladder scores finite on majors-full + stacked-16', finite(M) && finite(S),
    'majors=' + M.buckets + ' stacked16=' + S.buckets);
  const mono = (p) => COSTS.every((c, i) => i === 0 || p.ladder[String(c)].netSharpe < p.ladder[String(COSTS[i - 1])].netSharpe);
  check('e134: net falls monotonically with cost on both panels (cost mechanism)',
    mono(M) && mono(S),
    'majors ' + COSTS.map((c) => M.ladder[String(c)].netSharpe.toFixed(2)).join('/') +
    ' stacked ' + COSTS.map((c) => S.ladder[String(c)].netSharpe.toFixed(2)).join('/'));
  const cohMaj = Math.abs(M.ladder['4'].netSharpe - 0.3404) < 0.005 && Math.abs(M.ladder['4'].breakEvenCostBps - 42.88) < 0.5;
  const cohStk = Math.abs(S.ladder['4'].netSharpe - 0.4008) < 0.005 && Math.abs(S.ladder['4'].breakEvenCostBps - 24.11) < 0.5;
  check('e134: 4bps lanes reproduce the recorded pinned lanes (e131/e132 coherence)', cohMaj && cohStk,
    'majors4=' + M.ladder['4'].netSharpe.toFixed(4) + '/' + M.ladder['4'].breakEvenCostBps.toFixed(2) +
    ' stacked4=' + S.ladder['4'].netSharpe.toFixed(4) + '/' + S.ladder['4'].breakEvenCostBps.toFixed(2));
  const cross = (p) => { for (const c of COSTS) if (p.ladder[String(c)].netSharpe <= 0) return c; return null; };
  const xM = cross(M);
  const xS = cross(S);
  check('e134: zero-crossing cost is finite on both panels (cost-sensitive inside the ladder)',
    xM !== null && xS !== null, 'cross majors@' + xM + 'bps stacked@' + xS + 'bps');
  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: {
      verdict: failed.length === 0 ? 'SUPPORTED' : 'NEGATIVE',
      majors: M, stacked16: S, crossAt: { majors: xM, stacked16: xS },
    },
  };
}
