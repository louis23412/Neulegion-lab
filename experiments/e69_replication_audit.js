// E69 - SEED REPLICATION, AUDITED: `analysis/replication.js`. CYCLE-061 (L10-cj ...).
//
// `analysis/replication.js` (round 26, R26-13) is the honest-summary layer: a single-seed ordering is not a
// ranking (Bouthillier et al. 2019), so the level is the **interquartile mean** (Agarwal et al. 2021), the
// interval is a **stratified bootstrap** resampling within each seed, and the spread is split into
// seed/fold/residual fractions. `pairedVarianceRatio` is the CRN criterion (Glasserman & Yao 1992). It is
// SHIPPED: `analyze.js` imports `seedDistribution`/`formatSeedReplication` behind `--seeds`, aggregating a
// multi-seed run into `replication.json`. Pure + seeded, so every number is reproducible.
//
// PRE-REGISTERED READ. PASSES if: (i) `interquartileMean` is the mean of the rank-slice middle that its own
// doc describes (drop the lowest/highest `floor(n/4)`, mean the rest; `< 4` values -> the plain mean; non-finite
// filtered; empty -> NaN); (ii) `stratifiedBootstrapCI` is deterministic per seed, preserves each stratum's
// size in every replicate, returns lo <= median <= hi, and abstains on an empty / all-non-finite input;
// (iii) the CI's empirical coverage of a known population mean is near nominal; (iv) `varianceComponents`
// satisfies `total = between + within + residual` and the fractions sum to 1, with the pure-between-seed,
// pure-within-seed and repeated-cell cases exact; (v) `pairedVarianceRatio` is `var(paired)/var(unpaired)` with
// `reduction = 1 - ratio`, abstaining on short / zero-unpaired-variance input; (vi) `seedDistribution` carries
// the documented fields and (vii) `formatSeedReplication` renders the level, the CI and the fractions.
//
// The DEFECTS are reported in `findings`:
//   - the IQM drops the lowest/highest `floor(n/4)` by RANK, not a quarter of the MASS: it differs from the
//     cited Agarwal et al. reference (a quantile-filter of the middle 50%), sometimes sharply on skewed data.
//   - `formatSeedReplication` prints its OWN `alpha` in the CI label rather than the distribution's, so a
//     distribution built at `alpha = 0.10` is labelled "95%CI".

