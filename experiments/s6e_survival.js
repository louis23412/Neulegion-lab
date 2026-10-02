// S6e — survival-cap run for the a=0.25 operating book (CYCLE-186 DESIGN, executed same cycle).
// Standalone: NOT in run_all.js. Read-only. Seconds via the harness.
//
// DESIGN (director). S6c decided interim operating L≤10 (judgment) with equity
// ≤ min($1.15M at L10, cap-implied), because vol-target L (25.6–27×) is a
// reference ceiling and the Sharpe never sees the cascade tail (D-20: crash-
// robustness is out-of-window — label it). S6e replaces judgment with measured
// survival bounds on the SAME blend (25% mid-band / 75% stacked-band):
//   (1) unit-gross equity diagnostics: maxDD, Calmar, longest-underwater, worst
//       single-bar loss (labels the tail the Sharpe hides).
//   (2) maxDD-based leverage: L_dd = tolerableDD / maxDD_unit at 20% (and 10%
//       variant) — the size at which the IN-WINDOW worst drawdown is survivable.
//   (3) governed path: fixed-point causal leverage L×g_t, g from the shipped
//       drawdownGovernor rule (sleeve/sizing.js, cap 5%) on the levered equity
//       — measures how much the tree's own crash brake cuts the DD at L=10.
//   (4) funding-spike stress (SYNTHETIC, labeled): worst-30-bar window returns
//       ×3, recompute DD at L — the spike shape 10s grounds qualitatively
//       (2608.03616/2607.27070/2606.15715/2602.15182); the ×3 is a stress
//       multiple, not a forecast.
//   (5) basis-gap ladder (SYNTHETIC, labeled): one-bar adverse gap G bps of
//       gross at leverage L ⇒ equity hit L×G; L_gap tables at G=50/100/150bps
//       for hit ≤5% — perps gap on listing/news; no gap in-window (D-20).
// DECISION (pre-registered form): operating L = min(L_dd20, L_gap5@100bps,
// L10-interim); governed DD reported alongside. PASS: legs reproduce banked to
// 1e-9; blend reproduces s6b to 1e-4; equity diagnostics finite; governed DD ≤
// ungoverned DD at L=10; stress tables complete.
import { parseSleeveInputs, parseMarksJson, scoreSleeve } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { worstBlock } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const REPO = 'src/NeuLegion-master/NeuLegion-master';
const PPY = 365 * 3;
const FEE = 4;
const MID = ['arbusdt', 'avaxusdt', 'injusdt', 'nearusdt', 'opusdt', 'seiusdt', 'suiusdt', 'tiausdt'];
const MAJ = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'adausdt', 'dogeusdt', 'linkusdt'];
const BANKED = {
    mid: { net: 8.561946528824238, to: 5.217419351971228, be: 69.62044793120769 },
    stk: { net: 9.503248111775504, to: 6.645113901372404, be: 60.06490814583304 },
};
const S6B = { net: 9.8717 };

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

const moments = (a) => {
    const m = a.reduce((x, v) => x + v, 0) / a.length;
    let s = 0;
    for (const v of a) s += (v - m) * (v - m);
    const sd = Math.sqrt(s / (a.length - 1));
    return { m, sd, sh: sd > 0 ? m / sd : 0 };
};

const leveredEquity = (net, L) => {
    const eq = new Array(net.length + 1);
    eq[0] = 1;
    for (let t = 0; t < net.length; t++) eq[t + 1] = eq[t] * (1 + L * net[t]);
    return eq;
};

const drawdownOf = (eq) => {
    let peak = eq[0], maxDD = 0, uw = 0, maxUW = 0;
    for (const e of eq) {
        if (e > peak) { peak = e; uw = 0; }
        else uw++;
        const dd = peak > 0 ? (peak - e) / peak : 0;
        if (dd > maxDD) maxDD = dd;
        if (uw > maxUW) maxUW = uw;
    }
    return { maxDD, maxUWbars: maxUW };
};

