# CYCLE-169 — 116 turnkey script (operator runs ONE command)

**Trigger:** operator: don't hand over a multi-block recipe — put it in
`scripts/` with self-checks.

## Built

`scripts/round93-midcap-116.sh` (`port` | `gate` | `runs` | `all`=default):
port verifies 8/8 lab series at 19,728 rows, copies, asserts 15 files in
`src/data/`, appends the 8 manifest entries idempotently (grep-skip if
present) via a `node --input-type=module` heredoc anchored on the LINKUSDT
line (the `require` form would die under the repo's `"type": "module"` —
caught in review), then asserts 16 `binance-1h` entries; gate runs
`test.sh quick`; runs executes gh + cadenced/exposure + `--test=10` and
prints the newest `report.json` paths.

## Verified AI-side

The manifest-edit string ops replayed against the real `candles_audit.js`:
anchor hits once, edited file parses, 16 `binance-1h` entries, symbols in
order, all 8 entry files present (~2.2 MB each ≈ the 17 MB TODO cost).
`--cadences`/`--exposure-match` confirmed as real flags.

## Docs

Repo §83.1 now points at the one command; TODO 116 carries the turnkey line.

## Next

CYCLE-170: bank the 116 readouts when the operator uploads the reports.
