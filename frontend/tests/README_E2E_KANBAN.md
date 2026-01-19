# Documentación: Pruebas E2E Kanban de Ingeniería (Playwright)

## Resumen
Este documento describe el flujo de pruebas E2E para el tablero Kanban de Ingeniería en Emerald ERP, incluyendo:
- Login automático con credenciales admin de testing
- Sectorización de helpers y tests
- Recomendaciones para QA y desarrollo seguro

---

## Estructura de Archivos

- `/frontend/tests/kanban.e2e.spec.ts`: Tests E2E principales del Kanban
- `/frontend/tests/helpers/login.ts`: Helper reutilizable para login automático

## Flujo de Prueba
1. **Login Automático**: Antes de cada test, se ejecuta el helper `login()` con las credenciales admin de testing (`admin@emerald.com` / `Admin@123`).
2. **Navegación**: Los tests asumen sesión iniciada y navegan directo a `/app/engineering`.
3. **Verificaciones**: Se validan columnas principales y operaciones de drag & drop.

## Recomendaciones y Buenas Prácticas
- **No subir helpers ni datos de test a producción**: Mantener `/tests/helpers` y credenciales de testing fuera de builds productivos.
- **Sectorizar helpers y tests**: No mezclar lógica de test con código de negocio.
- **Revisar entorno antes de correr E2E**: Confirmar que el entorno es de desarrollo y que los datos de testing no afectan producción.
- **Actualizar credenciales de testing periódicamente**: Para evitar leaks o accesos no deseados.

## Ejecución de Pruebas

```bash
# Desde /frontend
npx playwright test tests/kanban.e2e.spec.ts --reporter=list
```

## Troubleshooting
- Si falla el login, revisar credenciales y que el backend esté corriendo.
- Si el drag & drop falla, revisar el DOM y los selectores de las tareas/columnas.
- Si aparecen datos sensibles en los logs, pausar y revisar sectorización.

---

**Emerald ERP QA / Enero 2026**
