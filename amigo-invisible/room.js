/* Habitación en perspectiva caballera con avatares tipo Mii.
   Proyección caballera: el plano frontal se dibuja a tamaño real y la
   profundidad (z) se dibuja como una diagonal a 45° escalada por Q. */
window.Room = (() => {
'use strict';

const W = 10, D = 8, H = 3.2;           // sala en "unidades"
const Q = 0.7, ANG = Math.PI / 4;
const DX = Q * Math.cos(ANG), DY = Q * Math.sin(ANG);
const SHIRTS = ['#e5384f', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
const PANTS = '#2d3a57', SKIN = '#ffd9b8';

let cv, ctx, raf = 0, last = 0;
let cssW = 0, cssH = 0, dpr = 1, s = 1, U = 30, ox = 0, oy = 0;
let cast = [], items = [], H_ = {};
let phase = 'idle', me = null, gift = null, talkT = 0, text = '', talkDone = false, onTalkDone = null;
let hover = null;
const cam = { z: 1, cx: 0, cy: 0, tz: 1, tcx: 0, tcy: 0 };

const P = (x, y, z) => [ox + s * (x + z * DX), oy - s * (y + z * DY)];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Utilidades JPEG ---------- */
// Quita los segmentos APP2 (perfil ICC) para que las fotos pesen ~500 bytes menos.
function stripIcc(url) {
  const bin = atob(url.split(',')[1]);
  const b = Uint8Array.from(bin, c => c.charCodeAt(0));
  const out = [0xFF, 0xD8];
  let i = 2;
  while (i < b.length && b[i] === 0xFF) {
    const m = b[i + 1];
    if (m === 0xDA) { for (; i < b.length; i++) out.push(b[i]); break; }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (m !== 0xE2) for (let k = 0; k < len + 2; k++) out.push(b[i + k]);
    i += len + 2;
  }
  let str = ''; for (const v of out) str += String.fromCharCode(v);
  return 'data:image/jpeg;base64,' + btoa(str);
}
function squareJpeg(source, sw, sh, size, q) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const m = Math.min(sw, sh);
  c.getContext('2d').drawImage(source, (sw - m) / 2, (sh - m) / 2, m, m, 0, 0, size, size);
  return stripIcc(c.toDataURL('image/jpeg', q));
}
function canvasJpeg(c, q) { return stripIcc(c.toDataURL('image/jpeg', q)); }
function shrink(url, size, q) {
  return new Promise(res => {
    if (!url) return res('');
    const im = new Image();
    im.onload = () => res(squareJpeg(im, im.naturalWidth, im.naturalHeight, size, q));
    im.onerror = () => res('');
    im.src = url;
  });
}

/* ---------- Dibujo de primitivas ---------- */
function poly(pts, fill, stroke, lw) {
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = fill; ctx.fill(); }

// Caja en perspectiva caballera: cara frontal, tapa y lateral derecho.
function box(x, y, z, w, h, d, col, rib) {
  const sh = (pts, a) => { poly(pts, col); poly(pts, a); };
  sh([P(x, y, z), P(x + w, y, z), P(x + w, y + h, z), P(x, y + h, z)], 'rgba(0,0,0,0)');
  poly([P(x, y + h, z), P(x + w, y + h, z), P(x + w, y + h, z + d), P(x, y + h, z + d)], 'rgba(255,255,255,.28)');
  poly([P(x + w, y, z), P(x + w, y, z + d), P(x + w, y + h, z + d), P(x + w, y + h, z)], col);
  poly([P(x + w, y, z), P(x + w, y, z + d), P(x + w, y + h, z + d), P(x + w, y + h, z)], 'rgba(0,0,0,.28)');
  if (rib) {
    const a = x + w * .4, b = x + w * .6;
    poly([P(a, y, z), P(b, y, z), P(b, y + h, z), P(a, y + h, z)], rib);
    poly([P(a, y + h, z), P(b, y + h, z), P(b, y + h, z + d), P(a, y + h, z + d)], rib);
  }
}

/* ---------- Decorado ---------- */
function drawRoom() {
  // paredes
  poly([P(0, 0, D), P(W, 0, D), P(W, H, D), P(0, H, D)], '#2f6b53');
  poly([P(0, 0, 0), P(0, 0, D), P(0, H, D), P(0, H, 0)], '#255a45');
  // zócalo alto
  poly([P(0, 0, D), P(W, 0, D), P(W, 1, D), P(0, 1, D)], '#1f4a39');
  poly([P(0, 0, 0), P(0, 0, D), P(0, 1, D), P(0, 1, 0)], '#193f31');
  ctx.strokeStyle = '#f4c95d'; ctx.lineWidth = Math.max(1.5, s * .05);
  ctx.beginPath(); let a = P(0, 1, D), b = P(W, 1, D); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  ctx.beginPath(); a = P(0, 1, 0); b = P(0, 1, D); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  // suelo (tablero)
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
    poly([P(i, 0, j), P(i + 1, 0, j), P(i + 1, 0, j + 1), P(i, 0, j + 1)], (i + j) % 2 ? '#c9a06f' : '#bb905f');
  }
  // canto del suelo
  poly([P(0, 0, 0), P(W, 0, 0), P(W, -.28, 0), P(0, -.28, 0)], '#6e4a2a');
  poly([P(W, 0, 0), P(W, 0, D), P(W, -.28, D), P(W, -.28, 0)], '#553819');
  // alfombra
  poly([P(2.4, 0, 2), P(7.6, 0, 2), P(7.6, 0, 5.8), P(2.4, 0, 5.8)], '#a3162b');
  poly([P(2.7, 0, 2.3), P(7.3, 0, 2.3), P(7.3, 0, 5.5), P(2.7, 0, 5.5)], null, '#f4c95d', Math.max(1.5, s * .05));
  // ventana (pared del fondo)
  poly([P(3.2, 1.35, D), P(5.8, 1.35, D), P(5.8, 2.8, D), P(3.2, 2.8, D)], '#0b2540', '#efe3c2', s * .1);
  const [mx, my] = P(5.0, 2.35, D); circle(mx, my, s * .2, '#f6f1d8');
  for (let i = 0; i < 9; i++) { const [sx, sy] = P(3.35 + (i * .29) % 2.3, 1.5 + (i * .37) % 1.2, D); circle(sx, sy, s * .025, '#fff'); }
  ctx.strokeStyle = '#efe3c2'; ctx.lineWidth = s * .06;
  ctx.beginPath(); a = P(4.5, 1.35, D); b = P(4.5, 2.8, D); ctx.moveTo(...a); ctx.lineTo(...b);
  a = P(3.2, 2.075, D); b = P(5.8, 2.075, D); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  // cuadro (pared izquierda)
  poly([P(0, 1.5, 2.8), P(0, 1.5, 5.2), P(0, 2.7, 5.2), P(0, 2.7, 2.8)], '#7a1d2a', '#f4c95d', s * .09);
  // guirnalda
  ctx.strokeStyle = '#1d8f4e'; ctx.lineWidth = s * .08; ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const x = i / 24 * W, y = H - .18 - Math.sin(i / 24 * Math.PI * 4) * .12 - .12; const p = P(x, y, D); i ? ctx.lineTo(...p) : ctx.moveTo(...p); }
  ctx.stroke();
  for (let i = 0; i <= 24; i += 2) { const x = i / 24 * W, y = H - .18 - Math.sin(i / 24 * Math.PI * 4) * .12 - .12; const p = P(x, y, D); circle(p[0], p[1], s * .07, ['#e5384f', '#f4c95d', '#60a5fa'][(i / 2) % 3]); }
}

