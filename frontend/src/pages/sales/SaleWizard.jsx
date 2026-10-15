import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import api from '@/api/client';
import BarcodeScanner from '@/components/barcode-reader/BarcodeScanner';
import ProductPicker from '@/components/inventory/ProductPicker';
import * as inventoryService from '@/services/inventory.service';
import { confirmSale, createSale, searchCustomers } from '@/services/sales.service';

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

  // Cliente / DNI dinámico
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);

  // Formulario de línea
  const [lineProductId, setLineProductId] = useState('');
  const [lineQuantity, setLineQuantity] = useState('1');
  const [lineSerial, setLineSerial] = useState('');

  // Escaneo (mismo sistema que entregas: resolve-scan valida contra la BD)
  const [scanning, setScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const scanningRef = useRef(false);

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

  // Búsqueda dinámica de cliente por DNI/nombre (debounce 300ms).
  useEffect(() => {
    const q = customerQuery.trim();
    if (q.length < 2) {
      setCustomerResults([]);
      setCustomerOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const data = await searchCustomers(q);
        setCustomerResults(Array.isArray(data) ? data : []);
        setCustomerOpen(true);
      } catch {
        setCustomerResults([]);
      } finally {
        setCustomerLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustomerQuery(c.doc_number || c.name || '');
    setCustomerResults([]);
    setCustomerOpen(false);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
    setCustomerResults([]);
    setCustomerOpen(false);
  };

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

  // Selección de item vía ProductPicker (serial individual o producto bulk).
  const handleProductSelect = (item) => {
    if (!item) return;
    const product = {
      id: item.product_id,
      name: item.product_name,
      sku: item.product_sku,
      type: item.product_type || (item.kind === 'serial' ? 'SERIALIZED' : 'BULK'),
      is_composite: item.is_composite,
      unit_measure: item.unit_measure,
      composite_unit_label: item.composite_unit_label,
      unit_size: item.unit_size,
    };
    setProducts((prev) => {
      const exists = prev.some((p) => String(p.id) === String(product.id));
      return exists ? prev : [...prev, product];
    });
    setLineProductId(String(product.id));
    if (item.kind === 'serial' && item.serial_number) {
      setLineSerial(item.serial_number);
    } else {
      setLineSerial('');
    }
    setLineQuantity('1');
    setError(null);
  };

  // Escaneo: valida contra la BD (mismo sistema que entregas a cuadrillas).
  const handleScan = async (code) => {
    if (!code || !code.trim()) return;
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setScanFeedback(null);
    try {
      const { data } = await api.get(`/v2/inventory/resolve-scan?query=${encodeURIComponent(code.trim())}`);
      if (data?.type === 'serial' && data?.product) {
        setLineProductId(String(data.product.id));
        setLineSerial(data.serial?.serial_number || code.trim().toUpperCase());
        setLineQuantity('1');
        setScanFeedback({ type: 'success', message: `Serial encontrado: ${data.product.name}` });
        setError(null);
      } else if (data?.type === 'product' && data?.product) {
        setLineProductId(String(data.product.id));
        if (data.product.is_serialized) {
          setLineSerial('');
          setScanFeedback({ type: 'info', message: `Producto serializado: ${data.product.name}. Escaneá o ingresá el serial.` });
        } else {
          setScanFeedback({ type: 'success', message: `Producto encontrado: ${data.product.name}. Indicá la cantidad.` });
        }
        setError(null);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se pudo validar el código escaneado';
      setScanFeedback({ type: 'error', message: msg });
      setLineProductId('');
      setLineSerial('');
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
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
        customer_id: selectedCustomer?.id ?? null,
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
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  DNI/CUIT del comprador
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setSelectedCustomer(null);
                    }}
                    onFocus={() => customerQuery.trim().length >= 2 && customerResults.length > 0 && setCustomerOpen(true)}
                    placeholder="Buscar cliente por DNI o nombre (opcional)..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm pr-8"
                  />
                  {customerLoading && (
                    <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-400" />
                  )}
                  {selectedCustomer && !customerLoading && (
                    <button
                      type="button"
                      onClick={clearCustomer}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                      title="Quitar cliente"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {customerOpen && customerResults.length > 0 && (
                  <div className="mt-1 bg-zinc-900 border border-zinc-700 rounded-lg max-h-48 overflow-y-auto z-10">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-800 text-sm border-b border-zinc-800/50 last:border-b-0"
                      >
                        <p className="text-white font-medium">{c.name}</p>
                        <p className="text-xs text-zinc-400">
                          {c.doc_number ? `DNI: ${c.doc_number}` : 'Sin DNI'}
                          {c.address ? ` · ${c.address}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {selectedCustomer ? (
                  <p className="mt-1 text-xs text-emerald-300">
                    Cliente identificado: {selectedCustomer.name}
                    {selectedCustomer.doc_number ? ` (${selectedCustomer.doc_number})` : ''}
                  </p>
                ) : customerQuery.trim().length >= 2 ? (
                  <p className="mt-1 text-xs text-amber-300">
                    Consumidor final / no registrado. Verificá los dígitos si creés que el cliente ya existe.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Referencia (comprobante externo)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: Factura B 0001-12345678"
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

              <BarcodeScanner
                onScan={handleScan}
                scanning={scanning}
                feedback={scanFeedback}
                placeholder="Escanear SKU o serial del producto..."
                disabled={loading}
              />

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3 mt-3">
                <div className="sm:col-span-2">
                  <ProductPicker
                    warehouseId={warehouseId || null}
                    onSelect={handleProductSelect}
                    placeholder="Buscar producto (nombre, grupo, SN o SKU)..."
                  />
                </div>

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
