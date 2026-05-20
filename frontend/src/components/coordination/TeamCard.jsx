/**
 * TeamCard.jsx
 * 
 * Tarjeta visual de una cuadrilla con información y acciones.
 * Diseño Cyberpunk/Emerald.
 */

import { useState } from 'react';
import { Edit2, Trash2, Users, Plus, X, Truck, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Avatar from '@/components/ui/Avatar';
import coordinationService from '@/services/coordination.service';
import AddMemberDialog from './AddMemberDialog';

const TeamCard = ({
  team,
  onEdit,
  onDelete,
  availableUsers = [],
  onTeamUpdated,
}) => {
  const [showAddMember, setShowAddMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [updatingMemberId, setUpdatingMemberId] = useState(null);

  // El vehículo viene resuelto via JOIN desde el backend (TeamDetailResponse.vehicle)
  const assignedVehicle = team?.vehicle || null;

  /**
   * Obtener color de rol
   */
  const getRoleColor = (role) => {
    switch (role) {
      case 'leader':
        return 'bg-cyan-600/20 text-cyan-300 border-cyan-600/40';
      case 'technician':
        return 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40';
      default:
        return 'bg-zinc-600/20 text-zinc-300 border-zinc-600/40';
    }
  };

  /**
   * Eliminar miembro de la cuadrilla
   */
  const handleRemoveMember = async (userId) => {
    try {
      setRemovingMemberId(userId);
      await coordinationService.removeTeamMember(team.id, userId);
      
      alert('✅ Miembro removido de la cuadrilla');

      // Recargar datos
      if (onTeamUpdated) {
        onTeamUpdated();
      }
    } catch (err) {
      console.error('Error removing member:', err);
      alert(`❌ Error al remover miembro: ${err.message}`);
    } finally {
      setRemovingMemberId(null);
    }
  };

  /**
   * Manejar agregar miembro
   */
  const handleAddMemberSubmit = async (userId, role) => {
    try {
      await coordinationService.addTeamMember(team.id, {
        user_id: userId,
        role,
      });

      alert('✅ Miembro agregado a la cuadrilla');

      setShowAddMember(false);
      if (onTeamUpdated) {
        onTeamUpdated();
      }
    } catch (err) {
      console.error('Error adding member:', err);
      alert(`❌ Error al agregar miembro: ${err.message}`);
    }
  };

  /**
   * Actualizar rol de un miembro (solo 1 líder por cuadrilla)
   */
  const handleRoleChange = async (member, newRole) => {
    if (!member || member.role === newRole) return;

    const currentLeader = team.members?.find((m) => m.role === 'leader');
    const promotingToLeader =
      newRole === 'leader' &&
      currentLeader &&
      currentLeader.user_id !== member.user_id;

    if (promotingToLeader) {
      const confirm = window.confirm(
        `Esta cuadrilla ya tiene líder (${currentLeader.user_name}). ¿Querés reemplazarlo?`
      );
      if (!confirm) return;
    }

    try {
      setUpdatingMemberId(member.user_id);

      if (promotingToLeader) {
        await coordinationService.updateMemberRole(
          team.id,
          currentLeader.user_id,
          'technician'
        );
      }

      await coordinationService.updateMemberRole(
        team.id,
        member.user_id,
        newRole
      );

      alert('✅ Rol actualizado correctamente');

      if (onTeamUpdated) {
        onTeamUpdated();
      }
    } catch (err) {
      console.error('Error updating member role:', err);
      alert(`❌ Error al actualizar rol: ${err.message}`);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  return (
    <>
      <Card className="border-emerald-600/40 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all overflow-hidden">
        {/* Header - Info de Cuadrilla */}
        <div className="p-5 border-b border-emerald-600/20">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-emerald-400 mb-1">
                {team.name}
              </h3>
              <p className="text-sm text-zinc-400">
                {team.member_count} técnico{team.member_count !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {team.is_active ? (
                <Badge className="bg-emerald-600/30 text-emerald-300 border-emerald-600/40">
                  Activa
                </Badge>
              ) : (
                <Badge className="bg-zinc-600/30 text-zinc-400 border-zinc-600/40">
                  Inactiva
                </Badge>
              )}
            </div>
          </div>

          {/* Líder */}
          {team.leader_name && (
            <div className="text-xs text-zinc-500">
              <span className="text-zinc-400">Líder:</span>{' '}
              <span className="text-emerald-300 font-semibold">
                {team.leader_name}
              </span>
            </div>
          )}
        </div>

        {/* Body - Miembros */}
        <div className="p-5 min-h-[120px] flex flex-col">
          <div className="mb-4 rounded-md border border-zinc-700/60 bg-zinc-900/70 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <Truck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Vehículo asignado</span>
            </div>
            {assignedVehicle ? (
              <>
                <p className="text-sm text-zinc-100 font-medium truncate">
                  {assignedVehicle.name}
                </p>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  {assignedVehicle.vehicle_model || 'Modelo s/d'} · {assignedVehicle.license_plate || 'Patente s/d'}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                  <Package className="h-3 w-3 text-amber-400" />
                  <span>{assignedVehicle.full_name || assignedVehicle.name || 'Warehouse s/d'}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-500">Sin vehículo asignado</p>
            )}
          </div>

          {team.members && team.members.length > 0 ? (
            <div className="space-y-2 flex-1">
              {team.members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-2 py-1 rounded bg-zinc-800/30 border border-zinc-700/30 hover:border-emerald-600/30 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Avatar
                      name={member.user_name}
                      email={member.user_email}
                      size="sm"
                      variant="emerald"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">
                        {member.user_name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {member.user_email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member, e.target.value)}
                      disabled={updatingMemberId === member.user_id}
                      className={`text-xs px-1.5 py-0.5 rounded border bg-zinc-900 ${getRoleColor(member.role)}`}
                      title="Cambiar rol"
                    >
                      <option value="technician">Técnico</option>
                      <option value="leader">Líder</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.user_id)}
                      disabled={removingMemberId === member.user_id}
                      className="h-5 w-5 p-0 text-zinc-500 hover:text-ruby-400 hover:bg-ruby-950/20 flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center text-center py-6">
              <div>
                <Users className="h-8 w-8 text-zinc-600 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-zinc-400">Sin miembros asignados</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Acciones */}
        <div className="p-4 border-t border-emerald-600/20 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddMember(true)}
            className="flex-1 border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/30"
          >
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(team)}
            className="border-amber-600/40 text-amber-300 hover:bg-amber-950/30"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(team.id, team.name)}
            className="border-ruby-600/40 text-ruby-300 hover:bg-ruby-950/30"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Add Member Dialog */}
      {showAddMember && (
        <AddMemberDialog
          open={showAddMember}
          onOpenChange={setShowAddMember}
          teamId={team.id}
          availableUsers={availableUsers.filter(
            u => !team.members.some(m => m.user_id === u.id)
          )}
          onSubmit={handleAddMemberSubmit}
        />
      )}
    </>
  );
};

export default TeamCard;
