'use strict';
/* CRM de clientes — vanilla JS, sin build. Datos vía /api/data (archivo JSON local). */
const CFG = Object.assign({
  googleMapsKey: '', region: '', language: 'es', currency: 'EUR',
  defaultCenter: { lat: 4.711, lng: -74.0721 }, defaultZoom: 12, mapId: 'DEMO_MAP_ID',
}, window.CRM_CONFIG || {});

const STATUSES = [
  ['prospecto', 'Prospecto'], ['contactado', 'Contactado'], ['reunion', 'Reunión'],
  ['propuesta', 'Propuesta'], ['ganado', 'Ganado'], ['perdido', 'Perdido'],
];
const SLABEL = Object.fromEntries(STATUSES);
const CONTACT_TYPES = ['Llamada', 'WhatsApp', 'Email', 'Visita', 'Reunión', 'Otro'];

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => n ? new Intl.NumberFormat('es', { style: 'currency', currency: CFG.currency, maximumFractionDigits: 0 }).format(n) : '—';
const fdate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '';
const badge = (s) => `<span class="badge" style="background:var(--s-${s})">${SLABEL[s]}</span>`;
const safeUrl = (u) => /^https?:\/\//i.test(u || '') ? u : '';

let data = { clients: [] };
let view = 'panel';
let openId = null;
let draft = null; // cliente nuevo aún sin datos: no se guarda hasta que se edita algo
const filt = { q: '', status: '', mode: 'lista' };

/* ---------- persistencia ---------- */
let saveTimer = null, saveFail = false;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const r = await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(r.status);
      saveFail = false;
    } catch (e) { saveFail = true; toast('⚠ No se pudo guardar. ¿Sigue corriendo el servidor?'); }
  }, 250);
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600);
}
const byId = (id) => (draft && draft.id === id ? draft : data.clients.find((c) => c.id === id));
function touch(c) {
  if (c === draft) { // primera edición: el borrador pasa a ser un cliente real
    if (!c.name.trim()) c.name = 'Sin nombre';
    data.clients.unshift(c); draft = null;
  }
  c.updatedAt = new Date().toISOString(); save();
}

function newClient(p = {}) {
  return Object.assign({
    id: uid(), name: '', type: '', address: '', phone: '', website: '', rating: null, ratingCount: null,
    placeId: '', lat: null, lng: null, status: 'prospecto', notes: '', contacts: [],
    nextDate: '', nextText: '', soldSite: '', price: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }, p);
}

/* ---------- navegación ---------- */
function go(v) {
  view = v;
  document.querySelectorAll('.view').forEach((s) => (s.hidden = s.id !== 'v-' + v));
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  render();
  if (v === 'buscar') initMaps();
}
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(b.dataset.view); });

function render() {
  if (view === 'panel') renderPanel();
  else if (view === 'clientes') renderClientes();
  else if (view === 'ajustes') renderAjustes();
  else if (view === 'buscar') refreshSearchSaved();
}

