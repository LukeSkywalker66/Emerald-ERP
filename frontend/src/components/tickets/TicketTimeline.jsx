import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  AlertCircle,
  FileText,
  AlertTriangle,
  Paperclip,
  File,
  Image as ImageIcon,
  Download,
  Zap,
  Wrench,
} from 'lucide-react';

function TimelineEventCard({ event }) {
  const navigate = useNavigate();

  const eventIcons = {
    note: { icon: MessageSquare, color: 'text-blue-400' },
    status_change: { icon: AlertCircle, color: 'text-amber-400' },
    ot_event: { icon: Zap, color: 'text-emerald-400' },
    alert: { icon: AlertTriangle, color: 'text-ruby-400' },
    file: { icon: Paperclip, color: 'text-cyan-400' },
  };

  const eventInfo = eventIcons[event.event_type?.toLowerCase?.()] || eventIcons.note;
  const Icon = eventInfo.icon;

  // Extraer attachments del meta_data
  const attachments = event.meta_data?.attachments || [];

  const isImageFile = event.meta_data?.content_type?.startsWith('image/') || event.meta_data?.type?.startsWith('image/');
  const fileSize = event.meta_data?.size;
  const fileName = event.meta_data?.filename;
  const filePath = event.meta_data?.filepath || event.meta_data?.url;

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Mapeo de estados a colores
  const statusColorMap = {
    'pending_planning': 'bg-zinc-600 text-zinc-100',
    'assigned': 'bg-blue-600 text-blue-100',
    'in_progress': 'bg-amber-600 text-amber-100',
    'completed': 'bg-emerald-600 text-emerald-100',
    'failed': 'bg-red-600 text-red-100',
    'backlog': 'bg-zinc-700 text-zinc-200',
    'testing': 'bg-gold-700 text-gold-100',
    'rejected': 'bg-ruby-700 text-ruby-100',
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending_planning': 'Pendiente',
      'assigned': 'Asignada',
      'in_progress': 'En progreso',
      'completed': 'Completada',
      'failed': 'Fallida',
      'backlog': 'Backlog',
      'testing': 'Testing',
      'rejected': 'Rechazada',
    };
    return labels[status] || status;
  };

  // Card especial para tareas del NOC (detecta eventos tipo 'alert' con engineering_task_id)
  if (
    event.event_type === 'alert' &&
    event.meta_data && typeof event.meta_data.engineering_task_id !== 'undefined'
  ) {
    const taskId = event.meta_data.engineering_task_id;
    const currentStatus = event.meta_data.engineering_task_status || 'backlog';
    const statusColor = statusColorMap[currentStatus] || 'bg-zinc-700 text-zinc-200';
    return (
      <div className="flex gap-4 relative">
        <div className={`w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 z-10 text-emerald-400`}>
          <Wrench size={12} />
        </div>
        <div className="flex-1 pb-4">
          <div
            onClick={() => navigate(`/app/engineering?task=${taskId}`)}
            className="cursor-pointer rounded-lg border border-emerald-700/50 bg-zinc-900/30 p-4 hover:border-emerald-500 hover:bg-zinc-900/50 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm text-emerald-200 font-semibold">Tarea NOC #{taskId}</p>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
                {getStatusLabel(currentStatus)}
              </span>
            </div>
            <p
              className="text-sm text-emerald-100 mt-1"
              dangerouslySetInnerHTML={{ __html: event.content }}
            />
            <div className="flex items-center justify-between mt-2">
              <time className="text-xs text-zinc-500">
                {new Date(event.created_at).toLocaleString('es-AR')}
              </time>
              {event.author_name && (
                <p className="text-xs text-zinc-500">por {event.author_name}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  const navigate = useNavigate();

  const eventIcons = {
    note: { icon: MessageSquare, color: 'text-blue-400' },
    status_change: { icon: AlertCircle, color: 'text-amber-400' },
    ot_event: { icon: Zap, color: 'text-emerald-400' },
    alert: { icon: AlertTriangle, color: 'text-ruby-400' },
    file: { icon: Paperclip, color: 'text-cyan-400' },
  };

  const eventInfo = eventIcons[event.event_type?.toLowerCase?.()] || eventIcons.note;
  const Icon = eventInfo.icon;

  // Extraer attachments del meta_data
  const attachments = event.meta_data?.attachments || [];

  const isImageFile = event.meta_data?.content_type?.startsWith('image/') || event.meta_data?.type?.startsWith('image/');
  const fileSize = event.meta_data?.size;
  const fileName = event.meta_data?.filename;
  const filePath = event.meta_data?.filepath || event.meta_data?.url;

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Mapeo de estados a colores
  const statusColorMap = {
    'pending_planning': 'bg-zinc-600 text-zinc-100',
    'assigned': 'bg-blue-600 text-blue-100',
    'in_progress': 'bg-amber-600 text-amber-100',
    'completed': 'bg-emerald-600 text-emerald-100',
    'failed': 'bg-red-600 text-red-100',
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending_planning': 'Pendiente',
      'assigned': 'Asignada',
      'in_progress': 'En progreso',
      'completed': 'Completada',
      'failed': 'Fallida',
    };
    return labels[status] || status;
  };

  // Si es evento de OT, renderizar como Card clickeable con status dinámico
  if (event.event_type === 'OT_EVENT' && event.meta_data?.work_order_id) {
    // Usar el status ACTUAL si está disponible (desde backend), sino fallback al contenido
    const currentStatus = event.meta_data?.current_status || 'pending_planning';
    const statusColor = statusColorMap[currentStatus] || 'bg-zinc-600 text-zinc-100';
    
    return (
      <div className="flex gap-4 relative">
        <div className={`w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 z-10 ${eventInfo.color}`}>
          <Icon size={12} />
        </div>
        <div className="flex-1 pb-4">
          <div
            onClick={() => navigate(`/app/work-orders/${event.meta_data.work_order_id}/execute`)}
            className="cursor-pointer rounded-lg border border-emerald-700/50 bg-emerald-900/30 p-4 hover:border-emerald-500 hover:bg-emerald-900/50 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm text-emerald-200 font-semibold">OT #{event.meta_data.work_order_id}</p>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
                {getStatusLabel(currentStatus)}
              </span>
            </div>
            <p
              className="text-sm text-emerald-100 mt-1"
              dangerouslySetInnerHTML={{ __html: event.content }}
            />
            <div className="flex items-center justify-between mt-2">
              <time className="text-xs text-zinc-500">
                {new Date(event.created_at).toLocaleString('es-AR')}
              </time>
              {event.author_name && (
                <p className="text-xs text-zinc-500">por {event.author_name}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Formatear contenido con saltos de línea
  const formatContent = (content) => {
    if (!content) return '';
    // Convertir saltos de línea en elementos separados
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 1) {
      return <span className="text-sm font-medium text-white">{lines[0]}</span>;
    }
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-white">{lines[0]}</p>
        {lines.slice(1).map((line, idx) => (
          <p key={idx} className="text-sm text-zinc-300 leading-relaxed">{line}</p>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex gap-4 relative">
        <div className={`w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 z-10 ${eventInfo.color}`}>
          <Icon size={12} />
        </div>
        <div className="flex-1 pb-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="flex items-start justify-between mb-2">
              {formatContent(event.content)}
              <time className="text-xs text-zinc-500 ml-4 whitespace-nowrap flex-shrink-0">
                {new Date(event.created_at).toLocaleString('es-AR')}
              </time>
            </div>
            {event.author_name && (
              <p className="text-xs text-zinc-500">por {event.author_name}</p>
            )}

          {/* Archivos adjuntos en NOTE */}
          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-zinc-400 font-semibold">
                Adjuntos ({attachments.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {attachments.map(attachment => {
                  const isImage = attachment.type?.startsWith('image/');

                  return (
                    <div key={attachment.id}>
                      {isImage ? (
                        <div className="relative group">
                          <img
                            src={attachment.url || attachment.filepath}
                            alt={attachment.filename}
                            className="w-full h-24 object-cover rounded-lg border border-zinc-700 cursor-pointer hover:border-emerald-500"
                            onClick={() => {
                              const modal = document.createElement('div');
                              modal.innerHTML = `
                                <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;">
                                  <img src="${attachment.url || attachment.filepath}" style="max-width: 90vw; max-height: 90vh; border-radius: 8px;" />
                                </div>
                              `;
                              document.body.appendChild(modal);
                              modal.addEventListener('click', () => modal.remove());
                            }}
                          />
                          <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ImageIcon size={20} className="text-white" />
                          </div>
                        </div>
                      ) : (
                        <a
                          href={attachment.url || attachment.filepath}
                          download={attachment.filename}
                          className="w-full h-24 rounded-lg border border-zinc-700 flex flex-col items-center justify-center hover:border-emerald-500 hover:bg-zinc-800/50 transition-colors"
                        >
                          <File size={18} className="text-zinc-400 mb-1" />
                          <span className="text-xs text-zinc-400 text-center truncate px-1">
                            {attachment.filename}
                          </span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Single attachment (legacy) */}
          {fileName && (
            <div className="mt-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isImageFile ? (
                  <ImageIcon size={16} className="text-cyan-400 flex-shrink-0" />
                ) : (
                  <File size={16} className="text-cyan-400 flex-shrink-0" />
                )}
                <span className="text-xs text-zinc-300 truncate">{fileName}</span>
                {fileSize && <span className="text-xs text-zinc-500">({formatFileSize(fileSize)})</span>}
              </div>
              <a
                href={filePath}
                download={fileName}
                className="ml-2 text-cyan-400 hover:text-cyan-300 transition-colors flex-shrink-0"
              >
                <Download size={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default TimelineEventCard;
