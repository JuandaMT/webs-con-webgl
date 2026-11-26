(() => {
'use strict';
const $ = id => document.getElementById(id);
const STORE = 'amigo-invisible:v1';

/* ---------- Estado ---------- */
let state = { ev: { name: '', budget: '', date: '' }, people: [], ex: [], photos: {} };
let result = null;          // { giver: receiver } por nombre, solo en memoria
let seen = new Set();

try { Object.assign(state, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} };

/* ---------- Navegación ---------- */
const views = ['setup', 'done', 'wishes', 'room'];
function show(name) {
  views.forEach(v => $(v).hidden = v !== name);
  window.scrollTo(0, 0);
}

/* ---------- Preparar ---------- */
function renderSetup() {
  $('evName').value = state.ev.name;
  $('evBudget').value = state.ev.budget;
  $('evDate').value = state.ev.date;
  $('count').textContent = state.people.length;

  const ul = $('people'); ul.innerHTML = '';
  state.people.forEach((p, i) => {
    const li = document.createElement('li');
    const av = document.createElement('button');
    av.type = 'button'; av.className = 'av'; av.title = 'Poner foto a ' + p; av.setAttribute('aria-label', 'Poner foto a ' + p);
    fillFace(av, state.photos[p], p);
    av.onclick = () => { photoFor = p; $('photoIn').click(); };
    li.append(av, p);
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', 'Quitar ' + p);
    b.onclick = () => {
      delete state.photos[p];
      state.people.splice(i, 1);
      state.ex = state.ex.filter(e => e[0] !== p && e[1] !== p);
      save(); renderSetup();
    };
    li.append(b); ul.append(li);
  });

  for (const s of [$('exA'), $('exB')]) {
    const prev = s.value; s.innerHTML = '';
    state.people.forEach(p => s.add(new Option(p, p)));
    if (state.people.includes(prev)) s.value = prev;
  }
  if (state.people.length > 1 && $('exA').value === $('exB').value) $('exB').selectedIndex = 1;

  const el = $('exList'); el.innerHTML = '';
  state.ex.forEach((e, i) => {
    const li = document.createElement('li');
    li.append(`${e[0]} ${e[2] ? '↔' : '→'} ${e[1]}`);
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', 'Quitar restricción');
    b.onclick = () => { state.ex.splice(i, 1); save(); renderSetup(); };
    li.append(b); el.append(li);
  });
  $('setupMsg').textContent = '';
}

/* ---------- Fotos ---------- */
let photoFor = null;
const validPhoto = s => typeof s === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(s) && s.length < 20000;
function fillFace(el, photo, name) {
  el.textContent = ''; el.style.backgroundImage = '';
  if (validPhoto(photo)) el.style.backgroundImage = `url(${photo})`;
  else el.textContent = name.trim().charAt(0).toUpperCase();
}
$('photoIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f || !photoFor) return;
  const url = await cropPhoto(f);
  if (url) { state.photos[photoFor] = url; save(); renderSetup(); }
  else if (url === undefined) $('setupMsg').textContent = 'No he podido leer esa imagen.';
};

/* Recortador: arrastrar para mover, deslizador / rueda / pellizco para el zoom.
   Resuelve con un data URL JPEG de 96x96, null si se cancela o undefined si no se puede leer. */
function cropPhoto(file) {
  return new Promise(async resolve => {
    let bmp;
    try { bmp = await createImageBitmap(file); } catch (e) { resolve(undefined); return; }
    const S = 280, modal = $('cropModal'), cv = $('cropCv'), c = cv.getContext('2d'), zoom = $('cropZoom');
    const s0 = Math.max(S / bmp.width, S / bmp.height);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    let z = 1, cx = S / 2, cy = S / 2, pinch = 0;
    const ptrs = new Map();
    const fit = () => {
      const w = bmp.width * s0 * z / 2, h = bmp.height * s0 * z / 2;
      cx = clamp(cx, S - w, w); cy = clamp(cy, S - h, h);
    };
    const draw = () => {
      const sc = s0 * z;
      c.fillStyle = '#fff'; c.fillRect(0, 0, S, S);
      c.drawImage(bmp, cx - bmp.width * sc / 2, cy - bmp.height * sc / 2, bmp.width * sc, bmp.height * sc);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.rect(0, 0, S, S); c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2, true); c.fill('evenodd');
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); c.stroke();
    };
    const setZ = nz => {
      nz = clamp(nz, 1, 4); const f = nz / z; z = nz;
      cx = S / 2 + (cx - S / 2) * f; cy = S / 2 + (cy - S / 2) * f;
      fit(); zoom.value = z; draw();
    };
    const dist = () => { const p = [...ptrs.values()]; return Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); };
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); pinch = ptrs.size === 2 ? dist() : 0; };
    cv.onpointermove = e => {
      const prev = ptrs.get(e.pointerId); if (!prev) return;
      const k = cv.getBoundingClientRect().width / S;
      if (ptrs.size === 1) { cx += (e.clientX - prev[0]) / k; cy += (e.clientY - prev[1]) / k; fit(); draw(); }
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { const d = dist(); if (pinch) setZ(z * d / pinch); pinch = d; }
    };
    cv.onpointerup = cv.onpointercancel = e => { ptrs.delete(e.pointerId); pinch = 0; };
    cv.onwheel = e => { e.preventDefault(); setZ(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); };
    zoom.oninput = () => setZ(+zoom.value);
    const onKey = e => { if (e.key === 'Escape') done(null); };
    const done = url => {
      modal.hidden = true; document.removeEventListener('keydown', onKey);
      cv.onpointerdown = cv.onpointermove = cv.onpointerup = cv.onpointercancel = cv.onwheel = zoom.oninput = null;
      bmp.close && bmp.close(); resolve(url);
    };
    $('cropOk').onclick = () => {
      const out = document.createElement('canvas'); out.width = out.height = 96;
      const o = out.getContext('2d'), f = 96 / S, sc = s0 * z * f;
      o.fillStyle = '#fff'; o.fillRect(0, 0, 96, 96);
      o.drawImage(bmp, (cx - bmp.width * s0 * z / 2) * f, (cy - bmp.height * s0 * z / 2) * f, bmp.width * sc, bmp.height * sc);
      done(Room.canvasJpeg(out, 0.78));
    };
    $('cropCancel').onclick = () => done(null);
    document.addEventListener('keydown', onKey);
    zoom.value = 1; modal.hidden = false; draw(); $('cropOk').focus();
  });
}

