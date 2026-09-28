# CYCLE-028 — Is the OI-change signal unrescuable, or was it F-23 again? (L07, challenges F-28)

**Date:** 2026-11-26
**Goal:** F-28 closed open interest as a *directional* signal on two reads — the pooled next-8h IC of
Δlog(OI) is 0.020 (≈0), and the cross-sectional book in `e21` is **churned to death** (gross Sharpe
**+0.96**, turnover **1501×/yr**, break-even **1.89 bps**, net@4 **−1.07**). The lab has since carried the
line "do not port OI as a directional stream" (FOLD-BACK R7, THEORY §3, L07).

But the lab made this exact mistake once and corrected it: F-23 killed the funding-rank dispersion book on
its **daily** 803×/yr turnover (break-even 1.87 bps), and F-24 showed that was the **implementation** — the
EWMA-smoothed book turns over 85×/yr and breaks even at 12.78 bps. The OI book's daily numbers (1501×/yr,
1.89 bps) are almost exactly the F-23 pattern. This cycle gives the OI signal the F-24/F-37 treatment.

## Work

1. **`experiments/e37_oi_signal_rescue.js`** (new, registered as `e37_oi_signal_rescue`) — reuses the exact
   e21 book builder (`xsBookImpl`, **extracted this cycle and verified byte-identical**) under an EWMA
   weight policy swept fast→slow (λ ∈ {0.5, 0.25, 0.1, 0.05, 0.02, 0.01}, renormalised), each audited by
   `e16#audit`. Adds the **F-37 walk-forward λ-selection** (choose λ by trailing net@4 only), a **fee
   stress**, net halves and net-by-year, and a sign control.
2. **Sign is a PRIOR, not a fit:** F-28's pooled IC was **+0.020**, so `sign=+1` is pre-registered; the
   opposite sign is reported only as the control.
3. **Falsifier (pre-registered, mirrors F-24/F-25/F-32).** The OI signal is **unrescuable** if *no*
   smoothing policy reaches a break-even of 4 bps (net@4 > 0). **Guard:** the daily sign+1 book must
   reproduce `e21`'s stored `dLogOI_pos` gross Sharpe / turnover exactly (0.9612 / 1501.11 — it does).

## Results

**(a) The signal IS rescuable — F-28's blanket verdict is too strong.** Smoothing the weights lifts the
break-even from **1.89 bps** to a peak of **14.73 bps**, and **3 of the 6** policies clear a 4 bps fee:

| policy | gross Sharpe | turnover /yr | break-even | net@4 |
| --- | ---: | ---: | ---: | ---: |
| daily (F-28's book) | 0.961 | 1501× | **1.89 bps** | **−1.07** |
| EWMA 0.5 | 1.009 | 849× | 3.21 bps | −0.25 |
| **EWMA 0.25** | **1.178** | 338× | **8.93 bps** | **+0.65** |
| EWMA 0.1 | 0.713 | 116× | **14.73 bps** | +0.52 |
| EWMA 0.05 | 0.170 | 55× | 7.43 bps | +0.08 |
| EWMA 0.02 | 0.005 | 21× | 0.54 bps | −0.03 |
| EWMA 0.01 | 0.019 | 11× | 3.67 bps | 0.00 |

The rescue is a **window**, not a point: too fast (0.5) still fails on cost, too slow (≤0.05) fails because
the **signal dies** (gross collapses) — the F-25/F-32 "the signal is genuinely fast" pattern, not the F-24
"purely an implementation" pattern. The signal is **independent of the carry book** (return corr with the
funding-rank dispersion book **0.007**), and the **sign control loses in both halves**: the opposite-sign
book reads −0.961 gross / net@4 **−3.00** (the prior sign is right).

**(b) But it is weak, churny, and recent-regime.** At the best policy (λ=0.25): net@4 **0.65**, turnover
**338×/yr** (vs the toptrader fade's 23×/yr and the retuned carry's 10×/yr), **net halves 0.07 / 1.47**
(second-half-driven), and **net-by-year** 2022 +0.52, 2023 **−0.86**, 2024 **+1.56**, 2025 +0.96, 2026
**+2.30** — positive in the recent regime but negative in 2023. The **walk-forward λ-selection
underperforms pinning** (OOS net@4 **+0.44** vs pinned λ=0.25 +0.76 and λ=0.1 +0.99), the F-40 pattern on a
weak signal; fee-stressed, the pinned λ=0.25 book reads OOS **+0.76 / +0.44 / +0.13** at 4 / 6 / 8 bps and
recent-24m +1.73 / +1.42 / +1.10, so it does clear a taker fee.

## What is now false that used to be believed

* **"Open interest has no directional signal — do not port it (F-28)."** Too strong. That verdict was read
  off the **daily** book (1501×/yr, 1.89 bps); EWMA-smoothed it clears the fee (break-even **8.9–14.7 bps**,
  net@4 **+0.5…+0.7**), exactly as F-23→F-24 for the funding book. The correct statement is "the OI book is
  a **weak, churny** signal — weaker and ~15× churnier than the fade at the same break-even class."
* **"The lab has no new-data signal left."** F-29's toptrader fade was the only one; the OI-change
  cross-sectional book is a **second** independent positioning signal (corr 0.007 with carry), and it is
  positive in 2024–26 — though with the caveats above.
* **(Nuance)** F-28's *other* conclusion — OI useful as a **sizing** input — is untouched.

## Ledger effects

* New **F-45**; new experiment `e37_oi_signal_rescue.js`, new artefact `results/e37_oi_signal_rescue.json`;
  `e21#xsBookImpl` extracted as a reusable primitive (its artefact verified byte-identical); `run_all` is
  now **45 steps** with a new validation guard.
* New lead **L19** (OI-change cross-sectional signal) — the lab's first *re-opened* signal claim since
  CYCLE-013; **L07** updated (its OI half is no longer simply "closed directionless").
* **FOLD-BACK R7** amended ("do not port OI as a directional stream" → "the smoothed OI book is a weak
  second stream; do not port yet, but it is not closed"); **THEORY §3** row amended.

## Next

* **L19's live question:** is the edge real or a 2024–26 artefact? The 2023 negative + second-half loading
  is the falsifier. A held-out split, a capacity read (the OI book is thin-alt-bound, so its size will be
  *shared* with R8 — the F-43/F-44 problem again), and a **rank/decay** decomposition are the next tests.
* L10's audit remains open; the frontier now has exactly one unmeasured-but-reachable mechanism left (L19).

## Run

`e37` ~1.9 s (registered). Full `run_all` regeneration **45 steps** (`RUN_SUMMARY` at
**2026-09-26T22:56:43Z**, ~18.6 min wall); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e37` all report `pass` (0 fails).
