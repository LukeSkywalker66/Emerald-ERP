import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Shield,
  Ban,
  CheckCircle,
  Key,
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import usersService from '@/services/users.service';
import rolesService from '@/services/roles.service';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    password: '',
    role_id: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const data = await rolesService.getAllRoles();
      setRoles(data);
      // Establecer rol por defecto (técnico si existe)
      const defaultRole = data.find((r) => r.name === 'tecnico') || data[0];
      if (defaultRole && !formData.role_id) {
        setFormData((prev) => ({ ...prev, role_id: defaultRole.id }));
      }
    } catch (error) {
      console.error('Error al cargar roles:', error);
      // Si falla, usar lista mínima de fallback
      setRoles([
        { id: 5, name: 'tecnico', permissions: [] },
      ]);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await usersService.getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      
      // Manejar errores específicos
      if (error.response?.status === 401) {
        alert('Sesión expirada o no autenticado. Redirigiendo al login...');
        localStorage.removeItem('emerald_token');
        localStorage.removeItem('emerald_email');
        navigate('/login');
        return;
      }
      
      if (error.response?.status === 403) {
        setError('No tienes permisos para acceder a este módulo. Solo superusuarios pueden gestionar usuarios.');
        return;
      }
      
      setError(error.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (userId) => {
    if (!confirm('¿Resetear contraseña de este usuario?')) return;
    
    try {
      const result = await usersService.resetPassword(userId);
      prompt(
        'Contraseña temporal generada (copiar y entregar al usuario):',
        result.temporary_password
      );
      alert('Contraseña reseteada exitosamente');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleToggleStatus = async (user) => {
    const action = user.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Seguro que desea ${action} a ${user.username}?`)) return;

    try {
      await usersService.updateStatus(user.id, !user.is_active);
      alert(`Usuario ${action}do exitosamente`);
      loadUsers();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleOpenCreateDialog = () => {
    // Resetear formulario con rol por defecto
    const defaultRole = roles.find((r) => r.name === 'tecnico') || roles[0];
    setFormData({
      email: '',
      username: '',
      full_name: '',
      password: '',
      role_id: defaultRole?.id || null,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }
    
    if (!formData.username.trim()) {
      errors.username = 'El username es requerido';
    } else if (formData.username.length < 3) {
      errors.username = 'Mínimo 3 caracteres';
    }
    
    if (!formData.password.trim()) {
      errors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 8) {
      errors.password = 'Mínimo 8 caracteres';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      await usersService.createUser(formData);
      alert(`Usuario ${formData.username} creado exitosamente`);
      setDialogOpen(false);
      loadUsers();
    } catch (error) {
      if (error.response?.status === 409) {
        alert('Error: El email o username ya existe');
      } else {
        alert(`Error: ${error.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo al editar
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
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
          onClick={handleOpenCreateDialog}
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
          {error ? (
            <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h3 className="font-semibold text-red-300">
                  Error de Acceso
                </h3>
                <p className="text-sm text-red-200">{error}</p>
                <Button
                  onClick={() => navigate('/app')}
                  variant="outline"
                  size="sm"
                  className="mt-2 border-red-700 text-red-300 hover:bg-red-900/30"
                >
                  Volver al Dashboard
                </Button>
              </div>
            </div>
          ) : loading ? (
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
                        title="Resetear contraseña"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(user)}
                        className={
                          user.is_active
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }
                        title={user.is_active ? 'Desactivar' : 'Activar'}
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

      {/* Dialog Crear Usuario */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-500" />
              Crear Nuevo Usuario
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Email *
              </label>
              <Input
                type="email"
                placeholder="usuario@emerald.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={formErrors.email ? 'border-red-500' : ''}
              />
              {formErrors.email && (
                <p className="text-xs text-red-400 mt-1">{formErrors.email}</p>
              )}
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Username *
              </label>
              <Input
                type="text"
                placeholder="usuario123"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={formErrors.username ? 'border-red-500' : ''}
              />
              {formErrors.username && (
                <p className="text-xs text-red-400 mt-1">{formErrors.username}</p>
              )}
            </div>

            {/* Nombre Completo */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Nombre Completo
              </label>
              <Input
                type="text"
                placeholder="Juan Pérez"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Contraseña *
              </label>
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={formErrors.password ? 'border-red-500' : ''}
              />
              {formErrors.password && (
                <p className="text-xs text-red-400 mt-1">{formErrors.password}</p>
              )}
            </div>

            {/* Rol */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Rol
              </label>
              <select
                value={formData.role_id || ''}
                onChange={(e) => handleInputChange('role_id', parseInt(e.target.value))}
                className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              >
                {roles.length === 0 && (
                  <option value="">Cargando roles...</option>
                )}
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
