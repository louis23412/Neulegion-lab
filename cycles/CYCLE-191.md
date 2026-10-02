# CYCLE-191 — script-format fix + full bug/sanity re-check of CYCLE-186…190 code (2026-10-02)

## Command-format fix (operator directive, locked)

Inline shell blocks are an undesired format. The S6f harvest block from
CYCLE-190 is now `scripts/s6f-oi-harvest.sh` (repo script, staged
`fetch|sample|all`, default `all`; writes `$OUT_DIR` only, never the repo;
prints the paste-back). PLAN.md conventions locked to script-form
(COMMANDS ARE SCRIPTS). No test enumerates `scripts/` (verified by grep —
zero matches in `test/`), and the script imports nothing repo-side, so no
golden/registry risk; `npm test` re-gate not owed for it (pure-shell new
file, zero JS surface).

## Bug + sanity sweep (all code touched CYCLE-186…190)

* Fresh harness re-run, current file state: s6e 6/6, m1 3/3, m4 3/3 +
  hard-fixture 3/3 — all green, numbers bit-identical to the recorded runs
  (L=5; ridge 0.24906; hard recall 0.887/0.987/0.967 PARK).
* Two self-caught issues, both fixed same cycle: (1) the re-run writer
  mapped `s6e_survival` → stray `scratch/s6ee_result.json` (deleted; the
  canonical `scratch/s6e_result.json` verified intact with identical
  content); (2) the re-run overwrote `scratch/m4_result.json` with the
  easy arm only (restored as the honest {easy, hard} pair).
* Script shell review (no shell here to execute it — operator runs it):
  `set -euo pipefail` hazards swept — `ls`-empty and `unzip|head` SIGPIPE
  paths guarded with `|| true`; the 2026 month cap uses lexicographic
  `M > 09` (correct for zero-padded months); `OUT_DIR` overridable.
* Plan wiring verified: S6e/M1p1/M4/M3 DONE-decided, S6f GO with script,
  M2/M5/M6 still gated, non-goals restated; counts agree (190 cycles,
  174 findings + this one, 146 experiment files, 3/3 scratch artefacts).

## Operator command (one line)

```bash
bash scripts/s6f-oi-harvest.sh all
```

Paste back the full `sample` output (per-symbol counts + missing log +
CSV header). Next cycle writes the aggregator against the real header.

## Next

S6f aggregator (on header) → mid-leg F-42 schedule → phase-2 native queue.
