// E126 - DISPERSION-SCALED CARRY SIZING (state-dependent book scale).
//
// Round-98 AI-side. Flat 1.0 sizing is the naive half of the carry book: the
// R8 dispersion trade ranks funding across the basket, so its edge should
// concentrate when dispersion is HIGH and starve when the panel is flat.
// This tests the 2605.06405-flavored idea (state-dependent scale) with zero
// new data: scale each weight row by xsStd(fRate[t]) / trailing-median-30,
// clamped to [0.25, 2] (causal — row t prices the t+1 earn).
//
// Method: the repo's own path per panel (parseSleeveInputs → signal →
// singleBook.compose → capBandRisk → scale → returns → scoreBookReturns),
// flat vs scaled on majors-full-history AND the midcap window.
//
// PRE-REGISTERED. PASS iff scaled beats flat on BOTH net Sharpe AND
// break-even on BOTH panels (4/4). Else NEGATIVE (flat sizing stands).

import { parseSleeveInputs } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import { carryDispersionSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/carry-dispersion.js';
import { singleBook } from '../../NeuLegion-master/NeuLegion-master/src/plugins/books/single.js';
import { capBandRisk } from '../../NeuLegion-master/NeuLegion-master/src/plugins/risk/cap-band.js';
import { scoreBookReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const LAB = 'src/NeuLegion-lab';
const REPO = 'src/NeuLegion-master/NeuLegion-master';
const MAJ = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT'];
const MID = ['AVAXUSDT', 'NEARUSDT', 'ARBUSDT', 'SUIUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'SEIUSDT'];

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

function scorePanel(fTexts, cTexts, { slow = false } = {}) {
  const REG = slow ? 90 : 30;
  const LO = slow ? 0.5 : 0.25;
  const HI = slow ? 1.5 : 2.0;
  const { view } = parseSleeveInputs({ fundingTexts: fTexts, candleTexts: cTexts });
  const raw = carryDispersionSleeve.signal(view);
  const book = singleBook.compose([{ rows: raw, weight: 1 }]);
  const flat = capBandRisk.applyForSleeve(book.weightRows, 'carry-dispersion');
  const disp = view.fRate.map(xsStd);
  const scaled = flat.map((row, t) => {
    const base = medianOf(disp.slice(Math.max(0, t - REG), t));
    let f = Number.isFinite(disp[t]) && Number.isFinite(base) && base > 0 ? disp[t] / base : 1;
    f = Math.min(HI, Math.max(LO, f));
    return row.map((w) => w * f);
  });
  const flatScored = scoreBookReturns(carryDispersionSleeve.returns(view, flat), flat, { costBps: 4 });
  const scaledScored = scoreBookReturns(carryDispersionSleeve.returns(view, scaled), scaled, { costBps: 4 });
  return { flat: flatScored, scaled: scaledScored, buckets: view.times.length };
}

export async function run() {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const load = async (base, dir, s, isFunding) => {
    const sl = s.toLowerCase();
    if (isFunding) {
      const p = base === REPO
        ? REPO + '/src/data/funding_' + sl + '_8h.jsonl'
        : LAB + '/data/midcap_funding/funding_' + sl + '_8h.jsonl';
      return globalThis.__fs.readTextFile(p);
    }
    if (base === REPO) {
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
    for (const s of syms) { f.push(await load(b, null, s, true)); c.push(await load(b, null, s, false)); }
    panels[key] = scorePanel(f, c);
    panels[key + 'Slow'] = scorePanel(f, c, { slow: true });
  }
  const finite = (p) => Number.isFinite(p.flat.netSharpe) && Number.isFinite(p.scaled.netSharpe);
  check('e126: both panels score finite flat and scaled books',
    finite(panels.majors) && finite(panels.midcap),
    'majors flat=' + panels.majors.flat.netSharpe.toFixed(3) + ' scaled=' + panels.majors.scaled.netSharpe.toFixed(3));
  const wins = {
    majorsSharpe: panels.majors.scaled.netSharpe > panels.majors.flat.netSharpe,
    majorsBE: panels.majors.scaled.breakEvenCostBps > panels.majors.flat.breakEvenCostBps,
    midcapSharpe: panels.midcap.scaled.netSharpe > panels.midcap.flat.netSharpe,
    midcapBE: panels.midcap.scaled.breakEvenCostBps > panels.midcap.flat.breakEvenCostBps,
  };
  const nWins = Object.values(wins).filter(Boolean).length;
  check('e126: scaled-vs-flat comparison is measurable on majors full history',
    Number.isFinite(panels.majors.scaled.netSharpe) && Number.isFinite(panels.majors.scaled.breakEvenCostBps),
    'flatBE=' + panels.majors.flat.breakEvenCostBps.toFixed(1) + ' scaledBE=' + panels.majors.scaled.breakEvenCostBps.toFixed(1));
  check('e126: scaled-vs-flat comparison is measurable on the midcap window',
    Number.isFinite(panels.midcap.scaled.netSharpe) && Number.isFinite(panels.midcap.scaled.breakEvenCostBps),
    'flatBE=' + panels.midcap.flat.breakEvenCostBps.toFixed(1) + ' scaledBE=' + panels.midcap.scaled.breakEvenCostBps.toFixed(1));
  const verdict = nWins === 4 ? 'SUPPORTED' : 'NEGATIVE';
  const failed = checks.filter((c) => !c.pass);
  const pack = (s) => ({ netSharpe: s.netSharpe, breakEvenCostBps: s.breakEvenCostBps, turnover: s.turnover });
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: {
      verdict, wins,
      majors: { buckets: panels.majors.buckets, flat: pack(panels.majors.flat), scaled: pack(panels.majors.scaled) },
      midcap: { buckets: panels.midcap.buckets, flat: pack(panels.midcap.flat), scaled: pack(panels.midcap.scaled) },
      exploratorySlow: {
        majors: pack(panels.majorsSlow.scaled), midcap: pack(panels.midcapSlow.scaled),
        note: 'REG-90/clamp-[0.5,1.5], descriptive only — outside the pre-registered gate',
      },
    },
  };
}
