import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import Lenis from 'lenis';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = innerWidth < 800;

/* ---------------------------------------------------------------
   Texturas dibujadas en canvas (no hace falta ninguna imagen)
---------------------------------------------------------------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const noise = (x, w, h, n, a) => { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},${Math.random() * a})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };

const wallTex = () => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#2b2c2f'; x.fillRect(0, 0, w, h); noise(x, w, h, 9000, .05);
  x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 128); x.lineTo(w, i * 128); x.stroke(); }
  x.beginPath(); x.moveTo(256, 0); x.lineTo(256, h); x.stroke();
}, [6, 2]);

const floorTex = () => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#17181b'; x.fillRect(0, 0, w, h); noise(x, w, h, 14000, .06);
  x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h);
}, [12, 12]);

const signTex = () => canvasTex(1400, 260, (x, w, h) => {
  x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '800 190px "Barlow Condensed", Impact, sans-serif';
  x.shadowColor = '#ff5a1f'; x.shadowBlur = 40; x.fillStyle = '#ff7a45';
  for (let i = 0; i < 3; i++) x.fillText('TALLER NORTE', w / 2, h / 2 + 8);
  x.shadowBlur = 0; x.fillStyle = '#fff1e8'; x.fillText('TALLER NORTE', w / 2, h / 2 + 8);
});

const pegTex = () => canvasTex(1024, 512, (x, w, h) => {
  x.fillStyle = '#202225'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,0,0,.5)';
  for (let i = 12; i < w; i += 32) for (let j = 12; j < h; j += 32) { x.beginPath(); x.arc(i, j, 3, 0, 7); x.fill(); }
  x.strokeStyle = '#ff5a1f'; x.lineWidth = 7; x.lineCap = 'round';
  const wrench = (cx, cy, len, a) => { x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath(); x.moveTo(-len, 0); x.lineTo(len, 0); x.stroke(); x.beginPath(); x.arc(-len, 0, 20, 0, 7); x.stroke(); x.beginPath(); x.arc(len, 0, 14, 0, 7); x.stroke(); x.restore(); };
  for (let i = 0; i < 6; i++) wrench(120 + i * 150, 150, 90 - i * 6, Math.PI / 2 + (i % 2 ? .06 : -.06));
  for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(110 + i * 180, 380, 40 - i * 4, 0, 7); x.stroke(); x.beginPath(); x.moveTo(110 + i * 180, 380 + 40 - i * 4); x.lineTo(110 + i * 180, 480); x.stroke(); }
  x.lineWidth = 9; x.strokeStyle = '#8b8e94'; x.strokeRect(6, 6, w - 12, h - 12);
});

const chestTex = () => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#b0231c'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 5; i++) x.fillRect(16, 20 + i * 98, w - 32, 6);
  x.fillStyle = '#c7c9cc'; for (let i = 0; i < 5; i++) x.fillRect(w / 2 - 80, 50 + i * 98, 160, 12);
  noise(x, w, h, 4000, .05);
});

/* ---------------------------------------------------------------
   Sala del taller
---------------------------------------------------------------- */
function buildRoom(scene, renderer, w, h) {
  const room = new THREE.Group(); scene.add(room);
  const wall = new THREE.MeshStandardMaterial({ map: wallTex(), roughness: .92, metalness: 0 });
  const plane = (pw, ph, mat, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat); m.position.set(...pos); m.rotation.set(...rot); room.add(m); return m; };
  plane(30, 9, wall, [0, 4.5, -10], [0, 0, 0]);
  plane(30, 9, wall, [-13, 4.5, 4], [0, Math.PI / 2, 0]).scale.set(1, 1, 1);
  plane(30, 9, wall, [13, 4.5, 4], [0, -Math.PI / 2, 0]);
  plane(30, 9, wall, [0, 4.5, 16], [0, Math.PI, 0]);
  const ceil = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: .95 });
  plane(30, 30, ceil, [0, 9, 4], [Math.PI / 2, 0, 0]);

  // tubos de luz del techo
  const tube = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.1, 2.9) });
  for (const x of [-7, -2.5, 2.5, 7]) for (const z of [-5, 3, 11]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(.28, .08, 4.6), tube); m.position.set(x, 8.9, z); room.add(m);
  }

  // suelo: espejo + capa oscura semitransparente encima
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex(), color: 0xffffff, roughness: .35, metalness: 0, transparent: true, opacity: mobile ? .96 : .74 });
  const floor = plane(40, 40, floorMat, [0, .004, 0], [-Math.PI / 2, 0, 0]);
  floor.receiveShadow = true;
  let reflector = null;
  if (!mobile) {
    const pr = renderer.getPixelRatio();
    reflector = new Reflector(new THREE.PlaneGeometry(40, 40), { color: 0x9a9aa0, textureWidth: Math.round(w * pr * .6), textureHeight: Math.round(h * pr * .6), clipBias: .003 });
    reflector.rotation.x = -Math.PI / 2; room.add(reflector);
  }

  // rótulo de neón
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), new THREE.MeshBasicMaterial({ map: signTex(), transparent: true, toneMapped: false }));
  sign.position.set(0, 5.7, -9.9); room.add(sign);
  const signLight = new THREE.PointLight(0xff6a30, 90, 14, 2); signLight.position.set(0, 5.5, -8); room.add(signLight);

  // panel de herramientas
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshStandardMaterial({ map: pegTex(), roughness: .8 }));
  peg.position.set(-6.5, 3, -9.92); room.add(peg);

  // cajonera roja
  const chest = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.1), new THREE.MeshStandardMaterial({ map: chestTex(), roughness: .5, metalness: .3 }));
  chest.position.set(-6.5, .8, -9.3); chest.castShadow = chest.receiveShadow = true; room.add(chest);

  // neumáticos apilados
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: .85 });
  for (const [x, z, n] of [[7.2, -8.4, 5], [8.6, -8.2, 3], [7.4, -6.9, 2]]) for (let i = 0; i < n; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(.42, .2, 18, 36), tireMat);
    t.rotation.x = Math.PI / 2; t.position.set(x, .2 + i * .4, z); t.castShadow = true; room.add(t);
  }

  // líneas amarillas del suelo
  const yellow = new THREE.MeshBasicMaterial({ color: 0xe9b400 });
  for (const x of [-4.2, 4.2]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(.12, 18), yellow); l.rotation.x = -Math.PI / 2; l.position.set(x, .008, 0); room.add(l); }

  // elevador de dos columnas
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8541c, roughness: .45, metalness: .5 });
  const lift = new THREE.Group(); room.add(lift);
  for (const x of [-2.6, 2.6]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(.34, 3.8, .5), orange); col.position.set(x, 1.9, -.4); col.castShadow = true; lift.add(col);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.9, .06, 1.2), orange); base.position.set(x, .03, -.4); lift.add(base);
  }
  const arms = new THREE.Group(); lift.add(arms);
  for (const x of [-.78, .78]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.22, .12, 3), orange); rail.position.set(x, 0, 0); rail.castShadow = true; arms.add(rail);
  }
  for (const s of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.9, .14, .22), orange); bar.position.set(s * 1.7, 0, -.4); bar.castShadow = true; arms.add(bar);
  }

  return { reflector, arms };
}

