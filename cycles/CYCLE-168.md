# CYCLE-168 — Full bug + sanity sweep on touched code (2026-10-02)

**Trigger:** operator request for a full check that the plan is implemented,
wired, and documented, with fixes + the exact commands re-presented.

## Code re-proof (real shipped text, stubbed deps via esbuild bundle)

* `parseSleeveRisk` + `scoreSleeve` guard battery: **27/27 PASS** — none-given,
  empty, numeric, `none`/`null`/case variants, zero-band, alias precedence,
  all five garbled throws, dual-identical numerics (`0.01` vs `0.010`),
  dual null/`none` sentinel both orders, raw-spec guard throw + sentinel-ok,
  pinned echo, override eff, `none`-cap-keeps-pinned-band.
* CLI wiring emulation (verbatim `argOf`/`flagGiven` copies + real parser):
  bare `--sleeve-cap`, `--sleeve-cap=`, bare `--sleeve-band`, garbled,
  negative, valid combo, absent — **7/7 as specified**.
* Parse check: 9/9 JS files OK (scoring, report, cli main/io/run,
  sleeve_score, candles_audit, both test entries). (Two `.sh` files fail a JS
  parse by construction — harness artifact, not a bug; untouched by this work.)

## Issues found and fixed (2)

1. **§83 port self-check miscounted (real bug).** `ls src/data/candles_*usdt_1h.jsonl`
   said "expect 16" — but only 7 majors live in `src/data/` (BTC is
   `src/candles.jsonl` per the manifest). After the port the count is **15**.
   Fixed in place; no other copy of the error exists (lab "8+8" phrasing is
   symbol panels, correct).
2. **Bare `--sleeve-cap` uncovered natively (coverage gap).** The CYCLE-164
   fix exists precisely for the no-`=` form, yet `analyze_cli.test.js` only
   refused `--sleeve-cap=`. Added the bare row (same expected error);
   wiring emulation proves it throws. Rides the operator's next `npm test`.

## Docs/plan coherence (all verified, no change needed)

* §83 entries match `CANDLE_MANIFEST` field-for-field (frozen array, floor
  semantics — 19_000 < 19_728 ✓); filenames = lab files ✓; `--symbols=all`
  auto-covers ✓; `--cadences`/`--exposure-match` flags exist (main.js
  help + wiring) ✓; TODO 116/117/118 texts match the recipe, queue order,
  and the 118 honesty gate ✓.

## Next

Operator runs the re-presented block (116 + new-test coverage in one
`test.sh quick`). Then CYCLE-169: bank the 116 readouts.