function treeDraw() {
  const [x, y] = P(W - 1.1, 0, D - 1.1);
  ctx.fillStyle = '#6b4423'; ctx.fillRect(x - s * .15, y - s * .45, s * .3, s * .45);
  const tiers = [[1.0, .35, 1.1], [.78, 1.15, 1.0], [.55, 1.9, .9]];
  tiers.forEach(([hw, by, h], i) => {
    ctx.beginPath(); ctx.moveTo(x - hw * s, y - by * s); ctx.lineTo(x + hw * s, y - by * s); ctx.lineTo(x, y - (by + h) * s); ctx.closePath();
    ctx.fillStyle = ['#157a43', '#1b9253', '#22a862'][i]; ctx.fill();
  });
  [[-.45, .65, '#e5384f'], [.4, .85, '#f4c95d'], [-.25, 1.5, '#60a5fa'], [.3, 1.55, '#e5384f'], [0, 2.1, '#f4c95d']].forEach(([dx, dy, c]) => circle(x + dx * s, y - dy * s, s * .09, c));
  ctx.fillStyle = '#f4c95d'; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .1 : s * .22, an = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * r, y - 2.95 * s + Math.sin(an) * r); }
  ctx.closePath(); ctx.fill();
}

/* ---------- Avatares ---------- */
function hashCol(n) { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) | 0; return SHIRTS[Math.abs(h) % SHIRTS.length]; }