/* ---------- panel ---------- */
function renderPanel() {
  const cs = data.clients;
  const n = (s) => cs.filter((c) => c.status === s).length;
  const active = cs.filter((c) => !['ganado', 'perdido'].includes(c.status)).length;
  const won = cs.filter((c) => c.status === 'ganado');
  const revenue = won.reduce((a, c) => a + (+c.price || 0), 0);
  const pipeline = cs.filter((c) => c.status === 'propuesta').reduce((a, c) => a + (+c.price || 0), 0);
  const closed = n('ganado') + n('perdido');
  const conv = closed ? Math.round((n('ganado') / closed) * 100) + '%' : '—';
  const max = Math.max(1, ...STATUSES.map(([s]) => n(s)));
  const t = today(), in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const rems = cs.filter((c) => c.nextDate && !['ganado', 'perdido'].includes(c.status) && c.nextDate <= in7)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const activity = cs.flatMap((c) => c.contacts.map((h) => ({ c, h }))).sort((a, b) => b.h.date.localeCompare(a.h.date)).slice(0, 6);

  $('#v-panel').innerHTML = `
  <header class="head"><div><h1>Panel</h1><p class="sub">Resumen de tu embudo de ventas.</p></div>
    <button class="btn primary" data-act="new">+ Nuevo cliente</button></header>
  <div class="kpis">
    <div class="card kpi"><small>Clientes totales</small><b>${cs.length}</b></div>
    <div class="card kpi"><small>En el embudo</small><b>${active}</b></div>
    <div class="card kpi"><small>Ganados · conversión ${conv}</small><b>${won.length}</b></div>
    <div class="card kpi"><small>Ingresos</small><b>${money(revenue)}</b></div>
    <div class="card kpi"><small>En propuesta (potencial)</small><b>${money(pipeline)}</b></div>
  </div>
  <div class="grid2">
    <div class="card"><h2>Embudo</h2>${STATUSES.map(([s, l]) => `
      <div class="bar"><span>${l}</span><div><i style="width:${(n(s) / max) * 100}%;background:var(--s-${s})"></i></div><b>${n(s)}</b></div>`).join('')}</div>
    <div class="card"><h2>Próximas acciones</h2>${rems.length ? rems.map((c) => `
      <div class="rem" data-open="${c.id}"><span class="d ${c.nextDate < t ? 'late' : ''}">${c.nextDate < t ? 'Vencida · ' : c.nextDate === t ? 'Hoy' : ''}${c.nextDate === t ? '' : fdate(c.nextDate)}</span>
      <div class="t"><b>${esc(c.name)}</b><span>${esc(c.nextText || 'Sin descripción')}</span></div>${badge(c.status)}</div>`).join('')
      : '<p class="empty">Nada pendiente en los próximos 7 días 🎉</p>'}</div>
  </div>
  <div class="card" style="margin-top:16px"><h2>Actividad reciente</h2>${activity.length ? activity.map(({ c, h }) => `
    <div class="rem" data-open="${c.id}"><span class="d">${fdate(h.date)}</span><div class="t"><b>${esc(c.name)} · ${esc(h.type)}</b><span>${esc(h.text)}</span></div></div>`).join('')
    : '<p class="empty">Aún no has registrado contactos.</p>'}</div>`;
}