import {
    interquartileMean, stratifiedBootstrapCI, varianceComponents, seedDistribution, pairedVarianceRatio,
    formatSeedReplication,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/replication.js';
import { mulberry32 } from '../../NeuLegion-master/NeuLegion-master/src/legion/rng.js';

const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const close = (a, b, tol = 1e-12) => (a === b) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// numpy-default linear-interpolation quantile, for the rliable/Agarwal reference IQM.
const quantile = (sorted, p) => {
    const n = sorted.length;
    if (n === 0) return NaN;
    if (n === 1) return sorted[0];
    const pos = p * (n - 1);
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};
// Agarwal et al. (rliable): keep the values inside [q1, q3] and mean them.
const iqmReference = (values) => {
    const v = (Array.isArray(values) ? values : []).filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
    if (!v.length) return NaN;
    const q1 = quantile(v, 0.25), q3 = quantile(v, 0.75);
    return mean(v.filter((x) => x >= q1 && x <= q3));
};
const gauss = (rnd) => (rnd() + rnd() + rnd() + rnd() + rnd() + rnd() - 3) * Math.sqrt(2); // approx N(0,1)

export async function run() {
    const checks = {};
    const rows = {};

    // ============================== A. the IQM contract ===============================================
    checks.iqmContract = (() => {
        const cases = [
            { v: [], want: NaN },
            { v: [7], want: 7 },
            { v: [1, 3], want: 2 },
            { v: [1, 2, 3], want: 2 },
            { v: [1, 2, 3, 4], want: 2.5 },               // slice(1,3) -> [2,3]
            { v: [1, 2, 3, 4, 5], want: 3 },              // slice(1,4) -> [2,3,4]
            { v: [1, 2, 3, 4, 5, 6, 7, 8], want: 4.5 },   // slice(2,6) -> [3,4,5,6]
            { v: [5, 1, 4, 2, 3], want: 3 },              // unsorted -> sorted [1..5]
        ];
        let exact = true;
        for (const c of cases) {
            const got = interquartileMean(c.v);
            if (Number.isNaN(c.want)) { if (!Number.isNaN(got)) exact = false; }
            else if (!close(got, c.want, 1e-12)) exact = false;
        }
        const filtered = close(interquartileMean([1, NaN, 2, Infinity, 3, 4]), 2.5, 1e-12); // [1,2,3,4]
        const monotone = interquartileMean([1, 2, 3, 4, 5]) <= interquartileMean([2, 3, 4, 5, 6]);
        rows.iqm = { exact, filtered, monotone };
        return exact && filtered && monotone;
    })();

    // (FINDING) the IQM is the RANK-slice middle, not the cited Agarwal quantile-filter.
    checks.iqmIsNotTheCitedReference = (() => {
        const witness = [0, 0, 5, 10];
        const module = interquartileMean(witness);
        const reference = iqmReference(witness);
        const rnd = mulberry32(99);
        let differing = 0, maxDiff = 0;
        for (let p = 0; p < 300; p++) {
            const n = 5 + Math.floor(rnd() * 8);
            const v = [];
            for (let i = 0; i < n; i++) v.push(Math.exp(gauss(rnd)) - 1); // right-skewed
            const a = interquartileMean(v), b = iqmReference(v);
            if (!close(a, b, 1e-9)) differing++;
            maxDiff = Math.max(maxDiff, Math.abs(a - b));
        }
        rows.iqmReference = {
            witness, module: module, reference: reference, witnessGap: Math.abs(module - reference),
            skewedPanelsDiffering: differing, skewedPanels: 300, maxSkewedGap: maxDiff,
            note: 'the module sorts and takes `sorted.slice(floor(n/4), n - floor(n/4))` - it drops a fixed COUNT (floor(n/4)) from each END BY RANK. The cited Agarwal et al. (arXiv 2108.13264) / rliable IQM drops the values outside [q1, q3] (a MASS rule). For [0,0,5,10] the module reads 2.5 (mean of [0,5]) while the reference reads 1.6667 (mean of [0,0,5]). On 300 right-skewed panels (5-12 values) the two disagree on a large fraction, with a gap up to the value measured. The doc says "the interquartile mean (IQM) ... is the summary Agarwal et al. recommend" - it is not that estimator.',
        };
        // pin the actual behaviour (a real divergence the claim does not admit)
        return !close(module, reference, 1e-9) && differing > 0;
    })();

    // ============================== B. the stratified bootstrap =======================================
    checks.stratifiedBootstrapContract = (() => {
        const strata = [[0.1, -0.2, 0.3, 0.05], [0.4, 0.5, -0.1, 0.2, 0.3], [-0.3, 0.1, 0.2]];
        const total = 4 + 5 + 3;
        const a = stratifiedBootstrapCI({ strata, seed: 4242, nBoot: 500 });
        const b = stratifiedBootstrapCI({ strata, seed: 4242, nBoot: 500 });
        const c = stratifiedBootstrapCI({ strata, seed: 4243, nBoot: 500 });
        const deterministic = deepEq(a, b);
        const seedMoves = !deepEq(a, c);
        const ordered = a.lo <= a.median && a.median <= a.hi;
        // every replicate must carry exactly the original count (sizes preserved within each stratum)
        const sizes = stratifiedBootstrapCI({ strata, statistic: (s) => s.length, seed: 7, nBoot: 200 });
        const sizePreserved = sizes.available && close(sizes.median, total, 0) && close(sizes.hi, total, 0) && close(sizes.lo, total, 0);
        const empty = stratifiedBootstrapCI({ strata: [] });
        const allNonFinite = stratifiedBootstrapCI({ strata: [[NaN, Infinity]] });
        const nanIsHonest = stratifiedBootstrapCI({ strata: [[1, 2], [3, NaN]] });
        rows.bootstrap = {
            deterministic, seedMoves, ordered, sizePreserved, total,
            emptyAbstains: empty.available === false, allNonFiniteAbstains: allNonFinite.available === false,
            points: a.points, nBoot: a.nBoot,
            nanFiltered: nanIsHonest.available === true,
            lo: a.lo, hi: a.hi, median: a.median,
        };
        return deterministic && seedMoves && ordered && sizePreserved
            && empty.available === false && allNonFinite.available === false;
    })();

    // (calibration) the CI's empirical coverage of a known population mean.
    checks.bootstrapCoverage = (() => {
        const R = 400, nBoot = 400;
        let covered = 0;
        for (let r = 0; r < R; r++) {
            const rnd = mulberry32(1000 + r);
            const strata = [];
            for (let s = 0; s < 12; s++) {
                const g = [];
                for (let i = 0; i < 6; i++) g.push(gauss(rnd));
                strata.push(g);
            }
            const ci = stratifiedBootstrapCI({ strata, statistic: mean, nBoot, seed: 500 + r });
            if (ci.available && ci.lo <= 0 && 0 <= ci.hi) covered++;
        }
        const cov = covered / R;
        rows.coverage = { R, nBoot, coverage: cov, note: 'the CIs are for the MEAN here (statistic = mean) of 12 i.i.d. zero-mean strata of 6; the population mean is 0. Percentile-bootstrap coverage is asymptotic, so a small shortfall from 0.95 is expected.' };
        return cov >= 0.88 && cov <= 0.995;
    })();

    // ============================== C. the variance decomposition =====================================
    checks.varianceDecomposition = (() => {
        const mkCells = (bySeed) => {
            const cells = [];
            for (const [seed, values] of Object.entries(bySeed)) values.forEach((value, fold) => cells.push({ seed: Number(seed), fold, value }));
            return cells;
        };
        const betweenOnly = varianceComponents({ cells: mkCells({ 1: [1, 1, 1], 2: [3, 3, 3], 3: [5, 5, 5], 4: [7, 7, 7] }) });
        const withinOnly = varianceComponents({ cells: mkCells({ 1: [1, 2, 3, 4] }) });
        const residualOnly = varianceComponents({ cells: [{ seed: 1, fold: 0, value: 1 }, { seed: 1, fold: 0, value: 3 }, { seed: 1, fold: 1, value: 2 }, { seed: 1, fold: 1, value: 2 }] });
        const mixed = varianceComponents({ cells: mkCells({ 1: [0.1, -0.1, 0.2, 0], 2: [0.3, 0.1, -0.2, 0.2], 3: [0.05, 0.15, 0.25, -0.05] }) });
        const identity = (c, tol = 1e-9) => close(c.totalVariance, c.seedVariance + c.foldVariance + c.residualVariance, tol);
        const fractions = (c) => close((c.seedFraction || 0) + (c.foldFraction || 0) + (c.residualFraction || 0), 1, 1e-9);
        const shortInput = varianceComponents({ cells: [{ seed: 1, fold: 0, value: 1 }] });
        rows.variance = {
            betweenOnlySeedFraction: betweenOnly.seedFraction,
            betweenOnlyExact: close(betweenOnly.seedFraction, 1, 1e-9) && close(betweenOnly.foldFraction, 0, 1e-9),
            withinOnlyFoldFraction: withinOnly.foldFraction,
            withinOnlyExact: close(withinOnly.seedFraction, 0, 1e-9) && close(withinOnly.foldFraction, 1, 1e-9),
            residualOnlyFraction: residualOnly.residualFraction,
            residualOnlyExact: close(residualOnly.residualFraction, 1, 1e-9),
            mixedIdentity: identity(mixed), mixedFractions: fractions(mixed),
            mixedSeedFraction: mixed.seedFraction, mixedFoldFraction: mixed.foldFraction, mixedResidualFraction: mixed.residualFraction,
            shortAbstains: shortInput.available === false,
            totalIsPopulationVariance: false,
        };
        // total is the population (divide-by-n) variance about the grand mean
        const vals = mkCells({ 1: [0.1, -0.1, 0.2, 0], 2: [0.3, 0.1, -0.2, 0.2], 3: [0.05, 0.15, 0.25, -0.05] }).map((c) => c.value);
        const g = mean(vals);
        rows.variance.totalIsPopulationVariance = close(mixed.totalVariance, mean(vals.map((x) => (x - g) ** 2)), 1e-12);
        return rows.variance.betweenOnlyExact && rows.variance.withinOnlyExact && rows.variance.residualOnlyExact
            && identity(betweenOnly) && identity(withinOnly) && identity(residualOnly) && identity(mixed)
            && fractions(mixed) && shortInput.available === false && rows.variance.totalIsPopulationVariance;
    })();

    // ============================== D. the CRN criterion ==============================================
    checks.pairedVarianceContract = (() => {
        const rnd = mulberry32(31);
        const paired = [], unpaired = [];
        for (let i = 0; i < 40; i++) { paired.push((rnd() - 0.5) * 0.1); unpaired.push((rnd() - 0.5) * 4); }
        const r = pairedVarianceRatio({ paired, unpaired });
        const varOf = (v) => { const m = mean(v); return v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1); };
        const ratioExact = close(r.varianceRatio, varOf(paired) / varOf(unpaired), 1e-12);
        const reductionExact = close(r.varianceReduction, 1 - varOf(paired) / varOf(unpaired), 1e-12);
        const crnHelps = r.varianceReduction > 0;
        const short = pairedVarianceRatio({ paired: [1], unpaired: [1, 2] });
        const zeroVar = pairedVarianceRatio({ paired: [1, 2, 3], unpaired: [5, 5, 5] });
        const increase = pairedVarianceRatio({ paired: [1, -1, 2, -2], unpaired: [0.1, -0.1, 0.05, -0.05] });
        rows.paired = {
            ratioExact, reductionExact, crnHelps, ratio: r.varianceRatio, reduction: r.varianceReduction,
            shortAbstains: short.available === false, zeroVarAbstains: zeroVar.available === false,
            zeroVarReason: zeroVar.reason, increaseIsNegative: increase.varianceReduction < 0,
        };
        return ratioExact && reductionExact && crnHelps && short.available === false && zeroVar.available === false && increase.varianceReduction < 0;
    })();

    // ============================== E. seedDistribution + the formatter ===============================
    checks.seedDistributionStructure = (() => {
        const perSeed = [
            { seed: 1, values: [0.1, 0.2, -0.1, 0.3] },
            { seed: 2, values: [0.15, 0.05, 0.25, 0.2] },
            { seed: 3, values: [-0.05, 0.1, 0.3, 0.15] },
        ];
        const d = seedDistribution({ perSeed, nBoot: 400, seed: 77 });
        const flat = perSeed.flatMap((p) => p.values);
        const ok = d.available === true
            && deepEq(d.seeds, [1, 2, 3])
            && d.n === flat.length
            && deepEq(d.foldsPerSeed, [4, 4, 4])
            && close(d.mean, mean(flat), 1e-12)
            && close(d.iqm, interquartileMean(flat), 1e-12)
            && close(d.statistic, interquartileMean(flat), 1e-12)
            && d.ci && d.ci.available === true
            && d.components && d.components.available === true
            && typeof d.reader === 'string' && d.reader.includes('IQM');
        const empty = seedDistribution({ perSeed: [] });
        rows.distribution = { ok, ciAlpha: d.ci.alpha, emptyAbstains: empty.available === false, reader: d.reader.slice(0, 40) };
        return ok && empty.available === false;
    })();

    // (FINDING, RESTATED round 94) the formatter now labels the CI from the distribution's own
    // alpha (fixed) — a 0.10 distribution prints 90%CI without the caller passing alpha.
    checks.formatterAlphaMismatch = (() => {
        const perSeed = [{ seed: 1, values: [0.1, 0.2, 0.3, 0.4] }, { seed: 2, values: [0.15, 0.25, 0.35, 0.45] }];
        const d90 = seedDistribution({ perSeed, alpha: 0.10, nBoot: 400, seed: 5 });
        const textBad = formatSeedReplication({ label: 'seeds', dist: d90 });               // used to print 95%CI
        const textGood = formatSeedReplication({ label: 'seeds', dist: d90, alpha: 0.10 }); // explicit alpha agrees
        const labels90 = textBad.includes('90%CI') && d90.ci.alpha === 0.10;
        const goodLabels90 = textGood.includes('90%CI');
        rows.formatter = {
            ciAlpha: d90.ci.alpha, labels90, goodLabels90,
            badText: textBad, goodText: textGood,
            note: 'ROUND-94 UPDATE: fixed — formatSeedReplication reads `dist.ci.alpha` for the CI label, so a distribution built at alpha = 0.10 prints "90%CI" by default. Pre-fix it used its own `alpha = 0.05` default and mislabeled it "95%CI" (bounds were the 90% ones either way).',
        };
        return labels90 && goodLabels90;
    })();

    const findingIqm = rows.iqmReference;
    const findingFormatter = rows.formatter;

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = (v && typeof v.then === 'function') ? await v : v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-cj..: `analysis/replication.js` is the SHIPPED honest-summary layer (round 26, R26-13; `analyze.js` aggregates `--seeds` into `replication.json` via seedDistribution/formatSeedReplication). PASSES the pre-registered read: `interquartileMean` is exactly the rank-slice middle its own doc describes (drop floor(n/4) from each end, `< 4` -> plain mean, non-finite filtered, empty -> NaN); `stratifiedBootstrapCI` is deterministic per seed, seed-sensitive, preserves each stratum size in every replicate, returns lo <= median <= hi and abstains on empty/all-non-finite input; its empirical coverage of a known mean is near nominal; `varianceComponents` satisfies total = between + within + residual with the fractions summing to 1 and the pure-between-seed, pure-within-seed and repeated-cell cases exact (total is the population variance, consistently); `pairedVarianceRatio` is exactly var(paired)/var(unpaired) with reduction = 1 - ratio, abstaining on short / zero-unpaired-variance input and going negative when the pairing hurts; `seedDistribution` carries the documented fields; and `formatSeedReplication` renders the level, the CI and the fractions. FINDINGS: (0) the IQM is the RANK-slice middle, not the cited Agarwal et al. estimator (a quantile-filter of the middle 50%) - witness [0,0,5,10] reads 2.5 vs the reference 1.6667, and the two disagree on much of skewed data; (1) `formatSeedReplication` prints its OWN alpha in the CI label rather than `dist.ci.alpha`, so a distribution built at alpha = 0.10 is labelled "95%CI". Both latent/claim-level (the shipped path uses the default alpha throughout); no golden moves and no fold-back row.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            iqmIsNotTheCitedReference: findingIqm,
            formatterAlphaMismatch: findingFormatter,
        },
        scope: {
            shipped: ['analyze.js imports seedDistribution + formatSeedReplication', 'replicateAnalysis builds seedDistribution({ perSeed: runs.map(...) }) per variant and writes replication.json', 'the CLI --seeds path prints formatSeedReplication({ label, dist }) per variant'],
            why: 'replication.js is pure + seeded and only summarizes an already-scored run, so no finding can move a measured number. The shipped path uses the default alpha (0.05) for BOTH the distribution and the formatter, so the label bug is latent there; the IQM divergence is a claim-level mismatch (the module is self-consistent, it is the attribution that is wrong). No golden moves and no fold-back row is due.',
        },
    };

    return { config: { coverageR: 400, panels: 300 }, rows, validation: resolved, verdict };
}
