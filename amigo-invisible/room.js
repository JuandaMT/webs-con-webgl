/* Casa entera en perspectiva caballera con avatares tipo Mii.
   Proyección caballera: el plano frontal se dibuja a tamaño real y la
   profundidad (z) se dibuja como una diagonal a 45° escalada por Q.
   La casa son N habitaciones en fila (eje x) separadas por tabiques bajos con
   puerta. El Grinch recorre la casa tumbando a todos menos a ti y a tu amigo
   invisible, y al final viene a contarte quién te toca. */
window.Room = (() => {
'use strict';

const RW = 8, N = 4, W = RW * N, D = 8, H = 3.6, PH = 2.0;  // N habitaciones de RW de ancho
const DZ0 = 3.0, DZ1 = 5.0, DZ = 4.0;                       // hueco de las puertas (en z)
const ZMIN = .7, ZMAX = 5.3;                                // zona por la que pasean
const Q = 0.7, ANG = Math.PI / 4;
const DX = Q * Math.cos(ANG), DY = Q * Math.sin(ANG);
const SHIRTS = ['#e5384f', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
const PANTS = '#2d3a57', SKIN = '#ffd9b8', GREEN = '#86c440';
const ROOMS = [
  { name: 'Salón', icon: '🎄', wall: '#2f6b53', low: '#1f4a39', fa: '#c9a06f', fb: '#bb905f' },
  { name: 'Cocina', icon: '🍳', wall: '#d9c58a', low: '#b9a366', fa: '#eef3f4', fb: '#cfe0e4' },
  { name: 'Dormitorio', icon: '🛏️', wall: '#5b4a93', low: '#463876', fa: '#b9906a', fb: '#a98059' },
  { name: 'Baño', icon: '🛁', wall: '#3d8fa6', low: '#2d7185', fa: '#f1f5f7', fb: '#cfe3ea' }
];

let cv, ctx, raf = 0, last = 0, clock = 0;
let cssW = 0, cssH = 0, dpr = 1, s = 1, U = 30, ox = 0, oy = 0, worldW = 0;
let cast = [], items = [], H_ = {};
let phase = 'idle', me = null, gift = null, grinch = null;
let talkT = 0, text = '', talkDone = false, onTalkDone = null;
let hover = null, panned = false, panX = 0, dragging = false;
const cam = { z: 1, cx: 0, cy: 0, snap: true };

const P = (x, y, z) => [ox + s * (x + z * DX), oy - s * (y + z * DY)];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const roomOf = x => clamp(Math.floor(x / RW), 0, N - 1);

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
  poly([P(x, y + h, z), P(x + w, y + h, z), P(x + w, y + h, z + d), P(x, y + h, z + d)], col);
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
function windowAt(xa, xb, ya, yb) {
  poly([P(xa, ya, D), P(xb, ya, D), P(xb, yb, D), P(xa, yb, D)], '#0b2540', '#efe3c2', s * .1);
  const [mx, my] = P(xa + (xb - xa) * .66, yb - .5, D); circle(mx, my, s * .17, '#f6f1d8');
  for (let i = 0; i < 7; i++) { const [sx, sy] = P(xa + .15 + (i * .31) % (xb - xa - .3), ya + .2 + (i * .37) % (yb - ya - .4), D); circle(sx, sy, s * .025, '#fff'); }
  ctx.strokeStyle = '#efe3c2'; ctx.lineWidth = s * .06; ctx.beginPath();
  let a = P((xa + xb) / 2, ya, D), b = P((xa + xb) / 2, yb, D); ctx.moveTo(...a); ctx.lineTo(...b);
  a = P(xa, (ya + yb) / 2, D); b = P(xb, (ya + yb) / 2, D); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
}

function fireplace() {
  poly([P(.9, 0, D), P(3.5, 0, D), P(3.5, 2.3, D), P(.9, 2.3, D)], '#8c3b2b', '#5a2418', Math.max(1, s * .04));
  poly([P(1.4, 0, D), P(3.0, 0, D), P(3.0, 1.4, D), P(1.4, 1.4, D)], '#1a0c08');
  for (let i = 0; i < 3; i++) {
    const xc = 1.7 + i * .5, h = .55 + .28 * Math.sin(clock * 9 + i * 2.1) + (i === 1 ? .2 : 0);
    poly([P(xc - .32, .04, D), P(xc + .32, .04, D), P(xc, .04 + h, D)], '#ff8c1a');
    poly([P(xc - .18, .04, D), P(xc + .18, .04, D), P(xc, .04 + h * .6, D)], '#ffd23f');
  }
  poly([P(.7, 2.3, D), P(3.7, 2.3, D), P(3.7, 2.5, D), P(.7, 2.5, D)], '#6b4423');
  [1.15, 2.1, 3.05].forEach((x, i) => {
    poly([P(x, 2.3, D), P(x + .3, 2.3, D), P(x + .3, 1.75, D), P(x + .52, 1.62, D), P(x + .5, 1.45, D), P(x, 1.45, D)], ['#e5384f', '#1d8f4e', '#3b82f6'][i]);
    poly([P(x, 2.3, D), P(x + .3, 2.3, D), P(x + .3, 2.15, D), P(x, 2.15, D)], '#fff');
  });
}

function drawShell(k) {
  const R = ROOMS[k], x0 = k * RW, x1 = x0 + RW;
  poly([P(x0, 0, D), P(x1, 0, D), P(x1, H, D), P(x0, H, D)], R.wall);
  poly([P(x0, 0, D), P(x1, 0, D), P(x1, 1, D), P(x0, 1, D)], R.low);
  ctx.strokeStyle = '#f4c95d'; ctx.lineWidth = Math.max(1.5, s * .05);
  ctx.beginPath(); ctx.moveTo(...P(x0, 1, D)); ctx.lineTo(...P(x1, 1, D)); ctx.stroke();
  for (let i = 0; i < RW; i++) for (let j = 0; j < D; j++)
    poly([P(x0 + i, 0, j), P(x0 + i + 1, 0, j), P(x0 + i + 1, 0, j + 1), P(x0 + i, 0, j + 1)], (i + j) % 2 ? R.fa : R.fb);
  poly([P(x0, 0, 0), P(x1, 0, 0), P(x1, -.28, 0), P(x0, -.28, 0)], '#6e4a2a');
  if (k === N - 1) poly([P(x1, 0, 0), P(x1, 0, D), P(x1, -.28, D), P(x1, -.28, 0)], '#553819');
  // alfombras
  const gold = Math.max(1.5, s * .05);
  if (k === 0) {
    poly([P(1.6, 0, 1.4), P(6.2, 0, 1.4), P(6.2, 0, 5.0), P(1.6, 0, 5.0)], '#a3162b');
    poly([P(1.9, 0, 1.7), P(5.9, 0, 1.7), P(5.9, 0, 4.7), P(1.9, 0, 4.7)], null, '#f4c95d', gold);
  } else if (k === 1) {
    poly([P(x0 + 2, 0, 1.2), P(x0 + 6, 0, 1.2), P(x0 + 6, 0, 4.4), P(x0 + 2, 0, 4.4)], '#3b82f6');
    poly([P(x0 + 2.3, 0, 1.5), P(x0 + 5.7, 0, 1.5), P(x0 + 5.7, 0, 4.1), P(x0 + 2.3, 0, 4.1)], null, '#fff', gold);
  } else if (k === 2) {
    ctx.beginPath(); for (let i = 0; i < 28; i++) { const a = i / 28 * 7, p = P(x0 + 4 + Math.cos(a) * 2.6, 0, 3.0 + Math.sin(a) * 1.7); i ? ctx.lineTo(...p) : ctx.moveTo(...p); }
    ctx.closePath(); ctx.fillStyle = '#f4c95d'; ctx.fill();
    ctx.beginPath(); for (let i = 0; i < 28; i++) { const a = i / 28 * 7, p = P(x0 + 4 + Math.cos(a) * 2.0, 0, 3.0 + Math.sin(a) * 1.25); i ? ctx.lineTo(...p) : ctx.moveTo(...p); }
    ctx.closePath(); ctx.fillStyle = '#e5384f'; ctx.fill();
  } else {
    poly([P(x0 + 2.6, 0, 1.6), P(x0 + 5.4, 0, 1.6), P(x0 + 5.4, 0, 3.4), P(x0 + 2.6, 0, 3.4)], '#f4c95d');
  }
  // guirnalda
  ctx.strokeStyle = '#1d8f4e'; ctx.lineWidth = s * .08; ctx.beginPath();
  for (let i = 0; i <= 20; i++) { const x = x0 + i / 20 * RW, y = H - .18 - Math.sin(i / 20 * Math.PI * 4) * .12 - .12; const p = P(x, y, D); i ? ctx.lineTo(...p) : ctx.moveTo(...p); }
  ctx.stroke();
  for (let i = 0; i <= 20; i += 2) { const x = x0 + i / 20 * RW, y = H - .18 - Math.sin(i / 20 * Math.PI * 4) * .12 - .12; const p = P(x, y, D); circle(p[0], p[1], s * .07, ['#e5384f', '#f4c95d', '#60a5fa'][(i / 2) % 3]); }
  // detalles de la pared del fondo
  if (k === 0) { fireplace(); windowAt(4.8, 7.2, 1.6, 3.0); }
  else if (k === 1) { windowAt(x0 + 1.4, x0 + 3.8, 1.8, 3.1); poly([P(x0 + 5.3, 2.0, D), P(x0 + 7.0, 2.0, D), P(x0 + 7.0, 2.9, D), P(x0 + 5.3, 2.9, D)], '#8a6b4a', '#f4c95d', s * .06); }
  else if (k === 2) { windowAt(x0 + 1.9, x0 + 4.1, 1.8, 3.1); poly([P(x0 + 5.0, 1.7, D), P(x0 + 6.2, 1.7, D), P(x0 + 6.2, 2.6, D), P(x0 + 5.0, 2.6, D)], '#7a1d2a', '#f4c95d', s * .06); }
  else {
    const [mx, my] = P(x0 + 6.6, 2.2, D);
    ctx.beginPath(); ctx.ellipse(mx, my, s * .6, s * .8, 0, 0, 7); ctx.fillStyle = '#cfe9f2'; ctx.fill(); ctx.strokeStyle = '#f4c95d'; ctx.lineWidth = s * .07; ctx.stroke();
    windowAt(x0 + 1.4, x0 + 3.4, 1.8, 3.0);
  }
}

function drawLeftWall() {
  poly([P(0, 0, 0), P(0, 0, D), P(0, H, D), P(0, H, 0)], '#255a45');
  poly([P(0, 0, 0), P(0, 0, D), P(0, 1, D), P(0, 1, 0)], '#193f31');
  ctx.strokeStyle = '#f4c95d'; ctx.lineWidth = Math.max(1.5, s * .05);
  ctx.beginPath(); ctx.moveTo(...P(0, 1, 0)); ctx.lineTo(...P(0, 1, D)); ctx.stroke();
  poly([P(0, 1.7, 2.8), P(0, 1.7, 5.2), P(0, 3.0, 5.2), P(0, 3.0, 2.8)], '#7a1d2a', '#f4c95d', s * .09);
}

// Tabique bajo con puerta; el hueco queda entre DZ0 y DZ1.
function drawPartition(px) {
  const c = '#e6d9ba';
  box(px - .15, 0, DZ1, .3, PH, D - DZ1, c);
  box(px - .15, 0, 0, .3, PH, DZ0, c);
}
function drawThreshold(px) {
  poly([P(px - .55, .01, DZ0 + .1), P(px + .55, .01, DZ0 + .1), P(px + .55, .01, DZ1 - .1), P(px - .55, .01, DZ1 - .1)], 'rgba(244,201,93,.4)');
}

function treeDraw(tx, tz) {
  const [x, y] = P(tx, 0, tz);
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

// Muebles: { x, z, draw }. x decide la habitación y z el orden de dibujo.
function buildItems() {
  const it = (x, z, draw) => ({ x, z, draw });
  const o = 16, b = 24, c = 8;
  return [
    // Salón
    it(6.9, 6.6, () => treeDraw(6.9, 6.6)),
    it(2.2, 6.3, () => {
      box(2.2, 0, 7.4, 3.2, 1.6, .3, '#8a1d2e');
      box(2.2, 0, 6.3, 3.2, .7, 1.1, '#9b2335');
      box(2.0, 0, 6.3, .3, 1.1, 1.4, '#7f1a2a'); box(5.1, 0, 6.3, .3, 1.1, 1.4, '#7f1a2a');
    }),
    it(5.3, 5.4, () => box(5.2, 0, 5.4, .9, .6, .7, '#e5384f', '#f4c95d')),
    it(6.4, 5.2, () => box(6.3, 0, 5.2, .75, .5, .7, '#3b82f6', '#fff')),
    it(5.35, 5.5, () => box(5.35, .6, 5.5, .6, .4, .5, '#f4c95d', '#e5384f')),
    // Cocina
    it(c + .5, 6.9, () => {
      box(c + .5, 0, 6.9, 5.0, 1.0, 1.0, '#7a5a3a');
      box(c + .45, 1.0, 6.85, 5.1, .12, 1.1, '#e9e2d0');
      box(c + 3.3, 1.12, 7.1, 1.0, .06, .7, '#2b2b2b');
      const [px, py] = P(c + 3.8, 1.18, 7.45); ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.ellipse(px, py - s * .22, s * .32, s * .26, 0, 0, 7); ctx.fill();
    }),
    it(c + 6.2, 6.6, () => { box(c + 6.2, 0, 6.6, 1.3, 2.6, 1.1, '#dfe6ea'); poly([P(c + 7.2, 1.3, 6.6), P(c + 7.3, 1.3, 6.6), P(c + 7.3, 2.1, 6.6), P(c + 7.2, 2.1, 6.6)], '#555'); }),
    it(c + 1.8, 5.4, () => {
      [[c + 1.95, 5.5], [c + 4.15, 5.5], [c + 1.95, 6.5], [c + 4.15, 6.5]].forEach(([lx, lz]) => box(lx, 0, lz, .15, .85, .15, '#6b4423'));
      box(c + 1.8, .85, 5.4, 2.6, .12, 1.4, '#8b5a2b');
      const [px, py] = P(c + 3.1, .97, 6.1); circle(px, py - s * .12, s * .3, '#f4e3c4'); circle(px, py - s * .3, s * .09, '#e5384f');
    }),
    // Dormitorio
    it(o + .9, 7.7, () => box(o + .9, 0, 7.7, 3.0, 1.5, .3, '#6b4423')),
    it(o + .9, 6.0, () => {
      box(o + .9, 0, 6.0, 3.0, .3, 1.7, '#6b4423');
      box(o + .9, .3, 6.0, 3.0, .55, 1.7, '#e5384f', '#f4c95d');
      box(o + 1.1, .85, 7.0, 1.0, .22, .6, '#fff'); box(o + 2.7, .85, 7.0, 1.0, .22, .6, '#fff');
    }),
    it(o + 5.9, 6.8, () => box(o + 5.9, 0, 6.8, 1.9, 2.8, 1.0, '#8b5a2b', '#6b4423')),
    it(o + 4.3, 7.0, () => {
      box(o + 4.3, 0, 7.0, .8, .7, .7, '#6b4423');
      const [px, py] = P(o + 4.7, 1.2, 7.35); ctx.fillStyle = 'rgba(255,230,140,.35)'; ctx.beginPath(); ctx.arc(px, py, s * .55, 0, 7); ctx.fill();
      ctx.fillStyle = '#f6e7a1'; ctx.beginPath(); ctx.moveTo(px - s * .22, py - s * .1); ctx.lineTo(px + s * .22, py - s * .1); ctx.lineTo(px + s * .14, py + s * .2); ctx.lineTo(px - s * .14, py + s * .2); ctx.fill();
    }),
    // Baño
    it(b + .6, 6.5, () => {
      box(b + .6, 0, 6.5, 2.8, .9, 1.3, '#f4f7f9');
      poly([P(b + .8, .9, 6.7), P(b + 3.2, .9, 6.7), P(b + 3.2, .9, 7.5), P(b + .8, .9, 7.5)], '#8fd3f4');
      [[1.2, 7.0], [1.7, 7.2], [2.5, 6.9]].forEach(([dx, dz]) => { const [px, py] = P(b + dx, .95, dz); circle(px, py, s * .11, 'rgba(255,255,255,.85)'); });
      const [dx2, dy2] = P(b + 2.2, .95, 7.1); circle(dx2, dy2 - s * .08, s * .13, '#ffd23f');
    }),
    it(b + 4.6, 7.0, () => { box(b + 4.6, 0, 7.5, .8, 1.5, .3, '#f4f7f9'); box(b + 4.6, 0, 7.0, .8, .7, .7, '#fff'); }),
    it(b + 6.1, 7.1, () => { box(b + 6.1, 0, 7.1, 1.0, .9, .7, '#e8eef0'); box(b + 5.95, .9, 7.3, 1.3, .1, .5, '#cfd9de'); })
  ];
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
    ctx.strokeStyle = a.grinch ? '#8f1224' : PANTS; ctx.lineWidth = .2 * u; ctx.beginPath(); ctx.moveTo(x0, hipY); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey + .03 * u, .14 * u, .08 * u, 0, 0, 7); ctx.fill();
  }
  // torso
  const shirt = a.grinch ? '#c8102e' : hashCol(a.n), skin = a.grinch ? GREEN : SKIN;
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
    circle(ex, ey, .1 * u, skin);
  }
  // cabeza con la cara
  ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.clip();
  if (a.grinch) {
    ctx.fillStyle = GREEN; ctx.fillRect(hx - r, hy - r, 2 * r, 2 * r);
    ctx.fillStyle = 'rgba(40,90,20,.28)'; ctx.beginPath(); ctx.ellipse(hx, hy + r * .6, r * .95, r * .55, 0, 0, 7); ctx.fill();
    ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const ex = hx + sd * r * .38, ey = hy - r * .1;
      ctx.fillStyle = '#f7e34a'; ctx.beginPath(); ctx.ellipse(ex, ey, r * .27, r * .2, sd * -.25, 0, 7); ctx.fill();
      ctx.fillStyle = '#c0261a'; ctx.beginPath(); ctx.ellipse(ex, ey + r * .02, r * .11, r * .17, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(ex, ey + r * .02, r * .04, r * .15, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1f4a0c'; ctx.lineWidth = r * .15;
      ctx.beginPath(); ctx.moveTo(hx + sd * r * .72, ey - r * .5); ctx.lineTo(hx + sd * r * .1, ey - r * .14); ctx.stroke();
    }
    ctx.strokeStyle = '#1c3a0c'; ctx.lineWidth = r * .1;
    ctx.beginPath(); ctx.moveTo(hx - r * .62, hy + r * .3); ctx.quadraticCurveTo(hx, hy + r * .95, hx + r * .66, hy + r * .2); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const dx of [-.28, 0, .28]) { ctx.beginPath(); ctx.moveTo(hx + dx * r - r * .08, hy + r * (.58 - Math.abs(dx) * .3)); ctx.lineTo(hx + dx * r + r * .08, hy + r * (.58 - Math.abs(dx) * .3)); ctx.lineTo(hx + dx * r, hy + r * (.74 - Math.abs(dx) * .3)); ctx.fill(); }
  } else if (a.img && a.img.complete && a.img.naturalWidth) ctx.drawImage(a.img, hx - r, hy - r, 2 * r, 2 * r);
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
  if (a.bat && !a.grinch) { ctx.strokeStyle = '#7a1020'; ctx.lineWidth = .06 * u; ctx.beginPath(); ctx.moveTo(hx - r * .55, hy - r * .22); ctx.lineTo(hx - r * .1, hy - r * .02); ctx.moveTo(hx + r * .55, hy - r * .22); ctx.lineTo(hx + r * .1, hy - r * .02); ctx.stroke(); }
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
  const label = (a.seen ? '✓ ' : '') + a.label, isMe = !a.grinch && (a === me || a.mine);
  const fs = Math.max(11, .3 * u); ctx.font = `600 ${fs}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(label).width + fs * .8;
  const ly = (down ? fy - 1.55 * u : g.labelY - bob) - (down ? 0 : fs * .6);
  rr(fx - tw / 2, ly - fs * .65, tw, fs * 1.3, fs * .65);
  ctx.fillStyle = a.grinch ? '#2f6b1a' : isMe ? '#f4c95d' : 'rgba(0,0,0,.55)'; ctx.fill();
  ctx.fillStyle = isMe ? '#3b2a00' : '#fff'; ctx.fillText(label, fx, ly + 1);
  if (a.mark && !down) { // emoji sobre la cabeza (susto, regalo…)
    ctx.font = `${fs * 1.6}px system-ui,sans-serif`;
    ctx.fillText(a.mark, fx, ly - fs * (isMe ? 2.6 : 1.3) - Math.abs(Math.sin(a.t * 6)) * fs * .35);
  }
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
// Ruta entre habitaciones: siempre pasa por el centro de las puertas.
function routeTo(a, tx, tz) {
  const pts = [], ra = roomOf(a.x), rb = roomOf(tx), dir = rb > ra ? 1 : -1;
  for (let k = ra; k !== rb; k += dir) { const px = (dir > 0 ? k + 1 : k) * RW; pts.push([px - dir * .9, DZ], [px + dir * .9, DZ]); }
  pts.push([tx, tz]); return pts;
}
function stepRoute(a, dt, v) {
  if (!a.pts || !a.pts.length) return true;
  const p = a.pts[0];
  if (moveToward(a, p[0], p[1], v * dt)) a.pts.shift();
  return !a.pts.length;
}
function moveToward(a, tx, tz, step) {
  const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
  if (d <= step) { a.x = tx; a.z = tz; return true; }
  a.x += dx / d * step; a.z += dz / d * step; return false;
}
function newTarget(a) {
  const r = Math.random() < .35 ? Math.floor(Math.random() * N) : roomOf(a.x);
  a.pts = routeTo(a, r * RW + rnd(.8, RW - .8), rnd(ZMIN, ZMAX));
}
function wander(a, dt) {
  a.wave = false;
  if (a.wait > 0) { a.wait -= dt; a.walking = false; return; }
  a.walking = true;
  if (stepRoute(a, dt, a.v)) { a.wait = rnd(.6, 3); newTarget(a); }
}

let rv = null, rvSide = -1, rst = 'go', rt = 0, hitDone = false, effects = [];
const POW = ['¡POW!', '¡PAF!', '¡BONK!', '¡ZAS!', '¡PLAF!'];
function setPhase(p) { phase = p; H_.onPhase && H_.onPhase(p); }

function smash(v, g) {
  const dir = v.x >= g.x ? 1 : -1;
  Object.assign(v, { down: true, air: true, airT: 0, h: .01, vh: 5.2, vx: dir * 5, dirH: dir, bounce: 0, lie: 0, rot: 0, rb: roomOf(v.x), mark: '', scared: false });
  effects.push({ x: v.x, z: v.z, t: 0, txt: POW[Math.floor(Math.random() * POW.length)] });
}
function forceDown(v, g) {
  const dir = g && v.x < g.x ? -1 : 1;
  Object.assign(v, { down: true, air: false, h: 0, vx: 0, dirH: dir, rot: dir * Math.PI / 2, lie: 1, walking: false, mark: '', scared: false });
}
function physics(a, dt) {
  if (a.air) {
    a.airT += dt; a.vh -= 16 * dt; a.h += a.vh * dt;
    a.x = clamp(a.x + a.vx * dt, a.rb * RW + .3, a.rb * RW + RW - .3);
    a.rot = a.dirH * Math.PI / 2 * Math.min(1, a.airT / .45); a.lie = Math.min(1, a.airT / .45);
    if (a.h <= 0) {
      a.h = 0;
      if (a.bounce < 1) { a.bounce++; a.vh = 1.8; a.vx *= .4; } else { a.air = false; a.vx = 0; a.lie = 1; a.rot = a.dirH * Math.PI / 2; }
    }
  }
}

// El Grinch va a por la víctima más cercana, de habitación en habitación.
function rampage(a, dt) {
  if (!rv) {
    const rest = cast.filter(v => v !== me && v !== gift && !v.down);
    if (!rest.length) { a.bat = false; a.swingP = -1; a.walking = false; beginApproach(); return; }
    const cost = v => Math.hypot(v.x - a.x, v.z - a.z) + Math.abs(roomOf(v.x) - roomOf(a.x)) * 4;
    rest.sort((p, q) => cost(p) - cost(q));
    rv = rest[0]; rst = 'go'; rvSide = a.x <= rv.x ? -1 : 1; a.replan = 0; a.pts = [];
  }
  if (rst === 'go') {
    const rm = roomOf(rv.x), gx = clamp(rv.x + rvSide * 1.0, rm * RW + .5, rm * RW + RW - .5), gz = rv.z;
    a.replan -= dt;
    if (a.replan <= 0 || !a.pts.length) { a.pts = routeTo(a, gx, gz); a.replan = .3; }
    a.walking = true; a.wave = false;
    stepRoute(a, dt, 5.2);
    if (!a.pts.length && roomOf(a.x) === rm && Math.hypot(a.x - gx, a.z - gz) < .15) {
      a.walking = false; rst = 'swing'; rt = 0; hitDone = false; a.batSide = rv.x >= a.x ? 1 : -1; a.swingP = 0;
    }
  } else {
    rt += dt; a.swingP = Math.min(1, rt / .5);
    if (!hitDone && a.swingP >= .6) { smash(rv, a); hitDone = true; }
    if (rt >= .75) { rv = null; a.swingP = -1; }
  }
}

// Quedan solo tú y tu amigo invisible: el Grinch y él van hacia ti.
function beginApproach() {
  const base = roomOf(me.x) * RW, dir = me.x - base > RW / 2 ? -1 : 1;
  grinch.gx = clamp(me.x + dir * 1.4, base + .6, base + RW - .6); grinch.gz = clamp(me.z - .5, .5, ZMAX);
  gift.gx = clamp(me.x + dir * 2.9, base + .6, base + RW - .6); gift.gz = clamp(me.z + .3, .5, ZMAX);
  grinch.pts = routeTo(grinch, grinch.gx, grinch.gz); gift.pts = routeTo(gift, gift.gx, gift.gz);
  grinch.arr = gift.arr = false; gift.mark = '🎁'; gift.scared = false; rv = null;
  setPhase('approach');
}
function startTalk() {
  setPhase('talk'); talkT = 0; talkDone = false;
  grinch.walking = false; grinch.wave = true; gift.walking = false;
}

function update(dt) {
  clock += dt;
  for (const e of effects) e.t += dt;
  effects = effects.filter(e => e.t < .9);
  const act = phase === 'rampage' || phase === 'approach' || phase === 'talk';
  for (const a of cast) {
    a.t += dt;
    if (a.down) { physics(a, dt); a.walking = false; continue; }
    if (act && a === me) { a.walking = false; continue; }
    if (act && a === gift) {
      if (phase === 'rampage') wander(a, dt);
      else if (phase === 'approach' && !a.arr) { a.walking = true; if (stepRoute(a, dt, 3.0)) { a.arr = true; a.walking = false; } }
      else a.walking = false;
      continue;
    }
    if (phase === 'rampage' && grinch && roomOf(a.x) === roomOf(grinch.x) && Math.hypot(a.x - grinch.x, a.z - grinch.z) < 4.5) {
      a.walking = false; a.scared = true; a.mark = '😱'; continue;       // se queda helado al ver al Grinch
    }
    wander(a, dt);
  }
  if (grinch) {
    const g = grinch; g.t += dt;
    if (phase === 'rampage') rampage(g, dt);
    else if (phase === 'approach') {
      if (!g.arr) { g.walking = true; g.wave = false; if (stepRoute(g, dt, 3.8)) { g.arr = true; g.walking = false; } }
      if (g.arr && gift.arr) startTalk();
    }
  }
  if (phase === 'talk') {
    talkT += dt;
    if (!talkDone && talkT * 28 >= text.length) { talkDone = true; onTalkDone && onTalkDone(); }
  }
  updateCam(dt);
}

function clampAxis(v, half, total) { return total < 2 * half ? total / 2 : clamp(v, half, total - half); }
function updateCam(dt) {
  let tcx, tcy = cssH / 2, tz = 1;
  if (grinch && (phase === 'rampage' || phase === 'approach')) {
    const A = avatarGeom(grinch); tcx = A.fx; tcy = A.fy - 1.5 * U; tz = 1.1;
  } else if (grinch && phase === 'talk' && me && gift) {
    const A = [me, grinch, gift].map(avatarGeom), xs = A.map(g => g.fx);
    tcx = (Math.min(...xs) + Math.max(...xs)) / 2; tcy = A[1].fy - 1.5 * U;
    tz = clamp(cssW * .9 / (Math.max(...xs) - Math.min(...xs) + 5 * U), 1, 1.5);
  } else {
    const m = cast.find(a => a.mine);
    tcx = panned ? panX : m ? avatarGeom(m).fx : P(RW / 2, 0, D / 2)[0];
  }
  const k = cam.snap || dragging ? 1 : 1 - Math.exp(-dt * 5);
  cam.z += (tz - cam.z) * k;
  const hw = cssW / cam.z / 2, hh = cssH / cam.z / 2;
  cam.cx += (clampAxis(tcx, hw, worldW) - cam.cx) * k;
  cam.cy += (clampAxis(tcy, hh, cssH) - cam.cy) * k;
  cam.snap = false;
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
  const half = cssW / cam.z / 2, vx0 = cam.cx - half, vx1 = cam.cx + half;
  const vis = k => P(k * RW, 0, D)[0] - s < vx1 + 3 * U && P((k + 1) * RW, 0, D)[0] > vx0 - 3 * U;
  const on = []; for (let k = 0; k < N; k++) on.push(vis(k));
  for (let k = 0; k < N; k++) if (on[k]) drawShell(k);
  for (let k = 0; k < N - 1; k++) if (on[k] || on[k + 1]) drawThreshold((k + 1) * RW);
  if (on[0]) drawLeftWall();
  const groups = Array.from({ length: N }, () => []);
  for (const o of cast) groups[roomOf(o.x)].push(o);
  if (grinch) groups[roomOf(grinch.x)].push(grinch);
  for (const o of items) groups[roomOf(o.x)].push(o);
  for (let k = 0; k < N; k++) {
    if (on[k]) {
      groups[k].sort((a, b) => b.z - a.z);
      for (const o of groups[k]) {
        if (o.draw) { o.draw(); continue; }
        const fx = P(o.x, 0, o.z)[0]; if (fx < vx0 - 2 * U || fx > vx1 + 2 * U) continue;
        drawAvatar(o);
      }
    }
    if (k < N - 1 && (on[k] || on[k + 1])) drawPartition((k + 1) * RW);
  }
  drawEffects();
  if (phase === 'talk' && grinch) drawBubble(grinch);
}

function loop(ts) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  update(dt); draw();
}

function resize() {
  if (!cv) return;
  const w = cv.parentElement.clientWidth; if (!w) return;
  const prev = s, first = !worldW;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssW = w;
  s = cssW / clamp(cssW / 70, 11.5, 20);          // se ve más o menos una habitación (en pantallas grandes, algo más)
  U = Math.max(s * .85, 26);
  worldW = s * (W + D * DX + 1);
  const natural = s * (H + D * DY + 1.5 + .45);
  cssH = Math.max(natural, cssW < 600 ? cssW * .95 : 0);
  oy = cssH - .45 * s; ox = .5 * s;
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  cv.style.height = cssH + 'px';
  if (!first) { cam.cx *= s / prev; panX *= s / prev; }
  cam.cy = cssH / 2; cam.z = 1; cam.snap = true;
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
  let drag = null, moved = false;
  const free = () => phase === 'pick' || phase === 'free';
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, c: cam.cx }; moved = false; });
  cv.addEventListener('pointermove', e => {
    if (drag && free() && (e.buttons || e.pointerType === 'touch')) {
      const dx = e.clientX - drag.x;
      if (moved || Math.abs(dx) > 6) { moved = dragging = panned = true; panX = drag.c - dx / cam.z; }
    }
    hover = phase === 'pick' && !moved ? hit(e) : null; cv.style.cursor = hover ? 'pointer' : 'default';
  });
  const end = () => { drag = null; dragging = false; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', end);
  cv.addEventListener('click', e => {
    if (moved) { moved = false; return; }
    if (phase !== 'pick') return; const a = hit(e); if (a && H_.onPick) H_.onPick(a.i);
  });
}

function open(people, handlers, mode) {
  H_ = handlers || {};
  cast = people.map((p, i) => {
    const a = { i, n: p.n, label: p.nick || p.n, mine: false, x: 0, z: rnd(ZMIN, ZMAX), t: rnd(0, 9), v: rnd(.9, 1.5), wait: rnd(0, 2), walking: false, wave: false, seen: false, img: null, pts: [], mark: '' };
    a.x = Math.floor(rnd(0, N)) * RW + rnd(.8, RW - .8);
    newTarget(a);
    if (p.p) { a.img = new Image(); a.img.src = p.p; }
    return a;
  });
  items = buildItems();
  me = gift = grinch = null; panned = false; phase = mode === 'free' ? 'free' : 'pick';
  resize(); cam.snap = true;
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
}
function busy() { return phase === 'rampage' || phase === 'approach' || phase === 'talk'; }
function close() { cancelAnimationFrame(raf); raf = 0; cast = []; me = gift = grinch = null; phase = 'idle'; }
function setMine(i) { cast.forEach(a => a.mine = a.i === i); }
function setProfile(i, d) { const a = cast[i]; if (!a) return; if (d.nick !== undefined) a.label = d.nick || a.n; if (d.p !== undefined) setPhoto(i, d.p); }
function setPhoto(i, p) { const a = cast[i]; if (!a) return; if (p) { a.img = new Image(); a.img.src = p; } else a.img = null; }
function setSeen(i, v = true) { if (cast[i]) cast[i].seen = v; }
function focusRoom(k) { panned = true; panX = P(k * RW + RW / 2, 0, D / 2)[0]; }
function follow() { panned = false; }

// El Grinch entra por el extremo de la casa más lejano a ti.
function encounter(meIdx, giftIdx, say, done) {
  me = cast[meIdx]; gift = cast[giftIdx]; text = say; talkDone = false; onTalkDone = done; hover = null; panned = false;
  grinch = { i: -1, n: 'El Grinch', label: 'El Grinch', grinch: true, x: roomOf(me.x) < N / 2 ? W - 1.2 : 1.2, z: DZ, t: 0, v: 0, wait: 0, walking: false, wave: false, img: null, bat: true, swingP: -1, pts: [], replan: 0, mark: '' };
  for (const a of cast) { a.mark = ''; a.scared = false; a.arr = false; }
  rv = null; effects = [{ x: grinch.x, z: grinch.z, t: 0, txt: '¡JA, JA, JA!' }];
  setPhase('rampage');
}
function endEncounter(back) {
  for (const a of cast) {
    if (a.down) Object.assign(a, { down: false, air: false, h: 0, rot: 0, lie: 0, vx: 0 });
    Object.assign(a, { mark: '', scared: false, arr: false, wave: false, wait: rnd(0, 2.5) });
    newTarget(a);
  }
  me = gift = grinch = null; rv = null; effects = [];
  setPhase(back === 'pick' ? 'pick' : 'free');
}
function skip() {
  if (!grinch) return;
  if (phase === 'rampage') {
    for (const v of cast) if (v !== me && v !== gift && !v.down) forceDown(v, grinch);
    grinch.bat = false; grinch.swingP = -1; grinch.walking = false; rv = null;
    beginApproach();
  } else if (phase === 'approach') {
    Object.assign(grinch, { x: grinch.gx, z: grinch.gz, pts: [], arr: true }); Object.assign(gift, { x: gift.gx, z: gift.gz, pts: [], arr: true });
    startTalk();
  }
}

return { init, open, close, busy, skip, setSeen, setPhoto, setMine, setProfile, encounter, endEncounter, focusRoom, follow, ROOMS, shrink, squareJpeg, canvasJpeg };
})();
