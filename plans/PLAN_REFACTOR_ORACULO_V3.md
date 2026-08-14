# Plan: Refactor Oráculo PPPoE a campos estructurados (Graylog extractors + Influx basicstats)

## Contexto

El pipeline de ingesta cambió:

- **Graylog** parsea nativamente con extractores regex y expone campos estructurados.
- **InfluxDB** (vía Telegraf + plugin `basicstats`) renombró las métricas.
- El backend Emerald ERP ([`backend/src/routers/oraculo.py`](backend/src/routers/oraculo.py)) todavía hace
  procesamiento regex de texto y consulta métricas con nombres viejos.

## Objetivo

Acoplar estrictamente el Oráculo a la nueva estructura de datos, eliminando todo el
procesamiento regex de Python y el tag `sentido` de las consultas Flux.

### Decisión tomada con el usuario (Opción 1)

En **ambos buckets** (`netflow` y `netflow_resumen`) la dirección del tráfico la define
exclusivamente el Field:

- `in_bytes_sum` → descarga
- `out_bytes_sum` → subida

Se elimina cualquier lógica que dependa del tag `sentido`.

---

## Archivos a modificar

1. [`backend/src/config.py`](backend/src/config.py)
2. [`backend/src/routers/oraculo.py`](backend/src/routers/oraculo.py)
3. [`beholder_frontend/src/components/BeholderHistory.tsx`](beholder_frontend/src/components/BeholderHistory.tsx)

No se agregan librerías nuevas. No se modifican las rutas ni los parámetros de los endpoints.

---

## 1. config.py — Ajustes de configuración

### 1.1 `ORACULO_GRAYLOG_FIELDS` (obligatorio)

Línea [`config.py:147`](backend/src/config.py:147). Reemplazar:

```python
ORACULO_GRAYLOG_FIELDS = os.getenv("ORACULO_GRAYLOG_FIELDS", "message,source,timestamp")
```

por:

```python
ORACULO_GRAYLOG_FIELDS = os.getenv("ORACULO_GRAYLOG_FIELDS", "pppoe_action,framed_ip,mac_address,router_ip,timestamp")
```

### 1.2 Campos Flux (dirección por Field, sin tag sentido)

- Línea [`config.py:112`](backend/src/config.py:112): cambiar default de
  `ORACULO_INFLUX_IN_BYTES_FIELD` de `"in_bytes"` a `"in_bytes_sum"`.
- Agregar nueva clave para la subida:

```python
ORACULO_INFLUX_OUT_BYTES_FIELD = os.getenv("ORACULO_INFLUX_OUT_BYTES_FIELD", "out_bytes_sum")
```

- Eliminar las 3 claves del tag `sentido` ([`config.py:115`](backend/src/config.py:115) a [`config.py:117`](backend/src/config.py:117)):
  - `ORACULO_INFLUX_RESUMEN_SENTIDO_TAG`
  - `ORACULO_INFLUX_SENTIDO_DESCARGA`
  - `ORACULO_INFLUX_SENTIDO_SUBIDA`

`ORACULO_INFLUX_RESUMEN_IP_TAG` (`ip_cliente`) y `ORACULO_INFLUX_NODE_TAG` (`source`) se conservan.

---

## 2. oraculo.py — Destrucción de código regex obsoleto

Eliminar por completo:

| Elemento | Líneas |
|---|---|
| `import re` | [`oraculo.py:5`](backend/src/routers/oraculo.py:5) |
| `_extract_ipv4_candidates()` | [`oraculo.py:141`](backend/src/routers/oraculo.py:141) |
| `_extract_session_ip()` | [`oraculo.py:152`](backend/src/routers/oraculo.py:152) |
| `_extract_disconnect_reason()` | [`oraculo.py:450`](backend/src/routers/oraculo.py:450) |

