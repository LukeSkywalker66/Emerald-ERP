# Plan: Schedule Configurator — Reemplazar cron raw por UI visual

## 1. Problema

Actualmente la UI de tareas programadas expone una expresión cron cruda (`0 3 * * *`) que:
- No es amigable para un administrador
- No permite configurar fácilmente múltiples ejecuciones por día
- Requiere conocer sintaxis cron

## 2. Aclaración técnica

Celery Beat NO usa cron de Linux. Su [`crontab()`](backend/src/celery_app.py:161-167) acepta el mismo formato de 5 campos como parte de su API nativa:
```python
crontab(minute='0', hour='3')  # equivalente a crontab(expression='0 3 * * *')
```
El problema es solo de UX, no de compatibilidad.

## 3. Solución propuesta

Agregar campo `schedule_config` (JSON) al modelo `ScheduledTask` y construir una UI visual que traduzca internamente a cron para Celery.

### 3.1 Tipos de schedule

| Tipo | UI | schedule_config | Cron generado |
|------|-----|-----------------|---------------|
| `interval_minutes` | Cada N minutos | `{"type":"interval_minutes","value":30}` | `*/30 * * * *` |
| `interval_hours` | Cada N horas | `{"type":"interval_hours","value":2}` | `0 */2 * * *` |
| `daily` | Diario a las HH:MM | `{"type":"daily","times":["03:00"]}` | `0 3 * * *` |
| `daily_multi` | Diario a las 08:00 y 20:00 | `{"type":"daily","times":["08:00","20:00"]}` | `0 8,20 * * *` |
| `weekly` | Lun/Mie/Vie a las 14:30 | `{"type":"weekly","days":[1,3,5],"time":"14:30"}` | `30 14 * * 1,3,5` |
| `custom_cron` | Avanzado: cron directo | `{"type":"custom_cron","expression":"0 3 * * *"}` | `0 3 * * *` |

### 3.2 Backend

#### Nuevo archivo: `backend/src/utils/schedule_parser.py`

Tres funciones:
- `schedule_config_to_cron(config: dict) -> str` — Traduce schedule_config → expresión cron de 5 campos
- `cron_to_schedule_config(cron: str) -> dict` — Traduce cron existente → schedule_config (best-guess, para backfill)
- `cron_to_human_readable(cron: str) -> str` — Genera descripción legible tipo "Diario a las 3:00 AM"

```python
def schedule_config_to_cron(config: dict) -> str:
    t = config["type"]
    if t == "interval_minutes":
        return f"*/{config['value']} * * * *"
    elif t == "interval_hours":
        return f"0 */{config['value']} * * *"
    elif t == "daily":
        times = config["times"]  # ["03:00"] o ["08:00","20:00"]
        hours = ",".join(t.split(":")[0] for t in times)
        minutes = times[0].split(":")[1]
        return f"{minutes} {hours} * * *"
    elif t == "weekly":
        days = ",".join(str(d) for d in config["days"])
        hour, minute = config["time"].split(":")
        return f"{minute} {hour} * * {days}"
    elif t == "custom_cron":
        return config["expression"]
    raise ValueError(f"Tipo de schedule desconocido: {t}")
```

#### Modelo: `backend/src/models/scheduled_task.py`

Agregar columna:
```python
schedule_config: Optional[dict] = Column(
    JSON, nullable=True,
    comment="Configuración estructurada del schedule (tipo, intervalo, horarios, días)"
)
```

#### Schema: `backend/src/schemas/scheduled_task.py`

Agregar `schedule_config: Optional[dict]` a `ScheduledTaskResponse` y `ScheduledTaskUpdate`.

#### Servicio: `backend/src/services/scheduled_task_service.py`

En `update_config()`: si se provee `schedule_config`, auto-computar `cron_expression` usando `schedule_config_to_cron()`.

#### Migración Alembic (nueva)

1. Agregar columna `schedule_config` (JSON)
2. Backfill: para cada tarea con `cron_expression` no nulo, generar `schedule_config` y guardarlo

### 3.3 Frontend

#### Nuevo archivo: `frontend/src/components/settings/ScheduleConfigurator.jsx`

Componente React puro que recibe `value` (schedule_config) y `onChange`.

**Estados del componente:**

```
┌─────────────────────────────────────────────┐
│  Frecuencia: [Cada N minutos ▼]             │
│                                             │
│  ┌──┐                                       │
│  │30│ minutos                               │
│  └──┘                                       │
│                                             │
│  Vista previa: Cada 30 minutos              │
└─────────────────────────────────────────────┘
```

Para cada tipo de schedule, renderiza controles específicos:

- **interval_minutes/interval_hours**: NumberInput (1-999) + unit selector
- **daily/daily_multi**: TimePicker con botón "+" para agregar múltiples horarios y "×" para eliminar
- **weekly**: Checkbox grid para días (Lun-Sab) + TimePicker
- **custom_cron**: Input raw cron (colapsado por defecto, con label "Avanzado")

Siempre muestra un preview legible abajo, ej:
- "Cada 30 minutos"
- "Diario a las 3:00 AM"
- "Diario a las 8:00 AM y 8:00 PM"
- "Lunes, Miércoles y Viernes a las 2:30 PM"
- "Expresión personalizada: 0 3 * * *"

#### Modificar: `frontend/src/pages/settings/ScheduledTasksTab.jsx`

- En el edit panel (líneas 539-553), reemplazar el Input de cron por `<ScheduleConfigurator>`
- En la lista de tareas (línea 428), mostrar descripción legible en vez de cron expression
- El `handleSave` debe enviar `schedule_config` en lugar de/incluyendo `cron_expression`

## 4. Archivos a modificar/crear

### Nuevos
- `backend/src/utils/schedule_parser.py`
- `frontend/src/components/settings/ScheduleConfigurator.jsx`

### Modificar
- `backend/src/models/scheduled_task.py`
- `backend/src/schemas/scheduled_task.py`
- `backend/src/services/scheduled_task_service.py`
- `backend/alembic/env.py`
- Nueva migración Alembic
- `frontend/src/pages/settings/ScheduledTasksTab.jsx`

### Sin cambios
- `celery_app.py` — Sigue leyendo `cron_expression`
- `backend/src/routers/settings.py` — No necesita cambios (serializa el JSON automáticamente)

## 5. Orden de implementación

1. Crear `schedule_parser.py` con las 3 funciones de traducción
2. Agregar columna `schedule_config` al modelo + migración con backfill
3. Agregar `schedule_config` a schemas y service
4. Crear `ScheduleConfigurator.jsx` frontend
5. Integrar en `ScheduledTasksTab.jsx`
6. Verificar: UI muestra schedule config, guarda correctamente, Celery Beat recibe cron correcto
