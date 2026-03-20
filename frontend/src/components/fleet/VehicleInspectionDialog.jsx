import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Loader2, ShieldAlert } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import fleetService from '@/services/fleet.service';

const STATUS_STYLES = {
  OK: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
  NEEDS_ATTENTION: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
  CRITICAL: 'border-rose-500/50 bg-rose-500/15 text-rose-300',
};

const STATUS_LABELS = {
  OK: 'Apto',
  NEEDS_ATTENTION: 'Requiere atencion',
  CRITICAL: 'Critico',
};

const LEVEL_OPTIONS = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'minimo', label: 'Minimo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
];

const LEVEL_VALUE_MAP = {
  bajo: 'bajo',
  low: 'bajo',
  minimo: 'minimo',
  'mínimo': 'minimo',
  minimum: 'minimo',
  medio: 'medio',
  medium: 'medio',
  alto: 'alto',
  high: 'alto',
};

function normalizeLevelValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return LEVEL_VALUE_MAP[normalized] || 'medio';
}

function YesNoRow({ label, value, onChange, anomaly = false }) {
  const yesMeans = anomaly ? 'Anomalia' : 'Correcto';
  const noMeans = anomaly ? 'Sin anomalias' : 'Falta / no funciona';

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div className="pr-3">
        <p className="text-sm text-zinc-200 leading-snug">{label}</p>
        <p className="text-[11px] text-zinc-500 mt-1">{value ? `Si (${yesMeans})` : `No (${noMeans})`}</p>
      </div>
      <Switch checked={Boolean(value)} onCheckedChange={onChange} />
    </div>
  );
}

