# Amigo invisible

Web estática (HTML/CSS/JS, sin build ni dependencias) para sortear el amigo invisible entre amigos. Fondo de nieve en WebGL.

## Abrir en local

```bash
cd amigo-invisible
python3 -m http.server 5176
```

Abre http://localhost:5176

## Uso
1. Pon nombre del evento, presupuesto y fecha (opcionales), añade participantes (mínimo 3) y **una foto por persona** tocando su círculo.
2. Restricciones opcionales: parejas/hermanos que no se tocan entre sí (si no hay sorteo posible, avisa).
3. **Hacer el sorteo** y elegir cómo repartir. En los dos modos se entra a una **habitación en perspectiva caballera** donde todos los participantes pasean como avatares tipo Mii con su cara y un gorro de Papá Noel:
   - **Pasar el móvil**: cada uno toca su avatar (o su nombre), confirma «¿Eres X?», se queda quieto y su amigo invisible **viene caminando y se lo cuenta** en una burbuja. «Entendido, ocultar» devuelve a todos a pasear para el siguiente.
   - **Enviar enlaces**: un enlace por persona (copiar o WhatsApp). Al abrirlo, el avatar de esa persona ya está elegido y su amigo viene a contárselo. Sin servidor ni base de datos: todo (reparto, fotos pequeñas de 48 px, a quién le toca) va en el `#` de la URL (~800 caracteres por participante).

## Notas técnicas
- `room.js`: habitación y avatares dibujados en Canvas 2D con proyección caballera (frontal a escala real, profundidad en diagonal a 45° con factor 0.7), orden de pintado por profundidad y cámara con zoom en el encuentro. La nieve del fondo es WebGL (`app.js`).
- Las fotos se recortan en cuadrado y se guardan en el navegador (96 px).

## Publicarla (para que los enlaces funcionen en otros móviles)
Es 100 % estática: vale Cloudflare Pages, Netlify, GitHub Pages… subiendo la carpeta.

## Limitaciones honestas
- Los enlaces llevan el JSON en la URL, **sin cifrar**: quien sepa leerlo puede ver a quién le toca a esa persona. Es suficiente para jugar entre amigos, no para secretos de verdad.
- Quien hace el sorteo ve la pantalla de enlaces (los nombres de quien envía), pero no tiene por qué abrirlos. Si participa, que no los abra.
- Participantes y restricciones se guardan en `localStorage` de tu navegador; el resultado del sorteo no.
