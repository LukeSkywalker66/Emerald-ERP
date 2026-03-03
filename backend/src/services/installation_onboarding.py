from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from src.clients import ispcube
from src.db.postgres import Database


class InstallationSyncError(Exception):
    pass


class InstallationValidationError(Exception):
    pass


def _normalize_selected_connection(connection: Dict[str, Any], customer_id: Any) -> Dict[str, Any]:
    connection_id = connection.get("id") or connection.get("external_id")
    if not connection_id:
        raise InstallationValidationError("Conexión inválida: falta ID de conexión")

    return {
        "id": connection_id,
        "user": connection.get("user") or connection.get("pppoe_username") or "",
        "customer_id": connection.get("customer_id") or customer_id,
        "node_id": connection.get("node_id"),
        "plan_id": connection.get("plan_id"),
        "direccion": connection.get("direccion") or connection.get("address"),
        "status": connection.get("status") or connection.get("state"),
    }


def sync_installation_context(
    *,
    destination_connection_id: int,
    customer_dni: Optional[str],
    ispcube_customer: Optional[Dict[str, Any]],
    ispcube_connections: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    """
    Sincroniza cliente + conexión de instalación usando la misma lógica base del nightly sync.

    Reglas:
    - Si viene payload del wizard, se usa como fuente primaria.
    - Si no viene payload completo, consulta ISPCube por DNI.
    - Siempre sincroniza SOLO la conexión seleccionada por el operador.
    
    Retorna dict con:
    - customer_id, connection_id: IDs sincronizados
    - timeline_event: Dict para evento de timeline (humanizado + auditoría técnica)
    """
    customer_payload: Optional[Dict[str, Any]] = ispcube_customer
    connections_payload: List[Dict[str, Any]] = list(ispcube_connections or [])
    lookup_source = "wizard_payload"

    if not customer_payload:
        dni_clean = (customer_dni or "").strip()
        if not dni_clean:
            raise InstallationValidationError(
                "Para instalación se requiere customer_dni o payload ISPCube del wizard"
            )

        pack = ispcube.obtener_cliente_por_dni(dni_clean)
        if not pack or not pack.get("customer"):
            raise InstallationValidationError("Cliente no encontrado en ISPCube para el DNI indicado")

        customer_payload = pack.get("customer")
        connections_payload = list(pack.get("connections") or [])
        lookup_source = "dni_lookup"

    customer_id = customer_payload.get("id") or customer_payload.get("external_id")
    if not customer_id:
        raise InstallationValidationError("Payload de cliente inválido: falta id")

    selected_connection = next(
        (
            conn
            for conn in connections_payload
            if str(conn.get("id") or conn.get("external_id")) == str(destination_connection_id)
        ),
        None,
    )

    if not selected_connection:
        raise InstallationValidationError(
            "La conexión seleccionada no coincide con el resultado confirmado desde ISPCube"
        )

    normalized_connection = _normalize_selected_connection(selected_connection, customer_id)

    db_sync = Database()
    try:
        db_sync.sync_cliente_instalacion(
            customer_data=customer_payload,
            connections_data=[normalized_connection],
        )
    except Exception as exc:
        raise InstallationSyncError(f"No se pudo sincronizar cliente/conexión de instalación: {exc}") from exc
    finally:
        db_sync.close()

    # Construir mensaje humanizado para timeline (sin detalles técnicos para el usuario)
    client_name = customer_payload.get("name", "Cliente")
    direction = normalized_connection.get("direccion", "ubicación sin especificar")
    
    timeline_content = f"✅ Instalación: cliente confirmado desde ISPCube ({client_name}, {direction})"

    return {
        "customer_id": customer_id,
        "connection_id": normalized_connection.get("id"),
        "timeline_event": {
            "content": timeline_content,
            "meta_data": {
                "installation_lookup": lookup_source,
                "customer_id": customer_id,
                "customer_dni": customer_payload.get("doc_number"),
                "customer_name": client_name,
                "connection_id": normalized_connection.get("id"),
                "connection_direction": direction,
                "pppoe_username": normalized_connection.get("user"),
                "ispcube_confirmed": True,
                "sync_timestamp": datetime.utcnow().isoformat(),
            },
        },
    }
