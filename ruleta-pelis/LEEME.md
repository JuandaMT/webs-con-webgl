# Ruleta de pelis

Web estática (HTML/CSS/JS, sin build ni dependencias externas) para decidir qué película ver.

## Abrir en local

```bash
cd ruleta-pelis
python3 -m http.server 8000
```

Abre http://localhost:8000 (también funciona abriendo `index.html` directamente).
Para usarla desde el móvil en la misma wifi: `http://IP-DE-TU-PC:8000`.

## Uso
- **Girar**: pulsa el botón central. Sale una peli con su ficha.
- **Girar otra vez / Quitar y girar**: en el resultado; "quitar" desactiva la ganadora de la ruleta.
- **Filtros**: por género y plataforma.
- **Lista**: añade películas (título, año, género, plataforma, URL de póster opcional), actívalas/desactívalas con el ojo o bórralas. Se guarda en `localStorage` del navegador.
- Sin póster, se genera una tarjeta de color con el título (no se usa ningún servicio externo).