function readEvent() {
  state.ev = { name: $('evName').value.trim(), budget: $('evBudget').value.trim(), date: $('evDate').value.trim() };
  save();
}

$('addForm').onsubmit = e => {
  e.preventDefault();
  const n = $('newName').value.trim().replace(/\s+/g, ' ');
  if (!n) return;
  if (state.people.some(p => p.toLowerCase() === n.toLowerCase())) {
    $('setupMsg').textContent = `«${n}» ya está en la lista (si hay dos con el mismo nombre, añade la inicial).`;
    return;
  }
  state.people.push(n); $('newName').value = ''; save(); renderSetup(); $('newName').focus();
};

$('exForm').onsubmit = e => {
  e.preventDefault();
  const a = $('exA').value, b = $('exB').value;
  if (!a || !b || a === b) { $('setupMsg').textContent = 'Elige dos personas distintas.'; return; }
  state.ex.push([a, b, $('exBoth').checked]); save(); renderSetup();
};

['evName', 'evBudget', 'evDate'].forEach(id => $(id).addEventListener('input', readEvent));

$('clearBtn').onclick = () => {
  if (!confirm('¿Vaciar participantes y restricciones?')) return;
  state.people = []; state.ex = []; save(); renderSetup();
};

/* ---------- Sorteo ---------- */
function forbiddenSet() {
  const f = new Set();
  state.ex.forEach(([a, b, both]) => { f.add(a + '\u0000' + b); if (both) f.add(b + '\u0000' + a); });
  return f;
}

// Backtracking aleatorio: siempre encuentra solución si existe.
function draw(people, forbidden) {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const order = shuffle(people), out = {}, used = new Set();
  const go = k => {
    if (k === order.length) return true;
    const g = order[k];
    for (const r of shuffle(people)) {
      if (r === g || used.has(r) || forbidden.has(g + '\u0000' + r)) continue;
      out[g] = r; used.add(r);
      if (go(k + 1)) return true;
      used.delete(r); delete out[g];
    }
    return false;
  };
  return go(0) ? out : null;
}

