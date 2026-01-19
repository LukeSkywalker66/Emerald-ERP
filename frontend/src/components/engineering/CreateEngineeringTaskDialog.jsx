/**
 * CreateEngineeringTaskDialog - Modal para derivar ticket a NOC/Ingeniería
 * 
 * Permite crear una tarea técnica asociada al ticket actual
 */
import React, { useState } from 'react';
import { AlertCircle, Loader, X } from 'lucide-react';
import engineeringService from '../../services/engineering.service';

const PRIORIDAD_OPTIONS = [
  { value: 'low', label: 'Baja', color: 'text-zinc-400' },
  { value: 'medium', label: 'Media', color: 'text-amber-300' },
  { value: 'high', label: 'Alta', color: 'text-orange-400' },
  { value: 'critical', label: 'Crítica', color: 'text-rose-400' },
];

export default function CreateEngineeringTaskDialog({ 
  isOpen, 
  onClose, 
  ticketId, 
  ticketSubject,
  onSuccess,
}) {
  const [formData, setFormData] = useState({
    title: `Revisión técnica ticket #${ticketId}`,
    description: '',
    priority: 'medium',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.title.trim() || formData.title.trim().length < 5) {
      setError('El título debe tener al menos 5 caracteres');
      return;
    }

    if (!formData.description.trim() || formData.description.trim().length < 10) {
      setError('Describe qué debe revisar el ingeniero (mínimo 10 caracteres)');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        ticket_id: ticketId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        task_type: 'incident', // Por defecto es incident (reactivo)
      };

      const createdTask = await engineeringService.createTask(payload);

      // Resetear form
      setFormData({
        title: `Revisión técnica ticket #${ticketId}`,
        description: '',
        priority: 'medium',
      });

      // Callback de éxito
      if (onSuccess) {
        onSuccess(createdTask);
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear tarea de ingeniería');
      console.error('Error creating engineering task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      setFormData({
        title: `Revisión técnica ticket #${ticketId}`,
        description: '',
        priority: 'medium',
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-white text-xl font-semibold flex items-center gap-2">
                <span className="text-2xl">🔧</span>
                Derivar a NOC / Ingeniería
              </h2>
              <p className="text-sm text-zinc-400 mt-2">
                Se creará una tarea técnica para el equipo de ingeniería. El ticket quedará en estado{' '}
                <strong className="text-purple-300">"Esperando respuesta interna"</strong> hasta que se resuelva.
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Referencia al ticket */}
          <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-700/50">
            <p className="text-xs text-purple-300 uppercase tracking-wide mb-1">
              Ticket de origen
            </p>
            <p className="text-sm text-white font-medium">
              #{ticketId} - {ticketSubject}
            </p>
          </div>

          {/* Título de la tarea */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Título de la tarea *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
              placeholder="Ej: Revisar configuración de ruteo BGP"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              disabled={isSubmitting}
              maxLength={255}
            />
            <p className="text-xs text-zinc-500 mt-1">
              {formData.title.length}/255 caracteres
            </p>
          </div>

          {/* Prioridad */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Prioridad *
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(p => ({ ...p, priority: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              disabled={isSubmitting}
            >
              {PRIORIDAD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Descripción técnica */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Descripción técnica *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe qué debe revisar o hacer el ingeniero...&#10;&#10;Ejemplo:&#10;- Cliente reporta latencia alta (300ms)&#10;- Verificar carga en nodo&#10;- Revisar ruteo y peering&#10;- Comprobar QoS"
              rows={6}
              maxLength={1000}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {formData.description.length}/1000 caracteres (mínimo 10)
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 flex gap-2 justify-end flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader size={16} className="animate-spin" />
                Creando...
              </>
            ) : (
              'Derivar a Ingeniería'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
