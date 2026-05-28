# Implementación Multi-Entorno Frontend

**Fecha:** 2026-05-28
**Responsable:** DevOps/Frontend Engineer
**Propósito:** Preparar el Frontend (React/Vite) para soportar múltiples entornos (Producción, Staging, Desarrollo) siguiendo la metodología 12-Factor App.

---

## Resumen

Se implementaron indicadores visuales de entorno en el Frontend de Emerald ERP utilizando las capacidades nativas de Vite para cargar variables de entorno según el modo de ejecución (`development`, `staging`, `production`).

---

## Archivos Creados

### 1. `frontend/.env.development`

```bash
# Entorno: Desarrollo Local
VITE_APP_ENV=development
VITE_API_URL=http://localhost:8500/api/v2
```

**Uso:** Se carga automáticamente al ejecutar `npm run dev` (Vite mode = `development`).

---

### 2. `frontend/.env.staging`

```bash
# Entorno: Staging
VITE_APP_ENV=staging
VITE_API_URL=/api/v2
```

**Uso:** Se carga al ejecutar `npm run dev:staging` (Vite mode = `staging`).

---

### 3. `frontend/.env.production`

```bash
# Entorno: Producción
VITE_APP_ENV=production
VITE_API_URL=/api/v2
```

**Uso:** Se carga al ejecutar `npm run build` o en producción (Vite mode = `production`).

---

## Archivos Modificados

### 4. `frontend/package.json`

Se agregó el script `dev:staging` en la línea 8:

```json
"scripts": {
  "dev": "vite",
  "dev:staging": "vite --mode staging --host",
  "build": "vite build",
  ...
}
```

Este script permite ejecutar el servidor de desarrollo de Vite en modo `staging`, lo que provoca que Vite cargue el archivo `.env.staging` y exponga `VITE_APP_ENV=staging` al cliente.

---

### 5. `frontend/src/layouts/DashboardLayout.jsx`

Se insertó un banner condicional de entorno en el layout principal (líneas 26-48), dentro del contenedor `flex flex-col flex-1`, justo antes del `<header>` del topbar.

**Mecanismo:** Lee `import.meta.env.VITE_APP_ENV` y renderiza condicionalmente:

| `VITE_APP_ENV` | Diseño | Texto |
|:---:|--------|-------|
| `staging` | Fondo negro (`bg-black`), texto ámbar neón (`text-amber-500`), bold monospace | `⚠️ ENTORNO DE STAGING - DATOS DE PRUEBA ⚠️` |
| `development` | Fondo cyan oscuro translúcido (`bg-cyan-950/80`), borde inferior cyan, texto cyan claro (`text-cyan-400`), bold monospace | `⚙️ ENTORNO DE DESARROLLO (LOCAL)` |
| `production` o `undefined` | No renderiza nada | — |

**Consideraciones de diseño:**
- El banner está dentro del flujo flex-col del área de contenido principal.
- No afecta al sidebar (que está en un contenedor flex separado).
- El banner empuja el topbar y el contenido hacia abajo naturalmente sin superposiciones.
- El ancho es `w-full` para ocupar todo el espacio disponible.

---

## Diagrama de Flujo

```
npm run dev
    → Vite mode = "development"
    → loadEnv() carga .env.development
    → VITE_APP_ENV=development
    → DashboardLayout renderiza banner CYAN

npm run dev:staging
    → Vite mode = "staging"
    → loadEnv() carga .env.staging
    → VITE_APP_ENV=staging
    → DashboardLayout renderiza banner AMBAR

npm run build (producción)
    → Vite mode = "production"
    → loadEnv() carga .env.production
    → VITE_APP_ENV=production
    → DashboardLayout NO renderiza banner
```

---

## Verificación

Para probar localmente:

```bash
# Terminal 1: Desarrollo (banner cyan)
cd frontend && npm run dev
# Abrir http://localhost:5173 → banner "ENTORNO DE DESARROLLO (LOCAL)"

# Terminal 2: Staging (banner ámbar)
cd frontend && npm run dev:staging
# Abrir http://localhost:5174 → banner "ENTORNO DE STAGING - DATOS DE PRUEBA"
```

---

## Notas para el Arquitecto

1. **No se requieren migraciones de base de datos** — todo es configuración de Frontend.
2. **Vite maneja la carga de `.env.{mode}` automáticamente** mediante `loadEnv(mode, process.cwd(), '')` en `vite.config.js`.
3. **La infraestructura Docker** (docker-compose.staging.yml, port offsets, container names) queda pendiente de implementación por parte de DevOps.
4. **Variables expuestas al cliente:** Solo las que comienzan con `VITE_` son accesibles via `import.meta.env`. `VITE_APP_ENV` y `VITE_API_URL` son las dos únicas variables de entorno que necesita el frontend.
