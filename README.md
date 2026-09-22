# Mercado Libre Deals & Best Sellers Scraper (Docker Edition)

Arquitectura completa y desacoplada de extracción y cruce de datos para Mercado Libre sin depender de APIs oficiales, tokens de desarrollador ni certificados locales.

---

## 🏛️ Arquitectura del Sistema

```
                  ┌───────────────────────────────┐
                  │   Frontend SPA (Puerto 3001)  │
                  │       React + Vite + Nginx    │
                  └───────────────┬───────────────┘
                                  │ Proxy HTTP /api
                                  ▼
                  ┌───────────────────────────────┐
                  │   Backend FastAPI (Port 8001) │
                  │  /api/v1/comparison & /sync   │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │    SQLite /meli_data/meli.db  │
                  │   (Volumen persistente Docker)│
                  └───────────────▲───────────────┘
                                  │
                   (Extracción periódica cada 6h)
                                  │
                  ┌───────────────┴───────────────┐
                  │   Scraper Worker Service      │
                  │   (curl_cffi + selectolax)    │
                  └───────────────┬───────────────┘
                                  │ TLS Chrome 120 Impersonate
                                  ▼
                  ┌───────────────────────────────┐
                  │     Mercado Libre Público     │
                  │   /mas-vendidos y /ofertas    │
                  └───────────────────────────────┘
```

---

## 🚀 Despliegue Rápido con Docker

### 1. Clonar o ingresar al proyecto
```bash
cd sales_app
```

### 2. Configuración de entorno (Opcional)
Por defecto ya existe un `.env` con:
- `FRONTEND_PORT=3001`
- `BACKEND_PORT=8001`
- `SITE_DOMAIN=www.mercadolibre.com.mx`
- `SCRAPE_INTERVAL_HOURS=6`

### 3. Construir y Levantar Contenedores
```bash
docker compose up --build -d
```

### 4. Acceder al Dashboard y API
- **Frontend Dashboard:** [http://localhost:3001](http://localhost:3001)
- **Documentación Swagger FastAPI:** [http://localhost:8001/docs](http://localhost:8001/docs)
- **Healthcheck:** [http://localhost:8001/api/v1/health](http://localhost:8001/api/v1/health)

---

## 📡 Endpoints Principales de la API

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Estado del servicio y dominio configurado. |
| `GET` | `/api/v1/categories` | Lista de categorías principales de Mercado Libre. |
| `GET` | `/api/v1/comparison` | Consulta de la última comparativa (soporta `category_id`, `min_discount`, `only_deals`). |
| `POST` | `/api/v1/sync` | Dispara extracción en tiempo real con bloqueo anti-concurrencia. |
| `GET` | `/api/v1/sync/status` | Estado del último proceso de sincronización y si hay uno en ejecución. |

---

## 🛠️ Comandos de Mantenimiento

- **Ver logs en tiempo real:**
  ```bash
  docker compose logs -f
  ```
- **Ver logs de solo el worker de scraping:**
  ```bash
  docker compose logs -f worker
  ```
- **Detener los servicios:**
  ```bash
  docker compose down
  ```
- **Detener y borrar volúmenes:**
  ```bash
  docker compose down -v
  ```
