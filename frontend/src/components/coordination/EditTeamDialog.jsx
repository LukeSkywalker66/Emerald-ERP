/**
 * EditTeamDialog.jsx
 * 
 * Dialog para editar cuadrilla existente.
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EditTeamDialog = ({
  open,
  onOpenChange,
  team,
  onSubmit,
  availableUsers = [],
  loadingUsers = false,
  availableVehicles = [],
  loadingVehicles = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    vehicle_id: '',
    is_active: true,
  });

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || '',
        vehicle_id: team.vehicle_id || '',
        is_active: team.is_active !== false,
      });
    }
  }, [team]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('El nombre de la cuadrilla es requerido');
      return;
    }

    try {
      setLoading(true);
      await onSubmit(team.id, {
        name: formData.name.trim(),
        vehicle_id: formData.vehicle_id ? parseInt(formData.vehicle_id) : null,
        is_active: formData.is_active,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-emerald-600/40">
        <DialogHeader>
          <DialogTitle className="text-amber-400">
            ✏️ Editar Cuadrilla
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nombre */}
          <div className="space-y-2">
            <label htmlFor="edit_name" className="block text-sm font-medium text-zinc-300">
              Nombre de Cuadrilla *
            </label>
            <Input
              id="edit_name"
              name="name"
              placeholder="Ej: Móvil 01 - Norte"
              value={formData.name}
              onChange={handleInputChange}
              className="bg-zinc-800 border-zinc-700 text-white focus:border-amber-600"
            />
          </div>

          {/* Móvil asignado (Opcional) */}
          <div className="space-y-2">
            <label htmlFor="edit_vehicle_id" className="block text-sm font-medium text-zinc-300">
              Móvil asignado (opcional)
            </label>
            <select
              id="edit_vehicle_id"
              name="vehicle_id"
              value={formData.vehicle_id}
              onChange={handleInputChange}
              disabled={loadingVehicles}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 focus:border-amber-600 focus:outline-none"
            >
              <option value="">Sin móvil asignado</option>
              {availableVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {(vehicle.name || vehicle.label || vehicle.code || 'Móvil')} (ID: {vehicle.id})
                </option>
              ))}
            </select>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              id="edit_is_active"
              name="is_active"
              type="checkbox"
              checked={formData.is_active}
              onChange={handleInputChange}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 accent-amber-600"
            />
            <label htmlFor="edit_is_active" className="text-sm font-medium text-zinc-300 cursor-pointer">
              Cuadrilla activa
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zinc-600 text-zinc-300"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.name.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTeamDialog;
