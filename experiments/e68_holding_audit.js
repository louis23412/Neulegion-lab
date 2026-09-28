// E68 - THE TURNOVER POLICY GRID, AUDITED: `analysis/holding.js`. CYCLE-060 (L10-cg ...).
//
// `analysis/holding.js` (round 26, R26-5) is the "turnover attack": it restates the journaled raw
// pre-policy confidence (R26-3) under a dead-zone x scale x entry/exit-hysteresis x minimum-holding
// grid, and for each (candidate, policy) reports the restated turnover / gross / break-even cost /
// pooled Sharpe and a FULL promotion decision. It is SHIPPED - `analyze.js` imports it as
// `runTurnoverSweep` behind `--turnover-sweep` and calls it with the run's `costBps` and with
// `decisionOptions: { requireCleanAudit: audit, ...gateOptions }`.
//
// PRE-REGISTERED READ. PASSES if: (i) the grid is the cartesian product DZ x SCALE x HOLD, each policy
// merged as `{...holding, deadZone, scale}`, and the row count is (policies x candidates); (ii) every
// row's turnover/gross/break-even/Sharpe equals a direct `restateReportAtPolicy(candidate, policy)`
// recompute; (iii) rows are sorted by break-even DESCENDING with a missing value last; (iv) `byId`'s
// `best` is the highest-break-even row for the id and `bestPromoting` is the highest-break-even
// PROMOTING row, with `bestTurnoverPolicy` preferring the promoting one; (v) the two bail-outs
// (a baseline with no fold inputs; a candidate with none) return `available:false`; (vi)
// `formatTurnoverSweep` renders an unavailable reason and, when available, every id plus the target.
//
// The DEFECTS are reported in `findings`:
//   - `turnoverSweep` ACCEPTS `costBps` and echoes it on every row, but NEVER passes it to
//     `restateReportAtPolicy` (which accepts `{costBps}`), so every row's `netSharpe`/`dsr` and every
//     promotion decision is computed at ZERO cost; only the cost-independent fields carry cost
//     information. A sweep at costBps 0 and 25 is byte-identical apart from the echoed field. The
//     shipped caller passes `costBps` (`--cost-bps`).
//   - `turnoverSweep`'s promotion decision cannot apply the `requireCleanAudit` hurdle it is asked for:
//     `restateReportAtPolicy` drops the `audit` block (unlike its sibling `restateReportAtCost`, which
//     deliberately carries it), so `promoteDecision` sees `audit === undefined` and skips the hurdle. A
//     candidate that FAILED the run's look-ahead audit can still be named `bestPromoting`.
//   - `DEFAULT_TURNOVER_GRID` is `Object.freeze`d only SHALLOWLY: its `deadZones`/`scales`/`holdings`
//     arrays (and the holding objects) stay mutable, so one caller can silently change the default grid
//     for every later caller.

