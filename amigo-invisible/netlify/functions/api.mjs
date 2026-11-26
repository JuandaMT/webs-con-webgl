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
// Ideas de regalo: exactamente 3, ninguna vacía (sin caracteres de control ni < >).
const cleanWish = v => str(v, 50).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
const wishesOf = p => Array.isArray(p.wishes) ? p.wishes : [];
const wishesDone = p => { const w = wishesOf(p); return w.length === 3 && w.every(x => typeof x === 'string' && x); };
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
    const clean = people.map(p => ({ n: str(p && p.n, 30), p: p && okPhoto(p.p || '') ? (p.p || '') : '', nick: '', wishes: [], key: rid(16), opened: false }));
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
    return json({ id: gid, admin, keys: clean.map(p => p.key) });
  }

  if (!id || !/^[a-z0-9]{8}$/.test(id)) return json({ error: 'Sala no válida' }, 400);
  const g = await store.get(id, { type: 'json' });
  if (!g) return json({ error: 'Sala no encontrada' }, 410);
  const byKey = k => g.people.findIndex(p => same(p.key, str(k, 32)));

  if (action === 'game' && req.method === 'GET') {
    return json({ ev: g.ev, people: g.people.map(p => ({ n: p.n, p: p.p, nick: p.nick || '', opened: !!p.opened, wished: wishesDone(p) })) });
  }

  if (action === 'me' && req.method === 'POST') {
    const i = byKey(body.key);
    return i < 0 ? json({ error: 'Enlace no válido' }, 401) : json({ i, wishes: wishesOf(g.people[i]) });
  }

  if (action === 'reveal' && req.method === 'POST') {
    const i = byKey(body.key);
    if (i < 0) return json({ error: 'Enlace no válido' }, 401);
    // Antes de ver nada hay que haber puesto las 3 ideas de regalo.
    if (!wishesDone(g.people[i])) return json({ error: 'Antes de ver a quién te toca, escribe tus 3 ideas de regalo.' }, 409);
    if (!g.people[i].opened) { g.people[i].opened = true; await store.setJSON(id, g); }
    // El Grinch cuenta las ideas de la persona a la que le haces el regalo (puede que aún no las haya puesto).
    return json({ gift: g.giftOf[i], wishes: wishesOf(g.people[g.giftOf[i]]) });
  }

  if (action === 'wishes' && req.method === 'POST') {
    const i = byKey(body.key);
    if (i < 0) return json({ error: 'Enlace no válido' }, 401);
    const w = Array.isArray(body.wishes) ? body.wishes.map(cleanWish) : [];
    if (w.length !== 3 || w.some(x => !x)) return json({ error: 'Rellena las 3 ideas de regalo.' }, 400);
    g.people[i].wishes = w;
    await store.setJSON(id, g);
    return json({ ok: true, wishes: w });
  }

  if (action === 'profile' && req.method === 'POST') {
    const i = byKey(body.key);
    if (i < 0) return json({ error: 'Enlace no válido' }, 401);
    if (body.nick !== undefined) g.people[i].nick = str(body.nick, 20).replace(/[\u0000-\u001f<>]/g, '');
    if (body.p !== undefined) {
      if (typeof body.p !== 'string' || !okPhoto(body.p)) return json({ error: 'Foto no válida' }, 400);
      g.people[i].p = body.p;
    }
    await store.setJSON(id, g);
    return json({ ok: true, nick: g.people[i].nick });
  }

  if (action === 'links' && req.method === 'POST') {
    if (!same(g.admin, str(body.admin, 64))) return json({ error: 'No autorizado' }, 401);
    return json({ keys: g.people.map(p => p.key) });
  }

  return json({ error: 'No encontrado' }, 400);
};
