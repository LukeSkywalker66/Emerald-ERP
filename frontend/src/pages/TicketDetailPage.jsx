import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Loader,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  MessageSquare,
  FileText,
  TrendingUp,
  ArrowLeft,
  Wrench,
  Calendar,
  Send,
  MapPin,
  Phone,
  Network,
  Pencil,
  Check,
  X,
  Paperclip,
  File,
  Download,
  Image as ImageIcon,
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
import TicketHistoryCard from '@/components/tickets/TicketHistoryCard';
import RepeatedIssueAlert from '@/components/tickets/RepeatedIssueAlert';

const statusConfig = {
  open: { label: 'Abierto', tone: 'text-emerald-400', chip: 'bg-emerald-500/10 border-emerald-500/50' },
  in_progress: { label: 'En progreso', tone: 'text-blue-300', chip: 'bg-blue-500/10 border-blue-500/50' },
  pending: { label: 'Pendiente', tone: 'text-amber-300', chip: 'bg-amber-500/10 border-amber-500/50' },
  pending_infra: { label: 'Pendiente Infra', tone: 'text-purple-300', chip: 'bg-purple-500/10 border-purple-500/50' },
  resolved: { label: 'Resuelto', tone: 'text-emerald-300', chip: 'bg-emerald-500/10 border-emerald-500/50' },
  closed: { label: 'Cerrado', tone: 'text-zinc-300', chip: 'bg-zinc-500/10 border-zinc-700' },
};

const priorityConfig = {
  critical: { label: 'Crítica', chip: 'bg-ruby-500/15 border-ruby-500/60 text-ruby-200' },
  high: { label: 'Alta', chip: 'bg-ruby-500/10 border-ruby-500/50 text-ruby-100' },
  medium: { label: 'Media', chip: 'bg-gold-500/10 border-gold-500/50 text-gold-100' },
  low: { label: 'Baja', chip: 'bg-zinc-700/60 border-zinc-600 text-zinc-200' },
};

function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig.open;
  return (
    <Badge variant="outline" className={`${cfg.chip} text-xs font-semibold px-3 py-1`}> 
      {cfg.label}
    </Badge>
  );
}

function PriorityBadge({ priority }) {
  const cfg = priorityConfig[priority] || priorityConfig.medium;
  return (
    <Badge variant="outline" className={`${cfg.chip} text-xs font-semibold px-3 py-1`}>
      Prioridad {cfg.label}
    </Badge>
  );
}

