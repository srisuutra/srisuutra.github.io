/* SRISUUTRA ALGO TRADING - public site. Static, no build step, no server, no tokens.
 * Backtest reports: reports/index.json + reports/<id>/report.json (written by the GANITHAYYANTRA zip).
 * Live results:     live/live.json (written by local/daily_entry.html).
 */
(function () {
  'use strict';
  const E = window.GHE, C = window.GC, esc = C.esc, inr = C.inr, pc = C.pc, cls = C.cls;
  const LIVE_URL = 'live/live.json', INDEX_URL = 'reports/index.json';
  const GROUP_NAME = { NONDIRECTIONAL: 'Non-directional', DIRECTIONAL: 'Directional' };
  const gname = g => GROUP_NAME[g] || g;
  const $ = s => document.querySelector(s);
  const REP = {}; let INDEX = [], LIVE = null, LIVE_ERR = '', IDX_ERR = '';

  /* ---------- state + share code ---------- */
  const S = { tab: 'live', sel: [], groups: null, cap: null, cfg: E.defaultCfg(), view: 'net', per: 'monthly', pf: '', pt: '', lcap: null, lgroups: null, lper: 'monthly', lpf: '', lpt: '' };
  function decode() {
    try { const m = /[#&]s=([^&]+)/.exec(location.hash); if (!m) return; const o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      ['tab', 'sel', 'groups', 'cap', 'view', 'per', 'lcap', 'lgroups', 'lper'].forEach(k => { if (o[k] !== undefined) S[k] = o[k]; });
      if (o.cfg) { S.cfg.settings = Object.assign(E.nullSettings(), o.cfg.settings || {}); S.cfg.statutory_on = o.cfg.statutory_on !== false; S.cfg.orders_scale_with_size = o.cfg.orders_scale_with_size !== false; }
    } catch (e) { /* ignore bad share code */ }
  }
  function encode() {
    const o = { tab: S.tab, sel: S.sel, groups: S.groups, cap: S.cap, view: S.view, per: S.per, cfg: S.cfg, lcap: S.lcap, lgroups: S.lgroups, lper: S.lper };
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_');
  }
  function sync() { try { history.replaceState(null, '', '#s=' + encode()); } catch (e) { /* file:// */ } }
  function shareBtn() { return `<button class="sm" data-share>Copy share link</button>`; }

  /* ---------- loading ---------- */
  async function getJSON(u) { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(u + ' (' + r.status + ')'); return r.json(); }
  async function loadReport(id) {
    if (REP[id]) return REP[id];
    const ix = INDEX.find(x => x.id === id), r = await getJSON(ix ? ix.file : 'reports/' + id + '/report.json');
    if (r.format !== 'ganithayyantra-report' || r.version !== 1) throw new Error('Unsupported report format in ' + id);
    r.trades = r.trades || []; REP[id] = r; return r;
  }
  function loadScript(file, url) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/' + file;
      s.onload = res; s.onerror = () => { const t = document.createElement('script'); t.src = url; t.crossOrigin = 'anonymous'; t.onload = res; t.onerror = () => rej(new Error('Could not load ' + file)); document.head.appendChild(t); }; document.head.appendChild(s); });
  }
  const LIBS = {
    h2c: () => window.html2canvas ? 0 : loadScript('html2canvas.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
    pdf: () => window.jspdf ? 0 : loadScript('jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  };
  async function snap(el, name, asPdf) {
    await LIBS.h2c(); if (asPdf) await LIBS.pdf();
    const cv = await window.html2canvas(el, { scale: 2, backgroundColor: getComputedStyle(document.body).backgroundColor, ignoreElements: n => n.classList && n.classList.contains('noprint') });
    if (!asPdf) { const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = name + '.png'; a.click(); return; }
    const k = cv.width / el.offsetWidth, w = cv.width / k, h = cv.height / k, p = new window.jspdf.jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'px', format: [w, h] });
    p.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, w, h); p.save(name + '.pdf');
  }

  /* ---------- shared UI helpers ---------- */
  const badge = k => k === 'bt' ? '<span class="badge bt">BACKTEST (simulated)</span>' : k === 'lv' ? '<span class="badge lv">LIVE (owner-entered, net of charges)</span>' : '<span class="badge mix">INFO</span>';
  const kpi = (l, v, sub, c) => `<div class="kpi"><span>${esc(l)}</span><strong class="${c || ''}">${v}</strong><em>${sub || ''}</em></div>`;
  const fdate = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-';
  const mlabel = k => /^\d{4}-\d{2}$/.test(k) ? new Date(k + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : k;
  const ym = d => d.slice(0, 7);

  function chart(id, title, kind) { return `<div class="card"><h2>${esc(title)} ${badge(kind)}</h2><div id="${id}"></div></div>`; }

  function periodsHTML(prefix, kind) {
    return `<div class="card"><h2>Periods ${badge(kind)}</h2>
     <div class="row noprint"><div class="seg" id="${prefix}seg">${['monthly', 'quarterly', 'yearly', 'custom'].map(p => `<button data-per="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div>
     <span id="${prefix}cust" class="row" hidden><label>From</label><input type="date" id="${prefix}pf"><label>To</label><input type="date" id="${prefix}pt"></span></div>
     <div class="scroll" id="${prefix}tbl"></div></div>`;
  }
  function renderPeriods(prefix, m, per, pf, pt, capital) {
    const seg = $('#' + prefix + 'seg'); seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.per === per));
    $('#' + prefix + 'cust').hidden = per !== 'custom';
    let rows;
    if (per === 'custom') {
      const ix = m.dates.map((d, i) => i).filter(i => (!pf || m.dates[i] >= pf) && (!pt || m.dates[i] <= pt));
      rows = ix.length ? E.periodRows(ix.map(i => m.dates[i]), ix.map(i => m.nets[i]), capital, () => 'Custom range') : [];
    } else rows = per === 'monthly' ? m.monthly : per === 'quarterly' ? m.quarterly : m.yearly;
    $('#' + prefix + 'tbl').innerHTML = rows.length ? `<table class="t"><tr><th>Period</th><th>Net P&amp;L</th><th>ROI</th><th>Days</th><th>Win rate</th><th>Best day</th><th>Worst day</th><th>Max drawdown</th><th>Longest drawdown</th></tr>` +
      rows.map(r => `<tr><td>${esc(r.key)}</td><td class="${cls(r.net)}">${inr(r.net)}</td><td class="${cls(r.roi)}">${pc(r.roi)}</td><td>${r.days}</td><td>${r.winPct.toFixed(1)}%</td><td class="pos">${inr(r.best.net)}<br><small>${fdate(r.best.date)}</small></td><td class="neg">${inr(r.worst.net)}<br><small>${fdate(r.worst.date)}</small></td><td class="neg">${inr(-r.maxDD)} (${pc(-r.maxDDPct)})</td><td>${r.ddSessions} session${r.ddSessions === 1 ? '' : 's'}</td></tr>`).join('') + '</table>' : '<p class="sub">No sessions in this range.</p>';
  }
  function ddAnalyticsHTML(dd) {
    const t = dd.top; return `<p class="sub">Percent of the capital on the slider. Time under water = sessions below the last equity peak.</p>
     <div class="kpis">${kpi('Current drawdown', pc(-dd.curPct), inr(-dd.cur), dd.cur > 0 ? 'neg' : '')}${kpi('Maximum drawdown', pc(-dd.maxPct), inr(-dd.max), dd.max > 0 ? 'neg' : '')}${kpi('Longest drawdown', dd.longest + ' sessions', 'peak to new peak')}${kpi('Time under water', dd.underSessions + ' sessions', dd.cum.length ? (dd.underSessions / dd.cum.length * 100).toFixed(0) + '% of the period' : '')}</div>
     <h3>Top 5 drawdowns</h3>${t.length ? `<div class="scroll"><table class="t"><tr><th>#</th><th>Peak</th><th>Start</th><th>Trough</th><th>Depth</th><th>Depth %</th><th>To trough</th><th>Recovery</th></tr>` +
      t.map((e, i) => `<tr><td>${i + 1}</td><td>${fdate(e.peakDate)}</td><td>${fdate(e.start)}</td><td>${fdate(e.troughDate)}</td><td class="neg">${inr(-e.depth)}</td><td class="neg">${pc(-e.pct)}</td><td>${e.toTrough} sessions</td><td>${e.recovered ? fdate(e.end) + ' (' + e.sessions + ' sessions)' : '<b>not yet recovered</b>'}</td></tr>`).join('') + '</table></div>' : '<p class="sub">No drawdown in this period.</p>'}`;
  }
  function exportRow(prefix) { return `<span class="row noprint"><button class="sm" data-exp="csv" data-p="${prefix}">CSV</button><button class="sm" data-exp="png" data-p="${prefix}">PNG</button><button class="sm" data-exp="pdf" data-p="${prefix}">PDF</button>${shareBtn()}</span>`; }

  /* ================= BACKTEST ================= */
  let BT = null; // last model for exports
  function btModel() {
    const reps = S.sel.map(id => REP[id]).filter(Boolean); if (!reps.length) return null;
    const avail = [...new Set(reps.flatMap(r => r.strategies.map(s => s.id)))];
    const groups = avail.filter(g => !S.groups || S.groups.includes(g)); if (!groups.length) return { reps, avail, groups, empty: true };
    const extra = {}; reps.forEach(r => r.strategies.forEach(s => { extra[s.id] = s.capital; }));
    const dep = E.deployed(groups, extra), cap = Math.max(dep, S.cap || dep), k = E.sizeK(cap, dep);
    const comb = E.combineReports(reps, groups), hasT = comb.atoms.length > 0, notes = comb.notes.slice();
    let priced = [], days;
    if (hasT) { priced = E.repriceAtoms(comb.atoms, S.cfg, k); days = E.dailyFromPriced(comb.sessions, priced); }
    else { const m = {}; reps[0].daily.forEach(d => { m[d.date] = d; }); days = comb.sessions.map(d => ({ date: d, gross: m[d].gross * k, costs: m[d].costs * k, net: m[d].net * k, trades: m[d].trades }));
      notes.push('This report was exported without trade legs: size scaling works, but the Cost Lab and trade analytics are unavailable.'); }
    const m = E.metrics(days, cap), basis = (reps[0].summary || {}).drawdown_basis || 'daily';
    const pos = hasT ? E.positions(priced) : [];
    if (basis === 'trade' && pos.length) { m.dd = E.drawdown(pos.map(p => p.x), pos.map(p => p.net), cap); }
    return { reps, avail, groups, extra, dep, cap, k, comb, hasT, notes, priced, days, m, pos, basis };
  }

  function buildBT() {
    const el = $('#p_bt');
    if (IDX_ERR) { el.innerHTML = `<div class="card"><h2>Backtest reports</h2><div class="note warn">${esc(IDX_ERR)}</div></div>`; return; }
    if (!INDEX.length) { el.innerHTML = '<div class="card"><h2>Backtest reports</h2><p>No reports have been published yet.</p></div>'; return; }
    el.innerHTML = `
    <div class="card"><h2>Backtest ${badge('bt')} ${exportRow('bt')}</h2>
     <p class="sub">Simulated on historical data with modelled costs. Not live trading. Pick one or more reports; reports from different runs are combined on <b>common dates only</b>.</p>
     <div class="row" id="b_reports"></div>
     <div class="row" style="margin-top:8px"><b style="font-size:13px">Strategy groups</b><span id="b_groups" class="row"></span></div>
     <div class="note">Directional = the six logics, always together. <b>Call selling is bearish; put selling is bullish.</b> Per-logic detail is not published.</div>
     <div id="b_meta" class="sub"></div></div>
    <div id="b_body"></div>`;
    $('#b_reports').innerHTML = INDEX.map(x => `<span class="chip ${S.sel.includes(x.id) ? 'on' : ''}" data-rep="${esc(x.id)}" title="${esc(x.id)}">${esc(x.title)} <small>${esc(x.range.start)} to ${esc(x.range.end)}</small></span>`).join('');
  }

  async function renderBT() {
    if (!$('#b_reports')) buildBT(); if (IDX_ERR || !INDEX.length) return;
    for (const id of S.sel) { try { await loadReport(id); } catch (e) { $('#b_meta').innerHTML = `<span class="neg">${esc(e.message)}</span>`; } }
    document.querySelectorAll('#b_reports .chip').forEach(c => c.classList.toggle('on', S.sel.includes(c.dataset.rep)));
    const M = BT = btModel(), body = $('#b_body');
    if (!M) { $('#b_groups').innerHTML = ''; $('#b_meta').textContent = ''; body.innerHTML = '<div class="card"><p>Select a report above.</p></div>'; return; }
    $('#b_groups').innerHTML = M.avail.map(g => `<span class="chip ${M.groups.includes(g) ? 'on' : ''}" data-grp="${g}">${esc(gname(g))}</span>`).join('');
    $('#b_meta').innerHTML = M.reps.map(r => `<div><b>${esc(r.title)}</b> | ${fdate(r.range.start)} to ${fdate(r.range.end)} | generated ${esc(r.generated_at || '-')} | fingerprints: <span class="fp">${esc(Object.keys((r.provenance || {}).fingerprints || {}).length ? JSON.stringify(r.provenance.fingerprints) : 'none recorded')}</span></div>`).join('') + (M.reps.some(r => /SAMPLE|synthetic/i.test(r.title + (r.disclaimer || ''))) ? '<div class="note warn"><b>This is a synthetic sample report, not real results.</b></div>' : '');
    if (M.empty) { body.innerHTML = '<div class="card"><p>Select at least one strategy group.</p></div>'; return; }
    if (!body.dataset.built || body.dataset.sig !== S.sel.join('|') + '#' + M.groups.join('|')) { buildBTBody(M); body.dataset.built = 1; body.dataset.sig = S.sel.join('|') + '#' + M.groups.join('|'); }
    updateBT(M); sync();
  }

  const LAB = [ // key, label, min, max, step, unit
    ['slippage_pct', 'Slippage', 0, 0.5, 0.005, '%'], ['brokerage_per_order', 'Brokerage per order', 0, 60, 1, '₹'], ['brokerage_pct', 'Brokerage % of turnover', 0, 0.1, 0.001, '%'],
    ['stt_pct', 'STT (sell side)', 0, 0.3, 0.001, '%'], ['exchange_pct', 'Exchange charge', 0, 0.1, 0.0005, '%'], ['gst_pct', 'GST', 0, 28, 1, '%'],
    ['stamp_pct', 'Stamp duty (buy side)', 0, 0.02, 0.0005, '%'], ['sebi_per_crore', 'SEBI fee per crore', 0, 30, 1, '₹'], ['ipft_per_crore', 'IPFT per crore', 0, 1, 0.01, '₹'], ['other_per_order', 'Other per order', 0, 30, 1, '₹']
  ];

  function buildBTBody(M) {
    const slidersOn = M.hasT;
    $('#b_body').innerHTML = `
    <div class="card"><h2>Capital ${badge('bt')}</h2>
     <p class="sub">Size = floor(capital ÷ deployed). Deployed capital for this selection: <b>${inr(M.dep)}</b>. Between steps the extra capital sits idle, so ROI and drawdown (a % of the capital chosen here) are diluted.</p>
     <div class="cslide" style="grid-template-columns:90px 1fr 120px 90px"><span>Capital</span><input type="range" id="b_cap" min="${M.dep}" max="${M.dep * 5}" step="10000"><output id="b_capv"></output><span id="b_k"></span></div>
     <label><input type="checkbox" id="b_scale"> Orders scale with size (each set is its own orders). Untick for “one bigger order per leg”, where per-order brokerage does not scale.</label></div>
    <div class="kpis" id="b_kpis"></div>
    <div class="grid2">${chart('b_eq', 'Equity curve (cumulative P&L)', 'bt')}${chart('b_dd', 'Drawdown (% of capital)', 'bt')}</div>
    <div class="row noprint"><div class="seg" id="b_view"><button data-view="net">Net of costs</button><button data-view="gross">Gross (before costs)</button></div></div>
    <div class="grid2" style="margin-top:14px">${chart('b_mon', 'Monthly net P&L', 'bt')}<div class="card"><h2>P&amp;L calendar ${badge('bt')}</h2><div id="b_cal"></div></div></div>
    ${periodsHTML('b_', 'bt')}
    <div class="card"><h2>Drawdown analytics ${badge('bt')}</h2><div id="b_dda"></div></div>
    <div class="card" id="b_cmp_card"><h2>Compare groups ${badge('bt')}</h2><div id="b_cmp"></div></div>
    <div class="card"><h2>Trade analytics ${badge('bt')}</h2><div id="b_ta"></div></div>
    <div class="card"><h2>Cost Lab ${badge('bt')} <button class="sm noprint" id="b_reset">Reset to backtest</button></h2>
     <p class="sub">Costs are modelled. A slider left at <b>backtest</b> uses the backtest's own dated charges; moving it re-prices that line on a linear model. Cost sliders apply to backtests only; live results are real money.</p>
     ${slidersOn ? `<div id="b_lab"></div><div class="row"><label><input type="checkbox" id="b_stat"> Statutory charges on (STT, exchange, SEBI, stamp, IPFT)</label></div>` : '<div class="note warn">Not available: this report has no trade legs.</div>'}
     <div class="grid2" style="margin-top:10px"><div id="b_costtbl" class="scroll"></div><div><div id="b_costchart"></div><div id="b_be"></div></div></div></div>`;
    if (slidersOn) {
      $('#b_lab').innerHTML = LAB.map(([k, l, mn, mx, st, u]) => `<div class="cslide" data-k="${k}"><span>${l}</span><input type="range" min="${mn}" max="${mx}" step="${st}"><output></output><span class="act"><button class="sm" data-clr="${k}">actual</button></span></div>`).join('');
    }
  }

  function labStart(M, k) { const aw = E.actualWeighted(E.repriceAtoms(M.comb.atoms, E.defaultCfg(), 1)); return k === 'stt_pct' ? aw.stt_pct : k === 'exchange_pct' ? aw.exchange_pct : E.PARAM_DEFAULTS[k]; }

  function updateBT(M) {
    const m = M.m;
    $('#b_cap').value = M.cap; $('#b_capv').textContent = inr(M.cap); $('#b_k').textContent = M.k + '× size'; $('#b_scale').checked = S.cfg.orders_scale_with_size;
    $('#b_kpis').innerHTML = kpi('Net P&L', inr(m.total), pc(m.roi) + ' ROI on ' + inr(M.cap), cls(m.total)) + kpi('Max drawdown', pc(-m.dd.maxPct), inr(-m.dd.max) + ' | ' + M.basis + ' basis', 'neg') + kpi('Current drawdown', pc(-m.dd.curPct), inr(-m.dd.cur), m.dd.cur > 0 ? 'neg' : '') +
      kpi('Win days', m.winPct.toFixed(1) + '%', m.tradingDays + ' trading days / ' + m.sessions + ' sessions') + kpi('Sharpe (daily, ×√252)', m.sharpe.toFixed(2), 'on daily net') +
      kpi('Best day', inr(m.best ? m.best.net : 0), m.best ? fdate(m.best.date) : '', 'pos') + kpi('Worst day', inr(m.worst ? m.worst.net : 0), m.worst ? fdate(m.worst.date) : '', 'neg') + kpi('Costs', inr(m.costs), m.gross ? (m.costs / Math.abs(m.gross) * 100).toFixed(0) + '% of |gross|' : '');
    const gross = S.view === 'gross'; let cg = 0; const eqVals = gross ? M.days.map(d => (cg += d.gross)) : m.dd.cum;
    document.querySelectorAll('#b_view button').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
    C.line($('#b_eq'), { series: [{ name: gross ? 'Gross' : 'Net', color: (eqVals.length ? eqVals[eqVals.length - 1] : 0) >= 0 ? C.POS : C.NEG, vals: eqVals }], labels: m.dates, fmt: v => inr(v), title: 'Equity curve' });
    C.line($('#b_dd'), { series: [{ name: 'Drawdown', color: C.GOLD, vals: m.dd.ddPct.map(v => -v) }], labels: m.dates, fmt: v => v.toFixed(2) + '%', title: 'Drawdown' });
    C.bars($('#b_mon'), { labels: m.monthly.map(r => mlabel(r.key)), vals: m.monthly.map(r => r.net), fmt: v => inr(v), title: 'Monthly net' });
    C.calendar($('#b_cal'), m.dates, m.nets, M.cap);
    renderPeriods('b_', m, S.per, S.pf, S.pt, M.cap);
    $('#b_dda').innerHTML = ddAnalyticsHTML(m.dd);
    // compare groups
    if (M.groups.length > 1 && M.hasT) {
      const sess = M.days.map(d => d.date), per = M.groups.map(g => { const pr = M.priced.filter(p => p.g === g), d = E.dailyFromPriced(sess, pr), c = E.deployed([g], M.extra) * M.k, mm = E.metrics(d, c); return { g, d, mm, c }; });
      let h = `<div class="scroll"><table class="t"><tr><th>Group</th><th>Net P&amp;L</th><th>ROI (own capital)</th><th>Max drawdown</th><th>Win days</th><th>Losing days</th></tr>` +
        per.map(p => `<tr><td>${esc(gname(p.g))}</td><td class="${cls(p.mm.total)}">${inr(p.mm.total)}</td><td class="${cls(p.mm.roi)}">${pc(p.mm.roi)} <small>on ${inr(p.c)}</small></td><td class="neg">${pc(-p.mm.dd.maxPct)}</td><td>${p.mm.winPct.toFixed(1)}%</td><td>${p.d.filter(x => x.net < 0).length}</td></tr>`).join('') + '</table></div>';
      if (per.length === 2) { const a = per[0], b = per[1], la = a.d.map(x => x.net < 0), lb = b.d.map(x => x.net < 0), both = la.filter((v, i) => v && lb[i]).length, na = la.filter(Boolean).length, nb = lb.filter(Boolean).length;
        h += `<div class="note">${esc(gname(a.g))} lost on <b>${na}</b> days, ${esc(gname(b.g))} on <b>${nb}</b>. Both lost on the same day <b>${both}</b> times${na ? ` (${(both / na * 100).toFixed(0)}% of ${esc(gname(a.g))}'s losing days, ${nb ? (both / nb * 100).toFixed(0) : 0}% of ${esc(gname(b.g))}'s)` : ''}.</div>`; }
      h += `<p class="sub">Combined capital is ${inr(M.dep)} (margin offset), not the sum of the two.</p>`; $('#b_cmp').innerHTML = h; $('#b_cmp_card').hidden = false;
    } else $('#b_cmp_card').hidden = true;
    // trade analytics
    if (M.hasT) {
      const t = E.tradeStats(M.pos), tb = (rows, lab) => `<h3>${lab}</h3><table class="t"><tr><th>${lab.split(' ')[1] || ''}</th><th>Trades</th><th>Net</th><th>Win %</th></tr>` + rows.map(r => `<tr><td>${esc(r.key)}</td><td>${r.n}</td><td class="${cls(r.net)}">${inr(r.net)}</td><td>${(r.wins / r.n * 100).toFixed(0)}%</td></tr>`).join('') + '</table>';
      $('#b_ta').innerHTML = `<p class="sub">A trade = all legs sharing one id. Figures are net of the costs in the Cost Lab settings.</p><div class="kpis">${kpi('Trades', t.count)}${kpi('Win rate', t.winRate.toFixed(1) + '%')}${kpi('Average win', inr(t.avgWin), '', 'pos')}${kpi('Average loss', inr(t.avgLoss), '', 'neg')}${kpi('Expectancy / trade', inr(t.expectancy), '', cls(t.expectancy))}${kpi('Profit factor', t.profitFactor == null ? '-' : t.profitFactor.toFixed(2))}${kpi('Longest win / loss streak', t.maxWinStreak + ' / ' + t.maxLossStreak)}${kpi('Best / worst trade', inr(t.bestTrade) + ' / ' + inr(t.worstTrade))}</div>
       <div class="grid3"><div>${tb(t.byWeekday, 'By weekday')}</div><div>${tb(t.byDTE, 'By DTE (sessions to expiry)')}</div><div>${tb(t.byHour, 'By entry hour')}</div></div><div style="margin-top:10px">${tb(t.byWhy, 'By exit reason')}</div>
       <p class="sub">DTE = trading sessions to expiry (expiry day 0, session before 1, and so on); weekends and holidays are not counted. Taken from the report as given.</p>`;
    } else $('#b_ta').innerHTML = '<p class="sub">Not available: this report has no trade legs.</p>';
    // cost lab
    if (M.hasT) {
      document.querySelectorAll('#b_lab .cslide').forEach(r => {
        const k = r.dataset.k, inp = r.querySelector('input'), out = r.querySelector('output'), set = S.cfg.settings[k], v = set != null ? set : labStart(M, k), u = LAB.find(x => x[0] === k)[5];
        if (document.activeElement !== inp) inp.value = v; out.textContent = (set != null ? '' : 'backtest ') + (u === '₹' ? '₹' + (+v).toFixed(2) : (+v).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + '%'); out.style.color = set != null ? 'var(--ink)' : 'var(--mut)';
        r.querySelector('button').style.visibility = set != null ? 'visible' : 'hidden';
      });
      $('#b_stat').checked = S.cfg.statutory_on;
      const T = E.costTotals(M.priced), A = E.costTotals(E.repriceAtoms(M.comb.atoms, Object.assign(E.defaultCfg(), { orders_scale_with_size: S.cfg.orders_scale_with_size }), M.k)), line = (l, v, a) => `<tr><td>${l}</td><td>${inr(v, 2)}</td><td>${T.gross ? (v / Math.abs(T.gross) * 100).toFixed(1) + '%' : '-'}</td><td class="${cls(a - v)}">${inr(v - a, 2)}</td></tr>`;
      $('#b_costtbl').innerHTML = `<table class="t"><tr><th>Line</th><th>₹</th><th>% of |gross|</th><th>vs backtest</th></tr><tr><td><b>Gross</b></td><td>${inr(T.gross, 2)}</td><td></td><td>${inr(T.gross - A.gross, 2)}</td></tr>` +
        [['Brokerage', 'brk'], ['Other', 'other'], ['STT', 'stt'], ['Exchange', 'exchange'], ['SEBI', 'sebi'], ['Stamp', 'stamp'], ['IPFT', 'ipft'], ['GST', 'gst']].map(([l, k]) => line(l, T[k], A[k])).join('') +
        `<tr class="hl"><td><b>Total costs</b></td><td>${inr(T.costs, 2)}</td><td>${T.gross ? (T.costs / Math.abs(T.gross) * 100).toFixed(1) + '%' : '-'}</td><td>${inr(T.costs - A.costs, 2)}</td></tr><tr class="hl"><td><b>Net</b></td><td class="${cls(T.net)}">${inr(T.net, 2)}</td><td></td><td>${inr(T.net - A.net, 2)}</td></tr></table><p class="sub">Turnover ${inr(T.turnover)}. “vs backtest” = this setting minus the backtest's own figure.</p>`;
      let cc = 0; C.line($('#b_costchart'), { series: [{ name: 'Cumulative costs ("drag")', color: C.NEG, vals: M.days.map(d => (cc += d.costs)), area: true }], labels: m.dates, fmt: v => inr(v), title: 'Cumulative cost drag', height: 190 });
      const be = E.breakevenSlippage(M.comb.atoms, S.cfg, M.k);
      $('#b_be').innerHTML = `<div class="note">Break-even slippage: ${be == null ? (T.net > 0 ? '<b>above 5%</b>' : '<b>none</b> (net is not positive even with zero slippage on these settings)') : '<b>' + be.toFixed(3) + '%</b> per side (net falls to zero)'}.</div>`;
    }
  }

  /* ================= LIVE ================= */
  let LM = null;
  function liveModel() {
    if (!LIVE) return null;
    const strat = LIVE.strategies || [], ids = strat.map(s => s.id), groups = ids.filter(g => !S.lgroups || S.lgroups.includes(g)); if (!groups.length) return { empty: true, strat, ids, groups };
    const extra = {}; strat.forEach(s => { extra[s.id] = s.capital; });
    const dep = E.deployed(groups, extra) || strat.filter(s => groups.includes(s.id)).reduce((t, s) => t + s.capital, 0), cap = Math.max(dep, S.lcap || dep), k = E.sizeK(cap, dep);
    const dates = Object.keys(LIVE.days).sort(), asof = LIVE.asof && dates.includes(LIVE.asof) ? LIVE.asof : dates[dates.length - 1];
    const ds = dates.filter(d => d <= asof), val = (d, g) => { const v = (LIVE.days[d] || {})[g]; return v == null || v === '' ? null : +v; };
    const per = groups.map(g => { const nets = ds.map(d => (val(d, g) || 0) * k), c = E.deployed([g], extra) * k || (extra[g] || 0) * k; return { g, nets, c, m: E.metrics(ds.map((d, i) => ({ date: d, net: nets[i], gross: nets[i], costs: 0, trades: val(d, g) != null ? 1 : 0 })), c) }; });
    const tn = ds.map((d, i) => per.reduce((t, p) => t + p.nets[i], 0)), tdays = ds.map((d, i) => ({ date: d, net: tn[i], gross: tn[i], costs: 0, trades: groups.some(g => val(d, g) != null) ? 1 : 0 })), tm = E.metrics(tdays, cap);
    return { strat, ids, groups, extra, dep, cap, k, ds, asof, per, tm, tn, val };
  }
  function slice(m, asof, kind) { // today / month / ytd net for metrics m
    const s = f => m.dates.reduce((t, d, i) => t + (f(d) ? m.nets[i] : 0), 0);
    return kind === 'day' ? s(d => d === asof) : kind === 'mo' ? s(d => ym(d) === ym(asof)) : s(d => d.slice(0, 4) === asof.slice(0, 4));
  }

  function renderLive() {
    const el = $('#p_live');
    if (!LIVE) { el.innerHTML = `<div class="card"><h2>Live results ${badge('lv')}</h2><p>${LIVE_ERR ? 'Live results could not be loaded: ' + esc(LIVE_ERR) : 'No live results have been published yet.'}</p><p class="sub">Live results start on their real start date. Nothing is back-filled.</p></div>`; return; }
    const M = LM = liveModel();
    if (!el.dataset.built) {
      el.dataset.built = 1;
      el.innerHTML = `<div class="card"><h2>Daily P&amp;L report ${badge('lv')} ${exportRow('lv')}</h2><p class="sub" id="l_meta"></p><div class="row"><b style="font-size:13px">Strategy groups</b><span id="l_groups" class="row"></span></div></div>
       <div class="card"><h2>Capital ${badge('lv')}</h2><p class="sub">Live P&amp;L is entered at 1× and scaled by size = floor(capital ÷ deployed). ROI and drawdown are a % of the capital chosen here. Cost sliders do <b>not</b> apply to live results: they are real, net of charges.</p>
        <div class="cslide" style="grid-template-columns:90px 1fr 120px 90px"><span>Capital</span><input type="range" id="l_cap" step="10000"><output id="l_capv"></output><span id="l_k"></span></div></div>
       <div class="kpis" id="l_kpis"></div><div class="card"><h2>Report ${badge('lv')}</h2><div class="scroll" id="l_rpt"></div></div>
       <div class="card" id="l_tgt" hidden><h2>Monthly target ${badge('lv')}</h2><div id="l_tgtb"></div></div>
       <div class="grid2">${chart('l_eq', 'Cumulative return (% of capital)', 'lv')}${chart('l_dd', 'Drawdown (% of capital)', 'lv')}</div>
       <div class="grid2" style="margin-top:14px">${chart('l_mon', 'Monthly net P&L', 'lv')}<div class="card"><h2>P&amp;L calendar ${badge('lv')}</h2><div id="l_cal"></div></div></div>
       ${periodsHTML('l_', 'lv')}<div class="card"><h2>Drawdown analytics ${badge('lv')}</h2><div id="l_dda"></div></div>
       <div class="card" id="l_corr"></div><div class="card" id="l_extra"></div>`;
    }
    if (M.empty) { $('#l_meta').textContent = 'Select at least one strategy group.'; }
    $('#l_groups').innerHTML = M.ids.map(g => { const s = M.strat.find(x => x.id === g); return `<span class="chip ${M.groups.includes(g) ? 'on' : ''}" data-lgrp="${g}">${esc(s.name || gname(g))}${s.retired ? ' (retired)' : ''}</span>`; }).join('');
    if (M.empty) return;
    const T = M.tm, a = M.asof;
    $('#l_meta').innerHTML = `As of <b>${fdate(a)}</b> | ${M.strat.filter(s => M.groups.includes(s.id)).map(s => esc(s.name) + ' since ' + fdate(s.started) + (s.retired ? ' (retired ' + fdate(s.retired_on) + ')' : '')).join(', ')}. Entries are net P&amp;L as shown by the broker, charges already deducted. Not audited.`;
    const cp = $('#l_cap'); cp.min = M.dep; cp.max = M.dep * 5; cp.value = M.cap; $('#l_capv').textContent = inr(M.cap); $('#l_k').textContent = M.k + '× size';
    const day = slice(T, a, 'day'), mo = slice(T, a, 'mo'), yr = slice(T, a, 'yr');
    $('#l_kpis').innerHTML = kpi('Capital deployed', inr(M.cap), M.groups.map(gname).join(' + ')) + kpi('Today', inr(day), pc(day / M.cap * 100), cls(day)) + kpi(new Date(a + 'T00:00:00Z').toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' }), inr(mo), pc(mo / M.cap * 100), cls(mo)) + kpi('Year to date', inr(yr), pc(yr / M.cap * 100), cls(yr)) + kpi('Max drawdown', pc(-T.dd.maxPct), inr(-T.dd.max), 'neg') + kpi('Win days', T.winPct.toFixed(1) + '%', T.tradingDays + ' days entered');
    const rows = [['Today P&L', m => slice(m, a, 'day'), inr], ['Today ROI', (m, c) => slice(m, a, 'day') / c * 100, pc], ['Month P&L', m => slice(m, a, 'mo'), inr], ['Month ROI', (m, c) => slice(m, a, 'mo') / c * 100, pc], ['YTD P&L', m => slice(m, a, 'yr'), inr], ['YTD ROI', (m, c) => slice(m, a, 'yr') / c * 100, pc], ['All-time P&L', m => m.total, inr], ['Current drawdown ₹', m => -m.dd.cur, inr], ['Current drawdown %', m => -m.dd.curPct, pc], ['Max drawdown ₹', m => -m.dd.max, inr], ['Max drawdown %', m => -m.dd.maxPct, pc]];
    $('#l_rpt').innerHTML = `<table class="t"><tr><th>Metric</th>${M.per.map(p => `<th>${esc((M.strat.find(s => s.id === p.g) || {}).name || p.g)}</th>`).join('')}<th class="ct">CUMULATIVE</th></tr>` +
      rows.map((r, i) => `<tr class="${i < 2 ? 'hl' : ''}"><td>${r[0]}</td>${M.per.map(p => { const v = r[1](p.m, p.c); return `<td class="${cls(v)}">${r[2](v)}</td>`; }).join('')}${(() => { const v = r[1](T, M.cap); return `<td class="ct ${cls(v)}">${r[2](v)}</td>`; })()}</tr>`).join('') +
      `</table><p class="sub">Each strategy column uses its own deployed capital × size; the cumulative column uses the capital chosen above. Drawdown = fall from the highest cumulative P&amp;L, as a % of capital.</p>`;
    const tgt = (LIVE.settings || {}).monthly_target; $('#l_tgt').hidden = !(tgt > 0);
    if (tgt > 0) { const t = tgt * M.k, p = Math.max(0, Math.min(100, mo / t * 100)); $('#l_tgtb').innerHTML = `<div class="prog"><i style="width:${p}%"></i></div><p class="sub">${inr(mo)} of a ${inr(t)} monthly target (${(mo / t * 100).toFixed(0)}%). The target is the owner's own goal, not a forecast.</p>`; }
    let cum = 0; C.line($('#l_eq'), { series: [{ name: 'Cumulative return', color: T.total >= 0 ? C.POS : C.NEG, vals: T.nets.map(v => (cum += v) / M.cap * 100) }], labels: T.dates, fmt: v => v.toFixed(2) + '%', title: 'Cumulative return' });
    C.line($('#l_dd'), { series: [{ name: 'Drawdown', color: C.GOLD, vals: T.dd.ddPct.map(v => -v) }], labels: T.dates, fmt: v => v.toFixed(2) + '%', title: 'Drawdown' });
    C.bars($('#l_mon'), { labels: T.monthly.map(r => mlabel(r.key)), vals: T.monthly.map(r => r.net), fmt: v => inr(v), title: 'Monthly net' });
    C.calendar($('#l_cal'), T.dates, T.nets, M.cap); renderPeriods('l_', T, S.lper, S.lpf, S.lpt, M.cap); $('#l_dda').innerHTML = ddAnalyticsHTML(T.dd);
    const cl = LIVE.corrections || [];
    $('#l_corr').innerHTML = `<h2>Corrections log ${badge('lv')}</h2><p class="sub">Past days must not change silently. Every correction to an entered figure is listed here.</p>` + (cl.length ? `<div class="scroll"><table class="t"><tr><th>Date</th><th>Strategy</th><th>Old</th><th>New</th><th>Reason</th><th>Recorded</th></tr>` + cl.map(c => `<tr><td>${esc(c.date)}</td><td>${esc(gname(c.strategy))}</td><td>${inr(c.old, 2)}</td><td>${inr(c.new, 2)}</td><td style="white-space:normal;text-align:left">${esc(c.reason || '')}</td><td>${esc(c.at || '')}</td></tr>`).join('') + '</table></div>' : '<p>No corrections have been made.</p>');
    const notes = LIVE.notes || [], links = LIVE.links || [];
    $('#l_extra').innerHTML = (notes.length ? `<h2>Notes</h2>${notes.map(n => `<div class="note">${esc(n)}</div>`).join('')}` : '') + (links.length ? `<h2>Links</h2>${links.map(l => /^https?:\/\//i.test(l.url) ? `<div><a href="${esc(l.url)}" rel="noopener noreferrer" target="_blank">${esc(l.label)}</a></div>` : '').join('')}` : '') || ''; sync();
  }

  /* ================= ABOUT ================= */
  function renderAbout() {
    const rs = Object.values(REP);
    $('#p_about').innerHTML = `
    <div class="card"><h2>How the numbers are made</h2><ul>
     <li><b>Backtest vs live.</b> Backtests are simulated on historical data. Live results are entered by hand by the owner, net of charges. They are always shown separately and never joined into one curve.</li>
     <li><b>Size and capital.</b> Non-directional (SIDDHI, a short strangle) trades 195 units per leg; each directional logic trades 65 units, the same in every year. Deployed capital: non-directional ${inr(400000)}, directional ${inr(100000)}, both together ${inr(400000)} (margin offset), not ${inr(500000)}. Size = floor(capital ÷ deployed).</li>
     <li><b>ROI and drawdown</b> are a % of the capital on the slider. Idle capital between size steps dilutes ROI. Drawdown is the fall from the highest cumulative P&amp;L, measured daily for intraday strategies (per trade for positional).</li>
     <li><b>Combining reports</b> from different runs uses common dates only; costs are summed.</li>
     <li><b>DTE</b> = trading sessions to expiry: expiry day 0, the session before 1; weekends and holidays are not counted.</li>
     <li><b>Sharpe</b> = mean daily net ÷ standard deviation of daily net × √252.</li></ul></div>
    <div class="card"><h2>Cost assumptions ${badge('bt')}</h2><p class="sub">NSE index options, charged on premium, by date. Backtest costs are modelled.</p><div class="scroll"><table class="t">
     <tr><th>Charge</th><th>Rate history</th></tr>
     <tr><td>STT (sell side)</td><td style="white-space:normal;text-align:left">0.05% → 0.0625% (1 Apr 2023) → 0.10% (1 Oct 2024) → 0.15% (1 Apr 2026)</td></tr>
     <tr><td>Exchange charge (both sides)</td><td style="white-space:normal;text-align:left">0.053% → 0.05% (1 Apr 2023) → 0.0495% (1 Apr 2024) → 0.03503% (1 Oct 2024)</td></tr>
     <tr><td>Stamp duty (buy side)</td><td>0.003%</td></tr><tr><td>SEBI fee</td><td>₹10 per crore of turnover</td></tr><tr><td>IPFT</td><td>₹0.01 per crore of turnover</td></tr>
     <tr><td>GST</td><td>18% on (brokerage + exchange + SEBI + IPFT)</td></tr><tr><td>Brokerage</td><td>₹20 per order</td></tr><tr><td>Slippage</td><td>0.02% (modelled; the backtest applies its own tick rounding)</td></tr></table></div></div>
    <div class="card"><h2>Loaded reports</h2>${rs.length ? rs.map(r => `<p><b>${esc(r.title)}</b> (${esc(r.id)})<br>Range ${fdate(r.range.start)} to ${fdate(r.range.end)} | generated ${esc(r.generated_at || '-')}<br>Fingerprints: <span class="fp">${esc(JSON.stringify((r.provenance || {}).fingerprints || {}))}</span><br><small>${esc(r.disclaimer || '')}</small></p>`).join('') : '<p class="sub">Open the Backtest tab and choose a report to list its provenance here.</p>'}</div>
    <div class="card"><h2>Important</h2><p>This website is for information only. It is not investment advice, research, or an offer or solicitation to buy or sell anything, and no strategy is offered for sale or subscription. Past performance, simulated or live, does not guarantee future results. Options trading carries a high risk of loss. Results shown may be unaudited and costs are modelled for backtests.</p></div>`;
  }

  /* ================= tabs + events ================= */
  function show(t) {
    S.tab = t; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    ['live', 'bt', 'about'].forEach(x => { $('#p_' + x).hidden = x !== t; });
    if (t === 'bt') renderBT(); else if (t === 'live') renderLive(); else renderAbout(); sync();
  }
  function exportCSV(prefix) {
    if (prefix === 'bt' && BT && !BT.empty) { const m = BT.m; C.download('srisuutra_backtest_daily.csv', C.csv([['date', 'gross', 'costs', 'net', 'cumulative_net', 'drawdown_pct_of_capital', 'label'], ...m.dates.map((d, i) => [d, BT.days[i].gross.toFixed(2), BT.days[i].costs.toFixed(2), BT.days[i].net.toFixed(2), m.dd.cum[i].toFixed(2), (-m.dd.ddPct[i]).toFixed(4), 'BACKTEST'])]));
      C.download('srisuutra_backtest_monthly.csv', C.csv([['month', 'net', 'roi_pct', 'label'], ...m.monthly.map(r => [r.key, r.net.toFixed(2), r.roi.toFixed(4), 'BACKTEST'])])); }
    if (prefix === 'lv' && LM && !LM.empty) { const T = LM.tm; C.download('srisuutra_live_daily.csv', C.csv([['date', ...LM.groups, 'total', 'cumulative', 'drawdown_pct_of_capital', 'label'], ...T.dates.map((d, i) => [d, ...LM.per.map(p => p.nets[i].toFixed(2)), T.nets[i].toFixed(2), T.dd.cum[i].toFixed(2), (-T.dd.ddPct[i]).toFixed(4), 'LIVE'])])); }
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('button,.chip,a'); if (!t) return;
    if (t.dataset.t) return show(t.dataset.t);
    if (t.dataset.rep) { const id = t.dataset.rep, i = S.sel.indexOf(id); if (i >= 0) S.sel.splice(i, 1); else S.sel.push(id); S.groups = null; S.cap = null; $('#b_body').dataset.sig = ''; return renderBT(); }
    if (t.dataset.grp) { const all = BT ? BT.avail : []; let g = S.groups ? S.groups.slice() : all.slice(); const i = g.indexOf(t.dataset.grp); if (i >= 0) g.splice(i, 1); else g.push(t.dataset.grp); S.groups = g; S.cap = null; return renderBT(); }
    if (t.dataset.lgrp) { const all = LM ? LM.ids : []; let g = S.lgroups ? S.lgroups.slice() : all.slice(); const i = g.indexOf(t.dataset.lgrp); if (i >= 0) g.splice(i, 1); else g.push(t.dataset.lgrp); S.lgroups = g; S.lcap = null; return renderLive(); }
    if (t.dataset.view) { S.view = t.dataset.view; return BT && updateBT(BT); }
    if (t.dataset.per) { const live = t.closest('#l_seg'); if (live) S.lper = t.dataset.per; else S.per = t.dataset.per; return live ? renderLive() : BT && updateBT(BT); }
    if (t.dataset.clr) { S.cfg.settings[t.dataset.clr] = null; return renderBT(); }
    if (t.id === 'b_reset') { S.cfg = E.defaultCfg(); return renderBT(); }
    if (t.dataset.share !== undefined) { sync(); (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(() => { t.textContent = 'Link copied'; setTimeout(() => t.textContent = 'Copy share link', 1500); }, () => prompt('Copy this link', location.href)); return; }
    if (t.dataset.exp) { const p = t.dataset.p, root = $(p === 'bt' ? '#p_bt' : '#p_live'); if (t.dataset.exp === 'csv') return exportCSV(p); return snap(root, 'srisuutra_' + (p === 'bt' ? 'backtest' : 'live'), t.dataset.exp === 'pdf').catch(err => alert(err.message)); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'b_cap') { S.cap = +t.value; renderBT(); }
    else if (t.id === 'l_cap') { S.lcap = +t.value; renderLive(); }
    else if (t.id === 'b_scale') { S.cfg.orders_scale_with_size = t.checked; BT && renderBT(); }
    else if (t.id === 'b_stat') { S.cfg.statutory_on = t.checked; BT && renderBT(); }
    else if (t.closest && t.closest('#b_lab') && t.type === 'range') { S.cfg.settings[t.closest('.cslide').dataset.k] = +t.value; renderBT(); }
    else if (/^(b_|l_)p[ft]$/.test(t.id)) { const live = t.id[0] === 'l'; if (live) { S[t.id === 'l_pf' ? 'lpf' : 'lpt'] = t.value; renderLive(); } else { S[t.id === 'b_pf' ? 'pf' : 'pt'] = t.value; BT && updateBT(BT); } }
  });

  /* ---------- gate + boot ---------- */
  function gate() {
    let ok = false; try { ok = localStorage.getItem('ghs_agreed') === '1'; } catch (e) { /* ignore */ }
    if (ok) return; $('#gate').style.display = 'flex';
    $('#agree').onclick = () => { try { localStorage.setItem('ghs_agreed', '1'); } catch (e) { /* ignore */ } $('#gate').style.display = 'none'; };
  }
  async function boot() {
    decode(); gate();
    document.addEventListener('click', e => { if (e.target.id === 'reopen') { e.preventDefault(); $('#gate').style.display = 'flex'; $('#agree').onclick = () => { $('#gate').style.display = 'none'; }; } });
    $('#foot').innerHTML = '© SRISUUTRA ALGO TRADING. Information and education only; not investment advice or an offer to buy or sell. Backtest results are simulated; live results are owner-entered and unaudited. Past performance does not guarantee future results. Options trading carries a high risk of loss. <a href="#" id="reopen">Read the full disclaimer</a>';
    try { INDEX = await getJSON(INDEX_URL); if (!Array.isArray(INDEX)) throw new Error('index.json must be a list'); } catch (e) { IDX_ERR = 'The report list could not be loaded (' + e.message + '). If you opened this file directly from disk, serve it over http (GitHub Pages does this automatically).'; }
    try { LIVE = await getJSON(LIVE_URL); if (LIVE.format !== 'ganithayyantra-live' || LIVE.version !== 1) throw new Error('unsupported live.json format'); } catch (e) { LIVE = null; LIVE_ERR = /404/.test(e.message) ? '' : e.message; }
    if (!S.sel.length && INDEX.length) S.sel = [INDEX[0].id];
    S.sel = S.sel.filter(id => INDEX.some(x => x.id === id));
    if (S.tab === 'live' && !LIVE && INDEX.length) S.tab = 'bt';
    show(S.tab);
  }
  // Period selector for the live tab needs its own id; renderPeriods builds ids from the prefix ('l_seg').
  boot();
})();
