// E113 - POSITIONING-SLEEVE FOLLOW-UPS THROUGH THE REPO PATH ON REAL DATA.
// Round-82 edge expansion (lab-only, no repo change): three screens the
// native gate (TODO 110) left open —
//   (a) cost ladder: oi-change (BE 11.4) should die between 8-16 bps while
//       toptrader-fade (BE 185) survives everything;
//   (b) carry x fade composite: both sleeves have edge (carry honest 6.25,
//       fade 1.05) — if their net series are ~uncorrelated on aligned bars,
//       an equal blend diversifies (the F-122 anti-case: zero edge there);
//   (c) fade sizing: does adaptive/drawdown vol-targeting buy anything on a
//       book that already turns only 7.9x/yr (cf F-119: sizing holds level) ?
// Pre-registered: (a) oi net@8 > 0 > oi net@16, fade net@16 > 0.8;
// (b) |corr| <= 0.3 on earn-time-aligned bars; (c) recorded, never gated.
// PASS iff the structural checks hold; the verdict row carries SUPPORTED /
// MIXED / NEGATIVE honestly from the numbers.

import { SYMBOLS } from '../lib/lab.js';
import { runSleeveReport } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { parseSleeveInputs, parseOiJson } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/view.js';
import { scoreSleeve } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/scoring.js';

const REPO = 'src/NeuLegion-master/NeuLegion-master';
const SYMS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','LINKUSDT'];
const LADDER = [0, 1, 2, 4, 8, 16];
const ANN = Math.sqrt(365 * 3);

function sharpe(xs) {
  let m = 0; for (const x of xs) m += x; m /= xs.length;
  let v = 0; for (const x of xs) v += (x - m) * (x - m); v /= xs.length;
  return v > 0 ? m / Math.sqrt(v) : 0;
}

function pearson(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) * (a[i] - ma); sbb += (b[i] - mb) * (b[i] - mb); }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
}

