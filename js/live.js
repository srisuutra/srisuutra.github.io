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
    vals.forEach(v => { V += v; pk = Math.max(pk, V); curA = V - pk; cur = pk ? curA / pk * 100 : 0; if (cur < mx) { mx = cur; mxA = curA; } ser.push(cur); });
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
    const table = `<table class="t"><tr><th>Metric</th>${M.rows.map(r => `<th>${esc(r.s.name)}</th>`).join('')}<th class="ct">CUMULATIVE</th></tr>` +
      L.map((l, n) => `<tr class="${n < 2 ? 'hl' : ''}"><td>${l[0]}</td>${M.rows.map(r => `<td class="${cls(r.m[l[1]])}">${l[2](r.m[l[1]])}</td>`).join('')}<td class="ct ${cls(T[l[1]])}">${l[2](T[l[1]])}</td></tr>`).join('') + '</table>';
    const links = (D.links || []).filter(l => url(l.url)), notes = D.notes || [];
    const strat = M.S.map(s => `<tr><td>${esc(s.name)}</td><td>${badge(s)}</td><td>${inr(num(s.cap))}</td><td>${s.mult || 1}×</td><td>${s.code ? `<span class="fp">${esc(s.code)}</span> <button class="sm" data-copy="${esc(s.code)}">Copy</button>` : '-'}</td></tr>`).join('');
    el.innerHTML = head + `<p class="sub">As of <b>${fd(M.a)}</b> · ${entd.length} trading days · ${esc(D.sub || '')}. Entries are net P&amp;L as shown by the broker, charges already deducted. Not audited.</p>${newHigh ? '<span class="badge lv">▲ NEW EQUITY HIGH</span>' : ''}</div>
     <div class="kpis">${kpi('Capital deployed', inr(T.cap), M.on ? 'cumulative capital' : 'sum of strategy capital')}${kpi('Today', sg(T.day), sp(T.dayR), cls(T.day))}${kpi(fm(M.a.slice(0, 7)), sg(T.mo), sp(T.moR), cls(T.mo))}${kpi('Year to date', sg(T.yr), sp(T.yrR), cls(T.yr))}${kpi('All-time', sg(T.total), sp(T.cap ? T.total / T.cap * 100 : 0), cls(T.total))}${kpi('Max drawdown', pc(T.max), sg(T.maxA), 'neg')}${kpi('Win days', wr.toFixed(1) + '%', 'of trading days')}${kpi('Equity high', sg(hi), last === hi && hi > 0 ? 'closed at the peak' : 'peak so far')}</div>
     ${pview()}
     <div class="card"><h2>Report <span class="badge lv">LIVE</span></h2><div class="scroll">${table}</div><p class="sub">${M.on ? 'ROI and drawdown of every column use the cumulative capital.' : 'ROI and drawdown of each strategy use its own capital.'} Drawdown = fall from the highest equity (capital + cumulative P/L), in % of that peak.</p></div>
     <div class="grid2"><div class="card"><h2>Cumulative return (%) <span class="badge lv">LIVE</span></h2><div id="lv_eq"></div></div><div class="card"><h2>Portfolio drawdown (%) <span class="badge lv">LIVE</span></h2><div id="lv_dd"></div></div></div>
     <div class="card"><h2>Monthly net P&amp;L <span class="badge lv">LIVE</span></h2><div id="lv_mon"></div></div><div class="card"><h2>P&amp;L calendar <span class="badge lv">LIVE</span></h2><div id="lv_cal"></div></div>
     <div class="card"><h2>Strategies</h2><div class="scroll"><table class="t"><tr><th>Name</th><th>Exchange</th><th>Capital</th><th>Multiplier</th><th>Share code</th></tr>${strat}</table></div></div>
     ${notes.length ? `<div class="card"><h2>Notes</h2>${notes.map(n => `<div class="note">${esc(n)}</div>`).join('')}</div>` : ''}
     ${links.length ? `<div class="card"><h2>Follow &amp; join</h2><div class="row">${links.map(l => `<a class="linkbtn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`).join('')}</div></div>` : ''}`;
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
        const b = e.target.closest('[data-lmt],[data-lsel],[data-copy]'); if (!b) return;
        if (b.dataset.lmt) st.mt = b.dataset.lmt;
        else if (b.dataset.lsel) st.sel[st.mt] = b.dataset.lsel;
        else { try { navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1500); } catch (x) { prompt('Copy this code', b.dataset.copy); } return; }
        render(el, D);
      });
    }
  }
  function csv() {
    if (!M) return;
    C.download('srisuutra_live_daily.csv', C.csv([['date', ...M.S.map(s => s.name), 'total', 'label'], ...M.dates.map((d, i) => [d, ...M.rows.map(r => r.v[i].toFixed(2)), M.tv[i].toFixed(2), 'LIVE'])]));
  }
  root.SLive = { render, csv };
})(window);
