# CYCLE-025 — Is the OI capacity a number or a schedule? (L07 / L15 / L17 / L18, follow-up to F-41)

**Date:** 2026-11-26
**Goal:** F-41 restated a sleeve's open-interest capacity as a *distribution* — the largest **constant** size
is set by the thin tail of `G_t = f·min_j OI_j(t)/|w_j(t)|`. But a book need not be constant-size: if it
targets a fixed participation `f` and lets the gross notional *float*, it can hold the **mean** of `G_t`
instead of its p5, with no breach. This cycle asks what that schedule is worth and what it costs — and,
because a min-of-ratio needs care, it also audits the F-41 measurement itself.

## Work

1. **`experiments/e34_oi_scaled_sizing.js`** (new, registered as `e34_oi_scaled_sizing`) — for each working
   sleeve it builds the book (as `e30`/`e32` do), rescales to **mean gross exposure = 1** (so `G` is the
   gross notional), computes `G_t^cap` at 5 % participation and the per-period dollar PnL of seven sizing
   policies, all causal: `const_trail_p5`, `const_trail_min`, `clipped_trail_median` (`min(target, G_t^cap)`),
   `scaled_full` (`G_t^cap`), `scaled_half`, `scaled_ewma` (EWMA(0.1) of `G_t^cap`) and a seeded
   `placebo_shuffle`. Dollar PnL charges the fee on the **actual dollars traded** (so resize turnover is
   included) and e19's square-root impact at the schedule's size.
2. **Falsifier (pre-registered):** the schedule is immaterial if the OI-scaled mean size is within 20 % of
   the constant trailing-p5 size. **Guard:** the raw `min_j(OI/|w|)` must reproduce `e33`'s stored
   min-of-ratios to 1e-9.
