/**
 * Helper para resolver dinámicamente la URL base de la API.
 *
 * - Por defecto usa ruta relativa ('') para aprovechar el proxy inverso same-origin
 *   de Nginx (/api/ -> http://backend:8000/api/) en Docker/Homelab y el proxy de Vite
 *   en desarrollo local, evitando problemas de CORS y 404 por subdominios Traefik.
 * - Soporta variable de entorno VITE_API_URL si se requiere apuntar a un host externo explícito.
 */
export function getApiBaseUrl() {
  if (import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  return '';
}

export function apiUrl(path) {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Parsea de forma segura la respuesta HTTP sin lanzar SyntaxError cuando el proxy
 * (Traefik, Nginx o Vite) devuelve texto plano o HTML (por ejemplo en errores 404/502).
 */
export async function parseApiResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    const text = (await res.text()).trim();
    return text ? { detail: text.slice(0, 200) } : null;
  } catch {
    return null;
  }
}
