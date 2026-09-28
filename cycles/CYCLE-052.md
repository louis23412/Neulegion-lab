# CYCLE-052 — The successive-halving racing engine: exact against its own closed forms, but its "a racing budget does not change the decided set" requirement is a tautology on the test fixture — and the race can cost more than the grid it replaces (L10-bg…L10-bk)

**Date:** 2028-05-16
**Goal:** `analysis/race.js` (round 26, R26-15) is the successive-halving / Hyperband family-search engine
(Jamieson & Talwalkar 2016; Li et al. 2018): every arm is scored at the cheapest rung, only the top `1/eta`
survive to a budget `eta` times larger, and the race stops when one arm remains. The shipped `analyze`
driver deliberately exposes **no** `--race` flag (the R26-15 gate is closed — `RUN-ANALYSIS.md` §7 measured
neither an economics nor a diversity win), so the module is **engine-only / test-only**. But its docstring
and `docs/LOCKED.md` make a strong *correctness* claim — *"a racing budget must not change the decided
set"*, validated against a full-grid oracle — and that claim is cheap to test while the gate is shut.

## Work

New experiment `experiments/e60_race_audit.js` (registered; **68 steps, 37 gated, 0 fails**; 27 ms in the
suite; **18 checks, all pass**). One probe cycle first (`probe_race`) established the witnesses, then was
deleted. The audit has three parts: the closed forms, the engine's contracts, and — the interesting part —
a **budget-expenditure model** and a **budget-DEPENDENT evaluator** (which is the SHA premise: a cheap rung
is a noisy estimate).

## Results

### A. The closed forms and the engine contracts are exact (validated)

| claim | measurement |
| --- | --- |
| `halvingRounds` = `max(1, floor(log(max/min)/log(eta)) + 1)` | exact for `(9,1,3)→3`, `(9,1,2)→4`, `(27,1,3)→4`, `(3,1,3)→2`, `(2,1,3)→1`, `(9,9,3)→1` |
| … and its guards return 0 | `eta ≤ 1`, `minBudget > maxBudget`, non-numeric inputs, `{}` |
| `halvingSchedule`'s `keep = max(1, ceil(survivors/eta))` at every rung | exact on 5 grids (incl. 100 arms / budget 27) |
| the first rung is full width; the budgets are monotone; `roundsUsed ≤ halvingRounds` | exact |
| the top rung reaches exactly `maxBudget` when every round runs | exact (`(9,9,2)→[1,2,5,9]`, `(100,27,3)→[1,3,9,27]`) |
| the schedule stops early once one arm remains | exact (`(9,9,3)→[1,3]`, already 1 survivor) |
| the §AM fixture's race: winner `a`, `evaluated` 12, `spentBudget` 18, `gridBudget` 81 | exact |
| `scored` is the full rung in arm order; `survivors` = top `keep`; `lost` = the finite arms beyond `keep`; `lost ∩ survivors = ∅` | exact |
| a non-finite evaluation is eliminated, never ranked | placed in `nonFinite`, excluded from `lost`/`survivors` |
| `maximize:false` selects the lowest score | winner `a8`, rung-0 survivors `a8,a7,a6` |
| deterministic; identical under a sync or an async evaluator; ties are stable (arm order) | byte-identical results |
| cost counters reconstruct | `evaluated`, `spentBudget`, `survivorEvaluations`, `gridBudget = n·round(maxBudget)` on 6 grids |
| guards | empty arms, missing `evaluate`, `maxBudget = NaN` or `0` → `available:false` with a reason |
| `formatRace` | the fixture string, `null`, and an unavailable block all render |

### B. The stated correctness requirement does not hold (L10-bg)

`docs/LOCKED.md`: *"Validated against the brute-force full-grid oracle (the race winner equals the grid
winner, so a racing budget does not change the decided set)."* The §AM fixture is
`evaluate(arm, budget) = arm.q + (arm.q > 0 ? 0.05 : -0.05) / budget` — a scoring rule whose **ranking is
identical at every budget** (`rank(1) == rank(9)`), so the oracle agreement is a **tautology**; and the
fixture's schedule is `[1, 3]`, i.e. the race's top rung is **3 while the "oracle" is evaluated at 9** — a
budget the race never visits.

With a budget-dependent evaluator (the SHA premise), the race eliminates the arm that is best at the full
budget. Witness: eight `early` arms strong at budget 1 / weak at 9, one `late` arm mediocre at 1 / best at
9 → the race's rung-0 `lost` set contains `late`, and the race returns `early0` while the top-budget oracle
returns `late`. Over seeded ensembles whose low-budget score is `q + N(0,1)·2/sqrt(budget)`, the race
disagrees with the top-budget argmax on

| eta | maxBudget | K | reps | disagreement |
| ---: | ---: | ---: | ---: | ---: |
| 3 | 27 | 16 | 120 | **0.617** |
| 3 | 9 | 16 | 120 | **0.617** |
| 3 | 3 | 16 | 120 | **0.700** |
| 2 | 16 | 16 | 120 | **0.625** |

That is the known character of successive halving (a best-arm-identification *heuristic*, not an exact
selector) — but the module states the opposite as a validated requirement, and the test that is supposed to
enforce it cannot fail.

