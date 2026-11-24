import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import Lenis from 'lenis';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const mobile = matchMedia('(pointer:coarse)').matches || innerWidth < 760;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- constantes del edificio (metros) ---------- */
const FH = 3.2, FLOORS = 6, AK = 3;      // alto de planta, plantas, planta del ático (0 = baja)
const FY = AK * FH;                       // cota del suelo de la vivienda
const HW = 9.5, HD = 5;                   // medio ancho y medio fondo exteriores

/* pseudoaleatorio con semilla: el edificio es siempre igual */
let seed = 7;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* ---------- renderer / escena ---------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#f6b98f');
scene.background = HORIZON;
scene.fog = new THREE.Fog(HORIZON, 110, 420);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1200);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const root = new THREE.Group(); scene.add(root);
const apt = new THREE.Group(); apt.position.y = FY; root.add(apt);   // coordenadas locales de la vivienda

/* ---------- texturas procedurales ---------- */
function ctex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
const texWood = ctex(512, 512, (g, w, h) => {
  const n = 8, ph = h / n;
  for (let i = 0; i < n; i++) {
    const l = 56 + rnd() * 10;
    g.fillStyle = `hsl(32, ${34 + rnd() * 8}%, ${l}%)`; g.fillRect(0, i * ph, w, ph);
    for (let j = 0; j < 40; j++) { g.strokeStyle = `rgba(90,55,25,${.05 + rnd() * .09})`; g.lineWidth = .5 + rnd(); const y = i * ph + rnd() * ph; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rnd() * 5 - 2.5, w * .6, y + rnd() * 5 - 2.5, w, y); g.stroke(); }
    g.fillStyle = 'rgba(60,35,15,.55)'; g.fillRect(0, i * ph, w, 1.5);
    const cut = rnd() * w; g.fillRect(cut, i * ph, 1.5, ph);
  }
});
const texDeck = ctex(256, 256, (g, w, h) => {
  const n = 8, pw = w / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = `hsl(25, ${26 + rnd() * 8}%, ${34 + rnd() * 8}%)`; g.fillRect(i * pw, 0, pw, h);
    g.fillStyle = 'rgba(20,10,5,.7)'; g.fillRect(i * pw, 0, 2, h);
    for (let j = 0; j < 14; j++) { g.strokeStyle = 'rgba(0,0,0,.12)'; g.beginPath(); const x = i * pw + rnd() * pw; g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }
});
const texMarble = ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#efecE8'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = `rgba(${90 + rnd() * 40},${90 + rnd() * 40},${100 + rnd() * 40},${.08 + rnd() * .2})`; g.lineWidth = .6 + rnd() * 1.6;
    g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += rnd() * 140 - 50; y += rnd() * 140 - 50; g.quadraticCurveTo(x + rnd() * 60 - 30, y + rnd() * 60 - 30, x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(80,80,90,.28)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
});
const texStone = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#d6d0c6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '90,85,75'},${rnd() * .07})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
  g.strokeStyle = 'rgba(70,65,55,.28)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
});
const art = pal => ctex(256, 160, (g, w, h) => {
  g.fillStyle = pal[0]; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) { g.fillStyle = pal[1 + i % (pal.length - 1)]; g.globalAlpha = .9; g.beginPath(); g.arc(rnd() * w, rnd() * h, 20 + rnd() * 60, 0, 7); g.fill(); }
  g.globalAlpha = 1; g.fillStyle = pal[pal.length - 1]; g.fillRect(0, h * .72, w, h * .28);
});
const texArt = [art(['#e9dcc6', '#c8553d', '#e8a76b', '#3f5d5a', '#2c3b4a']), art(['#2d4a5a', '#e8a76b', '#f1e3c8', '#c8553d', '#142027']), art(['#f2ece0', '#9bb59a', '#d8a47f', '#5c7a73', '#c9b8a3'])];
function winTex(lit) {
  return ctex(128, 256, (g, w, h) => {
    g.fillStyle = lit ? '#000' : '#c4b9a6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
      const on = rnd() < .3;
      g.fillStyle = lit ? (on ? '#ffcf8a' : '#000') : (on ? '#d9bf94' : '#56627a');
      g.fillRect(x * 32 + 6, y * 32 + 6, 20, 22);
    }
  });
}

const texRug = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#d6c9b2'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,250,240' : '120,100,70'},${rnd() * .12})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 1); }
  g.strokeStyle = '#a89577'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
});

/* ---------- materiales ---------- */
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: 0, ...o });
const m = {
  plaster: M('#efe8dc', { roughness: .95, emissive: '#4a4034', emissiveIntensity: .35 }), stone: M('#d9d1c3', { roughness: .95 }), stoneDk: M('#6f685e', { roughness: .9 }),
  slab: M('#ebe7df', { roughness: .9 }), dark: M('#1d1f24', { roughness: .45, metalness: .6 }), steel: M('#b4b8be', { roughness: .3, metalness: .9 }),
  oak: M('#ffffff', { map: texWood, roughness: .55 }), walnut: M('#6e4a30', { roughness: .6 }), wood: M('#a8794a', { roughness: .65 }),
  deck: M('#ffffff', { map: texDeck, roughness: .8 }), marble: M('#ffffff', { map: texMarble, roughness: .22 }), tile: M('#ffffff', { map: texStone, roughness: .6 }),
  white: M('#f4f1ea', { roughness: .55 }), graphite: M('#2c3037', { roughness: .5 }), black: M('#0c0d10', { roughness: .3, metalness: .2 }),
  sofa: M('#cbbba2', { roughness: 1 }), linen: M('#ece6da', { roughness: 1 }), terra: M('#c8553d', { roughness: 1 }), mustard: M('#d9a441', { roughness: 1 }),
  olive: M('#7d8560', { roughness: 1 }), leaf: M('#4c7a45', { roughness: .8 }), leaf2: M('#6b9a52', { roughness: .8 }), pot: M('#d8cdbc', { roughness: .8 }),
  rug: M('#ffffff', { map: texRug, roughness: 1 }), rug2: M('#b9a68a', { roughness: 1 }),
  glass: M('#cfe6ee', { roughness: .04, metalness: 0, transparent: true, opacity: .16, envMapIntensity: 1.6, depthWrite: false }),
  warm: new THREE.MeshStandardMaterial({ color: '#fff0d0', emissive: '#ffcf8a', emissiveIntensity: 2.2 }),
  screen: new THREE.MeshStandardMaterial({ color: '#05070a', emissive: '#2a4a78', emissiveIntensity: .7, roughness: .2 }),
  grass: M('#5f7a4a', { roughness: 1 }), asphalt: M('#2b2d33', { roughness: .95 }), pave: M('#bdb6a8', { roughness: .95 }), water: M('#2fb5c4', { roughness: .08, metalness: .1, envMapIntensity: 1.5 }),
  winDark: M('#16212f', { roughness: .15, metalness: .7, envMapIntensity: 1.4 }),
  winWarm: new THREE.MeshStandardMaterial({ color: '#2a2018', emissive: '#ffb765', emissiveIntensity: .9, roughness: .3 }),
  winCool: new THREE.MeshStandardMaterial({ color: '#142030', emissive: '#7fa9e6', emissiveIntensity: .55, roughness: .3 }),
  art: texArt.map(t => new THREE.MeshStandardMaterial({ map: t, roughness: .9 })),
  curtain: M('#f3ede2', { roughness: 1, transparent: true, opacity: .8 }),
};

