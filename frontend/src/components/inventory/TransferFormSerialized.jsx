import React, { useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';

/**
 * Componente Helper para Transferencias SERIALIZED
 * Permite seleccionar seriales específicos mediante checkboxes
 */
export default function TransferFormSerialized({
  product,
  sourceWarehouse,
  serialItems,
  onSubmit,
  isLoading = false,
}) {
  const [selectedSerials, setSelectedSerials] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  // Filtrar seriales por búsqueda
  const filteredSerials = serialItems.filter((item) =>
    item.serial_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleSerial = (serialId) => {
    setSelectedSerials((prev) => {
      if (prev.includes(serialId)) {
        return prev.filter((id) => id !== serialId);
      } else {
        return [...prev, serialId];
      }
    });
    setError(null);
  };

  const handleSelectAll = () => {
    if (selectedSerials.length === serialItems.length) {
      setSelectedSerials([]);
    } else {
      setSelectedSerials(serialItems.map((item) => item.id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (selectedSerials.length === 0) {
      setError('Debes seleccionar al menos 1 serial para transferir');
      return;
    }

    onSubmit({
      quantity: null, // SERIALIZED no usa cantidad numérica
      serial_item_ids: selectedSerials,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info del Producto */}
      <div className="bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
        <p className="text-sm text-zinc-400">Producto Seleccionado</p>
        <p className="text-lg font-semibold text-white">{product.name}</p>
        <p className="text-sm text-zinc-400 mt-2">
          SKU: <span className="font-mono text-emerald-400">{product.sku}</span>
        </p>
        <p className="text-sm text-emerald-400 mt-2">
          Tipo: <span className="font-semibold">Serializado</span>
        </p>
      </div>

      {/* Info del Almacén Origen */}
      <div className="bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
        <p className="text-sm text-zinc-400">Almacén Origen</p>
        <p className="text-lg font-semibold text-white">
          {sourceWarehouse.name}
        </p>
        <p className="text-sm text-emerald-400 mt-2">
          Seriales Disponibles:{' '}
          <span className="text-2xl font-bold">{serialItems.length}</span>
        </p>
      </div>

      {/* Búsqueda de Seriales */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Buscar Serial
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filtra por número de serial..."
          className="w-full bg-zinc-700 border border-zinc-600 rounded px-4 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Botones de Selección Rápida */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSelectAll}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded text-sm font-medium transition-colors"
        >
          {selectedSerials.length === serialItems.length
            ? 'Deseleccionar Todos'
            : 'Seleccionar Todos'}
        </button>
      </div>

      {/* Lista de Seriales */}
      {serialItems.length === 0 ? (
        <div className="text-center py-8 bg-zinc-700/20 rounded-lg">
          <p className="text-zinc-400">
            No hay seriales disponibles en este almacén
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto bg-zinc-700/20 p-4 rounded-lg">
          {filteredSerials.map((serial) => (
            <label
              key={serial.id}
              className="flex items-center gap-3 p-2 hover:bg-zinc-700/30 rounded cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedSerials.includes(serial.id)}
                onChange={() => handleToggleSerial(serial.id)}
                className="w-4 h-4 rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white font-mono text-sm">
                  {serial.serial_number}
                </p>
                {serial.notes && (
                  <p className="text-xs text-zinc-400 truncate">
                    {serial.notes}
                  </p>
                )}
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                  serial.status === 'NEW'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-600/50 text-zinc-300'
                }`}
              >
                {serial.status}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Contador de Seleccionados */}
      <div className="text-sm text-zinc-400 text-center">
        {selectedSerials.length} de {serialItems.length} seriales seleccionados
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-ruby-500/20 border border-ruby-500/50 rounded-lg flex gap-2 text-ruby-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={selectedSerials.length === 0 || isLoading}
        className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:opacity-50 text-white font-semibold py-2 rounded transition-colors flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        {isLoading ? 'Procesando...' : 'Siguiente'}
      </button>
    </form>
  );
}
