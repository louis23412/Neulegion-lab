# CYCLE-051 — The forecast scoring layer: exact against the repo's own second Murphy implementation, a false decomposition claim, a count-only alignment guard, and a benchmark-grouping branch that contradicts its own reader (L10-ba…L10-bf)

**Date:** 2028-05-09
**Goal:** `analysis/forecast.js` is the next module in the L10 synth-audit queue (after `carry.js` → F-61,
`dependence.js` → F-62, `splits.js` → F-63, `labels.js` → F-64, `overfitting.js` → F-65,
`reality_check.js` → F-66). Unlike the last three it is **shipped**: `analyze.js` imports
`forecastComparison`/`formatForecast` and runs the block on by default (`--forecast=0` disables), so its
output reaches a run report. It scores the family as *forecasters* — Brier + the Murphy (1973)
reliability/resolution/uncertainty partition, the log score, the Diebold-Mariano (1995) test on
block-bootstrapped per-bar Brier-loss differentials, and the Hansen-Lunde-Nason (2011) Model Confidence
Set — and it consumes `reality_check.js#stationaryBlockIndices` (audited in F-66). The audit gets a free
**second reference**: the repo already contains an independent Murphy implementation in
`observer/legion_metrics.js`.

## Work

New experiment `experiments/e59_forecast_audit.js` (registered; **67 steps, 36 gated, 0 fails**; 4.1 s in
the suite; **33 checks, all pass**). One probe cycle first (`probe_fc*`) established the shape and the
witnesses, then was deleted. The audit is a closed-form + cross-implementation sweep with one seeded
calibration battery (i.i.d. DM size, a persistence sweep, MCS coverage under an exact null) at the
F-57/F-62 discipline: ensembles with 2.5-standard-error bands.

## Results

### A. The scoring arithmetic is exact (validated)

| claim | measurement |
| --- | --- |
| `forecastPairs` maps confidence to `(c+1)/2` | exactly the inverse of `confidenceFromProb(prob) = clamp(prob,0,100)/50 − 1` (1e−12 for `prob ∈ {0,1,25,50,75,99,100}`) |
| … and to the **next** bar's sign, dropping each fold's last bar | hand case: `[0.01,−0.02,0.03]`/`[0.5,−0.5,0.9]` → 2 pairs `(0.75,0)`/`(0.25,1)` |
| non-finite/absent pairs are skipped | a `null` confidence, a NaN return, a missing `confidence`, a `null` fold list, a NaN at a middle bar |
| `brierBinIndex` | `0→0`, `0.5→5`, `1→9`, `0.3→3`, out-of-range clamped; top edge closed |
| `brierScore` | exact mean squared error; empty → NaN; NaN pairs skipped |
| `logScore` | exact mean negative log-likelihood; `eps` clip keeps a confidently-wrong bar finite; a *correct* `p=1`/`p=0` bar costs ~0 (not the 34.5 clip penalty) |
| Murphy identity | `brierBinned = REL − RES + UNC` to 1e−17; `Σ n_k = bars`; crafted 2-bin and `bins = 1` / `bins > N` exact |
| **cross-module** | `observer/legion_metrics.js`'s independent `brierDecomposition` agrees on `reliability`/`resolution`/`uncertainty`/`brier` to **1e−12** on 6 datasets × bin counts, and its explicit `within` equals forecast's gap to **1e−17** |

### B. `bootstrapMeans` and the Diebold-Mariano test (validated)

| claim | measurement |
| --- | --- |
| deterministic | byte-identical replicates for a fixed seed |
| default block length `max(1, floor(cbrt(T)))`; explicit honoured | 8→2, 27→3, explicit 5→5, `blockLength 0` → default |
| one paired index draw per replicate | two series differing by a constant keep that constant in **every** bootstrap mean |
| empty/`[[]]` → unavailable | exact |
| DM statistic = `dbar / bootstrap-SE` | reconstructed exactly from the same rng stream (1e−12), including the p-value `(exceed+1)/(B+1)` |
| degenerate arms | zero differential → stat 0 / p 1 / favored `null`; constant positive → stat `Infinity` / p 0 / favored `B`; < 2 pairs → unavailable |
| reported block length | `max(1, floor(cbrt(n)))` |
| i.i.d. size | **0.0525** at 5 %, **0.1075** at 10 % (400 reps; p-value median 0.497) |
| block bootstrap vs `blockLength = 1` under φ = 0.5 | **0.095** vs **0.135** (200 reps each) — the block controls the size, i.i.d. resampling does not |

