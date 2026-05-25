/**
 * ScheduleConfigurator.jsx
 * 
 * Componente visual para configuración de schedules de tareas programadas.
 * Reemplaza el input de cron expression raw con una interfaz amigable.
 * 
 * Tipos de schedule soportados:
 * - interval_minutes: Cada N minutos
 * - interval_hours: Cada N horas
 * - daily: Diario a una o más horas específicas
 * - weekly: Días específicos de la semana a una hora
 * - custom_cron: Expresión cron directa (fallback)
 * 
 * Props:
 * - value: schedule_config actual (objeto con {type, ...params})
 * - cronExpression: expresión cron actual (para preview)
 * - onChange(config): callback cuando cambia la configuración
 * - onCronChange(cron): callback opcional con el cron computado
 * - readOnly: si es true, oculta los controles de edición (solo preview)
 */
import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Clock,
  Info,
} from 'lucide-react';

// ─── Constantes ──────────────────────────────────────────────────────────

const SCHEDULE_TYPES = [
  { value: 'daily', label: 'Diario', icon: '📅' },
  { value: 'weekly', label: 'Semanal', icon: '📆' },
  { value: 'interval_minutes', label: 'Cada N minutos', icon: '⏱️' },
  { value: 'interval_hours', label: 'Cada N horas', icon: '⏰' },
  { value: 'custom_cron', label: 'Expresión cron (avanzado)', icon: '⚙️' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom', short: 'D' },
  { value: 1, label: 'Lun', short: 'L' },
  { value: 2, label: 'Mar', short: 'M' },
  { value: 3, label: 'Mié', short: 'X' },
  { value: 4, label: 'Jue', short: 'J' },
  { value: 5, label: 'Vie', short: 'V' },
  { value: 6, label: 'Sáb', short: 'S' },
];

const DEFAULT_TIMES = ['03:00'];

// ─── Helpers ─────────────────────────────────────────────────────────────

function cronToHumanReadable(cron) {
  if (!cron) return 'No configurado';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return `Cron: ${cron}`;

  const [minute, hour, dom, month, dow] = parts;

  // Cada N minutos
  if (minute.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Cada ${minute.slice(2)} minutos`;
  }

  // Cada N horas
  if (minute === '0' && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
    const val = hour.slice(2);
    return `Cada ${val} hora${val !== '1' ? 's' : ''}`;
  }

  // Diario
  if (dom === '*' && month === '*' && dow === '*') {
    if (hour.includes(',')) {
      const times = hour.split(',').map(h => formatTime(`${h}:${minute}`)).join(', ');
      return `Diario a las ${times}`;
    }
    return `Diario a las ${formatTime(`${hour}:${minute}`)}`;
  }

  // Semanal
  if (dom === '*' && month === '*' && dow !== '*') {
    const dayNames = dow.split(',').map(d => {
      const num = parseInt(d, 10);
      const day = DAYS_OF_WEEK.find(dw => dw.value === num);
      return day ? day.label : d;
    }).join(', ');
    return `${dayNames} a las ${formatTime(`${hour}:${minute}`)}`;
  }

  return `Cron: ${cron}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const suffix = h < 12 ? 'AM' : 'PM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  } catch {
    return timeStr;
  }
}

/**
 * Computa una expresión cron de 5 campos desde un schedule_config.
 * Refleja la lógica de backend/src/utils/schedule_parser.py en frontend.
 */
function computeCronFromConfig(config) {
  if (!config || !config.type) return '';

  switch (config.type) {
    case 'interval_minutes':
      return `*/${config.value || 30} * * * *`;
    case 'interval_hours':
      return `0 */${config.value || 1} * * *`;
    case 'daily': {
      const times = config.times?.length > 0 ? config.times : DEFAULT_TIMES;
      const minutes = times[0].split(':')[1];
      const hours = times.map(t => t.split(':')[0]).join(',');
      return `${minutes} ${hours} * * *`;
    }
    case 'weekly': {
      const days = config.days?.length > 0 ? config.days : [1];
      const time = config.time || '08:00';
      const [hour, minute] = time.split(':');
      return `${minute} ${hour} * * ${days.sort((a, b) => a - b).join(',')}`;
    }
    case 'custom_cron':
      return config.expression || '';
    default:
      return '';
  }
}

// ─── Component ───────────────────────────────────────────────────────────

export default function ScheduleConfigurator({
  value,
  cronExpression,
  onChange,
  onCronChange,
  readOnly = false,
}) {
  // Inicializar estado local desde value prop
  const [config, setConfig] = useState(() => getInitialConfig(value));

  // Sincronizar cuando cambia la prop externa
  useEffect(() => {
    setConfig(getInitialConfig(value));
  }, [value]);

  // Cada vez que config cambia, notificar al padre
  useEffect(() => {
    if (!onChange) return;
    onChange(config);
    if (onCronChange) {
      const cron = computeCronFromConfig(config);
      onCronChange(cron);
    }
  }, [config]);

  const updateField = useCallback((field, val) => {
    setConfig(prev => ({ ...prev, [field]: val }));
  }, []);

  // ── Render helpers ──────────────────────────────────────────────────

  const renderIntervalMinutes = () => (
    <div className="space-y-2">
      <label className="block text-xs text-zinc-400 font-medium">
        Cada cuántos minutos
      </label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="1"
          max="59"
          value={config.value ?? 30}
          onChange={(e) => updateField('value', Math.max(1, Math.min(59, parseInt(e.target.value, 10) || 1)))}
          className="h-9 text-sm w-24"
          disabled={readOnly}
        />
        <span className="text-xs text-zinc-500">minutos</span>
      </div>
      <p className="text-[10px] text-zinc-600">
        La tarea se ejecutará repetidamente cada N minutos.
      </p>
    </div>
  );

  const renderIntervalHours = () => (
    <div className="space-y-2">
      <label className="block text-xs text-zinc-400 font-medium">
        Cada cuántas horas
      </label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="1"
          max="23"
          value={config.value ?? 1}
          onChange={(e) => updateField('value', Math.max(1, Math.min(23, parseInt(e.target.value, 10) || 1)))}
          className="h-9 text-sm w-24"
          disabled={readOnly}
        />
        <span className="text-xs text-zinc-500">horas</span>
      </div>
      <p className="text-[10px] text-zinc-600">
        Se ejecutará al inicio de cada bloque de N horas (ej: 0:00, 6:00, 12:00).
      </p>
    </div>
  );

  const renderDaily = () => {
    const times = config.times?.length > 0 ? [...config.times] : [...DEFAULT_TIMES];

    const addTime = () => {
      const newTimes = [...times, '12:00'];
      updateField('times', newTimes);
    };

    const removeTime = (index) => {
      const newTimes = times.filter((_, i) => i !== index);
      updateField('times', newTimes.length > 0 ? newTimes : DEFAULT_TIMES);
    };

    const updateTime = (index, val) => {
      const newTimes = [...times];
      newTimes[index] = val;
      updateField('times', newTimes);
    };

    return (
      <div className="space-y-2">
        <label className="block text-xs text-zinc-400 font-medium">
          Horarios de ejecución
        </label>
        <div className="space-y-1.5">
          {times.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="time"
                value={t}
                onChange={(e) => updateTime(i, e.target.value)}
                className="h-9 text-sm w-32"
                disabled={readOnly}
              />
              <span className="text-[11px] text-zinc-500 min-w-[70px]">
                {formatTime(t)}
              </span>
              {!readOnly && times.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTime(i)}
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={addTime}
            className="h-8 text-xs gap-1"
          >
            <Plus size={12} />
            Agregar horario
          </Button>
        )}
        <p className="text-[10px] text-zinc-600">
          La tarea se ejecutará diariamente a los horarios indicados.
          Podés agregar múltiples horarios para ejecuciones varias veces al día.
        </p>
      </div>
    );
  };

  const renderWeekly = () => {
    const days = config.days?.length > 0 ? [...config.days] : [1];
    const time = config.time || '08:00';

    const toggleDay = (dayValue) => {
      let newDays;
      if (days.includes(dayValue)) {
        newDays = days.filter(d => d !== dayValue);
      } else {
        newDays = [...days, dayValue];
      }
      // Mantener al menos un día seleccionado
      updateField('days', newDays.length > 0 ? newDays : [dayValue]);
    };

    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-400 font-medium mb-1.5">
            Días de la semana
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {DAYS_OF_WEEK.map((day) => {
              const isActive = days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => !readOnly && toggleDay(day.value)}
                  disabled={readOnly}
                  className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:bg-zinc-700/50 hover:text-zinc-300'
                  }`}
                  title={day.label}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-400 font-medium mb-1.5">
            Hora de ejecución
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={time}
              onChange={(e) => updateField('time', e.target.value)}
              className="h-9 text-sm w-32"
              disabled={readOnly}
            />
            <span className="text-[11px] text-zinc-500">{formatTime(time)}</span>
          </div>
        </div>
        <p className="text-[10px] text-zinc-600">
          La tarea se ejecutará los días seleccionados a la hora indicada.
        </p>
      </div>
    );
  };

  const renderCustomCron = () => (
    <div className="space-y-2">
      <label className="block text-xs text-zinc-400 font-medium">
        Expresión Cron
      </label>
      <Input
        value={config.expression || ''}
        onChange={(e) => updateField('expression', e.target.value)}
        placeholder="minuto hora día_mes mes día_semana"
        className="h-9 text-sm font-mono"
        disabled={readOnly}
      />
      <p className="text-[10px] text-zinc-600">
        Formato estándar de 5 campos separados por espacio.
        Ej: <code className="text-zinc-400">0 3 * * *</code> = diario a las 3:00 AM
      </p>
      <p className="text-[10px] text-zinc-600">
        <Info size={10} className="inline mr-1" />
        Formato Celery Beat, no cron de Linux. Mismos campos pero interpretado por Celery.
      </p>
    </div>
  );

  // ── Render schedule type selector ───────────────────────────────────

  const renderTypeSelector = () => (
    <div className="space-y-2">
      <label className="block text-xs text-zinc-400 font-medium">
        Tipo de schedule
      </label>
      <Select
        value={config.type || 'daily'}
        onValueChange={(val) => {
          // Resetear campos según el tipo seleccionado
          const newConfig = { type: val };
          switch (val) {
            case 'interval_minutes':
              newConfig.value = 30;
              break;
            case 'interval_hours':
              newConfig.value = 1;
              break;
            case 'daily':
              newConfig.times = [...DEFAULT_TIMES];
              break;
            case 'weekly':
              newConfig.days = [1];
              newConfig.time = '08:00';
              break;
            case 'custom_cron':
              newConfig.expression = '0 * * * *';
              break;
          }
          setConfig(newConfig);
        }}
        disabled={readOnly}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Seleccionar tipo" />
        </SelectTrigger>
        <SelectContent>
          {SCHEDULE_TYPES.map((st) => (
            <SelectItem key={st.value} value={st.value}>
              <span className="flex items-center gap-2">
                <span>{st.icon}</span>
                <span>{st.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // ── Render preview ──────────────────────────────────────────────────

  const renderPreview = () => {
    const cron = cronExpression || computeCronFromConfig(config);
    const description = cronToHumanReadable(cron);

    return (
      <div className="bg-zinc-900/50 rounded-lg p-3 space-y-1.5 border border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-emerald-400" />
          <span className="text-[11px] text-zinc-400 font-medium">Vista previa</span>
        </div>
        <p className="text-xs text-zinc-200">{description}</p>
        {cron && (
          <p className="text-[10px] text-zinc-600 font-mono">
            Cron: {cron}
          </p>
        )}
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {!readOnly && renderTypeSelector()}

      {/* Controles específicos por tipo */}
      {config.type === 'interval_minutes' && renderIntervalMinutes()}
      {config.type === 'interval_hours' && renderIntervalHours()}
      {config.type === 'daily' && renderDaily()}
      {config.type === 'weekly' && renderWeekly()}
      {config.type === 'custom_cron' && renderCustomCron()}

      {/* Vista previa de schedule */}
      {renderPreview()}
    </div>
  );
}

// ─── Helper para inicializar estado ─────────────────────────────────────

function getInitialConfig(value) {
  if (value && value.type) {
    return value;
  }

  // Valor por defecto: daily a las 3:00 AM
  return {
    type: 'daily',
    times: [...DEFAULT_TIMES],
  };
}
