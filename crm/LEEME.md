# CRM de clientes (webs WebGL)

Pequeño CRM local para encontrar negocios con Google Maps, llevar el embudo (prospecto → ganado/perdido), notas, historial, recordatorios y ventas.

## Arrancar en local

Necesitas Node 18+ (sin `npm install`, no hay dependencias).

```bash
node crm/server.js
```

Abre http://localhost:5175 (solo accesible desde tu máquina). Otro puerto: `PORT=6000 node crm/server.js`.

## Clave de Google Maps (opcional, para «Buscar»)

1. Copia `crm/config.example.js` a `crm/config.local.js` y pon tu clave.
2. En Google Cloud habilita **Maps JavaScript API** y **Places API (New)**, y restringe la clave a `localhost`.
3. Reinicia el servidor.

Sin clave, todo funciona salvo el buscador (puedes añadir clientes a mano).

## Datos y privacidad

- Los clientes se guardan en `crm/data/crm.json` (más una copia `.bak` del guardado anterior).
- `crm/data/` y `crm/config.local.js` están en `.gitignore`: **nunca se suben al repo**.
- Aun así, como GitHub Pages publica el repo, el código del CRM es público (sin datos ni claves). Si no quieres eso, no lo hagas commit.
- Ajustes → Exportar/Importar JSON para copias de seguridad.
