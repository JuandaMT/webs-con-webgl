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

## Versión en Netlify (con contraseña)

La misma web puede vivir en Netlify: la API es una función (`netlify/functions/api.mjs`), los clientes se guardan en **Netlify Blobs** y todo está detrás de una contraseña. El modo local (`node crm/server.js`) sigue funcionando igual, sin contraseña.

### Desplegar

Desde la carpeta `crm/` (necesitas `npm i -g netlify-cli` y `netlify login`):

```bash
npm install
netlify sites:create --name mi-crm        # solo la primera vez; apunta el ID del sitio
```

Variables de entorno (ponlas **antes** de desplegar):

```bash
netlify env:set CRM_PASSWORD "una-contraseña-larga-y-única" --site <ID_DEL_SITIO>
netlify env:set GOOGLE_MAPS_KEY "tu-clave" --site <ID_DEL_SITIO>      # opcional (buscador)
```

Opcionales: `CRM_SECRET` (firma de sesiones; si no, se usa la contraseña), `CRM_CURRENCY` (por defecto `EUR`), `CRM_REGION` (`es`, `co`…), `CRM_LANGUAGE`, `CRM_CENTER` (`lat,lng` del mapa), `CRM_ZOOM`, `CRM_MAP_ID`.

```bash
netlify deploy --prod --dir public --functions netlify/functions --site <ID_DEL_SITIO>
```

Si cambias la contraseña, vuelve a desplegar: las sesiones abiertas dejan de valer.

### Después de desplegar

- **Clave de Maps:** en Google Cloud restríngela al dominio `https://mi-crm.netlify.app/*` (la clave llega al navegador, como en cualquier mapa web).
- **Pasar tus datos de local a la nube:** en local, Ajustes → Exportar JSON; en la web de Netlify, Ajustes → Importar JSON.
- **Probar en local con Netlify:** crea `crm/.env` con `CRM_PASSWORD=...` (está en `.gitignore`) y ejecuta `netlify dev --cwd crm --port 5177`.

### Cómo se protege

- Sin sesión, la API devuelve 401. La sesión es un token firmado que dura 30 días y se guarda en el navegador (Ajustes → Cerrar sesión la borra).
- 10 contraseñas erróneas seguidas bloquean los nuevos inicios de sesión 15 minutos. Las sesiones ya abiertas no se ven afectadas.
- Si falta `CRM_PASSWORD`, la API se niega a funcionar (no queda abierta por error).
- Si abres el CRM en dos dispositivos, cada guardado lleva el número de versión: si otro dispositivo guardó antes, avisa en vez de pisar sus cambios.
- Se conserva una copia de la versión anterior (`data.bak` en Blobs).
- La web no se indexa (`noindex`) y no admite iframes.

