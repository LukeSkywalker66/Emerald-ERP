from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from sqlalchemy.orm import Session

from src import models
from src.clients import ispcube
from src.services.location_resolver import (
    get_or_create_city,
    get_or_create_neighborhood,
    resolve_address_data,
)


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


def _sync_installation_to_session(
    db: Session,
    customer_data: Dict[str, Any],
    connections_data: List[Dict[str, Any]],
) -> None:
    """Sincroniza cliente + conexiones en la MISMA sesión transaccional del ticket.

    NO hace commit: la transacción la cierra el caller. Así, si la creación del
    ticket falla, ni el cliente ni la conexión quedan persistidos y un segundo
    intento no encuentra la conexión ya "existente" en Emerald.
    """
    from src.jobs.sync import mapear_cliente

    customer_id = customer_data.get("id")
    if not customer_id:
        raise InstallationValidationError("Payload de cliente inválido: falta id")

    # 1) Cliente
    mapped_cliente = mapear_cliente(customer_data)
    existing_cliente = db.query(models.Cliente).filter_by(id=customer_id).first()
    if existing_cliente:
        for key, value in mapped_cliente.items():
            if hasattr(existing_cliente, key):
                setattr(existing_cliente, key, value)
    else:
        db.merge(
            models.Cliente(
                id=mapped_cliente.get("id"),
                code=mapped_cliente.get("code"),
                name=mapped_cliente.get("name"),
                doc_number=mapped_cliente.get("doc_number"),
                address=mapped_cliente.get("address"),
                status=mapped_cliente.get("status"),
                raw_data=customer_data,
            )
        )

    # 2) Contactos (emails + teléfonos)
    for email_obj in customer_data.get("contact_emails") or []:
        if email_obj.get("email"):
            db.add(models.ClienteEmail(customer_id=customer_id, email=email_obj.get("email")))
    for tel_obj in customer_data.get("phones") or []:
        if tel_obj.get("number"):
            db.add(models.ClienteTelefono(customer_id=customer_id, number=tel_obj.get("number")))

    # 3) Conexiones
    for conn in connections_data:
        if not conn.get("id"):
            continue

        resolved = resolve_address_data({"connection": conn, "client": customer_data})
        city = get_or_create_city(db, resolved.get("city_name"))
        neighborhood = get_or_create_neighborhood(
            db, resolved.get("neighborhood_name"), city.id if city else None
        )

        conn_id = conn.get("id")
        # Coordenadas: vienen del cliente ISPCube (top-level lat/lng) o de la conexión.
        lat = (
            conn.get("lat") or conn.get("latitude")
            or customer_data.get("lat") or customer_data.get("latitude")
        )
        lng = (
            conn.get("lng") or conn.get("longitude")
            or customer_data.get("lng") or customer_data.get("longitude")
        )

        existing_conn = db.query(models.Connection).filter_by(connection_id=conn_id).first()
        if existing_conn:
            existing_conn.pppoe_username = str(conn.get("user") or "")
            existing_conn.customer_id = customer_id
            existing_conn.node_id = conn.get("node_id")
            existing_conn.plan_id = conn.get("plan_id")
            existing_conn.direccion = conn.get("direccion") or conn.get("address")
            existing_conn.city_id = city.id if city else None
            existing_conn.neighborhood_id = neighborhood.id if neighborhood else None
            if lat is not None:
                existing_conn.latitude = lat
            if lng is not None:
                existing_conn.longitude = lng
        else:
            db.add(
                models.Connection(
                    connection_id=conn_id,
                    pppoe_username=str(conn.get("user") or ""),
                    customer_id=customer_id,
                    node_id=conn.get("node_id"),
                    plan_id=conn.get("plan_id"),
                    direccion=conn.get("direccion") or conn.get("address"),
                    city_id=city.id if city else None,
                    neighborhood_id=neighborhood.id if neighborhood else None,
                    latitude=lat,
                    longitude=lng,
                )
            )

    db.flush()


def sync_installation_context(
    *,
    db: Session,
    destination_connection_id: int,
    customer_dni: Optional[str],
    ispcube_customer: Optional[Dict[str, Any]],
    ispcube_connections: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    """Sincroniza cliente + conexión de instalación en la sesión transaccional del ticket.

    Reglas:
    - Si viene payload del wizard, se usa como fuente primaria.
    - Si no viene payload completo, consulta ISPCube por DNI.
    - Siempre sincroniza SOLO la conexión seleccionada por el operador.
    - Opera sobre `db` (sin commit propio) para que cliente/conexión/ticket sean atómicos.

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

    try:
        _sync_installation_to_session(
            db,
            customer_data=customer_payload,
            connections_data=[normalized_connection],
        )
    except InstallationValidationError:
        raise
    except Exception as exc:
        db.rollback()
        raise InstallationSyncError(
            f"No se pudo sincronizar cliente/conexión de instalación: {exc}"
        ) from exc

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