/* ---------- helpers de geometría ---------- */
function put(geo, mat, x, y, z, parent, shadow = true) {
  const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z);
  o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o;
}
const box = (w, h, d, mat, x, y, z, parent = apt, shadow = true) => put(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, shadow);
const cyl = (rt, rb, h, mat, x, y, z, parent = apt, seg = 20) => put(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, parent);
function rgeo(w, h, d, r = .05) {
  const b = Math.min(r, w / 2 - .002, h / 2 - .002, d / 2 - .002, .06), s = new THREE.Shape(), x = -(w - 2 * b) / 2, y = -(h - 2 * b) / 2, ww = w - 2 * b, hh = h - 2 * b, rr = Math.max(b * .6, .001);
  s.moveTo(x + rr, y); s.lineTo(x + ww - rr, y); s.quadraticCurveTo(x + ww, y, x + ww, y + rr); s.lineTo(x + ww, y + hh - rr); s.quadraticCurveTo(x + ww, y + hh, x + ww - rr, y + hh);
  s.lineTo(x + rr, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - rr); s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -(d - 2 * b) / 2); return g;
}
const rbox = (w, h, d, mat, x, y, z, parent = apt, r = .05, ry = 0) => { const o = put(rgeo(w, h, d, r), mat, x, y, z, parent); o.rotation.y = ry; return o; };

/* suelo con UV en coordenadas de mundo para que la textura continúe entre estancias */
function floorRect(x1, z1, x2, z2, y, mat, tile = 2.4) {
  const w = x2 - x1, d = z2 - z1, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + pos.getX(i)) / tile, (cz + pos.getZ(i)) / tile);
  const o = new THREE.Mesh(g, mat); o.position.set(cx, y, cz); o.receiveShadow = true; apt.add(o); return o;
}

/* pared recta con huecos; (x1,z1)-(x2,z2) alineada a un eje, y0..y1 en coordenadas locales */
function wall(x1, z1, x2, z2, y0, y1, t, mat, openings = [], parent = apt) {
  const alongZ = Math.abs(x1 - x2) < 1e-6, a1 = alongZ ? Math.min(z1, z2) : Math.min(x1, x2), a2 = alongZ ? Math.max(z1, z2) : Math.max(x1, x2), fixed = alongZ ? x1 : z1;
  const seg = (a, b, ya, yb) => {
    if (b - a < 1e-4 || yb - ya < 1e-4) return;
    const len = b - a, mid = (a + b) / 2;
    if (alongZ) box(t, yb - ya, len, mat, fixed, (ya + yb) / 2, mid, parent); else box(len, yb - ya, t, mat, mid, (ya + yb) / 2, fixed, parent);
  };
  let c = a1;
  for (const o of [...openings].sort((p, q) => p.a - q.a)) {
    seg(c, o.a, y0, y1);
    seg(o.a, o.b, y0, o.y0 ?? 0); seg(o.a, o.b, o.y1 ?? 2.3, y1);
    c = o.b;
  }
  seg(c, a2, y0, y1);
}

/* ---------- luz ---------- */
scene.add(new THREE.HemisphereLight('#ffe9d2', '#6e5d4c', .55));
const sunDir = new THREE.Vector3(.5, .4, .78).normalize();
const sun = new THREE.DirectionalLight('#ffd7a6', 3.3);
sun.position.copy(sunDir).multiplyScalar(70).add(new THREE.Vector3(0, FY, 0));
sun.target.position.set(0, FY, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 10, far: 160 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; sun.shadow.radius = 3;
scene.add(sun, sun.target);

const rlights = [];
function lamp(x, y, z, color = '#ffd9a0', i = 9, d = 8) {
  const l = new THREE.PointLight(color, i, d, 1.7); l.position.set(x, y, z); apt.add(l); rlights.push(l);
}
[[5.5, 2.7, 2.2], [3.6, 2.7, -2.6], [7.4, 2.7, -2.6], [.25, 2.7, .4], [-5, 2.7, -3], [-5, 2.7, 2.5], [-6.5, 2.7, -.5]].forEach(p => lamp(...p));

/* ---------- cielo ---------- */
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sun: { value: sunDir }, top: { value: new THREE.Color('#1f3f73') }, mid: { value: new THREE.Color('#e48f78') }, hor: { value: HORIZON }, glow: { value: new THREE.Color('#ffd49a') } },
  vertexShader: 'varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform vec3 sun,top,mid,hor,glow; varying vec3 vD;
    void main(){ vec3 d=normalize(vD); float h=d.y;
      vec3 c=mix(hor,mid,smoothstep(-.02,.18,h)); c=mix(c,top,smoothstep(.12,.7,h)); c=mix(c,hor*.9,smoothstep(0.,-.25,h));
      float s=max(dot(d,normalize(sun)),0.); c+=glow*(pow(s,10.)*.45+pow(s,260.)*3.);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
scene.add(sky);
const puff = ctex(128, 64, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,225,200,.9)'); r.addColorStop(1, 'rgba(255,200,170,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
for (let i = 0; i < 12; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, opacity: .35 + rnd() * .3, depthWrite: false, fog: false }));
  const a = rnd() * 6.28, r = 300 + rnd() * 120; s.position.set(Math.cos(a) * r, 80 + rnd() * 90, Math.sin(a) * r); s.scale.set(180 + rnd() * 120, 40 + rnd() * 30, 1); scene.add(s);
}

/* =====================================================================
   EDIFICIO
   ===================================================================== */
const winMats = [m.winDark, m.winDark, m.winWarm, m.winWarm, m.winCool];
const pickWin = () => winMats[Math.floor(rnd() * winMats.length)];

