# CYCLE-020 — Re-tuning the dispersion book for the decayed regime: the fix is slowness, and it is a rule, not a pick (L12, L16)

**Date:** 2026-11-16
**Goal:** CYCLE-019 / F-36 established that the carry dispersion book's decay is a **cost-margin** decay:
its gross trend is flat but its break-even fell to **2.9–3.4 bps** (below the 4 bps fee) as turnover rose
75 → 98×/yr. That leaves one precise, pre-registerable question — the gate on R8 and L16's live action:

> **Is there a weight policy whose break-even clears a realistic fee *on the recent window* (and keeps a
> positive recent net Sharpe) — and, if so, is choosing it a rule or a hindsight pick?**

The second clause is the whole cycle. `e28` sweeps 16 policies and looks at the recent window; that is
*selection on the window it is credited with fixing*, which PROTOCOL §3.2 forbids reporting as evidence.
`e29` therefore turns the defence into a test: a **walk-forward selector**, which cannot see the future,
must reproduce the retune out of sample.

## Work

1. **`experiments/e28_regime_retune.js`** (new, registered as `e28_regime_retune`) — reuses
   `e17#buildBook` (the single policy implementation) and audits each book on three windows (full /
   last-24m / last-12m): gross Sharpe, turnover, **break-even** and net@4. It adds the two levers F-24
   never swept — **much slower smoothing** (`ewma 0.05 / 0.02 / 0.01 / 0.005`) and **longer holds**
   (`hold 27 / 54 / 108`) — plus the F-27 strict per-symbol cap. Validation guard: the F-24 spec must
   reproduce F-36's recent structure (break-even < 4.5 bps, net@4 < 0) — it does.
2. **`experiments/e29_regime_retune_oos.js`** (new, registered as `e29_regime_retune_oos`) — three tests:
   (Q1) is the "slower clears the fee" gradient present in **every** named regime, or only the recent one;
   (Q2) **walk-forward λ-selection** (every block, pick the λ with the best *trailing* net@4 and trade it
   forward — a series the selector never saw) vs the pinned F-24 spec and pinned leader on the same
   out-of-sample span, with a **gross-blind selector** as a control; (Q3) autocorrelation-honest
   significance (design-effect-adjusted t + 90-period moving-block bootstrap CI of the recent net@4).
3. **Falsifiers (pre-registered).** e28: the dispersion family is dead if *no* policy has recent-24m
   break-even ≥ 4 bps **and** net@4 > 0. e29: the retune is *not* a rule if the walk-forward selector
   fails to beat the pinned F-24 spec out of sample, or if the slow book nets positive in < 7/9 regimes.

## Results

**(a) The falsifier is REFUTED — several slower policies clear the fee on the recent window.** On the full
6.0-year grid (6 557 8h periods), recent-24m window, 4 bps fee:

| policy | recent turnover ×/yr | recent break-even | recent net@4 | full gross Sharpe |
| --- | ---: | ---: | ---: | ---: |
| **ewma_0.01_norm** | **9** | **27.07 bps** | **+3.86** | 5.71 |
| ewma_0.02_norm | 18 | 14.65 bps | +3.62 | 5.48 |
| hold108_norm | 12 | 7.77 bps | +1.05 | 3.56 |
| ewma_0.05_norm + cap12.5 % | 26 | 7.03 bps | +2.67 | 6.64 |
| ewma_0.05_norm | 46 | 6.66 bps | +2.33 | 5.59 |
| hold54_norm | 23 | 6.51 bps | +1.20 | 1.56 |
| level_ewma_0.1_norm | 95 | 4.03 bps | +0.05 | 4.66 |
| *(F-24 spec: ewma_0.1_norm)* | 93 | **3.68 bps** | **−0.58** | 5.18 |

**7 of 16 policies clear 4 bps recently; 6 clear 6 bps.** The leader clears by a factor of ~7. Two things
make this more than a lucky pick: (i) the recent break-even is **monotone in policy slowness**, exactly
what F-36's mechanism predicts; and (ii) the leader is net-positive in **all 9 named regimes** (including
FTX **+13.2** and 2026 **+2.9**), i.e. it is a better book full-sample too — full net@4 **5.37** vs the
spec's 3.55 — not merely a recent-regime patch. It stays dollar-neutral (rank weights) and price-neutral
(market corr 0.045).

**(b) The gradient is a mechanism, not a recent accident.** Net-positive regimes by λ (of 9):
λ ≤ 0.05 → **9/9**; 0.075 → 8/9; 0.1 → 7/9; 0.15–0.2 → 7/9; 0.3 → 5/9. Slower is better in essentially
every independent window, not just the one that was selected on.

