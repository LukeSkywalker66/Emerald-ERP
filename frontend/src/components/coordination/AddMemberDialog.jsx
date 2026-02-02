/**
 * AddMemberDialog.jsx
 * 
 * Dialog para agregar miembro a una cuadrilla.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const AddMemberDialog = ({
  open,
  onOpenChange,
  teamId,
  availableUsers = [],
  onSubmit,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('technician');

  const handleSubmit = async () => {
    if (!selectedUserId) {
      alert('Selecciona un técnico');
      return;
    }

    try {
      setLoading(true);
      await onSubmit(parseInt(selectedUserId), selectedRole);
      
      // Reset form
      setSelectedUserId('');
      setSelectedRole('technician');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-emerald-600/40">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">
            ➕ Agregar Miembro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {availableUsers.length === 0 ? (
            <div className="p-4 rounded bg-zinc-800/50 border border-zinc-700/30 text-center">
              <p className="text-zinc-400 text-sm">
                Todos los usuarios ya son miembros de esta cuadrilla
              </p>
            </div>
          ) : (
            <>
              {/* Usuario */}
              <div className="space-y-2">
                <label htmlFor="user_select" className="block text-sm font-medium text-zinc-300">
                  Técnico *
                </label>
                <select
                  id="user_select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="">Selecciona un técnico...</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id.toString()}>
                      {user.full_name || user.username}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <label htmlFor="role_select" className="block text-sm font-medium text-zinc-300">
                  Rol en la Cuadrilla *
                </label>
                <select
                  id="role_select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="technician">Técnico (ejecuta trabajos)</option>
                  <option value="leader">Líder (responsable de cuadrilla)</option>
                </select>
                <p className="text-xs text-zinc-400 mt-1">
                  • <strong>Técnico:</strong> Ejecuta trabajos<br />
                  • <strong>Líder:</strong> Responsable de la cuadrilla
                </p>
              </div>
            </>
          )}
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
            disabled={loading || !selectedUserId || availableUsers.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? 'Agregando...' : 'Agregar Miembro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemberDialog;
