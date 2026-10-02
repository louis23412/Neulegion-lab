// S6a — trailing-beta hedge overlay on the honest carry book (CYCLE-178).
// Standalone: NOT registered in run_all.js. Read-only (never writes the
// repo or the lab tree — the driver writes scratch/). Seconds to run.
//
// Context: every banked 118 lane reads neutralAnnual > netAnnual (+0.08 on
// mid-8, +0.45 on stacked-16). `neutral` is the FIRST-PC-HEDGED Sharpe of
// the same book (dependence/student.js: net − beta·PC1, full-sample beta),
// NOT an equal-weight portfolio — so the gap says the book's residual
// common-factor loading is dead weight, 5x more on the stacked book (the
// majors leg carries the loading; mid-8 is nearly factor-pure). The
// full-sample beta is lookahead, so the gap is an UPPER BOUND. This
// experiment prices the implementable version: trailing-window PC weights
// + trailing beta, with the hedge leg's own turnover costed at 4 bps.
//
// PASS (pre-registered): (1) all 4 lanes reproduce the banked operator
// reports to 1e-9 on netAnnual/turnoverAnnual/BE (same code + same data —
// a mismatch is itself a finding about tree drift); (2) the trailing hedge
// reports gross + net-of-hedge-cost Sharpes for W ∈ {270, 540} on
// stacked-band, stacked-flat, mid-band.
import { runSleeveReport, parseSleeveInputs, parseMarksJson, scoreSleeve } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { firstPCWeights } from '../../NeuLegion-master/NeuLegion-master/src/analysis/dependence.js';

const REPO = 'src/NeuLegion-master/NeuLegion-master';
const PPY = 365 * 3;
const MID = ['arbusdt', 'avaxusdt', 'injusdt', 'nearusdt', 'opusdt', 'seiusdt', 'suiusdt', 'tiausdt'];
const MAJ = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'dogeusdt', 'linkusdt'];
const STK = [...MAJ, ...MID];
const FEE = 4;

async function loadLeg(syms, marksFile) {
    const fundingTexts = [], candleTexts = [];
    for (const s of syms) {
        fundingTexts.push(await globalThis.__fs.readTextFile(`${REPO}/src/data/funding_${s}_8h.jsonl`));
        const name = s === 'btcusdt' ? 'candles.jsonl' : `candles_${s}_1h.jsonl`;
        try { candleTexts.push(await globalThis.__fs.readTextFile(`${REPO}/src/data/${name}`)); }
        catch { candleTexts.push(await globalThis.__fs.readTextFile(`${REPO}/src/${name}`)); }
    }
    const marksText = await globalThis.__fs.readTextFile(`${REPO}/src/data/${marksFile}`);
    return { fundingTexts, candleTexts, marksText, symbols: syms.map((s) => s.toUpperCase()) };
}

const sharpe = (a) => {
    const m = a.reduce((x, v) => x + v, 0) / a.length;
    let s = 0;
    for (const v of a) s += (v - m) * (v - m);
    const sd = Math.sqrt(s / (a.length - 1));
    return { m, sd, sh: sd > 0 ? m / sd : 0 };
};

