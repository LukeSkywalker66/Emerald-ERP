import { useState } from 'react';
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

export default function VehicleInspectionDialog({
  open,
  onOpenChange,
  vehicleId,
  onSubmitted,
}) {
  const [form, setForm] = useState({
    km_actual: '',
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
      <DialogContent className="max-w-xl border-zinc-800 bg-zinc-950 p-0">
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

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
              <Gauge size={15} className="text-emerald-400" />
              Kilometraje actual
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

          <div className="space-y-3">
            {[
              ['water_level_ok', 'Nivel de Agua'],
              ['oil_level_ok', 'Nivel de Aceite'],
              ['tires_ok', 'Neumáticos'],
              ['lights_ok', 'Luces'],
              ['cleanliness_ok', 'Limpieza'],
            ].map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3"
              >
                <span className="text-sm text-zinc-200">{label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${form[key] ? 'text-emerald-300' : 'text-zinc-500'}`}>
                    {form[key] ? 'OK' : 'Revisar'}
                  </span>
                  <Switch
                    checked={Boolean(form[key])}
                    onCheckedChange={(checked) => setField(key, checked)}
                  />
                </div>
              </div>
            ))}
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
            <label className="text-sm text-zinc-300 mb-2 block">Observaciones / Daños (opcional)</label>
            <textarea
              value={form.damage_notes}
              onChange={(e) => setField('damage_notes', e.target.value)}
              rows={4}
              placeholder="Rayones, golpes, luces quemadas, etc."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-700/60 bg-rose-950/40 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
