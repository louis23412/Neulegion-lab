# CYCLE-096 — Round 63: learner slot gate (walk-forward)

**Date:** 2026-09-29
**Goal:** ask the slot-level question the three ports exist to answer: does any of them beat the prior out of sample?

## Measured (lab, no repo change)

* `e100_learner_gate.js` (3/3): walk-forward Brier skill vs the base-rate plugin — ridge **+0.0036**, mlp **−0.0222** over 24 cells, all finite (F-110).

## Decision

NEGATIVE, and usefully so: the slot machinery works (finite everywhere, skills measured), and the numbers say what G-A always said — the target, not the model class, is the constraint. The learners stay UNTESTED/off-roster until a run with new features says otherwise; the promotion bar is a measured skill, not a port. This closes the V2.3 arc as far as this environment can take it: contracts → three ports (all bit-exact) → slot gate. What remains needs native execution (`npm test` for the 3009-check ledger, gate runs, venues, G5). Hand to the operator.
