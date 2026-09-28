// E89 - W4b on the carry book: does AR beat EWMA on carry-book vol?
//
// CYCLE-093. Every vol result so far (E78–E88) is on spot-price realized
// vol. But W4b's applied payoff is sizing the carry sleeve — and carry
// P&L has a different risk profile (funding-regime jumps, basis tail).
// This runs the REPO half-split tournament on the honest delta-neutral
// carry book's own vol (pooled, 8h grid).
//
// PRE-REGISTERED. PASS iff the tournament is available, EWMA skill is
// positive, and AR beats EWMA. A failure bounds W4b to price vol —
// recorded either way. Read-only.

import { loadCarryBook } from './e3_carry.js';
import { SYMBOLS } from '../lib/lab.js';
import { realizedVolatility, tournamentVolForecast } from '../../NeuLegion-master/NeuLegion-master/src/analysis/forecast.js';

export async function run({ window = 24, split = 0.5, lambda = 0.94, order = 1 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });
    const book = await loadCarryBook(SYMBOLS);
    const pooled = book && book.pooled ? book.pooled : null;
    check('e89: the honest carry book loads with a pooled series',
        Array.isArray(pooled) && pooled.length > 1000, `n=${pooled ? pooled.length : 0}`);
    const vols = pooled ? realizedVolatility(pooled, window) : [];
    check('e89: carry-book realized vol builds', vols.length > 500, `n=${vols.length}`);
    const t = vols.length ? tournamentVolForecast(vols, { split, lambda, order }) : { available: false, reason: 'no vols' };
    check('e89: tournament is available on carry-book vol',
        t.available === true, t.available ? `trainN=${t.trainN} testN=${t.testN}` : t.reason);
    check('e89: EWMA skill is positive on carry-book vol',
        t.available && t.ewmaSkill > 0, t.available ? `ewma=${t.ewmaSkill.toFixed(3)}` : 'n/a');
    check('e89: AR beats EWMA on carry-book vol',
        t.available && t.beatsEwma === true, t.available ? `ar=${t.arSkill.toFixed(3)} winner=${t.winner}` : 'n/a');
    const failed = checks.filter((c) => !c.pass);
    return { total: checks.length, failed: failed.length, failures: failed, checks };
}
