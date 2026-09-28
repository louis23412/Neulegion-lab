// E74 - THE COMPOSER VERIFICATION: does the REPO's R40/R42 sleeve composition
// reproduce the lab's R8 book on real data, and what do the G5 knobs read?
//
// CYCLE-075. e73 proved the PORT (repo sleeves == lab books bit-for-bit on the
// lab's own panel). Rounds 40/42 added repo-side machinery e73 never touches:
// `buildCarrySleeveView` (raw funding rows + spot closes -> the aligned panel)
// and `scoreSleeve` (the full sleeve -> single -> cap-band -> gate chain). This
// experiment drives that machinery on the REAL 8-symbol panel and checks the
// economics against the stored R8 book (e52: net@4 6.18 / 10x/yr / 46.04 bps),
// then reads the G5 knobs (level / blocks / neutral / capacity) on the real
// book. Read-only on the repo: it IMPORTS repo modules, never edits them.
//
// PRE-REGISTERED READ. PASS iff:
//   (1) the built view covers the lab's common grid (buckets >= 6500 of the
//       6557 e52 periods, 8 streams, null-basis fraction < 5%);
//   (2) the repo-scored economics match the stored R8 book (net@4 within 0.5,
//       turnover within 2/yr, break-even within 3 bps) — same tolerances as e73
//       §(3), widened for the independent panel build;
//   (3) the G5 knob identities hold (level == the recomputed Sharpe, blocks ==
//       the hand count, neutral == the recomputed factor-neutral Sharpe).
// The G5 VERDICT itself is expected FALSE (no dsrAdjusted without the full
// walk-forward gate, no human attestations) — the finding is the knob VALUES,
// which the lab has never measured for R8 (factor-neutral Sharpe, block
// positivity on the repo-scored book).
//
// Spot-close labelling (RUNNER bar-label rule): candle bars are labelled by
// OPEN, so the close known at a bucket boundary T is the bar labelled T-1h —
// closes are fed end-labelled (timestamp + 1h), and the builder's exact match
// then reads bars ending exactly at the boundary.

import { SYMBOLS, loadMarkPrices } from '../lib/lab.js';
import { parseFundingJsonl } from '../../NeuLegion-master/NeuLegion-master/src/analysis/carry.js';
import { buildCarrySleeveView, scoreSleeve } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { scoreG5 } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';
import { factorNeutralSharpe } from '../../NeuLegion-master/NeuLegion-master/src/analysis/dependence.js';

const GRID = 28_800_000;
const BAR = 3_600_000;
const PPY = 365 * 3;
const FEE_BPS = 4;
const STORED = { net4: 6.18, turnoverAnnual: 10, breakEvenBps: 46.04, periods: 6557 };

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const annSharpe = (a) => sd(a) > 0 ? (mean(a) / sd(a)) * Math.sqrt(PPY) : 0;
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);

