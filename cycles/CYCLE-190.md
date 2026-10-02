# CYCLE-190 — coherency sweep + S6f harvest spec (director go-ahead GRANTED) (2026-10-02)

**Vehicle:** none (sweep + spec). Docs + one 7-row table fix in FINDINGS.md.

## Coherency pre-check (this cycle's sweep)

* Cycles 000…189 = 190 files = 190 INDEX rows ✓. FINDINGS: 174 rows
  (F-01…F-174, full rows stop at F-81 by design) ✓ counts agree everywhere.
* 146 experiment files = 139 run_all imports + 6 standalone
  (s6a/s6b/s6c/s6e/m1/m4) + run_all.js itself ✓. All 6 standalone present;
  all 3 scratch artefacts (s6e/m1/m4) present ✓.
* One real doc bug found + fixed: F-148…F-154 lacked the leading table pipe
  (rendered outside the table). 7 rows fixed, numbers verified.
* No repo files touched in CYCLE-184…190 (lab + scratch only) → no `npm
  test` re-gate owed for this session's work. Native gate stays CLOSED.

## S6f harvest spec (director go-ahead: GRANTED with this spec)

S6c measured OI coverage 8/16 (majors only); the mid-leg F-42 schedule is
data-blocked. Harvest the 8 midcaps (ARBUSDT AVAXUSDT INJUSDT NEARUSDT
OPUSDT SEIUSDT SUIUSDT TIAUSDT) from the SAME source as `oi_8h.json`
(`data.binance.vision/data/futures/um/daily/metrics/<SYM>/<SYM>-metrics-<YYYY-MM-DD>.zip`):
same 8h grid (00:00/08:00/16:00 UTC, value = row stamped exactly at T),
same schema (`builtAt/gridMs/fields/convention/source/missing` + per-symbol
rows with oi/oiVal/topLS/takerLS), missing as null (never 0). Integrity on
landing mirrors `e14#oi_integrity` (grid match, oiVal ≈ contracts·close,
topLS ∈ [0,1]); the aggregator is written next cycle against the pasted
CSV header (columns not assumed).

## Operator commands (native-only, in order)

```bash
cd <repo-root>   # the NeuLegion-master checkout with node_modules
# 1. S6f download (months 2021-01 → 2026-09; skip 404s, keep a log):
for S in ARBUSDT AVAXUSDT INJUSDT NEARUSDT OPUSDT SEIUSDT SUIUSDT TIAUSDT; do
  mkdir -p /tmp/oi_mid/$S
  for Y in 2021 2022 2023 2024 2025 2026; do for M in 01 02 03 04 05 06 07 08 09 10 11 12; do
    curl -sf -o /tmp/oi_mid/$S/$S-metrics-$Y-$M.zip \
      https://data.binance.vision/data/futures/um/daily/metrics/$S/$S-metrics-$Y-$M.zip \
      || echo "missing $S $Y-$M" >> /tmp/oi_mid/missing.log
  done; done
done
ls /tmp/oi_mid/*/ | head -5; wc -l /tmp/oi_mid/missing.log
# 2. Unzip one file per symbol and paste back: the CSV header line + row count per symbol
```

Upload/paste back: (a) the missing.log tail + per-symbol zip counts, (b) ONE
symbol's CSV header line. No `npm test` needed (repo untouched). Next cycle
writes the aggregator against the real header.

## Next

S6f aggregator (on header) → mid-leg F-42 schedule → phase-2 native queue
(TSFM-probe + controller M1 arms). Gated M2/M5/M6 unchanged.
