# CYCLE-050 — The resampling hub: exact bootstrap/hac/subsampling identities, a documented reference the selector does not reproduce, and two ungated suite steps (L10-aw…L10-az)

**Date:** 2028-05-02
**Goal:** `analysis/reality_check.js` is the lab's and the repo's **resampling backbone** — the
stationary-bootstrap index process, the Newey-West (Bartlett) HAC standard error, White's Reality Check /
Hansen's SPA (plus the consistent SPA and the Romano-Wolf step-down), the Politis-White automatic
block-length selector, and the variance-consistent subsampling family. It is the hub the synthetic-audit
queue was always going to reach (`e53`→F-61 carry join, `e54`→F-62 dependence, `e55`→F-63 splits,
`e56`→F-64 labels, `e57`→F-65 overfitting), and — unlike those modules — **part of it is on the shipped
path**: `forecast.js` imports `stationaryBlockIndices`, and `walkforward.js` imports the four subsampling
procedures. So the scope trace is itself part of the audit.

## Work

New experiment `experiments/e58_reality_check_audit.js` (registered; **66 steps, 35 gated, 0 fails**;
5.6 s; **39 checks, all pass**). The audit is a synthetic-ground-truth sweep with two extra instruments:
an **independent port of the documented reference** (`arch.bootstrap.base._single_optimal_block`, vendored
line-for-line from its source), and an **independent NumPy legacy-RandomState(0) stream** (MT19937 +
polar normal), so the repo's headline claim of exact agreement can be tested without trusting the repo's
own test.

## Results

### A. The resampling primitives are exact (validated)

| claim | measurement |
| --- | --- |
| `stationaryBlockIndices(n, b)` has length `n`, indices in `[0, n)` | 4/4 `(n, b)` cases |
| at `b = 1` it is **exactly** i.i.d. sampling with replacement | byte-equal to a hand replay of the rng stream (2 draws per bar `t > 0`, 1 for bar 0) |
| the restart law is geometric with failure prob `1/b`, cursor `+1 (mod n)` otherwise | byte-equal to a hand replay over 60 bars at `b = 4` |
| restart rate `≈ 1/b` and mean run length `≈ b` | ensemble at `b = 6`, `n = 4000`: within the 2.5-SE bands |
| deterministic for a given rng stream | byte-identical on repeat |
| `neweyWestSE` is exactly the Bartlett estimator | matches an **independent** `γ(0) + 2Σ w_j γ(j)` implementation on 24 random windows × bandwidths (1e−12) |
| bandwidth 0 is the i.i.d. standard error | exact (`[1,2,4,8,16]` → 2.4396721…) |
| a constant window returns exactly 0 | exact |
| slice invariance | `neweyWestSE(series, from, len, m)` = `neweyWestSE(slice, 0, len, m)` on 10 cases |
| default bandwidth = `max(1, round(len^(1/3)))` | exact |

### B. The RC / SPA / subsampling arithmetic is exact (validated)