/* ---------- clientes: lista / tablero ---------- */
function filtered() {
  const q = filt.q.trim().toLowerCase();
  return data.clients.filter((c) => (!filt.status || c.status === filt.status) &&
    (!q || [c.name, c.address, c.type, c.phone, c.soldSite].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
function renderClientes() {
  const el = $('#v-clientes');
  if (!el.dataset.ready) {
    el.dataset.ready = 1;
    el.innerHTML = `<header class="head"><div><h1>Clientes</h1><p class="sub" id="c-count"></p></div>
      <button class="btn primary" data-act="new">+ Nuevo cliente</button></header>
      <div class="tools"><input id="f-q" type="search" placeholder="Buscar por nombre, zona, teléfono…" aria-label="Buscar clientes">
      <select id="f-s" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${STATUSES.map(([s, l]) => `<option value="${s}">${l}</option>`).join('')}</select>
      <div class="seg"><button data-mode="lista">Lista</button><button data-mode="tablero">Tablero</button></div></div>
      <div id="c-body"></div>`;
    $('#f-q').oninput = (e) => { filt.q = e.target.value; renderClientesBody(); };
    $('#f-s').onchange = (e) => { filt.status = e.target.value; renderClientesBody(); };
    el.querySelector('.seg').onclick = (e) => { const b = e.target.closest('button'); if (b) { filt.mode = b.dataset.mode; renderClientesBody(); } };
  }
  renderClientesBody();
}
function renderClientesBody() {
  const list = filtered(), t = today();
  $('#c-count').textContent = `${list.length} de ${data.clients.length} clientes`;
  document.querySelectorAll('#v-clientes .seg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === filt.mode));
  const body = $('#c-body');
  if (!data.clients.length) { body.innerHTML = '<div class="card empty">Aún no tienes clientes. Usa <b>Buscar</b> para encontrar negocios o añade uno manualmente.</div>'; return; }
  if (filt.mode === 'lista') {
    body.innerHTML = `<div class="card tbl"><table><thead><tr><th>Negocio</th><th>Estado</th><th class="hide-m">Teléfono</th><th class="hide-m">Próxima acción</th><th class="hide-m">Precio</th></tr></thead><tbody>
      ${list.map((c) => `<tr class="row" data-open="${c.id}"><td class="nm"><b>${esc(c.name)}</b><span>${esc(c.type || c.address)}</span></td><td>${badge(c.status)}</td>
      <td class="hide-m">${esc(c.phone) || '—'}</td><td class="hide-m" ${c.nextDate && c.nextDate < t ? 'style="color:#dc2626"' : ''}>${c.nextDate ? fdate(c.nextDate) + ' · ' + esc(c.nextText) : '—'}</td><td class="hide-m">${money(c.price)}</td></tr>`).join('')}
      </tbody></table>${list.length ? '' : '<p class="empty">Sin resultados.</p>'}</div>`;
  } else {
    body.innerHTML = `<div class="board">${STATUSES.map(([s, l]) => {
      const col = list.filter((c) => c.status === s);
      return `<div class="col" data-col="${s}"><h3><span style="color:var(--s-${s})">● ${l}</span><span>${col.length}</span></h3>${col.map((c) => `
        <div class="tile" draggable="true" data-open="${c.id}" data-id="${c.id}"><b>${esc(c.name)}</b><span>${esc(c.type || c.address)}</span>
        ${c.price ? `<span>${money(c.price)}</span>` : ''}${c.nextDate ? `<div class="nx ${c.nextDate < t ? 'late' : ''}">⏰ ${fdate(c.nextDate)} ${esc(c.nextText)}</div>` : ''}</div>`).join('')}</div>`;
    }).join('')}</div>`;
    body.querySelectorAll('.tile').forEach((el) => el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', el.dataset.id); }));
    body.querySelectorAll('.col').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault(); col.classList.remove('over');
        const c = byId(e.dataTransfer.getData('text/plain'));
        if (c && c.status !== col.dataset.col) { setStatus(c, col.dataset.col); renderClientesBody(); }
      });
    });
  }
}
function setStatus(c, s) {
  c.status = s;
  c.contacts.unshift({ id: uid(), date: today(), type: 'Estado', text: `Cambió a «${SLABEL[s]}»` });
  touch(c);
}

/* ---------- ficha (drawer) ---------- */
function openClient(id) {
  const c = byId(id); if (!c) return;
  openId = id;
  const d = $('#drawer');
  const field = (k, label, type = 'text', cls = '') => `<div class="${cls}"><label for="d-${k}">${label}</label><input id="d-${k}" data-k="${k}" type="${type}" value="${esc(c[k] ?? '')}"></div>`;
  d.innerHTML = `
  <div class="top"><div style="flex:1"><input data-k="name" value="${esc(c.name)}" aria-label="Nombre del negocio" placeholder="Nombre del negocio">
    <div class="sub" style="margin-left:0">${c.rating ? `★ ${c.rating} (${c.ratingCount || 0} reseñas) · ` : ''}${esc(c.type)}</div></div>
    <button class="btn sm" data-act="close" aria-label="Cerrar">✕</button></div>
  <div class="pipe" id="d-pipe">${STATUSES.map(([s, l]) => `<button data-s="${s}" class="${c.status === s ? 'on' : ''}" style="${c.status === s ? `background:var(--s-${s})` : ''}">${l}</button>`).join('')}</div>
  <div class="card sec"><h2>Contacto</h2><div class="f">
    ${field('phone', 'Teléfono', 'tel')}${field('website', 'Web actual', 'url')}${field('address', 'Dirección', 'text', 'full')}${field('type', 'Tipo de negocio')}
    <div style="align-self:end">${c.lat != null ? `<a href="https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}${c.placeId ? '&query_place_id=' + encodeURIComponent(c.placeId) : ''}" target="_blank" rel="noopener">Ver en Google Maps ↗</a>` : ''} ${safeUrl(c.website) ? `<a href="${esc(c.website)}" target="_blank" rel="noopener" style="margin-left:10px">Abrir web ↗</a>` : ''}</div></div></div>
  <div class="card sec"><h2>Próxima acción</h2><div class="f">${field('nextDate', 'Fecha', 'date')}${field('nextText', 'Qué hacer (ej. llamar para agendar demo)')}</div></div>
  <div class="card sec"><h2>Venta</h2><div class="f">${field('soldSite', 'Web vendida / propuesta')}${field('price', 'Precio', 'number')}</div></div>
  <div class="card sec"><h2>Notas</h2><textarea data-k="notes" aria-label="Notas">${esc(c.notes)}</textarea></div>
  <div class="card sec"><h2>Historial de contactos</h2>
    <div class="addc"><select id="h-type">${CONTACT_TYPES.map((t) => `<option>${t}</option>`).join('')}</select><input type="date" id="h-date" value="${today()}"><input id="h-text" placeholder="Qué se habló…"><button class="btn primary sm" data-act="addc">Añadir</button></div>
    <div class="hist">${c.contacts.length ? c.contacts.map((h) => `<div class="hi"><small>${fdate(h.date)} · ${esc(h.type)}</small><span style="flex:1">${esc(h.text)}</span><button class="btn sm" data-del-h="${h.id}" aria-label="Borrar entrada">✕</button></div>`).join('') : '<p class="empty">Sin contactos registrados.</p>'}</div></div>
  <p style="margin-top:18px"><button class="btn danger" data-act="del">Eliminar cliente</button></p>`;
  d.hidden = false; d.setAttribute('aria-hidden', 'false'); $('#scrim').hidden = false;
  d.scrollTop = 0;
}
function closeDrawer() {
  $('#drawer').hidden = true; $('#scrim').hidden = true; openId = null; draft = null; render();
}
$('#scrim').onclick = closeDrawer;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openId) closeDrawer(); });

