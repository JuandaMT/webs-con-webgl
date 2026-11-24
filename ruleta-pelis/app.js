(() => {
'use strict';
const KEY = 'ruleta-pelis-v1';
const COLORS = ['#b3122b','#7a0f2b','#d9a441','#4a1a5e','#e0452f','#1f5c6b','#9c2a5a','#c47a1a'];
const DEFAULTS = [
 ['El Padrino',1972,'Drama','Cine'],['Amélie',2001,'Romance','Cine'],['Parásitos',2019,'Thriller','Cine'],
 ['La La Land',2016,'Romance','Cine'],['Spider-Man: Un nuevo universo',2018,'Animación','Cine'],
 ['Origen',2010,'Ciencia ficción','Cine'],['Superlópez',2018,'Comedia','Cine'],['Coco',2017,'Animación','Cine'],
 ['Antes del amanecer',1995,'Romance','Cine'],['Mad Max: Furia en la carretera',2015,'Acción','Cine'],
 ['El gran hotel Budapest',2014,'Comedia','Cine'],['Midsommar',2019,'Terror','Cine'],
 ['Interstellar',2014,'Ciencia ficción','Cine'],['Ratatouille',2007,'Animación','Cine']
].map(([title,year,genre,platform],i)=>({id:'d'+i,title,year:String(year),genre,platform,poster:'',on:true}));

const $ = s => document.querySelector(s);
const canvas = $('#wheel'), ctx = canvas.getContext('2d');
let movies = load(), fGenre = '', fPlat = '', rot = 0, spinning = false, winner = null, lastTick = -1;

function load(){ try{ const v = JSON.parse(localStorage.getItem(KEY)); if(Array.isArray(v)) return v; }catch(e){} return structuredClone(DEFAULTS); }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(movies)); }catch(e){} }
const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const colorOf = i => COLORS[i % COLORS.length];
const active = () => movies.filter(m => m.on && (!fGenre || m.genre === fGenre) && (!fPlat || m.platform === fPlat));
const uniq = k => [...new Set(movies.map(m => m[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));

/* ---------- Rueda ---------- */
function size(){
  const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(r.width * d);
  draw();
}
function draw(){
  const W = canvas.width; if(W < 20) return;
  const c = W/2, R = c - W*0.03, list = active();
  ctx.clearRect(0,0,W,W);
  // aro exterior
  ctx.beginPath(); ctx.arc(c,c,c-2,0,7); ctx.fillStyle = '#f4c95d'; ctx.fill();
  ctx.beginPath(); ctx.arc(c,c,R+W*0.012,0,7); ctx.fillStyle = '#3a0a14'; ctx.fill();
  if(!list.length){
    ctx.beginPath(); ctx.arc(c,c,R,0,7); ctx.fillStyle = '#2a0a12'; ctx.fill();
    ctx.fillStyle = '#fbeed7'; ctx.textAlign = 'center'; ctx.font = `italic ${W*0.04}px Georgia`;
    ctx.fillText('Añade películas 🎬', c, c + W*0.2); return;
  }
  const n = list.length, a = Math.PI*2/n;
  list.forEach((m,i) => {
    const s = rot + i*a;
    ctx.beginPath(); ctx.moveTo(c,c); ctx.arc(c,c,R,s,s+a); ctx.closePath();
    ctx.fillStyle = colorOf(i); ctx.fill();
    ctx.strokeStyle = '#00000040'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(c,c); ctx.rotate(s + a/2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const fs = Math.max(W*0.022, Math.min(W*0.045, W*0.9/n*0.5));
    ctx.font = `700 ${fs}px Georgia`;
    ctx.fillStyle = (i % COLORS.length === 2 || i % COLORS.length === 7) ? '#2b0a10' : '#fff';
    let t = m.title; const max = R*0.62;
    while(ctx.measureText(t).width > max && t.length > 3) t = t.slice(0,-2);
    if(t !== m.title) t = t.trimEnd() + '…';
    ctx.fillText(t, R - W*0.05, 0); ctx.restore();
  });
  // bombillas del borde
  const bulbs = 24;
  for(let i=0;i<bulbs;i++){
    const ang = i/bulbs*Math.PI*2 + (spinning ? rot*0.5 : 0), rr = R + W*0.012 + W*0.0 ;
    ctx.beginPath(); ctx.arc(c+Math.cos(ang)*(R+W*0.006), c+Math.sin(ang)*(R+W*0.006), W*0.007, 0, 7);
    ctx.fillStyle = i%2 ? '#fff3c4' : '#ffb347'; ctx.fill();
  }
  // centro
  ctx.beginPath(); ctx.arc(c,c,W*0.13,0,7); ctx.fillStyle = '#3a0a14'; ctx.fill();
  ctx.lineWidth = W*0.008; ctx.strokeStyle = '#f4c95d'; ctx.stroke();
}
function indexAtPointer(n){
  const a = Math.PI*2/n;
  const p = ((-Math.PI/2 - rot) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
  return Math.floor(p / a) % n;
}

/* ---------- Giro ---------- */
function spin(){
  const list = active(); if(spinning || !list.length) return;
  closeModal(); spinning = true; $('#spin').disabled = true;
  const n = list.length, a = Math.PI*2/n, w = Math.floor(Math.random()*n);
  const jitter = (Math.random()-0.5)*a*0.7;
  const target = -Math.PI/2 - (w+0.5)*a + jitter;
  const base = (((target - rot) % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
  const delta = base + Math.PI*2*(5 + Math.floor(Math.random()*3));
  const start = rot, dur = 5200 + Math.random()*1500, t0 = performance.now();
  const ease = t => 1 - Math.pow(1-t, 4);
  lastTick = indexAtPointer(n);
  const step = now => {
    const t = Math.min(1,(now-t0)/dur);
    rot = start + delta*ease(t);
    const idx = indexAtPointer(n);
    if(idx !== lastTick){ lastTick = idx; tick(); }
    draw();
    if(t < 1) requestAnimationFrame(step);
    else { spinning = false; $('#spin').disabled = false; winner = list[w]; draw(); showWinner(winner); }
  };
  requestAnimationFrame(step);
}

/* ---------- Sonido ---------- */
let actx;
function beep(f,d,v,type='square'){
  if(!$('#sound').checked) return;
  try{
    actx = actx || new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + d);
  }catch(e){}
}
function tick(){
  const p = $('.pointer'); p.classList.remove('tick'); void p.offsetWidth; p.classList.add('tick');
  beep(900,0.04,0.04);
}

/* ---------- Resultado ---------- */
function showWinner(m){
  $('#wTitle').textContent = m.title;
  $('#wMeta').textContent = [m.year, m.genre, m.platform].filter(Boolean).join(' · ');
  const p = $('#wPoster'); p.innerHTML = '';
  const fake = () => { p.innerHTML = ''; const d = document.createElement('div'); d.className = 'fake';
    const h = [...m.title].reduce((s,ch)=>s+ch.charCodeAt(0),0) % 360;
    d.style.background = `linear-gradient(160deg,hsl(${h} 70% 38%),hsl(${(h+50)%360} 60% 18%))`; d.textContent = m.title; p.appendChild(d); };
  if(m.poster){ const im = new Image(); im.alt = 'Póster de ' + m.title; im.onerror = fake; im.src = m.poster; p.appendChild(im); } else fake();
  $('#modal').hidden = false; $('#again').focus();
  [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,0.25,0.08,'triangle'), i*110));
  confetti();
}
function closeModal(){ $('#modal').hidden = true; stopConfetti(); }
let cf = null;
function confetti(){
  const c = $('#confetti'), x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#f4c95d','#e8344f','#fbeed7','#ff9f1c','#a06cd5'];
  const ps = Array.from({length:150},()=>({x:innerWidth/2,y:innerHeight*0.45,vx:(Math.random()-0.5)*16,vy:-Math.random()*16-4,
    s:5+Math.random()*7,r:Math.random()*6,vr:(Math.random()-0.5)*0.4,c:cols[Math.random()*cols.length|0]}));
  let f = 0; stopConfetti();
  const loop = () => {
    x.clearRect(0,0,c.width,c.height);
    ps.forEach(p=>{ p.vy += 0.3; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x,p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2); x.restore(); });
    if(++f < 220) cf = requestAnimationFrame(loop); else x.clearRect(0,0,c.width,c.height);
  };
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches) loop();
}
function stopConfetti(){ if(cf) cancelAnimationFrame(cf); cf = null; }

/* ---------- UI ---------- */
function render(){
  // filtros
  if(fGenre && !uniq('genre').includes(fGenre)) fGenre = '';
  if(fPlat && !uniq('platform').includes(fPlat)) fPlat = '';
  const chips = $('#genreChips'); chips.innerHTML = '';
  ['', ...uniq('genre')].forEach(g => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
    b.textContent = g || 'Todos'; b.setAttribute('aria-pressed', String(g === fGenre));
    b.onclick = () => { fGenre = g; render(); }; chips.appendChild(b);
  });
  const sel = $('#platformSel'); sel.innerHTML = '<option value="">Todas</option>' +
    uniq('platform').map(p => `<option ${p===fPlat?'selected':''}>${esc(p)}</option>`).join('');
  $('#genres').innerHTML = uniq('genre').map(g=>`<option value="${esc(g)}">`).join('');
  $('#plats').innerHTML = uniq('platform').map(g=>`<option value="${esc(g)}">`).join('');
  // lista
  const ul = $('#list'); ul.innerHTML = '';
  if(!movies.length) ul.innerHTML = '<li class="empty">Lista vacía. ¡Añade una peli!</li>';
  const act = active();
  movies.forEach(m => {
    const i = act.indexOf(m), li = document.createElement('li');
    li.style.setProperty('--c', i >= 0 ? colorOf(i) : '#555'); if(!m.on) li.className = 'off';
    li.innerHTML = `<div class="t"><b>${esc(m.title)}</b><small>${esc([m.year,m.genre,m.platform].filter(Boolean).join(' · '))}</small></div>
      <button type="button" data-a="t" aria-label="${m.on?'Quitar de la ruleta':'Volver a la ruleta'}: ${esc(m.title)}">${m.on?'👁':'🚫'}</button>
      <button type="button" data-a="d" aria-label="Borrar ${esc(m.title)}">✕</button>`;
    li.querySelector('[data-a=t]').onclick = () => { m.on = !m.on; save(); render(); };
    li.querySelector('[data-a=d]').onclick = () => { movies = movies.filter(x => x !== m); save(); render(); };
    ul.appendChild(li);
  });
  $('#count').textContent = act.length ? `${act.length} película${act.length>1?'s':''} en la ruleta` : 'No hay películas con estos filtros';
  $('#spin').disabled = spinning || !act.length;
  draw();
}
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

$('#platformSel').onchange = e => { fPlat = e.target.value; render(); };
$('#spin').onclick = spin;
$('#again').onclick = spin;
$('#close').onclick = closeModal;
$('#removeSpin').onclick = () => { if(winner){ winner.on = false; save(); } render(); spin(); };
$('#modal').addEventListener('click', e => { if(e.target.id === 'modal') closeModal(); });
addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });
$('#addForm').onsubmit = e => {
  e.preventDefault();
  const v = id => $(id).value.trim(), t = v('#fTitle'); if(!t) return;
  const y = v('#fYear').replace(/\D/g,'');
  movies.push({id:uid(), title:t, year:y, genre:v('#fGenre'), platform:v('#fPlat'), poster:v('#fPoster'), on:true});
  save(); e.target.reset(); render();
};
$('#restore').onclick = () => { movies = structuredClone(DEFAULTS); fGenre = fPlat = ''; save(); render(); };
$('#clear').onclick = () => { if(confirm('¿Vaciar toda la lista?')){ movies = []; save(); render(); } };
new ResizeObserver(size).observe(canvas);
render(); size();
})();
