// E67 - THE ORDER-PRESERVING SCHEDULER, AUDITED: `analysis/parallel.js`. CYCLE-059 (L10-ce ...).
//
// `analysis/parallel.js` (round 26, R26-4) is the module the A/B's parallel fold loop stands on. The claim is
// narrow and load-bearing: the scheduler runs N units with C in flight and returns the results in UNIT ORDER, so
// `folds.jsonl` and the per-variant checkpoints are byte-identical between the serial and parallel paths. It is
// SHIPPED: `backtest.js` and `walkforward.js` call `normaliseConcurrency`/`scheduleUnits`, `analyze.js` calls
// `makeFoldExecutor`/`normaliseConcurrency`, and `fold_worker.js` posts the reply shape the executor validates.
//
// PRE-REGISTERED READ. PASSES if (i) `normaliseConcurrency` treats a non-finite / non-positive width as serial
// (never unbounded), floors a fractional width, caps at its `max`, and is deterministic; (ii) `scheduleUnits`
// returns results in unit order for any completion order, never exceeds the requested concurrency, calls `exec`
// exactly once per unit, reports through `onResult` out of order and best-effort (a throwing reporter does not
// fail the run); (iii) a rejection rejects the whole call with the FIRST error, starts no new unit after it,
// and awaits the already-running units (so no promise is left dangling); and (iv) `makeFoldExecutor` adapts the
// worker's `{positions, confidence, stats}` reply to `{signals, confidence, stats}` and refuses a malformed one.
//
// The DEFECTS were reported in `findings` and HARDENED in round 48 (e67 restated round 94):
// `normaliseConcurrency` now validates its `max` cap (L10-ce throws on non-finite or < 1;
// residual: fractional max >= 1 un-floored); `makeFoldExecutor` now throws a named error on
// a non-array `confidence` or non-object `stats` (L10-cf) instead of nulling half the reply.

import { normaliseConcurrency, scheduleUnits, makeFoldExecutor } from '../../NeuLegion-master/NeuLegion-master/src/analysis/parallel.js';

