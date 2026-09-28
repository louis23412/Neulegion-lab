# CYCLE-035 — What is the cap actually doing? Concentration limit or no-trade band? (L17 × L16, tests F-27/F-50)

**Date:** 2027-06-05
**Goal:** F-27 and F-50 establish that a strict per-symbol cap (`|w_j| ≤ 1/k = 0.125`) *helps* the R8
dispersion book: at λ=0.02 it lifts the full-window net@4 Sharpe **4.92 → 6.18** and cuts turnover
**17 → 10×/yr**, and it roughly doubles the OI position capacity (**$20.4 M → $35.9 M**). But the cap
changes **two** things at once: it **clips the largest positions** (max `|w|` 0.438 → 0.125), which is what
raises the per-symbol OI capacity; and clipping large moves also **shortens the weight path**, cutting
turnover, which is what raises the *net* Sharpe. F-50 called the cap "a flat plateau" and "a capacity add" —
but never asked *why* it adds. Is the cap's Sharpe gain just a cheap no-trade band in disguise (a
*turnover* effect), or is it genuinely about **concentration**? A no-trade band (only rebalance symbol j
when the target has moved more than `eps`) is a *pure* turnover tool — it does not change the target's
concentration, so it should cut turnover without lifting capacity. If a turnover-matched banded book
reproduces the cap's net gain, the cap's edge is a turnover effect and a cheaper construction could
replace it; if it does not, the cap's edge is genuinely about the *shape* of the book.

## Work

**`experiments/e44_cap_mechanism.js`** (new, registered as `e44_cap_mechanism`) — rebuilds the R8 λ=0.02
rank-funding book (guards reproduce `e30`'s `ewma_0.02_norm` / `ewma_0.02_norm_cap12.5` full-window reads
**exactly** — net@4 4.92 / 6.18, turnover 17 / 10, break-even 39.63 / 46.04, 5 %-of-mean-OI capacity
$20,415,294 / $35,937,181, all matching to tolerance), then compares, **at matched turnover**:

1. `base` — `ewma 0.02`, no cap (the F-24/F-30 spec).
2. `capped` — base + the strict 12.5 % clip (the F-27/F-50 spec).
3. `band(eps)` — base + a **no-trade band** (a pure turnover tool), over a `eps` grid.
4. `capped + band` — can the two **stack**?

