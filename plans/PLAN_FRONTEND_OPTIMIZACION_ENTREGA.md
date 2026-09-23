# Plan: Optimización de entrega del Frontend (técnicos en campo) — v2

> ⚠️ ACTUALIZACIÓN (implementación): `manualChunks` para `react-vendor` fue **revertido**.
> Separar React/react-dom en un chunk propio rompió el interop default de React
> (`Cannot read properties of undefined (reading 'useLayoutEffect')`) en librerías
> como react-big-calendar/radix. Se mantiene `chunkSizeWarningLimit: 500` y el
> code-splitting por `React.lazy` (que es el win principal). Ver Paso 2.

**Objetivo Q3:** reducir warnings de bundle/chunks y mejorar carga en conexiones móviles.
**Directivas:**
- NO ROMPER LO QUE YA ANDA.
- PROHIBIDO modificar `emerald_proxy` del host. Toda la optimización de red se encapsula en el contenedor del frontend.
**Foco:** lista y detalle de OT y Tickets.
**Estado:** propuesta para revisión — sin cambios aplicados.

---

## Hallazgo crítico (raíz del problema)

[`frontend/Dockerfile`](frontend/Dockerfile:1) corre **`npm run dev`** (servidor Vite de desarrollo), y [`docker-compose.yml:50`](docker-compose.yml:50) monta `./frontend:/app`. Es decir, **en todos los entornos (incluido producción) el frontend se sirve en MODO DEV**:

- Sin minificación/tree-shaking de producción.
- Con HMR websocket y source maps.
- El `manualChunks`/`build` de Vite **no aplica en dev** (solo en `vite build`).

Esto pesa mucho más que la falta de `React.lazy`. El mayor win es **servir el build de producción**, y se logra encapsulando nginx dentro del contenedor del frontend (sin tocar el proxy del host).

---

## Análisis de impacto (respuesta honesta)

**¿Cuánto mejora la experiencia en conexiones débiles?**

No se puede dar un % exacto sin medir el bundle real, pero los tres frentes apuntan a esto:

| Frente | Reducción típica de bytes transferidos |
|---|---|
| Pasar de `npm run dev` a `vite build` (minificación + tree-shaking, sin HMR) | ~50–70% del JS |
| GZIP nivel 6 sobre JS/CSS/JSON | ~60–80% adicional del payload (si hoy no comprime el edge) |
| `React.lazy` en rutas no usadas por técnicos | No reduce el total, pero reduce el **inicial** (time-to-interactive) al no descargar/parsear las otras ~20 páginas |

En la práctica, para un técnico que entra directo a `/app/tickets`, el **tiempo hasta poder interactuar** suele mejorar del orden de **50–80%** en un enlace débil. Es una estimación razonable, no una medición: la única forma de confirmarlo es con `vite build` (que reporta tamaños gzip) y una prueba real con throttling.

**¿Cuánto se sacrifica de performance?**

- Cliente: **nada** — al contrario, bundles más chicos se parsean y ejecutan más rápido.
- Servidor: solo un costo de CPU **menor** por el gzip nivel 6 (despreciable para el volumen de técnicos en campo).
- Build: un poco más lento (multi-stage), irrelevante para el runtime.
- Dev workflow: se pierde HMR en producción (que no se usa ahí); el dev local se mantiene con su propio override.

Es decir: no se sacrifica performance de servicio; se **gana** al quitar el overhead del modo dev.

---

## Paso 1 — Code Splitting (`React.lazy`)

Igual que en v1. Crear [`frontend/src/components/ui/PageFallback.jsx`](frontend/src/components/ui/PageFallback.jsx) (loader esmeralda minimalista) y refactorizar [`App.jsx`](frontend/src/App.jsx:1):

```jsx
import React, { Suspense, lazy } from 'react';
// ...
const TicketsPage = lazy(() => import('./pages/TicketsPage'));
const TicketDetailPage = lazy(() => import('./pages/TicketDetailPage'));
const WorkOrdersPage = lazy(() => import('./pages/WorkOrdersPage'));
const WorkOrderExecutionPage = lazy(() => import('./pages/WorkOrderExecutionPage'));
// ... resto de páginas también bajo lazy (LoginPage queda estático)
```

