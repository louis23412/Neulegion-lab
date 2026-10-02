# CYCLE-175 — Bug + sanity sweep on the CYCLE-174 touch set (2026-10-02)

**Scope:** harvester, both marks files, `sleeve-midcap-118.sh`, PLAN.md
rewrite, TODO 118, CYCLE-174 records.

## Issues found and fixed (2)

1. **`"$0"` recursion in the 118 script.** `all)` re-invoked `"$0" <stage>`
   after `cd` — dangling whenever `$0` is not root-relative (PATH lookup).
   Replaced with `do_*` functions; `all` calls them in-process. Same sweep
   confirmed `round93-midcap-116.sh` never recurses (clean).
2. **118 runs without the 116 manifest port would hit `resolveSymbolFiles`.**
   It throws loudly (unknown symbol), but the failure would come minutes in.
   Added an up-front manifest guard pointing at the 116 port stage.

## Verified, no change

* Sleeve candle resolution is manifest-driven for ANY `--symbols` list
  (`runSleeveAnalysis`: `files ?? resolveSymbolFiles(symbols)`), so the
  mid-8 runs need no `--files` — and FUND16 order (majors then midcaps)
  matches manifest order for positional funding↔candle matching.
* Both marks files parse and satisfy everything `parseMarksJson` reads
  (t0/stepMs/v[]; the majors file's stale `nKlines` is pre-existing and
  unread).
* PLAN.md rewrite verified intact (89 lines, all sections, nothing lost).
* Harvester usage comment restored after an edit collision (the `_nulls`
  note briefly replaced it — caught in this sweep).

## Next

Operator: S0 tests, then S2. Then S4 (G5, director's decision).

## Postscript (same session): 118 ordering trap removed

The operator hit the manifest guard (entries absent — tree regressed or port
never persisted). Director fix: the 118 script now auto-applies the 116
port stage when entries are missing instead of fatal-erroring. If the data
files are gone too, the port stage names the missing file — that means a
tree-sync problem, report it back.