function LevelField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs text-zinc-400 mb-1.5 block uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      >
        {LEVEL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function VehicleInspectionDialog({
  open,
  onOpenChange,
  vehicleId,
  onSubmitted,
}) {
  const [form, setForm] = useState({
    km_actual: '',
    oil_level: 'medio',
    water_level: 'medio',
    fuel_level: 'medio',
    brake_fluid_level: 'medio',

    has_hydraulic_leaks: false,
    pulls_to_one_side: false,
    oil_leaks: false,
    hose_leaks: false,
    radiator_leaks: false,

    low_beam_lights_ok: true,
    high_beam_lights_ok: true,
    hazard_lights_ok: true,
    brake_lights_ok: true,
    position_lights_ok: true,
    reverse_lights_ok: true,
    fog_lights_ok: true,
    dashboard_indicators_on: false,
    reverse_alarm_ok: true,

    tires_cuts_or_bulges: false,
    has_spare_tire: true,
    has_lug_wrench: true,
    has_jack: true,
    tires_pressure_ok_30psi: true,

    seatbelts_all_ok: true,
    horn_ok: true,
    mirrors_ok: true,
    has_two_safety_cones: true,
    fire_extinguisher_ok: true,
    wipers_ok: true,

    // Legacy (compatibilidad)
    water_level_ok: true,
    oil_level_ok: true,
    tires_ok: true,
    lights_ok: true,
    cleanliness_ok: true,
    damage_notes: '',
    status: 'OK',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm({
      km_actual: '',
      oil_level: 'medio',
      water_level: 'medio',
      fuel_level: 'medio',
      brake_fluid_level: 'medio',

      has_hydraulic_leaks: false,
      pulls_to_one_side: false,
      oil_leaks: false,
      hose_leaks: false,
      radiator_leaks: false,

      low_beam_lights_ok: true,
      high_beam_lights_ok: true,
      hazard_lights_ok: true,
      brake_lights_ok: true,
      position_lights_ok: true,
      reverse_lights_ok: true,
      fog_lights_ok: true,
      dashboard_indicators_on: false,
      reverse_alarm_ok: true,

      tires_cuts_or_bulges: false,
      has_spare_tire: true,
      has_lug_wrench: true,
      has_jack: true,
      tires_pressure_ok_30psi: true,

      seatbelts_all_ok: true,
      horn_ok: true,
      mirrors_ok: true,
      has_two_safety_cones: true,
      fire_extinguisher_ok: true,
      wipers_ok: true,

      // Legacy (compatibilidad)
      water_level_ok: true,
      oil_level_ok: true,
      tires_ok: true,
      lights_ok: true,
      cleanliness_ok: true,
      damage_notes: '',
      status: 'OK',
    });
    setError('');
  };

  const nowLabel = useMemo(
    () => new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
    [open]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!vehicleId) {
      setError('No se encontró vehículo asignado para cargar la planilla.');
      return;
    }

    const km = Number(form.km_actual);
    if (!Number.isInteger(km) || km < 0) {
      setError('Ingresá un kilometraje válido (entero, mayor o igual a 0).');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await fleetService.submitInspection({
        vehicle_id: vehicleId,
        km_actual: km,

        mechanical_conditions: null,
        oil_level: normalizeLevelValue(form.oil_level),
        water_level: normalizeLevelValue(form.water_level),
        fuel_level: normalizeLevelValue(form.fuel_level),
        brake_fluid_level: normalizeLevelValue(form.brake_fluid_level),

        has_hydraulic_leaks: form.has_hydraulic_leaks,
        pulls_to_one_side: form.pulls_to_one_side,
        oil_leaks: form.oil_leaks,
        hose_leaks: form.hose_leaks,
        radiator_leaks: form.radiator_leaks,

        low_beam_lights_ok: form.low_beam_lights_ok,
        high_beam_lights_ok: form.high_beam_lights_ok,
        hazard_lights_ok: form.hazard_lights_ok,
        brake_lights_ok: form.brake_lights_ok,
        position_lights_ok: form.position_lights_ok,
        reverse_lights_ok: form.reverse_lights_ok,
        fog_lights_ok: form.fog_lights_ok,
        dashboard_indicators_on: form.dashboard_indicators_on,
        reverse_alarm_ok: form.reverse_alarm_ok,

        tires_cuts_or_bulges: form.tires_cuts_or_bulges,
        has_spare_tire: form.has_spare_tire,
        has_lug_wrench: form.has_lug_wrench,
        has_jack: form.has_jack,
        tires_pressure_ok_30psi: form.tires_pressure_ok_30psi,

        seatbelts_all_ok: form.seatbelts_all_ok,
        horn_ok: form.horn_ok,
        mirrors_ok: form.mirrors_ok,
        has_two_safety_cones: form.has_two_safety_cones,
        fire_extinguisher_ok: form.fire_extinguisher_ok,
        wipers_ok: form.wipers_ok,

        // Legacy para compatibilidad histórica
        water_level_ok: form.water_level_ok,
        oil_level_ok: form.oil_level_ok,
        tires_ok: form.tires_ok,
        lights_ok: form.lights_ok,
        cleanliness_ok: form.cleanliness_ok,
        damage_notes: form.damage_notes?.trim() || null,
        status: form.status,
      });

      onOpenChange(false);
      resetForm();
      onSubmitted?.();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo enviar la inspección.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          resetForm();
        }
      }}
    >
      <DialogContent className="w-[96vw] max-w-2xl border-zinc-800 bg-zinc-950 p-0 max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-zinc-800">
          <DialogHeader className="mb-0">
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <ShieldAlert size={18} className="text-emerald-400" />
              Control Diario de Vehículo
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-zinc-400 mt-2">
            Completá la planilla de control previo a la salida antes de continuar con tus OTs.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="p-5 space-y-5 overflow-y-auto min-h-0">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Fecha / hora de carga</p>
            <p className="text-sm text-zinc-200 mt-1">{nowLabel}</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
                <Gauge size={15} className="text-emerald-400" />
                KM inicial
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.km_actual}
                onChange={(e) => setField('km_actual', e.target.value)}
                placeholder="Ej: 128450"
                className="h-11 bg-zinc-900 border-zinc-700 text-zinc-100"
                required
              />
            </div>
            </div>

          <div className="space-y-3">
            <h4 className="text-xs text-zinc-400 uppercase tracking-wide">Niveles</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LevelField label="Nivel de aceite" value={form.oil_level} onChange={(v) => setField('oil_level', v)} />
              <LevelField label="Nivel de agua" value={form.water_level} onChange={(v) => setField('water_level', v)} />
              <LevelField label="Nivel de combustible" value={form.fuel_level} onChange={(v) => setField('fuel_level', v)} />
              <LevelField label="Liquido de freno" value={form.brake_fluid_level} onChange={(v) => setField('brake_fluid_level', v)} />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs text-zinc-400 uppercase tracking-wide">Condiciones mecánicas</h4>
            <YesNoRow label="Existen fugas hidráulicas" value={form.has_hydraulic_leaks} onChange={(v) => setField('has_hydraulic_leaks', v)} anomaly />
            <YesNoRow label="El vehículo tira para un lado" value={form.pulls_to_one_side} onChange={(v) => setField('pulls_to_one_side', v)} anomaly />
            <YesNoRow label="Estado de aceite: tiene pérdidas" value={form.oil_leaks} onChange={(v) => setField('oil_leaks', v)} anomaly />
            <YesNoRow label="Estado de mangueras: tienen pérdidas" value={form.hose_leaks} onChange={(v) => setField('hose_leaks', v)} anomaly />
            <YesNoRow label="Estado del radiador: tiene pérdidas" value={form.radiator_leaks} onChange={(v) => setField('radiator_leaks', v)} anomaly />
          </div>

          <div className="space-y-3">
            <h4 className="text-xs text-zinc-400 uppercase tracking-wide">Luces y tablero</h4>
            <YesNoRow label="Luces bajas: funcionan todas" value={form.low_beam_lights_ok} onChange={(v) => setField('low_beam_lights_ok', v)} />
            <YesNoRow label="Luces altas: funcionan todas" value={form.high_beam_lights_ok} onChange={(v) => setField('high_beam_lights_ok', v)} />
            <YesNoRow label="Balizas: funcionan todas" value={form.hazard_lights_ok} onChange={(v) => setField('hazard_lights_ok', v)} />
            <YesNoRow label="Luces de freno" value={form.brake_lights_ok} onChange={(v) => setField('brake_lights_ok', v)} />
            <YesNoRow label="Luces de posición" value={form.position_lights_ok} onChange={(v) => setField('position_lights_ok', v)} />
            <YesNoRow label="Luces de retroceso" value={form.reverse_lights_ok} onChange={(v) => setField('reverse_lights_ok', v)} />
            <YesNoRow label="Luz auxiliar / rompenieblas" value={form.fog_lights_ok} onChange={(v) => setField('fog_lights_ok', v)} />
            <YesNoRow label="Indicadores de tablero encendidos" value={form.dashboard_indicators_on} onChange={(v) => setField('dashboard_indicators_on', v)} anomaly />
            <YesNoRow label="Alarma de retroceso audible" value={form.reverse_alarm_ok} onChange={(v) => setField('reverse_alarm_ok', v)} />
          </div>

          <div className="space-y-3">
            <h4 className="text-xs text-zinc-400 uppercase tracking-wide">Cubiertas y auxilio</h4>
            <YesNoRow label="Existen cortaduras o abultamientos" value={form.tires_cuts_or_bulges} onChange={(v) => setField('tires_cuts_or_bulges', v)} anomaly />
            <YesNoRow label="Tiene auxilio" value={form.has_spare_tire} onChange={(v) => setField('has_spare_tire', v)} />
            <YesNoRow label="Tiene llave cruz" value={form.has_lug_wrench} onChange={(v) => setField('has_lug_wrench', v)} />
            <YesNoRow label="Tiene gato" value={form.has_jack} onChange={(v) => setField('has_jack', v)} />
            <YesNoRow label="Presión de aire correcta (30 lbs)" value={form.tires_pressure_ok_30psi} onChange={(v) => setField('tires_pressure_ok_30psi', v)} />
          </div>

          <div className="space-y-3">
            <h4 className="text-xs text-zinc-400 uppercase tracking-wide">Accesorios y seguridad</h4>
            <YesNoRow label="Cinturón en todos los asientos" value={form.seatbelts_all_ok} onChange={(v) => setField('seatbelts_all_ok', v)} />
            <YesNoRow label="Bocina audible" value={form.horn_ok} onChange={(v) => setField('horn_ok', v)} />
            <YesNoRow label="Espejos retrovisores" value={form.mirrors_ok} onChange={(v) => setField('mirrors_ok', v)} />
            <YesNoRow label="Conos de seguridad (2 unidades)" value={form.has_two_safety_cones} onChange={(v) => setField('has_two_safety_cones', v)} />
            <YesNoRow label="Matafuego" value={form.fire_extinguisher_ok} onChange={(v) => setField('fire_extinguisher_ok', v)} />
            <YesNoRow label="Limpiaparabrisas operativo" value={form.wipers_ok} onChange={(v) => setField('wipers_ok', v)} />
          </div>

          <div>
            <p className="text-sm text-zinc-300 mb-2">Estado general</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['OK', 'NEEDS_ATTENTION', 'CRITICAL'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setField('status', status)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.status === status
                      ? STATUS_STYLES[status]
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {status === 'OK' && <CheckCircle2 size={14} className="inline mr-1" />}
                  {status === 'NEEDS_ATTENTION' && <AlertTriangle size={14} className="inline mr-1" />}
                  {status === 'CRITICAL' && <ShieldAlert size={14} className="inline mr-1" />}
                  {STATUS_LABELS[status] || status}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-zinc-300 mb-2 block">Observaciones / Daños</label>
            <textarea
              value={form.damage_notes}
              onChange={(e) => setField('damage_notes', e.target.value)}
              rows={4}
              placeholder="Golpes, pérdidas, ruidos, piezas faltantes u otras novedades..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-700/60 bg-rose-950/40 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

            <div className="h-2" />
          </div>

          <div className="border-t border-zinc-800 px-5 py-4 bg-zinc-950">
            <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-zinc-700 text-zinc-300"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Confirmar Inspección'
              )}
            </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
