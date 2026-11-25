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
let rc = null;      // { mode, cast, giftOf, ev, id, admin, me, pending, doneFn }
let poll = 0;
const facePhoto = n => validPhoto(state.photos[n]) ? state.photos[n] : '';
const api = (path, body) => fetch('/api/' + path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
function token() { let t = localStorage.getItem(K + 'tok'); if (!t) { t = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem(K + 'tok', t); } return t; }

function openRoom(o) {
  clearInterval(poll);
  rc = { ...o, pending: null, doneFn: null, me: null };
  seen = new Set();
  $('wrap').classList.add('wide');
  if (o.ev.name) $('title').textContent = o.ev.name;
  show('room');
  ['roomResult', 'whoConfirm', 'roomPhoto', 'adminBox'].forEach(id => $(id).hidden = true);
  $('roomDone').hidden = true;
  $('roomBack').hidden = o.mode === 'online';
  if (o.mode === 'online') {
    const m = localStorage.getItem(K + 'me:' + o.id);
    const i = m === null ? -1 : o.cast.findIndex(c => c.n === m);
    rc.me = i >= 0 ? i : null;
    rc.cast.forEach(c => { if (c.claimed) seen.add(c.n); });
    rc.admin = localStorage.getItem(K + 'admin:' + o.id);
  }
  Room.open(o.cast, { onPick: askWho }, 'pick');
  rc.cast.forEach((c, i) => { if (seen.has(c.n)) Room.setSeen(i); });
  renderWho(); setHint();
  if (o.mode === 'online') {
    $('roomPhoto').hidden = rc.me === null;
    renderAdmin();
    poll = setInterval(refresh, 8000);
  }
}

function setHint(msg) {
  if (msg) { $('roomHint').textContent = msg; return; }
  if (rc.mode === 'pass') {
    $('roomHint').textContent = rc.cast.every(c => seen.has(c.n)) ? '¡Todos listos! 🎉 Ya pueden salir de la habitación.' : '¿Quién eres? Toca tu avatar o tu nombre.';
  } else {
    $('roomHint').textContent = rc.me !== null ? `Hola, ${rc.cast[rc.me].n}. Toca tu avatar para que tu amigo invisible venga a contártelo.` : '¿Quién eres? Toca tu avatar o tu nombre.';
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
  if (!rc || !$('whoList').offsetParent) return;
  const p = rc.cast[i];
  if (rc.mode === 'pass') { if (seen.has(p.n)) return; }
  else {
    if (rc.me !== null && rc.me !== i) { setHint(`Este móvil ya es ${rc.cast[rc.me].n}. Si no eres tú, entra desde tu propio dispositivo.`); return; }
    if (rc.me === i) { claim(i); return; }
    if (seen.has(p.n)) { setHint(`«${p.n}» ya lo ha abierto otra persona. Si eres tú, pídele al organizador que lo libere.`); return; }
  }
  rc.pending = i;
  $('whoQ').textContent = `¿Eres ${p.n}?`;
  $('whoConfirm').hidden = false;
}
$('whoNo').onclick = () => { $('whoConfirm').hidden = true; rc.pending = null; };
$('whoYes').onclick = () => {
  const i = rc.pending; $('whoConfirm').hidden = true;
  if (rc.mode === 'pass') { $('whoList').hidden = true; meet(i); } else claim(i);
};

async function claim(i) {
  $('whoList').hidden = true; setHint('Un momento…');
  try {
    const r = await api('claim/' + rc.id, { i, token: token() });
    if (r.status === 409) {
      seen.add(rc.cast[i].n); Room.setSeen(i); renderWho();
      setHint(`«${rc.cast[i].n}» ya lo ha abierto otra persona. Si eres tú, pídele al organizador que lo libere.`); return;
    }
    if (!r.ok) throw new Error();
    const d = await r.json();
    rc.me = i; localStorage.setItem(K + 'me:' + rc.id, rc.cast[i].n);
    rc.giftOf[i] = rc.cast.findIndex(c => c.n === d.gift);
    meet(i);
  } catch (e) { renderWho(); setHint('No he podido conectar con el servidor. Inténtalo otra vez.'); }
}

function meet(me) {
  const g = rc.giftOf[me], you = rc.cast[me], other = rc.cast[g];
  setHint(`${other.n} viene a contártelo…`);
  Room.encounter(me, g, `¡Hola ${you.n}! Soy ${other.n}. ¡Te ha tocado regalarme a mí! 🎁`, () => {
    fillFace($('roomFace'), other.p, other.n);
    $('roomName').textContent = other.n;
    $('roomMeta').textContent = [rc.ev.budget && `Presupuesto: ${rc.ev.budget}`, rc.ev.date && `Fecha: ${rc.ev.date}`].filter(Boolean).join(' · ');
    $('roomResult').hidden = false; $('roomDone').hidden = false;
    rc.doneFn = () => {
      $('roomResult').hidden = true; $('roomDone').hidden = true;
      seen.add(you.n); Room.setSeen(me);
      Room.endEncounter('pick'); renderWho();
      if (rc.mode === 'online') {
        $('roomPhoto').hidden = false; renderAdmin();
        setHint(you.p ? `Hola, ${you.n}. Toca tu avatar para ver otra vez a tu amigo invisible.` : '¡Ponte tu foto para que te reconozcan! 📷');
      } else setHint();
    };
  });
}
$('roomDone').onclick = () => rc && rc.doneFn && rc.doneFn();
$('roomBack').onclick = leaveRoom;
function leaveRoom() {
  clearInterval(poll); Room.close(); $('wrap').classList.remove('wide');
  $('title').innerHTML = '¿A quién te <em>toca?</em>'; rc = null; show('done');
}

/* ---------- Sala online ---------- */
$('modePass').onclick = () => {
  const cast = state.people.map(n => ({ n, p: facePhoto(n) }));
  openRoom({ mode: 'pass', cast, giftOf: state.people.map(n => state.people.indexOf(result[n])), ev: { name: state.ev.name, budget: state.ev.budget, date: state.ev.date } });
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
      if (rc.cast[i].p !== p.p) { rc.cast[i].p = p.p; Room.setPhoto(i, p.p); }
      rc.cast[i].claimed = p.claimed;
      if (p.claimed && !seen.has(p.n)) { seen.add(p.n); Room.setSeen(i); }
      else if (!p.claimed && seen.has(p.n) && i !== rc.me) { seen.delete(p.n); Room.setSeen(i, false); }
    });
    if (!$('whoList').hidden) renderWho();
    renderAdmin();
  } catch (e) {}
}

