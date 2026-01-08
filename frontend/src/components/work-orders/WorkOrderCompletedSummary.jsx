import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

/**
 * WorkOrderCompletedSummary - Muestra el resumen de una OT completada
 *
 * Incluye:
 * - Referencia al ticket origen (con link)
 * - Categoría de resolución (badge de color)
 * - Descripción del trabajo realizado
 * - Materiales utilizados
 * - Galería de fotos de evidencia
 */
export default function WorkOrderCompletedSummary({ workOrder }) {
  const navigate = useNavigate();

  if (!workOrder || !workOrder.completed_at) {
    return null;
  }

  const ticket_id = workOrder.ticket_info?.id || workOrder.ticket_id;
  const photos = workOrder.photo_urls || [];
  const category = workOrder.resolution_category;

  const categoryColors = {
    infrastructure: {
      bg: 'bg-blue-900/30',
      text: 'text-blue-200',
      border: 'border-blue-700/50',
      badge: 'bg-blue-600',
    },
    equipment: {
      bg: 'bg-purple-900/30',
      text: 'text-purple-200',
      border: 'border-purple-700/50',
      badge: 'bg-purple-600',
    },
    configuration: {
      bg: 'bg-emerald-900/30',
      text: 'text-emerald-200',
      border: 'border-emerald-700/50',
      badge: 'bg-emerald-600',
    },
    other: {
      bg: 'bg-amber-900/30',
      text: 'text-amber-200',
      border: 'border-amber-700/50',
      badge: 'bg-amber-600',
    },
  };

  const categoryLabels = {
    infrastructure: 'Infraestructura',
    equipment: 'Equipamiento',
    configuration: 'Configuración',
    other: 'Otra',
  };

  const colors = categoryColors[category] || categoryColors.other;

  console.log('[DEBUG] WorkOrderCompletedSummary received:', {
    photo_urls: photos,
    resolution_category: category,
  });

  return (
    <div className="space-y-4">
      {/* Referencia del Ticket Origen */}
      <div className={`p-4 rounded border ${colors.border} ${colors.bg}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Ticket Origen
            </p>
            <p className={`text-lg font-bold ${colors.text} mt-1`}>
              #{ticket_id} - {workOrder.ticket_info?.subject || 'Sin referencia'}
            </p>
            {workOrder.ticket_info?.client_name && (
              <p className="text-sm text-zinc-300 mt-2">
                Cliente: {workOrder.ticket_info.client_name}
              </p>
            )}
            {workOrder.ticket_info?.pppoe_username && (
              <p className="text-xs text-zinc-400 mt-1">
                Usuario: {workOrder.ticket_info.pppoe_username}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/app/tickets/${ticket_id}`)}
            className="flex items-center gap-2 text-emerald-400 border-emerald-500/50 hover:bg-emerald-900/30"
          >
            Ver Ticket
            <ExternalLink size={14} />
          </Button>
        </div>
      </div>

      {/* Categoría de Resolución */}
      {category && (
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Categoría de Resolución
          </p>
          <Badge className={`${colors.badge} text-white`}>
            {categoryLabels[category]}
          </Badge>
        </div>
      )}

      {/* Descripción del Trabajo */}
      {workOrder.resolution_notes && (
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Descripción del Trabajo
          </p>
          <div className="p-3 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 whitespace-pre-wrap">
            {workOrder.resolution_notes}
          </div>
        </div>
      )}

      {/* Materiales Utilizados */}
      {workOrder.items && workOrder.items.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Materiales Utilizados
          </p>
          <div className="space-y-2">
            {workOrder.items.map((item) => (
              <div key={item.id} className="p-3 bg-zinc-800 border border-zinc-700 rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Producto ID: {item.product_id}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Cantidad: {item.quantity} {item.serial_number && `| Serial: ${item.serial_number}`}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-zinc-300 mt-1">{item.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidencia Fotográfica */}
      {photos.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Evidencia Fotográfica
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative group bg-zinc-800 border border-zinc-700 rounded aspect-square overflow-hidden hover:border-emerald-500/50 transition"
              >
                <img
                  src={url}
                  alt={`Foto ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <p className="text-emerald-400 font-medium">Ver</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {!photos.length && (
        <div className="p-3 bg-amber-900/30 border border-amber-700/50 rounded text-sm text-amber-200">
          sin adjuntos
        </div>
      )}
    </div>
  );
}
