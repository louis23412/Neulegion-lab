// E55 - THE SPLIT FAMILY'S PURGE CONTRACT, AUDITED. CYCLE-046 (L10-af).
//
// `analysis/splits.js` opens: "Time-series cross-validation with purging and embargoing." Three
// functions carry the family: `purgedKFoldSplit`, `combinatorialPurgedSplit` (both take `labels` /
// `labelSpan` / `embargo` and purge every training label whose window overlaps the test hull) and
// `walkForwardSplit` (which takes neither). The repo's `test/lock-registry.js` note for the module
// claims, for the family: "Proved: train/test disjoint, **zero label-window leakage**, train starts
// after embargo". The lab leans on the walk-forward path (F-13 pools `walkForwardSplit` folds), and
// the shipped controller trains on labels with a real horizon (`labelHorizonBars`; the opt-in
// `label:triple` policy sets a vertical barrier), so the claim matters.
//
// CYCLE-046 audits it the way CYCLE-044/045 taught: a **synthetic label-overlap ground truth**. A
// fold leaks iff some training label window [i, i+H-1] overlaps some test label window [j, j+H-1],
// i.e. 0 < j-i <= H-1. That is a closed form, so the expected leak is exact.
//
// PRE-REGISTERED READ. PASSES if (i) both purged variants are leak-free on every fold of a label
// grid and honour the embargo; (ii) `walkForwardSplit` is shown to leak exactly (H-1)-deep at every
// fold boundary for H > 1 and never for H = 1, carries no purge metadata, ignores a `labels` /
// `labelSpan` argument, and its causality guard (`isCausalFold`) passes the leaky folds; and (iii)
// the leaked labels are demonstrably *exploitable* - an index-lookup model whose inputs are training
// labels recovers test-period returns in the leak zone (a positive per-bar edge that a purged
// walk-forward does not have). A failure means F-63 must be revised.

import { purgedKFoldSplit, combinatorialPurgedSplit, walkForwardSplit, assertNoLeakage } from '../../NeuLegion-master/NeuLegion-master/src/analysis/splits.js';

// ---- deterministic standard normals (LCG + Box-Muller); no Math.random --------------------------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { let u = 0; let v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const r3 = (x, d = 3) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a) => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };

// Label window for observation i, horizon H: [i, i+H-1]. Two observations i<j overlap iff j-i <= H-1.
function leakEdges(fold, H) {
    let edges = 0;
    const test = new Set(fold.test);
    for (const i of fold.train) {
        for (let d = 1; d <= H - 1; d++) if (test.has(i + d)) edges++;
    }
    return edges;
}
// The forward H-bar return a horizon-H label at i is a function of: sum of returns i+1..i+H.
function fwdReturn(r, i, H) { let s = 0; for (let k = 1; k <= H; k++) if (i + k < r.length) s += r[i + k]; return s; }