function renderAdmin() {
  if (!rc || !rc.admin) return;
  $('adminBox').hidden = false;
  const url = location.href.split('#')[0] + '#s=' + rc.id;
  $('shareUrl').value = url;
  $('shareWa').href = 'https://wa.me/?text=' + encodeURIComponent(`🎁 ${rc.ev.name || 'Amigo invisible'}: entra, toca tu avatar y descubre a quién te toca: ${url}`);
  const ul = $('adminList'); ul.innerHTML = '';
  rc.cast.forEach((p, i) => {
    const li = document.createElement('li'); li.className = 'rel' + (seen.has(p.n) ? '' : ' free');
    li.textContent = (seen.has(p.n) ? '🔒 ' : '○ ') + p.n; li.title = seen.has(p.n) ? 'Pulsa para liberar' : 'Aún sin abrir';
    if (seen.has(p.n)) li.onclick = async () => {
      if (!confirm(`¿Liberar a ${p.n}? Podrá volver a abrirlo desde cualquier móvil.`)) return;
      await api('release/' + rc.id, { i, admin: rc.admin });
      seen.delete(p.n); rc.cast[i].claimed = false; Room.setSeen(i, false); await refresh(); renderWho();
    };
    ul.append(li);
  });
}
$('shareCopy').onclick = async () => {
  try { await navigator.clipboard.writeText($('shareUrl').value); $('shareCopy').textContent = '¡Copiado!'; }
  catch (e) { $('shareUrl').select(); }
  setTimeout(() => $('shareCopy').textContent = 'Copiar', 1500);
};

$('roomPhoto').onclick = () => $('roomPhotoIn').click();
$('roomPhotoIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f || !rc || rc.me === null) return;
  try {
    const bmp = await createImageBitmap(f);
    const p = Room.squareJpeg(bmp, bmp.width, bmp.height, 96, 0.7);
    const r = await api('photo/' + rc.id, { i: rc.me, token: token(), p });
    if (!r.ok) throw new Error();
    rc.cast[rc.me].p = p; Room.setPhoto(rc.me, p);
    setHint('¡Foto cambiada! 😄');
  } catch (err) { setHint('No he podido guardar la foto. Inténtalo otra vez.'); }
};

/* ---------- Arranque ---------- */
async function boot() {
  const m = location.hash.match(/^#s=([a-z0-9]{8})$/);
  if (m) {
    try {
      const r = await api('game/' + m[1]);
      if (!r.ok) throw new Error();
      const d = await r.json();
      openRoom({ mode: 'online', id: m[1], cast: d.people, giftOf: [], ev: d.ev });
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
