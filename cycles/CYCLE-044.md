# CYCLE-044 — The shipped carry grid join mis-scales sub-8h funding (L10; settles the pre-registered FOLD-BACK R4(b))

**Date:** 2028-01-20
**Goal:** The lab's roadmap was empty of known items after CYCLE-043. This cycle opens a **new lead via a bug
hunt** (the L10 register), as CYCLE-043's "Next" prescribed, and picks the oldest open row: **L10-d** — the
repo's `analysis/carry.js#carryOnBarGrid`/`carryPanelStream` funding→bar-grid join. It is the exact pairing
that produced the four F-18 joins, and **FOLD-BACK R4 pre-registered the check in CYCLE-006**: before porting
the carry sleeve, audit those functions for (a) a candle-tail guard, **(b) sub-8h funding aggregation,**
(c) exact bar alignment — "if any is missing, that is a shipped-path defect".

## Work

**`experiments/e53_carry_grid_audit.js`** (new, registered as `e53_carry_grid_audit`) — the audit's first
experiment that measures the **repo's own function** against a synthetic ground truth. Four parts:

* **A. Synthetic interval scaling.** One 8h period, 1h bars, funding rows at 8h/4h/2h/1h; compare
  `carryOnBarGrid`'s receipt with the sleeve sum (`carryReturns`).
* **B. Bar-spacing inference.** A bar grid whose first two bars straddle a missing candle.
* **C. Shipped data.** SOLUSDT is the only symbol with sub-8h funding; audit it, and measure the FTX window
  (2022-11-09→18) and the pooled 8h sleeve both ways (raw rows vs rows bucketed into 8h **sums**).
* **D. Guard.** The synthetic ratios (exactly 1×/2×/4×/8×), SOL's interval histogram, the audit's silence,
  the FTX understatement, and the pooled-sleeve deltas.

**`experiments/e14_data_integrity.js`** — new check **13 `sub_8h_sleeve_equality`**: the lab's bucket
aggregation is lossless and the FTX-window bucket total equals the raw-row total. This pins the lab side, so
the lab cannot regress onto the repo's per-row scaling.

**Pre-registered read.** PASSES if the synthetic ratios are exactly [1,2,4,8], SOL shows 3 × 4h + 98 off-grid
steps and zero audit problems, the FTX understatement is 2.8–3.3×, and the pooled deltas land in the
pre-registered windows. A failure (any ratio 1, or SOL reported a problem) means the repo has fixed the join
and F-61 must be **withdrawn**.

## Results

**A. The projection returns one rate per 8h at every interval** (it divides by the *default* 8h bar count,
`round(gridMs / firstBarStep)`), so sub-8h funding is understated `8h/interval`:

| funding interval | rows in the 8h | `carryOnBarGrid` receipt | 8h sleeve | understatement |
| --- | ---: | ---: | ---: | ---: |
| 8h | 1 | r | r | **1×** |
| 4h | 2 | r | 2r | **2×** |
| 2h | 4 | r | 4r | **4×** |
| 1h | 8 | r | 8r | **8×** |

The module's comment (carry.js lines 22–26) claims "the bar-grid projection **divides by the period actually
observed**" — the code never reads the observed interval. **The comment is false of the code.**

**B (latent).** `barsPerPeriod` is inferred from a **single** bar pair, so a window whose first two bars
straddle a missing candle **doubles** the whole symbol's carry (synthetic first step 2h → 2× the clean
receipt). Every shipped candle file's first pair is currently modal, so this is registered, not triggered.

**C. It bites the shipped data, and it fails safe.** SOLUSDT's funding file has
`intervalHistogram` {8h: 6579, 4h: 3} plus **98 off-grid (2h) steps**, all in the FTX window — and
`auditFundingProblems` returns **[]** (the steps are 1.47 % of the file, under the 2 % budget, and *shorter*
than a grid period so not `missingPeriods`). The FTX window receipts **−0.1070** (shipped) vs **−0.3244**
(bucket-summed) = **3.03×**. On the pooled equal-weight 8h sleeve (6691 periods):

| | annualised carry | Sharpe | corr with market |
| --- | ---: | ---: | ---: |
| shipped `carryOnBarGrid` | **9.985 %** | **11.96** | 0.0795 |
| bucket-summed (lab) | **9.531 %** | **9.60** | 0.0623 |

Because the FTX funding was strongly **negative** (short perp paid), under-counting it makes the sleeve read
**better** — the defect **flatters** the book, so the F-11 "implausibly large Sharpe" alarm could never fire
(the F-18 direction lesson, third appearance). P4's independence claim survives.

**Lab side unchanged.** The lab's loader buckets rows into 8h **sums** first (the L10-o fix), so no lab
number moves; `e14` check 13 now pins that.

## What is now false that used to be believed

* **"`carryOnBarGrid` handles the observed funding interval."** False of the code, true only of the comment.
  It assumes 8h-uniform funding; sub-8h funding is understated by exactly `8h/interval`.
* **"A defect in the funding join would show up as a bigger number and be caught by the F-11 alarm."** False:
  this one *reduces* a negative carry, so it **raises** the sleeve's mean and Sharpe — it fails safe, and only
  a **synthetic** ground truth (a known 2h/4h payment pattern) exposes it. The F-18 direction trap, again.
* **"The funding audit (`auditFundingProblems`) reports the sub-8h regimes the comment says it tolerates."**
  False: the interval *histogram* detects them, but the problem classifier does not (2 % off-grid budget; a
  sub-grid step is never a `missingPeriods`).

## Ledger effects

* New **F-61**; new experiment `e53_carry_grid_audit.js`, new artefact `results/e53_carry_grid_audit.json`;
  `run_all` is now **61 steps** (30 gated). **L10-d is settled**; the register gains **L10-aa** (the confirmed
  shipped-path defect), **L10-ab** (the latent single-pair inference) and **L10-ac** (the audit blind spot);
  **L10-ad** (the one-period attribution lag) is added as **OPEN** for a future cycle. `e14` is now **14
  checks**. **FOLD-BACK R4** records the port requirement (bucket rows before projecting; fix the repo's
  `carryOnBarGrid`).

## Next

* **L10-ad (open):** `carryOnBarGrid` credits a payment to the bar that *opens* at the payment time — i.e.
  to the interval *after* the one that earned it (the repo's own test pins `gridCarry[0] === 0` for a bar
  opening exactly at the first funding timestamp). It is causal (a lag, not a look-ahead); quantify its
  effect on the sleeve's correlation with the price basket before calling it a defect.
* Remaining L10 rows: **L10-e** (the feature `closes` contract), **L10-f** (`effectiveBars` bound), **L10-h**
  (golden movement for any port), **L10-i** (`designEffect < 1` path).
* The general technique this cycle introduced — a **synthetic ground truth for a repo function** — can be
  turned on the other pure analysis modules (labels, splits, dependence) the way `e14` covers the data joins.

## Run

`e53` ~2.5 s (registered). Full `run_all` regeneration **61 steps** (`RUN_SUMMARY` at
**2026-09-27T03:32:56Z**, machine-load dependent); controls `e0c`, `e5` (1h/15m), the 14-check `e14`, and the
validation guards `e28`–`e53` all report `pass` (0 fails). The gate-less exploratory steps report timing only.