$('#drawer').addEventListener('change', (e) => {
  const c = byId(openId), k = e.target.dataset.k; if (!c || !k) return;
  let v = e.target.value;
  if (k === 'price') v = v === '' ? null : Math.max(0, +v);
  c[k] = v; touch(c);
});
$('#drawer').addEventListener('click', (e) => {
  const c = byId(openId); if (!c) return;
  const s = e.target.closest('[data-s]');
  if (s && s.dataset.s !== c.status) { setStatus(c, s.dataset.s); openClient(c.id); return; }
  const dh = e.target.closest('[data-del-h]');
  if (dh) { c.contacts = c.contacts.filter((h) => h.id !== dh.dataset.delH); touch(c); openClient(c.id); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') closeDrawer();
  if (act === 'addc') {
    const text = $('#h-text').value.trim(); if (!text) { $('#h-text').focus(); return; }
    c.contacts.unshift({ id: uid(), date: $('#h-date').value || today(), type: $('#h-type').value, text });
    c.contacts.sort((a, b) => b.date.localeCompare(a.date)); touch(c);
    if (c.status === 'prospecto') { c.status = 'contactado'; toast('Estado cambiado a «Contactado»'); touch(c); }
    openClient(c.id);
  }
  if (act === 'del' && confirm(`¿Eliminar a «${c.name}» y todo su historial? No se puede deshacer.`)) {
    data.clients = data.clients.filter((x) => x.id !== c.id); save(); closeDrawer();
  }
});

/* acciones globales (nuevo cliente, abrir ficha) */
document.addEventListener('click', (e) => {
  if (e.target.closest('#drawer')) return;
  const o = e.target.closest('[data-open]'); if (o) { openClient(o.dataset.open); return; }
  if (e.target.closest('[data-act="new"]')) {
    draft = newClient(); openClient(draft.id);
    $('#drawer [data-k="name"]').focus();
  }
});

/* ---------- ajustes ---------- */
function renderAjustes() {
  $('#v-ajustes').innerHTML = `<header class="head"><div><h1>Ajustes</h1><p class="sub">Copia de seguridad y estado de la configuración.</p></div></header>
  <div class="card"><h2>Datos</h2><p class="sub">Se guardan en <code>crm/data/crm.json</code> (ignorado por git). ${data.clients.length} clientes.</p>
    <p><button class="btn" id="exp">Exportar JSON</button> <label class="btn" style="display:inline-block;margin:0;cursor:pointer">Importar JSON<input id="imp" type="file" accept="application/json" hidden></label></p></div>
  <div class="card" style="margin-top:16px"><h2>Google Maps</h2><p class="sub">${CFG.googleMapsKey ? 'Clave cargada desde <code>config.local.js</code>.' : 'Sin clave. Copia <code>config.example.js</code> a <code>config.local.js</code> y pon tu clave.'}</p></div>`;
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `crm-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#imp').onchange = async (e) => {
    try {
      const j = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(j.clients)) throw 0;
      if (!confirm(`Esto reemplazará tus ${data.clients.length} clientes por ${j.clients.length} del archivo. ¿Continuar?`)) return;
      data = { clients: j.clients.map((c) => newClient(c)) }; save(); renderAjustes(); toast('Datos importados');
    } catch { toast('Archivo no válido'); }
  };
}

/* ---------- buscador Google Maps (Places API nueva) ---------- */
let map = null, mapsReady = null, results = [], markers = [], hlIdx = -1;

function initMaps() {
  const setup = $('#map-setup');
  if (!CFG.googleMapsKey || CFG.googleMapsKey.startsWith('PEGA_')) {
    setup.hidden = false;
    setup.innerHTML = '<b>Falta la clave de Google Maps.</b> Copia <code>crm/config.example.js</code> a <code>crm/config.local.js</code>, pon tu clave (APIs: Maps JavaScript y Places API (New)) y reinicia. Mientras tanto puedes añadir clientes manualmente.';
    $('#q-go').disabled = true; return;
  }
  setup.hidden = true; $('#q-go').disabled = false;
  if (!mapsReady) {
    mapsReady = new Promise((res, rej) => {
      window.__gmReady = res;
      window.gm_authFailure = () => { setup.hidden = false; setup.innerHTML = '<b>Google rechazó la clave.</b> Revisa que esté activa, que tenga habilitadas las APIs y que permita <code>localhost</code>.'; };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CFG.googleMapsKey)}&v=weekly&loading=async&language=${CFG.language}${CFG.region ? '&region=' + CFG.region : ''}&callback=__gmReady`;
      s.async = true; s.onerror = () => rej(new Error('No se pudo cargar Google Maps'));
      document.head.appendChild(s);
    }).then(async () => {
      const { Map } = await google.maps.importLibrary('maps');
      await google.maps.importLibrary('places'); await google.maps.importLibrary('marker');
      map = new Map($('#map'), { center: CFG.defaultCenter, zoom: CFG.defaultZoom, mapId: CFG.mapId, mapTypeControl: false, streetViewControl: false });
    }).catch((e) => { mapsReady = null; toast(e.message); });
  }
}

