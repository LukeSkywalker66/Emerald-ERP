import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, CheckCircle2, Loader, Package, Boxes } from 'lucide-react';
import * as inventoryService from '@/services/inventory.service';

const SERIAL_STATUS_OPTIONS = [
  { value: 'NEW', label: 'Nuevo (central)' },
  { value: 'IN_VEHICLE', label: 'En camioneta (móvil)' },
  { value: 'INSTALLED', label: 'Instalado en cliente' },
  { value: 'DEFECTIVE', label: 'Defectuoso' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'DECOMMISSIONED', label: 'Baja definitiva' },
  { value: 'SOLD', label: 'Vendido' },
];

function statusLabel(value) {
  return SERIAL_STATUS_OPTIONS.find((s) => s.value === value)?.label || value || '—';
}

/**
 * Reconciliación de inventario (P1).
 * Permite corregir un SerialItem (status/warehouse/connection) y corregir stock BULK
 * con delta con signo. Ambas operaciones exigen motivo y quedan auditadas.
 */
export default function InventoryReconciliation() {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Reconciliación de serial
  const [serialSearch, setSerialSearch] = useState('');
  const [serialResult, setSerialResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [serialError, setSerialError] = useState(null);
  const [serialForm, setSerialForm] = useState({
    status: '',
    warehouse_id: '',
    connection_id: '',
    clear_connection: false,
    motive: '',
  });
  const [serialSubmitting, setSerialSubmitting] = useState(false);

  // Corrección de stock BULK
  const [bulkForm, setBulkForm] = useState({
    product_id: '',
    warehouse_id: '',
    quantity_delta: '',
    motive: '',
    reference: '',
  });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [feedback, setFeedback] = useState(null); // { type, text }
  const [discrepancies, setDiscrepancies] = useState([]);

  useEffect(() => {
    inventoryService.getInventoryDiscrepancies()
      .then(setDiscrepancies)
      .catch(() => setDiscrepancies([]));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [wh, prod] = await Promise.all([
          inventoryService.getWarehouses(),
          inventoryService.getProducts(),
        ]);
        setWarehouses(wh || []);
        setProducts(prod || []);
      } catch (err) {
        setLoadError(err.response?.data?.detail || err.message || 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const bulkProducts = products.filter((p) => p.type === 'BULK');

  const handleSearchSerial = async () => {
    const serial = String(serialSearch || '').trim();
    if (!serial) return;
    setSearching(true);
    setSerialError(null);
    setSerialResult(null);
    try {
      const result = await inventoryService.searchSerialItem(serial);
      setSerialResult(result);
      setSerialForm((prev) => ({
        ...prev,
        status: result.status || '',
        warehouse_id: result.warehouse_id ? String(result.warehouse_id) : '',
        connection_id: result.connection_id ? String(result.connection_id) : '',
        clear_connection: false,
        motive: '',
      }));
    } catch (err) {
      setSerialError(err.response?.data?.detail || 'Serial no encontrado');
    } finally {
      setSearching(false);
    }
  };

  const handleSerialReconcile = async () => {
    if (!serialResult) return;
    if (!serialForm.motive || serialForm.motive.trim().length < 5) {
      setFeedback({ type: 'error', text: 'El motivo es obligatorio (mínimo 5 caracteres)' });
      return;
    }

    const payload = {
      motive: serialForm.motive.trim(),
    };
    if (serialForm.status && serialForm.status !== serialResult.status) {
      payload.status = serialForm.status;
    }
    if (serialForm.warehouse_id && parseInt(serialForm.warehouse_id, 10) !== serialResult.warehouse_id) {
      payload.warehouse_id = parseInt(serialForm.warehouse_id, 10);
    }
    if (serialForm.clear_connection) {
      payload.clear_connection = true;
    } else if (serialForm.connection_id && parseInt(serialForm.connection_id, 10) !== serialResult.connection_id) {
      payload.connection_id = parseInt(serialForm.connection_id, 10);
    }

    setSerialSubmitting(true);
    setFeedback(null);
    try {
      const updated = await inventoryService.reconcileSerialItem(serialResult.id, payload);
      setSerialResult(updated);
      setFeedback({ type: 'success', text: `Serial ${updated.serial_number} reconciliado correctamente` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Error al reconciliar serial' });
    } finally {
      setSerialSubmitting(false);
    }
  };

  const handleBulkReconcile = async () => {
    if (!bulkForm.product_id || !bulkForm.warehouse_id || bulkForm.quantity_delta === '') {
      setFeedback({ type: 'error', text: 'Completá producto, depósito y delta de cantidad' });
      return;
    }
    if (!bulkForm.motive || bulkForm.motive.trim().length < 5) {
      setFeedback({ type: 'error', text: 'El motivo es obligatorio (mínimo 5 caracteres)' });
      return;
    }

    setBulkSubmitting(true);
    setFeedback(null);
    try {
      const result = await inventoryService.reconcileStockBulk({
        product_id: parseInt(bulkForm.product_id, 10),
        warehouse_id: parseInt(bulkForm.warehouse_id, 10),
        quantity_delta: parseFloat(bulkForm.quantity_delta),
        motive: bulkForm.motive.trim(),
        reference: bulkForm.reference.trim() || null,
      });
      setFeedback({ type: 'success', text: result.message || 'Stock corregido correctamente' });
      setBulkForm({ product_id: '', warehouse_id: '', quantity_delta: '', motive: '', reference: '' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Error al corregir stock' });
    } finally {
      setBulkSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader className="text-emerald-400 animate-spin" size={40} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-rose-400" size={40} />
          <p className="text-rose-300 mb-4">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 md:px-6 py-6">
      <h1 className="text-xl font-bold text-white mb-1">Reconciliación de inventario</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Correcciones auditadas de seriales y stock a granel. Cada operación exige motivo.
      </p>

      {feedback && (
        <div
          className={`mb-4 p-3 rounded-lg border text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-200'
              : 'bg-rose-950/30 border-rose-700/50 text-rose-200'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="inline mr-2" size={16} />}
          {feedback.type === 'error' && <AlertCircle className="inline mr-2" size={16} />}
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Reconciliar serial */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Package size={16} className="text-purple-400" />
            Reconciliar serial
          </h2>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={serialSearch}
              onChange={(e) => setSerialSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSerial()}
              placeholder="Número de serie"
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white font-mono placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleSearchSerial}
              disabled={searching || !serialSearch.trim()}
              className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:bg-zinc-700 disabled:opacity-50"
            >
              {searching ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </div>

          {serialError && (
            <div className="mb-3 p-2 rounded bg-rose-950/30 border border-rose-800/50 text-xs text-rose-300">
              {serialError}
            </div>
          )}

          {serialResult && (
            <div className="space-y-3">
              <div className="p-3 rounded bg-zinc-800/50 border border-zinc-700 text-xs space-y-1">
                <p className="text-zinc-200 font-mono">{serialResult.serial_number}</p>
                <p className="text-zinc-400">Producto: {serialResult.product_name || `#${serialResult.product_id}`}</p>
                <p className="text-zinc-400">Depósito: {serialResult.warehouse_name || `#${serialResult.warehouse_id}`}</p>
                <p className="text-zinc-400">Estado: {statusLabel(serialResult.status)}</p>
                <p className="text-zinc-400">Conexión: {serialResult.connection_id || '—'}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Nuevo estado</label>
                <select
                  value={serialForm.status}
                  onChange={(e) => setSerialForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {SERIAL_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Nuevo depósito</label>
                <select
                  value={serialForm.warehouse_id}
                  onChange={(e) => setSerialForm((p) => ({ ...p, warehouse_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Sin cambio</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Conexión (ID)</label>
                <input
                  type="number"
                  value={serialForm.connection_id}
                  onChange={(e) => setSerialForm((p) => ({ ...p, connection_id: e.target.value }))}
                  placeholder="ID de la conexión"
                  disabled={serialForm.clear_connection}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
                <label className="flex items-center gap-2 mt-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={serialForm.clear_connection}
                    onChange={(e) => setSerialForm((p) => ({ ...p, clear_connection: e.target.checked }))}
                  />
                  Desvincular de la conexión
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Motivo *</label>
                <textarea
                  value={serialForm.motive}
                  onChange={(e) => setSerialForm((p) => ({ ...p, motive: e.target.value }))}
                  rows={2}
                  placeholder="Ej: ONT ya instalada en domicilio X, se corrige estado"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSerialReconcile}
                disabled={serialSubmitting}
                className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-50"
              >
                {serialSubmitting ? 'Aplicando...' : 'Aplicar reconciliación'}
              </button>
            </div>
          )}
        </div>

        {/* Corregir stock BULK */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 h-fit">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Boxes size={16} className="text-amber-400" />
            Corregir stock a granel (BULK)
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Producto (BULK)</label>
              <select
                value={bulkForm.product_id}
                onChange={(e) => setBulkForm((p) => ({ ...p, product_id: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Seleccioná un producto...</option>
                {bulkProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Depósito</label>
              <select
                value={bulkForm.warehouse_id}
                onChange={(e) => setBulkForm((p) => ({ ...p, warehouse_id: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Seleccioná un depósito...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Delta de cantidad (negativo descuenta, positivo suma)
              </label>
              <input
                type="number"
                step="0.01"
                value={bulkForm.quantity_delta}
                onChange={(e) => setBulkForm((p) => ({ ...p, quantity_delta: e.target.value }))}
                placeholder="Ej: -10 o +5"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Motivo *</label>
              <textarea
                value={bulkForm.motive}
                onChange={(e) => setBulkForm((p) => ({ ...p, motive: e.target.value }))}
                rows={2}
                placeholder="Ej: conteo físico difiere del stock"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Referencia (opcional)</label>
              <input
                type="text"
                value={bulkForm.reference}
                onChange={(e) => setBulkForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="Ej: auditoría octubre"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={handleBulkReconcile}
              disabled={bulkSubmitting}
              className="w-full py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm disabled:opacity-50"
            >
              {bulkSubmitting ? 'Aplicando...' : 'Aplicar corrección de stock'}
            </button>
          </div>
        </div>
      </div>

      {/* Discrepancias detectadas (P4) */}
      <div className="mt-6 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-400" />
          Discrepancias de inventario
          {discrepancies.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-xs">
              {discrepancies.length}
            </span>
          )}
        </h2>
        {discrepancies.length === 0 ? (
          <p className="text-xs text-zinc-500">Sin discrepancias detectadas.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {discrepancies.map((d, i) => (
              <div
                key={i}
                className={`p-2 rounded border text-xs ${
                  d.severity === 'critical'
                    ? 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                    : 'bg-amber-950/20 border-amber-800/50 text-amber-200'
                }`}
              >
                <span className="font-mono mr-2">{d.type}</span>
                {d.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
