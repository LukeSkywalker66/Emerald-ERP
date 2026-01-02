import React, { useState } from 'react';
import {
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  Signal,
  AlertTriangle,
  CheckCircle,
  User,
  Plus,
  X,
  Send,
  TrendingDown,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * TicketDetailPage - Vista de Detalle para Operador de Mesa de Ayuda
 *
 * Responsabilidades:
 * - Visualizar estado completo de ticket
 * - Monitorear OT (Orden de Trabajo) asociada
 * - Gestionar timeline de eventos y notas
 * - Solicitar visita técnica
 * - Cerrar ticket
 *
 * NOTA: El Técnico NO ve esta pantalla. Esta es 100% para Operador.
 */

// Mock data - Reemplazar con API
const mockTicket = {
  id: 'CNX-8821',
  title: 'Corte de servicio - Fibra no responde',
  status: 'open',
  priority: 'critical',
  createdAt: '2026-01-02 09:15',
  updatedAt: '2026-01-02 14:32',

  // Datos del servicio
  service: {
    id: 'SRV-4521',
    address: 'Av. Libertador 1234, Depto 5B, CABA',
    city: 'Ciudad Autónoma de Buenos Aires',
    zipCode: '1636',
  },

  // Datos del cliente
  client: {
    id: 'CLI-892',
    name: 'Empresa TechVision SRL',
    phone: '+54 9 11 5555-1234',
    email: 'soporte@techvision.ar',
  },

  // Plan
  plan: {
    name: 'Enterprise Fiber 300',
    bandwidth: '300 Mbps',
    sla: '99.5%',
  },

  // OT (Orden de Trabajo) asociada
  workOrder: {
    id: 'OT-2851',
    status: 'pending_assignment', // pending_assignment | in_transit | working | completed | cancelled
    createdAt: '2026-01-02 09:30',
    scheduledDate: '2026-01-03 10:00',
    assignedTo: null, // { id, name, avatar } si existe
    lastUpdate: 'Creada por operador - Aguardando planificación',
  },

  // Snapshot Beholder/Técnico
  telemetry: {
    onu: {
      status: 'offline', // online | offline | los
      lastSeen: '2026-01-02 09:05',
      signal: -32.5, // dBm
      signalStatus: 'critical', // ok | warning | critical
    },
    infrastructure: {
      node: 'NOD-NORTE-04',
      ip: '192.168.100.45',
      macAddress: '00:1a:2b:3c:4d:5e',
      oltName: 'SmartOLT-01',
    },
  },

  // Timeline mixto (Notas operador + Alertas + Cambios OT)
  events: [
    {
      id: 'evt-5',
      timestamp: '2026-01-02 14:32',
      type: 'note', // note | status_change | ot_update | system_alert
      author: 'Op. Andrea García',
      content: 'Cliente confirmó que probó reiniciar la ONU sin éxito. Solicité visita técnica.',
      metadata: {},
    },
    {
      id: 'evt-4',
      timestamp: '2026-01-02 13:45',
      type: 'system_alert',
      author: 'Beholder',
      content: 'ONU sin señal por más de 1.5 horas',
      metadata: { severity: 'critical' },
    },
    {
      id: 'evt-3',
      timestamp: '2026-01-02 11:20',
      type: 'status_change',
      author: 'Operador',
      content: 'Ticket escalado a CRÍTICO',
      metadata: { from: 'high', to: 'critical' },
    },
    {
      id: 'evt-2',
      timestamp: '2026-01-02 09:45',
      type: 'note',
      author: 'Op. Pedro Martínez',
      content: 'Cliente llamó reportando pérdida total de conectividad. Diagnosticado: ONU offline.',
      metadata: {},
    },
    {
      id: 'evt-1',
      timestamp: '2026-01-02 09:15',
      type: 'status_change',
      author: 'Sistema',
      content: 'Ticket creado',
      metadata: {},
    },
  ],
};

// Componente: Card de OT (Monitoreo)
function WorkOrderCard({ workOrder, onRequestVisit }) {
  const statusMap = {
    pending_assignment: {
      label: 'Pendiente de Asignación',
      bgColor: 'bg-amber-950/30',
      borderColor: 'border-amber-500/30',
      dotColor: 'bg-amber-500',
      textColor: 'text-amber-400',
    },
    in_transit: {
      label: 'En Camino',
      bgColor: 'bg-blue-950/30',
      borderColor: 'border-blue-500/30',
      dotColor: 'bg-blue-500',
      textColor: 'text-blue-400',
    },
    working: {
      label: 'Trabajando en Sitio',
      bgColor: 'bg-blue-950/40',
      borderColor: 'border-blue-500/40',
      dotColor: 'bg-blue-500 animate-pulse',
      textColor: 'text-blue-400',
    },
    completed: {
      label: 'Finalizada',
      bgColor: 'bg-emerald-950/30',
      borderColor: 'border-emerald-500/30',
      dotColor: 'bg-emerald-500',
      textColor: 'text-emerald-400',
    },
    cancelled: {
      label: 'Cancelada',
      bgColor: 'bg-zinc-800/30',
      borderColor: 'border-zinc-600/30',
      dotColor: 'bg-zinc-500',
      textColor: 'text-zinc-400',
    },
  };

  const config = statusMap[workOrder.status] || statusMap.pending_assignment;

  return (
    <div className={`border rounded-xl p-5 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${config.dotColor}`}></div>
          <div>
            <p className="text-xs text-zinc-500 font-mono">#{workOrder.id}</p>
            <p className={`text-sm font-semibold ${config.textColor}`}>
              {config.label}
            </p>
          </div>
        </div>
        {workOrder.status === 'pending_assignment' && (
          <Button
            size="sm"
            className="bg-gold-600 hover:bg-gold-500 text-white"
            onClick={onRequestVisit}
          >
            <Plus size={14} className="mr-1" />
            Solicitar Visita
          </Button>
        )}
      </div>

      {workOrder.status === 'completed' && (
        <div className="bg-emerald-950/40 border border-emerald-500/20 rounded p-3 mb-3">
          <p className="text-xs text-emerald-300 font-medium mb-1">✓ Visita Completada</p>
          <p className="text-xs text-zinc-400">
            {workOrder.lastUpdate}
          </p>
        </div>
      )}

      {workOrder.assignedTo && (
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-xs font-semibold text-emerald-400">
            {workOrder.assignedTo.initials}
          </div>
          <div>
            <p className="text-xs text-zinc-500">Asignado a</p>
            <p className="text-sm font-medium text-white">
              {workOrder.assignedTo.name}
            </p>
          </div>
        </div>
      )}

      {workOrder.scheduledDate && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Clock size={14} />
          <span>
            Programada:{' '}
            <span className="text-emerald-400 font-mono">
              {workOrder.scheduledDate}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// Componente: Timeline Item
function TimelineItem({ event }) {
  const typeConfig = {
    note: {
      icon: null,
      bgColor: 'bg-zinc-800/40',
      borderColor: 'border-zinc-700/50',
      dotColor: 'bg-zinc-600',
    },
    status_change: {
      icon: <CheckCircle size={16} />,
      bgColor: 'bg-emerald-950/30',
      borderColor: 'border-emerald-500/20',
      dotColor: 'bg-emerald-500',
    },
    ot_update: {
      icon: <Clock size={16} />,
      bgColor: 'bg-blue-950/30',
      borderColor: 'border-blue-500/20',
      dotColor: 'bg-blue-500',
    },
    system_alert: {
      icon: <AlertTriangle size={16} />,
      bgColor: 'bg-ruby-950/30',
      borderColor: 'border-ruby-500/20',
      dotColor: 'bg-ruby-500',
    },
  };

  const config = typeConfig[event.type] || typeConfig.note;

  return (
    <div className="flex gap-4 mb-4">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full ${config.dotColor} mt-1.5`}
        ></div>
        <div className="w-0.5 h-16 bg-gradient-to-b from-zinc-700 to-transparent"></div>
      </div>

      {/* Event card */}
      <div
        className={`flex-1 rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}
      >
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-semibold text-zinc-400">
            {event.author}
            {config.icon && (
              <span className="ml-2 inline-flex items-center gap-1 text-zinc-300">
                {config.icon}
              </span>
            )}
          </p>
          <p className="text-xs text-zinc-500 font-mono">
            {event.timestamp}
          </p>
        </div>

        <p className="text-sm text-zinc-200 leading-relaxed">
          {event.content}
        </p>

        {event.metadata?.severity === 'critical' && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-ruby-600/30 border border-ruby-500/30 rounded text-xs text-ruby-300 font-medium">
            <AlertTriangle size={12} />
            CRÍTICO
          </div>
        )}
      </div>
    </div>
  );
}

// Componente: Telemetría Snapshot
function TelemetrySnapshot({ telemetry }) {
  const signalStatus = telemetry.onu.signalStatus;
  const signalConfig = {
    ok: { color: 'text-emerald-400', bg: 'bg-emerald-950/30' },
    warning: { color: 'text-amber-400', bg: 'bg-amber-950/30' },
    critical: { color: 'text-ruby-400', bg: 'bg-ruby-950/30' },
  };
  const config = signalConfig[signalStatus] || signalConfig.critical;

  return (
    <div className="space-y-3">
      {/* ONU Status */}
      <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-4">
        <p className="text-xs text-zinc-500 font-semibold mb-2">ESTADO ONU</p>
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              telemetry.onu.status === 'online'
                ? 'bg-emerald-500'
                : 'bg-ruby-500'
            } ${telemetry.onu.status !== 'online' ? 'animate-pulse' : ''}`}
          ></div>
          <div>
            <p className="text-sm font-semibold text-white capitalize">
              {telemetry.onu.status === 'online'
                ? 'En línea'
                : telemetry.onu.status === 'offline'
                ? 'Sin respuesta'
                : 'Sin luz'}
            </p>
            <p className="text-xs text-zinc-500">
              Visto: {telemetry.onu.lastSeen}
            </p>
          </div>
        </div>
      </div>

      {/* Signal */}
      <div className={`rounded-lg border p-4 ${config.bg} border-zinc-800/50`}>
        <p className="text-xs text-zinc-500 font-semibold mb-3">SEÑAL ÓPTICA</p>
        <div className="flex items-end gap-3">
          <div>
            <p className={`text-2xl font-bold ${config.color} font-mono`}>
              {telemetry.onu.signal}
            </p>
            <p className="text-xs text-zinc-500">dBm</p>
          </div>
          <div className="flex-1">
            <Signal size={20} className={`${config.color} ml-auto`} />
          </div>
        </div>
      </div>

      {/* Infraestructura */}
      <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-4 space-y-2">
        <p className="text-xs text-zinc-500 font-semibold mb-3">
          INFRAESTRUCTURA
        </p>
        <div className="text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-zinc-500">Nodo:</span>
            <span className="text-zinc-300 font-mono">
              {telemetry.infrastructure.node}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">IP:</span>
            <span className="text-zinc-300 font-mono">
              {telemetry.infrastructure.ip}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">MAC:</span>
            <span className="text-zinc-300 font-mono text-[10px]">
              {telemetry.infrastructure.macAddress}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">OLT:</span>
            <span className="text-zinc-300 font-mono">
              {telemetry.infrastructure.oltName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente Principal
export default function TicketDetailPage() {
  const [ticket, setTicket] = useState(mockTicket);
  const [noteInput, setNoteInput] = useState('');
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const handleAddNote = () => {
    if (!noteInput.trim()) return;

    const newEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toLocaleString('es-AR'),
      type: 'note',
      author: 'Op. Tu Nombre',
      content: noteInput,
      metadata: {},
    };

    setTicket({
      ...ticket,
      events: [newEvent, ...ticket.events],
    });
    setNoteInput('');
  };

  const handleRequestVisit = () => {
    setShowVisitDialog(false);
    // TODO: API call para crear OT / cambiar estado
    alert('Visita técnica solicitada. OT en estado "Pendiente de Planificación"');
  };

  const handleCloseTicket = () => {
    setShowCloseDialog(false);
    // TODO: API call para cerrar ticket
    alert('Ticket cerrado. Se notificará al cliente.');
  };

  return (
    <div className="space-y-6 px-8 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <span>Tickets</span>
        <ChevronRight size={16} />
        <span className="text-emerald-400 font-mono">#{ticket.id}</span>
      </div>

      {/* HEADER - Conexión / Servicio */}
      <div className="space-y-4">
        {/* Título principal */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
            {ticket.service.address}
          </h1>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <MapPin size={14} />
            <span>
              {ticket.service.city} - {ticket.service.zipCode}
            </span>
          </div>
        </div>

        {/* Cliente + Plan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-4">
            <p className="text-xs text-zinc-500 font-semibold mb-2">CLIENTE</p>
            <p className="text-sm font-semibold text-white mb-2">
              {ticket.client.name}
            </p>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <Phone size={12} />
              <span>{ticket.client.phone}</span>
            </div>
            <div className="text-xs text-zinc-400">
              {ticket.client.email}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-4">
            <p className="text-xs text-zinc-500 font-semibold mb-2">PLAN</p>
            <p className="text-sm font-semibold text-emerald-400 mb-2">
              {ticket.plan.name}
            </p>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{ticket.plan.bandwidth}</span>
              <span>SLA: {ticket.plan.sla}</span>
            </div>
          </div>
        </div>

        {/* Badges de estado + Acciones */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Badge
              className="bg-ruby-600 text-white border-ruby-500/50"
            >
              CRÍTICO
            </Badge>
            <Badge
              variant="outline"
              className="border-zinc-700 text-zinc-300"
            >
              Abierto
            </Badge>
            <span className="text-xs text-zinc-500 font-mono">
              Creado: {ticket.createdAt}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="bg-gold-600 hover:bg-gold-500 text-white"
              onClick={() => setShowVisitDialog(true)}
            >
              Solicitar Visita Técnica
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              onClick={() => setShowCloseDialog(true)}
            >
              Cerrar Ticket
            </Button>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL - 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal (70%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* OT Monitor */}
          {ticket.workOrder && (
            <WorkOrderCard
              workOrder={ticket.workOrder}
              onRequestVisit={() => setShowVisitDialog(true)}
            />
          )}

          {/* Timeline */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Bitácora de Eventos
            </h2>

            {/* Input para notas */}
            <div className="mb-6 p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
              <label className="text-xs text-zinc-500 font-semibold mb-2 block">
                Agregar Nota (Operador)
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Escribir nota interna..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === 'Enter' && handleAddNote()
                  }
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                />
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={handleAddNote}
                >
                  <Send size={14} />
                </Button>
              </div>
            </div>

            {/* Events */}
            <div>
              {ticket.events.map((event) => (
                <TimelineItem key={event.id} event={event} />
              ))}
            </div>
          </div>
        </div>

        {/* Columna Lateral (30%) */}
        <div className="space-y-6">
          {/* Telemetría Snapshot */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Snapshot Técnico (Beholder)
            </h3>
            <TelemetrySnapshot telemetry={ticket.telemetry} />
          </div>

          {/* Placeholder Mapa */}
          <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 h-40 flex items-center justify-center">
            <div className="text-center">
              <MapPin size={32} className="text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">Mapa de ubicación</p>
              <p className="text-xs text-zinc-600 mt-1">
                {ticket.service.address}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-4 space-y-2">
            <p className="text-xs text-zinc-500 font-semibold mb-3">
              ACCIONES RÁPIDAS
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-zinc-300 hover:text-white"
            >
              🔄 Refrescar Telemetría
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-zinc-300 hover:text-white"
            >
              📞 Llamar al Cliente
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-zinc-300 hover:text-white"
            >
              📋 Ver Historial OT
            </Button>
          </div>
        </div>
      </div>

      {/* DIALOGS */}

      {/* Dialog: Solicitar Visita */}
      <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
        <DialogContent className="bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              Solicitar Visita Técnica
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-2">
                Descripción del Problema (para el Técnico)
              </label>
              <textarea
                placeholder="Ej: ONU sin señal, cliente intentó reiniciar sin éxito..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded text-white text-sm p-3 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                rows="3"
              ></textarea>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-2">
                Fecha/Hora Preferida (Opcional)
              </label>
              <input
                type="datetime-local"
                className="w-full bg-zinc-900 border border-zinc-700 rounded text-white text-sm p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="bg-amber-950/30 border border-amber-500/20 rounded p-3">
              <p className="text-xs text-amber-400">
                ℹ️ La OT se creará en estado <strong>"Pendiente de Planificación"</strong>.
                El planificador la asignará a un técnico y programará la fecha.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300"
              onClick={() => setShowVisitDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={handleRequestVisit}
            >
              Crear Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cerrar Ticket */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Cerrar Ticket</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-2">
                Nota de Cierre
              </label>
              <textarea
                placeholder="Ej: Problema resuelto. Técnico cambió la ONU..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded text-white text-sm p-3 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                rows="3"
              ></textarea>
            </div>

            <div className="bg-ruby-950/30 border border-ruby-500/20 rounded p-3">
              <p className="text-xs text-ruby-400">
                ⚠️ <strong>Atención:</strong> Cerrar un ticket es irreversible.
                Se notificará al cliente automáticamente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300"
              onClick={() => setShowCloseDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-ruby-600 hover:bg-ruby-500 text-white"
              onClick={handleCloseTicket}
            >
              Cerrar Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
