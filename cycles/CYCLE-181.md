# CYCLE-181 — S6c executed: sizing prescription decided; survival follow-up scoped; research 10s (2026-10-02)

**Vehicle:** `experiments/s6c_sizing.js` (standalone, not in `run_all.js`;
result `scratch/s6c_result.json`). 6/6 checks, ~2 s. Pre-registered DESIGN
in its header.

## Coherency pre-check

PLAN S6c GATED-OPEN; s6b result present (a=0.25 net 9.8717); INDEX through
180; repo OI file present (1.5 MB). Proceeded.

## S6c measurements (a=0.25 book, 2465 bars)

* Scenarios (annualized Sharpe): FULL **9.87** / RECENT **7.31** /
  STRESS **4.67** — pays in every cut, halves-ordered as required.
* Unit-gross ann vol: 0.37% (FULL) / 0.39% (RECENT) — the carry paradox:
  vol-target L at 10% = **25.6–27.0×**, at 15% = **38.5–40.5×**.
* Cap rule: gross ≤ $11.5M ⇒ max equity $448k (L25.6) / $284k (L40.5).
* OI coverage: repo file covers **8/16** (majors only) — mid-leg OI
  unscored; F-42 schedule upgrade for the mid leg is data-blocked.

## Director's S6c decision (measured vs judgment, separated)

* MEASURED: scenarios, reference-L table, cap rule, OI gap above.
* JUDGMENT (labeled): vol-target L is a reference CEILING, not a
  prescription — 27× on perps is ruin-on-first-basis-gap, and the Sharpe
  never sees the cascade tail (no crash in-window). Interim operating
  leverage **L ≤ 10** (~3.7% vol) pending the survival run; equity ≤
  min($1.15M at L10, cap-implied). STRESS Sharpe 4.67 supports that the
  book pays while the survival work completes.
* Follow-ups opened: **S6e** survival-cap run (maxDD-based L + scenario
  stress incl. funding-spike/basis-gap; grounded by 10s), **S6f** midcap
  OI harvest (unblocks the F-42 schedule for the mid leg).

## Bug + sanity sweep (touch set)

* 10s JSON parses (4 grounded); s6b/s6c results present and pass;
  s6c imports proven by green bundling + run; README 10s line landed
  (one edit retry on exact context — verified).

## Research sync (10s)

`all:liquidation AND all:perpetual` (40 results): 2608.03616, 2607.27070,
2606.15715, 2602.15182 — all filed to S6e. Carryovers from 10r in-file.

## Next

S6c DONE-decided. S6e DESIGN next (AI). S6f conditional (director go-ahead;
harvest scale). No operator load owed.
