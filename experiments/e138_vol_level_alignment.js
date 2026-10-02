// E138 - VOL-TOURNAMENT LEVEL ALIGNMENT (10o-1). CYCLE-158.
//
// 2609.27024: raw loss comparisons confound forecast LEVEL with movement
// skill — align levels before comparing models. The repo vol tournament
// (W4b/W4c) ranks AR above EWMA on raw MSE skill with QLIKE as the second
// skill, but no leg aligns levels. This experiment asks whether that matters,
// on synthetic AR(1)-truth vol paths where AR *should* win:
//
// PRE-REGISTERED. PASSES iff every guard passes. Guard 7 is the verdict on
// the paper's concern: it FAILS (becomes an L10 row) iff a level bias below
// 1 realised-vol-sigma flips the raw-MSE ranking on a majority of seeds.

import {
  realizedVolatility, ewmaVolForecast, volForecastSkill, fitArVolForecast,
  predictArVolForecast, volForecastQlike,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast/vol/estimators.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rnd) => {
  const u = Math.max(rnd(), 1e-12), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const mse = (a, f) => mean(a.map((x, i) => (x - f[i]) ** 2));

function truthPath(seed, T = 1500, mu = 0.02, phi = 0.9, sigma = 0.003) {
  const rnd = mulberry32(seed);
  const v = [mu];
  for (let t = 1; t < T; t++) v.push(mu + phi * (v[t - 1] - mu) + sigma * gauss(rnd));
  return v;
}
// Rolling one-step AR(1): fit once on train, predict each test bar from the
// realised history (the tournament's expanding-forecast shape, simplified to a
// fixed fit so the level bias we inject is the only moving part).
function arRolling(vols, split) {
  const train = vols.slice(0, split);
  const fit = fitArVolForecast(train, { order: 1 });
  if (!fit.available) return null;
  const out = new Array(vols.length).fill(NaN);
  for (let t = split; t < vols.length; t++) out[t] = predictArVolForecast(fit, vols.slice(0, t));
  return out;
}

export async function run() {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const seeds = [11, 22, 33, 44, 55];
  const T = 1500, split = 750;

  // 1. repo EWMA == hand recompute.
  {
    const v = truthPath(7, 60);
    const repo = ewmaVolForecast(v, { lambda: 0.94 });
    let hand = [v[0]];
    for (let t = 1; t < v.length; t++) hand.push(0.94 * hand[t - 1] + 0.06 * v[t - 1]);
    check('e138: repo ewmaVolForecast matches a hand replay',
      repo.every((x, t) => Math.abs(x - hand[t]) < 1e-12), '');
  }
  // 2. repo AR(1) fit == independent 2x2 OLS.
  {
    const v = truthPath(7, 400);
    const fit = fitArVolForecast(v, { order: 1 });
    let s1 = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
    for (let t = 1; t < v.length; t++) { s1++; sx += v[t - 1]; sy += v[t]; sxx += v[t - 1] ** 2; sxy += v[t - 1] * v[t]; n++; }
    const det = n * sxx - sx * sx;
    const b = (n * sxy - sx * sy) / det, a = (sy - b * sx) / n;
    check('e138: repo AR(1) fit matches an independent OLS solve',
      fit.available && Math.abs(fit.coef[0] - a) < 1e-9 && Math.abs(fit.coef[1] - b) < 1e-9,
      'coef=' + (fit.coef || []).map((x) => x.toFixed(6)).join(','));
  }
  // 3. repo skills == hand recomputes.
  {
    const a = truthPath(9, 120), f = a.map((x) => x * 1.02 + 0.001), b = a.map(() => 0.02);
    const s = volForecastSkill(a, f, b);
    const q = volForecastQlike(a, f, b);
    const hMse = (x, y) => mse(x, y);
    const hQ = (x, y) => mean(x.map((xi, i) => y[i] / xi - Math.log(y[i] / xi) - 1));
    check('e138: repo MSE/QLIKE skills match hand recomputes',
      s.available && Math.abs(s.skill - (1 - hMse(a, f) / hMse(a, b))) < 1e-12 &&
      q.available && Math.abs(q.skill - (1 - hQ(a, f) / hQ(a, b))) < 1e-12, '');
  }
  // 4-6. tournament premise + alignment/QLIKE agreement on AR truth.
  let agreeRaw = 0, agreeQ = 0, premise = 0;
  for (const seed of seeds) {
    const v = truthPath(seed);
    const test = v.slice(split);
    const ew = ewmaVolForecast(v, { lambda: 0.94 }).slice(split);
    const ar = arRolling(v, split).slice(split);
    const flat = test.map(() => mean(v.slice(0, split)));
    const mAR = mse(test, ar), mEW = mse(test, ew), mFL = mse(test, flat);
    if (mAR < mEW && mEW < mFL) premise++;
    // alignment bias estimated on the TRAIN half (the paper's validation form):
    // one-step rolling predictions, which are defined for every train bar.
    const trainFit = fitArVolForecast(v.slice(0, split), { order: 1 });
    const biasAR = mean(v.slice(1, split).map((y, i) =>
      predictArVolForecast(trainFit, v.slice(0, i + 1)) - y).filter(Number.isFinite));
    const ewFull = ewmaVolForecast(v, { lambda: 0.94 });
    const biasEW = mean(ewFull.slice(1, split).map((p, i) => p - v[i + 1]).filter(Number.isFinite));
    const arAl = ar.map((x) => x - biasAR), ewAl = ew.map((x) => x - biasEW);
    const mARa = mse(test, arAl), mEWa = mse(test, ewAl);
    const rawRank = mAR < mEW ? 'ar' : 'ew';
    const alRank = mARa < mEWa ? 'ar' : 'ew';
    if (rawRank === alRank) agreeRaw++;
    const qAR = volForecastQlike(test, ar, ew), qAL = volForecastQlike(test, arAl, ewAl);
    const qRank = qAR.available && qAR.skill > 0 ? 'ar' : 'ew';
    const qRankA = qAL.available && qAL.skill > 0 ? 'ar' : 'ew';
    if (qRank === alRank && qRankA === alRank) agreeQ++;
  }
  check('e138: raw MSE ranks AR > EWMA > flat on AR truth (tournament premise)', premise >= 4, premise + '/5 seeds');
  check('e138: level alignment never flips the AR/EWMA ranking on truth-like data', agreeRaw === 5, agreeRaw + '/5 seeds');
  check('e138: QLIKE agrees with aligned MSE on every seed', agreeQ === 5, agreeQ + '/5 seeds');

  // 7. flip threshold: good-movement biased AR vs right-level flat.
  const flips = [];
  for (const seed of seeds) {
    const v = truthPath(seed);
    const test = v.slice(split);
    const ar = arRolling(v, split).slice(split);
    const flat = test.map(() => mean(v.slice(0, split)));
    const sd = Math.sqrt(mean(test.map((x) => (x - mean(test)) ** 2)));
    const mFL = mse(test, flat);
    let star = null;
    for (let k = 0; k <= 12; k++) {
      const b = (k * 0.25) * sd;
      if (mse(test, ar.map((x) => x + b)) > mFL) { star = k * 0.25; break; }
    }
    flips.push(star);
  }
  const med = flips.slice().sort((a, b) => a - b)[2];
  const majorityFragile = flips.filter((x) => x !== null && x < 1).length >= 3;
  check('e138: raw-MSE flip needs >= 1 vol-sigma of level bias (else L10 row)',
    !majorityFragile, 'median b*=' + med + ' sigma, per-seed=' + flips.join(','));

  // 8. determinism.
  {
    const v1 = truthPath(11), v2 = truthPath(11);
    check('e138: synthetic paths are bit-deterministic per seed',
      v1.every((x, i) => x === v2[i]), '');
  }

  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: { verdict: failed.length === 0 ? 'SUPPORTED' : 'NEGATIVE', medianFlipSigma: med, flips },
  };
}
