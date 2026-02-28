# Continuous Integration - E2E Tests

## Overview

Workflow automático que valida regresiones en Work Order Execution cada vez que se crea un PR contra `develop` o `master`.

## Trigger Conditions

✅ **Se ejecuta cuando:**
- PR abierto contra `develop` o `master`
- Cambios en `frontend/**`
- Cambios en `.github/workflows/e2e-tests.yml`
- Trigger manual (workflow_dispatch)

## Workflow Steps

### 1. **Checkout Code** 📥
Descarga el código del branch del PR.

### 2. **Setup Node.js** 🟢
- Node v18 (compatible con Vite + React 19)
- Cache de npm para velocidad

### 3. **Install Playwright** 📦
- Instala browsers del sistema (Chromium, Firefox, WebKit deps)
- Solo Chromium en CI (más rápido)

### 4. **Install Dependencies** 📝
```bash
npm ci  # Clean install (reproducible)
```

### 5. **Build Frontend** 🏗️
```bash
npm run build  # Vite build para producción
```
⚠️ `continue-on-error: true` - Los tests corren aunque build falle (para detectar runtime issues).

### 6. **Start Dev Server** 🌐
```bash
npm run dev &  # Background
sleep 10      # Espera que arranque
```

### 7. **Wait for Server** ⏳
```bash
curl -f http://localhost:5173  # Max 30s
```

### 8. **Run E2E Tests** 🧪
```bash
npx playwright test tests/work-order-execution.e2e.spec.ts
```

**Test Suite:**
- ✓ Detalle: asignación + criticidad coherentes
- ✓ Modal Material: no cierra por Escape/click afuera
- ✓ Modal Cierre: no cierra por Escape/click afuera

### 9. **Upload Report** 📊
Artefacto HTML de Playwright por 30 días.

### 10. **Comment on PR** 💬
Bot comenta con resumen automático.

## Status Checks

### In PR
Aparece como:
```
✅ E2E Tests - Work Order Execution
```

Si **falla**, bloquea merge.

### Logs
Clickear en ❌ → Ver logs completos → Diagnóstico.

## Artifacts

**Disponibles por 30 días:**
- `playwright-report/` - Reporte HTML interactivo
- Screenshots de failures
- Videos de fallidas

**Acceso:**
1. PR → Actions tab
2. Seleccionar workflow run
3. Buscar "Artifacts" → Download

## Timing

| Paso | Tiempo |
|------|--------|
| Setup | 2-3min |
| Dependencies | 1-2min |
| Build | 30-60s |
| Dev Server | 10-15s |
| Tests | 10-20s |
| **Total** | **5-8 min** |

## Failure Modes

### ❌ Browser not found
```
Error: Browser is not supported/installed
```
**Fix:** Workflow instala automáticamente. Si falla, check permisos.

### ❌ Dev server not responding
```
curl: (7) Failed to connect
```
**Fix:** 
- Check `npm run dev` output
- Verifica puerto 5173 libre
- Aumenta `sleep` en step

### ❌ Test timeout
```
test timeout of 30000ms exceeded
```
**Fix:**
- Aumenta timeout en `playwright-ci.config.ts`
- Revisa logs de test específico

### ❌ Backend not reachable
Necesita backend real (API en 8000, DB en 5432).  
En CI, mockear o usar test database.

## Local Testing (Simular CI)

```bash
cd frontend

# Opción 1: Usar la misma config que CI
npx playwright test tests/work-order-execution.e2e.spec.ts \
  --config=playwright-ci.config.ts

# Opción 2: Debug mode
npm run test:e2e:debug

# Opción 3: UI interactivo
npm run test:e2e:ui
```

## Customization

### Cambiar browsers
En `playwright-ci.config.ts`:
```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
]
```

### Cambiar reporters
En `playwright-ci.config.ts`:
```typescript
reporter: [
  ['html'],
  ['github'],
  ['json', { outputFile: 'test-results.json' }],
]
```

### Cambiar timeout
```typescript
timeout: 60 * 1000,  // 60s
```

## GitHub Permissions

Workflow necesita:
- ✅ `checks: write` (comentarios en PR)
- ✅ `actions: read` (acceso a artifacts)
- ✅ `contents: read` (checkout code)

Default GITHUB_TOKEN incluye todo.

## Monitoreo

### Dashboard
Settings → Actions → All workflows → `E2E Tests`

### Notifications
- Fallo en PR: Notificación automática
- Reporte: Generado automáticamente

### Metrics
```
Total runs: [N]
Success rate: [%]
Avg duration: [Xm]
```

## Troubleshooting Checklist

- [ ] Node v18 en runner? ✅ Especificado
- [ ] npm ci vs npm install? ✅ Usar ci para reproducibilidad
- [ ] Browser instalado? ✅ `npx playwright install`
- [ ] Dev server en el puerto correcto? ✅ 5173
- [ ] Tests usan helpers? ✅ `openFirstWorkOrderExecution()`
- [ ] Timeout suficiente? ✅ 30s por test
- [ ] Report se genera? ✅ Artifact upload
- [ ] Bot puede comentar? ✅ GITHUB_TOKEN automático

## Future Enhancements

- [ ] Slack notifications en fallo
- [ ] Performance benchmarking
- [ ] Cross-browser testing (Firefox, Safari)
- [ ] Visual regression testing
- [ ] Test result trends/dashboard
- [ ] Parallel test runs en múltiples workers
