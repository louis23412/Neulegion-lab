# CYCLE-113 — Round 84c: HAR-residual closes the model track (e117)

**Date:** 2026-09-30
**Goal:** answer the last book-actionable model question: does the HiveMind
predict what the linear vol reference cannot? A positive justifies the V2.3
vol-learner port; a negative closes the model track's measurement phase.

## Measured (lab, read-only on the repo)

* `e117_har_residual.js` (3/3, `results/e117_har_residual.json`): 8h-analogue
  HAR(1,3,21) per stream, OLS on train, positive-residual label — HiveMind
  skill **−0.0090**, ≤5/24 positive (best +0.016, noise-shaped). F-129
  NEGATIVE, exactly the pre-registered hypothesis.
* Registered in `run_all.js`.

## Decision

Model track final ledger (round 84): directional CLOSED (e114), 1h magnitude
SUPPORTED-but-not-book-actionable (e115), 8h magnitude CLOSED (e116),
HAR-residual CLOSED (e117). No V2.3 vol-learner port — the slot stays a
base-rate farm team. Only 1h-horizon execution uses remain open (idea, not
measurement). TODO 111 marked measured-complete; model attention returns to
the locked-core upgrade question (which locked part, if any, is the
constraint — a future round with fresh research). No repo change.

## Operator commands (none — lab + docs only)

No commands, no uploads. `npm test` NOT needed (repo untouched).
