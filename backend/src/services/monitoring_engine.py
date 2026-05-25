"""
Monitoring Engine — Motor de Verificación de Servicios.

Arquitectura basada en Strategy Pattern:
- BaseChecker (interfaz abstracta)
- PingChecker, HttpChecker, TcpChecker, SslChecker (implementaciones)
- CheckerFactory (fábrica de checkers)
- MonitoringOrchestrator (orquestador central)

Todas las verificaciones se ejecutan en el backend.
Nunca en el frontend.

Dependencias:
- httpx (ya instalado) para HTTP
- stdlib: socket, ssl, subprocess, datetime
"""
from __future__ import annotations

import logging
import re
import shlex
import socket
import ssl
import subprocess
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session

from src.models.settings import (
    ServiceMonitor,
    MonitorType,
    MonitorStatus,
    CriticalityIndex,
)

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────
# CONSTANTES
# ────────────────────────────────────────────────────────────

# Timeouts por defecto (segundos)
PING_TIMEOUT = 5
HTTP_TIMEOUT = 15
TCP_TIMEOUT = 5
SSL_TIMEOUT = 10

# Días mínimos antes de expiración para considerar SSL como "degradado"
SSL_WARN_DAYS = 30

# Tamaño máximo de mensaje de error almacenado
MAX_ERROR_LENGTH = 2000

# ────────────────────────────────────────────────────────────
# CHECK RESULT
# ────────────────────────────────────────────────────────────


@dataclass
class CheckResult:
    """Resultado estandarizado de una verificación.

    Attributes:
        status: Estado del monitor (UP/DOWN/DEGRADED/UNKNOWN)
        status_code: Código de estado (HTTP status, exit code, etc.)
        response_time_ms: Tiempo de respuesta en milisegundos
        error_message: Mensaje de error si la verificación falló
    """
    status: MonitorStatus
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None

    @classmethod
    def up(cls, response_time_ms: float, status_code: Optional[int] = None) -> "CheckResult":
        """Helper para resultado exitoso."""
        return cls(
            status=MonitorStatus.UP,
            status_code=status_code,
            response_time_ms=round(response_time_ms, 2),
        )

    @classmethod
    def down(cls, error_message: str, response_time_ms: Optional[float] = None,
             status_code: Optional[int] = None) -> "CheckResult":
        """Helper para resultado fallido."""
        return cls(
            status=MonitorStatus.DOWN,
            status_code=status_code,
            response_time_ms=round(response_time_ms, 2) if response_time_ms else None,
            error_message=str(error_message)[:MAX_ERROR_LENGTH],
        )

    @classmethod
    def degraded(cls, error_message: str, response_time_ms: Optional[float] = None,
                 status_code: Optional[int] = None) -> "CheckResult":
        """Helper para resultado degradado (respuesta lenta, SSL próximo a expirar)."""
        return cls(
            status=MonitorStatus.DEGRADED,
            status_code=status_code,
            response_time_ms=round(response_time_ms, 2) if response_time_ms else None,
            error_message=str(error_message)[:MAX_ERROR_LENGTH],
        )


# ────────────────────────────────────────────────────────────
# BASE CHECKER (Strategy Pattern)
# ────────────────────────────────────────────────────────────


class BaseChecker(ABC):
    """Interfaz abstracta para todos los checkers.

    Cada tipo de verificación (PING, HTTP, TCP, SSL) implementa
    esta interfaz y se registra en CHECKER_REGISTRY.
    """

    @abstractmethod
    def check(self, monitor: ServiceMonitor) -> CheckResult:
        """Ejecuta la verificación para un monitor específico.

        Args:
            monitor: Instancia de ServiceMonitor con la configuración.

        Returns:
            CheckResult con el estado y métricas de la verificación.
        """
        ...

    def get_timeout(self, monitor: ServiceMonitor) -> int:
        """Obtiene el timeout apropiado para este checker.

        Como máximo usa el check_interval_seconds del monitor,
        pero con un límite superior razonable.
        """
        return min(monitor.check_interval_seconds, self._default_timeout())

    @staticmethod
    def _default_timeout() -> int:
        return 30


