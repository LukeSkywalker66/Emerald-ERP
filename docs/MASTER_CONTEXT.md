# Master Context - Emerald ERP

Version: 2026-06-24
Proposito: referencia central operativa, compacta y consistente para desarrollo diario.

---

## 1) Que es Emerald ERP

Plataforma integral para ISP con modulos de:
- Tickets y Work Orders
- Coordinacion y cuadrillas
- Flota y almacenes moviles
- Inventario y trazabilidad
- Ingenieria/NOC
- Integraciones (ISPCube, Mikrotik, SmartOLT)

Stack:
- Backend: Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic
- Frontend: React + Vite + Tailwind + Shadcn
- DB: PostgreSQL 15
- Infra: Docker Compose + Nginx

---

## 2) Estado actual consolidado

Q2 2026 cerrado con:
- Logistica/scanner productivo
- Inventario compuesto trazable con consumo fraccionado
- Cierre OT hardening (multi-rol)
- Versionado/entorno visible en frontend + endpoint backend de version

Estado modulo por modulo: estable.

Snapshot operativo vigente:
- docs/ESTADO_ACTUAL_2026_06_24.md

Snapshot historico:
- docs/ESTADO_ACTUAL_2026_06_02.md

---

## 3) Reglas arquitectonicas

1. No hacks fragiles.
2. Source of Truth en backend/DB.
3. Frontend no inventa datos de negocio.
4. Cambios de inventario/material deben dejar trazabilidad.
5. Mantener compatibilidad con Beholder legacy.

---

## 4) Estructura minima relevante

- backend/src/main.py
- backend/src/routers/
- backend/src/services/
- backend/src/models/
- backend/src/schemas/
- frontend/src/pages/
- frontend/src/components/
- frontend/src/hooks/
- docs/

---

## 5) Documentos canonicos (primera plana)

- docs/AI_ARCHITECT_CONTEXT.md
- docs/MASTER_CONTEXT.md
- docs/ROADMAP.md
- docs/BASE_DATOS.md
- docs/ESTADO_ACTUAL_2026_06_24.md

---

## 6) Legacy y detalle historico

Para reducir tokens y evitar drift en asistentes:
- Todo detalle historico extenso se consulta en docs/_legacy/
- Handoffs de sesiones previas quedan como evidencia historica, no como contexto principal.
- Decisiones antiguas no vigentes deben permanecer fuera de primera plana.
