# CYCLE-031 — Does a fixed cross-scale blend beat R8's walk-forward λ? (L12 × L16, tests F-37/F-39)

**Date:** 2027-02-21
**Goal:** The port-ready R8 spec (F-37/F-39) reaches its OOS number with a **walk-forward, cost-aware λ
selection** — one fitted object (lookback, block, objective) on top of the R8 construction. F-46 found a
strictly cheaper way to remove a window-fit smoothing parameter: when a single λ is regime-specific, a
**fixed equal-capital blend across scales** was positive in every year with *no* rule at all. Natural
question: is R8's λ-selection rule still needed, or does a fixed blend of the same λ family match it out of
sample? A blend needs no lookback and no block — if it matches, R8 gets a simpler port spec.

## Work

**`experiments/e40_retune_blend.js`** (new, registered as `e40_retune_blend`) — builds the R8 spec family
(rank-funding weights, EWMA(λ), strict **12.5 % cap**) for the pre-registered cost-aware λ grid
`{0.005, 0.01, 0.02, 0.05, 0.1}`, forms **fixed equal-capital blends** over five pre-registered sub-sets, and
compares them with the λ-only walk-forward (`lookback 1095`, `block 365` — the rule never sees the block it
trades) on one common OOS span `[1095, 6205)` (span 5110, all four series scored at net@4 and over the
recent 24 m of that span).

**Falsifier (pre-registered).** The blend does **NOT** replace the rule if the best fixed blend's OOS net@4
is more than **0.2 Sharpe below** the walk-forward's, or if **every** blend is negative recently. It **does**
replace it if some blend is within 0.2 Sharpe of the walk-forward and positive recently.

**Guards.** The pinned `λ=0.02 + 12.5 % cap` book must reproduce `e30`'s stored
`books['ewma_0.02_norm_cap12.5'].windows.full` net@4 (**6.18**) and gross (**6.77**) Sharpe (full history)
and `e31`'s stored `pinned['lam0.02_cap12.5'].oosNet4Sharpe` (**6.86**, same OOS span). Both hold
(6.184/6.773 vs 6.18/6.77; 6.86 vs 6.86), with an absolute 0.01 tolerance because those artefacts store
Sharpe to 2 dp. (The first drafting used a **relative** 5e-4 tolerance, which the 2-dp storage makes
**unpassable** — 6.184 vs 6.18 is a 6.5e-4 relative gap but only a 0.004 absolute one; the guard was
corrected to an absolute 0.01 test. See *What is now false*.)

## Results

