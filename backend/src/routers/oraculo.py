import asyncio
import csv
import io
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from influxdb_client.client.influxdb_client import InfluxDBClient
from pydantic import BaseModel

from src import config
from src.db.postgres import Database


def _require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if not config.API_KEY:
        raise HTTPException(status_code=500, detail="API key no configurada en servidor")
    if x_api_key != config.API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")


router = APIRouter(
    prefix="/api/v1/oraculo",
    tags=["oraculo"],
    dependencies=[Depends(_require_api_key)],
)


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


class SesionCliente(BaseModel):
    inicio: str
    fin: Optional[str] = None
    duracion: str
    ip_cliente: Optional[str] = None
    mac_address: Optional[str] = None
    razon_desconexion: Optional[str] = None
    router: str


class ProbeResult(BaseModel):
    ok: bool
    time_sec: float
    detail: str


class OraculoDebugResponse(BaseModel):
    influx: ProbeResult
    graylog: ProbeResult


class SesionIpCliente(BaseModel):
    inicio: str
    fin: Optional[str] = None
    ip_cliente: Optional[str] = None
    mac_address: Optional[str] = None
    router: str
    razon_desconexion: Optional[str] = None


_RANGE_SECONDS = {
    "15m": 15 * 60,
    "30m": 30 * 60,
    "60m": 60 * 60,
    "12h": 12 * 60 * 60,
    "24h": 24 * 60 * 60,
    "7d": 7 * 24 * 60 * 60,
    "30d": 30 * 24 * 60 * 60,
}

_GRAYLOG_SESSION_CACHE: dict[str, tuple[float, list[SesionIpCliente]]] = {}
_GRAYLOG_SESSION_CACHE_LOCK = asyncio.Lock()
_REQUEST_LOGGER = logging.getLogger("uvicorn.error")


def _is_transient_error(exc: Exception) -> bool:
    text = str(exc).lower()
    markers = (
        "timed out",
        "timeout",
        "connection refused",
        "failed to establish a new connection",
        "max retries exceeded",
        "temporarily unavailable",
        "connection reset",
    )
    return any(marker in text for marker in markers)


def _sleep_with_backoff(attempt: int) -> None:
    base = max(config.ORACULO_RETRY_BACKOFF_SEC, 0.0)
    multiplier = max(config.ORACULO_RETRY_BACKOFF_MULTIPLIER, 1.0)
    delay = base * (multiplier ** max(attempt - 1, 0))
    if delay > 0:
        time.sleep(delay)


def _resolve_influx_node_ip(router_ip: Optional[str]) -> Optional[str]:
    if not router_ip:
        return None

    router_ip = router_ip.strip()
    if not router_ip:
        return None

    return config.ORACULO_NODO_IP_MAP.get(router_ip, router_ip)


def _merge_traffic_points(points: list[TraficoPunto]) -> list[TraficoPunto]:
    merged: dict[str, TraficoPunto] = {}
    for point in points:
        current = merged.get(point.tiempo)
        if current is None:
            merged[point.tiempo] = point
            continue

        merged[point.tiempo] = TraficoPunto(
            tiempo=point.tiempo,
            descarga_mbps=round(current.descarga_mbps + point.descarga_mbps, 4),
            subida_mbps=round(current.subida_mbps + point.subida_mbps, 4),
            descarga_bytes=current.descarga_bytes + point.descarga_bytes,
            subida_bytes=current.subida_bytes + point.subida_bytes,
        )

    return [merged[key] for key in sorted(merged.keys())]


