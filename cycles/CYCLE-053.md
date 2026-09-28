# CYCLE-053 — The P1 model-class benchmark: the ridge arm's probability is anchored at 0.5 (its training base rate is computed and then discarded), and the shipped test can only see accuracy (L10-bl…L10-bo)

**Date:** 2028-05-23
**Goal:** `analysis/benchmark.js` (round 29 → 30, P1) is the **shipped** model-class benchmark — base rate /
ridge (closed form) / one-hidden-layer tanh MLP (seeded SGD) / a pluggable pretrained-TSFM arm, each a
`{fit(X,y), predictProb(x)}` forecaster over the **same causal `featureVector`** the bare path reads. Its
verdict is the round-29 **P1 negative branch (G-A)**: no model class has material positive Brier skill vs
the base rate, so the **features/target, not the architecture**, are the constraint (RUN-ANALYSIS §16.2).
The ridge arm is the MCS survivor and the best of the set, so its probability output is load-bearing. Unlike
the engine-only `race.js` (F-68), this module **reaches a run report** whenever `--variants=bench-*` is used.

## Work

New experiment `experiments/e61_benchmark_audit.js` (registered; **69 steps, 38 gated, 0 fails**; 67 ms in
the suite; **12 checks, all pass**). One probe cycle first (`probe_bench`) established the witnesses, then
was deleted. The audit has two parts: the module's documented contracts (the standardiser, the closed form vs
an **independently solved** centred ridge, the base rate = training prior, MLP determinism, `BENCHMARK_KINDS`,
the factory's `tsfm`/unknown-kind refusals, a perfect classifier beating the base rate), and — the
interesting part — the **output map** of the ridge forecaster, which is where the defects are.

## Results

### A. The documented contracts hold (validated)

| claim | measurement |
| --- | --- |
| `fitStandardiser`/`applyStandardiser` zero-mean / unit-std on the fit fold | exact on 200×3; a collapsed constant column reads `std = 1e-8` and `z = 0`; empty input → `d = 0` |
| `fitRidge` is the closed form | an **independently solved** centred ridge (same normal equations, this file's own Gaussian elimination) matches the module's `w` to **0** |
| the intercept is unpenalised | `lambda = 0` vs `lambda = 1e6` leave the intercept column's diagonal untouched |
| `predictRidge` is a probability | in `(0,1)` on every input; the `standardise:false` path is finite |
| `fitBaseRate` = the training prior | `p` = mean(y), `predictBaseRate` returns it, empty input → 0.5 |
| ridge and MLP learn a separable rule | both > 0.8 accuracy on the shipped §P1 fixture shape |
| the MLP is deterministic under a seed | identical bytes for the same seed, different across seeds |
| `BENCHMARK_KINDS` = `base-rate,linear,mlp,tsfm`; `tsfm` throws (no checkpoint) | exact; an unknown kind throws |
| a perfect classifier beats the base rate on Brier | ridge 0.1425 vs base 0.2500 |

### B. The ridge forecaster's probability is anchored at 0.5 (L10-bl)

`fitRidge` computes the training base rate **`ybar`**, *uses it to centre the target* (`yc = y − ybar`), and
returns it as a field — but **`predictRidge` never reads it**. The shipped probability is
`sigmoid(z·w + c)`, the **centred** linear predictor, so the arm's output is centred at `sigmoid(0) = 0.5`
whatever the label prior. Witnesses:

| fold | `ybar` | shipped mean prediction | Brier shipped | Brier with the module's own `ybar` restored |
| --- | ---: | ---: | ---: | ---: |
| constant `y = 1` (n=40) | 1.0 | **0.5000** | — | — |
| labels 25 ones / 5 zeros (base rate 0.833) | 0.833 | **0.5000** | **0.22475** | **0.13533** |

The constant-y fold returns exactly `0.5` for every input — no regression of a constant target can do that;
the intercept the fit solved is `0` because the centred target has mean 0 and the standardiser makes the
feature columns mean 0. The consequence is a **mis-specified output map**, not a small numerical wart: the
arm cannot represent a base rate far from 0.5, and `brierSkill = 1 − Brier/p̄(1−p̄)` is computed from that
probability. The module's own shipped test checks **accuracy** (a 0.5 threshold, invariant to the missing
offset) so it cannot fail — the F-68 "a test that cannot fail" lesson, now on a shipped arm.

### C. The sigmoid is applied to a bounded least-squares fit (L10-bm)

`predictRidge` sigmoids a least-squares fit of a 0/1 label. The fitted value of a bounded target lies in
`[min y, max y]` (centred: `[−ybar, 1−ybar]`), so `sigmoid` maps it into `sigmoid([−1,1]) ≈ [0.27, 0.73]`
(at `ybar = 0.5`: `[0.378, 0.622]`) — the arm **cannot express confidence** however separable the data is:

| case | measurement |
| --- | --- |
| a perfectly separable single feature | predictions in `[0.378, 0.622]`; Brier **0.1425** (the arm's floor), not ~0 |
| a constant-`y = 1` fold, MLP arm | **0.99** (the MLP fits its output bias on the raw label through the same sigmoid) |

So the ridge and MLP arms are **not the same kind of probability model**, and the P1 comparison "does any
model class beat the base rate on Brier" is, for the ridge arm, partly a statement about a bounded output map
rather than about the model class. The §16.2 headline "ridge… Brier skill −0.0008 / −0.0043 / −0.0009" is
read from this map.

### D. The "ridge closed form vs a hand solve" claim is unverified (L10-bn)

`docs/LOCKED.md` and `test/lock-registry.js` both claim the P1 tests prove "the ridge closed form matches a
hand-computed solve". The shipped `analysis.test.js` P1 block asserts only: ridge/MLP **accuracy** > 0.8 on a
separable rule, MLP determinism, a zero-mean standardiser round-trip, the factory kinds and the benchmark MCS
grouping — **there is no hand solve**. The closed form itself **is** exact (part A matches it to 0), so the
claim is *true but untested*; and all five shipped checks would pass on a ridge with an arbitrary output map
(part B is exactly such a map). The `L10-ag` lesson: a test-ledger claim is itself a claim — read the
assertions, not the note.

### E. The eps constant-column fallback amplifies a train→test deviation (L10-bo, latent)

`fitStandardiser` gives a constant column `std = sqrt(0) + eps = 1e-8`, so the fallback prevents a division
by zero but not the blow-up: a test-fold value **one unit** away from a train-constant column maps to
`z = 1/1e-8 = 1e8`. A feature constant over a 60-bar training fold is plausible, so this is latent but real,
and it is untested.

### F. Scope

**Shipped**: the arms are opt-in (`--variants=bench-base-rate,bench-linear,bench-mlp`) and never in the
default roster, but a benchmark run reaches RUN-ANALYSIS §16.2 and the ridge is the MCS survivor, so L10-bl/bm
move a **forecast arm's probability readout** (not the goldens, which are untouched by an opt-in arm). `tsfm`
is unreachable by design (throws). L10-bo is latent.

## What is now false that used to be believed

* **"`predictRidge` returns the ridge regression's probability."** It returns `sigmoid(centred linear
  predictor)` — the training base rate the fit computed (`ybar`) is never restored. A constant-y fold reads
  exactly 0.5; a 0.833-base-rate fold reads a mean of 0.50 (Brier 0.2248 vs 0.1353 with the term restored).
* **"The bench-linear and bench-mlp arms are comparable probability models."** The linear arm's output is
  confined to `sigmoid([−1,1])` (Brier floor ≈0.14 on a perfect problem) while the MLP reaches 0.99 on a
  constant-y fold; "no model class has positive Brier skill" is, for the ridge, partly a property of the map.
* **"The P1 test proves the ridge closed form against a hand-computed solve."** No shipped test performs a
  hand solve; the closed form is exact but verified by none of the five §P1 checks.
* **"A constant column is handled safely by the eps fallback."** It collapses to 0 on the fit fold, but a
  one-unit test-fold deviation becomes `z = 1e8`.

## Ledger effects

* **F-69** is added: `benchmark.js` is **validated** on its documented contracts (12/12) with four registered
  rows — **L10-bl** (the dead training base rate / anchored probability), **L10-bm** (the sigmoid band cap),
  **L10-bn** (the unverified hand-solve claim) and **L10-bo** (the eps column amplification, latent). The
  first two touch a **shipped** arm's readout; no fold-back row (an opt-in arm, no golden moves).
* `e61_benchmark_audit.js` is the register's **eighth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e60`). `run_all` is now **69 steps, 38 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T06:44:55Z**).

## Next

* Remaining L10 rows: **L10-e** (the feature `closes` contract), **L10-h** (golden movement for any R1–R9
  port), **L10-ad** (the carry attribution lag), **L10-ae** (the `effectiveBars` unbounded limit).
* Then the remaining pure modules the lab consumes but has not yet audited by synthetic ground truth:
  **`features.js`** (the causal signal family), **`holding.js`**, **`performance.js`**, **`uniqueness.js`**
  and the `streams.js`/`world.js` data layer.

## Run

No repo file is touched. Full regeneration: `run_all` → **69 steps, 38 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T06:44:55Z** (`e61` 67 ms; `e0d` remains the slowest step at ~532 s).