### C. The Model Confidence Set (validated, with one paper-level deviation)

| claim | measurement |
| --- | --- |
| eliminates a uniformly worse arm, keeps an identical pair | `['a','c']` survive, `b` eliminated at p `<α`, one step |
| always contains the sample-best | **4 ensembles × 200 runs → 200/200 each** |
| coverage ≈ 1 − α under an exact null | K=3 α=0.10 **0.880** (i.i.d.), **0.855** (φ=0.5); K=4 α=0.10 **0.865**; α=0.05 **0.925** — all inside the 2.5-SE band, at its lower edge |
| deterministic; monotone in the confidence level | exact; `MCS₉₀ ⊆ MCS₉₅` on the graded roster |
| K=1 → its own MCS; K=0 → unavailable; unequal lengths → unavailable | exact |
| **L10-be** elimination denominator | the range statistic `T_R = max|dbar_ij|/se_ij` is HLN's, but the elimination score divides by `sd(L_i)` where HLN's `t_i` divides by `sd(d_i)`, `d_i = L_i − mean_others`; the two differ by up to **77×** on 150 heteroskedastic K=4 configs — yet the surviving set and the elimination **order** were identical in **150/150** |

An earlier 0.82 coverage reading in probe work turned out to be Monte-Carlo noise: at R = 200 the 2.5-SE
band is ±0.053, and the measured rate is ~0.86. Recorded rather than reported as a defect.

### D. The raw-minus-binned gap: the docstring identity is false (L10-ba)

`forecast.js`'s comment says the raw-minus-binned gap *"is the within-bin **forecast** variance that
merging into a bin discards"*. The exact identity — which `observer/legion_metrics.js` states and
computes — is

```
gap = WITHIN = Σ_k w_k [ mean_k(p − p̄_k)² − 2 mean_k((p − p̄_k)(o − ō_k)) ] = withinVar − 2·withinCov
```

and my independent recomputation matches it to 1e−12 on every config. The covariance term is material:

| config | gap | withinVar | withinCov |
| --- | ---: | ---: | ---: |
| T=500, bins=10 | +0.000852 | 0.000829 | −0.0000114 |
| T=200, bins=5 | **−0.00449** | +0.00321 | +0.00385 |
| T=137, bins=20 | **−0.00125** | +0.000166 | +0.000706 |
| T=64, bins=1 | **−0.0531** | +0.0774 | +0.0652 |
| T=300, bins=3 | **−0.0108** | +0.00981 | +0.0103 |
| T=90, bins=10 | **−0.00129** | +0.000867 | +0.00108 |

The gap is **negative on 5 of 6** configs while `withinVar` is positive, and the claimed value is wrong by
up to **0.13**. The module still returns the *correct* fields (`brier`, `brierBinned`, a zero
`identityResidual`), so what fails is the stated identity — the F-66 species (`the module's own comment is
not the code`), now with the rare luxury of an in-repo correct reference.

### E. The alignment guard is count-only (L10-bb)

`forecastComparison` refuses only when `pairs.bars !== base.bars` — a **count** — while its comment says
*"alignment is the whole point of a paired test; refuse rather than silently compare mismatched windows"*.
`forecastPairs` drops each fold's non-finite bars, so two variants that drop the **same number** of bars at
**different positions** pass the guard and are then paired **index-wise**, comparing non-corresponding
bars. On 6 crafted witnesses (a confidence series with a NaN at a different bar per variant) the guard
accepted every one, the two `outcomes` sequences differed, and the DM verdict **flipped in 6/6** relative
to the correctly bar-aligned comparison (sign of the differential and/or the 0.05 significance decision).
Reachable in principle when a variant's confidence has a non-finite bar (warmup/degenerate, or a NaN
`predictProb`) at a position another variant does not.

### F. The benchmark-grouping branch contradicts its own reader — and is dead in production (L10-bd)