Eliminar todos los bloques condicionales que busquen `"logged in"`, `"authenticated"` o
`"terminating"` dentro de `message.message` (verificación previa: el único uso restante de
`re` en el archivo está dentro de estas funciones, por lo que el import se elimina sin romper nada).

---

## 3. oraculo.py — Modelos Pydantic

### 3.1 `SesionCliente` ([`oraculo.py:39`](backend/src/routers/oraculo.py:39))

```python
class SesionCliente(BaseModel):
    inicio: str
    fin: Optional[str] = None          # None = sesión activa actualmente
    duracion: str
    ip_cliente: Optional[str] = None
    mac_address: Optional[str] = None  # nuevo
    razon_desconexion: Optional[str] = None
    router: str
```

### 3.2 `SesionIpCliente` ([`oraculo.py:59`](backend/src/routers/oraculo.py:59))

```python
class SesionIpCliente(BaseModel):
    inicio: str
    fin: Optional[str] = None          # None = abierta hasta "ahora"
    ip_cliente: Optional[str] = None
    mac_address: Optional[str] = None  # nuevo
    router: str
    razon_desconexion: Optional[str] = None
```

[`_normalize_pppoe_segments()`](backend/src/routers/oraculo.py:696) ya trata `fin` falsy como
"ahora" (`if not end_dt: end_dt = now`), por lo que no requiere cambios.

---

## 4. oraculo.py — Normalización de respuesta de Graylog

### 4.1 `_query_graylog_raw()` — rama CSV ([`oraculo.py:403`](backend/src/routers/oraculo.py:403))

La rama JSON (`payload.get("messages", [])`) queda igual: Graylog ya devuelve los campos
estructurados dentro de `message`.

**Nota (validado contra Graylog real):** la query de búsqueda se ajustó a
`"{usuario_pppoe}" AND pppoe_action:*`. Sin este filtro, los primeros resultados mezclan
mensajes de otros tipos (syslog genérico) que no poseen los campos de los extractores y
Graylog los devuelve solo con `_id` + `timestamp`.

La rama CSV debe mapear las nuevas columnas:

```python
records.append(
    {
        "message": {
            "timestamp": row.get("timestamp"),
            "pppoe_action": row.get("pppoe_action"),
            "framed_ip": row.get("framed_ip"),
            "mac_address": row.get("mac_address"),
            "router_ip": row.get("router_ip"),
        }
    }
)
```

La consulta, auth, retries, sort, range y limit no cambian.

---

## 5. oraculo.py — Reescritura lógica de sesiones (sin regex)

### 5.1 Helper compartido para extraer evento de un envelope

```python
def _parse_graylog_evento(msg: dict) -> tuple[Optional[str], Optional[datetime], Optional[str], Optional[str], Optional[str], str]:
    """Devuelve accion, ts, ip_cliente, mac_address, razon_desconexion, router."""
    accion = str(msg.get("pppoe_action") or "").strip().lower()
    if accion not in ("logged in", "logged out"):
        return None, None, None, None, None, "Desconocido"

    timestamp_raw = msg.get("timestamp")
    if not timestamp_raw:
        return None, None, None, None, None, "Desconocido"
    try:
        ts = _parse_graylog_timestamp(str(timestamp_raw))
    except Exception:
        return None, None, None, None, None, "Desconocido"

    router = _to_operator_router(str(msg.get("router_ip") or "Desconocido"))
    if accion == "logged in":
        return accion, ts, msg.get("framed_ip") or None, msg.get("mac_address") or None, None, router
    # "logged out" → fin de sesión
    return accion, ts, None, None, "Cierre de sesión", router
```

### 5.2 `_pair_sessions()` ([`oraculo.py:502`](backend/src/routers/oraculo.py:502))

Reescribir usando `pppoe_action`:

```python
def _pair_sessions(usuario_pppoe: str, graylog_messages: list[dict], limite: int) -> list[SesionCliente]:
    eventos: list[dict] = []

    for envelope in graylog_messages:
        msg = envelope.get("message", {})
        accion, ts, ip_cliente, mac_address, razon, router = _parse_graylog_evento(msg)
        if accion is None or ts is None:
            continue
        eventos.append({
            "ts": ts,
            "is_login": accion == "logged in",
            "is_logout": accion == "logged out",
            "ip_cliente": ip_cliente,
            "mac_address": mac_address,
            "reason": razon,
            "router": router,
        })

    eventos.sort(key=lambda e: e["ts"])

    sesiones: list[SesionCliente] = []
    logins_abiertos: list[dict] = []
    now = datetime.now(timezone.utc)

    for ev in eventos:
        if ev["is_login"]:
            logins_abiertos.append(ev)
            continue
        if ev["is_logout"] and logins_abiertos:
            inicio_ev = logins_abiertos.pop(0)
            sesiones.append(
                SesionCliente(
                    inicio=inicio_ev["ts"].isoformat(),
                    fin=ev["ts"].isoformat(),
                    duracion=_format_duration(inicio_ev["ts"], ev["ts"]),
                    ip_cliente=inicio_ev.get("ip_cliente"),
                    mac_address=inicio_ev.get("mac_address"),
                    razon_desconexion="Cierre de sesión",
                    router=ev.get("router") or inicio_ev.get("router") or "Desconocido",
                )
            )

    for inicio_ev in logins_abiertos:
        sesiones.append(
            SesionCliente(
                inicio=inicio_ev["ts"].isoformat(),
                fin=None,  # sesión activa actualmente (antes se enviaba "Activa" y el front rompía el parseo de fecha)
                duracion=_format_duration(inicio_ev["ts"], now),
                ip_cliente=inicio_ev.get("ip_cliente"),
                mac_address=inicio_ev.get("mac_address"),
                razon_desconexion=None,
                router=inicio_ev.get("router") or "Desconocido",
            )
        )

    sesiones.sort(key=lambda s: s.inicio, reverse=True)
    return sesiones[:limite]
```

**Nota:** se elimina el filtro de texto `usuario_pppoe.lower() not in lower_text` y las
detecciones por `"logged in"` / `"logged out"` / `"disconnected"` / `"logout"` sobre
`message.message`. La confianza pasa al campo estructurado `pppoe_action`. La firma de la
función se conserva (el endpoint no cambia).

### 5.3 `_query_graylog_session_windows()` ([`oraculo.py:596`](backend/src/routers/oraculo.py:596))

Reescribir con la misma lógica estructurada:

```python
def _query_graylog_session_windows(usuario_pppoe: str, limite: int, range_sec: Optional[int] = None) -> list[SesionIpCliente]:
    raw_messages = _query_graylog_raw(usuario_pppoe, limite, range_sec=range_sec)
    eventos: list[dict] = []

    for envelope in raw_messages:
        msg = envelope.get("message", {})
        accion, ts, ip_cliente, mac_address, razon, router = _parse_graylog_evento(msg)
        if accion is None or ts is None:
            continue
        eventos.append({
            "inicio": ts.isoformat(),
            "ip_cliente": ip_cliente,
            "mac_address": mac_address,
            "router": router,
            "razon_desconexion": razon,
            "is_login": accion == "logged in",
            "is_logout": accion == "logged out",
        })

    eventos.sort(key=lambda e: e["inicio"])

    sesiones: list[SesionIpCliente] = []
    current_login: Optional[dict] = None
    for ev in eventos:
        if current_login is None:
            if ev.get("is_login"):
                current_login = ev
            continue

        if ev.get("is_logout"):
            current_login["fin"] = ev["inicio"]
            sesiones.append(
                SesionIpCliente(
                    inicio=current_login["inicio"],
                    fin=current_login["fin"],
                    ip_cliente=current_login.get("ip_cliente"),
                    mac_address=current_login.get("mac_address"),
                    router=current_login.get("router", "Desconocido"),
                    razon_desconexion="Cierre de sesión",
                )
            )
            current_login = None
            continue

        if ev.get("is_login"):
            current_login = ev

    if current_login is not None:
        sesiones.append(
            SesionIpCliente(
                inicio=current_login["inicio"],
                fin=None,  # abierta; _normalize_pppoe_segments la cierra en "ahora"
                ip_cliente=current_login.get("ip_cliente"),
                mac_address=current_login.get("mac_address"),
                router=current_login.get("router", "Desconocido"),
                razon_desconexion=None,
            )
        )

    return sesiones[:limite]
```

