# L04 — Momentum / trend upgrades are all dead at realistic cost

**Status:** NEGATIVE (closed)
**Opened:** CYCLE-000
**Last updated:** CYCLE-000
**Owner experiments:** `e2_arm_sweep.js`, `e4_edge_hunt.js`
**Prototypes:** (none — every arm is a shipped or literature rule)
**Result artefacts:** `results/e2_arm_sweep_1h.json`, `results/e4_edge_hunt_1h.json`
**Fold-back rows:** — (explicitly on the NOT-to-port list in `FOLD-BACK.md`)
**Falsifier:** a trend-family arm that clears a realistic cost on the full history with block-stability
≥ 4/6. None has.

## Claim

No momentum/trend construction available from OHLCV on this basket has a full-history Sharpe above
~0.15, and every break-even is ≤ 2.6 bps — below the 5–10 bps taker cost the project itself assumes.
This includes the literature upgrades the project's own notes propose (vol-scaling, multi-horizon
blend, network/lead-lag, regime gating) and the classic cross-sectional momentum family.

## Why we care

These are the arms the project keeps returning to. Closing them with a full-history number frees the
next cycles for the leads that can matter (L07 new data, L06 the model's job, L09 sizing, L03/L12
carry). It also relocates the problem: the constraint is not the signal, it is the *sample* (L01) and
the *cost* (L08).

## Evidence

Full-history mean net Sharpe, 1h basket (`e2`, `e4`):

| upgrade (source) | shipped id | full-history Sharpe | break-even |
| --- | --- | ---: | ---: |
| vol-scaled momentum (`1904.04912`) | `sig-vol-momentum` | +0.084 | 1.52 bps |
| multi-horizon blend (`2112.08534`) | `sig-blend-momentum` | +0.015 | 0.19 bps |
| network / lead-lag (`2308.11294`) | `sig-network-momentum` | +0.009 | 0.00 bps |
| regime / crash gate (`2105.13727`) | `sig-regime-momentum` | +0.124 | 2.63 bps |
| plain momentum (baseline) | `sig-momentum` | +0.110 | 2.30 bps |
| acceleration | `accel-16` | **+0.147** | 2.63 bps |

`accel-16` is the best and the most *stable* (6/6 blocks positive), but at 0.15 Sharpe it is not
tradeable. Longer horizons: `mom-168` +0.086 (stability 0.83), `mom-336` +0.049, `accel-336` +0.027 —
the published multi-month trend effect is present and an order of magnitude too small.

Cross-sectional momentum (classic XSMOM) is also null (`e2`, `e4`): `xs-mom-16` −0.021,
`xs-mom-48` −0.010, `xs-mom-168` +0.005, `xs-mom-336` −0.012, `xs-mom-720` +0.033. Volatility
conditioning does not help either (F-08, in L05). Combining the three least-correlated candidates
(`accel-336` + `xs-mom-336` + `fund-contra`): **+0.019** — a portfolio of zero-edge sleeves is a
zero-edge sleeve (F-12).

## Verdict

**NEGATIVE, closed.** Do not spend another cycle on rule-based directional edge from OHLCV+funding on
this basket. If a trend arm ever re-enters, it must be scored over the full history with block
stability (L01/R1/R2) — the 600-bar window makes these all look alive.

## Next actions

* None. Re-open only if new data (L07) or a new cost model (L08) changes the input.

## Log

* **CYCLE-000** — opened and closed. `e2`/`e4` arm sweep measured; F-06, F-07, F-08, F-12 recorded.
* **CYCLE-001** — moved into the lead library.
