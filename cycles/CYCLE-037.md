# CYCLE-037 — Why does clipping help? The cap is a saturation of the tail — not a hard constraint, and not wholesale shrinkage (L16 × L17, tests F-27/F-50/F-52)

**Date:** 2027-07-28
**Goal:** F-52/F-53 established that the 12.5 % cap works by **concentration**, not turnover, on both
deployable sleeves (R8 net@4 4.92 → 6.18; R7 fade 0.82 → 1.07) — and left the mechanism question sharp:
*why* does cutting the concentrated extremes raise net Sharpe? The simplest candidate is that the cap is
just a **concentration** operation, so *any* transform that lowers concentration equally would do the same
job. The alternative is that a **hard** constraint is special (the structural `1/k` level, F-27). This cycle
tests those directly.

## Work

**`experiments/e46_cap_shrinkage.js`** (new, registered as `e46_cap_shrinkage`) — applies three families of
weight transforms to the R8 λ=0.02 rank-funding weight rows (no renormalisation, matching `e30#applyCap`):

1. `hardCap(c)` = `clip(w, ±c)` — the F-27/F-50 spec.
2. `softCap(c)` = `c·tanh(w/c)` — a **smooth saturation**: ≈`w` when small, →`±c` when large.
3. `powerShrink(p)` = `sign(w)·|w|^p` (p>1) — a smooth concentration shrink that touches *all* weights.
4. a **flat-rank** control — the equal-weight book on the top/bottom k/2 ranks (max `|w| = 1/k`, the
   least-concentrated book the rank signal admits).

For each: gross/net@4 Sharpe, turnover, mean/max `|w|` (concentration) and the 5 %-of-mean-OI capacity.
Guards: base and `hard_0.125` reproduce `e30` exactly (net@4 4.92 / 6.18, turnover 17 / 10, OI@5 %
$20,415,294 / $35,937,181).

**Pre-registered read.** "The cap's benefit is concentration" is **SUPPORTED** if `softCap(0.125)` is within
0.2 net@4 of `hardCap(0.125)` (a smooth saturation of the same level does the same job); **FALSIFIED** if
the hard cap beats every smooth transform reaching the same concentration.

## Results

**(a) A smooth saturation matches the hard cap.** `soft_0.125` reads net@4 **6.04** vs `hard_0.125`'s
**6.18** — a **0.14** gap, inside the pre-registered 0.2 band (`softMatchesHard: true`). At c=0.10 the soft
book reads **6.11** (0.07 below the hard). So the **form** of the clamp (hard clip vs smooth tanh) barely
matters; what matters is the **level**. The pre-registered hypothesis is **supported**: the cap is a
concentration operation, and a hard constraint is not special.

**(b) The level is a plateau — confirmed on the full window.** `hardCap`: **6.18 / 6.18 / 6.13 / 5.84 /
5.23** for c = 0.10 / 0.125 / 0.15 / 0.20 / 0.30; `softCap` tracks it (**6.11 / 6.04 / 5.94 / 5.74 /
5.43**), even *beating* the hard cap at 0.30. So F-50's OOS plateau is the full-window shape too, and the
soft form is, if anything, *more* forgiving at large c.

**(c) But it is specifically a *tail* clamp — not generic concentration reduction.** `powerShrink` reduces
concentration yet **destroys the edge**: net@4 **4.44 / 3.99 / 3.25 / 2.27** for p = 1.25 / 1.5 / 2 / 3 —
*every one below base* (4.92) — because `|w|^p` shrinks the **small** weights too (and the weight
*magnitudes* carry the rank signal's strength). The `flat_rank` equal-weight book — the least-concentrated
book available — is worst of all at **1.51**. So the mechanism is not "lower concentration": it is
**winsorising the extreme tail while preserving the body** of the weight distribution.

| transform | net@4 | gross | turnover | max `\|w\|` | mean `\|w\|` | OI 5 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| base (no transform) | 4.92 | 5.48 | 17 | 0.438 | 0.125 | $20.42 M |
| **hard 0.125** | **6.18** | 6.77 | 10 | 0.125 | 0.089 | $35.94 M |
| soft 0.125 | 6.04 | 6.62 | 9 | 0.125 | 0.079 | $38.86 M |
| power 1.5 | 3.99 | 4.50 | 8 | 0.289 | 0.052 | $42.57 M |
| power 2 | 3.25 | 3.72 | 4 | 0.191 | 0.023 | $86.90 M |
| flat-rank (equal weight) | 1.51 | 1.90 | 17 | 0.125 | 0.125 | $34.28 M |

## What is now false that used to be believed

* **"Only a *hard* per-symbol cap works / the hard form is the mechanism."** Falsified: a smooth saturation
  (`c·tanh(w/c)`) at the same level matches the hard clip (6.04 vs 6.18), and *beats* it at c=0.30. The hard
  clip is a convenient implementation, not the mechanism — the **level** (≈ `1/k`, a plateau) is what
  matters, which sharpens F-27's "the cap is structural".
* **"The cap helps because it lowers concentration."** Falsified as stated: `powerShrink` lowers
  concentration yet reads *below base* at every p (4.44 … 2.27), and equal-weight is worst (1.51). It is not
  concentration in the abstract — it is **clipping the extreme tail** (the weights above ≈`1/k`) while
  leaving the body of the distribution intact. The cap is a **winsorisation**, not a shrinkage.

## Ledger effects

* New **F-54**; new experiment `e46_cap_shrinkage.js`, new artefact `results/e46_cap_shrinkage.json`;
  `run_all` is now **54 steps** with the `e30` cross-check guard (all diffs 0.00).
* **F-27/F-50** sharpened (the cap is a *saturation* at the structural level; the hard form is replaceable
  by a smooth one); **F-52/F-53** explained (the concentration gain is a tail-winsorisation, and it is why a
  turnover tool cannot substitute); the F-52 mechanism lead is now **closed**.
* **L16 / L17** updated; **FOLD-BACK R8** amended (the cap may be implemented as a smooth saturation, but
  the level ≈ `1/k` is the load-bearing choice).

## Next

* The F-52 mechanism thread is closed. Remaining open: **L19's `hold-N` / non-equal-two-scale construction**
  lead; and a **split-point / span robustness** sweep of the F-50/F-51 "pinned beats rule" conclusions
  (they rest on 5 split points — a dense grid would harden or break them).

## Run

`e46` ~1.3 s (registered). Full `run_all` regeneration **54 steps** (`RUN_SUMMARY` at
**2026-09-27T02:07:43Z**, machine-load dependent); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and
the validation guards `e28`–`e46` all report `pass` (0 fails).
