// Parity test (handover section 4): site numbers must equal the zip's file at default settings.
// Run: node tests/parity.test.js reports/<id>/report.json   (needs a report that includes trade legs)
const fs = require('fs'), path = require('path'), E = require('../js/engine.js');
const file = process.argv[2];
if (!file) { console.log('Usage: node tests/parity.test.js reports/<id>/report.json'); process.exit(2); }
const R = JSON.parse(fs.readFileSync(file, 'utf8'));
let fail = 0;
const chk = (name, got, want, tol) => { const ok = Math.abs(got - want) <= tol; if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got.toFixed(4) + ' want=' + want + ' tol=' + tol); };

const cfg = E.defaultCfg(), k = 1, T = R.summary.totals;
const priced = E.repriceAtoms(R.trades, cfg, k);
const tot = E.costTotals(priced);
chk('sum(net) of atoms == summary.totals.net (to the paisa)', E.sum(priced.map(p => Math.round(p.net * 100) / 100)), T.net, 0.005);
chk('sum(net) unrounded within 1 rupee', tot.net, T.net, 1);
chk('gross', tot.gross, T.gross, 1);
chk('costs', tot.costs, T.costs, 1);
chk('brokerage', tot.brk, T.brokerage, 0.01);
chk('stt', tot.stt, T.stt, 0.5);
chk('exchange', tot.exchange, T.exchange, 0.5);
chk('gst', tot.gst, T.gst, 0.5);

const sessions = R.daily.map(d => d.date);
const days = E.dailyFromPriced(sessions, priced);
let maxDiff = 0; days.forEach((d, i) => { maxDiff = Math.max(maxDiff, Math.abs(d.net - R.daily[i].net)); });
chk('every daily net vs file (max abs diff)', maxDiff, 0, 0.05);

const m = E.metrics(days, R.capital.chosen);
chk('roi_pct', m.roi, R.summary.roi_pct, 0.01);
chk('max_drawdown', m.dd.max, R.summary.max_drawdown, 0.5);
chk('max_drawdown_pct', m.dd.maxPct, R.summary.max_drawdown_pct, 0.01);
chk('current_drawdown', m.dd.cur, R.summary.current_drawdown, 0.5);
chk('sharpe', m.sharpe, R.summary.sharpe, 0.01);
chk('win_days_pct', m.winPct, R.summary.win_days_pct, 0.05);
chk('best_day net', m.best.net, R.summary.best_day.net, 0.05);
chk('worst_day net', m.worst.net, R.summary.worst_day.net, 0.05);
R.summary.monthly.forEach((mm, i) => { chk('month ' + mm.month + ' net', m.monthly[i].net, mm.net, 0.05); chk('month ' + mm.month + ' roi', m.monthly[i].roi, mm.roi_pct, 0.01); });

// Size: k=2 doubles everything (orders scale with size).
const p2 = E.costTotals(E.repriceAtoms(R.trades, cfg, 2));
chk('k=2 doubles net', p2.net, 2 * tot.net, 0.01);

// Linear-model consistency: moving a setting to the value that reproduces the actual figure must not change much.
// STT moved to the weighted actual rate: total STT within 1% of the dated-rate figure (different weighting only).
const aw = E.actualWeighted(priced);
const c2 = E.defaultCfg(); c2.settings.stt_pct = aw.stt_pct; c2.settings.exchange_pct = aw.exchange_pct;
const t3 = E.costTotals(E.repriceAtoms(R.trades, c2, 1));
chk('STT/exchange at weighted actual rates ~ actual total costs (within 25 rupees)', t3.costs, tot.costs, 25);

// Statutory off: statutory lines are zero, GST applies to brokerage only.
const c3 = E.defaultCfg(); c3.statutory_on = false;
const t4 = E.costTotals(E.repriceAtoms(R.trades, c3, 1));
chk('statutory off: stt+exchange+sebi+stamp+ipft = 0', t4.stt + t4.exchange + t4.sebi + t4.stamp + t4.ipft, 0, 1e-9);
chk('statutory off: gst = 18% of brokerage', t4.gst, 0.18 * t4.brk, 0.01);

// Zero slippage / zero costs: net == gross at raw prices.
const c4 = E.defaultCfg(); Object.assign(c4.settings, { slippage_pct: 0, brokerage_per_order: 0, brokerage_pct: 0, stt_pct: 0, exchange_pct: 0, gst_pct: 0, stamp_pct: 0, sebi_per_crore: 0, ipft_per_crore: 0, other_per_order: 0 });
const t5 = E.costTotals(E.repriceAtoms(R.trades, c4, 1));
chk('all costs zero: costs = 0', t5.costs, 0, 1e-9);
const rawGross = R.trades.reduce((t, a) => t + (a.dir === 'LONG' ? (a.xr - a.er) : (a.er - a.xr)) * a.q, 0);
chk('zero slippage gross == raw price difference', t5.gross, rawGross, 0.01);
console.log(fail ? '\n' + fail + ' CHECK(S) FAILED' : '\nALL CHECKS PASSED');
process.exit(fail ? 1 : 0);
