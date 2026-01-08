import requests
import sys
from datetime import datetime, timedelta
from src import config
from src.config import logger

ISPCUBE_BASEURL = config.ISPCUBE_BASEURL
ISPCUBE_APIKEY = config.ISPCUBE_APIKEY
ISPCUBE_USER = config.ISPCUBE_USER
ISPCUBE_PASSWORD = config.ISPCUBE_PASSWORD
ISPCUBE_CLIENTID = config.ISPCUBE_CLIENTID

_token_cache = None

# Cache para búsqueda de conexiones (TTL: 5 minutos)
_connections_cache = {
    "data": None,
    "timestamp": None,
    "ttl_minutes": 5
}

# Cache para clientes (TTL: 10 minutos, cambian menos frecuentemente)
_customers_cache = {
    "data": None,
    "timestamp": None,
    "ttl_minutes": 10
}

def _obtener_token():
    url = f"{ISPCUBE_BASEURL}/sanctum/token"
    payload = {"username": ISPCUBE_USER, "password": ISPCUBE_PASSWORD}
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "api-key": ISPCUBE_APIKEY,
        "client-id": ISPCUBE_CLIENTID,
        "login-type": "api"
    }
    resp = requests.post(url, json=payload, headers=headers)
    resp.raise_for_status()
    return resp.json()["token"]

def _get_token(force_refresh=False):
    global _token_cache
    if force_refresh or _token_cache is None:
        _token_cache = _obtener_token()
    return _token_cache

def _headers(token=None):
    return {
        "Authorization": f"Bearer {token or _get_token()}",
        "api-key": ISPCUBE_APIKEY,
        "client-id": ISPCUBE_CLIENTID,
        "login-type": "api",
        "Accept": "application/json",
        "username": ISPCUBE_USER
    }

def _request(method, url, **kwargs):
    token = _get_token()
    headers = kwargs.pop("headers", {})
    headers.update(_headers(token))
    
    resp = requests.request(method, url, headers=headers, **kwargs)
    
    if resp.status_code == 401:
        logger.warning("Token expirado, renovando...")
        token = _get_token(force_refresh=True)
        headers.update(_headers(token))
        resp = requests.request(method, url, headers=headers, **kwargs)
    
    resp.raise_for_status()
    return resp

# ------------------ Funciones públicas ------------------

def obtener_nodos():
    url = f"{ISPCUBE_BASEURL}/nodes/nodes_list"
    resp = _request("GET", url)
    body = resp.json()
    items = body["data"] if isinstance(body, dict) and "data" in body else body
    nodos = []
    for n in items:
        nodos.append({
            "id": n.get("id"),
            "name": n.get("comment"),
            "ip": n.get("ip"),
            "puerto": n.get("port")
        })
    return nodos

def obtener_todas_conexiones():
    """
    Devuelve lista de conexiones con datos básicos usando endpoint de lista completa.
    """
    url = f"{ISPCUBE_BASEURL}/connections/connections_list"
    # Timeout extendido por seguridad, pero lógica original
    resp = _request("GET", url, timeout=60)
    conexiones = resp.json()

    if not isinstance(conexiones, list):
        logger.error("Respuesta inesperada de ISPCube al listar conexiones")
        return []

    resultado = []
    for c in conexiones:
        if c.get("conntype") == "pppoe":
            resultado.append({
                "user": c.get("user"),
                "customer_id": c.get("customer_id"),
                "id": c.get("id"),
                "node_id": c.get("node_id"),
                "plan_id": c.get("plan_id"),
                "direccion": c.get("address")
            })
    return resultado

def obtener_planes():
    url = f"{ISPCUBE_BASEURL}/plans/plans_list"
    resp = _request("GET", url)
    planes = resp.json()

    if not isinstance(planes, list):
        logger.error("Respuesta inesperada de ISPCube al listar planes")
        return []

    resultado = []
    for p in planes:
        resultado.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "speed": p.get("speed"),
            "comment": p.get("comment")
        })
    return resultado

def obtener_clientes():
    """
    Devuelve lista completa de clientes usando PAGINACIÓN (esto sí funciona bien).
    """
    url = f"{ISPCUBE_BASEURL}/customers/customers_list"
    all_customers = []
    LIMIT = 500
    offset = 0
    
    print(f"     ↳ [Paginación] Iniciando descarga de clientes...")
    
    while True:
        try:
            params = {"limit": LIMIT, "offset": offset}
            resp = _request("GET", url, params=params)
            batch = resp.json()
            
            if not isinstance(batch, list) or len(batch) == 0:
                break 
            
            all_customers.extend(batch)
            sys.stdout.write(f"\r     ↳ [Paginación] Bajados: {len(all_customers)} clientes...")
            sys.stdout.flush()
            
            if len(batch) < LIMIT:
                break
            
            offset += LIMIT
        except Exception as e:
            print(f"\n❌ Error bajando bloque offset={offset}: {e}")
            break

    print(f" ✅ Total: {len(all_customers)}")
    return all_customers


# ==================== NUEVAS FUNCIONES PARA WIZARDS ====================
# Estas funciones NO modifican las existentes (regla de oro)