async function readJsonlLines(path) {
    const text = await globalThis.__fs.readTextFile(path);
    const out = [];
    for (const line of String(text).split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try { out.push(JSON.parse(t)); } catch { /* counted upstream by e14 */ }
    }
    return out;
}

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const REPO = 'src/NeuLegion-master/NeuLegion-master';

    const streams = [];
    // The mark extension (F-18/CYCLE-006): the shipped funding files carry
    // markPrice = 0 before 2023-10-31, so rows without a positive mark read the
    // repo-independent mark history — the same substitution loadCarryBook makes.
    const ext = await loadMarkPrices().catch(() => null);
    const snap = (t) => Math.floor(t / GRID) * GRID;
    for (const s of SYMBOLS) {
        const ftext = await globalThis.__fs.readTextFile(`${REPO}/src/data/funding_${s}_8h.jsonl`);
        const { rows } = parseFundingJsonl(ftext);
        for (const r of rows) {
            if (!(r.markPrice > 0) && ext && ext[s]) {
                const m = ext[s].get(snap(r.timestamp));
                if (m > 0) r.markPrice = m;
            }
        }
        const name = s === 'btcusdt' ? 'candles.jsonl' : `candles_${s}_1h.jsonl`;
        const candles = await readJsonlLines(`${REPO}/src/data/${name}`).catch(() => readJsonlLines(`${REPO}/src/${name}`));
        const closes = [];
        for (const c of candles) {
            const t = Date.parse(c.timestamp);
            const p = Number(c.close);
            if (Number.isFinite(t) && Number.isFinite(p)) closes.push({ timestamp: t + BAR, close: p });
        }
        streams.push({ symbol: s, fundingRows: rows, spotCloses: closes });
    }
    check('e74: all 8 funding panels and candle panels loaded',
        streams.length === 8 && streams.every((s) => s.fundingRows.length > 6000 && s.spotCloses.length > 40000),
        streams.map((s) => `${s.symbol}:${s.fundingRows.length}/${s.spotCloses.length}`).join(' '));

    const view = buildCarrySleeveView({ streams });
    const nullBasis = view.basisPnl.flat().filter((x) => x === null).length;
    const cells = view.buckets * view.streams;
    check('e74: the built view covers the lab grid with a clean basis',
        view.buckets >= 6500 && view.streams === 8 && (cells ? nullBasis / cells : 1) < 0.05,
        `buckets=${view.buckets} nullBasis=${nullBasis}/${cells}`);
    check('e74: every view row is finite funding beside a nullable basis',
        view.fRate.every((row) => row.every(Number.isFinite)) &&
        view.basisPnl.every((row) => row.every((x) => x === null || Number.isFinite(x))));

    const scored = scoreSleeve('carry-dispersion', view, { costBps: FEE_BPS });
    check('e74: the real book scores available', scored.available === true, scored.reason || `n=${scored.net.length}`);
    const net = scored.net;
    const repoNet4 = r2(annSharpe(net));
    const repoTurnover = r2(scored.turnover * PPY / net.length);
    const repoBE = r2(scored.breakEvenCostBps);
    check('e74: repo net@4 reproduces the stored R8 book',
        Math.abs(repoNet4 - STORED.net4) <= 0.5, `repo=${repoNet4} stored=${STORED.net4}`);
    check('e74: repo turnover reproduces the stored R8 book',
        Math.abs(repoTurnover - STORED.turnoverAnnual) <= 2, `repo=${repoTurnover} stored=${STORED.turnoverAnnual}`);
    check('e74: repo break-even reproduces the stored R8 book',
        Math.abs(repoBE - STORED.breakEvenBps) <= 3, `repo=${repoBE} stored=${STORED.breakEvenBps}`);

    const panel = view.fRate[0].map((_, j) => view.fRate.map((row, i) => row[j] + (view.basisPnl[i][j] === null ? 0 : view.basisPnl[i][j])));
    const fn = factorNeutralSharpe(net, panel);
    const g5 = scoreG5({ net, costBps: FEE_BPS, blocks: 6, dsrAdjusted: null, neutralSharpe: fn.neutral, decayDocumented: false, unseenData: false });
    const knob = (n) => g5.knobs.find((k) => k.knob === n);
    check('e74: G5 level == the recomputed annualized Sharpe',
        Math.abs(knob('level').value * Math.sqrt(PPY) - repoNet4) < 0.01, `level=${r2(knob('level').value * Math.sqrt(PPY))}`);
    check('e74: G5 blocks == the hand-counted positive fraction',
        (() => {
            const size = Math.floor(net.length / 6);
            let pos = 0;
            for (let b = 0; b < 6; b++) {
                const seg = net.slice(b * size, (b + 1) * size);
                if (annSharpe(seg) > 0) pos++;
            }
            return knob('blocks').value === pos / 6;
        })(), knob('blocks').note);
    check('e74: G5 neutral == the recomputed factor-neutral Sharpe',
        Math.abs(knob('neutral').value - fn.neutral) < 1e-9 || (Number.isNaN(knob('neutral').value) && Number.isNaN(fn.neutral)),
        `neutral=${r2(fn.neutral)} raw=${r2(fn.raw)}`);
    check('e74: G5 verdict is false on unscored dsr + unattested decay/unseen (the operator run owns them)',
        g5.verdict === false && g5.reasons.includes('dsr') && g5.reasons.includes('decay') && g5.reasons.includes('unseen'),
        `reasons=${g5.reasons.join(',')}`);

    const failed = checks.filter((c) => !c.pass);
    return {
        config: { symbols: SYMBOLS.length, buckets: view.buckets, bookBars: net.length },
        repo: { net4: repoNet4, turnoverAnnual: repoTurnover, breakEvenBps: repoBE, grossSharpe: r2(annSharpe(scored.gross)) },
        stored: STORED,
        g5: {
            verdict: g5.verdict,
            levelAnn: r2(knob('level').value * Math.sqrt(PPY)),
            blocksNote: knob('blocks').note,
            neutralAnn: r2(fn.neutral * Math.sqrt(PPY)),
            rawAnn: r2(fn.raw * Math.sqrt(PPY)),
            stress: { first: r2(scored.stress.first * Math.sqrt(PPY)), second: r2(scored.stress.second * Math.sqrt(PPY)) },
            worstBlockAnn: r2(scored.worstBlock * Math.sqrt(PPY)),
        },
        total: checks.length, failed: failed.length, failures: failed, checks,
        pass: failed.length === 0,
    };
}
