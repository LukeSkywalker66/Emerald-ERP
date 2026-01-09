import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Ban,
  CheckCircle,
  Key,
  UserCog,
  AlertTriangle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import usersService from '@/services/users.service';

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [confirmActionDialog, setConfirmActionDialog] = useState(null);

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    full_name: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await usersService.getAllUsers();
      setUsers(data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar usuarios',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      await usersService.createUser(formData);
      toast({
        title: 'Usuario creado',
        description: `Usuario ${formData.username} creado exitosamente`,
      });
      setCreateDialogOpen(false);
      setFormData({ email: '', username: '', password: '', full_name: '' });
      loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al crear usuario',
        description: error.message,
      });
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      const result = await usersService.resetPassword(userId);
      setTemporaryPassword(result.temporary_password);
      setResetPasswordDialog(result);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al resetear contraseña',
        description: error.message,
      });
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await usersService.updateStatus(userId, !currentStatus);
      toast({
        title: currentStatus ? 'Usuario desactivado' : 'Usuario activado',
        description: 'Estado actualizado correctamente',
      });
      setConfirmActionDialog(null);
      loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al cambiar estado',
        description: error.message,
      });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado',
      description: 'Contraseña temporal copiada al portapapeles',
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Gestión de Usuarios
          </h1>
          <p className="text-zinc-400 mt-1">
            Administrar usuarios del sistema Emerald
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Crear Usuario
        </Button>
      </div>

      {/* Users Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center">
            <Users className="mr-2 h-5 w-5 text-emerald-500" />
            Usuarios del Sistema
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrado
            {users.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-zinc-400">
              Cargando usuarios...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-300">Usuario</TableHead>
                  <TableHead className="text-zinc-300">Email</TableHead>
                  <TableHead className="text-zinc-300">Estado</TableHead>
                  <TableHead className="text-zinc-300">Rol</TableHead>
                  <TableHead className="text-zinc-300 text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-zinc-800">
                    <TableCell className="font-medium text-zinc-100">
                      <div className="flex items-center">
                        {user.is_superuser && (
                          <Shield className="mr-2 h-4 w-4 text-amber-500" />
                        )}
                        {user.username}
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Activo
                        </Badge>
                      ) : (
                        <Badge className="bg-red-600/20 text-red-400 border-red-600">
                          <Ban className="mr-1 h-3 w-3" />
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {user.role?.name || (
                        <span className="text-zinc-500">Sin rol</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetPassword(user.id)}
                        className="text-zinc-400 hover:text-zinc-100"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmActionDialog({ user, action: 'toggle' })
                        }
                        className={
                          user.is_active
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }
                      >
                        {user.is_active ? (
                          <Ban className="h-4 w-4" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <UserPlus className="mr-2 h-5 w-5 text-emerald-500" />
              Crear Nuevo Usuario
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Complete los datos para crear un nuevo usuario en el sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@emerald.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de Usuario</Label>
              <Input
                id="username"
                placeholder="usuario"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre Completo</Label>
              <Input
                id="full_name"
                placeholder="Nombre Completo"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700"
              />
              <p className="text-xs text-zinc-500">
                Debe contener mayúsculas, minúsculas, números y símbolos
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Crear Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={!!resetPasswordDialog}
        onOpenChange={() => setResetPasswordDialog(null)}
      >
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center text-amber-500">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Contraseña Temporal Generada
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              La contraseña ha sido reseteada. Copie y entregue esta contraseña
              temporal al usuario.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
            <code className="text-amber-400 text-lg font-mono break-all">
              {temporaryPassword}
            </code>
          </div>
          <DialogFooter>
            <Button
              onClick={() => copyToClipboard(temporaryPassword)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Copiar Contraseña
            </Button>
            <Button
              variant="outline"
              onClick={() => setResetPasswordDialog(null)}
              className="border-zinc-700 text-zinc-300"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <AlertDialog
        open={!!confirmActionDialog}
        onOpenChange={() => setConfirmActionDialog(null)}
      >
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmActionDialog?.user?.is_active
                ? 'Desactivar Usuario'
                : 'Activar Usuario'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {confirmActionDialog?.user?.is_active
                ? `¿Desactivar al usuario ${confirmActionDialog?.user?.username}? No podrá acceder al sistema.`
                : `¿Activar al usuario ${confirmActionDialog?.user?.username}? Podrá acceder nuevamente al sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                handleToggleStatus(
                  confirmActionDialog?.user?.id,
                  confirmActionDialog?.user?.is_active
                )
              }
              className={
                confirmActionDialog?.user?.is_active
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }
            >
              {confirmActionDialog?.user?.is_active
                ? 'Desactivar'
                : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