`PageFallback`:

```jsx
export default function PageFallback() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center bg-zinc-950">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin" />
      </div>
      <p className="mt-4 text-xs font-medium tracking-wide text-emerald-500/70 uppercase animate-pulse">Cargando…</p>
    </div>
  );
}
```

---

## Paso 2 — Vite (`frontend/vite.config.js`)

```js
build: {
  sourcemap: process.env.VITE_ENABLE_SOURCEMAPS === 'true',
  chunkSizeWarningLimit: 500, // KB
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (!id.includes('node_modules')) return undefined;
        if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react-vendor';
        if (id.includes('lucide-react')) return 'icons';
        if (id.includes('@tanstack/react-query')) return 'query-vendor';
        if (id.includes('axios')) return 'http-vendor';
        return 'vendor';
      },
    },
  },
},
```

Solo tiene efecto cuando corre `vite build` (que es justo lo que habilitamos en el Paso 3).

---

## Paso 3 — GZIP + Cache DENTRO del contenedor frontend (multi-stage + nginx)

### 3a. `frontend/Dockerfile` (multi-stage)

```dockerfile
# ── Stage 1: build de producción ──
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: servir estáticos con nginx (encapsulado, sin tocar el host) ──
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 3b. `frontend/nginx.conf` (nuevo)

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_http_version 1.1;
    gzip_types
        text/plain
        text/css
        text/xml
        application/json
        application/javascript
        application/xml
        application/xml+rss
        text/javascript;

    # Estáticos hasheados por Vite → cache largo e immutable
    location ~* \.(?:js|css|woff2?|png|jpe?g|gif|svg|ico|webp|avif)$ {
        expires 365d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # index.html sin caché (descubre los hashes nuevos)
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # SPA fallback para recarga directa (F5) en rutas profundas
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3c. Ajustes de orquestación (DENTRO del stack, no del host)

- El nginx interno [`nginx/default.conf:20`](nginx/default.conf:20) pasa de `proxy_pass http://frontend:5173` a **`http://frontend:80`** (el frontend ahora es nginx).
- En [`docker-compose.yml:50`](docker-compose.yml:50) quitar el bind-mount `./frontend:/app` y el modo dev para producción (el dev queda cubierto por su propio override con HMR).

---

## Riesgos / consideraciones al implementar

1. **Variables VITE_* en build**: `npm run build` inlina `import.meta.env.VITE_*` en tiempo de build. Hay que pasar `VITE_APP_ENV` y `VITE_API_URL` como **build args** del Dockerfile (o confirmar que el default `/api` es suficiente, ya que nginx interno proxea `/api`). El [`loadEnv` de `vite.config.js:15`](frontend/vite.config.js:15) apunta a `../` (raíz del repo), así que en el contexto de build del contenedor hay que revisar esa ruta.
2. **Recarga profunda (F5)**: el `try_files ... /index.html` de nginx conserva el history-fallback (hoy lo da el proxy); verificar que siga andando.
3. **Dev vs prod**: mantener el flujo dev (HMR) en un override aparte para no perder velocidad de desarrollo.
4. **No tocar `emerald_proxy`**: todo lo anterior vive en `frontend/Dockerfile`, `frontend/nginx.conf`, `nginx/default.conf` y `docker-compose.yml` (stack Emerald), nunca en el proxy del host.

---

## Orden de aplicación y verificación

1. Crear `PageFallback.jsx` y refactorizar `App.jsx` (Paso 1).
2. Ajustar `vite.config.js` (Paso 2).
3. Multi-stage `Dockerfile` + `nginx.conf` + ajuste del nginx interno y compose (Paso 3).
4. `docker compose build frontend` → verificar que `dist/` se genera y que el contenedor levanta nginx.
5. Smoke test: `/app/tickets`, `/app/tickets/:id`, `/app/work-orders`, `/app/work-orders/:id/execute` (carga, navegación y F5).
6. Comparar tamaño del bundle antes/después (dev vs build + gzip) para reportar el % real.