---

## 6. oraculo.py — Query Flux unificado (`in_bytes_sum` / `out_bytes_sum`)

Reescribir [`_build_influx_interval_query()`](backend/src/routers/oraculo.py:204) para que una
sola plantilla sirva a ambos buckets. La dirección viene del Field, no del tag `sentido`:

```python
def _build_influx_interval_query(
    ip_cliente: str,
    rango: str,
    start_iso: str,
    stop_iso: str,
    nodo_ip: Optional[str] = None,
    force_raw: bool = False,
) -> str:
    raw_bucket = config.ORACULO_INFLUX_RAW_BUCKET
    resumen_bucket = config.ORACULO_INFLUX_RESUMEN_BUCKET
    raw_measurement = config.ORACULO_INFLUX_RAW_MEASUREMENT
    resumen_measurement = config.ORACULO_INFLUX_RESUMEN_MEASUREMENT
    in_bytes_field = config.ORACULO_INFLUX_IN_BYTES_FIELD      # in_bytes_sum  → descarga
    out_bytes_field = config.ORACULO_INFLUX_OUT_BYTES_FIELD    # out_bytes_sum → subida
    resumen_ip_tag = config.ORACULO_INFLUX_RESUMEN_IP_TAG      # ip_cliente
    node_tag = config.ORACULO_INFLUX_NODE_TAG                  # source
    node_clause = f' and r["{node_tag}"] == "{nodo_ip}"' if node_tag and nodo_ip else ""

    use_raw = force_raw or rango in _REALTIME_RANGES
    if use_raw:
        bucket = raw_bucket
        measurement = raw_measurement
        window_seconds = config.ORACULO_INFLUX_REALTIME_WINDOW_SECONDS
        descarga_ip_cond = f'r["dst"] == ip'
        subida_ip_cond = f'r["src"] == ip'
        aggregation = "    |> aggregateWindow(every: 1m, fn: sum, createEmpty: false)\n"
    else:
        bucket = resumen_bucket
        measurement = resumen_measurement
        window_seconds = config.ORACULO_INFLUX_RESUMEN_WINDOW_SECONDS
        descarga_ip_cond = f'r["{resumen_ip_tag}"] == "{ip_cliente}"'
        subida_ip_cond = f'r["{resumen_ip_tag}"] == "{ip_cliente}"'
        aggregation = ""

    return f'''
ip = "{ip_cliente}"

descarga = from(bucket: "{bucket}")
    |> range(start: time(v: "{start_iso}"), stop: time(v: "{stop_iso}"))
    |> filter(fn: (r) => r["_measurement"] == "{measurement}" and r["_field"] == "{in_bytes_field}" and {descarga_ip_cond}{node_clause})
{aggregation}    |> set(key: "_dir", value: "descarga")

subida = from(bucket: "{bucket}")
    |> range(start: time(v: "{start_iso}"), stop: time(v: "{stop_iso}"))
    |> filter(fn: (r) => r["_measurement"] == "{measurement}" and r["_field"] == "{out_bytes_field}" and {subida_ip_cond}{node_clause})
{aggregation}    |> set(key: "_dir", value: "subida")

union(tables: [descarga, subida])
    |> pivot(rowKey:["_time"], columnKey: ["_dir"], valueColumn: "_value")
    |> map(fn: (r) => ({{
    r with descarga_mbps: float(v: r["descarga"]) * 8.0 / {window_seconds}.0 / 1024.0 / 1024.0,
    subida_mbps: float(v: r["subida"]) * 8.0 / {window_seconds}.0 / 1024.0 / 1024.0
    }}))
    |> keep(columns: ["_time", "descarga_mbps", "subida_mbps"])
    |> sort(columns: ["_time"], desc: false)
'''
```

