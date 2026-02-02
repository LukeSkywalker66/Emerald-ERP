/**
 * TeamCard.jsx
 * 
 * Tarjeta visual de una cuadrilla con información y acciones.
 * Diseño Cyberpunk/Emerald.
 */

import { useState } from 'react';
import { Edit2, Trash2, Users, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import coordinationService from '@/services/coordination.service';
import AddMemberDialog from './AddMemberDialog';

const TeamCard = ({
  team,
  onEdit,
  onDelete,
  availableUsers = [],
  onTeamUpdated,
}) => {
  const { toast } = useToast();
  const [showAddMember, setShowAddMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  /**
   * Obtener iniciales del nombre de usuario
   */
  const getInitials = (name) => {
    return name
      ?.split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase() || '?';
  };

  /**
   * Obtener color de rol
   */
  const getRoleColor = (role) => {
    switch (role) {
      case 'leader':
        return 'bg-ruby-600/20 text-ruby-300 border-ruby-600/40';
      case 'technician':
        return 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40';
      default:
        return 'bg-zinc-600/20 text-zinc-300 border-zinc-600/40';
    }
  };

  /**
   * Traducir rol al español
   */
  const getRoleLabel = (role) => {
    switch (role) {
      case 'leader':
        return 'Líder';
      case 'technician':
        return 'Técnico';
      default:
        return role;
    }
  };

  /**
   * Eliminar miembro de la cuadrilla
   */
  const handleRemoveMember = async (userId) => {
    try {
      setRemovingMemberId(userId);
      await coordinationService.removeTeamMember(team.id, userId);
      
      toast({
        title: '✅ Miembro removido',
        description: 'El técnico fue removido de la cuadrilla',
      });

      // Recargar datos
      if (onTeamUpdated) {
        onTeamUpdated();
      }
    } catch (err) {
      console.error('Error removing member:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo remover el miembro',
      });
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

      toast({
        title: '✅ Miembro agregado',
        description: 'El técnico fue agregado a la cuadrilla',
      });

      setShowAddMember(false);
      if (onTeamUpdated) {
        onTeamUpdated();
      }
    } catch (err) {
      console.error('Error adding member:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.response?.data?.detail || 'No se pudo agregar el miembro',
      });
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
          {team.members && team.members.length > 0 ? (
            <div className="space-y-2 flex-1">
              {team.members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded bg-zinc-800/30 border border-zinc-700/30 hover:border-emerald-600/30 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-8 w-8 bg-emerald-600/20 border border-emerald-600/40">
                      <AvatarFallback className="text-xs text-emerald-300">
                        {getInitials(member.user_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">
                        {member.user_name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {member.user_email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getRoleColor(member.role)}`}>
                      {getRoleLabel(member.role)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.user_id)}
                      disabled={removingMemberId === member.user_id}
                      className="h-6 w-6 p-0 text-zinc-500 hover:text-ruby-400 hover:bg-ruby-950/20"
                    >
                      <X className="h-4 w-4" />
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
