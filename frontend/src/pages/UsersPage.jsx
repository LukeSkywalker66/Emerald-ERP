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
import usersService from '@/services/users.service';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

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
          onClick={() => alert('Crear usuario: implementar formulario')}
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
    </div>
  );
}
