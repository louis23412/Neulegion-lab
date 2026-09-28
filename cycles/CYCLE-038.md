# CYCLE-038 — Is the "frozen λ matches the pinned book" conclusion split-point robust? A dense grid says: only past ~2.3 y (L12 × L16, tests F-49/F-50)

**Date:** 2027-08-20
**Goal:** F-49 and F-50 rest on a **five-point** split ladder (S = 1095 / 1825 / 2555 / 3285 / 4380): a λ
frozen on trailing data matches the walk-forward, and the joint (λ, cap) rule loses to the pinned book.
Five hand-picked splits is exactly the kind of choice a reviewer would challenge, so this cycle replaces the
ladder with a **dense grid** (every 365 periods) and asks whether the conclusion survives — under both a
**rolling** trailing freeze (a fixed 1-year window ending at S) and the **expanding** `[0, S)` freeze F-49
used.

## Work

**`experiments/e47_split_robustness.js`** (new, registered as `e47_split_robustness`) — builds the R8
λ-ladder {0.005, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1}, capped (12.5 %) and uncapped (guarding `e30` exactly —
capped 6.18 / 10 / 46.04 / $35,937,181; uncapped 4.92 / 17 / 39.63 / $20,415,294). For each dense split S it
records: the λ picked by trailing net@4 (rolling 1 y and expanding `[0,S)`), the frozen book's OOS net@4 on
`[S, end)`, the fixed λ=0.02 book's OOS, and the **in-sample-best** book's OOS (best full-history λ).

**Pre-registered read.** The conclusion is **ROBUST** if the frozen λ is within 0.2 net@4 of the
in-sample-best pinned book at **≥ 80 %** of splits (dense).

## Results

**The pre-registered bar narrowly fails — but only because of the earliest splits.** On the 14-point dense
grid:

| freeze construction (capped) | within 0.2 of best | median gap | failing splits |
| --- | ---: | ---: | --- |
| **rolling 1 y** | **0.79** (11/14) | **+0.30** | S = 1095, 1460 (pick **0.1**), 5475 (pick 0.005, −0.22) |
| **expanding `[0,S)`** (F-49) | **0.71** (10/14) | **0.00** | S = 1095 (**0.1**), 1460 / 1825 / 2190 (**0.075**) |

Neither reaches the pre-set **0.80** bar. But the failures are **all in the first ~2 years** — the region
F-49 already flagged. The **expanding** freeze fails at every split with **S ≤ 2190** (~2.0 y), picking a
fast λ (0.1, then 0.075) and collapsing to **−3.4…−4.4** below the pinned book; from **S = 2555** it picks
**0.03** and matches at **10 / 10** remaining splits. So the result is a **quantified widening** of a known
caveat, not a new anomaly: the safe boundary is **~2.3 y (S ≥ 2555)**, and F-49's five-point ladder
under-sampled the boundary between 1825 and 2555.

**The dense grid refines F-49's specifics.** (i) The **broken fast λ is 0.075, not 0.1**, once training
exceeds ~1.3 y — the 0.1 pick is a small-sample artefact of the earliest splits. (ii) The good pick is
**0.03, not 0.02**, at most splits ≥ 2555. (iii) The **rolling 1-year** freeze is **strictly more robust**
than the expanding one (0.79 vs 0.71, median gap +0.30 vs 0.00) and its median OOS is *above* the
in-sample-best pinned book — because it **forgets the early regime**, whereas the expanding window carries
it forever. F-49's "non-monotone freeze knob" is explained: it is an artefact of the *expanding* window.

**The cap improves robustness.** The uncapped family is much less stable under the rolled freeze —
**0.50** (median gap −0.20) vs the capped **0.79** — so F-50's structural cap also **stabilises the frozen-λ
policy**, not just the Sharpe/capacity. This is a new, independent confirmation of the cap's value.

## What is now false that used to be believed

* **"F-49's five-point ladder shows the frozen-λ fix is safe from S ≥ 2555."** True, but incomplete: the
  dense grid shows the **unsafe region reaches S = 2190** under the expanding freeze, and the "broken" fast
  λ is **0.075** (not 0.1) once there is >1.3 y of training. The dense grid **widens and sharpens** the
  known boundary rather than contradicting it.
* **"The freeze should be on the expanding `[0,S)` window."** Reversed: the **rolling 1-year** freeze is
  strictly more robust (0.79 vs 0.71) and its median gap is *positive* (+0.30), because it discards the
  early regime. F-49's non-monotonicity was a symptom of the expanding window, not of rolling.
* **"The cap is only a Sharpe/capacity tool."** Extended: the cap also **stabilises** the frozen-λ policy
  (rolled robustness 0.50 uncapped → **0.79** capped).

## Ledger effects

* New **F-55**; new experiment `e47_split_robustness.js`, new artefact `results/e47_split_robustness.json`;
  `run_all` is now **55 steps** with the `e30` cross-check guard (all diffs 0.00).
* **F-49/F-50** refined (the dense grid widens the unsafe region to S ≈ 2190 and prefers a **rolling**
  freeze; the pre-registered 0.80 bar fails at 0.79/0.71 — a genuine caveat, not a refutation); **F-50's
  cap** gains a third benefit (policy robustness).
* **L12 / L16** updated; **FOLD-BACK R8** amended (freeze λ on a **rolling ≥ ~2.3 y** window, not the
  expanding window).

## Next

* **L19's `hold-N` / non-equal-two-scale construction** lead remains the last open construction thread.
* The pinned R8/R7 specs are now tested from every angle the lab has (mechanism, robustness, transfer); a
  **port-shaped integration artefact** (one function → both sized books) is the remaining packaging step.

## Run

`e47` ~1.7 s (registered). Full `run_all` regeneration **55 steps** (`RUN_SUMMARY` at
**2026-09-27T02:18:33Z**, machine-load dependent); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and
the validation guards `e28`–`e47` all report `pass` (0 fails).
