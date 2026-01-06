import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Play,
  Pause,
  X,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader,
  Clock,
  User,
  Zap,
  Package,
  MoreVertical,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import workOrdersService from '@/services/workOrders.service';

// ============ Timer Component ============
function Timer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    const updateElapsed = () => {
      const now = new Date();
      const start = new Date(startedAt);
      const diff = Math.floor((now - start) / 1000);
      setElapsed(Math.max(0, diff));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm">
      <Clock size={16} />
      <span>
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
        {String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}

// ============ Diagnostic Result Component ============
function DiagnosticResult({ result, loading, error }) {
  if (loading) {
    return (
      <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
        <Loader size={16} className="text-emerald-400 animate-spin" />
        <span className="text-sm text-zinc-300">Ejecutando diagnóstico...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg border border-ruby-800/50 bg-ruby-900/20 flex items-start gap-3">
        <AlertCircle size={16} className="text-ruby-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-ruby-300">Error en diagnóstico</p>
          <p className="text-xs text-ruby-200 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const isOnline = result.pppoe_status === 'online';
  const signalGood = parseFloat(result.optical_signal_dbm) > -20;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {/* PPPoE Status */}
        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-400 mb-1">PPPoE</p>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400' : 'bg-ruby-400'
              }`}
            />
            <p
              className={`text-sm font-medium ${
                isOnline ? 'text-emerald-300' : 'text-ruby-300'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Optical Signal */}
        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-400 mb-1">Señal óptica</p>
          <div className="flex items-center gap-2">
            <Zap
              size={14}
              className={signalGood ? 'text-emerald-400' : 'text-gold-400'}
            />
            <p className="text-sm font-medium text-zinc-200">
              {result.optical_signal_dbm} dBm
            </p>
          </div>
        </div>

        {/* Uptime */}
        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 col-span-2">
          <p className="text-xs text-zinc-400 mb-1">Uptime</p>
          <p className="text-sm font-medium text-zinc-200">
            {result.uptime_hours}h
          </p>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Última verificación:{' '}
        {new Date(result.last_check).toLocaleTimeString('es-AR')}
      </p>
    </div>
  );
}

// ============ Material Item Component ============
function MaterialItem({ item, onRemove, loading }) {
  return (
    <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-zinc-100">{item.serial_number || 'Sin serial'}</p>
        <p className="text-xs text-zinc-400 mt-1">
          Cant: <span className="text-zinc-300">{item.quantity}</span>
        </p>
        {item.notes && <p className="text-xs text-zinc-500 mt-1">{item.notes}</p>}
      </div>

      <button
        onClick={() => onRemove(item.id)}
        disabled={loading}
        className="p-1.5 hover:bg-zinc-800 rounded-md transition text-zinc-400 hover:text-ruby-400 disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// ============ Main Page ============
export default function WorkOrderExecutionPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // ---- State Management ----
  const [workOrder, setWorkOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Diagnostic
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState(null);
  const [diagnosticResult, setDiagnosticResult] = useState(null);

  // Material Dialog
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    product_id: '',
    quantity: 1,
    serial_number: '',
    notes: '',
  });
  const [submittingMaterial, setSubmittingMaterial] = useState(false);

  // Resolution Dialog
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [resolutionForm, setResolutionForm] = useState({
    resolution_type: 'success',
    resolution_notes: '',
  });
  const [submittingResolution, setSubmittingResolution] = useState(false);

  // Edit & Pause
  const [editMode, setEditMode] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "coordinator";
  const isInputsDisabled = workOrder?.completed_at && !editMode;
  // ---- Effects ----
  useEffect(() => {
    fetchWorkOrder();
  }, [id]);

  // ---- Handlers ----
  const fetchWorkOrder = async () => {
    try {
      setLoading(true);
      const data = await workOrdersService.getWorkOrderDetail(id);
      setWorkOrder(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al cargar OT');
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = async () => {
    try {
      setLoading(true);
      const updated = await workOrdersService.updateWorkOrder(id, {
        started_at: new Date().toISOString(),
      });
      setWorkOrder(updated);
    } catch (err) {
      setError(err.message || 'Error al iniciar OT');
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiagnostic = async () => {
    if (!workOrder?.ticket_info?.connection_id) {
      setDiagnosticError('No hay conexión asociada');
      return;
    }

    try {
      setDiagnosticLoading(true);
      setDiagnosticError(null);
      const result = await workOrdersService.runQuickDiagnostic(
        workOrder.ticket_info.connection_id
      );
      setDiagnosticResult(result);
    } catch (err) {
      setDiagnosticError(err.message || 'Error en diagnóstico');
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleAddMaterial = async () => {
    if (!materialForm.product_id) {
      alert('Selecciona un producto');
      return;
    }

    try {
      setSubmittingMaterial(true);
      const item = await workOrdersService.addWorkOrderItem(id, {
        product_id: parseInt(materialForm.product_id),
        quantity: parseInt(materialForm.quantity) || 1,
        serial_number: materialForm.serial_number || null,
        notes: materialForm.notes || null,
      });

      // Update local state
      setWorkOrder((prev) => ({
        ...prev,
        items: [...(prev.items || []), item],
      }));

      // Reset form
      setMaterialForm({
        product_id: '',
        quantity: 1,
        serial_number: '',
        notes: '',
      });
      setMaterialDialogOpen(false);
    } catch (err) {
      alert('Error al agregar material: ' + err.message);
    } finally {
      setSubmittingMaterial(false);
    }
  };

  const handleRemoveMaterial = async (itemId) => {
    if (!confirm('¿Eliminar material?')) return;

    try {
      await workOrdersService.removeWorkOrderItem(id, itemId);

      // Update local state
      setWorkOrder((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== itemId),
      }));
    } catch (err) {
      alert('Error al eliminar material: ' + err.message);
    }
  };

  const handleCompleteWork = async () => {
    if (!resolutionForm.resolution_type) {
      alert('Selecciona tipo de resolución');
      return;
    }

    try {
      setSubmittingResolution(true);
      const updated = await workOrdersService.updateWorkOrder(id, {
        completed_at: new Date().toISOString(),
        resolution_type: resolutionForm.resolution_type,
        resolution_notes: resolutionForm.resolution_notes || null,
      });

      setWorkOrder(updated);
      setResolutionDialogOpen(false);

      // Toast/notification
      setTimeout(() => {
        navigate('/app/tickets');
      }, 2000);
    } catch (err) {
      alert('Error al completar OT: ' + err.message);
    } finally {
      setSubmittingResolution(false);
    }
  };

  // ---- Render ----
  if (loading && !workOrder) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader className="text-emerald-400 animate-spin" size={40} />
      </div>
    );
  }

  if (error && !workOrder) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-ruby-400" size={40} />
          <p className="text-ruby-300 mb-4">{error}</p>
          <Button onClick={() => navigate(-1)} variant="outline">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  const isActive = workOrder?.started_at && !workOrder?.completed_at;
  const isCompleted = !!workOrder?.completed_at;

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* ===== Header ===== */}
      <div className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-zinc-900 rounded-lg transition"
          >
            <ChevronLeft className="text-emerald-400" size={24} />
          </button>

          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-white">
              Orden #{workOrder?.id}
            </h1>
            {workOrder?.ticket_info?.ticket_id && (
              <p className="text-xs text-zinc-400 mt-1">
                Ticket #{workOrder.ticket_info.ticket_id}
              </p>
            )}
          </div>

          <div className="w-10" /> {/* Balance flex */}
        </div>

        {/* Timer & Status Row */}
        <div className="flex items-center justify-between">
          {isActive ? (
            <Timer startedAt={workOrder.started_at} />
          ) : (
            <span className="text-xs text-zinc-500">
              {isCompleted ? '✓ Completada' : 'Pendiente'}
            </span>
          )}

          <Badge variant="emerald" className="font-medium">
            {workOrder?.ot_type?.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="px-4 py-4 space-y-6">
        {/* ===== Ticket Info Card ===== */}
        {workOrder?.ticket_info && (
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-2">
            <p className="text-xs text-zinc-400 font-medium">CLIENTE</p>
            <p className="text-base font-semibold text-white">
              {workOrder.ticket_info.client_name || 'Sin cliente'}
            </p>
            {workOrder.ticket_info.address && (
              <p className="text-sm text-zinc-300">
                {workOrder.ticket_info.address}
              </p>
            )}
            {workOrder.ticket_info.contact_phone && (
              <p className="text-sm text-emerald-400">
                {workOrder.ticket_info.contact_phone}
              </p>
            )}
          </div>
        )}

        {/* Banner: Sin Técnico Asignado */}
        {!workOrder?.technician_name && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-700/50 bg-amber-900/30 px-4 py-3 text-amber-200 text-sm">
            Esta orden requiere coordinación (sin técnico asignado).
          </div>
        )}

        {/* Cliente y Dirección con Mapa */}
        {workOrder?.ticket_info?.address && (
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-2 text-sm text-zinc-300 mb-2">
              <MapPin size={14} className="text-emerald-400" />
              <span className="font-medium">{workOrder.ticket_info.address}</span>
            </div>
            <button
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(workOrder.ticket_info.address)}`,
                  '_blank'
                )
              }
              className="text-xs text-emerald-400 hover:text-emerald-300 underline"
            >
              Ver en mapa
            </button>
          </div>
        )}

                {/* ===== Work Info Card ===== */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-3">
          {workOrder?.technician_name && (
            <div className="flex items-center gap-2">
              <User size={14} className="text-zinc-400" />
              <span className="text-sm text-zinc-300">
                Técnico: <span className="text-white font-medium">{workOrder.technician_name}</span>
              </span>
            </div>
          )}

          {workOrder?.scheduled_at && (
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-zinc-400" />
              <span className="text-sm text-zinc-300">
                Programada:{' '}
                <span className="text-white font-medium">
                  {new Date(workOrder.scheduled_at).toLocaleDateString('es-AR')}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ===== Diagnostic Section ===== */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">Diagnóstico</h2>
            <Badge variant="default" className="text-xs">
              Beholder
            </Badge>
          </div>

          <DiagnosticResult
            result={diagnosticResult}
            loading={diagnosticLoading}
            error={diagnosticError}
          />

          <Button
            onClick={handleRunDiagnostic}
            disabled={diagnosticLoading || isCompleted}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
          >
            {diagnosticLoading ? (
              <>
                <Loader size={16} className="animate-spin mr-2" />
                Ejecutando...
              </>
            ) : (
              <>
                <Zap size={16} className="mr-2" />
                Ejecutar Diagnóstico
              </>
            )}
          </Button>
        </div>

        {/* ===== Materials Section ===== */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white">Materiales Consumidos</h2>

          {workOrder?.items && workOrder.items.length > 0 ? (
            <div className="space-y-2">
              {workOrder.items.map((item) => (
                <MaterialItem
                  key={item.id}
                  item={item}
                  onRemove={handleRemoveMaterial}
                  loading={loading}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 text-center py-4">
              Sin materiales agregados
            </p>
          )}

          <Button
            onClick={() => setMaterialDialogOpen(true)}
            disabled={isCompleted}
            className="w-full h-12 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium rounded-lg"
          >
            <Plus size={16} className="mr-2" />
            Agregar Material
          </Button>
        </div>

        {/* ===== Action Buttons ===== */}
        <div className="space-y-2">
          {!isActive && !isCompleted && (
            <Button
              onClick={handleStartWork}
              disabled={loading}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-lg"
            >
              <Play size={18} className="mr-2" />
              Iniciar Trabajo
            </Button>
          )}

          {isActive && (
            <Button
              onClick={() => setResolutionDialogOpen(true)}
              className="w-full h-14 bg-gold-600 hover:bg-gold-700 text-zinc-950 font-bold text-base rounded-lg"
            >
              <CheckCircle size={18} className="mr-2" />
              Completar Trabajo
            </Button>
          )}

          {isCompleted && (
            <div className="p-4 rounded-lg border border-emerald-800/50 bg-emerald-900/20 text-center">
              <CheckCircle
                size={24}
                className="mx-auto text-emerald-400 mb-2"
              />
              <p className="text-sm font-medium text-emerald-300">
                Trabajo completado
              </p>
              <p className="text-xs text-emerald-200 mt-1">
                {workOrder.resolution_type?.replace(/_/g, ' ').toUpperCase()}
              </p>
              {workOrder.resolution_notes && (
                <p className="text-xs text-zinc-300 mt-2">
                  {workOrder.resolution_notes}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== Material Dialog ===== */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Agregar Material</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Producto ID
              </label>
              <input
                type="number"
                value={materialForm.product_id}
                onChange={(e) =>
                  setMaterialForm((prev) => ({
                    ...prev,
                    product_id: e.target.value,
                  }))
                }
                placeholder="Ej: 123"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Cantidad
              </label>
              <input
                type="number"
                value={materialForm.quantity}
                onChange={(e) =>
                  setMaterialForm((prev) => ({
                    ...prev,
                    quantity: e.target.value,
                  }))
                }
                min="1"
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
                onChange={(e) =>
                  setMaterialForm((prev) => ({
                    ...prev,
                    serial_number: e.target.value,
                  }))
                }
                placeholder="Ej: SN123456"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={materialForm.notes}
                onChange={(e) =>
                  setMaterialForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Observaciones..."
                rows="2"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setMaterialDialogOpen(false)}
              disabled={submittingMaterial}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddMaterial}
              disabled={submittingMaterial}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submittingMaterial ? 'Guardando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Resolution Dialog ===== */}
      <Dialog open={resolutionDialogOpen} onOpenChange={setResolutionDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Resolver Trabajo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Tipo de Resolución
              </label>
              <select
                value={resolutionForm.resolution_type}
                onChange={(e) =>
                  setResolutionForm((prev) => ({
                    ...prev,
                    resolution_type: e.target.value,
                  }))
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
                value={resolutionForm.resolution_notes}
                onChange={(e) =>
                  setResolutionForm((prev) => ({
                    ...prev,
                    resolution_notes: e.target.value,
                  }))
                }
                placeholder="Describe lo que se realizó, problemas encontrados, etc."
                rows="3"
                maxLength="500"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {resolutionForm.resolution_notes.length}/500
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setResolutionDialogOpen(false)}
              disabled={submittingResolution}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteWork}
              disabled={submittingResolution}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submittingResolution ? 'Guardando...' : 'Completar Trabajo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
