# CYCLE-047 — Scoping F-63: the walk-forward leak is latent, not live, on the shipped controller (L10-ag resolved)

**Date:** 2028-04-11
**Goal:** CYCLE-046 (F-63) left one thing unmeasured: the walk-forward boundary leak is a real property
of `walkForwardSplit`, and the label-span precondition is met (the repo's own diagnostic reads
`heldBars {mean 8.30, max 54}` on the shipped `optimistic` labeller — labels *do* overlap), but whether
it reaches **the shipped model path** was left open. That is the `L10-ag` follow-up R9 is gated on.
This cycle resolves it by tracing what the controller actually trains on.

## Work

No new experiment — this is a **code-trace scoping** of F-63 (the lab's L10-b / L10-g / L10-s class:
a claim settled by reading the code and citing it). Two facts decide it:

1. **How the fold fits the controller.** `analyze.js#makeControllerModelFactory` fits a fold by replaying
   the model over bars `i = 1 … testStart`, each call seeing only the window that ends at `i − 1`
   (`for (let i = 1; i <= testStart; i++) ctl.getSignal(candles.slice(Math.max(0, i - cacheSize), i), 1)`,
   `analyze.js:1018`). The last bar the fit ever sees is **`testStart − 1`**. The fold's declared `train`
   index list is **ignored** — the factory trains on `[0, testStart)` regardless.
2. **How a label is realised.** `hivemind/controller/trades.js` labels a trade by its **outcome at the exit
   bar** (`heldBars` elapsed bars after entry), and only *closed* trades enter training. So a training
   label's outcome is a function of candles up to its exit bar.

Together: every training label's outcome is realised at an exit bar `≤ testStart − 1`, i.e. **before the
first test bar** — so no training label can be a function of a test-period return. The F-63 leak needs a
training label *realised inside the test window*; on this path there is none.

## Results

**F-63 is scoped down: the walk-forward leak is LATENT on the shipped path, not live.** The leak is a
genuine property of `walkForwardSplit` and its precondition is met (labels span ~8 bars on average), but the
only consumer of `walkForwardSplit` in the shipped A/B is an **online** controller whose training sample is
realised at the trade's exit, and whose fit stops at `testStart − 1`. The leak would be live for a
**fixed-label offline** model that fits the fold's training *block* — the shape the F-63 exploit models — and
the repo simply does not run one on this path.

Concretely, the three conditions a live leak needs, and where each fails on the shipped path:

| condition | shipped A/B |
| --- | --- |
| a label span > 1 | **met** — `heldBars {mean 8.30, max 54}` on `optimistic` |
| a training label realised **inside** the test window | **not met** — labels realised at exit ≤ `testStart − 1` |
| the model fits the fold's declared training **block** | **not met** — the factory ignores `train` and replays `[0, testStart)` |

So R9's fix (purge the walk-forward boundary) is **not needed for the shipped default or the controller
variants**; it becomes relevant only if the project adds a fixed-label offline model behind
`walkForwardSplit`. R9 is **downgraded to latent / low-priority**, and the `e55` guard stays (so a future
offline model cannot silently inherit the leak).

## What is now false that used to be believed

* **"F-63's leak is live because the shipped controller trains on overlapping labels."** False: the labels
  overlap, but the online controller only ever trains on labels *realised* at the trade's exit, and its fit
  stops one bar before the test — so the training set is causally closed. The overlap is a property of the
  label *span*, not of the training *set*.
* **"`walkForwardSplit`'s folds drive the controller's training window."** False: the controller factory
  ignores the fold's `train` list and replays the whole history `[0, testStart)`. The walk-forward's
  train/test split is, for this model, only a **test-start marker**.

## Ledger effects

* **F-63 is amended** (scope resolved: latent, not live; CYCLE-047). New register row **L10-ah** (the
  online-realisation-at-exit immunity). **FOLD-BACK R9 is downgraded to latent / low-priority.** No new
  experiment, no new `F`; `run_all` stays **63 steps** (32 gated). This is the lab's first cycle whose
  deliverable is a **negative scope** on a shipped-path alarm — recorded so a future reader does not
  re-open R9 as urgent.

## Next

* Remaining L10 rows: **L10-ad** (the carry attribution lag — the last open carry-grid question),
  **L10-e** (the feature `closes` contract), **L10-h** (golden movement for any R1–R8 port).
* The synthetic-ground-truth sweep of the pure analysis modules continues: **`labels.js`**
  (`tripleBarrierLabels` / CUSUM — a natural follow-on to this scoping, since label spans are exactly what
  F-63/F-64 turned on), then `overfitting.js` (PBO/CSCV), `forecast.js`, `race.js`.

## Run

No code change to `run_all`; the last full regeneration remains **63 steps, 32 gated, 0 fails**
(`RUN_SUMMARY` at **2026-09-27T04:07:42Z**). The F-63 guard (`e55`) still reports `pass` — F-63's *facts*
are unchanged; only its *scope* moved.