export async function run() {
  const checks = [];
  const check = (name, pass, detail='') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const fundingTexts = []; const candleTexts = [];
  for (const s of SYMBOLS) {
    fundingTexts.push(await globalThis.__fs.readTextFile(REPO + '/src/data/funding_' + s + '_8h.jsonl'));
    const name = s === 'btcusdt' ? 'candles.jsonl' : 'candles_' + s + '_1h.jsonl';
    try { candleTexts.push(await globalThis.__fs.readTextFile(REPO + '/src/data/' + name)); }
    catch { candleTexts.push(await globalThis.__fs.readTextFile(REPO + '/src/' + name)); }
  }
  const oiText = await globalThis.__fs.readTextFile(REPO + '/src/data/oi_8h.json');
  check('e113: inputs loaded', fundingTexts.length===8 && candleTexts.every(t=>t.length>1000) && oiText.length>100000, 'oi '+oiText.length+' chars');

  const ladder = { oi: {}, fade: {} };
  for (const bps of LADDER) {
    const oi = runSleeveReport({ sleeveId:'oi-change', fundingTexts, candleTexts, costBps:bps, symbols:SYMS, oiText });
    const fade = runSleeveReport({ sleeveId:'toptrader-fade', fundingTexts, candleTexts, costBps:bps, symbols:SYMS, oiText });
    if (oi.available === true) ladder.oi[bps] = +oi.netAnnual.toFixed(3);
    if (fade.available === true) ladder.fade[bps] = +fade.netAnnual.toFixed(3);
  }
  check('e113: ladder scored all six rungs both sleeves',
    Object.keys(ladder.oi).length===6 && Object.keys(ladder.fade).length===6,
    'oi ['+LADDER.map(b=>ladder.oi[b]).join(',')+'] fade ['+LADDER.map(b=>ladder.fade[b]).join(',')+']');
  check('e113: oi dies between 8 and 16 bps (BE 11.4)',
    ladder.oi[8] > 0 && ladder.oi[16] < 0, 'net@8='+ladder.oi[8]+' net@16='+ladder.oi[16]);
  check('e113: fade survives the whole ladder (BE 185)',
    LADDER.every(b=>ladder.fade[b] > 0.8), 'net@16='+ladder.fade[16]);
  check('e113: ladders monotone non-increasing in cost',
    LADDER.every((b,i)=>i===0 || (ladder.oi[b]<=ladder.oi[LADDER[i-1]] && ladder.fade[b]<=ladder.fade[LADDER[i-1]])),
    'cost drag monotone');

  const oiParsed = parseSleeveInputs({ fundingTexts, candleTexts, gridMs: 28800000, barMs: 3600000, marks: null, symbols: SYMS, oi: parseOiJson(oiText) });
  const carryParsed = parseSleeveInputs({ fundingTexts, candleTexts, gridMs: 28800000, barMs: 3600000, marks: null, symbols: null, oi: null });
  check('e113: both views share the 6606-bucket grid', oiParsed.buckets===6606 && carryParsed.buckets===6606, oiParsed.buckets+'/'+carryParsed.buckets);
  const fadeBook = scoreSleeve('toptrader-fade', oiParsed.view, { costBps: 4 });
  const carryBook = scoreSleeve('carry-dispersion', carryParsed.view, { costBps: 4 });
  check('e113: both books scored', fadeBook.available===true && carryBook.available===true, (fadeBook.reason||'fade ok')+' / '+(carryBook.reason||'carry ok'));
  let comp = null;
  const fadeTimes = Array.isArray(fadeBook.earnTimes) ? fadeBook.earnTimes : oiParsed.view.times.slice(1, 1 + fadeBook.net.length);
  const carryTimes = Array.isArray(carryBook.earnTimes) ? carryBook.earnTimes : carryParsed.view.times.slice(1, 1 + carryBook.net.length);
  if (fadeBook.available===true && carryBook.available===true) {
    const idx = new Map(fadeTimes.map((t,i)=>[t,i]));
    const pairs = [];
    for (let i = 0; i < carryTimes.length && i < carryBook.net.length; i++) {
      const j = idx.get(carryTimes[i]);
      if (j !== undefined && j < fadeBook.net.length) pairs.push([carryBook.net[i], fadeBook.net[j]]);
    }
    check('e113: earn-time alignment covers the overlap', pairs.length > 4000, pairs.length+' aligned bars');
    if (pairs.length > 4000) {
      const cn = pairs.map(p=>p[0]); const fn = pairs.map(p=>p[1]);
      const corr = pearson(cn, fn);
      const vol = (xs) => { const m = xs.reduce((a,b)=>a+b,0)/xs.length; return Math.sqrt(xs.reduce((a,b)=>a+(b-m)*(b-m),0)/xs.length); };
      const vc = vol(cn); const vf = vol(fn);
      const blend = pairs.map(p=>0.5*p[0]+0.5*p[1]);
      const rp = pairs.map(p=>0.5*p[0]/vc+0.5*p[1]/vf);
      const sC = sharpe(cn) * ANN; const sF = sharpe(fn) * ANN; const sB = sharpe(blend) * ANN; const sR = sharpe(rp) * ANN;
      comp = { bars: pairs.length, corr: +corr.toFixed(4), carryAnn: +sC.toFixed(3), fadeAnn: +sF.toFixed(3), blendAnn: +sB.toFixed(3), rpBlendAnn: +sR.toFixed(3), carryVol: +vc.toExponential(3), fadeVol: +vf.toExponential(3) };
      check('e113: all series finite', Number.isFinite(corr) && Number.isFinite(sB) && Number.isFinite(sR), 'corr='+corr.toFixed(3)+' naive='+sB.toFixed(3)+' rp='+sR.toFixed(3));
      check('e113: carry x fade ~uncorrelated (|corr| <= 0.3)', Math.abs(corr) <= 0.3, 'corr='+corr.toFixed(3));
      check('e113: naive 50/50 net blend recorded (vol-mismatch screen)', Number.isFinite(sB), 'naive='+sB.toFixed(3)+' (carryVol='+vc.toExponential(2)+' fadeVol='+vf.toExponential(2)+')');
      check('e113: risk-parity blend recorded (dilution screen)', Number.isFinite(sR), 'rp='+sR.toFixed(3)+' vs best leg '+Math.max(sC,sF).toFixed(3)+' (a 9.4/1.1 pair cannot blend up)');
    }
  }

  const fadeAdapt = runSleeveReport({ sleeveId:'toptrader-fade', fundingTexts, candleTexts, costBps:4, symbols:SYMS, oiText, sizingTarget:'adaptive' });
  const fadeDd = runSleeveReport({ sleeveId:'toptrader-fade', fundingTexts, candleTexts, costBps:4, symbols:SYMS, oiText, sizingTarget:'drawdown' });
  const sized = {};
  if (fadeAdapt.sized && fadeAdapt.sized.available === true) sized.adaptive = { net: +fadeAdapt.sized.netAnnual.toFixed(3), turn: +fadeAdapt.sized.turnoverAnnual.toFixed(2) };
  if (fadeDd.sized && fadeDd.sized.available === true) sized.drawdown = { net: +fadeDd.sized.netAnnual.toFixed(3), turn: +fadeDd.sized.turnoverAnnual.toFixed(2) };
  check('e113: fade sizing paths score', !!sized.adaptive && !!sized.drawdown, JSON.stringify(sized));
  if (sized.adaptive) check('e113: fade sizing recorded vs flat 1.054', Number.isFinite(sized.adaptive.net), 'adaptive net='+sized.adaptive.net);

  const failed = checks.filter(c=>!c.pass);
  return { config:{ ladder: LADDER }, repo: { ladder, comp, sized, fadeFlat: ladder.fade[4], oiFlat: ladder.oi[4] },
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length===0 };
}
