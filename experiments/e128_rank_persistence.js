// E128 - FUNDING XS-RANK PERSISTENCE (grounds the R8 slow policy).
//
// Round-100 AI-side. e126/F-139 + e127/F-140 closed sizing twice: the R8 edge
// is in the XS RANK, flat sizing stands. The pinned spec smooths the rank
// with a slow EWMA (lambda 0.01-0.02) — this experiment measures whether the
// cross-sectional funding rank actually persists at that timescale, through
// the repo's own aligned view (parseSleeveInputs), on both panels.
//
// Method: per 8h bucket, rank the 8 funding rates cross-sectionally (average
// ranks); Spearman rho between rank vectors at lags 1, 7, 30, 90 buckets
// (~8h, ~2.3d, ~10d, ~30d); plus mean absolute rank change at lag 1.
//
// PRE-REGISTERED. SUPPORTED iff on BOTH panels: rho1 >= 0.7 (short-term
// persistence), rho1 > rho7 > rho30 (decay over days/weeks, not hours), and
// rho30 > 0 (still persistent at ~10d — the slow-policy timescale). Else
// NEGATIVE (the EWMA slowness would need re-justification).

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];
const LAGS = [1, 7, 30, 90];

function ranksOf(row) {
  const idx = row.map((v, i) => i).filter((i) => Number.isFinite(row[i]));
  const sorted = [...idx].sort((a, b) => row[a] - row[b]);
  const r = new Array(row.length).fill(NaN);
  let k = 0;
  while (k < sorted.length) {
    let j = k;
    while (j + 1 < sorted.length && row[sorted[j + 1]] === row[sorted[k]]) j++;
    const avg = (k + j) / 2 + 1;
    for (let m = k; m <= j; m++) r[sorted[m]] = avg;
    k = j + 1;
  }
  return r;
}

function pearson(a, b) {
  let n = 0;
  let ma = 0;
  let mb = 0;
  let s = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) continue;
    n++;
    const da = a[i] - ma;
    ma += da / n;
    const db = b[i] - mb;
    mb += db / n;
    s += da * (b[i] - mb);
    sa += da * (a[i] - ma);
    sb += db * (b[i] - mb);
  }
  return n >= 2 && sa > 0 && sb > 0 ? s / Math.sqrt(sa * sb) : NaN;
}

function rankCurve(fRate) {
  const ranks = fRate.map(ranksOf);
  const rho = {};
  for (const lag of LAGS) {
    let sum = 0;
    let n = 0;
    for (let t = lag; t < ranks.length; t++) {
      const r = pearson(ranks[t - lag], ranks[t]);
      if (Number.isFinite(r)) { sum += r; n++; }
    }
    rho['lag' + lag] = n ? sum / n : NaN;
  }
  let move = 0;
  let n = 0;
  for (let t = 1; t < ranks.length; t++) {
    for (let j = 0; j < ranks[t].length; j++) {
      if (Number.isFinite(ranks[t][j]) && Number.isFinite(ranks[t - 1][j])) { move += Math.abs(ranks[t][j] - ranks[t - 1][j]); n++; }
    }
  }
  return { buckets: fRate.length, rho, meanAbsMove: n ? move / n : NaN };
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
    panels[key] = rankCurve(view.fRate);
  }
  const M = panels.majors;
  const D = panels.midcap;
  const finite = (p) => p.buckets >= 1000 && LAGS.every((l) => Number.isFinite(p.rho['lag' + l])) && Number.isFinite(p.meanAbsMove);
  check('e128: both panels yield finite rank curves on >= 1000 buckets', finite(M) && finite(D),
    'majors=' + M.buckets + ' midcap=' + D.buckets);
  check('e128: lag-1 rank persistence >= 0.7 on both panels', M.rho.lag1 >= 0.7 && D.rho.lag1 >= 0.7,
    'rho1 majors=' + M.rho.lag1.toFixed(3) + ' midcap=' + D.rho.lag1.toFixed(3));
  check('e128: rank persistence decays over days/weeks (rho1 > rho7 > rho30) on both panels',
    M.rho.lag1 > M.rho.lag7 && M.rho.lag7 > M.rho.lag30 && D.rho.lag1 > D.rho.lag7 && D.rho.lag7 > D.rho.lag30,
    'majors ' + M.rho.lag1.toFixed(3) + '>' + M.rho.lag7.toFixed(3) + '>' + M.rho.lag30.toFixed(3) +
    ' midcap ' + D.rho.lag1.toFixed(3) + '>' + D.rho.lag7.toFixed(3) + '>' + D.rho.lag30.toFixed(3));
  check('e128: ranks still persistent at ~10d (rho30 > 0) on both panels', M.rho.lag30 > 0 && D.rho.lag30 > 0,
    'rho30 majors=' + M.rho.lag30.toFixed(3) + ' midcap=' + D.rho.lag30.toFixed(3) +
    ' move1 majors=' + M.meanAbsMove.toFixed(2) + ' midcap=' + D.meanAbsMove.toFixed(2));
  const failed = checks.filter((c) => !c.pass);
  const supported = failed.length === 0;
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: {
      verdict: supported ? 'SUPPORTED' : 'NEGATIVE',
      majors: { buckets: M.buckets, rho: M.rho, meanAbsMove: M.meanAbsMove },
      midcap: { buckets: D.buckets, rho: D.rho, meanAbsMove: D.meanAbsMove },
    },
  };
}
