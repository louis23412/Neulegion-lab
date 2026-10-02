// S6c — sizing prescription for the a=0.25 operating book (CYCLE-181 DESIGN, executed same cycle).
// Standalone: NOT in run_all.js. Read-only. Seconds via the harness.
//
// DESIGN (director). The Blend a=0.25 (25% mid-band / 75% stacked-band) is
// decided (S6b: net 9.87, BE 62.0, worstBlock 0.141). Sizing answers: what
// leverage at what forward assumption, capped by what dollars.
//   (1) Forward scenarios in annualized Sharpe: FULL (full-sample 9.87),
//       RECENT (second-half Sharpe — the seasonally-balanced halves-primary
//       read from D-18), STRESS (worstBlock — the weakest sixth).
//   (2) Target-risk leverage L = targetVol / annVol at 10% and 15% vol
//       targets, under FULL and RECENT vol (vol = per-bar std × sqrt(PPY),
//       per unit gross — the book is ~unit-gross dollar-neutral).
//   (3) Dollar cap rule: gross exposure ≤ $11.5M (pinned spec neverBreach,
//       D-20) ⇒ max equity = 11.5e6 / L; plus an OI-file coverage diagnostic
//       (which of the 16 symbols the repo OI file covers — the F-42
//       schedule upgrade needs it; this experiment does NOT build it).
// Pricings applied (10r, qualitative — no order-book data in-repo): SaR
// (2603.09164) frames the liquidity limit, perp-liquidation (2601.10812)
// the 5%-of-OI position rule (F-41), collateral control (2605.05089) the
// spot-leg deployment caveat. They shape the cap rule, not a number here.
// PASS (pre-registered): legs reproduce banked lanes to 1e-9; blend
// reproduces s6b a=0.25 to 1e-4; scenario table complete; L reported at
// 10%/15% under FULL+RECENT vol; cap rule + OI coverage recorded.
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
const S6B = { net: 9.8717, be: 62.047 };

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
        check(`s6c: ${key} reproduces banked to 1e-9`,
            Math.abs(n - b.net) < 1e-9 && Math.abs(to - b.to) < 1e-9 && Math.abs(sc.breakEvenCostBps - b.be) < 1e-9,
            `net ${n.toFixed(6)} to ${to.toFixed(6)} be ${sc.breakEvenCostBps.toFixed(6)}`);
    }
    const A = 0.25, B = 0.75;
    const net = ms.net.map((v, i) => A * v + B * ss.net[i]);
    const full = moments(net);
    const fullAnn = full.sh * Math.sqrt(PPY);
    check('s6c: blend reproduces s6b a=0.25 to 1e-4', Math.abs(fullAnn - S6B.net) < 1e-4, `net ${fullAnn.toFixed(4)} vs ${S6B.net}`);
    const h = Math.floor(net.length / 2);
    const recent = moments(net.slice(h));
    const recentAnn = recent.sh * Math.sqrt(PPY);
    const wb = worstBlock(net);
    const stressAnn = wb * Math.sqrt(PPY);
    const scenarios = {
        FULL: +fullAnn.toFixed(3), RECENT: +recentAnn.toFixed(3), STRESS: +stressAnn.toFixed(3),
        annVolFull: +(full.sd * Math.sqrt(PPY)).toFixed(4), annVolRecent: +(recent.sd * Math.sqrt(PPY)).toFixed(4),
    };
    check('s6c: scenario table complete (FULL>RECENT>STRESS, all positive)',
        scenarios.FULL > scenarios.RECENT && scenarios.RECENT > scenarios.STRESS && scenarios.STRESS > 0,
        `FULL ${scenarios.FULL} RECENT ${scenarios.RECENT} STRESS ${scenarios.STRESS}`);
    const lev = {};
    for (const t of [0.10, 0.15]) {
        lev[`L${t * 100}pct_fullVol`] = +(t / scenarios.annVolFull).toFixed(3);
        lev[`L${t * 100}pct_recentVol`] = +(t / scenarios.annVolRecent).toFixed(3);
    }
    const capRule = {};
    for (const [k, L] of Object.entries(lev)) capRule[k] = { leverage: L, maxEquityAt11p5M: Math.floor(11.5e6 / L) };
    check('s6c: leverage finite and cap rule stated', Object.values(lev).every(Number.isFinite), JSON.stringify(lev));
    let oiCov = null;
    try {
        const oi = JSON.parse(await globalThis.__fs.readTextFile(`${REPO}/src/data/oi_8h.json`));
        const keys = oi.symbols ? Object.keys(oi.symbols) : Object.keys(oi).filter((k) => !['builtAt', 'scale', 'convention', 'source'].includes(k));
        const want = [...MAJ, ...MID].map((s) => s.toUpperCase());
        const lk = keys.map((k) => String(k).toUpperCase());
        oiCov = { keys: keys.length, covered16: want.filter((w) => lk.some((k) => k.includes(w))).length };
        check('s6c: OI coverage diagnostic', true, `${oiCov.covered16}/16 symbols, ${oiCov.keys} keys`);
    } catch (e) { check('s6c: OI coverage diagnostic', false, String(e).slice(0, 120)); oiCov = { error: 'unreadable' }; }
    return { pass: checks.every((c) => c.pass), checks, scenarios, leverage: lev, capRule, oiCoverage: oiCov };
}
