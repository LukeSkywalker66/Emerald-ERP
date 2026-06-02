## Source Maps Switch — Implementado ✅

### Cambios realizados

**1️⃣ [`frontend/vite.config.js`](frontend/vite.config.js:18)** — Sección `build` agregada:
```js
build: {
  sourcemap: process.env.VITE_ENABLE_SOURCEMAPS === 'true',
}
```
- `VITE_ENABLE_SOURCEMAPS` no definida → `undefined === 'true'` → **`false`** (seguro)
- `VITE_ENABLE_SOURCEMAPS=true` → `'true' === 'true'` → **`true`** (debug)

**2️⃣ [`frontend/package.json`](frontend/package.json:9)** — Nuevo script agregado:
```json
"build:debug": "VITE_ENABLE_SOURCEMAPS=true vite build"
```

### Uso

| Comando | Source Maps | Propósito |
|---------|------------|-----------|
| `npm run build` | ❌ No | Build seguro para producción |
| `npm run build:debug` | ✅ Sí | Build con source maps para debugging en servidor |

### Confirmación Docker

El [`frontend/Dockerfile`](frontend/Dockerfile:10) usa `npm run dev` (dev server de Vite), no `npm run build`. No se ve afectado por este cambio.