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
    // Validar: mínimo 15 min, máximo 480 min (8 horas)
    const clamped = Math.max(15, Math.min(480, newDuration));
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
      alert('Error al guardar la duración');
    } finally {
      setIsSavingDuration(false);
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
      
      // Actualizar lista de intentos
      setContactAttempts([data, ...contactAttempts]);
      console.log(`✅ Intento de contacto registrado`);
    } catch (err) {
      console.error('Error registering contact attempt:', err);
      alert('Error al registrar el intento de contacto');
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
  const clientPhone = ticket?.contact_info?.phone;
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

        {/* ========== CONTENIDO ========== */}
        <div className="space-y-5 py-4">
          {/* ========== TELÉFONO DESTACADO ========== */}
          {clientPhone && (
            <a
              href={`tel:${formatPhone(clientPhone)}`}
              className="block group"
            >
              <button
                className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-4 px-4 flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-emerald-600/50"
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
              variant="outline"
              className="w-full border-amber-700/50 text-amber-300 hover:bg-amber-950/30"
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
                  Criticidad
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

            {/* Display actual */}
            <div className="rounded-lg bg-zinc-800/30 border border-zinc-700/50 p-3">
              <p className="text-xs text-zinc-500 mb-2">Tiempo estimado</p>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-emerald-400">
                  {duration}
                  <span className="text-xs text-zinc-400 ml-1">min</span>
                </div>
                <div className="text-xs text-zinc-400">
                  {Math.floor(duration / 60)}h{duration % 60 ? ` ${duration % 60}m` : ''}
                </div>
              </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleDurationChange(duration - 15)}
                disabled={duration <= 15}
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 border-zinc-700 text-zinc-400"
              >
                <Minus size={16} />
              </Button>

              {/* Input directo */}
              <input
                type="number"
                value={duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value) || 60)}
                min="15"
                max="480"
                step="15"
                className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <Button
                onClick={() => handleDurationChange(duration + 15)}
                disabled={duration >= 480}
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 border-zinc-700 text-zinc-400"
              >
                <Plus size={16} />
              </Button>
            </div>

            {/* Validación */}
            {duration < 15 && (
              <p className="text-xs text-red-400">Mínimo 15 minutos</p>
            )}
            {duration > 480 && (
              <p className="text-xs text-red-400">Máximo 8 horas (480 min)</p>
            )}

            {/* Botón guardar (si cambió) */}
            {durationChanged && (
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

              {workOrder.scheduled_start && (
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
    </Sheet>
  );
}