| claim | measurement |
| --- | --- |
| RC statistic = `sqrt(T)·max_k mean(f_k)` | exact (1e−12) + the right best index |
| a constant benchmark `b` shifts the statistic by exactly `−sqrt(T)·b` | exact |
| SPA statistic = `max(0, max_k fbar_k/ω_k)` with the bootstrap SE | matches an independent recomputation from the same draws (1e−12) |
| a zero-variance positive candidate is an infinite t with `p = 0` | exact |
| the consistent recentring bound is `A_k = ω_k·sqrt(2 log log T)` | exact; `fbar ≥ −A` keeps the mean, else recentres to 0 |
| with every candidate \"valid\", consistent and upper recentring coincide | p-value, statistic and recentring all equal |
| `p(SPA_c) ≤ p(SPA)` (Hansen's consistency) | held on the planted-poor design |
| the step-down's **first step IS** the single-step consistent SPA | bit-equal p-value / best index / best t |
| the step-down p-values are monotone and it stops at the first failure | on a design with one genuine edge |
| k-FWER at `k = 1` == the step-down's first p == the consistent SPA p | bit-equal |
| the SPA/step-down/k-FWER share **one** reference | means, SEs, recentring, window length and bandwidth all identical |
| subsampling is deterministic (no rng) | byte-identical on repeat |
| every window statistic = `(windowMean − recentring)/shrink/neweyWestSE(window, m)` | exact on every window (1e−12) |
| `shrink = sqrt(1 − b/T)`, defaults `b = round(T/3)`, `m = round(b/6)` | exact |
| `groups = [T]` is bit-identical to ungrouped; grouped windows never straddle | exact; window count = `Σ (len_g − b + 1)` |
| the FDP heuristic's reported bound is `(k̂ − 1)/R` | self-consistent |

A subtlety worth recording rather than a defect: the k-FWER reference is the **k-th largest** window
statistic, so its p-value is **non-increasing** in `k` (raising `k` shrinks the reference). My first
check asserted the opposite and failed; the module is right.

### C. The Politis-White selector does not reproduce its documented reference (L10-aw)

The module's comment states it \"reproduces the reference implementation
`arch.bootstrap.optimal_block_length` … to floating-point precision\", and its own test pins the arch
AR(1) benchmark vector. Both hold **where the code's guard does not fire**: on 30 series with `g > 0` the
output matches the vendored arch port to 1e−9, and the reference vector is reproduced independently from
the NumPy stream — **13.635665 / 15.608940** (my own MT19937 + polar-normal implementation gives the
known first draws `0.5488135039273248` and `1.764052345967664`, so the reproduction is not borrowed from
the repo's test).

But the code's own `length` helper returns **0** unless `sigma2 > 0 && g > 0`, whereas the reference
squares `g` and is therefore positive for a mean-reverting series. The divergence is not a corner case:

| ensemble | repo = 0 | repo ≠ arch |
| --- | ---: | ---: |
| AR(−0.5), T = 400, 200 series | **198** | **198** |
| e.g. seed 0 | 0 | arch **22.0** (`g = −0.858`) |
| e.g. seed 1 | 0 | arch **5.99** (`g = −0.273`) |
| e.g. seed 2 | 0 | arch **10.86** (`g = −0.565`) |

The consequence is the *auto* policy: `autoBlockLength` floors the raw selector at 1, so on the same
ensemble it returns block length **1 for 99 of 100 series** — i.e. the automatic block bootstrap silently
degrades to **i.i.d. resampling** on exactly the anti-persistent streams where a block bootstrap is most
needed. (Arguably `g < 0` *should* mean a short block, so the guard may be a deliberate improvement over
the reference — but it is undocumented, and the comment's claim of floating-point agreement with arch is
false on a non-degenerate set. The F-61 lesson: **the module's own comment is not the code.**)

Related, smaller: over an i.i.d. ensemble the guard fires on **58 %** of T = 120 columns, so even with no
persistence the selector reports 0 for more than half the candidates. The decoder's own docstring
describes the selector as \"right-skewed\"; the guard makes it a point mass at zero for many columns.

### D. Two more latent warts (L10-ax, L10-ay) and the scope (L10-az)

* **L10-ax — the `median` reduction is the UPPER median for an even arm count.** `autoBlockLength`'s
  `median` branch takes `sorted[floor(K/2)]`, which for even `K` is the upper order statistic, not the
  average of the two middle ones. Measured on one 4-arm matrix: per-arm `[3.671, 4.848, 3.369, 6.357]`,
  upper median **4.84761**, standard median **4.25907**; the function returns **4.84761**. The repo test
  uses `K = 5` (odd), the one case that cannot see it.
* **L10-ay — the `neweyWestSE` clamp's `v < 0` arm is unreachable.** The code clamps a non-positive
  Bartlett-tapered long-run variance to 0, with the comment \"a constant window (or rounding noise) has
  zero variance\". But the tapered sum is a **PSD quadratic form** (the Bartlett kernel), so it cannot be
  negative: an exhaustive search over every ±1 window up to length 18 × every bandwidth, plus 3000 random
  windows, finds minimum taper **exactly 0** (constant windows) and never a negative value. Only the
  `v = 0` arm is live; the `v < 0` arm is defensive and dead (rounding cannot make it negative).
  `neweyWestSE` is finite and ≥ 0 across the whole battery.
* **L10-az — the scope.** The block-bootstrap family (`whiteRealityCheck`, `hansenSpa`,
  `hansenSpaConsistent`, `romanoWolfStepM`, `consistentRecentring`, `politisWhiteBlockLength`,
  `autoBlockLength`, `bootstrapRelativeMeans`) is **test-only** — no shipped module imports it. The
  shipped consumers are `stationaryBlockIndices` (via `forecast.js`'s Diebold-Mariano test and Model
  Confidence Set) and `neweyWestSE` + the four subsampling procedures (via `walkforward.js`'s familywise
  search). So the defects above are latent, while the primitives that *are* live (A/B/E rows) are exact.

### E. Independent calibration re-measured (the F-57/F-62 discipline)

| design (K = 5, T = 100, 200 reps) | measured reject rate (α = 0.05) |
| --- | --- |
| subsampling SPA, φ = 0 / 0.2 / 0.5 / 0.8 | **0.040 / 0.045 / 0.045 / 0.030** |
| block-bootstrap consistent SPA, same φ | 0.090 / 0.105 / 0.180 / **0.385** |
| RC / SPA under a pure i.i.d. null | 0.035 / 0.065 |

So the module's flagship claim reproduces on my own seeds: the variance-consistent subsampling holds its
nominal size across the persistence sweep while the block bootstrap over-rejects badly at φ = 0.8
(**0.385** vs **0.030**), and RC/SPA keep their size under the i.i.d. null. This is the first
synthetic-ground-truth audit in the queue whose *statistic* passes its own calibration independently.

## What is now false that used to be believed

* **\"`politisWhiteBlockLength` reproduces `arch.optimal_block_length` to floating-point precision.\"**
  True only where `g > 0`. For mean-reverting series (98 of 100 AR(−0.5) draws) the repo returns exactly 0
  and arch returns a positive length; `autoBlockLength` then silently uses block length 1.
* **\"The `median` arm reduction is the median.\"** It is the upper median for an even arm count.
* **\"`neweyWestSE`'s negative-variance clamp protects against a negative long-run variance estimate.\"**
  The Bartlett estimator is a PSD quadratic form and can never produce one; only the `v = 0` arm is live.
* **\"`run_all`'s 32 gated steps mean the whole suite is gated.\"** `e56` and `e57` never exposed
  `verdict.validationPass`, so `run_all` left their `pass` **undefined** from CYCLE-048/049 — two steps
  (both validation suites) were reported but **not gated**. Fixed this cycle: they now return a
  `validationPass`, and the suite reads **35 gated**.

## Ledger effects

* **F-66** is added: the resampling hub is **validated** on the shipped primitives and on every exact
  identity, its documented arch reference is **not reproduced** for `g ≤ 0`, and three latent warts are
  registered — **L10-aw** (the `g > 0` guard), **L10-ax** (the upper median), **L10-ay** (the dead clamp),
  **L10-az** (test-only scope). No fold-back row.
* **Lab bug fixed:** `e56`/`e57`'s `verdict.validationPass` (see above) — two ungated suite steps since
  CYCLE-048/049.
* `e58_reality_check_audit.js` is the register's **fifth synthetic-ground-truth experiment on a repo
  module** (after `e53`, `e54`, `e55`, `e56`, `e57`). `run_all` is now **66 steps, 35 gated, 0 fails**
  (`RUN_SUMMARY` at **2026-09-27T05:08:30Z**).

## Next

* Finish the pure-module sweep: **`forecast.js`** (proper scores / Diebold-Mariano / Model Confidence
  Set), then **`race.js`** (successive-halving arm ranking), then **`benchmark.js`**.
* Remaining L10 rows: **L10-e** (the feature `closes` contract), **L10-h** (golden movement for any R1–R9
  port), **L10-ad** (the carry attribution lag), **L10-ae** (the `effectiveBars` unbounded limit).

## Run

No repo file is touched. Full regeneration: `run_all` → **66 steps, 35 gated, 0 fails**,
`RUN_SUMMARY` at **2026-09-27T05:08:30Z** (`e58` 5.6 s; `e0d` remains the slowest step at ~168 s).