def _build_influx_interval_query(
    ip_cliente: str,
    router_pub: str,
    rango: str,
    start_iso: str,
    stop_iso: str,
) -> str:
    raw_bucket = config.ORACULO_INFLUX_RAW_BUCKET
    resumen_bucket = config.ORACULO_INFLUX_RESUMEN_BUCKET
    raw_measurement = config.ORACULO_INFLUX_RAW_MEASUREMENT
    resumen_measurement = config.ORACULO_INFLUX_RESUMEN_MEASUREMENT
    in_bytes_field = config.ORACULO_INFLUX_IN_BYTES_FIELD
    out_bytes_field = config.ORACULO_INFLUX_OUT_BYTES_FIELD
    ip_tag = config.ORACULO_INFLUX_RESUMEN_IP_TAG
    router_tag = config.ORACULO_INFLUX_ROUTER_PUB_TAG

    rango_segundos = _RANGE_SECONDS.get(rango)
    if not rango_segundos:
        raise HTTPException(status_code=400, detail=f"Rango no soportado: {rango}")

    if rango_segundos <= 6 * 60 * 60:
        bucket = raw_bucket
        measurement = raw_measurement
        window = "1m"
        window_seconds = 60
    else:
        bucket = resumen_bucket
        measurement = resumen_measurement
        window = "5m"
        window_seconds = 300

    router_clause = f' and r["{router_tag}"] == "{router_pub}"' if router_pub else ""

    return f'''
ip = "{ip_cliente}"

from(bucket: "{bucket}")
    |> range(start: time(v: "{start_iso}"), stop: time(v: "{stop_iso}"))
    |> filter(fn: (r) => r["_measurement"] == "{measurement}" and (r["_field"] == "{in_bytes_field}" or r["_field"] == "{out_bytes_field}") and r["{ip_tag}"] == ip{router_clause})
    |> aggregateWindow(every: {window}, fn: sum, createEmpty: false)
    |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    |> map(fn: (r) => ({{
    _time: r._time,
    descarga_bytes: (if exists r["{in_bytes_field}"] then float(v: r["{in_bytes_field}"]) else 0.0),
    subida_bytes: (if exists r["{out_bytes_field}"] then float(v: r["{out_bytes_field}"]) else 0.0),
    descarga_mbps: (if exists r["{in_bytes_field}"] then float(v: r["{in_bytes_field}"]) else 0.0) * 8.0 / {window_seconds}.0 / 1000000.0,
    subida_mbps: (if exists r["{out_bytes_field}"] then float(v: r["{out_bytes_field}"]) else 0.0) * 8.0 / {window_seconds}.0 / 1000000.0
    }}))
    |> keep(columns: ["_time", "descarga_mbps", "subida_mbps", "descarga_bytes", "subida_bytes"])
    |> sort(columns: ["_time"], desc: false)
'''


def _query_influx_interval(
    ip_cliente: str,
    router_pub: str,
    rango: str,
    start_iso: str,
    stop_iso: str,
) -> list[TraficoPunto]:
    influx_url = config.ORACULO_INFLUX_URL
    influx_token = config.ORACULO_INFLUX_TOKEN
    influx_org = config.ORACULO_INFLUX_ORG
    timeout_ms = config.ORACULO_INFLUX_TIMEOUT_MS

    if not influx_url or not influx_token or not influx_org:
        raise HTTPException(status_code=500, detail="Credenciales de InfluxDB incompletas")

    flux_query = _build_influx_interval_query(ip_cliente, router_pub, rango, start_iso, stop_iso)

    attempts = max(config.ORACULO_RETRY_ATTEMPTS, 1)
    last_exc: Optional[Exception] = None
    tables = []
    for attempt in range(1, attempts + 1):
        try:
            with InfluxDBClient(url=influx_url, token=influx_token, org=influx_org, timeout=timeout_ms) as client:
                tables = client.query_api().query(query=flux_query, org=influx_org)
            last_exc = None
            break
        except Exception as exc:
            last_exc = exc
            should_retry = attempt < attempts and _is_transient_error(exc)
            if should_retry:
                _sleep_with_backoff(attempt)
                continue
            raise HTTPException(status_code=502, detail=f"Fallo consultando InfluxDB: {exc}") from exc

    if last_exc is not None:
        raise HTTPException(status_code=502, detail=f"Fallo consultando InfluxDB: {last_exc}") from last_exc

    puntos: list[TraficoPunto] = []
    for table in tables:
        for record in table.records:
            timestamp = record.get_time()
            if timestamp is None:
                continue

            descarga_raw = record.values.get("descarga_mbps")
            subida_raw = record.values.get("subida_mbps")
            descarga = float(descarga_raw) if descarga_raw is not None else 0.0
            subida = float(subida_raw) if subida_raw is not None else 0.0
            descarga_bytes_raw = record.values.get("descarga_bytes")
            subida_bytes_raw = record.values.get("subida_bytes")
            descarga_bytes = int(float(descarga_bytes_raw)) if descarga_bytes_raw is not None else 0
            subida_bytes = int(float(subida_bytes_raw)) if subida_bytes_raw is not None else 0
            puntos.append(
                TraficoPunto(
                    tiempo=timestamp.isoformat(),
                    descarga_mbps=round(descarga, 4),
                    subida_mbps=round(subida, 4),
                    descarga_bytes=descarga_bytes,
                    subida_bytes=subida_bytes,
                )
            )

    return puntos