function avatarGeom(a) {
  const [fx, fy] = P(a.x, 0, a.z), u = U;
  const hipY = fy - .5 * u, top = hipY - .7 * u, r = .5 * u, hy = top - .06 * u - r;
  return { fx, fy, u, hipY, top, r, hy, hatTop: hy - r * .62 - r * 1.3, labelY: hy - r * .62 - r * 1.3 - .12 * u };
}

function starPath(x, y, ro, ri, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const rr_ = i % 2 ? ri : ro, an = rot - Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr_, y + Math.sin(an) * rr_); }
  ctx.closePath();
}

function drawAvatar(a) {
  const g = avatarGeom(a), u = g.u;
  const sw = a.walking ? Math.sin(a.t * 9) : 0;
  const bob = a.walking ? Math.abs(Math.cos(a.t * 9)) * .07 * u : 0;
  const fx = g.fx, fy = g.fy, hipY = g.hipY - bob, top = g.top - bob, hx = fx, hy = g.hy - bob, r = g.r;
  const down = !!a.down, lie = a.lie || 0, lift = (a.h || 0) * u;

  // sombra (se encoge al volar y se alarga al tumbarse)
  const sk = 1 - Math.min(.6, (a.h || 0) * .35);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(fx, fy, .5 * u * sk * (1 + lie * .9), .16 * u * sk, 0, 0, 7); ctx.fill();

  const py = fy - .8 * u;
  ctx.save();
  if (down) { ctx.translate(fx, py - lift + .55 * u * lie); ctx.rotate(a.rot || 0); ctx.translate(-fx, -py); }

  // piernas
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const ang = sw * side * .55, x0 = fx + side * .17 * u;
    const ex = x0 + Math.sin(ang) * .45 * u, ey = hipY + Math.cos(ang) * .45 * u;
    ctx.strokeStyle = PANTS; ctx.lineWidth = .2 * u; ctx.beginPath(); ctx.moveTo(x0, hipY); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey + .03 * u, .14 * u, .08 * u, 0, 0, 7); ctx.fill();
  }
  // torso
  const shirt = hashCol(a.n);
  rr(fx - .36 * u, top, .72 * u, .8 * u, .2 * u); ctx.fillStyle = shirt; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(fx - .36 * u, top + .42 * u, .72 * u, .1 * u, .05 * u); ctx.fill();
  // brazos (y bate)
  for (const side of [-1, 1]) {
    const sx = fx + side * .43 * u, sy = top + .15 * u;
    let ang = -sw * side * .6 + side * .12, bat = false;
    if (down) ang = side * (1.1 + (a.air ? Math.sin(a.t * 20) * .3 : 0));
    else if (a.bat && side === (a.batSide || 1)) {
      const p = a.swingP === undefined ? -1 : a.swingP;
      let b;
      if (p < 0) b = Math.PI * .82;
      else if (p < .35) b = Math.PI * (.9 + .1 * (p / .35));
      else { const q = (p - .35) / .65; b = Math.PI * (1 - .7 * q * q * (3 - 2 * q)); }
      ang = side > 0 ? b : -b; bat = true;
    } else if (a.wave && side === 1) ang = Math.PI * .8 + Math.sin(a.t * 12) * .3;
    const L = .55 * u, ex = sx + Math.sin(ang) * L, ey = sy + Math.cos(ang) * L;
    ctx.strokeStyle = shirt; ctx.lineWidth = .17 * u; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    if (bat) {
      const dx = (ex - sx) / L, dy = (ey - sy) / L;
      ctx.strokeStyle = '#a8743a'; ctx.lineWidth = .09 * u; ctx.beginPath(); ctx.moveTo(ex - dx * .12 * u, ey - dy * .12 * u); ctx.lineTo(ex + dx * .4 * u, ey + dy * .4 * u); ctx.stroke();
      ctx.strokeStyle = '#d19a58'; ctx.lineWidth = .19 * u; ctx.beginPath(); ctx.moveTo(ex + dx * .4 * u, ey + dy * .4 * u); ctx.lineTo(ex + dx * 1.15 * u, ey + dy * 1.15 * u); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = .04 * u; ctx.beginPath(); ctx.moveTo(ex + dx * .5 * u, ey + dy * .5 * u); ctx.lineTo(ex + dx * 1.1 * u, ey + dy * 1.1 * u); ctx.stroke();
    }
    circle(ex, ey, .1 * u, SKIN);
  }
  // cabeza con la cara
  ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.clip();
  if (a.img && a.img.complete && a.img.naturalWidth) ctx.drawImage(a.img, hx - r, hy - r, 2 * r, 2 * r);
  else {
    ctx.fillStyle = SKIN; ctx.fillRect(hx - r, hy - r, 2 * r, 2 * r);
    ctx.fillStyle = '#5a3b22'; ctx.font = `700 ${r * 1.1}px Georgia,serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(a.label.charAt(0).toUpperCase(), hx, hy + r * .05);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7);
  const hot = hover === a && phase === 'pick';
  ctx.strokeStyle = hot ? '#f4c95d' : '#fff'; ctx.lineWidth = hot ? .1 * u : .05 * u; ctx.stroke();
  // cara de enfado al gift con bate / de mareo al noqueado
  if (a.bat) { ctx.strokeStyle = '#7a1020'; ctx.lineWidth = .06 * u; ctx.beginPath(); ctx.moveTo(hx - r * .55, hy - r * .22); ctx.lineTo(hx - r * .1, hy - r * .02); ctx.moveTo(hx + r * .55, hy - r * .22); ctx.lineTo(hx + r * .1, hy - r * .02); ctx.stroke(); }
  // gorro
  const base = hy - r * .62, bw = r * 1.02;
  ctx.fillStyle = '#d62839'; ctx.beginPath(); ctx.moveTo(hx - bw, base);
  ctx.quadraticCurveTo(hx - bw * .6, base - r * 1.0, hx + bw * .9, base - r * 1.15);
  ctx.quadraticCurveTo(hx + bw * .55, base - r * .4, hx + bw, base); ctx.closePath(); ctx.fill();
  rr(hx - bw * 1.08, base - r * .12, bw * 2.16, r * .3, r * .15); ctx.fillStyle = '#fff'; ctx.fill();
  circle(hx + bw * .9, base - r * 1.15, r * .2, '#fff');
  ctx.restore();

  // estrellitas de mareo
  const bodyY = down ? py - lift + .55 * u * lie : 0;
  if (down && lie > .8) {
    const cx = fx + .96 * u * Math.sin(a.rot || 0), cy = bodyY - .96 * u * Math.cos(a.rot || 0) - .5 * u;
    for (let k = 0; k < 3; k++) {
      const an = a.t * 4 + k * 2.09;
      ctx.fillStyle = '#ffd23f'; starPath(cx + Math.cos(an) * .5 * u, cy + Math.sin(an) * .14 * u, .14 * u, .06 * u, an); ctx.fill();
    }
  }

  // etiqueta
  const label = (a.seen ? '✓ ' : '') + a.label, isMe = a === me || a.mine;
  const fs = Math.max(11, .3 * u); ctx.font = `600 ${fs}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(label).width + fs * .8;
  const ly = (down ? fy - 1.55 * u : g.labelY - bob) - (down ? 0 : fs * .6);
  rr(fx - tw / 2, ly - fs * .65, tw, fs * 1.3, fs * .65);
  ctx.fillStyle = isMe ? '#f4c95d' : 'rgba(0,0,0,.55)'; ctx.fill();
  ctx.fillStyle = isMe ? '#3b2a00' : '#fff'; ctx.fillText(label, fx, ly + 1);
  if (isMe) { // flecha sobre «yo»
    const ay = ly - fs * .9 - Math.abs(Math.sin(a.t * 4)) * fs * .4;
    ctx.fillStyle = '#f4c95d'; ctx.beginPath(); ctx.moveTo(fx - fs * .4, ay - fs * .6); ctx.lineTo(fx + fs * .4, ay - fs * .6); ctx.lineTo(fx, ay); ctx.fill();
  }
}

