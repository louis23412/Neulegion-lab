# CYCLE-062 — Cluster inference: the correlations, the jackknife, the Student-t tails and the exact sign test are exact — but `clusterStability.stable` drops half of its own rule, and `signTest` underflows (L10-cl…L10-cm)

**Date:** 2028-07-25
**Goal:** `analysis/dependence.js` (round 25) is the module behind the pooled cross-stream evaluation's honest
standard error. `poolReports` concatenates one walk-forward per symbol; the large-sample Sharpe SE of Lo (2002)
assumes independent bars, which is false here (the 8 crypto majors' per-fold Sharpe series correlate 0.41–0.52,
and the 4 320 pooled bars are 288 fold windows × 8 streams), so the module takes a **cluster** view — clusters
are the independent units and a smooth statistic's SE comes from the **delete-one-cluster jackknife**. It is
**pure and imports nothing** (no I/O, no RNG, no repo imports), so it is fully auditable in isolation, and it is
**shipped** (`walkforward.js#promoteDecision` uses `pairedClusterTest`/`clusterStability`/`pairedClusterSignTest`;
`decision.js#foldConcentration` and the dependence block use the rest).

## Work

New experiment `experiments/e70_dependence_audit.js` (registered; **78 steps, 47 gated, 0 fails**; 47 ms in the
suite; **10 checks, all pass**). The audit checks the correlations and their NaN guards, the equicorrelation
identities, the fold-window grouping and `concatClusters`, the jackknife against a hand recompute, the Student-t
tails against the exact df = 1 / df = 2 closed forms, the critical-value round trip, the exact sign test, the two
paired cluster tests; then it pins two defects.

## Results

### A. The correlations are textbook (validated)

`pearsonCorrelation` is exactly `Σdₐd_b / √(Σdₐ²Σd_b²)`, `+1`/`−1` for a perfectly monotone pair, and NaN for
fewer than three points, an unequal length or a zero-variance member. `meanPairwiseCorrelation` averages the
finite pairs (`[[1,2,3,4],[1,2,3,4],[4,3,2,1]]` → `(1 − 1 − 1)/3 = −1/3`), skips a flat pair, and is NaN for a
single series.

### B. The equicorrelation design effect is Kish's (validated)

`equicorrelationDesignEffect(k, ρ) = 1 + (k−1)ρ` and `equicorrelationEffectiveSize = k/deff` exactly (K = 1 → 1);
a negative ρ legitimately *reduces* the deff; a non-positive deff abstains (NaN); `k < 1` / non-finite ρ abstain.

### C. The fold-window grouping and the jackknife are exact (validated)

`foldWindowClusters([[1,2,3,4],[5,6,7,8]], 2)` → `[[1,2,5,6],[3,4,7,8]]`, and it throws on a non-divisible panel,
a non-rectangular panel, `foldLength = 0` and an empty stream list. `concatClusters` drops exactly one cluster.
`clusterJackknife` on clusters `[[1,2],[3,4],[5,6]]` with `statistic = mean` reproduces a hand recompute exactly:
estimate **3.5**, leave-one-out **[4.5, 3.5, 2.5]**, `se = √((2/3)·2) = 1.1547005383792515`; it abstains on fewer
than two clusters (NaN `se`) and on a non-finite statistic, and throws on a non-function statistic.

### D. The Student-t tails are exact (validated)

`studentTPValue` reproduces the exact closed forms for **df = 1** (Cauchy, `P(T>t) = 0.5 − atan(t)/π`) and **df = 2**
(`P(T>t) = 0.5 − t/(2√(2+t²))`) to 5e-7 over `t ∈ {−3, −1.5, −0.5, 0, 0.5, 1.5, 3}`; `t = 0` gives exactly
**0.5** (one-sided) / **1** (two-sided); the tails are symmetric (`P(T>t) + P(T>−t) = 1`); the two-sided value is
`min(1, 2·oneSided)`; the ±Infinity tails are 0/1; a bad `df` is NaN. `regularizedIncompleteBeta` matches
`I_x(1,1) = x`, `I_{0.5}(2,3) = 0.6875`, `I_{0.5}(4,4) = 0.5` and the 0/1 boundaries.

### E. `studentTCritical` inverts the tail exactly (validated)

At df = 35 it reads **1.6895724578** (one-sided 0.05; table 1.68957) and **2.0301079283** (two-sided 0.05; table
2.03011), and it round-trips through `studentTPValue` to 1e-6 at df ∈ {3, 10, 35, 200} on both tails; a bad `df`
or `alpha` abstains.

