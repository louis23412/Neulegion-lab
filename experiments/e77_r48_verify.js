// E77 - R48 W6 hardening verify: do the repo's fixed guards mean what they say?
//
// CYCLE-081. Round 48 fixes six latent analysis-layer rows (L10-ca/cb/ce/cf/cj/cn)
// additively with no healthy-path move. This experiment drives the REPO functions
// and checks the contracts. Read-only on the repo.
//
// PRE-REGISTERED. PASS iff all 8 checks hold (see run() below).
// A failure means the port is not the measured object.

import { designEffectOfStreams, selectStreams } from '../../NeuLegion-master/NeuLegion-master/src/analysis/streams.js';
import { normaliseConcurrency, makeFoldExecutor } from '../../NeuLegion-master/NeuLegion-master/src/analysis/parallel.js';
import { interquartileMean, rliableIqm } from '../../NeuLegion-master/NeuLegion-master/src/analysis/replication.js';
import { restateReportAtPolicy } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const mkTrend = (n, f) => { const a = []; let x = 0; for (let i = 0; i < n; i++) { x += f(i); a.push(x); } return a; };
    const sA = mkTrend(60, (i) => Math.sin(i * 0.3) + 0.1 * Math.sin(i * 1.7));
    const sB = mkTrend(60, (i) => Math.cos(i * 0.23) + 0.1 * Math.sin(i * 2.1));

    const healthy = designEffectOfStreams({ a: sA, b: sB });
    check('e77: healthy panel available', healthy.available === true, `K=${healthy.K}`);
    const deg = designEffectOfStreams({ a: sA, b: sA.map(() => 5) });
    check('e77: constant stream fails closed (L10-ca)', deg.available === false && /L10-ca/.test(deg.reason || ''), deg.reason || '');
    let cb = false;
    try { selectStreams({ seriesByLabel: { a: sA, b: sB }, maxStreams: 0 }); } catch (e) { cb = /L10-cb/.test(e.message); }
    check('e77: maxStreams 0 throws (L10-cb)', cb);
    let ce = false;
    try { normaliseConcurrency(4, { max: 0 }); } catch (e) { ce = /L10-ce/.test(e.message); }
    check('e77: bad concurrency max throws (L10-ce)', ce && normaliseConcurrency(4, { max: 64 }) === 4);
    const exBad = makeFoldExecutor({ dispatch: async () => ({ positions: [1], confidence: 5, stats: {} }) });
    let cf = false;
    try { await exBad({ variantId: 'v', foldIndex: 0 }); } catch (e) { cf = /L10-cf/.test(e.message); }
    check('e77: malformed confidence throws (L10-cf)', cf);
    check('e77: rank-slice IQM kept, reference differs (L10-cj)',
        Math.abs(interquartileMean([1, 2, 3, 4]) - 2.5) < 1e-12 && Math.abs(rliableIqm([0, 0, 5, 10]) - 5 / 3) < 1e-9,
        `iqm=${interquartileMean([0, 0, 5, 10])} ref=${rliableIqm([0, 0, 5, 10])}`);
    const rep = {
        foldInputs: [{ returns: [0.01, 0.02, -0.01], signals: [1, 1, 1], confidence: [0.9, 0.9, 0.9] }],
        folds: [{ metrics: {} }], trials: 1,
    };
    const rs = restateReportAtPolicy(rep, { deadZone: 0.999 });
    check('e77: restatement carries restated signals (L10-cn)',
        !!rs && rs.foldInputs[0].signals.every((x) => x === 0) && rep.foldInputs[0].signals[0] === 1);
    check('e77: single constant fails closed, single healthy trivial',
        designEffectOfStreams({ a: sA.map(() => 2) }).available === false && designEffectOfStreams({ a: sA }).designEffect === 1);

    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
