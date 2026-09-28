// E64 - SAMPLE UNIQUENESS AND THE SEQUENTIAL BOOTSTRAP, AUDITED: `analysis/uniqueness.js`. CYCLE-056 (L10-bx ...).
//
// `analysis/uniqueness.js` is the reference implementation of Lopez de Prado ch.4 sample uniqueness: the
// per-observation `average of 1/concurrency` over a label span, the effective sample size (sum of uniqueness),
// and a sequential bootstrap. It is NOT imported by shipped code (the hot path may not import `analysis/`);
// the shipped path re-implements the *average uniqueness* in `hivemind/training/sample_weights.js`
// (`overlapUniqueness`), and the test suite cross-checks the two. But it IS the module the lock-registry bills
// as the proof of the ch.4 formula, and `sequentialBootstrap` is the module's only algorithm.
//
// PRE-REGISTERED READ. PASSES if (i) `sampleUniqueness` reproduces an INDEPENDENT recompute (a scan-all-spans
// count per bar, a different data structure from the module's typed-array concurrency) exactly on the
// documented fixtures and on seeded random spans, and matches the SHIPPED `overlapUniqueness` bit-for-bit;
// (ii) uniqueness is per-label (order-invariant) and the ESS identities hold (ESS of point labels === n,
// ESS === sum of uniqueness, averageUniqueness === ESS/n, ESS <= n, empty -> []/NaN);
// (iii) `sequentialBootstrap` returns exactly `size` in-range indices, is deterministic per seed and different
// across seeds, and returns [] on empty input.
//
// The DEFECTS are reported in `findings`: the sequential bootstrap's draw weight is the uniqueness **sum**, not
// the average (a comment says "running average uniqueness"), so two labels with IDENTICAL average uniqueness
// but different span lengths are drawn in proportion to their lengths; and the implemented heuristic (static
// numerator, count-only conditioning) is NOT the AFML ch.4 sequential bootstrap it cites (the reference
// recomputes each candidate's average uniqueness against the current selection), with a measurable
// distributional gap; plus a minor robustness gap (a span with `start > end` yields NaN or -0 rather than
// abstaining).

import {
    sampleUniqueness, averageUniqueness, effectiveSampleSize, sequentialBootstrap,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/uniqueness.js';
import {
    overlapUniqueness, sampleWeights,
} from '../../NeuLegion-master/NeuLegion-master/src/hivemind/training/sample_weights.js';

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const close = (a, b, tol = 1e-12) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= tol;
const spanLen = ([s, e]) => e - s + 1;

// Independent reference: count, per bar, how many spans cover it by scanning ALL spans (no concurrency array).
function refUniqueness(spans) {
    const n = spans.length;
    if (!n) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
        const [s, e] = spans[i];
        const len = e - s + 1;
        if (len <= 0) { out.push(NaN); continue; }
        let acc = 0;
        for (let t = s; t <= e; t++) {
            let c = 0;
            for (let j = 0; j < n; j++) { const [sj, ej] = spans[j]; if (t >= sj && t <= ej) c++; }
            acc += 1 / c;
        }
        out.push(acc / len);
    }
    return out;
}

// Average uniqueness of label `i` (its span) against a multiset of selected labels (`sel` = indices).
function avgUniqOfLast(spans, sel, i) {
    const chosen = sel.map((j) => spans[j]);
    chosen.push(spans[i]);
    const [s, e] = spans[i];
    const len = e - s + 1;
    if (len <= 0) return 0;
    let acc = 0;
    for (let t = s; t <= e; t++) {
        let c = 0;
        for (const [sj, ej] of chosen) if (t >= sj && t <= ej) c++;
        acc += 1 / c;
    }
    return acc / len;
}

// AFML ch.4 sequential bootstrap: P(i) ∝ average uniqueness of i given the CURRENT selection + {i}.
function afmlSeqBootstrap(spans, size, seed) {
    const n = spans.length;
    if (!n) return [];
    const draws = size != null ? size : n;
    const rnd = mulberry32(seed);
    const phi = [];
    for (let d = 0; d < draws; d++) {
        const w = new Array(n);
        let total = 0;
        for (let i = 0; i < n; i++) { w[i] = avgUniqOfLast(spans, phi, i); total += w[i]; }
        if (!(total > 0)) break;
        let r = rnd() * total;
        let chosen = n - 1;
        for (let i = 0; i < n; i++) { r -= w[i]; if (r <= 0) { chosen = i; break; } }
        phi.push(chosen);
    }
    return phi;
}

