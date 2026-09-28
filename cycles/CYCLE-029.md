# CYCLE-029 — Is the OI-change signal a 2024–26 artefact? (L19, its own falsifier)

**Date:** 2026-12-20
**Goal:** CYCLE-028 (F-45) re-opened the OI-change cross-sectional signal but labelled it "weak, churny and
**recent-regime**" — on three reads: net halves **0.07 / 1.47** (second-half-driven), net-by-year 2023
**−0.86** vs 2024–26 +1.56/+0.96/+2.30, and a walk-forward λ rule that underperforms pinning (the F-40
signature). L19 therefore carried exactly one live falsifier: **(b) the edge is a 2024–26 artefact — a
held-out split, or a pre-2024 read with the sign fixed, would kill it.**

This cycle runs that falsifier. The pre-registration is deliberately strict: the **sign (+1**, F-28's pooled
IC prior**)** and the **λ window ({0.1, 0.25}**, the CYCLE-028 candidates**)** are fixed *before* looking at
the split — nothing is re-fitted. If the edge is a regime artefact it must be absent pre-2024 for the
pre-registered parameters.

## Work

1. **`experiments/e38_oi_signal_holdout.js`** (new, registered as `e38_oi_signal_holdout`) — reuses the
   extracted `e21#xsBookImpl` for every book, and reports:
   - the **pre-2024 / post-2024 calendar split** of each pre-registered book (gross, turnover, break-even,
     net@4) and per-year net@4;
   - the **F-36 block-trend decay test** (8 blocks, permutation null) — reusing `e27`'s method;
   - a **regime-λ selection** (choose λ by trailing net@4 on one regime, trade it through the other) and a
     sign selection, so the "winner" is never chosen on the window it is credited with;
   - the **rank** construction (the signal pre-transformed to per-period centered ranks) versus the level
     form, since the funding book's rank form beat its level form (F-17);
   - the **confounds**: return correlation with the L18 toptrader fade, the raw signal's cross-sectional
     correlation with the toptrader ratio, and the Δlog(OI) correlation with the price move over its *own*
     interval (the F-28 look-ahead echo);
   - the book's **OI schedule** (`G_t = 0.05·min_j OI_j(t)/|w_j(t)|`) as a first capacity read;
   - a **fixed 50/50 blend** of the two pre-registered λ (average the weight vectors, renormalise) — no
     parameter chosen on any window.
2. **Guard.** The daily sign+1 book must reproduce `e21#dLogOI_pos` (gross 0.9612 / turnover 1501.11).

## Results

**(a) The falsifier's "kill" reading does NOT fire — but F-45's *best λ* was the artefact.**

