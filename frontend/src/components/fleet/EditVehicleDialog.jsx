import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EditVehicleDialog = ({
  open,
  onOpenChange,
  vehicle,
  onSubmit,
  loading = false,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    license_plate: '',
    vehicle_brand: '',
    vehicle_model: '',
    vehicle_year: '',
    status: 'ACTIVE',
  });

  useEffect(() => {
    if (!vehicle) return;
    setFormData({
      name: vehicle.name || '',
      license_plate: vehicle.license_plate || '',
      vehicle_brand: vehicle.vehicle_brand || '',
      vehicle_model: vehicle.vehicle_model || '',
      vehicle_year: vehicle.vehicle_year || '',
      status: vehicle.status || 'ACTIVE',
    });
  }, [vehicle]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!vehicle?.id) return;
    if (!formData.name.trim()) {
      alert('El nombre del vehículo es requerido');
      return;
    }

    await onSubmit(vehicle.id, {
      name: formData.name.trim(),
      license_plate: formData.license_plate?.trim() || null,
      vehicle_brand: formData.vehicle_brand?.trim() || null,
      vehicle_model: formData.vehicle_model?.trim() || null,
      vehicle_year: formData.vehicle_year ? Number(formData.vehicle_year) : null,
      status: formData.status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-zinc-900 border-amber-600/40 max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-amber-400">✏️ Editar Vehículo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            name="name"
            placeholder="Nombre del vehículo"
            value={formData.name}
            onChange={handleInputChange}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <Input
            name="license_plate"
            placeholder="Patente"
            value={formData.license_plate}
            onChange={handleInputChange}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              name="vehicle_brand"
              placeholder="Marca"
              value={formData.vehicle_brand}
              onChange={handleInputChange}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            <Input
              name="vehicle_model"
              placeholder="Modelo"
              value={formData.vehicle_model}
              onChange={handleInputChange}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <Input
            name="vehicle_year"
            type="number"
            min="1900"
            max="2200"
            placeholder="Año"
            value={formData.vehicle_year}
            onChange={handleInputChange}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
            <option value="RETIRED">RETIRED</option>
            <option value="DONATED">DONATED</option>
          </select>
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

export default EditVehicleDialog;
