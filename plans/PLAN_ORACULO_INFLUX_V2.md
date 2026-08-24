# Plan: Oráculo PPPoE — Esquema InfluxDB v2 + rótulo de resumen

## Contexto

InfluxDB v2 cambió el esquema de telemetría Netflow:

- **Buckets (sin cambios de selección):**
  - `rango <= 6h` → bucket `netflow` (ventana 1m).
  - `rango > 6h` → bucket `netflow_resumen` (ventana 5m).
- **Fields (idénticos en ambos buckets):**
  - `download_bytes_sum` (descarga).
  - `upload_bytes_sum` (subida).
- **Tags (idénticos en ambos buckets):**
  - `ip_cliente` (IP del abonado).
  - `router_pub` (IP pública del router origen) — obligatorio.
- **Conversión a Mbps:**
  - `netflow` (1m): `Mbps = (bytes * 8) / 60 / 1000000`.
  - `netflow_resumen` (5m): `Mbps = (bytes * 8) / 300 / 1000000`.

## Flujo del gráfico (necesidad funcional)

Beholder resuelve sesiones PPPoE desde Graylog (login/logout → `ip_cliente` + `router_ip`),
normaliza segmentos de tiempo por IP y consulta Influx **una query por cada IP de sesión**
(filtrando por `ip_cliente` y `router_pub`), para luego fusionar los puntos por timestamp en
una única serie temporal. El gráfico muestra Mbps y, además, un rótulo con totales y picos.

## Cambios backend — [`backend/src/routers/oraculo.py`](backend/src/routers/oraculo.py)

### 1. Modelos

```python
class TraficoPunto(BaseModel):
    tiempo: str
    descarga_mbps: float
    subida_mbps: float
    descarga_bytes: int = 0
    subida_bytes: int = 0


class ResumenTrafico(BaseModel):
    total_descarga_bytes: int
    total_subida_bytes: int
    pico_descarga_mbps: float
    pico_subida_mbps: float


class TraficoSerie(BaseModel):
    puntos: list[TraficoPunto]
    resumen: ResumenTrafico
```

### 2. Config de campos/tags

Usar en la query:
- `in_field = config.ORACULO_INFLUX_IN_BYTES_FIELD` → `download_bytes_sum`.
- `out_field = config.ORACULO_INFLUX_OUT_BYTES_FIELD` → `upload_bytes_sum`.
- `ip_tag = config.ORACULO_INFLUX_RESUMEN_IP_TAG` → `ip_cliente`.
- `router_tag = config.ORACULO_INFLUX_ROUTER_PUB_TAG` → `router_pub` (nuevo en config).

### 3. `_build_influx_interval_query(ip_cliente, router_pub, rango, start_iso, stop_iso)`

```python
rango_segundos = _RANGE_SECONDS.get(rango)
if not rango_segundos:
    raise HTTPException(400, f"Rango no soportado: {rango}")

if rango_segundos <= 6 * 60 * 60:
    bucket = raw_bucket; window = "1m"; window_seconds = 60
else:
    bucket = resumen_bucket; window = "5m"; window_seconds = 300

router_clause = f' and r["{router_tag}"] == "{router_pub}"' if router_pub else ""

return f'''
ip = "{ip_cliente}"

from(bucket: "{bucket}")
    |> range(start: time(v: "{start_iso}"), stop: time(v: "{stop_iso}"))
    |> filter(fn: (r) => r["_measurement"] == "{measurement}" and (r["_field"] == "{in_field}" or r["_field"] == "{out_field}") and r["{ip_tag}"] == ip{router_clause})
    |> aggregateWindow(every: {window}, fn: sum, createEmpty: false)
    |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    |> map(fn: (r) => ({{
    _time: r._time,
    descarga_bytes: (if exists r["{in_field}"] then float(v: r["{in_field}"]) else 0.0),
    subida_bytes: (if exists r["{out_field}"] then float(v: r["{out_field}"]) else 0.0),
    descarga_mbps: (if exists r["{in_field}"] then float(v: r["{in_field}"]) else 0.0) * 8.0 / {window_seconds}.0 / 1000000.0,
    subida_mbps: (if exists r["{out_field}"] then float(v: r["{out_field}"]) else 0.0) * 8.0 / {window_seconds}.0 / 1000000.0
    }}))
    |> keep(columns: ["_time", "descarga_mbps", "subida_mbps", "descarga_bytes", "subida_bytes"])
    |> sort(columns: ["_time"], desc: false)
'''
```

### 4. `_query_influx_interval(ip_cliente, router_pub, rango, start_iso, stop_iso)`

