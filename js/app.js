/* SRISUUTRA ALGO TRADING - public site. Static, no build step, no server, no tokens.
 * Backtest reports: reports/index.json + reports/<id>/report.json (written by the GANITHAYYANTRA zip).
 * Live results:     live/data.json (written by local/daily_entry.html, 'Export website data').
 */
(function () {
  'use strict';
  const E = window.GHE, C = window.GC, esc = C.esc, inr = C.inr, pc = C.pc, cls = C.cls;
  const LIVE_URLS = ['live/data.json', 'live/live.json', 'data.json'], INDEX_URL = 'reports/index.json';
  const GROUP_NAME = { NONDIRECTIONAL: 'Non-directional', DIRECTIONAL: 'Directional' };
  const gname = g => GROUP_NAME[g] || g;
  const $ = s => document.querySelector(s);
  const REP = {}; let INDEX = [], LIVE = null, LIVE_ERR = '', IDX_ERR = '';

  /* ---------- state + share code ---------- */
  const BT_TABS = ['strategy', 'trade', 'cost'], LEGACY = ['monthly', 'combined', 'compare', 'drawdown', 'combos', 'bt'], TABS = ['live', ...BT_TABS, 'share', 'about'];
  const S = { tab: 'live', sel: [], groups: null, cap: null, cfg: E.defaultCfg(), view: 'net', per: 'monthly', pf: '', pt: '', lcap: null, lgroups: null, lper: 'monthly', lpf: '', lpt: '' };
  function decode() {
    try { const m = /[#&]s=([^&]+)/.exec(location.hash); if (!m) return false; const o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      ['tab', 'sel', 'groups', 'cap', 'view', 'per', 'lcap', 'lgroups', 'lper'].forEach(k => { if (o[k] !== undefined) S[k] = o[k]; });
      if (o.cfg) { S.cfg.settings = Object.assign(E.nullSettings(), o.cfg.settings || {}); S.cfg.statutory_on = o.cfg.statutory_on !== false; S.cfg.orders_scale_with_size = o.cfg.orders_scale_with_size !== false; }
      if (LEGACY.includes(S.tab)) S.tab = 'strategy'; if (!TABS.includes(S.tab)) S.tab = 'live'; return true;
    } catch (e) { return false; }
  }
  function encode() {
    const o = { tab: S.tab, sel: S.sel, groups: S.groups, cap: S.cap, view: S.view, per: S.per, cfg: S.cfg, lcap: S.lcap, lgroups: S.lgroups, lper: S.lper };
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_');
  }
  function sync() { try { history.replaceState(null, '', '#s=' + encode()); } catch (e) { /* file:// */ } }
  function shareBtn() { return `<button class="sm" data-share>Copy share link</button>`; }

  /* ---------- live file: accepts the entry tool's data.json (v1) or the older ganithayyantra-live file ---------- */
  function asLive(j) {
    if (!j || typeof j !== 'object') return null;
    if (Array.isArray(j.strat) && j.days) return j;
    if (j.format === 'ganithayyantra-live' && Array.isArray(j.strategies) && j.days) return { v: 1, title: j.title || 'SRISUUTRA LIVE', sub: '', asof: j.asof, cumOn: true, cumCap: '', strat: j.strategies.map(x => ({ id: x.id, name: x.name || x.id, cap: x.capital, mult: 1, ex: '', code: '' })), days: j.days, links: j.links || [], notes: j.notes || [] };
    return null;
  }
  /* If the usual files are missing or empty, look through the public repo (one GitHub API call) for any report / live json that was put in the wrong place. */
  let DIAG = '';
  async function discover() {
    let repo = ''; try { repo = (await getJSON('config.json')).repo || ''; } catch (e) { /* optional */ }
    const host = location.hostname;
    if (!repo && /\.github\.io$/.test(host)) { const o = host.split('.')[0], first = location.pathname.split('/')[1]; repo = first && first !== 'index.html' ? o + '/' + first : o + '/' + host; }
    if (!repo) return;
    let paths = null;
    for (const br of ['main', 'master']) { try { const j = await getJSON('https://api.github.com/repos/' + repo + '/git/trees/' + br + '?recursive=1'); paths = j.tree.filter(x => x.type === 'blob').map(x => x.path); break; } catch (e) { /* try next */ } }
    if (!paths) return;
    const js = paths.filter(x => /\.(json|txt)$/i.test(x) && !/(^|\/)(config|package|package-lock|index)\.json$/i.test(x) && !/^(vendor|tests|tools|node_modules)\//.test(x)).slice(0, 40);
    const known = /^(assets|css|js|vendor|tests|tools|local)\/|^(index\.html|README\.md|PUBLISHING\.md|config\.json|\.gitignore|\.nojekyll)$|\.gitkeep$|(^|\/)index\.json$/;
    DIAG = js.length ? 'Data files found in the repository: ' + js.join(', ') : 'No data files were found in the repository. Files that are there: ' + (paths.filter(x => !known.test(x)).slice(0, 30).join(', ') || '(only the site files; nothing was added to live/ or reports/)');
    for (const f of js) {
      try {
        const j = await getJSON(f);
        if (j && j.format === 'ganithayyantra-report' && j.version === 1 && !INDEX.some(x => x.id === (j.id || f))) {
          const id = j.id || f; INDEX.push({ id, title: j.title || id, range: j.range || { start: '', end: '' }, strategies: (j.strategies || []).map(x => x.id), file: f }); j.trades = (j.trades || []).map(normWhy); REP[id] = j;
        } else if (!LIVE) { const l = asLive(j); if (l) { LIVE = l; LIVE_ERR = ''; } }
      } catch (e) { /* not a usable file */ }
    }
    if (INDEX.length) IDX_ERR = '';
  }

  /* ---------- loading ---------- */
  async function getJSON(u) { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(u + ' (' + r.status + ')'); return r.json(); }
  /* Exit reasons are shown as broad categories only; the exact rules and thresholds are not published. */
  function normWhy(t) {
    const w = String(t.why || ''); t.why = /time exit/i.test(w) ? 'Time exit' : /mtm/i.test(w) ? 'MTM drawdown exit' : /hedge/i.test(w) ? 'Hedge exit' : /stop/i.test(w) ? 'Stop-loss exit' : /rapid|imbalance/i.test(w) ? 'Market-move exit' : w ? 'Other exit' : 'Unspecified'; return t;
  }
  async function loadReport(id) {
    if (REP[id]) return REP[id];
    const ix = INDEX.find(x => x.id === id), r = await getJSON(ix ? ix.file : 'reports/' + id + '/report.json');
    if (r.format !== 'ganithayyantra-report' || r.version !== 1) throw new Error('Unsupported report format in ' + id);
    r.trades = (r.trades || []).map(normWhy); REP[id] = r; return r;
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
    if (!INDEX.length) { el.innerHTML = '<div class="card"><h2>Backtest reports</h2><p>No reports have been published yet.</p>' + (DIAG ? '<p class="sub">' + esc(DIAG) + '. Each report must be a <b>report.json</b> file from the backtest tool.</p>' : '') + '</div>'; return; }
    el.innerHTML = `
    <div class="card"><h2>Backtest ${badge('bt')} ${exportRow('bt')}</h2>
     <p class="sub">Simulated on historical data with modelled costs. Not live trading. Pick one or more reports; reports from different runs are combined on <b>common dates only</b>.</p>
     <div class="row" id="b_reports"></div>
     <div class="row" style="margin-top:8px"><b style="font-size:13px">Strategy groups</b><span id="b_groups" class="row"></span></div>
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
    $('#b_meta').innerHTML = M.reps.map(r => `<div><b>${esc(r.title)}</b> | ${fdate(r.range.start)} to ${fdate(r.range.end)} | generated ${esc(r.generated_at || '-')} | source files fingerprinted: ${Object.keys((r.provenance || {}).fingerprints || {}).length || 'none recorded'}</div>`).join('') + (M.reps.some(r => /SAMPLE|synthetic/i.test(r.title + (r.disclaimer || ''))) ? '<div class="note warn"><b>This is a synthetic sample report, not real results.</b></div>' : '');
    if (M.empty) { body.innerHTML = '<div class="card"><p>Select at least one strategy group.</p></div>'; return; }
    if (!body.dataset.built || body.dataset.sig !== S.sel.join('|') + '#' + M.groups.join('|')) { buildBTBody(M); body.dataset.built = 1; body.dataset.sig = S.sel.join('|') + '#' + M.groups.join('|'); }
    updateBT(M); applyView(); sync();
  }

  function applyView() { document.querySelectorAll('#p_bt [data-sec]').forEach(e => e.classList.toggle('vh', !e.dataset.sec.split(' ').includes(S.tab))); }

  /* ---------- Combos: every report x group combination, ranked ---------- */
  let COMBOS = null, CSORT = 'rd';
  function comboModel(reps, groups) {
    const extra = {}; reps.forEach(r => r.strategies.forEach(s => { extra[s.id] = s.capital; }));
    const dep = E.deployed(groups, extra); if (!dep) return null;
    const comb = E.combineReports(reps, groups); let days;
    if (comb.atoms.length) days = E.dailyFromPriced(comb.sessions, E.repriceAtoms(comb.atoms, E.defaultCfg(), 1));
    else if (reps.length === 1) days = reps[0].daily.filter(d => comb.sessions.includes(d.date)); else return null;
    if (!days.length) return null; const m = E.metrics(days, dep);
    return { net: m.total, roi: m.roi, dd: m.dd.maxPct, rd: m.dd.maxPct > 0 ? m.roi / m.dd.maxPct : 0, win: m.winPct, sharpe: m.sharpe, n: m.sessions, dep };
  }
  async function renderCombos() {
    const box = $('#b_combos'); if (!box || !INDEX.length) return;
    if (!COMBOS) {
      box.innerHTML = '<div class="card"><h2>Combos</h2><p>Calculating every combination...</p></div>';
      const ids = INDEX.slice(0, 6).map(x => x.id); for (const id of ids) { try { await loadReport(id); } catch (e) { /* skip */ } }
      const list = ids.filter(id => REP[id]), out = [];
      for (let mask = 1; mask < (1 << list.length); mask++) {
        const sub = list.filter((id, i) => mask & (1 << i)), reps = sub.map(id => REP[id]), av = [...new Set(reps.flatMap(r => r.strategies.map(x => x.id)))];
        for (let gm = 1; gm < (1 << av.length); gm++) {
          const groups = av.filter((g, i) => gm & (1 << i)); let r = null; try { r = comboModel(reps, groups); } catch (e) { r = null; }
          if (r) out.push(Object.assign(r, { sub, groups }));
        }
        await new Promise(res => setTimeout(res, 0));
      }
      COMBOS = out;
    }
    const rows = COMBOS.slice().sort((a, b) => CSORT === 'dd' ? a.dd - b.dd : b[CSORT] - a[CSORT]);
    const head = (k, l) => `<th><button class="sm ${CSORT === k ? 'on' : ''}" data-csort="${k}">${l}</button></th>`;
    box.innerHTML = `<div class="card"><h2>Combos ${badge('bt')}</h2><p class="sub">Every combination of the published reports and strategy groups, at 1× size on its deployed capital with the backtest's own costs. Combined reports use common dates only. Sort with the column buttons; <b>Open</b> shows that combination in full.</p>
      ${rows.length ? `<div class="scroll"><table class="t"><tr><th>Combination</th>${head('net', 'Net P&amp;L')}${head('roi', 'ROI')}${head('dd', 'Max DD')}${head('rd', 'ROI ÷ DD')}${head('win', 'Win days')}${head('sharpe', 'Sharpe')}<th>Sessions</th><th></th></tr>` +
      rows.map((r, i) => `<tr><td style="white-space:normal;text-align:left">${r.sub.map(id => esc((REP[id] || {}).title || id)).join(' + ')}<br><small>${r.groups.map(gname).join(' + ')}</small></td><td class="${cls(r.net)}">${inr(r.net)}</td><td class="${cls(r.roi)}">${pc(r.roi)}</td><td class="neg">${pc(-r.dd)}</td><td>${r.rd.toFixed(2)}</td><td>${r.win.toFixed(1)}%</td><td>${r.sharpe.toFixed(2)}</td><td>${r.n}</td><td><button class="sm" data-copen="${COMBOS.indexOf(r)}">Open</button></td></tr>`).join('') + '</table></div>' : '<p>No combinations could be calculated.</p>'}
      <p class="sub">Past performance, simulated. Ranking by the best historical result invites over-fitting; it is not a recommendation.</p></div>`;
  }

  /* ================= SHARE CODES ================= */
  function renderShare() {
    let list = SHARE && Array.isArray(SHARE.strategies) ? SHARE.strategies : [];
    if (!list.length && LIVE) list = (LIVE.strat || []).map(x => ({ name: x.name, exchange: x.ex, code: x.code }));
    const btn = TGURL ? `<a class="tgbtn" href="${esc(TGURL)}" target="_blank" rel="noopener noreferrer">${TGSVG}Join Telegram</a>` : '';
    $('#p_share').innerHTML = `<div class="card"><h2>Share codes</h2><p class="sub">Copy a strategy's share code to use it on your platform. Codes are published here when they are ready. This is information only, not advice; past performance does not guarantee future results.</p>${btn ? `<p>${btn}</p>` : ''}
      ${list.length ? `<div class="scroll"><table class="t"><tr><th>Strategy</th><th>Exchange</th><th>Share code</th></tr>${list.map(x => `<tr><td>${esc(x.name || '')}</td><td>${x.exchange ? esc(x.exchange) : '-'}</td><td>${x.code ? `<span class="fp">${esc(x.code)}</span> <button class="sm" data-copycode="${esc(x.code)}">Copy</button>` : '<span class="sub">Not published yet</span>'}</td></tr>`).join('')}</table></div>` : '<p>No strategies listed yet.</p>'}</div>`;
  }
  function loadCode(txt) {
    txt = String(txt || '').trim(); if (!txt) return false;
    const m = /[#&?]s=([A-Za-z0-9_\-=+/]+)/.exec(txt), code = m ? m[1] : txt;
    const keep = location.hash; try { history.replaceState(null, '', '#s=' + code); } catch (e) { return false; }
    const bak = JSON.stringify([S.tab, S.sel, S.groups, S.cap, S.cfg]); S.sel = []; S.groups = null; S.cap = null; S.cfg = E.defaultCfg();
    if (!decode()) { const o = JSON.parse(bak); S.tab = o[0]; S.sel = o[1]; S.groups = o[2]; S.cap = o[3]; S.cfg = o[4]; try { history.replaceState(null, '', keep || '#'); } catch (e) { /* ignore */ } return false; }
    $('#b_body') && ($('#b_body').dataset.sig = ''); return true;
  }

  const LAB = [ // key, label, min, max, step, unit
    ['slippage_pct', 'Slippage', 0, 0.5, 0.005, '%'], ['brokerage_per_order', 'Brokerage per order', 0, 60, 1, '₹'], ['brokerage_pct', 'Brokerage % of turnover', 0, 0.1, 0.001, '%'],
    ['stt_pct', 'STT (sell side)', 0, 0.3, 0.001, '%'], ['exchange_pct', 'Exchange charge', 0, 0.1, 0.0005, '%'], ['gst_pct', 'GST', 0, 28, 1, '%'],
    ['stamp_pct', 'Stamp duty (buy side)', 0, 0.02, 0.0005, '%'], ['sebi_per_crore', 'SEBI fee per crore', 0, 30, 1, '₹'], ['ipft_per_crore', 'IPFT per crore', 0, 1, 0.01, '₹'], ['other_per_order', 'Other per order', 0, 30, 1, '₹']
  ];

  function buildBTBody(M) {
    const slidersOn = M.hasT;
    $('#b_body').innerHTML = `
    <div class="card" id="b_panel" data-sec="strategy cost"><h2>Cost Lab: capital and costs ${badge('bt')}</h2>
     <p class="sub">Every slider opens at what the backtest actually charged (STT and exchange at their turnover-weighted average of the dated rates). A slider you have not moved keeps the backtest's own figure, line by line; move it and that line is re-priced on a linear model. <b>Every number, chart and table on this page updates as you move a slider.</b> Capital: size = whole multiples of the deployed capital (<b>${inr(M.dep)}</b>); ROI and drawdown are a % of the capital on the slider.</p>
     <div class="labcap"><b>Capital (₹)</b><input type="range" id="b_cap" min="${M.dep}" max="${M.dep * 5}" step="10000"><input type="number" id="b_capn" min="${M.dep}" step="10000"><span class="sub">Deployed ${inr(M.dep)} → trading <b id="b_k"></b></span><output id="b_capv" hidden></output></div>
     ${slidersOn ? '<div id="b_lab" class="labgrid"></div>' : '<div class="note warn">Cost sliders are not available: this report was exported without trade legs. Capital still works.</div>'}
     <div class="row" style="margin:8px 0">${slidersOn ? '<label><input type="checkbox" id="b_stat"> Apply statutory charges (STT / exchange / SEBI / GST / stamp / IPFT)</label>' : ''}<label><input type="checkbox" id="b_scale"> At 2×, 3× … capital each set is its own orders (every output scales; untick: one bigger order per leg)</label><button class="sm" id="b_reset">Reset all to the backtest</button><button class="sm" data-share>Copy share link</button>
      <span class="seg" id="b_view"><button data-view="net">Net of costs</button><button data-view="gross">Gross (before costs)</button></span></div>
     <div class="kpis" id="b_labk"></div></div>
    <div class="kpis" id="b_kpis" data-sec="strategy"></div>
    <div class="card" id="b_combined" data-sec="strategy"></div>
    <div class="grid2" data-sec="strategy">${chart('b_eq', 'Equity curve (cumulative P&L)', 'bt')}${chart('b_dd', 'Drawdown (% of capital)', 'bt')}</div>
    <div data-sec="strategy">${chart('b_mon', 'Monthly net P&L', 'bt')}<div class="card"><h2>P&amp;L calendar, last 12 months ${badge('bt')}</h2><div id="b_cal"></div></div></div>
    <div data-sec="strategy">${periodsHTML('b_', 'bt')}</div>
    <div class="card" data-sec="strategy"><h2>Drawdown analytics ${badge('bt')}</h2><div id="b_dda"></div></div>
    <div class="card" id="b_cmp_card" data-sec="strategy"><h2>Compare groups ${badge('bt')}</h2><div id="b_cmp"></div></div>
    <div class="card" data-sec="trade"><h2>Trade analytics ${badge('bt')}</h2><div id="b_ta"></div></div>
    <div class="card" data-sec="cost"><h2>Cost breakdown ${badge('bt')}</h2>
     <p class="sub">Move the sliders in the panel above. This section breaks the charges down line by line against the backtest's own figures.</p>
     <div class="grid2" style="margin-top:10px"><div id="b_costtbl" class="scroll"></div><div><div id="b_costchart"></div><div id="b_be"></div></div></div></div>`;
    if (slidersOn) {
      $('#b_lab').innerHTML = LAB.map(([k, l, mn, mx, st, u]) => `<div class="lab1" data-k="${k}"><label>${l.toUpperCase()}: <output></output></label><input type="range" min="${mn}" max="${mx}" step="${st}"><button class="sm" data-clr="${k}">actual</button></div>`).join('');
    }
  }

  function labStart(M, k) { const aw = E.actualWeighted(E.repriceAtoms(M.comb.atoms, E.defaultCfg(), 1)); return k === 'stt_pct' ? aw.stt_pct : k === 'exchange_pct' ? aw.exchange_pct : E.PARAM_DEFAULTS[k]; }

  function updateBT(M) {
    const m = M.m;
    $('#b_cap').value = M.cap; $('#b_capn').value = M.cap; $('#b_capv').textContent = inr(M.cap); $('#b_k').textContent = M.k + '×'; $('#b_scale').checked = S.cfg.orders_scale_with_size;
    $('#b_kpis').innerHTML = kpi('Net P&L', inr(m.total), pc(m.roi) + ' ROI on ' + inr(M.cap), cls(m.total)) + kpi('Max drawdown', pc(-m.dd.maxPct), inr(-m.dd.max) + ' | ' + M.basis + ' basis', 'neg') + kpi('Current drawdown', pc(-m.dd.curPct), inr(-m.dd.cur), m.dd.cur > 0 ? 'neg' : '') +
      kpi('Win days', m.winPct.toFixed(1) + '%', m.tradingDays + ' trading days / ' + m.sessions + ' sessions') + kpi('Sharpe (daily, ×√252)', m.sharpe.toFixed(2), 'on daily net') +
      kpi('Best day', inr(m.best ? m.best.net : 0), m.best ? fdate(m.best.date) : '', 'pos') + kpi('Worst day', inr(m.worst ? m.worst.net : 0), m.worst ? fdate(m.worst.date) : '', 'neg') + kpi('Costs', inr(m.costs), m.gross ? (m.costs / Math.abs(m.gross) * 100).toFixed(0) + '% of |gross|' : '');
    { const rr = M.reps.map(r => { const n = r.daily.reduce((t, d) => t + d.net, 0); return `<tr><td>${esc(r.title)}</td><td>${fdate(r.range.start)} to ${fdate(r.range.end)}</td><td>${r.daily.length}</td><td class="${cls(n)}">${inr(n)}</td></tr>`; }).join('');
      $('#b_combined').hidden = M.reps.length < 2;
      $('#b_combined').innerHTML = `<h2>Combined view ${badge('bt')}</h2><p class="sub">${M.reps.length > 1 ? 'Reports are combined on <b>common dates only</b>, so the combined figure is not the plain sum of the rows below.' : 'One report selected. Pick more reports above to combine them on common dates.'} Report rows are at 1× size, backtest costs.</p><div class="scroll"><table class="t"><tr><th>Report</th><th>Range</th><th>Sessions</th><th>Net P&amp;L (1×)</th></tr>${rr}<tr class="tt"><td>Combined: ${M.groups.map(gname).join(' + ')}</td><td>${m.dates.length ? fdate(m.dates[0]) + ' to ' + fdate(m.dates[m.dates.length - 1]) : '-'}</td><td>${m.sessions}</td><td class="${cls(m.total)}">${inr(m.total)}</td></tr></table></div>`; }
    $('#b_labk').innerHTML = kpi('Gross P&L', inr(m.gross), 'before costs', cls(m.gross)) + kpi('Total costs', inr(m.costs), m.gross ? (m.costs / Math.abs(m.gross) * 100).toFixed(1) + '% of |gross|' : '') + kpi('Net P&L', inr(m.total), 'after costs', cls(m.total)) + kpi('Net ROI', pc(m.roi), 'on ' + inr(M.cap), cls(m.roi)) + kpi('Net Sharpe', m.sharpe.toFixed(2), 'daily ×√252') + kpi('Max drawdown', pc(-m.dd.maxPct), inr(-m.dd.max), 'neg');
    const gross = S.view === 'gross'; let cg = 0; const eqVals = gross ? M.days.map(d => (cg += d.gross)) : m.dd.cum;
    document.querySelectorAll('#b_view button').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
    C.line($('#b_eq'), { series: [{ name: gross ? 'Gross' : 'Net', color: (eqVals.length ? eqVals[eqVals.length - 1] : 0) >= 0 ? C.POS : C.NEG, vals: eqVals }], labels: m.dates, fmt: v => inr(v), title: 'Equity curve' });
    C.line($('#b_dd'), { series: [{ name: 'Drawdown', color: C.GOLD, vals: m.dd.ddPct.map(v => -v) }], labels: m.dates, fmt: v => v.toFixed(2) + '%', title: 'Drawdown' });
    C.bars($('#b_mon'), { labels: m.monthly.map(r => mlabel(r.key)), vals: m.monthly.map(r => r.net), fmt: v => inr(v), title: 'Monthly net' });
    { const lm = m.dates.length ? m.dates[m.dates.length - 1] : '', y = +lm.slice(0, 4), mo = +lm.slice(5, 7) - 11, cut = new Date(Date.UTC(y, mo - 1, 1)).toISOString().slice(0, 10), n0 = Math.max(0, m.dates.findIndex(d => d >= cut)); C.calendar($('#b_cal'), m.dates.slice(n0), m.nets.slice(n0), M.cap); }
    renderPeriods('b_', m, S.per, S.pf, S.pt, M.cap);
    $('#b_dda').innerHTML = ddAnalyticsHTML(m.dd);
    // compare groups
    if (M.groups.length > 1 && M.hasT) {
      const sess = M.days.map(d => d.date), per = M.groups.map(g => { const pr = M.priced.filter(p => p.g === g), d = E.dailyFromPriced(sess, pr), c = E.deployed([g], M.extra) * M.k, mm = E.metrics(d, c); return { g, d, mm, c }; });
      let h = `<div class="scroll"><table class="t"><tr><th>Group</th><th>Net P&amp;L</th><th>ROI (own capital)</th><th>Max drawdown</th><th>Traded days</th><th>Winning days</th><th>Losing days</th></tr>` +
        per.map(p => { const td = p.d.filter(x => x.trades > 0).length, w = p.d.filter(x => x.net > 0).length, l = p.d.filter(x => x.net < 0).length; return `<tr><td>${esc(gname(p.g))}</td><td class="${cls(p.mm.total)}">${inr(p.mm.total)}</td><td class="${cls(p.mm.roi)}">${pc(p.mm.roi)} <small>on ${inr(p.c)}</small></td><td class="neg">${pc(-p.mm.dd.maxPct)} <small>${inr(-p.mm.dd.max)}</small></td><td>${td}</td><td>${w} <small>(${td ? (w / td * 100).toFixed(1) : 0}%)</small></td><td>${l} <small>(${td ? (l / td * 100).toFixed(1) : 0}%)</small></td></tr>`; }).join('') + '</table></div>';
      if (per.some(p => p.mm.dd.maxPct > 100)) h += '<div class="note">A drawdown above 100% means that group, on its own, lost more than the capital allotted to it from its best point. Groups are meant to run together: the portfolio drawdown (shown above) is measured on the combined capital.</div>';
      if (per.length === 2) { const a = per[0], b = per[1], la = a.d.map(x => x.net < 0), lb = b.d.map(x => x.net < 0), both = la.filter((v, i) => v && lb[i]).length, na = la.filter(Boolean).length, nb = lb.filter(Boolean).length;
        h += `<div class="note">${esc(gname(a.g))} lost on <b>${na}</b> days, ${esc(gname(b.g))} on <b>${nb}</b>. Both lost on the same day <b>${both}</b> times${na ? ` (${(both / na * 100).toFixed(0)}% of ${esc(gname(a.g))}'s losing days, ${nb ? (both / nb * 100).toFixed(0) : 0}% of ${esc(gname(b.g))}'s)` : ''}.</div>`; }
      h += `<p class="sub">Combined capital is ${inr(M.dep)} (margin offset), not the sum of the two.</p>`; $('#b_cmp').innerHTML = h; $('#b_cmp_card').hidden = false;
    } else $('#b_cmp_card').hidden = true;
    // trade analytics
    if (M.hasT) {
      const t = E.tradeStats(M.pos), tb = (rows, lab) => `<h3>${lab}</h3><table class="t"><tr><th>${lab.split(' ')[1] || ''}</th><th>Trades</th><th>Net</th><th>Win %</th></tr>` + rows.map(r => `<tr><td>${esc(r.key)}</td><td>${r.n}</td><td class="${cls(r.net)}">${inr(r.net)}</td><td>${(r.wins / r.n * 100).toFixed(0)}%</td></tr>`).join('') + '</table>';
      $('#b_ta').innerHTML = `<p class="sub">A trade = all legs sharing one id. Figures are net of the costs in the Cost Lab settings.</p><div class="kpis">${kpi('Trades', t.count)}${kpi('Win rate', t.winRate.toFixed(1) + '%')}${kpi('Average win', inr(t.avgWin), '', 'pos')}${kpi('Average loss', inr(t.avgLoss), '', 'neg')}${kpi('Expectancy / trade', inr(t.expectancy), '', cls(t.expectancy))}${kpi('Profit factor', t.profitFactor == null ? '-' : t.profitFactor.toFixed(2))}${kpi('Longest win / loss streak', t.maxWinStreak + ' / ' + t.maxLossStreak)}${kpi('Best / worst trade', inr(t.bestTrade) + ' / ' + inr(t.worstTrade))}</div>
       <div class="grid3"><div>${tb(t.byWeekday, 'By weekday')}</div><div>${tb(t.byDTE, 'By DTE (sessions to expiry)')}</div><div>${tb(t.byHour, 'By entry hour')}</div></div>
       <p class="sub">DTE = trading sessions to expiry (expiry day 0, session before 1, and so on); weekends and holidays are not counted. Taken from the report as given.</p>`;
    } else $('#b_ta').innerHTML = '<p class="sub">Not available: this report has no trade legs.</p>';
    // cost lab
    if (M.hasT) {
      document.querySelectorAll('#b_lab .lab1').forEach(r => {
        const k = r.dataset.k, inp = r.querySelector('input'), out = r.querySelector('output'), set = S.cfg.settings[k], v = set != null ? set : labStart(M, k), u = LAB.find(x => x[0] === k)[5];
        if (document.activeElement !== inp) inp.value = v; out.textContent = (u === '₹' ? '₹' + (+v).toFixed(2) : (+v).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + '%') + (set != null ? '' : ' (BACKTEST)'); out.style.color = set != null ? 'var(--ink)' : 'var(--mut)';
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
  function renderLive() {
    const el = $('#p_live');
    if (!LIVE) { el.innerHTML = `<div class="card"><h2>Live results ${badge('lv')}</h2><p>${LIVE_ERR ? 'Live results could not be loaded: ' + esc(LIVE_ERR) : 'No live results have been published yet.'}</p>${DIAG ? '<p class="sub">' + esc(DIAG) + '. The site looks for <b>live/data.json</b> (the file from Export website data).</p>' : ''}<p class="sub">Live results start on their real start date. Nothing is back-filled. The Backtest Analysis tab shows simulated results only.</p></div>`; return; }
    window.SLive.render(el, LIVE);
  }

  /* ================= ABOUT ================= */
  function renderAbout() {
    const rs = Object.values(REP);
    $('#p_about').innerHTML = `
    <div class="card"><h2>How the numbers are made</h2><ul>
     <li><b>Backtest vs live.</b> Backtests are simulated on historical data. Live results are entered by hand by the owner, net of charges. They are always shown separately and never joined into one curve.</li>
     <li><b>Size and capital.</b> Non-directional trades 195 units per leg; directional trades 65 units per leg, the same in every year. Deployed capital: non-directional ${inr(400000)}, directional ${inr(100000)}, both together ${inr(400000)} (margin offset), not ${inr(500000)}. Size = floor(capital ÷ deployed).</li>
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
    <div class="card"><h2>Important</h2><p>This website is for information only. It is not investment advice, research, or an offer or solicitation to buy or sell anything, and no strategy is offered for sale or subscription. Past performance, simulated or live, does not guarantee future results. Options trading carries a high risk of loss. Results shown may be unaudited and costs are modelled for backtests.</p></div>`;
  }

  /* ================= tabs + events ================= */
  function show(t) {
    if (LEGACY.includes(t)) t = 'strategy'; if (!TABS.includes(t)) t = 'live';
    S.tab = t; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    const page = t === 'live' ? 'live' : BT_TABS.includes(t) ? 'bt' : t;
    ['live', 'bt', 'share', 'about'].forEach(x => { $('#p_' + x).hidden = x !== page; });
    if (page === 'bt') { applyView(); renderBT(); } else if (page === 'live') renderLive(); else if (page === 'share') renderShare(); else renderAbout(); sync();
  }
  function exportCSV(prefix) {
    if (prefix === 'bt' && BT && !BT.empty) { const m = BT.m; C.download('srisuutra_backtest_daily.csv', C.csv([['date', 'gross', 'costs', 'net', 'cumulative_net', 'drawdown_pct_of_capital', 'label'], ...m.dates.map((d, i) => [d, BT.days[i].gross.toFixed(2), BT.days[i].costs.toFixed(2), BT.days[i].net.toFixed(2), m.dd.cum[i].toFixed(2), (-m.dd.ddPct[i]).toFixed(4), 'BACKTEST'])]));
      C.download('srisuutra_backtest_monthly.csv', C.csv([['month', 'net', 'roi_pct', 'label'], ...m.monthly.map(r => [r.key, r.net.toFixed(2), r.roi.toFixed(4), 'BACKTEST'])])); }
    if (prefix === 'lv') window.SLive.csv();
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('button,.chip,a'); if (!t) return;
    if (t.dataset.t) return show(t.dataset.t);
    if (t.dataset.csort) { CSORT = t.dataset.csort; return renderCombos(); }
    if (t.dataset.copen !== undefined) { const c = COMBOS[+t.dataset.copen]; S.sel = c.sub.slice(); S.groups = c.groups.slice(); S.cap = null; const bb = $('#b_body'); if (bb) bb.dataset.sig = ''; return show('strategy'); }
    if (t.dataset.copycode !== undefined) { try { navigator.clipboard.writeText(t.dataset.copycode); t.textContent = 'Copied'; setTimeout(() => t.textContent = 'Copy', 1500); } catch (x) { prompt('Copy this code', t.dataset.copycode); } return; }
    if (t.dataset.rep) { const id = t.dataset.rep, i = S.sel.indexOf(id); if (i >= 0) S.sel.splice(i, 1); else S.sel.push(id); S.groups = null; S.cap = null; $('#b_body').dataset.sig = ''; return renderBT(); }
    if (t.dataset.grp) { const all = BT ? BT.avail : []; let g = S.groups ? S.groups.slice() : all.slice(); const i = g.indexOf(t.dataset.grp); if (i >= 0) g.splice(i, 1); else g.push(t.dataset.grp); S.groups = g; S.cap = null; return renderBT(); }
    if (t.dataset.lgrp) { const all = LM ? LM.ids : []; let g = S.lgroups ? S.lgroups.slice() : all.slice(); const i = g.indexOf(t.dataset.lgrp); if (i >= 0) g.splice(i, 1); else g.push(t.dataset.lgrp); S.lgroups = g; S.lcap = null; return renderLive(); }
    if (t.dataset.view) { S.view = t.dataset.view; return BT && updateBT(BT); }
    if (t.dataset.per) { const live = t.closest('#l_seg'); if (live) S.lper = t.dataset.per; else S.per = t.dataset.per; return live ? renderLive() : BT && updateBT(BT); }
    if (t.dataset.clr) { S.cfg.settings[t.dataset.clr] = null; return renderBT(); }
    if (t.id === 'b_reset') { S.cfg = E.defaultCfg(); S.cap = null; return renderBT(); }
    if (t.dataset.share !== undefined) { sync(); if ($('#sh_cur')) $('#sh_cur').value = location.href; (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(() => { t.textContent = 'Link copied'; setTimeout(() => t.textContent = 'Copy share link', 1500); }, () => prompt('Copy this link', location.href)); return; }
    if (t.dataset.exp) { const p = t.dataset.p, root = $(p === 'bt' ? '#p_bt' : '#p_live'); if (t.dataset.exp === 'csv') return exportCSV(p); return snap(root, 'srisuutra_' + (p === 'bt' ? 'backtest' : 'live'), t.dataset.exp === 'pdf').catch(err => alert(err.message)); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'b_cap') { S.cap = +t.value; renderBT(); }
    else if (t.id === 'l_cap') { S.lcap = +t.value; renderLive(); }
    else if (t.id === 'b_scale') { S.cfg.orders_scale_with_size = t.checked; BT && renderBT(); }
    else if (t.id === 'b_stat') { S.cfg.statutory_on = t.checked; BT && renderBT(); }
    else if (t.closest && t.closest('#b_lab') && t.type === 'range') { S.cfg.settings[t.closest('[data-k]').dataset.k] = +t.value; renderBT(); }
    else if (/^(b_|l_)p[ft]$/.test(t.id)) { const live = t.id[0] === 'l'; if (live) { S[t.id === 'l_pf' ? 'lpf' : 'lpt'] = t.value; renderLive(); } else { S[t.id === 'b_pf' ? 'pf' : 'pt'] = t.value; BT && updateBT(BT); } }
  });

  document.addEventListener('change', e => { if (e.target.id === 'b_capn') { S.cap = Math.max(0, +e.target.value || 0); renderBT(); } });

  /* ---------- gate + boot ---------- */
  function gate() {
    let ok = false; try { ok = localStorage.getItem('ghs_agreed') === '1'; } catch (e) { /* ignore */ }
    if (ok) return; $('#gate').style.display = 'flex';
    $('#agree').onclick = () => { try { localStorage.setItem('ghs_agreed', '1'); } catch (e) { /* ignore */ } $('#gate').style.display = 'none'; };
  }
  const BUILD = '2026-11-01.11';
  function loadAbs(src) { return new Promise((res, rej) => { const t = document.createElement('script'); t.src = src + '?v=' + BUILD; t.onload = res; t.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(t); }); }
  const TGSVG = '<svg viewBox="0 0 24 24"><path d="M21.9 3.4 2.7 10.8c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 1.9 5.8c.2.6.1.9.8.9.5 0 .8-.2 1.1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8l3-14.5c.3-1.2-.4-1.8-1.3-1.2zM8.6 13.2l9.6-6c.5-.3.9-.1.5.2l-8 7.2-.3 3.3z"/></svg>';
  let TGURL = '', SHARE = null;
  /* Makes the page work even if an older index.html is still on the server. */
  async function ensureShell() {
    const L = [['live', 'Daily PnL Report'], ['strategy', 'Backtest Analysis'], ['trade', 'Trade Analytics'], ['cost', 'Cost Lab'], ['share', 'Share Codes'], ['about', 'Method & costs']];
    $('#tabs').innerHTML = L.map(x => `<button data-t="${x[0]}">${x[1]}</button>`).join('');
    if (!$('#p_share')) { const sec = document.createElement('section'); sec.id = 'p_share'; sec.hidden = true; $('#p_about').before(sec); }
    if (!window.SLive) { try { await loadAbs('js/live.js'); } catch (e) { LIVE_ERR = e.message; } }
  }
  async function boot() {
    await ensureShell(); decode(); gate();
    document.addEventListener('click', e => { if (e.target.id === 'reopen') { e.preventDefault(); $('#gate').style.display = 'flex'; $('#agree').onclick = () => { $('#gate').style.display = 'none'; }; } });
    $('#foot').innerHTML = '© SRISUUTRA ALGO TRADING. Information and education only; not investment advice or an offer to buy or sell. Backtest results are simulated; live results are owner-entered and unaudited. Past performance does not guarantee future results. Options trading carries a high risk of loss. <a href="#" id="reopen">Read the full disclaimer</a>';
    try { INDEX = await getJSON(INDEX_URL); if (!Array.isArray(INDEX)) throw new Error('index.json must be a list'); } catch (e) { IDX_ERR = 'The report list could not be loaded (' + e.message + '). If you opened this file directly from disk, serve it over http (GitHub Pages does this automatically).'; }
    for (const u of LIVE_URLS) { try { const j = await getJSON(u); LIVE = asLive(j); if (!LIVE) throw new Error(u + ' is not in the expected live format'); LIVE_ERR = ''; break; } catch (e) { LIVE = null; if (!/\(404\)/.test(e.message)) LIVE_ERR = e.message; } }
    if (!LIVE || !INDEX.length) await discover();
    if (!S.sel.length && INDEX.length) S.sel = [INDEX[0].id];
    S.sel = S.sel.filter(id => INDEX.some(x => x.id === id));
    let cfg = {}; try { cfg = await getJSON('config.json'); } catch (e) { /* optional */ }
    const tl = cfg.telegram || ((LIVE && LIVE.links || []).find(l => /telegram|t\.me/i.test(l.label + l.url)) || {}).url;
    if (tl && /^https?:\/\//i.test(tl)) TGURL = tl;
    try { SHARE = await getJSON('share-codes.json'); } catch (e) { SHARE = null; }
    if (S.tab === 'live' && !LIVE && INDEX.length && !/[#&]s=/.test(location.hash)) S.tab = 'strategy';
    $('#foot').insertAdjacentHTML('beforeend', `<div class="sub" style="margin-top:8px">Build ${BUILD} · reports found: ${INDEX.length} · live data: ${LIVE ? 'loaded (' + Object.keys(LIVE.days || {}).length + ' days)' : 'not found'}${DIAG ? ' · ' + esc(DIAG) : ''}</div>`);
    show(S.tab);
  }
  // Period selector for the live tab needs its own id; renderPeriods builds ids from the prefix ('l_seg').
  boot();
})();
