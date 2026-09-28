# CYCLE-049 — The PBO / CSCV module: exact structure, a reproduced calibration draw, and a 252-split statistic that is really ~4 splits (L10-aq…L10-av)

**Date:** 2028-04-25
**Goal:** `analysis/overfitting.js` implements the Probability of Backtest Overfitting (Bailey, Borwein,
López de Prado & Zhu 2016) over `C(S, S/2)` combinatorially symmetric splits — the repo's *non-parametric*
selection-bias counterpart to the deflated Sharpe. It is the next pure module in the synthetic-audit queue
(`e53`→F-61, `e54`→F-62, `e55`→F-63, `e56`→F-64), and it is unusually well documented: `docs/LOCKED.md`
and `test/lock-registry.js` make exact structural claims *and* quote a calibration
("20 iid-noise strategies (T=500, S=10, 252 splits): PBO = 0.464").

## Work

New experiment `experiments/e57_overfitting_audit.js` (registered; **65 steps, 32 gated, 0 fails**; 11 s).
It audits the module against closed forms — the structure is exact combinatorics, the rank map and the
regression are exact arithmetic, and the "calibration" is a *statistic*, so the F-57/F-62 discipline
applies (a single realisation is not a measurement → an ensemble and a standard-error band).

## Results

### A. The structural claims are exact (validated)

| claim | measurement |
| --- | --- |
| `cscvBlocks` partitions exactly, remainder on the first blocks | 7/7 `(n, S)` cases: ordered contiguous cover, sizes `base + (b < n mod S)` |
| `cscvSplit` yields `C(S, S/2)` splits | 6/6 `S ∈ {2,…,12}`, count = an independent multiplicative binomial |
| every split is a disjoint cover of the timeline | all splits, all S |
| each block is in exactly `C(S−1, S/2−1)` in-sample sets | exact; and the split set is **closed under complement** |
| the split cap rejects an astronomical enumeration | `C(20,10) = 184756` passes (< 200 000), `C(22,11) = 705432` **throws** |
| `relativeRank`: best = `N/(N+1)`, worst = `1/(N+1)`, full tie = `1/2`, average tie ranks | exact (`[5,5,1,1]` → 0.7 for the 5s, 0.3 for the 1s); strictly inside (0,1) |
| `oosOnIsRegression` is "exact" | 40 random vectors match an **independent sum-formula OLS** (slope/intercept/r², 1e−9); identity slope 1, reflection −1; `sxx = 0` → slope 0, `syy = 0` → r² 0, n < 2 → NaN |

### B. The constructed cases have exact answers (validated)

| construction | PBO | why it is exact |
| --- | ---: | --- |
| all-flat (`Sharpe = 0` everywhere) | **1** | every `omega = 1/2` → `lambda = 0 ≤ 0` |
| one strictly dominant strategy | **0** | IS winner always `j = 0` (measured in all 252 splits), OOS rank `N` → `lambda = ln N > 0` |
| an anti-persistent pair (`S = 2`) | **1** | the IS winner is the OOS loser in *both* splits (`slope ≈ −1`) |
| `metric = s → s[0]` on `[[5,0,0,0],[0,0,0,0]]` | **0.5** | hand-computed: one tie split, one not |
| `metric = s → s[1]` on the same matrix | **1** | every value ties → every `lambda = 0` |

Invariances of a rank-based statistic: PBO is **identical** under annualisation (`periodsPerYear` 1 vs 252)
and under strictly positive per-column scaling (the default metric is a Sharpe) — both exact, both as they
should be. Structural invariants (`pbo = overfit/splits`, 252 splits, `omega ∈ (0,1)`) hold.

### C. The calibration reproduces — and is one draw

The repo's own quoted draw is reproduced **exactly**: 20 i.i.d. strategies, T = 500, S = 10, the repo's own
RNG at seed 20240 → **PBO = 117/252 = 0.46429**, degradation slope **−0.0936** ("~0", as claimed). The
ensemble of the same procedure on 60 seeds, plus the repo's other two regimes:

