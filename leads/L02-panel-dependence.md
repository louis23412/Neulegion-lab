# L02 — The panel is one factor; power is buyable

**Status:** SUPPORTED (panel fact + construction tool)
**Opened:** CYCLE-000
**Last updated:** CYCLE-000
**Owner experiments:** `e0_panel_baseline.js`, `e2_arm_sweep.js`
**Prototypes:** `prototypes/signals.js#xsMomentum`, `#xsVolScaledMomentum`, `#xsMomentumRank`,
`#inverseVolScale`
**Result artefacts:** `results/e0_panel_baseline_1h.json`, `results/e0_panel_baseline_15m.json`,
`results/e2_arm_sweep_1h.json`
**Fold-back rows:** R5 (cross-sectional demeaning as a variance-reduction primitive)
**Falsifier:** if a demeaned arm's full-history Sharpe is *below* the raw arm's, the construction is
destroying information — in which case port the *tool* (for carry, R4) but not the arm. (F-07 says
exactly this for momentum.)

## Claim

The 8 majors are one factor. The mean pairwise **return** correlation is **0.623 (1h) / 0.732
(15m)**; the shipped momentum streams correlate **0.63 / 0.50**; the design effect is **4.92 / 3.62**
and the effective number of streams is **1.47 / 1.77 of 8**. The project knows this. What is new is
that **demeaning a signal across the basket collapses the design effect to 0.39–0.60** (effective
streams 14–19) — the plan's lever 2 ("buy independence") is almost free. But demeaning buys *power*,
not *edge*: every cross-sectional momentum arm reads |Sharpe| ≤ 0.033.

## Why we care

DSR can only see the panel through the dependence between streams. If the only plausible future
sleeve (carry, L03) is independent (r = 0.09 with price), the way to make its evidence legible to the
gate is to construct the panel so the dependence is low — which is what demeaning does. The asymmetry
is the point: **power is buyable, edge is not.** (L03 was re-measured in CYCLE-006: the carry book's
price correlation and its Sharpe both changed when the history was extended — see F-19.)

## Evidence

Panel baseline (`e0`):

| statistic | 1h | 15m |
| --- | ---: | ---: |
| mean pairwise return corr | 0.623 | 0.732 |
| mean pairwise stream corr | 0.63 | 0.50 |
| design effect | 4.92 | 3.62 |
| effective streams (of 8) | 1.47 | 1.77 |
| buy-and-hold Sharpe | +0.14 | +0.03 |

Construction (`e2`):

| construction | design effect | effective streams | full-history Sharpe |
| --- | ---: | ---: | ---: |
| momentum (shipped) | 4.92 | 1.47 | +0.110 |
| `xs-momentum-16` | **0.56** | 14.63 | −0.021 |
| `xs-momentum-168` | 0.46 | 15.86 | +0.005 |
| `xs-vol-momentum-16` | 0.60 | 18.58 | +0.016 |
| `xs-rank-momentum-48` | **0.39** | **19.39** | +0.023 |

`designEffect < 1` means the panel is *diversifying*, not over-confident; `backtestMetrics`
deliberately declines to inflate confidence in that case (`effectiveBars` → null), so the repo's
machinery would report "no adjustment needed".

## Verdict

**SUPPORTED.** The measurement reproduces the project's own frontier (its reported 3.62–4.87 / 1.73)
— the harness is faithful. Demeaning is a ready, cheap variance-reduction primitive (R5). It must not
be sold as an edge: on momentum it produces none.

## Next actions

1. Hold `xsMomentum` ready as the construction for the first sleeve with a measured edge — carry
   (L03/R4) is the candidate; L12 tests the cross-sectional carry version directly.
2. If R5 lands, the report should show the demeaned `designEffect`/`effectiveStreams` beside the raw.

## Log

* **CYCLE-000** — opened. `e0` panel baseline + `e2` `xs-*` arms measured; F-02, F-03 recorded.
* **CYCLE-001** — moved into the lead library.
