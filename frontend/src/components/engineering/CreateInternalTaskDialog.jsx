/**
 * CreateInternalTaskDialog - Formulario para crear tareas internas de ingeniería
 * 
 * Permite crear tareas de mantenimiento/proyectos que NO están asociadas a tickets.
 * Casos de uso:
 * - Mantenimiento preventivo de infraestructura
 * - Actualizaciones de firmware
 * - Proyectos de mejora interna
 * - Revisiones técnicas programadas
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { engineeringService } from '@/services/engineering.service';
import ticketsService from '@/services/tickets.service';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja', color: 'text-zinc-400' },
  { value: 'medium', label: 'Media', color: 'text-amber-300' },
  { value: 'high', label: 'Alta', color: 'text-orange-400' },
  { value: 'critical', label: 'Crítica', color: 'text-rose-400' },
];

const TASK_TYPE_OPTIONS = [
  { value: 'maintenance', label: '🔧 Mantenimiento', description: 'Tareas preventivas y correctivas' },
  { value: 'incident', label: '🚨 Incidente', description: 'Problemas reactivos urgentes' },
];

export default function CreateInternalTaskDialog({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    task_type: 'maintenance',
    assigned_to_id: null,
  });
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.title.trim() || formData.title.trim().length < 5) {
      setError('El título debe tener al menos 5 caracteres');
      return;
    }

    if (!formData.description.trim() || formData.description.trim().length < 10) {
      setError('La descripción debe tener al menos 10 caracteres');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        task_type: formData.task_type,
        assigned_to_id: formData.assigned_to_id || null,
        // NO incluir ticket_id (es una tarea interna)
      };

      const createdTask = await engineeringService.createTask(payload);

      // Resetear form
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        task_type: 'maintenance',
        assigned_to_id: null,
      });

      // Callback de éxito
      if (onSuccess) {
        onSuccess(createdTask);
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear tarea interna');
      console.error('Error creating internal task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        task_type: 'maintenance',
        assigned_to_id: null,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-white text-xl font-semibold flex items-center gap-2">
            <span className="text-2xl">🔧</span>
            Nueva Tarea Interna
          </DialogTitle>
          <p className="text-sm text-zinc-400 mt-2">
            Crea tareas de mantenimiento o proyectos que no están asociadas a tickets de clientes.
          </p>
        </DialogHeader>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 px-1">
          {error && (
            <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Tipo de Tarea */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Tipo de Tarea *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TASK_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, task_type: option.value }))}
                  className={`
                    p-3 rounded-lg border-2 transition-all text-left
                    ${
                      formData.task_type === option.value
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                    }
                  `}
                >
                  <p className="text-sm font-semibold text-white mb-1">{option.label}</p>
                  <p className="text-xs text-zinc-500">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Título de la Tarea *
            </label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
              placeholder="Ej: Actualización de firmware en routers principales"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
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
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Asignar a Ingeniero */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Asignar a Ingeniero (Opcional)
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400 py-2">
                <Loader size={14} className="animate-spin" />
                Cargando ingenieros...
              </div>
            ) : (
              <select
                value={formData.assigned_to_id || ''}
                onChange={(e) => setFormData(p => ({ ...p, assigned_to_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                disabled={isSubmitting}
              >
                <option value="">Sin asignar (irá a Backlog)</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Descripción Técnica *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe en detalle la tarea a realizar, pasos necesarios, equipos afectados, etc."
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
        <DialogFooter className="flex-shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader size={16} className="mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Tarea'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
