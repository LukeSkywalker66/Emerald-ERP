import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, ShoppingCart, AlertCircle, Loader, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as inventoryService from '@/services/inventory.service';
import {
  BarcodeScanner,
  SerialScanner,
  ScanCounter,
  ScannedSerialsList,
} from '@/components/barcode-reader';

/**
 * Página para registrar ajustes de stock (Compras, Correcciones)
 * Formulario simple + tabla histórica de movimientos
 */
export default function StockAdjustments() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null); // { text: string, generatedSerialItemIds?: number[] }

  const [formData, setFormData] = useState({
    product_id: '',
    warehouse_id: '',
    quantity: '',
    serial_numbers: '',
    movement_type: 'PURCHASE',
    generate_barcodes: false,
    reference: '',
    notes: '',
  });

  // Scan session state (para productos SERIALIZED) - solo frontend, nada en DB
  const [scanMode, setScanMode] = useState('barcode'); // 'barcode' | 'serial'
  const [scanningProduct, setScanningProduct] = useState(null); // { product_id, product_name }
  const [scannedSerials, setScannedSerials] = useState([]);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [validatingSerial, setValidatingSerial] = useState(false);
  const scannedSerialsRef = useRef([]);
  const lastAcceptedSerialRef = useRef({ serial: null, ts: 0 });
  const warningDismissTimeoutRef = useRef(null);

  const DUPLICATE_FEEDBACK_SUPPRESSION_MS = 1200;

  useEffect(() => {
    scannedSerialsRef.current = scannedSerials;
  }, [scannedSerials]);

  const appendSerialIfNew = useCallback((rawSerial) => {
    const serial = String(rawSerial || '').trim().toUpperCase();
    if (!serial) return { status: 'invalid', serial: '' };

    const now = Date.now();
    const alreadyExists = scannedSerialsRef.current.includes(serial);

    if (alreadyExists) {
      const lastAccepted = lastAcceptedSerialRef.current;
      if (lastAccepted.serial === serial && now - lastAccepted.ts <= DUPLICATE_FEEDBACK_SUPPRESSION_MS) {
        return { status: 'suppressed', serial };
      }
      return { status: 'duplicate', serial };
    }

    const next = [...scannedSerialsRef.current, serial];
    scannedSerialsRef.current = next;
    setScannedSerials(next);
    lastAcceptedSerialRef.current = { serial, ts: now };
    return { status: 'added', serial, total: next.length };
  }, []);

  const showTransientWarning = useCallback((message) => {
    setScanFeedback({ type: 'warning', message });

    if (warningDismissTimeoutRef.current) {
      clearTimeout(warningDismissTimeoutRef.current);
    }

    warningDismissTimeoutRef.current = setTimeout(() => {
      setScanFeedback((prev) => {
        if (prev?.type === 'warning' && prev?.message === message) {
          return null;
        }
        return prev;
      });
      warningDismissTimeoutRef.current = null;
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (warningDismissTimeoutRef.current) {
        clearTimeout(warningDismissTimeoutRef.current);
      }
    };
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('📦 StockAdjustments: Iniciando carga de datos...');

        // Obtener warehouses y productos (BULK + SERIALIZED)
        const warehousesData = await inventoryService.getWarehouses();
        console.log('✅ Warehouses cargados:', warehousesData);
        setWarehouses(warehousesData || []);

        const productsData = await inventoryService.getProducts();
        console.log('✅ Productos cargados (todos los tipos):', productsData);
        setProducts(productsData || []);

        const movementsData = await inventoryService.getMovements();
        console.log('✅ Movimientos cargados:', movementsData);
        setMovements(movementsData || []);

        console.log('✅ Todos los datos cargados exitosamente');
      } catch (err) {
        console.error('❌ Error loading adjustment data:', err);
        console.error('Error status:', err.response?.status);
        console.error('Error message:', err.response?.data?.detail || err.message);
        console.error('Full error object:', err);
        
        const errorMessage = err.response?.data?.detail 
          || err.message 
          || 'No se pudieron cargar los datos. Intenta nuevamente.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === 'product_id') {
        const product = products.find((p) => p.id === parseInt(value));
        if (product?.type === 'SERIALIZED') {
          updated.movement_type = 'PURCHASE';
          updated.generate_barcodes = false;
        }
      }

      if (name === 'movement_type' && value !== 'PURCHASE' && value !== 'IN') {
        updated.generate_barcodes = false;
      }

      return updated;
    });
  };

  // ---------------------------------------------------------------
  // Scan handlers (para productos SERIALIZED)
  // ---------------------------------------------------------------
  const handleBarcodeScan = useCallback(async (code) => {
    if (!formData.product_id || !formData.warehouse_id) {
      setScanFeedback({ type: 'error', message: 'Primero seleccioná producto y almacén' });
      return;
    }

    setScanFeedback({ type: 'info', message: `Identificando: ${code}...` });

    try {
      const response = await inventoryService.scanCode({
        code,
        product_id: parseInt(formData.product_id),
        warehouse_id: parseInt(formData.warehouse_id),
      });

      if (!response.success) {
        setScanFeedback({ type: 'error', message: response.message || 'Código no reconocido' });
        return;
      }

      if (response.scan_type === 'PRODUCT_CODE') {
        if (response.is_serialized) {
          // Producto serializado: pasar a modo serial
          setScanMode('serial');
          setScanningProduct({
            product_id: response.product_id,
            product_name: response.product_name,
          });
          setScanFeedback({
            type: 'success',
            message: `${response.product_name} identificado. Escaneá el serial.`,
          });
        } else {
          // Producto BULK: mostrar como antes
          setScanFeedback({
            type: 'success',
            message: `Producto BULK detectado: ${response.product_name}. Usá el campo de cantidad.`,
          });
        }
      } else if (response.scan_type === 'SERIAL_NUMBER') {
        // Unificar criterio: validar también contra backend de serial (dup global + formato)
        const serialValidation = await inventoryService.scanSerial({
          serial_number: response.code,
          product_id: parseInt(formData.product_id),
          warehouse_id: parseInt(formData.warehouse_id),
        });

        if (!serialValidation.success) {
          setScanFeedback({
            type: 'error',
            message: serialValidation.message || `Serial ${response.code} inválido`,
          });
          return;
        }

        const localResult = appendSerialIfNew(response.code);
        if (localResult.status === 'added') {
          setScanFeedback({ type: 'success', message: `✅ Serial ${localResult.serial} registrado (${localResult.total} total)` });
          return;
        }
        if (localResult.status === 'duplicate') {
          setScanFeedback({ type: 'error', message: `Serial ${localResult.serial} ya ingresado` });
          return;
        }
        // status=suppressed: informar sin error para no pisar éxito con falso negativo
        if (localResult.status === 'suppressed') {
          showTransientWarning(`Lectura duplicada ignorada: ${localResult.serial}`);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Error al escanear';
      setScanFeedback({ type: 'error', message: msg });
    }
  }, [formData.product_id, formData.warehouse_id, showTransientWarning]);

  const handleSerialScan = useCallback(async (serial) => {
    if (!formData.product_id || !formData.warehouse_id || !scanningProduct) return;

    setValidatingSerial(true);
    setScanFeedback({ type: 'info', message: `Validando serial: ${serial}...` });

    try {
      // Solo validamos, no persistimos nada en DB
      const validation = await inventoryService.scanSerial({
        serial_number: serial,
        product_id: parseInt(formData.product_id),
        warehouse_id: parseInt(formData.warehouse_id),
      });

      if (!validation.success) {
        setScanFeedback({
          type: 'error',
          message: validation.message || `Serial ${serial} inválido`,
        });
        return;
      }

      // Dedup local con supresión de doble lectura inmediata
      const localResult = appendSerialIfNew(serial);
      if (localResult.status === 'added') {
        setScanFeedback({ type: 'success', message: `✅ Serial ${localResult.serial} registrado (${localResult.total} total)` });
        return;
      }
      if (localResult.status === 'duplicate') {
        setScanFeedback({ type: 'error', message: `Serial ${localResult.serial} ya ingresado` });
        return;
      }
      if (localResult.status === 'suppressed') {
        showTransientWarning(`Lectura duplicada ignorada: ${localResult.serial}`);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Error al validar serial';
      setScanFeedback({ type: 'error', message: msg });
    } finally {
      setValidatingSerial(false);
    }
  }, [formData.product_id, formData.warehouse_id, showTransientWarning]);

  const handleRemoveSerial = useCallback((serial) => {
    const normalized = String(serial || '').trim().toUpperCase();
    const next = scannedSerialsRef.current.filter((s) => s !== normalized);
    scannedSerialsRef.current = next;
    setScannedSerials(next);
  }, []);

  const handleResetScanSession = useCallback(() => {
    setScanMode('barcode');
    setScanningProduct(null);
    setScanFeedback(null);
    lastAcceptedSerialRef.current = { serial: null, ts: 0 };
  }, []);

  const handleConfirmScanSession = useCallback(async () => {
    if (scannedSerials.length === 0) return;

    setSubmitLoading(true);
    setError(null);

    try {
      const productId = parseInt(formData.product_id);
      const warehouseId = parseInt(formData.warehouse_id);
      const warehouse = warehouses.find((w) => w.id === warehouseId);
      const product = products.find((p) => p.id === productId);

      // Crear SerialItems uno por uno (como el flujo original)
      for (const serial of scannedSerials) {
        await inventoryService.createSerialItem({
          serial_number: serial,
          product_id: productId,
          warehouse_id: warehouseId,
          status: 'NEW',
          notes: formData.notes || formData.reference || null,
        });
      }

      setSuccessMessage({
        text: `✅ ${scannedSerials.length} equipo(s) registrado(s) en ${warehouse?.name || 'almacén'}`,
      });

      // Resetear
      setFormData({ product_id: '', warehouse_id: '', quantity: '', serial_numbers: '', movement_type: 'PURCHASE', generate_barcodes: false, reference: '', notes: '' });
      setScannedSerials([]);
      scannedSerialsRef.current = [];
      setScanMode('barcode');
      setScanningProduct(null);
      setScanFeedback(null);
      lastAcceptedSerialRef.current = { serial: null, ts: 0 };

      // Recargar movimientos (si falla, no crashea la UI)
      try {
        const updatedMovements = await inventoryService.getMovements({ limit: 20 });
        if (Array.isArray(updatedMovements)) setMovements(updatedMovements);
      } catch (movErr) {
        console.warn('No se pudieron recargar movimientos:', movErr);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
        : (Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ') : 'Error al confirmar');
      setError(String(msg));
    } finally {
      setSubmitLoading(false);
    }
  }, [scannedSerials.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (!formData.product_id || !formData.warehouse_id) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    const product = products.find((p) => p.id === parseInt(formData.product_id));
    const warehouse = warehouses.find((w) => w.id === parseInt(formData.warehouse_id));

    if (!product) {
      setError('Selecciona un producto válido.');
      return;
    }

    const isSerialized = product.type === 'SERIALIZED';
    let submissionOk = false;

    if (isSerialized) {
      // Usar scannedSerials del escaneo inteligente
      const serials = scannedSerials.length > 0
        ? scannedSerials
        : (formData.serial_numbers || '').split(/\n|,/).map(s => s.trim()).filter(Boolean);

      if (serials.length === 0) {
        setError('Ingresa al menos un número de serie.');
        return;
      }

      try {
        setSubmitLoading(true);
        setError(null);

        for (const serial of serials) {
          await inventoryService.createSerialItem({
            serial_number: serial,
            product_id: parseInt(formData.product_id),
            warehouse_id: parseInt(formData.warehouse_id),
            status: 'NEW',
            notes: formData.notes || formData.reference || null,
          });
        }

        setSuccessMessage({
          text: `✅ ${serials.length} equipo(s) registrado(s) en ${warehouse?.name || 'almacén'}`,
        });
        // Resetear escaneo
        setScannedSerials([]);
        scannedSerialsRef.current = [];
        setScanMode('barcode');
        setScanningProduct(null);
        setScanFeedback(null);
        lastAcceptedSerialRef.current = { serial: null, ts: 0 };
        submissionOk = true;
      } catch (err) {
        console.error('Error registrando seriales:', err);
        const errorMsg =
          err.response?.data?.detail ||
          err.message ||
          'Error al registrar los seriales. Intenta nuevamente.';
        setError(errorMsg);
      } finally {
        setSubmitLoading(false);
      }
    } else {
      if (!formData.quantity) {
        setError('Por favor completa la cantidad.');
        return;
      }

      if (parseInt(formData.quantity) <= 0) {
        setError('La cantidad debe ser mayor a 0.');
        return;
      }

      try {
        setSubmitLoading(true);
        setError(null);

        // La cantidad ingresada ya viaja como unidades del stock del producto.
        const finalQty = parseFloat(formData.quantity);

        const result = await inventoryService.adjustStock({
          product_id: parseInt(formData.product_id),
          warehouse_id: parseInt(formData.warehouse_id),
          quantity: finalQty,
          movement_type: formData.movement_type,
          generate_barcodes: Boolean(formData.generate_barcodes),
          reference: formData.reference || null,
          notes: formData.notes || null,
        });

        const typeLabel = formData.movement_type === 'PURCHASE' ? 'Compra' : 'Ajuste';
        const generatedSerialIds = Array.isArray(result?.generated_serial_item_ids)
          ? result.generated_serial_item_ids
          : [];
        const generatedTotal = Number(result?.tracked_units_created || generatedSerialIds.length || 0);

        setSuccessMessage({
          text: generatedTotal > 0
            ? `✅ ${typeLabel} serializada correctamente. ${generatedTotal} etiqueta(s) listas para imprimir.`
            : `✅ ${typeLabel} registrada correctamente. ID: ${result.movement_id}`,
          generatedSerialItemIds: generatedSerialIds,
        });
        submissionOk = true;
      } catch (err) {
        console.error('Error submitting adjustment:', err);
        const errorMsg =
          err.response?.data?.detail ||
          err.message ||
          'Error al registrar el ajuste. Intenta nuevamente.';
        setError(errorMsg);
      } finally {
        setSubmitLoading(false);
      }
    }

    if (!submissionOk) return;

    // Resetear formulario
    setFormData({
      product_id: '',
      warehouse_id: '',
      quantity: '',
      serial_numbers: '',
      movement_type: 'PURCHASE',
      generate_barcodes: false,
      reference: '',
      notes: '',
    });

    // Recargar movimientos
    try {
      const updatedMovements = await inventoryService.getMovements({ limit: 20 });
      if (Array.isArray(updatedMovements)) setMovements(updatedMovements);
    } catch (e) { console.warn('No se pudieron recargar movimientos:', e); }

    // Limpiar mensaje después de 5s
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const getMovementBadge = (type) => {
    const badges = {
      PURCHASE: {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        label: '🛒 Compra',
      },
      ADJUSTMENT: {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        label: '⚙️ Ajuste',
      },
    };
    return badges[type] || badges.ADJUSTMENT;
  };

  const selectedProduct = products.find(
    (p) => p.id === parseInt(formData.product_id)
  );
  const selectedWarehouse = warehouses.find(
    (w) => w.id === parseInt(formData.warehouse_id)
  );
  const isSerialized = selectedProduct?.type === 'SERIALIZED';
  const canGenerateBarcodes = !isSerialized
    && selectedProduct?.is_composite
    && (formData.movement_type === 'PURCHASE' || formData.movement_type === 'IN');
  const getDisplayUnit = (product) => {
    if (!product) return 'u.';
    if (product.is_composite) {
      return product.composite_unit_label || 'u.';
    }
    return product.unit_measure || 'u.';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 text-emerald-400 animate-spin" />
          <p className="text-zinc-300">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Plus className="w-8 h-8 text-emerald-400" />
            <h1 className="text-4xl font-bold text-white">
              Ajustes y Compras de Stock
            </h1>
          </div>
          <p className="text-zinc-400">
            Registra nuevas compras o correcciones de stock a granel
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6 text-emerald-400">
                Nuevo Ajuste
              </h2>

              {error && (
                <div className="mb-4 p-4 bg-ruby-500/20 border border-ruby-500/50 rounded-lg flex gap-3 text-ruby-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 text-sm space-y-3">
                  <p>{successMessage.text}</p>

                  {Array.isArray(successMessage.generatedSerialItemIds) && successMessage.generatedSerialItemIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const idsCsv = successMessage.generatedSerialItemIds.join(',');
                        navigate(`/app/logistics/print-labels?serial_item_ids=${encodeURIComponent(idsCsv)}`);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      🖨️ Imprimir Etiquetas Ahora
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Producto */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Producto *
                  </label>
                  <select
                    name="product_id"
                    value={formData.product_id}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecciona un producto...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                  {selectedProduct && (
                    <div className="text-xs text-zinc-400 mt-2 space-y-1">
                      <p>Categoría: {selectedProduct.category}</p>
                      {selectedProduct.is_composite && (
                        <p className="text-emerald-400">
                          Producto compuesto: ingresá cantidades en {getDisplayUnit(selectedProduct)}.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Warehouse */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Almacén Destino *
                  </label>
                  <select
                    name="warehouse_id"
                    value={formData.warehouse_id}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecciona un almacén...</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cantidad / Escaneo Inteligente */}
                {isSerialized ? (
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Escaneo de Seriales
                    </label>

                    {/* Contador */}
                    <ScanCounter
                      count={scannedSerials.length}
                      productName={selectedProduct?.name}
                    />

                    {/* Serial scanner o Barcode scanner */}
                    {scanMode === 'serial' && scanningProduct ? (
                      <SerialScanner
                        productName={scanningProduct.product_name}
                        productSku={selectedProduct?.sku}
                        onScan={handleSerialScan}
                        onCancel={handleResetScanSession}
                        validating={validatingSerial}
                      />
                    ) : (
                      <BarcodeScanner
                        onScan={handleBarcodeScan}
                        disabled={false}
                        placeholder="Escanear código de barra o serial..."
                        feedback={scanFeedback}
                        scanning={validatingSerial}
                      />
                    )}

                    {/* Lista de seriales escaneados */}
                    {scannedSerials.length > 0 && (
                      <ScannedSerialsList
                        serials={scannedSerials}
                        onRemove={handleRemoveSerial}
                      />
                    )}

                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Cantidad * {selectedProduct?.is_composite ? `(${getDisplayUnit(selectedProduct)})` : ''}
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="1"
                      step="1"
                      placeholder="Ingresa cantidad"
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {/* Tipo de Movimiento */}
                {!isSerialized ? (
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Tipo de Movimiento
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="movement_type"
                          value="PURCHASE"
                          checked={formData.movement_type === 'PURCHASE'}
                          onChange={handleInputChange}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">🛒 Compra</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="movement_type"
                          value="ADJUSTMENT"
                          checked={formData.movement_type === 'ADJUSTMENT'}
                          onChange={handleInputChange}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">⚙️ Ajuste</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-800/60 border border-emerald-600/40 rounded">
                    <p className="text-sm text-emerald-300 font-medium">Producto serializado</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      El alta de seriales se registra como compra automática. Ingresa los números de serie y los enviaremos al almacén seleccionado.
                    </p>
                  </div>
                )}

                {canGenerateBarcodes && (
                  <div className="p-3 rounded border border-emerald-600/40 bg-zinc-800/60">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="generate_barcodes"
                        checked={Boolean(formData.generate_barcodes)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData((prev) => ({ ...prev, generate_barcodes: checked }));
                        }}
                        className="mt-0.5 w-4 h-4"
                      />
                      <span>
                        <span className="text-sm text-emerald-300 font-semibold">
                          ¿Generar códigos de barra individuales?
                        </span>
                        <span className="block text-xs text-zinc-400 mt-1">
                          En compras de compuestos, crea unidades trazables con etiqueta en lugar de incrementar stock bulk.
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                {/* Referencia */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Referencia (ej: PO-2025-123)
                  </label>
                  <input
                    type="text"
                    name="reference"
                    value={formData.reference}
                    onChange={handleInputChange}
                    placeholder="Número de orden, factura, etc."
                    maxLength="200"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Notas (opcional)
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Información adicional..."
                    rows="3"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm resize-none"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        product_id: '', warehouse_id: '', quantity: '',
                        serial_numbers: '', movement_type: 'PURCHASE',
                        generate_barcodes: false,
                        reference: '', notes: '',
                      });
                      setScannedSerials([]);
                      scannedSerialsRef.current = [];
                      setScanMode('barcode');
                      setScanningProduct(null);
                      setScanFeedback(null);
                      lastAcceptedSerialRef.current = { serial: null, ts: 0 };
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    disabled={submitLoading}
                    className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-semibold rounded transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:opacity-50 text-white font-semibold rounded transition-colors flex items-center justify-center gap-2"
                  >
                    {submitLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        {formData.movement_type === 'PURCHASE' ? 'Registrar Compra' : 'Registrar Ajuste'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Tabla de Histórico */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6 text-emerald-400">
                Últimos Ajustes (20 registros)
              </h2>

              {movements.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">
                    No hay ajustes registrados aún
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-zinc-700">
                      <tr className="text-zinc-400">
                        <th className="text-left py-3 px-3 font-semibold">
                          Tipo
                        </th>
                        <th className="text-left py-3 px-3 font-semibold">
                          Producto
                        </th>
                        <th className="text-left py-3 px-3 font-semibold">
                          Almacén
                        </th>
                        <th className="text-right py-3 px-3 font-semibold">
                          Cantidad / Serial
                        </th>
                        <th className="text-left py-3 px-3 font-semibold">
                          Referencia
                        </th>
                        <th className="text-left py-3 px-3 font-semibold">
                          Fecha
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => {
                        const badge = getMovementBadge(movement.movement_type);
                        const moveDate = movement.date
                          ? new Date(movement.date).toLocaleDateString('es-AR')
                          : '-';

                        return (
                          <tr
                            key={movement.id}
                            className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition-colors"
                          >
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${badge.bg} ${badge.text}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-col">
                                <span className="text-white font-medium">
                                  {movement.product?.name}
                                </span>
                                <span className="text-zinc-400 text-xs">
                                  {movement.product?.sku}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-zinc-300">
                              {movement.to_warehouse?.name}
                            </td>
                            <td className="py-3 px-3 text-right font-mono">
                              {movement.serial_number ? (
                                <div className="text-right">
                                  <span className="text-emerald-400 block">1 u</span>
                                  <span className="text-zinc-400 text-xs">Serial: {movement.serial_number}</span>
                                </div>
                              ) : (
                                <span className="text-emerald-400">
                                  +{movement.quantity}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-zinc-400 text-xs">
                              {movement.reference || '-'}
                            </td>
                            <td className="py-3 px-3 text-zinc-400 text-xs">
                              {moveDate}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
