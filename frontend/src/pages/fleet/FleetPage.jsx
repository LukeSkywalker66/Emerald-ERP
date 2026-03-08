import { useEffect, useState } from 'react';
import { Car, Loader2, Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import fleetService from '@/services/fleet.service';
import CreateVehicleDialog from '@/components/fleet/CreateVehicleDialog';
import EditVehicleDialog from '@/components/fleet/EditVehicleDialog';
import { useAuth } from '@/context/AuthContext';
import Can from '@/components/auth/Can';
import { getWarehouses } from '@/services/inventory.service';
import { hasPermission } from '@/utils/permissions';

const getStatusStyle = (status) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40';
    case 'MAINTENANCE':
      return 'bg-amber-600/20 text-amber-300 border-amber-600/40';
    case 'RETIRED':
      return 'bg-ruby-600/20 text-ruby-300 border-ruby-600/40';
    case 'DONATED':
      return 'bg-cyan-600/20 text-cyan-300 border-cyan-600/40';
    default:
      return 'bg-zinc-600/20 text-zinc-300 border-zinc-600/40';
  }
};

const FleetPage = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const isTechnician = ['tecnico', 'technician'].includes((user?.role || '').toLowerCase());
  const canManageFleet = hasPermission(user?.role, 'inventory', 'edit');

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const data = await fleetService.getVehicles();
      let nextVehicles = Array.isArray(data) ? data : [];

      // Filtro forzado para técnicos: solo vehículos asociados a su warehouse móvil.
      if (isTechnician && user?.id) {
        const myWarehouses = await getWarehouses({ warehouse_type: 'MOBILE', user_id: user.id });
        const allowedWarehouseIds = new Set((myWarehouses || []).map((w) => w.id));
        nextVehicles = nextVehicles.filter((vehicle) => allowedWarehouseIds.has(vehicle.warehouse_id));
      }

      setVehicles(nextVehicles);
    } catch (err) {
      console.error('Error loading fleet:', err);
      alert(`❌ Error al cargar flota: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, [isTechnician, user?.id]);

  const handleCreate = async (payload) => {
    try {
      setSaving(true);
      await fleetService.createVehicle(payload);
      setShowCreate(false);
      await loadVehicles();
      alert('✅ Vehículo creado exitosamente');
    } catch (err) {
      console.error('Error creating vehicle:', err);
      alert(`❌ Error al crear vehículo: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (vehicleId, payload) => {
    try {
      setSaving(true);
      await fleetService.updateVehicle(vehicleId, payload);
      setShowEdit(false);
      setSelectedVehicle(null);
      await loadVehicles();
      alert('✅ Vehículo actualizado exitosamente');
    } catch (err) {
      console.error('Error updating vehicle:', err);
      alert(`❌ Error al actualizar vehículo: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vehicle) => {
    const ok = window.confirm(`¿Retirar vehículo "${vehicle.name}"?`);
    if (!ok) return;

    try {
      await fleetService.deleteVehicle(vehicle.id);
      await loadVehicles();
      alert('✅ Vehículo retirado');
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      alert(`❌ Error al retirar vehículo: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2">
            <Car className="h-7 w-7" />
            Módulo de Flota
          </h1>
          <p className="text-zinc-400 mt-1">
            {isTechnician
              ? 'Vista táctica: solo el móvil operativo asociado al técnico autenticado'
              : 'Administración de vehículos operativos'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadVehicles}
            className="border-zinc-700 text-zinc-300"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Can resource="inventory" action="edit">
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Vehículo
            </Button>
          </Can>
        </div>
      </div>

      <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 border-b border-zinc-800">
              <tr className="text-zinc-400">
                <th className="text-left px-4 py-3 font-semibold">Vehículo</th>
                <th className="text-left px-4 py-3 font-semibold">Patente</th>
                <th className="text-left px-4 py-3 font-semibold">Modelo</th>
                <th className="text-left px-4 py-3 font-semibold">Warehouse</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                {canManageFleet && <th className="text-right px-4 py-3 font-semibold">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManageFleet ? 6 : 5} className="px-4 py-12 text-center text-zinc-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Consultando al Orquestador...
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={canManageFleet ? 6 : 5} className="px-4 py-12 text-center text-zinc-500">
                    No hay vehículos registrados
                  </td>
                </tr>
              ) : (
                vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-b border-zinc-800/70 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-zinc-100 font-medium">{vehicle.name}</td>
                    <td className="px-4 py-3 text-zinc-300">{vehicle.license_plate || '—'}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {[vehicle.vehicle_brand, vehicle.vehicle_model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{vehicle.warehouse_name || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusStyle(vehicle.status)}>{vehicle.status}</Badge>
                    </td>
                    {canManageFleet && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              setShowEdit(true);
                            }}
                            className="border-amber-600/40 text-amber-300 hover:bg-amber-950/30"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(vehicle)}
                            className="border-ruby-600/40 text-ruby-300 hover:bg-ruby-950/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreate && canManageFleet && (
        <CreateVehicleDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSubmit={handleCreate}
          loading={saving}
        />
      )}

      {showEdit && selectedVehicle && canManageFleet && (
        <EditVehicleDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          vehicle={selectedVehicle}
          onSubmit={handleEdit}
          loading={saving}
        />
      )}
    </div>
  );
};

export default FleetPage;
