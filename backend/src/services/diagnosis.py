from src.db.postgres import Database
from src.clients import mikrotik, smartolt
from src import config
from src.config import logger

def consultar_diagnostico(pppoe_user: str, ip: str = None) -> dict:
    """
    Orquesta el diagnóstico:
    1. Busca datos base en DB (Postgres).
    2. Consulta Mikrotik en tiempo real (si hay IP).
    3. Consulta SmartOLT en tiempo real (si hay ID externo).
    """
    db = Database()
    try:
        # 1. Base de datos (Postgres)
        # Este método ya lo definimos en postgres.py y devuelve el dict estandarizado
        base = db.get_diagnosis(pppoe_user, target_router_ip=ip)
        
        if "error" in base:
            return base

        diagnosis = base.copy()

        # 2. Mikrotik
        # Si no tenemos nodo_ip (cliente solo en OLT), usamos el default MK_HOST del .env
        router_ip = base.get("nodo_ip")
        
        if not router_ip:
            logger.warning(f"Sin IP de nodo para {pppoe_user}. Usando MK_HOST por defecto.")
            router_ip = config.MK_HOST

        # Validamos PPPoE (si router_ip es válido)
        if router_ip:
            # Aseguramos que el puerto sea int
            port = int(base.get("puerto") or config.MK_PORT)
            pppoe_info = mikrotik.validar_pppoe(router_ip, pppoe_user, port)
            diagnosis["mikrotik"] = pppoe_info
        else:
            diagnosis["mikrotik"] = {"active": False, "error": "No Router IP"}

        # 3. SmartOLT (Solo si tenemos unique_external_id)
        external_id = base.get("unique_external_id")
        
        if external_id:
            diagnosis["onu_status_smrt"] = smartolt.get_onu_status(external_id)
            diagnosis["onu_signal_smrt"] = smartolt.get_onu_signals(external_id)
            # diagnosis["onu_vlan"] = smartolt.get_attached_vlans(external_id) # Opcional según performance
        else:
             # Caso raro: Cliente en ISPCube pero sin ONU vinculada
             diagnosis["onu_status_smrt"] = {"status": False, "error": "Sin ONU asociada"}
             diagnosis["onu_signal_smrt"] = {"status": False, "error": "Sin ONU asociada"}

        return diagnosis

    except Exception as e:
        logger.exception(f"Error en diagnóstico de {pppoe_user}. Detalles: {e}")
        # Retornamos lo que tengamos para no romper el frontend
        return diagnosis if 'diagnosis' in locals() else {"error": str(e)}
    finally:
        db.close()

def search_clients(query: str):
    """Búsqueda unificada delegada a la DB"""
    if not query or len(query) < 3:
        return []
    
    db = Database()
    try:
        return db.search_client(query)
    finally:
        db.close()

def get_live_traffic(pppoe_user: str):
    """Tráfico en vivo directo al Mikrotik"""
    db = Database()
    try:
        router_data = db.get_router_for_pppoe(pppoe_user)
        if not router_data:
            return {"status": "error", "detail": "Cliente no vinculado a un router."}
        
        router_ip, router_port = router_data
        if not router_port:
            router_port = config.MK_PORT
            
        trafico = mikrotik.obtener_trafico_en_vivo(router_ip, pppoe_user, int(router_port))
        
        if "error" in trafico:
             return {"status": "error", "detail": trafico["error"]}
             
        rx_mbps = round(int(trafico.get("rx", 0)) / 1000000, 2)
        tx_mbps = round(int(trafico.get("tx", 0)) / 1000000, 2)
        
        return {
            "status": "ok",
            "download_mbps": rx_mbps,
            "upload_mbps": tx_mbps,
            "raw": trafico
        }
    except Exception as e:
        logger.error(f"Fallo live traffic {pppoe_user}: {e}")
        return {"status": "error", "detail": str(e)}
    finally:
        db.close()