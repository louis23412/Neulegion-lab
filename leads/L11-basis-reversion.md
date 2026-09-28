# L11 — Basis reversion

**Status:** **NEGATIVE as an alpha; POSITIVE as a risk overlay** (CYCLE-010, F-25) — **CLOSED in both
directions**. The pure basis-convergence trade is cost-fragile *and unrescuable*: smoothing the position
cuts turnover 465×→39×/yr but destroys the gross Sharpe (9.15 → 2.66), so its edge is genuinely
high-frequency. The **z-timed carry** variant (carryPlus) *is* rescuable — smoothing it gives net Sharpe
**+4.05** at 4 bps with a **2.09 %** drawdown (vs flat carry's 7.96 % at equal exposure) — but its
Sharpe is *below* the cost-free flat hold (4.54), so it buys drawdown, not alpha. Earlier history:
un-parked in CYCLE-006, mark-price caveat cleared in CYCLE-007 (L14/F-22), cost caveat raised in
CYCLE-008 (F-23).
**Opened:** CYCLE-000
**Last updated:** CYCLE-010
**Owner experiments:** `e7_basis_reversion.js` (also exports `reversionFromBook`), `e15_traded_basis.js`,
`e16_cost_capacity.js`, `e18_reversion_smoothing.js`
**Prototypes:** `experiments/e7_basis_reversion.js#zscores` (causal basis z-score; the series itself
comes from `e3_carry.js#loadCarryBook`)
**Result artefacts:** `results/e7_basis_reversion.json`, `results/e15_traded_basis.json`,
`results/e16_cost_capacity.json`, `results/e18_reversion_smoothing.json`
**Fold-back rows:** — (as an optional **drawdown overlay on R4**, not a sleeve)
**Falsifier:** the mark one applied and **survived** (CYCLE-007): traded-perp leg IC 0.391 (8/8
positive), convergence Sharpe 9.17. The cost one applied and **failed** (CYCLE-008, F-23), and the rescue
was tested and **only half-works** (CYCLE-010, F-25): the convergence leg is unrescuable; the timed-carry
leg survives costs but does not beat R4 on Sharpe.

## Claim

The perp–spot basis is a stationary spread. A causal z-score of the basis **level** predicts the next
period's delta-neutral basis return with a **positive IC on 8/8 symbols (0.107 … 0.527)**, and the
correctly-signed (convergence) book — long spot / short perp when the basis is rich — reaches a pooled
**Sharpe of +9.15 (+13.1 %/yr)** over 6.0 years, essentially uncorrelated with the price basket
(r = +0.09).

## Why we care

It is the one series in the carry work that behaves like a *trading signal* rather than a return
stream, and it is orthogonal to price. If it is real, it is a genuinely different edge from anything
else in the ledger — the basis is a basis (a financing/crowding spread), so its reversion is not
"another price signal".

## Evidence

`e7_basis_reversion.js`, 2020-09 → 2026-09 (6.0 y, 6 557 periods; z-window 60):

| quantity | value |
| --- | --- |
| per-symbol IC (basis z → next-period delta-neutral basis P&L) | **0.107 … 0.527, 8/8 positive** |
| pooled Sharpe, convergence book (`basisOnly`) | **+9.15** (+13.1 %/yr) |
| pooled Sharpe, follow-the-basis mirror (`followOnly`) | −9.15 |
| pooled Sharpe, funding + timed basis (`carryPlus`) | +9.54 (+16.4 %/yr) |
| corr with the price basket | +0.09 |
| fold-window design effect | 395 **raw** → **7.84 winsorised** (t ≈ 8.0) |

**The design effect needs the F-20 treatment.** 395 is one FTX bar (SOL basis −19.5 % in one 8h
period) inflating a Sharpe jackknife, not evidence of persistence — winsorised at ±3σ it is 7.84, and
that is what the t ≈ 8.0 uses. Both numbers are stored.

### Why the old "PARKED" verdict was wrong (CYCLE-006)

Two independent causes, both fixed:

1. **The series was corrupt.** `e7` had its own copy of the load loop and carried three of the four
   F-18 bugs: no `lastClose` guard (the spot leg froze over the funding files' tail), no `exact` bar
   alignment (8h returns stretched across missing bars), and `roundGrid`-collapsed funding rows (SOL's
   2h/4h FTX funding kept 1 of 4). It also read the **shipped** `markPrice`, so its window began
   2023-10-31 — the same benign 2.9 years as everything else.
2. **The design effect was read naively.** The old file quoted a design effect of 1675 and called it a
   kill. That number is an F-20 outlier artefact on a fat-tailed P&L series; the correct reading is
   the winsorised DE, and by that measure the evidence is strong.

The mirror-orientation bug found in CYCLE-002 was real and separate; the sign is still explicit and
both orientations are still reported.

## Verdict

**SUPPORTED as a lead.** Basis convergence is predictable and significant on the extended history, and
the one structural objection — that it was measured against a *smoothed* mark price rather than a
tradable one — was tested in CYCLE-007 and **failed to falsify it** (L14/F-22: IC 0.391 vs 0.430,
Sharpe 9.17 vs 9.15 on the traded leg). What remains is the F-20 caveat: the raw design effect (395) is
one FTX bar, so quote the winsorised 7.84, not the raw figure.

## Next actions

1. Add a spread-position prototype (`prototypes/`) so the book is not re-derived, and consider the
   funding + timed-basis sleeve (`carryPlus`, Sharpe 9.54) as the port candidate.
2. Measure **turnover and capacity**: the z-timed basis book changes exposure continuously and its cost
   sensitivity is unmeasured (`turnover()` is in the harness). This is now the binding unknown, not the
   mark price.
3. If a future cycle moves to an intraday basis horizon, note that the mark-vs-traded spread has
   `acf(1) > 0`, so its relative importance grows as the horizon shortens (L14's closing note).

## Log

* **CYCLE-000** — opened, measured, parked. F-10 recorded; F-11 bug caught in the process.
* **CYCLE-001** — moved into the lead library.
* **CYCLE-002** — sign bug found and fixed (the position was the mirror of the stated hypothesis, so
  the artefact stored −2.07 while the text quoted +2.1); both orientations now recorded. The
  conclusion — design effect 1675 kills it — is unchanged.
* **CYCLE-006** — **un-parked**. Refactored onto the single carry book (one load path, all four F-18
  bugs fixed) over the full 6.0 years: IC 8/8 positive, Sharpe +9.15, winsorised design effect 7.84
  (t ≈ 8.0). The old PARKED verdict was an artefact. New blocking falsifier: L14.
* **CYCLE-007** — **falsifier applied and survived**: on the traded perp leg the IC is 0.391 (8/8
  positive) and the convergence Sharpe 9.17, so the signal is tradable basis, not mark smoothing. The
  `reversionFromBook` export now lets any perp source be tested without duplicating the logic.
* **CYCLE-008** — **cost falsifier applied and it FAILED (F-23).** `e16` measures the book's own
  exposure vectors (`reversionFromBook({includeWeights:true})`): 465× gross notional/yr turnover,
  **break-even 2.82 bps** (basisOnly) and 3.54 bps (carryPlus). At a 4 bps fee the net Sharpe is −3.8
  and −1.3. The signal is real; the *timed* implementation is dominated by the fee it pays to chase
  the z-score every 8h. A low-turnover version (deadband/smoothing) is the open question — L16.
* **CYCLE-010** — **rescue tested; answer is a split (F-25).** `e18` smooths the reversion `fade` and
  audits it. The **basisOnly** (pure convergence) leg is *unrescuable*: smoothing cuts turnover
  465×→39×/yr but kills the gross Sharpe (9.15 → 2.66) — the edge is high-frequency. The **carryPlus**
  (z-timed carry) leg *is* rescuable (EWMA(0.1)-norm: net@4 **+4.05**, DD **2.09 %**), and smoothing
  reveals the 9.54 gross Sharpe was churn (smoothed: 5.04). But that Sharpe is *below* flat carry's
  4.54, so the overlay buys drawdown, not alpha. Closed: no new sleeve; possible R4 drawdown overlay.
