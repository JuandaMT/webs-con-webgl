// API del CRM para Netlify: login con contraseña + datos en Netlify Blobs.
// Variables de entorno: CRM_PASSWORD (obligatoria), CRM_SECRET (opcional, firma de sesiones),
// GOOGLE_MAPS_KEY, CRM_REGION, CRM_LANGUAGE, CRM_CURRENCY, CRM_CENTER ("lat,lng"), CRM_ZOOM, CRM_MAP_ID.
import { getStore } from '@netlify/blobs';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const config = { path: ['/api/*', '/config.js'] };

const SESSION_MS = 30 * 24 * 3600 * 1000;   // la sesión dura 30 días
const MAX_FAILS = 10, FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_BODY = 5_000_000;                  // Netlify limita las peticiones a ~6 MB

const json = (o, s = 200, extra = {}) => new Response(JSON.stringify(o), {
  status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
});
const sha = (s) => createHash('sha256').update(String(s)).digest();
const same = (a, b) => timingSafeEqual(sha(a), sha(b));
const hmac = (exp) => createHmac('sha256', process.env.CRM_SECRET || process.env.CRM_PASSWORD).update('crm-session:' + exp).digest('hex');

const makeToken = () => { const exp = Date.now() + SESSION_MS; return exp + '.' + hmac(exp); };
function validToken(req) {
  const m = /^Bearer (\d+)\.([0-9a-f]{64})$/.exec(req.headers.get('authorization') || '');
  if (!m || Number(m[1]) < Date.now()) return false;
  return timingSafeEqual(Buffer.from(m[2]), Buffer.from(hmac(m[1])));
}

// Configuración del navegador (clave de Maps incluida: es una clave de navegador, restríngela por dominio en Google Cloud).
function configJs() {
  const e = process.env;
  const cfg = {
    googleMapsKey: e.GOOGLE_MAPS_KEY || '', region: e.CRM_REGION || '', language: e.CRM_LANGUAGE || 'es',
    currency: e.CRM_CURRENCY || 'EUR', mapId: e.CRM_MAP_ID || 'DEMO_MAP_ID',
  };
  if (e.CRM_CENTER) { const [la, ln] = e.CRM_CENTER.split(',').map(Number); if (Number.isFinite(la) && Number.isFinite(ln)) cfg.defaultCenter = { lat: la, lng: ln }; }
  if (Number(e.CRM_ZOOM)) cfg.defaultZoom = Number(e.CRM_ZOOM);
  return new Response('window.CRM_CONFIG = ' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ';', {
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function login(req) {
  const auth = getStore('crm-auth');
  const now = Date.now();
  let f = await auth.get('fails', { type: 'json' }).catch(() => null);
  if (!f || now - f.since > FAIL_WINDOW_MS) f = { n: 0, since: now };
  if (f.n >= MAX_FAILS) return json({ error: 'Demasiados intentos. Espera unos minutos.' }, 429);

  let body; try { body = await req.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
  const pw = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (!pw || !same(pw, process.env.CRM_PASSWORD)) {
    await auth.setJSON('fails', { n: f.n + 1, since: f.since });
    await new Promise((r) => setTimeout(r, 700));
    return json({ error: 'Contraseña incorrecta' }, 401);
  }
  if (f.n) await auth.delete('fails');
  return json({ token: makeToken() });
}

async function data(req) {
  const store = getStore('crm');
  const cur = await store.getWithMetadata('data', { type: 'json' });
  const curRev = Number(cur?.metadata?.rev || 0);

  if (req.method === 'GET') {
    return json(cur?.data ?? { clients: [] }, 200, { 'x-rev': String(curRev) });
  }
  if (req.method === 'PUT') {
    if (Number(req.headers.get('content-length') || 0) > MAX_BODY) return json({ error: 'Demasiado grande' }, 413);
    // Sin X-Rev no se escribe: evita pisar los datos con una copia vacía si la carga inicial falló.
    const sent = req.headers.get('x-rev');
    if (sent === null) return json({ error: 'Falta X-Rev' }, 428);
    if (Number(sent) !== curRev) return json({ error: 'Los datos cambiaron en otro dispositivo' }, 409, { 'x-rev': String(curRev) });
    let body; try { body = await req.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
    if (!body || !Array.isArray(body.clients)) return json({ error: 'Formato inválido' }, 400);
    if (cur) await store.setJSON('data.bak', cur.data);
    const rev = curRev + 1;
    await store.setJSON('data', body, { metadata: { rev } });
    return json({ ok: true, rev }, 200, { 'x-rev': String(rev) });
  }
  return json({ error: 'Método no permitido' }, 405);
}

export default async (req) => {
  const path = new URL(req.url).pathname;
  if (path === '/config.js') return configJs();
  if (!process.env.CRM_PASSWORD) return json({ error: 'Falta la variable CRM_PASSWORD en Netlify.' }, 503);

  if (path === '/api/login' && req.method === 'POST') return login(req);
  if (path === '/api/data') {
    if (!validToken(req)) return json({ error: 'No autorizado' }, 401);
    return data(req);
  }
  return json({ error: 'Ruta desconocida' }, 400);
};
