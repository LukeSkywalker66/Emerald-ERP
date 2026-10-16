import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Paperclip, Camera, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import api from '@/api/client';
import workOrdersService from '@/services/workOrders.service';
import * as workOrderTypesService from '@/services/workOrderTypes.service';
import { useAuth } from '@/context/AuthContext';
import useMaterialSelector from '@/components/work-orders/useMaterialSelector';
import MaterialSelectorForm from '@/components/work-orders/MaterialSelectorForm';

const RECOVERY_EXCLUDED_OT_TYPES = ['install_ftth', 'install_aire', 'install'];
const RECOVERY_STATE_LABELS = {
  funciona: 'Funciona',
  no_funciona: 'No funciona',
  revisar: 'Revisar',
};

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
  portal = true,
}) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Paso 1: Resolución (acciones dinámicas desde API)
  const [woActions, setWoActions] = useState([]);
  const [selectedAction, setSelectedAction] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Paso 2: Materiales - Compartido (hook unificado)
  const materialState = useMaterialSelector(workOrder?.id, {
    teamId: workOrder?.team_id ?? null,
    technicianId: workOrder?.technician_id ?? null,
  });
  const [materials, setMaterials] = useState(workOrder?.items || []);

  // Paso 3: Fotos
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  // Refs para inputs ocultos
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  // Clave de idempotencia del cierre: se genera al abrir el wizard y se reusa en
  // reintentos para que el backend no duplique el consumo de inventario.
  const closeIdempotencyKeyRef = useRef('');

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

  // Cargar acciones de resolución desde la API cuando se abre el dialog
  const [actionsLoading, setActionsLoading] = useState(false);
  useEffect(() => {
    if (!isOpen || !workOrder?.ot_type) return;
    setActionsLoading(true);
    workOrderTypesService.getWOActions({ ot_type: workOrder.ot_type, active_only: true })
      .then(setWoActions)
      .catch(() => setWoActions([]))
      .finally(() => setActionsLoading(false));
  }, [isOpen, workOrder?.ot_type]);

  // Cargar inventario desde el hook compartido cuando se abre el dialog
  useEffect(() => {
    if (isOpen && workOrder?.id) {
      materialState.loadInventory();
    }
  }, [isOpen, workOrder?.id]);

  // Reset completo del estado cuando se abre/cierra el dialog o cambia la OT
  useEffect(() => {
    if (isOpen) {
      // Se abre para una OT específica: cargar materiales de esa OT
      closeIdempotencyKeyRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `wo-${workOrder?.id}-${Date.now().toString(36)}`;
      if (workOrder?.id) {
        setMaterials(workOrder?.items || []);
      }
    } else {
      // Se cierra el dialog: limpiar TODO
      setStep(1);
      setSelectedAction(null);
      setResolutionNotes('');
      setUploadedPhotos([]);
      setUploadError(null);
      setMaterials([]);
      setConnectionNote('');
      setRecoveryEnabled(false);
      setConnectionAssets([]);
      setAssetStates({});
      setUnregisteredItems([]);
      setUnregisteredDraft({ product_id: '', serial_number: '', state: 'funciona' });
      materialState.resetForm();
    }
  }, [isOpen, workOrder?.id]);

  // Handlers de materiales (delegados al hook compartido)
  const handleWizardAddMaterial = async () => {
    const result = await materialState.addMaterial();
    if (result.success) {
      // Refrescar lista local de materiales
      if (workOrder?.id) {
        try {
          const updated = await workOrdersService.getWorkOrderDetail(workOrder.id);
          setMaterials(updated?.items || []);
        } catch {
          // Si falla, al menos notificamos al padre
        }
      }
      onMaterialsUpdated?.();
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

  // Detectar si es "No Realizada"
  const isNoRealizada = selectedAction?.code === 'no_realizada';
  const selectedActionRequiresNotes = selectedAction?.requires_notes === true;

  // Validaciones por paso
  const isStep1Valid = (() => {
    if (!selectedAction) return false;
    if (isNoRealizada || selectedActionRequiresNotes) {
      return resolutionNotes.trim().length >= 10;
    }
    return true; // acciones sin requisito de notas
  })();
  const isStep2Valid = true; // Opcional
  const isStep3Valid = true; // Fotos opcionales
  const isStep4Valid = true; // Confirmacion siempre valida

  // Handlers de navegación (ahora 4 pasos)
  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Cargar plantilla de materiales según OT type + acción seleccionada
  const [suggestedTemplate, setSuggestedTemplate] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  useEffect(() => {
    if (!selectedAction || !workOrder?.ot_type) {
      setSuggestedTemplate(null);
      return;
    }
    const loadTpl = async () => {
      setLoadingTemplate(true);
      try {
        const templates = await workOrderTypesService.getWOTemplates({
          ot_type: workOrder.ot_type,
          action_code: selectedAction.code,
          active_only: true,
        });
        setSuggestedTemplate(templates?.[0] || null);
      } catch {
        setSuggestedTemplate(null);
      } finally {
        setLoadingTemplate(false);
      }
    };
    loadTpl();
  }, [selectedAction, workOrder?.ot_type]);

  // State para paso 4: Nota de conexión + señal de instalación
  const [connectionNote, setConnectionNote] = useState('');
  const [signalDbm, setSignalDbm] = useState('');

  // ---- Recuperación de equipos del domicilio (opcional; no aplica a altas nuevas) ----
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [connectionAssets, setConnectionAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetStates, setAssetStates] = useState({});
  const [unregisteredItems, setUnregisteredItems] = useState([]);
  const [unregisteredDraft, setUnregisteredDraft] = useState({
    product_id: '',
    serial_number: '',
    state: 'funciona',
  });

  const isRecoveryApplicable =
    !!workOrder && !RECOVERY_EXCLUDED_OT_TYPES.includes(workOrder.ot_type);
  const serializedProducts = (materialState.products || []).filter(
    (p) => p.type === 'SERIALIZED' && !p.is_composite
  );

  useEffect(() => {
    if (!isRecoveryApplicable || !recoveryEnabled || !workOrder?.id) {
      setConnectionAssets([]);
      return;
    }
    let cancelled = false;
    setAssetsLoading(true);
    workOrdersService
      .getWorkOrderConnectionAssets(workOrder.id)
      .then((data) => {
        if (!cancelled) {
          setConnectionAssets(
            (data?.assets || []).filter((a) => a.status === 'INSTALLED')
          );
        }
      })
      .catch(() => {
        if (!cancelled) setConnectionAssets([]);
      })
      .finally(() => {
        if (!cancelled) setAssetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isRecoveryApplicable, recoveryEnabled, workOrder?.id]);

  const handleAddUnregistered = () => {
    if (!unregisteredDraft.product_id || !unregisteredDraft.serial_number.trim()) return;
    setUnregisteredItems((prev) => [
      ...prev,
      {
        product_id: parseInt(unregisteredDraft.product_id, 10),
        serial_number: unregisteredDraft.serial_number.trim(),
        state: unregisteredDraft.state || 'funciona',
      },
    ]);
    setUnregisteredDraft({ product_id: '', serial_number: '', state: 'funciona' });
  };

  // Completar / Cerrar OT - usa acciones dinámicas + nuevo endpoint
  const handleComplete = async () => {
    try {
      setUploading(true);

      // Recuperación de equipos (opcional, best-effort): se registra antes de
      // completar para que el cierre no falle por equipos retirados del domicilio.
      if (isRecoveryApplicable && recoveryEnabled) {
        const recoveryItems = [
          ...Object.entries(assetStates).map(([assetId, state]) => ({
            connection_asset_id: parseInt(assetId, 10),
            state,
          })),
          ...unregisteredItems,
        ];
        if (recoveryItems.length > 0) {
          await workOrdersService.recoverWorkOrderEquipment(workOrder.id, recoveryItems);
        }
      }

      const payload = {
        resolution_category: selectedAction?.code || 'other',
        resolution_notes: resolutionNotes,
        photo_urls: uploadedPhotos,
        connection_note: connectionNote.trim() || null,
        installation_signal_dbm: signalDbm ? parseFloat(signalDbm) : null,
        idempotency_key: closeIdempotencyKeyRef.current || null,
      };

      // Usar el nuevo endpoint POST /complete con inventario
      await api.post(`/v2/work-orders/${workOrder.id}/complete`, payload, {
        timeout: 60000,
      });

      onComplete?.();
      onClose?.();
    } catch (err) {
      console.error('[ERROR] Failed to close WO:', err);
      const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
      
      let errorMsg = 'Error al completar la OT';
      if (isTimeout) {
        errorMsg = 'Tiempo de espera excedido al completar. Intenta nuevamente.';
      } else if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMsg = detail.map(e => e.msg || String(e)).join('; ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        } else {
          errorMsg = String(detail);
        }
      }
      setUploadError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  // categoryOptions reemplazado por woActions (dinámico desde API)

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
      portal={portal}
    >
      <DialogContent
        className="max-w-3xl bg-zinc-900 border-zinc-800 p-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <div className="w-full bg-zinc-900 rounded-lg p-6 space-y-6">
          {/* Header */}
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">
                {isNoRealizada ? 'Cerrar OT - No Realizada' : 'Completar Orden de Trabajo'}
              </h2>
              <p className="text-sm text-zinc-400">
                Paso {step} de 4: {step === 1 ? 'Resolución' : step === 2 ? 'Materiales' : step === 3 ? 'Evidencia' : 'Confirmación'}
                {step === 3 && ' (opcional)'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClose}
              disabled={uploading || materialState.isSubmitting}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <X size={14} />
            </Button>
          </div>

          {/* Progress Bar (4 pasos) */}
          <div className="flex gap-2 mb-2">
            {[1, 2, 3, 4].map((num) => (
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
            {/* PASO 1: RESOLUCIÓN - ACCIONES DINÁMICAS */}
            {step === 1 && (
              <div className="space-y-6">
                {actionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-emerald-400 mr-2" />
                    <span className="text-sm text-zinc-400">Cargando acciones...</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-3">
                        Acción Realizada
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {woActions.map((action) => {
                          const isSelected = selectedAction?.code === action.code;
                          const isNoReal = action.code === 'no_realizada';
                          return (
                            <button
                              key={action.id}
                              onClick={() => setSelectedAction(action)}
                              className={`p-3 rounded border-2 transition text-left ${
                                isSelected
                                  ? isNoReal
                                    ? 'bg-rose-600/20 border-rose-500'
                                    : 'bg-emerald-600/20 border-emerald-500'
                                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                              }`}
                            >
                              <div className="font-medium text-white">{action.name}</div>
                              {action.description && (
                                <div className="text-xs text-zinc-400 mt-1">{action.description}</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Descripción del Trabajo
                        {(selectedAction && !selectedActionRequiresNotes && !isNoRealizada) && (
                          <span className="text-zinc-500 font-normal"> (opcional)</span>
                        )}
                      </label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder={
                          isNoRealizada
                            ? "Explicá el motivo por el que no se realizó la OT..."
                            : "Describí brevemente el trabajo realizado (opcional)"
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        rows={5}
                      />
                      {(isNoRealizada || selectedActionRequiresNotes) && (
                        <div className="mt-1 text-xs text-zinc-400">
                          {resolutionNotes.length}/1000 caracteres (mínimo 10)
                        </div>
                      )}
                    </div>
                  </>
                )}
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
                  ) : suggestedTemplate && (
                    <div className="p-3 rounded-lg border border-emerald-800/50 bg-emerald-950/20 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-emerald-300">
                          📋 Plantilla sugerida: {suggestedTemplate.name}
                        </p>
                        <button
                          onClick={async () => {
                            for (const item of suggestedTemplate.items) {
                              materialState.setForm({
                                product_id: item.product_id,
                                quantity: item.default_quantity,
                                serial_number: '',
                                notes: item.notes || '',
                              });
                              materialState.handleProductChange(item.product_id);
                              await materialState.addMaterial();
                            }
                            // Refrescar materiales después de cargar la plantilla
                            if (workOrder?.id) {
                              const updated = await workOrdersService.getWorkOrderDetail(workOrder.id);
                              setMaterials(updated?.items || []);
                            }
                            onMaterialsUpdated?.();
                          }}
                          className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                        >
                          Cargar plantilla
                        </button>
                      </div>
                      <div className="space-y-1">
                        {suggestedTemplate.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className="text-emerald-400">•</span>
                            <span>Producto #{item.product_id} x{item.default_quantity}{item.required ? ' *' : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-white mb-3 mt-6">
                    Agregar Material (Opcional)
                  </h3>
                  <MaterialSelectorForm
                    materialState={materialState}
                    onAdd={handleWizardAddMaterial}
                    compact
                  />
                </div>

                {isRecoveryApplicable && (
                  <div className="mt-6 border-t border-zinc-700 pt-4">
                    <h3 className="font-medium text-white mb-2">Recuperación de equipos</h3>
                    <p className="text-xs text-zinc-400 mb-3">
                      ¿Recuperaste algún equipo de la empresa del domicilio?
                    </p>
                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setRecoveryEnabled(false)}
                        className={`px-4 py-2 rounded-lg border text-sm transition ${
                          !recoveryEnabled
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecoveryEnabled(true)}
                        className={`px-4 py-2 rounded-lg border text-sm transition ${
                          recoveryEnabled
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        Sí
                      </button>
                    </div>

                    {recoveryEnabled && (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-zinc-300">
                          Equipos que estaban en el domicilio
                        </p>
                        {assetsLoading ? (
                          <p className="text-xs text-zinc-500">Cargando equipos...</p>
                        ) : connectionAssets.length > 0 ? (
                          connectionAssets.map((asset) => (
                            <div
                              key={asset.id}
                              className="flex items-center gap-3 p-2 bg-zinc-800/50 border border-zinc-700 rounded"
                            >
                              <span className="text-xs text-zinc-200 flex-1 font-mono">
                                {asset.serial_number}
                              </span>
                              <select
                                value={assetStates[asset.id] || 'funciona'}
                                onChange={(e) =>
                                  setAssetStates((prev) => ({
                                    ...prev,
                                    [asset.id]: e.target.value,
                                  }))
                                }
                                className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                              >
                                <option value="funciona">Funciona</option>
                                <option value="no_funciona">No funciona</option>
                                <option value="revisar">Revisar</option>
                              </select>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-zinc-500">
                            No hay equipos registrados en este domicilio.
                          </p>
                        )}

                        <div className="p-3 bg-zinc-800/30 border border-zinc-700 rounded space-y-2">
                          <p className="text-xs font-medium text-zinc-300">
                            Agregar equipo no registrado
                          </p>
                          <select
                            value={unregisteredDraft.product_id}
                            onChange={(e) =>
                              setUnregisteredDraft((prev) => ({
                                ...prev,
                                product_id: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">Tipo de equipo...</option>
                            {serializedProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={unregisteredDraft.serial_number}
                            onChange={(e) =>
                              setUnregisteredDraft((prev) => ({
                                ...prev,
                                serial_number: e.target.value,
                              }))
                            }
                            placeholder="Serial del equipo"
                            className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white font-mono placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                          />
                          <div className="flex gap-2">
                            <select
                              value={unregisteredDraft.state}
                              onChange={(e) =>
                                setUnregisteredDraft((prev) => ({
                                  ...prev,
                                  state: e.target.value,
                                }))
                              }
                              className="flex-1 px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                            >
                              <option value="funciona">Funciona</option>
                              <option value="no_funciona">No funciona</option>
                              <option value="revisar">Revisar</option>
                            </select>
                            <button
                              type="button"
                              onClick={handleAddUnregistered}
                              disabled={
                                !unregisteredDraft.product_id ||
                                !unregisteredDraft.serial_number.trim()
                              }
                              className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs disabled:bg-zinc-700 disabled:opacity-50"
                            >
                              Agregar
                            </button>
                          </div>
                        </div>

                        {unregisteredItems.length > 0 && (
                          <div className="space-y-1">
                            {unregisteredItems.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-xs text-zinc-300"
                              >
                                <span className="font-mono">{item.serial_number}</span>
                                <span className="text-zinc-500">
                                  {RECOVERY_STATE_LABELS[item.state]}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUnregisteredItems((prev) =>
                                      prev.filter((_, i) => i !== idx)
                                    )
                                  }
                                  className="ml-auto text-zinc-500 hover:text-rose-400"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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

            {/* PASO 4: CONFIRMACIÓN + NOTA DE CONEXIÓN */}
            {step === 4 && (
              <div className="space-y-4">
                {uploadError && (
                  <div className="p-3 bg-red-900/30 border border-red-700/50 rounded text-sm text-red-200 mb-4">
                    {uploadError}
                  </div>
                )}
                <div>
                  <h3 className="font-medium text-white mb-3">Confirmación y Notas</h3>
                  
                  {/* Resumen de la resolución */}
                  <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 mb-4">
                    <p className="text-xs text-zinc-400 mb-1">Acción realizada</p>
                    <p className="text-sm text-white font-medium">
                      {selectedAction?.name || 'Sin especificar'}
                    </p>
                    {resolutionNotes && (
                      <>
                        <p className="text-xs text-zinc-400 mt-3 mb-1">Descripción</p>
                        <p className="text-sm text-zinc-200">{resolutionNotes}</p>
                      </>
                    )}
                  </div>

                  {/* Resumen de materiales */}
                  <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 mb-4">
                    <p className="text-xs text-zinc-400 mb-1">Materiales registrados</p>
                    <p className="text-sm text-white font-medium">
                      {materials.length} material(es)
                    </p>
                    {materials.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {materials.slice(0, 5).map((item) => (
                          <div key={item.id} className="text-xs text-zinc-400">
                            • Producto #{item.product_id} {item.serial_number ? `(SN: ${item.serial_number})` : ''} x{item.quantity}
                          </div>
                        ))}
                        {materials.length > 5 && (
                          <p className="text-xs text-zinc-500 mt-1">...y {materials.length - 5} más</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fotos adjuntas */}
                  <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 mb-4">
                    <p className="text-xs text-zinc-400 mb-1">Evidencia fotográfica</p>
                    <p className="text-sm text-white font-medium">
                      {uploadedPhotos.length} foto(s) adjunta(s)
                    </p>
                  </div>

                  {/* Nota de conexión */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Nota sobre la conexión (opcional)
                    </label>
                    <textarea
                      value={connectionNote}
                      onChange={(e) => setConnectionNote(e.target.value)}
                      placeholder="Ej: Cliente con 3 pisos, perro peligroso, red aerea saturada, etc."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      rows={3}
                    />
                    <p className="mt-1 text-xs text-zinc-400">
                      Esta nota quedará asociada a la conexión del cliente para futuras visitas.
                    </p>
                  </div>

                  {/* Nivel de señal de instalación (solo para instalaciones) */}
                  {(workOrder?.ot_type === 'install_ftth' || workOrder?.ot_type === 'install_aire') && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Nivel de señal / luz (dBm) <span className="text-zinc-500">— opcional</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={signalDbm}
                          onChange={(e) => setSignalDbm(e.target.value)}
                          placeholder="Ej: -18.5"
                          className="w-32 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-zinc-400">dBm</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        Registrá el nivel de señal óptica (FTTH) o RSSI (radio) medido al instalar.
                        Quedará ligado a la conexión para futuras comparaciones.
                      </p>
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
                disabled={uploading || materialState.isSubmitting}
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

            {step < 4 ? (
              <Button
                onClick={handleNext}
                disabled={(step === 1 && !isStep1Valid) || (step === 3 && !isStep3Valid)}
                className="w-full sm:w-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                Siguiente
                <ChevronRight size={16} />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={uploading}
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
