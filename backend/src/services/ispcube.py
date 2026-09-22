from typing import Optional, Dict, Any

from src.clients import ispcube as isp_client
from src.config import logger


def get_customer_by_dni(dni: str) -> Optional[Dict[str, Any]]:
    """Consulta ISPCube por DNI y retorna cliente + conexiones sin tocar la base local."""
    dni_clean = (dni or "").strip()
    if len(dni_clean) < 3:
        return None

    try:
        # Buscar cliente por DNI
        customer_resp = isp_client._request(
            "GET",
            f"{isp_client.ISPCUBE_BASEURL}/customer",
            params={"doc_number": dni_clean},
        )
        customer_data = customer_resp.json() if customer_resp is not None else None
        if not customer_data or not isinstance(customer_data, dict):
            return None

        customer_id = customer_data.get("id")
        if not customer_id:
            return None

        # ISPCube devuelve `connections` desactualizadas al buscar por doc_number:
        # no incluye conexiones recién creadas. El lookup por customer_id devuelve la
        # lista completa y fresca, así que lo usamos como fuente para las conexiones.
        connections = customer_data.get("connections") or []
        try:
            fresh_pack = isp_client.obtener_cliente_por_id(customer_id)
            if fresh_pack and fresh_pack.get("customer"):
                fresh_customer = fresh_pack["customer"]
                fresh_connections = fresh_customer.get("connections")
                if isinstance(fresh_connections, list):
                    customer_data = fresh_customer
                    connections = fresh_connections
        except Exception as fresh_exc:
            logger.warning(
                f"No se pudo refrescar conexiones del cliente {customer_id} desde ISPCube: {fresh_exc}"
            )

        return {"customer": customer_data, "connections": connections}
    except Exception as exc:
        logger.error(f"Error consultando cliente en ISPCube por DNI {dni_clean}: {exc}")
        return None