/* ---------------------------------------------------------------
   Init
---------------------------------------------------------------- */
async function init() {
  const canvas = $('#gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return noGL(); }

  let vw = innerWidth, vh = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.setSize(vw, vh, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0d0e);
  scene.fog = new THREE.Fog(0x0d0d0e, 14, 30);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

  const camera = new THREE.PerspectiveCamera(mobile ? 50 : 38, vw / vh, .1, 80);

  // luces
  scene.add(new THREE.HemisphereLight(0x9fb0c8, 0x1a1a1c, .35));
  const key = new THREE.SpotLight(0xfff0dc, 420, 22, .62, .85, 2);
  key.position.set(2.5, 8, 3.5); key.target.position.set(0, 0, 0);
  key.castShadow = true; key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .03;
  scene.add(key, key.target);
  const rim = new THREE.PointLight(0xff6a2a, 80, 14, 2); rim.position.set(4.2, 2.2, -4.5); scene.add(rim);
  const cool = new THREE.PointLight(0x5c9cff, 55, 14, 2); cool.position.set(-6, 2.8, 4); scene.add(cool);

  const { reflector, arms } = buildRoom(scene, renderer, vw, vh);

  // --- coche
  const loadbar = $('#loadbar');
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('models/car.glb', e => { if (e.total) loadbar.style.transform = `scaleX(${e.loaded / e.total})`; });
  const car = gltf.scene;
  const carGroup = new THREE.Group(); carGroup.add(car); scene.add(carGroup);

  const named = n => car.getObjectByName(n);
  const center = (o, v = new THREE.Vector3()) => new THREE.Box3().setFromObject(o).getCenter(v);

  // orientar con el morro hacia +Z
  car.updateMatrixWorld(true);
  const dir = center(named('BodyHeadlights')).sub(center(named('BodyTaillights')));
  car.rotation.y = -Math.atan2(dir.x, dir.z);
  car.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(car);
  car.scale.setScalar(4.5 / (box.max.z - box.min.z));
  car.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(car);
  car.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  car.updateMatrixWorld(true);

  const variantsDef = gltf.parser.json.extensions?.KHR_materials_variants?.variants || [];
  const tweak = m => {
    if (m.name === 'Tireside') { m.map = null; m.color.set(0x0b0b0c); m.needsUpdate = true; }   // sin logos de terceros
    if (m.isMeshStandardMaterial) m.envMapIntensity = .85;
    if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = .26; m.depthWrite = false; m.thickness = 0; }
  };
  const variantMeshes = [];
  car.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    [].concat(o.material).forEach(tweak);
    const vdef = o.userData.gltfExtensions?.KHR_materials_variants;
    if (vdef) variantMeshes.push({ mesh: o, vdef, mats: {} });
  });
  // precarga de materiales de cada color
  await Promise.all(variantMeshes.flatMap(v => v.vdef.mappings.map(async mp => {
    const mat = await gltf.parser.getDependency('material', mp.material); tweak(mat);
    mp.variants.forEach(i => { v.mats[i] = mat; });
  })));
  const setVariant = i => variantMeshes.forEach(v => { if (v.mats[i]) v.mesh.material = v.mats[i]; });

  const COLORS = { carmine: '#b3162a', pearl: '#e9e6e0', graphite: '#3a3c40' };
  const sw = $('.swatches');
  variantsDef.forEach((v, i) => {
    const b = document.createElement('button');
    b.style.setProperty('--c', COLORS[v.name.toLowerCase()] || '#888'); b.title = v.name; b.setAttribute('aria-label', 'Color ' + v.name);
    b.addEventListener('click', () => { setVariant(i); $$('button', sw).forEach(x => x.classList.toggle('on', x === b)); });
    sw.appendChild(b);
  });
  if (variantsDef.length) { setVariant(0); sw.firstChild.classList.add('on'); }

  // capó con bisagra
  const hoodNames = ['BodyHood', 'BodyHoodInterior01', 'BodyHoodInterior02', 'BodyHoodTopgrill', 'BodyHoodUnder'];
  const hoodNodes = hoodNames.map(named).filter(Boolean);
  const hoodBox = new THREE.Box3(); hoodNodes.forEach(n => hoodBox.union(new THREE.Box3().setFromObject(n)));
  const hinge = new THREE.Group(); hinge.position.set((hoodBox.min.x + hoodBox.max.x) / 2, hoodBox.max.y, hoodBox.min.z);
  carGroup.add(hinge); carGroup.updateMatrixWorld(true);
  hoodNodes.forEach(n => hinge.attach(n));

  // puntos clave del coche
  const wheels = ['WheelFrontL', 'WheelFrontR'].map(named);
  const nearIdx = center(wheels[0]).x > center(wheels[1]).x ? 0 : 1;
  const wheel = center(wheels[nearIdx]);
  const discNode = named(nearIdx ? 'WheelFrontRBrakeDisc' : 'WheelFrontLBrakeDisc');
  const disc = center(discNode);
  const engineNode = named('Engine'), steerNode = named('InteriorSteeringWheel01'), underNode = named('BodyUnderside');
  const engine = center(engineNode), steer = center(steerNode);
  const hotNodes = { 1: engineNode, 2: wheels[nearIdx], 3: discNode, 4: steerNode, 5: underNode };
  const LIFT = 1.55;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const stops = [
    { pos: V(4.3, 1.7, 5.4),            tgt: V(0, .65, .3) },                                 // 0 hero
    { pos: V(2.1, 2.9, 4.4),            tgt: V(0, .9, 1.35) },                                // 1 motor (capó abierto)
    { pos: V(wheel.x + 2.5, wheel.y + .2, wheel.z + 1.7), tgt: wheel.clone() },               // 2 ruedas
    { pos: V(disc.x + 1.15, disc.y + .12, disc.z + .55),  tgt: disc.clone() },                // 3 frenos
    { pos: V(.55, 2.55, 3.9),           tgt: V(steer.x, steer.y - .1, steer.z) },             // 4 cuadro
    { pos: V(2.6, .45, 3.7),            tgt: V(0, 1.6 + LIFT * .5, .1) },                     // 5 bajos
    { pos: V(0, 1.0, 6.6),              tgt: V(0, .75, 1.0) },                                // 6 final
  ];
  // en vertical (móvil) hace falta más distancia para que el coche quepa a lo ancho
  if (mobile) stops.forEach((s, i) => { s.pos.sub(s.tgt).multiplyScalar([1.75, 1.3, 1.45, 1.45, 1.3, 1.3, 1.85][i]).add(s.tgt); });
  const N = stops.length;
  const SHIFTS = [.2, -.17, .18, -.17, .18, -.17, .2];   // + mueve el coche a la derecha
  const posCurve = new THREE.CatmullRomCurve3(stops.map(s => s.pos), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(stops.map(s => s.tgt), false, 'centripetal');
  const headlightMat = (() => { let m = null; car.traverse(o => { if (o.isMesh && o.name === 'BodyHeadlights') m = o.material; }); return m; })();
  const headBase = headlightMat?.emissiveIntensity ?? 1;

  // --- scroll suave
  const lenis = new Lenis({ lerp: reduce ? 1 : .085 });
  const story = $('.story');
  story.style.setProperty('--n', N);
  const storyTop = () => story.getBoundingClientRect().top + scrollY;
  const goStop = i => lenis.scrollTo(storyTop() + (i / (N - 1)) * (story.offsetHeight - innerHeight), { duration: 1.6 });
  $$('.dots li').forEach(li => li.addEventListener('click', () => goStop(+li.dataset.go)));
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = $(a.getAttribute('href')); if (!t) return; e.preventDefault();
    if (a.getAttribute('href') === '#recorrido') goStop(1); else lenis.scrollTo(t);
  }));

  // --- reveal y contadores
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    const c = $('[data-count]', e.target); if (c) countUp(c);
  }), { threshold: .2 });
  $$('[data-reveal]').forEach(el => io.observe(el));
  function countUp(el) {
    const end = +el.dataset.count, t0 = performance.now(), sep = 'sep' in el.dataset;
    (function tick(t) {
      const k = clamp((t - t0) / 1800), v = Math.round(end * (1 - Math.pow(1 - k, 4)));
      el.textContent = sep ? v.toLocaleString('es-ES') : v; if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  // --- ratón
  let mx = 0, my = 0, smx = 0, smy = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });

  addEventListener('resize', () => {
    vw = innerWidth; vh = innerHeight;
    renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix();
    if (reflector) reflector.getRenderTarget().setSize(vw * renderer.getPixelRatio() * .6, vh * renderer.getPixelRatio() * .6);
  });

  // --- UI
  const stopEls = $$('.stop'), hotEls = $$('.hot'), dotEls = $$('.dots li');
  let cap = -1;
  const setCap = c => {
    cap = c;
    stopEls.forEach((el, i) => el.classList.toggle('on', i === c));
    hotEls.forEach(el => el.classList.toggle('on', +el.dataset.hot === c));
    dotEls.forEach((el, i) => el.classList.toggle('on', i === c));
    document.body.classList.toggle('at-start', c === 0);
  };

  // --- bucle
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  let first = true, last = performance.now(), U = 0;
  function frame(now) {
    lenis.raf(now);
    const dt = Math.min((now - last) / 1000, .1); last = now;

    const rect = story.getBoundingClientRect();
    const f = clamp(-rect.top / (rect.height - vh));
    const u = f * (N - 1), idx = Math.min(Math.floor(u), N - 2), p = u - idx;
    U = idx + ss(.2, .8, p);

    // estados animados según la parada
    const hood = ss(.35, .9, U) * (1 - ss(1.25, 1.85, U));
    hinge.rotation.x = -hood * 1.02;
    const lift = ss(4.35, 4.95, U) * (1 - ss(5.35, 5.95, U));
    carGroup.position.y = lift * LIFT;
    arms.position.y = .14 + lift * LIFT; arms.position.z = 0;
    if (headlightMat) headlightMat.emissiveIntensity = headBase * (1 + 3 * ss(5.4, 6, U));

    // cámara
    const t = U / (N - 1);
    posCurve.getPoint(t, camPos); tgtCurve.getPoint(t, camTgt);
    smx += (mx - smx) * (1 - Math.exp(-dt * 3)); smy += (my - smy) * (1 - Math.exp(-dt * 3));
    camPos.x += smx * .35; camPos.y -= smy * .18;
    if (first) { camera.position.copy(camPos); look.copy(camTgt); first = false; }
    const k = 1 - Math.exp(-dt * 7);
    camera.position.lerp(camPos, k); look.lerp(camTgt, k);
    camera.lookAt(look);
    // desplaza el encuadre para que el coche quede al lado contrario del texto
    const sh = mobile ? 0 : SHIFTS[idx] + (SHIFTS[idx + 1] - SHIFTS[idx]) * ss(.2, .8, p);
    camera.setViewOffset(vw, vh, -sh * vw, mobile ? vh * .13 : 0, vw, vh);   // en móvil sube el coche para dejar sitio al texto

    // UI
    const c = Math.round(U);
    if (c !== cap) setCap(c);
    const hotEl = hotEls.find(h => +h.dataset.hot === c);
    if (hotEl) {
      const node = hotNodes[c];
      center(node, tmp).project(camera);
      const sx = (tmp.x + 1) / 2 * vw;
      hotEl.style.transform = `translate(${sx.toFixed(1)}px,${((1 - tmp.y) / 2 * vh).toFixed(1)}px)`;
      hotEl.classList.toggle('flip', sx > vw * .6);   // el rótulo se voltea si no cabe a la derecha
    }

    if (rect.bottom > -vh * .3) {
      key.target.updateMatrixWorld();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setCap(0);
  document.body.classList.remove('loading');
}

function noGL() {
  document.documentElement.classList.add('nogl');
  document.body.classList.remove('loading');
  $$('.stop').forEach(e => e.classList.add('on'));
  $$('[data-reveal]').forEach(e => e.classList.add('in'));
  $$('[data-count]').forEach(e => { e.textContent = e.dataset.count; });
}

init().catch(err => { console.error(err); noGL(); });
