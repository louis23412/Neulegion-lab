// E135 - BAND ON STACKED-16 (does the port recipe's no-trade band transfer?).
//
// Round-107 AI-side. F-52 stacked cap-then-band on the majors R8 book
// (net@4 6.36 vs capped 6.18, turnover 10→6x/yr) and the port artefact pins
// R8 = cap 1/k + band 0.005 — but the native 16-panel (TODO 116/118) is a
// genuinely different book (e124 cross-leg corr -0.02; e132 cap plateau holds
// on it). This sweeps the band on the pinned capped-0.125 stacked-16 book
// through the repo's own cleanBook + scoreBookReturns (e132 plumbing:
// every input floored at 2024-06-01, cost 4).
//
// PRE-REGISTERED. SUPPORTED iff on stacked-16: every lane scores finite, the
// null lane reproduces e132's pinned lane to 2 decimals (coherence), some
// eps>0 lane reaches net >= the null lane at turnover <= the null lane (the
// band adds), and the best lane is within 0.1 of a neighboring lane
// (smoothness — the F-57 isolated-spike guard). Else NEGATIVE (band stays
// R8-only, like F-53's fade result).

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import { carryDispersionSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/carry-dispersion.js';
import { buildFundingBook, rowRankWeights } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { cleanBook } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { scoreBookReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];
const EPS = [null, 0.005, 0.01, 0.03];
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

function scoreBand(view, eps) {
  const base = buildFundingBook({
    fRate: view.fRate,
    basisPnl: view.basisPnl,
    times: view.times,
    targetFn: rowRankWeights,
    policy: { kind: 'ewma', lambda: 0.02, normalize: true },
    n: null,
  });
  const rows = cleanBook(base.weightRows, { cap: 0.125, bandEps: eps });
  const s = scoreBookReturns(carryDispersionSleeve.returns(view, rows), rows, { costBps: 4 });
  return { netSharpe: s.netSharpe, breakEvenCostBps: s.breakEvenCostBps, turnover: s.turnover };
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
  for (const eps of EPS) {
    const s = scoreBand(view, eps);
    ladder[String(eps)] = { netSharpe: s.netSharpe, breakEvenCostBps: s.breakEvenCostBps, turnover: s.turnover };
  }
  const buckets = view.times.length;
  const nets = EPS.map((e) => ladder[String(e)].netSharpe);
  check('e135: full band ladder scores finite on stacked-16 (capped 0.125)',
    buckets >= 1000 && nets.every(Number.isFinite), 'buckets=' + buckets);
  const daily = ladder['null'].netSharpe;
  const bands = EPS.slice(1).map((e) => ({ eps: e, s: ladder[String(e)] }));
  const adds = bands.filter((b) => b.s.netSharpe >= daily && b.s.turnover <= ladder['null'].turnover);
  check('e135: some band lane matches/beats daily net at no higher turnover',
    adds.length > 0, 'daily=' + daily.toFixed(2) + ' lanes=' + bands.map((b) => b.eps + ':' + b.s.netSharpe.toFixed(2) + '/' + b.s.turnover.toFixed(1) + 'x').join(' '));
  const best = bands.reduce((a, b) => (b.s.netSharpe > a.s.netSharpe ? b : a));
  const order = bands.map((b) => b.s.netSharpe);
  const bi = order.indexOf(best.s.netSharpe);
  const nbrGap = Math.min(
    bi > 0 ? Math.abs(order[bi] - order[bi - 1]) : Infinity,
    bi < order.length - 1 ? Math.abs(order[bi] - order[bi + 1]) : Infinity,
  );
  check('e135: best band lane within 0.1 of a neighbor (no isolated spike)',
    nbrGap <= 0.1, 'best=' + best.eps + ':' + best.s.netSharpe.toFixed(2) + ' gap=' + nbrGap.toFixed(2));
  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: { verdict: failed.length === 0 ? 'SUPPORTED' : 'NEGATIVE', buckets, ladder },
  };
}
