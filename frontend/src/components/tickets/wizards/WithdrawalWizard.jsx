/**
 * WithdrawalWizard - Retiro de servicio
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Loader, Search, Trash2, AlertCircle } from 'lucide-react';
import ticketsService from '@/services/tickets.service';

export default function WithdrawalWizard({ onBack, onSuccess }) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);

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
    setSelectedConnection(conn);
    setStep(3);
  };

  const handleConfirmWithdrawal = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      const ticket = await ticketsService.create({
        ticket_type: 'withdrawal',
        subject: `Retiro - ${selectedConnection.client_name}`,
        description: `Retiro de servicio en ${selectedConnection.address}`,
        priority: 'medium',
        connection_id: selectedConnection.connection_id,
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
          <h3 className="text-lg font-semibold text-white mb-2">Buscar Conexión a Retirar</h3>
          <p className="text-sm text-zinc-400">Busca el cliente en la base de datos</p>
        </div>
        {error && (
          <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Nombre cliente, DNI o PPPoE..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <Button onClick={handleSearch} disabled={isSearching} className="bg-red-600">
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
        <p className="text-sm text-zinc-400">Selecciona la conexión a RETIRAR</p>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {searchResults.map((conn) => (
            <button
              key={conn.connection_id}
              onClick={() => handleSelectConnection(conn)}
              className="w-full text-left p-4 rounded-lg border border-zinc-700 hover:border-red-500/50 bg-zinc-800/50 hover:bg-zinc-800 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Trash2 size={16} className="text-red-400" />
                <p className="text-sm font-medium text-white">{conn.client_name}</p>
              </div>
              <p className="text-xs text-zinc-500">{conn.address}</p>
              <p className="text-xs text-zinc-600 mt-1">ID: {conn.connection_id} • {conn.plan_name}</p>
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
        <div className="p-4 rounded-lg bg-red-950/30 border border-red-700/50">
          <p className="text-sm font-medium text-red-200 mb-2">⚠️ Confirmar Retiro</p>
          <p className="text-sm text-red-300">
            Se retirará la conexión de <strong>{selectedConnection.client_name}</strong> en {selectedConnection.address}
          </p>
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
          <Button onClick={handleConfirmWithdrawal} disabled={isSubmitting} className="bg-red-600">
            {isSubmitting ? <Loader size={16} className="animate-spin mr-2" /> : null}
            Confirmar Retiro
          </Button>
        </div>
      </div>
    );
  }
}
