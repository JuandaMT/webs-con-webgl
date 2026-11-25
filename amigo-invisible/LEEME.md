# Amigo invisible

Sala online para sortear el amigo invisible entre amigos. Una habitación en perspectiva caballera con avatares tipo Mii (con la cara de cada uno) que pasean; cada uno toca su avatar y su amigo invisible viene caminando a contárselo.

Producción: https://amigo-invisible-navidad-2026.netlify.app

## Cómo se juega
1. **Organizador**: abre la web, pone evento/presupuesto/fecha, añade participantes (mín. 3), restricciones opcionales (parejas…) y, si quiere, fotos. «Continuar» → **Crear sala para mis amigos**.
2. El **servidor hace el sorteo** (nadie, ni el organizador, ve quién le toca a quién) y devuelve un enlace `…/#s=CODIGO` para compartir.
3. **Cada amigo** abre el enlace, ve a todos en la habitación, toca su avatar (o su nombre), confirma «¿Eres X?» y su amigo invisible viene y se lo cuenta. Después puede **cambiarse la foto** (📷).
4. «Pasar el móvil» sigue existiendo como modo local sin conexión.

## Privacidad
- Un nombre se «reserva» con el primer dispositivo que lo abre (token guardado en ese navegador). Otro dispositivo recibe «ya lo ha abierto otra persona».
- Si alguien abrió un nombre por error o cambia de móvil, el organizador (en el navegador donde creó la sala) pulsa su nombre en el panel «Organizador» para **liberarlo**.
- Quien conozca el enlace puede abrir cualquier nombre aún sin reservar: pásalo solo a tus amigos. Cada uno debe abrir **su** nombre.

## Estructura
- `index.html`, `style.css`, `app.js` (interfaz, nieve WebGL, flujo), `room.js` (habitación y avatares en Canvas 2D con proyección caballera).
- `netlify/functions/api.mjs`: API (crear, ver, abrir, foto, liberar). Los datos se guardan en Netlify Blobs.

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