$('#search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await mapsReady; if (!map) return;
  const type = $('#q-type').value.trim(), zone = $('#q-zone').value.trim();
  const go = $('#q-go'), box = $('#results');
  go.disabled = true; go.textContent = 'Buscando…';
  try {
    const { Place } = google.maps.places;
    const { places } = await Place.searchByText({
      textQuery: `${type} en ${zone}`, language: CFG.language, region: CFG.region || undefined, maxResultCount: 20,
      fields: ['id', 'displayName', 'formattedAddress', 'location', 'nationalPhoneNumber', 'websiteURI', 'rating', 'userRatingCount', 'primaryTypeDisplayName'],
    });
    results = places.map((p) => ({
      placeId: p.id, name: p.displayName || '', address: p.formattedAddress || '', phone: p.nationalPhoneNumber || '',
      website: p.websiteURI || '', rating: p.rating ?? null, ratingCount: p.userRatingCount ?? null,
      type: p.primaryTypeDisplayName || type, lat: p.location?.lat(), lng: p.location?.lng(),
    }));
    drawResults(true);
    if (!results.length) box.innerHTML = '<p class="empty">Sin resultados. Prueba con otro tipo o zona.</p>';
  } catch (err) {
    box.innerHTML = `<p class="empty">Error de búsqueda: ${esc(err.message || err)}.<br>Comprueba que «Places API (New)» está habilitada para tu clave.</p>`;
  } finally { go.disabled = false; go.textContent = 'Buscar'; }
});

