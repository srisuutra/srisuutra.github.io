/* Tiny dependency-free SVG charts + number formats. */
(function (root) {
  'use strict';
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inr = (n, d) => (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d });
  const pc = n => (isFinite(n) ? n : 0).toFixed(2) + '%';
  const cls = n => (n > 0.005 ? 'pos' : n < -0.005 ? 'neg' : '');
  const POS = '#0a8f55', NEG = '#d12c2c', GOLD = '#c9a43b', NAVY = '#1c2a4a';
  const nice = (lo, hi) => { if (hi === lo) { hi = lo + 1; } return [lo, hi]; };

  function tipFor(box) {
    let t = box.querySelector('.tip'); if (!t) { t = document.createElement('div'); t.className = 'tip'; box.appendChild(t); } return t;
  }

  /* series: [{name,color,vals[],area}]; labels[] one per point; fmt(v)->string */
  function line(box, o) {
    const W = 720, H = o.height || 250, L = 56, R = 10, T = 10, B = 24, S = o.series, n = S[0] ? S[0].vals.length : 0;
    if (!n) { box.innerHTML = '<p class="sub">No data yet.</p>'; return; }
    let lo = Infinity, hi = -Infinity; S.forEach(s => s.vals.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
    if (o.zero !== false) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    [lo, hi] = nice(lo, hi); const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const X = i => L + (n > 1 ? i / (n - 1) : 0.5) * (W - L - R), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const f = o.fmt || (v => v.toFixed(2));
    let g = '';
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".12"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${esc(f(v))}</text>`; }
    if (lo < 0 && hi > 0) g += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="currentColor" opacity=".45" stroke-dasharray="3"/>`;
    const lab = o.labels || [];
    [0, Math.floor((n - 1) / 2), n - 1].forEach((i, j) => { if (lab[i] != null) g += `<text x="${X(i)}" y="${H - 6}" text-anchor="${j == 0 ? 'start' : j == 2 ? 'end' : 'middle'}">${esc(lab[i])}</text>`; });
    S.forEach(s => {
      const pts = s.vals.map((v, i) => X(i) + ',' + Y(v)).join(' ');
      if (s.area !== false) g += `<polygon points="${X(0)},${Y(0)} ${pts} ${X(n - 1)},${Y(0)}" fill="${s.color}" opacity=".14"/>`;
      g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
    });
    g += `<line id="hv" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="currentColor" opacity=".4" style="display:none"/>`;
    box.classList.add('chart'); box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'chart')}">${g}</svg>`;
    const svg = box.querySelector('svg'), tip = tipFor(box), hv = svg.querySelector('#hv');
    svg.addEventListener('mousemove', e => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
      const i = Math.max(0, Math.min(n - 1, Math.round((px - L) / (W - L - R) * (n - 1))));
      hv.setAttribute('x1', X(i)); hv.setAttribute('x2', X(i)); hv.style.display = '';
      tip.innerHTML = esc(lab[i] || '') + '<br>' + S.map(s => esc(s.name) + ': ' + esc(f(s.vals[i]))).join('<br>');
      tip.style.display = 'block'; tip.style.left = Math.min(r.width - 140, X(i) / W * r.width + 10) + 'px'; tip.style.top = '8px';
    });
    svg.addEventListener('mouseleave', () => { tip.style.display = 'none'; hv.style.display = 'none'; });
  }

  /* bars: labels[], vals[] ; colours by sign unless o.color */
  function bars(box, o) {
    const V = o.vals, n = V.length; if (!n) { box.innerHTML = '<p class="sub">No data yet.</p>'; return; }
    const W = 720, H = o.height || 220, L = 56, R = 10, T = 10, B = 40; let lo = Math.min(0, ...V), hi = Math.max(0, ...V); [lo, hi] = nice(lo, hi);
    const Y = v => T + (hi - v) / (hi - lo) * (H - T - B), bw = (W - L - R) / n, f = o.fmt || (v => v.toFixed(2));
    let g = '';
    for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".12"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${esc(f(v))}</text>`; }
    V.forEach((v, i) => {
      const x = L + i * bw + bw * 0.15, w = bw * 0.7, y = v >= 0 ? Y(v) : Y(0), h = Math.max(1, Math.abs(Y(v) - Y(0)));
      g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${o.color || (v >= 0 ? POS : NEG)}" rx="2"><title>${esc((o.labels[i] || '') + ': ' + f(v))}</title></rect>`;
      if (n <= 14 || i % Math.ceil(n / 14) === 0) g += `<text x="${x + w / 2}" y="${H - 24}" text-anchor="middle">${esc(o.labels[i] || '')}</text>`;
    });
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="currentColor" opacity=".5"/>`;
    box.classList.add('chart'); box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'bar chart')}">${g}</svg>`;
  }

  /* P&L calendar: one small Mon-Fri grid per month, months laid out side by side. dates/nets parallel arrays. */
  function calendar(box, dates, nets, capital) {
    if (!dates.length) { box.innerHTML = '<p class="sub">No data yet.</p>'; return; }
    const mx = Math.max(...nets.map(Math.abs), 1), months = {};
    dates.forEach((d, i) => { const m = d.slice(0, 7); (months[m] = months[m] || []).push([d, nets[i]]); });
    let h = '<div class="calwrap">';
    Object.keys(months).forEach(m => {
      const tot = months[m].reduce((t, x) => t + x[1], 0);
      h += `<div class="calm"><div class="calh"><b>${new Date(m + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</b><span class="${cls(tot)}">${inr(tot)}</span></div><div class="cal">` + ['M', 'T', 'W', 'T', 'F'].map(x => `<div class="h">${x}</div>`).join('');
      const first = new Date(months[m][0][0] + 'T00:00:00Z').getUTCDay(); let col = (first + 6) % 7; if (col > 4) col = 0;
      for (let i = 0; i < col; i++) h += '<div class="e"></div>';
      let wk = col;
      months[m].forEach(([d, v]) => {
        const dow = (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7; if (dow > 4) return;
        while (wk % 5 !== dow) { h += '<div class="e"></div>'; wk++; }
        const a = Math.min(0.85, 0.12 + Math.abs(v) / mx * 0.7), bg = Math.abs(v) < 0.5 ? 'var(--inp)' : v > 0 ? `rgba(10,143,85,${a})` : `rgba(209,44,44,${a})`;
        h += `<div style="background:${bg}" title="${d}: ${inr(v)}${capital ? ' (' + pc(v / capital * 100) + ')' : ''}"><b>${+d.slice(8)}</b><small>${Math.abs(v) < 0.5 ? '-' : inr(v)}</small></div>`; wk++;
      });
      h += '</div></div>';
    });
    box.innerHTML = h + '</div>';
  }

  /* simple horizontal comparison bars: items [{l,v}] */
  function hbars(box, items, fmt) {
    if (!items.length) { box.innerHTML = '<p class="sub">No data.</p>'; return; }
    const mx = Math.max(...items.map(i => Math.abs(i.v)), 1);
    box.innerHTML = items.map(i => `<div style="display:grid;grid-template-columns:90px 1fr 100px;gap:8px;align-items:center;margin:3px 0;font-size:12px"><span>${esc(i.l)}</span><div style="background:var(--line);height:12px;border-radius:3px;position:relative"><i style="position:absolute;left:${i.v >= 0 ? 50 : 50 - Math.abs(i.v) / mx * 50}%;width:${Math.abs(i.v) / mx * 50}%;height:100%;background:${i.v >= 0 ? POS : NEG};border-radius:3px"></i></div><span class="${cls(i.v)}">${esc(fmt ? fmt(i.v) : i.v)}</span></div>`).join('');
  }

  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function csv(rows) { return rows.map(r => r.map(c => { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\n'); }

  root.GC = { esc, inr, pc, cls, line, bars, calendar, hbars, download, csv, POS, NEG, GOLD, NAVY };
})(window);
