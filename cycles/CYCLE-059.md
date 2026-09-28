# CYCLE-059 — The order-preserving scheduler: the queue contract holds exactly, but `normaliseConcurrency` never validates its `max`, and the fold executor silently nulls a malformed `confidence` (L10-ce…L10-cf)

**Date:** 2028-07-04
**Goal:** `analysis/parallel.js` (round 26, R26-4) is the module the A/B's parallel fold loop stands on. Its claim
is narrow and load-bearing: the scheduler runs N units with C in flight and returns the results in **unit
order**, so `folds.jsonl` and the per-variant checkpoints stay byte-identical between the serial and parallel
paths. It is **shipped** — `backtest.js` and `walkforward.js` call `normaliseConcurrency`/`scheduleUnits`,
`analyze.js` calls `makeFoldExecutor`/`normaliseConcurrency`, and `fold_worker.js` posts the reply shape the
executor validates.

## Work

New experiment `experiments/e67_parallel_audit.js` (registered; **75 steps, 44 gated, 0 fails**; 49 ms in the
suite; **7 checks, all pass**). The audit verifies the concurrency normaliser's serial/floor/cap contract, the
scheduler's order/concurrency/reporting contract and its failure semantics, the edges, and the fold executor's
reply adaptation; then it pins two defects. Two findings followed.

## Results

### A. `normaliseConcurrency` is exact on its documented input (validated)

Every non-finite / non-positive width maps to **serial (1)** — `0, −3, NaN, Infinity, −Infinity, null, undefined,
'3', true, false, 0.5, 1` all → 1 (never unbounded); a fractional width floors (`2.9 → 2`, `1.5 → 1`); and the
default cap holds (`1e6 → 64`, `65 → 64`, `64 → 64`). Deterministic.

### B. The scheduler's queue contract holds exactly (validated)

On 10 units at concurrency 3: results come back in **unit order** under an out-of-order completion schedule
(finish order `2,1,0,5,4,3,6,8,7,9`), `exec` is called **exactly once per unit**, and the peak in-flight count is
**3** (never more). `onResult` fires for all 10, **out of order**, and a **throwing reporter does not fail the
run** (`[1,2,3]` still returned). With `concurrency: 1000` on 5 units the peak is 5 (bounded by `n`, all start).

### C. The failure semantics hold exactly (validated)

With 8 units at concurrency 2 and unit 1 failing: the call rejects with the **first** error (`boom-1`), only
units `[0,1,2]` started, and **every started unit's `exec` settled** (`settled === started`, so no promise is
left dangling). Two failures → the first wins (`e0`). A **synchronous** throw in `exec` propagates (`sync`).
Empty input → `[]`; a non-array or a missing `exec` rejects.

### D. `makeFoldExecutor` adapts the reply (validated)

The happy path maps the worker's `{positions, confidence, stats}` to `{signals, confidence, stats}` and passes
the request through **verbatim** (identity-checked). A `null`/`undefined` reply, a missing `positions`, or a
non-array `positions` (including a `Float32Array`) throws the named `"fold executor: malformed reply"`
error.

### E. `normaliseConcurrency` never validates its `max` (L10-ce)

Only the **value** is validated; the cap is used raw in `Math.min(Math.floor(value), max)`:

| call | returns |
| --- | --- |
| `normaliseConcurrency(10, {max: 0})` | **0** |
| `normaliseConcurrency(10, {max: −2})` | **−2** |
| `normaliseConcurrency(10, {max: 2.5})` | **2.5** |
| `normaliseConcurrency(10, {max: 0.5})` | **0.5** |

So a bad cap makes the "normalised concurrency" a non-positive or fractional number — contradicting the
export's own contract. It is not reachable through `scheduleUnits` (which passes `{max: n}` with `n ≥ 1`) or
through the shipped callers (`walkforward.js`/`backtest.js` pass `{max: folds.length}`), so it is a
direct-call/export-level gap. LATENT.

### F. The fold executor validates `positions` but silently nulls a malformed `confidence` (L10-cf)

`confidence` is `Array.isArray(reply.confidence) ? reply.confidence : null`, and `stats` is
`reply.stats || null`:

| reply | result |
| --- | --- |
| `positions: new Float32Array([1])` | **throws** (malformed reply) |
| `confidence: 5` / `new Float32Array([1,2])` | **silently `null`** |
| `confidence: []` | `[]` (present-but-empty) |
| `stats: 0` / missing | **silently `null`** |

So half a malformed worker reply raises and half is absorbed. A worker that switched its `confidence` to a
typed array would silently lose the **R26-3 raw pre-policy confidence** that the whole turnover experiment is
built on — "no confidence" instead of an error. `fold_worker.js` posts a plain array or `null`, so this is
LATENT, but it is an asymmetry in a function whose stated job is "validating the reply".

### G. Scope

`parallel.js` is shipped and load-bearing for the serial/parallel byte-identity claim, but both findings are
latent (the bad `max` needs a direct caller; the worker always posts an array-or-null confidence). The
order-preservation / bounded-concurrency / no-dangling-promise contract — the thing the module exists for — is
validated exactly. No golden moves and `no fold-back row`.

## What is now false that used to be believed

* **"`normaliseConcurrency` normalises a concurrency request."** It normalises the *value*; a `max` cap of `0`,
  negative or fractional flows straight through, so the returned "concurrency" can be 0, −2 or 2.5.
* **"`makeFoldExecutor` validates the worker's reply."** It validates `positions` (throwing) but silently maps a
  non-array `confidence` and any falsy `stats` to `null`, so half a malformed reply is absorbed rather than
  raised — a wrong-type confidence becomes "no confidence".
* **"The scheduler can be trusted to bound concurrency."** Yes — but only against `n`: `normaliseConcurrency`'s
  documented default cap of 64 is overridden to `n` by `scheduleUnits`, so a huge request runs all `n` units at
  once (bounded, just not by 64).

## Ledger effects

* **F-75** is added: `parallel.js` is **validated** against its documented contract (7/7 checks) with two
  registered rows — **L10-ce** (`normaliseConcurrency` does not validate `max`; witnesses 0 / −2 / 2.5 / 0.5) and
  **L10-cf** (`makeFoldExecutor` silently nulls a non-array `confidence` and any falsy `stats`, while throwing on
  a bad `positions`). Both latent; no fold-back row.
* `e67_parallel_audit.js` is the register's **fourteenth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e66`). `run_all` is now **75 steps, 44 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T08:56:38Z**).

## Next

* Remaining pure modules: **`holding.js`** (the turnover policy grid), then `decision.js` / `replication.js` /
  `dependence.js` (partially covered by `e54`).
* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded).

## Run

No repo file is touched. Full regeneration: `run_all` → **75 steps, 44 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T08:56:38Z** (`e67` 49 ms; `e66` 49 ms; `e0d` the slowest; total **547 s** this run).
