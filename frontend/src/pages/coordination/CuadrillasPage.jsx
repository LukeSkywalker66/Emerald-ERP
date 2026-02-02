/**
 * CuadrillasPage.jsx
 * 
 * Página de gestión de cuadrillas (equipos de técnicos).
 * Interfaz Cyberpunk/Emerald con tarjetas, dialogs y gestión de miembros.
 */

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import coordinationService from '@/services/coordination.service';
import usersService from '@/services/users.service';
import rolesService from '@/services/roles.service';
import { getWarehouses } from '@/services/inventory.service';
import TeamCard from '@/components/coordination/TeamCard';
import CreateTeamDialog from '@/components/coordination/CreateTeamDialog';
import EditTeamDialog from '@/components/coordination/EditTeamDialog';

const CuadrillasPage = () => {
  // ========== STATE ==========
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  
  // Datos auxiliares
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  // ========== EFFECTS ==========

  useEffect(() => {
    loadTeams();
    loadUsers();
    loadVehicles();
  }, []);

  // ========== FUNCIONES ==========

  /**
   * Cargar lista de cuadrillas
   */
  const loadTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await coordinationService.getTeams({ active_only: false });
      setTeams(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading teams:', err);
      setError('No se pudieron cargar las cuadrillas');
      alert('❌ Error al cargar las cuadrillas');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cargar lista de usuarios disponibles
   */
  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const [usersData, rolesData] = await Promise.all([
        usersService.getAllUsers(),
        rolesService.getAllRoles(),
      ]);

      const usersList = Array.isArray(usersData) ? usersData : [];
      const rolesList = Array.isArray(rolesData) ? rolesData : [];
      const tecnicoRole = rolesList.find((role) =>
        String(role.name || '').toLowerCase().includes('tecnic')
      );

      const filteredUsers = usersList.filter((user) => {
        const roleName = String(user.role?.name || '').toLowerCase();
        const matchesByName = roleName.includes('tecnic');
        const matchesById = tecnicoRole
          ? (user.role_id === tecnicoRole.id || user.role?.id === tecnicoRole.id)
          : false;
        return matchesByName || matchesById;
      });

      setUsers(filteredUsers);
    } catch (err) {
      console.error('Error loading users:', err);
      // No mostrar error aquí, es secundario
    } finally {
      setLoadingUsers(false);
    }
  };

  /**
   * Cargar móviles disponibles (warehouses tipo MOBILE)
   */
  const loadVehicles = async () => {
    try {
      setLoadingVehicles(true);
      const data = await getWarehouses({ type: 'MOBILE', warehouse_type: 'MOBILE' });
      const list = Array.isArray(data) ? data : [];
      setVehicles(list);
    } catch (err) {
      console.error('Error loading vehicles:', err);
      // No mostrar error aquí, es secundario
    } finally {
      setLoadingVehicles(false);
    }
  };

  /**
   * Crear nueva cuadrilla
   */
  const handleCreateTeam = async (teamData) => {
    try {
      const { member_user_id, ...payload } = teamData;
      const newTeam = await coordinationService.createTeam(payload);

      if (member_user_id) {
        await coordinationService.addTeamMember(newTeam.id, {
          user_id: member_user_id,
          role: 'technician',
        });
      }

      await loadTeams();
      setShowCreateDialog(false);
      alert(`✅ Cuadrilla "${teamData.name}" creada exitosamente`);
    } catch (err) {
      console.error('Error creating team:', err);
      alert(`❌ Error al crear cuadrilla: ${err.message}`);
    }
  };

  /**
   * Editar cuadrilla existente
   */
  const handleEditTeam = async (teamId, teamData) => {
    try {
      const updated = await coordinationService.updateTeam(teamId, teamData);
      setTeams(teams.map(t => t.id === teamId ? updated : t));
      setShowEditDialog(false);
      setSelectedTeam(null);
      alert(`✅ Cuadrilla "${teamData.name}" actualizada exitosamente`);
    } catch (err) {
      console.error('Error updating team:', err);
      alert(`❌ Error al actualizar: ${err.message}`);
    }
  };

  /**
   * Eliminar cuadrilla
   */
  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la cuadrilla "${teamName}"?`)) {
      return;
    }

    try {
      await coordinationService.deleteTeam(teamId);
      setTeams(teams.filter(t => t.id !== teamId));
      alert(`✅ Cuadrilla "${teamName}" eliminada`);
    } catch (err) {
      console.error('Error deleting team:', err);
      alert(`❌ Error al eliminar: ${err.message}`);
    }
  };

  /**
   * Abrir dialog de edición
   */
  const handleOpenEditDialog = (team) => {
    setSelectedTeam(team);
    setShowEditDialog(true);
  };

  // ========== DERIVADOS ==========
  const assignedVehicleIds = new Set(
    teams
      .map((t) => t.vehicle_id)
      .filter((id) => id !== null && id !== undefined)
      .map((id) => Number(id))
  );

  const availableVehiclesForCreate = vehicles.filter(
    (v) => !assignedVehicleIds.has(Number(v.id))
  );

  const availableVehiclesForEdit = selectedTeam
    ? vehicles.filter(
        (v) =>
          !assignedVehicleIds.has(Number(v.id)) ||
          Number(v.id) === Number(selectedTeam.vehicle_id)
      )
    : vehicles;

  const assignedUserIds = new Set(
    teams
      .flatMap((t) => t.members || [])
      .map((m) => m.user_id)
      .filter((id) => id !== null && id !== undefined)
      .map((id) => Number(id))
  );

  const availableUsersForAssign = users.filter(
    (u) => !assignedUserIds.has(Number(u.id))
  );

  // ========== RENDER ==========

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-emerald-400 mb-2">
              ⚡ Gestión de Cuadrillas
            </h1>
            <p className="text-zinc-400">
              Administra equipos de técnicos y sus asignaciones
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nueva Cuadrilla
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="mb-6 border-red-600/40 bg-red-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-400">Error al cargar</h3>
              <p className="text-red-300 text-sm">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadTeams}
                className="mt-2 text-red-300 hover:text-red-200"
              >
                Reintentar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Cargando cuadrillas...</p>
          </div>
        </div>
      ) : teams.length === 0 ? (
        // Empty State
        <Card className="border-emerald-600/40 bg-zinc-900/50 p-12 text-center">
          <Users className="h-16 w-16 text-zinc-600 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-zinc-300 mb-2">
            Sin cuadrillas creadas
          </h3>
          <p className="text-zinc-400 mb-6">
            Crea una nueva cuadrilla para comenzar a gestionar tus equipos
          </p>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crear primera cuadrilla
          </Button>
        </Card>
      ) : (
        // Teams Grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              onEdit={handleOpenEditDialog}
              onDelete={handleDeleteTeam}
              availableUsers={availableUsersForAssign}
              onTeamUpdated={loadTeams}
            />
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      {showCreateDialog && (
        <CreateTeamDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={handleCreateTeam}
          availableUsers={availableUsersForAssign}
          loadingUsers={loadingUsers}
          availableVehicles={availableVehiclesForCreate}
          loadingVehicles={loadingVehicles}
        />
      )}

      {/* Edit Team Dialog */}
      {showEditDialog && selectedTeam && (
        <EditTeamDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          team={selectedTeam}
          onSubmit={handleEditTeam}
          availableUsers={users}
          loadingUsers={loadingUsers}
          availableVehicles={availableVehiclesForEdit}
          loadingVehicles={loadingVehicles}
        />
      )}
    </div>
  );
};

export default CuadrillasPage;
