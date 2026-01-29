import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search, User, AlertCircle, Loader, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import AsyncCombobox from '@/components/ui/AsyncCombobox';
import TagsFilterPopover from '@/components/tickets/TagsFilterPopover';
import CreateTicketDialog from '@/components/tickets/CreateTicketDialog';
import ticketsService, { getTags } from '@/services/tickets.service';

const statusConfig = {
  open: { label: 'Abierto', variant: 'emerald' },
  in_progress: { label: 'En progreso', variant: 'blue' },
  pending: { label: 'Pendiente', variant: 'gold' },
  closed: { label: 'Cerrado', variant: 'default' },
};

const priorityConfig = {
  critical: { label: 'Crítica', variant: 'critical' },
  high: { label: 'Alta', variant: 'high' },
  medium: { label: 'Media', variant: 'gold' },
  low: { label: 'Baja', variant: 'default' },
};

// Tipo de Ticket (agrupación lógica)
const typeConfig = {
  technical: { label: 'Técnico', tone: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40' },
  installation: { label: 'Instalación', tone: 'bg-blue-500/10 text-blue-200 border-blue-500/40' },
  withdrawal: { label: 'Retiro', tone: 'bg-zinc-600/30 text-zinc-100 border-zinc-500/30' },
  relocation: { label: 'Traslado', tone: 'bg-purple-500/15 text-purple-200 border-purple-500/40' },
  administrative: { label: 'Administrativo', tone: 'bg-amber-500/15 text-amber-200 border-amber-500/40' },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending;
  const variantClasses = {
    emerald: 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30',
    blue: 'bg-blue-950/50 text-blue-400 border-blue-500/30',
    gold: 'bg-amber-950/50 text-amber-400 border-amber-500/30',
    default: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  };

  return (
    <Badge variant="outline" className={`${variantClasses[config.variant]} text-xs font-medium border`}>
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }) {
  const config = priorityConfig[priority] || priorityConfig.low;
  const variantClasses = {
    critical: 'bg-red-900/70 text-red-200 border-red-400/60 border-2 font-bold shadow-lg shadow-red-900/50',
    high: 'bg-red-950/50 text-red-400 border-red-500/30',
    gold: 'bg-amber-950/50 text-amber-400 border-amber-500/30',
    default: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  };

  return (
    <Badge variant="outline" className={`${variantClasses[config.variant]} text-xs font-medium`}>
      {config.label}
    </Badge>
  );
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [sortField, setSortField] = useState('updated_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tagsFilter, setTagsFilter] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  const loadTickets = async () => {
    try {
      setError(null);
      const offset = (currentPage - 1) * pageSize;
      const data = await ticketsService.getAll({
        limit: pageSize,
        offset: offset,
        order_by: sortField,
        order_dir: sortDirection,
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        tags: tagsFilter.length ? tagsFilter : undefined,
      });
      setTickets(data.items || data || []);
      setTotalCount(data.total || (data.items ? data.items.length : data.length));
    } catch (err) {
      setError(err.message || 'Error al cargar los tickets');
      console.error('Error loading tickets:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await getTags(true);
        setAvailableTags(tags || []);
      } catch (err) {
        console.error('Error cargando tags:', err);
      }
    };
    loadTags();
  }, []);

  useEffect(() => {
    loadTickets();
  }, [currentPage, pageSize, sortField, sortDirection, searchQuery, statusFilter, priorityFilter, tagsFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTickets();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-zinc-600" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp size={14} className="text-emerald-400" /> : 
      <ArrowDown size={14} className="text-emerald-400" />;
  };

  const handleSearchConnections = async (query) => {
    try {
      const results = await ticketsService.searchConnections(query);
      return results.map(conn => ({
        id: conn.connection_id,
        name: conn.client_name,
        description: `${conn.installation_address || ''} • ${conn.pppoe_username || ''} • DNI: ${conn.client_dni || 'N/A'}`,
        connection_id: conn.connection_id,
      }));
    } catch (err) {
      console.error('Search error:', err);
      return [];
    }
  };

  const urgentCount = tickets.filter(t => t.priority === 'critical' || t.priority === 'high').length;
  const openCount = tickets.filter(t => t.status === 'open').length;
  const totalPages = Math.ceil(totalCount / pageSize);

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
            placeholder="Buscar por ID, asunto, cliente, DNI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>
        
        <select 
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">Todos los estados</option>
          <option value="open">Abiertos</option>
          <option value="in_progress">En progreso</option>
          <option value="pending">Pendientes</option>
          <option value="pending_infra">Pend. Infraestructura</option>
          <option value="resolved">Resueltos</option>
          <option value="closed">Cerrados</option>
        </select>

        <select 
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">Todas las prioridades</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>

        <TagsFilterPopover
          selectedTags={tagsFilter}
          onTagsChange={(newTags) => {
            setTagsFilter(newTags);
            setCurrentPage(1);
          }}
          availableTags={availableTags}
        />
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
                <TableHead 
                  className="w-[100px] text-zinc-400 font-semibold cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center gap-1">
                    ID
                    <SortIcon field="id" />
                  </div>
                </TableHead>
                <TableHead className="text-zinc-400 font-semibold cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('subject')}
                >
                  <div className="flex items-center gap-1">
                    Asunto
                    <SortIcon field="subject" />
                  </div>
                </TableHead>
                <TableHead className="w-[120px] text-zinc-400 font-semibold cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('ticket_type')}
                >
                  <div className="flex items-center gap-1">
                    Tipo
                    <SortIcon field="ticket_type" />
                  </div>
                </TableHead>
                <TableHead className="w-[180px] text-zinc-400 font-semibold">Etiquetas</TableHead>
                <TableHead 
                  className="w-[180px] text-zinc-400 font-semibold cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('client_name')}
                >
                  <div className="flex items-center gap-1">
                    Cliente
                    <SortIcon field="client_name" />
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[120px] text-zinc-400 font-semibold cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Estado
                    <SortIcon field="status" />
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[110px] text-zinc-400 font-semibold cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('priority')}
                >
                  <div className="flex items-center gap-1">
                    Prioridad
                    <SortIcon field="priority" />
                  </div>
                </TableHead>
                <TableHead className="w-[150px] text-zinc-400 font-semibold cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('assigned_to_name')}
                >
                  <div className="flex items-center gap-1">
                    Asignado a
                    <SortIcon field="assigned_to_name" />
                  </div>
                </TableHead>
                <TableHead 
                  className="w-[150px] text-zinc-400 font-semibold cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => handleSort('updated_at')}
                >
                  <div className="flex items-center gap-1">
                    Última actividad
                    <SortIcon field="updated_at" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                    No se encontraron tickets.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
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
                      {ticket.ticket_type ? (
                        <Badge variant="outline" className={`text-xs ${typeConfig[ticket.ticket_type]?.tone || 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                          {typeConfig[ticket.ticket_type]?.label || ticket.ticket_type}
                        </Badge>
                      ) : (
                        <span className="text-sm text-zinc-500">N/D</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <div className="flex items-center gap-1 flex-wrap">
                        {ticket.tags && ticket.tags.length > 0 ? (
                          <>
                            {ticket.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag.id}
                                className="h-5 px-2 inline-flex items-center rounded-full text-[10px] font-semibold border bg-emerald-500/5 border-emerald-500/30 text-emerald-200"
                                style={
                                  tag.color?.startsWith('#')
                                    ? {
                                        backgroundColor: `${tag.color}14`,
                                        borderColor: `${tag.color}55`,
                                        color: tag.color,
                                      }
                                    : {}
                                }
                              >
                                {tag.name}
                              </span>
                            ))}
                            {ticket.tags.length > 2 && (
                              <span className="h-5 px-2 inline-flex items-center rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                                +{ticket.tags.length - 2}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-500">Sin etiquetas</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ticket.client_name ? (
                        <span className="text-sm text-white font-medium">{ticket.client_name}</span>
                      ) : (
                        <span className="text-sm text-zinc-500">Sin cliente</span>
                      )}
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
                    <TableCell className="text-sm text-zinc-500 font-mono">
                      {new Date(ticket.updated_at).toLocaleDateString('es-AR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Footer con Paginación */}
          <div className="border-t border-zinc-800/50 bg-zinc-950/40 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6 text-xs">
              <p className="text-zinc-500">
                Mostrando <span className="text-white font-medium">{((currentPage - 1) * pageSize) + 1}</span>-
                <span className="text-white font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> de{' '}
                <span className="text-white font-medium">{totalCount}</span> tickets
              </p>
              <div className="flex items-center gap-4">
                <span className="text-zinc-500">
                  <span className="text-red-400 font-medium">{urgentCount}</span> urgentes
                </span>
                <span className="text-zinc-500">
                  <span className="text-emerald-400 font-medium">{openCount}</span> abiertos
                </span>
              </div>
            </div>
            
            {/* Controles de Paginación */}
            <div className="flex items-center gap-2">
              <select 
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7 p-0 border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </Button>
              
              <span className="text-xs text-zinc-400 px-2">
                Página <span className="text-white font-medium">{currentPage}</span> de <span className="text-white font-medium">{totalPages}</span>
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-7 w-7 p-0 border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Dialog - Multi-Flow Wizards */}
      <CreateTicketDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={(createdTicket) => {
          setShowCreateDialog(false);
          setSelectedConnection(null);
          loadTickets();
          navigate(`/app/tickets/${createdTicket.id}`);
        }}
      />
    </div>
  );
}
