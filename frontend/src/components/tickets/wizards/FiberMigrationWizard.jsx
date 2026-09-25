/**
 * FiberMigrationWizard - Pase a Fibra (migración de tecnología).
 *
 * A diferencia de la instalación, NO busca conexiones nuevas: el operador
 * selecciona la CONEXIÓN EXISTENTE del cliente que se va a migrar de aire a
 * fibra. Incluye el flag de retiro del equipo de aire (antena/radio).
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Search, MapPin, AlertCircle, Loader, Cable } from 'lucide-react';
import ticketsService from '@/services/tickets.service';

export default function FiberMigrationWizard({ onBack, onSuccess, categoryId }) {
  const [step, setStep] = useState(1); // 1: búsqueda, 2: confirmación
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [removeAirEquipment, setRemoveAirEquipment] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const results = await ticketsService.searchConnections(searchQuery.trim(), { source: 'local' });
      setSearchResults(results || []);
      if (!results || results.length === 0) {
        setError('No se encontraron conexiones para esa búsqueda.');
      }
    } catch (err) {
      setError(err.message || 'Error al buscar conexiones');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (conn) => {
    setSelectedConnection(conn);
    setError(null);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedConnection) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const equipmentNote = removeAirEquipment
        ? 'Retirar antena/equipo de aire instalado.'
        : null;

      await ticketsService.create({
        ticket_type: 'fiber_migration',
        subject: `Pase a Fibra - ${selectedConnection.client_name}`,
        description: `Migración a fibra óptica de la conexión existente (${
          selectedConnection.pppoe_username || `#${selectedConnection.connection_id}`
        }). ${equipmentNote || ''}`,
        priority: 'medium',
        category_id: categoryId,
        connection_id: selectedConnection.connection_id,
        installation_tech: 'fiber',
        availability_note: equipmentNote,
      });

      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error al crear el pase a fibra');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Buscar conexión a migrar</h3>
          <p className="text-sm text-zinc-400">
            Busca la conexión EXISTENTE del cliente que pasará de aire a fibra (por nombre, DNI, usuario o dirección).
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Nombre, DNI, usuario PPPoE o dirección..."
            className="flex-1 bg-zinc-800 border-zinc-700 text-white"
          />
          <Button type="button" onClick={handleSearch} disabled={isSearching} className="bg-emerald-600 hover:bg-emerald-700">
            {isSearching ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
          </Button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {searchResults.map((conn) => (
            <button
              key={conn.connection_id}
              type="button"
              onClick={() => handleSelect(conn)}
              className="w-full text-left p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 hover:border-emerald-500/60 hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{conn.client_name}</p>
                  <p className="text-xs text-zinc-400 truncate">{conn.installation_address}</p>
                  {conn.pppoe_username && (
                    <p className="text-xs text-zinc-500 font-mono">PPPoE: {conn.pppoe_username}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-start pt-2">
          <Button type="button" variant="outline" onClick={onBack} className="gap-2">
            <ChevronLeft size={16} />
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Confirmar pase a fibra</h3>
        <p className="text-sm text-zinc-400">Verificá la conexión y confirmá la migración.</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-800/50 space-y-2">
        <p className="text-sm font-medium text-white">{selectedConnection?.client_name}</p>
        <p className="text-xs text-zinc-400 flex items-center gap-2">
          <Cable size={14} className="text-emerald-400" />
          {selectedConnection?.installation_address}
        </p>
        {selectedConnection?.pppoe_username && (
          <p className="text-xs text-zinc-500 font-mono">PPPoE: {selectedConnection.pppoe_username}</p>
        )}
        <p className="text-xs text-zinc-500">Conexión #{selectedConnection?.connection_id}</p>
      </div>

      <label className="flex items-center gap-3 p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 cursor-pointer">
        <input
          type="checkbox"
          checked={removeAirEquipment}
          onChange={(e) => setRemoveAirEquipment(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        <span className="text-sm text-zinc-200">
          Retirar antena/equipo de aire instalado
        </span>
      </label>

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-2">
          <ChevronLeft size={16} />
          Volver
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isSubmitting ? 'Creando...' : 'Confirmar pase a fibra'}
        </Button>
      </div>
    </div>
  );
}