### F. The sign test is the exact binomial tail (validated)

`signTest` matches an independently-computed `Σ_{k≥wins} C(n,k)/2ⁿ` to 1e-12 on six cases (`7/10` → **0.171875**),
`signTestFloor(n) = 2⁻ⁿ`, the guards reject an out-of-range `wins`/`n`, and `significant` compares to `alpha`.
`pairedClusterTest` carries the documented fields (`value −0.1`, `se 0.4`, `t −0.25`, `df = C−1 = 2`,
`significant === pOneSided ≤ alpha`) and abstains on a shared-cluster mismatch; `pairedClusterSignTest` counts
**per-cluster** signs (wins 1, losses 2, `fraction = 1/3`) — the fixed form its own comment documents.

### G. `clusterStability.stable` ignores the `worstDelta > minDelta` half of its own rule (L10-cl)

The docstring says: *"`stable` requires `fractionPositive >= minFraction` (default: every cluster) **AND**
`worstDelta > minDelta` (default 0)."* The code computes `stable: fractionPositive >= minFraction − 1e-12` and
**never tests `worstDelta`**:

| minFraction | fractionPositive | worstDelta | code `stable` | documented rule |
| --- | --- | --- | --- | --- |
| 0.5 | **0.6667** | **−0.5** | **true** | **false** (`−0.5 > 0` fails) |
| 1 | 0.6667 | −0.5 | false | false |

With `minFraction = 1` the two coincide (all deltas `> 0` implies `worst > 0`), which is why the shipped default
never sees it; but `promoteDecision` exposes `minStableFraction`, so a looser threshold reaches a branch where a
candidate whose edge **collapses when its worst window is removed** still reads `stable: true`. LATENT.

### H. `signTest`'s pmf underflows for n ≥ ~1075 (L10-cm)

`signTest` starts from `pmf0 = 0.5ⁿ` and walks the binomial pmf. For `n ≥ 1075`, `2⁻ⁿ` underflows the double
range, so `pmf0` is exactly **0**, every pmf is 0, and `tail` stays 0:

| call | `pValue` |
| --- | --- |
| `signTest({wins: 500, n: 1000})` | **0.5126** (correct) |
| `signTest({wins: 1000, n: 2000})` | **0** (should be ≈ 0.5) |
| `signTest({wins: 1, n: 2000})` | **0** (`significant: true`) |
| `signTest({wins: 2000, n: 2000})` | **0** |

So a balanced 2 000-cluster sign test reads "certainly significant" — and the failure is silent and **in the
unsafe direction**. The docstring scopes the function to "tens to a few hundred" clusters, so this is outside the
documented range, but it is a sharp edge with no error. LATENT.

### I. Scope

`dependence.js` only re-evaluates a statistic on clustered arrays, so neither finding can move a scored number:
the stability flag feeds a gate whose shipped default is the strict `minFraction = 1` (where the two rules
coincide), and the sign test's documented range is `n < 1075`. No golden moves and **no fold-back row**.

## What is now false that used to be believed

* **"`clusterStability.stable` requires `fractionPositive >= minFraction` AND `worstDelta > minDelta`."** It
  requires only the first; a candidate whose edge collapses on its worst window can still read `stable: true`
  whenever `minFraction < 1`.
* **"`signTest` is exact for the cluster counts this harness sees."** True up to `n ≈ 1074`; beyond that it
  underflows to `pValue = 0` for every win count — an implementation limit the docstring's "tens to a few
  hundred" quietly assumes but does not enforce.

## Ledger effects

* **F-78** is added: `dependence.js` is **validated** against its documented contract (10/10 checks) with two
  registered rows — **L10-cl** (`clusterStability.stable` omits the `worstDelta > minDelta` half of its rule;
  witness fractionPositive 0.6667, worstDelta −0.5, `stable: true`) and **L10-cm** (`signTest`'s `0.5ⁿ` pmf start
  underflows for `n ≥ ~1075`, returning `pValue = 0` for any win count). Both latent; no fold-back row.
* `e70_dependence_audit.js` is the register's **seventeenth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e69`). `run_all` is now **78 steps, 47 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T09:56:14Z**).

## Next

* Remaining pure module: `decision.js` (the shipped decision layer, 44 KB) — the last lab-consumed analysis module
  without a dedicated synthetic audit.
* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded).

## Run

No repo file is touched. Full regeneration: `run_all` → **78 steps, 47 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T09:56:14Z** (`e70` 47 ms; `e69` 359 ms; `e0d` the slowest; total **921 s** this run).