def _query_graylog_raw(usuario_pppoe: str, limite: int, range_sec: Optional[int] = None) -> list[dict]:
    graylog_url = config.ORACULO_GRAYLOG_URL
    graylog_user = config.ORACULO_GRAYLOG_USER
    graylog_password = config.ORACULO_GRAYLOG_PASSWORD
    timeout_sec = config.ORACULO_GRAYLOG_TIMEOUT_SEC

    if not graylog_url or not graylog_user or not graylog_password:
        raise HTTPException(status_code=500, detail="Credenciales de Graylog incompletas")

    endpoint = f"{graylog_url.rstrip('/')}/api/search/universal/relative"
    fetch_limit = min(max(limite * 8, 200), 5000)
    params = {
        "query": f'"{usuario_pppoe}" AND pppoe_action:*',
        "range": range_sec if range_sec is not None else config.ORACULO_GRAYLOG_RANGE_SEC,
        "limit": fetch_limit,
        "sort": config.ORACULO_GRAYLOG_SORT,
        "fields": config.ORACULO_GRAYLOG_FIELDS,
    }

    attempts = max(config.ORACULO_RETRY_ATTEMPTS, 1)
    last_exc: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.get(
                endpoint,
                params=params,
                auth=(graylog_user, graylog_password),
                headers={"X-Requested-By": "beholder-oraculo", "Accept": "application/json, text/csv"},
                timeout=timeout_sec,
            )
            response.raise_for_status()

            content_type = (response.headers.get("Content-Type") or "").lower()
            body = response.text or ""

            if "application/json" in content_type:
                if not body.strip():
                    return []
                payload = response.json()
                return payload.get("messages", [])

            if "text/csv" in content_type or body.lstrip().startswith("timestamp"):
                if not body.strip():
                    return []

                records: list[dict] = []
                reader = csv.DictReader(io.StringIO(body))
                for row in reader:
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
                return records

            if not body.strip():
                return []

            raise HTTPException(
                status_code=502,
                detail=f"Formato de respuesta Graylog no soportado: {content_type or 'desconocido'}",
            )
        except HTTPException:
            raise
        except requests.RequestException as exc:
            last_exc = exc
            should_retry = attempt < attempts and _is_transient_error(exc)
            if should_retry:
                _sleep_with_backoff(attempt)
                continue
            raise HTTPException(status_code=502, detail=f"Fallo consultando Graylog: {exc}") from exc
        except ValueError as exc:
            last_exc = exc
            should_retry = attempt < attempts and _is_transient_error(exc)
            if should_retry:
                _sleep_with_backoff(attempt)
                continue
            raise HTTPException(status_code=502, detail=f"Respuesta invalida de Graylog: {exc}") from exc

    if last_exc is not None:
        raise HTTPException(status_code=502, detail=f"Fallo consultando Graylog: {last_exc}") from last_exc
    return []


def _parse_graylog_timestamp(raw_timestamp: str) -> datetime:
    normalized = raw_timestamp.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _parse_graylog_evento(
    msg: dict,
) -> tuple[Optional[str], Optional[datetime], Optional[str], Optional[str], Optional[str], str]:
    """Devuelve (accion, timestamp, ip_cliente, mac_address, razon_desconexion, router)."""
    accion = str(msg.get("pppoe_action") or "").strip().lower()
    if accion not in ("logged in", "logged out"):
        return None, None, None, None, None, "Desconocido"

    timestamp_raw = msg.get("timestamp")
    if not timestamp_raw:
        return None, None, None, None, None, "Desconocido"

    try:
        timestamp = _parse_graylog_timestamp(str(timestamp_raw))
    except Exception:
        return None, None, None, None, None, "Desconocido"

    router = str(msg.get("router_ip") or "Desconocido")
    if accion == "logged in":
        return accion, timestamp, msg.get("framed_ip") or None, msg.get("mac_address") or None, None, router

    # "logged out" → fin de sesión
    return accion, timestamp, None, None, "Cierre de sesión", router


