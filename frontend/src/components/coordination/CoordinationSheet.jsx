/**
 * CoordinationSheet.jsx
 * 
 * Panel lateral para coordinación pre-asignación.
 * Contacto, disponibilidad y ajuste de duración.
 */

import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Phone,
  Clock,
  AlertCircle,
  Plus,
  Minus,
  ChevronRight,
  MapPin,
  User,
  CheckCircle2,
  AlertTriangle,
  Lock,
  X,
  Send,
} from 'lucide-react';
import api from '@/api/client';

const OT_TYPE_LABELS = {
  repair: 'Reparación',
  install: 'Instalación',
  pickup: 'Retiro',
  infrastructure: 'Infraestructura',
};

const OT_TYPE_COLORS = {
  repair: 'bg-amber-600',
  install: 'bg-emerald-600',
  pickup: 'bg-blue-600',
  infrastructure: 'bg-purple-600',
};

export default function CoordinationSheet({
  workOrder,
  isOpen,
  onClose,
  onDurationChange,
}) {
  const [duration, setDuration] = useState(workOrder?.estimated_duration || 60);
  const [isSavingDuration, setIsSavingDuration] = useState(false);
  const [contactAttempts, setContactAttempts] = useState([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [durationChanged, setDurationChanged] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [isLoadingTicket, setIsLoadingTicket] = useState(false);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [incompleteReason, setIncompleteReason] = useState('');
  const [isMarkingIncomplete, setIsMarkingIncomplete] = useState(false);
  const [woPriority, setWoPriority] = useState(workOrder?.priority || 'medium');
  const [priorityChanged, setPriorityChanged] = useState(false);
  const [isSavingPriority, setIsSavingPriority] = useState(false);

  // ========== HELPER FUNCTIONS ==========

  /**
   * Determina si una OT está bloqueada por fecha pasada
   * Bloquea si scheduled_start < now - 5 minutos (grace period)
   */
  const isWorkOrderPastDate = (wo) => {
    if (!wo?.scheduled_start) return false;
    const now = new Date();
    const gracePeriod = 5 * 60 * 1000; // 5 minutos en ms
    const scheduledTime = new Date(wo.scheduled_start);
    return scheduledTime < new Date(now.getTime() - gracePeriod);
  };

  // Calcular si está bloqueada (por status completada O por fecha pasada)
  const isLocked = workOrder?.status === 'completed' || isWorkOrderPastDate(workOrder);
  const lockedReason = workOrder?.status === 'completed' 
    ? 'completada' 
    : isWorkOrderPastDate(workOrder) 
    ? 'fecha pasada' 
    : null;

  // ========== EFFECTS ==========

  useEffect(() => {
    if (isOpen && workOrder?.ticket_id) {
      loadTicketDetails();
    }
  }, [isOpen, workOrder?.ticket_id]);

  useEffect(() => {
    if (isOpen && workOrder?.id) {
      loadContactAttempts();
    }
  }, [isOpen, workOrder?.id]);

  useEffect(() => {
    setDuration(workOrder?.estimated_duration || 60);
    setDurationChanged(false);
    setWoPriority(workOrder?.priority || 'medium');
    setPriorityChanged(false);
  }, [workOrder?.id]);

  // ========== FUNCIONES ==========

  const loadTicketDetails = async () => {
    try {
      setIsLoadingTicket(true);
      const { data } = await api.get(`/v2/tickets/${workOrder.ticket_id}`);
      setTicket(data);
    } catch (err) {
      console.error('Error loading ticket details:', err);
    } finally {
      setIsLoadingTicket(false);
    }
  };

  const loadContactAttempts = async () => {
    try {
      setIsLoadingAttempts(true);
      const { data } = await api.get(`/v2/work-orders/${workOrder.id}/contact-attempts`);
      setContactAttempts(data);
    } catch (err) {
      console.error('Error loading contact attempts:', err);
    } finally {
      setIsLoadingAttempts(false);
    }
  };

  const handleDurationChange = (newDuration) => {
    // Validar: mínimo 5 min, máximo 480 min (8 horas)
    const clamped = Math.max(5, Math.min(480, newDuration));
    setDuration(clamped);
    setDurationChanged(clamped !== workOrder?.estimated_duration);
  };

  const saveDuration = async () => {
    if (!durationChanged) return;

    try {
      setIsSavingDuration(true);
      await api.patch(`/v2/work-orders/${workOrder.id}`, {
        estimated_duration: duration,
      });
      setDurationChanged(false);
      console.log(`✅ Duración actualizada a ${duration} minutos`);
      
      if (onDurationChange) {
        onDurationChange(duration);
      }
    } catch (err) {
      console.error('Error saving duration:', err);
      
      if (err.response?.status === 423) {
        const lockedReason = err.response?.headers?.['x-locked-reason'];
        if (lockedReason === 'LOCKED_COMPLETED') {
          alert('❌ OT completada. No se puede editar (inmutable).');
        } else if (lockedReason === 'LOCKED_PAST_DATE') {
          alert('❌ No se puede asignar a una fecha pasada.');
        } else {
          alert('❌ Operación bloqueada');
        }
      } else {
        alert('Error al guardar la duración');
      }
    } finally {
      setIsSavingDuration(false);
    }
  };

  const savePriority = async () => {
    if (!priorityChanged) return;

    try {
      setIsSavingPriority(true);
      console.log('🔧 [DEBUG] Guardando prioridad:', { 
        woId: workOrder.id, 
        priority: woPriority,
        currentStatus: workOrder.status,
        scheduledStart: workOrder.scheduled_start 
      });
      const response = await api.patch(`/v2/work-orders/${workOrder.id}`, {
        priority: woPriority,
      });
      console.log('✅ [DEBUG] Respuesta guardar prioridad:', response);
      setPriorityChanged(false);
      console.log(`✅ Prioridad actualizada a ${woPriority}`);
    } catch (err) {
      console.error('❌ [DEBUG] Error completo saving priority:', err);
      console.error('❌ [DEBUG] Error response:', err.response);
      console.error('❌ [DEBUG] Error detail:', err.response?.data?.detail);
      
      if (err.response?.status === 423) {
        alert('❌ OT completada o tiene fecha pasada. No se puede editar.');
      } else {
        const errorMsg = err.response?.data?.detail || err.message || 'Error desconocido';
        alert(`Error al guardar la prioridad: ${errorMsg}`);
      }
    } finally {
      setIsSavingPriority(false);
    }
  };

  const registerFailedAttempt = async () => {
    try {
      const { data } = await api.post(
        `/v2/work-orders/${workOrder.id}/contact-attempts`,
        {
          result: 'no_answer',
          phone_number: clientPhone || undefined,
          notes: 'Sin respuesta - Coordinador',
        }
      );
      
      setContactAttempts([data, ...contactAttempts]);
      console.log(`✅ Intento de contacto registrado`);
    } catch (err) {
      console.error('Error registering contact attempt:', err);
      alert('Error al registrar el intento de contacto');
    }
  };

  const unassignWorkOrder = async () => {
    if (!confirm('¿Devolver esta OT al backlog para recoordinar?')) {
      return;
    }

    try {
      await api.patch(`/v2/work-orders/${workOrder.id}/unassign`);
      console.log('✅ OT devuelta al backlog');
      alert('✓ OT devuelta al backlog');
      onClose();
      window.location.reload(); // Refresh para actualizar grid
    } catch (err) {
      console.error('❌ Error al desasignar OT:', err);
      alert(`Error al devolver al backlog: ${err.response?.data?.detail || err.message}`);
    }
  };

  const markAsIncomplete = async () => {
    if (!incompleteReason.trim()) {
      alert('⚠️ Ingresa una razón');
      return;
    }

    try {
      setIsMarkingIncomplete(true);
      const { data } = await api.post(
        `/v2/work-orders/${workOrder.id}/mark-incomplete`,
        { reason: incompleteReason }
      );
      
      console.log('✅ OT marcada como incompleta. Opciones:', data.options);
      alert('✓ OT marcada como incompleta\n\nOpciones: Reprogramar, Al backlog, Nueva OT');
      
      setShowIncompleteModal(false);
      setIncompleteReason('');
    } catch (err) {
      console.error('Error marking as incomplete:', err);
      alert('Error al marcar como incompleta');
    } finally {
      setIsMarkingIncomplete(false);
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return null;
    // Asumir formato argentino: agregar +54 si no lo tiene
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.startsWith('54') ? `+${cleanPhone}` : `+54${cleanPhone}`;
  };

  if (!workOrder) return null;

  const typeLabel = OT_TYPE_LABELS[workOrder.ot_type] || 'Tarea';
  const typeColor = OT_TYPE_COLORS[workOrder.ot_type] || 'bg-zinc-600';
  const hasAvailability = ticket?.availability_note;
  const clientPhone = [
    ticket?.contact_info?.phone,
    ticket?.contact_info?.mobile,
    ticket?.contact_info?.telefono,
    ticket?.contact_info?.cellphone,
    ticket?.connection_details?.phone,
    workOrder?.ticket?.contact_info?.phone,
    workOrder?.ticket?.contact_info?.mobile,
    workOrder?.ticket?.contact_info?.telefono,
    workOrder?.ticket?.contact_info?.cellphone,
    workOrder?.ticket?.connection_details?.phone,
    workOrder?.ticket_info?.contact_phone,
  ].find((value) => typeof value === 'string' && value.trim().length > 0);
  const clientName = ticket?.contact_info?.client_name || workOrder.client_name;

  // DEBUG: Ver qué datos tenemos
  console.log('🔍 CoordinationSheet Debug:', {
    workOrder_id: workOrder.id,
    ticket_id: ticket?.id,
    has_ticket: !!ticket,
    contact_info: ticket?.contact_info,
    clientPhone,
    clientName,
    full_ticket: ticket,
  });

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-96 bg-zinc-900 border-l border-zinc-800 overflow-y-auto">
        {/* ========== HEADER ========== */}
        <SheetHeader className="border-b border-zinc-800 pb-4 -mx-6 px-6 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`${typeColor} border-0 text-white`}>
                  {typeLabel}
                </Badge>
                {isLocked && (
                  <Badge className="bg-red-900/50 border border-red-700 text-red-200 flex items-center gap-1">
                    <Lock size={12} />
                    Bloqueada
                  </Badge>
                )}
                <span className="text-xs text-zinc-500">OT #{workOrder.id}</span>
              </div>
              <SheetTitle className="text-lg text-white">
                Coordinación
              </SheetTitle>
              <SheetDescription className="text-xs text-zinc-400 mt-1">
                {workOrder.address || 'Sin dirección'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ========== ALERTA SI COMPLETADA ========== */}
        {isLocked && (
          <Alert className="bg-red-900/20 border-red-700/50 mt-4">
            <Lock size={16} className="text-red-400" />
            <AlertDescription className="text-red-300">
              {lockedReason === 'completada' ? 'Orden completada. No se puede editar.' : 'Orden programada para el pasado. No se puede editar.'} Solo admin/técnico puede reabrir dentro de 2h.
            </AlertDescription>
          </Alert>
        )}

        {/* ========== CONTENIDO ========== */}
        <div className="space-y-5 py-4">
          {/* ========== TELÉFONO DESTACADO ========== */}
          {clientPhone && (
            <a
              href={`tel:${formatPhone(clientPhone)}`}
              className="block group"
            >
              <button
                disabled={isLocked}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-4 px-4 flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-emerald-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Phone size={20} className="flex-shrink-0" />
                <span className="text-base font-mono">{clientPhone}</span>
                <ChevronRight size={18} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
              </button>
            </a>
          )}

          {/* SECCIÓN 1: CLIENTE Y CONTACTO */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <User size={16} className="text-emerald-400" />
              Cliente
            </h3>

            {/* Nombre del cliente */}
            <div className="rounded-lg bg-zinc-800/30 border border-zinc-700/50 p-3">
              <p className="text-xs text-zinc-500 mb-1">Nombre</p>
              <p className="text-sm font-medium text-white">{clientName || 'N/D'}</p>
              {ticket?.connection_details?.client_dni && (
                <p className="text-xs text-zinc-400 mt-1">
                  DNI: {ticket.connection_details.client_dni}
                </p>
              )}
            </div>

            {/* Intento fallido */}
            <Button
              onClick={registerFailedAttempt}
              disabled={isLocked}
              variant="outline"
              className="w-full border-amber-700/50 text-amber-300 hover:bg-amber-950/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertTriangle size={16} className="mr-2" />
              {contactAttempts.length > 0
                ? `Reintentar (${contactAttempts.length})`
                : 'Registrar intento fallido'}
            </Button>

            {/* Historial de intentos */}
            {contactAttempts.length > 0 && (
              <div className="space-y-2 border-t border-zinc-700/50 pt-2">
                <p className="text-xs font-semibold text-zinc-400">Historial de contactos:</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {contactAttempts.slice(0, 5).map((attempt) => (
                    <div
                      key={attempt.id}
                      className="text-[10px] text-zinc-300 bg-zinc-800/30 rounded px-2 py-1 flex items-start gap-1.5"
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {attempt.result === 'no_answer' && '📵'}
                        {attempt.result === 'successful' && '✅'}
                        {attempt.result === 'busy' && '📞'}
                        {attempt.result === 'rescheduled' && '🔄'}
                        {attempt.result === 'refused' && '❌'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-mono">
                          {new Date(attempt.created_at).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </p>
                        {attempt.notes && <p className="truncate text-zinc-500">{attempt.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: CRITICIDAD/PRIORIDAD (INLINE) */}
          {ticket?.priority && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-400" />
                  Criticidad del Ticket
                </h3>
                <div className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${
                  ticket.priority === 'critical' ? 'bg-red-600' :
                  ticket.priority === 'high' ? 'bg-orange-600' :
                  ticket.priority === 'medium' ? 'bg-yellow-600' :
                  'bg-green-600'
                }`}>
                  {ticket.priority === 'critical' ? '🔴 CRÍTICA' :
                   ticket.priority === 'high' ? '🟠 ALTA' :
                   ticket.priority === 'medium' ? '🟡 MEDIA' :
                   '🟢 BAJA'}
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN 2B: PRIORIDAD DE LA ORDEN DE TRABAJO (EDITABLE) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <AlertCircle size={16} className="text-emerald-400" />
              Prioridad de la OT
            </h3>
            
            <select
              value={woPriority}
              onChange={(e) => {
                setWoPriority(e.target.value);
                setPriorityChanged(e.target.value !== workOrder?.priority);
              }}
              disabled={isLocked}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="critical">🔴 Crítica (urgencia extrema)</option>
              <option value="high">🟠 Alta (urgente hoy)</option>
              <option value="medium">🟡 Media (normal, recomendada)</option>
              <option value="low">🟢 Baja (puede esperar)</option>
            </select>

            <p className="text-xs text-zinc-400">
              Modifica la prioridad de esta orden. Puede ser diferente a la del ticket.
            </p>

            {priorityChanged && !isLocked && (
              <Button
                onClick={savePriority}
                disabled={isSavingPriority}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                {isSavingPriority ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="mr-2" />
                    Guardar prioridad
                  </>
                )}
              </Button>
            )}
          </div>

          {/* SECCIÓN 2B: DISPONIBILIDAD */}
          {hasAvailability && (
            <Alert className="border-emerald-700/50 bg-emerald-950/30">
              <Clock className="h-4 w-4 text-emerald-400" />
              <AlertDescription className="text-emerald-300 text-sm ml-2">
                <p className="font-semibold mb-1">Disponibilidad del cliente</p>
                <p className="whitespace-pre-line text-xs">
                  {ticket.availability_note}
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* SECCIÓN 3: ESTIMACIÓN DE DURACIÓN */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <Clock size={16} className="text-emerald-400" />
              Duración Estimada
            </h3>

            {/* Stepper compacto */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleDurationChange(duration - 5)}
                disabled={duration <= 5 || isLocked}
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus size={16} />
              </Button>

              {/* Input directo (sin flechas nativas) */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={isLocked}
                  value={duration}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val === '') {
                      setDuration(5);
                      setDurationChanged(true);
                    } else {
                      handleDurationChange(parseInt(val) || 5);
                    }
                  }}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-900"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">
                  min
                </span>
              </div>

              <Button
                onClick={() => handleDurationChange(duration + 5)}
                disabled={duration >= 480 || isLocked}
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
              </Button>
            </div>

            {/* Validación */}
            {duration < 5 && (
              <p className="text-xs text-red-400">⚠️ Mínimo 5 minutos</p>
            )}
            {duration > 480 && (
              <p className="text-xs text-red-400">⚠️ Máximo 8 horas (480 min)</p>
            )}

            {/* Botón guardar (si cambió y no está bloqueada) */}
            {durationChanged && !isLocked && (
              <Button
                onClick={saveDuration}
                disabled={isSavingDuration}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSavingDuration ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} className="mr-2" />
                    Guardar duración
                  </>
                )}
              </Button>
            )}

            {/* Aviso si OT completada y hay cambio */}
            {durationChanged && isLocked && (
              <div className="rounded-lg bg-red-900/20 border border-red-700/50 p-3 text-center">
                <p className="text-xs text-red-300 font-medium">🔒 OT {lockedReason}. No se puede guardar.</p>
              </div>
            )}
          </div>

          {/* SECCIÓN 4: INFORMACIÓN RÁPIDA */}
          <div className="space-y-2 pt-4 border-t border-zinc-800">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
              Detalles
            </h3>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-zinc-800/30 p-2">
                <p className="text-zinc-500 mb-1">Estado</p>
                <p className="font-medium text-white capitalize">
                  {workOrder.status?.replace('_', ' ')}
                </p>
              </div>

              <div className="rounded bg-zinc-800/30 p-2">
                <p className="text-zinc-500 mb-1">ID de Ticket</p>
                <p className="font-medium text-emerald-400">#{workOrder.ticket_id}</p>
              </div>

              {workOrder.scheduled_start && workOrder.team_id && (
                <div className="col-span-2 rounded bg-zinc-800/30 p-2">
                  <p className="text-zinc-500 mb-1">Programado</p>
                  <p className="font-medium text-white">
                    {format(parseISO(workOrder.scheduled_start), 'dd MMM HH:mm', {
                      locale: es,
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== BOTONES DE ACCIÓN SEGÚN STATUS ========== */}
        {(() => {
          const debugInfo = {
            woId: workOrder.id,
            status: workOrder.status,
            scheduledStart: workOrder.scheduled_start,
            teamId: workOrder.team_id,
            hasTeam: !!workOrder.team_id,
          };
          console.log('🔍🔍🔍 [BUTTON DEBUG] Status:', workOrder.status, '| Team:', workOrder.team_id, '| Start:', workOrder.scheduled_start);
          return null;
        })()}

        {/* BOTÓN DEVOLVER AL BACKLOG - Para OTs coordinadas (status: scheduled) */}
        {workOrder.status === 'scheduled' && workOrder.team_id && (
          <div className="border-t border-zinc-800 py-4 mt-6 space-y-3">
            <p className="text-xs text-zinc-400 font-medium">¿Recoordinar esta OT?</p>
            <Button
              onClick={unassignWorkOrder}
              disabled={isLocked}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↩️ Devolver al Backlog
            </Button>
            {isLocked && (
              <p className="text-xs text-red-400">
                🔒 OT {lockedReason}. No se puede devolver al backlog.
              </p>
            )}
          </div>
        )}

        {/* BOTÓN MARCAR INCOMPLETA - Para OTs en progreso */}
        {workOrder.status === 'in_progress' && (
          <div className="border-t border-zinc-800 py-4 mt-6 space-y-3">
            <p className="text-xs text-zinc-400 font-medium">¿Trabajo no completado?</p>
            <Button
              onClick={() => setShowIncompleteModal(true)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              📝 Marcar como Incompleta
            </Button>
          </div>
        )}

        {/* ========== FOOTER ========== */}
        <SheetFooter className="border-t border-zinc-800 pt-4 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* ========== MODAL: MARCAR COMO INCOMPLETA ========== */}
      <Sheet open={showIncompleteModal} onOpenChange={setShowIncompleteModal}>
        <SheetContent side="right" className="w-full sm:w-96 bg-zinc-900 border-l border-zinc-800">
          <SheetHeader className="border-b border-zinc-800 pb-4 -mx-6 px-6 pt-4">
            <SheetTitle className="text-lg text-white flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-500" />
              Marcar como No Realizada
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 py-6">
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Razón:</label>
              <textarea
                placeholder="Ej: Cliente no disponible, Requiere replanteo, Dirección equivocada..."
                value={incompleteReason}
                onChange={(e) => setIncompleteReason(e.target.value)}
                disabled={isMarkingIncomplete}
                className="w-full h-24 rounded-lg bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              />
            </div>

            <Alert className="bg-blue-900/20 border-blue-700/50">
              <AlertCircle size={16} className="text-blue-400" />
              <AlertDescription className="text-blue-300 text-xs">
                Después de marcar como incompleta, tendrás opciones para:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Reprogramar para otra fecha</li>
                  <li>Devolver al backlog</li>
                  <li>Crear nueva OT desde el ticket</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <SheetFooter className="border-t border-zinc-800 pt-4">
            <Button
              onClick={() => setShowIncompleteModal(false)}
              disabled={isMarkingIncomplete}
              variant="outline"
              className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <X size={16} className="mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={markAsIncomplete}
              disabled={isMarkingIncomplete || !incompleteReason.trim()}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isMarkingIncomplete ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Guardando...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Confirmar Incompleta
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Sheet>
  );
}