$('drawBtn').onclick = () => {
  readEvent();
  if (state.people.length < 3) { $('setupMsg').textContent = 'Hacen falta al menos 3 participantes.'; return; }
  const r = draw(state.people, forbiddenSet());
  if (!r) { $('setupMsg').textContent = 'Con esas restricciones no hay ningún sorteo posible. Quita alguna.'; return; }
  result = r; seen = new Set();
  show('done');
};
$('redoBtn').onclick = () => { result = null; show('setup'); };

/* ---------- Habitación ---------- */
Room.init($('roomCv'));
const K = 'amigo-invisible:';
let rc = null;      // { mode, cast, giftOf, ev, id, key, me, admin, pending, doneFn }
let poll = 0;
const lab = c => c.nick || c.n;
const facePhoto = n => validPhoto(state.photos[n]) ? state.photos[n] : '';
const api = (path, body) => fetch('/api/' + path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });

function openRoom(o) {
  clearInterval(poll);
  rc = { ...o, pending: null, doneFn: null };
  seen = new Set();
  $('wrap').classList.add('wide');
  if (o.ev.name) $('title').textContent = o.ev.name;
  show('room');
  ['roomResult', 'whoConfirm', 'revealBtn', 'profileBox', 'adminBox', 'roomDone', 'roomSkip'].forEach(id => $(id).hidden = true);
  const online = o.mode === 'online';
  $('roomBack').hidden = online;
  if (online) rc.cast.forEach(c => { if (c.opened) seen.add(c.n); });
  Room.open(o.cast, { onPick: askWho, onPhase: ph => { $('roomSkip').hidden = ph !== 'rampage' && ph !== 'approach'; } }, 'pick');
  renderNav(online && rc.me !== null);
  rc.cast.forEach((c, i) => { if (seen.has(c.n)) Room.setSeen(i); });
  if (online && rc.me !== null) Room.setMine(rc.me);
  if (online) { $('whoList').hidden = true; $('whoList').innerHTML = ''; } else renderWho();
  setHint();
  if (online) {
    if (rc.me !== null) { $('profileBox').hidden = false; $('revealBtn').hidden = false; $('nickIn').value = rc.cast[rc.me].nick || ''; }
    if (rc.admin) renderAdmin();
    poll = setInterval(refresh, 8000);
  }
}

function renderNav(withMe) {
  const nav = $('roomNav'); nav.innerHTML = '';
  const add = (label, fn) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.textContent = label;
    b.onclick = () => { if (!Room.busy()) fn(); }; nav.append(b);
  };
  if (withMe) add('📍 Yo', () => Room.follow());
  Room.ROOMS.forEach((r, k) => add(`${r.icon} ${r.name}`, () => Room.focusRoom(k)));
}