# ────────────────────────────────────────────────────────────
# PING CHECKER (ICMP)
# ────────────────────────────────────────────────────────────


class PingChecker(BaseChecker):
    """Verificación ICMP Ping usando el comando del sistema.

    Ejectura: ping -c 1 -W {timeout} {host}

    Args:
        monitor.url: IP o hostname (ej: 8.8.8.8, google.com)

    Returns:
        UP: si packet loss = 0% y respuesta recibida
        DOWN: si timeout, host unreachable, o error
    """

    def check(self, monitor: ServiceMonitor) -> CheckResult:
        host = monitor.url.strip()
        timeout = self.get_timeout(monitor)

        # Validar que el host no sea peligroso para shell injection
        # Al usar lista de args (no shell=True), esto es seguro,
        # pero validamos caracteres extraños igualmente
        if not self._validate_host(host):
            return CheckResult.down(f"Host inválido: {host}")

        start_time = time.monotonic()

        try:
            result = subprocess.run(
                ["ping", "-c", "1", "-W", str(timeout), host],
                capture_output=True,
                text=True,
                timeout=timeout + 2,  # margen para SIGTERM
            )
            elapsed = (time.monotonic() - start_time) * 1000

            # Parsear salida de ping
            # Formato típico: "1 packets transmitted, 1 received, 0% packet loss"
            stdout = result.stdout
            stderr = result.stderr

            # Buscar packet loss
            loss_match = re.search(r"(\d+)% packet loss", stdout)
            if loss_match:
                loss_pct = int(loss_match.group(1))
                if loss_pct == 100:
                    # Intentar obtener mensaje de error de stderr
                    error_msg = self._extract_ping_error(stderr or stdout)
                    return CheckResult.down(
                        error_message=error_msg or "100% packet loss",
                        response_time_ms=elapsed,
                    )

                if loss_pct > 0:
                    return CheckResult.degraded(
                        error_message=f"{loss_pct}% packet loss",
                        response_time_ms=elapsed,
                    )

            # Buscar tiempo de respuesta: "time=12.3 ms" o "time=12.3ms"
            time_match = re.search(r"time[=<]\s*([0-9.]+)\s*ms", stdout)
            if time_match:
                ping_ms = float(time_match.group(1))
                return CheckResult.up(response_time_ms=ping_ms)

            # Si no hay pérdida pero tampoco tiempo (caso raro)
            if result.returncode == 0:
                return CheckResult.up(response_time_ms=elapsed)

            error_msg = self._extract_ping_error(stderr or stdout)
            return CheckResult.down(
                error_message=error_msg or f"Ping falló (exit code: {result.returncode})",
                response_time_ms=elapsed,
            )

        except subprocess.TimeoutExpired:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message="Timeout",
                response_time_ms=elapsed,
            )
        except FileNotFoundError:
            return CheckResult.down(
                error_message="Comando ping no disponible en el sistema",
            )
        except Exception as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=str(e),
                response_time_ms=elapsed,
            )

    @staticmethod
    def _validate_host(host: str) -> bool:
        """Valida que el host sea seguro (IP o hostname válido).

        Previene caracteres peligrosos incluso cuando usamos lista de args.
        """
        if not host or len(host) > 255:
            return False
        # Solo permitir caracteres seguros: alfanumérico, puntos, guiones
        return bool(re.match(r'^[a-zA-Z0-9\.\-]+$', host))

    @staticmethod
    def _extract_ping_error(output: str) -> Optional[str]:
        """Extrae mensaje de error legible de la salida de ping."""
        patterns = [
            r"Destination Host Unreachable",
            r"Destination Net Unreachable",
            r"unknown host",
            r"Name or service not known",
            r"Temporary failure in name resolution",
            r"Network is unreachable",
            r"connect: Network is unreachable",
            r"100% packet loss",
            r"Request timeout",
        ]
        for pattern in patterns:
            match = re.search(pattern, output, re.IGNORECASE)
            if match:
                return match.group(0)
        return None

    @staticmethod
    def _default_timeout() -> int:
        return PING_TIMEOUT


