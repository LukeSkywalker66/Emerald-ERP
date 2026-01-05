/**
 * TicketHistoryCard - Historial de tickets de la misma conexión
 * 
 * Muestra lista compacta de tickets previos para contexto rápido.
 * Solo visible cuando hay connection_id asociado al ticket.
 */
import { useState, useEffect } from 'react';
import { FileText, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getConnectionHistory } from '@/services/tickets.service';

const STATUS_LABELS = {
  open: 'Abierto',
  in_progress: 'En Progreso',
  pending: 'Pendiente',
  pending_infra: 'Pendiente Infra',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

const PRIORITY_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

const STATUS_COLORS = {
  open: 'text-yellow-500',
  in_progress: 'text-blue-500',
  pending: 'text-orange-500',
  pending_infra: 'text-purple-500',
  resolved: 'text-green-500',
  closed: 'text-zinc-500',
};

const PRIORITY_COLORS = {
  low: 'text-zinc-400',
  medium: 'text-blue-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

export default function TicketHistoryCard({ connectionId, currentTicketId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!connectionId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const tickets = await getConnectionHistory(connectionId, {
          limit: 5,
          exclude_ticket_id: currentTicketId,
        });
        setHistory(tickets);
      } catch (err) {
        console.error('Error cargando historial:', err);
        setError('No se pudo cargar el historial');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [connectionId, currentTicketId]);

  if (!connectionId) return null;

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Historial de Incidentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Historial de Incidentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Historial de Incidentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">No hay incidentes previos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Historial de Incidentes ({history.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.map((ticket) => (
          <div
            key={ticket.id}
            className="p-2 bg-zinc-800/50 rounded border border-zinc-700 hover:border-emerald-700 transition-colors cursor-pointer"
            onClick={() => window.location.href = `/app/tickets/${ticket.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate">
                  #{ticket.id} - {ticket.subject}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs ${STATUS_COLORS[ticket.status]}`}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className={`text-xs ${PRIORITY_COLORS[ticket.priority]}`}>
                    {PRIORITY_LABELS[ticket.priority]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-zinc-500">
                <Calendar className="w-3 h-3" />
                <span className="text-xs">
                  {new Date(ticket.created_at).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: 'short'
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