function setHint(msg) {
  if (msg) { $('roomHint').textContent = msg; return; }
  if (rc.mode === 'pass') {
    const missing = rc.cast.filter((c, k) => !rc.wishes[k]);
    $('roomHint').textContent = missing.length ? `Primero, cada uno escribe sus 3 ideas de regalo: toca tu nombre. Faltan: ${missing.map(c => c.n).join(', ')}.`
      : rc.cast.every(c => seen.has(c.n)) ? '¡Todos listos! 🎉 Ya pueden salir de la casa.' : 'Ya están todas las ideas. ¿Quién eres? Toca tu avatar o tu nombre para ver a quién te toca.';
  } else if (rc.me !== null) {
    $('roomHint').textContent = `Hola, ${rc.cast[rc.me].n}. Tu avatar es el de la flecha dorada. Ponte mote y foto, y descubre a quién te toca.`;
  } else {
    $('roomHint').textContent = rc.admin ? 'Vista de organizador: aquí abajo tienes los enlaces personales.' : 'Estás viendo la sala. Usa tu enlace personal para ver a quién te toca.';
  }
}
function renderWho() {
  const ul = $('whoList'); ul.innerHTML = ''; ul.hidden = false;
  rc.cast.forEach((p, i) => {
    const li = document.createElement('li'); li.className = (seen.has(p.n) ? 'seen ' : '') + (rc.wishes[i] ? 'wished' : '');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'name'; b.textContent = p.n;
    b.onclick = () => askWho(i);
    li.append(b); ul.append(li);
  });
}
function askWho(i) {
  if (!rc || !$('roomResult').hidden) return;
  if (rc.mode === 'online') {
    if (rc.me === i) reveal();
    else setHint(rc.me !== null ? 'Ese no eres tú: tu avatar es el de la flecha dorada 👆' : 'Necesitas tu enlace personal para ver a quién te toca.');
    return;
  }
  if (!$('whoList').offsetParent || seen.has(rc.cast[i].n)) return;
  rc.pending = i;
  $('whoQ').textContent = `¿Eres ${rc.cast[i].n}?`;
  $('whoConfirm').hidden = false;
}
$('whoNo').onclick = () => { $('whoConfirm').hidden = true; rc.pending = null; };
$('whoYes').onclick = () => {
  const i = rc.pending; $('whoConfirm').hidden = true;
  if (!rc.wishes[i]) {       // antes de ver nada, sus 3 ideas
    openWishes({
      title: `Ideas de ${rc.cast[i].n}`, intro: 'Escribe 3 cosas que te gustaría que te regalaran. El Grinch se las dirá a quien te toque regalarte, así que no las enseñes… aún.',
      current: [], saveLabel: 'Guardar', onCancel: backToRoom,
      onSave: async w => { rc.wishes[i] = w; backToRoom(); renderWho(); setHint(); }
    });
    return;
  }
  const missing = rc.cast.filter((c, k) => !rc.wishes[k]);
  if (missing.length) { setHint(`Todavía faltan las ideas de: ${missing.map(c => c.n).join(', ')}.`); return; }
  $('whoList').hidden = true; meet(i);
};
$('revealBtn').onclick = () => reveal();

async function reveal() {
  if (rc.me === null || Room.busy()) return;
  $('revealBtn').hidden = true; setHint('Un momento…');
  try {
    const r = await api('reveal/' + rc.id, { key: rc.key });
    if (r.status === 409) { $('revealBtn').hidden = false; editWishes(); setHint('Antes de ver a quién te toca, escribe tus 3 ideas de regalo.'); return; }
    if (!r.ok) throw new Error();
    const d = await r.json();
    rc.giftOf[rc.me] = d.gift; rc.giftWishes[rc.me] = d.wishes || []; rc.cast[rc.me].opened = true; updateAdmin();
    meet(rc.me);
  } catch (e) { $('revealBtn').hidden = false; setHint('No he podido conectar con el servidor. Inténtalo otra vez.'); }
}

function meet(me) {
  const g = rc.giftOf[me], you = rc.cast[me], other = rc.cast[g];
  const ws = ((rc.mode === 'online' ? rc.giftWishes[me] : rc.wishes[g]) || []).filter(Boolean);
  setHint('¡El Grinch ha entrado en la casa! 🏚️ Mira cómo se va cargando a todos…');
  const speech = [
    `¡Hola ${lab(you)}! Soy el Grinch y me he cargado a todos los demás 😈 Tu amigo invisible es ${lab(other)}: ¡a ti te toca regalarle! 🎁`,
    ws.length ? `Para que no falles, ${lab(other)} sueña con ${listEs(ws.map(w => `«${w}»`))} 🎄`
      : `${lab(other)} todavía no me ha contado qué le hace ilusión… ¡vuelve a mirarlo más tarde! 🤷`
  ];
  Room.encounter(me, g, speech, () => {
    const ul = $('roomWishes'); ul.innerHTML = '';
    (ws.length ? ws : ['Aún no ha puesto sus ideas']).forEach(w => { const li = document.createElement('li'); li.textContent = w; if (!ws.length) li.className = 'none'; ul.append(li); });
    fillFace($('roomFace'), other.p, lab(other));
    $('roomName').textContent = lab(other);
    $('roomMeta').textContent = [other.nick && `Es ${other.n}`, rc.ev.budget && `Presupuesto: ${rc.ev.budget}`, rc.ev.date && `Fecha: ${rc.ev.date}`].filter(Boolean).join(' · ');
    $('roomResult').hidden = false; $('roomDone').hidden = false;
    rc.doneFn = () => {
      $('roomResult').hidden = true; $('roomDone').hidden = true;
      seen.add(you.n); Room.setSeen(me);
      Room.endEncounter('pick');
      if (rc.mode === 'online') { $('revealBtn').textContent = '🎁 Ver otra vez'; $('revealBtn').hidden = false; setHint(); }
      else { renderWho(); setHint(); }
    };
  });
}
$('roomSkip').onclick = () => Room.skip();
$('roomDone').onclick = () => rc && rc.doneFn && rc.doneFn();
$('roomBack').onclick = leaveRoom;
function leaveRoom() {
  clearInterval(poll); Room.close(); $('wrap').classList.remove('wide');
  $('title').innerHTML = '¿A quién te <em>toca?</em>'; rc = null; show('done');
}