def _format_duration(start: datetime, end: datetime) -> str:
    total_seconds = int(max((end - start).total_seconds(), 0))
    days, remainder = divmod(total_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)

    if days > 0:
        return f"{days} d {hours} h {minutes} min"
    if hours > 0:
        return f"{hours} h {minutes} min"
    return f"{minutes} min"


def _pair_sessions(usuario_pppoe: str, graylog_messages: list[dict], limite: int) -> list[SesionCliente]:
    eventos: list[dict] = []

    for envelope in graylog_messages:
        msg = envelope.get("message", {})
        accion, ts, ip_cliente, mac_address, razon, router = _parse_graylog_evento(msg)
        if accion is None or ts is None:
            continue

        eventos.append(
            {
                "ts": ts,
                "is_login": accion == "logged in",
                "is_logout": accion == "logged out",
                "ip_cliente": ip_cliente,
                "mac_address": mac_address,
                "reason": razon,
                "router": router,
            }
        )

    eventos.sort(key=lambda e: e["ts"])

    sesiones: list[SesionCliente] = []
    logins_abiertos: list[dict] = []
    now = datetime.now(timezone.utc)

    for ev in eventos:
        if ev["is_login"]:
            logins_abiertos.append(ev)
            continue

        if ev["is_logout"]:
            if not logins_abiertos:
                continue

            inicio_ev = logins_abiertos.pop(0)
            inicio_ts = inicio_ev["ts"]
            fin_ts = ev["ts"]

            sesiones.append(
                SesionCliente(
                    inicio=inicio_ts.isoformat(),
                    fin=fin_ts.isoformat(),
                    duracion=_format_duration(inicio_ts, fin_ts),
                    ip_cliente=inicio_ev.get("ip_cliente"),
                    mac_address=inicio_ev.get("mac_address"),
                    razon_desconexion="Cierre de sesión",
                    router=ev.get("router") or inicio_ev.get("router") or "Desconocido",
                )
            )

    if logins_abiertos:
        inicio_ev = logins_abiertos[-1]
        inicio_ts = inicio_ev["ts"]
        sesiones.append(
            SesionCliente(
                inicio=inicio_ts.isoformat(),
                fin=None,
                duracion=_format_duration(inicio_ts, now),
                ip_cliente=inicio_ev.get("ip_cliente"),
                mac_address=inicio_ev.get("mac_address"),
                razon_desconexion=None,
                router=inicio_ev.get("router") or "Desconocido",
            )
        )

    sesiones.sort(key=lambda s: s.inicio, reverse=True)
    return sesiones[:limite]


def _query_graylog_session_windows(usuario_pppoe: str, limite: int, range_sec: Optional[int] = None) -> list[SesionIpCliente]:
    raw_messages = _query_graylog_raw(usuario_pppoe, limite, range_sec=range_sec)
    eventos: list[dict] = []

    for envelope in raw_messages:
        msg = envelope.get("message", {})
        accion, ts, ip_cliente, mac_address, razon, router = _parse_graylog_evento(msg)
        if accion is None or ts is None:
            continue

        eventos.append(
            {
                "inicio": ts.isoformat(),
                "ip_cliente": ip_cliente,
                "mac_address": mac_address,
                "router": router,
                "razon_desconexion": razon,
                "is_login": accion == "logged in",
                "is_logout": accion == "logged out",
            }
        )

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
                fin=None,
                ip_cliente=current_login.get("ip_cliente"),
                mac_address=current_login.get("mac_address"),
                router=current_login.get("router", "Desconocido"),
                razon_desconexion=None,
            )
        )

    return sesiones[:limite]


