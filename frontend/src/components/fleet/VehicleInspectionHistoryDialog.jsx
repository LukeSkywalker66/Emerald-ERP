import { Fragment, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, ListChecks, Loader2, XCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import fleetService from '@/services/fleet.service';

const statusBadgeClass = (status) => {
  switch (status) {
    case 'OK':
      return 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40';
    case 'NEEDS_ATTENTION':
      return 'bg-amber-600/20 text-amber-300 border-amber-600/40';
    case 'CRITICAL':
      return 'bg-rose-600/20 text-rose-300 border-rose-600/40';
    default:
      return 'bg-zinc-600/20 text-zinc-300 border-zinc-600/40';
  }
};

const formatInspectionDate = (dateValue) => {
  if (!dateValue) return '-';
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function VehicleInspectionHistoryDialog({ open, onOpenChange, vehicle }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [expandedRowId, setExpandedRowId] = useState(null);

  useEffect(() => {
    if (!open || !vehicle?.id) return;

    let cancelled = false;

    const loadHistory = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await fleetService.getInspectionsHistory({ vehicle_id: vehicle.id });
        if (!cancelled) {
          setRows(data);
          setExpandedRowId(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'No se pudo cargar el historial de inspecciones.');
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [open, vehicle?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[95vw] !max-w-[1240px] sm:!max-w-[1240px] bg-zinc-950 border-zinc-800 p-0 overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <DialogHeader className="mb-0">
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              <ListChecks size={18} className="text-emerald-400" />
              Historial de Inspecciones · {vehicle?.name || 'Vehículo'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-zinc-400 mt-2">
            Ficha clínica operativa del móvil. Ordenado por fecha más reciente.
          </p>
        </div>

        <div className="p-4 max-h-[70vh] overflow-auto">
          {loading ? (
            <div className="py-16 text-center text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-emerald-500" />
              Cargando historial...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 p-3 text-rose-200 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center text-zinc-500 text-sm">
              No hay inspecciones registradas para este vehículo.
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="bg-zinc-900 border-b border-zinc-800">
                  <tr className="text-zinc-400">
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Fecha</th>
                    <th className="text-left px-3 py-2 font-semibold">Técnico</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">KM</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Estado</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Chequeo</th>
                    <th className="text-left px-3 py-2 font-semibold">Observaciones</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const hasNotes = Boolean(item.damage_notes && item.damage_notes.trim());
                    const isExpanded = expandedRowId === item.id;
                    const checks = [
                      { key: 'water_level_ok', label: 'Agua', ok: item.water_level_ok },
                      { key: 'oil_level_ok', label: 'Aceite', ok: item.oil_level_ok },
                      { key: 'tires_ok', label: 'Neumaticos', ok: item.tires_ok },
                      { key: 'lights_ok', label: 'Luces', ok: item.lights_ok },
                      { key: 'cleanliness_ok', label: 'Limpieza', ok: item.cleanliness_ok },
                    ];
                    const checksOk = checks.filter((c) => c.ok).length;
                    const failedChecks = checks.filter((c) => !c.ok).map((c) => c.label).join(', ');
                    return (
                      <Fragment key={item.id}>
                        <tr className="border-b border-zinc-800/70 hover:bg-zinc-900/60">
                          <td className="px-3 py-2 text-zinc-200 whitespace-nowrap">{formatInspectionDate(item.inspection_date)}</td>
                          <td className="px-3 py-2 text-zinc-300 break-words">{item.technician_name || `Usuario #${item.technician_id}`}</td>
                          <td className="px-3 py-2 text-zinc-200 font-mono whitespace-nowrap">{item.km_actual ?? '-'}</td>
                          <td className="px-3 py-2">
                            <Badge className={statusBadgeClass(item.status)}>{item.status_label || item.status}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <span className={`${checksOk === checks.length ? 'text-emerald-300' : 'text-amber-300'} font-semibold`}>
                              {checksOk}/5
                            </span>
                            {checksOk < checks.length && (
                              <p className="text-[11px] text-rose-300 mt-0.5 truncate" title={failedChecks}>
                                {failedChecks}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-zinc-300">
                            <p className="truncate" title={hasNotes ? item.damage_notes : 'Sin observaciones'}>
                              {hasNotes ? item.damage_notes : 'Sin observaciones'}
                            </p>
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                              className="border-cyan-600/40 text-cyan-300 hover:bg-cyan-950/30 whitespace-nowrap"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {isExpanded ? 'Ocultar' : 'Detalle'}
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-zinc-800/70 bg-zinc-900/40">
                            <td colSpan={7} className="px-3 py-3 text-zinc-300">
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                                  {checks.map((check) => (
                                    <div
                                      key={check.key}
                                      className={`rounded border px-2 py-1.5 text-xs flex items-center gap-1.5 ${
                                        check.ok
                                          ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-300'
                                          : 'border-rose-700/50 bg-rose-950/20 text-rose-300'
                                      }`}
                                    >
                                      {check.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                      <span>{check.label}</span>
                                    </div>
                                  ))}
                                </div>

                                <div className="rounded border border-zinc-700/60 bg-zinc-900/50 p-2 text-sm">
                                  <span className="text-zinc-400 text-xs uppercase tracking-wide mr-2">
                                    Observaciones / Daños
                                  </span>
                                  <span className="text-zinc-200">
                                    {hasNotes ? item.damage_notes : 'Sin observaciones registradas.'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
