/**
 * TechnicalWizard - Soporte técnico
 * filepath: frontend/src/components/tickets/wizards/TechnicalWizard.jsx
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Loader, Search, AlertCircle, MapPin } from 'lucide-react';
import ticketsService from '@/services/tickets.service';

export default function TechnicalWizard({ onBack, onSuccess, categoryId }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [isLoadingReasons, setIsLoadingReasons] = useState(false);
  
  const [formData, setFormData] = useState({
    connection_id: null,
    connection: null,
    ticket_reason_id: null,
    subject: '',
    description: '',
    priority: 'medium',
  });

  // Cargar motivos al montar el componente
  useEffect(() => {
    if (!categoryId) return;
    
    const loadReasons = async () => {
      try {
        setIsLoadingReasons(true);
        const data = await ticketsService.getReasons(categoryId);
        setReasons(data);
      } catch (err) {
        console.error('Error cargando motivos:', err);
      } finally {
        setIsLoadingReasons(false);
      }
    };
    
    loadReasons();
  }, [categoryId]);

  // Auto-search con debounce de 500ms
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      setError(null);
      
      const response = await ticketsService.searchConnections(searchQuery);
      setSearchResults(response);
      
      if (response.length === 0) {
        setError('No se encontraron conexiones');
      }
    } catch (err) {
      setError(err.message || 'Error al buscar');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectConnection = (conn) => {
    setFormData(p => {
      // Si ya hay motivo seleccionado, generar asunto automático
      const selectedReason = reasons.find(r => r.id === p.ticket_reason_id);
      const autoSubject = selectedReason 
        ? `[${selectedReason.name}] - ${conn.client_name}`
        : p.subject || `Reclamo - ${conn.client_name}`;
      
      return {
        ...p,
        connection_id: conn.connection_id,
        connection: conn,
        subject: autoSubject
      };
    });
    setSearchResults([]);
  };
  
  const handleReasonChange = (reasonId) => {
    setFormData(p => {
      const selectedReason = reasons.find(r => r.id === parseInt(reasonId));
      const autoSubject = selectedReason && p.connection
        ? `[${selectedReason.name}] - ${p.connection.client_name}`
        : p.subject;
      
      return {
        ...p,
        ticket_reason_id: reasonId ? parseInt(reasonId) : null,
        subject: autoSubject
      };
    });
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      const ticket = await ticketsService.create({
        ticket_type: 'technical',
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority,
        category_id: categoryId,
        connection_id: formData.connection_id,
        ticket_reason_id: formData.ticket_reason_id || undefined,
      });
      
      onSuccess(ticket);
    } catch (err) {
      setError(err.message || 'Error al crear el ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = formData.connection_id && formData.ticket_reason_id && formData.subject.trim().length >= 3;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-zinc-300 block mb-2">Cliente/Conexión *</label>
        {formData.connection ? (
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-700/50">
            <p className="text-white font-medium">{formData.connection.client_name}</p>
            <div className="flex items-center gap-1 text-sm text-zinc-400 mt-1">
              <MapPin size={14} className="text-emerald-400" />
              <span>{formData.connection.installation_address}</span>
            </div>
            <button
              onClick={() => setFormData(p => ({ ...p, connection_id: null, connection: null, subject: '', ticket_reason_id: null }))}
              className="text-xs text-emerald-300 hover:text-emerald-200 mt-2"
            >
              Cambiar cliente
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type="text"
                placeholder="Buscar por nombre, DNI o PPPoE..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {isSearching ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
            </Button>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
            {searchResults.map((conn) => (
              <button
                key={conn.connection_id}
                onClick={() => handleSelectConnection(conn)}
                className="w-full text-left p-2 rounded-lg border border-zinc-700 hover:border-emerald-500/50 bg-zinc-800/50 hover:bg-zinc-800 transition-all text-sm"
              >
                <p className="text-white font-medium">{conn.client_name}</p>
                <p className="text-xs text-zinc-400">{conn.installation_address}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-300 block mb-2">Motivo *</label>
        <select
          value={formData.ticket_reason_id || ''}
          onChange={(e) => handleReasonChange(e.target.value)}
          disabled={isLoadingReasons}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
        >
          <option value="">Seleccionar motivo...</option>
          {reasons.map(reason => (
            <option key={reason.id} value={reason.id}>
              {reason.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-300 block mb-2">Asunto *</label>
        <Input
          value={formData.subject}
          onChange={(e) => setFormData(p => ({ ...p, subject: e.target.value }))}
          placeholder="Ej: Sin internet, latencia alta..."
          className="bg-zinc-800 border-zinc-700 text-white"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-300 block mb-2">Descripción</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
          rows={3}
          placeholder="Detalles del problema..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-300 block mb-2">Prioridad</label>
        <select
          value={formData.priority}
          onChange={(e) => setFormData(p => ({ ...p, priority: e.target.value }))}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
      </div>

      <div className="flex justify-between pt-4 border-t border-zinc-800">
        <Button variant="outline" onClick={onBack} className="border-zinc-700 text-zinc-300">
          <ChevronLeft size={16} className="mr-1" />
          Volver
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !isValid}
          className="bg-emerald-600 hover:bg-emerald-500"
        >
          {isSubmitting ? <Loader size={16} className="animate-spin mr-2" /> : null}
          Crear Ticket
        </Button>
      </div>
    </div>
  );
}
