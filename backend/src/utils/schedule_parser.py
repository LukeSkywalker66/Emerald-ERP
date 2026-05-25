"""
Utilidades para traducir entre schedule_config (estructurado) y cron_expression.

Proporciona:
- schedule_config_to_cron()   → Config visual → cron de 5 campos para Celery Beat
- cron_to_schedule_config()   → Cron existente → config estructurada (backfill)
- cron_to_human_readable()    → Cron → descripción legible para la UI
"""

import re
from typing import Optional

DAYS_OF_WEEK_ES = {
    0: "domingo",
    1: "lunes",
    2: "martes",
    3: "miércoles",
    4: "jueves",
    5: "viernes",
    6: "sábado",
}

DAYS_OF_WEEK_SHORT_ES = {
    0: "Dom",
    1: "Lun",
    2: "Mar",
    3: "Mié",
    4: "Jue",
    5: "Vie",
    6: "Sáb",
}


def schedule_config_to_cron(config: dict) -> str:
    """Traduce un schedule_config estructurado a expresión cron de 5 campos.

    Args:
        config: Diccionario con la configuración estructurada.
                Ej: {"type": "daily", "times": ["03:00"]}
                     {"type": "interval_minutes", "value": 30}

    Returns:
        Expresión cron de 5 campos: "minuto hora día_mes mes día_semana"

    Raises:
        ValueError: Si el tipo es desconocido o faltan parámetros.
    """
    if not config or "type" not in config:
        raise ValueError("schedule_config debe contener al menos 'type'")

    t = config["type"]

    if t == "interval_minutes":
        value = config.get("value", 30)
        return f"*/{value} * * * *"

    elif t == "interval_hours":
        value = config.get("value", 1)
        return f"0 */{value} * * *"

    elif t == "daily":
        times = config.get("times", ["00:00"])
        # Combinar múltiples horarios: "0 8,20 * * *"
        minutes = times[0].split(":")[1]
        hours = ",".join(t.split(":")[0] for t in times)
        # Todos deben tener los mismos minutos
        return f"{minutes} {hours} * * *"

    elif t == "weekly":
        days = config.get("days", [1])  # [1,3,5] = Lun, Mié, Vie
        time = config.get("time", "08:00")
        hour, minute = time.split(":")
        days_str = ",".join(str(d) for d in sorted(days))
        return f"{minute} {hour} * * {days_str}"

    elif t == "custom_cron":
        expression = config.get("expression", "0 * * * *")
        # Validar que sea una expresión de 5 campos
        parts = expression.strip().split()
        if len(parts) != 5:
            raise ValueError(
                f"Expresión cron inválida: '{expression}'. "
                "Debe tener 5 campos separados por espacio."
            )
        return expression

    raise ValueError(f"Tipo de schedule desconocido: '{t}'")


def cron_to_schedule_config(cron: str) -> dict:
    """Traduce una expresión cron de 5 campos a schedule_config estructurado.

    Intenta inferir el mejor tipo de schedule según el patrón del cron.
    Útil para backfill de datos existentes y para mostrar configuración
    existente en la UI.

    Args:
        cron: Expresión cron de 5 campos (ej: "0 3 * * *")

    Returns:
        Diccionario schedule_config.
    """
    if not cron:
        return {"type": "custom_cron", "expression": "0 * * * *"}

    cron = cron.strip()
    parts = cron.split()

    if len(parts) != 5:
        return {"type": "custom_cron", "expression": cron}

    minute, hour, dom, month, dow = parts

    # --- Detectar "*/N * * * *" → interval_minutes ---
    if (
        minute.startswith("*/")
        and hour == "*"
        and dom == "*"
        and month == "*"
        and dow == "*"
    ):
        return {
            "type": "interval_minutes",
            "value": int(minute[2:]),
        }

    # --- Detectar "0 */N * * *" → interval_hours ---
    if (
        minute == "0"
        and hour.startswith("*/")
        and dom == "*"
        and month == "*"
        and dow == "*"
    ):
        return {
            "type": "interval_hours",
            "value": int(hour[2:]),
        }

    # --- Detectar "MM HH * * *" → daily (posiblemente multi-horario) ---
    # Si hay coma en hour: "0 8,20 * * *" → múltiples horarios
    if dom == "*" and month == "*" and dow == "*":
        if "," in hour:
            times = [f"{h.zfill(2)}:{minute.zfill(2)}" for h in hour.split(",")]
        else:
            times = [f"{hour.zfill(2)}:{minute.zfill(2)}"]
        return {"type": "daily", "times": times}

    # --- Detectar "MM HH * * DOW" → weekly ---
    if dom == "*" and month == "*" and dow != "*":
        days = []
        for part in dow.split(","):
            try:
                days.append(int(part))
            except ValueError:
                # Rango como "1-5", convertir a lista
                if "-" in part:
                    start, end = part.split("-")
                    days.extend(range(int(start), int(end) + 1))
        return {
            "type": "weekly",
            "days": sorted(set(days)),
            "time": f"{hour.zfill(2)}:{minute.zfill(2)}",
        }

    # --- Fallback: custom_cron ---
    return {"type": "custom_cron", "expression": cron}


def cron_to_human_readable(cron: Optional[str]) -> str:
    """Convierte una expresión cron a descripción legible en español.

    Args:
        cron: Expresión cron de 5 campos o None.

    Returns:
        Cadena descriptiva en español.
        Ej: "Diario a las 3:00 AM"
            "Cada 30 minutos"
            "Lunes, Miércoles y Viernes a las 14:30"
    """
    if not cron:
        return "No configurado"

    cron = cron.strip()
    parts = cron.split()

    if len(parts) != 5:
        return f"Cron: {cron}"

    minute, hour, dom, month, dow = parts

    # --- Cada N minutos ---
    if minute.startswith("*/") and hour == "*" and dom == "*" and month == "*" and dow == "*":
        return f"Cada {minute[2:]} minutos"

    # --- Cada N horas ---
    if minute == "0" and hour.startswith("*/") and dom == "*" and month == "*" and dow == "*":
        val = hour[2:]
        return f"Cada {val} hora{'s' if val != '1' else ''}"

    # --- Diario ---
    if dom == "*" and month == "*" and dow == "*":
        if "," in hour:
            times = ", ".join(_format_time(f"{h}:{minute}") for h in hour.split(","))
            return f"Diario a las {times}"
        return f"Diario a las {_format_time(f'{hour}:{minute}')}"

    # --- Semanal ---
    if dom == "*" and month == "*" and dow != "*":
        day_names = []
        for part in dow.split(","):
            try:
                d = int(part)
                day_names.append(DAYS_OF_WEEK_SHORT_ES.get(d, str(d)))
            except ValueError:
                day_names.append(part)
        days_str = ", ".join(day_names)
        return f"{days_str} a las {_format_time(f'{hour}:{minute}')}"

    # --- Día específico del mes ---
    if dom != "*" and dom != "*" and month == "*" and dow == "*":
        return f"Día {dom} del mes a las {_format_time(f'{hour}:{minute}')}"

    return f"Cron: {cron}"


def _format_time(time_str: str) -> str:
    """Formatea HH:MM a formato legible con AM/PM."""
    try:
        parts = time_str.split(":")
        h = int(parts[0])
        m = parts[1]
        suffix = "AM" if h < 12 else "PM"
        if h == 0:
            h12 = 12
        elif h > 12:
            h12 = h - 12
        else:
            h12 = h
        return f"{h12}:{m} {suffix}"
    except (ValueError, IndexError):
        return time_str