def _to_utc_datetime(raw_iso: str) -> Optional[datetime]:
    try:
        parsed = datetime.fromisoformat(raw_iso.replace("Z", "+00:00"))
    except Exception:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _normalize_pppoe_segments(
    sesiones: list[SesionIpCliente],
    rango_segundos: int,
) -> list[tuple[str, str, str, str]]:
    now = datetime.now(timezone.utc)
    rango_segundos = max(rango_segundos, 1)
    window_start = now - timedelta(seconds=rango_segundos)
    window_end = now

    prepared: list[tuple[str, str, datetime, datetime]] = []
    for sesion in sesiones:
        if not sesion.ip_cliente:
            continue

        router_pub = (sesion.router or "").strip()
        if not router_pub or router_pub == "Desconocido":
            continue

        start_dt = _to_utc_datetime(sesion.inicio)
        if not start_dt:
            continue

        end_dt = _to_utc_datetime(sesion.fin) if sesion.fin else None
        if not end_dt:
            end_dt = now

        if end_dt <= start_dt:
            continue

        clamped_start = max(start_dt, window_start)
        clamped_end = min(end_dt, window_end)
        if clamped_end <= clamped_start:
            continue

        prepared.append((sesion.ip_cliente.strip(), router_pub, clamped_start, clamped_end))

    if not prepared:
        return []

    prepared.sort(key=lambda row: (row[0], row[1], row[2], row[3]))
    merged: list[tuple[str, str, datetime, datetime]] = []
    for ip, router_pub, start_dt, end_dt in prepared:
        if not merged:
            merged.append((ip, router_pub, start_dt, end_dt))
            continue

        prev_ip, prev_router, prev_start, prev_end = merged[-1]
        if ip == prev_ip and router_pub == prev_router and start_dt <= (prev_end + timedelta(seconds=1)):
            merged[-1] = (prev_ip, prev_router, prev_start, max(prev_end, end_dt))
            continue

        merged.append((ip, router_pub, start_dt, end_dt))

    return [(ip, router_pub, start.isoformat(), end.isoformat()) for ip, router_pub, start, end in merged]


async def _get_cached_graylog_sessions(
    usuario_pppoe: str,
    limite: int,
    range_sec: int,
) -> tuple[list[SesionIpCliente], str]:
    cache_key = f"{usuario_pppoe.strip().lower()}|{limite}|{range_sec}"
    ttl_sec = max(config.ORACULO_GRAYLOG_SESSION_CACHE_TTL_SEC, 0)
    now_mono = time.monotonic()

    if ttl_sec == 0:
        sesiones = await asyncio.to_thread(_query_graylog_session_windows, usuario_pppoe, limite, range_sec)
        return sesiones, "bypass"

    if ttl_sec > 0:
        async with _GRAYLOG_SESSION_CACHE_LOCK:
            cached = _GRAYLOG_SESSION_CACHE.get(cache_key)
            if cached:
                created_at, sesiones = cached
                if now_mono - created_at <= ttl_sec:
                    return list(sesiones), "hit"
                _GRAYLOG_SESSION_CACHE.pop(cache_key, None)

    sesiones = await asyncio.to_thread(_query_graylog_session_windows, usuario_pppoe, limite, range_sec)

    async with _GRAYLOG_SESSION_CACHE_LOCK:
        _GRAYLOG_SESSION_CACHE[cache_key] = (time.monotonic(), list(sesiones))

    return sesiones, "miss"


async def _query_influx_interval_async(
    sem: asyncio.Semaphore,
    ip_cliente: str,
    router_pub: str,
    rango: str,
    start_iso: str,
    stop_iso: str,
) -> list[TraficoPunto]:
    async with sem:
        return await asyncio.to_thread(
            _query_influx_interval,
            ip_cliente,
            router_pub,
            rango,
            start_iso,
            stop_iso,
        )


def _resolve_pppoe_node_context(usuario_pppoe: str) -> tuple[Optional[str], Optional[str]]:
    db = Database()
    try:
        diagnosis = db.get_diagnosis(usuario_pppoe)
    except Exception as exc:
        config.logger.warning(
            "[ORACULO][NODO] No se pudo resolver nodo para %s: %s",
            usuario_pppoe,
            str(exc)[:180],
        )
        return None, None
    finally:
        db.close()

    nodo_ip = diagnosis.get("nodo_ip")
    nodo_influx_ip = _resolve_influx_node_ip(str(nodo_ip)) if nodo_ip else None
    return (str(nodo_ip) if nodo_ip else None, nodo_influx_ip)


