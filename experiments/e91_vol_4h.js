// E91 - W5 breadth: does the vol tournament hold on 4h resampled bars?
//
// CYCLE-095. W5 buys independence breadth; its cheapest form here is a
// lower frequency (fewer, less correlated bars). This resamples the real
// 1h panel to 4h with the REPO `resampleCandles` and runs the across-
// splits tournament on each stream.
//
// PRE-REGISTERED. PASS iff the tournament is available on all 8 streams
// and AR wins the majority on >= 6/8. A flip bounds W4b to intraday
// frequencies. Read-only.

import { buildPanel } from '../lib/lab.js';
import { realizedVolatility, tournamentVolForecastAcrossSplits } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';
import { resampleCandles } from '../../NeuLegion-master/NeuLegion-master/src/analysis/streams.js';

const SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7];

export async function run({ factor = 4, window = 12, lambda = 0.94, order = 1 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const panel = await buildPanel({ tf: '1h' });
    check('e91: the 1h panel builds with 8 streams', panel.length === 8, `streams=${panel.length}`);
    const rows = [];
    for (let k = 0; k < panel.length; k++) {
        const s = panel[k];
        const candles = s.close.map((c, i) => ({ open: c, high: c, low: c, close: c, volume: 1, timestamp: i }));
        const re = resampleCandles(candles, { factor });
        const closes = re.map((c) => c.close);
        const rets = closes.slice(1).map((c, i) => c / closes[i] - 1);
        const vols = realizedVolatility(rets, window);
        const t = tournamentVolForecastAcrossSplits(vols, { splits: SPLITS, lambda, order });
        rows.push({ sym: (s.label || `stream${k}`).replace(/^candles_/, '').replace(/\.jsonl$/, ''), t, n4h: closes.length });
    }
    check('e91: 4h resampling yields 13k+ bars per stream',
        rows.every((r) => r.n4h > 13000), rows.map((r) => `${r.sym}=${r.n4h}`).join(','));
    check('e91: tournament available on every 4h stream',
        rows.every((r) => r.t.available),
        rows.map((r) => `${r.sym}:${r.t.available ? `${r.t.arWins}/5` : r.t.reason}`).join(' '));
    const winners = rows.filter((r) => r.t.available && r.t.arWinFraction > 0.5).length;
    check('e91: AR majority on >= 6/8 4h streams', winners >= 6, `arMajority=${winners}/8`);
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