for (let k = 0; k <= FLOORS; k++) {
  const y0 = k * FH;
  box(HW * 2 + .2, .2, HD * 2 + .2, m.slab, 0, y0 - .1, 0, root);                     // forjado
  if (k < FLOORS) {
    box(HW * 2 + .2, .2, 2.5, m.slab, 0, y0 - .1, HD + 1.25, root);                    // balcón corrido
    // barandilla de cristal + pasamanos
    box(HW * 2, 1.05, .03, m.glass, 0, y0 + .525, HD + 2.42, root, false);
    box(HW * 2, .03, .05, m.steel, 0, y0 + 1.06, HD + 2.42, root, false);
    box(.03, 1.05, 2.4, m.glass, -HW + .05, y0 + .525, HD + 1.3, root, false); box(.03, 1.05, 2.4, m.glass, HW - .05, y0 + .525, HD + 1.3, root, false);
  }
  if (k >= FLOORS || k === AK) continue;
  box(HW * 2, FH - .2, HD * 2, k === 0 ? m.stoneDk : m.stone, 0, y0 + (FH - .2) / 2, 0, root);        // volumen macizo
  for (let i = 0; i < 6; i++) {                                                                      // ventanas frontales y traseras
    const x = -7.5 + 3 * i;
    if (k === 0) continue;
    box(1.9, 2.1, .06, pickWin(), x, y0 + 1.5, HD + .03, root, false);
    box(1.9, 2.1, .06, pickWin(), x, y0 + 1.5, -HD - .03, root, false);
  }
  for (let j = 0; j < 3; j++) { const z = -3 + 3 * j; box(.06, 2.1, 1.5, pickWin(), HW + .03, y0 + 1.5, z, root, false); box(.06, 2.1, 1.5, pickWin(), -HW - .03, y0 + 1.5, z, root, false); }
  if (k === 0) {                                                                                      // vestíbulo
    box(7, 2.5, .06, m.winWarm, 0, 1.45, HD + .03, root, false); box(.1, 2.5, .08, m.dark, -3.5, 1.45, HD + .04, root, false); box(.1, 2.5, .08, m.dark, 3.5, 1.45, HD + .04, root, false); box(.1, 2.5, .08, m.dark, 0, 1.45, HD + .04, root, false);
    box(6, .12, 2.4, m.dark, 0, 2.9, HD + 1.2, root);
  } else {
    for (let q = 0; q < 3; q++) {                                                                    // jardineras
      const x = -8 + rnd() * 16, z = HD + 2.1;
      box(.9, .4, .4, m.stoneDk, x, y0 + .2, z, root);
      const b = put(new THREE.IcosahedronGeometry(.42, 1), rnd() < .5 ? m.leaf : m.leaf2, x, y0 + .65, z, root); b.scale.y = .8;
    }
  }
}
// aletas de madera en las esquinas de la fachada
for (const s of [-1, 1]) {
  box(.5, FLOORS * FH, .22, m.wood, s * (HW - .25), FLOORS * FH / 2, HD + .11, root);
  box(.5, FLOORS * FH, .22, m.wood, s * (HW - .25), FLOORS * FH / 2, -HD - .11, root);
}
// cubierta: peto, casetón, piscina comunitaria
const RY = FLOORS * FH;
box(HW * 2 + .2, .6, .2, m.stone, 0, RY + .3, HD, root); box(HW * 2 + .2, .6, .2, m.stone, 0, RY + .3, -HD, root);
box(.2, .6, HD * 2, m.stone, -HW, RY + .3, 0, root); box(.2, .6, HD * 2, m.stone, HW, RY + .3, 0, root);
box(5, 2.4, 3.6, m.stone, 5, RY + 1.2, -2.2, root); box(7.5, .06, 3.4, m.water, -4.2, RY + .06, 1.2, root, false);
box(7.9, .1, 3.8, m.white, -4.2, RY + .05, 1.2, root);

/* =====================================================================
   VIVIENDA (planta AK). Coordenadas locales: y=0 es el suelo.
   Interior: x -9..9, z -4.5..4.5. Fachada con terraza hacia +z.
   ===================================================================== */
const H = 3.0, T = .14;
// suelos
floorRect(1.5, 0, 9, 4.5, .004, m.oak);        // salón
floorRect(1.5, -4.5, 9, 0, .004, m.tile, 1.5); // cocina
floorRect(-1, -4.5, 1.5, 4.5, .004, m.oak);    // pasillo
floorRect(-9, .5, -1, 4.5, .004, m.oak);       // dormitorio principal
floorRect(-9, -4.5, -1, -1.5, .004, m.oak);    // dormitorio 2
floorRect(-9, -1.5, -4, .5, .004, m.marble, 1.2); // baño
floorRect(-4, -1.5, -1, .5, .004, m.marble, 1.2); // aseo
floorRect(-HW, HD, HW, HD + 2.5, .004, m.deck, 2.0); // terraza

// techo blanco con un poco de luz propia (simula el rebote de luz)
{ const c = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), new THREE.MeshStandardMaterial({ color: '#f6f2ea', emissive: '#6a6054', emissiveIntensity: .8, roughness: 1 })); c.rotation.x = Math.PI / 2; c.position.set(0, H - .005, 0); apt.add(c); }
// tabiques interiores
const DOOR = { y0: 0, y1: 2.3 };
wall(1.5, -4.5, 1.5, 4.5, 0, H, T, m.plaster, [{ a: -3.4, b: -2.1, ...DOOR }, { a: 2.7, b: 3.9, ...DOOR }]);
wall(-1, -4.5, -1, 4.5, 0, H, T, m.plaster, [{ a: -3.4, b: -2.1, ...DOOR }, { a: -.9, b: .2, ...DOOR }, { a: 2.7, b: 3.9, ...DOOR }]);
wall(-9, .5, -1, .5, 0, H, T, m.plaster, [{ a: -6.6, b: -5.4, ...DOOR }]);
wall(-9, -1.5, -1, -1.5, 0, H, T, m.plaster);
wall(-4, -1.5, -4, .5, 0, H, T, m.plaster);
// revestimiento de mármol en baño y aseo
box(5, H, .02, m.marble, -6.5, H / 2, -1.42, apt, false); box(.02, H, 2, m.marble, -8.98, H / 2, -.5, apt, false); box(.02, H, 2, m.marble, -4.07, H / 2, -.5, apt, false);
box(3, H, .02, m.marble, -2.5, H / 2, -1.42, apt, false); box(3, H, .02, m.marble, -2.5, H / 2, .42, apt, false); box(5, H, .02, m.marble, -6.5, H / 2, .42, apt, false);

