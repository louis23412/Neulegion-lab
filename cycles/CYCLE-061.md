# CYCLE-061 — Seed replication: the IQM, the stratified bootstrap, the variance split and the CRN criterion are exact — but the "IQM" is not the cited estimator, and the formatter can mislabel its own CI (L10-cj…L10-ck)

**Date:** 2028-07-18
**Goal:** `analysis/replication.js` (round 26, R26-13) is the **honest-summary** layer. The literature is
unambiguous that a single-seed ordering is not a ranking (Bouthillier et al. 2019; Henderson et al. 2018), so
the module implements the three-part fix: a robust level (the **interquartile mean**, Agarwal et al. 2021), a
**stratified bootstrap** CI resampling within each seed stratum, and a **variance decomposition** into
seed/fold/residual fractions. `pairedVarianceRatio` is the CRN criterion (Glasserman & Yao 1992). It is
**shipped** — `analyze.js` imports `seedDistribution`/`formatSeedReplication` behind `--seeds` and aggregates a
multi-seed run into `replication.json`. Pure and seeded, so every number is reproducible.

## Work

New experiment `experiments/e69_replication_audit.js` (registered; **77 steps, 46 gated, 0 fails**; 359 ms in
the suite; **8 checks, all pass**). The audit checks the IQM contract against hand cases, the stratified
bootstrap's determinism / size preservation / abstentions, its empirical coverage, the variance-decomposition
identities, the paired-variance (CRN) arithmetic, the `seedDistribution` structure and the formatter; then it
pins two defects.

## Results

### A. `interquartileMean` is the rank-slice middle its own doc describes (validated)

Exact on hand cases: `[]` → **NaN**, `[7]` → 7, `[1,3]` → 2, `[1,2,3]` → 2, `[1,2,3,4]` → **2.5**
(`slice(1,3)`), `[1..5]` → 3, `[1..8]` → **4.5** (`slice(2,6)`), an unsorted input sorts first; non-finite values
are filtered (`[1,NaN,2,Infinity,3,4]` → 2.5); it is monotone.

### B. The stratified bootstrap is deterministic, size-preserving and abstains honestly (validated)

Same seed → byte-identical result; a different seed moves it; `lo ≤ median ≤ hi`. A probe statistic returning
the sample length confirms **every replicate carries exactly the original count** (12 for strata `[4,5,3]`), i.e.
the resampling preserves each stratum's size. An empty `strata` and an all-non-finite stratum both return
`available:false`; a stratum with one non-finite value is filtered (`nanFiltered` true).

### C. The CI's empirical coverage is near nominal (validation)

400 panels of 12 i.i.d. zero-mean strata of 6, `statistic = mean`, nominal 95 %: measured coverage **0.92** —
the usual small percentile-bootstrap shortfall from asymptotic nominal.

### D. The variance decomposition holds exactly (validated)

`total = between + within + residual` to 1e-9 and the fractions sum to 1 in every constructed panel: a
pure-between-seed panel (4 seeds × 3 identical values) reads `seedFraction` **1**, `foldFraction` **0**; a
pure-within-seed panel (1 seed, 4 folds) reads `seedFraction` **0**, `foldFraction` **1**; a repeated-cell
panel (one seed, two folds, one with two values) reads `residualFraction` **1**; a mixed 3-seed × 4-fold panel
reproduces the identity with `seedFraction` **0.02703**, `foldFraction` **0.97297**, `residualFraction` **0**.
`totalVariance` is confirmed to be the population (÷n) variance about the grand mean. Fewer than two
observations abstains.

### E. `pairedVarianceRatio` is the CRN arithmetic (validated)

`varianceRatio` is exactly `var(paired)/var(unpaired)` (sample variance, ÷(n−1)) and `varianceReduction` is
exactly `1 − ratio`; a low-variance paired series against a high-variance unpaired one reads ratio **0.000635**
(99.94 % reduction); fewer than two on a side abstains, and a zero-variance unpaired series abstains with reason
`the unpaired difference has zero variance`; a pairing that *hurts* yields a negative reduction.

### F. `seedDistribution` and the formatter render the documented fields (validated)