For each book: gross/net@4 Sharpe, turnover, break-even, mean`|w|` and max`|w|` (concentration), the
**ratio-of-means** OI capacity (e30's convention) and the honest **min-of-ratio** schedule (F-41/F-42).

**Pre-registered read.** The cap's **net** benefit is a **turnover effect** if the turnover-matched banded
uncapped book's net@4 is within 0.2 Sharpe of the capped book's. The cap's **capacity** benefit is a
**concentration effect** if the banded uncapped book's OI capacity is materially below the capped book's
(the band cannot lift max`|w|`, so it cannot lift the min-of-ratio bound).

## Results

**(a) The cap's net gain is NOT a turnover effect.** A no-trade band swept to match the capped book's
turnover (eps=0.008 → **10×/yr**, exactly the cap's) reads net@4 **5.05** vs the capped **6.18** — it
captures only **+0.13 of the cap's +1.26** gain. Across the *whole* band sweep (turnover 16 → 6×/yr) net@4
never leaves **[4.95, 5.05]**: a pure turnover tool moves this book's net by ≤0.13 no matter how it is
tuned, while the cap moves it by 1.26. So **the cap's Sharpe benefit is the shape of the book, not its
churn** — the pre-registered "turnover effect" hypothesis **does not fire**.

| book | turnover | net@4 | gross | max `\|w\|` | OI 5 % (ratio-of-means) | OI min-of-ratio (mean) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| base (`ewma 0.02`, no cap) | 17 | 4.92 | 5.48 | 0.438 | $20.42 M | $19.84 M |
| **capped 12.5 %** | 10 | **6.18** | 6.77 | **0.125** | **$35.94 M** | **$33.76 M** |
| band(eps=0.008) — turnover-matched | 10 | 5.05 | 5.49 | 0.436 | $20.44 M | $19.88 M |
| capped + band(eps=0.006) | 6 | **6.36** | — | 0.125 | — | — |

**(b) The cap's capacity gain IS concentration.** The band leaves concentration and capacity untouched:
max`|w|` **0.436** (vs base 0.438, capped 0.125), and its OI capacity is a **1.00×** multiple of base
(ratio-of-means $20.44 M vs $20.42 M; min-of-ratio $19.88 M vs $19.84 M). The cap is **1.76×** (ratio-of-means)
/ **1.70×** (min-of-ratio). So the pre-registered "capacity effect is concentration" hypothesis **fires** —
the cap is the *only* one of the two tools that lifts size, and it does so by lowering max`|w|`.

**(c) The two tools STACK.** A no-trade band on top of the cap *also* helps: capped + band(eps=0.006) reads
net@4 **6.36** at turnover **6×/yr** (vs capped alone 6.18 at 10), and every band `eps` in [0.001, 0.006]
keeps net@4 ≥ 6.21. So the cap and the band are **independent** improvements — the cap buys concentration
(net *and* capacity), the band buys cheaper rebalancing — and the port spec can carry both. (The band pick
is in-sample, but the claim is a *plateau*: banding the capped book never *hurts* net across the grid.)

## What is now false that used to be believed

* **"The cap's net-Sharpe gain is a turnover effect."** **Falsified.** A no-trade band, swept to the cap's
  exact turnover (10×/yr), recovers only **+0.13** of the cap's **+1.26** net@4 gain, and no band setting
  (turnover 16 → 6×/yr) moves the book's net outside **[4.95, 5.05]**. The cap's edge is the *shape* of the
  book (clipping the concentrated extremes), not its churn — so `1/k` is doing real work, not acting as a
  rebalance filter.
* **"The cap is a capacity add (a size tool) with a side-effect on Sharpe."** Refined: the cap is a
  **concentration** tool on *both* axes. It raises net@4 **4.92 → 6.18** and OI capacity **1.70–1.76×** by
  the same mechanism (lowering max `|w|`), and a turnover tool (the band) reproduces *neither*.
* **"The R8 cost story is complete once the cap is on."** Corrected: the cap is not the end of the cost
  story — a no-trade band stacked on the capped book cuts turnover **10 → 6×/yr** and lifts net@4 **6.18 →
  6.36**. The port spec can be improved.

## Ledger effects

* New **F-52**; new experiment `e44_cap_mechanism.js`, new artefact `results/e44_cap_mechanism.json`;
  `run_all` is now **52 steps** with the `e30` cross-check guard (all diffs 0.00).
* **F-27/F-50** refined (the cap's mechanism is *concentration*, on both net and capacity — its net gain is
  not turnover); **F-41/F-42** extended (the min-of-ratio capacity responds only to the cap, not the band,
  because it is a max-`|w|` object).
* **L16 / L17** updated; **FOLD-BACK R8** amended (the cost recipe is now `cap 12.5 % + a no-trade band`);
  the mechanism also transfers to R7 (F-51's pinned fade carries the same structural cap).
* New thread: **what is the mechanism by which clipping the extremes raises net Sharpe?** (robustness to
  weight outliers / a shrinkage-like effect). The band experiment rules out churn; the remaining candidate
  is signal-shape robustness — a lead for a later cycle.

## Next

* **The port cost recipe is now `ewma 0.02 (λ frozen ≥ ~2 y) + a strict 12.5 % cap + a no-trade band`** —
  concentration for size and net, the band for churn. Test the same decomposition on R7 (the pinned fade),
  where F-51 showed the cap also transfers.
* The mechanism lead above (why does clipping help net Sharpe?) — a candidate next cycle.
* L19's `hold-N` / non-equal-two-scale construction lead remains open; this cycle's band result is the
  *first* construction to beat its baseline (the capped book) since F-42.

## Run

`e44` ~2.2 s (registered). Full `run_all` regeneration **52 steps** (`RUN_SUMMARY` at
**2026-09-27T01:25:25Z**, ~20.8 min wall — machine-load dependent); controls `e0c`, `e5` (1h/15m), the
13-check `e14`, and the validation guards `e28`–`e44` all report `pass` (0 fails).
