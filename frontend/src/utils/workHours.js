/**
 * workHours.js
 *
 * Utilidades compartidas para el horario de visitas técnicas (work_hours).
 *
 * El dato puede venir en dos formatos:
 *  - Legado: objeto plano { morning_start, morning_end, afternoon_start, afternoon_end }
 *  - Versionado: array de { effective_from, morning_start, ... } con vigencia por fecha
 *
 * Las funciones de este módulo normalizan ambos formatos y resuelven el
 * horario efectivo para una fecha determinada.
 */

export const DEFAULT_WORK_HOURS = {
  morning_start: '08:00',
  morning_end: '13:00',
  afternoon_start: '15:00',
  afternoon_end: '19:00',
};

export function timeToMinutes(timeStr) {
  const [hours, minutes] = String(timeStr || '00:00').split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesToTime(minutes) {
  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Convierte un valor work_hours (objeto legado o array versionado) en una
 * lista normalizada de vigencias ordenadas de más reciente a más antigua.
 */
export function normalizeWorkHoursSchedule(value) {
  if (Array.isArray(value)) {
    const entries = value
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => ({
        ...DEFAULT_WORK_HOURS,
        ...entry,
        effective_from: entry.effective_from || null,
      }));
    return entries.sort((a, b) =>
      String(b.effective_from || '').localeCompare(String(a.effective_from || ''))
    );
  }

  if (value && typeof value === 'object') {
    return [{ ...DEFAULT_WORK_HOURS, ...value, effective_from: null }];
  }

  return [{ ...DEFAULT_WORK_HOURS, effective_from: null }];
}

/**
 * Resuelve el horario efectivo para una fecha (YYYY-MM-DD).
 * Elige la vigencia con mayor effective_from <= fecha.
 */
export function resolveWorkHoursForDate(value, dateStr) {
  const schedule = normalizeWorkHoursSchedule(value);
  const target = String(dateStr || '').slice(0, 10);

  for (const entry of schedule) {
    if (!entry.effective_from || String(entry.effective_from) <= target) {
      return entry;
    }
  }

  return schedule[schedule.length - 1] || { ...DEFAULT_WORK_HOURS, effective_from: null };
}

/**
 * Determina el turno (Mañana/Tarde) de una fecha/hora usando el horario
 * resuelto para esa fecha. Devuelve null si cae en el hueco entre turnos.
 */
export function getShiftForDate(workHoursValue, dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;

  const wh = resolveWorkHoursForDate(workHoursValue, dateStr);
  const minutes = date.getHours() * 60 + date.getMinutes();

  if (minutes < timeToMinutes(wh.morning_end)) return 'Mañana';
  if (minutes >= timeToMinutes(wh.afternoon_start)) return 'Tarde';
  return null;
}