// fachadas de la vivienda (cerramiento macizo con huecos acristalados)
const WIN = (a, b, y0 = .9, y1 = 2.6) => ({ a, b, y0, y1 });
wall(-HW, -HD, HW, -HD, 0, H, .5, m.plaster, [WIN(-8, -6.2), WIN(-3.5, -1.5), WIN(4.8, 7), WIN(-.1, .6, 1.4, 2.4)].filter(o => o.b - o.a > .8));
wall(HW - .25, -HD, HW - .25, HD, 0, H, .5, m.plaster, [WIN(.5, 3.9), WIN(-3.8, -1.5)]);
wall(-HW + .25, -HD, -HW + .25, HD, 0, H, .5, m.plaster, [WIN(-3.6, -2)]);
const glassOn = (x, z, w, d, y0, y1) => box(w, y1 - y0, d, m.glass, x, (y0 + y1) / 2, z, apt, false);
glassOn(0, -HD + .1, 1.7, .03, .9, 2.6);
glassOn(-7.1, -HD + .15, 1.8, .03, .9, 2.6); glassOn(-2.5, -HD + .15, 2, .03, .9, 2.6); glassOn(5.9, -HD + .15, 2.2, .03, .9, 2.6);
glassOn(HW - .25, 2.2, .03, 3.4, .9, 2.6); glassOn(HW - .25, -2.65, .03, 2.3, .9, 2.6); glassOn(-HW + .25, -2.8, .03, 1.6, .9, 2.6);
// frente: cortina de vidrio de suelo a techo con dos puertas correderas abiertas
const FZ = HD - .25;
const gaps = [[3.9, 5.1], [-6.6, -5.4]];
let gx = -9;
const cuts = [-9, ...gaps.flat().sort((a, b) => a - b), 9];
for (let i = 0; i < cuts.length; i += 2) {
  const a = cuts[i], b = cuts[i + 1], n = Math.max(1, Math.round((b - a) / 1.8)), w = (b - a) / n;
  for (let j = 0; j < n; j++) glassOn(a + w * (j + .5), FZ, w - .04, .03, 0, H);
  for (let j = 0; j <= n; j++) box(.07, H, .1, m.dark, a + w * j, H / 2, FZ, apt);
}
for (const x of [4.5, -6]) { glassOn(x + 1.2 * (x > 0 ? 1 : 1), FZ + .09, 1.14, .03, 0, H); }
box(HW * 2, .06, .1, m.dark, 0, .03, FZ, apt); box(HW * 2, .06, .1, m.dark, 0, H - .03, FZ, apt);

// ---- focos de techo (decorativos)
for (const [x, z] of [[4, 1], [7, 1], [4, 3.6], [7, 3.6], [3.5, -2.6], [7.3, -2.6], [.25, -2], [.25, 1.5], [.25, 3.3], [-3, 2.5], [-6, 2.5], [-3, -3], [-6, -3], [-6.5, -.5], [-2.5, -.5]]) cyl(.07, .07, .03, m.warm, x, H - .02, z, apt, 10);

/* ---------- mobiliario ---------- */
function plant(x, z, s = 1, parent = apt, y = 0, pot = m.pot) {
  cyl(.2 * s, .16 * s, .4 * s, pot, x, y + .2 * s, z, parent, 14);
  cyl(.02 * s, .03 * s, .9 * s, m.walnut, x, y + .8 * s, z, parent, 6);
  for (let i = 0; i < 6; i++) { const l = put(new THREE.IcosahedronGeometry(.28 * s, 1), i % 2 ? m.leaf : m.leaf2, x + (rnd() - .5) * .35 * s, y + (1.05 + i * .13) * s, z + (rnd() - .5) * .35 * s, parent); l.scale.set(1, .75, 1); }
}
function pendant(x, y, z, r = .22) {
  cyl(.006, .006, H - y, m.black, x, (H + y) / 2, z, apt, 4);
  const s = put(new THREE.SphereGeometry(r, 18, 14), m.warm, x, y, z, apt, false);
  s.material = m.warm;
}
function chair(x, z, ry, parent = apt, y = 0, mat = m.wood) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  box(.46, .05, .46, mat, 0, .45, 0, g); box(.46, .5, .05, mat, 0, .72, -.21, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.04, .45, .04, m.dark, sx * .2, .225, sz * .2, g);
}
function stool(x, z) { cyl(.19, .19, .06, m.walnut, x, .7, z, apt, 18); cyl(.02, .02, .68, m.dark, x, .35, z, apt, 6); cyl(.17, .17, .02, m.dark, x, .02, z, apt, 14); }
function nightstand(x, z, shade = true) { box(.42, .45, .42, m.wood, x, .32, z); box(.42, .03, .42, m.white, x, .565, z); cyl(.02, .02, .3, m.dark, x, .73, z, apt, 6); const s = cyl(.12, .16, .2, m.warm, x, .96, z, apt, 14); s.castShadow = false; }
function frame(mat, w, h, x, y, z, ry) { const o = box(w, h, .04, mat, x, y, z); o.rotation.y = ry; box(w + .06, h + .06, .03, m.dark, x, y, z).rotation.y = ry; o.position.add(new THREE.Vector3(Math.sin(ry) * .02, 0, Math.cos(ry) * .02)); }

// SALÓN ------------------------------------------------------------------
rbox(4.4, .03, 3.2, m.rug, 6.5, .02, 2.1, apt, .01);
rbox(1.0, .42, 3.2, m.sofa, 8.35, .33, 2, apt, .08);                         // asiento
rbox(.3, .6, 3.2, m.sofa, 8.75, .72, 2, apt, .08);                           // respaldo
rbox(1.0, .26, .28, m.sofa, 8.35, .5, .42, apt, .06); rbox(1.0, .26, .28, m.sofa, 8.35, .5, 3.58, apt, .06);
rbox(1.9, .42, .9, m.sofa, 7.9, .33, -.1, apt, .08); rbox(.3, .6, .9, m.sofa, 8.75, .72, -.1, apt, .08);        // chaise
for (const z of [.9, 2, 3.1]) rbox(.7, .16, .98, m.linen, 8.2, .62, z, apt, .06);
for (const [z, mat, ry] of [[.6, m.terra, .2], [3.4, m.mustard, -.3], [1.5, m.olive, .15]]) rbox(.12, .4, .42, mat, 8.35, .86, z, apt, .05, ry);
cyl(.65, .65, .04, m.marble, 6.5, .4, 2, apt, 32); cyl(.08, .08, .38, m.dark, 6.5, .19, 2, apt, 10); cyl(.4, .4, .02, m.dark, 6.5, .015, 2, apt, 24);
cyl(.3, .3, .5, m.walnut, 7.2, .25, 3.3, apt, 20);
rbox(.85, .45, .85, m.terra, 4.9, .3, .55, apt, .12, .8);  rbox(.85, .6, .2, m.terra, 4.65, .68, .35, apt, .08, .8);
cyl(.015, .015, 1.6, m.dark, 4.1, .8, -.15, apt, 6); put(new THREE.SphereGeometry(.22, 16, 12), m.warm, 4.1, 1.7, -.15, apt, false);
rbox(.45, .5, 2.2, m.walnut, 1.82, .5, 1.3, apt, .02);                       // mueble TV
box(.05, .95, 1.7, m.screen, 1.6, 1.55, 1.3);
box(.04, 1.3, 2.6, m.walnut, 1.58, 1.4, 1.3, apt, false).position.x = 1.575;
plant(8.5, 4.15, 1.2); plant(1.95, 4.15, 1.1); plant(8.55, -.35, .8);
pendant(6.5, 1.95, 2, .26);
frame(m.art[0], 1.2, .75, 9.07 - .2, 1.55, -1.2, -Math.PI / 2);