// The module's OWN weight law, enumerated: w_i = sumU_i / (1 + count_i), sumU = the sum of 1/concurrency.
function moduleWeights(spans, count) {
    const u = sampleUniqueness(spans);
    const n = spans.length;
    const w = new Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
        const sumU = u[i] * spanLen(spans[i]);
        w[i] = sumU / (1 + (count[i] || 0));
        total += w[i];
    }
    return { w, total, p: w.map((x) => x / total) };
}

// Monte-Carlo: the first-draw frequency and the second-draw distribution conditioned on first === cond,
// under a given generator.
function mcDraws(gen, spans, seeds, cond, size) {
    const n = spans.length;
    const first = new Array(n).fill(0);
    const second = new Array(n).fill(0);
    let condCount = 0;
    const rnd = mulberry32(0xABCDEF);
    for (let k = 0; k < seeds; k++) {
        const seq = gen(spans, size, (rnd() * 0x7fffffff) | 0);
        if (!seq.length) continue;
        first[seq[0]]++;
        if (seq.length > 1 && seq[0] === cond) { second[seq[1]]++; condCount++; }
    }
    return { first: first.map((x) => x / seeds), second: second.map((x) => (condCount ? x / condCount : NaN)), condCount };
}
function tv(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / 2; }
const se = (p, n) => Math.sqrt(Math.max(p * (1 - p), 1e-9) / n);

