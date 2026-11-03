/* SRISUUTRA - Live results view. Reads live/data.json (written by local/daily_entry.html, "Export website data").
 * All numbers are recalculated here in the browser from the daily P&L the owner entered. */
(function (root) {
  'use strict';
  const C = root.GC, esc = C.esc, cls = C.cls;
  const num = v => isFinite(parseFloat(v)) ? parseFloat(v) : 0;
  const inr = n => (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const sg = n => (n < 0 ? '-' : '+') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
  const pc = n => n.toFixed(2) + '%', sp = n => (n < 0 ? '' : '+') + n.toFixed(2) + '%';
  const fd = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const fm = m => new Date(m + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const url = u => /^(https?:\/\/|tg:)/i.test(u) ? u : '';
  const st = { mt: 'd', sel: { d: null, m: null } };
  let D = null, M = null, el = null;

  function ddOf(vals, cap) {
    let V = cap, pk = cap, mx = 0, mxA = 0, cur = 0, curA = 0; const ser = [];
    vals.forEach(v => { V += v; pk = Math.max(pk, V); curA = V - pk; cur = cap ? curA / cap * 100 : 0; if (cur < mx) { mx = cur; mxA = curA; } ser.push(cur); });
    return { cur, curA, max: mx, maxA: mxA, ser };
  }
  function metrics(vals, dates, cap, a) {
    const sum = f => vals.reduce((t, v, i) => t + (f(dates[i]) ? v : 0), 0), roi = p => cap ? p / cap * 100 : 0;
    const day = sum(d => d === a), mo = sum(d => d.slice(0, 7) === a.slice(0, 7)), yr = sum(d => d.slice(0, 4) === a.slice(0, 4)), f = ddOf(vals, cap);
    return { cap, day, dayR: roi(day), mo, moR: roi(mo), yr, yrR: roi(yr), cur: f.cur, curA: f.curA, max: f.max, maxA: f.maxA, ser: f.ser, total: vals.reduce((t, v) => t + v, 0) };
  }
  const has = (d, s) => { const v = (D.days[d] || {})[s.id]; return v !== '' && v != null; };
  function model() {
    const all = Object.keys(D.days).sort(), a = D.asof && all.includes(D.asof) ? D.asof : all[all.length - 1];
    if (!a) return null;
    const dates = all.filter(d => d <= a), S = D.strat || [];
    const rows = S.map(s => { const v = dates.map(d => num((D.days[d] || {})[s.id]) * (s.mult || 1)); return { s, v, m: metrics(v, dates, num(s.cap), a) }; });
    const tv = dates.map((d, i) => rows.reduce((t, r) => t + r.v[i], 0)), ac = S.reduce((t, s) => t + num(s.cap), 0), on = D.cumOn !== false;
    const tc = on ? (num(D.cumCap) > 0 ? num(D.cumCap) : ac) : ac;
    if (on) rows.forEach(r => { r.m = metrics(r.v, dates, tc, a); });
    return { a, dates, rows, tv, tc, on, tot: metrics(tv, dates, tc, a), S };
  }
  const badge = (s) => { const e = (s.ex || '').trim().toUpperCase(); return e ? `<span class="bx ${e === 'MCX' ? 'mcx' : e === 'NFO' ? '' : 'o'}">${esc(e)}</span>` : '<span class="sub">-</span>'; };
  const kpi = (l, v, sub, c) => `<div class="kpi"><span>${esc(l)}</span><strong class="${c || ''}">${v}</strong><em>${sub || ''}</em></div>`;

  function agg(key, isM) {
    const k = d => isM ? d.slice(0, 7) : d, ix = M.dates.map((d, i) => k(d) === key ? i : -1).filter(i => i >= 0);
    const days = ix.filter(i => M.S.some(s => has(M.dates[i], s)));
    const per = M.rows.map(r => ({ s: r.s, has: ix.some(i => has(M.dates[i], r.s)), v: ix.reduce((t, i) => t + r.v[i], 0) }));
    const tot = ix.reduce((t, i) => t + M.tv[i], 0);
    return { tot, nd: days.length, w: days.filter(i => M.tv[i] > 0).length, l: days.filter(i => M.tv[i] < 0).length, per, ns: per.filter(p => p.has).length };
  }
  function pview() {
    const isM = st.mt === 'm', k = d => isM ? d.slice(0, 7) : d, keys = [...new Set(M.dates.map(k))].sort().reverse();
    let sel = st.sel[st.mt]; if (!keys.includes(sel)) sel = keys[0];
    const A = agg(sel, isM), lab = x => isM ? fm(x) : fd(x), cap = M.tc || 1;
    const rows = A.per.filter(p => p.has).map(p => `<tr><td>${esc(p.s.name)}</td><td>${badge(p.s)}</td><td class="${cls(p.v)}">${sg(p.v)}</td></tr>`).join('') +
      `<tr class="tt"><td>Total</td><td></td><td class="${cls(A.tot)}">${sg(A.tot)} <small>(${sp(A.tot / cap * 100)})</small></td></tr>`;
    const hist = keys.map(x => { const a = agg(x, isM); return `<div class="mve${x === sel ? ' on' : ''}" data-lsel="${x}"><div><b>${isM ? fm(x) : fd(x)}</b><small>${isM ? `${a.nd} days · ${a.w}W / ${a.l}L · ${a.ns} strats` : `${new Date(x + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' })} · ${a.ns} strats`}</small></div><div><strong class="${cls(a.tot)}">${sg(a.tot)}</strong><em class="${cls(a.tot)}">${sp(a.tot / cap * 100)}</em></div></div>`; }).join('');
    return `<div class="grid2 mvw"><div class="card"><div class="row" style="justify-content:space-between"><div class="seg"><button data-lmt="d" class="${isM ? '' : 'on'}">Daily P&amp;L</button><button data-lmt="m" class="${isM ? 'on' : ''}">Monthly P&amp;L</button></div><b class="${cls(A.tot)}" style="font-size:13px">● ${lab(sel)}</b></div>
      <p class="sub" style="margin-top:10px">${isM ? 'Monthly' : 'Daily'} strategy breakdown (${A.ns} strateg${A.ns === 1 ? 'y' : 'ies'}) · ROI on ${inr(M.tc)}</p>
      <table class="t mvtb"><tr><th>Strategy</th><th>Exchange</th><th>P&amp;L</th></tr>${rows}</table></div>
      <div class="card"><h2>${isM ? 'Monthly' : 'Daily'} history <span class="badge mix">${keys.length} ${isM ? 'month' : 'day'}${keys.length === 1 ? '' : 's'}</span></h2><p class="sub">Click an entry to see its breakdown.</p><div class="mvl">${hist}</div></div></div>`;
  }

  function render(box, data) {
    el = box; D = data; M = model();
    const head = `<div class="card"><h2>${esc(D.title || 'Live results')} <span class="badge lv">LIVE</span> <span class="row noprint"><button class="sm" data-exp="csv" data-p="lv">CSV</button><button class="sm" data-exp="png" data-p="lv">PNG</button><button class="sm" data-exp="pdf" data-p="lv">PDF</button></span></h2>`;
    if (!M) { el.innerHTML = head + '<p>No daily results have been entered yet.</p></div>'; return; }
    const T = M.tot, eq = []; let t = 0; M.tv.forEach(v => eq.push(t += v));
    const last = eq[eq.length - 1] || 0, hi = Math.max(0, ...eq), entd = M.dates.filter(d => M.S.some(s => has(d, s))), wins = entd.filter(d => M.tv[M.dates.indexOf(d)] > 0).length;
    const wr = entd.length ? wins / entd.length * 100 : 0, newHigh = eq.length > 1 && last === hi && hi > 0;
    const L = [['Today P/L', 'day', inr], ['Today ROI', 'dayR', pc], ['Month P/L', 'mo', inr], ['Month ROI', 'moR', pc], ['YTD P/L', 'yr', inr], ['YTD ROI', 'yrR', pc], ['Current drawdown ₹', 'curA', inr], ['Current drawdown %', 'cur', pc], ['Max drawdown ₹', 'maxA', inr], ['Max drawdown %', 'max', pc]];
    const DOT = ['#1c2a4a', '#2f6fd6', '#f0a020', '#0b8f57', '#8e44ad'], mname = fm(M.a.slice(0, 7)).split(' ')[0];
    const pl = (v, r) => `<div class="pv ${cls(v)}"><b>${inr(v)}</b> <small>(${sp(r)})</small></div>`;
    const ddc = m => { const w = m.max < 0 ? Math.max(0, Math.min(100, m.cur / m.max * 100)) : 0; return `<div class="ddc"><div class="ddt"><b class="${m.cur < 0 ? 'neg' : ''}">${pc(m.cur)}</b><span>max: ${pc(m.max)}</span></div><div class="ddb"><i style="width:${w.toFixed(1)}%"></i></div></div>`; };
    const trow = (nm, dot, m, tot) => `<tr class="${tot ? 'tot' : ''}"><td class="sn">${dot ? `<i class="dot" style="background:${dot}"></i>` : ''}${esc(nm)}</td><td>${pl(m.day, m.dayR)}</td><td>${pl(m.mo, m.moR)}</td><td>${pl(m.total, m.cap ? m.total / m.cap * 100 : 0)}</td><td>${ddc(m)}</td></tr>`;
    const table = `<table class="t lvtbl"><tr><th>Strategy</th><th>Today P&amp;L</th><th>${esc(mname)} P&amp;L</th><th>All-time P&amp;L</th><th>Drawdown <small>(current vs max)</small></th></tr>` + M.rows.map((r, i) => trow(r.s.name, DOT[i % DOT.length], r.m, false)).join('') + trow('Portfolio total', '', T, true) + '</table>';
    const links = (D.links || []).filter(l => url(l.url)), notes = D.notes || [];
    const strat = M.S.map(s => `<tr><td>${esc(s.name)}</td><td>${badge(s)}</td><td>${inr(num(s.cap))}</td><td>${s.mult || 1}×</td><td>${s.code ? `<span class="fp">${esc(s.code)}</span> <button class="sm" data-copy="${esc(s.code)}">Copy</button>` : '-'}</td></tr>`).join('');
    const fy = M.dates.find(d => M.S.some(s => has(d, s))) || M.dates[0], tgl = ((D.links || []).find(l => /t\.me|telegram/i.test(l.label + l.url)) || {}).url || '';
    const tint = v => v < 0 ? 'neg' : v > 0 ? 'pos' : 'flat', sn = M.rows.filter(r => has(M.a, r.s) || true);
    const spark = (() => { const w = 420, h = 74, p = 6, vs = [0, ...eq], mn = Math.min(...vs), mx = Math.max(...vs), rg = (mx - mn) || 1, X = i => p + i * (w - 2 * p) / Math.max(1, vs.length - 1), Y = v => h - p - (v - mn) / rg * (h - 2 * p), pts = vs.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)), col = last >= 0 ? '#0b8f57' : '#d12f2f';
      return `<svg class="lvspark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="M${X(0).toFixed(1)},${h - p} L${pts.join(' L')} L${X(vs.length - 1).toFixed(1)},${h - p} Z" fill="${col}" opacity=".12"/><line x1="${p}" x2="${w - p}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#9aa3c0" stroke-dasharray="3 3"/><line x1="${p}" x2="${w - p}" y1="${Y(mx).toFixed(1)}" y2="${Y(mx).toFixed(1)}" stroke="#c9a43b" stroke-dasharray="4 3"/><polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${X(vs.length - 1).toFixed(1)}" cy="${Y(last).toFixed(1)}" r="4.5" fill="${col}"/></svg>`; })();
    const stratRows = M.rows.map(r => { const v = r.m.day; return `<div class="lvsr ${cls(v)}"><span>${esc(r.s.name)}</span><b>${sg(v)}</b></div>`; }).join('');
    el.innerHTML = '<div class="qtybox"><b>Results from 14 October 2026</b></div>' + `<div class="card lvrep" id="lv_report">
      <div class="lvtop"><div><h2 class="lvh">${esc(D.title || 'Live results')}</h2><div class="sub">Daily performance report · ${M.S.length} strateg${M.S.length === 1 ? 'y' : 'ies'} · since ${fd(fy)} · ${entd.length} trading days · ${inr(T.cap)} ${M.on ? 'cumulative capital' : 'capital'}${D.sub ? ' · ' + esc(D.sub) : ''}</div></div>
        <div class="lvdate"><div class="lvd">${fd(M.a)}</div><span class="row noprint"><button class="sm" data-lcopy="1">⧉ Copy report</button><button class="sm" data-exp="csv" data-p="lv">CSV</button><button class="sm" data-exp="png" data-p="lv">PNG</button><button class="sm" data-exp="pdf" data-p="lv">PDF</button></span></div></div>
      <div class="lvhero"><div class="lvbox ${tint(T.day)}"><div class="lvl">Today · ${fd(M.a)}</div><div class="lvbig ${cls(T.day)}">${sg(T.day)}</div><div class="lvp">${sp(T.dayR)} of capital</div><div class="lvsl">${stratRows}</div></div>
        <div class="lvbox ${tint(T.total)}"><div class="lvl">All-time · since ${fd(fy)}</div><div class="lvbig ${cls(T.total)}">${sg(T.total)}</div><div class="lvp">${sp(T.cap ? T.total / T.cap * 100 : 0)} of capital</div>${spark}</div></div>
      <div class="lvstats"><div class="lvst"><span>${fm(M.a.slice(0, 7))}</span><b class="${cls(T.mo)}">${sg(T.mo)}</b><em>${sp(T.moR)}</em></div><div class="lvst"><span>Equity high</span><b class="hi">${sg(hi)}</b><em>${last === hi && hi > 0 ? 'closed at the peak' : 'peak so far'}</em></div><div class="lvst"><span>Max drawdown</span><b class="neg">${pc(T.max)}</b><em>${sg(T.maxA)}</em></div><div class="lvst"><span>Win days</span><b>${wr.toFixed(1)}%</b><em>of trading days</em></div></div>
      <div class="scroll">${table}</div>
      <p class="sub">${M.on ? 'ROI and drawdown of every column use the cumulative capital.' : 'ROI and drawdown of each strategy use its own capital.'} Drawdown = fall from the highest equity (capital + cumulative P/L), in % of the capital deployed; the bar shows the current drawdown against the maximum seen to date. Entries are net P&amp;L as shown by the broker, charges already deducted. Owner-entered and unaudited; can be verified on Tradetron. Past performance does not guarantee future returns.${tgl ? ' Telegram: ' + esc(tgl.replace(/^https?:\/\//, '')) : ''}</p>${newHigh ? '<span class="badge lv">▲ NEW EQUITY HIGH</span>' : ''}</div>
     ${pview()}
     <div class="grid2"><div class="card"><h2>Cumulative return (%) <span class="badge lv">LIVE</span></h2><div id="lv_eq"></div></div><div class="card"><h2>Portfolio drawdown (%) <span class="badge lv">LIVE</span></h2><div id="lv_dd"></div></div></div>
     <div class="card"><h2>Monthly net P&amp;L <span class="badge lv">LIVE</span></h2><div id="lv_mon"></div></div><div class="card"><h2>P&amp;L calendar <span class="badge lv">LIVE</span></h2><div id="lv_cal"></div></div>`;
    const cum = eq.map(v => v / (M.tc || 1) * 100);
    C.line(el.querySelector('#lv_eq'), { series: [{ name: 'Cumulative return', color: last >= 0 ? C.POS : C.NEG, vals: cum }], labels: M.dates, fmt: v => v.toFixed(2) + '%', title: 'Cumulative return' });
    C.line(el.querySelector('#lv_dd'), { series: [{ name: 'Drawdown', color: C.GOLD, vals: T.ser }], labels: M.dates, fmt: v => v.toFixed(2) + '%', title: 'Drawdown' });
    const mo = {}; M.dates.forEach((d, i) => { mo[d.slice(0, 7)] = (mo[d.slice(0, 7)] || 0) + M.tv[i]; });
    const mk = Object.keys(mo).sort();
    C.bars(el.querySelector('#lv_mon'), { labels: mk.map(k => fm(k).slice(0, 3) + ' ' + k.slice(2, 4)), vals: mk.map(k => mo[k]), fmt: v => inr(v), title: 'Monthly net' });
    C.calendar(el.querySelector('#lv_cal'), M.dates, M.tv, M.tc);
    if (!el.dataset.bound) {
      el.dataset.bound = 1;
      el.addEventListener('click', e => {
        const lc = e.target.closest('[data-lcopy]'); if (lc) { copyReport(lc); return; }
        const b = e.target.closest('[data-lmt],[data-lsel],[data-copy]'); if (!b) return;
        if (b.dataset.lmt) st.mt = b.dataset.lmt;
        else if (b.dataset.lsel) st.sel[st.mt] = b.dataset.lsel;
        else { try { navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1500); } catch (x) { prompt('Copy this code', b.dataset.copy); } return; }
        render(el, D);
      });
    }
  }
  function h2c() {
    if (window.html2canvas) return Promise.resolve();
    return new Promise((res, rej) => { const a = document.createElement('script'); a.src = 'vendor/html2canvas.min.js'; a.onload = res; a.onerror = () => { const b = document.createElement('script'); b.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; b.crossOrigin = 'anonymous'; b.onload = res; b.onerror = () => rej(new Error('Could not load the image library')); document.head.appendChild(b); }; document.head.appendChild(a); });
  }
  async function copyReport(btn) {
    const t0 = btn.textContent, say = m => { btn.textContent = m; setTimeout(() => { btn.textContent = t0; }, 1800); };
    try {
      btn.textContent = 'Copying…'; await h2c(); const node = document.getElementById('lv_report');
      const cv = await window.html2canvas(node, { scale: 3, backgroundColor: getComputedStyle(document.body).backgroundColor, ignoreElements: n => n.classList && n.classList.contains('noprint') });
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); say('Copied ✓'); }
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'SRISUUTRA_daily_report.png'; a.click(); say('Saved as picture'); }
    } catch (e) { say('Copy blocked'); }
  }
  function csv() {
    if (!M) return;
    C.download('srisuutra_live_daily.csv', C.csv([['date', ...M.S.map(s => s.name), 'total', 'label'], ...M.dates.map((d, i) => [d, ...M.rows.map(r => r.v[i].toFixed(2)), M.tv[i].toFixed(2), 'LIVE'])]));
  }
  root.SLive = { render, csv };
})(window);
