// E109 - THE OPERATOR YEARLY BLOCK, RE-DERIVED IN THE LAB (round 77, TODO 105).
//
// The operator's 20260929T111926-seed1-sleeve run is the first real yearly
// readout of the decay attestation's evidence (2020 +0.66 → 2026 +0.11 per-bar,
// slope -0.09/yr, G5 still false on (decay,unseen) by design). This experiment
// re-derives that block in the lab through the repo's own `runSleeveReport` on
// the same shipped texts: same code, same data, so the yearly series + slope
// must match the uploaded report's block near-exactly — any drift fails loudly
// (the F-60 port-verify pattern: disagreement means a calendar/data bug, not a
// signal). It then recomputes the yearly decay SHAPE on the lab's INDEPENDENT
// honest carry book (`e3#loadCarryBook`: equal-weight delta-neutral, full mark
// history with ext substitution — a different book on different marks, so only
// the decay DIRECTION is compared, never the level): agreement means the decay
// is not a calendar artefact of `sleeveYearly`.
//
// PRE-REGISTERED READ. PASS iff:
//   (1) all 8 funding + candle texts load;
//   (2) the lab report's yearly block equals the uploaded operator block
//       (per-year bars exact, per-bar Sharpe within 1e-9, slope within 1e-12);
//   (3) the new `firstLast` block is populated (halves sum to the scored bars,
//       diff finite) and the formatter prints it;
//   (4) the lab honest-book yearly slope is negative and its last-two-year
//       mean Sharpe sits below its first-two-year mean (decay direction);
//   (5) the operator block itself shows decay (2026 below 2020, slope < 0) —
//       the pin on the uploaded numbers this attestation reads.

import { SYMBOLS, sharpeRatio } from '../lib/lab.js';
import { runSleeveReport, formatSleeveReport } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { loadCarryBook } from './e3_carry.js';

// The `yearly` block of `src/runs/20260929T111926-seed1-sleeve/report.json`
// (read-only operator evidence, embedded as the port-verify target).
const OPERATOR_YEARLY = [
    { year: 2020, bars: 327, netSharpe: 0.6610957320719044 },
    { year: 2021, bars: 1095, netSharpe: 0.4913401677014427 },
    { year: 2022, bars: 1095, netSharpe: 0.547848279564191 },
    { year: 2023, bars: 1095, netSharpe: 0.34339020565170686 },
    { year: 2024, bars: 1098, netSharpe: 0.3033532515802494 },
    { year: 2025, bars: 1095, netSharpe: 0.14333893448675503 },
    { year: 2026, bars: 800, netSharpe: 0.10958877848807633 },
];
const OPERATOR_SLOPE = -0.09267922697017147;

function olsSlope(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((a, v) => a + v, 0) / n;
    const my = ys.reduce((a, v) => a + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
    return den > 0 ? num / den : NaN;
}

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
    check('e109: all 8 funding + candle texts loaded',
        fundingTexts.length === 8 && candleTexts.every((t) => t.length > 1000),
        `funding ${fundingTexts.length}, candles ${candleTexts.filter((t) => t.length > 1000).length}/8`);

    const r = runSleeveReport({ sleeveId: 'carry-dispersion', fundingTexts, candleTexts, costBps: 4 });
    check('e109: the sleeve-mode report is available on shipped texts', r.available === true, r.reason || `buckets=${r.buckets}`);

    const y = r.available === true ? r.yearly : null;
    const yearlyMatch = y !== null && y.available === true && y.years.length === OPERATOR_YEARLY.length &&
        y.years.every((row, i) => row.year === OPERATOR_YEARLY[i].year &&
            row.bars === OPERATOR_YEARLY[i].bars &&
            Math.abs(row.netSharpe - OPERATOR_YEARLY[i].netSharpe) <= 1e-9) &&
        Math.abs(y.slope - OPERATOR_SLOPE) <= 1e-12;
    check('e109: the lab yearly block equals the operator block near-exactly',
        yearlyMatch,
        y !== null && y.available === true
            ? `slope lab=${y.slope} operator=${OPERATOR_SLOPE}, maxSharpeDrift=${Math.max(...y.years.map((row, i) => Math.abs(row.netSharpe - OPERATOR_YEARLY[i].netSharpe)))}`
            : 'yearly unavailable');

    const f = r.available === true ? r.firstLast : null;
    const text = r.available === true ? formatSleeveReport(r) : '';
    check('e109: the first-last block is populated over the scored bars and printed',
        f !== null && f.available === true &&
        f.first.n + f.second.n === r.dsr.bars &&
        Number.isFinite(f.diff) && Number.isFinite(f.seDiff) &&
        text.includes('first-last '),
        f !== null && f.available === true ? `halves ${f.first.n}+${f.second.n}=${r.dsr.bars}, diff=${f.diff}` : 'firstLast unavailable');

    const { perSym } = await loadCarryBook(SYMBOLS);
    const byYear = new Map();
    for (const p of perSym) {
        const per = new Map();
        for (let i = 0; i < p.rets.length; i++) {
            const year = new Date(p.times[i]).getUTCFullYear();
            if (!per.has(year)) per.set(year, []);
            per.get(year).push(p.rets[i]);
        }
        for (const [year, bars] of per) {
            if (bars.length < 2) continue;
            if (!byYear.has(year)) byYear.set(year, []);
            byYear.get(year).push(sharpeRatio(bars, { periodsPerYear: 1 }));
        }
    }
    const honestYears = [...byYear.keys()].sort((a, b) => a - b)
        .map((year) => ({ year, mean: byYear.get(year).reduce((a, v) => a + v, 0) / byYear.get(year).length, n: byYear.get(year).length }));
    const honestSlope = honestYears.length >= 2
        ? olsSlope(honestYears.map((d) => d.year), honestYears.map((d) => d.mean)) : NaN;
    const firstTwo = honestYears.length >= 2 ? (honestYears[0].mean + honestYears[1].mean) / 2 : NaN;
    const lastTwo = honestYears.length >= 2
        ? (honestYears[honestYears.length - 2].mean + honestYears[honestYears.length - 1].mean) / 2 : NaN;
    check('e109: the independent honest book shows the same decay direction',
        honestYears.length >= 4 && honestSlope < 0 && lastTwo < firstTwo,
        `${honestYears.length}y slope=${Number.isFinite(honestSlope) ? honestSlope.toFixed(3) : 'n/a'} first2=${firstTwo.toFixed(2)} last2=${lastTwo.toFixed(2)}`);

    check('e109: the operator block itself shows decay (the attestation pin)',
        OPERATOR_YEARLY[OPERATOR_YEARLY.length - 1].netSharpe < OPERATOR_YEARLY[0].netSharpe && OPERATOR_SLOPE < 0,
        `2020 ${OPERATOR_YEARLY[0].netSharpe.toFixed(2)} → 2026 ${OPERATOR_YEARLY[OPERATOR_YEARLY.length - 1].netSharpe.toFixed(2)}, slope ${OPERATOR_SLOPE.toFixed(2)}/yr`);

    const failed = checks.filter((c) => !c.pass);
    return {
        config: { symbols: SYMBOLS.length },
        repo: r.available === true
            ? { buckets: r.buckets, slope: y.available === true ? y.slope : null, diff: f.available === true ? f.diff : null }
            : { available: false, reason: r.reason },
        honest: { years: honestYears.length, slope: honestSlope, firstTwo, lastTwo },
        total: checks.length, failed: failed.length, failures: failed, checks,
        pass: failed.length === 0,
    };
}
