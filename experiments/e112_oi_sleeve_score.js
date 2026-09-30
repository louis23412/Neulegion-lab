// E112 - THE POSITIONING SLEEVES THROUGH THE REPO PATH ON REAL DATA.
// Round-80 AI-side gate for TODO 110: do `oi-change` and `toptrader-fade`
// reproduce their lab levels through `runSleeveReport` (vendored oi_8h.json,
// funding + 1h candles as text) before any native gate run.
//
// Pre-registered expectations (from FINDINGS):
//   oi-change (F-45/F-46): weak/churny standalone, net@4 +0.5..+0.7,
//     turnover ~200-350/yr, break-even 8.9-14.7 bps, corr ~0 with carry.
//   toptrader-fade (F-40/F-51): pinned ewma 0.05 + cap 12.5%, net@4 ~1.14,
//     turnover ~8/yr, break-even ~180 bps.
// PASS iff all checks below hold. Levels are recorded, never gated into G5
// (G5 needs the operator native run + decay/unseen attestations).

import { SYMBOLS } from '../lib/lab.js';
import { runSleeveReport, formatSleeveReport } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';

const REPO = 'src/NeuLegion-master/NeuLegion-master';
const SYMS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','LINKUSDT'];

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
  check('e112: all 8 funding + candle texts + OI loaded',
    fundingTexts.length===8 && candleTexts.every(t=>t.length>1000) && oiText.length>100000,
    'funding 8, candles '+candleTexts.filter(t=>t.length>1000).length+'/8, oi '+oiText.length+' chars');
  const oi = runSleeveReport({ sleeveId:'oi-change', fundingTexts, candleTexts, costBps:4, symbols:SYMS, oiText });
  const top = runSleeveReport({ sleeveId:'toptrader-fade', fundingTexts, candleTexts, costBps:4, symbols:SYMS, oiText });
  check('e112: oi-change available on the 6606x8 grid', oi.available===true && oi.buckets===6606 && oi.streams===8, oi.reason||('buckets='+oi.buckets));
  check('e112: toptrader-fade available on the 6606x8 grid', top.available===true && top.buckets===6606 && top.streams===8, top.reason||('buckets='+top.buckets));
  if (oi.available===true) {
    check('e112: oi net@4 in the F-45 band', oi.netAnnual>0.4 && oi.netAnnual<1.0, 'net='+oi.netAnnual.toFixed(3));
    check('e112: oi turnover churny', oi.turnoverAnnual>100 && oi.turnoverAnnual<400, 'turn='+oi.turnoverAnnual.toFixed(1)+'/yr');
    check('e112: oi break-even clears a fee', oi.breakEvenCostBps>8 && oi.breakEvenCostBps<16, 'be='+oi.breakEvenCostBps.toFixed(2)+' bps');
    check('e112: oi coverage documents the late start', oi.oi.coverageOiVal>0.8 && oi.oi.coverageTopLS>0.6, 'oiVal='+(100*oi.oi.coverageOiVal).toFixed(1)+'% topLS='+(100*oi.oi.coverageTopLS).toFixed(1)+'%');
    check('e112: oi shows no decay (slope + first-last)', oi.yearly.available===true && oi.yearly.slope>-0.02 && oi.firstLast.available===true && oi.firstLast.diff>-0.05, 'slope='+Number(oi.yearly.slope).toFixed(3)+' first-last='+Number(oi.firstLast.diff).toFixed(3));
    check('e112: oi DSR reported below the floor (weak sleeve)', oi.dsr.available===true && oi.dsr.dsrAdjusted<0.95, 'dsr='+Number(oi.dsr.dsrAdjusted).toFixed(4));
  }
  if (top.available===true) {
    check('e112: fade net@4 near F-51', top.netAnnual>0.8 && top.netAnnual<1.4, 'net='+top.netAnnual.toFixed(3));
    check('e112: fade turnover low', top.turnoverAnnual<15, 'turn='+top.turnoverAnnual.toFixed(2)+'/yr');
    check('e112: fade break-even huge', top.breakEvenCostBps>100, 'be='+top.breakEvenCostBps.toFixed(1)+' bps');
    check('e112: fade DSR passes', top.dsr.available===true && top.dsr.dsrAdjusted>=0.95, 'dsr='+Number(top.dsr.dsrAdjusted).toFixed(4));
    check('e112: fade shows no decay', top.yearly.available===true && top.yearly.slope>-0.02, 'slope='+Number(top.yearly.slope).toFixed(3));
  }
  const to = oi.available===true ? formatSleeveReport(oi) : '';
  const tt = top.available===true ? formatSleeveReport(top) : '';
  check('e112: formatters name the sleeves + G5 line', to.includes('oi-change') && to.includes('G5 verdict') && tt.includes('toptrader-fade') && tt.includes('G5 verdict'), (to.split('\n')[0]||'')+' / '+(tt.split('\n')[0]||''));
  const failed = checks.filter(c=>!c.pass);
  return { config:{}, repo: {
    oi: oi.available===true ? { buckets:oi.buckets, net4:+oi.netAnnual.toFixed(3), turn:+oi.turnoverAnnual.toFixed(2), be:+oi.breakEvenCostBps.toFixed(2), dsr:+Number(oi.dsr.dsrAdjusted).toFixed(4), slope:+Number(oi.yearly.slope).toFixed(4) } : { reason: oi.reason },
    top: top.available===true ? { buckets:top.buckets, net4:+top.netAnnual.toFixed(3), turn:+top.turnoverAnnual.toFixed(2), be:+top.breakEvenCostBps.toFixed(1), dsr:+Number(top.dsr.dsrAdjusted).toFixed(4), slope:+Number(top.yearly.slope).toFixed(4) } : { reason: top.reason } },
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length===0 };
}
