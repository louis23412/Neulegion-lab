# L01 — The verdict is read off a 25-day window

**Status:** SUPPORTED — critical
**Opened:** CYCLE-000
**Last updated:** CYCLE-000
**Owner experiments:** `e0b_window_sweep.js`, `e2_arm_sweep.js`, `e0d_ab_aggregation.js`
**Prototypes:** (none — measures the shipped `sig-momentum`)
**Result artefacts:** `results/e0b_window_sweep_1h.json`, `results/e2_arm_sweep_1h.json`,
`results/e0d_ab_aggregation_1h.json`
**Fold-back rows:** R1 (long-sample scorer), R2 (window robustness), R3 (full-history cost)
**Falsifier:** if the long-sample readout and the 600-bar readout agree, F-01 is wrong and this lead
closes.

## Claim

The A/B's `--bars=<n>` means "the most recent n bars" (`analyze.js` line 3228), so the acceptance
batch and the verdict run score the **last 600 bars ≈ 25 days** of 1h data. The reported
`sig-momentum` Sharpe **+1.0848** is that window, not a property of the strategy. Over the full
1h history (53 500 bars) the same signal reads **+0.110**. In the 600-bar window *almost every arm*
looks good, including arms with no own-asset content and arms that are not trend signals.

## Why we care

The entire gate — DSR, SPA, block stability, the pruned `K` arithmetic — is evaluated on that
window, and it is the basis of the round-29/30 promotion arithmetic (`PLAN-round30.md` §3.1 uses
`netSharpe 1.0848 / effectiveBars 1192`). A selection-of-window problem is exactly what the
project's own DSR machinery exists to punish, but the machinery is only ever pointed at the
parameter space `K`, never at the *time* dimension. The deflation corrects "best of 12 variants", not
"best of N calendar windows". It persists because the *model* is O(n²) per stream; the *signal family
is parameter-free and costs nothing* (the lab scores 20 arms × 8 streams × 53 500 bars in ~28 s).

## Evidence

Trailing-window ladder, shipped `sig-momentum` (window 16, sat 2, zWindow 32), 1h basket, `e0b`:

| window (bars) | mean net Sharpe | mean break-even | design effect | pooled Sharpe | pooled `dsrAdjusted` |
| ---: | ---: | ---: | ---: | ---: | ---: |
| **600** | **+1.267** | **18.73 bps** | 4.48 | +1.190 | 0.996 |
| 1200 | +0.446 | 5.96 bps | 5.25 | +0.383 | 0.847 |
| 2400 | −0.008 | −0.11 bps | 5.31 | −0.009 | 0.486 |
| 4800 | +0.046 | 0.57 bps | 4.60 | +0.043 | 0.599 |
| 9600 | +0.122 | 1.82 bps | 4.92 | +0.122 | 0.833 |
| **all 53 500** | **+0.110** | **2.30 bps** | 4.92 | +0.122 | 0.833 |

The decisive corollary (`e2`, last 600 bars vs full history):

| arm | full-history Sharpe | last-600 Sharpe | comment |
| --- | ---: | ---: | --- |
| `sig-momentum` (16) | +0.110 | +1.267 | the reported arm |
| `netmom-16` | **+0.009** | **+1.450** | a panel arm with *no* own-asset content |
| `range-32` | +0.064 | +0.782 | not a trend signal |
| `accel-16` | +0.147 | +1.058 | the most *stable* arm (6/6 blocks) |
| `mom-48` | +0.056 | **−0.162** | same arm, same window — negative |
| `xs-mom-16` | −0.021 | −0.054 | the demeaned arm does *not* inherit the window |

Two independent confirmations that +1.0 is the window: the lab's 600-bar reading (+1.267) reproduces
the batch's +1.0848, and the lab's 600-bar design effect (4.48) matches the batch's 4.87 of the same
window.

## Verdict

**SUPPORTED, critical.** The window is a market regime, not an arm difference. On the full 1h history
no rule-based arm exceeds +0.15 Sharpe and every break-even cost is 1–2 bps — below the 5–10 bps
taker cost the project itself assumes. The three port rows R1–R3 are measurement fixes, not
strategies, and need no promotion.

**The contiguous-vs-fold gap is now closed (CYCLE-002).** `e0d` runs the repo's *own* aggregation —
`walkForwardSplit(60/15)` → `walkForwardEvaluate` → `poolReports` — on the same signal, read-only:
it reads **+1.106 at 600 bars** (the reported number is **+1.0848**; the contiguous readout is
+1.190), −0.009 at 2400, +0.110 at 9600 and **+0.109 at the full history**. The A/B's own path lands
*on* the reported number, so F-01 is about the sample and not the aggregation (F-13).

## Next actions

1. Port R1 (model-free long-sample scorer), then R2 (`blockStability` + gate), then R3 (report
   full-history break-even by default). F-13 shows a contiguous scorer is the equivalent, cheap path;
   F-14 shows the expensive part of the A/B path is `poolReports`' `dependenceSummary`.
2. Keep the `e0d` ladder in `run_all` so any future change to the aggregation is caught.

## Log

* **CYCLE-000** — opened. `e0b` window ladder + `e2` verdict-window column measured; F-01 recorded.
* **CYCLE-001** — moved into the lead library; falsifier and port rows linked.
* **CYCLE-002** — falsifier tested and **survived**: `e0d` reproduces the window effect through the
  repo's own fold+pool path (F-13), and the 155 s `poolReports` cost is measured (F-14). L10-c closed.