// COCINA -----------------------------------------------------------------
box(6.3, .88, .62, m.graphite, 5.85, .44, -4.19);                            // bajos
box(6.34, .04, .66, m.marble, 5.85, .9, -4.17);
box(2.2, .85, .36, m.wood, 3.5, 1.95, -4.3); box(1.7, .85, .36, m.wood, 8.1, 1.95, -4.3);
box(.7, .02, .5, m.black, 3.9, .925, -4.15); box(.06, .06, .06, m.steel, 5.9, 1.0, -4.45);
box(.95, 2.1, .68, m.steel, 2.15, 1.05, -4.15); box(.01, 1.8, .02, m.dark, 2.62, 1.05, -3.8);
box(3.7, .88, 1.0, m.walnut, 6.4, .44, -2.2); box(3.9, .05, 1.2, m.marble, 6.4, .905, -2.1); box(3.9, .05, .02, m.walnut, 6.4, .82, -1.48, apt, false);
box(.7, .01, .5, m.black, 7.3, .94, -2.2);
for (const x of [5.3, 6.4, 7.5]) stool(x, -1.15);
for (const x of [5.2, 6.4, 7.6]) pendant(x, 1.85, -2.1, .17);
put(new THREE.SphereGeometry(.14, 12, 10), m.mustard, 5.4, 1.0, -2.1, apt); put(new THREE.SphereGeometry(.12, 12, 10), m.terra, 5.62, 1.0, -2.05, apt);
box(.5, .04, .3, m.wood, 4.9, .95, -4.15);

// PASILLO ----------------------------------------------------------------
rbox(1.1, .02, 7.4, m.rug2, .25, .018, -.4, apt, .005);
box(.34, .82, 1.5, m.walnut, 1.28, .41, .6); box(.34, .03, 1.5, m.marble, 1.28, .83, .6);
const mir = cyl(.45, .45, .03, m.steel, 1.42, 1.65, .6, apt, 32); mir.rotation.z = Math.PI / 2; mir.material = M('#dfe9ee', { roughness: .08, metalness: .5 });
cyl(.12, .1, .24, m.pot, 1.28, .96, .2, apt, 12); plant(-.55, -4.05, 1.1); plant(1.0, 4.1, .9);
frame(m.art[1], .9, .6, -.87, 1.6, 1.4, Math.PI / 2); frame(m.art[2], .6, .8, -.87, 1.6, 2.2, Math.PI / 2);
pendant(.25, 2.0, -.8, .2); pendant(.25, 2.0, 2.2, .2);

// DORMITORIO 2 ----------------------------------------------------------
rbox(4.2, .02, 3.0, m.rug, -6.8, .02, -3, apt, .005);
box(2.2, .22, 1.7, m.dark, -7.9, .18, -3);
rbox(2.1, .3, 1.65, M('#f2eee6', { roughness: 1 }), -7.85, .44, -3, apt, .06);
rbox(1.5, .12, 1.72, M('#6f8794', { roughness: 1 }), -7.35, .6, -3, apt, .05);
for (const z of [-3.5, -2.5]) rbox(.42, .12, .62, m.linen, -8.55, .62, z, apt, .05, .1);
box(.1, 1.05, 2.4, m.walnut, -8.92, .7, -3);
nightstand(-8.55, -4.15); nightstand(-8.55, -1.85);
frame(m.art[2], 1.4, .85, -8.91, 1.75, -3, Math.PI / 2);
box(1.7, .04, .7, m.wood, -2.55, .74, -4.15); box(.05, .72, .6, m.dark, -3.3, .36, -4.15); box(.05, .72, .6, m.dark, -1.8, .36, -4.15);
chair(-2.6, -3.5, Math.PI, apt, 0, m.walnut);
box(.32, .01, .22, m.steel, -2.5, .765, -4.1).rotation.y = .2; box(.02, .2, .3, m.dark, -2.5, .86, -4.22).rotation.x = -.2;
cyl(.015, .015, .4, m.dark, -3.2, .95, -4.2, apt, 6); put(new THREE.SphereGeometry(.07, 10, 8), m.warm, -3.2, 1.17, -4.2, apt, false);
box(3.5, 2.5, .6, m.white, -4.5, 1.25, -1.88);
for (let i = 0; i < 7; i++) box(.01, 2.3, .02, m.dark, -6.1 + i * .5, 1.25, -1.57);
for (let i = 0; i < 6; i++) box(.02, .5, .03, m.dark, -6.1 + .25 + i * .5, 1.25, -1.57);
plant(-1.6, -4.0, 1);

// DORMITORIO PRINCIPAL ---------------------------------------------------
rbox(4.2, .02, 3.4, m.rug, -6.8, .02, 2.5, apt, .005);
box(2.3, .22, 2.1, m.dark, -7.85, .18, 2.5);
rbox(2.2, .32, 2.05, M('#f2eee6', { roughness: 1 }), -7.8, .45, 2.5, apt, .06);
rbox(1.7, .12, 2.1, M('#c6b59a', { roughness: 1 }), -7.1, .62, 2.5, apt, .05);
rbox(.8, .06, 2.1, m.terra, -6.4, .66, 2.5, apt, .03);
for (const z of [1.85, 3.15]) rbox(.45, .13, .68, m.linen, -8.5, .64, z, apt, .05, z > 2.5 ? -.1 : .1);
box(.1, 1.15, 2.7, m.walnut, -8.92, .72, 2.5);
rbox(.5, .42, 1.8, m.sofa, -6.0, .26, 2.5, apt, .06);                        // banco
nightstand(-8.55, 1.12); nightstand(-8.55, 3.88);
frame(m.art[0], 1.8, 1.1, -8.91, 1.85, 2.5, Math.PI / 2);
box(3.5, 2.5, .6, m.white, -3.05, 1.25, .88);
for (let i = 0; i < 7; i++) box(.01, 2.3, .02, m.dark, -4.5 + i * .5, 1.25, 1.19);
plant(-1.6, 4.1, 1.2);
for (const x0 of [-9, -7.9]) box(.55, 2.8, .04, m.curtain, x0 + .3, 1.5, 4.3, apt, false);
for (const x0 of [-4.3, -3.3]) box(.55, 2.8, .04, m.curtain, x0, 1.5, 4.3, apt, false);

