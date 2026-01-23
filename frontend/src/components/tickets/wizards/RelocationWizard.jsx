/**
 * RelocationWizard - Flujo de traslado/mudanza
 * filepath: frontend/src/components/tickets/wizards/RelocationWizard.jsx
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  CheckCircle,
  Loader,
  AlertCircle,
} from 'lucide-react';
import ticketsService from '@/services/tickets.service';

export default function RelocationWizard({ onBack, onSuccess, categoryId }) {
  const [step, setStep] = useState(1); // 1: Search, 2: Origin, 3: Destination, 4: Confirm
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [isLoadingReasons, setIsLoadingReasons] = useState(false);

  const [formData, setFormData] = useState({
    clientName: '',
    clientDni: '',
    originConnection: null,
    destinationConnection: null,
    availabilityNote: '',
    destinationAddress: '',
    ticket_reason_id: null,
  });

  const [destinationMode, setDestinationMode] = useState('existing'); // existing | manual

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      setError(null);
      const results = await ticketsService.searchConnections(searchQuery, { source: 'local' });

      setSearchResults(results);
      if (results.length > 0) {
        setFormData((prev) => ({
          ...prev,
          clientName: results[0].client_name,
          clientDni: results[0].client_id?.toString() || 'Sin DNI',
        }));
        setStep(2);
      } else {
        setError('No se encontraron resultados para esta búsqueda');
      }
    } catch (err) {
      setError(err.message || 'Error al buscar cliente');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectOrigin = (connection) => {
    setFormData((prev) => ({ ...prev, originConnection: connection }));
    setStep(3);
  };

  const handleSelectDestination = (connection) => {
    setError(null);
    setDestinationMode('existing');
    setFormData((prev) => ({ ...prev, destinationConnection: connection, destinationAddress: '' }));
    setStep(4);
  };

  const handleManualDestination = () => {
    const trimmedAddress = formData.destinationAddress.trim();
    if (!trimmedAddress) {
      setError('Ingresa la nueva dirección de destino');
      return;
    }
    setError(null);
    setDestinationMode('manual');
    setFormData((prev) => ({ ...prev, destinationConnection: null, destinationAddress: trimmedAddress }));
    setStep(4);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!formData.originConnection) {
        setError('Selecciona una conexión de origen');
        setIsSubmitting(false);
        return;
      }
      
      if (!formData.ticket_reason_id) {
        setError('Selecciona el motivo del traslado');
        setIsSubmitting(false);
        return;
      }

      const hasDestinationConnection = Boolean(formData.destinationConnection);
      const manualAddress = formData.destinationAddress?.trim();

      if (!hasDestinationConnection && !manualAddress) {
        setError('Selecciona una conexión de destino o ingresa una dirección manual');
        setIsSubmitting(false);
        return;
      }

      const destinationLabel = hasDestinationConnection
        ? formData.destinationConnection.installation_address
        : `Dirección manual: ${manualAddress}`;

      const availabilityNote = [
        formData.availabilityNote?.trim(),
        !hasDestinationConnection ? `Destino manual: ${manualAddress}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const selectedReason = reasons.find(r => r.id === formData.ticket_reason_id);
      const reasonLabel = selectedReason?.name || 'Traslado';

      const ticket = await ticketsService.create({
        ticket_type: 'relocation',
        subject: `[${reasonLabel}] - ${formData.clientName || 'Cliente'}`,
        description: `Traslado desde ${formData.originConnection.installation_address} hacia ${destinationLabel}`,
        priority: 'medium',
        category_id: categoryId,
        origin_connection_id: formData.originConnection.connection_id,
        destination_connection_id: hasDestinationConnection
          ? formData.destinationConnection.connection_id
          : null,
        availability_note: availabilityNote || null,
        ticket_reason_id: formData.ticket_reason_id,
      });

      onSuccess(ticket);
    } catch (err) {
      setError(err.message || 'Error al crear el ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PASO 1: Búsqueda
  if (step === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Buscar Cliente</h3>
          <p className="text-sm text-zinc-400">
            Ingresa el nombre, DNI o usuario PPPoE del cliente que desea trasladarse
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

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
            className="bg-purple-600 hover:bg-purple-500"
          >
            {isSearching ? <Loader size={16} className="animate-spin" /> : 'Buscar'}
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

  // PASO 2: Seleccionar Origen
  if (step === 2) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Conexión de Origen</h3>
          <p className="text-sm text-zinc-400">
            Selecciona la conexión ACTUAL (donde se encuentran los equipos actualmente)
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-purple-300 border-purple-500/50">
              Cliente: {formData.clientName}
            </Badge>
            <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-600">
              DNI: {formData.clientDni}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {searchResults.map((conn) => (
            <button
              key={conn.connection_id}
              onClick={() => handleSelectOrigin(conn)}
              className="w-full text-left p-4 rounded-lg border border-zinc-700 hover:border-purple-500/50 bg-zinc-800/50 hover:bg-zinc-800 transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-purple-400" />
                  <p className="text-sm font-medium text-white">
                    {conn.installation_address || 'Sin dirección'}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs bg-zinc-900/50 text-zinc-400 border-zinc-600"
                >
                  ID: {conn.connection_id}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                <span>Usuario: {conn.pppoe_username || 'N/A'}</span>
                <span>Plan: {conn.plan_name || 'N/A'}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-between pt-4 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={() => setStep(1)}
            className="border-zinc-700 text-zinc-300"
          >
            <ChevronLeft size={16} className="mr-1" />
            Buscar Otro
          </Button>
        </div>
      </div>
    );
  }

  // PASO 3: Seleccionar Destino
  if (step === 3) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Conexión de Destino</h3>
          <p className="text-sm text-zinc-400">
            Selecciona la conexión NUEVA (donde se instalarán los equipos)
          </p>
          <div className="mt-3 p-3 rounded-lg bg-purple-950/30 border border-purple-700/50">
            <p className="text-xs text-purple-300 font-medium mb-1">Origen seleccionado:</p>
            <p className="text-sm text-white">{formData.originConnection.installation_address}</p>
          </div>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {searchResults
            .filter((conn) => conn.connection_id !== formData.originConnection.connection_id)
            .map((conn) => (
              <button
                key={conn.connection_id}
                onClick={() => handleSelectDestination(conn)}
                className="w-full text-left p-4 rounded-lg border border-zinc-700 hover:border-emerald-500/50 bg-zinc-800/50 hover:bg-zinc-800 transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-400" />
                    <p className="text-sm font-medium text-white">
                      {conn.installation_address || 'Sin dirección'}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs bg-zinc-900/50 text-zinc-400 border-zinc-600"
                  >
                    ID: {conn.connection_id}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                  <span>Usuario: {conn.pppoe_username || 'N/A'}</span>
                  <span>Plan: {conn.plan_name || 'N/A'}</span>
                </div>
              </button>
            ))}

          <div className="w-full p-4 rounded-lg border border-dashed border-emerald-700/60 bg-emerald-950/10">
            <p className="text-sm text-emerald-100 font-medium mb-2 flex items-center gap-2">
              <MapPin size={16} className="text-emerald-400" />
              Ingresar dirección manual
            </p>
            <p className="text-xs text-emerald-200/80 mb-3">
              Usa esta opción si la dirección nueva aún no existe en la base local (sin conexión creada).
            </p>
            <Input
              type="text"
              placeholder="Ej: Calle 123, Ciudad, Provincia"
              value={formData.destinationAddress}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, destinationAddress: e.target.value }))
              }
              className="bg-zinc-900 border-emerald-700/60 text-white placeholder:text-emerald-200/50"
            />
            <Button
              onClick={handleManualDestination}
              className="mt-3 bg-emerald-600 hover:bg-emerald-500"
            >
              Continuar con dirección manual
            </Button>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={() => setStep(2)}
            className="border-zinc-700 text-zinc-300"
          >
            <ChevronLeft size={16} className="mr-1" />
            Cambiar Origen
          </Button>
        </div>
      </div>
    );
  }

  // PASO 4: Confirmación
  if (step === 4) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <CheckCircle size={20} className="text-emerald-400" />
            Confirmar Traslado
          </h3>
          <p className="text-sm text-zinc-400">
            Revisa los datos antes de generar el ticket y la orden de trabajo
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Resumen */}
        <div className="space-y-4">
          {/* Cliente */}
          <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Cliente</p>
            <p className="text-white font-medium">{formData.clientName}</p>
            <p className="text-sm text-zinc-400 mt-1">DNI: {formData.clientDni}</p>
          </div>

          {/* Origen → Destino */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-purple-950/20 border border-purple-700/50">
              <p className="text-xs text-purple-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                <MapPin size={12} />
                Origen (Retiro)
              </p>
              <p className="text-sm text-white">
                {formData.originConnection.installation_address}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                ID: {formData.originConnection.connection_id}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-700/50">
              <p className="text-xs text-emerald-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                <MapPin size={12} />
                Destino ({destinationMode === 'manual' ? 'Dirección manual' : 'Instalación'})
              </p>
              <p className="text-sm text-white">
                {destinationMode === 'manual'
                  ? formData.destinationAddress
                  : formData.destinationConnection.installation_address}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                {destinationMode === 'manual'
                  ? 'ID: N/A (sin conexión cargada)'
                  : `ID: ${formData.destinationConnection.connection_id}`}
              </p>
            </div>
          </div>

          {/* Horarios de disponibilidad */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Horarios de Disponibilidad (Opcional)
            </label>
            <textarea
              value={formData.availabilityNote}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, availabilityNote: e.target.value }))
              }
              rows={2}
              placeholder="Ej: Lunes a viernes de 14 a 18hs"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-sm"
            />
          </div>

          {/* Motivo del Traslado */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">Motivo del Traslado *</label>
            <select
              value={formData.ticket_reason_id || ''}
              onChange={(e) => setFormData(p => ({ ...p, ticket_reason_id: e.target.value ? parseInt(e.target.value) : null }))}
              disabled={isLoadingReasons}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
            >
              <option value="">Seleccionar motivo...</option>
              {reasons.map(reason => (
                <option key={reason.id} value={reason.id}>
                  {reason.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={() => setStep(3)}
            disabled={isSubmitting}
            className="border-zinc-700 text-zinc-300"
          >
            <ChevronLeft size={16} className="mr-1" />
            Atrás
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            {isSubmitting ? (
              <>
                <Loader size={16} className="animate-spin mr-2" />
                Creando...
              </>
            ) : (
              'Crear Traslado'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