function drawBubble(a) {
  const g = avatarGeom(a), u = g.u;
  const fs = Math.max(12, .34 * u), maxW = Math.min(6.5 * u, cssW / cam.z * .85);
  ctx.font = `600 ${fs}px system-ui,sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const shown = text.slice(0, Math.floor(talkT * 28));
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur);
  const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width))) + fs * 1.2, lh = fs * 1.3, bh = lines.length * lh + fs * .9;
  const half = cssW / cam.z / 2;
  const bx = clamp(g.fx - bw / 2, cam.cx - half + 6, cam.cx + half - bw - 6), by = g.labelY - fs * 1.6 - bh;
  rr(bx, by, bw, bh, fs * .6); ctx.fillStyle = '#fffaf0'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(g.fx - fs * .4, by + bh - 1); ctx.lineTo(g.fx + fs * .4, by + bh - 1); ctx.lineTo(g.fx, by + bh + fs * .7); ctx.fill();
  ctx.fillStyle = '#2a1c05';
  let n = 0;
  lines.forEach((l, i) => {
    const part = shown.slice(n, n + l.length + 1); n += l.length + 1;
    ctx.fillText(part.trimEnd(), bx + fs * .6, by + fs * .45 + lh * (i + .5));
  });
}

/* ---------- Lógica ---------- */
function newTarget(a) { a.tx = rnd(.7, W - .7); a.tz = rnd(.6, D - 1.0); }
function moveToward(a, tx, tz, step) {
  const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
  if (d <= step) { a.x = tx; a.z = tz; return true; }
  a.x += dx / d * step; a.z += dz / d * step; return false;
}

let rv = null, rst = 'go', rt = 0, hitDone = false, effects = [];
const POW = ['¡POW!', '¡PAF!', '¡BONK!', '¡ZAS!', '¡PLAF!'];
function setPhase(p) { phase = p; H_.onPhase && H_.onPhase(p); }

function smash(v, g) {
  const dir = v.x >= g.x ? 1 : -1;
  Object.assign(v, { down: true, air: true, airT: 0, h: .01, vh: 5.2, vx: dir * 5, dirH: dir, bounce: 0, lie: 0, rot: 0 });
  effects.push({ x: v.x, z: v.z, t: 0, txt: POW[Math.floor(Math.random() * POW.length)] });
}
function forceDown(v, g) {
  const dir = g && v.x < g.x ? -1 : 1;
  Object.assign(v, { down: true, air: false, h: 0, vx: 0, dirH: dir, rot: dir * Math.PI / 2, lie: 1, walking: false });
}
function physics(a, dt) {
  if (a.air) {
    a.airT += dt; a.vh -= 16 * dt; a.h += a.vh * dt;
    a.x = clamp(a.x + a.vx * dt, .3, W - .3);
    a.rot = a.dirH * Math.PI / 2 * Math.min(1, a.airT / .45); a.lie = Math.min(1, a.airT / .45);
    if (a.h <= 0) {
      a.h = 0;
      if (a.bounce < 1) { a.bounce++; a.vh = 1.8; a.vx *= .4; } else { a.air = false; a.vx = 0; a.lie = 1; a.rot = a.dirH * Math.PI / 2; }
    }
  }
}

function rampage(a, dt) {
  if (!rv) {
    const rest = cast.filter(v => v !== me && v !== gift && !v.down);
    if (!rest.length) { a.bat = false; a.swingP = -1; a.walking = false; setPhase('approach'); return; }
    rest.sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z));
    rv = rest[0]; rst = 'go';
  }
  if (rst === 'go') {
    const side = a.x <= rv.x ? -1 : 1;
    a.walking = true; a.wave = false;
    if (moveToward(a, clamp(rv.x + side * 1.0, .4, W - .4), rv.z, 4.4 * dt)) { a.walking = false; rst = 'swing'; rt = 0; hitDone = false; a.batSide = rv.x >= a.x ? 1 : -1; a.swingP = 0; }
  } else {
    rt += dt; a.swingP = Math.min(1, rt / .5);
    if (!hitDone && a.swingP >= .6) { smash(rv, a); hitDone = true; }
    if (rt >= .75) { rv = null; a.swingP = -1; }
  }
}

function update(dt) {
  for (const e of effects) e.t += dt;
  effects = effects.filter(e => e.t < .9);
  for (const a of cast) {
    a.t += dt;
    if (a.down) { physics(a, dt); a.walking = false; continue; }
    if (me && a === me) { a.walking = false; continue; }
    if (a === gift && phase === 'rampage') { rampage(a, dt); continue; }
    if (a === gift && phase === 'approach') {
      a.walking = true; a.wave = false;
      if (moveToward(a, a.gx, a.gz, 2.6 * dt)) { setPhase('talk'); talkT = 0; a.walking = false; a.wave = true; }
    } else if (a === gift && phase === 'talk') { a.walking = false; a.wave = true; }
    else if (phase === 'rampage') { a.walking = false; }       // los demás se quedan petrificados
    else {
      a.wave = false;
      if (a.wait > 0) { a.wait -= dt; a.walking = false; }
      else { a.walking = true; if (moveToward(a, a.tx, a.tz, a.v * dt)) { a.wait = rnd(.6, 3); newTarget(a); } }
    }
  }
  if (phase === 'talk') {
    talkT += dt;
    if (!talkDone && talkT * 28 >= text.length) { talkDone = true; onTalkDone && onTalkDone(); }
  }
  // cámara
  if (phase === 'rampage' && gift) {
    const A2 = avatarGeom(gift);
    cam.tz = Math.min(1.5, cssW / (11 * U));
    cam.tcx = A2.fx; cam.tcy = A2.fy - 1.8 * U;
  } else if (me && gift) {
    const A1 = avatarGeom(me), A2 = avatarGeom(gift);
    cam.tz = Math.min(1.7, cssW / (9 * U));
    cam.tcx = (A1.fx + A2.fx) / 2; cam.tcy = Math.min(A1.fy, A2.fy) - 2.4 * U;
  } else { cam.tz = 1; cam.tcx = cssW / 2; cam.tcy = cssH / 2; }
  cam.z += (cam.tz - cam.z) * .08;
  const hw = cssW / cam.z / 2, hh = cssH / cam.z / 2;
  cam.cx += (clamp(cam.tcx, hw, cssW - hw) - cam.cx) * .08;
  cam.cy += (clamp(cam.tcy, hh, cssH - hh) - cam.cy) * .08;
}

function drawEffects() {
  for (const e of effects) {
    const [x, y] = P(e.x, 0, e.z), p = e.t / .9, sc = p < .2 ? p / .2 : 1 + p * .3;
    const cx = x, cy = y - 1.7 * U - p * .4 * U, R = .75 * U * sc;
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - p) * 2.2);
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#e5384f'; ctx.lineWidth = Math.max(2, .07 * U);
    starPath(cx, cy, R, R * .55, p * .6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b3122b'; ctx.font = `800 ${Math.max(12, .34 * U * sc)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.txt, cx, cy + 1); ctx.restore();
  }
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
  ctx.translate(cssW / 2, cssH / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.cx, -cam.cy);
  drawRoom();
  const list = [...cast, ...items].sort((a, b) => b.z - a.z);
  for (const o of list) o.draw ? o.draw() : drawAvatar(o);
  drawEffects();
  if (phase === 'talk' && gift) drawBubble(gift);
}

