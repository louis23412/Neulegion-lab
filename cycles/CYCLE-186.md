# CYCLE-186 — S6e executed: survival-cap decided; governor honest read; research 10w (2026-10-02)

**Vehicle:** `experiments/s6e_survival.js` (standalone, not in `run_all.js`;
result `scratch/s6e_result.json`). 6/6 checks, seconds. Pre-registered DESIGN
in its header.

## Coherency pre-check

PLAN S6e QUEUED-DESIGN-FIRST; s6b/s6c results present and green; shipped
`drawdownGovernor` + `worstBlock` imports proven by green bundling + run.
Proceeded.

## S6e measurements (a=0.25 book, 2465 bars)

* Unit-gross equity: maxDD **0.072%**, Calmar 52.7, longest underwater 98
  bars, worst single bar **−6.44 bps**. The in-window tail is a ripple —
  exactly why the Sharpe hides survival (D-20 restated as a number).
* maxDD-based L: Ldd20 = **276.9×**, Ldd10 = 138.4× — MEANINGLESS as a
  prescription (reproduces the S6c vol-target pathology: in-window DD never
  binds). Recorded only to close the "use maxDD" branch: maxDD does not
  size this book; the gap does.
* Governor at L10: governed **0.71%** vs raw 0.72% — INERT in-window (book
  never sags toward the 5% cap). Under the ×3 spike: governed 1.58% vs raw
  1.55% — slightly ADVERSE (de-sizes into the recovery). Honest read: the
  tree's crash brake is unproven on this book; credit it nothing.
* Gap ladder (synthetic): L_gap5 = 10 / **5** / 3.33 at 50/100/150 bps.
* Decision (min-rule, pre-registered): operating **L ≤ 5** (gap-bound at
  100 bps/5% hit); gross ≤ $11.5M ⇒ equity ≤ $2.3M at L5. The 100 bps gap
  is JUDGMENT (labeled) — no gap in-window (D-20).

## Director's S6e decision (measured vs judgment, separated)

* MEASURED: diagnostics, Ldd table (voided), governor inert/adverse reads,
  gap ladder above.
* JUDGMENT (labeled): 100 bps single-bar gap as the binding shock; 5% equity
  hit tolerance. Interim operating leverage **L ≤ 5** replaces S6c's L ≤ 10.
* S6e DONE-decided. Allocation track now: sized operating book (L≤5,
  gross ≤ $11.5M) + S6f conditional (midcap OI harvest, director go-ahead).

## Bug + sanity sweep (touch set)

* s6e imports proven by green run; legs/blend guards reproduce banked
  (1e-9/1e-4); no repo files touched; no golden moves (standalone).

## Research sync (10w)

`all:drawdown control AND all:leverage` (2 results): 2607.23068 (vol-drag
mitigation under aggressive leverage — compact GMV net, variance reduction
supports higher leverage under long-only; qualitative support for the
gap-bound framing: leverage is a variance question, not a Sharpe one).
Thin sweep; 10s liquidation groundings still carry S6e's spike shape.

## Next

M1 execution FIRST (model track) + M4 parallel. No operator load owed.
