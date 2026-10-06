import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import * as inventoryService from '@/services/inventory.service';
import { confirmSale, createSale } from '@/services/sales.service';

const PRODUCT_TYPES = {
  SERIALIZED: { label: 'Serializado', cls: 'text-purple-300' },
  BULK: { label: 'Bulk', cls: 'text-sky-300' },
};

export default function SaleWizard() {
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [warehouseId, setWarehouseId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  // Formulario de línea
  const [lineProductId, setLineProductId] = useState('');
  const [lineQuantity, setLineQuantity] = useState('1');
  const [lineSerial, setLineSerial] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [whs, prods] = await Promise.all([
          inventoryService.getWarehouses(),
          inventoryService.getProducts(),
        ]);
        const sellableWhs = (whs || []).filter((w) => w.type === 'CENTRAL' || w.type === 'AUXILIAR');
        setWarehouses(sellableWhs);
        setProducts(prods || []);
        if (sellableWhs.length === 1) setWarehouseId(String(sellableWhs[0].id));
      } catch (err) {
        setError('No se pudieron cargar depósitos o productos.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selectedLineProduct = useMemo(
    () => products.find((p) => String(p.id) === String(lineProductId)),
    [products, lineProductId]
  );

  const addItem = () => {
    if (!lineProductId) return;
    const product = products.find((p) => String(p.id) === String(lineProductId));
    if (!product) return;

    if (product.type === 'SERIALIZED' && !lineSerial.trim()) {
      setError('Para un producto SERIALIZED tenés que indicar el serial.');
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        product_type: product.type,
        quantity: product.type === 'SERIALIZED' ? 1 : Number(lineQuantity) || 1,
        serial_number: product.type === 'SERIALIZED' ? lineSerial.trim().toUpperCase() : null,
      },
    ]);

    setLineProductId('');
    setLineQuantity('1');
    setLineSerial('');
    setError(null);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!warehouseId) {
      setError('Seleccioná el depósito de salida.');
      return;
    }
    if (items.length === 0) {
      setError('Agregá al menos una línea a la venta.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const draft = await createSale({
        warehouse_id: Number(warehouseId),
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          serial_number: it.serial_number,
        })),
      });
      await confirmSale(draft.id);
      navigate('/app/sales');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo registrar la venta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/sales')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <h1 className="text-2xl font-bold text-emerald-300">Nueva Venta</h1>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-zinc-300 gap-3">
            <Loader className="w-6 h-6 animate-spin text-emerald-400" />
            Cargando...
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            <div className="p-4 rounded border border-zinc-800 bg-zinc-900/40 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Depósito de salida *</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Referencia (comprador, comprobante externo)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: Consumidor final - DNI 30123456"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Líneas */}
            <div className="p-4 rounded border border-zinc-800 bg-zinc-900/40">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Líneas de la venta</h2>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
                <select
                  value={lineProductId}
                  onChange={(e) => setLineProductId(e.target.value)}
                  className="sm:col-span-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                >
                  <option value="">Producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>

                {selectedLineProduct?.type !== 'SERIALIZED' ? (
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={lineQuantity}
                    onChange={(e) => setLineQuantity(e.target.value)}
                    placeholder="Cantidad"
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={lineSerial}
                    onChange={(e) => setLineSerial(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addItem()}
                    placeholder="Serial (escaneá o pegá)"
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                  />
                )}

                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              </div>

              {items.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Todavía no hay líneas.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((it, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-zinc-800/60 border border-zinc-700/50 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-zinc-200">
                          {it.product_name}{' '}
                          <span className={`text-xs font-mono ${PRODUCT_TYPES[it.product_type]?.cls || ''}`}>
                            {PRODUCT_TYPES[it.product_type]?.label}
                          </span>
                        </p>
                        <p className="text-xs text-zinc-500 font-mono">
                          {it.product_type === 'SERIALIZED'
                            ? `Serial: ${it.serial_number}`
                            : `Cantidad: ${it.quantity}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-ruby-400 hover:text-ruby-300"
                        title="Quitar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <div className="p-4 rounded border border-ruby-500/50 bg-ruby-500/10 text-ruby-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-4 h-4" />
              {submitting ? 'Registrando...' : 'Registrar venta (descontar stock)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
