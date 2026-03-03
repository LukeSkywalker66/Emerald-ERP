/**
 * InstallationWizard - Alta de servicio
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Loader, Search, MapPin, AlertCircle } from 'lucide-react';
import ticketsService from '@/services/tickets.service';

export default function InstallationWizard({ onBack, onSuccess, categoryId }) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [lookupPayload, setLookupPayload] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    connection: null,
    installation_tech: 'fiber',
    availabilityNote: '',
  });

  // Helper: Detectar si el query es un DNI/CUIT/CUIL válido (solo números, 7-9 o 11 dígitos)
  const isDNI = (query) => {
    const clean = query.trim();
    // DNI: 7-9 dígitos | CUIT/CUIL: 11 dígitos
    return /^\d{7,9}$/.test(clean) || /^\d{11}$/.test(clean);
  };

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

    if (!isDNI(searchQuery)) {
      setError('Para instalaciones nuevas, la búsqueda debe hacerse por DNI (7-9 dígitos), CUIT o CUIL (11 dígitos).');
      setSearchResults([]);
      setLookupPayload(null);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);

      const result = await ticketsService.lookupCustomerByDNI(searchQuery);
      if (!result) {
        setError('Cliente no encontrado en ISPCube');
        setSearchResults([]);
        setLookupPayload(null);
        return;
      }

      setLookupPayload(result);

      // Transformar resultado para UI y conservar payload crudo confirmado
      const connections = (result.connections || []).map((conn) => ({
        connection_id: Number(conn.external_id || conn.id),
        client_name: result.customer?.name,
        client_dni: result.customer?.doc_number,
        pppoe_username: conn.pppoe_username || conn.user,
        installation_address: conn.address || conn.direccion,
        plan_name: `Plan ID ${conn.plan_id || 'N/A'}`,
        node_name: `Nodo ID ${conn.node_id || 'N/A'}`,
        plan_id: conn.plan_id,
        node_id: conn.node_id,
        status: conn.status,
        raw_connection: {
          ...conn,
          id: conn.id || conn.external_id,
          user: conn.user || conn.pppoe_username,
          address: conn.address || conn.direccion,
        },
      }));

      setSearchResults(connections);
      if (connections.length > 0) {
        setStep(2);
      } else {
        setError('El cliente no tiene conexiones disponibles');
      }
    } catch (err) {
      setError(err.message || 'Error en la búsqueda');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectConnection = (conn) => {
    setFormData(p => ({ ...p, connection: conn }));
    setStep(3);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!lookupPayload?.customer || !formData.connection?.raw_connection) {
        setError('Debes confirmar cliente y conexión desde ISPCube antes de crear la instalación.');
        return;
      }

      const ticket = await ticketsService.create({
        ticket_type: 'installation',
        subject: `Instalación - ${formData.connection.client_name}`,
        description: `Nueva instalación en ${formData.connection.installation_address}`,
        priority: 'medium',
        category_id: categoryId,
        destination_connection_id: formData.connection.connection_id,
        installation_tech: formData.installation_tech,
        availability_note: formData.availabilityNote,
        customer_dni: searchQuery.trim(),
        ispcube_customer: lookupPayload.customer,
        ispcube_connections: [formData.connection.raw_connection],
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
          <h3 className="text-lg font-semibold text-white mb-2">Buscar Cliente Nuevo</h3>
          <p className="text-sm text-zinc-400">Ingresa DNI, CUIT o CUIL para consultar ISPCube en tiempo real</p>
        </div>
        {error && (
          <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="DNI, CUIT o CUIL (solo números)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <Button onClick={handleSearch} disabled={isSearching} className="bg-blue-600">
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
        <p className="text-sm text-zinc-400">Selecciona la conexión NUEVA</p>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {searchResults.map((conn) => (
            <button
              key={conn.connection_id}
              onClick={() => handleSelectConnection(conn)}
              className="w-full text-left p-4 rounded-lg border border-zinc-700 hover:border-blue-500/50 bg-zinc-800/50 hover:bg-zinc-800 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} className="text-blue-400" />
                <p className="text-sm font-medium text-white">{conn.installation_address}</p>
              </div>
              <p className="text-xs text-zinc-500">ID: {conn.connection_id} • Plan: {conn.plan_name}</p>
            </button>
          ))}
        </div>
        <div className="flex justify-between pt-4 border-t border-zinc-800">
          <Button variant="outline" onClick={() => setStep(1)} className="border-zinc-700">
            <ChevronLeft size={16} className="mr-1" />
            Buscar Otro
          </Button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Tecnología *</label>
          <select
            value={formData.installation_tech}
            onChange={(e) => setFormData(p => ({ ...p, installation_tech: e.target.value }))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
          >
            <option value="fiber">Fibra Óptica (FTTH)</option>
            <option value="wireless">Inalámbrico (Punto a Punto)</option>
            <option value="hybrid">Híbrido</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Horarios de Disponibilidad</label>
          <textarea
            value={formData.availabilityNote}
            onChange={(e) => setFormData(p => ({ ...p, availabilityNote: e.target.value }))}
            rows={2}
            placeholder="Ej: Lunes a viernes de 9 a 13hs"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
          />
        </div>
        <div className="flex justify-between pt-4 border-t border-zinc-800">
          <Button variant="outline" onClick={() => setStep(2)} className="border-zinc-700">
            <ChevronLeft size={16} className="mr-1" />
            Atrás
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600">
            {isSubmitting ? <Loader size={16} className="animate-spin mr-2" /> : null}
            Crear Instalación
          </Button>
        </div>
      </div>
    );
  }
}