function loop(ts) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  update(dt); draw();
}

function resize() {
  if (!cv) return;
  const w = cv.parentElement.clientWidth; if (!w) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssW = w; s = cssW / (W + D * DX + 1);
  U = Math.max(s * 1.1, 27);
  const natural = s * (H + D * DY + 1.5 + .45);
  cssH = Math.max(natural, cssW < 600 ? cssW * .95 : 0);
  oy = cssH - .45 * s; ox = .5 * s;
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  cv.style.height = cssH + 'px';
  cam.cx = cam.tcx = cssW / 2; cam.cy = cam.tcy = cssH / 2; cam.z = cam.tz = 1;
}

function toWorld(e) {
  const r = cv.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  return [(px - cssW / 2) / cam.z + cam.cx, (py - cssH / 2) / cam.z + cam.cy];
}
function hit(e) {
  const [x, y] = toWorld(e);
  const list = [...cast].sort((a, b) => a.z - b.z);
  for (const a of list) {
    const g = avatarGeom(a);
    if (Math.abs(x - g.fx) < .6 * U && y < g.fy + .1 * U && y > g.hatTop - .5 * U) return a;
  }
  return null;
}

/* ---------- API pública ---------- */
function init(canvas) {
  cv = canvas; ctx = cv.getContext('2d');
  window.addEventListener('resize', resize);
  cv.addEventListener('pointermove', e => { hover = phase === 'pick' ? hit(e) : null; cv.style.cursor = hover ? 'pointer' : 'default'; });
  cv.addEventListener('click', e => { if (phase !== 'pick') return; const a = hit(e); if (a && H_.onPick) H_.onPick(a.i); });
}

