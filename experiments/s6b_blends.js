// S6b — static blends over the D-14 frontier (CYCLE-179 DESIGN, executed same cycle).
// Standalone: NOT in run_all.js. Read-only. Seconds via the harness.
//
// DESIGN (director). Universe: the two band lanes ONLY — they pairwise-
// dominate the flat lanes on net AND BE (midBand 8.56/69.6 > midFlat
// 8.16/34.2; stkBand 9.50/60.1 > stkFlat 8.87/24.7), so flat lanes are
// excluded by dominance, documented here. Instrument: static capital blend
// a·midBand + (1-a)·stkBand — static, so NO rebalance turnover exists and
// blend turnover/gross are exact linear mixes of the legs' scored series
// (both already net of their own 4 bps costs). Grid a ∈ {0,.25,.5,.75,1}.
// Per blend: netAnn, turnoverAnnual, BE (exact from series), worstBlock,
// split halves, DSR (adjusted + design effect), yearly slope.
// Time grids must be IDENTICAL (both 2465 bars) or the blend FAILS with
// the reason (never silently intersect).
// PASS (pre-registered): table complete for all 5 blends AND the two
// operating-point queries answered honestly: max-net-at-BE≥55 and
// max-BE-at-net≥9.0 (an "unsatisfiable" answer counts if true). The
// director picks the operating blend afterwards — this experiment does
// not choose.
import { parseSleeveInputs, parseMarksJson, scoreSleeve } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { sleeveDsr, sleeveYearly } from '../../NeuLegion-master/NeuLegion-master/src/sleeve/evidence.js';
import { worstBlock } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const REPO = 'src/NeuLegion-master/NeuLegion-master';
const PPY = 365 * 3;
const FEE = 4;
const MID = ['arbusdt', 'avaxusdt', 'injusdt', 'nearusdt', 'opusdt', 'seiusdt', 'suiusdt', 'tiausdt'];
const MAJ = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'dogeusdt', 'linkusdt'];

async function loadLeg(syms, marksFile) {
    const fundingTexts = [], candleTexts = [];
    for (const s of syms) {
        fundingTexts.push(await globalThis.__fs.readTextFile(`${REPO}/src/data/funding_${s}_8h.jsonl`));
        const name = s === 'btcusdt' ? 'candles.jsonl' : `candles_${s}_1h.jsonl`;
        try { candleTexts.push(await globalThis.__fs.readTextFile(`${REPO}/src/data/${name}`)); }
        catch { candleTexts.push(await globalThis.__fs.readTextFile(`${REPO}/src/${name}`)); }
    }
    const marksText = await globalThis.__fs.readTextFile(`${REPO}/src/data/${marksFile}`);
    return { fundingTexts, candleTexts, marks: parseMarksJson(marksText), symbols: syms.map((s) => s.toUpperCase()) };
}

const sharpe = (a) => {
    const m = a.reduce((x, v) => x + v, 0) / a.length;
    let s = 0;
    for (const v of a) s += (v - m) * (v - m);
    const sd = Math.sqrt(s / (a.length - 1));
    return sd > 0 ? m / sd : 0;
};

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });
    const mid = await loadLeg(MID, 'marks_midcap_8h.json');
    const stk = await loadLeg([...MAJ, ...MID], 'marks_stacked16_8h.json');
    const band = { cap: 0.125, bandEps: 0.01 };
    const mv = parseSleeveInputs({ ...mid });
    const sv = parseSleeveInputs({ ...stk });
    const ms = scoreSleeve('carry-dispersion', mv.view, { costBps: FEE, riskSpec: band });
    const ss = scoreSleeve('carry-dispersion', sv.view, { costBps: FEE, riskSpec: band });
    check('s6b: both band legs score', ms.available && ss.available, `mid n=${ms.net?.length} stk n=${ss.net?.length}`);
    if (!ms.available || !ss.available) return { pass: false, checks, blends: null };
    const mt = mv.view.times.slice(1, 1 + ms.net.length);
    const st = sv.view.times.slice(1, 1 + ss.net.length);
    const aligned = mt.length === st.length && mt.every((t, i) => t === st[i]);
    check('s6b: time grids identical (no silent intersect)', aligned, `lengths ${mt.length}/${st.length}`);
    if (!aligned) return { pass: false, checks, blends: null };
    const blends = {};
    for (const a of [0, 0.25, 0.5, 0.75, 1]) {
        const b = 1 - a;
        const net = ms.net.map((v, i) => a * v + b * ss.net[i]);
        const gross = ms.gross.map((v, i) => a * v + b * ss.gross[i]);
        const to = a * ms.turnover + b * ss.turnover;
        const sg = gross.reduce((x, v) => x + v, 0);
        const dsr = sleeveDsr({ net });
        const yr = sleeveYearly({ net, times: mt });
        const h = Math.floor(net.length / 2);
        blends[`a${a}`] = {
            aMid: a,
            netAnnual: +(sharpe(net) * Math.sqrt(PPY)).toFixed(4),
            turnoverAnnual: +(to * PPY / net.length).toFixed(4),
            breakEvenCostBps: +(1e4 * sg / to).toFixed(4),
            worstBlock: +worstBlock(net).toFixed(4),
            halfFirst: +sharpe(net.slice(0, h)).toFixed(4),
            halfSecond: +sharpe(net.slice(h)).toFixed(4),
            dsrAdjusted: dsr.available ? +dsr.dsrAdjusted.toFixed(6) : null,
            designEffect: dsr.available ? +dsr.designEffect.toFixed(3) : null,
            yearlySlope: yr.available ? +yr.slope.toFixed(4) : null,
        };
    }
    check('s6b: 5-blend table complete', Object.keys(blends).length === 5, JSON.stringify(Object.values(blends).map((x) => [x.netAnnual, x.breakEvenCostBps])));
    const rows = Object.values(blends);
    const atBE55 = rows.filter((r) => r.breakEvenCostBps >= 55).sort((x, y) => y.netAnnual - x.netAnnual)[0] || null;
    const atNet9 = rows.filter((r) => r.netAnnual >= 9.0).sort((x, y) => y.breakEvenCostBps - x.breakEvenCostBps)[0] || null;
    check('s6b: max-net-at-BE≥55 identified', true, atBE55 ? `a=${atBE55.aMid} net=${atBE55.netAnnual} BE=${atBE55.breakEvenCostBps}` : 'UNSATISFIABLE on grid');
    check('s6b: max-BE-at-net≥9.0 identified', true, atNet9 ? `a=${atNet9.aMid} net=${atNet9.netAnnual} BE=${atNet9.breakEvenCostBps}` : 'UNSATISFIABLE on grid');
    return { pass: checks.every((c) => c.pass), checks, blends, operating: { atBE55: atBE55?.aMid ?? null, atNet9: atNet9?.aMid ?? null } };
}
