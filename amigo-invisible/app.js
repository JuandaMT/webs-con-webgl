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
const views = ['setup', 'done', 'links', 'room'];
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
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => show('done'));

/* ---------- Habitación ---------- */
Room.init($('roomCv'));
const B64 = 'data:image/jpeg;base64,';
let rc = null;   // contexto: { mode, cast, giftOf, ev, pending, doneFn }

function openRoom(mode, cast, giftOf, ev, me) {
  rc = { mode, cast, giftOf, ev, pending: null, doneFn: null };
  $('wrap').classList.add('wide');
  if (ev.name) $('title').textContent = ev.name;
  show('room');
  $('roomResult').hidden = true; $('roomDone').hidden = true; $('whoConfirm').hidden = true;
  $('roomBack').hidden = mode !== 'pass';
  if (mode === 'pass') {
    Room.open(cast, { onPick: askWho }, 'pick');
    renderWho(); setHint();
  } else {
    $('whoList').innerHTML = '';
    Room.open(cast, {}, 'free');
    $('roomHint').textContent = `Hola, ${cast[me].n}. Quédate quieto un momento…`;
    setTimeout(() => meet(me), 1800);
  }
}

function setHint() {
  const all = rc.cast.every((_, i) => seen.has(rc.cast[i].n));
  $('roomHint').textContent = all ? '¡Todos listos! 🎉 Ya pueden salir de la habitación.' : '¿Quién eres? Toca tu avatar o tu nombre.';
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
  if (!rc || rc.mode !== 'pass' || seen.has(rc.cast[i].n)) return;
  rc.pending = i;
  $('whoQ').textContent = `¿Eres ${rc.cast[i].n}?`;
  $('whoConfirm').hidden = false;
}
$('whoNo').onclick = () => { $('whoConfirm').hidden = true; rc.pending = null; };
$('whoYes').onclick = () => {
  const i = rc.pending; $('whoConfirm').hidden = true; $('whoList').hidden = true;
  meet(i);
};

function meet(me) {
  const g = rc.giftOf[me], you = rc.cast[me], other = rc.cast[g];
  $('roomHint').textContent = `${other.n} viene a contártelo…`;
  Room.encounter(me, g, `¡Hola ${you.n}! Soy ${other.n}. ¡Te ha tocado regalarme a mí! 🎁`, () => {
    fillFace($('roomFace'), other.p, other.n);
    $('roomName').textContent = other.n;
    $('roomMeta').textContent = [rc.ev.b && `Presupuesto: ${rc.ev.b}`, rc.ev.d && `Fecha: ${rc.ev.d}`].filter(Boolean).join(' · ');
    $('roomResult').hidden = false;
    $('roomDone').textContent = rc.mode === 'pass' ? 'Entendido, ocultar' : 'Ver otra vez';
    $('roomDone').hidden = false;
    rc.doneFn = () => {
      $('roomResult').hidden = true; $('roomDone').hidden = true;
      if (rc.mode === 'pass') {
        seen.add(you.n); Room.setSeen(me);
        Room.endEncounter('pick'); renderWho(); setHint();
      } else { Room.endEncounter('free'); setTimeout(() => meet(me), 700); $('roomHint').textContent = 'Otra vez…'; }
    };
  });
}
$('roomDone').onclick = () => rc && rc.doneFn && rc.doneFn();
$('roomBack').onclick = leaveRoom;
function leaveRoom() {
  Room.close(); $('wrap').classList.remove('wide'); $('title').innerHTML = '¿A quién te <em>toca?</em>'; rc = null; show('done');
}

function facePhoto(n) { return validPhoto(state.photos[n]) ? state.photos[n] : ''; }
$('modePass').onclick = () => {
  const cast = state.people.map(n => ({ n, p: facePhoto(n) }));
  openRoom('pass', cast, state.people.map(n => state.people.indexOf(result[n])), state.ev, null);
};

/* ---------- Modo: enlaces ---------- */
const encodeLink = o => encodeURIComponent(JSON.stringify(o)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

$('modeLinks').onclick = async () => {
  const small = await Promise.all(state.people.map(n => Room.shrink(facePhoto(n), 48, 0.55)));
  const c = state.people.map((n, i) => [n, small[i].slice(B64.length)]);
  const ul = $('linkList'); ul.innerHTML = '';
  const base = location.href.split('#')[0];
  state.people.forEach((p, i) => {
    const url = base + '#r=' + encodeLink({ c, m: i, t: state.people.indexOf(result[p]), e: state.ev.name, b: state.ev.budget, d: state.ev.date });
    const li = document.createElement('li');
    const name = document.createElement('b'); name.textContent = p;
    const kb = document.createElement('span'); kb.className = 'note'; kb.textContent = Math.max(1, Math.round(url.length / 1024)) + ' KB';
    const copy = document.createElement('button');
    copy.className = 'btn ghost'; copy.type = 'button'; copy.textContent = 'Copiar';
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(url); copy.textContent = '¡Copiado!'; }
      catch (e) { prompt('Copia el enlace:', url); }
      setTimeout(() => copy.textContent = 'Copiar', 1500);
    };
    const wa = document.createElement('a');
    wa.className = 'btn'; wa.target = '_blank'; wa.rel = 'noopener'; wa.textContent = 'WhatsApp';
    const msg = `🎁 ${state.ev.name || 'Amigo invisible'}: ${p}, entra en la habitación y mira a quién te toca (¡es secreto!): ${url}`;
    wa.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    li.append(name, kb, copy, wa); ul.append(li);
  });
  show('links');
};

/* ---------- Arranque ---------- */
function parseLink(raw) {
  const d = JSON.parse(decodeURIComponent(raw));
  const ok = Array.isArray(d.c) && d.c.length >= 3 && d.c.length <= 40 &&
    d.c.every(x => Array.isArray(x) && typeof x[0] === 'string' && x[0].length <= 40 && typeof x[1] === 'string') &&
    Number.isInteger(d.m) && Number.isInteger(d.t) && d.m !== d.t && d.m >= 0 && d.t >= 0 && d.m < d.c.length && d.t < d.c.length;
  if (!ok) throw new Error('bad');
  const str = v => typeof v === 'string' ? v.slice(0, 40) : '';
  return {
    cast: d.c.map(([n, p]) => ({ n, p: p && validPhoto(B64 + p) ? B64 + p : '' })),
    me: d.m, t: d.t, ev: { name: str(d.e), b: str(d.b), d: str(d.d) }
  };
}
function boot() {
  const m = location.hash.match(/^#r=(.+)$/);
  if (m) {
    try {
      const d = parseLink(m[1]);
      const giftOf = d.cast.map((_, i) => i === d.me ? d.t : -1);
      openRoom('link', d.cast, giftOf, d.ev, d.me);
      return;
    } catch (e) {}
    $('title').textContent = 'Enlace no válido';
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
