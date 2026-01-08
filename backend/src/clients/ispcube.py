import requests
import sys
from src import config
from src.config import logger

ISPCUBE_BASEURL = config.ISPCUBE_BASEURL
ISPCUBE_APIKEY = config.ISPCUBE_APIKEY
ISPCUBE_USER = config.ISPCUBE_USER
ISPCUBE_PASSWORD = config.ISPCUBE_PASSWORD
ISPCUBE_CLIENTID = config.ISPCUBE_CLIENTID

_token_cache = None

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

def buscar_conexiones(query: str, limit: int = 20):
    """
    Busca conexiones en ISPCube por nombre de cliente, dirección o username.
    Retorna conexiones enriquecidas con datos del cliente.
    
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
        # 1. Obtener todas las conexiones (usa función existente)
        todas_conexiones = obtener_todas_conexiones()
        
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
        
        # 3. Enriquecer con datos del cliente
        # Para evitar N+1 queries, obtener todos los clientes una vez
        url_customers = f"{ISPCUBE_BASEURL}/customers/customers_list"
        params = {"limit": 1000}  # Traer un lote grande
        resp = _request("GET", url_customers, params=params)
        clientes_dict = {c["id"]: c for c in resp.json() if isinstance(c, dict)}
        
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