| regime | measurement |
| --- | --- |
| i.i.d. noise (60 matrices, N = 8, T = 400, S = 10) | mean **0.4769** (se 0.0329), **sd 0.2546**, p05–p95 **0.099–0.885** |
| binomial split SE of one 252-split PBO at p = 1/2 | **0.0315** |
| implied split design effect / effective splits | **65.4** → **≈ 3.9 independent splits** |
| persistent edge (the repo's construction, 12 seeds) | PBO **0** everywhere, slope **≈ +1.00** |
| planted regime flip (the repo's construction) | PBO **1** |

So the quoted 0.464 is a *single* realisation of a distribution roughly **0.25 wide**, and the 252
combinatorially symmetric splits carry the information of roughly **four** independent ones (they share the
same ten block performances). A PBO quoted to two or three decimals — including the repo's own
`0.464` — overstates its resolution by about an order of magnitude. This is the F-62 lesson, one level up:
last cycle it was a `designEffect`; here it is the whole PBO estimator.

### D. Two things the calibration does not cover, and one falsified guess

**1. A fully-tied roster is forced to PBO = 1 (L10-ar).** Because `lambda ≤ 0` counts an exact tie as
overfit, a roster whose candidates all carry the same performance — all-flat returns, or identical columns —
reads **exactly 1** ("certainly overfit"), which is the least informative case there is. The repo documents
this ("under the documented tie convention"), but it is a real trap for a metric that collapses candidates
onto the same value. **My pre-registered guess was wrong, though**: I expected *partial* duplication to bias
PBO upward (a tie pulls `omega` to 1/2, hence `lambda` to 0). Measured on ten paired base matrices,
duplication moves the mean the *other* way — **0.5806 → 0.5671 → 0.5401** for 0/5/19 duplicate columns, sign
6/10 — because a duplicate only ties the *winner* (its twin shares its OOS value), and averaging the
winner's rank toward the middle can move `omega` either way. The tie convention forces only the fully-tied
case.

**2. The pooled degradation regression's `n` invites an invalid inference (L10-as).** `degradation` pools
every `(split, strategy)` pair and returns `n = N · C(S,S/2)` (2016 here) — but those pairs are deterministic
functions of only `N · S = 80` block performances, so they are wildly dependent. A naive
`t = sqrt(r²(n−2)/(1−r²))` built from the returned `{slope, r2, n}` exceeds 1.96 on **91.2 %** of genuinely
skill-less matrices (nominal 5 %). The *arithmetic* is exact, as the lock-registry says; the *inference* a
consumer would draw from the returned `n` is not.

**3. `relativeRank`'s non-finite handling (L10-aq).** The rank skips non-finite entries but `omega` divides
by the **full** length: `relativeRank([1,2,3,NaN], 2) = 3/5 = 0.60` where excluding the missing candidate
gives `3/4 = 0.75`. A metric that returns `NaN` for some candidates (the documented `metric` option; the
default Sharpe returns `0`, not `NaN`, for zero dispersion) therefore depresses every `omega` and biases PBO
**up**.

### E. Contract (L10-au) and scope (L10-av)

`cscvBlocks(n, blocks)` alone accepts `blocks ≤ n`, so `cscvBlocks(6, 6)` yields six **1-observation**
blocks; only the `probabilityOfBacktestOverfitting` entry enforces `blocks ≤ floor(T/2)`, and its message
says "at least 2 observations per **half**" where the condition is ≥ 2 per **block**. A direct consumer of
the splitters can build degenerate halves.

**Scope: nothing here is live.** No shipped module imports `overfitting.js` — a grep of `src/` finds only
`analysis.test.js` and `test/lock-registry.js` (the matches in `decision.js`, `reality_check.js` and
`walkforward.js` are comments). Like `labels.js`'s barrier primitives (F-64), the module is **test-only**,
so all five rows are latent.

## What is now false that used to be believed

* **"PBO = 0.464 on 20 i.i.d. strategies" is a *calibration*.** It is one realisation (117/252), and the
  statistic's own spread across i.i.d. matrices is **sd 0.25** — the ensemble mean is 0.477, so "≈ 1/2" is
  right and the specific digits are not resolvable.
* **"252 splits means 252 observations."** No: the implied design effect is **65**, so a 252-split PBO has
  about **4** independent splits' worth of information.
* **"Duplicating candidates biases PBO upward."** False (measured: 0.58 → 0.54). Only a *fully* tied roster
  is forced to 1.
* **"`oosOnIsRegression` is exact, so a significance test from it is valid."** The arithmetic is exact; the
  pooled `n` it returns is not a sample size, and a naive t from it over-rejects at ~91 %.

## Ledger effects

* **F-65** is added: the PBO/CSCV module's structure and closed forms are **validated**, its calibration is
  **reproduced but shown to be one draw**, and five latent rows are registered — **L10-aq** (the NaN
  denominator), **L10-ar** (the fully-tied roster / the falsified duplication guess), **L10-as** (the pooled
  degradation `n`), **L10-at** (a 252-split PBO is ~4 splits), **L10-au** (the block-count contract),
  **L10-av** (no shipped importer). No fold-back row.
* `e57_overfitting_audit.js` is the register's **fourth synthetic-ground-truth experiment on a repo module**
  (after `e53`, `e54`, `e55`, `e56`). `run_all` is now **65 steps, 32 gated, 0 fails**
  (`RUN_SUMMARY` at **2026-09-27T04:46:25Z**).

## Next

* Finish the pure-module sweep: **`forecast.js`** (EWMA/HAR vol), **`race.js`** (arm ranking), then
  `reality_check.js` (White RC / Hansen SPA — it bootstraps a max statistic, so its calibration is a
  distribution and the F-57/F-62 discipline applies doubly).
* Remaining L10 rows: **L10-e** (the feature `closes` contract), **L10-h** (golden movement for any R1–R9
  port), **L10-ad** (the carry attribution lag), **L10-ae** (the `effectiveBars` unbounded limit).

## Run

No repo file is touched. Full regeneration: `run_all` → **65 steps, 32 gated, 0 fails**,
`RUN_SUMMARY` at **2026-09-27T04:46:25Z** (`e57` 11.1 s; `e0d` remains the slowest step at ~168 s).
