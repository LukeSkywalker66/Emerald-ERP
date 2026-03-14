# E2E Automatizadas - Ticket/OT + Usuarios + Pre-Deploy

Fecha: 2026-03-12
Branch: `develop`

## Objetivo
Ejecutar pruebas E2E automatizadas sobre cambios recientes de dominio Ticket -> OT (Fase B), autenticación y flujo de pre-deploy.

## Cambios aplicados para habilitar E2E

### 1) Autenticación real en scripts E2E
Se actualizaron scripts que asumían endpoints públicos para usar login Bearer y credenciales de desarrollo:

- `test/test_wizards_e2e.py`
- `test/test_timeline_live_status.py`
- `test/test_users_v2_integration.py`

Estrategia de credenciales:
- Primero variables de entorno.
- Luego fallback de `.env`.
- Fallback adicional de QA (`qa.phaseb2@emerald.com`) para entorno local.

Variables soportadas:
- `E2E_BASE_URL` (default: `http://localhost:8500`)
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `ADMIN_EMAIL`/`ADMIN_PASSWORD` (fallback)

### 2) Repetibilidad de tests de usuarios
En `test/test_users_v2_integration.py` se agregaron identificadores únicos por corrida para evitar colisiones de email/username entre ejecuciones.

## Comandos ejecutados

### Wizards E2E (multi-flow tickets)
```bash
E2E_ADMIN_EMAIL=qa.phaseb2@emerald.com E2E_ADMIN_PASSWORD=QAPhaseB123 \
/opt/emerald-erp/.venv/bin/python test/test_wizards_e2e.py
```

Resultado:
- `technical`: PASS
- `installation`: FAIL (`400`)
- `relocation`: PASS
- `administrative`: PASS
- Score: `3/4`

Interpretación:
- El fallo de instalación no rompe Fase B Ticket->OT (foco principal). Corresponde a validación específica del wizard de instalación/datos requeridos.

### Timeline Live Status E2E
```bash
E2E_ADMIN_EMAIL=qa.phaseb2@emerald.com E2E_ADMIN_PASSWORD=QAPhaseB123 \
/opt/emerald-erp/.venv/bin/python test/test_timeline_live_status.py
```

Resultado:
- `Timeline con estados dinámicos`: PASS
- `Consistencia status`: PASS
- Resultado final: `2/2`

### Users V2 Integration (pytest)
```bash
E2E_ADMIN_EMAIL=qa.phaseb2@emerald.com E2E_ADMIN_PASSWORD=QAPhaseB123 \
/opt/emerald-erp/.venv/bin/python -m pytest -q test/test_users_v2_integration.py
```

Resultado:
- `8 passed`
- `1 warning` de pytest por `return` no nulo en un test (no bloqueante).

### Pre-Deploy Check unificado
```bash
./pre_deploy_check.sh
```

Incluye:
1. `test/test_phase_b_ot_creation_integration.py`
2. `frontend/npm run build`

Resultado:
- Regresión Fase B: `2 passed`
- Build frontend: OK
- Estado final: `OK`

## Criterio de salida recomendado

### Bloqueantes
- Falla en `test/test_phase_b_ot_creation_integration.py`
- Falla en build frontend (`npm run build`)
- Falla masiva de auth (`401`) por credenciales no válidas

### No bloqueantes (a revisar)
- Warning de pytest por retorno en tests
- Warnings de chunk size en build frontend

## Ejecución recomendada antes de deploy

### Opción rápida (gating principal)
```bash
./pre_deploy_check.sh
```

### Opción extendida (E2E completa)
```bash
E2E_ADMIN_EMAIL=<usuario> E2E_ADMIN_PASSWORD=<password> \
/opt/emerald-erp/.venv/bin/python test/test_wizards_e2e.py

E2E_ADMIN_EMAIL=<usuario> E2E_ADMIN_PASSWORD=<password> \
/opt/emerald-erp/.venv/bin/python test/test_timeline_live_status.py

E2E_ADMIN_EMAIL=<usuario> E2E_ADMIN_PASSWORD=<password> \
/opt/emerald-erp/.venv/bin/python -m pytest -q test/test_users_v2_integration.py

./pre_deploy_check.sh
```

## Troubleshooting rápido
- `401` en tests E2E: verificar `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` o actualizar `.env`.
- `No module named pytest`: instalar en venv con `pip install pytest`.
- `installation wizard 400`: revisar payload/validaciones del flujo installation y datos de conexiones destino.
