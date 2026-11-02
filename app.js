/* Baldwin County Development Tracker — front end. Data: data.php?f=dashboard|geo */
(async function () {
  const css = getComputedStyle(document.documentElement);
  const C = (v) => css.getPropertyValue(v).trim();
  const S1 = C('--series-1'), S2 = C('--series-2'), S3 = C('--series-3'), CRIT = C('--critical');
  const INK2 = C('--text-secondary'), MUTED = C('--muted'), GRID = C('--grid'), AXIS = C('--axis'), SURF = C('--surface-1');
  const GRAY_RAMP = ['#f0efec', '#d9d7cf', '#b5b2a6', '#8c897d', '#5f5d55'];
  const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

  const [D, G] = await Promise.all(['dashboard', 'geo'].map((f) => fetch(`data/${f}.json`).then((r) => r.json())));
  const Y = D.years;
  const fmt = (n) => (n == null ? '—' : Math.round(n).toLocaleString());
  const money = (n) => (n ? '$' + Math.round(n).toLocaleString() : '—');
  const pct = (n, d = 0) => (n == null || !isFinite(n) ? '—' : (n >= 0 ? '+' : '') + (n * 100).toFixed(d) + '%');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);
  const isConstruction = (s) => s.id.startsWith('ALR1');
  const isActive = (s) => s.status === 'Effective' || s.status === 'Admin Continued';
  const wasCited = (s) => s.informal > 0 || s.formal > 0 || s.penalty > 0;
  const echoLink = (id) => `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(id)}`;
  const ZIP_TOWN = { 36507: 'Bay Minette', 36511: 'Bon Secour', 36526: 'Daphne', 36527: 'Spanish Fort', 36530: 'Elberta',
    36532: 'Fairhope', 36535: 'Foley', 36542: 'Gulf Shores', 36549: 'Lillian', 36551: 'Loxley', 36555: 'Magnolia Springs',
    36561: 'Orange Beach', 36562: 'Perdido', 36567: 'Robertsdale', 36574: 'Seminole', 36576: 'Silverhill', 36578: 'Stapleton',
    36579: 'Stockton', 36580: 'Summerdale' };
  const wsByHuc = Object.fromEntries(D.watersheds.map((w) => [w.huc, w]));

  // ---------- Chart.js defaults: thin marks, recessive grid, hover on ----------
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = MUTED;
  Chart.defaults.borderColor = GRID;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.plugins.legend.display = false;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: SURF, titleColor: '#0b0b0b', bodyColor: INK2, borderColor: 'rgba(11,11,11,.12)',
    borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true,
  });
  const axes = (opts = {}) => ({
    x: { grid: { display: false }, border: { color: AXIS }, stacked: !!opts.stacked, ticks: { maxRotation: 0, autoSkipPadding: 8 } },
    y: { grid: { color: GRID }, border: { display: false }, beginAtZero: true, stacked: !!opts.stacked,
      ticks: { callback: opts.yfmt || ((v) => v.toLocaleString()) } },
  });
  const legend = (id, items) => {
    document.getElementById(id).innerHTML = items
      .map(([label, color, kind]) => `<span><i class="${kind || ''}" style="${kind === 'dash' ? 'border-color' : 'background'}:${color}"></i>${label}</span>`).join('');
  };
  const bar = (color) => ({ backgroundColor: color, borderColor: SURF, borderWidth: { top: 0, left: 1, right: 1, bottom: 0 },
    borderRadius: 4, borderSkipped: 'start', maxBarThickness: 36 });
  const hbar = (id, labels, data, color, valueFmt = fmt, tickFmt = valueFmt) => new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets: [{ data, ...bar(color), borderRadius: 4, maxBarThickness: 18 }] },
    options: { indexAxis: 'y', interaction: { mode: 'nearest', axis: 'y', intersect: false },
      scales: { x: { grid: { color: GRID }, border: { display: false }, ticks: { maxRotation: 0, maxTicksLimit: 6, callback: (v) => tickFmt(v) } },
        y: { grid: { display: false }, border: { color: AXIS }, ticks: { color: INK2, autoSkip: false } } },
      plugins: { tooltip: { callbacks: { label: (c) => ' ' + valueFmt(c.raw) } } } },
  });

  // ---------- KPIs + leads ----------
  const pop15 = D.county.pop['2015'], pop25 = D.county.pop['2025'];
  const units = sum(D.county.permits.map((p) => p.total));
  const netMig = sum(D.migration.map((m) => m.net_people));
  const cons = D.sites.filter(isConstruction);
  const consSince = cons.filter((s) => s.year >= 2015);
  const cited = D.sites.filter(wasCited);
  const fined = D.sites.filter((s) => s.penalty > 0);
  const totalPen = sum(fined.map((s) => s.penalty));
  const impairedWaters = D.waters.filter((w) => w.impaired).length;
  const kpi = (lbl, val, sub, src) => `<div class="kpi"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub}</div><a class="kpi-src" href="#src-${src}">Source</a></div>`;
  document.getElementById('kpis').innerHTML = [
    kpi('Population, 2025', fmt(pop25), `<span class="up">${pct(pop25 / pop15 - 1)}</span> since 2015 (${fmt(pop15)})`, 'pep'),
    kpi('Housing units permitted', fmt(units), '2015–2025, countywide', 'bps'),
    kpi('Net new residents by migration', '+' + fmt(netMig), 'IRS, 2015–2023 filing years', 'irs-mig'),
    kpi('Construction sites (1+ acre)', fmt(consSince.length), 'stormwater permits starting 2015 or later', 'echo'),
    kpi('Sites cited by regulators', fmt(cited.length), `${fined.length} fined · ${money(totalPen)} in penalties`, 'echo'),
    kpi('Impaired water segments', fmt(impairedWaters), `of ${fmt(D.waters.length)} assessed in these watersheds`, 'attains'),
  ].join('');

  const cityGrowth = D.cities.filter((c) => c.pop[0] && c.name !== 'Unincorporated')
    .map((c) => ({ ...c, g: c.pop[10] / c.pop[0] - 1 })).sort((a, b) => b.g - a.g);
  const topPermitCity = [...D.cities].sort((a, b) => sum(b.permits) - sum(a.permits));
  const zipG = D.zips.map((z) => ({ zip: z.zip, g: z.pop[9] / z.pop[0] - 1, add: z.pop[9] - z.pop[0] })).sort((a, b) => b.g - a.g);
  const wsCited = [...D.watersheds].sort((a, b) => b.cited - a.cited)[0];
  const wsBusy = D.watersheds[0];
  const outState = D.origin_states.slice(1).reduce((a, s) => a + s.people, 0);
  const lastMig = D.migration[D.migration.length - 1];
  const topFine = [...fined].sort((a, b) => b.penalty - a.penalty)[0];
  const y25 = D.outlook.permits_2026_ytd[2025], y26 = D.outlook.permits_2026_ytd[2026];
  const leads = [
    `<b>${cityGrowth[0].name}</b> grew fastest: ${pct(cityGrowth[0].g)} in population since 2015 (${fmt(cityGrowth[0].pop[0])} → ${fmt(cityGrowth[0].pop[10])}); <b>${cityGrowth[1].name}</b> was next at ${pct(cityGrowth[1].g)}.`,
    `<b>${topPermitCity[0].name === 'Unincorporated' ? 'Unincorporated Baldwin' : topPermitCity[0].name}</b> permitted the most housing (${fmt(sum(topPermitCity[0].permits))} units); among cities, <b>${topPermitCity[1].name}</b> led with ${fmt(sum(topPermitCity[1].permits))}.`,
    `ZIP <b>${zipG[0].zip} (${ZIP_TOWN[zipG[0].zip]})</b> added the most people relative to its size (${pct(zipG[0].g)}, 2014–2023).`,
    wsBusy === wsCited ? `<b>${wsBusy.name}</b> watershed has had both the most construction sites (${fmt(wsBusy.sites)}) and the most sites cited by regulators (${wsCited.cited}).` : `<b>${wsBusy.name}</b> has had the most construction sites of any watershed (${fmt(wsBusy.sites)}); <b>${wsCited.name}</b> has the most sites cited by regulators (${wsCited.cited}).`,
    `Biggest fine: <b>${money(topFine.penalty)}</b> at ${esc(topFine.name)} (${esc(topFine.operator || 'operator not listed')}), ${esc(topFine.city)}.`,
    `In the latest IRS year, newcomer households reported <b>${money(lastMig.in_agi_per_hh)}</b> average income vs. ${money(lastMig.stay_agi_per_hh)} for households already here. About ${Math.round(outState / (outState + D.origin_states[0].people) * 100)}% of identifiable movers came from out of state.`,
    `Housing permits are <b>${pct(y26.total / y25.total - 1)}</b> in Jan–Sep 2026 vs. the same months of 2025 (${fmt(y26.total)} vs ${fmt(y25.total)} units).`,
  ];
  document.querySelector('#leads ul').innerHTML = leads.map((l) => `<li>${l}</li>`).join('');

  // ---------- Growth ----------
  const permLabels = [...Y.map(String), "'26 YTD"];
  legend('lg-permits', [['Single-family', S1], ['Multifamily (2+ units)', S2]]);
  new Chart(document.getElementById('c-permits'), {
    type: 'bar',
    data: { labels: permLabels, datasets: [
      { label: 'Single-family', data: [...D.county.permits.map((p) => p.single), y26.single], ...bar(S1) },
      { label: 'Multifamily', data: [...D.county.permits.map((p) => p.multi), y26.multi], ...bar(S2) },
    ] },
    options: { scales: { ...axes({ stacked: true }), x: { ...axes({ stacked: true }).x, ticks: { maxRotation: 0, autoSkip: false, font: { size: 11 } } } }, interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { callbacks: { footer: (items) => 'Total: ' + fmt(sum(items.map((i) => i.raw))) + ' units' } } } },
  });

  hbar('c-zips', zipG.map((z) => `${z.zip} ${ZIP_TOWN[z.zip] || ''}`), zipG.map((z) => +(z.g * 100).toFixed(1)), S1, (v) => v + '%');

  function heatTable(el, cols, rows, opts = {}) {
    const state = { key: opts.sortKey ?? null, asc: false };
    function render() {
      const sorted = [...rows];
      if (state.key != null) {
        const col = cols[state.key];
        sorted.sort((a, b) => {
          const va = col.sort ? col.sort(a) : col.v(a), vb = col.sort ? col.sort(b) : col.v(b);
          const r = typeof va === 'string' ? va.localeCompare(vb) : (va ?? -Infinity) - (vb ?? -Infinity);
          return state.asc ? r : -r;
        });
      }
      el.innerHTML = '<thead><tr>' + cols.map((c, i) => `<th data-i="${i}" class="${c.l ? 'l' : ''} ${state.key === i ? 'sorted' + (state.asc ? ' asc' : '') : ''}">${c.h}</th>`).join('') + '</tr></thead><tbody>' +
        sorted.map((r) => `<tr class="${opts.onClick ? 'clickable' : ''}" data-k="${esc(opts.rowKey ? opts.rowKey(r) : '')}">` + cols.map((c) => {
          const val = c.v(r);
          const html = c.f ? c.f(val, r) : esc(val);
          if (c.heat) {
            const idx = c.heat(val);
            return `<td class="h ${idx >= 4 ? 'dark' : ''}" style="background:${idx >= 0 ? SEQ[idx] : 'transparent'}">${html}</td>`;
          }
          return `<td class="${c.l ? 'l' : ''} ${c.wrap ? 'wrap-cell' : ''}">${html}</td>`;
        }).join('') + '</tr>').join('') + '</tbody>';
      el.querySelectorAll('th').forEach((th) => th.onclick = () => {
        const i = +th.dataset.i;
        state.asc = state.key === i ? !state.asc : false;
        state.key = i;
        render();
      });
      if (opts.onClick) el.querySelectorAll('tbody tr').forEach((tr) => tr.onclick = () => opts.onClick(tr.dataset.k));
    }
    render();
    return { rerender: (newRows) => { rows = newRows; render(); } };
  }

  const maxCell = Math.max(...D.cities.flatMap((c) => c.permits));
  const heatIdx = (v) => (v ? Math.min(6, Math.floor(Math.sqrt(v / maxCell) * 7)) : -1);
  const cityName = (c) => c.name === 'Unincorporated' ? 'Unincorporated county' : c.name;
  heatTable(document.getElementById('t-cities'), [
    { h: 'City', l: 1, v: cityName },
    { h: 'Pop. 2015', v: (c) => c.pop[0], f: fmt },
    { h: 'Pop. 2025', v: (c) => c.pop[10], f: fmt },
    { h: 'Growth', v: (c) => (c.pop[0] ? c.pop[10] / c.pop[0] - 1 : null), f: (v) => pct(v) },
    ...Y.map((y, i) => ({ h: String(y), v: (c) => c.permits[i], f: fmt, heat: heatIdx })),
    { h: 'Total units', v: (c) => sum(c.permits), f: (v) => `<b>${fmt(v)}</b>` },
  ], D.cities, { sortKey: 15 });

  // ---------- Who's moving in ----------
  const migLabels = D.migration.map((m) => m.label);
  legend('lg-mig', [['Moved in', S1], ['Moved out', S2]]);
  new Chart(document.getElementById('c-mig'), {
    type: 'bar',
    data: { labels: migLabels, datasets: [
      { label: 'Moved in', data: D.migration.map((m) => m.in_people), ...bar(S1) },
      { label: 'Moved out', data: D.migration.map((m) => m.out_people), ...bar(S2) },
    ] },
    options: { scales: axes(), interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { callbacks: { footer: (items) => 'Net gain: +' + fmt(D.migration[items[0].dataIndex].net_people) + ' people' } } } },
  });
  legend('lg-inc', [['Newcomer households', S1, 'line'], ['Households that stayed', S2, 'line']]);
  const line = (color, extra = {}) => ({ borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 3,
    pointHoverRadius: 5, pointBorderColor: SURF, pointBorderWidth: 2, tension: 0, ...extra });
  new Chart(document.getElementById('c-inc'), {
    type: 'line',
    data: { labels: migLabels, datasets: [
      { label: 'Newcomers', data: D.migration.map((m) => m.in_agi_per_hh), ...line(S1) },
      { label: 'Stayed', data: D.migration.map((m) => m.stay_agi_per_hh), ...line(S2) },
    ] },
    options: { scales: { ...axes({ yfmt: (v) => '$' + (v / 1000) + 'k' }), y: { ...axes().y, beginAtZero: false, ticks: { callback: (v) => '$' + v / 1000 + 'k' } } },
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${money(c.raw)}` } } } },
  });
  hbar('c-origins', D.origins.map((o) => o.name), D.origins.map((o) => o.people), S1);
  const st = D.origin_states.slice(1, 16);
  hbar('c-states', st.map((s) => s.state), st.map((s) => s.people), S1);

  // ---------- Map ----------
  const map = L.map('map', { scrollWheelZoom: false, preferCanvas: true, zoomSnap: 0.25 }).setView([30.72, -87.75], 9);
  const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  L.tileLayer(esri + 'World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxZoom: 16 }).addTo(map);
  map.createPane('labels').style.zIndex = 450;
  map.getPane('labels').style.pointerEvents = 'none';
  L.tileLayer(esri + 'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { pane: 'labels', maxZoom: 16 }).addTo(map);
  map.createPane('shade').style.zIndex = 350;
  map.createPane('waters').style.zIndex = 420;
  const countyLayer = L.geoJSON(G.county, { interactive: false, style: { color: '#52514e', weight: 1.5, fill: false, dashArray: '4 3' } }).addTo(map);
  map.fitBounds(countyLayer.getBounds(), { padding: [4, 4] });

  const zipStat = Object.fromEntries(zipG.map((z) => [z.zip, z]));
  let shadeLayer = null, sitesLayer = null;
  const watersLayer = L.geoJSON(G.waters, {
    pane: 'waters',
    filter: (f) => f.properties.impaired,
    style: (f) => f.geometry.type.includes('Polygon')
      ? { color: CRIT, weight: 1, fillColor: CRIT, fillOpacity: 0.12 }
      : { color: CRIT, weight: 2, opacity: 0.85 },
    onEachFeature: (f, l) => l.bindPopup(`<h4>${esc(f.properties.name)}</h4><div class="tag crit">Impaired</div>
      <p>Causes: ${f.properties.causes.length ? f.properties.causes.map((c) => c.replace(/_/g, ' ')).join(', ') : 'see report'}</p>
      <a href="${esc(f.properties.link)}" target="_blank" rel="noopener">EPA water report ↗</a>`),
  }).addTo(map);

  function quantileBreaks(vals) {
    const s = vals.filter((v) => v != null).sort((a, b) => a - b);
    return [0.2, 0.4, 0.6, 0.8].map((q) => s[Math.floor(q * (s.length - 1))]);
  }
  const classify = (v, br) => br.findIndex((b) => v <= b) === -1 ? 4 : br.findIndex((b) => v <= b);

  function drawShade() {
    if (shadeLayer) map.removeLayer(shadeLayer);
    const mode = document.getElementById('f-shade').value;
    const lg = document.getElementById('lg-shade');
    if (mode === 'none') { shadeLayer = null; lg.innerHTML = ''; return; }
    let fc, val, label, fmtv, popup;
    if (mode === 'zip-growth') {
      fc = G.zips; val = (p) => zipStat[p.zip]?.g; label = 'ZIP population growth, 2014–2023'; fmtv = (v) => pct(v);
      popup = (p) => zipStat[p.zip] ? `<h4>ZIP ${p.zip} ${ZIP_TOWN[p.zip] || ''}</h4><div class="kv"><span>Growth</span><span>${pct(zipStat[p.zip].g, 1)}</span><span>People added</span><span>${fmt(zipStat[p.zip].add)}</span></div>` : `<h4>ZIP ${p.zip}</h4>Data suppressed (small ZIP)`;
    } else {
      fc = G.watersheds;
      val = mode === 'ws-density' ? (p) => wsByHuc[p.huc]?.density : (p) => wsByHuc[p.huc]?.cited;
      label = mode === 'ws-density' ? 'Construction sites per 100 km²' : 'Sites cited by regulators';
      fmtv = (v) => fmt(v);
      popup = (p) => wsPopup(wsByHuc[p.huc]);
    }
    const br = quantileBreaks(fc.features.map((f) => val(f.properties)));
    shadeLayer = L.geoJSON(fc, {
      pane: 'shade',
      style: (f) => {
        const v = val(f.properties);
        return { color: '#898781', weight: 0.8, fillColor: v == null ? 'transparent' : GRAY_RAMP[classify(v, br)], fillOpacity: v == null ? 0 : 0.7 };
      },
      onEachFeature: (f, l) => { l.bindPopup(() => popup(f.properties)); l.on('mouseover', () => l.setStyle({ weight: 2.5, color: '#0b0b0b' })); l.on('mouseout', () => shadeLayer.resetStyle(l)); },
    }).addTo(map);
    const edges = [Math.min(...fc.features.map((f) => val(f.properties)).filter((v) => v != null)), ...br];
    lg.innerHTML = `<h4>${label}</h4><div class="ramp">${GRAY_RAMP.map((c) => `<div style="background:${c}"></div>`).join('')}</div>
      <div class="ramp-lbl"><span>${fmtv(edges[0])}</span><span>${fmtv(br[1])}</span><span>${fmtv(br[3])}+</span></div>`;
  }

  function wsPopup(w) {
    if (!w) return 'No data';
    const causes = Object.keys(w.causes).slice(0, 4).map((c) => c.replace(/_/g, ' ')).join(', ') || 'none listed';
    return `<h4>${esc(w.name)}</h4><div class="muted">HUC ${w.huc} · drains to ${w.system}</div><div class="kv">
      <span>Construction sites</span><span>${fmt(w.sites)} (${fmt(w.recent)} since 2021)</span>
      <span>Active now</span><span>${fmt(w.active)}</span>
      <span>Residential / commercial</span><span>${fmt(w.res)} / ${fmt(w.com)}</span>
      <span>Sites cited</span><span>${fmt(w.cited)}</span><span>Penalties</span><span>${money(w.penalties)}</span>
      <span>Impaired waters</span><span>${w.impaired} of ${w.waters} assessed</span><span>Causes</span><span>${esc(causes)}</span></div>`;
  }

  const CAT_COLOR = { Residential: S1, Commercial: S2 };
  const catColor = (c) => CAT_COLOR[c] || S3;
  const years = [...new Set(cons.map((s) => s.year).filter(Boolean))].sort();
  const fFrom = document.getElementById('f-from'), fTo = document.getElementById('f-to');
  years.forEach((y) => { fFrom.add(new Option(y, y)); fTo.add(new Option(y, y)); });
  fFrom.value = 2015; fTo.value = years[years.length - 1];

  function sitePopup(s) {
    return `<h4>${esc(s.name)}</h4><div class="muted">${esc(s.addr)}, ${esc(s.city)} ${esc(s.zip)}</div><div class="kv">
      <span>Operator</span><span>${esc(s.operator || '—')}</span>
      <span>Type</span><span>${esc(s.cat)}${s.naics ? ' · ' + esc(s.naics) : ''}</span>
      <span>Started</span><span>${s.year ?? '—'}${s.year_est ? ' <span class="est">(est.)</span>' : ''}</span>
      <span>Permit status</span><span>${esc(s.status)}</span>
      <span>Watershed</span><span>${esc(wsByHuc[s.huc]?.name || '—')}</span>
      <span>Inspections</span><span>${s.insp}${s.last_insp ? ' (last ' + s.last_insp + ')' : ''}</span>
      <span>Enforcement</span><span>${s.informal} informal, ${s.formal} formal</span>
      <span>Penalties</span><span>${money(s.penalty)}${s.last_penalty ? ' (' + s.last_penalty + ')' : ''}</span>
      <span>Drains to impaired water</span><span>${s.impaired ? 'Yes' : 'No / unknown'}</span></div>
      <p><a href="${echoLink(s.id)}" target="_blank" rel="noopener">EPA ECHO record ${esc(s.id)} ↗</a></p>`;
  }

  function filteredSites() {
    const from = +fFrom.value, to = +fTo.value, cat = document.getElementById('f-cat').value;
    const active = document.getElementById('f-active').checked, citedOnly = document.getElementById('f-cited').checked;
    return D.sites.filter((s) => {
      if (citedOnly) { if (!wasCited(s)) return false; } else if (!isConstruction(s)) return false;
      if (isConstruction(s)) {
        if (s.year == null || s.year < from || s.year > to) return false;
        if (cat === 'other' ? ['Residential', 'Commercial'].includes(s.cat) : cat !== 'all' && s.cat !== cat) return false;
      } else if (cat !== 'all') return false;
      if (active && !isActive(s)) return false;
      return true;
    });
  }

  function drawSites() {
    if (sitesLayer) map.removeLayer(sitesLayer);
    const list = filteredSites().sort((a, b) => wasCited(a) - wasCited(b));
    sitesLayer = L.layerGroup(list.map((s) => {
      const c = wasCited(s);
      const m = s.penalty > 0
        ? L.marker([s.lat, s.lon], { icon: L.divIcon({ className: 'fine-icon', html: '▲', iconSize: [15, 15] }), zIndexOffset: 1000 })
        : L.circleMarker([s.lat, s.lon], { radius: c ? 6 : 4, color: c ? '#0b0b0b' : SURF, weight: c ? 2 : 1,
          fillColor: isConstruction(s) ? catColor(s.cat) : '#898781', fillOpacity: 0.9 });
      return m.bindPopup(() => sitePopup(s));
    })).addTo(map);
    const nc = list.filter(wasCited).length;
    document.getElementById('f-count').textContent = `${fmt(list.length)} sites shown · ${fmt(nc)} cited`;
  }

  document.getElementById('map-legend').innerHTML = `
    <section id="lg-shade"></section>
    <section><h4>Construction sites</h4>
      <div class="row"><span class="sw" style="background:${S1}"></span>Residential</div>
      <div class="row"><span class="sw" style="background:${S2}"></span>Commercial</div>
      <div class="row"><span class="sw" style="background:${S3}"></span>Roads, utilities, clearing &amp; unspecified</div>
      <div class="row"><span class="sw" style="background:#898781"></span>Wastewater / unpermitted (cited only)</div></section>
    <section><h4>Enforcement</h4>
      <div class="row"><span class="sw" style="background:#fff;border:2px solid #0b0b0b"></span>Cited (warning, NOV or order)</div>
      <div class="row"><span style="width:14px;text-align:center">▲</span>Fined</div></section>
    <section><h4>Water quality</h4>
      <div class="row"><span style="width:14px;height:3px;background:${CRIT}"></span>Impaired water (EPA 303(d)/ATTAINS)</div></section>
    <p class="muted">Click any dot, water or shaded area for details. Scroll-zoom is off; use +/− or double-click.</p>`;

  ['f-shade'].forEach((id) => document.getElementById(id).onchange = drawShade);
  ['f-from', 'f-to', 'f-cat', 'f-active', 'f-cited'].forEach((id) => document.getElementById(id).onchange = drawSites);
  document.getElementById('f-waters').onchange = (e) => e.target.checked ? watersLayer.addTo(map) : map.removeLayer(watersLayer);
  drawShade();
  drawSites();

  function zoomToHuc(huc) {
    const f = G.watersheds.features.find((x) => x.properties.huc === huc);
    if (!f) return;
    document.getElementById('map-sec').scrollIntoView();
    const l = L.geoJSON(f);
    map.fitBounds(l.getBounds(), { padding: [20, 20] });
    L.popup().setLatLng(l.getBounds().getCenter()).setContent(wsPopup(wsByHuc[huc])).openOn(map);
  }

  // ---------- Watersheds ----------
  const sysYears = [...Y, 2026];
  const sysSeries = (sys) => sysYears.map((_, i) => sum(D.watersheds.filter((w) => w.system === sys).map((w) => w.by_year[i])));
  legend('lg-sys', [['Mobile Bay watersheds', S1, 'line'], ['Perdido Bay watersheds', S2, 'line']]);
  new Chart(document.getElementById('c-sys'), {
    type: 'line',
    data: { labels: sysYears.map((y) => (y === 2026 ? '2026*' : String(y))), datasets: [
      { label: 'Mobile Bay', data: sysSeries('Mobile Bay'), ...line(S1) },
      { label: 'Perdido Bay', data: sysSeries('Perdido Bay'), ...line(S2) },
    ] },
    options: { scales: axes(), interaction: { mode: 'index', intersect: false } },
  });
  const causeTot = {};
  D.waters.forEach((w) => w.causes.forEach((c) => (causeTot[c] = (causeTot[c] || 0) + 1)));
  const causes = Object.entries(causeTot).sort((a, b) => b[1] - a[1]);
  hbar('c-causes', causes.map(([c]) => c.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase())), causes.map(([, n]) => n), S1, (v) => fmt(v) + ' segments', fmt);

  heatTable(document.getElementById('t-ws'), [
    { h: 'Watershed', l: 1, v: (w) => w.name },
    { h: 'Drains to', l: 1, v: (w) => w.system },
    { h: 'Area km²', v: (w) => w.sqkm, f: fmt },
    { h: 'Constr. sites', v: (w) => w.sites, f: fmt },
    { h: 'Per 100 km²', v: (w) => w.density, f: (v) => v.toFixed(0) },
    { h: 'Since 2021', v: (w) => w.recent, f: fmt },
    { h: 'Active now', v: (w) => w.active, f: fmt },
    { h: 'Residential', v: (w) => w.res, f: fmt },
    { h: 'Commercial', v: (w) => w.com, f: fmt },
    { h: 'Sites cited', v: (w) => w.cited, f: (v) => (v ? `<b>${v}</b>` : '0') },
    { h: 'Penalties', v: (w) => w.penalties, f: money },
    { h: 'Impaired / assessed', v: (w) => w.impaired, f: (v, w) => `${v} / ${w.waters}` },
    { h: 'Impairment causes', l: 1, v: (w) => Object.keys(w.causes).slice(0, 3).map((c) => c.replace(/_/g, ' ')).join(', '), wrap: 1 },
  ], D.watersheds.filter((w) => w.system !== 'Other'), { sortKey: 3, rowKey: (w) => w.huc, onClick: zoomToHuc });

  // ---------- Accountability ----------
  const normOp = (s) => s.toUpperCase().replace(/[.,'"]/g, ' ')
    .replace(/\b(L ?L ?C|INC|INCORPORATED|CO|COMPANY|CORP|CORPORATION|LTD|LP|LLP|PLLC|THE)\b/g, ' ')
    .replace(/\bOF (ALABAMA|AL)\b/g, ' ').replace(/[^A-Z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim();
  const ops = {};
  D.sites.filter((s) => s.operator).forEach((s) => {
    const k = normOp(s.operator);
    if (!k) return;
    const o = (ops[k] ||= { key: k, names: {}, sites: 0, recent: 0, cited: 0, informal: 0, formal: 0, penalty: 0, active: 0, list: [] });
    o.names[s.operator] = (o.names[s.operator] || 0) + 1;
    o.sites++; o.recent += s.year >= 2021; o.active += isActive(s);
    if (wasCited(s)) { o.cited++; o.list.push(s.name); }
    o.informal += s.informal; o.formal += s.formal; o.penalty += s.penalty;
  });
  const opRows = Object.values(ops).filter((o) => o.cited > 0)
    .map((o) => ({ ...o, name: Object.entries(o.names).sort((a, b) => b[1] - a[1])[0][0], rate: o.cited / o.sites }));
  const opsTable = heatTable(document.getElementById('t-ops'), [
    { h: 'Operator', l: 1, v: (o) => o.name, wrap: 1 },
    { h: 'Sites (all years)', v: (o) => o.sites, f: fmt },
    { h: 'Since 2021', v: (o) => o.recent, f: fmt },
    { h: 'Active now', v: (o) => o.active, f: fmt },
    { h: 'Sites cited', v: (o) => o.cited, f: (v) => `<b>${v}</b>` },
    { h: 'Informal actions', v: (o) => o.informal, f: fmt },
    { h: 'Formal actions', v: (o) => o.formal, f: fmt },
    { h: 'Penalties', v: (o) => o.penalty, f: money },
    { h: 'Cited sites', l: 1, v: (o) => o.list.slice(0, 3).join('; ') + (o.list.length > 3 ? ` +${o.list.length - 3} more` : ''), wrap: 1 },
  ], opRows, { sortKey: 4 });
  document.getElementById('q-ops').oninput = (e) => {
    const q = e.target.value.toUpperCase();
    opsTable.rerender(opRows.filter((o) => (o.name + ' ' + o.list.join(' ')).toUpperCase().includes(q)));
  };

  const citedRows = cited.map((s) => ({ ...s, wsName: wsByHuc[s.huc]?.name || '—' }));
  const sitesTable = heatTable(document.getElementById('t-sites'), [
    { h: 'Site', l: 1, v: (s) => s.name, f: (v, s) => `<a href="${echoLink(s.id)}" target="_blank" rel="noopener">${esc(v)}</a>`, wrap: 1 },
    { h: 'Operator', l: 1, v: (s) => s.operator || '—', wrap: 1 },
    { h: 'City', l: 1, v: (s) => s.city },
    { h: 'Watershed', l: 1, v: (s) => s.wsName, wrap: 1 },
    { h: 'Type', l: 1, v: (s) => s.cat, wrap: 1 },
    { h: 'Started', v: (s) => s.year, f: (v, s) => (v ?? '—') + (s.year_est ? ' <span class="est">est.</span>' : '') },
    { h: 'Inspections', v: (s) => s.insp, f: fmt },
    { h: 'Informal', v: (s) => s.informal, f: fmt },
    { h: 'Formal', v: (s) => s.formal, f: fmt },
    { h: 'Penalty', v: (s) => s.penalty, f: money },
    { h: 'Last action', v: (s) => s.last_penalty || s.last_formal || s.last_informal || '',
      sort: (s) => { const d = s.last_penalty || s.last_formal || s.last_informal; return d ? +new Date(d) : 0; } },
    { h: 'Impaired water', l: 1, v: (s) => (s.impaired ? 'Yes' : ''), f: (v) => (v ? '<span class="tag crit">Impaired</span>' : '') },
  ], citedRows, { sortKey: 9 });
  document.getElementById('q-sites').oninput = (e) => {
    const q = e.target.value.toUpperCase();
    sitesTable.rerender(citedRows.filter((s) => [s.name, s.operator, s.city, s.wsName, s.id].join(' ').toUpperCase().includes(q)));
  };

  // ---------- Outlook ----------
  const projYears = [...Array(16)].map((_, i) => 2015 + i);
  const actual = projYears.map((y) => (y <= 2025 ? D.county.pop[y] : null));
  const proj = projYears.map((y) => (y >= 2025 ? D.outlook.county_proj[y] : null));
  new Chart(document.getElementById('c-proj'), {
    type: 'line',
    data: { labels: projYears, datasets: [
      { label: 'Census estimate', data: actual, ...line(S1) },
      { label: 'Projection at 2020–25 pace', data: proj, ...line(S1, { borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 4 }) },
    ] },
    options: { scales: { ...axes(), y: { ...axes().y, beginAtZero: false } }, interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { filter: (i) => i.raw != null && !(i.datasetIndex === 1 && i.label === '2025'),
        callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.raw)}` } } } },
  });
  const act = [...D.watersheds].filter((w) => w.active).sort((a, b) => b.active - a.active).slice(0, 12);
  hbar('c-active', act.map((w) => w.name), act.map((w) => w.active), S1, (v) => fmt(v) + ' active sites', fmt);

  const projRows = D.cities.filter((c) => D.outlook.city_proj[c.name]).map((c) => ({ ...c, ...D.outlook.city_proj[c.name] }));
  heatTable(document.getElementById('t-proj'), [
    { h: 'City', l: 1, v: cityName },
    { h: 'Pop. 2020', v: (c) => c.pop[5], f: fmt },
    { h: 'Pop. 2025', v: (c) => c.pop[10], f: fmt },
    { h: 'Annual growth 2020–25', v: (c) => c.cagr, f: (v) => pct(v, 1) },
    { h: '2030 at this pace', v: (c) => c['2030'], f: (v) => `<b>${fmt(v)}</b>` },
    { h: 'Added by 2030', v: (c) => c['2030'] - c.pop[10], f: (v) => '+' + fmt(v) },
    { h: 'Housing units permitted 2021–25', v: (c) => sum(c.permits.slice(6)), f: fmt },
  ], projRows, { sortKey: 3 });

  // ---------- CSV export ----------
  document.querySelectorAll('[data-csv]').forEach((b) => b.onclick = () => {
    const t = document.getElementById(b.dataset.csv);
    const q = (v) => '"' + v.replace(/"/g, '""') + '"';
    const rows = [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => q(c.innerText.replace(/[▾▴]/g, '').trim())).join(','));
    // attribution footer: the credit lines of the sources linked in this table's caption
    const credits = [...t.closest('figure').querySelectorAll('.src-link a')]
      .map((l) => document.querySelector(`${l.getAttribute('href')} .credit q`).textContent);
    rows.push('', q('Source: ' + credits.join('; ')), q(`Data downloaded ${D.generated}. Full source notes: ${location.href.split('#')[0]}#sources`));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = `baldwin-${b.dataset.csv.replace('t-', '')}.csv`;
    a.click();
  });
})();