async def _build_pppoe_traffic_series(
    usuario_pppoe: str,
    rango: str,
    limite: int = 100,
) -> tuple[TraficoSerie, dict[str, str | int | float]]:
    metrics: dict[str, str | int | float] = {
        "cache": "unknown",
        "segments": 0,
        "graylog_sec": 0.0,
        "influx_sec": 0.0,
    }

    nodo_origen_ip, nodo_influx_ip = _resolve_pppoe_node_context(usuario_pppoe)
    if nodo_origen_ip:
        config.logger.info(
            "[ORACULO][NODO] usuario=%s nodo_db=%s nodo_influx=%s",
            usuario_pppoe,
            nodo_origen_ip,
            nodo_influx_ip or "<sin mapeo>",
        )

    rango_segundos = _RANGE_SECONDS.get(rango, 0)
    graylog_range_sec = max(rango_segundos, config.ORACULO_GRAYLOG_RANGE_SEC)

    graylog_t0 = time.perf_counter()
    sesiones, cache_status = await _get_cached_graylog_sessions(usuario_pppoe, limite, graylog_range_sec)
    graylog_dt = time.perf_counter() - graylog_t0
    metrics["cache"] = cache_status
    metrics["graylog_sec"] = round(graylog_dt, 3)

    segmentos = _normalize_pppoe_segments(sesiones, rango_segundos)
    metrics["segments"] = len(segmentos)
    if not segmentos:
        return TraficoSerie(
            puntos=[],
            resumen=ResumenTrafico(
                total_descarga_bytes=0,
                total_subida_bytes=0,
                pico_descarga_mbps=0.0,
                pico_subida_mbps=0.0,
            ),
        ), metrics

    max_concurrency = max(config.ORACULO_INFLUX_MAX_CONCURRENCY, 1)
    sem = asyncio.Semaphore(max_concurrency)
    tasks = [
        _query_influx_interval_async(sem, ip_cliente, router_pub, rango, start_iso, stop_iso)
        for ip_cliente, router_pub, start_iso, stop_iso in segmentos
    ]

    influx_t0 = time.perf_counter()
    batches = await asyncio.gather(*tasks)
    influx_dt = time.perf_counter() - influx_t0
    metrics["influx_sec"] = round(influx_dt, 3)

    merged_points: list[TraficoPunto] = []
    for batch in batches:
        merged_points.extend(batch)

    puntos = _merge_traffic_points(merged_points)
    resumen = ResumenTrafico(
        total_descarga_bytes=sum(p.descarga_bytes for p in puntos),
        total_subida_bytes=sum(p.subida_bytes for p in puntos),
        pico_descarga_mbps=max((p.descarga_mbps for p in puntos), default=0.0),
        pico_subida_mbps=max((p.subida_mbps for p in puntos), default=0.0),
    )
    return TraficoSerie(puntos=puntos, resumen=resumen), metrics


def _probe_influx() -> ProbeResult:
    start = time.perf_counter()
    influx_url = config.ORACULO_INFLUX_URL
    influx_token = config.ORACULO_INFLUX_TOKEN
    influx_org = config.ORACULO_INFLUX_ORG

    if not influx_url or not influx_token or not influx_org:
        return ProbeResult(ok=False, time_sec=round(time.perf_counter() - start, 3), detail="Credenciales incompletas")

    try:
        with InfluxDBClient(url=influx_url, token=influx_token, org=influx_org, timeout=config.ORACULO_INFLUX_TIMEOUT_MS) as client:
            bucket = client.buckets_api().find_bucket_by_name(config.ORACULO_INFLUX_RESUMEN_BUCKET)
            if not bucket:
                return ProbeResult(
                    ok=False,
                    time_sec=round(time.perf_counter() - start, 3),
                    detail=f"Bucket no visible: {config.ORACULO_INFLUX_RESUMEN_BUCKET}",
                )
    except Exception as exc:
        return ProbeResult(ok=False, time_sec=round(time.perf_counter() - start, 3), detail=str(exc)[:200])

    return ProbeResult(ok=True, time_sec=round(time.perf_counter() - start, 3), detail="OK")


