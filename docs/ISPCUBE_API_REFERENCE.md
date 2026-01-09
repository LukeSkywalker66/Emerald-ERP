# ISPCube API Reference

Documentación de endpoints de ISPCube utilizados en Emerald ERP.

Fuente: https://apidoc.ispcube.com/

---

## 🔍 Consultar Cliente Individual

**Endpoint:** `GET /api/customer`

**URL:** `http://ispdomain.com/api/customer`

**Descripción:** Obtiene toda la información de un cliente específico.

**Permisos requeridos:** Listar clientes

### Headers

```http
Content-Type: application/json
Accept: application/json
api-key: {{apiKey}}
client-id: {{companyId}}
login-type: api
username: {{userName}}
Authorization: Bearer {{token}}
```

### Query Parameters

| Parámetro | Tipo | Ejemplo | Descripción |
|-----------|------|---------|-------------|
| `customer_id` | integer | `2` | ID interno del cliente |
| `code` | string | `"000002"` | Código del cliente |
| `doc_number` | string | `"26281212"` | DNI/CUIT/CUIL/RUT del cliente |
| `phone_number` | string | `"2915048080"` | Número de teléfono del cliente |
| `deleted` | boolean | `false` | Incluir clientes eliminados (default: true) |
| `temporary` | boolean | `false` | Incluir clientes temporales (default: true) |

**Nota:** Los parámetros son opcionales. Se puede buscar por cualquiera de ellos.

### Ejemplo de Request

```bash
curl -X GET "http://ispdomain.com/api/customer?doc_number=26281212" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -H "client-id: YOUR_CLIENT_ID" \
  -H "login-type: api" \
  -H "username: YOUR_USERNAME" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response (200 OK)

```json
{
  "id": 2236,
  "code": "003365",
  "name": "RIOS ANA",
  "tax_residence": "Calle Amenabar 123",
  "type": "no_fiscal_invoice",
  "tax_situation_id": 4,
  "identification_type_id": 7,
  "doc_number": "12123456",
  "auto_bill_sending": 1,
  "auto_payment_recipe_sending": 1,
  "nickname": null,
  "comercial_activity": null,
  "address": "Calle Amenabar 123",
  "between_address1": null,
  "between_address2": null,
  "city_id": 3,
  "lat": "-33.6931047",
  "lng": null,
  "extra1": "",
  "extra2": "",
  "entity_id": 79,
  "collector_id": 1,
  "seller_id": null,
  "block": 1,
  "free": 0,
  "apply_late_payment_due": 0,
  "apply_reconnection": 0,
  "contract": 0,
  "contract_type_id": null,
  "contract_expiration_date": null,
  "paycomm": null,
  "expiration_type_id": null,
  "business_id": 1,
  "first_expiration_date": 0,
  "second_expiration_date": 0,
  "next_month_corresponding_date": 0,
  "start_date": "2014-04-01 00:00:00",
  "perception_id": null,
  "phonekey": null,
  "debt": "0.00",
  "duedebt": "0.00",
  "speed_limited": 0,
  "status": "no_service",
  "enable_date": null,
  "block_date": null,
  "created_at": "2014-04-01T03:00:00.000000Z",
  "updated_at": "2014-04-01T03:00:00.000000Z",
  "deleted_at": null,
  "temporary": 1,
  "paycomm_request_date": null,
  "uuid": "",
  "phones": [
    {
      "id": 2137,
      "customer_id": 2236,
      "detail": null,
      "number": "1234567890",
      "sms": 0,
      "created_at": "2018-05-14T03:00:00.000000Z",
      "updated_at": null
    }
  ],
  "connections": [],
  "contact_emails": [],
  "electronic_payment_codes": [],
  "city": {
    "id": 3,
    "name": "Vicente Lopez",
    "province": "Buenos Aires",
    "postal_code": 1605,
    "created_at": "2022-11-03T13:55:38.000000Z",
    "updated_at": null
  },
  "customer_cbu": []
}
```

### Campos Importantes

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | integer | ID interno del cliente en ISPCube |
| `code` | string | Código único del cliente |
| `name` | string | Nombre completo del cliente |
| `doc_number` | string | DNI/CUIT del cliente |
| `address` | string | Dirección del cliente |
| `city_id` | integer | ID de la ciudad |
| `status` | string | Estado: `no_service`, `active`, etc. |
| `temporary` | boolean | Si es cliente temporal (sin servicio activo) |
| `phones[]` | array | Lista de teléfonos del cliente |
| `connections[]` | array | Lista de conexiones activas del cliente |
| `contact_emails[]` | array | Emails de contacto |
| `city` | object | Datos de la ciudad (nombre, provincia, código postal) |
| `debt` | decimal | Deuda total |
| `duedebt` | decimal | Deuda vencida |

---

## 🔄 Uso en Emerald ERP

### Para el Wizard de Instalación (Alta)

Cuando el usuario ingresa un DNI en el wizard de instalación, se puede:

1. Buscar primero en la DB local
2. Si no existe, consultar a ISPCube con: `GET /api/customer?doc_number={dni}`
3. Si ISPCube retorna un cliente:
   - **`temporary: true` y `connections: []`** → Cliente nuevo sin servicio (IDEAL para instalación)
   - **`temporary: false` con conexiones** → Cliente existente (mostrar advertencia)
4. Pre-cargar datos del cliente en el wizard:
   - Nombre: `name`
   - Dirección: `address`
   - Teléfono: `phones[0].number`
   - Ciudad: `city.name`

### Implementación Sugerida

```python
# backend/src/clients/ispcube.py

