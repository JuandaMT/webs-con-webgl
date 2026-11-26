// Copia este archivo como config.local.js (está en .gitignore, NO se sube a GitHub)
// y rellena tu clave. Restríngela en Google Cloud a "localhost" y a las APIs
// "Maps JavaScript API" y "Places API (New)".
window.CRM_CONFIG = {
  googleMapsKey: 'PEGA_AQUI_TU_CLAVE',
  region: 'co',            // código de país para sesgar resultados (es, mx, co, ar...)
  language: 'es',
  currency: 'EUR',         // moneda de los precios (EUR, USD, COP, MXN...)
  defaultCenter: { lat: 4.711, lng: -74.0721 }, // centro inicial del mapa
  defaultZoom: 12,
  mapId: 'DEMO_MAP_ID',    // opcional: tu Map ID propio
};
