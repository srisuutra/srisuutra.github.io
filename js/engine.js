/* SRISUUTRA ALGO TRADING - calculation engine (no dependencies).
 * Runs in the browser (window.GHE) and in Node (tests/parity.test.js).
 * price() is a line-for-line port of the rules in HANDOVER_WEBSITE.md section 4.
 * Percent settings are in PERCENT (0.02 = 0.02%). Money in rupees.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GHE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CRORE = 1e7;
  // Standard deployed capital per group (handover section 2). Non-directional 5L, directional 2L; both together 5L (margin offset).
  const DEPLOYED = {};
  const BOTH = 0;
  // Slider start positions (Parameters of the zip). STT/exchange open at costs.actual_weighted.
  const PARAM_DEFAULTS = {
    slippage_pct: 0.02, brokerage_per_order: 20, brokerage_pct: 0, stt_pct: null, exchange_pct: null,
    gst_pct: 18, stamp_pct: 0.003, sebi_per_crore: 10, ipft_per_crore: 0.01, other_per_order: 0
  };
  const SETTING_KEYS = Object.keys(PARAM_DEFAULTS);

  /* Capital comes from the report: per-strategy capital, and (when every strategy of one report is selected) the report's combined deployed capital (margin offset). */
  function deployed(groups, extra, both) {
    const g = [...new Set(groups)];
    if (both && g.length > 1) return both;
    let t = 0; g.forEach(x => { t += DEPLOYED[x] || (extra && extra[x]) || 0; });
    return t;
  }
  const sizeK = (capital, dep) => (dep > 0 ? Math.max(0, Math.floor(capital / dep + 1e-9)) : 1);

  const nullSettings = () => { const o = {}; SETTING_KEYS.forEach(k => o[k] = null); return o; };
  const defaultCfg = () => ({ settings: nullSettings(), statutory_on: true, orders_scale_with_size: false });
  const has = v => v !== null && v !== undefined;
  const r2 = x => Math.round(x * 100) / 100;

  /* price(atom, cfg, k) -> {gross, brk, other, stt, exchange, sebi, stamp, ipft, gst, costs, net, tb, ts}
   * cfg = {settings:{...|null}, statutory_on, orders_scale_with_size}. null = the backtest's own figure. */
  function price(a, cfg, k) {
    cfg = cfg || defaultCfg();
    const st = cfg.settings || {};
    const statOn = cfg.statutory_on !== false;
    const scale = cfg.orders_scale_with_size !== false;
    const ko = scale ? k : 1;
    if (k === 0) return { gross: 0, brk: 0, other: 0, stt: 0, exchange: 0, sebi: 0, stamp: 0, ipft: 0, gst: 0, costs: 0, net: 0, tb: 0, ts: 0 };

    const allNull = SETTING_KEYS.every(x => !has(st[x]));
    if (allNull && statOn && (scale || k === 1)) {
      // Fast path: everything is the backtest's own figure, scaled by size.
      const o = {
        gross: a.gross * k, brk: a.brk * ko, other: (a.oc || 0) * ko, stt: a.stt * k, exchange: a.exchange * k,
        sebi: a.sebi * k, stamp: a.stamp * k, ipft: a.ipft * k, gst: k === 1 ? a.gst : a.gst * k, tb: a.tb * k, ts: a.ts * k
      };
      o.net = a.net * k;
      o.costs = o.gross - o.net;
      return o;
    }

    let tb, ts, gross;
    if (has(st.slippage_pct)) {
      const s = st.slippage_pct / 100, long = a.dir === 'LONG';
      const rawBuy = long ? a.er * a.q : a.xr * a.q, rawSell = long ? a.xr * a.q : a.er * a.q;
      tb = rawBuy * (1 + s) * k; ts = rawSell * (1 - s) * k; gross = ts - tb;
      if (long) gross = ts - tb; // same expression: sell - buy for both directions
    } else { tb = a.tb * k; ts = a.ts * k; gross = a.gross * k; }
    const turn = tb + ts;

    const bpo = st.brokerage_per_order, bpc = st.brokerage_pct;
    let brk;
    if (has(bpo) || has(bpc)) brk = (has(bpo) ? bpo : PARAM_DEFAULTS.brokerage_per_order) * a.o * ko + (has(bpc) ? bpc / 100 : 0) * turn;
    else brk = a.brk * ko;

    let stt = 0, exchange = 0, sebi = 0, stamp = 0, ipft = 0;
    if (statOn) {
      stt = has(st.stt_pct) ? st.stt_pct / 100 * ts : a.stt * k;
      exchange = has(st.exchange_pct) ? st.exchange_pct / 100 * turn : a.exchange * k;
      sebi = has(st.sebi_per_crore) ? st.sebi_per_crore * turn / CRORE : a.sebi * k;
      stamp = has(st.stamp_pct) ? st.stamp_pct / 100 * tb : a.stamp * k;
      ipft = has(st.ipft_per_crore) ? st.ipft_per_crore * turn / CRORE : a.ipft * k;
    }
    const other = has(st.other_per_order) ? st.other_per_order * a.o * ko : (a.oc || 0) * ko;

    // GST base: brokerage + exchange + SEBI + IPFT (statutory off: brokerage only).
    const baseChanged = !statOn || ['slippage_pct', 'brokerage_per_order', 'brokerage_pct', 'exchange_pct', 'sebi_per_crore', 'ipft_per_crore']
      .some(x => has(st[x]));
    let gst;
    if (!baseChanged && !has(st.gst_pct) && k === 1) gst = a.gst;
    else gst = (has(st.gst_pct) ? st.gst_pct / 100 : PARAM_DEFAULTS.gst_pct / 100) * (brk + exchange + sebi + ipft);

    const costs = brk + other + stt + exchange + sebi + stamp + ipft + gst;
    return { gross, brk, other, stt, exchange, sebi, stamp, ipft, gst, costs, net: gross - costs, tb, ts };
  }

  /* Reprice atoms; returns rows with the atom's identity plus priced figures. */
  function repriceAtoms(atoms, cfg, k) {
    return atoms.map(a => { const p = price(a, cfg, k); p.atom = a; p.x = a.x; p.d = a.d; p.g = a.g; p.id = a.id; return p; });
  }

  /* Daily series over a list of sessions from priced rows (by exit date). */
  function dailyFromPriced(sessions, priced) {
    const m = {}; sessions.forEach(d => { m[d] = { date: d, gross: 0, costs: 0, net: 0, ids: new Set() }; });
    priced.forEach(p => { const r = m[p.x]; if (!r) return; r.gross += p.gross; r.costs += p.costs; r.net += p.net; r.ids.add(p.id); });
    return sessions.map(d => { const r = m[d]; return { date: d, gross: r.gross, costs: r.costs, net: r.net, trades: r.ids.size }; });
  }

  const sum = a => a.reduce((t, v) => t + v, 0);
  const mean = a => (a.length ? sum(a) / a.length : 0);
  function std(a) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a.map(v => (v - m) * (v - m))) / (a.length - 1)); }

  /* Drawdown on cumulative P&L, as % of capital. Returns series + episodes. */
  function drawdown(dates, nets, capital) {
    let cum = 0, peak = 0, peakI = -1, maxDD = 0, ep = null; const cumS = [], ddS = [], ddPct = [], eps = [];
    nets.forEach((v, i) => {
      cum += v; cumS.push(cum);
      if (cum >= peak) { // new or equal high: close any open episode
        if (ep) { ep.end = dates[i]; ep.endI = i; ep.recovered = true; eps.push(ep); ep = null; }
        peak = cum; peakI = i;
      }
      const dd = peak - cum; ddS.push(dd); ddPct.push(capital ? dd / capital * 100 : 0);
      if (dd > 0) {
        if (!ep) ep = { peakDate: peakI >= 0 ? dates[peakI] : dates[0], peakI, start: dates[i], startI: i, depth: 0, troughDate: dates[i], troughI: i, end: null, endI: null, recovered: false };
        if (dd > ep.depth) { ep.depth = dd; ep.troughDate = dates[i]; ep.troughI = i; }
      }
      if (dd > maxDD) maxDD = dd;
    });
    if (ep) { ep.endI = nets.length - 1; eps.push(ep); }
    eps.forEach(e => { e.pct = capital ? e.depth / capital * 100 : 0; e.sessions = e.endI - e.startI + (e.recovered ? 0 : 1); e.toTrough = e.troughI - e.startI + 1; });
    const cur = ddS.length ? ddS[ddS.length - 1] : 0;
    const top = eps.slice().sort((x, y) => y.depth - x.depth).slice(0, 5);
    const longest = eps.reduce((m, e) => Math.max(m, e.sessions), 0);
    const under = ddS.filter(v => v > 0).length;
    return { cum: cumS, dd: ddS, ddPct, max: maxDD, maxPct: capital ? maxDD / capital * 100 : 0, cur, curPct: capital ? cur / capital * 100 : 0, episodes: eps, top, longest, underSessions: under };
  }

  const monthKey = d => d.slice(0, 7);
  const quarterKey = d => d.slice(0, 4) + '-Q' + (Math.floor((+d.slice(5, 7) - 1) / 3) + 1);
  const yearKey = d => d.slice(0, 4);

  function periodRows(dates, nets, capital, keyFn) {
    const keys = [], idx = {};
    dates.forEach((d, i) => { const k = keyFn(d); if (!(k in idx)) { idx[k] = []; keys.push(k); } idx[k].push(i); });
    return keys.map(k => {
      const ix = idx[k], n = ix.map(i => nets[i]), ds = ix.map(i => dates[i]);
      const net = sum(n), dd = drawdown(ds, n, capital);
      let bi = 0, wi = 0; n.forEach((v, j) => { if (v > n[bi]) bi = j; if (v < n[wi]) wi = j; });
      return { key: k, net, roi: capital ? net / capital * 100 : 0, days: n.length, winPct: n.length ? n.filter(v => v > 0).length / n.length * 100 : 0,
        best: { date: ds[bi], net: n[bi] }, worst: { date: ds[wi], net: n[wi] }, maxDD: dd.max, maxDDPct: dd.maxPct, ddSessions: dd.longest, from: ds[0], to: ds[ds.length - 1] };
    });
  }

  /* Full metrics for a daily series. days = [{date,net,gross,costs,trades}] */
  function metrics(days, capital) {
    const dates = days.map(d => d.date), nets = days.map(d => d.net);
    const dd = drawdown(dates, nets, capital);
    const total = sum(nets), tradingDays = days.filter(d => d.trades > 0);
    let best = null, worst = null;
    days.forEach(d => { if (!best || d.net > best.net) best = d; if (!worst || d.net < worst.net) worst = d; });
    const sd = std(nets);
    return {
      capital, total, gross: sum(days.map(d => d.gross)), costs: sum(days.map(d => d.costs)),
      roi: capital ? total / capital * 100 : 0, dd, sessions: days.length, tradingDays: tradingDays.length,
      winPct: tradingDays.length ? tradingDays.filter(d => d.net > 0).length / tradingDays.length * 100 : 0,
      sharpe: sd ? mean(nets) / sd * Math.sqrt(252) : 0, best, worst,
      monthly: periodRows(dates, nets, capital, monthKey), quarterly: periodRows(dates, nets, capital, quarterKey), yearly: periodRows(dates, nets, capital, yearKey),
      dates, nets
    };
  }

  /* Positions: legs with the same id are one position. */
  function positions(priced) {
    const m = new Map();
    priced.forEach(p => {
      const a = p.atom; let q = m.get(a.id);
      if (!q) { q = { id: a.id, d: a.d, x: a.x, t: a.t, xt: a.xt, g: a.g, dte: a.dte, xd: a.xd, why: a.why, net: 0, gross: 0, costs: 0, legs: 0 }; m.set(a.id, q); }
      q.net += p.net; q.gross += p.gross; q.costs += p.costs; q.legs++;
    });
    return Array.from(m.values()).sort((a, b) => (a.x < b.x ? -1 : a.x > b.x ? 1 : a.id < b.id ? -1 : 1));
  }

  function tradeStats(pos) {
    const n = pos.map(p => p.net), wins = n.filter(v => v > 0), loss = n.filter(v => v < 0);
    const aw = mean(wins), al = mean(loss), wr = n.length ? wins.length / n.length : 0;
    let mw = 0, ml = 0, cw = 0, cl = 0;
    n.forEach(v => { if (v > 0) { cw++; cl = 0; } else if (v < 0) { cl++; cw = 0; } else { cw = 0; cl = 0; } mw = Math.max(mw, cw); ml = Math.max(ml, cl); });
    const grp = (keyFn, order) => {
      const m = {}; pos.forEach(p => { const k = keyFn(p); (m[k] = m[k] || { key: k, n: 0, net: 0, wins: 0 }); m[k].n++; m[k].net += p.net; if (p.net > 0) m[k].wins++; });
      const arr = Object.values(m); if (order) arr.sort(order); return arr;
    };
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      count: n.length, winRate: wr * 100, avgWin: aw, avgLoss: al, expectancy: n.length ? mean(n) : 0,
      profitFactor: sum(loss) ? sum(wins) / Math.abs(sum(loss)) : null, maxWinStreak: mw, maxLossStreak: ml,
      bestTrade: n.length ? Math.max(...n) : 0, worstTrade: n.length ? Math.min(...n) : 0,
      byHour: grp(p => (p.t || '??').slice(0, 2) + ':00', (a, b) => (a.key < b.key ? -1 : 1)),
      byWeekday: grp(p => wd[new Date(p.d + 'T00:00:00Z').getUTCDay()], (a, b) => wd.indexOf(a.key) - wd.indexOf(b.key)),
      byDTE: grp(p => String(p.dte), (a, b) => +a.key - +b.key),
      byWhy: grp(p => p.why || 'n/a', (a, b) => b.n - a.n)
    };
  }

  /* Break-even slippage: the slippage % at which net falls to 0 (null if net <= 0 even at 0 slippage, or none below 5%). */
  function breakevenSlippage(atoms, cfg, k) {
    const f = s => { const c = JSON.parse(JSON.stringify(cfg || defaultCfg())); c.settings.slippage_pct = s; return sum(atoms.map(a => price(a, c, k).net)); };
    if (!atoms.length || f(0) <= 0) return null;
    if (f(5) > 0) return null;
    let lo = 0, hi = 5; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  /* Cost totals by line. */
  function costTotals(priced) {
    const t = { gross: 0, brk: 0, other: 0, stt: 0, exchange: 0, sebi: 0, stamp: 0, ipft: 0, gst: 0, costs: 0, net: 0, tb: 0, ts: 0 };
    priced.forEach(p => Object.keys(t).forEach(k => { t[k] += p[k]; }));
    t.turnover = t.tb + t.ts; return t;
  }

  /* Weighted-average actual STT/exchange rates (percent) for slider start positions. */
  function actualWeighted(priced) {
    const ts = sum(priced.map(p => p.ts)), turn = sum(priced.map(p => p.tb + p.ts));
    return { stt_pct: ts ? sum(priced.map(p => p.stt)) / ts * 100 : 0, exchange_pct: turn ? sum(priced.map(p => p.exchange)) / turn * 100 : 0 };
  }

  /* Combine selected reports: common sessions only; atoms taken from the first report that supplies each group. */
  function combineReports(reports, groups) {
    const common = reports.map(r => new Set(r.daily.map(d => d.date))).reduce((a, s) => new Set([...a].filter(x => s.has(x))));
    const sessions = reports[0].daily.map(d => d.date).filter(d => common.has(d));
    const used = {}, atoms = [], notes = [];
    reports.forEach(r => {
      const rg = new Set((r.trades || []).map(t => t.g)); const gs = groups.filter(g => rg.has(g) && !used[g]);
      gs.forEach(g => { used[g] = r.id; });
      (r.trades || []).forEach(t => { if (gs.includes(t.g) && common.has(t.x)) atoms.push(t); });
    });
    groups.forEach(g => { if (!used[g]) notes.push('No trade data for ' + g + ' in the selected reports.'); });
    return { sessions, atoms, used, notes };
  }

  return { CRORE, DEPLOYED, BOTH, PARAM_DEFAULTS, SETTING_KEYS, deployed, sizeK, nullSettings, defaultCfg, price, repriceAtoms,
    dailyFromPriced, drawdown, metrics, periodRows, monthKey, quarterKey, yearKey, positions, tradeStats, breakevenSlippage,
    costTotals, actualWeighted, combineReports, sum, mean, std, r2 };
});
