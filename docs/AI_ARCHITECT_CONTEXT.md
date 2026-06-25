# AI Architect Context - Emerald ERP

Version: 2026-06-24
Audiencia: IAs, LLMs, agentes de codificacion
Proposito: contexto operativo vigente para decisiones de arquitectura sin ruido historico.

---

## 1) Estado vigente (Q2 cerrado)

Emerald ERP opera estable en los modulos core:
- Backend FastAPI + SQLAlchemy 2.0 + PostgreSQL 15
- Frontend React + Vite + Tailwind
- Inventario trazable con consumo fraccionado auditable
- Logistica de entregas/recepciones con scanner y override controlado
- Cierre OT multi-rol robustecido

Release activa:
- Frontend/Backend: 1.0.0-rc.1
- Endpoint sistema: GET /api/v2/system/version (autenticado)

---

## 2) Cambios arquitectonicos consolidados (junio 2026)

### 2.1 Logistica y scanner
- Escaneo por barcode/serial en entregas.
- Regla operativa: fuera de propuesta aceptada responde 409 OUTSIDE_ACCEPTED_PROPOSAL.
- Frontend permite confirmacion explicita y retry con override.

### 2.2 Inventario compuesto trazable
- Unidades compuestas trazables usan serial propio.
- Saldo fraccionable por unidad base:
  - initial_quantity
  - remaining_quantity
- Cierre OT registra:
  - consumption_logs (before/after)
  - stock_movements (CONSUMPTION)

### 2.3 Cierre OT desde coordinacion
- El wizard compartido resuelve warehouse por team_id cuando el operador no tiene deposito propio.
- Se evita bloqueo en cierres forzados y se mantiene trazabilidad.

### 2.4 Release hygiene
- Version frontend inyectada desde package.json.
- Favicon por entorno (development/staging/production).

---

## 3) Principios no negociables

1. Robustez sobre rapidez: no hacks ad-hoc.
2. Source of Truth:
- ISPCube para clientes/facturacion.
- Emerald para operaciones/logistica/inventario fisico.
3. Sincronizacion: priorizar nightly sync sobre inferencias en frontend.
4. Backend manda: reglas criticas de negocio siempre server-side.
5. Trazabilidad: todo consumo/material debe ser auditable.

---

## 4) Reglas tecnicas activas

Backend:
- SQLAlchemy 2.0: Mapped[] + mapped_column().
- Datos flexibles: JSONB.
- Tickets por eventos (ticket_events), no comentarios planos.
- Beholder legacy en backend/src/db/postgres.py no se toca sin permiso.

Frontend:
- UI tactica Emerald (alta densidad informativa, estados claros).
- No inferir reglas criticas ni completar datos faltantes en cliente.

---

## 5) Contratos y rutas clave

- OT: /api/v2/work-orders
- Inventario/Warehouses: /api/v2/warehouses
- Logistica: /api/v2/logistics
- Tracked units labels: /api/v2/tracked-units/labels
- System version: /api/v2/system/version

---

## 6) Contexto historico y legacy

Para evitar sobrecarga de contexto, el detalle historico (Q1, decisiones antiguas, diagramas extensos, handoffs) se mantiene fuera de primera plana en:
- docs/_legacy/
- docs/HANDOFF_*.md
- docs/ESTADO_ACTUAL_2026_06_02.md (snapshot historico)

Snapshot vigente:
- docs/ESTADO_ACTUAL_2026_06_24.md