| book | pre-2024 (2021-12→2023-12, n=2270) | post-2024 (2024-01→2026-09, n=2976) |
| --- | ---: | ---: |
| λ=0.25 (F-45's "best") | gross 0.34 · break-even **2.96 bps** · net@4 **−0.12** | gross 2.06 · 13.60 bps · net@4 **+1.45** |
| λ=0.10 | gross 0.64 · break-even **15.23 bps** · net@4 **+0.47** | gross 0.82 · 14.33 bps · net@4 **+0.59** |
| sign control (−1, λ=0.25) | net@4 **−0.80** | net@4 **−2.66** |

The slower λ=0.1 clears a 4 bps fee in **both** regimes at a **stable ~15 bps** break-even and is positive
in both halves — so the *signal* is not a 2024–26 artefact. The faster λ=0.25, which CYCLE-028 called best,
is **entirely** a post-2024 phenomenon (net@4 −0.12 pre). A held-out read therefore does not kill the
signal; it kills F-45's **parameter choice** (the F-37/F-40 lesson once more, now with a resolution below).

**(b) The two λ are anti-phase, and an unfitted blend is robust every year.** Year-to-year net@4 for the two
pre-registered λ runs *opposite* (2023: 0.25 **−0.86** vs 0.1 **+1.88**; 2024: **+1.56** vs **−0.26**), so a
fixed **50/50 blend** (no fitting) reads:

| blend | gross | turnover /yr | break-even | net@4 |
| --- | ---: | ---: | ---: | ---: |
| full 2021-12→2026-09 | 1.18 | 254× | **11.33 bps** | **+0.77** |
| pre-2024 | 0.69 | 256× | 7.70 bps | **+0.33** |
| post-2024 | 1.73 | 252× | 14.15 bps | **+1.24** |

and it is **positive in every calendar year 2022–26** (net@4 0.34 / 0.73 / 0.89 / 1.45 / 1.88). On the full
window the blend's net@4 (**+0.77**) beats *both* single λ (+0.65, +0.52): combining the two smoothing
scales is better than either, because their errors are anti-phase.

**(c) No decay — the book got better.** The net block trend is **positive** (λ=0.25 rho **+0.67**, p 0.053;
gross rho **+0.77**, p 0.018), i.e. the F-36 decay test finds *improvement*, not decay. λ=0.1's net trend is
+0.56 (p 0.149). So "recent-regime" is true as *description* (later years are stronger) but not as *decay*.

**(d) The rank construction does not help (a negative).** λ=0.25 rank: pre-2024 net@4 **−0.42** (worse than
level's −0.12), full **+0.22** (vs +0.65); λ=0.1 rank: post-2024 **−0.36**. So F-17's "rank beats level" does
**not** transfer from funding to open interest — a clean negative worth recording.

**(e) Independent, and the look-ahead echo is confirmed as measurement.** Return correlation with the L18
toptrader fade **−0.045**; raw signal x-sec correlation with the toptrader ratio **−0.016**; and Δlog(OI) vs
the spot return over its **own** interval is **0.595** (the F-28 trap) while the causal forward IC stays
**0.020**. The signal is a genuinely distinct stream, and its only large correlation is with its own
measurement window.

**(f) Capacity — a shared thin-alt constraint.** The λ=0.25 book's individual OI schedule is mean **$27.7 M**,
p5 **$8.2 M**, median $22.4 M, min **$4.5 M**, binding **DOGE (102) / LINK (105) / ADA (52)** in the thin
tail; λ=0.1 binds **DOGE (230) / LINK (29)**. Those are the same symbols R8's sleeves bind on, so a third
stream's size must be read **jointly** (the F-43/F-44 LP) — deferred, but the individual bound is
**$6–28 M**, i.e. single-digit-to-low-tens-of-millions like the other sleeves, not a new pool.

## What is now false that used to be believed

* **"The OI-change signal is a 2024–26 artefact / second-half-driven (F-45, L19's hypothesis (b))."** False
  as stated: with the sign and λ fixed a priori, λ=0.1 clears a fee pre-2024 (**+0.47**, break-even 15.23
  bps) and a fixed 50/50 blend of the two λ is net-positive in **every** calendar year 2022–26. What was
  regime-specific was the **single λ=0.25** the prior cycle selected on the full window — F-45's *best
  parameter* was a window fit, not its *signal*.
* **"The best policy is to pin λ=0.25 (F-45)."** The holdout flips the ranking: λ=0.25 is the *worst* choice
  for robustness (pre-2024 −0.12). The regime-robust object is the **blend across scales**, which needs no
  parameter selection at all.
* **(New negative) "Rank weights beat level weights (F-17)."** Not for open interest: the rank form is worse
  in the holdout, on the full window, and post-2024. F-17 is scoped to the funding book.
* **(Nuance)** F-45's *quantitative* table and its "not a port candidate" verdict stand; only the
  "recent-regime" interpretation is corrected.

## Ledger effects

* New **F-46**; new experiment `e38_oi_signal_holdout.js`, new artefact
  `results/e38_oi_signal_holdout.json`; `run_all` is now **46 steps** with a new validation guard.
* **L19** updated (status → "OPEN — weak, churny, but regime-robust at the blended scale"; its falsifier (b)
  is now **tested and does not fire**); **F-45** amended; **L07**'s OI-signal line refined.
* **FOLD-BACK R7** OI branch amended (the "recent-regime" caveat is softened to "churny and thin-alt-bound";
  still do **not** port).

## Next

* **Capacity (L19's item 2):** read the OI book's size **jointly** with R8's two sleeves (a 3-sleeve LP, or
  the 2-D `e36#lpFrontier` for the OI book against each R8 sleeve), since DOGE/LINK/ADA are shared.
* **Construction:** a `hold-N` cadence and a **two-scale** (rather than 50/50) blend; check whether a
  cost-optimal fixed mix of λ beats the equal blend (still without selecting a single λ).
* **Co-movement with R8:** the OI stream and the fade both read positioning; a joint portfolio question
  (does the OI stream add to the *R8 + fade* pair, net of the shared cap?) is now the natural cycle.
* L10's audit remains open.

## Run

`e38` ~1.9 s (registered). Full `run_all` regeneration **46 steps** (`RUN_SUMMARY` at
**2026-09-26T23:17:22Z**, ~17.9 min wall); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e38` all report `pass` (0 fails).
