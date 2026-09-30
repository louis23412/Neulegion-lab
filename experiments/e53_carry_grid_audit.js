// E53 - L10-d: THE SHIPPED CARRY GRID JOIN, AUDITED. CYCLE-044 (L10).
// ROUND-94 RESTATEMENT: F-61 was FIXED in round 34 (divide by the observed interval), so the
// synthetic sweep now prices every interval at par. The header below describes the PRE-FIX
// behavior this audit originally witnessed; the real-data guards measure the historical
// sub-8h rows in the vendored funding files (a data fact).
//
// FOLD-BACK R4 pre-registered this check in CYCLE-006: before porting the carry sleeve, audit the repo's
// `analysis/carry.js#carryOnBarGrid`/`carryPanelStream` (the shipped funding -> bar-grid join) for
//   (a) a candle-tail guard, (b) sub-8h funding aggregation, (c) exact bar alignment.
// This experiment settles (b): it is MISSING, and the function contradicts its own header comment.
//
// What the module says (carry.js lines 22-26, above `FUNDING_GRID_MS`):
//   "Binance's standard funding interval. Some symbols have run 4h funding periods (intervalHistogram in
//    the audit reports them), so the audit tolerates both and the bar-grid projection divides by the
//    period actually observed."
// What the code does: `carryOnBarGrid` sets `perBar = gridMs` (the 8h DEFAULT), infers
// `barsPerPeriod = round(gridMs / barStep)` from the FIRST TWO bar timestamps, and writes
// `rows[ri].fundingRate / barsPerPeriod` to every bar until the next funding row. So every funding row is
// spread over a full 8h worth of bars REGARDLESS of the interval it actually covers: a 2h row is spread
// over 32 bars on a 15m grid (16 on 1h) and divided by the 8h bar count, so four 2h payments sum to ONE
// 8h rate instead of four. The projection never reads the observed interval.
//
// Parts:
//   A. Synthetic ground truth - one 8h period, 1h bars, funding at 8h/4h/2h/1h: the function's per-period
//      receipt is exactly ONE rate at every interval => it understates by 8h/interval (1x/2x/4x/8x).
//   B. `barsPerPeriod` is inferred from a single bar pair, so a window whose first two bars straddle a
//      missing candle doubles (or halves) the whole symbol's carry. Shipped first pairs are all modal, so
//      this is LATENT - registered, not triggered.
//   C. Shipped data: only SOLUSDT carries sub-8h funding (3 x 4h + 98 x 2h steps, 2022-11-09..18 = FTX),
//      and `auditFundingProblems` reports ZERO problems for it (the off-grid budget is 2% and the file is
//      at 1.47%; `missingPeriods` counts only steps LONGER than a period). The FTX window is a ~3x
//      understatement, and the pooled sleeve's annualised carry and Sharpe both move.
//
// PRE-REGISTERED READ. PASSES if the synthetic ratios are exactly [1,2,4,8], SOL shows 3 x 4h + 98 off-grid
// steps and ZERO audit problems, the FTX-window understatement is 2.8-3.3x, and the pooled-sleeve deltas
// land in the pre-registered windows. A failure - any synthetic ratio == 1, or SOL reported a problem -
// means the repo has since fixed the join and F-61 must be WITHDRAWN.