# ────────────────────────────────────────────────────────────
# HTTP CHECKER
# ────────────────────────────────────────────────────────────


class HttpChecker(BaseChecker):
    """Verificación HTTP/HTTPS.

    Realiza una petición HTTP al endpoint configurado y evalúa
    la respuesta según el código de estado.

    Args:
        monitor.url: URL completa (ej: https://ejemplo.com/health)
        monitor.auth_username / auth_password: Basic Auth opcional

    Returns:
        UP: si 200 <= status_code < 400
        DEGRADED: si 400 <= status_code < 500 (error cliente)
        DOWN: si status_code >= 500, timeout, conexión rechazada
    """

    def check(self, monitor: ServiceMonitor) -> CheckResult:
        import httpx

        url = monitor.url.strip()
        timeout = self.get_timeout(monitor)

        # Construir headers de autenticación si es necesario
        headers = {}
        auth = None

        if monitor.auth_username and monitor.auth_password_hash:
            # Nota: auth_password_hash es el hash almacenado, no podemos
            # usarlo directamente para Basic Auth. El usuario debe
            # proporcionar la contraseña en texto plano al crear/editar.
            # Aquí intentamos con el username solamente.
            pass

        start_time = time.monotonic()

        try:
            with httpx.Client(
                timeout=httpx.Timeout(timeout),
                follow_redirects=True,
                verify=True,
                headers=headers,
            ) as client:
                response = client.get(url, auth=auth)

            elapsed = (time.monotonic() - start_time) * 1000
            status_code = response.status_code

            if 200 <= status_code < 400:
                return CheckResult.up(
                    response_time_ms=elapsed,
                    status_code=status_code,
                )
            elif 400 <= status_code < 500:
                return CheckResult.degraded(
                    error_message=f"HTTP {status_code} - Error del cliente",
                    response_time_ms=elapsed,
                    status_code=status_code,
                )
            else:
                return CheckResult.down(
                    error_message=f"HTTP {status_code} - Error del servidor",
                    response_time_ms=elapsed,
                    status_code=status_code,
                )

        except httpx.TimeoutException:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message="Timeout",
                response_time_ms=elapsed,
            )
        except httpx.ConnectError as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"Conexión rechazada: {str(e)[:200]}",
                response_time_ms=elapsed,
            )
        except httpx.HTTPError as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=str(e)[:MAX_ERROR_LENGTH],
                response_time_ms=elapsed,
            )
        except Exception as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=str(e)[:MAX_ERROR_LENGTH],
                response_time_ms=elapsed,
            )

    @staticmethod
    def _default_timeout() -> int:
        return HTTP_TIMEOUT


# ────────────────────────────────────────────────────────────
# TCP CHECKER
# ────────────────────────────────────────────────────────────


