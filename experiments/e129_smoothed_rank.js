// E129 - SMOOTHED-RANK CONSTRUCTION CHECK (tests the F-141 reading).
//
// Round-101 AI-side. e128/F-141 found raw 8h XS ranks churn (rho1
// 0.52/0.42) with persistence at 10-30d, and read the slow EWMA as
// *constructing* the tradeable rank rather than tracking a slow raw. This
// experiment tests that reading constructively: causally EWMA-smooth each
// funding series (lambda 0.02, the pinned R8 value), rank the SMOOTHED
// values cross-sectionally, and measure the same rank-vector curve.
//
// PRE-REGISTERED. SUPPORTED iff on BOTH panels: smoothed rho1 >= 0.9 (the
// construction manufactures a slow rank) AND smoothed rho1 > raw rho1 AND
// smoothed rho30 >= raw rho30 (smoothing helps at every horizon, computed
// in-run on the same grid — no hardcoded constants). Else NEGATIVE.

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];
const LAMBDA = 0.02;
const LAGS = [1, 7, 30];

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

function rhoCurve(rankRows) {
  const rho = {};
  for (const lag of LAGS) {
    let sum = 0;
    let n = 0;
    for (let t = lag; t < rankRows.length; t++) {
      const r = pearson(rankRows[t - lag], rankRows[t]);
      if (Number.isFinite(r)) { sum += r; n++; }
    }
    rho['lag' + lag] = n ? sum / n : NaN;
  }
  return rho;
}

function smoothedRanks(fRate) {
  const k = fRate[0].length;
  const s = new Array(k).fill(NaN);
  const out = [];
  for (const row of fRate) {
    const sm = new Array(k);
    for (let j = 0; j < k; j++) {
      const x = row[j];
      if (Number.isFinite(x)) s[j] = Number.isFinite(s[j]) ? LAMBDA * x + (1 - LAMBDA) * s[j] : x;
      sm[j] = s[j];
    }
    out.push(ranksOf(sm));
  }
  return out;
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
    const raw = rhoCurve(view.fRate.map(ranksOf));
    const sm = rhoCurve(smoothedRanks(view.fRate));
    panels[key] = { buckets: view.fRate.length, raw, sm };
  }
  const M = panels.majors;
  const D = panels.midcap;
  const finite = (p) => p.buckets >= 1000 && LAGS.every((l) => Number.isFinite(p.raw['lag' + l]) && Number.isFinite(p.sm['lag' + l]));
  check('e129: both panels yield finite raw + smoothed curves on >= 1000 buckets', finite(M) && finite(D),
    'majors=' + M.buckets + ' midcap=' + D.buckets);
  check('e129: smoothed rho1 >= 0.9 on both panels (the construction manufactures a slow rank)',
    M.sm.lag1 >= 0.9 && D.sm.lag1 >= 0.9,
    'sm rho1 majors=' + M.sm.lag1.toFixed(3) + ' midcap=' + D.sm.lag1.toFixed(3));
  check('e129: smoothing helps at every horizon (sm >= raw at lags 1/7/30) on both panels',
    LAGS.every((l) => M.sm['lag' + l] >= M.raw['lag' + l] && D.sm['lag' + l] >= D.raw['lag' + l]),
    'majors raw ' + M.raw.lag1.toFixed(3) + '->sm ' + M.sm.lag1.toFixed(3) +
    ' midcap raw ' + D.raw.lag1.toFixed(3) + '->sm ' + D.sm.lag1.toFixed(3));
  check('e129: smoothed long-horizon rank persists (sm rho30 >= 0.5) on both panels',
    M.sm.lag30 >= 0.5 && D.sm.lag30 >= 0.5,
    'sm rho30 majors=' + M.sm.lag30.toFixed(3) + ' midcap=' + D.sm.lag30.toFixed(3));
  const failed = checks.filter((c) => !c.pass);
  const supported = failed.length === 0;
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: {
      verdict: supported ? 'SUPPORTED' : 'NEGATIVE',
      lambda: LAMBDA,
      majors: { buckets: M.buckets, raw: M.raw, sm: M.sm },
      midcap: { buckets: D.buckets, raw: D.raw, sm: D.sm },
    },
  };
}
