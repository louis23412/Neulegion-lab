# CYCLE-189 — M3 delivered: execution-uses data spec + pre-registered gates (2026-10-02)

**Vehicle:** none (docs-only M3 = the spec; build needs data that does not
exist in-repo). Research 10x (10 results, 3 grounded).

## Coherency pre-check

TODO 111 (model track, measured-complete) + RUN-ANALYSIS §27.2 + L08 lead
agree: e115 1h big-move skill +0.0246 (19/24) is SUPPORTED-but-not-
book-actionable; uses (a)/(b) need sub-bar data the project does not hold.
This spec is written so a future harvest unlocks both immediately.

## M3 spec — what to harvest (exact)

* Venue: the SAME venue the book would trade (Binance USDT-perp for the
  majors leg; no cross-venue proxy — queue dynamics don't transfer).
* L2 snapshots: bids/asks with sizes, depth ≥ 10 levels, cadence ≤ 1 s
  (use (a) needs the quote the model would widen/cancel — 1 s is the
  slowest cadence that still resolves cancellation; slower never counts).
* Trade prints: price/size/side-taker-flag, exchange timestamps (use (b)
  needs realized fill prices for rebalances, not bar closes).
* Latency logs: signal-compute + order-transmit timestamps per action
  (both uses are void if the predicted state expires before the quote
  moves — log it, don't assume it).
* History: ≥ 6 months overlapping the 1h candle window (the e115 skill is
  dated; a disjoint window tests a different regime).
* Sync rule: all three streams on exchange timestamps; a harvest missing
  any stream, or on ingestion timestamps, does not unlock the builds.

## Pre-registered builds (locked now, run on harvest)

* E-a (adverse-selection avoidance): maker replay in the e25 harness with
  quotes widened/cancelled in predicted big-move states vs the e25
  baseline maker. GATE: gain in **bps per real fill** vs e25; a simulated
  spread never counts (TODO 111's own rule, kept).
* E-b (taker-timing): delay book rebalances out of predicted high-vol
  states; same fill-based gate vs the taker baseline.
* Both carry e25's side-control (seeded-random side isolates execution
  cost from signal edge) and L10-r masking discipline.

## Research sync (10x)

`all:adverse selection AND all:market making` (18 results): 2606.09454
(spread = inventory + adverse-selection additively; the avoidable component
is identified — E-a's theory), 2508.20225 (optimal quoting under adverse
selection + price reading — the widen/cancel rule form), 2603.07752
(dynamic slippage control + rejection feedback — E-b's analogue). Filed to
M3; the L2/fill data block stands.

## Director's M3 decision

M3 DONE (spec + gates, no build possible). Model track now: phase-2 native
queue (TSFM-probe + controller arms) + operator re-gate; gated M2/M5/M6
unchanged; non-goals restated. No operator load owed.

## Next

Operator queue stacks: (1) full `npm test` re-gate (repo untouched since
134/134 — confirm clean), (2) phase-2 native (TSFM-probe + controller M1
arms). Then M6 revisit needs M1 skill + 91/92 (still archived).
