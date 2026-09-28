# CYCLE-002 — Challenge L01, verify the ledger, close the cheap audit rows

**Date:** 2026-09-18
**Goal:** attack the lab's one *critical* claim (F-01 / L01) through the repo's own aggregation, verify
every number in `FINDINGS.md` against freshly regenerated artefacts, and work the cheapest rows of the
L10 audit register.

## Work

### 1. Regenerate and verify (L10 + ledger integrity)

Regenerated all artefacts with `run_all.js` (`RUN_SUMMARY.json` now written by the run itself, so a
regeneration is self-recording). Controls green in the same run: `e0c` pass, `e5` 1h/15m pass.

Then checked every `FINDINGS.md` number against the fresh JSONs. **All matched to display precision**
except F-10 (below):

| finding | claim | artefact | result |
| --- | --- | --- | --- |
| F-01 | +1.267 @600, +0.110 @53 500 | `e0b` | ✓ 1.2674 / 0.1102, de 4.48/4.92 |
| F-02 | 0.623 / 4.92 / 1.47 (1h); 0.732 / 3.62 / 1.77 (15m) | `e0` | ✓ 0.6229 / 4.922 / 1.471; 0.7322 / 3.621 / 1.766 |
| F-03 | xs de 0.39–0.60 | `e2` | ✓ 0.555/0.459/0.597/0.389 |
| F-04 | +4.78 %/yr, Sharpe 0.958, DD 10.15 %, r 0.115 | `e3` | ✓ |
| F-06 | upgrades ≤ +0.147, break-even ≤ 2.6 bps | `e2`,`e4` | ✓ |
| F-08/F-09 | vol-cond +0.112 vs +0.110; OOS −0.009/−0.073 | `e6` | ✓ |
| F-11 | oracle +12.25, random ≈ 0 | `e5` | ✓ |
| **F-10** | "Sharpe ≈ 2.1" | `e7` | **artefact stored the mirror (−2.07)** — sign bug, fixed |

### 2. F-01 under the repo's own aggregation — L10-c (new: F-13)

Built `e0d_ab_aggregation.js`, which runs the repo's real path read-only —
`walkForwardSplit({trainSize:60, testSize:15})` → `walkForwardEvaluate` → `poolReports` — for the
shipped `sig-momentum`, on the 600/2400/9600/full history slices, beside the contiguous readout:

| bars | folds/stream | A/B pooled | contiguous pooled | reported |
| ---: | ---: | ---: | ---: | ---: |
| 600 | 36 | **+1.106** | +1.190 | **+1.0848** |
| 2400 | 156 | +0.006 | −0.009 | — |
| 9600 | 636 | +0.110 | +0.122 | — |
| 53 500 | 3562 | **+0.109** | +0.110 | — |

The repo's own path lands **on** the reported +1.0848. F-01 holds under the repo's arithmetic; the
claim is about the sample, not the aggregation. **L10-c resolved — no defect.**

### 3. What a full-history signal run actually costs — F-14

Timed the pieces at full history: 8 × `walkForwardEvaluate` (3562 folds each) = **~250 ms total**, but
`poolReports` = **≈155 s**, almost all in `dependenceSummary` over 3562 fold lengths. So the cost of
a long-sample *signal* run is the design-effect estimate, not the O(n²) model — which sharpens R1:
score contiguously (equivalent, F-13) or bound the cluster count.

### 4. Two lab-local defects found and fixed (L10-j, L10-k)

* **L10-j** — `lib/lab.js#tail` sliced `close`/`volume` but not the derived `returns`/`closes`/`volumes`
  that `prepare` attaches, so `tail` on a prepared panel would pair full-length `returns` with a
  truncated `close`. Fixed to slice the derived arrays too.
* **L10-k** — `e7_basis_reversion.js` set its position to the **mirror** of its stated hypothesis
  (`pos = −z`), so the artefact stored the losing orientation (−2.07) while its own IC was positive
  and the prose quoted +2.1. Fixed: `pos = +z` for the convergence bet, and both orientations are now
  stored (`basisOnly` / `followOnly`). Verdict unchanged (design effect 1675).

### 5. Ledger updates

* `FINDINGS.md`: added **F-13** and **F-14**; rewrote **F-10** (sign + erratum, verdict → PARKED);
  closed F-01's "honest caveat"; summary table updated.
* `leads/`: L01 (F-13 evidence + log; falsifier survived), L10 (L10-c resolved, L10-g scope-confirmed,
  L10-j/k fixed), L11 (sign + erratum).
* `FOLD-BACK.md`: R1 status — falsifier tested and survived, with the two implementation notes.
* `THEORY.md`: J1 refined with the F-14 cost decomposition.
* `RUNNER.md` / `PROTOCOL.md` / `INDEX.md` already carried the conventions this cycle used.

## Ledger effects

* New findings: **F-13** (SUPPORTED), **F-14** (SUPPORTED).
* Changed: **F-10** (number sign corrected, verdict PARKED).
* No existing measurement moved: every regenerated artefact reproduced its ledger value.

## What is now false that was believed at the start of the cycle

* "F-01 might be an artefact of the lab's contiguous scoring rather than the window." → **false**; the
  repo's own fold+pool reproduces the window effect (F-13).
* "`e7`'s −2.07 was the correctly-signed basis book." → **false**; the code was the mirror of its
  hypothesis and the correctly-signed book is +2.07 (design effect 1675 — still dead).
* "A long-sample signal run is expensive because of the O(n²) model." → **false**; the model is not in
  the signal path; the cost is `poolReports`' dependence estimate (F-14).

## Next

* **CYCLE-003** — open the frontier: L07 (derivatives microstructure data: taker imbalance first,
  it is free in the Binance kline payload), then L09 (volatility predictability / sizing),
  L06 (meta-labelling feasibility), L12 (cross-sectional carry), L13 (reversal gross edge).
* Keep the L10 register moving: L10-d (carry-grid alignment), L10-f (`effectiveBars` bound), L10-e
  (feature `closes` contract).