def _probe_graylog() -> ProbeResult:
    start = time.perf_counter()
    graylog_url = config.ORACULO_GRAYLOG_URL
    graylog_user = config.ORACULO_GRAYLOG_USER
    graylog_password = config.ORACULO_GRAYLOG_PASSWORD

    if not graylog_url or not graylog_user or not graylog_password:
        return ProbeResult(ok=False, time_sec=round(time.perf_counter() - start, 3), detail="Credenciales incompletas")

    endpoint = f"{graylog_url.rstrip('/')}/api/search/universal/relative"
    try:
        response = requests.get(
            endpoint,
            params={
                "query": "*",
                "range": 300,
                "limit": 1,
                "sort": config.ORACULO_GRAYLOG_SORT,
                "fields": config.ORACULO_GRAYLOG_FIELDS,
            },
            auth=(graylog_user, graylog_password),
            headers={"X-Requested-By": "beholder-oraculo"},
            timeout=config.ORACULO_GRAYLOG_TIMEOUT_SEC,
        )
        if response.status_code >= 400:
            return ProbeResult(
                ok=False,
                time_sec=round(time.perf_counter() - start, 3),
                detail=f"HTTP {response.status_code}",
            )
    except Exception as exc:
        return ProbeResult(ok=False, time_sec=round(time.perf_counter() - start, 3), detail=str(exc)[:200])

    return ProbeResult(ok=True, time_sec=round(time.perf_counter() - start, 3), detail="OK")


def _query_influx_trafico(ip_cliente: str, rango: str, router_pub: Optional[str] = None) -> list[TraficoPunto]:
    now = datetime.now(timezone.utc)
    rango_segundos = _RANGE_SECONDS.get(rango)
    if not rango_segundos:
        raise HTTPException(status_code=400, detail=f"Rango no soportado: {rango}")
    start_iso = (now - timedelta(seconds=rango_segundos)).isoformat()
    stop_iso = now.isoformat()
    return _query_influx_interval(ip_cliente, router_pub or "", rango, start_iso, stop_iso)


@router.get("/trafico/{ip_cliente}", response_model=list[TraficoPunto])
async def obtener_trafico_cliente(
    ip_cliente: str,
    rango: Literal["15m", "30m", "60m", "12h", "24h", "7d", "30d"] = Query(default="24h"),
    router_pub: Optional[str] = Query(default=None),
) -> list[TraficoPunto]:
    return await asyncio.to_thread(_query_influx_trafico, ip_cliente, rango, router_pub)


@router.get("/sesiones/{usuario_pppoe}", response_model=list[SesionCliente])
async def obtener_historial_sesiones(
    usuario_pppoe: str,
    limite: int = Query(default=20, ge=1, le=200),
) -> list[SesionCliente]:
    mensajes = await asyncio.to_thread(_query_graylog_raw, usuario_pppoe, limite)
    return _pair_sessions(usuario_pppoe, mensajes, limite)


@router.get("/trafico-pppoe/{usuario_pppoe}", response_model=TraficoSerie)
async def obtener_trafico_pppoe(
    usuario_pppoe: str,
    rango: Literal["15m", "30m", "60m", "12h", "24h", "7d", "30d"] = Query(default="24h"),
) -> TraficoSerie:
    total_t0 = time.perf_counter()
    status_code = 200
    points_count = 0
    metrics: dict[str, str | int | float] = {
        "cache": "unknown",
        "segments": 0,
        "graylog_sec": 0.0,
        "influx_sec": 0.0,
    }
    error_text = ""

    try:
        serie, metrics = await _build_pppoe_traffic_series(usuario_pppoe, rango)
        points_count = len(serie.puntos)
        return serie
    except HTTPException as exc:
        status_code = exc.status_code
        error_text = str(exc.detail)
        raise
    except Exception as exc:
        status_code = 500
        error_text = str(exc)
        raise
    finally:
        total_sec = round(time.perf_counter() - total_t0, 3)
        _REQUEST_LOGGER.info(
            "oraculo_pppoe_metrics user=%s rango=%s status=%s cache=%s segments=%s graylog_sec=%s influx_sec=%s total_sec=%s points=%s error=%s",
            usuario_pppoe,
            rango,
            status_code,
            metrics.get("cache", "unknown"),
            metrics.get("segments", 0),
            metrics.get("graylog_sec", 0.0),
            metrics.get("influx_sec", 0.0),
            total_sec,
            points_count,
            error_text[:180] if error_text else "-",
        )


@router.get("/debug", response_model=OraculoDebugResponse)
async def debug_oraculo() -> OraculoDebugResponse:
    influx = await asyncio.to_thread(_probe_influx)
    graylog = await asyncio.to_thread(_probe_graylog)
    return OraculoDebugResponse(influx=influx, graylog=graylog)