/**
 * InternalWizard - Ticket interno (infraestructura / oficina, sin conexión de cliente)
 *
 * A diferencia de los flujos de servicio, no busca cliente ni conexión. El objeto
 * de trabajo es una ubicación / activo de infraestructura: postes, fibra en calle,
 * NAP, nodo, torre, grupo electrógeno u oficina local.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Loader, AlertCircle, Building2, Wrench } from 'lucide-react';
import ticketsService from '@/services/tickets.service';

const SUBTYPES = [
  { value: 'poles', label: 'Postes', hint: 'Tendido, herrajes, reemplazo de postes' },
  { value: 'fiber_street', label: 'Fibra en calle', hint: 'Tendido, empalmes, reparación de roturas' },
  { value: 'nap', label: 'NAP / Caja de distribución', hint: 'Trabajo sobre cajas de distribución óptica' },
  { value: 'node_maintenance', label: 'Mantenimiento de nodo', hint: 'Nodos en otros edificios' },
  { value: 'tower', label: 'Mantenimiento de torre', hint: 'Estructura, anclajes, equipos' },
  { value: 'power', label: 'Grupo electrógeno', hint: 'Oficina o nodos' },
  { value: 'office', label: 'Oficina local', hint: 'Router, cámara, instalación eléctrica' },
  { value: 'other', label: 'Otra tarea interna', hint: 'Trabajo interno operativo' },
];

export default function InternalWizard({ onBack, onSuccess, categoryId }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    internal_subtype: '',
    internal_node_id: '',
    internal_location: '',
    subject: '',
    description: '',
    priority: 'medium',
  });

  const selectedSubtype = SUBTYPES.find((s) => s.value === formData.internal_subtype);

  const handleSubtypeChange = (value) => {
    const subtype = SUBTYPES.find((s) => s.value === value);
    setFormData((prev) => ({
      ...prev,
      internal_subtype: value,
      subject: subtype ? `[${subtype.label}] - ${prev.internal_location || 'trabajo interno'}` : prev.subject,
    }));
  };

  const handleLocationChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      internal_location: value,
      subject: selectedSubtype ? `[${selectedSubtype.label}] - ${value || 'trabajo interno'}` : prev.subject,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.internal_subtype) {
      setError('Seleccioná el subtipo de trabajo interno');
      return;
    }
    if (!formData.internal_location.trim()) {
      setError('Indicá la ubicación del trabajo (calle/sector, oficina, nodo, torre...)');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        ticket_type: 'internal',
        internal_subtype: formData.internal_subtype,
        internal_node_id: formData.internal_node_id
          ? parseInt(formData.internal_node_id, 10)
          : null,
        internal_location: formData.internal_location.trim(),
        subject:
          formData.subject.trim() ||
          `[${selectedSubtype.label}] - ${formData.internal_location.trim()}`,
        description: formData.description.trim() || null,
        priority: formData.priority,
        category_id: categoryId || null,
        // Explícitamente sin connection_id / customer_dni: ticket interno.
      };

      const ticket = await ticketsService.create(payload);
      onSuccess(ticket);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Error al crear ticket interno');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-3 rounded-lg border border-purple-700/40 bg-purple-950/20">
        <Wrench size={18} className="text-purple-300 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-purple-200">
          Ticket interno. No requiere cliente ni conexión. Los trabajos de campo
          (postes, fibra, NAP, nodos, torres, grupos electrógenos) generan una OT de
          infraestructura; las tareas de oficina quedan como ticket simple.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Subtipo */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Tipo de trabajo interno</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUBTYPES.map((subtype) => (
            <button
              key={subtype.value}
              type="button"
              onClick={() => handleSubtypeChange(subtype.value)}
              className={`
                text-left p-3 rounded-lg border transition-colors
                ${formData.internal_subtype === subtype.value
                  ? 'border-purple-500/70 bg-purple-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}
              `}
            >
              <p className="text-sm font-medium text-white">{subtype.label}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{subtype.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Ubicación */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Ubicación <span className="text-rose-400">*</span>
        </label>
        <Input
          placeholder="Ej: Oficina local · Calle X entre Y y Z · NAP 12 · Torre Norte · Nodo Alem"
          value={formData.internal_location}
          onChange={(e) => handleLocationChange(e.target.value)}
          className="bg-zinc-800 border-zinc-700 text-white"
        />
      </div>

      {/* Nodo (opcional) */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Nodo (opcional)</label>
        <Input
          type="number"
          placeholder="ID de nodo si el trabajo es sobre un nodo específico"
          value={formData.internal_node_id}
          onChange={(e) => setFormData((p) => ({ ...p, internal_node_id: e.target.value }))}
          className="bg-zinc-800 border-zinc-700 text-white"
        />
      </div>

      {/* Asunto */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Asunto</label>
        <Input
          placeholder="Se autocompleta según subtipo y ubicación"
          value={formData.subject}
          onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
          className="bg-zinc-800 border-zinc-700 text-white"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Descripción</label>
        <textarea
          rows="3"
          placeholder="Detalle del trabajo, materiales o consideraciones de seguridad"
          value={formData.description}
          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none text-sm"
        />
      </div>

      {/* Prioridad */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Prioridad</label>
        <select
          value={formData.priority}
          onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value }))}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between pt-2">
        <Button onClick={onBack} variant="ghost" disabled={isSubmitting} className="text-zinc-400">
          <ChevronLeft size={16} className="mr-1" /> Volver
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-500">
          {isSubmitting ? <Loader size={16} className="animate-spin" /> : <Building2 size={16} className="mr-1" />}
          Crear ticket interno
        </Button>
      </div>
    </div>
  );
}
