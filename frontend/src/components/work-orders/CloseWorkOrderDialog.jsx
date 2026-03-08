import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Paperclip, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import api from '@/api/client';
import * as inventoryService from '@/services/inventory.service';
import workOrdersService from '@/services/workOrders.service';
import { useAuth } from '@/context/AuthContext';

/**
 * CloseWorkOrderDialog - Wizard de 3 pasos para cerrar una Orden de Trabajo
 *
 * Flujo:
 * 1. Seleccionar categoría de resolución + escribir narrativa (mín 10 caracteres)
 * 2. Revisar materiales consumidos (opcional agregar más)
 * 3. Adjuntar fotos de evidencia (obligatorio para install/repair)
 *
 * Las fotos se comprimen automáticamente si pesan >2MB (JPEG, calidad 0.82)
 */
export default function CloseWorkOrderDialog({
  workOrder,
  isOpen,
  onClose,
  onComplete,
  onMaterialsUpdated,
}) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Paso 1: Resolución
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Paso 2: Materiales - Inventario
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState(null);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState(null);
  const [materialSubmitting, setMaterialSubmitting] = useState(false);
  const [materialError, setMaterialError] = useState(null);

  const [additionalMaterial, setAdditionalMaterial] = useState({
    product_id: '',
    quantity: 1,
    serial_number: '',
    notes: '',
  });
  const [materials, setMaterials] = useState(workOrder?.items || []);

  // Paso 3: Fotos
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  // Refs para inputs ocultos
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Compresión de imágenes
  const maybeCompressImage = async (file) => {
    return new Promise((resolve) => {
      // Si el archivo es <2MB, usarlo tal cual
      if (file.size < 2 * 1024 * 1024) {
        resolve(file);
        return;
      }

      // Si es >2MB, comprimir a JPEG con Canvas API
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            0.82
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // Cargar productos cuando se abre el dialog y user está disponible
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    let isCancelled = false;

    const loadInventoryProducts = async () => {
      try {
        setInventoryLoading(true);
        setInventoryError(null);
        setMaterialError(null);

        // Cargar productos disponibles
        const productsData = await inventoryService.getProducts();
        if (isCancelled) return;
        setProducts(productsData || []);

        // Cargar warehouse del técnico para seriales
        const myWarehouse = await inventoryService.getMyWarehouse(user.id);
        if (isCancelled) return;
        setCurrentWarehouse(myWarehouse || null);

        if (myWarehouse) {
          const stockData = await inventoryService.getWarehouseStock(myWarehouse.id);
          if (isCancelled) return;
          setWarehouseStock(stockData);
        }

        console.log('📦 Productos cargados en wizard de cierre:', productsData?.length);
      } catch (err) {
        if (isCancelled) return;
        console.error('Error cargando inventario en wizard:', err);
        setInventoryError(err.message || 'Error al cargar inventario');
      } finally {
        if (!isCancelled) {
          setInventoryLoading(false);
        }
      }
    };

    loadInventoryProducts();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, user?.id]);

  useEffect(() => {
    setMaterials(workOrder?.items || []);
  }, [workOrder, isOpen]);

  // Handler para cambio de producto
  const handleProductChange = (productId) => {
    const product = products.find((p) => p.id === parseInt(productId));
    setSelectedProduct(product);
    setAdditionalMaterial((prev) => ({
      ...prev,
      product_id: productId,
      quantity: 1,
      serial_number: '',
    }));

    if (product && product.type === 'SERIALIZED' && warehouseStock) {
      const stockItem = warehouseStock.items?.find((item) => item.product_id === product.id);
      setAvailableSerials(stockItem?.serial_items || []);
    } else {
      setAvailableSerials([]);
    }
  };

  // Get max quantity para BULK
  const getMaxQuantity = () => {
    if (!selectedProduct || !warehouseStock) return 1;
    if (selectedProduct.type === 'BULK') {
      const stockItem = warehouseStock.items?.find((item) => item.product_id === selectedProduct.id);
      return stockItem?.quantity || 1;
    } else {
      return availableSerials.length || 1;
    }
  };

  // Validate additional material
  const isAddMaterialValid = () => {
    if (!additionalMaterial.product_id) return false;
    if (selectedProduct?.type === 'BULK') {
      const qty = parseInt(additionalMaterial.quantity, 10);
      return qty > 0 && qty <= getMaxQuantity();
    } else {
      return !!additionalMaterial.serial_number;
    }
  };

  const handleAddMaterial = async () => {
    if (!isAddMaterialValid()) return;
    if (!currentWarehouse) {
      setMaterialError('No tienes una camioneta asignada. Contacta a coordinación.');
      return;
    }

    try {
      setMaterialSubmitting(true);
      setMaterialError(null);

      const payload = {
        product_id: parseInt(additionalMaterial.product_id, 10),
        quantity: selectedProduct?.type === 'BULK' ? parseInt(additionalMaterial.quantity, 10) || 1 : 1,
        serial_number: selectedProduct?.type === 'SERIALIZED' ? additionalMaterial.serial_number : null,
        notes: additionalMaterial.notes || null,
        warehouse_id: currentWarehouse.id,
      };

      const item = await workOrdersService.addWorkOrderItem(workOrder.id, payload);

      // Refrescar stock y seriales disponibles
      if (currentWarehouse) {
        const updatedStock = await inventoryService.getWarehouseStock(currentWarehouse.id);
        setWarehouseStock(updatedStock);

        if (selectedProduct?.type === 'SERIALIZED') {
          const stockItem = updatedStock.items?.find((itm) => itm.product_id === selectedProduct.id);
          setAvailableSerials(stockItem?.serial_items || []);
        }
      }

      // Actualizar lista local y notificar al padre para refrescar
      setMaterials((prev) => [...prev, item]);
      onMaterialsUpdated?.();

      // Reset form
      setAdditionalMaterial({ product_id: '', quantity: 1, serial_number: '', notes: '' });
      setSelectedProduct(null);
      setAvailableSerials([]);
    } catch (err) {
      console.error('Error al agregar material en wizard:', err);
      setMaterialError(err?.response?.data?.detail || err.message || 'Error al agregar material');
    } finally {
      setMaterialSubmitting(false);
    }
  };

  // Upload de foto
  const uploadAttachment = async (file) => {
    try {
      setUploading(true);
      setUploadError(null);

      // Comprimir si es necesario
      const processedFile = await maybeCompressImage(file);

      const formData = new FormData();
      formData.append('file', processedFile);

      const response = await api.post(
        `/v2/tickets/${workOrder.ticket_id}/attachments`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          // Subidas pueden tardar más según red/dispositivo
          timeout: 60000,
        }
      );

      if (response.data && response.data.attachment) {
        const photoUrl = response.data.attachment.url;
        setUploadedPhotos((prev) => [...prev, photoUrl]);
        console.log('[DEBUG] Photo uploaded:', photoUrl);
      }
    } catch (err) {
      console.error('[ERROR] Upload failed:', err);
      const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
      setUploadError(
        isTimeout
          ? 'Tiempo de espera excedido al subir. Intenta nuevamente.'
          : (err.response?.data?.detail || 'Error al subir la foto')
      );
    } finally {
      setUploading(false);
    }
  };

  // Handlers de input
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAttachment(file);
    }
    e.target.value = ''; // Reset input
  };

  const handleCameraCapture = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAttachment(file);
    }
    e.target.value = ''; // Reset input
  };

  // Validaciones por paso
  const isStep1Valid = selectedCategory && resolutionNotes.length >= 10;
  const isStep2Valid = true; // Opcional
  const requiresPhotoEvidence =
    workOrder?.status === 'pending_closure' ||
    (workOrder?.ot_type !== 'pickup' && workOrder?.ot_type !== 'pending_planning');

  const isStep3Valid = requiresPhotoEvidence ? uploadedPhotos.length > 0 : true;

  // Handlers de navegación
  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Completar OT
  const handleComplete = async () => {
    if (!isStep3Valid) {
      setUploadError('Debes adjuntar al menos una foto para esta resolución');
      return;
    }

    try {
      setUploading(true);
      const payload = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        resolution_category: selectedCategory,
        resolution_notes: resolutionNotes,
        photo_urls: uploadedPhotos,
      };

      console.log('[DEBUG] Closing WO with payload:', payload);

      await api.patch(`/v2/work-orders/${workOrder.id}`, payload, {
        timeout: 60000,
      });

      onComplete?.();
      onClose?.();
    } catch (err) {
      console.error('[ERROR] Failed to close WO:', err);
      const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
      setUploadError(
        isTimeout
          ? 'Tiempo de espera excedido al completar. Intenta nuevamente.'
          : (err.response?.data?.detail || 'Error al completar la OT')
      );
    } finally {
      setUploading(false);
    }
  };

  const categoryOptions = [
    {
      value: 'infrastructure',
      label: 'Infraestructura',
      desc: 'Fibra, nodos, torres',
      color: 'bg-blue-600',
    },
    {
      value: 'equipment',
      label: 'Equipamiento',
      desc: 'Routers, ONUs, antenas',
      color: 'bg-purple-600',
    },
    {
      value: 'configuration',
      label: 'Configuración',
      desc: 'Software, parámetros',
      color: 'bg-emerald-600',
    },
    {
      value: 'other',
      label: 'Otra',
      desc: 'Otra categoría',
      color: 'bg-amber-600',
    },
  ];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
    >
      <DialogContent
        className="max-w-3xl bg-zinc-900 border-zinc-800 p-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="w-full bg-zinc-900 rounded-lg p-6 space-y-6">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Completar Orden de Trabajo</h2>
            <p className="text-sm text-zinc-400">
              Paso {step} de 3: {step === 1 ? 'Resolución' : step === 2 ? 'Materiales' : 'Evidencia'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            disabled={uploading || materialSubmitting}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <X size={14} />
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-2">
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              className={`flex-1 h-2 rounded ${
                num <= step
                  ? 'bg-emerald-500'
                  : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Contenido por Paso */}
        <div className="mb-2 min-h-96">
          {/* PASO 1: RESOLUCIÓN */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Categoría de Resolución
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {categoryOptions.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`p-3 rounded border-2 transition ${
                        selectedCategory === cat.value
                          ? `${cat.color} border-emerald-400`
                          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                      }`}
                    >
                      <div className="font-medium text-white">{cat.label}</div>
                      <div className="text-xs text-zinc-400">{cat.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Descripción del Trabajo
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describe qué se hizo, qué se encontró y cómo se resolvió..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  rows={6}
                />
                <div className="mt-1 text-xs text-zinc-400">
                  {resolutionNotes.length}/1000 caracteres (mínimo 10)
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: MATERIALES */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-white mb-3">
                  Materiales Utilizados
                </h3>
                {materials && materials.length > 0 ? (
                  <div className="space-y-2">
                    {materials.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-zinc-800 border border-zinc-700 rounded flex justify-between items-start"
                      >
                        <div>
                          <div className="text-sm text-white">
                            Producto ID: {item.product_id}
                          </div>
                          <div className="text-xs text-zinc-400 mt-1">
                            Cantidad: {item.quantity} | Serial: {item.serial_number || 'N/A'}
                          </div>
                          {item.notes && (
                            <div className="text-xs text-zinc-300 mt-1">{item.notes}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-900/30 border border-amber-700/50 rounded text-sm text-amber-200">
                    ⚠️ Esta instalación no tiene materiales registrados. Considera agregar si se utilizó algo.
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium text-white mb-3 mt-6">
                  Agregar Material (Opcional)
                </h3>

                {/* Loading indicator */}
                {inventoryLoading && (
                  <div className="text-sm text-zinc-400 flex items-center gap-2 mb-3">
                    <div className="animate-spin w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full" />
                    Cargando productos...
                  </div>
                )}

                {/* Error messages */}
                {inventoryError && (
                  <div className="bg-amber-950/30 border border-amber-800 text-amber-200 text-sm rounded-lg p-3 mb-3">
                    ⚠️ {inventoryError}
                  </div>
                )}

                <div className="space-y-3">
                  {/* Dropdown de productos */}
                  {!inventoryLoading && products.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-2">
                        Producto *
                      </label>
                      <select
                        value={additionalMaterial.product_id}
                        onChange={(e) => handleProductChange(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">Selecciona un producto...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.sku}) - {product.type === 'BULK' ? '📦' : '🔢'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Info del producto seleccionado */}
                  {selectedProduct && (
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                      <p className="text-xs text-zinc-400">
                        Tipo:{' '}
                        <span className="text-emerald-400 font-medium">
                          {selectedProduct.type === 'BULK' ? '📦 A Granel' : '🔢 Serializado'}
                        </span>
                      </p>
                      {selectedProduct.category && (
                        <p className="text-xs text-zinc-400 mt-1">Categoría: {selectedProduct.category}</p>
                      )}
                      {warehouseStock && (
                        <p className="text-xs text-emerald-300 mt-2 font-medium">
                          {selectedProduct.type === 'BULK'
                            ? `Stock disponible: ${getMaxQuantity()} unidades`
                            : `Disponibles: ${availableSerials.length} seriales`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Cantidad (solo para BULK) */}
                  {selectedProduct && selectedProduct.type === 'BULK' && (
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-2">
                        Cantidad *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={getMaxQuantity()}
                        value={additionalMaterial.quantity}
                        onChange={(e) =>
                          setAdditionalMaterial({
                            ...additionalMaterial,
                            quantity: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  {/* Serial (solo para SERIALIZED) */}
                  {selectedProduct && selectedProduct.type === 'SERIALIZED' && (
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-2">
                        Serial *
                      </label>
                      {availableSerials.length > 0 ? (
                        <select
                          value={additionalMaterial.serial_number}
                          onChange={(e) =>
                            setAdditionalMaterial({
                              ...additionalMaterial,
                              serial_number: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="">Selecciona un serial...</option>
                          {availableSerials.map((serial) => (
                            <option key={serial.id} value={serial.serial_number}>
                              {serial.serial_number}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs text-zinc-500 p-2">No hay seriales disponibles</div>
                      )}
                    </div>
                  )}

                  {/* Notas */}
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-2">
                      Notas (opcional)
                    </label>
                    <textarea
                      value={additionalMaterial.notes}
                      onChange={(e) =>
                        setAdditionalMaterial({
                          ...additionalMaterial,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Notas sobre el material..."
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      rows={2}
                    />
                  </div>
                </div>
                {materialError && (
                  <div className="bg-rose-950/40 border border-rose-800 text-rose-200 text-xs rounded-lg p-3">
                    {materialError}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleAddMaterial}
                    disabled={!isAddMaterialValid() || materialSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {materialSubmitting ? 'Agregando...' : 'Agregar material'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: FOTOS */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-white mb-3">Evidencia Fotográfica</h3>
                <div className="flex gap-2 mb-4">
                  {/* Inputs ocultos controlados por refs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    disabled={uploading}
                    className="hidden"
                  />

                  <Button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    variant="outline"
                    size="icon"
                    className="border-zinc-700 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-[0_0_10px_rgba(16,185,129,0.35)] bg-zinc-900/40 disabled:opacity-50"
                    disabled={uploading}
                  >
                    <Paperclip size={16} className="text-emerald-400" />
                  </Button>

                  <Button
                    type="button"
                    onClick={() => cameraInputRef.current && cameraInputRef.current.click()}
                    variant="outline"
                    size="icon"
                    className="border-zinc-700 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-[0_0_10px_rgba(16,185,129,0.35)] bg-zinc-900/40 disabled:opacity-50"
                    disabled={uploading}
                  >
                    <Camera size={16} className="text-emerald-400" />
                  </Button>
                </div>

                {uploadError && (
                  <div className="p-3 bg-red-900/30 border border-red-700/50 rounded text-sm text-red-200 mb-4">
                    {uploadError}
                  </div>
                )}

                {uploading && (
                  <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded text-sm text-blue-200 mb-4">
                    Subiendo foto...
                  </div>
                )}

                {/* Galería de fotos */}
                {uploadedPhotos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {uploadedPhotos.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative group bg-zinc-800 border border-zinc-700 rounded aspect-square overflow-hidden"
                      >
                        <img
                          src={url}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() =>
                            setUploadedPhotos((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                        >
                          <X size={24} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 bg-zinc-800 border border-dashed border-zinc-600 rounded text-center text-zinc-400">
                    <Paperclip size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Adjunta fotos de la resolución</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botones de navegación */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between pt-4 border-t border-zinc-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={uploading || materialSubmitting}
              className="w-full sm:w-auto border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={step === 1 || uploading}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <ChevronLeft size={16} />
              Anterior
            </Button>
          </div>

          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={!isStep1Valid && step === 1}
              className="w-full sm:w-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              Siguiente
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={!isStep3Valid || uploading}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
            >
              {uploading ? 'Completando...' : 'Completar Trabajo'}
            </Button>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
