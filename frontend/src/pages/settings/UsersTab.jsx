/**
 * UsersTab.jsx
 * Gestión de Usuarios embebida en SettingsPage
 *
 * Comportamiento según rol:
 *  - Admin/Superuser: CRUD completo sobre todos los usuarios
 *  - Otros roles: Solo ven su propio usuario + cambio de contraseña
 */
import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Ban,
  CheckCircle,
  Key,
  AlertTriangle,
  Trash2,
  Search,
  Pencil,
  Lock,
  Save,
  X,
  Eye,
  EyeOff,
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
import { Input } from '@/components/ui/input';
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
import usersService from '@/services/users.service';
import rolesService from '@/services/roles.service';
import { formatTimeAgo, isUserOnline } from '@/utils/time';
import { useAuth } from '@/context/AuthContext';

export default function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Determinar si el usuario actual es administrador ──
  const isAdmin =
    currentUser?.is_superuser ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin';

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editUser, setEditUser] = useState(null);

  // Password change (non-admin) state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordFormErrors, setPasswordFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [resetUserId, setResetUserId] = useState(null);
  const [resetPasswordMode, setResetPasswordMode] = useState('auto');
  const [customResetPassword, setCustomResetPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');

  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    password: '',
    confirmPassword: '',
    role_id: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    role_id: null,
  });
  const [editFormErrors, setEditFormErrors] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    // Solo los administradores necesitan cargar la lista completa de usuarios
    if (isAdmin) {
      loadUsers();
    } else {
      // No-admin no necesita llamar a la API, su info viene del contexto
      setLoading(false);
    }
    loadRoles();
  }, [isAdmin]);

  const loadRoles = async () => {
    try {
      const data = await rolesService.getAllRoles();
      setRoles(data);
      const defaultRole = data.find((r) => r.name === 'tecnico') || data[0];
      if (defaultRole && !formData.role_id) {
        setFormData((prev) => ({ ...prev, role_id: defaultRole.id }));
      }
    } catch (error) {
      console.error('Error al cargar roles:', error);
      setRoles([{ id: 5, name: 'tecnico', permissions: [] }]);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await usersService.getAllUsers();
      setUsers(data || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      if (error.response?.status === 401) {
        setError('Sesión expirada. Recarga la página e inicia sesión nuevamente.');
      } else if (error.response?.status === 403) {
        setError('No tienes permisos para gestionar usuarios.');
      } else {
        setError(error.response?.data?.detail || error.message || 'Error al cargar usuarios');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Password helpers ─────────────────────────────────────────────────

  const validatePassword = (password) => {
    if (!password || password.length < 8) return 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(password)) return 'Debe contener al menos una mayúscula';
    if (!/[a-z]/.test(password)) return 'Debe contener al menos una minúscula';
    if (!/[0-9]/.test(password)) return 'Debe contener al menos un número';
    return null;
  };

  const generatePassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const all = upper + lower + digits;
    let pwd = '';
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    for (let i = 0; i < 11; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  };

  // ── Handlers ─────────────────────────────────────────────────────────

  // ── Create user handlers ───────────────────────────────────────────

  const handleOpenCreateDialog = () => {
    setFormData({
      email: '',
      username: '',
      full_name: '',
      password: generatePassword(),
      confirmPassword: '',
      role_id: roles.find((r) => r.name === 'tecnico')?.id || roles[0]?.id || null,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.email.trim()) errors.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }
    if (!formData.username.trim()) errors.username = 'El username es obligatorio';
    const pwdError = validatePassword(formData.password);
    if (pwdError) errors.password = pwdError;
    // Validar confirmación de contraseña
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Debes confirmar la contraseña';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload = {
        email: formData.email.trim(),
        username: formData.username.trim(),
        full_name: formData.full_name.trim() || undefined,
        password: formData.password,
        role_id: formData.role_id || undefined,
      };
      await usersService.createUser(payload);
      setDialogOpen(false);
      await loadUsers();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail) && detail.length > 0) {
        alert(`Error de validación: ${detail[0].msg}`);
      } else {
        alert(`Error: ${error.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit user handlers ────────────────────────────────────────────

  const handleOpenEditDialog = (user) => {
    setEditUser(user);
    setEditFormData({
      email: user.email || '',
      username: user.username || '',
      full_name: user.full_name || '',
      role_id: user.role_id || null,
    });
    setEditFormErrors({});
    setEditDialogOpen(true);
  };

  const handleEditInputChange = (field, value) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
    if (editFormErrors[field]) {
      setEditFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateEditForm = () => {
    const errors = {};
    if (!editFormData.email.trim()) errors.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email)) {
      errors.email = 'Email inválido';
    }
    if (!editFormData.username.trim()) errors.username = 'El username es obligatorio';
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditUser = async () => {
    if (!validateEditForm() || !editUser) return;
    setEditSubmitting(true);
    try {
      const payload = {
        email: editFormData.email.trim(),
        username: editFormData.username.trim(),
        full_name: editFormData.full_name.trim() || undefined,
        role_id: editFormData.role_id || undefined,
      };
      await usersService.updateUser(editUser.id, payload);
      setEditDialogOpen(false);
      setEditUser(null);
      await loadUsers();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'object' && detail?.message) {
        alert(`Error: ${detail.message}`);
      } else if (Array.isArray(detail) && detail.length > 0) {
        alert(`Error de validación: ${detail[0].msg}`);
      } else {
        alert(`Error: ${error.response?.data?.detail || error.message}`);
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Password reset (admin) ────────────────────────────────────────

  const handleResetPassword = (userId) => {
    setResetUserId(userId);
    setResetPasswordMode('auto');
    setCustomResetPassword('');
    setResetPasswordError('');
    setResetDialogOpen(true);
  };

  const handleConfirmResetPassword = async () => {
    if (resetPasswordMode === 'custom') {
      const pwdError = validatePassword(customResetPassword);
      if (pwdError) {
        setResetPasswordError(pwdError);
        return;
      }
    }
    try {
      const password = resetPasswordMode === 'auto' ? null : customResetPassword;
      const result = await usersService.resetPassword(resetUserId, password);
      const tempPassword = result?.temporary_password || result?.new_password;
      if (tempPassword) {
        alert(`✅ Contraseña temporal: ${tempPassword}\n\nEntrégala al usuario. Se recomienda cambiar al primer inicio de sesión.`);
      } else {
        alert('✅ Contraseña reseteada correctamente.');
      }
      setResetDialogOpen(false);
    } catch (error) {
      alert(`Error al resetear contraseña: ${error.response?.data?.detail || error.message}`);
    }
  };

  // ── Toggle status & delete ────────────────────────────────────────

  const handleToggleStatus = async (user) => {
    try {
      await usersService.updateStatus(user.id, !user.is_active);
      await loadUsers();
    } catch (error) {
      alert(`Error al cambiar estado: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await usersService.deleteUser(userToDelete.id);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      await loadUsers();
    } catch (error) {
      alert(`Error al eliminar: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // ── Password change (non-admin) ────────────────────────────────────

  const handleOpenChangePassword = () => {
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setPasswordFormErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setChangePasswordOpen(true);
  };

  const validatePasswordForm = () => {
    const errors = {};
    const pwdError = validatePassword(passwordForm.newPassword);
    if (pwdError) errors.newPassword = pwdError;
    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = 'Debes confirmar la contraseña';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }
    setPasswordFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm()) return;
    setChangingPassword(true);
    try {
      // Usar el endpoint de self-service con contraseña actual
      await usersService.changeMyPassword(passwordForm.currentPassword, passwordForm.newPassword);
      alert('✅ Contraseña actualizada correctamente.');
      setChangePasswordOpen(false);
    } catch (error) {
      alert(`Error al cambiar contraseña: ${error.response?.data?.detail || error.message}`);
    } finally {
      setChangingPassword(false);
    }
  };

  // ── Filtered users ───────────────────────────────────────────────────

  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.full_name?.toLowerCase().includes(q)
    );
  });

  // ── Render: Non-admin view (solo su usuario + cambiar contraseña) ────

  if (!isAdmin) {
    // Usar datos del contexto Auth (JWT) ya que no se carga la lista completa de usuarios
    const myUser = users.find((u) => u.id === currentUser?.id) || {
      id: currentUser?.id,
      username: currentUser?.username,
      email: currentUser?.email,
      full_name: currentUser?.full_name,
      is_active: true,
      is_superuser: currentUser?.is_superuser,
      last_login: null,
      role: currentUser?.role ? { name: currentUser.role } : null,
    };

    return (
      <div className="space-y-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              Mi Usuario
            </CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
              Información de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-zinc-400 text-sm">Cargando información...</div>
            ) : myUser ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Usuario</p>
                    <p className="text-sm text-zinc-100 font-medium">{myUser.username}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Email</p>
                    <p className="text-sm text-zinc-100">{myUser.email}</p>
                  </div>
                  {myUser.full_name && (
                    <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Nombre Completo</p>
                      <p className="text-sm text-zinc-100">{myUser.full_name}</p>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Rol</p>
                    <p className="text-sm text-zinc-100 capitalize">{myUser.role?.name || 'Sin rol'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Estado</p>
                    <Badge
                      className={`text-xs ${
                        myUser.is_active
                          ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600'
                          : 'bg-red-600/20 text-red-400 border-red-600'
                      }`}
                    >
                      {myUser.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Último Acceso</p>
                    <p className="text-sm text-zinc-100">{formatTimeAgo(myUser.last_login)}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <Button
                    onClick={handleOpenChangePassword}
                    className="bg-amber-600 hover:bg-amber-700"
                    size="sm"
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Cambiar mi contraseña
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-zinc-500 text-sm">
                No se pudo cargar la información del usuario.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ Dialog: Cambiar Contraseña (non-admin) ═══ */}
        <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Lock className="h-5 w-5 text-amber-500" />
                Cambiar mi Contraseña
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Contraseña Actual */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Contraseña Actual *
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Tu contraseña actual"
                    value={passwordForm.currentPassword}
                    onChange={(e) => {
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }));
                    }}
                  />
                </div>
              </div>

              {/* Nueva Contraseña */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Nueva Contraseña *
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mín. 8 caracteres, 1 mayúscula, 1 minúscula, 1 número"
                    value={passwordForm.newPassword}
                    onChange={(e) => {
                      setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }));
                      setPasswordFormErrors((prev) => ({ ...prev, newPassword: undefined }));
                    }}
                    className={`pr-10 ${passwordFormErrors.newPassword ? 'border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordFormErrors.newPassword && (
                  <p className="text-xs text-red-400 mt-1">{passwordFormErrors.newPassword}</p>
                )}
              </div>

              {/* Confirmar Contraseña */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Confirmar Contraseña *
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repite la contraseña"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => {
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                      setPasswordFormErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    className={`pr-10 ${passwordFormErrors.confirmPassword ? 'border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordFormErrors.confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">{passwordFormErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setChangePasswordOpen(false)} disabled={changingPassword}>
                Cancelar
              </Button>
              <Button onClick={handleChangePassword} disabled={changingPassword} className="bg-amber-600 hover:bg-amber-700">
                {changingPassword ? 'Guardando...' : 'Cambiar Contraseña'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Render: Admin view (CRUD completo) ─────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar usuarios..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button
          onClick={handleOpenCreateDialog}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Users Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            Usuarios del Sistema
          </CardTitle>
          <CardDescription className="text-zinc-500 text-xs">
            {filteredUsers.length} de {users.length} usuario{users.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h3 className="font-semibold text-red-300 text-sm">Error de Acceso</h3>
                <p className="text-sm text-red-200">{error}</p>
                <Button onClick={loadUsers} variant="outline" size="sm" className="mt-2">
                  Reintentar
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-zinc-400 text-sm">Cargando usuarios...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              {searchQuery ? 'No se encontraron usuarios con ese criterio.' : 'No hay usuarios registrados.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400 text-xs uppercase">Usuario</TableHead>
                    <TableHead className="text-zinc-400 text-xs uppercase">Email</TableHead>
                    <TableHead className="text-zinc-400 text-xs uppercase">Estado</TableHead>
                    <TableHead className="text-zinc-400 text-xs uppercase">Rol</TableHead>
                    <TableHead className="text-zinc-400 text-xs uppercase">Último Acceso</TableHead>
                    <TableHead className="text-zinc-400 text-xs uppercase text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-zinc-800 hover:bg-zinc-800/30">
                      <TableCell className="font-medium text-zinc-100">
                        <div className="flex items-center gap-2">
                          {user.is_superuser && (
                            <Shield className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span className="text-sm">{user.username}</span>
                          {user.full_name && (
                            <span className="text-xs text-zinc-500 hidden sm:inline">
                              ({user.full_name})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-300 text-sm">{user.email}</TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600 text-xs">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Activo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-600/20 text-red-400 border-red-600 text-xs">
                            <Ban className="mr-1 h-3 w-3" />
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-300 text-sm">
                        {user.role?.name ? (
                          <span className="capitalize">{user.role.name}</span>
                        ) : (
                          <span className="text-zinc-500">Sin rol</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              isUserOnline(user.last_login) ? 'bg-emerald-500' : 'bg-zinc-700'
                            }`}
                          />
                          <span className="text-xs text-zinc-500">
                            {formatTimeAgo(user.last_login)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* ✏️ Editar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDialog(user)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100"
                            title="Editar usuario"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {/* 🔑 Resetear contraseña */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetPassword(user.id)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100"
                            title="Resetear contraseña"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {/* Activar / Desactivar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(user)}
                            className={`h-8 w-8 p-0 ${
                              user.is_active
                                ? 'text-red-400 hover:text-red-300'
                                : 'text-emerald-400 hover:text-emerald-300'
                            }`}
                            title={user.is_active ? 'Desactivar' : 'Activar'}
                          >
                            {user.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                          {/* 🗑️ Eliminar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                            className="h-8 w-8 p-0 text-zinc-600 hover:text-red-400"
                            title="Eliminar permanentemente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Dialog: Crear Usuario ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5 text-emerald-500" />
              Crear Nuevo Usuario
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email *</label>
              <Input
                type="email"
                placeholder="usuario@emerald.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={formErrors.email ? 'border-red-500' : ''}
              />
              {formErrors.email && <p className="text-xs text-red-400 mt-1">{formErrors.email}</p>}
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Username *</label>
              <Input
                type="text"
                placeholder="usuario123"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={formErrors.username ? 'border-red-500' : ''}
              />
              {formErrors.username && <p className="text-xs text-red-400 mt-1">{formErrors.username}</p>}
            </div>

            {/* Nombre Completo */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nombre Completo</label>
              <Input
                type="text"
                placeholder="Juan Pérez"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Contraseña *</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`flex-1 ${formErrors.password ? 'border-red-500' : ''} font-mono text-xs`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInputChange('password', generatePassword())}
                  className="text-xs whitespace-nowrap"
                >
                  Generar
                </Button>
              </div>
              {formErrors.password && <p className="text-xs text-red-400 mt-1">{formErrors.password}</p>}
              {!formErrors.password && formData.password && (
                <p className="text-xs text-zinc-500 mt-1">
                  {formData.password.length >= 8 && '✓ Longitud OK'}
                  {formData.password.length >= 8 && /[A-Z]/.test(formData.password) && ' · ✓ Mayúscula'}
                  {formData.password.length >= 8 && /[a-z]/.test(formData.password) && ' · ✓ Minúscula'}
                  {formData.password.length >= 8 && /[0-9]/.test(formData.password) && ' · ✓ Número'}
                </p>
              )}
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirmar Contraseña *</label>
              <Input
                type="password"
                placeholder="Repite la contraseña"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={formErrors.confirmPassword ? 'border-red-500' : ''}
              />
              {formErrors.confirmPassword && (
                <p className="text-xs text-red-400 mt-1">{formErrors.confirmPassword}</p>
              )}
            </div>

            {/* Rol */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Rol</label>
              <select
                value={formData.role_id || ''}
                onChange={(e) => handleInputChange('role_id', parseInt(e.target.value))}
                className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              >
                {roles.length === 0 && <option value="">Cargando roles...</option>}
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Editar Usuario ═══ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-5 w-5 text-blue-500" />
              Editar Usuario: {editUser?.username}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email *</label>
              <Input
                type="email"
                placeholder="usuario@emerald.com"
                value={editFormData.email}
                onChange={(e) => handleEditInputChange('email', e.target.value)}
                className={editFormErrors.email ? 'border-red-500' : ''}
              />
              {editFormErrors.email && <p className="text-xs text-red-400 mt-1">{editFormErrors.email}</p>}
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Username *</label>
              <Input
                type="text"
                placeholder="usuario123"
                value={editFormData.username}
                onChange={(e) => handleEditInputChange('username', e.target.value)}
                className={editFormErrors.username ? 'border-red-500' : ''}
              />
              {editFormErrors.username && <p className="text-xs text-red-400 mt-1">{editFormErrors.username}</p>}
            </div>

            {/* Nombre Completo */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nombre Completo</label>
              <Input
                type="text"
                placeholder="Juan Pérez"
                value={editFormData.full_name}
                onChange={(e) => handleEditInputChange('full_name', e.target.value)}
              />
            </div>

            {/* Rol */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Rol</label>
              <select
                value={editFormData.role_id || ''}
                onChange={(e) => handleEditInputChange('role_id', parseInt(e.target.value))}
                className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              >
                {roles.length === 0 && <option value="">Cargando roles...</option>}
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)} disabled={editSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleEditUser} disabled={editSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {editSubmitting ? 'Guardando...' : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Reset Contraseña ═══ */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Key className="h-5 w-5 text-amber-500" />
              Resetear Contraseña
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-zinc-400">Elige cómo establecer la nueva contraseña:</p>

            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-800/50">
                <input
                  type="radio"
                  name="resetMode"
                  value="auto"
                  checked={resetPasswordMode === 'auto'}
                  onChange={(e) => setResetPasswordMode(e.target.value)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-sm font-medium text-zinc-200">Generar automáticamente</div>
                  <div className="text-xs text-zinc-500">Contraseña robusta de 14 caracteres</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-800/50">
                <input
                  type="radio"
                  name="resetMode"
                  value="custom"
                  checked={resetPasswordMode === 'custom'}
                  onChange={(e) => setResetPasswordMode(e.target.value)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-sm font-medium text-zinc-200">Escribir manualmente</div>
                  <div className="text-xs text-zinc-500">Define tú la contraseña temporal</div>
                </div>
              </label>
            </div>

            {resetPasswordMode === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nueva Contraseña *</label>
                <Input
                  type="password"
                  placeholder="Min. 8 caracteres, 1 mayúscula, 1 minúscula, 1 número"
                  value={customResetPassword}
                  onChange={(e) => {
                    setCustomResetPassword(e.target.value);
                    setResetPasswordError('');
                  }}
                  className={resetPasswordError ? 'border-red-500' : ''}
                />
                {resetPasswordError && <p className="text-xs text-red-400 mt-1">{resetPasswordError}</p>}
                {!resetPasswordError && customResetPassword && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {customResetPassword.length >= 8 && '✓ Longitud OK'}
                    {customResetPassword.length >= 8 && /[A-Z]/.test(customResetPassword) && ' · ✓ Mayúscula'}
                    {customResetPassword.length >= 8 && /[a-z]/.test(customResetPassword) && ' · ✓ Minúscula'}
                    {customResetPassword.length >= 8 && /[0-9]/.test(customResetPassword) && ' · ✓ Número'}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmResetPassword} className="bg-amber-600 hover:bg-amber-700">
              Resetear Contraseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Confirmar Eliminación ═══ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-5 w-5 text-red-500" />
              Eliminar Usuario
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-zinc-300">
            ¿Estás seguro de eliminar permanentemente a <strong>{userToDelete?.username}</strong>?
          </p>
          <p className="text-xs text-zinc-500">
            Esta acción solo es posible si el usuario no tiene historial asociado (tickets, OT, etc.).
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
