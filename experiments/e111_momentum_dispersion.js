// E111 - MOMENTUM-DISPERSION ON THE 8H GRID: A CLEAN NULL (round 79).
//
// The 1h momentum edge (sig-momentum 1.0848, sig-accel 1.0194) does not survive
// the sleeve grid. This experiment scores the R8 construction shell with a
// momentum sort key instead of the funding rank — trailing-W-bucket spot
// returns, cross-sectional rank weights, EWMA(0.02) + L1, 12.5% cap, earning
// next-bucket spot at 4 bps — at W = 2/4/8/16 buckets, through the repo's own
// `parseSleeveInputs` (exact bucket boundaries, exact-boundary closes) and the
// `singleBook` + `scoreBookReturns` pipeline the shipped sleeves score
// through. It then decomposes gross-vs-net and runs a hold-6 variant to test
// whether turnover (rather than no signal) is the killer.
//
// Symbols go in UPPERCASE to pin the case-insensitive mark-map match (marks
// are not used here; momentum needs no mark history).
//
// PRE-REGISTERED READ. PASS iff:
//   (1) all 8 funding + candle texts load;
//   (2) the carry control replicates the shipped-marks level (netAnnual
//       11.26 +/- 0.5 — proves the plumbing is the shipped arithmetic);
//   (3) momentum is null at EVERY window (|per-bar net| < 0.02,
//       break-even < 15 bps);
//   (4) momentum is decorrelated from carry at every window (|corr| < 0.1);
//   (5) the null is gross, not cost: |grossAnn| < 1.0 at W4/W8, and the
//       hold-6 variant churns HARDER than EWMA (keys non-persistent —
//       no turnover rescue exists).
//
// Executed AI-side in-session on the real data through the repo's own modules
// (esbuild bundle of this exact logic): 5/5. Consequence: NO PORT — there is
// no momentum sleeve and no carry+momentum composite (corr ~ 0 with zero edge
// is nothing to blend). Recorded as lab F-122.

