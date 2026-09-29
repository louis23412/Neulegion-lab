// E110 - THE HONEST-MARKS SLEEVE REPORT, PORT-VERIFIED (round 78, TODO 95).
//
// Round 78 wires the lab's ext-mark substitution into the repo CLI
// (`--carry-marks`): the report can now score the basis-marked book over the
// full history instead of the shipped-marks window. This experiment
// port-verifies that path on the real files: `runSleeveReport` with the marks
// text must equal the programmatic twin (manual substitution + the
// `buildCarrySleeveView` + `scoreSleeve` chain, the e74 construction) —
// bit-for-bit views, exactly-equal economics — and the honest level must
// reproduce the stored R8 book (e74's 6.18 / 10 / 46.04), far below the
// shipped-marks 11.26 the operator runs print by default.
//
// Symbols are passed UPPERCASE to pin the case-insensitive mark-map match
// (the CLI resolves manifest symbols, which are uppercase).
//
// PRE-REGISTERED READ. PASS iff:
//   (1) all 8 funding + candle texts and the marks file load;
//   (2) the marks report is available with a full-history substitution
//       (substituted > 20000 rows) and a clean basis (nullBasis < 0.05);
//   (3) the text-path view EQUALS the programmatic substituted view
//       bit-for-bit (fRate, basisPnl nulls in the same cells, times);
//   (4) the report economics EQUAL the direct chain's economics exactly
//       (netAnnual, turnoverAnnual, breakEvenCostBps);
//   (5) the honest level reproduces the stored R8 book within the e74
//       tolerances AND the formatter prints the marks line.

import { SYMBOLS } from '../lib/lab.js';
import { runSleeveReport, formatSleeveReport, buildCarrySleeveView, parseMarksJson, parseSleeveInputs, scoreSleeve } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { parseFundingJsonl } from '../../NeuLegion-master/NeuLegion-master/src/analysis/carry.js';

const GRID = 28_800_000;
const BAR = 3_600_000;
const FEE_BPS = 4;
const STORED = { net4: 6.18, turnoverAnnual: 10, breakEvenBps: 46.04 };

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
    const marksText = await globalThis.__fs.readTextFile('src/NeuLegion-lab/data/mark_8h.json');
    check('e110: all 8 funding + candle texts and the marks file loaded',
        fundingTexts.length === 8 && candleTexts.every((t) => t.length > 1000) && marksText.length > 1000,
        `funding ${fundingTexts.length}, candles ${candleTexts.filter((t) => t.length > 1000).length}/8, marks ${marksText.length} chars`);

    const upper = SYMBOLS.map((s) => s.toUpperCase());
    const r = runSleeveReport({ sleeveId: 'carry-dispersion', fundingTexts, candleTexts, costBps: FEE_BPS, marksText, symbols: upper });
    check('e110: the honest-marks report is available with a full-history substitution',
        r.available === true && r.marks !== null && r.marks.substituted > 20000 && r.nullBasisFraction < 0.05,
        r.available === true ? `substituted=${r.marks.substituted} nullBasis=${(100 * r.nullBasisFraction).toFixed(2)}%` : (r.reason || 'unavailable'));

    // The programmatic twin: the e74 substitution, then the direct chain.
    const marks = parseMarksJson(marksText);
    const snap = (t) => Math.floor(t / GRID) * GRID;
    const streams = fundingTexts.map((text, j) => {
        const { rows } = parseFundingJsonl(text);
        const key = Object.keys(marks).find((k) => k.toLowerCase() === SYMBOLS[j]);
        for (const row of rows) {
            if (!(row.markPrice > 0) && key != null) {
                const m = marks[key].get(snap(row.timestamp));
                if (Number.isFinite(m) && m > 0) row.markPrice = m;
            }
        }
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
    check('e110: the text-path view equals the programmatic substituted view bit-for-bit',
        r.available === true && viewsEqual(parseViewForCompare(), view),
        `buckets twin=${view.buckets}`);
    function parseViewForCompare() {
        // The report does not retain the view; rebuild it through the same
        // text path the report took (this re-derives, never copies internals).
        return parseSleeveInputs({ fundingTexts, candleTexts, marks: parseMarksJson(marksText), symbols: upper }).view;
    }
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

    const direct = scoreSleeve('carry-dispersion', view, { costBps: FEE_BPS });
    const PPY = 365 * 3;
    check('e110: the report economics equal the direct chain economics exactly',
        r.available === true && direct.available === true &&
        r.netAnnual === direct.netSharpe * Math.sqrt(PPY) &&
        r.turnoverAnnual === direct.turnover * PPY / direct.net.length &&
        r.breakEvenCostBps === direct.breakEvenCostBps,
        r.available === true ? `report ${r.netAnnual.toFixed(2)}/${r.turnoverAnnual.toFixed(2)}` : '');
    const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
    check('e110: the honest level reproduces the stored R8 book and the formatter prints the marks line',
        r.available === true &&
        Math.abs(r2(r.netAnnual) - STORED.net4) <= 0.5 &&
        Math.abs(r2(r.turnoverAnnual) - STORED.turnoverAnnual) <= 2 &&
        Math.abs(r2(r.breakEvenCostBps) - STORED.breakEvenBps) <= 3 &&
        formatSleeveReport(r).includes('marks +'),
        r.available === true ? `honest ${r2(r.netAnnual)}/${r2(r.turnoverAnnual)}/${r2(r.breakEvenCostBps)} vs stored ${STORED.net4}/${STORED.turnoverAnnual}/${STORED.breakEvenBps}` : '');

    const failed = checks.filter((c) => !c.pass);
    return {
        config: { symbols: SYMBOLS.length },
        repo: r.available === true
            ? { buckets: r.buckets, net4: r2(r.netAnnual), turnoverAnnual: r2(r.turnoverAnnual), breakEvenBps: r2(r.breakEvenCostBps), substituted: r.marks.substituted, nullBasisFraction: +r.nullBasisFraction.toFixed(4) }
            : { available: false, reason: r.reason },
        total: checks.length, failed: failed.length, failures: failed, checks,
        pass: failed.length === 0,
    };
}
