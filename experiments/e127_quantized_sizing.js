// E127 - QUANTIZED-REGIME CARRY SIZING (2-state scale with hysteresis).
//
// Round-99 AI-side (TODO 119). e126/F-139 killed per-bar scaling: the regime
// factor moves far faster than the slow book, so turnover explodes. The filed
// next design quantizes the scale — a 2-state HIGH/LOW with hysteresis and a
// minimum hold (transitions at most monthly), so the scale moves SLOWER than
// the book instead of faster.
//
// Method: same repo score path as e126 (parseSleeveInputs → signal →
// singleBook.compose → capBandRisk → scale → returns → scoreBookReturns).
// Regime ratio r = xsStd(fRate[t]) / trailing-median-90; state HIGH when
// r >= 1.2, LOW when r <= 0.8, else hold; scale HIGH 1.25 / LOW 0.75;
// minimum hold 90 buckets (~monthly) after any transition (causal —
// transitions decided on row t price the t+1 earn).
//
// PRE-REGISTERED (TODO 119). SUPPORTED iff quantized BE >= flat BE with
// turnover <= 2× flat on BOTH panels. Else NEGATIVE (flat stands again).

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import { carryDispersionSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/carry-dispersion.js';
import { singleBook } from '../../NeuLegion-master/NeuLegion-master/src/plugins/books/single.js';
import { capBandRisk } from '../../NeuLegion-master/NeuLegion-master/src/plugins/risk/cap-band.js';
import { scoreBookReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];

const HI = 1.2;
const LO = 0.8;
const HOLD = 90;
const S_HI = 1.25;
const S_LO = 0.75;

function xsStd(row) {
  let n = 0;
  let m = 0;
  let m2 = 0;
  for (const v of row) {
    if (!Number.isFinite(v)) continue;
    n++;
    const d = v - m;
    m += d / n;
    m2 += d * (v - m);
  }
  return n >= 2 ? Math.sqrt(m2 / (n - 1)) : NaN;
}

function medianOf(arr) {
  const s = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function scorePanel(fTexts, cTexts) {
  const { view } = parseSleeveInputs({ fundingTexts: fTexts, candleTexts: cTexts });
  const raw = carryDispersionSleeve.signal(view);
  const book = singleBook.compose([{ rows: raw, weight: 1 }]);
  const flat = capBandRisk.applyForSleeve(book.weightRows, 'carry-dispersion');
  const disp = view.fRate.map(xsStd);
  let state = 1;
  let held = HOLD;
  let transitions = 0;
  const quantized = flat.map((row, t) => {
    const base = medianOf(disp.slice(Math.max(0, t - 90), t));
    const r = Number.isFinite(disp[t]) && Number.isFinite(base) && base > 0 ? disp[t] / base : 1;
    if (held >= HOLD) {
      if (state !== 1 && r >= HI) { state = 1; held = 0; transitions++; }
      else if (state !== -1 && r <= LO) { state = -1; held = 0; transitions++; }
    } else held++;
    const f = state === 1 ? S_HI : S_LO;
    return row.map((w) => w * f);
  });
  const flatScored = scoreBookReturns(carryDispersionSleeve.returns(view, flat), flat, { costBps: 4 });
  const qScored = scoreBookReturns(carryDispersionSleeve.returns(view, quantized), quantized, { costBps: 4 });
  return { flat: flatScored, q: qScored, buckets: view.times.length, transitions };
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
    panels[key] = scorePanel(f, c);
  }
  const gate = (p) => p.q.breakEvenCostBps >= p.flat.breakEvenCostBps && p.q.turnover <= 2 * p.flat.turnover;
  check('e127: both panels score finite flat and quantized books',
    [panels.majors, panels.midcap].every((p) => Number.isFinite(p.flat.netSharpe) && Number.isFinite(p.q.netSharpe)),
    'majors qBE=' + panels.majors.q.breakEvenCostBps.toFixed(1) + ' midcap qBE=' + panels.midcap.q.breakEvenCostBps.toFixed(1));
  check('e127: quantized regime switches at most monthly', panels.majors.transitions <= panels.majors.buckets / 90 + 1 && panels.midcap.transitions <= panels.midcap.buckets / 90 + 1,
    'transitions majors=' + panels.majors.transitions + ' midcap=' + panels.midcap.transitions);
  check('e127: quantized-vs-flat comparison is measurable on majors',
    Number.isFinite(panels.majors.q.breakEvenCostBps) && Number.isFinite(panels.majors.q.turnover),
    'qBE=' + panels.majors.q.breakEvenCostBps.toFixed(1) + ' flatBE=' + panels.majors.flat.breakEvenCostBps.toFixed(1));
  check('e127: quantized-vs-flat comparison is measurable on midcap',
    Number.isFinite(panels.midcap.q.breakEvenCostBps) && Number.isFinite(panels.midcap.q.turnover),
    'qBE=' + panels.midcap.q.breakEvenCostBps.toFixed(1) + ' flatBE=' + panels.midcap.flat.breakEvenCostBps.toFixed(1));
  const supported = gate(panels.majors) && gate(panels.midcap);
  const failed = checks.filter((c) => !c.pass);
  const pack = (s) => ({ netSharpe: s.netSharpe, breakEvenCostBps: s.breakEvenCostBps, turnover: s.turnover });
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: {
      verdict: supported ? 'SUPPORTED' : 'NEGATIVE',
      majors: { buckets: panels.majors.buckets, transitions: panels.majors.transitions, flat: pack(panels.majors.flat), q: pack(panels.majors.q) },
      midcap: { buckets: panels.midcap.buckets, transitions: panels.midcap.transitions, flat: pack(panels.midcap.flat), q: pack(panels.midcap.q) },
    },
  };
}
