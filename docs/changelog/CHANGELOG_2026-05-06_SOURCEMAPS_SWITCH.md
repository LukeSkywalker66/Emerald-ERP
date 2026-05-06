# 🛡️ Source Maps Switch — Frontend Emerald ERP

**Fecha:** 2026-05-06
**Branch:** `refactor/api-routing-standards`
**Autor:** Roo (AI Architect/Code)

---

## 1. Necesidad / Problema

### 🔴 Riesgo de Seguridad

El build de producción del frontend (Vite) **no tenía control explícito sobre la generación de Source Maps**. Por defecto, Vite no genera source maps en build (`vite build`), pero al no estar declarado explícitamente en la configuración, cualquier cambio futuro en las defaults de Vite o un comando accidental podría exponer código fuente en producción.

Los Source Maps en producción permiten reconstruir el código fuente original desde el bundle minificado, exponiendo:
- Lógica de negocio del frontend
- Estructura de componentes y rutas
- Posibles credenciales hardcodeadas o endpoints internos
- Cómo se consumen los endpoints del backend

### 🎯 Objetivo

Establecer un **mecanismo explícito y predecible** para controlar la generación de Source Maps, siguiendo el principio de **seguridad por defecto (secure by default)** :

| Entorno | Source Maps | Comando |
|---------|:-----------:|---------|
| Producción (default) | ❌ Desactivados | `npm run build` |
| Debug en servidor Debian | ✅ Activados | `npm run build:debug` |

---

## 2. Cambios Efectuados

### 2.1 [`frontend/vite.config.js`](/frontend/vite.config.js:18)

Se agregó la sección `build` dentro del objeto de configuración de Vite:

```js
build: {
  sourcemap: process.env.VITE_ENABLE_SOURCEMAPS === 'true',
}
```

**Comportamiento:**
- `VITE_ENABLE_SOURCEMAPS` no definida → `undefined === 'true'` → `false` → build seguro
- `VITE_ENABLE_SOURCEMAPS=true` → `'true' === 'true'` → `true` → build con source maps

### 2.2 [`frontend/package.json`](/frontend/package.json:9)

Se agregó el script `build:debug`:

```json
"build:debug": "VITE_ENABLE_SOURCEMAPS=true vite build"
```

El script `build` original se mantiene intacto como el comando seguro por defecto.

### 2.3 Archivos NO modificados (verificados)

| Archivo | Motivo |
|---------|--------|
| [`frontend/Dockerfile`](/frontend/Dockerfile) | Usa `npm run dev` (dev server), no ejecuta `vite build` |
| [`nginx/default.conf`](/nginx/default.conf) | Proxy reverso a dev server, no sirve archivos estáticos de build |

---

## 3. Modo de Uso

### Build seguro (producción)
```bash
npm run build
# → sourcemap: false
```

### Build con source maps (debug)
```bash
npm run build:debug
# → sourcemap: true
# → genera archivos .map en dist/
```

Para debuggear en el servidor Debian unificado:
```bash
npm run build:debug
# Subir/distribuir los archivos de dist/
# Los source maps .map estarán disponibles para el navegador
```

---

## 4. Referencias

- [Vite Docs: build.sourcemap](https://vite.dev/config/build-options.html#build-sourcemap)
- [OWASP: Source Code Disclosure](https://owasp.org/www-community/attacks/Source_Code_Disclosure)
- Documento de planificación: [`plans/PLAN_ACCION_MEJORAS_API.md`](/plans/PLAN_ACCION_MEJORAS_API.md)
