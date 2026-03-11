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
                    const issueChecks = [
                      { label: 'Fugas hidráulicas', issue: item.has_hydraulic_leaks },
                      { label: 'Tira para un lado', issue: item.pulls_to_one_side },
                      { label: 'Pérdidas de aceite', issue: item.oil_leaks },
                      { label: 'Pérdidas en mangueras', issue: item.hose_leaks },
                      { label: 'Pérdidas en radiador', issue: item.radiator_leaks },
                      { label: 'Indicadores encendidos', issue: item.dashboard_indicators_on },
                      { label: 'Cortaduras/abultamientos', issue: item.tires_cuts_or_bulges },
                      { label: 'Luces bajas', issue: !item.low_beam_lights_ok },
                      { label: 'Luces altas', issue: !item.high_beam_lights_ok },
                      { label: 'Balizas', issue: !item.hazard_lights_ok },
                      { label: 'Luces de freno', issue: !item.brake_lights_ok },
                      { label: 'Luces de posición', issue: !item.position_lights_ok },
                      { label: 'Luces de retroceso', issue: !item.reverse_lights_ok },
                      { label: 'Rompenieblas', issue: !item.fog_lights_ok },
                      { label: 'Alarma retroceso', issue: !item.reverse_alarm_ok },
                      { label: 'Sin auxilio', issue: !item.has_spare_tire },
                      { label: 'Sin llave cruz', issue: !item.has_lug_wrench },
                      { label: 'Sin gato', issue: !item.has_jack },
                      { label: 'Presión incorrecta', issue: !item.tires_pressure_ok_30psi },
                      { label: 'Cinturones', issue: !item.seatbelts_all_ok },
                      { label: 'Bocina', issue: !item.horn_ok },
                      { label: 'Espejos', issue: !item.mirrors_ok },
                      { label: 'Conos', issue: !item.has_two_safety_cones },
                      { label: 'Matafuego', issue: !item.fire_extinguisher_ok },
                      { label: 'Limpiaparabrisas', issue: !item.wipers_ok },
                    ];

                    const issues = issueChecks.filter((c) => c.issue).map((c) => c.label);
                    const levelsSummary = `Aceite ${item.oil_level} · Agua ${item.water_level} · Combustible ${item.fuel_level} · Freno ${item.brake_fluid_level}`;
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
                            <p className="text-zinc-300 truncate" title={levelsSummary}>{levelsSummary}</p>
                            {issues.length > 0 && (
                              <p className="text-[11px] text-rose-300 mt-0.5 truncate" title={issues.join(', ')}>
                                {issues.length} observación(es): {issues.join(', ')}
                              </p>
                            )}
                            {issues.length === 0 && <p className="text-[11px] text-emerald-300 mt-0.5">Sin anomalías</p>}
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
                                <div className="rounded border border-zinc-700/60 bg-zinc-900/50 p-2.5 text-xs text-zinc-300">
                                  <span className="text-zinc-400 uppercase tracking-wide mr-2">Niveles</span>
                                  Aceite: <strong>{item.oil_level}</strong> · Agua: <strong>{item.water_level}</strong> · Combustible: <strong>{item.fuel_level}</strong> · Líquido de freno: <strong>{item.brake_fluid_level}</strong>
                                </div>

                                {item.mechanical_conditions && (
                                  <div className="rounded border border-zinc-700/60 bg-zinc-900/50 p-2.5 text-sm text-zinc-200">
                                    <span className="text-zinc-400 text-xs uppercase tracking-wide mr-2">Condiciones mecánicas</span>
                                    {item.mechanical_conditions}
                                  </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {[
                                    { label: 'Fugas hidráulicas', ok: !item.has_hydraulic_leaks },
                                    { label: 'Alineación correcta', ok: !item.pulls_to_one_side },
                                    { label: 'Sin pérdidas de aceite', ok: !item.oil_leaks },
                                    { label: 'Mangueras sin pérdidas', ok: !item.hose_leaks },
                                    { label: 'Radiador sin pérdidas', ok: !item.radiator_leaks },
                                    { label: 'Luces bajas', ok: item.low_beam_lights_ok },
                                    { label: 'Luces altas', ok: item.high_beam_lights_ok },
                                    { label: 'Balizas', ok: item.hazard_lights_ok },
                                    { label: 'Luces de freno', ok: item.brake_lights_ok },
                                    { label: 'Luces de posición', ok: item.position_lights_ok },
                                    { label: 'Luces de retroceso', ok: item.reverse_lights_ok },
                                    { label: 'Rompenieblas', ok: item.fog_lights_ok },
                                    { label: 'Tablero sin alertas', ok: !item.dashboard_indicators_on },
                                    { label: 'Alarma retroceso', ok: item.reverse_alarm_ok },
                                    { label: 'Sin cortes/abultamientos', ok: !item.tires_cuts_or_bulges },
                                    { label: 'Auxilio', ok: item.has_spare_tire },
                                    { label: 'Llave cruz', ok: item.has_lug_wrench },
                                    { label: 'Gato', ok: item.has_jack },
                                    { label: 'Presión 30 lbs', ok: item.tires_pressure_ok_30psi },
                                    { label: 'Cinturones', ok: item.seatbelts_all_ok },
                                    { label: 'Bocina', ok: item.horn_ok },
                                    { label: 'Espejos', ok: item.mirrors_ok },
                                    { label: '2 Conos', ok: item.has_two_safety_cones },
                                    { label: 'Matafuego', ok: item.fire_extinguisher_ok },
                                    { label: 'Limpiaparabrisas', ok: item.wipers_ok },
                                  ].map((check, idx) => (
                                    <div
                                      key={`${check.label}-${idx}`}
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
