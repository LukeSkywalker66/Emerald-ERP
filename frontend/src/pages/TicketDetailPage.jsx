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
  MessageSquare,
  AlertTriangle,
  Send,
  Edit2,
  Check,
  X,
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
  pending: { label: 'Pendiente', variant: 'gold', icon: AlertTriangle },
  resolved: { label: 'Resuelto', variant: 'emerald', icon: CheckCircle },
  closed: { label: 'Cerrado', variant: 'default', icon: CheckCircle },
};

const priorityConfig = {
  critical: { label: 'Crítica', variant: 'ruby' },
  high: { label: 'Alta', variant: 'ruby' },
  medium: { label: 'Media', variant: 'gold' },
  low: { label: 'Baja', variant: 'default' },
};

function WorkOrderCard({ workOrder }) {
  const statusIcons = {
    pending_planning: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-950/30', label: 'En planificación' },
    scheduled: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-950/30', label: 'Programada' },
    in_progress: { icon: Loader, color: 'text-emerald-400', bg: 'bg-emerald-950/30', label: 'En curso' },
    completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950/30', label: 'Completada' },
  };

  const statusInfo = statusIcons[workOrder.status] || statusIcons.pending_planning;
  const Icon = statusInfo.icon;

  return (
    <div className={`p-4 rounded-lg border border-zinc-800/80 ${statusInfo.bg}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className={statusInfo.color} />
          <span className="text-sm font-medium text-white">OT #{workOrder.id}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {statusInfo.label}
        </Badge>
      </div>
      {workOrder.technician_name && (
        <p className="text-sm text-zinc-400 flex items-center gap-2">
          <User size={14} />
          {workOrder.technician_name}
        </p>
      )}
      {workOrder.scheduled_at && (
        <p className="text-xs text-zinc-500 mt-1">
          Programada: {new Date(workOrder.scheduled_at).toLocaleString('es-AR')}
        </p>
      )}
    </div>
  );
}

function TimelineItem({ event, index }) {
  const eventIcons = {
    NOTE: { icon: MessageSquare, color: 'text-blue-400' },
    STATUS_CHANGE: { icon: AlertCircle, color: 'text-amber-400' },
    OT_EVENT: { icon: FileText, color: 'text-emerald-400' },
    ALERT: { icon: AlertTriangle, color: 'text-ruby-400' },
  };

  const eventInfo = eventIcons[event.event_type] || eventIcons.NOTE;
  const Icon = eventInfo.icon;

  return (
    <div className="flex gap-4 relative">
      {index !== 0 && (
        <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-800 -translate-y-4"></div>
      )}
      <div className={`w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 z-10 ${eventInfo.color}`}>
        <Icon size={12} />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between mb-1">
          <p className="text-sm font-medium text-white">{event.content}</p>
          <time className="text-xs text-zinc-500">
            {new Date(event.created_at).toLocaleString('es-AR')}
          </time>
        </div>
        {event.author_name && (
          <p className="text-xs text-zinc-500">por {event.author_name}</p>
        )}
      </div>
    </div>
  );
}

// Componente para Editar Fields (Status, Priority, Assigned)
function EditableField({ label, value, options, onSave, isLoading }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newValue, setNewValue] = useState(value);

  const handleSave = async () => {
    if (newValue !== value) {
      try {
        await onSave(newValue);
        setIsEditing(false);
      } catch (err) {
        console.error('Save error:', err);
      }
    } else {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1 px-2 py-1 bg-zinc-800 border border-emerald-500 rounded text-sm text-white focus:outline-none"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="p-1 hover:bg-emerald-600 rounded transition-colors"
        >
          <Check size={14} className="text-emerald-400" />
        </button>
        <button
          onClick={() => {
            setNewValue(value);
            setIsEditing(false);
          }}
          className="p-1 hover:bg-zinc-700 rounded transition-colors"
        >
          <X size={14} className="text-zinc-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group">
      <div className="text-sm text-zinc-300">
        {options.find(o => o.value === value)?.label || value}
      </div>
      <button
        onClick={() => setIsEditing(true)}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-zinc-800 rounded transition-all"
      >
        <Edit2 size={14} className="text-zinc-500" />
      </button>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [isSubmittingWO, setIsSubmittingWO] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [users, setUsers] = useState([]);

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

  const loadUsers = async () => {
    try {
      const data = await ticketsService.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  useEffect(() => {
    loadTicket();
    loadUsers();
  }, [id]);

  const handleSaveField = async (fieldName, newValue) => {
    try {
      setIsSaving(true);
      await ticketsService.updateTicket(id, { [fieldName]: newValue });
      setTicket(prev => ({
        ...prev,
        [fieldName]: newValue,
      }));
      // Recargar para obtener el timeline actualizado
      await loadTicket();
    } catch (err) {
      setError('Error al guardar cambios');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;

    try {
      setIsSubmittingNote(true);
      setError(null);
      await ticketsService.addNote(ticket.id, noteContent);
      setNoteContent('');
      await loadTicket();
    } catch (err) {
      setError(err.message || 'Error al agregar nota');
      console.error('Error adding note:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

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
        <div className="p-6 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-center">
          <p className="text-zinc-400">Ticket no encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
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
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card - Editable Fields */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  {ticket.subject}
                </h1>
                <p className="text-sm text-emerald-400 font-mono">
                  Ticket #{ticket.id}
                </p>
              </div>
            </div>

            <p className="text-zinc-300 mb-4">
              {ticket.description || 'Sin descripción adicional.'}
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
              {/* Prioridad - Editable */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                  Prioridad
                </p>
                <EditableField
                  value={ticket.priority}
                  options={[
                    { value: 'low', label: 'Baja' },
                    { value: 'medium', label: 'Media' },
                    { value: 'high', label: 'Alta' },
                    { value: 'critical', label: 'Crítica' },
                  ]}
                  onSave={(val) => handleSaveField('priority', val)}
                  isLoading={isSaving}
                />
              </div>

              {/* Estado - Editable */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                  Estado
                </p>
                <EditableField
                  value={ticket.status}
                  options={[
                    { value: 'open', label: 'Abierto' },
                    { value: 'pending', label: 'Pendiente' },
                    { value: 'resolved', label: 'Resuelto' },
                    { value: 'closed', label: 'Cerrado' },
                  ]}
                  onSave={(val) => handleSaveField('status', val)}
                  isLoading={isSaving}
                />
              </div>

              {/* Creado por */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                  Creado por
                </p>
                <p className="text-sm text-zinc-300">{ticket.creator_name || 'Sistema'}</p>
              </div>

              {/* Asignado a - Editable */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                  Asignado a
                </p>
                <EditableField
                  value={ticket.assigned_to_id || 0}
                  options={[
                    { value: 0, label: 'Sin asignar' },
                    ...users.map(u => ({ value: u.id, label: u.name })),
                  ]}
                  onSave={(val) => handleSaveField('assigned_to_id', val === 0 ? null : val)}
                  isLoading={isSaving}
                />
              </div>
            </div>
          </div>

          {/* Órdenes de Trabajo */}
          {ticket.work_orders && ticket.work_orders.length > 0 && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText size={20} className="text-emerald-400" />
                Órdenes de Trabajo
              </h2>
              <div className="space-y-3">
                {ticket.work_orders.map((wo) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            </div>
          )}

          {/* Agregar Nota */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3 flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-400" />
              Agregar Nota
            </h2>
            <div className="space-y-3">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Escribe una nota sobre el ticket..."
                rows={3}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
              />
              <Button
                onClick={handleAddNote}
                disabled={!noteContent.trim() || isSubmittingNote}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
              >
                {isSubmittingNote ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Enviar Nota
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Clock size={20} className="text-emerald-400" />
              Cronología
            </h2>
            {ticket.timeline && ticket.timeline.length > 0 ? (
              <div className="space-y-2 relative">
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

            <div className="pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                Información del Ticket
              </p>
              <div className="space-y-2 text-xs text-zinc-400">
                <div>
                  <span className="text-zinc-500">ID Conexión:</span>
                  <p className="font-mono">#{ticket.connection_id || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Creado:</span>
                  <p>
                    {new Date(ticket.created_at).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </div>
            </div>

            {/* Connection Details */}
            {ticket.connection_details && (
              <div className="pt-4 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                  Datos de la Conexión
                </p>
                <div className="space-y-2 text-xs text-zinc-400">
                  {ticket.connection_details.client_name && (
                    <div>
                      <span className="text-zinc-500">Cliente:</span>
                      <p>{ticket.connection_details.client_name}</p>
                    </div>
                  )}
                  {ticket.connection_details.client_dni && (
                    <div>
                      <span className="text-zinc-500">DNI:</span>
                      <p className="font-mono">{ticket.connection_details.client_dni}</p>
                    </div>
                  )}
                  {ticket.connection_details.pppoe_username && (
                    <div>
                      <span className="text-zinc-500">Usuario PPPoE:</span>
                      <p className="font-mono">{ticket.connection_details.pppoe_username}</p>
                    </div>
                  )}
                  {ticket.connection_details.address && (
                    <div>
                      <span className="text-zinc-500">Dirección:</span>
                      <p className="text-xs">{ticket.connection_details.address}</p>
                    </div>
                  )}
                  {ticket.connection_details.node_name && (
                    <div>
                      <span className="text-zinc-500">Nodo:</span>
                      <p>{ticket.connection_details.node_name}</p>
                    </div>
                  )}
                  {ticket.connection_details.plan_name && (
                    <div>
                      <span className="text-zinc-500">Plan:</span>
                      <p>{ticket.connection_details.plan_name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
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
              este ticket. El cliente será notificado.
            </p>
            <div className="p-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30">
              <p className="text-sm text-emerald-300">
                <strong>Ticket:</strong> <span className="font-mono">#{ticket.id}</span>
              </p>
              <p className="text-sm text-emerald-300 mt-1">
                <strong>Asunto:</strong> {ticket.subject}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowVisitDialog(false)}
              className="border-zinc-700 text-zinc-300"
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
                  Creando OT...
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
