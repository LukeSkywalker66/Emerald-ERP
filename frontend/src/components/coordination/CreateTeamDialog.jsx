/**
 * CreateTeamDialog.jsx
 * 
 * Dialog para crear nueva cuadrilla.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CreateTeamDialog = ({
  open,
  onOpenChange,
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
    member_user_id: '',
    is_active: true,
  });

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
      await onSubmit({
        name: formData.name.trim(),
        vehicle_id: formData.vehicle_id ? parseInt(formData.vehicle_id) : null,
        member_user_id: formData.member_user_id ? parseInt(formData.member_user_id) : null,
        is_active: formData.is_active,
      });
      
      // Reset form
      setFormData({
        name: '',
        vehicle_id: '',
        member_user_id: '',
        is_active: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-emerald-600/40">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">
            ⚡ Nueva Cuadrilla
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nombre */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300">
              Nombre de la Cuadrilla
            </label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Móvil 01 - Norte"
              value={formData.name}
              onChange={handleInputChange}
              className="bg-zinc-800 border-zinc-700 text-white focus:border-emerald-600"
            />
            <p className="text-xs text-zinc-400">
              Nombre único y descriptivo para la cuadrilla
            </p>
          </div>

          {/* Móvil / Warehouse */}
          <div className="space-y-2">
            <label htmlFor="vehicle_id" className="block text-sm font-medium text-zinc-300">
              Móvil disponible (opcional)
            </label>
            <select
              id="vehicle_id"
              name="vehicle_id"
              value={formData.vehicle_id}
              onChange={handleInputChange}
              disabled={loadingVehicles}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Seleccionar móvil...</option>
              {availableVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {(vehicle.name || vehicle.label || vehicle.code || 'Móvil')} (ID: {vehicle.id})
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-400">
              Vincula la cuadrilla a un móvil por nombre e ID
            </p>
          </div>

          {/* Técnico inicial */}
          <div className="space-y-2">
            <label htmlFor="member_user_id" className="block text-sm font-medium text-zinc-300">
              Técnico inicial (opcional)
            </label>
            <select
              id="member_user_id"
              name="member_user_id"
              value={formData.member_user_id}
              onChange={handleInputChange}
              disabled={loadingUsers}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Seleccionar técnico...</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.full_name || user.username || user.email)} (ID: {user.id})
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-400">
              Se agregará automáticamente a la cuadrilla
            </p>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              checked={formData.is_active}
              onChange={handleInputChange}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 accent-emerald-600"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-zinc-300 cursor-pointer">
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? 'Creando...' : 'Crear Cuadrilla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTeamDialog;
