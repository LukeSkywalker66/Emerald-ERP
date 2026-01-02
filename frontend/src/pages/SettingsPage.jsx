import React, { useState } from 'react';
import { Settings, Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('team');

  // Mock users data
  const users = [
    {
      id: 1,
      name: 'Admin Central',
      email: 'admin@2finternet.ar',
      role: 'Admin',
      status: 'Active',
      lastAccess: '2 horas',
      avatar: 'AC'
    },
    {
      id: 2,
      name: 'Técnico 1 - NOC',
      email: 'tecnico1@2finternet.ar',
      role: 'Técnico',
      status: 'Active',
      lastAccess: '30 min',
      avatar: 'T1'
    },
    {
      id: 3,
      name: 'Operador NOC',
      email: 'operador@2finternet.ar',
      role: 'Operador',
      status: 'Active',
      lastAccess: '15 min',
      avatar: 'ON'
    },
    {
      id: 4,
      name: 'Técnico 2 - Campo',
      email: 'tecnico2@2finternet.ar',
      role: 'Técnico',
      status: 'Inactive',
      lastAccess: '3 días',
      avatar: 'T2'
    },
    {
      id: 5,
      name: 'Supervisor',
      email: 'supervisor@2finternet.ar',
      role: 'Admin',
      status: 'Active',
      lastAccess: '1 hora',
      avatar: 'SV'
    }
  ];

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'Admin':
        return 'gold';
      case 'Técnico':
        return 'emerald';
      case 'Operador':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getStatusDot = (status) => {
    return status === 'Active'
      ? 'bg-emerald-500 animate-pulse'
      : 'bg-zinc-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Settings className="text-emerald-400" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Ajustes</h1>
            <p className="text-sm text-zinc-400">Gestiona la configuración del Orquestador</p>
          </div>
        </div>
      </div>

      {/* Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="team">Mi Equipo</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        {/* Tab: Mi Equipo */}
        <TabsContent value="team" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-50">Gestión de Usuarios</h2>
              <p className="text-zinc-400 text-sm mt-1">{users.length} usuarios configurados</p>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
              <Plus size={18} className="mr-2" />
              Invitar Usuario
            </Button>
          </div>

          {/* Users Table */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-800/30">
                <TableRow>
                  <TableHead className="text-zinc-300">Nombre</TableHead>
                  <TableHead className="text-zinc-300">Email</TableHead>
                  <TableHead className="text-zinc-300">Rol</TableHead>
                  <TableHead className="text-zinc-300">Estado</TableHead>
                  <TableHead className="text-zinc-300">Último Acceso</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="hover:bg-zinc-800/20 border-zinc-800/50"
                  >
                    <TableCell className="font-medium text-zinc-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-600/50 flex items-center justify-center">
                          <span className="text-xs font-bold text-emerald-400">
                            {user.avatar}
                          </span>
                        </div>
                        {user.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusDot(user.status)}`}></div>
                        <span className={user.status === 'Active' ? 'text-emerald-400' : 'text-zinc-500'}>
                          {user.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm font-mono">
                      {user.lastAccess}
                    </TableCell>
                    <TableCell>
                      <button className="p-2 hover:bg-zinc-700/50 rounded transition-colors">
                        <MoreHorizontal size={16} className="text-zinc-500" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Info Box */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <p className="text-zinc-400 text-sm">
              💡 <span className="ml-2">Los permisos se gestionan por rol. Próximamente: asignación de permisos granulares.</span>
            </p>
          </div>
        </TabsContent>

        {/* Tab: General */}
        <TabsContent value="general" className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-50 mb-6">Configuración General</h2>

            <div className="space-y-4">
              {/* Empresa */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <label className="block text-zinc-300 text-sm font-medium mb-2">
                  Empresa
                </label>
                <input
                  type="text"
                  defaultValue="2F INTERNET ARGENTINA S.A."
                  readOnly
                  className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded px-3 py-2 text-zinc-400 text-sm cursor-not-allowed"
                />
                <p className="text-zinc-500 text-xs mt-2">Read-only. Cambiar requiere contacto con soporte.</p>
              </div>

              {/* Dominio */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <label className="block text-zinc-300 text-sm font-medium mb-2">
                  Dominio Principal
                </label>
                <input
                  type="text"
                  defaultValue="emerald.2finternet.ar"
                  readOnly
                  className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded px-3 py-2 text-zinc-400 text-sm cursor-not-allowed"
                />
              </div>

              {/* Zona Horaria */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <label className="block text-zinc-300 text-sm font-medium mb-2">
                  Zona Horaria
                </label>
                <input
                  type="text"
                  defaultValue="America/Argentina/Buenos_Aires (ART, UTC-3)"
                  readOnly
                  className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded px-3 py-2 text-zinc-400 text-sm cursor-not-allowed"
                />
              </div>

              {/* Versión */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <label className="block text-zinc-300 text-sm font-medium mb-2">
                  Versión del Orquestador
                </label>
                <input
                  type="text"
                  defaultValue="v1.0.0-beta (build 20260102)"
                  readOnly
                  className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded px-3 py-2 text-zinc-400 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
              <p className="text-zinc-400 text-sm">
                ⚙️ <span className="ml-2">La configuración general está protegida. Para cambios, contacta al equipo de soporte.</span>
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
