/**
 * AddMemberDialog.jsx
 * 
 * Dialog para agregar miembro a una cuadrilla.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
                <Label htmlFor="user_select" className="text-zinc-300">
                  Técnico *
                </Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger
                    id="user_select"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  >
                    <SelectValue placeholder="Selecciona un técnico" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {availableUsers.map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        <span className="text-zinc-100">
                          {user.full_name || user.username}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="role_select" className="text-zinc-300">
                  Rol en la Cuadrilla *
                </Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger
                    id="role_select"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="technician" className="text-zinc-100">
                      Técnico
                    </SelectItem>
                    <SelectItem value="leader" className="text-zinc-100">
                      Líder
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-400">
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
