"""Regresion Fase B: unificacion Ticket -> OT con semantica estricta.

Este test valida en API real que:
1) Ambos endpoints de creacion de OT usan el mismo contrato de dominio.
2) work_order.notes persiste la instruccion operativa.
3) ticket.description queda como contexto historico independiente.

Credenciales:
- Primero lee variables de entorno.
- Si no estan, intenta leer .env del repo (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD).
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import pytest
import requests


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE_URL = "http://localhost:8500"


def _load_dotenv_fallback() -> dict[str, str]:
    env_path = REPO_ROOT / ".env"
    data: dict[str, str] = {}

    if not env_path.exists():
        return data

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        data[key] = value

    return data


def _cfg(key: str, fallback: dict[str, str], default: str | None = None) -> str | None:
    return os.getenv(key) or fallback.get(key) or default


@pytest.fixture(scope="module")
def cfg() -> dict[str, str]:
    fallback = _load_dotenv_fallback()

    base_url = _cfg("E2E_BASE_URL", fallback, DEFAULT_BASE_URL)
    email = _cfg("E2E_ADMIN_EMAIL", fallback, "superadmin@emerald.com")
    password = _cfg("E2E_ADMIN_PASSWORD", fallback, "SuperAdmin123!")

    assert base_url, "BASE URL vacia"
    assert email, "Credencial E2E_ADMIN_EMAIL no definida"
    assert password, "Credencial E2E_ADMIN_PASSWORD no definida"

    return {
        "base_url": base_url.rstrip("/"),
        "email": email,
        "password": password,
    }


@pytest.fixture(scope="module")
def auth_headers(cfg: dict[str, str]) -> dict[str, str]:
    fallback = _load_dotenv_fallback()
    candidates = [
        (cfg["email"], cfg["password"]),
        (_cfg("ADMIN_EMAIL", fallback, None), _cfg("ADMIN_PASSWORD", fallback, None)),
        (_cfg("E2E_OPERATOR_EMAIL", fallback, None), _cfg("E2E_OPERATOR_PASSWORD", fallback, None)),
        ("superadmin@emerald.com", "SuperAdmin123!"),
        ("qa.phaseb2@emerald.com", "QAPhaseB123"),
    ]

    for user, password in candidates:
        if not user or not password:
            continue

        response = requests.post(
            f"{cfg['base_url']}/api/v1/auth/login",
            data={"username": user, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=20,
        )
        if response.status_code == 200:
            access_token = response.json().get("access_token")
            assert access_token, "Respuesta de login sin access_token"
            return {"Authorization": f"Bearer {access_token}"}

    pytest.skip(
        "No fue posible autenticar para tests de Fase B. "
        "Configura credenciales validas en E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD."
    )


@pytest.fixture(scope="module")
def phase_b_created_entities(cfg: dict[str, str], auth_headers: dict[str, str]) -> dict[str, object]:
    base = cfg["base_url"]

    search = requests.get(
        f"{base}/api/v2/tickets/search-connections",
        params={"query": "test", "limit": 1},
        headers=auth_headers,
        timeout=20,
    )
    assert search.status_code == 200, f"search-connections fallo: {search.status_code} {search.text}"

    connections = search.json()
    if not connections:
        fallback_search = requests.get(
            f"{base}/api/v2/tickets/search-connections",
            params={"query": "", "limit": 20},
            headers=auth_headers,
            timeout=20,
        )
        assert fallback_search.status_code == 200, (
            f"search-connections fallback fallo: {fallback_search.status_code} {fallback_search.text}"
        )
        connections = fallback_search.json()

    assert connections, "No hay conexiones para ejecutar regression de Ticket -> OT"
    connection_id = connections[0]["connection_id"]

    suffix = int(time.time())
    ticket_context = f"Contexto historico cliente Fase B ({suffix})"

    ticket_payload = {
        "ticket_type": "technical",
        "subject": f"[QA Fase B] Ticket de regresion {suffix}",
        "description": ticket_context,
        "priority": "medium",
        "connection_id": connection_id,
    }

    ticket_resp = requests.post(
        f"{base}/api/v2/tickets",
        json=ticket_payload,
        headers=auth_headers,
        timeout=25,
    )
    assert ticket_resp.status_code == 201, f"Creacion ticket fallo: {ticket_resp.status_code} {ticket_resp.text}"
    ticket_id = ticket_resp.json()["id"]

    wo_instruction_a = "Revisar ONU y medir potencia en domicilio"
    wo_payload_a = {
        "ticket_id": ticket_id,
        "ot_type": "repair",
        "priority": "high",
        "operational_instruction": wo_instruction_a,
        "description": wo_instruction_a,
    }

    wo_resp_a = requests.post(
        f"{base}/api/v2/work-orders",
        json=wo_payload_a,
        headers=auth_headers,
        timeout=25,
    )
    assert wo_resp_a.status_code == 201, f"Creacion OT por /work-orders fallo: {wo_resp_a.status_code} {wo_resp_a.text}"

    wo_instruction_b = "Escalar a cuadrilla infra por microcortes recurrentes"
    wo_payload_b = {
        "ticket_id": ticket_id,
        "ot_type": "infrastructure",
        "priority": "critical",
        "operational_instruction": wo_instruction_b,
        "description": wo_instruction_b,
    }

    wo_resp_b = requests.post(
        f"{base}/api/v2/tickets/{ticket_id}/work-orders",
        json=wo_payload_b,
        headers=auth_headers,
        timeout=25,
    )
    assert wo_resp_b.status_code == 201, (
        "Creacion OT por /tickets/{id}/work-orders fallo: "
        f"{wo_resp_b.status_code} {wo_resp_b.text}"
    )

    wo_a = wo_resp_a.json()
    wo_b = wo_resp_b.json()

    return {
        "ticket_id": ticket_id,
        "ticket_context": ticket_context,
        "wo_a_id": wo_a["id"],
        "wo_b_id": wo_b["id"],
        "wo_instruction_a": wo_instruction_a,
        "wo_instruction_b": wo_instruction_b,
    }


def test_phase_b_notes_are_operational_instruction(
    cfg: dict[str, str],
    auth_headers: dict[str, str],
    phase_b_created_entities: dict[str, object],
):
    base = cfg["base_url"]

    wo_a_id = phase_b_created_entities["wo_a_id"]
    wo_b_id = phase_b_created_entities["wo_b_id"]

    detail_a = requests.get(f"{base}/api/v2/work-orders/{wo_a_id}", headers=auth_headers, timeout=20)
    detail_b = requests.get(f"{base}/api/v2/work-orders/{wo_b_id}", headers=auth_headers, timeout=20)

    assert detail_a.status_code == 200, f"Detalle OT A fallo: {detail_a.status_code} {detail_a.text}"
    assert detail_b.status_code == 200, f"Detalle OT B fallo: {detail_b.status_code} {detail_b.text}"

    data_a = detail_a.json()
    data_b = detail_b.json()

    assert data_a.get("notes") == phase_b_created_entities["wo_instruction_a"]
    assert data_b.get("notes") == phase_b_created_entities["wo_instruction_b"]

    assert data_a.get("status") == "pending_planning"
    assert data_b.get("status") == "pending_planning"


def test_phase_b_ticket_description_remains_context(
    cfg: dict[str, str],
    auth_headers: dict[str, str],
    phase_b_created_entities: dict[str, object],
):
    base = cfg["base_url"]
    ticket_id = phase_b_created_entities["ticket_id"]

    ticket_detail = requests.get(f"{base}/api/v2/tickets/{ticket_id}", headers=auth_headers, timeout=20)
    assert ticket_detail.status_code == 200, (
        f"Detalle ticket fallo: {ticket_detail.status_code} {ticket_detail.text}"
    )

    payload = ticket_detail.json()
    assert payload.get("description") == phase_b_created_entities["ticket_context"]

    ot_events = [
        event for event in payload.get("timeline", [])
        if event.get("event_type") == "ot_event"
    ]
    assert ot_events, "No se registraron eventos OT en timeline"

    # Debe existir metadata de instruccion operativa en al menos un evento de OT
    assert any(
        (event.get("meta_data") or {}).get("operational_instruction")
        for event in ot_events
    ), "Timeline de OT sin operational_instruction en meta_data"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v", "--tb=short"]))