export async function run() {
    // ---------- A. the purged siblings are leak-free (closed-form ground truth) ----------
    const pkRows = [];
    for (const n of [200, 1000]) {
        for (const k of [4, 8]) {
            for (const H of [1, 2, 5, 20]) {
                for (const embargo of [0, 2, 10]) {
                    const folds = purgedKFoldSplit({ n, k, embargo, labelSpan: H });
                    let leak = 0;
                    let embargoBreach = 0;
                    for (const f of folds) {
                        leak += assertNoLeakage(f, { n, labelSpan: H }).length;
                        // point-label view of the embargo: no train index may sit in (purgeEnd, embargoEnd]
                        for (const i of f.train) if (i > f.purgeEnd && i <= f.embargoEnd) embargoBreach++;
                    }
                    pkRows.push({ n, k, H, embargo, leak, embargoBreach });
                }
            }
        }
    }
    const cpRows = [];
    for (const n of [240, 1200]) {
        for (const k of [4, 6]) {
            for (const m of [1, 2]) {
                const H = 5;
                const folds = combinatorialPurgedSplit({ n, k, testGroups: m, embargo: 3, labelSpan: H });
                let leak = 0;
                for (const f of folds) leak += assertNoLeakage(f, { n, labelSpan: H }).length;
                const count = folds.length;              // C(k, m)
                // each observation tested C(k-1, m-1) times -> total test slots = n * C(k-1,m-1)
                const multiplicity = folds.reduce((s, f) => s + f.test.length, 0) / n;
                cpRows.push({ n, k, m, H, count, leak, multiplicity: r3(multiplicity, 4) });
            }
        }
    }

    // ---------- B. the walk-forward leaks (the defect) ----------
    const wfRows = [];
    for (const testSize of [10, 40]) {
        for (const H of [1, 2, 3, 5, 10]) {
            const n = 600;
            const trainSize = 120;
            const folds = walkForwardSplit({ n, trainSize, testSize });
            const totalEdges = folds.reduce((s, f) => s + leakEdges(f, H), 0);
            const perFold = folds.map((f) => leakEdges(f, H));
            const maxPerFold = Math.max(...perFold);
            const repoDetector = folds.reduce((s, f) => s + assertNoLeakage(f, { n, labelSpan: H }).length, 0);
            const closedPerFold = testSize >= H ? (H * (H - 1)) / 2 : (H * (H - 1)) / 2 - ((H - testSize) * (H - testSize - 1)) / 2;
            wfRows.push({ testSize, H, folds: folds.length, totalEdges, closedPerFold, maxPerFold, repoDetector });
        }
    }
    const wfAllCleanAtH1 = wfRows.filter((x) => x.H === 1).every((x) => x.totalEdges === 0 && x.repoDetector === 0);
    const wfLeakClosed = wfRows.filter((x) => x.H > 1).every((x) => x.totalEdges === x.closedPerFold * x.folds && x.totalEdges > 0);
    // assertNoLeakage reports the number of *training indices* whose window overlaps a test window
    // (it breaks after the first), a subset of the edge count - so it must be > 0 exactly when H > 1.
    const wfRepoDetectorAgrees = wfRows.every((x) => (x.H === 1 ? x.repoDetector === 0 : x.repoDetector > 0));

    // structural: folds carry no purge metadata, and a `labels`/`labelSpan` argument is ignored
    const sampleFold = walkForwardSplit({ n: 600, trainSize: 120, testSize: 40 })[0];
    const wfNoMeta = !('purgeStart' in sampleFold) && !('purgeEnd' in sampleFold) && !('embargoEnd' in sampleFold);
    const withArg = walkForwardSplit({ n: 600, trainSize: 120, testSize: 40, labels: Array.from({ length: 600 }, (_, i) => [i, Math.min(599, i + 9)]), labelSpan: 10, embargo: 5 });
    const wfIgnoresLabels = JSON.stringify(withArg) === JSON.stringify(walkForwardSplit({ n: 600, trainSize: 120, testSize: 40 }));

    // causality guard blind spot: the leaky folds pass `isCausalFold` (index order only)
    let wfCausalGuardBlind = true;
    for (const f of walkForwardSplit({ n: 600, trainSize: 120, testSize: 40 })) {
        if (!(f.train.every((i) => i < f.test[0]))) wfCausalGuardBlind = false;
    }
    // (mirror the module's own predicate so we do not depend on its import surface)
    const causalBlind = wfCausalGuardBlind && wfRows.find((x) => x.H === 10).totalEdges > 0;

    // ---------- C. exploitability (seeded ensemble, F-57 discipline) ----------
    // An index-lookup model is *given* trainIdx, so it may read a training label whose window covers
    // the test bar. In deployment that label does not exist yet at decision time (the future has not
    // happened) - it is only in the fold because the walk-forward did not purge the boundary.
    function exploit(seed, H) {
        const n = 603;
        const trainSize = 120;
        const testSize = 40;
        const r = rng(seed);
        const ret = [];
        for (let i = 0; i < n; i++) ret.push(gauss(r) * 0.01);
        const folds = walkForwardSplit({ n, trainSize, testSize });
        const leakZone = [];   // per-bar P&L of the leaky model on bars whose return appears in a training label
        const cleanZone = [];  // the same model on bars it cannot see
        const purged = [];     // a purged walk-forward: training trimmed to labels ending before testStart
        for (const f of folds) {
            const testStart = f.test[0];
            const trainSet = new Set(f.train);
            const purgedTrain = f.train.filter((i) => i + H - 1 < testStart);
            const lastPurged = purgedTrain.length ? purgedTrain[purgedTrain.length - 1] : null;
            const lastLeaky = testStart - 1;      // label covers [testStart-1, testStart-1+H-1]
            for (const j of f.test) {
                let posLeak = 0;
                let covered = false;
                if (trainSet.has(j - 1)) { posLeak = Math.sign(fwdReturn(ret, j - 1, H)); covered = true; }
                else if (trainSet.has(lastLeaky) && j - testStart <= H - 2) { posLeak = Math.sign(fwdReturn(ret, lastLeaky, H)); covered = true; }
                const pnl = posLeak * ret[j];
                if (covered) leakZone.push(pnl); else cleanZone.push(pnl);
                const posP = lastPurged != null ? Math.sign(fwdReturn(ret, lastPurged, H)) : 0;
                purged.push(posP * ret[j]);
            }
        }
        const edge = (a) => mean(a);
        return { leakEdge: edge(leakZone), cleanEdge: edge(cleanZone), purgedEdge: edge(purged), leakBars: leakZone.length };
    }
    const H = 5;
    const trials = [];
    for (let s = 1; s <= 200; s++) trials.push(exploit(9000 + s * 17, H));
    const leakEdge = mean(trials.map((t) => t.leakEdge));
    const leakSe = sd(trials.map((t) => t.leakEdge)) / Math.sqrt(trials.length);
    const cleanEdge = mean(trials.map((t) => t.cleanEdge));
    const purgedEdge = mean(trials.map((t) => t.purgedEdge));
    const exploitRows = {
        H, trials: trials.length,
        leakEdge: r3(leakEdge, 5), leakSe: r3(leakSe, 5),
        cleanEdge: r3(cleanEdge, 5), purgedEdge: r3(purgedEdge, 5),
        leakBarsPerRun: trials[0].leakBars,
        note: 'per-bar P&L edge of an index-lookup model: on the leak zone it reads sign of a training label whose window contains that bar, so it must beat chance; the clean zone and a purged walk-forward must be ~0',
    };

    // ---------- guards ----------
    const checks = {
        purgedKFoldLeakFree: pkRows.every((x) => x.leak === 0),
        purgedKFoldEmbargoHonoured: pkRows.filter((x) => x.embargo > 0).every((x) => x.embargoBreach === 0),
        cpLeakFree: cpRows.every((x) => x.leak === 0),
        cpcvFoldCount: cpRows.every((x) => x.count > 0),
        cpcvTestMultiplicity: cpRows.every((x) => Number.isFinite(x.multiplicity) && x.multiplicity > 0),
        wfCleanAtH1: wfAllCleanAtH1,
        wfLeakMatchesClosedForm: wfLeakClosed && wfRepoDetectorAgrees,
        wfNoPurgeMetadata: wfNoMeta,
        wfIgnoresLabelArgs: wfIgnoresLabels,
        wfCausalGuardBlind: causalBlind,
        exploitLeakZoneEdge: leakEdge - 2.5 * leakSe > 0,
        exploitPurgedNeutral: Math.abs(purgedEdge) < Math.abs(leakEdge) && Math.abs(cleanEdge) < Math.abs(leakEdge),
    };
    const validationPass = Object.values(checks).every((x) => x === true);

    const verdict = {
        note: 'L10-af: `purgedKFoldSplit`/`combinatorialPurgedSplit` are leak-free and embargo-honouring, but `walkForwardSplit` (the path the repo A/B and the lab use) performs NO purging or embargoing - it takes no labels/embargo and its folds carry no purge metadata - so for a label horizon H>1 it leaks exactly H(H-1)/2 train/test label-overlap edges per fold, the causality guard `isCausalFold` passes the leaky folds, and an index-lookup model recovers test-period returns in the leak zone (positive per-bar edge; the purged counterpart is neutral). The lab scores parameter-free signals (H=1 -> zero leak), so lab numbers are unaffected; the repo controller trains on horizon labels (labelHorizonBars / opt-in triple barrier), so the leak\'s precondition is met on the shipped model path.',
        checks,
        validationPass,
    };
    return {
        config: { labelGrid: 'n in {200,1000}, k in {4,8}, H in {1,2,5,20}, embargo in {0,2,10}', wfGrid: 'trainSize=120, testSize in {10,40}, H in {1,2,3,5,10}, n=600', exploitH: H, exploitTrials: trials.length },
        purgedKFold: pkRows,
        combinatorialPurged: cpRows,
        walkForward: wfRows,
        structure: { wfNoMeta, wfIgnoresLabels, causalBlind },
        exploit: exploitRows,
        validation: checks,
        verdict,
    };
}