One OOS span (2021-09 → 2025-09, the walk-forward's never-seen blocks), all values net@4 on the 8h book
(PPY = 365·3):

| book | OOS net@4 | recent-24m net@4 | turnover (×/yr) | break-even (bps) |
| --- | ---: | ---: | ---: | ---: |
| **walk-forward λ** (lookback 1095, block 365) | 6.63 | 4.43 | **14** | 25.55 |
| pinned λ=0.02 + cap *(tuned on full history)* | 6.86 | 4.30 | 10 | 35.69 |
| fixed blend λ∈{0.01, 0.02} (`pair0102`) | **6.66** | **4.58** | **7** | **46.14** |
| fixed blend λ∈{0.005, 0.01, 0.02} (`slow3`) | 6.08 | 4.63 | 6 | 57.74 |
| fixed blend λ∈{0.005, 0.01, 0.02, 0.05} (`slow4`) | 5.74 | 4.24 | 10 | 34.49 |
| fixed blend λ∈{0.01, 0.02, 0.05} (`mid3`) | 6.02 | 4.04 | 13 | 28.56 |
| fixed blend λ∈{0.005, 0.01, 0.02, 0.05, 0.1} (`all5`) | 4.36 | 3.43 | 18 | 21.52 |

**(a) The falsifier does not fire — a fixed blend matches the rule.** The best blend (`pair0102`,
λ = 0.01 + 0.02 in equal capital) reads **OOS net@4 6.66**, *above* the walk-forward's **6.63** (so within
0.2 Sharpe by construction), **positive recently (4.58)** with **half the turnover** (7 vs 14×/yr) and a
break-even of **46 bps** (~1.8× the walk-forward's). Every one of the five pre-registered blends is
recent-positive, so the second clause of the falsifier also fails to fire. **A fixed two-scale blend — no
rule, no lookback, no block — matches R8's λ walk-forward out of sample.** **But note the *set* matters:**
only `pair0102` clears the 0.2 bar — `mid3`/`slow3`/`slow4` read **0.61/0.55/0.89 Sharpe below** the rule
(though all are recent-positive, 4.04–4.63). So "a fixed blend matches" is a statement about *one* of the
five pre-registered sets, and whether the winning set is knowable without hindsight is the cycle's second
open question (carried into CYCLE-032).

**(b) The walk-forward's value was repairing the *broken* λ, not the tuned one.** Two controls pin this
down. `all5` — the only set that includes the known-broken fast λ = 0.1 (F-37) — is the *worst* blend
(4.36 OOS), so nothing here rewards mixing blindly. Conversely, the **pinned λ = 0.02** book reads 6.86,
*higher* than both the walk-forward and every blend — so on this span the selection rule is worth
**−0.23 Sharpe** against a fixed well-chosen λ. The rule's OOS advantage over the *old* λ = 0.1 spec
(F-37's +6.13 vs +2.76) is real, but it is the advantage of *slowness*, and equality of that slowness is all
the blend needs.

**(c) Caveat — the pinned λ = 0.02 is not itself out of sample.** λ = 0.02 was chosen on the **full**
history (F-24/F-38), so its 6.86 is a mild in-sample read; it is *not* a legitimate ex-ante single-λ spec.
What this cycle establishes is narrower and honest: **given a cost-aware slow λ range, a fixed two-scale
blend matches the walk-forward that selects within it** — i.e. the *rule* buys nothing over a *fixed blend*,
but a blend is still a choice of which scales to include. Whether a *single* frozen λ (chosen before the
OOS span) could have done as well is **not** tested here and is the cycle's main open question.

## What is now false that used to be believed

* **"R8 needs the walk-forward λ-selection rule."** Refined: the λ-only rule's OOS value over a fixed slow
  blend is **~0** (6.63 vs 6.66) and over a well-chosen pinned λ is **negative** (−0.23). The rule repaired
  the *broken* λ = 0.1 spec (F-37); it is not required once a slow, cost-aware blend is used.
* **"The retune is a rule, not a hindsight pick" (F-37's framing).** Still true *for λ = 0.1 vs the pinned
  fast spec*, but overstated as a general statement about λ: out of sample, cost-aware *slowness* is what
  matters, and a fixed cross-scale blend carries it with no selection machinery.
* **(Guard / harness) A 2-decimal-Sharpe cross-check cannot use a relative 5e-4 tolerance.** New
  drafting note: when a guard compares against an artefact that stores `+x.toFixed(2)`, the comparison must
  be **absolute** (≤ 0.01), not relative — `e40`'s first guard failed at 6.184 vs 6.18 for exactly this
  reason (`e35`/`e39` avoided it only because their guards are 5 %-scale, on means not Sharpes).

## Ledger effects

* New **F-48**; new experiment `e40_retune_blend.js`, new artefact `results/e40_retune_blend.json`;
  `run_all` is now **48 steps** with the `e30`/`e31` Sharpe cross-check guard.
* **F-37** carries a scope note (its "rule, not a hindsight pick" is about *slowness*, not about needing a
  rule); **F-39's** port spec can optionally be simplified to a fixed λ blend (needs the frozen-λ test).
* **L12**/**L16** updated; **FOLD-BACK R8** amended (a fixed blend is an acceptable λ policy).

## Next

* **The frozen-λ test (now the decisive open question).** Choose a *single* λ on a training span that ends
  before the OOS span, freeze it, and score that exact spec OOS — the honest analogue of "pinned λ = 0.02".
  If the frozen λ comes out fast (the pre-2024 trailing winner is λ = 0.1), its OOS will be poor and the
  walk-forward is *required* after all; if it comes out ~0.02 the blend conclusion is OOS-hard. This is the
  one comparison that separates "slowness is knowable ex ante" from "0.02 is hindsight".
* The **cap** half of R8's joint walk-forward (F-39) is untouched by this cycle: combine a fixed λ blend
  with a frozen/blended **cap** and see if the last fitted object (the cap rule) is also removable.
* The L19 construction lead from F-47 remains open (a `hold-N` cadence / non-equal two-scale blend).

## Run

`e40` ~2.4 s (registered). Full `run_all` regeneration **48 steps** (`RUN_SUMMARY` at
**2026-09-27T00:03:23Z**, ~16.2 min wall); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e40` all report `pass` (0 fails).