// BAÑO -------------------------------------------------------------------
const tub = put(new THREE.CapsuleGeometry(.38, 1.2, 8, 20), M('#fbfbf9', { roughness: .15 }), -7.8, .3, -.55, apt); tub.rotation.z = Math.PI / 2; tub.scale.set(1, 1, 1.1); tub.scale.x = .8;
box(1.8, .03, .02, m.steel, -7.8, .02, -.1, apt, false);
box(1.9, .55, .5, m.walnut, -5.9, .85, -1.2); box(2.0, .05, .54, m.marble, -5.9, 1.14, -1.18);
for (const x of [-6.3, -5.5]) { cyl(.17, .14, .1, m.white, x, 1.22, -1.18, apt, 20); cyl(.012, .012, .26, m.steel, x, 1.32, -1.38, apt, 8); }
box(1.9, .95, .03, M('#dfe9ee', { roughness: .08, metalness: .5 }), -5.9, 1.9, -1.41, apt, false);
box(2.05, 1.1, .01, m.warm, -5.9, 1.9, -1.425, apt, false);
box(.03, 2.3, 1.2, m.glass, -4.45, 1.15, -.8, apt, false); box(.04, .04, 1.25, m.dark, -4.45, 2.3, -.8, apt, false); cyl(.1, .1, .03, m.steel, -4.3, 2.4, -.55, apt, 16);
// aseo
cyl(.18, .15, .4, m.white, -3.3, .22, -1.1, apt, 16); box(.4, .35, .2, m.white, -3.3, .5, -1.32); box(.45, .08, .35, m.white, -1.9, .85, -1.25); cyl(.01, .01, .2, m.steel, -1.9, .95, -1.38, apt, 6);

// TERRAZA ----------------------------------------------------------------
const tz = HD + 1.5;
box(2.0, .04, 1.0, m.wood, 6.6, .74, tz + .1); cyl(.04, .04, .72, m.dark, 5.8, .36, tz + .1, apt, 8); cyl(.04, .04, .72, m.dark, 7.4, .36, tz + .1, apt, 8);
for (const [x, z, r] of [[6.0, tz - .7, 0], [7.2, tz - .7, 0], [6.0, tz + .9, Math.PI], [7.2, tz + .9, Math.PI]]) chair(x, z, r, apt, 0, m.wood);
cyl(.012, .012, 2.2, m.dark, 6.6, 1.1, tz + .1, apt, 6); const par = put(new THREE.ConeGeometry(1.5, .4, 16, 1, true), M('#f1e6d2', { side: THREE.DoubleSide }), 6.6, 2.25, tz + .1, apt);
for (const [x, z] of [[-8.0, tz - .3], [-8.0, tz + .6]]) {
  rbox(.65, .14, 1.6, m.linen, x, .32, z, apt, .05, 0); box(.05, .3, 1.5, m.wood, x - .26, .17, z); box(.05, .3, 1.5, m.wood, x + .26, .17, z);
  rbox(.65, .5, .1, m.linen, x, .55, z - .8, apt, .04).rotation.x = .5;
}
cyl(.2, .2, .4, m.stoneDk, -6.6 + 3.2, .2, tz + .6, apt, 14);
for (const x of [-8.7, 0, 2.5, 9.0]) { box(.8, .4, .4, m.stoneDk, x, .2, HD + 2.2); const b = put(new THREE.IcosahedronGeometry(.45, 1), m.leaf, x, .7, HD + 2.2, apt); b.scale.y = .85; }

/* =====================================================================
   ENTORNO
   ===================================================================== */
const gnd = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), m.grass); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; root.add(gnd);
const strip = (z1, z2, mat, y = .01, x1 = -300, x2 = 300) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat); o.rotation.x = -Math.PI / 2; o.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); o.receiveShadow = true; root.add(o); };
strip(HD + 2.5, 15, m.grass, .005); strip(15, 17.5, m.pave, .02); strip(17.5, 29, m.asphalt, .02); strip(29, 32, m.pave, .02);
strip(HD + 2.5, 15, m.pave, .012, -1.6, 1.6);
strip(-60, -HD, m.pave, .012, -60, 60);
for (let x = -120; x < 120; x += 6) { const l = new THREE.Mesh(new THREE.PlaneGeometry(2.8, .22), M('#e9e2d0')); l.rotation.x = -Math.PI / 2; l.position.set(x, .03, 23.25); root.add(l); }
for (const [x, w] of [[-5.5, 7.2], [5.5, 7.2]]) box(w, .9, .7, m.leaf, x, .45, 14.3, root);

function tree(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
  cyl(.14 * s, .2 * s, 2.4 * s, m.walnut, 0, 1.2 * s, 0, g, 8);
  for (let i = 0; i < 4; i++) { const b = put(new THREE.IcosahedronGeometry((1.2 - i * .12) * s, 1), i % 2 ? m.leaf : m.leaf2, (rnd() - .5) * .9 * s, (3 + i * .75) * s, (rnd() - .5) * .9 * s, g); b.scale.y = .9; }
}
for (let x = -44; x <= 44; x += 11) { tree(x + rnd() * 3, 16.2, .9); }
for (let i = 0; i < 22; i++) tree(-70 + rnd() * 140, 36 + rnd() * 50, 1 + rnd() * .9);
tree(-13, 10, 1.1); tree(13, 10, 1.2); tree(-6, 11.5, .8); tree(6, 11.5, .8);
for (let x = -40; x <= 40; x += 16) { cyl(.05, .07, 5, m.dark, x, 2.5, 30.6, root, 6); put(new THREE.SphereGeometry(.22, 10, 8), m.warm, x, 5.1, 30.6, root, false); }

function car(color, x, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
  const body = M(color, { roughness: .25, metalness: .6, envMapIntensity: 1.2 });
  rbox(4.3, .6, 1.8, body, 0, .6, 0, g, .2); rbox(2.3, .55, 1.6, M('#10151c', { roughness: .1, metalness: .8 }), -.2, 1.1, 0, g, .22);
  for (const sx of [-1.4, 1.4]) for (const sz of [-.85, .85]) { const w = cyl(.33, .33, .22, m.black, sx, .33, sz, g, 14); w.rotation.x = Math.PI / 2; }
  for (const sz of [-.65, .65]) box(.06, .14, .3, m.warm, 2.17, .72, sz, g, false);
  return g;
}
const mover = car('#c8553d', -80, 25.4, 0);
car('#dfe3e6', -14, 18.6, Math.PI); car('#2f4c63', 9, 18.6, Math.PI);