import { SYMBOLS } from '../lib/lab.js';
import { parseSleeveInputs, scoreSleeve } from '../../NeuLegion-master/NeuLegion-master/src/sleeve_score.js';
import { scoreBookReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';
import { singleBook } from '../../NeuLegion-master/NeuLegion-master/src/plugins/books/single.js';
import { cleanBook, rowRankWeights, applyWeightPolicy, fin } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { normalizeL1 } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/weights.js';

const GRID = 28_800_000;
const BAR = 3_600_000;
const FEE_BPS = 4;
const PPY = 365 * 3;
const WINDOWS = [2, 4, 8, 16];

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
    check('e111: all 8 funding + candle texts loaded',
        fundingTexts.length === 8 && candleTexts.every((t) => t.length > 1000),
        `funding ${fundingTexts.length}, candles ${candleTexts.filter((t) => t.length > 1000).length}/8`);

    const upper = SYMBOLS.map((s) => s.toUpperCase());
    const { view } = parseSleeveInputs({ fundingTexts, candleTexts, marks: null, symbols: upper });
    const T = view.buckets;
    const K = view.streams;

    const carry = scoreSleeve('carry-dispersion', view, { costBps: FEE_BPS });
    const carryAnn = carry.available === true ? carry.netSharpe * Math.sqrt(PPY) : NaN;
    check('e111: the carry control replicates the shipped-marks level',
        carry.available === true && Math.abs(carryAnn - 11.26) <= 0.5,
        carry.available === true ? `carry netAnn=${carryAnn.toFixed(2)}` : (carry.reason || 'unavailable'));

    const closeMaps = candleTexts.map((text) => {
        const m = new Map();
        for (const line of String(text).split('\n')) {
            const t = line.trim();
            if (!t) continue;
            let c;
            try { c = JSON.parse(t); } catch { continue; }
            const ts = typeof c.timestamp === 'number' ? c.timestamp : Date.parse(c.timestamp);
            const close = Number(c.close);
            if (Number.isFinite(ts) && Number.isFinite(close)) m.set(ts + BAR, close);
        }
        return m;
    });
    const spot = [];
    for (let i = 0; i < T; i++) {
        const key = view.times[i];
        const row = [];
        for (let j = 0; j < K; j++) {
            const s1 = closeMaps[j].get(key);
            const s0 = closeMaps[j].get(key - GRID);
            row.push(Number.isFinite(s0) && Number.isFinite(s1) && s0 > 0 ? s1 / s0 - 1 : null);
        }
        spot.push(row);
    }

    const scoreKeys = (W, policy) => {
        const trail = [];
        for (let i = 0; i < T; i++) {
            const key = view.times[i];
            const row = [];
            for (let j = 0; j < K; j++) {
                const a = closeMaps[j].get(key - W * GRID);
                const b = closeMaps[j].get(key);
                row.push(Number.isFinite(a) && Number.isFinite(b) && a > 0 ? b / a - 1 : null);
            }
            trail.push(row);
        }
        let held = new Array(K).fill(0);
        const raw = [];
        let ctr = 0;
        for (let r = 0; r < T - 1; r++) {
            const keys = trail[r];
            const target = keys.every((v) => Number.isFinite(v)) ? rowRankWeights(keys) : new Array(K).fill(0);
            held = policy.normalize
                ? normalizeL1(applyWeightPolicy(held, target, policy, ctr))
                : applyWeightPolicy(held, target, policy, ctr);
            ctr += 1;
            raw.push(held.slice());
        }
        const clean = cleanBook(raw, { cap: 0.125, bandEps: null });
        const book = singleBook.compose([{ rows: clean, weight: 1 }]);
        const gross = book.weightRows.map((w, t) => {
            const fwd = spot[t + 1] || [];
            return w.reduce((acc, x, j) => acc + x * fin(fwd[j]), 0);
        });
        return scoreBookReturns(gross, book.weightRows, { costBps: FEE_BPS });
    };
    const corrWith = (a, b) => {
        const n = a.length;
        const ma = a.reduce((x, v) => x + v, 0) / n;
        const mb = b.reduce((x, v) => x + v, 0) / n;
        let cv = 0, va = 0, vb = 0;
        for (let i = 0; i < n; i++) { cv += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
        return va > 0 && vb > 0 ? cv / Math.sqrt(va * vb) : NaN;
    };

    const EWMA = { kind: 'ewma', lambda: 0.02, normalize: true };
    const perW = {};
    for (const W of WINDOWS) {
        const sc = scoreKeys(W, EWMA);
        perW[W] = sc
            ? { net: sc.netSharpe, netAnn: sc.netSharpe * Math.sqrt(PPY), be: sc.breakEvenCostBps, corr: corrWith(sc.net, carry.net) }
            : null;
    }
    check('e111: momentum is null at every window',
        WINDOWS.every((W) => perW[W] !== null && Math.abs(perW[W].net) < 0.02 && perW[W].be < 15),
        WINDOWS.map((W) => `W${W}:${perW[W] !== null ? `${perW[W].net.toFixed(3)}/${perW[W].be.toFixed(1)}` : 'n/a'}`).join(' '));
    check('e111: momentum is decorrelated from carry at every window',
        carry.available === true && WINDOWS.every((W) => perW[W] !== null && Math.abs(perW[W].corr) < 0.1),
        WINDOWS.map((W) => `W${W}:${perW[W] !== null ? perW[W].corr.toFixed(3) : 'n/a'}`).join(' '));

    const HOLD = { kind: 'hold', N: 6 };
    const h4 = scoreKeys(4, HOLD);
    const h8 = scoreKeys(8, HOLD);
    const e4 = scoreKeys(4, EWMA);
    const e8 = scoreKeys(8, EWMA);
    check('e111: the null is gross, not cost (no turnover rescue)',
        h4 && h8 && e4 && e8 &&
        Math.abs(h4.grossSharpe * Math.sqrt(PPY)) < 1.0 && Math.abs(h8.grossSharpe * Math.sqrt(PPY)) < 1.0 &&
        h4.turnoverPerYear > e4.turnoverPerYear && h8.turnoverPerYear > e8.turnoverPerYear,
        `grossAnn ${h4 ? (h4.grossSharpe * Math.sqrt(PPY)).toFixed(2) : 'n/a'}/${h8 ? (h8.grossSharpe * Math.sqrt(PPY)).toFixed(2) : 'n/a'}, ` +
        `turn hold ${h4 ? h4.turnoverPerYear.toFixed(0) : 'n/a'}/${h8 ? h8.turnoverPerYear.toFixed(0) : 'n/a'} vs ewma ${e4 ? e4.turnoverPerYear.toFixed(0) : 'n/a'}/${e8 ? e8.turnoverPerYear.toFixed(0) : 'n/a'}`);

    const failed = checks.filter((c) => !c.pass);
    return {
        config: { windows: WINDOWS, feeBps: FEE_BPS },
        repo: carry.available === true ? { buckets: T, carryAnn: +carryAnn.toFixed(2) } : { available: false },
        momentum: Object.fromEntries(WINDOWS.map((W) => [W, perW[W] !== null
            ? { net: +perW[W].net.toFixed(4), netAnn: +perW[W].netAnn.toFixed(2), be: +perW[W].be.toFixed(1), corr: +perW[W].corr.toFixed(3) }
            : null])),
        total: checks.length, failed: failed.length, failures: failed, checks,
        pass: failed.length === 0,
    };
}
