# Web de la inmobiliaria (WebGL)

Escena 3D procedural: un edificio visto desde la calle. Al hacer scroll la cámara sube por la fachada, entra por la terraza y recorre el piso (salón, cocina, dormitorio 2, dormitorio principal, baño en suite) hasta volver a salir a la terraza. Después, ficha de la vivienda y formulario de contacto. Todo se modela con geometrías de Three.js y texturas dibujadas en canvas: no hay modelos ni imágenes externas.

## Ver en local
```
python3 -m http.server 5174 --directory inmobiliaria
```
Abrir http://localhost:5174 (o, desde dentro de la carpeta, `python3 -m http.server 5174`).
No funciona abriendo `index.html` con doble clic: los módulos JS necesitan un servidor.

## Personalizar
- **Textos, precio y datos:** `index.html` (bloques `<article class="stop">`, sección `#ficha`, sección `#contacto` y el JSON-LD del `<head>`). Los datos son inventados.
- **Nombre de la inmobiliaria:** logo en `index.html`, `<title>`, textos y pantalla de carga.
- **Colores:** variables `--acc`, `--acc2`, `--bg` en `css/style.css`; luz y cielo en `js/main.js` (`sunDir`, `sun`, shader `sky`).
- **Recorrido de cámara:** array `WP` en `js/main.js` (`p` = posición, `t` = punto al que mira, `w` = longitud del tramo, `hold` = pausa, `fm` = zoom). Cada panel de texto se enlaza con `data-i` al número de waypoint.
- **Plano de la vivienda:** coordenadas de las estancias en `ROOMS` (mini plano) y bloques «SALÓN», «COCINA»… de `js/main.js` (mobiliario).
- **Formulario:** es una demo, no envía nada. Para usarlo de verdad, conectar `#form` a un servicio de formularios o a un backend.

## Publicar
Es una web estática sin compilar: se sube la carpeta tal cual (GitHub Pages, Netlify, Cloudflare Pages…). Three.js, Lenis y las fuentes están en local, sin CDN.
Esta demo lleva `noindex` en `index.html` y en `_headers` (Netlify/Cloudflare): quitarlos al publicar la web real. Cambiar también `robots.txt` si procede.