/* ---------- Ideas de regalo ---------- */
const completeWishes = w => Array.isArray(w) && w.length === 3 && w.every(x => typeof x === 'string' && x.trim());
const listEs = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
let wishCtx = null;
function openWishes(ctx) {
  wishCtx = ctx;
  [1, 2, 3].forEach((n, k) => $('wish' + n).value = (ctx.current && ctx.current[k]) || '');
  $('wishTitle').textContent = ctx.title; $('wishIntro').textContent = ctx.intro;
  $('wishCancel').hidden = !ctx.onCancel; $('wishSave').textContent = ctx.saveLabel || 'Guardar'; $('wishMsg').textContent = '';
  show('wishes'); $('wish1').focus();
}
$('wishSave').onclick = async () => {
  const w = [1, 2, 3].map(n => $('wish' + n).value.trim().replace(/\s+/g, ' '));
  if (w.some(x => !x)) { $('wishMsg').textContent = 'Rellena las 3 ideas para continuar.'; return; }
  $('wishSave').disabled = true;
  try { await wishCtx.onSave(w); }
  catch (e) { $('wishMsg').textContent = e instanceof TypeError ? 'No hay conexión con el servidor. Inténtalo otra vez.' : (e.message || 'No he podido guardarlo. Inténtalo otra vez.'); }
  finally { $('wishSave').disabled = false; }
};
$('wishCancel').onclick = () => wishCtx && wishCtx.onCancel && wishCtx.onCancel();
[1, 2, 3].forEach(n => $('wish' + n).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); n < 3 ? $('wish' + (n + 1)).focus() : $('wishSave').click(); } });
function backToRoom() { show('room'); window.dispatchEvent(new Event('resize')); }
async function saveWishes(w, id, key) {
  const r = await api('wishes/' + id, { key, wishes: w });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'No he podido guardarlo.'); }
}
function editWishes() {
  if (!rc || rc.me === null || Room.busy()) return;
  openWishes({
    title: 'Mis ideas de regalo', intro: 'Estas 3 ideas se las dirá el Grinch a quien te regale a ti. Puedes cambiarlas cuando quieras.',
    current: rc.myWishes, saveLabel: 'Guardar', onCancel: backToRoom,
    onSave: async w => { await saveWishes(w, rc.id, rc.key); rc.myWishes = w; backToRoom(); setHint('¡Ideas guardadas! 🎁'); }
  });
}
$('roomWishEdit').onclick = editWishes;

/* ---------- Sala online ---------- */
$('modePass').onclick = () => {
  const cast = state.people.map(n => ({ n, p: facePhoto(n) }));
  openRoom({ mode: 'pass', cast, giftOf: state.people.map(n => state.people.indexOf(result[n])), wishes: {}, ev: { name: state.ev.name, budget: state.ev.budget, date: state.ev.date }, me: null });
};

