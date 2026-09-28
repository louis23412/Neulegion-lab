# CYCLE-023 — Does the cost-aware-slowness lesson transfer to the fade? (L18 × F-37)

**Date:** 2026-11-22
**Goal:** CYCLE-020–022 (F-37/F-39) repaired and sized the carry dispersion book with a *slower, cost-aware*
weight policy and a walk-forward selection rule. The lab's other working sleeve is the **L18 toptrader
fade** (F-29/F-30), whose EWMA(0.1) form is cheap (23×/yr, break-even 74 bps) and has **not** decayed
(F-36). The natural transferable-mechanism question:

> Does slowness (and its walk-forward selection rule) help the fade too — or is F-37 a *dispersion-specific*
> fix?

The answer decides how the two sleeves are described, and whether the lab's newest method is general.

## Work

1. **`experiments/e32_fade_retune.js`** (new, registered as `e32_fade_retune`) — reuses the **exact fade
   construction** `e22#buildMasked` (exported in this cycle; the extraction was verified byte-identical by
   re-running `e22` and diffing its artefact) and the F-38 capacity readout. It sweeps λ ∈ {0.02…0.5} ×
   {no cap, 12.5 % cap}, reports each book's full/recent net@4 + break-even + OI bound, runs the joint
   (λ, cap) **walk-forward** and a **fee stress**, and compares to the pinned EWMA(0.1) fade.
2. **Falsifier (pre-registered):** the transfer is NULL if the joint walk-forward does not beat the pinned
   EWMA(0.1) fade out of sample. **Guard:** λ=0.1/no-cap must reproduce `e22`'s stored numbers.

## Results

**(a) The fade is not cost-fragile at any λ — so there is nothing for slowness to fix.** Full-sample and
recent-24m break-evens (bps), on the 2021-12+ fade grid:

| λ | turnover ×/yr | full break-even | recent-24m break-even | full net@4 |
| ---: | ---: | ---: | ---: | ---: |
| 0.02 | 8 | 192.3 | 138.2 | +0.75 |
| 0.05 | 14 | 118.4 | 89.6 | +0.82 |
| **0.1 (spec)** | **23** | **74.2** | **54.8** | **+0.79** |
| 0.25 | 42 | 40.1 | 29.6 | +0.76 |
| 0.5 | 69 | 25.8 | 19.5 | +0.76 |

Even the *fastest* policy clears a 4 bps fee by ~6×, and the spec's recent margin is **54.8 bps** — versus
the dispersion book's **3.7 bps** before its retune. Slowness raises the fade's break-even but the fade was
never *below* the fee, so the F-37 mechanism has no purchase here.

**(b) The walk-forward *selection rule* does not transfer — it overfits a weak signal.** Joint (λ, cap)
walk-forward vs the pinned spec, same OOS span:

| book | OOS net@4 | recent-24m net@4 | net@4 @ 6 bps |
| --- | ---: | ---: | ---: |
| joint walk-forward (λ, cap) | **+0.70** | +0.46 | +0.68 |
| pinned EWMA(0.1) (the spec) | **+0.94** | +0.84 | +0.92 |
| pinned `λ=0.05 + cap12.5 %` | +1.14 | +0.64 | +1.12 |

The walk-forward is **worse** than simply pinning λ=0.1 (+0.70 vs +0.94) — the opposite of the dispersion
result (+6.13 vs +2.76). The reason is signal strength: the fade's Sharpe is ~0.8, so a trailing-12-month
window is dominated by noise and the selector chases it. **The F-37 rule requires a signal strong enough
that trailing-window scoring is informative; it is not a universal improvement.**

**(c) The F-27 cap *does* transfer — because it fixes concentration, not cost.** The 12.5 % cap roughly
halves turnover and lifts the fade's usable size and edge:

| fade book (5 % of mean OI basis) | turnover ×/yr | break-even | full net@4 | OI bound | usable |
| --- | ---: | ---: | ---: | ---: | ---: |
| EWMA(0.1), no cap | 23 | 74.2 bps | +0.79 | $37 M (LINK) | $37 M |
| EWMA(0.1) + cap12.5 % | 13 | 109.3 bps | +1.00 | $54 M (LINK) | $54 M |

So the *construction* lesson (a strict per-symbol cap) generalises across sleeves; the *retuning* lesson
(slower λ, walk-forward selection) is specific to a book whose cost margin is actually decaying.

## What is now false that used to be believed

* **"The slowness fix is a general property of smoothed books."** It is not: the fade is not cost-fragile
  at any λ (recent break-even 55 bps at the spec, ≥19 bps even at λ=0.5), so there is nothing to repair.
* **"A walk-forward parameter selection is always better than a pinned choice."** False for a weak signal:
  on the fade the walk-forward nets +0.70 OOS vs the pinned λ=0.1's +0.94. The F-37 rule needs a signal
  whose trailing performance is informative (the dispersion book's Sharpe ~5, not the fade's ~0.8).
* **"The cap is a cost fix."** The cap's benefit here is concentration/OI ($37 M→$54 M) and a lower
  turnover, not the fee margin — the fade cleared the fee either way.

## Ledger effects

* New **F-40**; new experiment `e32_fade_retune.js`, new artefact `results/e32_fade_retune.json`. **L18**
  gains a capacity/edge upgrade (cap) and a "do not retune λ" note. **L16/RUNNER** gain the scoping of the
  F-37 rule ("only where the cost margin is binding"). `e22#buildMasked` is now an exported primitive.
  `run_all` is now **40 steps**.
* No shipped number moves; `e14` unchanged (13 checks); `e22`'s artefact is byte-identical after the export.

## Next

* The last unmeasured mechanism in the whole frontier remains **L07's liquidation-print half**; the fade is
  now as optimised as the lab can make it without L2/queue data (F-34's data requirement).
* If R7 is revisited, port the fade with the 12.5 % cap ($37 M → $54 M at 5 % of mean OI).

## Run

`e32` ~3.3 s (registered). Full `run_all` regeneration **40 steps, 24.6 min** (`RUN_SUMMARY` at
**2026-09-26T20:24:09Z**); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the validation guards
`e28`/`e29`/`e30`/`e31`/`e32` all report `pass`.
