# L05 — Conditional / seasonal structure does not rescue anything

**Status:** NEGATIVE (closed)
**Opened:** CYCLE-000
**Last updated:** CYCLE-000
**Owner experiments:** `e6_conditional_seasonal.js` (uses `e2`'s `blockStability`)
**Prototypes:** (none — conditioning shells around the shipped `sig-momentum`)
**Result artefacts:** `results/e6_conditional_seasonal_1h.json`
**Fold-back rows:** — (NOT-to-port)
**Falsifier:** a conditioning variable that raises an arm's full-history Sharpe meaningfully *and*
out-of-sample. None has.

## Claim

Two standard ways to rescue a weak signal both fail here, measured on the full history:
**volatility conditioning** (gate momentum on a causal expanding-median realised-vol state) and
**calendar seasonality** (hour-of-day, day-of-week), with the seasonality fit on the first half and
scored only on the second.

## Why we care

These are the cheapest "free" filters one reaches for when a signal is weak. Closing them keeps the
lab honest about where the frontier is (J1, J4, J6 — not "one more filter").

## Evidence

`e6_conditional_seasonal.js`, 1h:

| test | result | verdict |
| --- | --- | --- |
| momentum in low-vol state | +0.112 (stability 0.83) | vs unconditional **+0.110** — nothing |
| momentum in high-vol state | +0.052 | nothing |
| hour-of-day, **fit first half, scored second half** | **−0.009** (4/8 streams positive) | null |
| day-of-week, same OOS split | **−0.073** (0/8) | null |

The in-sample hour-of-day spread looks large; it does not repeat. This is consistent with the
project's own `sig-vol-regime` DROP.

## Verdict

**NEGATIVE, closed.** A vol split changes nothing on the long sample, and the calendar pattern is a
multiple-testing trap (F-09 is the lab's worked example of the OOS discipline: *fit on one half,
score on the other*).

## Next actions

* None. Re-open only with a *pre-registered* conditioning variable and an OOS split.

## Log

* **CYCLE-000** — opened and closed. `e6` measured; F-08, F-09 recorded.
* **CYCLE-001** — moved into the lead library.