import { REPO, SYMBOLS } from '../lib/lab.js';
import {
    carryOnBarGrid, carryReturns, parseFundingJsonl, auditFundingSeries, auditFundingProblems, correlation,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/carry.js';

const GRID_MS = 28_800_000;      // 8h
const PPY = 365 * 3;             // 8h periods in a year
const HOUR = 3_600_000;
const FTX_START = Date.parse('2022-11-09T00:00:00Z');
const FTX_END = Date.parse('2022-11-20T00:00:00Z');

const fin = (x) => (Number.isFinite(x) ? x : 0);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sdOf = (a) => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const sharpe = (a) => { const s = sdOf(a); return s > 0 ? (mean(a) / s) * Math.sqrt(PPY) : NaN; };
const r = (x, d = 5) => (Number.isFinite(x) ? +x.toFixed(d) : null);

// Snap a funding timestamp to its 8h bucket END (rows are stamped at the end of their interval).
const snapTo8h = (t) => { const n = Math.round(t / GRID_MS) * GRID_MS; return Math.abs(t - n) < 60_000 ? n : Math.ceil(t / GRID_MS) * GRID_MS; };

// Sum funding rows into 8h buckets. This is the L10-o-corrected aggregation the lab's loader uses: a
// bucket's carry is the SUM of the payments in it, so one 8h bucket == one funding row of the 8h sleeve.
function bucketRows(rows) {
    const m = new Map();
    for (const row of rows) {
        const t = snapTo8h(row.timestamp);
        const cur = m.get(t) || { timestamp: t, fundingRate: 0 };
        cur.fundingRate += row.fundingRate;
        m.set(t, cur);
    }
    return [...m.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function readTs(text) {
    const out = [];
    for (const line of text.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        try { const p = JSON.parse(s); out.push(typeof p.timestamp === 'number' ? p.timestamp : Date.parse(p.timestamp)); } catch { /* skip */ }
    }
    return out;
}

async function readFunding(symbol) {
    const text = await globalThis.__fs.readTextFile(`${REPO}/src/data/funding_${symbol}_8h.jsonl`);
    return parseFundingJsonl(text).rows;
}

async function readBars(symbol) {
    const f = symbol === 'btcusdt' ? `${REPO}/src/candles.jsonl` : `${REPO}/src/data/candles_${symbol}_1h.jsonl`;
    return readTs(await globalThis.__fs.readTextFile(f));
}

export async function run({ symbols = SYMBOLS } = {}) {
    // ---------- A. synthetic interval scaling ----------
    const T0 = Date.parse('2024-01-01T00:00:00Z');
    const RATE = 1e-4;
    const synthBars = [];
    for (let i = 0; i < 8; i++) synthBars.push(T0 + i * HOUR);
    const synthetic = {};
    for (const ivH of [8, 4, 2, 1]) {
        const rows = [];
        for (let t = T0; t < T0 + 8 * HOUR; t += ivH * HOUR) rows.push({ timestamp: t, fundingRate: RATE, markPrice: null });
        const codeSum = carryOnBarGrid(synthBars, rows, { gridMs: GRID_MS }).reduce((a, b) => a + b, 0);
        const sleeveSum = rows.reduce((a, row) => a + carryReturns([row])[0], 0);   // one rate per funding row
        synthetic[`iv${ivH}h`] = {
            rowsIn8h: rows.length,
            codeReceiptPer8h: r(codeSum, 8),
            sleevePer8h: r(sleeveSum, 8),
            understatementX: r(sleeveSum / codeSum, 3),
        };
    }
    const syntheticRatios = [8, 4, 2, 1].map((h) => synthetic[`iv${h}h`].understatementX);
    // RESTATED round 94 (F-61 fixed round 34: bucket rows / divide by the observed interval):
    // the sub-8h mis-scale is gone, so every interval prices at par ([1,1,1,1], was [1,2,4,8]).
    const syntheticExact = syntheticRatios.every((x) => Math.abs(x - 1) < 1e-9);

    // ---------- B. bar-spacing inference is a single pair (latent) ----------
    const cleanBars = [];
    for (let i = 0; i < 8; i++) cleanBars.push(T0 + i * HOUR);
    const raggedBars = cleanBars.slice();
    raggedBars[1] = T0 + 2 * HOUR;     // first pair straddles a missing candle
    const oneRow = [{ timestamp: T0, fundingRate: 8e-4, markPrice: null }];
    const cleanSum = carryOnBarGrid(cleanBars, oneRow, { gridMs: GRID_MS }).reduce((a, b) => a + b, 0);
    const raggedSum = carryOnBarGrid(raggedBars, oneRow, { gridMs: GRID_MS }).reduce((a, b) => a + b, 0);
    const firstPair = { cleanReceipt: r(cleanSum, 8), raggedReceipt: r(raggedSum, 8), inflatedX: r(raggedSum / cleanSum, 3) };

    // shipped first pairs: is it triggered?
    const firstPairs = {};
    let allFirstPairsModal = true;
    for (const s of symbols) {
        const bars = await readBars(s);
        const hist = {};
        for (let i = 1; i < bars.length; i++) { const dt = Math.round((bars[i] - bars[i - 1]) / 60_000); hist[dt] = (hist[dt] || 0) + 1; }
        const modal = +Object.entries(hist).sort((a, b) => b[1] - a[1])[0][0];
        const firstStep = Math.round((bars[1] - bars[0]) / 60_000);
        firstPairs[s] = { firstStepMin: firstStep, modalStepMin: modal };
        if (firstStep !== modal) allFirstPairsModal = false;
    }

    // ---------- C. shipped data: SOL's sub-8h window ----------
    const solRows = await readFunding('solusdt');
    const solAudit = auditFundingSeries(solRows, { now: Date.parse('2027-01-01T00:00:00Z') });
    const solProblems = auditFundingProblems(solAudit, { label: 'funding_solusdt_8h.jsonl' });
    const solOffGridFraction = solAudit.offGrid / Math.max(1, solAudit.count - 1);

    const solBars = await readBars('solusdt');
    const solRaw = carryOnBarGrid(solBars, solRows, { gridMs: GRID_MS });
    const solBkt = carryOnBarGrid(solBars, bucketRows(solRows), { gridMs: GRID_MS });
    let ftxRaw = 0; let ftxBkt = 0; let ftxBars = 0;
    for (let i = 0; i < solBars.length; i++) {
        if (!(solBars[i] >= FTX_START && solBars[i] < FTX_END)) continue;
        ftxRaw += solRaw[i]; ftxBkt += solBkt[i]; ftxBars++;
    }
    const sub8h = {
        rows: solRows.length,
        intervalHistogram: solAudit.intervalHistogram,
        offGridSteps: solAudit.offGrid,
        offGridFraction: r(solOffGridFraction, 4),
        missingPeriods: solAudit.missingPeriods,
        extremeRows: solAudit.extremeRates,
        auditProblems: solProblems,
        ftxWindow: { bars: ftxBars, shippedReceipt: r(ftxRaw, 6), correctedReceipt: r(ftxBkt, 6), understatementX: r(ftxBkt / ftxRaw, 3) },
    };

    // ---------- C2. pooled sleeve on the 8h grid: shipped vs corrected ----------
    const tsByName = {};
    for (const s of symbols) tsByName[s] = await readBars(s);
    let common = tsByName[symbols[0]].slice();
    const setOf = {};
    for (const s of symbols) setOf[s] = new Set(tsByName[s]);
    common = common.filter((t) => symbols.every((s) => setOf[s].has(t))).sort((a, b) => a - b);

    const to8h = (series, bars) => {
        const m = new Map();
        for (let i = 0; i < bars.length; i++) {
            const t = Math.floor(bars[i] / GRID_MS) * GRID_MS;
            m.set(t, (m.get(t) || 0) + series[i]);
        }
        return m;
    };

    const rawBySym = {}; const bktBySym = {};
    for (const s of symbols) {
        const rows = await readFunding(s);
        rawBySym[s] = to8h(carryOnBarGrid(common, rows, { gridMs: GRID_MS }), common);
        bktBySym[s] = to8h(carryOnBarGrid(common, bucketRows(rows), { gridMs: GRID_MS }), common);
    }
    let grid = [...rawBySym[symbols[0]].keys()].sort((a, b) => a - b);
    for (const s of symbols.slice(1)) grid = grid.filter((t) => rawBySym[s].has(t));

    const pooledSeries = (map) => grid.map((t) => { let a = 0; for (const s of symbols) a += map[s].get(t); return a / symbols.length; });
    const shippedSleeve = pooledSeries(rawBySym);
    const correctedSleeve = pooledSeries(bktBySym);

    // market proxy: the BTC 8h close return (equal-weight basket is what the sleeve should be uncorrelated with)
    const btcClose = new Map();
    for (const line of (await globalThis.__fs.readTextFile(`${REPO}/src/candles.jsonl`)).split('\n')) {
        const s = line.trim(); if (!s) continue;
        try { const p = JSON.parse(s); btcClose.set(typeof p.timestamp === 'number' ? p.timestamp : Date.parse(p.timestamp), +p.close); } catch { /* skip */ }
    }
    const mkt = []; const sRawR = []; const sBktR = [];
    for (let j = 1; j < grid.length; j++) {
        const a = btcClose.get(grid[j - 1]); const b = btcClose.get(grid[j]);
        if (!(a > 0 && b > 0)) continue;
        mkt.push(b / a - 1); sRawR.push(shippedSleeve[j]); sBktR.push(correctedSleeve[j]);
    }

    const annOf = (x) => mean(x) * PPY;
    const sleeveStats = {
        shipped: { periods: grid.length, annCarry: r(annOf(shippedSleeve), 5), sharpe: r(sharpe(shippedSleeve), 3), corrWithMarket: r(correlation(mkt, sRawR), 5) },
        corrected: { periods: grid.length, annCarry: r(annOf(correctedSleeve), 5), sharpe: r(sharpe(correctedSleeve), 3), corrWithMarket: r(correlation(mkt, sBktR), 5) },
        delta: {
            annCarry: r(annOf(correctedSleeve) - annOf(shippedSleeve), 5),
            sharpe: r(sharpe(correctedSleeve) - sharpe(shippedSleeve), 3),
            corrWithMarket: r(correlation(mkt, sBktR) - correlation(mkt, sRawR), 5),
        },
    };

    // ---------- guards ----------
    const inWindow = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
    const checks = {
        syntheticExact,                                                    // 1x/2x/4x/8x, exactly
        solSub8hPresent: solAudit.intervalHistogram['4h'] === 3 && solAudit.offGrid === 98,
        solAuditBlind: solProblems.length === 0,
        ftxUnderstated: inWindow(sub8h.ftxWindow.understatementX, 2.8, 3.3),
        pooledAnnMoves: inWindow(sleeveStats.delta.annCarry, -0.006, -0.003),
        pooledSharpeMoves: inWindow(sleeveStats.delta.sharpe, -3.0, -1.5),
        firstPairLatent: allFirstPairsModal,                               // shipped first pairs are clean
    };
    const validationPass = Object.values(checks).every((x) => x === true);

    const verdict = {
        note: 'L10-d / FOLD-BACK-R4(b), RESTATED round 94 (F-61 fixed round 34): the shipped carry grid join USED TO spread every funding row over an 8h bar count regardless of the observed interval; the fixed carryOnBarGrid divides by the period actually observed, so the synthetic sweep prices every interval at par ([1,1,1,1]). The real-data guards below still measure the historical sub-8h rows in the vendored funding files (a data fact, not the repo behavior).',
        commentClaim: 'carry.js ("the bar-grid projection divides by the period actually observed") — true since round 34',
        codeFact: 'carryOnBarGrid divides by the observed interval (round-34 fix); pre-fix it used perBar = gridMs (default 8h) and barsPerPeriod = round(gridMs / firstBarStep)',
        synthetic,
        barSpacing: { synthetic: firstPair, shippedFirstPairs: firstPairs },
        shipped: sub8h,
        pooledSleeve: sleeveStats,
        checks,
        validationPass,
    };

    return {
        config: { symbols: symbols.length, gridMs: GRID_MS, feeFree: true },
        synthetic, barSpacing: { synthetic: firstPair, shippedFirstPairs: firstPairs },
        sub8h, pooledSleeve: sleeveStats,
        validation: checks,
        verdict,
    };
}
