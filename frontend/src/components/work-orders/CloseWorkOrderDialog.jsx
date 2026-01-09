import { useState } from 'react';
import { ChevronRight, ChevronLeft, Paperclip, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import api from '@/api/client';

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
}) {
  const [step, setStep] = useState(1);

  // Paso 1: Resolución
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Paso 2: Materiales
  const [additionalMaterial, setAdditionalMaterial] = useState({
    product_id: '',
    quantity: '',
    serial_number: '',
    notes: '',
  });

  // Paso 3: Fotos
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

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
        }
      );

      if (response.data && response.data.attachment) {
        const photoUrl = response.data.attachment.url;
        setUploadedPhotos((prev) => [...prev, photoUrl]);
        console.log('[DEBUG] Photo uploaded:', photoUrl);
      }
    } catch (err) {
      console.error('[ERROR] Upload failed:', err);
      setUploadError(err.response?.data?.detail || 'Error al subir la foto');
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
  const isStep3Valid =
    uploadedPhotos.length > 0 ||
    (workOrder.ot_type === 'pending_planning' || workOrder.ot_type === 'pickup');

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

      await api.patch(`/v2/work-orders/${workOrder.id}`, payload);

      onComplete?.();
      onClose?.();
    } catch (err) {
      console.error('[ERROR] Failed to close WO:', err);
      setUploadError(err.response?.data?.detail || 'Error al completar la OT');
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-zinc-900 border-zinc-800 p-0">
        <div className="w-full bg-zinc-900 rounded-lg p-6 space-y-6">
        {/* Header */}
        <div className="mb-2">
          <h2 className="text-xl font-bold text-white mb-2">Completar Orden de Trabajo</h2>
          <p className="text-sm text-zinc-400">
            Paso {step} de 3: {step === 1 ? 'Resolución' : step === 2 ? 'Materiales' : 'Evidencia'}
          </p>
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
                {workOrder.items && workOrder.items.length > 0 ? (
                  <div className="space-y-2">
                    {workOrder.items.map((item) => (
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
                <div className="space-y-2">
                  <input
                    type="number"
                    placeholder="Producto ID"
                    value={additionalMaterial.product_id}
                    onChange={(e) =>
                      setAdditionalMaterial({
                        ...additionalMaterial,
                        product_id: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white placeholder:text-zinc-500 text-sm"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Cantidad"
                    value={additionalMaterial.quantity}
                    onChange={(e) =>
                      setAdditionalMaterial({
                        ...additionalMaterial,
                        quantity: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white placeholder:text-zinc-500 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Serial (opcional)"
                    value={additionalMaterial.serial_number}
                    onChange={(e) =>
                      setAdditionalMaterial({
                        ...additionalMaterial,
                        serial_number: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white placeholder:text-zinc-500 text-sm"
                  />
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  (No se guardará en esta versión, solo para referencia visual)
                </p>
              </div>
            </div>
          )}

          {/* PASO 3: FOTOS */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-white mb-3">Evidencia Fotográfica</h3>
                <div className="flex gap-2 mb-4">
                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-zinc-700 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-[0_0_10px_rgba(16,185,129,0.35)] bg-zinc-900/40 disabled:opacity-50"
                      disabled={uploading}
                    >
                      <Paperclip size={16} className="text-emerald-400" />
                    </Button>
                  </label>

                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraCapture}
                      disabled={uploading}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-zinc-700 hover:ring-1 hover:ring-emerald-500/40 hover:shadow-[0_0_10px_rgba(16,185,129,0.35)] bg-zinc-900/40 disabled:opacity-50"
                      disabled={uploading}
                    >
                      <Camera size={16} className="text-emerald-400" />
                    </Button>
                  </label>
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
        <div className="flex gap-3 justify-between pt-4 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={step === 1 || uploading}
            className="flex items-center gap-2"
          >
            <ChevronLeft size={16} />
            Anterior
          </Button>

          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={!isStep1Valid && step === 1}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              Siguiente
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={!isStep3Valid || uploading}
              className="bg-emerald-600 hover:bg-emerald-700"
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