**(c) The retune IS a rule (out of sample).** The walk-forward selector — trained only on trailing net@4,
never shown the block it trades — produces, on its 5 110-period (~4.7 y) out-of-sample span:

| selector / policy (same OOS span) | OOS net@4 | OOS break-even | OOS turnover |
| --- | ---: | ---: | ---: |
| **walk-forward (net-aware)** | **+5.71** | 16.08 bps | 38×/yr |
| pinned F-24 spec (λ 0.1) | +2.76 | — | 84×/yr |
| pinned leader (λ 0.01) | +6.48 | — | 8×/yr |
| gross-blind selector (control) | **+0.28** | — | — |

The selector's recent-24m OOS net@4 is **+3.41** vs the pinned spec's **−0.53** on the same data. It is not
hard-wired slow: it opens at λ 0.3 / 0.2 (2021–22, when the gross edge was large enough to pay the churn),
then converges to 0.005–0.03 and by 2025–26 picks 0.0075–0.01. And it holds across **all 12**
(lookback, block) parameterisations tested (OOS net@4 5.02–7.42; recent-24m 3.39–5.60). The **gross-blind
control is the methodological point**: selecting the smoothing by *gross* Sharpe picks λ 0.3 in 11 of 14
blocks and nets only +0.28 — cost-awareness is what makes the retune work, not smoothing per se.

**(d) The leader's recent edge survives the autocorrelation check.** Recent-24m net@4 Sharpe **3.86**,
design effect **0.4** (below 1, i.e. *not* autocorrelation-inflated), design-effect-adjusted t **8.7**, and
a 90-period moving-block bootstrap CI of **[3.07, 4.85]** — entirely above zero. (The F-24 spec's recent
net@4 is −0.58, CI [−1.57, +0.69].)

## What is now false that used to be believed

* **"The dispersion sleeve is no longer tradable at 4 bps in the current regime" (F-36's headline).** Too
  strong. It is the **EWMA(0.1) policy** that is no longer tradable; the *sleeve* is, under a slower
  policy (recent break-even 27 bps, recent net@4 +3.86). F-36's mechanism stands — turnover was the
  binding constraint — but its conclusion that the family is dead was a statement about one λ.
* **"Re-tuning λ on the recent window is necessarily a hindsight pick."** Tested with a walk-forward
  selector that cannot see the future: it reproduces the outperform out of sample (+5.71 vs +2.76) on 12/12
  parameterisations. The retune is a **rule**.
* **"Smoothing matters because it removes zero-mean churn" (F-24's explanation).** Incomplete: choosing the
  smoothing by *gross* Sharpe is strictly worse OOS (+0.28) than choosing it by *net* Sharpe (+5.71). The
  effect is cost, not variance reduction.
* **"The F-24/F-26/F-27 break-even and capacity numbers are stale" (F-36).** They are stale *for λ=0.1*;
  the R8 port spec should be re-stated as a **cost-aware, walk-forward λ**, not a fixed λ=0.1.

## Ledger effects

* New **F-37**; new experiments `e28_regime_retune.js` / `e29_regime_retune_oos.js`; new artefacts
  `results/e28_regime_retune.json` / `results/e29_regime_retune_oos.json`. `run_all` is now **37 steps**.
* **L12** re-gains a tradable construction; **L16** (low-turnover dispersion) is re-opened and answered
  (slower EWMA, cost-aware selection). **FOLD-BACK R8** is un-gated *with an amended spec*: a cost-aware
  walk-forward λ (recent λ ≈ 0.01–0.02), not a pinned λ = 0.1.
* No shipped number moves; `e14` unchanged (13 checks). `RUNNER.md` records the walk-forward-selection
  and cost-aware-smoothing conventions.

## Next

* The retuned book should be re-measured for **capacity** (L15/L17): a 9–38×/yr book has *better*
  capacity than the 85×/yr spec, so the F-26/F-27 $27 M figure is a floor, not a ceiling — but it is
  unmeasured at the new λ.
* **`ewma_0.05_norm + cap12.5 %` is the most interesting second candidate** (full gross Sharpe 6.64, recent
  break-even 7.03 bps, net@4 +2.67): it is fast enough to still harvest, cheap enough to clear, and it
  carries the F-27 cap that fixes the DOGE impact bound. Test it as a *standalone* R8 spec vs the
  walk-forward λ.
* L18's fade capacity and L07's liquidation-print half remain open.

## Run

`e28` ~2.4 s, `e29` ~3.1 s (both registered). Full `run_all` regeneration **37 steps, 24.4 min**
(`RUN_SUMMARY` at **2026-09-26T18:56:37Z**); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, `e28`'s
F-36 cross-check and `e29`'s OOS guard all report `pass`.
