/* Casa en planta, vista con una ligera inclinación (proyección ortogonal con
   cabeceo: el suelo se ve casi desde arriba y las paredes asoman un poco).
   Plano: el salón-cocina ocupa la fila de delante y detrás hay tres cuartos
   (azul, baño y dormitorio) que dan al salón por sus puertas. Los avatares son
   sprites de pie. El Grinch entra por la puerta de la calle, recorre la casa
   tumbando a todos menos a ti y a tu amigo invisible, y al final viene a
   contarte quién te toca. */
window.Room = (() => {
'use strict';

const W = 16, D = 13, H = 3.6, PH = 1.5, WT = .3;       // casa, altura de paredes, altura de tabiques, grosor
const ZS = 6.6, ZB = ZS + WT;                             // el tabique del salón va de ZS a ZB
const EL = 64 * Math.PI / 180, SP = Math.sin(EL), CP = Math.cos(EL);   // inclinación de la cámara
const GAPS = [[2.3, 3.9], [7.3, 8.7], [12.2, 13.8]];      // puertas del tabique (en x)
const SHIRTS = ['#e5384f', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
const PANTS = '#2d3a57', SKIN = '#ffd9b8', GREEN = '#86c440';
// wx/wz: zona por la que pasean; door: x de su puerta al salón.
const ROOMS = [
  { name: 'Salón y cocina', icon: '🎄', x0: 0, x1: 16, z0: 0, z1: ZS, wx: [2.3, 15.2], wz: [.8, 4.9] },
  { name: 'Cuarto azul', icon: '🛏️', x0: 0, x1: 6, z0: ZB, z1: D, wx: [2.5, 5.2], wz: [7.7, 9.9], door: 3.1 },
  { name: 'Baño', icon: '🛁', x0: 6, x1: 10, z0: ZB, z1: D, wx: [6.6, 8.6], wz: [7.7, 11.3], door: 8.0 },
  { name: 'Dormitorio', icon: '🛌', x0: 10, x1: 16, z0: ZB, z1: D, wx: [10.8, 15.2], wz: [7.7, 9.6], door: 13.0 }
];
const OBST = [[4.0, 8.0, 1.6, 4.8]];                      // la mesa del comedor

let cv, ctx, raf = 0, last = 0, clock = 0;
let cssW = 0, viewH = 0, dpr = 1, s = 1, U = 30, ox = 0, oy = 0, worldW = 0, worldH = 0;
let cast = [], items = [], walls = [], H_ = {};
let phase = 'idle', me = null, gift = null, grinch = null;
let talkT = 0, text = '', talkDone = false, onTalkDone = null;
let hover = null, panned = false, panX = 0, panY = 0, dragging = false;
const cam = { z: 1, cx: 0, cy: 0, snap: true };

const P = (x, y, z) => [ox + s * x, oy - s * (y * CP + z * SP)];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const roomAt = (x, z) => z < ZS + WT / 2 ? 0 : x < 6 ? 1 : x < 10 ? 2 : 3;

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
// Elipse apoyada en el suelo (un círculo visto con la inclinación de la cámara).
function disc(x, y, z, r, fill) { const [px, py] = P(x, y, z); ctx.beginPath(); ctx.ellipse(px, py, r * s, r * s * SP, 0, 0, 7); ctx.fillStyle = fill; ctx.fill(); }

// Caja: cara frontal y tapa (con esta cámara los laterales no se ven).
function box(x, y, z, w, h, d, col, rib) {
  const front = [P(x, y, z), P(x + w, y, z), P(x + w, y + h, z), P(x, y + h, z)];
  const top = [P(x, y + h, z), P(x + w, y + h, z), P(x + w, y + h, z + d), P(x, y + h, z + d)];
  poly(front, col); poly(front, 'rgba(0,0,0,.12)');
  poly(top, col); poly(top, 'rgba(255,255,255,.28)');
  if (rib) {
    const a = x + w * .4, b = x + w * .6;
    poly([P(a, y, z), P(b, y, z), P(b, y + h, z), P(a, y + h, z)], rib);
    poly([P(a, y + h, z), P(b, y + h, z), P(b, y + h, z + d), P(a, y + h, z + d)], rib);
  }
}

/* ---------- Decorado ---------- */
function windowAt(xa, xb, ya, yb) {
  poly([P(xa, ya, D), P(xb, ya, D), P(xb, yb, D), P(xa, yb, D)], '#0b2540', '#efe3c2', s * .08);
  const [mx, my] = P(xa + (xb - xa) * .68, yb - .45, D); circle(mx, my, s * .15, '#f6f1d8');
  for (let i = 0; i < 6; i++) { const [sx, sy] = P(xa + .15 + (i * .31) % (xb - xa - .3), ya + .2 + (i * .37) % (yb - ya - .4), D); circle(sx, sy, s * .022, '#fff'); }
  ctx.strokeStyle = '#efe3c2'; ctx.lineWidth = s * .05; ctx.beginPath();
  ctx.moveTo(...P((xa + xb) / 2, ya, D)); ctx.lineTo(...P((xa + xb) / 2, yb, D));
  ctx.moveTo(...P(xa, (ya + yb) / 2, D)); ctx.lineTo(...P(xb, (ya + yb) / 2, D)); ctx.stroke();
}

function tiles(x0, x1, z0, z1, c1, c2) {
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
    const xb = Math.min(x + 1, x1), zb = Math.min(z + 1, z1);
    poly([P(x, 0, z), P(xb, 0, z), P(xb, 0, zb), P(x, 0, zb)], (Math.floor(x - x0) + Math.floor(z - z0)) % 2 ? c1 : c2);
  }
}
function planks(x0, x1, z0, z1, cols) {
  for (let x = x0, i = 0; x < x1; x += .6, i++) { const xb = Math.min(x + .6, x1); poly([P(x, 0, z0), P(xb, 0, z0), P(xb, 0, z1), P(x, 0, z1)], cols[i % cols.length]); }
}
function rect(x0, x1, z0, z1, fill, stroke, lw) { poly([P(x0, 0, z0), P(x1, 0, z0), P(x1, 0, z1), P(x0, 0, z1)], fill, stroke, lw); }

function drawFloors() {
  tiles(0, W, 0, ZS, '#2e6079', '#2a5871');
  planks(0, 6, ZB, D, ['#b27a4d', '#a8714a', '#bb8556']);
  tiles(6, 10, ZB, D, '#bfe4f5', '#9fd2ee');
  planks(10, W, ZB, D, ['#7d5a6e', '#735063', '#876478']);
  for (const [a, b] of GAPS) rect(a, b, ZS - .02, ZB + .02, '#c9a06f');
  poly([P(0, 0, 0), P(W, 0, 0), P(W, -.3, 0), P(0, -.3, 0)], '#4a3320');
  const gold = Math.max(1.5, s * .045);
  // alfombra del salón
  rect(10.0, 14.4, 1.8, 4.6, '#f1e7cf'); rect(10.25, 14.15, 2.05, 4.35, null, '#2f6079', gold);
  disc(12.2, 0, 3.2, .55, '#4b5560'); disc(12.2, 0, 3.2, .3, '#7b8791');
  // felpudo de la puerta de la calle
  rect(7.0, 9.0, .05, .95, '#8b5a2b'); rect(7.15, 8.85, .2, .8, null, '#f4c95d', gold);
  // alfombras de los cuartos
  rect(2.6, 4.9, 7.8, 9.4, '#ffffff'); rect(2.8, 4.7, 7.95, 9.25, null, '#5ea6e0', gold);
  rect(7.0, 8.4, 8.1, 9.1, '#f4c95d');
  rect(11.0, 14.8, 7.9, 9.5, '#f4c95d'); rect(11.25, 14.55, 8.15, 9.25, null, '#e5384f', gold);
}

function drawBackWall() {
  const cols = [[0, 6, '#5ea6e0', '#4a8cc4'], [6, 10, '#9ad7ee', '#7bbdd8'], [10, W, '#b0629c', '#8c4a7c']];
  for (const [x0, x1, c, low] of cols) {
    poly([P(x0, 0, D), P(x1, 0, D), P(x1, H, D), P(x0, H, D)], c);
    poly([P(x0, 0, D), P(x1, 0, D), P(x1, 1, D), P(x0, 1, D)], low);
  }
  ctx.strokeStyle = '#f4c95d'; ctx.lineWidth = Math.max(1.5, s * .04);
  ctx.beginPath(); ctx.moveTo(...P(0, 1, D)); ctx.lineTo(...P(W, 1, D)); ctx.stroke();
  poly([P(-WT, H, D), P(W + WT, H, D), P(W + WT, H, D + WT), P(-WT, H, D + WT)], '#efe6d2');
  // guirnalda
  ctx.strokeStyle = '#1d8f4e'; ctx.lineWidth = s * .07; ctx.beginPath();
  const gy = i => H - .2 - Math.abs(Math.sin(i / 80 * Math.PI * 16)) * .22;
  for (let i = 0; i <= 80; i++) { const p = P(i / 80 * W, gy(i), D); i ? ctx.lineTo(...p) : ctx.moveTo(...p); }
  ctx.stroke();
  for (let i = 0; i <= 80; i += 5) { const p = P(i / 80 * W, gy(i), D); circle(p[0], p[1], s * .06, ['#e5384f', '#f4c95d', '#60a5fa'][(i / 5) % 3]); }
  windowAt(3.3, 5.3, 1.2, 3.0); windowAt(7.2, 8.8, 1.3, 3.0); windowAt(12.3, 14.5, 1.2, 3.0);
}

// Tabiques bajos con puertas y paredes laterales: trozos que se ordenan junto a los avatares.
function buildWalls() {
  const out = [], cream = '#efe6d2', cool = '#cfd9e1';
  const piece = (x, z, w, d, col) => out.push({ z, draw: () => box(x, 0, z, w, PH, d, col) });
  let x = 0;
  for (const [a, b] of GAPS.concat([[W, W]])) { if (a > x) piece(x, ZS, a - x, WT, cool); x = b; }
  for (const wx of [6, 10]) for (let z = ZB; z < D; z++) piece(wx - WT / 2, z, WT, Math.min(1, D - z), cream);
  for (let z = 0; z < D; z++) { piece(-WT, z, WT, Math.min(1, D - z), cream); piece(W, z, WT, Math.min(1, D - z), cream); }
  return out;
}

function treeDraw(tx, tz, k) {
  const [x, y] = P(tx, 0, tz), u = s * k;
  ctx.fillStyle = '#6b4423'; ctx.fillRect(x - u * .15, y - u * .45, u * .3, u * .45);
  [[1.0, .35, 1.1], [.78, 1.15, 1.0], [.55, 1.9, .9]].forEach(([hw, by, h], i) => {
    ctx.beginPath(); ctx.moveTo(x - hw * u, y - by * u); ctx.lineTo(x + hw * u, y - by * u); ctx.lineTo(x, y - (by + h) * u); ctx.closePath();
    ctx.fillStyle = ['#157a43', '#1b9253', '#22a862'][i]; ctx.fill();
  });
  [[-.45, .65, '#e5384f'], [.4, .85, '#f4c95d'], [-.25, 1.5, '#60a5fa'], [.3, 1.55, '#e5384f'], [0, 2.1, '#f4c95d']].forEach(([dx, dy, c]) => circle(x + dx * u, y - dy * u, u * .09, c));
  ctx.fillStyle = '#f4c95d'; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? u * .1 : u * .22, an = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * r, y - 2.95 * u + Math.sin(an) * r); }
  ctx.closePath(); ctx.fill();
}
function plantDraw(px, pz) {
  const [x, y] = P(px, .45, pz);
  for (let i = 0; i < 7; i++) {
    const an = -Math.PI / 2 + (i - 3) * .5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(an + Math.PI / 2);
    ctx.fillStyle = i % 2 ? '#1b9253' : '#22a862'; ctx.beginPath(); ctx.ellipse(0, -s * .38, s * .12, s * .38, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  box(px - .22, 0, pz - .15, .44, .45, .3, '#c8642a');
}

// Muebles: { z, draw }; z decide el orden de dibujo (el de delante se pinta el último).
function buildItems() {
  const it = (z, draw) => ({ z, draw });
  const L = [];
  // --- Salón y cocina
  L.push(it(.9, () => {
    box(.2, 0, .9, 1.2, 1.0, 4.6, '#c9a77a'); box(.15, 1.0, .85, 1.3, .1, 4.7, '#e8e0cf');
    box(.4, 1.1, 3.3, .9, .04, .9, '#2b2b2b'); box(.4, 1.1, 1.5, .9, .04, .8, '#9fb4c4');
  }));
  L.push(it(5.4, () => { box(.2, 0, 5.4, 1.3, 2.4, .9, '#dfe6ea'); box(1.2, 1.0, 5.4, .06, .7, .05, '#555'); }));
  L.push(it(4.4, () => box(5.7, 0, 4.4, .6, .5, .55, '#c8642a')));
  L.push(it(2.9, () => {
    box(4.2, 0, 2.7, .55, .5, .6, '#c8642a'); box(7.65, 0, 2.7, .55, .5, .6, '#c8642a');
    [[5.1, 2.3], [7.1, 2.3], [5.1, 4.0], [7.1, 4.0]].forEach(([lx, lz]) => box(lx, 0, lz, .15, .85, .15, '#8b6b43'));
    box(4.9, .85, 2.2, 2.6, .12, 2.0, '#d3a96f');
    [[5.5, 2.8], [6.9, 2.8], [5.5, 3.7], [6.9, 3.7]].forEach(([px, pz]) => disc(px, .97, pz, .22, '#f4eee0'));
    disc(6.2, 1.0, 3.25, .25, '#e5384f');
  }));
  L.push(it(1.5, () => box(5.7, 0, 1.4, .6, .5, .55, '#c8642a')));
  L.push(it(5.3, () => {
    box(10.2, .6, 6.0, 3.6, .8, .3, '#8f9197');
    box(10.2, 0, 5.3, 3.6, .6, 1.0, '#a8aab0');
    box(10.0, 0, 5.3, .25, .9, 1.0, '#8f9197'); box(13.8, 0, 5.3, .25, .9, 1.0, '#8f9197');
  }));
  L.push(it(1.3, () => plantDraw(9.3, 1.3)));
  L.push(it(1.1, () => plantDraw(10.2, 1.1)));
  L.push(it(5.0, () => treeDraw(14.9, 5.0, .62)));
  L.push(it(4.0, () => box(13.9, 0, 4.0, .7, .45, .6, '#e5384f', '#f4c95d')));
  L.push(it(3.7, () => box(14.9, 0, 3.7, .6, .4, .55, '#3b82f6', '#fff')));
  // --- Cuarto azul
  L.push(it(12.0, () => box(.3, 0, 12.0, 1.9, 2.3, .9, '#4aa3e6', '#2f7fc0')));
  L.push(it(10.2, () => {
    box(2.6, 0, 10.2, 1.9, .35, 2.7, '#7a4a2a'); box(2.7, .35, 10.3, 1.7, .3, 2.5, '#3b82f6', '#7fb7ff'); box(2.9, .65, 12.0, 1.3, .14, .6, '#fff');
  }));
  L.push(it(7.6, () => {
    box(.4, 0, 7.7, .12, .75, .12, '#888'); box(1.85, 0, 7.7, .12, .75, .12, '#888');
    box(.35, .75, 7.6, 1.7, .1, .95, '#e9e2d0'); box(.9, .85, 8.3, .8, .5, .1, '#222');
  }));
  L.push(it(8.9, () => box(.85, 0, 8.9, .7, .55, .7, '#222')));
  // --- Baño
  L.push(it(12.0, () => {
    box(6.5, 0, 12.0, 3.3, .7, .95, '#f4f7f9');
    poly([P(6.7, .7, 12.15), P(9.6, .7, 12.15), P(9.6, .7, 12.8), P(6.7, .7, 12.8)], '#8fd3f4');
    [[7.3, 12.4], [8.1, 12.6], [9.0, 12.3]].forEach(([bx, bz]) => { const [px, py] = P(bx, .72, bz); circle(px, py, s * .1, 'rgba(255,255,255,.85)'); });
    const [dx, dy] = P(8.6, .75, 12.4); circle(dx, dy - s * .06, s * .12, '#ffd23f');
  }));
  L.push(it(10.4, () => { box(9.0, 0, 10.8, .6, .8, .3, '#f4f7f9'); box(9.0, 0, 10.0, .6, .5, .8, '#fff'); }));
  L.push(it(8.4, () => { box(9.0, 0, 8.4, .6, .9, .8, '#e8eef0'); disc(9.3, .9, 8.8, .22, '#cfe9f2'); }));
  // --- Dormitorio
  L.push(it(10.0, () => {
    box(11.3, 0, 10.0, 3.4, .35, 2.9, '#5a3a2a'); box(11.3, .35, 12.75, 3.4, .9, .2, '#5a3a2a');
    box(11.4, .35, 10.1, 3.2, .3, 2.7, '#8a2f7a', '#c66bb2');
    box(11.6, .65, 12.0, 1.2, .14, .6, '#fff'); box(13.2, .65, 12.0, 1.2, .14, .6, '#fff');
  }));
  L.push(it(12.0, () => {
    [10.5, 14.8].forEach(nx => {
      box(nx, 0, 12.0, .6, .6, .7, '#6b4423');
      const [px, py] = P(nx + .3, .95, 12.35); ctx.fillStyle = 'rgba(255,230,140,.35)'; ctx.beginPath(); ctx.arc(px, py, s * .45, 0, 7); ctx.fill();
      circle(px, py, s * .13, '#f6e7a1');
    });
  }));
  return L;
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
  const bx = clamp(g.fx - bw / 2, cam.cx - half + 6, cam.cx + half - bw - 6), by = Math.max(6, g.labelY - fs * 1.6 - bh);
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
// Ruta entre habitaciones: los cuartos de atrás solo se comunican por el salón, siempre por el centro de las puertas.
function routeTo(a, tx, tz) {
  const ra = roomAt(a.x, a.z), rb = roomAt(tx, tz), pts = [];
  if (ra !== rb) {
    if (ra) { const d = ROOMS[ra].door; pts.push([d, ZB + .8], [d, ZS - .9]); }
    if (rb) { const d = ROOMS[rb].door; pts.push([d, ZS - .9], [d, ZB + .8]); }
  }
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
const blocked = (x, z) => OBST.some(o => x > o[0] && x < o[1] && z > o[2] && z < o[3]);
function spot(k) {
  const R = ROOMS[k]; let x, z, n = 0;
  do { x = rnd(R.wx[0], R.wx[1]); z = rnd(R.wz[0], R.wz[1]); } while (blocked(x, z) && ++n < 8);
  return [x, z];
}
function newTarget(a) {
  const k = Math.random() < .35 ? Math.floor(Math.random() * ROOMS.length) : roomAt(a.x, a.z);
  a.pts = routeTo(a, ...spot(k));
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
  Object.assign(v, { down: true, air: true, airT: 0, h: .01, vh: 5.2, vx: dir * 5, dirH: dir, bounce: 0, lie: 0, rot: 0, rb: roomAt(v.x, v.z), mark: '', scared: false });
  effects.push({ x: v.x, z: v.z, t: 0, txt: POW[Math.floor(Math.random() * POW.length)] });
}
function forceDown(v, g) {
  const dir = g && v.x < g.x ? -1 : 1;
  Object.assign(v, { down: true, air: false, h: 0, vx: 0, dirH: dir, rot: dir * Math.PI / 2, lie: 1, walking: false, mark: '', scared: false });
}
function physics(a, dt) {
  if (a.air) {
    const R = ROOMS[a.rb];
    a.airT += dt; a.vh -= 16 * dt; a.h += a.vh * dt;
    a.x = clamp(a.x + a.vx * dt, R.x0 + .5, R.x1 - .5);
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
    const cost = v => Math.hypot(v.x - a.x, v.z - a.z) + (roomAt(v.x, v.z) !== roomAt(a.x, a.z) ? 5 : 0);
    rest.sort((p, q) => cost(p) - cost(q));
    rv = rest[0]; rst = 'go'; rvSide = a.x <= rv.x ? -1 : 1; a.replan = 0; a.pts = [];
  }
  if (rst === 'go') {
    const R = ROOMS[roomAt(rv.x, rv.z)], gx = clamp(rv.x + rvSide * 1.0, R.x0 + .6, R.x1 - .6), gz = rv.z;
    a.replan -= dt;
    if (a.replan <= 0 || !a.pts.length) { a.pts = routeTo(a, gx, gz); a.replan = .3; }
    a.walking = true; a.wave = false;
    stepRoute(a, dt, 5.2);
    if (!a.pts.length && roomAt(a.x, a.z) === roomAt(rv.x, rv.z) && Math.hypot(a.x - gx, a.z - gz) < .15) {
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
  const R = ROOMS[roomAt(me.x, me.z)], dir = me.x - R.x0 > (R.x1 - R.x0) / 2 ? -1 : 1;
  const zc = z => clamp(z, R.z0 + .5, R.z1 - .5);
  grinch.gx = clamp(me.x + dir * 1.4, R.x0 + .6, R.x1 - .6); grinch.gz = zc(me.z - .6);
  gift.gx = clamp(me.x + dir * 2.9, R.x0 + .6, R.x1 - .6); gift.gz = zc(me.z + .1);
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
    if (phase === 'rampage' && grinch && roomAt(a.x, a.z) === roomAt(grinch.x, grinch.z) && Math.hypot(a.x - grinch.x, a.z - grinch.z) < 4.5) {
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
  let tcx, tcy, tz = 1;
  if (grinch && (phase === 'rampage' || phase === 'approach')) {
    const A = avatarGeom(grinch); tcx = A.fx; tcy = A.fy - 1.1 * U; tz = 1.1;
  } else if (grinch && phase === 'talk' && me && gift) {
    const A = [me, grinch, gift].map(avatarGeom), xs = A.map(g => g.fx);
    tcx = (Math.min(...xs) + Math.max(...xs)) / 2; tcy = A[1].fy - 2.4 * U;     // más arriba para que quepa el globo
    tz = clamp(cssW * .9 / (Math.max(...xs) - Math.min(...xs) + 5 * U), 1, 1.2);
  } else if (panned) { tcx = panX; tcy = panY; }
  else {
    const m = cast.find(a => a.mine);
    if (m) { const A = avatarGeom(m); tcx = A.fx; tcy = A.fy - 1.1 * U; }
    else { tcx = P(W / 2, 0, 0)[0]; tcy = P(0, 0, D * .5)[1]; }
  }
  const k = cam.snap || dragging ? 1 : 1 - Math.exp(-dt * 5);
  cam.z += (tz - cam.z) * k;
  const hw = cssW / cam.z / 2, hh = viewH / cam.z / 2;
  cam.cx += (clampAxis(tcx, hw, worldW) - cam.cx) * k;
  cam.cy += (clampAxis(tcy, hh, worldH) - cam.cy) * k;
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, viewH);
  ctx.translate(cssW / 2, viewH / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.cx, -cam.cy);
  const hw = cssW / cam.z / 2, hh = viewH / cam.z / 2;
  drawFloors(); drawBackWall();
  const list = [...walls, ...items, ...cast];
  if (grinch) list.push(grinch);
  list.sort((a, b) => b.z - a.z);
  for (const o of list) {
    if (o.draw) { o.draw(); continue; }
    const [fx, fy] = P(o.x, 0, o.z);
    if (Math.abs(fx - cam.cx) > hw + 2 * U || fy < cam.cy - hh - 1 * U || fy > cam.cy + hh + 4 * U) continue;
    drawAvatar(o);
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
  const wuW = W + 2, wuH = D * SP + H * CP + 2.2;
  viewH = clamp(Math.round(Math.min(innerHeight * .7, w * 1.05)), 320, 700);
  const fit = Math.min(cssW / wuW, viewH / wuH);
  s = cssW >= 700 ? fit : Math.max(fit, cssW / 10);     // en pantallas grandes cabe toda la casa; en el móvil se ve una parte y la cámara sigue la acción
  U = Math.max(s * .55, 20);
  worldW = s * wuW; worldH = s * wuH;
  ox = s; oy = worldH - s;
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(viewH * dpr);
  cv.style.height = viewH + 'px';
  if (!first) { const k = s / prev; cam.cx *= k; cam.cy *= k; panX *= k; panY *= k; }
  cam.z = 1; cam.snap = true;
}

function toWorld(e) {
  const r = cv.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  return [(px - cssW / 2) / cam.z + cam.cx, (py - viewH / 2) / cam.z + cam.cy];
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
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: cam.cx, cy: cam.cy }; moved = false; });
  cv.addEventListener('pointermove', e => {
    if (drag && free() && (e.buttons || e.pointerType === 'touch')) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (moved || Math.hypot(dx, dy) > 6) { moved = dragging = panned = true; panX = drag.cx - dx / cam.z; panY = drag.cy - dy / cam.z; }
    }
    hover = phase === 'pick' && !moved ? hit(e) : null; cv.style.cursor = hover ? 'pointer' : 'grab';
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
    const a = { i, n: p.n, label: p.nick || p.n, mine: false, x: 0, z: 0, t: rnd(0, 9), v: rnd(.9, 1.5), wait: rnd(0, 2), walking: false, wave: false, seen: false, img: null, pts: [], mark: '' };
    [a.x, a.z] = spot(Math.floor(rnd(0, ROOMS.length)));
    newTarget(a);
    if (p.p) { a.img = new Image(); a.img.src = p.p; }
    return a;
  });
  items = buildItems(); walls = buildWalls();
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
function focusRoom(k) {
  const R = ROOMS[k], [px, py] = P((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
  panned = true; panX = px; panY = py - U * .5;
}
function follow() { panned = false; }

// El Grinch entra por la puerta de la calle.
function encounter(meIdx, giftIdx, say, done) {
  me = cast[meIdx]; gift = cast[giftIdx]; text = say; talkDone = false; onTalkDone = done; hover = null; panned = false;
  grinch = { i: -1, n: 'El Grinch', label: 'El Grinch', grinch: true, x: W / 2, z: .4, t: 0, v: 0, wait: 0, walking: false, wave: false, img: null, bat: true, swingP: -1, pts: [], replan: 0, mark: '' };
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