const governedEquity = (net, L, cap = 0.05) => {
    const eq = [1];
    let peak = 1;
    for (let t = 0; t < net.length; t++) {
        const dd = (peak - eq[t]) / peak;
        const g = Math.min(1, Math.max(0, 1 - dd / cap));
        eq.push(eq[t] * (1 + L * g * net[t]));
        if (eq[t + 1] > peak) peak = eq[t + 1];
    }
    return eq;
};

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });
    const band = { cap: 0.125, bandEps: 0.01 };
    const mid = await loadLeg(MID, 'marks_midcap_8h.json');
    const stk = await loadLeg([...MAJ, ...MID], 'marks_stacked16_8h.json');
    const mv = parseSleeveInputs({ ...mid });
    const sv = parseSleeveInputs({ ...stk });
    const ms = scoreSleeve('carry-dispersion', mv.view, { costBps: FEE, riskSpec: band });
    const ss = scoreSleeve('carry-dispersion', sv.view, { costBps: FEE, riskSpec: band });
    for (const [key, sc, b] of [['mid', ms, BANKED.mid], ['stk', ss, BANKED.stk]]) {
        const n = sc.netSharpe * Math.sqrt(PPY), to = sc.turnover * PPY / sc.net.length;
        check(`s6e: ${key} reproduces banked to 1e-9`,
            Math.abs(n - b.net) < 1e-9 && Math.abs(to - b.to) < 1e-9 && Math.abs(sc.breakEvenCostBps - b.be) < 1e-9,
            `net ${n.toFixed(6)} to ${to.toFixed(6)} be ${sc.breakEvenCostBps.toFixed(6)}`);
    }
    const net = ms.net.map((v, i) => 0.25 * v + 0.75 * ss.net[i]);
    const fullAnn = moments(net).sh * Math.sqrt(PPY);
    check('s6e: blend reproduces s6b a=0.25 to 1e-4', Math.abs(fullAnn - S6B.net) < 1e-4, `net ${fullAnn.toFixed(4)}`);
    const eq1 = leveredEquity(net, 1);
    const dd1 = drawdownOf(eq1);
    const worstBar = Math.min(...net);
    const annRet1 = (eq1[eq1.length - 1] - 1) / (net.length / PPY);
    const diag = {
        maxDD_unit: +dd1.maxDD.toFixed(5), calmar_unit: +(annRet1 / dd1.maxDD).toFixed(3),
        underwaterMax_bars: dd1.maxUWbars, worstBar_bps: +(worstBar * 1e4).toFixed(2),
    };
    check('s6e: unit equity diagnostics finite', [diag.maxDD_unit, diag.calmar_unit, diag.worstBar_bps].every(Number.isFinite), JSON.stringify(diag));
    const Ldd20 = 0.20 / dd1.maxDD, Ldd10 = 0.10 / dd1.maxDD;
    const wb = worstBlock(net) * Math.sqrt(PPY);
    const gov10 = drawdownOf(governedEquity(net, 10));
    const raw10 = drawdownOf(leveredEquity(net, 10));
    check('s6e: governor does not worsen in-window DD at L=10', gov10.maxDD <= raw10.maxDD + 1e-12,
        `governed ${(gov10.maxDD * 100).toFixed(2)}% vs raw ${(raw10.maxDD * 100).toFixed(2)}%`);
    let w0 = 0, wSum = -Infinity;
    for (let i = 0; i + 30 <= net.length; i++) {
        let s = 0;
        for (let k = 0; k < 30; k++) s += net[i + k];
        if (s < wSum || wSum === -Infinity) { wSum = s; w0 = i; }
    }
    const spiked = net.map((v, i) => (i >= w0 && i < w0 + 30 ? 3 * v : v));
    const spikeDD = drawdownOf(leveredEquity(spiked, 10)).maxDD;
    const spikeGovDD = drawdownOf(governedEquity(spiked, 10)).maxDD;
    const gap = {};
    for (const bps of [50, 100, 150]) {
        const G = bps / 1e4;
        gap[`L_gap5@${bps}bps`] = +(0.05 / G).toFixed(3);
    }
    const operating = Math.min(Ldd20, gap['L_gap5@100bps'], 10);
    const out = {
        pass: checks.every((c) => c.pass), checks,
        diagnostics: diag, worstBlockSharpe: +wb.toFixed(3),
        leverage: { Ldd20: +Ldd20.toFixed(3), Ldd10: +Ldd10.toFixed(3) },
        governedAtL10: { rawDD: +(raw10.maxDD * 100).toFixed(2), govDD: +(gov10.maxDD * 100).toFixed(2) },
        fundingSpike_x3_L10: { rawDD: +(spikeDD * 100).toFixed(2), govDD: +(spikeGovDD * 100).toFixed(2), synthetic: true },
        gapLadder: gap,
        decision: { operatingL: +operating.toFixed(3), rule: 'min(Ldd20, L_gap5@100bps, 10-interim)' },
    };
    check('s6e: stress tables complete', Number.isFinite(out.decision.operatingL) && Number.isFinite(spikeDD), JSON.stringify(out.decision));
    out.pass = checks.every((c) => c.pass);
    return out;
}
