// E93 - W4c range estimators on the real panel: does the ranking survive the estimator?
//
// CYCLE-097. Rounds 49-57 measured everything on close-close realized vol. The
// range-based estimators (Parkinson, Garman-Klass, Rogers-Satchell, Yang-Zhang)
// use the bar's high/low path, so they are an independent measurement of the
// same latent volatility - W4c breadth at the measurement layer. This drives
// the repo `rangeRealizedVolatility` / `yangZhangRealizedVolatility` on every
// 1h stream (true opens, now carried by the lab loader) and re-runs the
// across-splits AR-vs-EWMA tournament on each estimator series.
//
// PRE-REGISTERED. PASS iff every estimator series is available on all 8
// streams, every estimator correlates with close-close vol above 0.8, and AR
// holds the split majority on every stream x estimator cell (32/32).
// Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, rangeRealizedVolatility, yangZhangRealizedVolatility, tournamentVolForecastAcrossSplits } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

function barReturns(close) {
    const out = new Array(close.length - 1);
    for (let i = 1; i < close.length; i++) out[i - 1] = close[i] / close[i - 1] - 1;
    return out;
}

function correlation(a, b) {
    const n = Math.min(a.length, b.length);
    let ma = 0;
    let mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    let s = 0;
    let sa = 0;
    let sb = 0;
    for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) * (a[i] - ma); sb += (b[i] - mb) * (b[i] - mb); }
    return s / Math.sqrt(sa * sb);
}

const ESTIMATORS = ['parkinson', 'garman-klass', 'rogers-satchell'];
const SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7];
const WINDOW = 24;

export async function run() {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e93: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    check('e93: every stream carries true opens', panel.every((s) => Array.isArray(s.open) && s.open.length === s.close.length), `open[0]=${panel.map((s) => s.open.length).join(',')}`);
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const ohlc = s.close.map((c, i) => ({ o: s.open[i], h: s.high[i], l: s.low[i], c }));
        const cc = realizedVolatility(barReturns(s.close), WINDOW);
        const series = { cc };
        for (const e of ESTIMATORS) series[e] = rangeRealizedVolatility(ohlc, WINDOW, { estimator: e });
        series.yz = yangZhangRealizedVolatility(ohlc, WINDOW);
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), series });
    }
    check('e93: every estimator series is available on every stream',
        rows.every((r) => Object.values(r.series).every((v) => Array.isArray(v) && v.length > 100)),
        rows.map((r) => `${r.sym}:${Object.values(r.series).map((v) => v.length).join('/')}`).join(' '));
    const corrs = [];
    for (const r of rows) {
        for (const e of [...ESTIMATORS, 'yz']) corrs.push({ sym: r.sym, e, c: correlation(r.series[e], r.series.cc) });
    }
    check('e93: every range estimator correlates with close-close vol above 0.8',
        corrs.every((x) => Number.isFinite(x.c) && x.c > 0.8),
        `min=${Math.min(...corrs.map((x) => x.c)).toFixed(4)}`);
    const cells = [];
    for (const r of rows) {
        for (const e of [...ESTIMATORS, 'yz']) {
            const t = tournamentVolForecastAcrossSplits(r.series[e], { splits: SPLITS });
            cells.push({ sym: r.sym, e, frac: t.available ? t.arWinFraction : NaN });
        }
    }
    check('e93: AR holds the split majority on every stream x estimator cell',
        cells.every((x) => Number.isFinite(x.frac) && x.frac > 0.5),
        `${cells.filter((x) => x.frac > 0.5).length}/${cells.length} cells majority-AR`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
