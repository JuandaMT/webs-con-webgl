# Web del taller (WebGL)

Escena 3D: un coche dentro de un taller. El scroll mueve la cámara por las partes del coche y cada parada explica un servicio.

## Ver en local
```
python3 -m http.server 5173 --directory taller
```
Abrir http://localhost:5173

## Personalizar para otro cliente
- **Textos y servicios:** `index.html`, bloques `<article class="stop">`. Una parada = un servicio.
- **Datos del taller:** nombre en `index.html` (logo, título, contacto) y rótulo de neón en `js/main.js` (`signTex`, texto `TALLER NORTE`).
- **Colores de marca:** variable `--acc` en `css/style.css` y colores del elevador (`orange`) en `buildRoom`.
- **Paradas de cámara:** array `stops` en `js/main.js` (posición `pos` y punto al que mira `tgt`). `SHIFTS` mueve el coche a un lado para dejar sitio al texto.
- **Otro coche:** cambiar `models/car.glb`. Los nombres de pieza que se buscan (`Engine`, `BodyHood`, `WheelFrontL`, `BodyHeadlights`...) deben existir; si no, adaptar los nombres en `main.js`.

## Optimizar un modelo nuevo (de 12 MB a ~2,6 MB)
```
npx -y @gltf-transform/cli@4 optimize entrada.glb salida.glb --compress meshopt --texture-compress webp --texture-size 1024 --join false --flatten false --simplify false
```
Los `--join/--flatten/--simplify false` son necesarios: si no, se fusionan las piezas y la web no encuentra capó, ruedas ni motor por nombre.

## Publicar
La carpeta `taller/` es una web estática y no necesita compilar. Se puede subir tal cual a Netlify, Cloudflare Pages, Vercel o cualquier hosting. Todo es local (sin CDN ni Google Fonts), así que no hay peticiones a terceros.

### Lista para cada cliente (buscar `tallernorte` y `600 000 000` en `index.html`)
- [ ] Nombre del taller: logo, `<title>`, textos, rótulo de neón (`signTex` en `js/main.js`)
- [ ] Teléfono, WhatsApp, email, dirección y horario (sección contacto **y** bloque JSON-LD del `<head>`)
- [ ] Dominio real en `canonical`, `og:url`, `og:image` y `url` del JSON-LD
- [ ] Imagen para compartir `img/og.jpg` (1200×630), por ejemplo una captura de la escena
- [ ] Cifras de la sección de números (años, coches, garantía) y textos de servicios: que sean reales
- [ ] Añadir `Sitemap:` en `robots.txt`
- [ ] Política de privacidad / aviso legal si el cliente lo exige (la web no usa cookies ni analítica)
- [ ] Mantener la atribución del modelo 3D en el pie de página

## Créditos (obligatorios al usar el modelo)
Modelo «CarConcept» de Eric Chadwick, licencia CC BY 4.0, vía Khronos glTF-Sample-Assets. La atribución ya está en el pie de página: no quitarla.