function InlineEditableSelect({ label, display, value, options, onSave, disabled, loading }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSave = async () => {
    if (draft === value) {
      setIsEditing(false);
      return;
    }
    await onSave(draft);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
        <div className="flex items-center gap-2 text-sm text-white">
          <span>{display}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2">
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled || loading}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || loading}
          className="p-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
          title="Guardar"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => { setDraft(value); setIsEditing(false); }}
          className="p-2 rounded bg-zinc-800 text-zinc-200"
          title="Cancelar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function WorkOrderCard({ workOrder }) {
  const statusIcons = {
    pending_planning: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-950/30', label: 'En planificación' },
    assigned: { icon: User, color: 'text-blue-300', bg: 'bg-blue-950/30', label: 'Asignada' },
    scheduled: { icon: Calendar, color: 'text-blue-300', bg: 'bg-blue-950/30', label: 'Programada' },
    in_progress: { icon: Loader, color: 'text-emerald-400', bg: 'bg-emerald-950/30', label: 'En curso' },
    completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950/30', label: 'Completada' },
    failed: { icon: AlertTriangle, color: 'text-ruby-400', bg: 'bg-ruby-950/30', label: 'Fallida' },
  };

  const statusInfo = statusIcons[workOrder.status] || statusIcons.pending_planning;
  const Icon = statusInfo.icon;

  const typeLabels = {
    repair: { label: 'Soporte', tone: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40' },
    install: { label: 'Instalación', tone: 'bg-blue-500/10 text-blue-200 border-blue-500/40' },
    pickup: { label: 'Retiro', tone: 'bg-zinc-600/30 text-zinc-100 border-zinc-500/30' },
    infrastructure: { label: 'Infraestructura', tone: 'bg-purple-500/15 text-purple-200 border-purple-500/40' },
  };

  const typeInfo = typeLabels[workOrder.ot_type] || typeLabels.repair;

  return (
    <div className={`p-4 rounded-lg border border-zinc-800/80 ${statusInfo.bg}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className={statusInfo.color} />
          <span className="text-sm font-medium text-white">OT #{workOrder.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{statusInfo.label}</Badge>
          <Badge variant="outline" className={`text-xs ${typeInfo.tone}`}>{typeInfo.label}</Badge>
        </div>
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
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  const eventIcons = {
    note: { icon: MessageSquare, color: 'text-blue-400' },
    status_change: { icon: AlertCircle, color: 'text-amber-400' },
    ot_event: { icon: FileText, color: 'text-emerald-400' },
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

  return (
    <>
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
            <time className="text-xs text-zinc-500 ml-4 whitespace-nowrap">
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
                        <div
                          onClick={() => {
                            setSelectedImage(attachment);
                            setShowImageModal(true);
                          }}
                          className="group relative rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800 cursor-pointer hover:border-emerald-500/50 transition aspect-square"
                        >
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <ImageIcon size={16} className="text-white" />
                          </div>
                        </div>
                      ) : (
                        <a
                          href={attachment.url}
                          download={attachment.name}
                          className="flex flex-col items-center justify-center p-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700/50 transition h-full gap-1 w-24"
                          title={`Descargar ${attachment.name}`}
                        >
                          <File size={16} className="text-cyan-400" />
                          <span className="text-xs text-zinc-300 text-center line-clamp-2 break-words max-w-full">
                            {attachment.name}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {formatFileSize(attachment.size)}
                          </span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Archivo adjunto (compatibilidad con FILE event_type antiguo) */}
          {event.event_type?.toLowerCase?.() === 'file' && filePath && (
            <div className="mt-3">
              {isImageFile ? (
                <div className="space-y-2">
                  <img 
                    src={filePath}
                    alt={fileName}
                    className="max-w-xs max-h-48 rounded-lg border border-zinc-700 cursor-pointer hover:border-emerald-500 transition-colors"
                    onClick={() => setShowImageModal(true)}
                  />
                  <p className="text-xs text-zinc-500">{fileName} ({formatFileSize(fileSize)})</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 w-fit">
                  <File size={16} className="text-cyan-400" />
                  <div className="flex-1">
                    <p className="text-sm text-white break-all">{fileName}</p>
                    <p className="text-xs text-zinc-500">{formatFileSize(fileSize)}</p>
                  </div>
                  <a 
                    href={filePath}
                    download={fileName}
                    className="ml-2 p-1.5 rounded hover:bg-zinc-800 transition-colors"
                    title="Descargar archivo"
                  >
                    <Download size={16} className="text-cyan-400" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal para ver imagen en tamaño completo */}
      {showImageModal && selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4 overflow-auto"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-zinc-900 rounded-lg overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header con botón cerrar */}
            <div className="flex items-center justify-between p-3 border-b border-zinc-800">
              <p className="text-sm text-zinc-300 truncate flex-1 pr-4">
                {selectedImage.name || fileName}
              </p>
              <button
                onClick={() => setShowImageModal(false)}
                className="shrink-0 p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
                title="Cerrar (ESC)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Imagen */}
            <div className="flex-1 overflow-auto flex items-center justify-center min-h-0 bg-black/50">
              <img
                src={selectedImage.url || filePath}
                alt={selectedImage.name || fileName}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Footer con descarga */}
            <div className="p-3 border-t border-zinc-800 flex items-center justify-between bg-zinc-950">
              <span className="text-xs text-zinc-400">
                {formatFileSize(selectedImage.size)}
              </span>
              <a
                href={selectedImage.url || filePath}
                download={selectedImage.name || fileName}
                className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition"
                title="Descargar imagen"
              >
                <Download size={16} />
                Descargar
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AvailabilityEditor({ value, onSave, disabled }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(draft);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Disponibilidad</p>
          <p className="text-sm text-zinc-200 whitespace-pre-line min-h-[24px]">
            {value || 'Sin disponibilidad registrada'}
          </p>
        </div>
        {!disabled && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="border-emerald-700 text-emerald-300">
            Editar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">Disponibilidad</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        rows={3}
        placeholder="Ej: Solo mañana de 9 a 12"
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => { setDraft(value || ''); setIsEditing(false); }} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmittingWO, setIsSubmittingWO] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [escalateNote, setEscalateNote] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [infraNote, setInfraNote] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState([]);

  const loadTicket = async () => {
    try {
      setError(null);
      const data = await ticketsService.getById(id);
      setTicket(data);
      
      // Cargar historial si hay connection_id
      if (data.connection_id) {
        try {
          const history = await ticketsService.getConnectionHistory(data.connection_id, {
            limit: 5,
            exclude_ticket_id: data.id
          });
          setConnectionHistory(history);
        } catch (histErr) {
          console.error('Error loading connection history:', histErr);
          // No mostramos error al usuario, simplemente no cargará el historial
        }
      }
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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const data = await ticketsService.getUsers();
        setUsers(data || []);
      } catch (err) {
        console.error('Error loading users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const handleAddNote = async (contentOverride) => {
    const content = (contentOverride ?? noteContent).trim();
    if (!content && selectedFiles.length === 0) {
      setError('Agrega un texto o archivos');
      return;
    }

    try {
      setIsSubmittingNote(true);
      setError(null);

      // Crear FormData multipart
      const formData = new FormData();
      formData.append('content', content || 'Adjunto sin comentario');

      // Agregar archivos
      selectedFiles.forEach(({ file }) => {
        formData.append('files', file);
      });

      // POST a endpoint de timeline
      const response = await fetch(
        `/api/v2/tickets/${ticket.id}/timeline`,
        {
          method: 'POST',
          body: formData,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al publicar nota');
      }

      const newEvent = await response.json();

      // Optimistic update: agregar evento al timeline inmediatamente (al final)
      setTicket(prev => ({
        ...prev,
        timeline: [...prev.timeline, newEvent],
      }));

      // Limpiar estado
      setNoteContent('');
      setSelectedFiles([]);
    } catch (err) {
      setError(err.message || 'Error al agregar nota');
      console.error('Error adding note:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map(file => ({
      file,
      id: Math.random(),
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
    
    // Limpiar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingFile(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/v2/tickets/${ticket.id}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Error uploading file: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Actualizar el estado del ticket con el nuevo evento inmediatamente
      if (data.event && ticket) {
        setTicket(prev => ({
          ...prev,
          timeline: [data.event, ...prev.timeline]
        }));
      }
    } catch (err) {
      setError(err.message || 'Error al subir archivo');
      console.error('File upload error:', err);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const performStatusChange = async (newStatus, note) => {
    try {
      setIsSaving(true);
      await ticketsService.updateTicket(id, { status: newStatus });
      if (note && note.trim()) {
        await ticketsService.addNote(id, note.trim());
      }
      await loadTicket();
    } catch (err) {
      setError(err.message || 'Error al actualizar estado');
      console.error('Status change error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickUpdate = async (payload) => {
    try {
      setIsSaving(true);
      setError(null);
      await ticketsService.updateTicket(id, payload);
      await loadTicket();
    } catch (err) {
      setError(err.message || 'Error al actualizar ticket');
      console.error('Quick update error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    if (newStatus && newStatus !== ticket.status) {
      handleQuickUpdate({ status: newStatus });
    }
  };

  const handlePriorityChange = (e) => {
    const newPriority = e.target.value;
    if (newPriority && newPriority !== ticket.priority) {
      handleQuickUpdate({ priority: newPriority });
    }
  };

  const handleAssigneeChange = (e) => {
    const value = e.target.value;
    const assignedId = value ? Number(value) : null;
    handleQuickUpdate({ assigned_to_id: assignedId });
  };

  const handleRequestVisit = async () => {
    try {
      setIsSubmittingWO(true);
      await ticketsService.createWorkOrder(ticket.id, {
        ot_type: 'repair',
        notes: 'Visita técnica solicitada desde soporte',
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

  const handleInfraWorkOrder = async () => {
    try {
      setIsSubmittingWO(true);
      await ticketsService.createWorkOrder(ticket.id, {
        ot_type: 'infrastructure',
        notes: infraNote || 'OT Infra generada desde soporte',
      });
      setInfraNote('');
      await loadTicket();
    } catch (err) {
      setError(err.message || 'Error al crear OT infra');
      console.error('Error creating infra WO:', err);
    } finally {
      setIsSubmittingWO(false);
    }
  };

  const handleAvailabilitySave = async (value) => {
    try {
      setIsSaving(true);
      await ticketsService.updateTicket(id, { availability_note: value || null });
      setTicket((prev) => ({ ...prev, availability_note: value || null }));
      await loadTicket();
    } catch (err) {
      setError(err.message || 'Error al guardar disponibilidad');
      console.error('Availability save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader size={24} className="animate-spin text-emerald-400" />
          <p className="text-zinc-400">Cargando ticket...</p>
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

  const isInSupport = ['open', 'in_progress', 'pending'].includes(ticket.status);
  const isInInfra = ticket.status === 'pending_infra';
  const isClosed = ['resolved', 'closed'].includes(ticket.status);

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/app/tickets')}
        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      >
        <ChevronLeft size={16} />
        Volver a tickets
      </Button>

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
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">{ticket.subject}</h1>
                <p className="text-sm text-emerald-400 font-mono">Ticket #{ticket.id}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InlineEditableSelect
                label="Estado"
                display={statusConfig[ticket.status]?.label || 'Estado' }
                value={ticket.status}
                options={Object.entries(statusConfig).map(([value, cfg]) => ({ value, label: cfg.label }))}
                onSave={(val) => handleQuickUpdate({ status: val })}
                disabled={isClosed || isSaving}
                loading={isSaving}
              />

              <InlineEditableSelect
                label="Prioridad"
                display={`Prioridad ${priorityConfig[ticket.priority]?.label || 'N/D'}`}
                value={ticket.priority}
                options={Object.entries(priorityConfig).map(([value, cfg]) => ({ value, label: `Prioridad ${cfg.label}` }))}
                onSave={(val) => handleQuickUpdate({ priority: val })}
                disabled={isClosed || isSaving}
                loading={isSaving}
              />

              <InlineEditableSelect
                label="Asignado"
                display={ticket.assigned_to_name || 'Sin asignar'}
                value={ticket.assigned_to_id || ''}
                options={[{ value: '', label: 'Sin asignar' }, ...(users || []).map((u) => ({ value: String(u.id), label: u.name || u.username }))]}
                onSave={(val) => handleQuickUpdate({ assigned_to_id: val ? Number(val) : null })}
                disabled={isSaving || loadingUsers}
                loading={loadingUsers}
              />
            </div>

            <p className="text-zinc-300 leading-relaxed">
              {ticket.description || 'Sin descripción adicional.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
              <AvailabilityEditor
                value={ticket.availability_note}
                onSave={handleAvailabilitySave}
                disabled={isClosed}
              />

              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Referencia</p>
                <div className="flex items-center gap-2 text-sm text-zinc-200">
                  <Clock size={14} className="text-emerald-300" />
                  Creado: {new Date(ticket.created_at).toLocaleString('es-AR')}
                </div>
                {ticket.assigned_to_name && (
                  <div className="flex items-center gap-2 text-sm text-zinc-200">
                    <User size={14} className="text-emerald-300" />
                    Asignado: {ticket.assigned_to_name}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Cronología</p>
                <h2 className="text-lg font-semibold text-white">Bitácora del ticket</h2>
              </div>
            </div>

            <div className="space-y-4">
              {(ticket.timeline || []).length === 0 && (
                <p className="text-sm text-zinc-500">Sin eventos aún.</p>
              )}
              {(ticket.timeline || []).map((event, idx) => (
                <TimelineItem key={event.id} event={event} index={idx} />
              ))}
            </div>

            {!isClosed && (
              <div className="mt-6 border-t border-zinc-800 pt-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                  Agregar nota o archivo
                </p>
                <div className="space-y-3">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={3}
                    disabled={isSubmittingNote}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    placeholder="Escribe una nota (opcional si hay adjuntos)"
                  />

                  {/* Preview de archivos seleccionados */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
                      {selectedFiles.map(({ file, id }) => (
                        <div
                          key={id}
                          className="flex items-center gap-2 px-2 py-1 bg-zinc-800 rounded border border-zinc-700"
                        >
                          {file.type.startsWith('image/') ? (
                            <ImageIcon size={14} className="text-emerald-400" />
                          ) : (
                            <File size={14} className="text-cyan-400" />
                          )}
                          <span className="text-xs text-zinc-300 max-w-[150px] truncate">
                            {file.name}
                          </span>
                          <button
                            onClick={() => handleRemoveFile(id)}
                            className="p-0.5 hover:bg-zinc-700 rounded transition-colors"
                            title="Remover archivo"
                          >
                            <X size={12} className="text-zinc-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Input file oculto */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileInputChange}
                    multiple
                    disabled={isSubmittingNote}
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.doc,.docx,.xlsx"
                  />

                  {/* Botones Adjuntar + Publicar */}
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmittingNote}
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                      <Paperclip size={14} className="mr-2" />
                      Adjuntar
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleAddNote()}
                      disabled={
                        isSubmittingNote ||
                        (noteContent.trim().length === 0 && selectedFiles.length === 0)
                      }
                    >
                      <Send size={14} className="mr-2" />
                      {isSubmittingNote ? 'Enviando...' : 'Publicar'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Acciones</p>

            {isInSupport && !isClosed && (
              <Button className="w-full" onClick={() => setShowVisitDialog(true)} disabled={isSaving || isSubmittingWO}>
                <Calendar size={16} className="mr-2" /> Solicitar visita
              </Button>
            )}

            {isInSupport && !isClosed && (
              <Button
                className="w-full bg-purple-700 hover:bg-purple-600"
                onClick={() => setShowEscalateDialog(true)}
                disabled={isSaving}
              >
                <TrendingUp size={16} className="mr-2" /> Escalar a Infraestructura
              </Button>
            )}

            {isInInfra && !isClosed && (
              <Button
                variant="outline"
                className="w-full border-purple-500/60 text-purple-200"
                onClick={() => setShowReturnDialog(true)}
                disabled={isSaving}
              >
                <ArrowLeft size={16} className="mr-2" /> Devolver a soporte
              </Button>
            )}

            {isInInfra && !isClosed && (
              <div className="space-y-2">
                <textarea
                  value={infraNote}
                  onChange={(e) => setInfraNote(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nota para la OT de Infra"
                />
                <Button
                  variant="outline"
                  className="w-full border-emerald-600 text-emerald-200"
                  onClick={handleInfraWorkOrder}
                  disabled={isSubmittingWO}
                >
                  <Wrench size={16} className="mr-2" /> OT Infraestructura
                </Button>
              </div>
            )}

            {!isClosed && (
              <Button
                variant="ghost"
                className="w-full text-zinc-200"
                onClick={() => setShowCloseDialog(true)}
                disabled={isSaving}
              >
                <CheckCircle size={16} className="mr-2" /> Cerrar ticket
              </Button>
            )}

            {isClosed && (
              <div className="text-sm text-zinc-500">Ticket cerrado</div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Órdenes de trabajo</p>
              <Badge variant="outline" className="text-xs">
                {(ticket.work_orders || []).length} abiertas
              </Badge>
            </div>
            <div className="space-y-3">
              {(ticket.work_orders || []).length === 0 && (
                <p className="text-sm text-zinc-500">Aún no hay OT.</p>
              )}
              {(ticket.work_orders || []).map((wo) => (
                <WorkOrderCard key={wo.id} workOrder={wo} />
              ))}
            </div>
          </div>

          {ticket.connection_details && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Cliente y conexión</p>
                <Badge variant="outline" className="text-xs">ID #{ticket.connection_details.connection_id}</Badge>
              </div>

              <div className="space-y-3 text-sm text-zinc-200">
                <div className="flex items-start gap-2">
                  <User size={14} className="text-emerald-300 mt-0.5" />
                  <div>
                    <p className="font-medium text-white">{ticket.connection_details.client_name || 'Cliente sin nombre'}</p>
                    <p className="text-xs text-zinc-400">DNI: {ticket.connection_details.client_dni || 'N/D'}</p>
                    <p className="text-xs text-zinc-400 flex items-center gap-1">
                      <Phone size={12} /> {ticket.connection_details.phone || 'Sin teléfono'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-emerald-300 mt-0.5" />
                  <div>
                    <p className="text-sm">{ticket.connection_details.address || 'Sin dirección'}</p>
                    {ticket.connection_details.pppoe_username && (
                      <p className="text-xs text-zinc-400 font-mono">PPPoE: {ticket.connection_details.pppoe_username}</p>
                    )}
                  </div>
                </div>

                {(ticket.connection_details.node_name || ticket.connection_details.node_ip) && (
                  <div className="flex items-center gap-2 text-sm text-zinc-200">
                    <Network size={14} className="text-emerald-300" />
                    <span>
                      Nodo: {ticket.connection_details.node_name || 'N/D'}
                      {ticket.connection_details.node_ip ? ` (${ticket.connection_details.node_ip})` : ''}
                    </span>
                  </div>
                )}

                {(ticket.connection_details.plan_name || ticket.connection_details.plan_speed) && (
                  <div className="flex items-center gap-2 text-sm text-zinc-200">
                    <Badge variant="outline" className="text-xs">Plan</Badge>
                    <span>
                      {ticket.connection_details.plan_name || 'Plan sin nombre'}
                      {ticket.connection_details.plan_speed ? ` - ${ticket.connection_details.plan_speed} Mbps` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Historial de Tickets de la Conexión */}
          {ticket.connection_id && (
            <div className="space-y-4">
              {/* Alerta de Problema Recurrente */}
              <RepeatedIssueAlert history={connectionHistory} />

              {/* Card de Historial */}
              <TicketHistoryCard 
                connectionId={ticket.connection_id}
                currentTicketId={ticket.id}
              />
            </div>
          )}
        </div>

        {/* Sidebar Derecho - Vacío por ahora */}
        <div className="lg:col-span-1 space-y-4">
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar visita técnica</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-300">Se generará una OT de reparación y se notificará en la bitácora.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowVisitDialog(false)}>Cancelar</Button>
            <Button onClick={handleRequestVisit} disabled={isSubmittingWO}>
              {isSubmittingWO ? 'Creando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalar a Infraestructura</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">El ticket pasará a estado Pendiente Infra y quedará retenido en soporte.</p>
            <textarea
              value={escalateNote}
              onChange={(e) => setEscalateNote(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
              placeholder="Nota opcional para la bitácora"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEscalateDialog(false)}>Cancelar</Button>
            <Button onClick={async () => { await performStatusChange('pending_infra', escalateNote); setShowEscalateDialog(false); setEscalateNote(''); }} disabled={isSaving}>
              {isSaving ? 'Actualizando...' : 'Escalar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver a soporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">El ticket regresará a estado Pendiente para seguimiento en soporte.</p>
            <textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
              placeholder="Detalle de devolución"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReturnDialog(false)}>Cancelar</Button>
            <Button onClick={async () => { await performStatusChange('pending', returnNote); setShowReturnDialog(false); setReturnNote(''); }} disabled={isSaving}>
              {isSaving ? 'Actualizando...' : 'Devolver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">Cierra el ticket y registra una nota opcional en la cronología.</p>
            <textarea
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
              placeholder="Nota de cierre"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCloseDialog(false)}>Cancelar</Button>
            <Button onClick={async () => { await performStatusChange('closed', closeNote); setShowCloseDialog(false); setCloseNote(''); }} disabled={isSaving}>
              {isSaving ? 'Cerrando...' : 'Cerrar ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
