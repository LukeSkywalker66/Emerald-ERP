# ADR-0001: Reapertura de tickets cerrados y rollback de instalaciones

- **Estado:** Aceptado
- **Fecha:** 2026-09-30
- **Módulos:** Tickets (v2), Instalación (alta de servicio)
- **Decisor:** Equipo Emerald

---

## Contexto

Dos fricciones operativas detectadas en producción:

1. **No hay forma de reabrir un ticket cerrado por error.** El backend ya permite
   cambiar el estado vía `PATCH /api/v2/tickets/{id}` con `{"status":"open"}`
   (escribe timeline y auditoría), pero la UI no expone ningún botón "Reabrir".
   Los operadores, que son quienes cierran por error, no pueden corregirlo sin
   ayuda de administración o manipulación directa de la BD.

2. **El rollback de tickets de instalación es demasiado conservador.** Al
   cerrar/cancelar un ticket de instalación, el servicio
   [`rollback_installation_sync`](../backend/src/services/installation_rollback.py)
   solo se ejecuta si **ninguna** OT alcanzó estado terminal. Pero la función
   [`has_executed_work_orders`](../backend/src/services/installation_rollback.py:20)
   considera terminal tanto `completed` como `failed`. Resultado: una OT marcada
   como `failed` (aunque sea por cancelación administrativa, sin visita) impide
   el rollback y deja la conexión "ocupada" en Emerald, impidiendo crear un
   nuevo alta que la recicle.

---

## Decisión 1 — Botón "Reabrir ticket" en la UI

**Se decide** agregar un botón "Reabrir" en el detalle del ticket
(`TicketDetailPage`) visible para tickets en estado `closed` o `cancelled`.

- **Acción:** `PATCH /api/v2/tickets/{id}` con `{"status":"open"}`. El backend
  ya registra timeline ("Estado cambiado de … a …") y auditoría.
- **Permisos:** pueden reabrir tanto **operadores** como **admin** (no solo
  admin). Los operadores son los que cometen el error de cierre y restringirlo a
  admin solo agrega fricción; el endpoint actual (`get_user_id`, sin
  `require_admin`) ya lo permite.
- **OTs asociadas:** al reabrir **no** se reabre ni regenera ninguna OT
  automáticamente. Se ofrece la acción existente "Crear OT" para el caso en que
  se necesite una nueva (la OT anterior en `failed` queda como registro
  inmutable).

---

## Decisión 2 — Rollback de instalación cuando NO hay OT completada

**Se decide** ajustar la condición de rollback: el rollback debe aplicarse si
**no existe ninguna OT `completed`**, en lugar de "ninguna OT `completed` o
`failed`".

Concretamente, `has_executed_work_orders` (o su reemplazo) debe retornar `True`
únicamente ante OTs `completed`:

```python
# ANTES
TERMINAL_WO_STATUSES = {"completed", "failed"}

# DESPUÉS
# Solo una OT COMPLETADA impide el rollback. Una OT `failed` no implica
# visita efectiva del técnico y no debe bloquear el reciclado de la conexión.
COMPLETED_WO_STATUSES = {"completed"}
```

Con esto, cerrar/cancelar un alta con OTs `failed` ejecuta el rollback y recicla
la conexión sincronizada, permitiendo que un nuevo ticket de instalación la
tome como "nueva".

### Consideración / riesgo a mitigar

Una OT `failed` **puede** significar que el técnico sí visitó el sitio (ej.
"cliente sin lugar en NAP"). En ese caso, borrar la conexión/cliente sería
incorrecto. Mitigación propuesta: antes de ejecutar el rollback, evaluar la
`resolution_category` de la OT:

- `resolution_category == "incomplete"` y motivo administrativo (sin visita) →
  rollback.
- Si hubo visita efectiva → conservar la conexión y forzar el flujo de
  **reabrir ticket** (Decisión 1) en lugar de alta nueva.

Esta distinción fina puede implementarse como refuerzo en la misma iteración o
en una posterior, según prioridad.

---

## Consecuencias

**Positivas**
- Los operadores corrigen errores de cierre sin intervención de admin ni SQL.
- Las altas canceladas sin ejecución real liberan la conexión y no generan
  "fantasmas" que bloqueen nuevas instalaciones.
- Trazabilidad: toda reapertura y todo rollback quedan registrados en
  `ticket_timeline` y `audit_logs`.

**Negativas / a vigilar**
- Reabrir tickets indiscriminadamente puede reactivar casos que debían quedar
  cerrados; mitigable con confirmación explícita en UI.
- El rollback agresivo (sin distinguir "falló en sitio") puede borrar datos de
  un cliente real; mitigable con la distinción por `resolution_category`.

---

## Alternativas consideradas

- **Reabrir solo admin:** descartada por fricción operativa; el error lo cometen
  operadores.
- **No tocar el rollback y solo reabrir tickets:** insuficiente; deja el caso de
  altas canceladas sin poder reciclar la conexión.
- **Eliminar el rollback por completo:** descartada; es la única vía para
  reciclar `connection_id` de altas fallidas.
