# CYCLE-046 — The split family's purge contract: the purged variants hold, the walk-forward does not purge (L10-af/-ag)

**Date:** 2028-03-14
**Goal:** CYCLE-045 validated the statistic the lab reports *through*. CYCLE-046 turns the
synthetic-ground-truth technique on the *split* machinery the lab reports *from*. `analysis/splits.js`
opens "Time-series cross-validation with purging and embargoing", and `test/lock-registry.js` claims for
the family: "Proved: train/test disjoint, **zero label-window leakage**, train starts after embargo". The
lab leans on `walkForwardSplit` (F-13 pools its folds), and the shipped controller trains on labels with a
real horizon (`labelHorizonBars`; the opt-in `label:triple` policy sets a vertical barrier). So the claim
is load-bearing in both projects. This cycle audits it against a **closed-form label-overlap ground
truth**: a fold leaks iff some training label window `[i, i+H-1]` overlaps some test label window
`[j, j+H-1]`, i.e. `0 < j−i ≤ H−1` — an exact expected count.

## Work

**`experiments/e55_split_audit.js`** (new, registered as `e55_split_audit`) — three parts:

* **A. The purged siblings (validation).** `purgedKFoldSplit` on a grid (n ∈ {200, 1000}, k ∈ {4, 8},
  labelSpan H ∈ {1, 2, 5, 20}, embargo ∈ {0, 2, 10}) and `combinatorialPurgedSplit` on (n ∈ {240, 1200},
  k ∈ {4, 6}, testGroups m ∈ {1, 2}, H = 5, embargo = 3): assert **zero** label-window leakage on every
  fold and that the embargo band `(purgeEnd, embargoEnd]` contains no training index.
* **B. The walk-forward (the audit's target).** Count the **leak edges** (train-label/test-label overlap
  pairs) for `walkForwardSplit` across H ∈ {1, 2, 3, 5, 10} and testSize ∈ {10, 40}; compare with the
  closed form `H(H−1)/2` per fold; run the repo's own `assertNoLeakage`; check the fold objects for purge
  metadata; check whether a `labels`/`labelSpan`/`embargo` argument changes anything; and check the
  causality guard's verdict on the leaky folds.
* **C. Exploitability (seeded ensemble, the F-57 discipline).** Build an index-lookup model — the fold API
  hands it `trainIdx`, so it may read a training label whose window covers a test bar. Measure its per-bar
  P&L edge on the **leak zone** (bars whose return appears in a training label), on the clean zone, and for
  a **purged** walk-forward (training trimmed to labels ending before `testStart`), over 200 seeds.

**Pre-registered read.** PASSES if (i) both purged variants are leak-free and embargo-honouring; (ii)
`walkForwardSplit` leaks exactly `H(H−1)/2` edges per fold for H > 1 and zero for H = 1, carries no purge
metadata, ignores label arguments, and passes the causality guard; and (iii) the leak-zone per-bar edge is
positive at 2.5 SE while the purged and clean readings are ~0. A failure means F-63 must be revised.

## Results

**A. The purged variants hold.** `purgedKFoldSplit` and `combinatorialPurgedSplit` are leak-free on every
fold of every grid point (**0** leak pairs), honour the embargo, and CPCV's test multiplicity is exactly
`C(k−1, m−1)` (m=1 → 1×, m=2 → 3× for k=4 and 5× for k=6). The closed-form contract is met — these
functions do what the module header says.

**B. `walkForwardSplit` performs no purging and no embargoing.** Its folds' only boundary protection is
that training indices precede test indices *by index*; for a label horizon H > 1 the boundary leaks:

| H | leak edges per fold (closed form) | testSize = 40, 12 folds | testSize = 10, 48 folds | `isCausalFold` | `assertNoLeakage` |
| ---: | ---: | ---: | ---: | --- | ---: |
| 1 | 0 | **0** | **0** | pass | 0 |
| 2 | 1 | 12 | 48 | pass | >0 |
| 3 | 3 | 36 | 144 | pass | >0 |
| 5 | 10 | 120 | 480 | pass | >0 |
| 10 | 45 | 540 | 2160 | pass | >0 |

Measured edges equal the closed form on every row. Structurally, the folds carry **no**
`purgeStart`/`purgeEnd`/`embargoEnd`, and passing `labels`/`labelSpan`/`embargo` to `walkForwardSplit`
returns **byte-identical** folds — the function has no purge path at all. The causality guard
`isCausalFold` checks index order only, so it returns **true** on every leaky fold; the leak is invisible
to the guard that the module's own comment says exists to certify the walk-forward. The repo's
`assertNoLeakage` *does* flag it (it reports the leaking training indices), but nothing in the split path
calls it — the repo's test ledger runs `assertNoLeakage` only against `purgedKFoldSplit` and
`combinatorialPurgedSplit`, while the lock-registry note attributes "zero label-window leakage" to the
whole family.

