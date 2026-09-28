# L03 — Carry is a real, independent yield

**Status:** SUPPORTED
**Opened:** CYCLE-000
**Last updated:** CYCLE-044
**Owner experiments:** `e3_carry.js`, `e4_edge_hunt.js` (the funding-as-price-signal null),
`e13_carry_robustness.js` (window/regime breakdown)
**Prototypes:** `experiments/e3_carry.js#loadCarryBook` (the honest delta-neutral book — the lab's
single definition of the sleeve), `#loadFundingBuckets` (sub-8h funding aggregation)
**Result artefacts:** `results/e3_carry.json`, `results/e4_edge_hunt_1h.json`,
`results/e13_carry_robustness.json`
**Fold-back rows:** R4 (score the P4 sleeve basis-marked, inverse-vol across symbols)
**Falsifier:** if the basis-marked book's Sharpe is not materially below the raw funding series' on a
fixture, the marking is not the issue.

## Claim

Perpetual funding is a real, structural yield — the price of leverage, a different state variable
from price. Over the full **6.0 years** (8 symbols, 6 558 common 8h periods, 2020-09 → 2026-09) a
**basis-marked delta-neutral book** (`spotRet − perpRet + funding`, perp leg = the perp mark price)
earns **+9.05 %/yr at Sharpe 4.54, 7.96 % max drawdown, 38 % of periods negative, and correlates
r = 0.09 with the price basket.** The raw funding series reports Sharpe **9.40**, which is an
accounting artifact (a yield with no price risk) and must never be reported as a strategy.

## Why we care

It is the **only measured genuinely independent source** on this data — the one thing that is
decorrelated from the one-factor price panel (L02). Its natural role is as a **ninth panel stream**
(P4/G-J): its value is *independence*, not return. Two hard requirements: mark the basis, and
risk-size it (BNB and SOL have no carry at all over the full history and they are where the tail
lives, so equal weight is wrong — L09's inverse-vol result is the fix).

## Evidence

`e3_carry.js` + `e13_carry_robustness.js`, 2020-09 → 2026-09 (6.0 y, 6 558 periods):

| book | annualised | Sharpe | max drawdown | corr with price |
| --- | ---: | ---: | ---: | ---: |
| raw funding series (P4's stream) | +9.40 % | **9.40** | — | +0.09 |
| **honest delta-neutral book** | **+9.05 %** | **4.54** | **7.96 %** | −0.01 |

Per symbol (delta-neutral book, Sharpe / max DD): BTC **9.83 / 0.5 %**, ETH 8.19 / 2.0 %,
LINK 6.14 / 2.5 %, ADA 5.94 / 2.3 %, XRP 4.12 / 5.7 %, DOGE 4.02 / 3.6 %, then **BNB 0.02 / 26.7 %**
and **SOL −0.10 / 49.7 %**. The sleeve is *not* uniformly positive, and the tail is concentrated in
the two symbols with no carry.

**Where the tail is (F-19/F-21).** Sharpe by regime: crash 2021-05 +3.51, **bear 2022 −1.43**,
**LUNA 2022-05 −4.19**, **FTX 2022-11 −5.12** (max DD 7.1 %), recovery 2023 +6.96, bull 2024 +15.69.
Positive in 4/5 full years. The flat book is *long the common carry level*, and that level is what
collapses in a deleveraging — which is why the dollar-neutral dispersion construction (L12) is the
better carrier.

**Funding as a *price* predictor is a separate question and it is a null** (`e4`, F-05): a causal
z-score of funding used contrarian reads **+0.026** Sharpe (6/8 streams positive, block-stability
0.67); the follow-the-funding mirror is −0.026. The crowding hypothesis is directionally right and
economically nil. Carry survives as a *return* stream, not as a price signal.

## Verdict

**SUPPORTED.** "Carry +9 %/yr at Sharpe 4.5 with an 8 % drawdown, uncorrelated with price" is the
honest headline on the full history. Caveats that keep it a *breadth* stream rather than a
verdict-changer: the tail is real and concentrated in two symbols; the design effect is large
(99.5 raw / 11.8 winsorised — F-20), so the evidence is the winsorised and bootstrap readings; and
the perp leg is the **mark price**, a smoothed index, not a traded price (lead L14) — now tested and
cleared (F-22, CYCLE-007).

## Next actions

1. Port R4: `carryBookReturns(rows, spotLookup)` in `analysis/carry.js`, inverse-vol across symbols.
2. **L14 is cleared, not blocking** (F-22): the traded-perp leg leaves the book's Sharpe and drawdown
   intact (flat 4.54 → 4.65, dispersion 5.03 → 4.98). **The flat book's cost is now measured and it is
   essentially free (F-23, CYCLE-008): 0.2×/yr turnover, break-even 5422 bps** — it is the lab's only
   cost-robust sleeve, which makes R4 the priority port. The turnover/capacity question now applies to
   the *dispersion* book (L12/L16), not to this one.
3. L12's dispersion construction is the better carrier of the same yield (L12, F-17/F-21).
4. L09's inverse-vol sizing is the recommended risk layer (F-16 revision).

## Log

* **CYCLE-000** — opened. `e3` basis-marked book measured; `e4` funding-as-signal null; F-04, F-05.
* **CYCLE-001** — moved into the lead library.
* **CYCLE-006** — **re-measured on the full 6.0-year history** with the mark-price extension
  (`data/mark_8h.json`) and four alignment fixes (F-18). The old "Sharpe 0.96, 10.2 % DD" was a
  windowed artefact (F-19) and is now **4.54 / 7.96 %**. Added the regime breakdown (F-21): the flat
  book is negative in the 2022 bear, the LUNA month and the FTX month, and 4/5 years positive. Two of
  eight symbols (BNB, SOL) have no carry at all and carry the tail.
* **CYCLE-007** — cleared the L14 gate: rebuilt the perp leg from the **traded** `futures/um` 8h close
  (`data/perp_8h.json`, `e15_traded_basis.js`) instead of the smoothed mark. The flat book reads
  **4.65 / 7.96 %** (vs 4.54 / 7.96 % on the mark), so the yield is a traded yield, not a mark artefact
  (F-22). L14 closed negative; the open question for this lead is now turnover/capacity (see Next
  actions).
* **CYCLE-008** — **cost measured, and this lead is the winner of it (F-23).** Against the book's own
  exposure vectors (`e16`), the flat delta-neutral hold turns over **0.2× gross notional/yr** (a one-off
  entry), giving a break-even fee of **5422 bps** — it clears every tier. Even re-establishing the hedge
  every 8h adds only 0.41×/yr (break-even 2218 bps). By contrast the dispersion book (L12) breaks even
  at 1.87 bps. So the "boring" flat sleeve is the one that survives reality, and R4 is the priority.
* **CYCLE-044** — **the R4 fold-back path is audited and has a shipped-path defect (F-61, L10-aa).** The repo's
  `carryOnBarGrid` (the port target) mis-scales sub-8h funding by `8h/interval` — it understates SOLUSDT's
  FTX window **3.03×** and makes the pooled sleeve read *better* (ann **9.985 %→9.531 %**, Sharpe
  **11.96→9.60**), so it fails safe. **This lead's own numbers do not move**: the lab's loader buckets rows
  into 8h sums first (the L10-o fix), and `e14#sub_8h_sleeve_equality` now pins that. R4's port must use the
  bucket-sum projection; see `FOLD-BACK.md` R4's CYCLE-044 status.
