import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search, MoreHorizontal, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Datos mock para demostración
const mockTickets = [
  {
    id: 'T-1042',
    subject: 'Corte de fibra zona norte - URGENTE',
    client: 'Eventura SA',
    status: 'open',
    priority: 'critical',
    assignedTo: { name: 'Juan Pérez', initials: 'JP' },
    updatedAt: 'Hace 5 min',
    category: 'Infraestructura',
  },
  {
    id: 'T-1041',
    subject: 'Latencia alta en servicios enterprise',
    client: 'MMVO Telecom',
    status: 'in_progress',
    priority: 'high',
    assignedTo: { name: 'María García', initials: 'MG' },
    updatedAt: 'Hace 23 min',
    category: 'Red',
  },
  {
    id: 'T-1040',
    subject: 'Instalación nueva - Barrio Centro',
    client: 'Nuevo Cliente',
    status: 'pending',
    priority: 'medium',
    assignedTo: null,
    updatedAt: 'Hace 1 hora',
    category: 'Instalación',
  },
  {
    id: 'T-1039',
    subject: 'ONU sin señal - Requiere cambio',
    client: 'Coop. Norte',
    status: 'open',
    priority: 'high',
    assignedTo: { name: 'Carlos Ruiz', initials: 'CR' },
    updatedAt: 'Hace 2 horas',
    category: 'Hardware',
  },
  {
    id: 'T-1038',
    subject: 'Consulta sobre facturación',
    client: 'Micro ISP Sur',
    status: 'closed',
    priority: 'low',
    assignedTo: { name: 'Ana López', initials: 'AL' },
    updatedAt: 'Ayer 18:45',
    category: 'Administrativo',
  },
  {
    id: 'T-1037',
    subject: 'Migración a plan superior',
    client: 'TechHub SRL',
    status: 'closed',
    priority: 'low',
    assignedTo: { name: 'Pedro Martínez', initials: 'PM' },
    updatedAt: 'Ayer 14:20',
    category: 'Comercial',
  },
  {
    id: 'T-1036',
    subject: 'SNR inestable en nodo 4',
    client: 'Carrier Oeste',
    status: 'in_progress',
    priority: 'medium',
    assignedTo: { name: 'Juan Pérez', initials: 'JP' },
    updatedAt: 'Hace 3 horas',
    category: 'Diagnóstico',
  },
  {
    id: 'T-1035',
    subject: 'Actualización de router CPE',
    client: 'Edificio Torre 1',
    status: 'pending',
    priority: 'low',
    assignedTo: null,
    updatedAt: 'Hace 5 horas',
    category: 'Mantenimiento',
  },
  {
    id: 'T-1034',
    subject: 'Pérdida de paquetes cliente crítico',
    client: 'Hospital Regional',
    status: 'open',
    priority: 'critical',
    assignedTo: { name: 'María García', initials: 'MG' },
    updatedAt: 'Hace 10 min',
    category: 'Red',
  },
  {
    id: 'T-1033',
    subject: 'Renovación contrato anual',
    client: 'Municipalidad Centro',
    status: 'pending',
    priority: 'medium',
    assignedTo: { name: 'Ana López', initials: 'AL' },
    updatedAt: 'Hace 6 horas',
    category: 'Comercial',
  },
];

const statusConfig = {
  open: { label: 'Abierto', variant: 'emerald' },
  in_progress: { label: 'En progreso', variant: 'blue' },
  pending: { label: 'Pendiente', variant: 'gold' },
  closed: { label: 'Cerrado', variant: 'default' },
};

const priorityConfig = {
  critical: { label: 'Crítica', variant: 'ruby' },
  high: { label: 'Alta', variant: 'ruby' },
  medium: { label: 'Media', variant: 'gold' },
  low: { label: 'Baja', variant: 'default' },
};

export default function TicketsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filteredTickets = mockTickets.filter((ticket) =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestión de Tickets</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Sistema de seguimiento de incidencias y solicitudes de soporte técnico.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Actualizar
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
          >
            <Plus size={16} />
            Nuevo Ticket
          </Button>
        </div>
      </div>

      {/* Toolbar - Filtros */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            type="text"
            placeholder="Buscar tickets por ID, asunto o cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>
        
        <select className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
          <option value="">Todos los estados</option>
          <option value="open">Abiertos</option>
          <option value="in_progress">En progreso</option>
          <option value="pending">Pendientes</option>
          <option value="closed">Cerrados</option>
        </select>

        <select className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
          <option value="">Todas las prioridades</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-2xl shadow-black/30">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-zinc-800/80 hover:bg-transparent">
              <TableHead className="w-[100px] text-zinc-400 font-semibold">ID</TableHead>
              <TableHead className="text-zinc-400 font-semibold">Asunto</TableHead>
              <TableHead className="w-[180px] text-zinc-400 font-semibold">Cliente</TableHead>
              <TableHead className="w-[120px] text-zinc-400 font-semibold">Estado</TableHead>
              <TableHead className="w-[110px] text-zinc-400 font-semibold">Prioridad</TableHead>
              <TableHead className="w-[120px] text-zinc-400 font-semibold">Asignado a</TableHead>
              <TableHead className="w-[140px] text-zinc-400 font-semibold">Actualizado</TableHead>
              <TableHead className="w-[60px] text-zinc-400 font-semibold"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                  No se encontraron tickets que coincidan con tu búsqueda.
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  onClick={() => navigate(`/app/tickets/${ticket.id}`)}
                >
                  <TableCell className="font-mono text-sm text-emerald-400 font-medium">
                    {ticket.id}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white line-clamp-1">
                        {ticket.subject}
                      </p>
                      <p className="text-xs text-zinc-500">{ticket.category}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-400">
                    {ticket.client}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={ticket.priority} />
                  </TableCell>
                  <TableCell>
                    {ticket.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-xs font-semibold text-emerald-400">
                          {ticket.assignedTo.initials}
                        </div>
                        <span className="text-sm text-zinc-300 hidden xl:inline">
                          {ticket.assignedTo.name.split(' ')[0]}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-zinc-500">
                        <User size={16} />
                        <span className="text-xs">Sin asignar</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500 font-mono">
                    {ticket.updatedAt}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    >
                      <MoreHorizontal size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer con stats */}
      <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30">
        <p className="text-sm text-zinc-400">
          Mostrando <span className="font-medium text-white">{filteredTickets.length}</span> de{' '}
          <span className="font-medium text-white">{mockTickets.length}</span> tickets
        </p>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-ruby-500"></div>
            <span>{mockTickets.filter(t => ['critical', 'high'].includes(t.priority)).length} urgentes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span>{mockTickets.filter(t => t.status === 'open').length} abiertos</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar para badges de estado
function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending;
  
  const variantClasses = {
    emerald: 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30',
    blue: 'bg-blue-950/50 text-blue-400 border-blue-500/30',
    gold: 'bg-amber-950/50 text-amber-400 border-amber-500/30',
    default: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  };

  return (
    <Badge
      variant="outline"
      className={`${variantClasses[config.variant]} text-xs font-medium border`}
    >
      {config.label}
    </Badge>
  );
}

// Componente auxiliar para badges de prioridad
function PriorityBadge({ priority }) {
  const config = priorityConfig[priority] || priorityConfig.low;
  
  const variantClasses = {
    ruby: 'bg-ruby-950/50 text-ruby-400 border-ruby-500/30',
    gold: 'bg-amber-950/50 text-amber-400 border-amber-500/30',
    default: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  };

  return (
    <Badge
      variant="outline"
      className={`${variantClasses[config.variant]} text-xs font-medium border`}
    >
      {config.label}
    </Badge>
  );
}
