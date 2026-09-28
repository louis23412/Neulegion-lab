// E75 - THE SLEEVE-MODE TEXT PATH ON REAL DATA: does `runSleeveReport` (JSONL
// TEXTS in) equal the programmatic chain (parsed ROWS in) on the same files?
//
// CYCLE-077. e74 proved the repo CHAIN on real data, but it built closes
// programmatically — the TEXT parsing half of `parseSleeveInputs` (candle JSONL
// → end-labelled closes) never ran on real files. This experiment reads the
// shipped funding + candle files AS TEXT, drives `runSleeveReport` end to end,
// and requires bit-equality with the programmatic `buildCarrySleeveView` +
// `scoreSleeve` chain on the same files with SHIPPED marks only (no ext
// substitution — both sides see the same missing marks, so any parsing or
// labelling difference fails loudly).
//
// The shipped-marks object is NOT the R8 book: unmarked periods earn funding
// only (basis null → 0 through `fin`), so its level (net ~11.3 on this
// window) is recorded, never gated — gating a level read off one run would be
// curve-fitting. What is gated is the path equivalence plus the mode contract.
//
// PRE-REGISTERED READ. PASS iff:
//   (1) all 8 funding + candle texts load;
//   (2) the report is available with the e74 grid (buckets >= 6500, 8 streams)
//       and documents the mark confinement (markedFraction < 0.5 —
//       CYCLE-005 — with a material null-basis share);
//   (3) the text-parsed view EQUALS the programmatic view bit-for-bit
//       (fRate, basisPnl with nulls in the same cells, times);
//   (4) the report economics EQUAL the direct chain's economics exactly
//       (netAnnual, turnoverAnnual, breakEvenCostBps);
//   (5) the formatter names the sleeve and the G5 verdict line.

import { SYMBOLS } from '../lib/lab.js';
import { runSleeveReport, formatSleeveReport, buildCarrySleeveView, parseSleeveInputs, scoreSleeve } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { parseFundingJsonl } from '../../NeuLegion-master/NeuLegion-master/src/analysis/carry.js';

const GRID = 28_800_000;
const BAR = 3_600_000;

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const REPO = 'src/NeuLegion-master/NeuLegion-master';

    const fundingTexts = [];
    const candleTexts = [];
    for (const s of SYMBOLS) {
        fundingTexts.push(await globalThis.__fs.readTextFile(`${REPO}/src/data/funding_${s}_8h.jsonl`));
        const name = s === 'btcusdt' ? 'candles.jsonl' : `candles_${s}_1h.jsonl`;
        try {
            candleTexts.push(await globalThis.__fs.readTextFile(`${REPO}/src/data/${name}`));
        } catch {
            candleTexts.push(await globalThis.__fs.readTextFile(`${REPO}/src/${name}`));
        }
    }
    check('e75: all 8 funding + candle texts loaded',
        fundingTexts.length === 8 && candleTexts.every((t) => t.length > 1000),
        `funding ${fundingTexts.length}, candles ${candleTexts.filter((t) => t.length > 1000).length}/8`);

    const r = runSleeveReport({ sleeveId: 'carry-dispersion', fundingTexts, candleTexts, costBps: 4 });
    check('e75: the sleeve-mode report is available on shipped texts', r.available === true, r.reason || `buckets=${r.buckets}`);
    check('e75: the grid matches e74 with the mark confinement documented',
        r.available === true && r.buckets >= 6500 && r.streams === 8 && r.markedFraction < 0.5 && r.nullBasisFraction > 0.2,
        r.available === true ? `buckets=${r.buckets} marked=${(100 * r.markedFraction).toFixed(1)}% nullBasis=${(100 * r.nullBasisFraction).toFixed(2)}%` : '');

    // The programmatic twin: same files, shipped marks, no substitution.
    const streams = fundingTexts.map((text, j) => {
        const { rows } = parseFundingJsonl(text);
        const closes = [];
        for (const line of String(candleTexts[j]).split('\n')) {
            const t = line.trim();
            if (!t) continue;
            let c;
            try { c = JSON.parse(t); } catch { continue; }
            const ts = typeof c.timestamp === 'number' ? c.timestamp : Date.parse(c.timestamp);
            const close = Number(c.close);
            if (Number.isFinite(ts) && Number.isFinite(close)) closes.push({ timestamp: ts + BAR, close });
        }
        return { fundingRows: rows, spotCloses: closes };
    });
    const view = buildCarrySleeveView({ streams });
    const textView = parseSleeveInputs({ fundingTexts, candleTexts }).view;
    check('e75: the text-parsed view equals the programmatic view bit-for-bit',
        r.available === true && viewsEqual(textView, view),
        `buckets text=${textView.buckets} prog=${view.buckets}`);
    function viewsEqual(a, b) {
        if (a.times.length !== b.times.length) return false;
        for (let i = 0; i < a.times.length; i++) if (a.times[i] !== b.times[i]) return false;
        for (let i = 0; i < a.fRate.length; i++) {
            for (let j = 0; j < a.fRate[i].length; j++) {
                if (a.fRate[i][j] !== b.fRate[i][j]) return false;
                const x = a.basisPnl[i][j], y = b.basisPnl[i][j];
                if (x === null || y === null) { if (x !== y) return false; }
                else if (x !== y) return false;
            }
        }
        return true;
    }

    const direct = scoreSleeve('carry-dispersion', view, { costBps: 4 });
    const PPY = 365 * 3;
    const dNet = direct.available ? direct.netSharpe * Math.sqrt(PPY) : NaN;
    const dTurn = direct.available ? direct.turnover * PPY / direct.net.length : NaN;
    check('e75: the report economics equal the direct chain economics exactly',
        r.available === true && direct.available === true &&
        r.netAnnual === dNet && r.turnoverAnnual === dTurn && r.breakEvenCostBps === direct.breakEvenCostBps,
        r.available === true ? `report ${r.netAnnual.toFixed(2)}/${r.turnoverAnnual.toFixed(2)} vs direct ${dNet.toFixed(2)}/${dTurn.toFixed(2)}` : '');
    const text = formatSleeveReport(r);
    check('e75: the formatter names the sleeve and the G5 verdict line',
        text.includes('carry-dispersion') && text.includes('G5 verdict'), text.split('\n')[0]);

    const failed = checks.filter((c) => !c.pass);
    return {
        config: { symbols: SYMBOLS.length },
        repo: r.available === true
            ? { buckets: r.buckets, net4: +r.netAnnual.toFixed(2), turnoverAnnual: +r.turnoverAnnual.toFixed(2), breakEvenBps: +r.breakEvenCostBps.toFixed(2), markedFraction: +r.markedFraction.toFixed(3), nullBasisFraction: +r.nullBasisFraction.toFixed(4) }
            : { available: false, reason: r.reason },
        total: checks.length, failed: failed.length, failures: failed, checks,
        pass: failed.length === 0,
    };
}