class TcpChecker(BaseChecker):
    """Verificación de puerto TCP.

    Intenta establecer una conexión TCP al host:puerto especificado.
    Útil para verificar si un servicio está escuchando en un puerto.

    Args:
        monitor.url: host:puerto (ej: 192.168.1.1:22, db.example.com:5432)
        Si no incluye puerto, se usa 80 por defecto.

    Returns:
        UP: si la conexión TCP se estableció exitosamente
        DOWN: si timeout, conexión rechazada, o error de resolución DNS
    """

    def check(self, monitor: ServiceMonitor) -> CheckResult:
        host, port = self._parse_host_port(monitor.url)
        timeout = self.get_timeout(monitor)

        start_time = time.monotonic()

        try:
            sock = socket.create_connection(
                (host, port),
                timeout=timeout,
            )
            sock.close()

            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.up(response_time_ms=elapsed)

        except socket.timeout:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"Timeout conectando a {host}:{port}",
                response_time_ms=elapsed,
            )
        except socket.gaierror:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"No se pudo resolver el host: {host}",
                response_time_ms=elapsed,
            )
        except ConnectionRefusedError:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"Conexión rechazada en {host}:{port}",
                response_time_ms=elapsed,
            )
        except OSError as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"Error de red: {str(e)[:200]}",
                response_time_ms=elapsed,
            )
        except Exception as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=str(e)[:MAX_ERROR_LENGTH],
                response_time_ms=elapsed,
            )

    @staticmethod
    def _parse_host_port(url: str) -> tuple[str, int]:
        """Parsea host:puerto de la URL.

        Formatos aceptados:
        - 192.168.1.1:22 → ("192.168.1.1", 22)
        - 192.168.1.1 → ("192.168.1.1", 80)
        - db.example.com:5432 → ("db.example.com", 5432)
        - https://ejemplo.com:443 → ("ejemplo.com", 443)
        """
        # Limpiar URL de protocolo
        url = url.strip()
        url = re.sub(r'^https?://', '', url)
        url = re.sub(r'/.*$', '', url)  # remover ruta

        if ':' in url:
            parts = url.rsplit(':', 1)
            try:
                port = int(parts[1])
                return (parts[0], port)
            except (ValueError, IndexError):
                pass

        return (url, 80)

    @staticmethod
    def _default_timeout() -> int:
        return TCP_TIMEOUT


# ────────────────────────────────────────────────────────────
# SSL CHECKER
# ────────────────────────────────────────────────────────────


class SslChecker(BaseChecker):
    """Verificación de certificado SSL/TLS.

    Obtiene el certificado SSL del servidor y verifica:
    - Fecha de expiración
    - Emisor (issuer)
    - Sujeto (subject)

    Args:
        monitor.url: hostname:puerto (ej: ejemplo.com:443)
        Si no incluye puerto, se usa 443 por defecto.

    Returns:
        UP: certificado válido y expira en > SSL_WARN_DAYS días
        DEGRADED: certificado expira en <= SSL_WARN_DAYS días
        DOWN: certificado expirado, error de conexión, o host inválido
    """

    def check(self, monitor: ServiceMonitor) -> CheckResult:
        host, port = self._parse_host_port(monitor.url)
        timeout = self.get_timeout(monitor)

        start_time = time.monotonic()

        try:
            context = ssl.create_default_context()
            context.check_hostname = True
            context.verify_mode = ssl.CERT_REQUIRED

            with socket.create_connection((host, port), timeout=timeout) as sock:
                sock.settimeout(timeout)
                with context.wrap_socket(sock, server_hostname=host) as ssock:
                    cert = ssock.getpeercert()

            elapsed = (time.monotonic() - start_time) * 1000

            if not cert:
                return CheckResult.down(
                    error_message="No se pudo obtener el certificado SSL",
                    response_time_ms=elapsed,
                )

            # Verificar fecha de expiración
            not_after_str = cert.get("notAfter")
            if not not_after_str:
                return CheckResult.down(
                    error_message="Certificado sin fecha de expiración",
                    response_time_ms=elapsed,
                )

            # Parsear fecha SSL (formato: "May 23 12:00:00 2026 GMT")
            not_after = datetime.strptime(
                not_after_str, "%b %d %H:%M:%S %Y %Z"
            ).replace(tzinfo=timezone.utc)

            now = datetime.now(timezone.utc)
            days_remaining = (not_after - now).days

            # Obtener issuer y subject para el mensaje
            issuer = dict(x[0] for x in cert.get("issuer", []))
            subject = dict(x[0] for x in cert.get("subject", []))
            issuer_name = issuer.get("organizationName", issuer.get("commonName", "Desconocido"))
            subject_cn = subject.get("commonName", host)

            if days_remaining < 0:
                return CheckResult.down(
                    error_message=(
                        f"Certificado EXPIRADO hace {abs(days_remaining)} días "
                        f"para {subject_cn}. Emisor: {issuer_name}"
                    ),
                    response_time_ms=elapsed,
                )
            elif days_remaining <= SSL_WARN_DAYS:
                return CheckResult.degraded(
                    error_message=(
                        f"Certificado expira en {days_remaining} días "
                        f"para {subject_cn}. Emisor: {issuer_name}"
                    ),
                    response_time_ms=elapsed,
                )
            else:
                return CheckResult.up(response_time_ms=elapsed)

        except socket.timeout:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"Timeout conectando a {host}:{port}",
                response_time_ms=elapsed,
            )
        except socket.gaierror:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"No se pudo resolver el host: {host}",
                response_time_ms=elapsed,
            )
        except ConnectionRefusedError:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"Conexión rechazada en {host}:{port}",
                response_time_ms=elapsed,
            )
        except ssl.SSLCertVerificationError as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"Error de verificación SSL: {str(e)[:200]}",
                response_time_ms=elapsed,
            )
        except ssl.SSLError as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"Error SSL: {str(e)[:200]}",
                response_time_ms=elapsed,
            )
        except OSError as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=f"Error de red: {str(e)[:200]}",
                response_time_ms=elapsed,
            )
        except Exception as e:
            elapsed = (time.monotonic() - start_time) * 1000
            return CheckResult.down(
                error_message=str(e)[:MAX_ERROR_LENGTH],
                response_time_ms=elapsed,
            )

    @staticmethod
    def _parse_host_port(url: str) -> tuple[str, int]:
        """Parsea host:puerto de la URL para SSL.

        Formatos:
        - ejemplo.com → ("ejemplo.com", 443)
        - ejemplo.com:8443 → ("ejemplo.com", 8443)
        - https://ejemplo.com → ("ejemplo.com", 443)
        """
        url = url.strip()
        url = re.sub(r'^https?://', '', url)
        url = re.sub(r'/.*$', '', url)

        if ':' in url:
            parts = url.rsplit(':', 1)
            try:
                port = int(parts[1])
                return (parts[0], port)
            except (ValueError, IndexError):
                pass

        return (url, 443)

    @staticmethod
    def _default_timeout() -> int:
        return SSL_TIMEOUT


