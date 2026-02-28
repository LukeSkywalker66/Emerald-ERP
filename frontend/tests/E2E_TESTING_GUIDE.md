# E2E Tests Configuration

## Running E2E Tests Locally

### Prerequisites
- Node.js 18+
- Playwright browsers installed
- Emerald ERP backend running
- Frontend dev server running or built

### Install Dependencies
```bash
cd frontend
npm ci
npx playwright install --with-deps
```

### Run Tests

#### All E2E Tests
```bash
npm run test:e2e
```

#### Specific Test Suite
```bash
npx playwright test tests/work-order-execution.e2e.spec.ts
```

#### With UI Mode (Interactive)
```bash
npx playwright test --ui
```

#### With Debugging
```bash
npx playwright test --debug
```

### Environment Variables
```bash
# Required
VITE_API_BASE_URL=http://localhost:8000/api
TEST_USER_EMAIL=admin@emerald.local
TEST_USER_PASSWORD=admin123

# Optional
PLAYWRIGHT_HEADLESS=0  # Run in headed mode
PLAYWRIGHT_SLOWMO=1000 # Slow down execution (ms)
```

## Test Coverage

### Work Order Execution Suite (`work-order-execution.e2e.spec.ts`)

1. **Detalle muestra asignación y criticidad coherentes con backend**
   - Valida que los datos visuales coincidan con respuesta del backend
   - Asignatario: `team_name` → `technician_name` → "sin asignar"
   - Criticidad: mapea `priority` a etiqueta displayable

2. **Modal Agregar Material no cierra por Escape ni click afuera**
   - Valida que `onEscapeKeyDown` previene cierre
   - Valida que `onInteractOutside` previene cierre
   - Solo cierra con botón "Cancelar" explícito

3. **Wizard Completar OT no cierra por Escape ni click afuera**
   - Igual validación para modal de cierre
   - Previene cierre accidental durante completación

## CI/CD Integration

Tests se ejecutan automáticamente en:
- **Pull Requests** contra `develop` o `master`
- **Cambios en** `frontend/**` o `.github/workflows/e2e-tests.yml`
- **Manual trigger** con workflow_dispatch

### CI Behavior
- ✅ Falla PR si algún test no pasa
- ✅ Genera reporte HTML de Playwright
- ✅ Comenta en PR con status
- ✅ Sube artefactos (reports) por 30 días

## Troubleshooting

### Browser Not Found
```bash
npx playwright install --with-deps
```

### Tests Timeout
Aumenta timeout en `playwright.config.ts`:
```typescript
timeout: 30000, // 30s
```

### Cannot Connect to Backend
Verifica que:
1. Backend está en `http://localhost:8000`
2. BD está accesible
3. Token de test es válido

### SignUp/Login Fails
Verifica credenciales en `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`

## Best Practices

1. **Keep tests focused** - Un escenario por test
2. **Use helpers** - `openFirstWorkOrderExecution()` vs repetir setup
3. **Avoid flaky tests** - Usa `waitForResponse()`, no hardcoded delays
4. **Test real flows** - Login → navigate → interact → verify
5. **Document tests** - Comentarios claros para cada escenario

## Adding New Tests

1. Crea nuevo describe block:
```typescript
test.describe('Nueva funcionalidad', () => {
  test('descripción clara', async ({ page }) => {
    // setup
    // act
    // assert
  });
});
```

2. Usa helpers para reutilizar lógica común
3. Sigue naming: `test-name.e2e.spec.ts`
4. Ejecuta localmente antes de commit
5. Update CI si nuevas dependencias

## GitHub Actions Integration

### PR Status Check
```
✅/❌ E2E Tests - Work Order Execution
```

Aparece en PR como status check bloqueante.

### Artifacts
- `playwright-report/` - Reporte HTML interactivo
- Disponible por 30 días
- Accesible desde Actions tab

### Comment on PR
Bot comenta con resumen:
- Suite ejecutada
- Tests pasados
- Link al reporte completo