$('modeOnline').onclick = async () => {
  const btn = $('modeOnline'); btn.disabled = true; $('doneMsg').textContent = 'Creando la sala…';
  try {
    const r = await api('create', { ev: state.ev, people: state.people.map(n => ({ n, p: facePhoto(n) })), ex: state.ex });
    const d = await r.json();
    if (!r.ok) { $('doneMsg').textContent = d.error || 'No se pudo crear la sala.'; return; }
    localStorage.setItem(K + 'admin:' + d.id, d.admin);
    location.hash = 's=' + d.id;      // hashchange recarga y entra en la sala
  } catch (e) { $('doneMsg').textContent = 'No hay conexión con el servidor (¿estás abriendo la web publicada?).'; }
  finally { btn.disabled = false; }
};

async function refresh() {
  if (!rc || rc.mode !== 'online') return;
  try {
    const r = await api('game/' + rc.id); if (!r.ok) return;
    const d = await r.json();
    d.people.forEach((p, i) => {
      const c = rc.cast[i];
      if (i !== rc.me || $('roomResult').hidden) {   // no pisar lo que estoy editando
        if (c.p !== p.p) { c.p = p.p; Room.setPhoto(i, p.p); }
        if ((c.nick || '') !== p.nick) { c.nick = p.nick; Room.setProfile(i, { nick: p.nick }); }
      }
      c.opened = p.opened; c.wished = p.wished;
      if (p.opened && !seen.has(p.n)) { seen.add(p.n); Room.setSeen(i); }
    });
    updateAdmin();
  } catch (e) {}
}

async function renderAdmin() {
  try {
    const r = await api('links/' + rc.id, { admin: rc.admin });
    if (!r.ok) return;
    const { keys } = await r.json();
    const ul = $('linkList'); ul.innerHTML = ''; rc.adminRows = [];
    const base = location.href.split('#')[0];
    rc.cast.forEach((p, i) => {
      const url = `${base}#s=${rc.id}&k=${keys[i]}`;
      const li = document.createElement('li');
      const name = document.createElement('b'); name.textContent = p.n;
      const st = document.createElement('span'); st.className = 'st';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn ghost'; copy.textContent = 'Copiar';
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(url); copy.textContent = '¡Copiado!'; } catch (e) { prompt('Copia el enlace:', url); }
        setTimeout(() => copy.textContent = 'Copiar', 1500);
      };
      const wa = document.createElement('a'); wa.className = 'btn'; wa.target = '_blank'; wa.rel = 'noopener'; wa.textContent = 'WhatsApp';
      wa.href = 'https://wa.me/?text=' + encodeURIComponent(`🎁 ${rc.ev.name || 'Amigo invisible'}: ${p.n}, este es tu enlace personal (no lo compartas). Entra, ponte mote y foto, y descubre a quién te toca: ${url}`);
      li.append(name, st, copy, wa); ul.append(li); rc.adminRows.push(st);
    });
    $('adminBox').hidden = false;
    updateAdmin();
  } catch (e) {}
}
function updateAdmin() {
  if (!rc || !rc.admin || !rc.adminRows) return;
  let n = 0;
  rc.cast.forEach((p, i) => {
    const ok = !!p.opened; if (ok) n++;
    const st = rc.adminRows[i]; if (!st) return;
    st.textContent = (ok ? '✓ Ya ha mirado' : 'Pendiente') + (p.wished ? '' : ' · sin ideas aún'); st.className = 'st' + (ok ? ' ok' : '');
  });
  $('adminSummary').textContent = n === rc.cast.length ? `¡Todos han mirado! (${n} de ${n}) 🎉` : `${n} de ${rc.cast.length} ya han mirado a quién les toca`;
}

$('nickSave').onclick = async () => {
  if (!rc || rc.me === null) return;
  const nick = $('nickIn').value.trim().slice(0, 20);
  try {
    const r = await api('profile/' + rc.id, { key: rc.key, nick });
    if (!r.ok) throw new Error();
    const d = await r.json();
    rc.cast[rc.me].nick = d.nick; Room.setProfile(rc.me, { nick: d.nick });
    setHint(d.nick ? `¡Ahora eres «${d.nick}»! 😎` : 'Mote quitado.');
  } catch (e) { setHint('No he podido guardar el mote. Inténtalo otra vez.'); }
};
$('nickIn').onkeydown = e => { if (e.key === 'Enter') $('nickSave').click(); };