`groupOf(kind) = kind === 'benchmark' ? (baselineKind === 'signal' ? 'signal' : 'controller') : kind` maps
a benchmark to the **baseline's** kind. But the module's `reader` and `docs/LOCKED.md` both state a
benchmark journals a calibrated probability and therefore shares the **controller** family's calibration
group. With `baselineKind = 'signal'` a benchmark is grouped with the **signal** (z-score) family and
receives a DM test against it (`dm.available = true`), while a genuine controller candidate is refused as
cross-kind — precisely the mismatch R27-5 exists to prevent. It is **unreachable from `analyze.js`**: the
driver forces the `id:'baseline'` controller variant to index 0 whenever `--variants=` is given (and
`forecastKindOf` of it is `'controller'`), so `baselineKind` is never `'signal'` in a real run; the §AI
test only exercises `baselineKind = 'controller'`. A blemish in the exported API that no test sees
(cf. L10-ay's dead arm).

### G. Unvalidated inputs (L10-bc)

The exported `bootstrapMeans(series, …)` documents "one array per model, all the same length" but does not
check it: unequal lengths leave `available:true`, take `T` from `series[0]`, and produce **NaN** in the
replicates that touch the short series (3 of 8 in the witness). `modelConfidenceSet` *does* validate equal
lengths and refuses, but neither it nor `bootstrapMeans` filters a NaN **inside** a series: a loss series
containing a NaN leaves the MCS `available:true` with an arbitrary survivor. The shipped path is safe —
`forecastPairs` drops non-finite pairs before any loss array is built, so every shipped loss series is
finite — so both are latent, export-level gaps.

## What is now false that used to be believed

* **"The raw-minus-binned Brier gap is the within-bin forecast variance."** The exact identity is
  `gap = withinVar − 2·withinCov` (the repo's own `observer/legion_metrics.js` says so and computes it);
  the gap is negative on 5/6 configs and wrong by up to 0.13.
* **"`forecastComparison` refuses a mismatched window rather than comparing unpaired."** It compares the
  bar **counts**; a count-coincident misalignment is accepted and flipped the DM verdict in 6/6 witnesses.
* **"A benchmark arm joins the controller in the calibration MCS group."** True only when `baselineKind`
  is not `'signal'`; with a signal baseline the branch puts the probability-calibrated benchmark in the
  z-score group (unreachable from `analyze.js`, reachable through the API, untested).
* **"The MCS elimination statistic is HN's."** The range statistic is HLN's; the elimination denominator
  is `sd(L_i)`, not HLN's `sd(d_i)` (up to 77× apart, empirically inert — 0/150).
* **"The DM test / MCS are miscalibrated."** Falsified: i.i.d. size is nominal (0.0525/0.1075), the block
  bootstrap controls persistence size (0.095 vs 0.135), and coverage is near nominal (0.86–0.93) with the
  sample-best retained 800/800.

## Ledger effects

* **F-67** is added: `forecast.js` is **validated** on its shipped arithmetic (and cross-checked against
  the repo's independent second Murphy implementation), with four registered rows — **L10-ba** (the false
  gap identity), **L10-bb** (the count-only alignment guard), **L10-bd** (the off-target `groupOf`
  benchmark branch), **L10-be** (the inert HLN denominator deviation) — plus **L10-bc** (unvalidated
  `bootstrapMeans` / NaN-tolerant MCS, latent) and **L10-bf** (the calibration battery, which *upholds*
  the module). No fold-back row: the defects are docstring/branch/export-level, not scored-path defects.
* `e59_forecast_audit.js` is the register's **sixth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e58`). `run_all` is now **67 steps, 36 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T05:30:26Z**).

## Next

* Finish the pure-module sweep: **`race.js`** (successive-halving arm ranking), then **`benchmark.js`**.
* Remaining L10 rows: **L10-e** (the feature `closes` contract), **L10-h** (golden movement for any R1–R9
  port), **L10-ad** (the carry attribution lag), **L10-ae** (the `effectiveBars` unbounded limit).

## Run

No repo file is touched. Full regeneration: `run_all` → **67 steps, 36 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T05:30:26Z** (`e59` 4.1 s; `e0d` remains the slowest step at ~168 s).