export async function run() {
    const checks = {};
    const rows = {};

    // ============================== A. the average uniqueness ==========================================
    checks.uniquenessExact = (() => {
        const fixtures = [
            [[0, 2], [1, 3]],
            [[0, 0], [0, 5]],
            [[0, 0], [1, 1], [2, 2]],
            [[0, 5], [0, 5], [0, 5]],
            [[0, 9], [2, 3], [2, 3], [5, 7]],
        ];
        const rowsArr = [];
        let ok = true;
        for (const spans of fixtures) {
            const got = sampleUniqueness(spans);
            const ref = refUniqueness(spans);
            const matches = got.length === ref.length && got.every((v, i) => close(v, ref[i], 1e-12));
            if (!matches) ok = false;
            rowsArr.push({ spans: JSON.stringify(spans), got, ref, matches });
        }
        // documented vectors
        const doc = close(sampleUniqueness([[0, 2], [1, 3]])[0], 2 / 3, 1e-12) && close(sampleUniqueness([[0, 2], [1, 3]])[1], 2 / 3, 1e-12);
        rows.uniquenessFixtures = rowsArr;
        rows.uniquenessDocVector = { overlapping: sampleUniqueness([[0, 2], [1, 3]]), pointPlusLong: sampleUniqueness([[0, 0], [0, 5]]) };
        return ok && doc && close(sampleUniqueness([[0, 0], [0, 5]])[0], 0.5, 1e-12) && close(sampleUniqueness([[0, 0], [0, 5]])[1], 11 / 12, 1e-12);
    })();

    checks.uniquenessMatchesShippedOverlap = (() => {
        let worst = 0;
        for (let s = 1; s <= 8; s++) {
            const rnd = mulberry32(s);
            const spans = [];
            for (let i = 0; i < 12; i++) {
                const st = Math.floor(rnd() * 20);
                const len = 1 + Math.floor(rnd() * 5);
                spans.push([st, st + len - 1]);
            }
            const a = sampleUniqueness(spans);
            const b = overlapUniqueness(spans);
            for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
        }
        rows.overlapAgreement = { worstAbsDiff: worst, fixtures: 8 };
        return worst < 1e-15;
    })();

    checks.uniquenessOrderInvariant = (() => {
        const spans = [[0, 9], [2, 3], [2, 3], [5, 7], [9, 11], [11, 11]];
        const base = sampleUniqueness(spans);
        const perm = [3, 0, 5, 2, 4, 1];
        const p = sampleUniqueness(perm.map((j) => spans[j]));
        const ok = perm.every((j, k) => close(p[k], base[j], 1e-15));
        rows.orderInvariance = { perm, base, permuted: p, ok };
        return ok;
    })();

    checks.essIdentities = (() => {
        const pt = [[0, 0], [1, 1], [2, 2]];
        const ov = [[0, 2], [1, 3]];
        const n = 6;
        const rnd = mulberry32(7);
        const spans = Array.from({ length: n }, () => { const s = Math.floor(rnd() * 15); return [s, s + Math.floor(rnd() * 4)]; });
        const u = sampleUniqueness(spans);
        const ess = effectiveSampleSize(spans);
        const sumU = u.reduce((a, b) => a + b, 0);
        const avgU = averageUniqueness(spans);
        rows.ess = {
            essPointLabels: effectiveSampleSize(pt),
            essOverlapping: ess,
            n,
            essLeqN: ess <= n + 1e-12,
            sumMatchesEss: close(sumU, ess, 1e-15),
            avgMatchesEssOverN: close(avgU, ess / n, 1e-15),
            empty: sampleUniqueness([]),
            emptyAvg: averageUniqueness([]),
            emptyEss: effectiveSampleSize([]),
        };
        return close(effectiveSampleSize(pt), 3, 1e-15)
            && ess > 0 && ess <= n + 1e-12
            && close(sumU, ess, 1e-15) && close(avgU, ess / n, 1e-15)
            && sampleUniqueness([]).length === 0 && Number.isNaN(averageUniqueness([])) && effectiveSampleSize([]) === 0;
    })();

    // ============================== B. the sequential bootstrap ========================================
    checks.sequentialBootstrapBasics = (() => {
        const spans = [[0, 1], [1, 2], [2, 3], [3, 4]];
        const a = sequentialBootstrap({ labelSpans: spans, size: 8, seed: 3 });
        const b = sequentialBootstrap({ labelSpans: spans, size: 8, seed: 3 });
        const c = sequentialBootstrap({ labelSpans: spans, size: 8, seed: 4 });
        const dflt = sequentialBootstrap({ labelSpans: spans, seed: 1 });
        const inRange = a.every((i) => i >= 0 && i < spans.length);
        rows.sequentialBasics = { a, b, c, dfltLength: dflt.length, inRange, empty: sequentialBootstrap({ labelSpans: [] }) };
        return a.length === 8 && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c) && inRange && dflt.length === spans.length && sequentialBootstrap({ labelSpans: [] }).length === 0;
    })();

    // (FINDING 1) the draw weight is the uniqueness SUM, not the average -> length bias.
    checks.sequentialFirstDrawUsesSum = (() => {
        // Two NON-overlapping labels: each has average uniqueness 1.0 by definition, so the ch.4 average
        // weight treats them equally; their uniqueness SUMS are 1 and 3 (the span lengths), so the module
        // draws the 3-bar label 3x as often.
        const spans = [[0, 0], [1, 3]];
        const u = sampleUniqueness(spans);
        const seeds = 40000;
        const mc = mcDraws((sp, sz, sd) => sequentialBootstrap({ labelSpans: sp, size: sz, seed: sd }), spans, seeds, 0, 2);
        const pB = mc.first[1];
        const pBsumWeight = 3 / (1 + 3);       // the module's actual: sums 1 vs 3
        const pBavgWeight = 0.5;               // if it used the average (both 1.0)
        // a 3-label disjoint witness too: lengths 1,2,3 -> probs 1/6,2/6,3/6 vs 1/3 each
        const spans3 = [[0, 0], [1, 2], [3, 5]];
        const mc3 = mcDraws((sp, sz, sd) => sequentialBootstrap({ labelSpans: sp, size: sz, seed: sd }), spans3, seeds, 0, 1);
        rows.sequentialFirstDraw = {
            spans, avgUniqueness: u, spanLengths: spans.map(spanLen),
            sumA: u[0] * spanLen(spans[0]), sumB: u[1] * spanLen(spans[1]),
            measuredFirstDrawFreqB: pB, intendedIfAverage: pBavgWeight, moduleSumWeight: pBsumWeight,
            tol: 2.5 * se(pBsumWeight, seeds), seeds,
            disjoint3: { spans: spans3, measured: mc3.first, moduleSumWeight: [1 / 6, 2 / 6, 3 / 6], intendedIfAverage: [1 / 3, 1 / 3, 1 / 3] },
        };
        return Math.abs(pB - pBsumWeight) <= 2.5 * se(pBsumWeight, seeds);
    })();

    // (FINDING 2) the conditional law is the static-numerator/count heuristic, NOT AFML's reweighting. Pin the
    // module's own law as the check, and register the AFML gap in `rows`/`findings`.
    checks.sequentialConditionalLaw = (() => {
        const spans = [[0, 1], [0, 1], [2, 3], [2, 3]]; // two 2-label clusters
        const seeds = 60000;
        const mc = mcDraws((sp, sz, sd) => sequentialBootstrap({ labelSpans: sp, size: sz, seed: sd }), spans, seeds, 0, 2);
        const count = [1, 0, 0, 0]; // conditioned on first draw === 0
        const mod = moduleWeights(spans, count);
        const afmlW = [0, 1, 2, 3].map((i) => avgUniqOfLast(spans, [0], i));
        const afmlTotal = afmlW.reduce((a, b) => a + b, 0);
        const afmlP = afmlW.map((x) => x / afmlTotal);
        const tol = 2.5 * se(0.3, mc.condCount);
        const matches = mc.second.every((p, i) => Math.abs(p - mod.p[i]) <= tol);
        rows.sequentialConditional = {
            spans, condCount: mc.condCount,
            moduleP: mod.p, moduleW: mod.w,
            measuredSecondDraw: mc.second,
            afmlP, afmlW,
            tvDistance: tv(mod.p, afmlP),
            tol, matches,
        };
        return matches;
    })();

    // (FINDING 3) a span with start > end yields NaN or -0 rather than abstaining, and poisons the ESS.
    checks.invalidSpanHandling = (() => {
        const emptySpan = sampleUniqueness([[0, 2], [5, 4]]);      // len = 0 -> 0/0 = NaN
        const negSpan = sampleUniqueness([[0, 2], [6, 4]]);        // len = -1 -> 0/-1 = -0
        const essPoison = effectiveSampleSize([[0, 2], [5, 4]]);
        rows.invalidSpans = {
            emptySpan, negSpan,
            isNaN: Number.isNaN(emptySpan[1]),
            isNegZero: Object.is(negSpan[1], -0),
            essPoison,
            note: 'a span of zero or negative length is never validated; sampleUniqueness returns NaN (len 0) or -0 (len < 0) for it, and the NaN poisons effectiveSampleSize (sum) to NaN while the -0 does not — an inconsistent degenerate-input contract (the module docstring says uniqueness is "in (0, 1]").',
        };
        return Number.isNaN(emptySpan[1]) && Object.is(negSpan[1], -0) && Number.isNaN(essPoison);
    })();

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = (typeof v === 'object' && v && typeof v.then === 'function') ? await v : v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const findingSumWeight = {
        claim: 'the sequential bootstrap draws index i with probability proportional to its "running average uniqueness / (1 + pick count)" (module comment) and implements the Lopez de Prado ch.4 sequential bootstrap (module header)',
        witness: rows.sequentialFirstDraw,
        note: 'the numerator is the uniqueness SUM (`avgU[i] = acc`), not the average (`acc / (e - s + 1)`). The comment says "running average uniqueness" and the ch.4 weight IS the average, so the draw is biased toward LONG labels. Cleanest witness: two NON-overlapping labels are both maximally unique (average uniqueness 1.0 each), so the ch.4 weight is 50/50 — but with a 1-bar label [0,0] and a 3-bar label [1,3] the sums are 1 and 3 and the module draws the 3-bar label first 3x as often (measured 0.750 vs the intended 0.500, ~40x the MC SE). A 3-label disjoint witness (lengths 1,2,3) reads first-draw probabilities 1/6, 2/6, 3/6 instead of 1/3 each. The bias grows without bound in the span-length ratio. LATENT/test-only: `sequentialBootstrap` is called only by the test suite (no shipped importer), and the shipped uniqueness path (`hivemind/training/sample_weights.js#overlapUniqueness`, average) is correct and matches `sampleUniqueness` bit-for-bit. The shipped check asserts only length/determinism/range, so it cannot detect this (the F-68 class).',
    };
    const findingNotAFML = {
        claim: 'the module implements the AFML ch.4 sequential bootstrap (header reference)',
        witness: rows.sequentialConditional,
        note: 'the implemented heuristic is `uniqueness_sum / (1 + pick_count)` with a STATIC numerator; the ch.4 reference recomputes each candidate\'s AVERAGE uniqueness against the CURRENT selection (so the numerator is conditional and the span overlaps of what has been drawn matter). On the two-cluster fixture [[0,1],[0,1],[2,3],[2,3]], after the first draw the module gives the just-drawn label P=1/7 and the other three 2/7 each, while the reference gives 1/6, 1/6, 1/3, 1/3 (it prefers a label from the OTHER cluster, whose conditional uniqueness is 1.0). Total-variation gap 0.119. So the module\'s bootstrap does not respect uniqueness the way its cited reference does. LATENT/test-only (as above).',
    };
    const findingInvalidSpan = {
        claim: 'uniqueness is "in (0, 1]" and a feature/base case that cannot be computed abstains',
        witness: rows.invalidSpans,
        note: 'spans are never validated. A zero-length span (start = end + 1) returns NaN (0/0) and a negative-length span returns -0 (0/-1); a single NaN span makes `effectiveSampleSize` NaN (it is a plain sum) while a -0 span does not. No throw, no abstain — just an inconsistent degenerate value.',
    };

    const verdict = {
        note: 'L10-bx..: `analysis/uniqueness.js` is the reference implementation of Lopez de Prado ch.4 sample uniqueness (it is NOT imported by shipped code — the hot path may not import `analysis/`, and `hivemind/training/sample_weights.js` re-implements the average uniqueness and is cross-checked against it). PASSES the pre-registered read: `sampleUniqueness` reproduces an INDEPENDENT recompute (a scan-all-spans per-bar count, a different data structure) exactly on the documented fixtures ([[0,2],[1,3]] -> 2/3, 2/3; [[0,0],[0,5]] -> 1/2, 11/12) and on seeded random spans, matches the SHIPPED `overlapUniqueness` to < 1e-15, is per-label order-invariant, and the ESS identities hold (point labels -> n; ESS = sum of uniqueness; averageUniqueness = ESS/n; ESS <= n; empty -> []/NaN/0). `sequentialBootstrap` returns exactly `size` in-range indices, is deterministic per seed and different across seeds, defaults size to n, and returns [] on empty. FINDINGS: (0) the draw weight is the uniqueness SUM, not the average — two labels with IDENTICAL average uniqueness (0.5) but different lengths are drawn in proportion to their lengths (measured first-draw frequency 0.667 vs the intended 0.5 on [0,0] vs [0,1]); (1) the implemented heuristic (static numerator, count-only conditioning) is NOT the AFML ch.4 sequential bootstrap it cites — the reference recomputes each candidate\'s average uniqueness against the current selection, and on a two-cluster fixture the second-draw distributions differ by 0.119 total variation; (2) spans are unvalidated: a zero-length span returns NaN and a negative-length span -0, and a single NaN poisons the ESS. All findings are latent/test-only: no shipped importer, and no finding can move a golden.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            sequentialDrawUsesSum: findingSumWeight,
            sequentialNotAFML: findingNotAFML,
            invalidSpanHandling: findingInvalidSpan,
        },
        scope: {
            referenceOnly: ['sampleUniqueness', 'averageUniqueness', 'effectiveSampleSize', 'sequentialBootstrap'],
            shippedCounterpart: 'hivemind/training/sample_weights.js#overlapUniqueness (average uniqueness; matches sampleUniqueness bit-for-bit) + sampleWeights/normalizeWeights',
            why: 'no shipped module imports `analysis/uniqueness.js` (grep: only the test suite and the lock registry) — the hot path uses the `sample_weights.js` re-implementation, which this cycle confirms is the CORRECT average-uniqueness form. So L10-bx/by are test-only reads of a reference module, and L10-bz is a robustness gap; nothing here moves a report and no fold-back row is due.',
        },
    };

    return { config: { mcSeeds: 40000, conditionalSeeds: 60000, fixtures: 8 }, rows, validation: resolved, verdict };
}
