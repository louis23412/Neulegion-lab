// E137 - THE SCORING PATH, AUDITED AGAINST INDEPENDENT RECOMPUTES. CYCLE-139.
//
// `analysis/portfolio.js` is the module every published sleeve number flows
// through (e123-e136 all score via cleanBook + scoreBookReturns). The L10
// audit queue has never touched it. This experiment checks it against
// synthetic ground truth and independent recomputes: the clip/band/clean
// construction, the cost application, the risk-layer sizing, the block
// diagnostics and the G5 conjunction.
//
// PRE-REGISTERED. PASSES iff every guard passes (the module is exact). Any
// failing guard becomes an L10 row; a guard that moves a published e12x
// number is a finding, otherwise latent.

import {
  MIN_TRAIN_PERIODS, clipWeights, bandWeights, cleanBook, SLEEVE_SPECS, cleanForSleeve,
  inverseVolWeights, volTargetScale, clippedTrailingMedianSchedule, fixedSplitJointSize,
  bookReturns, bookTurnover, scoreBookReturns, scoreBook, scoreSleeveBook,
  stressHalves, worstBlock, blockSharpes, scoreG5,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/portfolio.js';

const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : String(x));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, v) => x + (v - m) ** 2, 0) / (a.length - 1)); };
const sharp = (a) => { const s = sd(a); return s > 0 ? mean(a) / s : 0; };