// Trailing hedge: for each bar t >= W, PC weights + beta from [t-W, t),
// hedge position -beta*w in each panel leg; hedge turnover costed at FEE.
function trailingHedge(net, panel, W) {
    const n = net.length, k = panel.length;
    const hedged = new Array(n).fill(null);
    const pos = [];
    const betas = [];
    for (let t = W; t < n; t++) {
        const w = firstPCWeights(panel.map((s) => s.slice(t - W, t)));
        if (!w) { hedged[t] = net[t]; pos.push(new Array(k).fill(0)); betas.push(0); continue; }
        const ns = net.slice(t - W, t);
        const ms = ns.reduce((a, v) => a + v, 0) / W;
        const pc = [];
        for (let i = 0; i < W; i++) { let a = 0; for (let j = 0; j < k; j++) a += w[j] * panel[j][t - W + i]; pc.push(a); }
        const mp = pc.reduce((a, v) => a + v, 0) / W;
        let cov = 0, vp = 0;
        for (let i = 0; i < W; i++) { cov += (ns[i] - ms) * (pc[i] - mp); vp += (pc[i] - mp) * (pc[i] - mp); }
        const beta = vp > 0 ? cov / vp : 0;
        let pct = 0;
        for (let j = 0; j < k; j++) pct += w[j] * panel[j][t];
        hedged[t] = net[t] - beta * pct;
        pos.push(w.map((x) => -beta * x));
        betas.push(beta);
    }
    let to = 0;
    for (let i = 1; i < pos.length; i++)
        for (let j = 0; j < k; j++) to += Math.abs(pos[i][j] - pos[i - 1][j]);
    const scored = hedged.slice(W);
    const costBar = (FEE / 1e4) * to / scored.length;
    const g = sharpe(scored);
    const nn = scored.map((v) => v - costBar);
    const s = sharpe(nn);
    const bm = betas.reduce((a, v) => a + Math.abs(v), 0) / betas.length;
    let bv = 0;
    const mb = betas.reduce((a, v) => a + v, 0) / betas.length;
    for (const b of betas) bv += (b - mb) * (b - mb);
    return {
        W, bars: scored.length,
        grossSharpeAnn: g.sh * Math.sqrt(PPY), netSharpeAnn: s.sh * Math.sqrt(PPY),
        hedgeTurnoverAnnual: to * PPY / scored.length,
        meanAbsBeta: bm, betaSd: Math.sqrt(bv / (betas.length - 1)),
    };
}

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });
    const lanes = {};
    const banked = {
        midFlat: { net: 8.160848479077806, to: 11.088655786467793, be: 34.20574104469017 },
        midBand: { net: 8.561946528824238, to: 5.217419351971228, be: 69.62044793120769 },
        stkFlat: { net: 8.866763935338751, to: 17.261361029164174, be: 24.674401909336872 },
        stkBand: { net: 9.503248111775504, to: 6.645113901372404, be: 60.06490814583304 },
    };
    const defs = {
        midFlat: [MID, 'marks_midcap_8h.json', null],
        midBand: [MID, 'marks_midcap_8h.json', { cap: 0.125, bandEps: 0.01 }],
        stkFlat: [STK, 'marks_stacked16_8h.json', null],
        stkBand: [STK, 'marks_stacked16_8h.json', { cap: 0.125, bandEps: 0.01 }],
    };
    for (const [key, [syms, marksFile, riskSpec]] of Object.entries(defs)) {
        const leg = await loadLeg(syms, marksFile);
        const r = runSleeveReport({ sleeveId: 'carry-dispersion', costBps: FEE, riskSpec, ...leg });
        if (!r.available) { check(`s6a: ${key} available`, false, r.reason || ''); continue; }
        lanes[key] = { report: { netAnnual: r.netAnnual, turnoverAnnual: r.turnoverAnnual, breakEvenCostBps: r.breakEvenCostBps, neutralAnnual: r.neutralAnnual, streams: r.streams, buckets: r.buckets } };
        const b = banked[key];
        const match = Math.abs(r.netAnnual - b.net) < 1e-9 && Math.abs(r.turnoverAnnual - b.to) < 1e-9 && Math.abs(r.breakEvenCostBps - b.be) < 1e-9;
        check(`s6a: ${key} reproduces banked lane to 1e-9`, match,
            `net ${r.netAnnual.toFixed(6)} vs ${b.net.toFixed(6)}, to ${r.turnoverAnnual.toFixed(6)}, be ${r.breakEvenCostBps.toFixed(6)}`);
    }
    const hedges = {};
    for (const key of ['stkBand', 'stkFlat', 'midBand']) {
        const [syms, marksFile, riskSpec] = defs[key];
        const leg = await loadLeg(syms, marksFile);
        const { view } = parseSleeveInputs({ fundingTexts: leg.fundingTexts, candleTexts: leg.candleTexts, marks: parseMarksJson(leg.marksText), symbols: leg.symbols });
        const scored = scoreSleeve('carry-dispersion', view, { costBps: FEE, riskSpec });
        if (!scored.available) { check(`s6a: ${key} direct score available`, false, scored.reason || ''); continue; }
        const panel = view.fRate[0].map((_, j) => view.fRate.map((row, i) => row[j] + (view.basisPnl[i][j] === null ? 0 : view.basisPnl[i][j])));
        hedges[key] = { W270: trailingHedge(scored.net, panel, 270), W540: trailingHedge(scored.net, panel, 540) };
        check(`s6a: ${key} trailing hedge scored`, true,
            `book ${lanes[key].report.netAnnual.toFixed(2)}/neutral ${lanes[key].report.neutralAnnual.toFixed(2)} | ` +
            `W270 net ${hedges[key].W270.netSharpeAnn.toFixed(2)} (hto ${hedges[key].W270.hedgeTurnoverAnnual.toFixed(1)}) | ` +
            `W540 net ${hedges[key].W540.netSharpeAnn.toFixed(2)} (hto ${hedges[key].W540.hedgeTurnoverAnnual.toFixed(1)})`);
    }
    const pass = checks.every((c) => c.pass);
    return { pass, checks, lanes, hedges };
}
