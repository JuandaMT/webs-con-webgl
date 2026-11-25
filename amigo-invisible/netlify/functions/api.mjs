import { getStore } from '@netlify/blobs';

export const config = { path: '/api/*' };

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const rid = n => {
  const a = crypto.getRandomValues(new Uint8Array(n));
  return [...a].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
};
const PHOTO = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const okPhoto = p => p === '' || (typeof p === 'string' && p.length < 30000 && PHOTO.test(p));
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && a === b;

// Sorteo con backtracking aleatorio: devuelve giftOf[i] = índice del receptor.
function draw(n, forbidden) {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const idx = [...Array(n).keys()], order = shuffle(idx), out = Array(n).fill(-1), used = new Set();
  const go = k => {
    if (k === n) return true;
    const g = order[k];
    for (const r of shuffle(idx)) {
      if (r === g || used.has(r) || forbidden.has(g + ',' + r)) continue;
      out[g] = r; used.add(r);
      if (go(k + 1)) return true;
      used.delete(r); out[g] = -1;
    }
    return false;
  };
  return go(0) ? out : null;
}

export default async (req) => {
  const [action, id] = new URL(req.url).pathname.replace(/^\/api\//, '').split('/');
  const store = getStore('games');

  let body = {};
  if (req.method === 'POST') {
    if (Number(req.headers.get('content-length') || 0) > 2_000_000) return json({ error: 'Demasiado grande' }, 413);
    try { body = await req.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
  }

  if (action === 'create' && req.method === 'POST') {
    const people = Array.isArray(body.people) ? body.people : [];
    if (people.length < 3 || people.length > 40) return json({ error: 'Hacen falta entre 3 y 40 participantes.' }, 400);
    const clean = people.map(p => ({ n: str(p && p.n, 30), p: p && okPhoto(p.p || '') ? (p.p || '') : '', claim: null }));
    if (clean.some(p => !p.n)) return json({ error: 'Nombre vacío.' }, 400);
    if (new Set(clean.map(p => p.n.toLowerCase())).size !== clean.length) return json({ error: 'Nombres repetidos.' }, 400);
    const pos = new Map(clean.map((p, i) => [p.n, i]));
    const forbidden = new Set();
    for (const e of Array.isArray(body.ex) ? body.ex : []) {
      const a = pos.get(e && e[0]), b = pos.get(e && e[1]);
      if (a === undefined || b === undefined) continue;
      forbidden.add(a + ',' + b); if (e[2]) forbidden.add(b + ',' + a);
    }
    const giftOf = draw(clean.length, forbidden);
    if (!giftOf) return json({ error: 'Con esas restricciones no hay sorteo posible.' }, 422);
    const gid = rid(8), admin = rid(24);
    const ev = { name: str(body.ev && body.ev.name, 40), budget: str(body.ev && body.ev.budget, 20), date: str(body.ev && body.ev.date, 30) };
    await store.setJSON(gid, { ev, people: clean, giftOf, admin });
    return json({ id: gid, admin });
  }

  if (!id || !/^[a-z0-9]{8}$/.test(id)) return json({ error: 'Sala no válida' }, 400);
  const g = await store.get(id, { type: 'json' });
  if (!g) return json({ error: 'Sala no encontrada' }, 410);
  const i = Number.isInteger(body.i) ? body.i : -1;
  const person = g.people[i];

  if (action === 'game' && req.method === 'GET') {
    return json({ ev: g.ev, people: g.people.map(p => ({ n: p.n, p: p.p, claimed: !!p.claim })) });
  }

  if (action === 'claim' && req.method === 'POST') {
    if (!person) return json({ error: 'Persona no válida' }, 400);
    const token = str(body.token, 64);
    if (token.length < 16) return json({ error: 'Token no válido' }, 400);
    if (person.claim && !same(person.claim, token)) return json({ error: 'Ya lo ha abierto otra persona' }, 409);
    if (!person.claim) { person.claim = token; await store.setJSON(id, g); }
    return json({ gift: g.people[g.giftOf[i]].n });
  }

  if (action === 'photo' && req.method === 'POST') {
    if (!person || !person.claim || !same(person.claim, str(body.token, 64))) return json({ error: 'No autorizado' }, 401);
    if (typeof body.p !== 'string' || !okPhoto(body.p)) return json({ error: 'Foto no válida' }, 400);
    person.p = body.p; await store.setJSON(id, g);
    return json({ ok: true });
  }

  if (action === 'release' && req.method === 'POST') {
    if (!same(g.admin, str(body.admin, 64))) return json({ error: 'No autorizado' }, 401);
    if (!person) return json({ error: 'Persona no válida' }, 400);
    person.claim = null; await store.setJSON(id, g);
    return json({ ok: true });
  }

  return json({ error: 'No encontrado' }, 400);
};