### C. The race can spend MORE budget than the grid it replaces (L10-bh)

`spentBudget = Σ_r budget_r · scored_r` vs `gridBudget = n · round(maxBudget)`. The module's framing
(*"the search cost is `O(arms)` at the cheapest rung instead of `O(arms)` at the full budget"*) and the
repo test's `spentBudget < gridBudget` identity hold only when the budget ratio is large:

| n | maxBudget | eta | rung budgets | spentBudget | gridBudget | ratio |
| ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 9 | 9 | 3 | 1→3 | 18 | 81 | 0.222 |
| 9 | 4 | 2 | 1→2→4 | 31 | 36 | 0.861 |
| 16 | 2 | 2 | 1→2 | 32 | 32 | **1.000** |
| 100 | 2 | 2 | 1→2 | 200 | 200 | **1.000** |
| 9 | 2 | 2 | 1→2 | 19 | 18 | **1.056** |
| 9 | 3 | 2 | 2→3 | 33 | 27 | **1.222** |
| 100 | 10 | 1.1 | 25 rungs | 2890 | 1000 | **2.890** |

When `maxBudget/minBudget` is small relative to the round count, the early full-width rungs dominate and
the race is *more* expensive than the grid. The repo test sits in the one regime (ratio 0.222) where the
saving is large.

### D. Small `eta` collapses consecutive rungs to the same integer budget (L10-bi)

`halvingSchedule` multiplies an **unrounded** budget by `eta` but stores and evaluates
`Math.round(budget)`. For a small `eta` (or a small budget) several consecutive rungs round to the **same**
integer, so those rungs re-score the survivors at the same budget — the "budget `eta` times larger"
reallocation does not happen, and `spentBudget` inflates:

| eta | arms | maxBudget | rungs | repeated consecutive budgets | cost ratio |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1.1 | 100 | 10 | 25 | **15** | **2.890** |
| 1.2 | 100 | 10 | 11 | 4 | 1.520 |
| 1.5 | 100 | 10 | 6 | 0 | 0.79 |
| 2.0 | 100 | 10 | 4 | 0 | 0.55 |

(The eta=1.1 schedule is `[1,1,1,1,1,2,2,2,2,2,3,3,3,4,4,4,5,5,6,6,7,8,8,9,10]`.)

### E. `eta` and `minBudget` are not validated (L10-bj)

`halvingRounds` guards `eta ≤ 1` and `minBudget > maxBudget` (returning 0 rounds), but `successiveHalving`
does not check its own `eta`/`minBudget`: the schedule is empty, **no arm is ever evaluated**, and the
result is `available: true` with `winner: null` / `winnerId: null` for `eta = 1`, `eta = 0.5`,
`eta = 0` and `minBudget > maxBudget` — a silent degenerate success rather than `available:false`. The
module *does* validate `arms`, `evaluate` and `maxBudget` (all three refused), so the omission is
inconsistent with its own contract.

### F. Scope (L10-bk)

Engine-only / test-only: no shipped module imports `race.js` (only `analysis.test.js` §AM and
`locks.test.js`'s export pin), and `analyze.js` deliberately exposes no `--race` flag. So every row above
is latent — but the *claim* that would license turning the flag on is the one that fails.

## What is now false that used to be believed

* **"The race winner equals the full-grid oracle — a racing budget does not change the decided set."** True
  only where the evaluator's ranking is budget-independent (the test fixture) and the race's top rung is
  `maxBudget`. On a budget-dependent evaluator the race discards the top-budget best on **0.62–0.70** of
  seeded fixtures, and the §AM fixture's own top rung (3) is below its oracle's budget (9).
* **"The race spends less budget than a full grid."** `spentBudget > gridBudget` whenever the budget ratio
  is small relative to the round count (up to **2.89×**).
* **"Only the top 1/eta survive to a budget eta times larger."** For a small `eta` the integer rounding
  leaves consecutive rungs at the same budget (15 of 25 rungs at `eta = 1.1`).
* **"The engine refuses an invalid configuration."** It refuses a bad `maxBudget`/`arms`/`evaluate` but
  not an invalid `eta`/`minBudget`, returning `available:true` with a `null` winner and zero evaluations.

## Ledger effects

* **F-68** is added: `race.js` is **validated** on its closed forms and engine contracts (18/18) with four
  registered rows — **L10-bg** (the decided-set claim / tautological oracle), **L10-bh** (the budget-saving
  identity is not universal), **L10-bi** (the small-`eta` rung collapse), **L10-bj** (unvalidated
  `eta`/`minBudget`) — plus **L10-bk** (scope: engine-only, test-only). No fold-back row.
* `e60_race_audit.js` is the register's **seventh synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e59`). `run_all` is now **68 steps, 37 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T06:13:12Z**).

## Next

* Finish the pure-module sweep: **`benchmark.js`** (the P1 model-class forecasters).
* Remaining L10 rows: **L10-e** (the feature `closes` contract), **L10-h** (golden movement for any R1–R9
  port), **L10-ad** (the carry attribution lag), **L10-ae** (the `effectiveBars` unbounded limit).

## Run

No repo file is touched. Full regeneration: `run_all` → **68 steps, 37 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T06:13:12Z** (`e60` 27 ms; `e0d` remains the slowest step at ~168 s).
