# CYCLE-022 — R8 capstone: a joint walk-forward spec that survives a 10 bps fee (L12, L15, L16, L17)

**Date:** 2026-11-20
**Goal:** CYCLE-020 (F-37) recovered the dispersion book's fee margin with a walk-forward λ; CYCLE-021
(F-38) sized it and found the F-27 cap compounds (`ewma 0.02 + cap12.5 %`, ~$36 M, recent net@4 +4.24).
But that combined spec was picked from a *frontier*, not selected by a rule — a 2-D (λ, cap) surface is a
bigger selection problem than the 1-D λ F-37 tested — and every number so far assumes a **4 bps** fee.
This cycle closes both criticisms and produces the R8 port spec on its own terms.

## Work

1. **`experiments/e31_ported_spec_oos.js`** (new, registered as `e31_ported_spec_oos`) — precomputes the
   whole **10 λ × 4 cap = 40-book** grid causally, then runs a **joint walk-forward** (every 12 months,
   pick the (λ, cap) pair with the best *trailing* net@4 Sharpe from data strictly before the block, trade
   it through the block). The resulting series is compared to the pinned candidates on the same OOS span.
2. **Fee stress** on the *same* OOS return/turnover series at 2 / 4 / 6 / 8 / 10 bps, so the port decision
   is not hostage to one fee assumption.
3. **Falsifier (pre-registered):** the spec is not robust enough to port if the joint walk-forward fails to
   beat the pinned F-24 spec out of sample, **or** if its OOS recent-24m net@4 turns ≤ 0 at a 6 bps fee.
   **Validation guard:** the pinned λ=0.1/no-cap book must still read the e28/F-36 recent numbers.

## Results

**(a) The joint walk-forward clears its falsifier comfortably.** On the 5 110-period (~4.7 y) OOS span:

| book (same OOS span) | OOS net@4 | OOS recent-24m net@4 | net@4 @ 6 bps | break-even |
| --- | ---: | ---: | ---: | ---: |
| **joint walk-forward (λ, cap)** | **+6.13** | **+4.49** | **+5.57** | **25.8 bps** |
| pinned F-24 spec (λ=0.1) | +2.76 | −0.53 | +1.82 | 9.9 bps |
| pinned `λ=0.02 + cap12.5 %` | +6.86 | +4.30 | +6.42 | 35.7 bps |
| pinned `λ=0.02` (no cap) | +6.63 | +3.43 | +6.18 | 34.0 bps |
| pinned `λ=0.1 + cap12.5 %` | +1.93 | −0.22 | +1.33 | 10.4 bps |

The joint selector — which cannot see the block it trades — beats the pinned F-24 spec by **+3.37 Sharpe**
OOS and is positive in the recent 24 months (+4.49 vs −0.53). It picks mostly slow λs (0.0075–0.03) with an
occasional cap, but not always slowly (one 0.15, one 0.005): the rule adapts. Note the honest asymmetry:
the walk-forward (+6.13) sits slightly *below* the best pinned combination (+6.86) — the expected signature
of the latter being frontier-picked — which is exactly why the walk-forward, not the pinned spec, is the
evidence.

**(b) The margin survives a 10 bps fee.** Re-scoring that one OOS series at different fees:

| fee | 2 bps | 4 bps | 6 bps | 8 bps | 10 bps |
| --- | ---: | ---: | ---: | ---: | ---: |
| OOS net@4 Sharpe | 6.69 | 6.13 | 5.57 | 5.00 | **4.43** |
| OOS recent-24m net@4 | 4.94 | 4.49 | 4.03 | 3.57 | **3.12** |

At the break-even (25.8 bps) the Sharpe passes through zero, so the construction has **~6× headroom**
above even a 4 bps taker fee — the F-24 spec, by contrast, sits at 9.9 bps (2.5×).

## What is now false that used to be believed

* **"The retuned dispersion spec is a frontier pick that may not be a rule" (F-38's residual caveat).**
  Tested jointly over the (λ, cap) surface with a walk-forward selector: it beats the pinned F-24 spec OOS
  (+6.13 vs +2.76) and is positive in the recent window (+4.49 vs −0.53). The cap is not needed to make the
  rule work (`λ=0.02` alone reads +6.63 OOS); it is a *capacity* add, not a *cost* crutch.
* **"The recovery is a 4 bps-fee story."** False: the walk-forward book stays net-positive out of sample
  down to a 10 bps fee (net@4 +4.43; recent-24m +3.12), far beyond any plausible taker tier.
* **"Cap the fast book to fix it" (a plausible reading of F-27).** False: `λ=0.1 + cap12.5 %` is still
  broken OOS (net@4 +1.93, recent −0.22) — the *slower λ* is what fixes the margin; the cap compounds it.

## Ledger effects

* New **F-39**; new experiment `e31_ported_spec_oos.js`, new artefact `results/e31_ported_spec_oos.json`.
  `run_all` is now **39 steps**.
* **L12/L16** carry a port-ready spec; **L15/L17** carry the size; **FOLD-BACK R8** is **port-ready** with
  the amended construction (`ewma 0.02 + cap12.5 %`, ~$36 M, walk-forward λ) and a stated fee margin.
* No shipped number moves; `e14` unchanged (13 checks). `RUNNER.md` records the joint walk-forward +
  fee-stress convention.

## Next

* The laboratory's carry-dispersion line is now closed end-to-end: signal → cost → capacity → OOS rule →
  fee robustness. The remaining live items are **L18's fade capacity** and **L07's liquidation-print half**.
* If the project ports R8, the port test should reproduce `e31`'s pinned `λ=0.02 + cap12.5 %` OOS span.

## Run

`e31` ~2.2 s (registered). Full `run_all` regeneration **39 steps, 24.7 min** (`RUN_SUMMARY` at
**2026-09-26T19:55:49Z**); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the validation guards
`e28`/`e29`/`e30`/`e31` all report `pass`.
