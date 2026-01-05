/**
 * RepeatedIssueAlert - Alerta de problema recurrente
 * 
 * Detecta si hay tickets resueltos/cerrados de la misma conexión en los últimos 7 días.
 * Muestra alerta visual para alertar al técnico.
 */
import { AlertTriangle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const STATUS_LABELS = {
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

export default function RepeatedIssueAlert({ history }) {
  if (!history || history.length === 0) return null;

  // Filtrar tickets resueltos/cerrados en últimos 7 días
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentResolved = history.filter((ticket) => {
    const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
    const createdAt = new Date(ticket.created_at);
    return isResolved && createdAt >= sevenDaysAgo;
  });

  if (recentResolved.length === 0) return null;

  return (
    <Alert className="bg-amber-950/30 border-amber-700/50">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="text-xs text-amber-200">
        <div className="flex items-start gap-2">
          <div>
            <p className="font-medium mb-1">⚠️ Problema Recurrente Detectado</p>
            <p className="text-amber-300/80">
              Esta conexión tuvo{' '}
              <span className="font-semibold">{recentResolved.length}</span>{' '}
              {recentResolved.length === 1 ? 'incidente' : 'incidentes'}{' '}
              {STATUS_LABELS[recentResolved[0].status].toLowerCase()}{' '}
              en los últimos 7 días.
            </p>
            <div className="mt-2 space-y-1">
              {recentResolved.slice(0, 2).map((ticket) => (
                <div key={ticket.id} className="flex items-center gap-2 text-amber-300/70">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">
                    #{ticket.id} - {ticket.subject} (
                    {new Date(ticket.created_at).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                    )
                  </span>
                </div>
              ))}
              {recentResolved.length > 2 && (
                <p className="text-xs text-amber-400/60 pl-5">
                  + {recentResolved.length - 2} más
                </p>
              )}
            </div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
