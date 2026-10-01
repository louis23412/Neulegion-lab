// E133 - PREDICTIVE-SMOOTHER PROBE (can a forecast beat fixed EWMA at rank persistence?).
//
// Round-105 AI-side. F-142 showed causal EWMA(0.02) manufactures rho1 0.992;
// sweep 10g's 1912.03270 says funding is heteroskedastic, Granger-causal with
// price, and GARCH-fitted as a forecastable state. If funding is forecastable,
// a predictive smoother (rank tomorrow's prediction) is a candidate challenger
// to the fixed-lambda constructor. This pits a causal recursive AR(1)
// one-step forecast per series against the pinned EWMA on the same
// rank-persistence curve (e129 harness: lags 1/7/30, both panels).
//
// PRE-REGISTERED. SUPPORTED iff the challenger persists at least as well as
// the pinned smoother on BOTH panels (pred rho1 >= sm rho1 majors-full AND
// midcap-window) with all curves finite — the adoption bar for a predictive
// smoother. Else NEGATIVE (fixed EWMA stands, F-142 reinforced — a near-ceiling
// baseline is allowed to win; that IS the finding).

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];
const LAMBDA = 0.02;
const WINDOW = 168;
const WARMUP = 24;
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

// Causal recursive AR(1): at bucket t, OLS y on lagged-y over the trailing
// WINDOW finite pairs, predict t+1; rank the predictions. Pure, no lookahead
// (only rows < t feed prediction for t).
function predictedRanks(fRate) {
  const n = fRate.length;
  const k = fRate[0].length;
  const cols = [];
  for (let j = 0; j < k; j++) cols.push(fRate.map((row) => row[j]));
  const out = [];
  for (let t = 0; t < n; t++) {
    const pred = new Array(k).fill(NaN);
    if (t >= 1) {
      for (let j = 0; j < k; j++) {
        const pairs = [];
        for (let s = Math.max(1, t - WINDOW); s <= t; s++) {
          const y = cols[j][s];
          const x = cols[j][s - 1];
          if (Number.isFinite(y) && Number.isFinite(x)) pairs.push([x, y]);
        }
        if (pairs.length >= WARMUP) {
          let mx = 0;
          let my = 0;
          for (const [x, y] of pairs) { mx += x; my += y; }
          mx /= pairs.length;
          my /= pairs.length;
          let sxx = 0;
          let sxy = 0;
          for (const [x, y] of pairs) { sxx += (x - mx) * (x - mx); sxy += (x - mx) * (y - my); }
          const prev = cols[j][t];
          if (Number.isFinite(prev)) pred[j] = sxx > 0 ? my + (sxy / sxx) * (prev - mx) : my;
        }
      }
    }
    out.push(ranksOf(pred));
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
    const sm = rhoCurve(smoothedRanks(view.fRate));
    const pr = rhoCurve(predictedRanks(view.fRate));
    panels[key] = { buckets: view.fRate.length, sm, pr };
  }
  const M = panels.majors;
  const D = panels.midcap;
  const finite = (p) => p.buckets >= 1000 && LAGS.every((l) => Number.isFinite(p.sm['lag' + l]) && Number.isFinite(p.pr['lag' + l]));
  check('e133: both panels yield finite smoothed + predicted curves on >= 1000 buckets', finite(M) && finite(D),
    'majors=' + M.buckets + ' midcap=' + D.buckets);
  check('e133: pinned smoother replicates e129 (sm rho1 >= 0.9 both panels, plumbing guard)',
    M.sm.lag1 >= 0.9 && D.sm.lag1 >= 0.9,
    'sm rho1 majors=' + M.sm.lag1.toFixed(3) + ' midcap=' + D.sm.lag1.toFixed(3));
  check('e133: AR(1) predictions persist at least as well as EWMA on majors-full (adoption bar)',
    M.pr.lag1 >= M.sm.lag1,
    'pred rho1=' + M.pr.lag1.toFixed(3) + ' sm rho1=' + M.sm.lag1.toFixed(3));
  check('e133: AR(1) predictions persist at least as well as EWMA on midcap-window (adoption bar)',
    D.pr.lag1 >= D.sm.lag1,
    'pred rho1=' + D.pr.lag1.toFixed(3) + ' sm rho1=' + D.sm.lag1.toFixed(3));
  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: {
      verdict: failed.length === 0 ? 'SUPPORTED' : 'NEGATIVE',
      window: WINDOW, warmup: WARMUP,
      majors: { buckets: M.buckets, sm: M.sm, pr: M.pr },
      midcap: { buckets: D.buckets, sm: D.sm, pr: D.pr },
    },
  };
}
