import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader,
  User,
  MapPin,
  Phone,
  Clock,
  Wifi,
  Package,
  Plus,
  X,
  Wrench,
  Home,
  Zap,
  Activity,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import workOrdersService from '@/services/workOrders.service';
import beholderService from '@/services/beholder.service';

// Mapeo de tipos de OT
const OT_TYPE_ICONS = {
  repair: { icon: Wrench, label: 'Soporte', color: 'text-emerald-400' },
  install: { icon: Home, label: 'Instalación', color: 'text-blue-400' },
  pickup: { icon: Package, label: 'Retiro', color: 'text-amber-400' },
  infrastructure: { icon: Zap, label: 'Infraestructura', color: 'text-purple-400' },
};

// Timer Component
function Timer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    const interval = setInterval(() => {
      const diff = Date.now() - new Date(startedAt).getTime();
      setElapsed(Math.floor(diff / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
      <Clock size={14} className="text-emerald-400" />
      <span className="font-mono text-emerald-300 text-sm">
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}

// Material Item
function MaterialItem({ item, onRemove }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-zinc-800/50 border border-zinc-700/50">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 truncate">
          {item.serial_number || item.product_name || `Producto #${item.product_id}`}
        </p>
        <p className="text-xs text-zinc-500">Qty: {item.quantity}</p>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-rose-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function WorkOrderExecutionPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // State
  const [workOrder, setWorkOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialogs
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  // Material form
  const [materialForm, setMaterialForm] = useState({
    product_id: '',
    quantity: 1,
    serial_number: '',
    notes: '',
  });

  // Completion form
  const [completionForm, setCompletionForm] = useState({
    resolution_type: 'success',
    resolution_notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Beholder diagnosis state
  const [beholderData, setBeholderData] = useState(null);
  const [beholderLoading, setBeholderLoading] = useState(false);
  const [beholderError, setBeholderError] = useState(null);

  // Load WO
  useEffect(() => {
    loadWorkOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadWorkOrder = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await workOrdersService.getWorkOrderDetail(id);
      setWorkOrder(data);
    } catch (err) {
      setError(err.message || 'Error al cargar OT');
      console.error('Error loading work order:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartWork = async () => {
    try {
      setIsSubmitting(true);
      const updated = await workOrdersService.updateWorkOrder(id, {
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });
      setWorkOrder(updated);
    } catch (err) {
      alert('Error al iniciar trabajo: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMaterial = async () => {
    if (!materialForm.product_id) {
      alert('Selecciona un producto');
      return;
    }

    try {
      setIsSubmitting(true);
      const item = await workOrdersService.addWorkOrderItem(id, {
        product_id: parseInt(materialForm.product_id),
        quantity: parseInt(materialForm.quantity) || 1,
        serial_number: materialForm.serial_number || null,
        notes: materialForm.notes || null,
      });

      setWorkOrder((prev) => ({
        ...prev,
        items: [...(prev.items || []), item],
      }));

      setMaterialForm({ product_id: '', quantity: 1, serial_number: '', notes: '' });
      setShowMaterialDialog(false);
    } catch (err) {
      alert('Error al agregar material: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMaterial = async (itemId) => {
    if (!confirm('¿Eliminar este material?')) return;

    try {
      await workOrdersService.removeWorkOrderItem(id, itemId);
      setWorkOrder((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== itemId),
      }));
    } catch (err) {
      alert('Error al eliminar material: ' + err.message);
    }
  };

  const handleCompleteWork = async () => {
    try {
      setIsSubmitting(true);
      const updated = await workOrdersService.updateWorkOrder(id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        resolution_type: completionForm.resolution_type,
        resolution_notes: completionForm.resolution_notes || null,
      });

      setWorkOrder(updated);
      setShowCompletionDialog(false);

      setTimeout(() => navigate('/app/work-orders'), 1500);
    } catch (err) {
      alert('Error al completar trabajo: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckBeholder = async () => {
    const pppoeUser = workOrder?.ticket_info?.pppoe_username;

    if (!pppoeUser) {
      alert('No se encontró usuario PPPoE para este cliente');
      return;
    }

    try {
      setBeholderLoading(true);
      setBeholderError(null);

      console.log('Consultando Beholder para:', pppoeUser);
      const data = await beholderService.getDiagnosis(pppoeUser);

      setBeholderData(data);
      console.log('Diagnóstico recibido:', data);
    } catch (err) {
      let errorMsg = 'Error al consultar diagnóstico';
      
      // Manejar error 404 (usuario no encontrado)
      if (err?.response?.status === 404) {
        errorMsg = `Usuario PPPoE "${pppoeUser}" no encontrado en la red. Verifica que el cliente esté activo.`;
      } else if (err?.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setBeholderError(errorMsg);
      console.error('Error Beholder:', err);
    } finally {
      setBeholderLoading(false);
    }
  };

  // Loading state
  if (isLoading && !workOrder) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader className="text-emerald-400 animate-spin" size={40} />
      </div>
    );
  }

  // Error state
  if (error && !workOrder) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-rose-400" size={40} />
          <p className="text-rose-300 mb-4">{error}</p>
          <Button onClick={() => navigate(-1)} variant="outline">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  const isActive = workOrder?.started_at && !workOrder?.completed_at;
  const isCompleted = !!workOrder?.completed_at;
  const typeConfig = OT_TYPE_ICONS[workOrder?.ot_type] || OT_TYPE_ICONS.repair;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-zinc-900 rounded-lg transition"
            >
              <ChevronLeft className="text-emerald-400" size={20} />
            </button>

            <div className="flex items-center gap-2">
              <TypeIcon size={20} className={typeConfig.color} />
              <div>
                <h1 className="text-base md:text-lg font-bold text-white">
                  {typeConfig.label} #{workOrder?.id}
                </h1>
                <p className="text-xs text-zinc-500">
                  Ticket #{workOrder?.ticket_id}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActive && <Timer startedAt={workOrder.started_at} />}

            {!isActive && !isCompleted && (
              <Button
                size="sm"
                onClick={handleStartWork}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 h-9"
              >
                <Play size={14} className="mr-1" />
                Iniciar
              </Button>
            )}

            {isActive && (
              <Button
                size="sm"
                onClick={() => setShowCompletionDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700 h-9"
              >
                <CheckCircle2 size={14} className="mr-1" />
                Completar
              </Button>
            )}

            {isCompleted && (
              <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 h-9 px-3">
                ✓ Completada
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Grid Layout */}
      <div className="px-4 md:px-6 py-4 md:py-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Columna Izquierda: Información */}
        <div className="space-y-4">
          {/* Cliente */}
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <User size={16} className="text-emerald-400" />
              Datos del Cliente
            </h2>

            <div className="space-y-2 text-sm">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Nombre</p>
                <p className="text-zinc-200 font-medium">
                  {workOrder?.ticket_info?.client_name || 'Sin cliente'}
                </p>
              </div>

              {workOrder?.ticket_info?.client_dni && (
                <div>
                  <p className="text-zinc-500 text-xs mb-1">DNI</p>
                  <p className="text-zinc-300 font-mono text-sm">
                    {workOrder.ticket_info.client_dni}
                  </p>
                </div>
              )}

              {workOrder?.ticket_info?.address && (
                <div>
                  <p className="text-zinc-500 text-xs mb-1">Dirección</p>
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                    <p className="text-zinc-300 text-sm">
                      {workOrder.ticket_info.address}
                    </p>
                  </div>
                </div>
              )}

              {workOrder?.ticket_info?.contact_phone && (
                <div>
                  <p className="text-zinc-500 text-xs mb-1">Teléfono</p>
                  <a
                    href={`tel:${workOrder.ticket_info.contact_phone}`}
                    className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm"
                  >
                    <Phone size={14} />
                    {workOrder.ticket_info.contact_phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Descripción / Notas de la OT */}
          {workOrder.notes && (
            <div className="p-4 rounded-lg border border-amber-800/50 bg-amber-950/20">
              <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <ClipboardList size={16} className="text-amber-400" />
                Descripción del Trabajo
              </h2>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                {workOrder.notes}
              </p>
            </div>
          )}

          {/* Detalles Técnicos */}
          {(workOrder?.ticket_info?.pppoe_username || 
            workOrder?.ticket_info?.plan_name || 
            workOrder?.ticket_info?.node_name) && (
            <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Wifi size={16} className="text-cyan-400" />
                Detalles Técnicos
              </h2>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {workOrder.ticket_info.pppoe_username && (
                  <div className="p-2 rounded bg-zinc-800/50">
                    <p className="text-zinc-500 mb-1">PPPoE</p>
                    <p className="font-mono text-zinc-200">
                      {workOrder.ticket_info.pppoe_username}
                    </p>
                  </div>
                )}

                {workOrder.ticket_info.plan_name && (
                  <div className="p-2 rounded bg-zinc-800/50">
                    <p className="text-zinc-500 mb-1">Plan</p>
                    <p className="text-zinc-200">
                      {workOrder.ticket_info.plan_name}
                      {workOrder.ticket_info.plan_speed && 
                        ` • ${workOrder.ticket_info.plan_speed}M`
                      }
                    </p>
                  </div>
                )}

                {workOrder.ticket_info.node_name && (
                  <div className="p-2 rounded bg-zinc-800/50 col-span-2">
                    <p className="text-zinc-500 mb-1">Nodo</p>
                    <p className="text-zinc-200">
                      {workOrder.ticket_info.node_name}
                      {workOrder.ticket_info.node_ip && 
                        ` • ${workOrder.ticket_info.node_ip}`
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: Operatividad */}
        <div className="space-y-4">
          {/* Beholder Widget (solo si NO es instalación) */}
          {workOrder?.ot_type !== 'install' && workOrder?.ticket_info?.pppoe_username && (
            <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Activity size={16} className="text-amber-400" />
                Diagnóstico Remoto (Beholder)
              </h2>

              <p className="text-xs text-zinc-500 mb-3">
                PPPoE: <span className="text-zinc-300 font-mono">{workOrder.ticket_info.pppoe_username}</span>
              </p>

              {/* Resultados del diagnóstico */}
              {beholderData && (
                <div className="mb-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 space-y-2">
                  {/* Estado PPPoE */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Estado PPPoE</span>
                    <Badge 
                      variant="outline" 
                      className={
                        beholderData.mikrotik?.active 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-xs'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs'
                      }
                    >
                      {beholderData.mikrotik?.active ? '🟢 Activo' : '🔴 Inactivo'}
                    </Badge>
                  </div>

                  {/* Cliente */}
                  {beholderData.cliente_nombre && beholderData.cliente_nombre !== 'No Vinculado' && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Cliente</span>
                      <span className="text-xs text-zinc-200">{beholderData.cliente_nombre}</span>
                    </div>
                  )}

                  {/* Plan */}
                  {beholderData.plan && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Plan</span>
                      <span className="text-xs text-zinc-200">{beholderData.plan}</span>
                    </div>
                  )}

                  {/* Nodo */}
                  {beholderData.nodo_nombre && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Nodo</span>
                      <span className="text-xs text-zinc-200">{beholderData.nodo_nombre}</span>
                    </div>
                  )}

                  {/* ONU Status */}
                  {beholderData.onu_status_smrt && !beholderData.onu_status_smrt.error && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">ONU</span>
                      <span className="text-xs text-zinc-200">{beholderData.onu_status_smrt.onu_status || 'N/A'}</span>
                    </div>
                  )}

                  {/* Señal óptica */}
                  {beholderData.onu_signal_smrt && !beholderData.onu_signal_smrt.error && beholderData.onu_signal_smrt.onu_signal_value && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Señal RX</span>
                      <span className="text-xs text-zinc-200">{beholderData.onu_signal_smrt.onu_signal_value} dBm</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {beholderError && (
                <div className="mb-3 p-2 rounded bg-rose-950/30 border border-rose-800/50">
                  <p className="text-xs text-rose-300">{beholderError}</p>
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckBeholder}
                disabled={isCompleted || beholderLoading}
                className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9"
              >
                {beholderLoading ? (
                  <>
                    <Loader size={14} className="mr-2 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Activity size={14} className="mr-2" />
                    {beholderData ? 'Actualizar Estado' : 'Verificar Estado'}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Materiales */}
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Package size={16} className="text-purple-400" />
                Materiales
              </h2>
              <span className="text-xs text-zinc-500">
                {workOrder?.items?.length || 0} items
              </span>
            </div>

            {workOrder?.items && workOrder.items.length > 0 ? (
              <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
                {workOrder.items.map((item) => (
                  <MaterialItem
                    key={item.id}
                    item={item}
                    onRemove={handleRemoveMaterial}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 text-center py-3 mb-3">
                Sin materiales agregados
              </p>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMaterialDialog(true)}
              disabled={isCompleted}
              className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9"
            >
              <Plus size={14} className="mr-1" />
              Agregar Material
            </Button>
          </div>
        </div>
      </div>

      {/* Material Dialog */}
      <Dialog open={showMaterialDialog} onOpenChange={setShowMaterialDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Agregar Material</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Producto ID (temporal)
              </label>
              <input
                type="number"
                value={materialForm.product_id}
                onChange={(e) => setMaterialForm((prev) => ({ ...prev, product_id: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                placeholder="Ej: 123"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Cantidad
              </label>
              <input
                type="number"
                min="1"
                value={materialForm.quantity}
                onChange={(e) => setMaterialForm((prev) => ({ ...prev, quantity: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Serial Number (opcional)
              </label>
              <input
                type="text"
                value={materialForm.serial_number}
                onChange={(e) => setMaterialForm((prev) => ({ ...prev, serial_number: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                placeholder="Ej: SN123456"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMaterialDialog(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddMaterial}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Completar Trabajo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Tipo de Resolución
              </label>
              <select
                value={completionForm.resolution_type}
                onChange={(e) =>
                  setCompletionForm((prev) => ({ ...prev, resolution_type: e.target.value }))
                }
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
              >
                <option value="success">✓ Exitosa</option>
                <option value="failed">✗ Fallida</option>
                <option value="partial">⊗ Parcial</option>
                <option value="rescheduled">↻ Reprogramada</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={completionForm.resolution_notes}
                onChange={(e) =>
                  setCompletionForm((prev) => ({ ...prev, resolution_notes: e.target.value }))
                }
                placeholder="Describe lo realizado, problemas encontrados, etc."
                rows="3"
                maxLength="500"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {completionForm.resolution_notes.length}/500
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCompletionDialog(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteWork}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? 'Guardando...' : 'Completar Trabajo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