**C. The leak is exploitable.** Over 200 seeded worlds (H = 5, trainSize 120, testSize 40; 48 leak-zone
bars per world), an index-lookup model — which the API permits, since it is given `trainIdx` — reads a
training label whose window contains the test bar and posts a per-bar P&L edge of **+0.0035** (se
**0.00007**, i.e. ~50 SE from zero) on the leak zone, while the clean zone reads **0.0000** and a purged
walk-forward **+0.0001**. In deployment that label does not exist when the position is decided (the future
has not happened); it is in the fold only because the boundary was not purged.

**The lab is unaffected; the shipped model path is not obviously so.** Every lab number that uses a
walk-forward (F-13, the F-37–F-59 OOS machinery) scores **parameter-free signals**, for which the label
span is 1 → zero leak (row H = 1). The repo's controller, however, trains on labels with a horizon
(`labelHorizonBars`; the opt-in `label:triple` policy sets a vertical barrier `maxHolding`), so the leak's
precondition is met on the shipped model path whenever a label horizon exceeds 1. Whether the controller
actually exploits it needs a model-level measurement, which this cycle does not claim — the leak is
**confirmed structurally** and **demonstrated exploitable in principle**; its live magnitude on the
controller is the follow-up.

## What is now false that used to be believed

* **"The whole split family purges and embargoes."** False: only `purgedKFoldSplit` and
  `combinatorialPurgedSplit` do. `walkForwardSplit` — the path the repo A/B and the lab's F-13 actually
  use — has no `labels`/`labelSpan`/`embargo` parameters, adds no purge metadata to its folds, and leaks
  `H(H−1)/2` label-overlap edges per fold for any label horizon H > 1.
* **"`isCausalFold` certifies the walk-forward."** False for horizon labels: it tests index order
  (`train < test`), not label-window overlap, so it passes every leaky fold. It is a *look-ahead-in-time*
  check, not a *leakage* check.
* **"`test/lock-registry.js` proved zero label-window leakage."** Overstated: the repo's tests call
  `assertNoLeakage` only on the purged K-fold and CPCV variants (and `isCausalFold` on the walk-forward);
  the walk-forward's leakage is **never asserted**, and is non-zero. This is the L10-t lesson again — a
  test-ledger claim is itself a claim.
* **"A synthetic label-horizon model is needed to expose a split leak."** False in this case: the leak is
  a closed-form count of label-window overlaps (`0 < j−i ≤ H−1`), measurable without randomness; the
  exploit only confirms it is not merely cosmetic.

## Ledger effects

* New **F-63**; new experiment `e55_split_audit.js`, new artefact `results/e55_split_audit.json`;
  `run_all` is now **63 steps** (32 gated). The register gains **L10-af** (`walkForwardSplit` is
  unpurged) and **L10-ag** (the repo's split ledger claims family-wide zero leakage but tests only the
  purged variants). A **FOLD-BACK R9 (candidate)** is added: purge the walk-forward boundary for horizon
  labels (drop training labels that overlap the test window), conditional on confirming the controller's
  label horizon — it is the same one-line idea as the purged K-fold, applied to the walk-forward path.
* This is the lab's **third** synthetic-ground-truth audit of a repo module (`e53` carry grid, `e54`
  dependence) and the first that audits **split/leakage** rather than an arithmetic transform. The
  closed-form-count variant introduced here (leak edges) is now a standing recipe alongside the additive
  closed forms and the 2.5-SE ensemble bands.

## Next

* **L10-ag follow-up:** measure the controller's actual label horizon (`labelPolicy` / `labelHorizonBars`
  defaults; `labels.js#tripleBarrierLabels.maxHolding`) and, if > 1, run a model-level leak test through
  `walkForwardEvaluate` to decide whether R9 is live or latent. This is the only thing between F-63 and a
  live shipped-path verdict.
* Remaining L10 rows: **L10-ad** (the carry attribution lag), **L10-e** (the feature `closes` contract),
  **L10-h** (golden movement for any R1–R8/R9 port).
* The synthetic-ground-truth sweep of the pure analysis modules: `labels.js`, `overfitting.js`
  (PBO/CSCV), `forecast.js`, `race.js`. `splits.js` is now covered.

## Run

`e55` ~0.1 s (registered). Full `run_all` regeneration **63 steps, 32 gated, 0 fails** (`RUN_SUMMARY` at
**2026-09-27T04:07:42Z**, machine-load dependent); controls `e0c`, `e5` (1h/15m), the 14-check `e14`, and
the validation guards `e28`–`e55` all report `pass`. The gate-less exploratory steps report timing only.
