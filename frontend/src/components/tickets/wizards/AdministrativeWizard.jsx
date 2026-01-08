/**
 * AdministrativeWizard - Trámites administrativos
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Loader, Search, FileText, AlertCircle } from 'lucide-react';
import ticketsService from '@/services/tickets.service';

const SUBTYPES = [
  { value: 'billing', label: 'Consulta / Problema de Facturación', icon: '💳' },
  { value: 'data_update', label: 'Actualización de Datos', icon: '📝' },
  { value: 'plan_change', label: 'Cambio de Plan', icon: '🔄' },
  { value: 'other', label: 'Otro Trámite', icon: '📋' },
];

export default function AdministrativeWizard({ onBack, onSuccess }) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    connection: null,
    administrative_subtype: 'billing',
    description: '',
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setIsSearching(true);
      setError(null);
      const results = await ticketsService.searchConnections(searchQuery);
      setSearchResults(results);
      if (results.length > 0) setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectConnection = (conn) => {
    setFormData(p => ({ ...p, connection: conn }));
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      setError('Describe el trámite solicitado');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const subtypeLabel = SUBTYPES.find(s => s.value === formData.administrative_subtype)?.label || 'Trámite';
      const ticket = await ticketsService.create({
        ticket_type: 'administrative',
        subject: `${subtypeLabel} - ${formData.connection.client_name}`,
        description: formData.description,
        priority: 'medium',
        administrative_subtype: formData.administrative_subtype,
        connection_id: formData.connection.connection_id,
      });
      onSuccess(ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Búsqueda de Cliente</h3>
          <p className="text-sm text-zinc-400">Busca el cliente para el trámite</p>
        </div>
        {error && (
          <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Nombre, DNI o usuario PPPoE..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <Button onClick={handleSearch} disabled={isSearching} className="bg-amber-600">
            {isSearching ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
          </Button>
        </div>
        <div className="flex justify-between pt-4 border-t border-zinc-800">
          <Button variant="outline" onClick={onBack} className="border-zinc-700 text-zinc-300">
            <ChevronLeft size={16} className="mr-1" />
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-zinc-400">Selecciona el cliente</p>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {searchResults.map((conn) => (
            <button
              key={conn.connection_id}
              onClick={() => handleSelectConnection(conn)}
              className="w-full text-left p-3 rounded-lg border border-zinc-700 hover:border-amber-500/50 bg-zinc-800/50 hover:bg-zinc-800 transition-all"
            >
              <p className="text-sm font-medium text-white">{conn.client_name}</p>
              <p className="text-xs text-zinc-500">{conn.address} • {conn.pppoe_username}</p>
            </button>
          ))}
        </div>
        <div className="flex justify-between pt-4 border-t border-zinc-800">
          <Button variant="outline" onClick={() => setStep(1)} className="border-zinc-700">
            <ChevronLeft size={16} className="mr-1" />
            Buscar
          </Button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Tipo de Trámite *</label>
          <div className="grid grid-cols-2 gap-2">
            {SUBTYPES.map((subtype) => (
              <button
                key={subtype.value}
                onClick={() => setFormData(p => ({ ...p, administrative_subtype: subtype.value }))}
                className={`p-2 rounded-lg border text-xs text-center font-medium transition-all ${
                  formData.administrative_subtype === subtype.value
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                    : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <div className="text-lg mb-1">{subtype.icon}</div>
                {subtype.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Descripción del Trámite *</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
            rows={3}
            placeholder="Describe el trámite o consulta..."
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
          />
        </div>
        {error && (
          <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex justify-between pt-4 border-t border-zinc-800">
          <Button variant="outline" onClick={() => setStep(2)} className="border-zinc-700">
            <ChevronLeft size={16} className="mr-1" />
            Atrás
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-amber-600">
            {isSubmitting ? <Loader size={16} className="animate-spin mr-2" /> : null}
            <FileText size={16} className="mr-2" />
            Crear Trámite
          </Button>
        </div>
      </div>
    );
  }
}
