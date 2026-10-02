# CYCLE-170 — Standalone-rule fix: midcap data lives in the repo

**Trigger:** operator correction — the project is standalone and can never
import from the lab. The CYCLE-169 script copied from
`src/NeuLegion-lab/data/midcap/`: a rule breach, fixed the same session.

## Fix

* Ported the 8 midcap series byte-exact into the repo
  (`src/data/candles_*usdt_1h.jsonl`): 8/8 at 2,152,146–2,292,608 bytes,
  19,728 lines each, sizes match lab sources exactly.
* `round93-midcap-116.sh` `port` stage now verifies in-repo files only —
  zero lab references in `scripts/` (one comment names the lab to prohibit
  it). Swept `src/` + `scripts/`: no runtime read of any lab path (only
  historical provenance comments, which are attribution, not imports).
* Docs updated to match: TODO 116 rewritten (data ships in-repo, script
  verifies), §83 copy block replaced, §83.1 reworded.

## Standing rule (inscribed in the script header)

The repo never reads from `src/NeuLegion-lab`. Data a run needs is ported
into `src/data/` first, by an explicit port step — never by a run script.

## Next

CYCLE-171: bank the 116 readouts when the operator uploads the reports.