const isSaved = (r) => data.clients.some((c) => c.placeId && c.placeId === r.placeId);
function drawResults(fit) {
  markers.forEach((m) => (m.map = null)); markers = [];
  const bounds = new google.maps.LatLngBounds();
  $('#results').innerHTML = results.map((r, i) => `
    <div class="res" data-i="${i}"><b>${esc(r.name)}</b><p>${esc(r.address)}</p>
      <p>${r.rating ? `★ ${r.rating} (${r.ratingCount || 0})` : 'Sin valoración'}${r.phone ? ' · ' + esc(r.phone) : ''}</p>
      <div class="acts">${isSaved(r) ? '<span class="badge" style="background:var(--s-ganado)">Guardado</span>' : `<button class="btn primary sm" data-save="${i}">Guardar como prospecto</button>`}
      ${safeUrl(r.website) ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">Web ↗</a>` : '<span class="sub" style="font-size:13px">Sin web</span>'}</div></div>`).join('');
  results.forEach((r, i) => {
    if (r.lat == null) return;
    const pin = document.createElement('div'); pin.className = 'pin' + (isSaved(r) ? ' saved' : '');
    const m = new google.maps.marker.AdvancedMarkerElement({ map, position: { lat: r.lat, lng: r.lng }, content: pin, title: r.name });
    m.addListener('click', () => highlight(i, true)); markers[i] = m; bounds.extend({ lat: r.lat, lng: r.lng });
  });
  if (fit && results.length) map.fitBounds(bounds, 60);
}
function highlight(i, scroll) {
  document.querySelectorAll('.res').forEach((el) => el.classList.toggle('hl', +el.dataset.i === i));
  markers.forEach((m, j) => m && m.content.classList.toggle('hl', j === i));
  if (scroll) document.querySelector(`.res[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  hlIdx = i;
}
function refreshSearchSaved() { if (map && results.length) drawResults(false); }
$('#results').addEventListener('click', (e) => {
  const sv = e.target.closest('[data-save]');
  if (sv) {
    const r = results[+sv.dataset.save];
    if (!isSaved(r)) { data.clients.unshift(newClient({ ...r })); save(); toast(`«${r.name}» guardado como prospecto`); drawResults(false); }
    return;
  }
  const el = e.target.closest('.res');
  if (el && !e.target.closest('a')) { const i = +el.dataset.i; highlight(i); const r = results[i]; if (r.lat != null) { map.panTo({ lat: r.lat, lng: r.lng }); } }
});

/* ---------- arranque ---------- */
(async function init() {
  try {
    const r = await fetch('/api/data'); data = await r.json();
    data.clients = (data.clients || []).map((c) => newClient(c));
  } catch { toast('No se pudo leer los datos. Arranca con «node server.js».'); }
  go('panel');
})();