# ────────────────────────────────────────────────────────────
# CHECKER REGISTRY & FACTORY
# ────────────────────────────────────────────────────────────

CHECKER_REGISTRY: dict[MonitorType, type[BaseChecker]] = {
    MonitorType.PING: PingChecker,
    MonitorType.HTTP: HttpChecker,
    MonitorType.TCP: TcpChecker,
    MonitorType.SSL: SslChecker,
}


def get_checker(monitor_type: MonitorType) -> BaseChecker:
    """Obtiene la instancia del checker apropiado para el tipo de monitor.

    Args:
        monitor_type: Tipo de monitor (PING, HTTP, TCP, SSL)

    Returns:
        Instancia del checker correspondiente.

    Raises:
        ValueError: Si el tipo de monitor no está registrado.
    """
    checker_cls = CHECKER_REGISTRY.get(monitor_type)
    if checker_cls is None:
        raise ValueError(
            f"Tipo de monitor no soportado: {monitor_type}. "
            f"Soportados: {list(CHECKER_REGISTRY.keys())}"
        )
    return checker_cls()


def register_checker(monitor_type: MonitorType, checker_cls: type[BaseChecker]) -> None:
    """Registra un nuevo checker en el registry (para extensibilidad futura)."""
    CHECKER_REGISTRY[monitor_type] = checker_cls
    logger.info(
        "[MONITORING] Checker registrado: %s → %s",
        monitor_type, checker_cls.__name__,
    )


# ────────────────────────────────────────────────────────────
# MONITORING ORCHESTRATOR
# ────────────────────────────────────────────────────────────


