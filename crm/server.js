// Servidor mínimo sin dependencias: sirve /public y guarda los datos en data/crm.json.
// Escucha solo en 127.0.0.1 (nadie más de tu red puede verlo).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5175;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'crm.json');
const CONFIG_FILE = path.join(ROOT, 'config.local.js');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

fs.mkdirSync(DATA_DIR, { recursive: true });

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req, limit = 20e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    // Protección básica contra peticiones de otros orígenes (CSRF desde otras webs)
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, 'Origen no permitido');

    if (url.pathname === '/api/data') {
      if (req.method === 'GET') {
        const body = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : '{"clients":[]}';
        return send(res, 200, body, TYPES['.json']);
      }
      if (req.method === 'PUT') {
        const text = await readBody(req);
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.clients)) return send(res, 400, 'Formato inválido');
        if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak');
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
        fs.renameSync(tmp, DATA_FILE);
        return send(res, 200, '{"ok":true}', TYPES['.json']);
      }
      return send(res, 405, 'Método no permitido');
    }

    // La configuración (con la clave de Maps) vive fuera de /public y está en .gitignore
    if (url.pathname === '/config.js') {
      const js = fs.existsSync(CONFIG_FILE) ? fs.readFileSync(CONFIG_FILE, 'utf8') : 'window.CRM_CONFIG = {};';
      return send(res, 200, js, TYPES['.js']);
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Prohibido');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'No encontrado');
    send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    send(res, 500, 'Error: ' + e.message);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`CRM en http://localhost:${PORT}`);
  console.log(fs.existsSync(CONFIG_FILE) ? 'Config: config.local.js cargada' : 'Config: falta config.local.js (el buscador de Maps estará desactivado)');
});
