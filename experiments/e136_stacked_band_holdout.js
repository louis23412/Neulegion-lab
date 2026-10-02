// E136 - STACKED-BAND HOLDOUT (is the 0.01 band pick stable out of sample?).
//
// Round-108 AI-side. e135 found the no-trade band transfers to stacked-16
// (best eps 0.01 at net 0.44 vs daily 0.40) — but the pick was read off the
// FULL curve, and F-49/F-55/F-59 taught the lab that a grid pick must be
// frozen on a trailing window and scored forward. This runs the dense-split
// holdout on the pinned capped-0.125 stacked-16 book through the repo's own
// construction + scoreBookReturns (e135 plumbing: inputs floored at
// 2024-06-01, cost 4, 2466 buckets):
//
//   for each split S: pick eps* by in-sample [0,S) net@4, score [S,end).
//   baselines: fixed eps=0.01 and the daily (null) book.
//
// Guards: full-sample null lane = e135 (0.40); fixed-0.01 full = e135 (0.44).
//
// PRE-REGISTERED. BAND-ROBUST iff (a) the frozen-eps OOS net >= daily at >=
// 60% of splits, (b) fixed-0.01 OOS >= daily at >= 60% of splits, and (c) the
// trailing pick takes at most 3 distinct values (a stable pick). Otherwise the
// e135 advantage is itself a full-sample artefact and the native port (TODO
// 118) takes the daily book.

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import { carryDispersionSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/carry-dispersion.js';
import { buildFundingBook, rowRankWeights } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { cleanBook } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { scoreBookReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];
const EPS = [null, 0.0025, 0.005, 0.01, 0.02, 0.03, 0.05];
const SPLITS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000];
const FLOOR_MS = Date.parse('2024-06-01T00:00:00.000Z');
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);

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
  const base = buildFundingBook({
    fRate: view.fRate,
    basisPnl: view.basisPnl,
    times: view.times,
    targetFn: rowRankWeights,
    policy: { kind: 'ewma', lambda: 0.02, normalize: true },
    n: null,
  });
  const m = view.times.length;
  const scored = {};
  for (const eps of EPS) {
    const rows = cleanBook(base.weightRows, { cap: 0.125, bandEps: eps });
    const rets = carryDispersionSleeve.returns(view, rows);
    scored[String(eps)] = { rows, rets };
  }
  const netAt = (eps, from, to) => {
    const s = scored[String(eps)];
    return scoreBookReturns(s.rets.slice(from, to), s.rows.slice(from, to), { costBps: 4 }).netSharpe;
  };
  const fullNull = netAt(null, 0, m);
  const fullFixed = netAt(0.01, 0, m);
  check('e136: full-sample lanes reproduce e135 (coherence guard)',
    Math.abs(fullNull - 0.40) < 0.005 && Math.abs(fullFixed - 0.44) < 0.005,
    'null=' + r2(fullNull) + ' fixed0.01=' + r2(fullFixed));
  const perSplit = SPLITS.filter((S) => S < m - 365).map((S) => {
    let pick = EPS[0];
    let pickNet = -Infinity;
    for (const e of EPS) {
      const v = netAt(e, 0, S);
      if (Number.isFinite(v) && v > pickNet) { pickNet = v; pick = e; }
    }
    return {
      S, epsPick: String(pick),
      oosFrozen: r2(netAt(pick, S, m)),
      oosFixed: r2(netAt(0.01, S, m)),
      oosDaily: r2(netAt(null, S, m)),
    };
  });
  const frac = (n) => +(n / perSplit.length).toFixed(2);
  const frozenBeats = perSplit.filter((p) => p.oosFrozen >= p.oosDaily).length;
  const fixedBeats = perSplit.filter((p) => p.oosFixed >= p.oosDaily).length;
  const picks = [...new Set(perSplit.map((p) => p.epsPick))];
  check('e136: frozen-eps OOS net >= daily at >= 60% of splits', frac(frozenBeats) >= 0.6,
    frac(frozenBeats) + ' (' + frozenBeats + '/' + perSplit.length + ')');
  check('e136: fixed-0.01 OOS net >= daily at >= 60% of splits', frac(fixedBeats) >= 0.6,
    frac(fixedBeats) + ' (' + fixedBeats + '/' + perSplit.length + ')');
  check('e136: trailing pick takes at most 3 distinct values (stable pick)', picks.length <= 3,
    'picks=' + picks.join(','));
  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: {
      verdict: failed.length === 0 ? 'SUPPORTED' : 'NEGATIVE',
      buckets: m, perSplit,
      note: failed.length === 0
        ? 'band-robust: the e135 pick survives the holdout'
        : 'band advantage is a full-sample artefact: TODO 118 takes the daily book',
    },
  };
}