/* edificios vecinos y horizonte */
const wtex = winTex(false), wlit = winTex(true);
function tower(x, z, w, h, d, shadows = false) {
  const t = wtex.clone(), e = wlit.clone(); t.needsUpdate = e.needsUpdate = true;
  t.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 8))); e.repeat.copy(t.repeat);
  const mat = new THREE.MeshStandardMaterial({ color: '#efe4d0', map: t, emissive: '#fff', emissiveMap: e, emissiveIntensity: .6, roughness: .9 });
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, h / 2, z); o.castShadow = shadows; o.receiveShadow = true; root.add(o);
}
tower(-26, 0, 22, 17, 11); tower(24, -1, 18, 13, 11); tower(-52, 2, 24, 25, 12); tower(48, 0, 24, 21, 12);
for (let i = 0; i < 46; i++) { const a = -90 + rnd() * 180; tower(a * 2.2, -110 - rnd() * 120, 12 + rnd() * 20, 20 + rnd() * 70, 12 + rnd() * 14); }
for (let i = 0; i < 26; i++) tower(-160 + i * 12.5 + rnd() * 6, 150 + rnd() * 90, 14 + rnd() * 18, 14 + rnd() * 55, 14 + rnd() * 10);
for (let i = 0; i < 16; i++) tower(-260 + rnd() * 60 - (i < 8 ? 0 : -400), -40 + rnd() * 120, 14 + rnd() * 16, 16 + rnd() * 40, 14);

/* ---------- aplicar intensidad de entorno ---------- */
scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.material.envMapIntensity === 1) o.material.envMapIntensity = .45; });
m.glass.envMapIntensity = 1.6;

/* =====================================================================
   RECORRIDO DE CÁMARA
   [x, y (relativa al suelo de la vivienda), z]
   ===================================================================== */
const E = 1.55;
let baseFov = 52;
const WP = [
  { p: [14, -2.8, 37], t: [-8, 2.6, 0], w: 1, hold: 1 },           // 0 hero
  { p: [11, .7, 24], t: [-6, 1.2, 5], w: .9, hold: 1 },        // 1 fachada
  { p: [4.5, 1.35, 12.6], t: [4.5, 1.1, 0], w: .8 },              // 2 aproximación a la terraza
  { p: [4.55, E, 3.5], t: [8.6, .9, 1.1], w: .7, hold: 1 },       // 3 salón
  { p: [5.9, E, 1.4], t: [1.5, 1.4, 1.3], w: .8, hold: 1 },       // 4 salón / TV
  { p: [4.3, E, .6], t: [6.4, .9, -3.6], w: .8, hold: 1 },      // 5 cocina
  { p: [2.4, E, -2.9], t: [-3, 1.4, -2.9], w: .6 },               // 6 puerta cocina
  { p: [-2.7, E, -2.8], t: [-8.2, 1.0, -3.0], w: .8, hold: 1 },   // 7 dormitorio 2
  { p: [.25, E, -1.8], t: [.25, 1.4, 3], w: .7 },                 // 8 pasillo
  { p: [.25, E, 3.1], t: [-4, 1.4, 3.3], w: .6 },                 // 9 pasillo / puerta
  { p: [-2.8, E, 3.2], t: [-8.4, 1.1, 2.4], w: .7, hold: 1 },     // 10 dormitorio principal
  { p: [-5.9, E, 1.9], t: [-6, 1.4, -1], w: .5, fm: 1.15 },                 // 11 hacia el baño
  { p: [-5.75, E, .15], t: [-8.3, .9, -.8], w: .8, hold: 1, fm: 1.4 },     // 12 baño
  { p: [-5.9, E, 2.0], t: [-6, 1.6, 8], w: .5, fm: 1.15 },                  // 13 salida
  { p: [-5.9, E, 4.4], t: [-3, 1.5, 14], w: .5 },
  { p: [-5.9, 1.5, 5.9], t: [-2, 1.2, 18], w: .6 },                // 15 salida a la terraza                 // 14 puerta de la terraza
  { p: [-1.0, 1.45, 6.4], t: [3.5, .75, 30], w: 1, hold: 1 },     // 16 terraza
];
const N = WP.length;
const cum = [0]; for (let i = 0; i < N - 1; i++) cum.push(cum[i] + WP[i].w);
const TOTAL = cum[N - 1];
const toV = a => new THREE.Vector3(a[0], FY + a[1], a[2]);
const curveP = new THREE.CatmullRomCurve3(WP.map(w => toV(w.p)), false, 'centripetal');
const curveT = new THREE.CatmullRomCurve3(WP.map(w => toV(w.t)), false, 'centripetal');
// la curva usa el mismo tiempo para cada tramo: así cada waypoint coincide con su texto
const posU = (c, u) => c.getPoint(clamp(u / (N - 1)));

function setLens() {
  const a = innerWidth / innerHeight;
  camera.aspect = a; baseFov = a < 1 ? 70 : 52; camera.fov = baseFov; camera.updateProjectionMatrix();
  portraitK = a < 1 ? 1 + (1 / a - 1) * .5 : 1;
}
let portraitK = 1;

/* ---------- DOM: paneles, HUD, plano ---------- */
const stops = [...document.querySelectorAll('.stop')];
const stopAt = new Map(stops.map(s => [+s.dataset.i, s]));
const story = $('.story'), hud = $('.hud'), roomEl = $('#roomName'), prog = $('#prog'), tag = $('#tag');
const navEl = $('.nav'), plan = $('#plan'), pg = plan.getContext('2d');