export async function run() {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });

  // A1. clip: exact cap, null identity, no renormalisation.
  const spiky = [[0.438, -0.3, 0.05], [0.1, 0.125, -0.5]];
  const clipped = clipWeights(spiky, 0.125);
  const maxAbs = Math.max(...clipped.flat().map(Math.abs));
  check('e137: clip caps max|w| exactly at cap', maxAbs === 0.125, 'max=' + maxAbs);
  check('e137: clip null returns the same array', clipWeights(spiky, null) === spiky, '');
  const unclippedRatio = spiky[0][2] / spiky[1][0];
  check('e137: clip preserves unclipped ratios (winsorise, not shrink)',
    Math.abs(clipped[0][2] / clipped[1][0] - unclippedRatio) < 1e-15, '');

  // A2. band: null identity, hold semantics, first row, order matters.
  check('e137: band null returns the same array', bandWeights(spiky, null) === spiky, '');
  const drift = [[0, 0], [0.004, 0.004], [0.009, 0.02], [0.02, 0.021]];
  const banded = bandWeights(drift, 0.005);
  const held = [[0, 0], [0, 0], [0.009, 0.02], [0.02, 0.02]];
  check('e137: band holds within eps, takes beyond (independent replay)',
    JSON.stringify(banded) === JSON.stringify(held), JSON.stringify(banded));
  const capThenBand = cleanBook(spiky, { cap: 0.125, bandEps: 0.01 });
  const manual = bandWeights(clipWeights(spiky, 0.125), 0.01);
  check('e137: cleanBook is exactly band-after-clip', JSON.stringify(capThenBand) === JSON.stringify(manual), '');
  const edge = [[0.12, 0], [0.14, 0], [0.12, 0]];
  const edgeCapThenBand = cleanBook(edge, { cap: 0.125, bandEps: 0.015 });
  const edgeBandThenCap = clipWeights(bandWeights(edge, 0.015), 0.125);
  check('e137: order matters (band-after-clip != clip-after-band on the edge witness)',
    JSON.stringify(edgeCapThenBand) !== JSON.stringify(edgeBandThenCap) &&
    JSON.stringify(edgeCapThenBand) === JSON.stringify([[0.12, 0], [0.12, 0], [0.12, 0]]) &&
    JSON.stringify(edgeBandThenCap) === JSON.stringify([[0.12, 0], [0.125, 0], [0.12, 0]]),
    JSON.stringify(edgeCapThenBand) + ' vs ' + JSON.stringify(edgeBandThenCap));

  // A3. specs pinned; cleanForSleeve routes; unknown throws.
  check('e137: SLEEVE_SPECS pinned (R8 0.125/0.005, R7 0.125/null, OI null/0.03)',
    SLEEVE_SPECS.R8.cap === 0.125 && SLEEVE_SPECS.R8.bandEps === 0.005 &&
    SLEEVE_SPECS.R7.cap === 0.125 && SLEEVE_SPECS.R7.bandEps === null &&
    SLEEVE_SPECS.OI.cap === null && SLEEVE_SPECS.OI.bandEps === 0.03 &&
    MIN_TRAIN_PERIODS === 2555, JSON.stringify(SLEEVE_SPECS));
  let threw = false;
  try { cleanForSleeve(spiky, 'NOPE'); } catch { threw = true; }
  check('e137: cleanForSleeve matches cleanBook per spec; unknown sleeve throws',
    threw && JSON.stringify(cleanForSleeve(spiky, 'R8')) === JSON.stringify(cleanBook(spiky, { cap: 0.125, bandEps: 0.005 })), '');

  // A4. bookReturns/bookTurnover identities.
  const W = [[0.5, -0.5], [0.25, 0.25], [0, 1]];
  const R = [[0.01, 0.02], [0.04, -0.04], [0.01, 0.01]];
  const hand = W.map((w, i) => w[0] * R[i][0] + w[1] * R[i][1]);
  check('e137: bookReturns is the hand dot product', JSON.stringify(bookReturns(W, R)) === JSON.stringify(hand), '');
  check('e137: bookReturns nulls on shape mismatch / non-finite',
    bookReturns(W, [R[0]]) === null && bookReturns([[0.5, NaN]], [R[0]]) === null, '');
  const handTo = Math.abs(0.25 - 0.5) + Math.abs(0.25 + 0.5) + Math.abs(0 - 0.25) + Math.abs(1 - 0.25);
  check('e137: bookTurnover is the hand L1 (first row free)', bookTurnover(W) === handTo, 'to=' + bookTurnover(W));
  check('e137: single-row turnover is 0', bookTurnover([[0.5]]) === 0, '');

  // A5. scoreBookReturns: uniform cost, BE identity, zero-cost, pipeline.
  const s = scoreBookReturns(hand, W, { costBps: 4 });
  const costPerBar = (4 / 1e4) * handTo / hand.length;
  check('e137: cost is spread uniformly (net = gross - cost/n)',
    s.net.every((v, i) => Math.abs(v - (hand[i] - costPerBar)) < 1e-15), '');
  const be = 1e4 * hand.reduce((a, v) => a + v, 0) / handTo;
  check('e137: break-even is 1e4*sum(gross)/turnover', Math.abs(s.breakEvenCostBps - be) < 1e-9, 'be=' + r2(s.breakEvenCostBps));
  const s0 = scoreBookReturns(hand, W, { costBps: 0 });
  check('e137: zero cost leaves gross untouched', JSON.stringify(s0.net) === JSON.stringify(hand), '');
  check('e137: scoreBook equals the two-step pipeline',
    JSON.stringify(scoreBook(W, R, { costBps: 4 })) === JSON.stringify(scoreBookReturns(bookReturns(W, R), W, { costBps: 4 })), '');
  const sl = scoreSleeveBook(W, R, null, { costBps: 4 });
  check('e137: null panel reads neutral NaN, raw == book net',
    sl && Number.isNaN(sl.neutralSharpe) && sl.rawSharpe === s.netSharpe, '');

  // B. risk layer.
  const iv = inverseVolWeights([[0.01, -0.01, 0.01, -0.01], [0, 0, 0, 0], [0.02, 0.02, -0.02, -0.02]]);
  check('e137: inverse-vol sums to 1, dead stream gets 0',
    Math.abs(iv[0] + iv[1] + iv[2] - 1) < 1e-12 && iv[1] === 0 && iv[0] > iv[2], iv.map(r2).join('/'));
  check('e137: all-degenerate vols read all 0',
    JSON.stringify(inverseVolWeights([[0, 0], [1, 1]])) === JSON.stringify([0, 0]), '');
  check('e137: volTargetScale is target/sqrt(var); degenerate reads NaN',
    Math.abs(volTargetScale([0.01, -0.01, 0.02, -0.02], 0.1) - 0.1 / sd([0.01, -0.01, 0.02, -0.02])) < 1e-12 &&
    Number.isNaN(volTargetScale([0.01, 0.01], 0.1)) && Number.isNaN(volTargetScale([0.01], 0)), '');
  check('e137: clipped schedule is the trailing median clipped at f*last',
    clippedTrailingMedianSchedule([10, 20, 30, 40, 1000], { lookback: 4, f: 0.05 }) === Math.min(35, 50) &&
    clippedTrailingMedianSchedule([], {}) === 0, '');
  check('e137: fixed-split joint is the dot product; mismatch is NaN',
    fixedSplitJointSize([10, 20], [0.5, 0.5]) === 15 && Number.isNaN(fixedSplitJointSize([10], [0.5, 0.5])), '');

  // C. diagnostics + G5.
  const net = [0.01, 0.02, -0.01, 0.03, 0.01, -0.02, 0.02, 0.01, 0.015, -0.005, 0.02, 0.01];
  check('e137: blockSharpes hand recompute (6 blocks of 2)',
    JSON.stringify(blockSharpes(net, 6).map(r2)) === JSON.stringify([0, 1, 2, 3, 4, 5].map((b) => r2(sharp(net.slice(b * 2, b * 2 + 2))))), '');
  check('e137: worstBlock is the min; stressHalves splits evenly',
    worstBlock(net, 6) === Math.min(...blockSharpes(net, 6)) &&
    Math.abs(stressHalves(net).first - sharp(net.slice(0, 6))) < 1e-12, '');
  const g5pass = scoreG5({ net, dsrAdjusted: 0.96, neutralSharpe: 0.1, decayDocumented: true, unseenData: true });
  const g5fail = scoreG5({ net, dsrAdjusted: null, neutralSharpe: 0.1, decayDocumented: true, unseenData: true });
  check('e137: G5 passes full conjunction; null dsr fails (never skips)',
    g5pass.verdict === true && g5fail.verdict === false && g5fail.reasons.includes('dsr'), g5fail.reasons.join(','));
  const g5noatt = scoreG5({ net, dsrAdjusted: 0.96, neutralSharpe: 0.1 });
  check('e137: G5 fails without human attestations',
    g5noatt.verdict === false && g5noatt.reasons.includes('decay') && g5noatt.reasons.includes('unseen'), g5noatt.reasons.join(','));

  const failed = checks.filter((c) => !c.pass);
  return {
    total: checks.length, failed: failed.length, failures: failed, checks,
    artefact: { verdict: failed.length === 0 ? 'SUPPORTED' : 'NEGATIVE' },
  };
}