3. **A measurement fix.** `e33`'s min-of-ratio admitted a period if *any* traded symbol had OI. When the OI
   history starts later than the book (the 7 alt symbols before 2021-12), that min over the remaining subset
   is meaningless: the dispersion book read a **$936 B** capacity on **2021-11-04** (only BTC had OI and the
   book's BTC weight was 0.0002). `e33` and `e34` now require **every traded symbol** to have an OI print;
   uncertifiable periods are dropped. Registered as **L10-x**.

## Results

**(a) A constant size chosen from trailing data is not compliant.** The trailing-2y p5 constant size — the
largest constant size F-41 implies — still breaches the 5 % cap, and the running-min constant is ~20 % smaller:

| sleeve | const trailing-p5 size | breach | peak participation | const running-min size | breach |
| --- | ---: | ---: | ---: | ---: | ---: |
| dispersion `λ=0.02 + cap12.5 %` (R8 spec) | $11.16 M | **2.9 %** | **10.2 %** | $9.23 M | 0.4 % |
| fade `λ=0.1 + cap12.5 %` (R7 spec) | $10.86 M | **2.7 %** | **6.1 %** | $9.15 M | 0.1 % |
| fade `λ=0.1`, no cap | $8.51 M | 3.7 % | 8.5 % | $5.50 M | 0.4 % |

OI is non-stationary, so a size picked from the *past* distribution does not respect the *current* bound in
the 3–4 % of periods where OI falls fastest. **The certified-safe constant size is the running min, not the
p5** — and it is materially smaller.

**(b) Sizing to OI is the compliant construction and raises the mean deployable size 2.0–4.1×.**

| sleeve | `G_t^cap` (mean / p5 / median / p95) | const p5 mean size | OI-scaled mean size | size gain |
| --- | ---: | ---: | ---: | ---: |
| dispersion `λ=0.02 + cap12.5 %` | $24.0 / 11.3 / 21.0 / 51.4 M | $11.16 M | **$22.88 M** | **2.05×** |
| fade `λ=0.1 + cap12.5 %` | $31.9 / 11.0 / 22.1 / 93.7 M | $10.86 M | **$33.58 M** | **3.09×** |
| fade `λ=0.1`, no cap | $32.5 / 8.4 / 22.7 / 87.1 M | $8.51 M | **$34.53 M** | **4.06×** |

The schedule "spends" the gap between the p5 and the mean of `G_t`; it never breaches by construction.

**(c) But maximizing size is not free — and a *lagged* size is not compliant.** Dollar-PnL Sharpe, max
drawdown, and the breach of the smoothed schedule:

| sleeve | const p5 | clip at `G_t^cap` | full-follow | EWMA(0.1) size | placebo (shuffled size) |
| --- | ---: | ---: | ---: | ---: | ---: |
| R8 spec | **5.02** (DD 3.3 %) | 4.41 (DD 3.5 %) | 3.26 (DD 4.8 %) | 4.86 — **breaches 53 %**, peak 9.3 % | **−18.5** |
| R7 spec | **1.21** (DD 22.8 %) | 0.96 (DD 34.9 %) | 0.77 (DD 58.2 %) | 1.10 — **breaches 55 %**, peak 13.2 % | −0.69 |
| fade, no cap | 0.93 | 0.74 | 0.78 | 1.06 — breaches 54 % | −0.67 |

Three things follow. **(i) The full-follow schedule lowers the dollar Sharpe** (R8 5.02→3.26; R7 1.21→0.77)
and deepens the drawdown (22.8 %→58.2 % on the fade): the OI-scaled book is a *capacity* device, not an
alpha — its dollar PnL is dominated by the high-OI, large-notional periods, which are not the good periods.
**(ii) A smoothed (EWMA) size re-introduces the breach** (53–55 % of periods!) because a lagged size sits
*above* a falling `G_t^cap`: the bound must be applied as a **hard clip**, never as a smoothed target.
**(iii) The placebo is catastrophic** — shuffling the size in time blows the per-unit turnover from 14–23×/yr
to **564–870×/yr** and drives the Sharpe to −0.7…−18.5, i.e. the schedule's value is *compliance at low
resize churn*, not timing.

**(d) The compliant, low-cost recipe is a CLIP.** Target the trailing-median size and clip it at `G_t^cap`:
mean size **$16.94 M** (R8) / **$19.34 M** (R7) — **1.5–1.8× the constant-p5 size** — with **zero breach**,
the clip binding ~44 % of periods, at Sharpe **4.41** / **0.96** and more absolute dollars ($469 k vs $378 k
per year; $3.55 M vs $2.53 M). The cap does not need a *number*; it needs a *policy*.

**(e) The unit wrinkle, resolved.** The capped books' weights average 0.70–0.71 gross, so `e30`/`e32`'s OI
bounds (quoted in "scale" units) are ~0.70× those values in **true gross notional** (R7 $53.84 M → $37.7 M;
R8 $35.94 M → $25.6 M). Immaterial to every conclusion (the OI bound binds in both units, and the impact
capacity is 20–130× larger), but every gross-size number here is stated in the honest unit.

## What is now false that used to be believed

* **"A constant size picked from a trailing p5 is OI-compliant."** It is not: the trailing-2y p5 breaches the
  5 % cap in **2.7–3.7 %** of periods and peaks at **6–10 %** of a symbol's OI. Only the running-min constant
  is safe (and it is ~20 % smaller).
* **"Smoothing the size is the safe way to follow OI."** The opposite: a lagged (EWMA) size breaches
  **53–55 %** of periods. The OI bound is a hard **clip**, not a smoothed target.
* **"Following OI is free size."** The full-follow schedule gets 2.0–4.1× the mean size but pays for it in
  dollar Sharpe (R8 5.02→3.26) and drawdown (fade 22.8 %→58.2 %) — it is a capacity device, not alpha.
* **"The F-41 min-of-ratio is well-defined whenever any symbol has OI."** No: a min over a *partial* symbol
  set can explode ($936 B at 2021-11-04); it requires **every traded symbol** to have an OI print.
* **(Refinement of F-41's numbers)** With the certifiability rule the published sizes breach the 5 % cap in
  **65–77 %** of periods (not 52–77 %), and the dispersion coverage is 78.9 % (the 7 alts' OI starts 2021-12).

## Ledger effects

* New **F-42**; new experiment `e34_oi_scaled_sizing.js`, new artefact `results/e34_oi_scaled_sizing.json`;
  `e19#turnoverAndCost` is now an exported primitive; `run_all` is now **42 steps** with a new validation guard.
* **`e33` corrected** (certifiability mask) — its headline bounds are unchanged, its breach fractions rose to
  65–77 %, and its full-sample distribution mean/median/max are now sane (the $936 B tail is gone).
* New bug register entry **L10-x** (min-of-ratio over a partial symbol set).
* **L07 / L15 / L17 / L18** gain the sizing policy; **FOLD-BACK R7/R8** gain a size-amendment: port with a
  **clipped trailing-median size** (~$17–19 M), not a fixed number and not the full-follow schedule.
* No *return* number moves — this cycle is the capacity/risk layer.

## Next

* The sleeve **mix** (F-31) was measured with the pre-retune specs and its capacity is now a schedule; a
  portfolio-level cycle (mix at the restated sizes, walk-forward) is the natural next step.
* L10's audit remains open (it never closes); the frontier has no unmeasured mechanism free data can reach.

## Run

`e34` ~30 s (registered). Full `run_all` regeneration **42 steps** (`RUN_SUMMARY` at
**2026-09-26T21:32:49Z**); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the validation guards
`e28`–`e34` all report `pass`.

*(Superseded run, CYCLE-026.)* The current full regeneration is the **43-step** run at `RUN_SUMMARY`
**2026-09-26T22:03:57Z**; `e34` is unchanged and the new `e35` also reports `pass`.
