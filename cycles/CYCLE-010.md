# CYCLE-010 — L11: does smoothing rescue the reversion book too?

**Date:** 2026-09-27
**Goal:** CYCLE-009 found that the dispersion sleeve's F-23 cost-fragility was an *implementation*
artefact — smoothing its weights cut turnover ~9× while keeping the gross edge (F-24). This cycle asks
whether the same treatment rescues the lab's **other** cost-fragile book: basis reversion (F-10/L11),
whose timed `fade` position is re-set from a basis z-score every 8h (465×/yr, break-even 2.82 bps).

## Work

1. **Exposed the reversion book's legs and weights.** `e7#reversionFromBook({includeWeights:true})` now
   also returns `pooledLegs` (`{basis, carry}` — the per-symbol leg vectors aligned with
   `pooledWeights`), so a policy can smooth the weights and recompute the return on the SAME legs
   instead of re-deriving the z-score.
2. **`experiments/e18_reversion_smoothing.js`** (new): applies nine weight policies (`daily`, `hold3/9`,
   `ewma 0.5/0.25/0.1`, `ewma_0.1_norm`, `deadband 0.02/0.05`) to the reversion `fade`, audits each with
   `e16#audit`, and reports both the **basisOnly** (pure convergence) and **carryPlus** (z-timed carry)
   books.
3. **Alignment guard, asserted in the artefact:** the `daily` policy must reconstruct E7's own pooled
   `basisOnly`/`carryPlus` series exactly — `maxAbsBasis = 0`, `maxAbsCarry = 0`,
   `dailyReproducesE7: true`.

## Result — F-25: the pure convergence edge is *fast* (not rescuable); the timed-carry overlay is real but buys drawdown, not Sharpe

| variant | turnover / yr | gross Sharpe | break-even | net@4 | net@10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| **basisOnly** daily (F-23 baseline) | 465× | 9.15 | 2.82 bps | −3.83 | −22.70 |
| basisOnly ewma_0.1 | 39× | **2.66** | 4.24 bps | +0.15 | −3.61 |
| **carryPlus** daily (F-23) | 465× | **9.54** | 3.54 bps | −1.26 | −17.24 |
| carryPlus ewma_0.1 | 39× | 4.82 | 9.61 bps | +2.82 | −0.19 |
| carryPlus ewma_0.1_norm | 43× | 5.04 | **20.33 bps** | **+4.05** | **+2.56** |

**Two opposite answers, and both are informative.**

* **The pure convergence signal (basisOnly) is genuinely high-frequency.** Smoothing cuts its turnover
  (465× → 39×) but *destroys* the gross Sharpe (9.15 → 2.66), so the break-even barely moves (2.82 →
  4.24 bps) and it still does not clear a realistic fee. Unlike the dispersion book, its edge lives in
  the fast basis ticks — smoothing is not a rescue, it is deletion. **L11's convergence trade stays
  cost-fragile**, and this is now a *measured* property of the signal, not just of its turnover.

* **The z-timed carry book (carryPlus) IS rescuable** — but the rescue reveals what it actually is.
  Smoothing cuts turnover to 43×/yr, raises the break-even to **20.33 bps**, and gives net Sharpe
  **+4.05 at 4 bps**. Two things fall out:
  1. The **implausibly high 9.54 gross Sharpe was churn**. Smoothed, the same sleeve reads **5.04** —
     just above the flat carry book's 4.54. So the eye-catching number in F-10 was high-frequency noise
     trading, not edge (the F-11/F-20 class, now explained rather than merely flagged).
  2. At the **same gross exposure as flat carry**, the smoothed timed-carry book earns net Sharpe
     **4.05** with a **2.09 %** max drawdown, versus flat carry's **4.54** Sharpe and **7.96 %** drawdown
     (F-04). It gives up ~0.5 Sharpe to cut the drawdown ~**4×** (Calmar ≈ 4.1 vs 1.1). That is the
     *original L11 thesis* — the basis z-score strips the basis-risk tail — and it survives costs.

**Read.** Basis timing is a **risk tool, not an alpha**:
* the pure convergence spread is untradable after fees at this horizon (fast signal, no rescue);
* the timed-carry overlay is tradable and materially reduces drawdown, but does **not** beat simply
  holding the (already free) flat carry book on Sharpe. So it belongs — if anywhere — as an optional
  **risk overlay on R4**, not as a new sleeve, and it must be judged by its drawdown, not its Sharpe.

## Ledger effects

* New **F-25**. **F-10/L11** is restated: the *convergence* leg is cost-fragile **and unrescuable**
  (measured); the *timed-carry* leg is tradable as a drawdown overlay but adds no net Sharpe over R4.
* **L11 → NEGATIVE as an alpha, positive as a risk overlay** (its cost question is now closed in both
  directions).
* New code: `experiments/e18_reversion_smoothing.js`; `e7#{pooledLegs, _basis, _f}`.

## Next

* **L15 (capacity/impact)** remains the binding physical limit on the carry complex — still needs the
  perp volume/depth harvest.
* **The 2025–2026 decay** of the dispersion edge (F-24 caveat) is now the most important open *risk*
  question for the lab's tradable sleeves.
* The **timed-carry drawdown overlay** could be folded into R4 as an option — but it needs to be tested
  as an overlay (does it cut R4's drawdown net of cost without hurting net Sharpe?), which is a
  CYCLE-011 candidate.
