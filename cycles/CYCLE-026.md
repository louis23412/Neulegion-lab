# CYCLE-026 — Does the mix survive the re-spec, and do the two sleeves' capacities add? (L12 × L18 × L15/L17)

**Date:** 2026-11-26
**Goal:** F-31 (CYCLE-015) combined the two working sleeves at their *pre-retune* specs — the carry
dispersion book at EWMA(0.1), uncapped, and the toptrader fade at EWMA(0.1), uncapped — and found that a
**25 % fade allocation turns the carry book's decayed second half positive** (ρ ≈ 0, so the fade is
insurance against the carry decay). Two things have changed since: F-37/F-39 **re-tuned** the carry book
(walk-forward cost-aware λ ≈ 0.02 + strict 12.5 % cap) and F-40 **capped** the fade, and F-41/F-42
restated both size limits as per-period **open-interest schedules**. So this cycle asks two questions that
have never been asked of the *final* specs:

1. **Does F-31 still hold?** If the re-tuned carry book no longer decays, the fade's insurance role may be
   gone — and a weak sleeve holding back a strong one is a cost, not a hedge.
2. **Do the two capacities add?** Both books' OI bound binds on the same thin alt symbols (LINK, ADA,
   DOGE). A portfolio running both at their individual sizes puts the **sum** of their positions into those
   symbols, so its compliant size is `f·min_j OI_j/|a·wF_j+(1−a)·wC_j|` — not the sum, and not the min.

## Work