`seeds`, `n`, `foldsPerSeed`, `mean`, `iqm`, `perSeedMean`/`perSeedIqm`, `statistic`, `ci`, `components` and the
`reader` are all present and exact against a direct recompute; an empty `perSeed` abstains.

### G. The IQM is the rank-slice middle, not the cited Agarwal et al. estimator (L10-cj)

The module sorts and takes `sorted.slice(floor(n/4), n − floor(n/4))` — it drops a fixed **count**
(`floor(n/4)`) from each end **by rank**. The cited Agarwal et al. (arXiv 2108.13264) / `rliable` IQM drops the
values outside `[q1, q3]` — a **mass** rule:

| input | module (rank-slice) | reference (quantile-filter) |
| --- | --- | --- |
| `[0, 0, 5, 10]` | **2.5** (mean of `[0,5]`) | **1.6667** (mean of `[0,0,5]`) |
| 300 right-skewed panels (5–12 values) | — | **149/300 differ**, max gap **1.016** |

So the summary the docstring attributes to Agarwal et al. is a different estimator — the same class as L10-by
(an algorithm that is not the one it names). LATENT/claim-level (the module is self-consistent; the attribution
is wrong).

### H. The formatter can label its CI with the wrong confidence level (L10-ck)

`formatSeedReplication({ label, dist, alpha = 0.05 })` prints `(1 − alpha)·100}%CI` using **its own** `alpha`
parameter, never `dist.ci.alpha`:

| distribution | formatter call | label printed | interval actually is |
| --- | --- | --- | --- |
| `seedDistribution({ alpha: 0.10 })` | `formatSeedReplication({ dist })` | **95%CI** | 90 % (`dist.ci.alpha = 0.10`) |
| `seedDistribution({ alpha: 0.10 })` | `formatSeedReplication({ dist, alpha: 0.10 })` | **90%CI** | 90 % |

So a distribution built at 10 % is reported as a 95 % interval unless the caller happens to pass the alpha
again. `analyze.js` calls the formatter without an alpha, so the shipped path is consistent **only because it
also builds the distribution at the default 0.05** — a non-default alpha mislabels the summary. LATENT.

### I. Scope

`replication.js` is pure and only summarizes an already-scored run, so no finding can move a measured number;
both are latent (the shipped path uses the default alpha throughout, and the IQM is self-consistent). No golden
moves and **no fold-back row**.

## What is now false that used to be believed

* **"The reported level is the IQM Agarwal et al. recommend."** It is a rank-slice of the sorted values, not
  the quantile-filter the reference defines; on skewed data the two disagree often and by a large amount.
* **"`formatSeedReplication` reports the CI at its actual confidence level."** It prints its own `alpha`
  parameter, which can disagree with the interval's (`dist.ci.alpha`) — a 90 % interval can read `95%CI`.
* **"A bootstrap CI here is a calibrated 95 % interval."** Its measured coverage for the mean is **0.92**, not
  0.95 — the expected asymptotic shortfall, now pinned rather than assumed.

## Ledger effects

* **F-77** is added: `replication.js` is **validated** against its documented contract (8/8 checks) with two
  registered rows — **L10-cj** (the IQM is the rank-slice middle, not the cited Agarwal et al. quantile-filter;
  witness `[0,0,5,10]` reads 2.5 vs 1.6667, and 149/300 skewed panels differ) and **L10-ck**
  (`formatSeedReplication` labels the CI with its own `alpha`, not `dist.ci.alpha`, so a 10 % interval can be
  printed as `95%CI`). Both latent; no fold-back row.
* `e69_replication_audit.js` is the register's **sixteenth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e68`). `run_all` is now **77 steps, 46 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T09:37:32Z**).

## Next

* Remaining pure modules: `decision.js` (the shipped decision layer, 44 KB) and `dependence.js` (22.6 KB;
  partially covered by `e54`) — the last two lab-consumed analysis modules without a dedicated synthetic audit.
* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded).

## Run

No repo file is touched. Full regeneration: `run_all` → **77 steps, 46 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T09:37:32Z** (`e69` 359 ms; `e68` 45 ms; `e0d` the slowest; total **942 s** this run).