import {
    DEFAULT_TURNOVER_GRID, turnoverSweep, bestTurnoverPolicy, formatTurnoverSweep,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/holding.js';
import {
    restateReportAtPolicy, promoteDecision, confidenceToPosition,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const close = (a, b, tol = 1e-12) => (a === b) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const mkReturns = (n, mean, amp, seed) => {
    const rnd = mulberry32(seed);
    const out = [];
    for (let i = 0; i < n; i++) out.push(mean + (rnd() - 0.5) * 2 * amp);
    return out;
};
// A variable confidence series so a dead zone / holding rule actually changes the positions.
const mkConfidence = (n, seed) => {
    const rnd = mulberry32(seed);
    const out = [];
    for (let i = 0; i < n; i++) out.push(Math.sin(i / 3.1) * 0.7 + (rnd() - 0.5) * 0.15);
    return out;
};
const mkReport = ({ id, confidences, returns, audit = null }) => ({
    id,
    foldInputs: [{
        confidence: confidences,
        signals: confidences.map((c) => confidenceToPosition(c, { deadZone: 0, scale: 1 })),
        returns,
    }],
    folds: [{ testStart: 0, testEnd: returns.length - 1 }],
    streamFoldLengths: [[returns.length]],
    audit,
});

const stripCost = (rows) => rows.map(({ costBps, ...rest }) => rest);

export async function run() {
    const checks = {};
    const rows = {};

    const N = 90;
    const strongReturns = mkReturns(N, 0.010, 0.0006, 3);
    const strongConf = new Array(N).fill(1);           // position always +1
    const weakReturns = mkReturns(N, -0.004, 0.0006, 4); // a LOSING baseline so the candidate clears every non-audit hurdle
    const weakConf = new Array(N).fill(1);
    const varying = mkConfidence(N, 7);
    const varyingReturns = mkReturns(N, 0.002, 0.004, 9);

    const baseline = mkReport({ id: 'base', confidences: weakConf, returns: weakReturns });
    const candStrong = mkReport({ id: 'sig-strong', confidences: strongConf, returns: strongReturns });
    const candVar = mkReport({ id: 'sig-var', confidences: varying, returns: varyingReturns });
    const baselineShort = mkReport({ id: 'base-short', confidences: varying, returns: varyingReturns });

    const DZ = [0, 0.1, 0.3];
    const SC = [1];
    const HO = [null, { enter: 0.2, exit: 0.05 }, { enter: 0.3, exit: 0.1, minHold: 3 }];
    const gridOpts = { deadZones: DZ, scales: SC, holdings: HO };

    // ============================== A. grid construction =========================================
    checks.gridConstruction = (() => {
        const sweep = turnoverSweep({ baseline, candidates: [candStrong, candVar], ...gridOpts, periodsPerYear: 252, trials: 1 });
        const policiesExpected = DZ.length * SC.length * HO.length;
        const rowShapeOk = sweep.rows.every((r) => r.policy && Number.isFinite(r.policy.deadZone) && Number.isFinite(r.policy.scale));
        // a null holding must merge to just {deadZone, scale}
        const bare = sweep.rows.find((r) => r.policy.enter === undefined && r.policy.exit === undefined);
        const holdOk = sweep.rows.some((r) => r.policy.enter === 0.2 && r.policy.exit === 0.05)
            && sweep.rows.some((r) => r.policy.enter === 0.3 && r.policy.exit === 0.1 && r.policy.minHold === 3);
        rows.grid = { policiesExpected, policies: sweep.policies, rows: sweep.rows.length, rowShapeOk, holdOk, bareFound: !!bare };
        return sweep.available === true && sweep.policies === policiesExpected
            && sweep.rows.length === policiesExpected * 2 && rowShapeOk && holdOk && !!bare;
    })();

    // ============================== B. the sweep surfaces the restatement =========================
    checks.sweepSurfacesRestatement = (() => {
        const sweep = turnoverSweep({ baseline, candidates: [candStrong, candVar], ...gridOpts, periodsPerYear: 252, trials: 1 });
        let ok = true;
        // a couple of policies checked against a direct restatement
        for (const policy of [{ deadZone: 0, scale: 1 }, { deadZone: 0.3, scale: 1 }, { deadZone: 0.1, scale: 1, enter: 0.2, exit: 0.05 }]) {
            const direct = restateReportAtPolicy(candVar, policy, { periodsPerYear: 252, trials: 1 });
            const row = sweep.rows.find((r) => r.id === 'sig-var' && r.policy.deadZone === policy.deadZone
                && r.policy.scale === policy.scale && r.policy.enter === policy.enter && r.policy.exit === policy.exit);
            if (!row) { ok = false; continue; }
            if (!close(row.turnover, direct.pooledMetrics.turnover, 1e-9)) ok = false;
            if (!close(row.grossPnl, direct.pooledMetrics.grossPnl, 1e-9)) ok = false;
            if (!close(row.netSharpe, direct.pooledMetrics.netSharpe, 1e-9)) ok = false;
            if (!close(row.breakEvenCostBps, direct.pooledMetrics.breakEvenCostBps, 1e-9)) ok = false;
        }
        rows.surfaces = { ok };
        return ok;
    })();

    // (FINDING) `costBps` is accepted, echoed, and never applied.
    checks.costBpsIsDead = (() => {
        const a = turnoverSweep({ baseline, candidates: [candVar], ...gridOpts, costBps: 0, periodsPerYear: 252, trials: 1 });
        const b = turnoverSweep({ baseline, candidates: [candVar], ...gridOpts, costBps: 25, periodsPerYear: 252, trials: 1 });
        const identical = deepEq(stripCost(a.rows), stripCost(b.rows));
        const echoed = b.rows.every((r) => r.costBps === 25) && a.rows.every((r) => r.costBps === 0);
        // ... but a direct restatement at a cost DOES change the net Sharpe (so the option would matter)
        const p = { deadZone: 0.1, scale: 1 };
        const at0 = restateReportAtPolicy(candVar, p, { periodsPerYear: 252, trials: 1, costBps: 0 });
        const at25 = restateReportAtPolicy(candVar, p, { periodsPerYear: 252, trials: 1, costBps: 25 });
        const costMoves = !close(at0.pooledMetrics.netSharpe, at25.pooledMetrics.netSharpe, 1e-9);
        const bar0 = a.rows.find((r) => r.policy.deadZone === 0.1 && r.policy.enter === undefined);
        const bar25 = b.rows.find((r) => r.policy.deadZone === 0.1 && r.policy.enter === undefined);
        rows.costDead = {
            identicalRows: identical, echoed, costMovesNetSharpe: costMoves,
            rowNetSharpe: bar0 ? bar0.netSharpe : null,
            direct0NetSharpe: at0.pooledMetrics.netSharpe,
            direct25NetSharpe: at25.pooledMetrics.netSharpe,
            note: 'turnoverSweep destructures `costBps` and writes it on every row, but each restatement is `restateReportAtPolicy(baseline|candidate, policy, { periodsPerYear, trials })` - costBps is NEVER threaded, so it defaults to 0. The rows at costBps 0 and 25 are byte-identical apart from the echoed field, while a DIRECT restatement at 25 bps moves the net Sharpe. So the reported net Sharpe and the promotion decision are gross-of-cost regardless of the requested cost. `analyze.js` passes the run `costBps` (the --cost-bps flag), so a `--turnover-sweep --cost-bps=10` run prints cost-free Sharpes under a header that says costBps=10.',
        };
        // pin the actual (buggy) behaviour
        return identical && echoed && costMoves;
    })();

    // (FINDING) the requireCleanAudit hurdle is structurally inapplicable in the sweep.
    checks.auditHurdleSkipped = (() => {
        const dirtyAudit = { clean: false, violations: [{ fold: 0 }], probes: 1, reachable: true };
        const baseDirty = mkReport({ id: 'base', confidences: weakConf, returns: weakReturns, audit: { clean: true, violations: [], probes: 1, reachable: true } });
        const candDirty = mkReport({ id: 'sig-dirty', confidences: strongConf, returns: strongReturns, audit: dirtyAudit });
        const sweep = turnoverSweep({ baseline: baseDirty, candidates: [candDirty], deadZones: [0], scales: [1], holdings: [null], periodsPerYear: 252, trials: 1, decisionOptions: { requireCleanAudit: true } });
        const somePromote = sweep.rows.some((r) => r.promote);
        const sweepMentionsAudit = sweep.rows.some((r) => (r.reasons || []).some((x) => /audit/i.test(x)));
        // the mechanism: restatement drops `audit`, so the hurdle sees undefined
        const restBase = restateReportAtPolicy(baseDirty, { deadZone: 0, scale: 1 });
        const restCand = restateReportAtPolicy(candDirty, { deadZone: 0, scale: 1 });
        const restDropsAudit = restBase.audit === undefined && restCand.audit === undefined;
        // ... and if the dirty audit WERE carried, the same decision would fail
        const manual = promoteDecision(restBase, { ...restCand, audit: dirtyAudit }, { requireCleanAudit: true });
        const manualFailsAudit = (manual.reasons || []).some((x) => /audit/i.test(x)) && manual.promote === false;
        const cleanPromote = promoteDecision(restBase, restCand, { requireCleanAudit: true }).promote;
        rows.auditSkip = {
            somePromote, sweepMentionsAudit, restDropsAudit, manualFailsAudit, cleanPromote,
            promoteStates: sweep.rows.map((r) => r.promote),
            manualReasons: manual.reasons,
            note: 'turnoverSweep passes `decisionOptions: { requireCleanAudit: audit }` straight to promoteDecision, but each report is RESTATED first, and restateReportAtPolicy does NOT carry the `audit` block (unlike its sibling restateReportAtCost, which deliberately does: "the look-ahead audit is cost-independent, so it carries over unchanged"). promoteDecision then sees audit === undefined and skips the hurdle (its guard is `if (baseline.audit && !baseline.audit.clean)`). So a candidate that FAILED the run\'s look-ahead audit still promotes in the sweep and can be named `byId.bestPromoting` - the sweep reports a decision the run would not make. Rebuilt with the audit attached, the same decision correctly fails.',
        };
        // pin the actual behaviour
        return restDropsAudit && manualFailsAudit && !sweepMentionsAudit && somePromote && cleanPromote;
    })();

    // (FINDING) DEFAULT_TURNOVER_GRID is only shallowly frozen.
    checks.defaultGridShallowFrozen = (() => {
        const outerFrozen = Object.isFrozen(DEFAULT_TURNOVER_GRID);
        const arraysFrozen = Object.isFrozen(DEFAULT_TURNOVER_GRID.deadZones)
            && Object.isFrozen(DEFAULT_TURNOVER_GRID.scales) && Object.isFrozen(DEFAULT_TURNOVER_GRID.holdings);
        const before = turnoverSweep({ baseline, candidates: [candStrong], periodsPerYear: 252, trials: 1 }).policies;
        let mutated = false;
        try {
            DEFAULT_TURNOVER_GRID.deadZones.push(0.9);
            mutated = DEFAULT_TURNOVER_GRID.deadZones.length === 9;
        } catch { mutated = false; }
        const after = turnoverSweep({ baseline, candidates: [candStrong], periodsPerYear: 252, trials: 1 }).policies;
        if (mutated) DEFAULT_TURNOVER_GRID.deadZones.pop();
        const restored = turnoverSweep({ baseline, candidates: [candStrong], periodsPerYear: 252, trials: 1 }).policies;
        const added = DEFAULT_TURNOVER_GRID.scales.length * DEFAULT_TURNOVER_GRID.holdings.length;
        rows.freeze = { outerFrozen, arraysFrozen, before, after, restored, added, note: 'Object.freeze is shallow: the exported DEFAULT_TURNOVER_GRID object is frozen, but its deadZones/scales/holdings arrays (and the holding objects) are not, so a caller can push a band and silently change the default grid for every later default sweep in the process. Latent (nobody mutates it today), but the "frozen" default is a shared mutable singleton.' };
        return outerFrozen && !arraysFrozen && mutated && after === before + added && restored === before;
    })();

    // ============================== C. ordering, byId, bestTurnoverPolicy =========================
    checks.orderingAndById = (() => {
        const sweep = turnoverSweep({ baseline, candidates: [candStrong, candVar, candStrong], ...gridOpts, periodsPerYear: 252, trials: 1 });
        const be = sweep.rows.map((r) => (r.breakEvenCostBps == null ? -Infinity : r.breakEvenCostBps));
        let sorted = true;
        for (let i = 1; i < be.length; i++) if (be[i] > be[i - 1] + 1e-9) sorted = false;
        // byId.best must be the max-break-even row of that id
        let bestOk = true, promoteOk = true;
        for (const [id, entry] of Object.entries(sweep.byId)) {
            const mine = sweep.rows.filter((r) => r.id === id);
            const maxBe = Math.max(...mine.map((r) => (r.breakEvenCostBps == null ? -Infinity : r.breakEvenCostBps)));
            if (!(entry.best && (entry.best.breakEvenCostBps == null ? -Infinity : entry.best.breakEvenCostBps) >= maxBe - 1e-9)) bestOk = false;
            const promotings = mine.filter((r) => r.promote);
            if (promotings.length) {
                if (!entry.bestPromoting) promoteOk = false;
            } else if (entry.bestPromoting !== null) promoteOk = false;
        }
        const bp = bestTurnoverPolicy(sweep, 'sig-strong');
        const bpOk = bp && (bp.promote || bp === sweep.byId['sig-strong'].best);
        const unknown = bestTurnoverPolicy(sweep, 'nope');
        rows.ordering = { sorted, bestOk, promoteOk, bpOk, unknownNull: unknown === null, maxMin: { max: be[0], min: be[be.length - 1] } };
        return sorted && bestOk && promoteOk && bpOk && unknown === null;
    })();

    // ============================== D. bail-outs and formatting ====================================
    checks.unavailablePaths = (() => {
        const noRefs = turnoverSweep({ baseline: { id: 'b', foldInputs: [] }, candidates: [candStrong] });
        const noBase = turnoverSweep({ candidates: [candStrong] });
        const badCand = turnoverSweep({ baseline, candidates: [{ id: 'x' }] });
        const okShape = (o) => o && o.available === false && typeof o.reason === 'string';
        rows.unavailable = { noRefs: okShape(noRefs) ? noRefs.reason : noRefs, noBase: okShape(noBase) ? noBase.reason : noBase, badCand: okShape(badCand) ? badCand.reason : badCand };
        return okShape(noRefs) && okShape(noBase) && okShape(badCand);
    })();

    checks.formatContract = (() => {
        const sweep = turnoverSweep({ baseline, candidates: [candStrong, candVar], ...gridOpts, periodsPerYear: 252, trials: 1, targetBps: 5 });
        const text = formatTurnoverSweep(sweep);
        const avail = typeof text === 'string' && text.includes('sig-strong') && text.includes('sig-var') && text.includes('target');
        const unavail = formatTurnoverSweep({ available: false, reason: 'no fold inputs' });
        const unavailOk = typeof unavail === 'string' && unavail.includes('unavailable') && unavail.includes('no fold inputs');
        const nullOk = formatTurnoverSweep(null) === null;
        rows.format = { avail: !!avail, unavailOk, nullOk, sample: text ? text.split('\n').slice(0, 2) : null };
        return avail && unavailOk && nullOk;
    })();

    const findingCost = rows.costDead;
    const findingAudit = rows.auditSkip;
    const findingFreeze = rows.freeze;

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = (v && typeof v.then === 'function') ? await v : v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-cg..: `analysis/holding.js` is the SHIPPED turnover attack (round 26, R26-5) - `analyze.js` imports it as `runTurnoverSweep` behind `--turnover-sweep` and calls it with the run costBps and `decisionOptions: { requireCleanAudit: audit, ...gateOptions }`. PASSES the pre-registered read: the grid is the cartesian product DZ x SCALE x HOLD ({...holding, deadZone, scale} per policy, rows = policies x candidates); every row reproduces a direct `restateReportAtPolicy(candidate, policy)` recompute (turnover/gross/net Sharpe/break-even to 1e-9); rows are sorted by break-even DESCENDING with a missing value last; `byId.best` is the highest-break-even row and `bestPromoting` the highest-break-even promoting one; `bestTurnoverPolicy` prefers promoting and returns null for an unknown id; the two bail-outs (no baseline fold inputs, a candidate without any) return `available:false` with a reason; and `formatTurnoverSweep` renders the unavailable reason and, when available, every id plus the target. FINDINGS: (0) `turnoverSweep` accepts `costBps` and echoes it on every row but NEVER threads it into `restateReportAtPolicy`, so every row netSharpe/dsr and every promotion decision is computed at ZERO cost - the costBps 0 and 25 sweeps are byte-identical apart from the echoed field while a direct restatement at 25 bps moves the net Sharpe (shipped caller passes costBps); (1) the `requireCleanAudit` hurdle the caller asks for is structurally inapplicable because `restateReportAtPolicy` drops the `audit` block (unlike `restateReportAtCost`, which carries it), so a candidate that FAILED the look-ahead audit still promotes and can be named `bestPromoting`; (2) `DEFAULT_TURNOVER_GRID` is only SHALLOWLY frozen - a caller can push a band onto its mutable `deadZones` and change the default grid for every later caller. All three are latent/report-level (no scored number moves, no golden moves); no fold-back row.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            costBpsNeverThreaded: findingCost,
            auditHurdleSkipped: findingAudit,
            defaultGridShallowFrozen: findingFreeze,
        },
        scope: {
            shipped: ['analyze.js imports turnoverSweep as runTurnoverSweep + formatTurnoverSweep', 'analyze.js calls runTurnoverSweep with { baseline, candidates: ladderCandidates, costBps, trials, decisionOptions: { requireCleanAudit: audit, ...gateOptions }, targetBps }'],
            why: 'holding.js only restates journaled inputs (no model, no RNG), so none of the three findings can move a scored number; they shape the diagnostic `--turnover-sweep` block and one exported default. costBps is passed by the shipped caller but dropped, so the reading is cost-free; the audit hurdle is requested but unreachable. No golden moves and no fold-back row is due.',
        },
    };

    return { config: { bars: N, deadZones: DZ, scales: SC, holdings: HO.length }, rows, validation: resolved, verdict };
}