def buscar_cliente_por_dni(dni: str):
    """
    Busca un cliente específico en ISPCube por DNI.
    
    Args:
        dni: DNI/CUIT del cliente
        
    Returns:
        dict con datos del cliente o None si no existe
    """
    url = f"{ISPCUBE_BASEURL}/api/customer"
    params = {"doc_number": dni}
    
    try:
        resp = _request("GET", url, params=params)
        cliente = resp.json()
        
        if cliente and isinstance(cliente, dict):
            return {
                "customer_id": cliente.get("id"),
                "code": cliente.get("code"),
                "name": cliente.get("name"),
                "doc_number": cliente.get("doc_number"),
                "address": cliente.get("address"),
                "city": cliente.get("city", {}).get("name"),
                "phone": cliente.get("phones", [{}])[0].get("number"),
                "status": cliente.get("status"),
                "is_temporary": cliente.get("temporary", 0) == 1,
                "has_connections": len(cliente.get("connections", [])) > 0,
                "debt": cliente.get("debt"),
                "connections_count": len(cliente.get("connections", []))
            }
        return None
    except Exception as e:
        logger.error(f"Error buscando cliente por DNI {dni}: {e}")
        return None
```

---

## 📋 Endpoints Adicionales (por documentar)

- `POST /api/customer` - Crear nuevo cliente
- `PUT /api/customer/{id}` - Actualizar cliente
- `GET /connections/connections_list` - Listar conexiones
- `POST /connections` - Crear nueva conexión
- `GET /plans/plans_list` - Listar planes
- `GET /nodes/nodes_list` - Listar nodos

---

## 🔐 Autenticación y Headers Comunes (Emerald ERP)

### Obtener Token

ISPCube utiliza un flujo de token vía Sanctum.

- Endpoint: `POST /sanctum/token`
- Body: `{ "username": ISPCUBE_USER, "password": ISPCUBE_PASSWORD }`
- Headers obligatorios: `api-key`, `client-id`, `login-type=api`, `Accept`
- Renovación automática: Si ISPCube responde `401`, Emerald renueva el token y reintenta.

### Headers Enviados por Emerald

```
Authorization: Bearer <token>
api-key: <ISPCUBE_APIKEY>
client-id: <ISPCUBE_CLIENTID>
login-type: api
Accept: application/json
username: <ISPCUBE_USER>
```

---

## 📦 Listados Masivos Utilizados

### 1) Conexiones (lista completa)
- Endpoint: `GET /connections/connections_list`
- Uso: Descargar todas las conexiones PPPoE y filtrar localmente
- Timeout sugerido: 60s (volumen alto)
- Nota: En Emerald solo se consideran conexiones con `conntype == "pppoe"`.

### 2) Clientes (paginado o lote grande)
- Endpoint: `GET /customers/customers_list`
- Parámetros recomendados: `limit` y opcionalmente `offset`
- Enriquecimiento: Se construye un diccionario `{id: cliente}` para lookups O(1)
- En Emerald, se cachea 10 minutos para reducir llamadas.

---

## 🔎 Integración de Búsqueda en Emerald ERP

### Endpoint Interno (Emerald)
- `GET /api/v2/tickets/search-connections?query=...&limit=...`
- Retorna: lista de conexiones enriquecidas con datos de cliente
- Campos: `connection_id`, `pppoe_username`, `installation_address`, `client_name`, `client_id`, `plan_name`, `node_name`, `status`

### Lógica Interna Resumida
1. Descargar conexiones desde ISPCube (o usar cache en memoria, TTL 5min)
2. Filtrar por `query` (username/dirección)
3. Descargar clientes (o usar cache, TTL 10min)
4. Enriquecer resultados y truncar a `limit`

### Consideraciones de Performance
- Primera búsqueda (cache frío): depende del volumen (en pruebas ~21.7s)
- Búsquedas subsecuentes: ~0.018s (cache caliente)
- Trade-off: datos pueden tener hasta 5/10 minutos de desfase

---

## ⚠️ Reglas de Modificación (Emerald)

- NO modificar funciones existentes en `backend/src/clients/ispcube.py` usadas por sync nocturno/Beholder (`obtener_todas_conexiones`, `obtener_clientes`, etc.)
- Agregar funciones nuevas para casos de uso adicionales (ej.: `buscar_conexiones`, `buscar_cliente_por_dni`)
- Si se requiere cambiar contrato de ISPCube, documentar primero el impacto en sync/diagnóstico.

---

**Última actualización:** 8 de enero de 2026