$('roomPhoto').onclick = () => $('roomPhotoIn').click();
$('roomPhotoIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f || !rc || rc.me === null) return;
  const p = await cropPhoto(f);
  if (p === null) return;
  if (p === undefined) { setHint('No he podido leer esa imagen.'); return; }
  try {
    const r = await api('profile/' + rc.id, { key: rc.key, p });
    if (!r.ok) throw new Error();
    rc.cast[rc.me].p = p; Room.setPhoto(rc.me, p);
    setHint('¡Foto cambiada! 😄');
  } catch (err) { setHint('No he podido guardar la foto. Inténtalo otra vez.'); }
};

/* ---------- Arranque ---------- */
async function boot() {
  const q = new URLSearchParams(location.hash.slice(1));
  const id = q.get('s');
  if (id && /^[a-z0-9]{8}$/.test(id)) {
    try {
      let key = q.get('k'), admin = q.get('a');
      if (admin) { localStorage.setItem(K + 'admin:' + id, admin); history.replaceState(null, '', '#s=' + id + (key ? '&k=' + key : '')); }
      if (key) localStorage.setItem(K + 'key:' + id, key); else key = localStorage.getItem(K + 'key:' + id);
      const r = await api('game/' + id);
      if (!r.ok) throw new Error();
      const d = await r.json();
      let me = null, myWishes = [];
      if (key) { const m = await api('me/' + id, { key }); if (m.ok) { const j = await m.json(); me = j.i; myWishes = j.wishes || []; } }
      const o = { mode: 'online', id, key: me === null ? null : key, me, admin: localStorage.getItem(K + 'admin:' + id), cast: d.people, giftOf: [], giftWishes: [], myWishes, ev: d.ev };
      if (me !== null && !completeWishes(myWishes)) {     // antes de ver nada, sus 3 ideas de regalo
        if (d.ev.name) $('title').textContent = d.ev.name;
        openWishes({
          title: `Hola, ${d.people[me].n} 👋`, current: myWishes, saveLabel: 'Guardar y entrar →',
          intro: 'Antes de entrar en la casa, escribe 3 cosas que te gustaría que te regalaran. Cuando el Grinch le cuente a tu amigo invisible que te toca regalarte, se las dirá.',
          onSave: async w => { await saveWishes(w, id, key); o.myWishes = w; openRoom(o); }
        });
      } else openRoom(o);
      return;
    } catch (e) { $('title').textContent = 'Sala no encontrada'; }
  }
  renderSetup(); show('setup');
}
window.addEventListener('hashchange', () => location.reload());
boot();

/* ---------- Nieve WebGL ---------- */
(function snow() {
  const c = $('snow');
  const gl = c.getContext('webgl', { alpha: true, antialias: false });
  if (!gl) return;
  const N = matchMedia('(max-width:600px)').matches ? 140 : 260;
  const vs = `
    attribute vec4 a; // x, fase, tamaño, velocidad
    uniform float t; uniform vec2 r; uniform float dpr;
    void main(){
      float y = 1.0 - mod(t*a.w*0.06 + a.y, 1.0)*2.2 + 0.1;
      float x = a.x*2.0-1.0 + sin(t*0.5*a.w + a.y*40.0)*0.04;
      gl_Position = vec4(x, y, 0.0, 1.0);
      gl_PointSize = a.z*dpr;
    }`;
  const fs = `
    precision mediump float;
    void main(){
      float d = length(gl_PointCoord-0.5);
      gl_FragColor = vec4(1.0,1.0,1.0, smoothstep(0.5,0.1,d)*0.8);
    }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return;
  gl.useProgram(p);
  const data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    data[i*4] = Math.random(); data[i*4+1] = Math.random();
    data[i*4+2] = 3 + Math.random() * 7; data[i*4+3] = 0.5 + Math.random();
  }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, 'a');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const uT = gl.getUniformLocation(p, 't'), uD = gl.getUniformLocation(p, 'dpr');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; gl.viewport(0, 0, c.width, c.height); gl.uniform1f(uD, dpr); };
  addEventListener('resize', resize); resize();
  const still = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const frame = ms => {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uT, ms / 1000); gl.drawArrays(gl.POINTS, 0, N);
    if (!still) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
})();