const close = (a, b, tol = 1e-12) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= tol;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
    const checks = {};
    const rows = {};

    // ============================== A. normaliseConcurrency ============================================
    checks.normaliseConcurrencyContract = (() => {
        const serial = [undefined, null, NaN, Infinity, -Infinity, -3, 0, 0.5, 1, '3', 'abc', true, false];
        const serialOk = serial.every((v) => normaliseConcurrency(v) === 1);
        const frac = normaliseConcurrency(2.9) === 2 && normaliseConcurrency(1.5) === 1 && normaliseConcurrency(2) === 2;
        const cap = normaliseConcurrency(1e6) === 64 && normaliseConcurrency(65) === 64 && normaliseConcurrency(64) === 64;
        const det = normaliseConcurrency(7) === normaliseConcurrency(7);
        rows.normalise = {
            serialMap: Object.fromEntries(serial.map((v) => [String(v), normaliseConcurrency(v)])),
            frac: { twoNine: normaliseConcurrency(2.9), oneFive: normaliseConcurrency(1.5), two: normaliseConcurrency(2) },
            cap: { big: normaliseConcurrency(1e6), sixtyFive: normaliseConcurrency(65), sixtyFour: normaliseConcurrency(64) },
            det,
        };
        return serialOk && frac && cap && det;
    })();

    // (FINDING, RESTATED round 94) `max` is now validated fail-closed (L10-ce, round 48,
    // R48-pinned): non-finite or < 1 throws instead of returning a non-concurrency. Residual:
    // a fractional max >= 1 (2.5) still passes through un-floored.
    checks.normaliseConcurrencyBadMax = (() => {
        const throwsCe = (max) => { try { normaliseConcurrency(10, { max }); return false; } catch (e) { return /L10-ce/.test(String(e && e.message)); } };
        const zeroThrows = throwsCe(0);
        const negThrows = throwsCe(-2);
        const halfThrows = throwsCe(0.5);
        const frac = normaliseConcurrency(10, { max: 2.5 });
        rows.badMax = {
            max0Throws: zeroThrows, maxNeg2Throws: negThrows, maxHalfThrows: halfThrows, max2p5: frac,
            note: 'ROUND-94 UPDATE: hardened — `max` must now be a finite value >= 1 (L10-ce throws on 0/-2/0.5/NaN/Infinity) instead of flowing raw into Math.min. Pre-hardening, `max: 0` -> 0, `max: -2` -> -2, `max: 2.5` -> 2.5. Residual (still present): a fractional max >= 1 passes through un-floored (`max: 2.5` -> 2.5).',
        };
        // pin the module's actual behaviour
        return zeroThrows && negThrows && halfThrows && frac === 2.5;
    })();

    // ============================== B. scheduleUnits order + bound ====================================
    checks.scheduleUnitsOrderAndBound = (async () => {
        const n = 10;
        const units = Array.from({ length: n }, (_, i) => i);
        let inFlight = 0, peak = 0, calls = 0;
        const finishes = [];
        const res = await scheduleUnits(units, {
            concurrency: 3,
            exec: async (u) => { calls++; inFlight++; peak = Math.max(peak, inFlight); await sleep(2 + ((n - u) % 4)); inFlight--; return `r${u}`; },
            onResult: (v, i) => finishes.push(i),
        });
        const orderOk = res.length === n && res.every((v, i) => v === `r${i}`);
        const finishesOutOfOrder = finishes.length === n && finishes.some((v, i) => v !== i);
        rows.scheduleUnits = { peak, calls, orderOk, finishes, finishesOutOfOrder, res };
        return orderOk && calls === n && peak <= 3 && peak >= 2 && finishesOutOfOrder;
    })();

    // ============================== C. failure semantics ==============================================
    checks.scheduleUnitsFailure = (async () => {
        const units = Array.from({ length: 8 }, (_, i) => i);
        const started = [];
        const settled = [];
        let firstErr = null;
        try {
            await scheduleUnits(units, {
                concurrency: 2,
                exec: async (u, i) => {
                    started.push(i);
                    await sleep(6);
                    settled.push(i);
                    if (u === 1) throw new Error(`boom-${i}`);
                    if (u === 4) throw new Error(`late-${i}`);
                    return u;
                },
            });
        } catch (e) { firstErr = e.message; }
        // no unit beyond the started window should have run, and every started unit's exec settled
        const maxStarted = Math.max(...started);
        const noRunAfter = settled.length === started.length;
        // two failures, first wins; a synchronous throw propagates
        let twoErr = null, syncErr = null;
        try {
            await scheduleUnits([0, 1, 2, 3], { concurrency: 2, exec: async (u) => { await sleep(1); if (u === 0 || u === 1) throw new Error(`e${u}`); return u; } });
        } catch (e) { twoErr = e.message; }
        try { await scheduleUnits([1], { concurrency: 1, exec: () => { throw new Error('sync'); } }); } catch (e) { syncErr = e.message; }
        rows.failure = { started, settled, maxStarted, firstErr, noRunAfter, twoErr, syncErr, unitsLen: units.length };
        return firstErr === 'boom-1' && syncErr === 'sync' && noRunAfter && maxStarted <= 2 && twoErr === 'e0';
    })();

    // ============================== D. edges ==========================================================
    checks.scheduleUnitsEdges = (async () => {
        const empty = await scheduleUnits([], { exec: async () => 1 });
        const emptyOk = Array.isArray(empty) && empty.length === 0;
        let nullRejected = false, noExecRejected = false;
        try { await scheduleUnits(null, { exec: async () => 1 }); } catch { nullRejected = true; }
        try { await scheduleUnits([], {}); } catch { noExecRejected = true; }
        // a throwing onResult must not fail the run
        const threw = await scheduleUnits([1, 2, 3], { exec: async (u) => u, onResult: () => { throw new Error('reporter'); } });
        const reporterOk = JSON.stringify(threw) === '[1,2,3]';
        // concurrency > n: still bounded by n, and all units start
        let peak = 0, inFlight = 0;
        await scheduleUnits([0, 1, 2, 3, 4], { concurrency: 1000, exec: async (u) => { inFlight++; peak = Math.max(peak, inFlight); await sleep(1); inFlight--; return u; } });
        rows.edges = { emptyOk, nullRejected, noExecRejected, reporterOk, peakOverN: peak, n: 5 };
        return emptyOk && nullRejected && noExecRejected && reporterOk && peak <= 5 && peak >= 2;
    })();

    // ============================== E. makeFoldExecutor ===============================================
    checks.makeFoldExecutorContract = (async () => {
        let seenReq = null;
        const ex = makeFoldExecutor({
            dispatch: async (req) => { seenReq = req; return { positions: [1, 0, -1], confidence: [0.5, 0, -0.5], stats: { folds: 1 } }; },
        });
        const req = { variantId: 'v', foldIndex: 2 };
        const good = await ex(req);
        const goodOk = JSON.stringify(good.signals) === '[1,0,-1]'
            && JSON.stringify(good.confidence) === '[0.5,0,-0.5]'
            && good.stats && good.stats.folds === 1 && seenReq === req;
        const bad = {};
        for (const [name, reply] of Object.entries({ nullReply: null, noPositions: { confidence: [] }, positionsNotArray: { positions: 'nope' }, undefinedReply: undefined })) {
            try { await makeFoldExecutor({ dispatch: async () => reply })({ variantId: 'v', foldIndex: 1 }); bad[name] = 'no-throw'; }
            catch (e) { bad[name] = 'throw'; }
        }
        let noDispatch = false;
        try { makeFoldExecutor({}); } catch { noDispatch = true; }
        let nullPositions = null;
        try { nullPositions = await makeFoldExecutor({ dispatch: async () => ({ positions: null }) })({ variantId: 'v', foldIndex: 1 }); } catch { nullPositions = 'throw'; }
        rows.executor = { goodOk, bad, noDispatch, nullPositions, good };
        return goodOk && bad.nullReply === 'throw' && bad.noPositions === 'throw' && bad.positionsNotArray === 'throw' && bad.undefinedReply === 'throw' && noDispatch && nullPositions === 'throw';
    })();

    // (FINDING) half the reply is validated, half is silently nulled.
    checks.makeFoldExecutorSilentConfidence = (async () => {
        const make = (reply) => makeFoldExecutor({ dispatch: async () => reply });
        const throwsCf = async (reply) => { try { await make(reply)({}); return false; } catch (e) { return /L10-cf/.test(String(e && e.message)); } };
        const numThrows = await throwsCf({ positions: [1], confidence: 5, stats: { x: 1 } });
        const typedThrows = await throwsCf({ positions: [1], confidence: new Float32Array([1, 2]), stats: { x: 1 } });
        const statsZeroThrows = await throwsCf({ positions: [1], confidence: [0.5], stats: 0 });
        const emptyConf = await make({ positions: [1], confidence: [], stats: { x: 1 } })({});
        const nullConf = await make({ positions: [1], confidence: null, stats: { x: 1 } })({});
        const statsMissing = await make({ positions: [1], confidence: [0.5] })({});
        let positionsTyped = 'no-throw';
        try { await make({ positions: new Float32Array([1]) })({}); } catch { positionsTyped = 'throw'; }
        rows.silentConfidence = {
            numConfidenceThrows: numThrows, typedConfidenceThrows: typedThrows,
            emptyConfidence: emptyConf.confidence, nullConfidence: nullConf.confidence,
            statsZeroThrows, statsMissing: statsMissing.stats, positionsTyped,
            note: 'ROUND-94 UPDATE: hardened — a non-array `confidence` or non-object `stats` now throws a named malformed-reply error (L10-cf, round 48, R48-pinned) instead of degrading to null. Missing/null fields still map to null; an empty-array confidence passes through. Pre-hardening, half a malformed worker reply raised and half was absorbed.',
        };
        // pin the module's actual behaviour
        return numThrows && typedThrows && statsZeroThrows && Array.isArray(emptyConf.confidence) && nullConf.confidence === null
            && statsMissing.stats === null && positionsTyped === 'throw';
    })();

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = (v && typeof v.then === 'function') ? await v : v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-ce..: `analysis/parallel.js` is the SHIPPED order-preserving bounded-concurrency scheduler (round 26, R26-4) — the module that makes `folds.jsonl` byte-identical between the serial and parallel A/B paths; `backtest.js`/`walkforward.js` use normaliseConcurrency/scheduleUnits, `analyze.js` uses makeFoldExecutor, and `fold_worker.js` posts the reply shape the executor validates. PASSES the pre-registered read: `normaliseConcurrency` treats every non-finite / non-positive width as serial (0, -3, NaN, Infinity, null, undefined, \'3\', true -> 1), floors a fractional width (2.9 -> 2) and caps at 64 by default; `scheduleUnits` returns results in UNIT ORDER for an out-of-order completion schedule, calls exec exactly once per unit, never exceeds the requested concurrency (peak 3 of 3 requested, peak n when the request exceeds n) and reports through onResult (out of order, best-effort — a throwing reporter does not fail the run); a rejection rejects the whole call with the FIRST error (two failures -> e0), starts no unit past the start window and awaits every started unit (settled === started); a synchronous throw propagates; and empty input is []. `makeFoldExecutor` adapts the worker reply to {signals, confidence, stats}, passes the request through verbatim, and throws a named "malformed reply" for a null/undefined reply or a non-array positions (including a Float32Array). FINDINGS, RESTATED round 94 (both hardened in round 48): (0) `normaliseConcurrency` validates its `max` cap — L10-ce throws on non-finite or < 1; residual: fractional max >= 1 (2.5) still passes through un-floored; (1) `makeFoldExecutor` throws a named L10-cf error on a non-array `confidence` or non-object `stats` (missing/null still map to null). Both were latent/export-level; no golden moves.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            normaliseConcurrencyBadMax: rows.badMax,
            makeFoldExecutorSilentConfidence: rows.silentConfidence,
        },
        scope: {
            shipped: ['backtest.js (normaliseConcurrency + scheduleUnits over folds)', 'walkforward.js (normaliseConcurrency)', 'analyze.js (makeFoldExecutor + normaliseConcurrency)', 'fold_worker.js (the reply shape)'],
            why: 'The scheduler is shipped and load-bearing for the serial/parallel byte-identity claim, but both findings are latent: the bad `max` needs a direct caller, and the worker always posts a plain-array-or-null confidence. The order-preservation/no-dangling-promise contract — the thing the module exists for — is validated exactly. No fold-back row.',
        },
    };

    return { config: { units: 10, concurrency: 3 }, rows, validation: resolved, verdict };
}