def _get_cached_connections():
    """
    Retorna conexiones en cache si está vigente, sino None.
    Cache TTL: 5 minutos (configurable en _connections_cache['ttl_minutes'])
    """
    global _connections_cache
    
    if _connections_cache["data"] is None:
        return None
    
    if _connections_cache["timestamp"] is None:
        return None
    
    # Verificar si el cache expiró
    elapsed = datetime.now() - _connections_cache["timestamp"]
    ttl = timedelta(minutes=_connections_cache["ttl_minutes"])
    
    if elapsed > ttl:
        logger.info("⏰ Cache de conexiones expirado, se renovará")
        return None
    
    logger.info(f"✅ Usando cache de conexiones (edad: {elapsed.seconds}s)")
    return _connections_cache["data"]


def _set_cached_connections(data):
    """Guarda conexiones en cache con timestamp actual."""
    global _connections_cache
    _connections_cache["data"] = data
    _connections_cache["timestamp"] = datetime.now()
    logger.info(f"💾 Cache de conexiones actualizado ({len(data)} conexiones)")


def _get_cached_customers():
    """
    Retorna clientes en cache si está vigente, sino None.
    Cache TTL: 10 minutos (clientes cambian menos frecuentemente)
    """
    global _customers_cache
    
    if _customers_cache["data"] is None:
        return None
    
    if _customers_cache["timestamp"] is None:
        return None
    
    # Verificar si el cache expiró
    elapsed = datetime.now() - _customers_cache["timestamp"]
    ttl = timedelta(minutes=_customers_cache["ttl_minutes"])
    
    if elapsed > ttl:
        logger.info("⏰ Cache de clientes expirado, se renovará")
        return None
    
    logger.info(f"✅ Usando cache de clientes (edad: {elapsed.seconds}s)")
    return _customers_cache["data"]


def _set_cached_customers(data):
    """Guarda clientes (dict) en cache con timestamp actual."""
    global _customers_cache
    _customers_cache["data"] = data
    _customers_cache["timestamp"] = datetime.now()
    logger.info(f"💾 Cache de clientes actualizado ({len(data)} clientes)")


def buscar_conexiones(query: str, limit: int = 20):
    """
    Busca conexiones en ISPCube por nombre de cliente, dirección o username.
    Retorna conexiones enriquecidas con datos del cliente.
    
    **OPTIMIZACIÓN:** Usa cache en memoria con TTL de 5 minutos para evitar
    descargar todas las conexiones en cada búsqueda.
    
    Args:
        query: Texto a buscar (nombre, dirección, username)
        limit: Máximo de resultados a retornar
    
    Returns:
        Lista de diccionarios con estructura:
        {
            "connection_id": int,
            "pppoe_username": str,
            "installation_address": str,
            "client_name": str,
            "client_id": int,
            "plan_name": str,
            "node_name": str,
            "status": str
        }
    """
    try:
        # 1. Intentar obtener del cache
        todas_conexiones = _get_cached_connections()
        
        if todas_conexiones is None:
            # Cache vacío o expirado → descargar de ISPCube
            logger.info("🌐 Descargando conexiones desde ISPCube...")
            todas_conexiones = obtener_todas_conexiones()
            _set_cached_connections(todas_conexiones)
        
        # 2. Si hay query, filtrar
        query_lower = query.lower() if query else ""
        conexiones_filtradas = []
        
        for conn in todas_conexiones:
            # Buscar en username o dirección
            username = (conn.get("user") or "").lower()
            direccion = (conn.get("direccion") or "").lower()
            
            if (not query_lower or 
                query_lower in username or 
                query_lower in direccion):
                conexiones_filtradas.append(conn)
                
                if len(conexiones_filtradas) >= limit:
                    break
        
        # 3. Enriquecer con datos del cliente (con cache)
        # Intentar obtener clientes del cache
        clientes_dict = _get_cached_customers()
        
        if clientes_dict is None:
            # Cache vacío o expirado → descargar de ISPCube
            logger.info("🌐 Descargando clientes desde ISPCube...")
            url_customers = f"{ISPCUBE_BASEURL}/customers/customers_list"
            params = {"limit": 1000}  # Traer un lote grande
            resp = _request("GET", url_customers, params=params)
            clientes_dict = {c["id"]: c for c in resp.json() if isinstance(c, dict)}
            _set_cached_customers(clientes_dict)
        
        # 4. Construir resultado enriquecido
        resultado = []
        for conn in conexiones_filtradas[:limit]:
            customer_id = conn.get("customer_id")
            cliente = clientes_dict.get(customer_id, {})
            
            resultado.append({
                "connection_id": conn.get("id"),
                "pppoe_username": conn.get("user"),
                "installation_address": conn.get("direccion") or cliente.get("address", "Sin dirección"),
                "client_name": cliente.get("name", "Cliente sin nombre"),
                "client_id": customer_id,
                "plan_name": f"Plan ID {conn.get('plan_id')}" if conn.get('plan_id') else "Sin plan",
                "node_name": f"Nodo ID {conn.get('node_id')}" if conn.get('node_id') else "Sin nodo",
                "status": "active"  # ISPCube no retorna status en lista simple
            })
        
        return resultado
    
    except Exception as e:
        logger.error(f"Error buscando conexiones: {e}")
        return []