/**
 * Helper para resolver dinámicamente la URL base de la API.
 * 
 * - En Homelab con Traefik: Si el hostname es meli-sales.* (ej. meli-sales.homelab.internal),
 *   automáticamente apunta al subdominio del backend api-meli-sales.*.
 * - Soporta variable de entorno VITE_API_URL si se define en build o ejecución.
 * - En entorno local (localhost o acceso directo a contenedor): usa ruta relativa ('').
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    // Si se definió explícitamente una variable de entorno en Vite
    if (import.meta.env?.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    }

    const host = window.location.hostname;

    // Detección automática para subdominios Homelab/Traefik
    // Ej: meli-sales.homelab.internal -> https://api-meli-sales.homelab.internal
    if (host.includes('meli-sales')) {
      const apiHost = host.replace('meli-sales', 'api-meli-sales');
      const port = window.location.port ? `:${window.location.port}` : '';
      // Si el puerto no es estándar web (80/443), omitirlo o mantenerlo
      return `${window.location.protocol}//${apiHost}${port}`;
    }
  }
  return '';
}

export function apiUrl(path) {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
