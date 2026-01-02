import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search, MoreHorizontal, User, AlertCircle, Loader } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ticketsService from '@/services/tickets.service';

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

function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, variant: 'default' };
  return (
    <Badge variant={config.variant} className="font-medium">
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }) {
  const config = priorityConfig[priority] || { label: priority, variant: 'default' };
  return (
    <Badge variant={config.variant} className="font-medium">
      {config.label}
    </Badge>
  );
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
  });

  const loadTickets = async () => {
    try {
      setError(null);
      const data = await ticketsService.getAll();
      setTickets(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar los tickets');
      console.error('Error loading tickets:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTickets();
  };

  const handleCreateSubmit = async () => {
    if (!formData.subject.trim()) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      await ticketsService.create({
        subject: formData.subject,
        description: formData.description || undefined,
        priority: formData.priority,
        connection_id: 1, // TODO: Get from connection selector
      });
      setShowCreateDialog(false);
      setFormData({ subject: '', description: '', priority: 'medium' });
      await loadTickets();
    } catch (err) {
      setError(err.message || 'Error al crear el ticket');
      console.error('Error creating ticket:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) =>
    ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.creator_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.id?.toString().includes(searchQuery)
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
            onClick={() => setShowCreateDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
          >
            <Plus size={16} />
            Nuevo Ticket
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl border border-ruby-900/50 bg-ruby-950/30 flex items-start gap-3">
          <AlertCircle size={20} className="text-ruby-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-ruby-300">Error</p>
            <p className="text-sm text-ruby-200/80">{error}</p>
          </div>
        </div>
      )}

      {/* Toolbar - Filtros */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            type="text"
            placeholder="Buscar tickets por ID, asunto o creador..."
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

      {/* Loading State */}
      {isLoading ? (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-8 flex items-center justify-center gap-3">
          <Loader size={20} className="animate-spin text-emerald-400" />
          <p className="text-zinc-400">Cargando tickets...</p>
        </div>
      ) : (
        /* Data Table */
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-2xl shadow-black/30">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-zinc-800/80 hover:bg-transparent">
                <TableHead className="w-[100px] text-zinc-400 font-semibold">ID</TableHead>
                <TableHead className="text-zinc-400 font-semibold">Asunto</TableHead>
                <TableHead className="w-[120px] text-zinc-400 font-semibold">Estado</TableHead>
                <TableHead className="w-[110px] text-zinc-400 font-semibold">Prioridad</TableHead>
                <TableHead className="w-[150px] text-zinc-400 font-semibold">Asignado a</TableHead>
                <TableHead className="w-[140px] text-zinc-400 font-semibold">Creador</TableHead>
                <TableHead className="w-[140px] text-zinc-400 font-semibold">Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                    No se encontraron tickets.
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
                      #{ticket.id}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-white line-clamp-1">
                        {ticket.subject}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {ticket.assigned_to_name ? (
                          <>
                            <div className="w-6 h-6 rounded-full bg-emerald-900/50 flex items-center justify-center border border-emerald-700/50">
                              <User size={12} className="text-emerald-400" />
                            </div>
                            <span className="text-sm text-zinc-300">{ticket.assigned_to_name}</span>
                          </>
                        ) : (
                          <span className="text-sm text-zinc-500">Sin asignar</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-400">
                      {ticket.creator_name || 'Sistema'}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {new Date(ticket.created_at).toLocaleDateString('es-AR')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Ticket Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Crear nuevo ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">
                Asunto *
              </label>
              <Input
                placeholder="Describe el problema o solicitud"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">
                Descripción
              </label>
              <textarea
                placeholder="Detalles adicionales (opcional)"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">
                Prioridad
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={isSubmitting || !formData.subject.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Ticket'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