const ROOMS = [
  ['Salón', 1.5, 0, 9, 4.5], ['Cocina', 1.5, -4.5, 9, 0], ['Pasillo', -1, -4.5, 1.5, 4.5], ['Dormitorio principal', -9, .5, -1, 4.5],
  ['Dormitorio 2', -9, -4.5, -1, -1.5], ['Baño', -9, -1.5, -4, .5], ['Aseo', -4, -1.5, -1, .5], ['Terraza', -9.5, 5, 9.5, 7.5],
];
const roomAt = (x, z) => {
  if (z > HD - .25 || Math.abs(x) > 9) return z > HD - .25 && z < 8 && Math.abs(x) < 9.5 && z > 4.6 ? 'Terraza' : 'Exterior';
  for (const r of ROOMS) if (x >= r[1] && x <= r[3] && z >= r[2] && z <= r[4]) return r[0] === 'Baño' ? 'Baño en suite' : r[0];
  return 'Vivienda';
};
function drawPlan(cx, cz, dx, dz) {
  const W = plan.width, Hh = plan.height, pad = 14, sc = Math.min((W - 2 * pad) / 19.4, (Hh - 2 * pad) / 13);
  const ox = W / 2, oz = pad + 5.4 * sc, X = x => ox + x * sc, Z = z => oz + z * sc - 5 * sc * 0 ;
  pg.clearRect(0, 0, W, Hh);
  pg.lineWidth = 2; pg.font = `${Math.round(sc * .62)}px Barlow, sans-serif`; pg.textAlign = 'center';
  for (const r of ROOMS) {
    const terr = r[0] === 'Terraza';
    pg.fillStyle = terr ? 'rgba(232,167,107,.18)' : 'rgba(246,240,228,.12)'; pg.strokeStyle = terr ? 'rgba(232,167,107,.7)' : 'rgba(246,240,228,.75)';
    pg.fillRect(X(r[1]), Z(r[2]), (r[3] - r[1]) * sc, (r[4] - r[2]) * sc); pg.strokeRect(X(r[1]), Z(r[2]), (r[3] - r[1]) * sc, (r[4] - r[2]) * sc);
    if (r[0] !== 'Aseo' && r[0] !== 'Pasillo') { pg.fillStyle = 'rgba(246,240,228,.7)'; pg.fillText(r[0] === 'Dormitorio principal' ? 'Principal' : r[0] === 'Dormitorio 2' ? 'Dorm. 2' : r[0], X((r[1] + r[3]) / 2), Z((r[2] + r[4]) / 2) + sc * .22); }
  }
  const px = X(cx), pz = Z(cz), a = Math.atan2(dz, dx);
  const gr = pg.createRadialGradient(px, pz, 0, px, pz, sc * 3.2); gr.addColorStop(0, 'rgba(232,167,107,.75)'); gr.addColorStop(1, 'rgba(232,167,107,0)');
  pg.fillStyle = gr; pg.beginPath(); pg.moveTo(px, pz); pg.arc(px, pz, sc * 3.2, a - .6, a + .6); pg.closePath(); pg.fill();
  pg.fillStyle = '#e8a76b'; pg.beginPath(); pg.arc(px, pz, sc * .38, 0, 7); pg.fill(); pg.strokeStyle = '#fff'; pg.lineWidth = 2; pg.stroke();
}

/* ---------- lenis ---------- */
const lenis = new Lenis({ lerp: reduce ? 1 : .09 });
const SEG_VH = mobile ? 70 : 85;
function sizeStory() { story.style.height = (TOTAL * SEG_VH + 100) + 'vh'; }
sizeStory();
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const t = document.querySelector(a.getAttribute('href')); if (!t) return; e.preventDefault();
  lenis.scrollTo(a.getAttribute('href') === '#inicio' ? 0 : t, { duration: 1.8 });
}));

/* ---------- formulario (demo: no envía nada) ---------- */
const form = $('#form'), msg = $('#msg');
form.addEventListener('submit', e => {
  e.preventDefault();
  const n = form.nombre, t = form.tel; let ok = true;
  for (const f of [n, t]) { const bad = !f.value.trim() || (f === t && f.value.replace(/\D/g, '').length < 9); f.classList.toggle('err', bad); if (bad) ok = false; }
  msg.classList.toggle('bad', !ok);
  msg.textContent = ok ? `Gracias, ${n.value.trim().split(' ')[0]}. Marta te llamará para confirmar la visita (demo: no se ha enviado nada).` : 'Revisa tu nombre y un teléfono de al menos 9 cifras.';
});

/* ---------- bucle ---------- */
const camTarget = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3(), tagV = new THREE.Vector3(0, FY + 2.4, HD + 2.6);
let mx = 0, my = 0, smx = 0, smy = 0, lastRoom = '', U = 0;
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
function resize() { renderer.setSize(innerWidth, innerHeight, false); setLens(); }
addEventListener('resize', resize); resize();

function loop(now) {
  lenis.raf(now);
  const r = story.getBoundingClientRect(), span = story.offsetHeight - innerHeight;
  const p = clamp(-r.top / span), s = Math.min(p * (TOTAL + .8), TOTAL);
  let i = 0; while (i < N - 2 && s >= cum[i + 1]) i++;
  const f = clamp((s - cum[i]) / WP[i].w), hold = ((WP[i].hold ? 1 : 0) + (WP[i + 1].hold ? 1 : 0)) / 2;
  const e = f + (smooth(f) - f) * (.35 + .6 * hold);
  U = i + e;

  tmpP.copy(posU(curveP, U)); tmpT.copy(posU(curveT, U));
  if (portraitK !== 1 && U < 2.2) { const k = 1 + (portraitK - 1) * clamp(1 - U / 2.2); tmpT.set(0, FY + 2.2, 0); tmpP.sub(tmpT).multiplyScalar(k).add(tmpT); tmpT.copy(posU(curveT, U)); }
  const fm = (WP[i].fm || 1) + ((WP[i + 1].fm || 1) - (WP[i].fm || 1)) * e;
  if (Math.abs(camera.fov - baseFov * fm) > .01) { camera.fov = baseFov * fm; camera.updateProjectionMatrix(); }
  smx += (mx - smx) * .05; smy += (my - smy) * .05;
  const inside = clamp((U - 2.5) / 1.2);
  camera.position.copy(tmpP);
  if (!reduce) { camera.position.x += Math.sin(now * .0006) * .015 * inside; camera.position.y += Math.sin(now * .0011) * .012 * inside; }
  camera.lookAt(tmpT);
  if (!reduce && !mobile) { camera.rotateY(-smx * .05); camera.rotateX(-smy * .03); }

  mover.position.x = ((now * .0075 + 80) % 200) - 80 - 20;
  renderer.render(scene, camera);

  // paneles
  for (const [idx, el] of stopAt) {
    const near = Math.abs(U - idx) < .3 + (idx === N - 1 ? .5 : 0) && !(idx === 0 && U > .35);
    if (el.classList.contains('on') !== near) el.classList.toggle('on', near);
  }
  // HUD
  const lp = tmpP.clone(); lp.y -= FY;
  const showHud = U > 2.4 && r.bottom > innerHeight - 2;
  hud.classList.toggle('on', showHud);
  if (showHud) {
    const name = roomAt(lp.x, lp.z); if (name !== lastRoom) { lastRoom = name; roomEl.textContent = name; }
    const dir = tmpT.clone().sub(tmpP); drawPlan(lp.x, lp.z, dir.x, dir.z);
  }
  navEl.classList.toggle('nav--dark', r.bottom < 70);
  prog.style.transform = `scaleX(${p})`;
  // etiqueta «Tu piso»
  const sv = tagV.clone().project(camera);
  const vis = U < 1.7 && sv.z < 1 && Math.abs(sv.x) < 1.1;
  tag.style.opacity = vis ? clamp(1.7 - U) : 0;
  tag.style.transform = `translate(${(sv.x * .5 + .5) * innerWidth}px,${(-sv.y * .5 + .5) * innerHeight - 60}px) translate(-50%,-100%)`;
  requestAnimationFrame(loop);
}

renderer.compile(scene, camera);
requestAnimationFrame(t => { loop(t); setTimeout(() => document.body.classList.remove('loading'), 900); });
