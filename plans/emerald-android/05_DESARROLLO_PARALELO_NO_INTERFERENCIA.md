# 05 — Desarrollo Paralelo sin Interferencia (Expansión Opcional)

La app Android es una **expansión opcional** de Emerald. Debe desarrollarse en paralelo sin alterar jamás el funcionamiento normal de la web ni del backend original.

## 1. Principios rectores

1. **Solo aditivo:** endpoints, tablas, columnas y routers nuevos. Nunca modificar comportamiento existente.
2. **Compatibilidad hacia atrás:** las respuestas actuales de la API quedan intactas; la web consume exactamente lo mismo.
3. **Detrás de feature flags:** todo lo del móvil se activa/desactiva por configuración/env sin tocar la web.
4. **No bloqueante:** FCM, sync y telemetría son best-effort (Celery o fire-and-forget); un fallo de push nunca debe afectar asignación o cierre.
5. **Repos separados:** la app vive en su repo; los cambios de backend entran al repo de Emerald solo con tests verdes.

## 2. Reglas para el backend de Emerald

- Crear **routers/archivos nuevos** (ej. `devices.py`, `notifications.py`) registrados de forma aditiva en [`main.py`](backend/src/main.py:82), sin reescribir routers existentes.
- **Migraciones Alembic solo aditivas y reversibles** (tablas `user_devices`, `technician_locations`; índices nuevos). Cero DDL destructivo.
- **No alterar schemas existentes.** Si hace falta un campo, agregarlo como `Optional` con default; nunca cambiar tipos ni quitar campos.
- **No tocar enums en uso** por la web; cualquier estado nuevo debe ser aditivo y no romper el mapeo actual.
- **Envío de FCM envuelto en `try/except`** y encolado; el flujo principal (crear/asignar/completar OT) no puede fallar por el push.

## 3. Reglas para la base de datos

- Tablas nuevas: `user_devices`, `technician_locations` (opcional).
- Índices aditivos permitidos sobre tablas existentes.
- Prohibido renombrar/eliminar columnas o tablas que usa la web.

## 4. Verificación de no regresión

- Correr la suite actual del backend y los E2E de Playwright ([`frontend/tests`](frontend/tests/)) **antes** de mergear cualquier cambio de backend relacionado al móvil.
- Endpoints nuevos con tests propios.
- En staging, desplegar los cambios detrás del feature flag, verificar que la web sigue igual y recién después habilitar para el móvil.

## 5. Rollback y degradación elegante

- Migraciones reversibles; apagar el feature flag desactiva el móvil sin afectar la web.
- Si FCM no está disponible, la app cae a **polling con WorkManager** (push es mejora, no dependencia).
- La app nunca requiere que la web cambie; la web nunca requiere que la app exista.

## 6. Feature flags sugeridos (settings/env)

- `MOBILE_SYNC_ENABLED`
- `MOBILE_FCM_ENABLED`
- `MOBILE_PRESIGNED_UPLOADS_ENABLED`
- `MOBILE_LOCATION_TRACKING_ENABLED`

## 7. Criterio de aceptación final

- Con todos los flags del móvil apagados, Emerald se comporta byte a byte como hoy.
- La app puede quedar sin publicar o desactivarse sin ningún impacto en producción.
