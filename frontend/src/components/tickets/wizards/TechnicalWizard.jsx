/**
 * TechnicalWizard - Soporte técnico
 * filepath: frontend/src/components/tickets/wizards/TechnicalWizard.jsx
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Loader, Search, AlertCircle } from 'lucide-react';
import ticketsService from '@/services/tickets.service';

export default function TechnicalWizard({ onBack, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    connection_id: null,
    connection: null,
    subject: '',
    description: '',
    priority: 'medium',
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      setError(null);
      // Simular búsqueda en ISPCube (en producción sería via API)
      const results = [
        { connection_id: 1, client_name: 'Cliente Test 1', installation_address: 'Calle 1 #123', pppoe_username: 'test1' },
        { connection_id: 2, client_name: 'Cliente Test 2', installation_address: 'Calle 2 #456', pppoe_username: 'test2' },
      ].filter(r => r.client_name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      setSearchResults(results);
    } catch (err) {
      setError(err.message || 'Error al buscar');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectConnection = (conn) => {
    setFormData(p => ({ ...p, connection_id: conn.connection_id, connection: conn }));
    setSearchResults([]);
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
        connection_id: formData.connection_id,
      });
      
      onSuccess(ticket);
    } catch (err) {
      setError(err.message || 'Error al crear el ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = formData.connection_id && formData.subject.trim().length >= 3;

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
            <p className="text-sm text-zinc-400 mt-1">{formData.connection.installation_address}</p>
            <button
              onClick={() => setFormData(p => ({ ...p, connection_id: null, connection: null }))}
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
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
