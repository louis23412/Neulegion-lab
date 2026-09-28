# CYCLE-036 — Does the cap-mechanism transfer to the fade? Concentration vs turnover on R7 (L18 × L17, tests F-51/F-52)

**Date:** 2027-07-01
**Goal:** CYCLE-035 (F-52) showed that on the R8 carry-dispersion book the 12.5 % cap works by
**concentration**, not by reducing churn — a no-trade band swept to the cap's exact turnover recovers only
**+0.13 of the cap's +1.26** net@4 gain, and leaves OI capacity a **1.00×** multiple of base while the cap
is **1.70–1.76×**; the band also **stacks** on the cap (R8: net@4 6.36 at 6×/yr vs 6.18 at 10). F-51 showed
the cap also transfers to the lab's other deployable sleeve, **R7** (the toptrader fade): at the pinned
λ=0.05 it lifts the full net@4 **0.82 → 1.07** and the OI bound **$37.4 M → $54.8 M**. The natural question
is whether the *mechanism* is the same on the fade — and whether the band stacks there too. The fade is a
different animal (Sharpe ~0.8, already cheap at 8–14×/yr capped), so a **null** transfer is also
informative: it would say the F-52 mechanism is specific to the dispersion book, not to *clipping*.

## Work

**`experiments/e45_fade_cap_mechanism.js`** (new, registered as `e45_fade_cap_mechanism`) — rebuilds the
fade λ=0.05 book (`e22#buildMasked`, sign −1) and guards `e32` **exactly** (base `lam0.05` full net@4
**0.82** / turnover **14** / break-even **118.38** / OI@5 % **$37,378,256**; capped `lam0.05_cap0.125`
**1.07** / **8** / **182.59** / **$54,782,334**), then runs the F-52 decomposition: a **no-trade band**
swept to the capped book's exact turnover, a `capped + band` stack, and both OI capacities (ratio-of-means
and the honest min-of-ratio schedule).

**Pre-registered read** (identical to F-52). The fade cap's **net** benefit is a **turnover effect** if the
turnover-matched banded fade's net@4 is within 0.2 of the capped fade's; its **capacity** benefit is a
**concentration effect** if the banded fade's capacity is materially below the capped fade's (≥1.3×).

## Results

**(a) The fade cap's net gain is NOT a turnover effect either.** The cap lifts net@4 **0.82 → 1.07**
(**+0.25**). A band swept to the cap's exact turnover (eps=0.05 → **8×/yr**) reads net@4 **0.78** — *below*
base (**−0.04**) — and across the whole band sweep (turnover 14 → 6×/yr) the uncapped fade's net@4 stays in
**[0.78, 0.95]**, never near the cap's **1.07**. So a pure turnover tool does nothing for the fade's net;
the cap's gain is the *shape*. The pre-registered "turnover effect" hypothesis **does not fire**.

**(b) The fade cap's capacity gain IS concentration.** The band leaves max `|w|` at **0.456** (base 0.500,
capped 0.125) and its OI capacity is a **1.04×** (ratio-of-means) / **1.03×** (min-of-ratio) multiple of
base, while the cap is **1.47× / 1.43×** ($37.38 M → $54.78 M ratio-of-means; $32.43 M → $46.36 M
min-of-ratio). The pre-registered "capacity effect is concentration" hypothesis **fires**. (Note the
uncapped fade concentrates to **max `|w| = 0.50`** — a single name can be half the book — so the cap has
even more room to bite here than on R8's 0.438.)

**(c) The band does NOT stack on the fade — unlike R8.** A band on the capped fade tops out at net@4
**1.13** at turnover **6×/yr** vs the capped fade's **1.07** at 8 — a **+0.06** gain, below the
pre-registered +0.1 stacking threshold (`stackingHelps: false`). For contrast, the R8 stack gained **+0.18**
(6.18 → 6.36). So the band remedy is **sleeve-specific**: it helps the dispersion book (which churns
17–10×/yr) but is neutral for the fade (already 8×/yr capped).

| book | turnover | net@4 | max `\|w\|` | OI 5 % (ratio-of-means) | OI min-of-ratio (mean) |
| --- | ---: | ---: | ---: | ---: | ---: |
| base (fade `ewma 0.05`, no cap) | 14 | 0.82 | 0.500 | $37.38 M | $32.43 M |
| **capped 12.5 %** | 8 | **1.07** | **0.125** | **$54.78 M** | **$46.36 M** |
| band(eps=0.05) — turnover-matched | 8 | 0.78 | 0.456 | $39.00 M | $33.37 M |
| capped + band(eps=0.01) | 6 | 1.13 | 0.125 | — | — |

## What is now false that used to be believed

* **"The cap's mechanism is a property of the dispersion book."** Reversed: the fade's cap works by
  **concentration** too. On both sleeves a turnover-matched band recovers ~none of the cap's net gain
  (R8 +0.13 of +1.26; R7 **−0.04** of +0.25) and leaves capacity a ~**1.0×** multiple of base while the cap
  is 1.4–1.8×. So the decomposition is a property of *clipping*, not of R8 — and the cap is a genuine
  **concentration** tool on the lab's second sleeve as well.
* **"A no-trade band is a general cost remedy for the pinned specs."** Scoped: the band **stacks** on R8
  (+0.18 net@4, turnover 10 → 6) but is **neutral** on R7 (+0.06, below the threshold). The band helps a
  high-churn book (R8); the fade — already cheap — gains nothing. The port cost recipe is therefore
  **cap `1/k` + a no-trade band for R8, cap `1/k` alone for R7**.
* **"F-52's `stackingHelps` is a general result."** Corrected: it is **R8-specific**.

## Ledger effects

* New **F-53**; new experiment `e45_fade_cap_mechanism.js`, new artefact
  `results/e45_fade_cap_mechanism.json`; `run_all` is now **53 steps** with the `e32` cross-check guard
  (all diffs 0.00).
* **F-52** generalised (the concentration mechanism is a property of *clipping*, confirmed on both
  deployable sleeves; the band *stack* is R8-only); **F-51** extended (the fade's cap transfer is explained
  — it is the same concentration effect); **F-27** gets a second-sleeve mechanism confirmation.
* **L18 / L17** updated; **FOLD-BACK R7** amended (the cap is a concentration tool; do **not** add a band).

## Next

* The mechanism lead F-52 opened — *why* does clipping the extremes raise net Sharpe? — is now sharper: it
  is not churn, and it holds on two independent sleeves. Candidate: the extreme rank weights are the least
  reliable/least diversifiable bets, so clipping is a form of shrinkage toward equal weight. A cycle could
  test a *smooth* shrinkage (`w' ∝ sign(w)·|w|^p`, renormalised) against the hard clip, and measure
  whether the gain tracks the *share of gross clipped* (span 0.125–0.5) rather than the cap value.
* L19's `hold-N` / non-equal-two-scale construction lead remains open.

## Run

`e45` ~2.0 s (registered). Full `run_all` regeneration **53 steps** (`RUN_SUMMARY` at
**2026-09-27T01:45:26Z**, ~16.7 min wall — machine-load dependent); controls `e0c`, `e5` (1h/15m), the
13-check `e14`, and the validation guards `e28`–`e45` all report `pass` (0 fails).
