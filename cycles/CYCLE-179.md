# CYCLE-179 — S6b executed: blend frontier + operating blend decided; research synced (2026-10-02)

**Vehicle:** `experiments/s6b_blends.js` (standalone, not in `run_all.js`;
result `scratch/s6b_result.json`). 5/5 checks, ~2 s. Pre-registered DESIGN
(CYCLE-179 file header): band lanes only (pairwise dominance over flat,
documented), static capital blends (no rebalance turnover), exact series
arithmetic, identical-grids-or-FAIL.

## Coherency pre-check (before the work)

PLAN steps/S6 rows/D-20 present; INDEX rows through 178; STATUS at 178;
s6a file + result + CYCLE-177/178 present; repo tail intact (§85.1–85.3).
All green — proceeded.

## Blend frontier (a = mid-band weight; 2465 bars, grids identical)

| a | net | turnover | BE | worstBlock | halves | DSR | slope |
|---|---|---|---|---|---|---|---|
| 0 | 9.50 | 6.65 | 60.1 | 0.138 | 0.36→0.22 | 1.0000 | −0.095 |
| 0.25 | 9.87 | 6.29 | 62.0 | 0.141 | 0.39→0.22 | 1.0000 | −0.109 |
| 0.5 | 9.84 | 5.93 | 64.3 | 0.134 | 0.40→0.21 | 1.0000 | −0.121 |
| 0.75 | 9.36 | 5.57 | 66.8 | 0.106 | 0.40→0.20 | 1.0000 | −0.127 |
| 1 | 8.56 | 5.22 | 69.6 | 0.065 | 0.37→0.18 | 1.0000 | −0.128 |

BE monotonic in a; net peaks interior (a=0.25). The a=0.25 blend beats pure
stacked on BOTH axes (9.87 > 9.50, 62.0 > 60.1) — genuine diversification,
not a trade-off at that step.

## Director's operating decision: a = 0.25 (25% mid-band / 75% stacked-band)

Operating book: net **9.87**, turnover 6.29, BE **62.0**, worstBlock 0.141
(best on frontier), halves 0.39→0.22, DSR ~1.0. Rationale: net is the
scarce quantity and BE is comfortable everywhere on the frontier (all
≥ 60, above the 30–50 pre-reg band); a=0.25 maximizes net while also taking
the best worst-block. a=0.5 (9.84/64.3) is the named fallback if S6c
sizing wants more buffer.

## Bug + sanity sweep (this cycle's touch set)

* `arxiv-sweep-2026-10r.json` parses (8 grounded, dated).
* s6b result: pass, BE monotonic, interior net peak, 5 rows.
* Import audit on both experiments: all names resolve (both ran green).
* PLAN carries 4 well-formed S6 rows.

## Research sync (10r)

`all:perpetual AND all:funding`, 39 results, 8 grounded: 2605.06405
(funding-aware MM → before any dynamic-rebalance costing), 2605.05089
(collateral control → S6c), 2608.25348 (PIT-audit convergence →
honesty-gate support), 2310.14973 (OI/volume → L19), 2601.06084,
2603.09164 (SaR → S6c), 2601.10812 (perp liquidation → S6c), 2506.08573.

## Next

S6b DONE-decided (operating blend a=0.25, fallback a=0.5). S6c sizing is
now gated-open with concrete inputs (blend series in scratch/s6b_result
inputs — recompute from legs; D-18 bracket; 11.5e6 cap; 10r pricings).
S0 (122b native test) still the only owed operator gate.