### Reglas del refactor Flux

- **Descarga:** `_field == "{in_bytes_field}"` + `dst == ip` (raw) / `ip_cliente == ip` (resumen).
- **Subida:** `_field == "{out_bytes_field}"` + `src == ip` (raw) / `ip_cliente == ip` (resumen).
- Se elimina `set(key: "{sentido_tag}", ...)`, `pivot` por `sentido`, y las variables
  `sentido_tag` / `sentido_descarga` / `sentido_subida`.
- El fallback a raw para rangos históricos ([`oraculo.py:327`](backend/src/routers/oraculo.py:327))
  sigue funcionando porque pasa por el mismo constructor con `force_raw=True`.
- `_probe_influx()` ([`oraculo.py:870`](backend/src/routers/oraculo.py:870)) no cambia (solo valida bucket visible).
- `_probe_graylog()` ([`oraculo.py:894`](backend/src/routers/oraculo.py:894)) usa
  `config.ORACULO_GRAYLOG_FIELDS` automáticamente con los nuevos campos. Sin cambios.

---

## 7. BeholderHistory.tsx — Ajustes de frontend

Archivo: [`beholder_frontend/src/components/BeholderHistory.tsx`](beholder_frontend/src/components/BeholderHistory.tsx)

1. Interface `Sesion` ([`BeholderHistory.tsx:34`](beholder_frontend/src/components/BeholderHistory.tsx:34)):
   - `fin?: string | null;`
   - agregar `mac_address?: string;`
2. Celda de fin ([`BeholderHistory.tsx:381`](beholder_frontend/src/components/BeholderHistory.tsx:381)):
   ```tsx
   {sesion.fin ? formatDateTime(sesion.fin) : "Activa actualmente"}
   ```
   (Evita el error actual: `new Date("Activa")` → "Invalid Date").
3. Agregar columna **MAC** en el `<thead>` (después de "IP Cliente") y en el cuerpo:
   ```tsx
   <td className="px-3 py-2 text-gray-300">{sesion.mac_address || "-"}</td>
   ```
4. Sin cambios en endpoints, rangos ni estructura de llamadas fetch.

---

## 8. Verificación (post-implementación)

1. `python -m py_compile backend/src/routers/oraculo.py backend/src/config.py`
2. Greps de residuos en `backend/src`:
   - `_extract_session_ip`, `_extract_disconnect_reason`, `_extract_ipv4_candidates`
   - `sentido`, `SENTIDO`
   - `"logged in"`, `authenticated`, `terminating` dentro de `oraculo.py`
   - `import re` en `oraculo.py`
3. Frontend: `cd beholder_frontend && npx tsc --noEmit` (o `npm run build`).
4. Smoke test con API key:
   - `GET /api/v1/oraculo/debug` → probes Graylog/Influx OK.
   - `GET /api/v1/oraculo/sesiones/{usuario}?limite=10` → sesiones con
     `ip_cliente`, `mac_address`, `router`, `razon_desconexion` = "Cierre de sesión",
     y `fin: null` para la sesión activa.
   - `GET /api/v1/oraculo/trafico-pppoe/{usuario}?rango=15m` y `?rango=24h` → puntos
     `{tiempo, descarga_mbps, subida_mbps}`; validar en logs la línea `oraculo_pppoe_metrics`
     con `segments>0` y sin error.

---

## Fuera de alcance

- No se tocan endpoints, rutas ni parámetros.
- No se agregan librerías.
- No se modifican `_normalize_pppoe_segments`, `_merge_traffic_points`, cache TTL ni la
  resolución de nodo (`_resolve_pppoe_node_context`).