function open(people, handlers, mode) {
  H_ = handlers || {};
  cast = people.map((p, i) => {
    const a = { i, n: p.n, label: p.nick || p.n, mine: false, x: rnd(1, W - 1), z: rnd(.8, D - 1.2), t: rnd(0, 9), v: rnd(.9, 1.5), wait: rnd(0, 2), walking: false, wave: false, seen: false, img: null };
    newTarget(a);
    if (p.p) { a.img = new Image(); a.img.src = p.p; }
    return a;
  });
  items = [
    { z: D - 1.1, draw: treeDraw },
    { z: 1.2, draw: () => box(.7, 0, 1.2, 1, .8, .8, '#e5384f', '#f4c95d') },
    { z: 1.0, draw: () => box(1.9, 0, 1.0, .75, .6, .7, '#3b82f6', '#fff') },
    { z: 1.35, draw: () => box(.85, .8, 1.35, .6, .5, .5, '#f4c95d', '#e5384f') }
  ];
  me = gift = null; phase = mode === 'free' ? 'free' : 'pick';
  resize();
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
}
function busy() { return phase === 'rampage' || phase === 'approach' || phase === 'talk'; }
function close() { cancelAnimationFrame(raf); raf = 0; cast = []; me = gift = null; phase = 'idle'; }
function setMine(i) { cast.forEach(a => a.mine = a.i === i); }
function setProfile(i, d) { const a = cast[i]; if (!a) return; if (d.nick !== undefined) a.label = d.nick || a.n; if (d.p !== undefined) setPhoto(i, d.p); }
function setPhoto(i, p) { const a = cast[i]; if (!a) return; if (p) { a.img = new Image(); a.img.src = p; } else a.img = null; }
function setSeen(i, v = true) { if (cast[i]) cast[i].seen = v; }
function encounter(meIdx, giftIdx, say, done) {
  me = cast[meIdx]; gift = cast[giftIdx]; text = say; talkDone = false; onTalkDone = done; hover = null;
  gift.gx = clamp(me.x + (me.x < W - 2 ? 1.3 : -1.3), .5, W - .5);
  gift.gz = clamp(me.z - .9, .3, D - .8);
  gift.bat = true; gift.swingP = -1; gift.wave = false; rv = null; effects = [];
  setPhase('rampage');
}
function endEncounter(back) {
  for (const a of cast) {
    if (a.down) { Object.assign(a, { down: false, air: false, h: 0, rot: 0, lie: 0, vx: 0 }); newTarget(a); a.wait = rnd(0, 2.5); }
    a.bat = false; a.swingP = -1;
  }
  if (gift) { gift.wave = false; newTarget(gift); gift.wait = 0; }
  me = gift = null; rv = null; effects = [];
  setPhase(back === 'pick' ? 'pick' : 'free');
}
function skip() {
  if (phase !== 'rampage' || !gift) return;
  for (const v of cast) if (v !== me && v !== gift && !v.down) forceDown(v, gift);
  gift.bat = false; gift.swingP = -1; gift.walking = false; rv = null;
  setPhase('approach');
}

return { init, open, close, busy, skip, setSeen, setPhoto, setMine, setProfile, encounter, endEncounter, shrink, squareJpeg, canvasJpeg };
})();
