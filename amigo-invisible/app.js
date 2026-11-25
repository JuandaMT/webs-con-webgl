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
const views = ['setup', 'done', 'room'];
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
  try {
    const bmp = await createImageBitmap(f);
    state.photos[photoFor] = Room.squareJpeg(bmp, bmp.width, bmp.height, 96, 0.7);
    save(); renderSetup();
  } catch (err) { $('setupMsg').textContent = 'No he podido leer esa imagen.'; }
};

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
  Room.open(o.cast, { onPick: askWho, onPhase: ph => { $('roomSkip').hidden = ph !== 'rampage'; } }, 'pick');
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

function setHint(msg) {
  if (msg) { $('roomHint').textContent = msg; return; }
  if (rc.mode === 'pass') {
    $('roomHint').textContent = rc.cast.every(c => seen.has(c.n)) ? '¡Todos listos! 🎉 Ya pueden salir de la habitación.' : '¿Quién eres? Toca tu avatar o tu nombre.';
  } else if (rc.me !== null) {
    $('roomHint').textContent = `Hola, ${rc.cast[rc.me].n}. Tu avatar es el de la flecha dorada. Ponte mote y foto, y descubre a quién te toca.`;
  } else {
    $('roomHint').textContent = rc.admin ? 'Vista de organizador: aquí abajo tienes los enlaces personales.' : 'Estás viendo la sala. Usa tu enlace personal para ver a quién te toca.';
  }
}
function renderWho() {
  const ul = $('whoList'); ul.innerHTML = ''; ul.hidden = false;
  rc.cast.forEach((p, i) => {
    const li = document.createElement('li'); if (seen.has(p.n)) li.className = 'seen';
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
$('whoYes').onclick = () => { const i = rc.pending; $('whoConfirm').hidden = true; $('whoList').hidden = true; meet(i); };
$('revealBtn').onclick = () => reveal();

async function reveal() {
  if (rc.me === null || Room.busy()) return;
  $('revealBtn').hidden = true; setHint('Un momento…');
  try {
    const r = await api('reveal/' + rc.id, { key: rc.key });
    if (!r.ok) throw new Error();
    const d = await r.json();
    rc.giftOf[rc.me] = d.gift;
    meet(rc.me);
  } catch (e) { $('revealBtn').hidden = false; setHint('No he podido conectar con el servidor. Inténtalo otra vez.'); }
}

function meet(me) {
  const g = rc.giftOf[me], you = rc.cast[me], other = rc.cast[g];
  setHint(`${lab(other)} saca un bate… 🏏 ¡Cuidado!`);
  Room.encounter(me, g, `¡Hola ${lab(you)}! Ya me he encargado de los demás 😈 Soy ${lab(other)}: ¡te ha tocado regalarme a mí! 🎁`, () => {
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

/* ---------- Sala online ---------- */
$('modePass').onclick = () => {
  const cast = state.people.map(n => ({ n, p: facePhoto(n) }));
  openRoom({ mode: 'pass', cast, giftOf: state.people.map(n => state.people.indexOf(result[n])), ev: { name: state.ev.name, budget: state.ev.budget, date: state.ev.date }, me: null });
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
      if (p.opened && !seen.has(p.n)) { seen.add(p.n); Room.setSeen(i); }
    });
  } catch (e) {}
}

async function renderAdmin() {
  try {
    const r = await api('links/' + rc.id, { admin: rc.admin });
    if (!r.ok) return;
    const { keys } = await r.json();
    const ul = $('linkList'); ul.innerHTML = '';
    const base = location.href.split('#')[0];
    rc.cast.forEach((p, i) => {
      const url = `${base}#s=${rc.id}&k=${keys[i]}`;
      const li = document.createElement('li');
      const name = document.createElement('b'); name.textContent = p.n;
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn ghost'; copy.textContent = 'Copiar';
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(url); copy.textContent = '¡Copiado!'; } catch (e) { prompt('Copia el enlace:', url); }
        setTimeout(() => copy.textContent = 'Copiar', 1500);
      };
      const wa = document.createElement('a'); wa.className = 'btn'; wa.target = '_blank'; wa.rel = 'noopener'; wa.textContent = 'WhatsApp';
      wa.href = 'https://wa.me/?text=' + encodeURIComponent(`🎁 ${rc.ev.name || 'Amigo invisible'}: ${p.n}, este es tu enlace personal (no lo compartas). Entra, ponte mote y foto, y descubre a quién te toca: ${url}`);
      li.append(name, copy, wa); ul.append(li);
    });
    $('adminBox').hidden = false;
  } catch (e) {}
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
  try {
    const bmp = await createImageBitmap(f);
    const p = Room.squareJpeg(bmp, bmp.width, bmp.height, 96, 0.7);
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
      let me = null;
      if (key) { const m = await api('me/' + id, { key }); if (m.ok) me = (await m.json()).i; }
      openRoom({ mode: 'online', id, key: me === null ? null : key, me, admin: localStorage.getItem(K + 'admin:' + id), cast: d.people, giftOf: [], ev: d.ev });
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