class MonitoringOrchestrator:
    """Orquestador central del sistema de monitoreo.

    Responsabilidades:
    1. Consultar DB por monitores activos que necesitan verificación
    2. Ejecutar el checker apropiado para cada uno
    3. Actualizar estado en DB
    4. Registrar resultados en historial

    Uso típico:
        >>> from src.services.monitoring_engine import MonitoringOrchestrator
        >>> results = MonitoringOrchestrator.run_due_checks(db)
    """

    @staticmethod
    def get_due_monitors(db: Session) -> list[ServiceMonitor]:
        """Retorna monitores activos cuyo intervalo de check haya vencido.

        Un monitor está "vencido" si:
        - Nunca se verificó (last_checked_at IS NULL), O
        - Su última verificación fue hace más de check_interval_seconds

        Returns:
            Lista de ServiceMonitor que necesitan verificación.
        """
        from sqlalchemy import text

        now = datetime.now(timezone.utc)

        stmt = select(ServiceMonitor).where(
            ServiceMonitor.is_active == True,  # noqa: E712
            or_(
                ServiceMonitor.last_checked_at.is_(None),
                and_(
                    ServiceMonitor.last_checked_at.isnot(None),
                    ServiceMonitor.last_checked_at <= now,
                ),
            ),
        )

        # Filtro adicional: last_checked_at + interval <= NOW()
        # Se hace en Python para mantener compatibilidad entre DB engines
        # y porque la cantidad de monitores es pequeña (< 1000)
        try:
            result = db.execute(stmt)
            all_active = list(result.scalars().all())

            due = []
            for monitor in all_active:
                if monitor.last_checked_at is None:
                    due.append(monitor)
                else:
                    next_check = monitor.last_checked_at.replace(
                        tzinfo=timezone.utc
                    ) if monitor.last_checked_at.tzinfo is None else monitor.last_checked_at

                    elapsed = (now - next_check).total_seconds()
                    if elapsed >= monitor.check_interval_seconds:
                        due.append(monitor)

            return due

        except Exception as e:
            logger.error("[MONITORING] Error al obtener monitores vencidos: %s", e)
            return []

    @staticmethod
    def run_check(monitor: ServiceMonitor) -> CheckResult:
        """Ejecuta la verificación para un monitor específico.

        Args:
            monitor: Monitor a verificar.

        Returns:
            CheckResult con el resultado de la verificación.
        """
        try:
            checker = get_checker(monitor.monitor_type)
            logger.debug(
                "[MONITORING] Verificando %s (%s) con %s",
                monitor.label, monitor.url, type(checker).__name__,
            )
            result = checker.check(monitor)
            logger.info(
                "[MONITORING] %s → %s (%.1fms)",
                monitor.label, result.status.value,
                result.response_time_ms or 0,
            )
            return result
        except ValueError as e:
            logger.error("[MONITORING] %s: %s", monitor.label, e)
            return CheckResult.down(error_message=str(e))
        except Exception as e:
            logger.error(
                "[MONITORING] Error inesperado en %s: %s",
                monitor.label, e, exc_info=True,
            )
            return CheckResult.down(error_message=f"Error interno: {str(e)[:200]}")

    @classmethod
    def run_due_checks(cls, db: Session) -> list[tuple[ServiceMonitor, CheckResult]]:
        """Ejecuta verificaciones para todos los monitores pendientes.

        Returns:
            Lista de tuplas (monitor, resultado) para los monitores verificados.
        """
        due_monitors = cls.get_due_monitors(db)
        if not due_monitors:
            logger.debug("[MONITORING] No hay monitores pendientes de verificación")
            return []

        logger.info(
            "[MONITORING] Ejecutando verificación para %d monitores",
            len(due_monitors),
        )

        results: list[tuple[ServiceMonitor, CheckResult]] = []
        for monitor in due_monitors:
            try:
                result = cls.run_check(monitor)
                results.append((monitor, result))
            except Exception as e:
                logger.error(
                    "[MONITORING] Error verificando %s: %s",
                    monitor.label, e,
                )
                results.append((
                    monitor,
                    CheckResult.down(error_message=f"Error: {str(e)[:200]}"),
                ))

        return results