- Leer del registro: `descarga_mbps`, `subida_mbps`, `descarga_bytes`, `subida_bytes`.
- Construir `TraficoPunto` con bytes incluidos.
- Retornar `list[TraficoPunto]` (los bytes viajan en el punto para calcular totales).

### 5. Segmentos con router público

- [`_normalize_pppoe_segments()`](backend/src/routers/oraculo.py) pasa a devolver
  `list[tuple[str, str, str, str]]` = `(ip_cliente, router_pub, start_iso, end_iso)`.
  - Merge agrupado por `(ip_cliente, router_pub)`.
  - Se descartan sesiones sin `ip_cliente` o sin `router` válido (router `None`/`Desconocido`).
- `_query_influx_interval_async()` y [`_build_pppoe_traffic_series()`](backend/src/routers/oraculo.py)
  propagan `router_pub` a la query.

### 6. Resumen en `_build_pppoe_traffic_series`

Tras fusionar puntos:
```python
total_descarga = sum(p.descarga_bytes for p in merged)
total_subida = sum(p.subida_bytes for p in merged)
pico_descarga = max((p.descarga_mbps for p in merged), default=0.0)
pico_subida = max((p.subida_mbps for p in merged), default=0.0)
resumen = ResumenTrafico(
    total_descarga_bytes=total_descarga,
    total_subida_bytes=total_subida,
    pico_descarga_mbps=pico_descarga,
    pico_subida_mbps=pico_subida,
)
return TraficoSerie(puntos=merged, resumen=resumen), metrics
```

### 7. Endpoints

- `GET /api/v1/oraculo/trafico-pppoe/{usuario}` → `response_model=TraficoSerie`.
- `GET /api/v1/oraculo/trafico/{ip_cliente}` (legacy, no usado por beholder) → se agrega
  query param opcional `router_pub`; si no viene, se omite el filtro de router.

## Cambios config — [`backend/src/config.py`](backend/src/config.py) y [`.env`](.env)

- `ORACULO_INFLUX_IN_BYTES_FIELD` default → `"download_bytes_sum"`.
- `ORACULO_INFLUX_OUT_BYTES_FIELD` default → `"upload_bytes_sum"`.
- Nueva `ORACULO_INFLUX_ROUTER_PUB_TAG` default → `"router_pub"`.
- `.env` dev: `ORACULO_INFLUX_IN_BYTES_FIELD=download_bytes_sum`,
  `ORACULO_INFLUX_OUT_BYTES_FIELD=upload_bytes_sum`.

## Cambios frontend — [`beholder_frontend/src/components/BeholderHistory.tsx`](beholder_frontend/src/components/BeholderHistory.tsx)

1. Estado nuevo `resumen` (`ResumenTrafico | null`).
2. Parseo de tráfico: el endpoint ahora devuelve `{ puntos, resumen }`:
   ```ts
   const data = await traficoResponse.json();
   setTrafico(data.puntos ?? []);
   setResumen(data.resumen ?? null);
   ```
   (aplicar en `handleLoadHistory` y `handleRangeChange`).
3. Rótulo de resumen sobre el gráfico:
   - Total descargado / Total subido (formatear bytes → MB/GB).
   - Pico descarga / Pico subida (Mbps).
4. Helper `formatBytes(bytes)` (B/KB/MB/GB).
5. Mantener robustez: si `trafico` falla o viene vacío, las sesiones siguen mostrándose.

## Verificación

1. `python3 -c "import ast; ast.parse(...)"` sobre `oraculo.py` y `config.py`.
2. Greps: sin `in_bytes_sum`/`out_bytes_sum`, `src`/`dst`, `sentido`; sí con
   `download_bytes_sum`, `upload_bytes_sum`, `router_pub`.
3. Generar queries Flux (15m y 24h) y validar bucket/fields/tags/conversión.
4. Reiniciar `emerald_backend_dev` (solo dev).
5. Smoke test:
   - `GET /api/v1/oraculo/sesiones/{usuario}` → sigue devolviendo sesiones (validar el
     reporte de "lista de sesiones dejó de mostrarse").
   - `GET /api/v1/oraculo/trafico-pppoe/{usuario}?rango=15m` → `{ puntos, resumen }`.
   - `GET /api/v1/oraculo/debug` → influx + graylog OK.
6. Frontend: `cd beholder_frontend && npm run build`.

## Fuera de alcance

- No se tocan prod/staging (solo dev).
- No se agregan librerías.
- La ingesta de Telegraf sigue siendo responsabilidad de infraestructura.
