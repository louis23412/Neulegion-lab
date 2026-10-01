// E125 - SIGN-REVERSAL × TAKER-FLOW CONDITIONING ON 15M (TODO 88).
//
// Round-97 AI-side. Sweep 10b/2608.21888 task-defines the open reversal leg:
// 15m reversal lives in SIGNS (fade the prior candle), concentrates after
// aggressive taker flow, and book depth conditions nothing. The lab holds
// taker_15m.json + e9_flow plumbing, so this is AI-side testable.
//
// Method: raw ±1/0 signal arrays (no z pipeline — binary needs none; the
// e9-controls precedent) through the same score()/netSeries() arithmetic.
// flowShock = |flowChange(t, {window:8})| (causal, taker.js); quintiles from
// the trailing 500-bar per-stream rank (causal, no lookahead). Arms: fade-all
// plus fade-in-quintile-q for q=1..5. Random control for sanity.
//
// PRE-REGISTERED. PASS iff BE_Q5 > BE_all AND HR_Q5 > HR_Q1 (flow intensity
// buys reversal edge with a positive quintile gradient). MIXED if exactly one
// holds. NEGATIVE otherwise (no flow-conditioning value).

import { buildPanel, attachFlow, loadTaker, score, netSeries, stats, SYMBOLS, PERIODS_PER_YEAR } from '../lib/lab.js';
import { flowChange } from '../prototypes/taker.js';

const QWIN = 500;

function quintileOf(rank, n) {
  if (!Number.isFinite(rank) || n < 5) return 0;
  const q = Math.floor((rank / n) * 5) + 1;
  return Math.min(5, Math.max(1, q));
}

export async function run({ blocks = 6 } = {}) {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
  const rawPanel = await buildPanel({ symbols: SYMBOLS, tf: '15m' });
  const taker = await loadTaker('src/NeuLegion-lab/data/taker_15m.json');
  let panel = attachFlow(rawPanel, SYMBOLS, taker);
  let end = panel[0].t.length;
  for (const s of panel) { for (let k = s.t.length - 1; k >= 0; k--) if (Number.isFinite(s.flow[k])) { end = Math.min(end, k + 1); break; } }
  panel = panel.map((s) => ({ ...s, t: s.t.slice(0, end), returns: s.returns.slice(0, end), flow: s.flow.slice(0, end), n: end }));
  const n = end;
  const coverage = panel.map((s) => s.flow.filter(Number.isFinite).length / n);
  check('e125: 15m flow coverage is usable', stats(coverage).min > 0.5, 'min=' + stats(coverage).min.toFixed(3) + ' mean=' + stats(coverage).mean.toFixed(3));
  const shock = panel.map((s) => {
    const out = new Array(n).fill(NaN);
    for (let t = 0; t < n; t++) { const v = flowChange(s, t, { window: 8 }); out[t] = Number.isFinite(v) ? Math.abs(v) : NaN; }
    return out;
  });
  const quint = shock.map((sh) => {
    const q = new Array(n).fill(0);
    for (let t = 0; t < n; t++) {
      if (!Number.isFinite(sh[t])) continue;
      let le = 0;
      let tot = 0;
      for (let k = Math.max(0, t - QWIN + 1); k <= t; k++) {
        if (!Number.isFinite(sh[k])) continue;
        tot++;
        if (sh[k] <= sh[t]) le++;
      }
      q[t] = quintileOf(le, tot);
    }
    return q;
  });
  const fadeAt = (s, t) => (t > 0 && Number.isFinite(s.returns[t - 1]) && s.returns[t - 1] !== 0 ? -Math.sign(s.returns[t - 1]) : 0);
  const arms = { all: panel.map((s) => s.returns.map((_, t) => fadeAt(s, t))) };
  for (let q = 1; q <= 5; q++) {
    arms['Q' + q] = panel.map((s, i) => s.returns.map((_, t) => (quint[i][t] === q ? fadeAt(s, t) : 0)));
  }
  const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const rnd = mulberry32(777);
  arms.rand = panel.map(() => new Array(n).fill(0).map(() => (rnd() < 0.5 ? -1 : 1)));
  const res = {};
  for (const [name, sig] of Object.entries(arms)) {
    const per = panel.map((s, i) => score(s.returns, sig[i], { costBps: 0 }));
    let wins = 0;
    let traded = 0;
    for (let i = 0; i < panel.length; i++) {
      const r = panel[i].returns;
      const g = sig[i];
      for (let t = 0; t < n - 1; t++) {
        if (g[t] !== 0 && Number.isFinite(r[t + 1])) { traded++; if (g[t] * r[t + 1] > 0) wins++; }
      }
    }
    res[name] = {
      meanSharpe: stats(per.map((p) => p.netSharpe)).mean,
      meanBE: stats(per.map((p) => p.breakEvenCostBps)).mean,
      hitRate: traded ? wins / traded : NaN,
      traded,
    };
  }
  check('e125: random control is null (sanity)', Math.abs(res.rand.meanSharpe) < 0.2 && Math.abs(res.rand.hitRate - 0.5) < 0.03,
    'sharpe=' + res.rand.meanSharpe.toFixed(3) + ' hr=' + res.rand.hitRate.toFixed(3));
  check('e125: every quintile arm trades', [1, 2, 3, 4, 5].every((q) => res['Q' + q].traded > 1000),
    [1, 2, 3, 4, 5].map((q) => res['Q' + q].traded).join('/'));
  const pass = res.Q5.meanBE > res.all.meanBE && res.Q5.hitRate > res.Q1.hitRate;
  const half = (res.Q5.meanBE > res.all.meanBE) !== (res.Q5.hitRate > res.Q1.hitRate);
  const verdict = pass ? 'SUPPORTED' : half ? 'MIXED' : 'NEGATIVE';
  const failed = checks.filter((c) => !c.pass);
  return { total: checks.length, failed: failed.length, failures: failed, checks, artefact: { verdict, arms: res, blocks } };
}
