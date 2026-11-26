# Amigo invisible

Sala online para sortear el amigo invisible entre amigos. Una casa entera (salón, cocina, dormitorio y baño) en perspectiva caballera con avatares tipo Mii (con la cara de cada uno) que pasean de habitación en habitación; cada uno toca su avatar y el **Grinch** entra en la casa, se va cargando a todos los demás y, cuando solo quedan tú y tu amigo invisible, viene hacia ti y te cuenta quién te toca.

Producción: https://amigo-invisible-navidad-2026.netlify.app

## Cómo se juega
1. **Organizador**: pone evento/presupuesto/fecha, añade participantes (mín. 3), restricciones (parejas…) y «Crear sala para mis amigos». También se puede crear llamando a `POST /api/create`.
2. El **servidor hace el sorteo** (nadie ve quién le toca a quién) y genera un **enlace personal por persona** (`#s=SALA&k=CLAVE`) y un enlace de organizador (`#s=SALA&a=ADMIN`) que muestra los enlaces para copiarlos o mandarlos por WhatsApp.
3. **Cada amigo** abre SU enlace: ve a todos en la casa, su avatar lleva una flecha dorada, puede ponerse **mote** y **foto** (con recortador: arrastrar, zoom con deslizador, rueda o pellizco) y pulsar «Ver a quién me toca» (o tocar su avatar): el Grinch hace su ronda y se lo cuenta.
4. «Pasar el móvil» sigue existiendo como modo local sin conexión.

## Privacidad
- El enlace personal es la «contraseña» de cada uno: solo permite ver a quién le toca a esa persona y editar su perfil. No se comparte.
- El enlace de organizador solo da acceso a la lista de enlaces y a ver quién ya ha mirado (✓ / pendiente); no revela el sorteo.
- Mientras los demás ven en la habitación nombres, motes y fotos, y un ✓ en quien ya ha mirado su amigo.

## Estructura
- `index.html`, `style.css`, `app.js` (interfaz, nieve WebGL, flujo), `room.js` (casa, avatares y Grinch en Canvas 2D con proyección caballera).
- `netlify/functions/api.mjs`: API (crear, ver, identificar, revelar, perfil, enlaces). Los datos se guardan en Netlify Blobs.

## Desarrollo local
```bash
npm install
netlify dev --port 5176
```
(Está configurado en `.claude/launch.json` como `amigo-invisible`.) Netlify Dev reintenta cualquier 403/404 con «.html», por eso la API usa 401/409/410.

## Desplegar
```bash
netlify deploy --prod --dir . --functions netlify/functions --site <ID_DEL_SITIO>
```
Sube el número `?v=` de los scripts en `index.html` cuando cambies JS/CSS para saltarse la caché.
