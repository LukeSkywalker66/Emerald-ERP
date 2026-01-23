import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Loader,
  FileText,
  Calendar,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ticketsService from '@/services/tickets.service';

const statusConfig = {
  open: { label: 'Abierto', variant: 'emerald', icon: AlertCircle },
  in_progress: { label: 'En progreso', variant: 'blue', icon: Clock },
  pending: { label: 'Pendiente', variant: 'gold', icon: AlertTriangle },
  closed: { label: 'Cerrado', variant: 'default', icon: CheckCircle },
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

function WorkOrderCard({ workOrder }) {
  const statusColors = {
    pending_planning: 'text-blue-400',
    in_planning: 'text-blue-400',
    ready_schedule: 'text-yellow-400',
    scheduled: 'text-amber-400',
    in_progress: 'text-emerald-400',
    completed: 'text-emerald-600',
    cancelled: 'text-zinc-500',
  };

  return (
    <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColors[workOrder.status] || 'text-zinc-400'}`}></div>
          <div>
            <p className="text-sm font-medium text-white">
              Orden de Trabajo #{workOrder.id}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {workOrder.status?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>
      {workOrder.technician_name && (
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <User size={14} />
          <span>{workOrder.technician_name}</span>
        </div>
      )}
      {workOrder.scheduled_at && (
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Calendar size={14} />
          <span>{new Date(workOrder.scheduled_at).toLocaleDateString('es-AR')}</span>
        </div>
      )}
    </div>
  );
}

function TimelineItem({ event, index }) {
  const eventIcons = {
    NOTE: MessageSquare,
    STATUS_CHANGE: CheckCircle,
    OT_EVENT: FileText,
    ALERT: AlertTriangle,
  };

  const EventIcon = eventIcons[event.event_type] || MessageSquare;
  const eventTypeLabel = {
    NOTE: 'Nota',
    STATUS_CHANGE: 'Cambio de estado',
    OT_EVENT: 'Evento de OT',
    ALERT: 'Alerta',
  };

  return (
    <div className="flex gap-4">
      {/* Timeline line */}
      {index !== 0 && (
        <div className="absolute left-[19px] top-0 bottom-full w-0.5 bg-zinc-800" />
      )}

      {/* Timeline dot */}
      <div className="relative z-10 w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 mt-1">
        <EventIcon size={16} className="text-emerald-400" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-300">
              {eventTypeLabel[event.event_type] || event.event_type}
            </p>
            <p className="text-xs text-zinc-500">
              {new Date(event.created_at).toLocaleString('es-AR')}
            </p>
          </div>
          <p className="text-sm text-zinc-200">{event.content}</p>
          {event.author_name && (
            <p className="text-xs text-zinc-500 mt-2">Por: {event.author_name}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [isSubmittingWO, setIsSubmittingWO] = useState(false);

  const loadTicket = async () => {
    try {
      setError(null);
      const data = await ticketsService.getById(id);
      setTicket(data);
    } catch (err) {
      setError(err.message || 'Error al cargar el ticket');
      console.error('Error loading ticket:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [id]);

  const handleRequestVisit = async () => {
    try {
      setIsSubmittingWO(true);
      await ticketsService.createWorkOrder(ticket.id, {
        ot_type: 'repair',
        notes: 'Solicitud de visita técnica desde operador',
      });
      setShowVisitDialog(false);
      await loadTicket();
    } catch (err) {
      setError(err.message || 'Error al solicitar visita');
      console.error('Error requesting visit:', err);
    } finally {
      setIsSubmittingWO(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader size={24} className="animate-spin text-emerald-400" />
          <p className="text-zinc-400">Cargando detalles del ticket...</p>
        </div>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="max-w-4xl">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/app/tickets')}
          className="mb-6 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <ChevronLeft size={16} />
          Volver a tickets
        </Button>
        <div className="p-6 rounded-xl border border-ruby-900/50 bg-ruby-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-ruby-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ruby-300">Error al cargar el ticket</p>
              <p className="text-sm text-ruby-200/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-4xl">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/app/tickets')}
          className="mb-6 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <ChevronLeft size={16} />
          Volver a tickets
        </Button>
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center text-zinc-400">
          No se encontró el ticket solicitado.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/app/tickets')}
        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      >
        <ChevronLeft size={16} />
        Volver a tickets
      </Button>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">{ticket.subject}</h1>
                <p className="text-sm text-emerald-400 font-mono mt-1">
                  Ticket #{ticket.id}
                </p>
              </div>
              <StatusBadge status={ticket.status} />
            </div>

            <p className="text-zinc-300">
              {ticket.description || 'Sin descripción adicional.'}
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                  Prioridad
                </p>
                <PriorityBadge priority={ticket.priority} />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                  Asignado a
                </p>
                <p className="text-sm text-zinc-300">
                  {ticket.assigned_to_name || 'Sin asignar'}
                </p>
              </div>
              {ticket.category_name && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                    Categoría
                  </p>
                  <p className="text-sm text-emerald-400 font-medium">{ticket.category_name}</p>
                </div>
              )}
              {ticket.reason_name && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                    Motivo
                  </p>
                  <p className="text-sm text-amber-400 font-medium">{ticket.reason_name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                  Creado por
                </p>
                <p className="text-sm text-zinc-300">{ticket.creator_name}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                  Fecha de creación
                </p>
                <p className="text-sm text-zinc-300">
                  {new Date(ticket.created_at).toLocaleDateString('es-AR')}
                </p>
              </div>
            </div>
          </div>

          {/* Ordenes de Trabajo */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-emerald-400" />
              Órdenes de Trabajo
            </h2>
            {ticket.work_orders && ticket.work_orders.length > 0 ? (
              <div className="space-y-3">
                {ticket.work_orders.map((wo) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                No hay órdenes de trabajo asociadas a este ticket.
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Clock size={20} className="text-emerald-400" />
              Cronología
            </h2>
            {ticket.timeline && ticket.timeline.length > 0 ? (
              <div className="space-y-4 relative">
                {ticket.timeline
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((event, index) => (
                    <TimelineItem key={event.id} event={event} index={index} />
                  ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                No hay eventos registrados en este ticket.
              </p>
            )}
          </div>
        </div>

        {/* Sidebar - Acciones */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 space-y-3 sticky top-6">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Acciones
            </h3>

            <Button
              onClick={() => setShowVisitDialog(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Solicitar Visita Técnica
            </Button>

            <Button
              variant="outline"
              className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cerrar Ticket
            </Button>

            <div className="pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                Información del Sistema
              </p>
              <div className="space-y-2 text-xs text-zinc-400">
                <div>
                  <span className="text-zinc-500">Estado:</span>
                  <p>{ticket.status}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Prioridad:</span>
                  <p>{ticket.priority}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visit Request Dialog */}
      <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Solicitar Visita Técnica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-zinc-300">
              Se creará una nueva orden de trabajo para que un técnico atienda
              este ticket. El cliente será notificado sobre la próxima visita.
            </p>
            <div className="p-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30">
              <p className="text-sm text-emerald-300">
                Ticket: <span className="font-mono text-emerald-400">#{ticket.id}</span>
              </p>
              <p className="text-sm text-emerald-300 mt-1">
                Asunto: <span className="font-medium">{ticket.subject}</span>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowVisitDialog(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRequestVisit}
              disabled={isSubmittingWO}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSubmittingWO ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Creando...
                </>
              ) : (
                'Confirmar Visita'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