1. **`experiments/e35_portfolio_mix.js`** (new, registered as `e35_portfolio_mix`) — builds the two books
   at their **final port specs** (carry `ewma 0.02 + cap12.5 %`; fade pinned `ewma 0.1 + cap12.5 %`), aligns
   them on the **same return interval** (the carry book index `m` earns leg `m+1`, the fade index `i` earns
   leg `i+2`, so fade `i` pairs with carry `i+1`), and then:
   * reports the return correlation, the mixed net@4 Sharpe and both halves at twelve capital splits, the
     unconstrained max-Sharpe mix, and a **walk-forward mix-weight rule** (pick the fade fraction by
     trailing net@4, trade it forward — F-37/F-39's test applied to the *allocation*);
   * measures each sleeve's **individual** OI schedule `G_t = f·min_j OI_j(t)/|w_j(t)|` and the **joint**
     schedule for the combined weights, all in the honest gross-notional unit (F-42), and the
     **realized participation** if each sleeve is deployed at its own individual bound.
2. **Guards.** Each book's *individual* OI-schedule mean must reproduce `e34`'s stored `meanGcap` for the
   same spec within 5 % — a single check of the weights, grid, OI join and unit convention at once. Both
   pass: carry **1.31 %**, fade **0.01 %** off.
3. **Falsifiers (pre-registered).** (a) F-31 survives only if the 25 % mix's net@4 second half is positive
   **and** the carry book alone is still negative in that half (there must be something to hedge).
   (b) The capacities "add" if the joint bound at the mix is ≥ the individual bounds summed — in which case
   there is no F-43.

## Results

**(a) F-31 does not survive the re-specification — because the re-tune removed what it hedged.** On the
common grid (5 247 periods, 2021-12 → 2026-09), at the final port specs:

| book | net@4 Sharpe | 1st half | 2nd half | turnover | break-even |
| --- | ---: | ---: | ---: | ---: | ---: |
| carry dispersion `ewma 0.02 + cap12.5 %` | **6.49** | 7.97 | **+4.66** | 10×/yr | 31.9 bps |
| toptrader fade `ewma 0.1 + cap12.5 %` | **1.00** | 1.39 | +0.54 | 13×/yr | 109.3 bps |

The return correlation is still ≈ 0 (**ρ = 0.010**), so F-31's mechanism is intact — but its *premise* is
gone. F-31 was insurance against the carry book's **decayed** second half (−0.12 net@4 at the F-24 spec);
after F-37's re-tune that half is **+4.66**. There is nothing left to hedge, and the fade (net@4 1.00) is
far weaker than the carry book (6.49), so every non-trivial weight is a pure dilution:

| fade fraction | 0 | 0.05 | 0.10 | 0.25 | 0.50 | 1.0 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **net@4 Sharpe** | **6.49** | 4.23 | 2.77 | 1.62 | 1.21 | 1.00 |
| 2nd-half net@4 | 4.66 | 2.46 | 1.53 | 0.88 | 0.65 | 0.54 |

The **walk-forward allocation rule picks the fade fraction 0 in 11 of 11 blocks** (trailing net@4 always
prefers pure carry) and nets **6.59** OOS vs the pinned 25 % mix's **1.67**. So the F-31 recommendation —
"put 25 % in the fade" — **does not survive the re-spec**; the fade is no longer the portfolio's hedge
because the re-tune fixed the thing it hedged. (The fade remains a live, cost-robust sleeve on its own:
break-even 109 bps, positive both halves; it is simply dominated by the re-tuned carry book.)

**(b) The two capacities do NOT add — an OI bound is a portfolio-level constraint.** Both books hold every
symbol, and their thin-alt positions are the binding ones:

| bound | mean | p5 | median | p95 |
| --- | ---: | ---: | ---: | ---: |
| carry alone (individual) | $23.72 M | $11.14 M | $20.74 M | $50.78 M |
| fade alone (individual) | $31.85 M | $11.02 M | $22.11 M | $93.84 M |
| **sum of individuals** | **$55.57 M** | — | — | — |
| joint at the 25 % fade mix | $31.32 M | $11.51 M | $28.04 M | $65.45 M |
| joint at a 50 % fade mix | $44.97 M | $11.72 M | $31.42 M | $115.86 M |

The joint schedule at the mix is **56 % of the summed individual schedules**, and the direct test is
blunter: **if each sleeve is deployed at its own individually-compliant size, the combined book breaches
the 5 %-of-OI cap in 78.4 % of periods, peaking at 10.0 % — exactly twice the cap — with a median
participation of 8.1 %** (binding symbols: ADA 2 707, LINK 1 692, DOGE 635). The two books' LINK weights
are essentially independent (**same-sign 51.2 %, weight corr −0.20**), so they do not net out; the summed
positions stack in whichever thin symbol both happen to hold.

The generalisable lesson: **a min-of-ratios capacity is not diversifiable.** Two sleeves that are each
individually inside a per-symbol cap are not *jointly* inside it, and uncorrelated sleeve returns do not
rescue this — the constraint is on the summed *positions*, not on the return correlation. A multi-sleeve
book's honest OI size is a **joint** schedule `f·min_j OI_j/|Σ_s a_s w^s_j|`, which at the F-31 mix is
~1.8× smaller than the sum of the parts.

## What is now false that used to be believed

* **"A 25 % fade allocation is the right mix (F-31)."** At the final specs it cuts net@4 from 6.49 to 1.62
  and the walk-forward rule never chooses it. F-31's hedge was against the F-24 carry decay; F-37 removed
  the decay, so the hedge is moot. (F-31's *correlation* result — ρ ≈ 0 — still holds.)
* **"The two sleeves' OI capacities add."** They do not: running both at their individual compliant sizes
  breaches the 5 % cap in **78 %** of periods (peak 10 %), and the joint bound at the mix is **56 %** of the
  sum. A per-symbol cap on each sleeve is not a cap on the portfolio.

## Ledger effects

* New **F-43**; new experiment `e35_portfolio_mix.js`, new artefact `results/e35_portfolio_mix.json`;
  `run_all` is now **43 steps** with a new validation guard.
* **F-31 restated** (the mix is stale at the final specs); **L12 / L18 / L15** gain the joint-capacity
  note; **FOLD-BACK R7/R8** gain a "size against a *joint* budget" amendment.
* No *return* number moves — this cycle is the portfolio/allocation layer.

## Next

* The exact portfolio OI object is a 2-D linear program per period: maximise total gross
  `G_C·ē_C + G_F·ē_F` subject to the joint per-symbol cap, i.e. the *frontier* of deployable (carry, fade)
  sizes. If that frontier is materially better than the proportional split, a **joint sizing schedule**
  (clip both sleeves against the shared budget) is the port artefact. This is the natural CYCLE-027.
* L10's audit remains open (it never closes); the frontier has no unmeasured mechanism free data can reach.

## Run

`e35` ~1.8 s (registered). Full `run_all` regeneration **43 steps** (`RUN_SUMMARY` at
**2026-09-26T22:03:57Z**); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the validation guards
`e28`–`e35` all report `pass`.

*(Superseded run, CYCLE-027.)* The current full regeneration is the **44-step** run at `RUN_SUMMARY`
**2026-09-26T22:33:14Z**; `e35` is unchanged (its `buildPair` extraction was verified byte-identical) and
the new `e36` also reports `pass`.
