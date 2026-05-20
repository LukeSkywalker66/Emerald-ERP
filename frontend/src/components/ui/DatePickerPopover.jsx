/**
 * DatePickerPopover - Calendario desplegable con estética retro cyberpunk
 *
 * Reemplaza <input type="date"> nativo con un popover de calendario visual
 * que mantiene la coherencia estética del sistema (neon emerald, dark mode,
 * bordes brillantes, hover glow).
 *
 * Props:
 *   value: string (YYYY-MM-DD) — fecha seleccionada
 *   onChange: (value: string) => void — callback al seleccionar/limpiar
 *   placeholder: string — texto cuando no hay fecha seleccionada
 *   label: string — texto del label opcional
 */
import { useState, useMemo, useCallback } from 'react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const DAY_HEADERS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export default function DatePickerPopover({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  label,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    value ? startOfMonth(parseISO(value)) : startOfMonth(new Date())
  );

  // Días del mes visible (incluye padding de meses anteriores/siguientes)
  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewMonth]);

  const selectedDate = value ? startOfDay(parseISO(value)) : null;

  const handlePrevMonth = useCallback(() => {
    setViewMonth((prev) => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth((prev) => addMonths(prev, 1));
  }, []);

  const handleSelectDay = useCallback(
    (day) => {
      onChange(format(day, 'yyyy-MM-dd'));
      setIsOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e) => {
      e.stopPropagation();
      onChange('');
      setIsOpen(false);
    },
    [onChange]
  );

  const handleToday = useCallback(() => {
    const today = new Date();
    onChange(format(today, 'yyyy-MM-dd'));
    setViewMonth(startOfMonth(today));
    setIsOpen(false);
  }, [onChange]);

  const displayText = value
    ? format(parseISO(value), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    : placeholder;

  const monthLabel = format(viewMonth, "MMMM 'de' yyyy", { locale: es });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
            'bg-zinc-950 border-zinc-800 text-zinc-100',
            'hover:border-emerald-500/50 hover:shadow-[0_0_8px_rgba(16,185,129,0.15)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
            !value && 'text-zinc-500'
          )}
        >
          <CalendarIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1 text-left truncate capitalize">
            {displayText}
          </span>
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-zinc-800 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-emerald-500/5">
        {/* Header del calendario */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-zinc-100 capitalize">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 px-3 pt-3 pb-1">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wider py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grilla de días */}
        <div className="grid grid-cols-7 px-3 pb-3 gap-0.5">
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, viewMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isDayToday = isToday(day);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectDay(day)}
                disabled={!isCurrentMonth}
                className={cn(
                  'relative w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-all',
                  // Fuera del mes
                  !isCurrentMonth && 'text-zinc-700 cursor-default',
                  // Dentro del mes (hover)
                  isCurrentMonth && 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
                  // Hoy (círculo borde)
                  isDayToday && isCurrentMonth && !isSelected && 'ring-1 ring-emerald-500/50',
                  // Seleccionado (neon glow)
                  isSelected && 'bg-emerald-500/20 text-emerald-300 font-bold ring-2 ring-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
                  // Hover sobre seleccionado
                  isSelected && 'hover:bg-emerald-500/30'
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Acciones rápidas */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 bg-zinc-950/50 rounded-b-xl">
          <button
            type="button"
            onClick={handleToday}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
          >
            📅 Hoy
          </button>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:underline transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
