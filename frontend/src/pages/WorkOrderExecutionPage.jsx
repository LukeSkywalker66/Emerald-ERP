import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  Users,
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
import * as inventoryService from '@/services/inventory.service';
import { useAuth } from '@/context/AuthContext';
import CloseWorkOrderDialog from '@/components/work-orders/CloseWorkOrderDialog';
import WorkOrderCompletedSummary from '@/components/work-orders/WorkOrderCompletedSummary';
import UpdateLocationModal from '@/components/ui/UpdateLocationModal';

// Mapeo de tipos de OT
const OT_TYPE_ICONS = {
  repair: { icon: Wrench, label: 'Soporte', color: 'text-emerald-400' },
  install: { icon: Home, label: 'Instalación', color: 'text-blue-400' },
  pickup: { icon: Package, label: 'Retiro', color: 'text-amber-400' },
  infrastructure: { icon: Zap, label: 'Infraestructura', color: 'text-purple-400' },
};

const PRIORITY_CONFIG = {
  critical: {
    label: 'Crítica',
    className: 'bg-rose-500/15 border-rose-500/50 text-rose-200',
  },
  high: {
    label: 'Alta',
    className: 'bg-amber-500/15 border-amber-500/50 text-amber-200',
  },
  medium: {
    label: 'Media',
    className: 'bg-blue-500/15 border-blue-500/50 text-blue-200',
  },
  low: {
    label: 'Baja',
    className: 'bg-zinc-700/60 border-zinc-600 text-zinc-200',
  },
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
  const location = useLocation();
  const { user } = useAuth();

  const needsInspection = Boolean(location.state?.needsInspection);
  const inspectionBlockMessage =
    location.state?.inspectionMessage || 'Complete la inspección del vehículo primero';

  // State
  const [workOrder, setWorkOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialogs
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Warehouse (inventario del técnico)
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [warehouseError, setWarehouseError] = useState(null);

  // Inventario (productos, stock, seriales)
  const [products, setProducts] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState(null);

  // Material form
  const [materialForm, setMaterialForm] = useState({
    product_id: '',
    quantity: 1,
    serial_number: '',
    notes: '',
  });

  // Completion form - Note: logic handled in CloseWorkOrderDialog
  // const [completionForm, setCompletionForm] = useState({
  //   resolution_type: 'success',
  //   resolution_notes: '',
  // });

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

  // Cargar warehouse + productos + stock cuando se abre el modal
  useEffect(() => {
    if (!showMaterialDialog || !user?.id) {
      console.log('⏭️ Skipping inventory load:', { showMaterialDialog, userId: user?.id });
      return;
    }

    let isCancelled = false;

    const loadInventoryData = async () => {
      try {
        console.log('🔄 Iniciando carga de inventario para user:', user.id, user.full_name);
        
        // Cargar warehouse del técnico
        setWarehouseLoading(true);
        setWarehouseError(null);
        setInventoryLoading(true);
        setInventoryError(null);

        const myWarehouse = await inventoryService.getMyWarehouse(user.id);
        console.log('📦 Warehouse obtenido:', myWarehouse);
        if (isCancelled) return;

        setCurrentWarehouse(myWarehouse || null);

        if (!myWarehouse) {
          console.warn('❌ No warehouse found for user:', user.id);
          setWarehouseError('No tienes una camioneta asignada. Contacta a coordinación.');
          setWarehouseLoading(false);
          setInventoryLoading(false);
          return;
        }

        // Cargar productos disponibles en el sistema
        const productsData = await inventoryService.getProducts();
        console.log('📦 Productos obtenidos:', productsData?.length, productsData);
        if (isCancelled) return;
        setProducts(productsData || []);

        // Cargar stock del warehouse del técnico
        const stockData = await inventoryService.getWarehouseStock(myWarehouse.id);
        console.log('💾 Stock obtenido:', stockData);
        if (isCancelled) return;
        setWarehouseStock(stockData);

        console.log(`✅ Inventario cargado para técnico ${user.full_name}:`, {
          warehouse: myWarehouse,
          productsCount: productsData?.length,
          stockItems: stockData?.items?.length,
        });
      } catch (err) {
        if (isCancelled) return;
        console.error('Error cargando inventario:', err);
        setInventoryError(err.message || 'Error al cargar el inventario. Intenta nuevamente.');
        setCurrentWarehouse(null);
        setWarehouseError(null);
      } finally {
        if (!isCancelled) {
          setWarehouseLoading(false);
          setInventoryLoading(false);
        }
      }
    };

    loadInventoryData();

    return () => {
      isCancelled = true;
    };
  }, [showMaterialDialog, user?.id]);

  const handleStartWork = async () => {
    try {
      setIsSubmitting(true);
      const updated = await workOrdersService.updateWorkOrder(id, {
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });
      setWorkOrder(updated);
    } catch (err) {
      if (err.response?.status === 423) {
        const reason = err.response?.headers?.['x-locked-reason'];
        if (reason === 'LOCKED_PAST_DATE') {
          alert('⛔ OT vencida. No se puede iniciar.\n\nUse el botón "Cerrar OT" para completarla o marcarla como no realizada.');
        } else if (reason === 'LOCKED_COMPLETED') {
          alert('🔒 OT ya completada. No se puede modificar.');
        } else {
          alert('🔒 OT bloqueada: ' + (err.response?.data?.detail || err.message));
        }
      } else {
        alert('Error al iniciar trabajo: ' + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar cambio de producto: detectar BULK vs SERIALIZED y cargar seriales disponibles
  const handleProductChange = (productId) => {
    const product = products.find((p) => p.id === parseInt(productId));
    setSelectedProduct(product);

    setMaterialForm((prev) => ({
      ...prev,
      product_id: productId,
      quantity: 1,
      serial_number: '',
    }));

    // Si es SERIALIZED, cargar seriales disponibles en el warehouse del técnico
    if (product && product.type === 'SERIALIZED' && warehouseStock) {
      const stockItem = warehouseStock.items?.find((item) => item.product_id === product.id);
      setAvailableSerials(stockItem?.serial_items || []);
      console.log(`🔢 Seriales disponibles para ${product.name}:`, stockItem?.serial_items);
    } else {
      setAvailableSerials([]);
    }
  };

  // Calcular cantidad máxima disponible según tipo de producto
  const getMaxQuantity = () => {
    if (!selectedProduct || !warehouseStock) return 0;

    if (selectedProduct.type === 'BULK') {
      const stockItem = warehouseStock.items?.find(
        (item) => item.product_id === selectedProduct.id
      );
      return stockItem?.quantity || 0;
    }

    // Para SERIALIZED, el máximo es la cantidad de seriales disponibles
    return availableSerials.length;
  };

  // Validar si el formulario tiene datos suficientes para agregar material
  const isAddMaterialValid = () => {
    if (!materialForm.product_id) return false;
    if (!selectedProduct) return false;
    if (!currentWarehouse) return false;

    if (selectedProduct.type === 'BULK') {
      const maxQty = getMaxQuantity();
      const qty = parseInt(materialForm.quantity) || 0;
      return qty > 0 && qty <= maxQty;
    }

    if (selectedProduct.type === 'SERIALIZED') {
      return !!materialForm.serial_number;
    }

    return false;
  };

  const handleAddMaterial = async () => {
    if (!isAddMaterialValid()) {
      alert('Verifica los datos del material (cantidad o serial)');
      return;
    }

    if (!currentWarehouse) {
      alert('No tienes una camioneta asignada. Contacta a coordinación.');
      return;
    }

    try {
      setIsSubmitting(true);
      const item = await workOrdersService.addWorkOrderItem(id, {
        product_id: parseInt(materialForm.product_id),
        quantity: selectedProduct.type === 'BULK' ? parseInt(materialForm.quantity) : 1,
        serial_number: selectedProduct.type === 'SERIALIZED' ? materialForm.serial_number : null,
        notes: materialForm.notes || null,
        warehouse_id: currentWarehouse.id,
      });

      // Refrescar OT completa para sincronizar cantidades y seriales
      await loadWorkOrder();

      // Recargar stock después de agregar material
      if (currentWarehouse) {
        const updatedStock = await inventoryService.getWarehouseStock(currentWarehouse.id);
        setWarehouseStock(updatedStock);
      }

      setMaterialForm({ product_id: '', quantity: 1, serial_number: '', notes: '' });
      setSelectedProduct(null);
      setAvailableSerials([]);
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

      // Recargar stock para mantener cantidades y seriales actualizados
      if (currentWarehouse) {
        const updatedStock = await inventoryService.getWarehouseStock(currentWarehouse.id);
        setWarehouseStock(updatedStock);

        if (selectedProduct?.type === 'SERIALIZED') {
          const stockItem = updatedStock.items?.find((itm) => itm.product_id === selectedProduct.id);
          setAvailableSerials(stockItem?.serial_items || []);
        }
      }
    } catch (err) {
      alert('Error al eliminar material: ' + err.message);
    }
  };

  const handleLocationSaved = async () => {
    await loadWorkOrder();
    setShowLocationModal(false);
  };

  const handleCloseWorkOrder = async () => {
    try {
      setIsSubmitting(true);
      const updated = await workOrdersService.getWorkOrderDetail(id);
      setWorkOrder(updated);
      setShowCloseDialog(false);

      setTimeout(() => navigate('/app/work-orders'), 1500);
    } catch (err) {
      console.error('[ERROR] Failed to reload WO after completion:', err);
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

  // OT vencida: scheduled_start superó el grace period de 5 minutos
  const isExpired = (() => {
    if (!workOrder?.scheduled_start) return false;
    if (isActive || isCompleted) return false;
    const scheduledDate = new Date(workOrder.scheduled_start);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    return scheduledDate < fiveMinAgo;
  })();
  const typeConfig = OT_TYPE_ICONS[workOrder?.ot_type] || OT_TYPE_ICONS.repair;
  const TypeIcon = typeConfig.icon;
  const rawPriority =
    typeof workOrder?.ticket_info?.priority === 'string'
      ? workOrder.ticket_info.priority
      : typeof workOrder?.priority === 'string'
        ? workOrder.priority
        : 'medium';
  const normalizedPriority = rawPriority.toLowerCase();
  const priority = PRIORITY_CONFIG[normalizedPriority] || PRIORITY_CONFIG.medium;
  const assignmentLabel = workOrder?.team_name || workOrder?.technician_name || 'sin asignar';
  const isTeamAssignment = Boolean(workOrder?.team_name);

  return (
    <div className="min-h-screen bg-zinc-950">
      {needsInspection && user?.role === 'tecnico' && (
        <div className="sticky top-0 z-[60] border-b border-amber-700/60 bg-amber-950/80 px-4 md:px-6 py-2">
          <p className="text-xs md:text-sm text-amber-200">
            🚐 Control de vehículo pendiente: podés revisar la OT y preparar materiales, pero no podés iniciar/completar hasta cargar la inspección.
          </p>
        </div>
      )}

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
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-zinc-500">
                    Ticket #{workOrder?.ticket_id}
                  </p>
                  <Badge variant="outline" className={`h-5 px-2 text-[10px] ${priority.className}`}>
                    Criticidad: {priority.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActive && <Timer startedAt={workOrder.started_at} />}

            {/* Badge: OT Vencida */}
            {isExpired && (
              <Badge variant="outline" className="bg-rose-500/15 border-rose-500/40 text-rose-300 h-9 px-3 gap-1.5">
                <AlertCircle size={14} />
                Vencida
              </Badge>
            )}

            {/* OT no iniciada ni completada: botón Iniciar + Cerrar OT si vencida */}
            {!isActive && !isCompleted && (
              <>
                <Button
                  size="sm"
                  onClick={handleStartWork}
                  disabled={isSubmitting || needsInspection || isExpired}
                  title={
                    needsInspection
                      ? inspectionBlockMessage
                      : isExpired
                        ? 'OT vencida. Use "Cerrar OT" para completarla o marcarla como no realizada.'
                        : 'Iniciar trabajo'
                  }
                  className={`h-9 ${isExpired ? 'bg-zinc-700 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  <Play size={14} className="mr-1" />
                  Iniciar
                </Button>

                {isExpired && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCloseDialog(true)}
                    className="h-9 border-emerald-700/50 text-emerald-300 hover:bg-emerald-950/30"
                    title="Abre el wizard de cierre (permite completar o marcar como no realizada)"
                  >
                    <CheckCircle2 size={14} className="mr-1" />
                    Cerrar OT
                  </Button>
                )}
              </>
            )}

            {isActive && (
              <Button
                size="sm"
                onClick={() => setShowCloseDialog(true)}
                disabled={needsInspection}
                title={needsInspection ? inspectionBlockMessage : 'Completar orden'}
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

              {/* Google Maps Button — always visible, grayed if no coordinates */}
              <div className="mt-3">
                {workOrder?.latitude && workOrder?.longitude ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${workOrder.latitude},${workOrder.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                               bg-zinc-900 text-emerald-400 border border-emerald-500/50
                               hover:shadow-[0_0_10px_rgba(52,211,153,0.5)]
                               transition-all duration-200 text-xs"
                  >
                    <MapPin size={14} />
                    Abrir en Google Maps
                  </a>
                ) : (
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                               bg-zinc-900/50 text-zinc-600 border border-zinc-700/50
                               cursor-not-allowed text-xs opacity-50"
                  >
                    <MapPin size={14} />
                    Abrir en Google Maps
                  </span>
                )}

                {/* Actualizar Ubicación — always visible */}
                <button
                  onClick={() => setShowLocationModal(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                             bg-zinc-900 text-amber-400 border border-amber-500/50
                             hover:shadow-[0_0_10px_rgba(251,191,36,0.3)]
                             transition-all duration-200 text-xs ml-2"
                >
                  <MapPin size={14} />
                  Actualizar Ubicación
                </button>
              </div>

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

          {/* Asignada a: (solo para admin/operator) */}
          {(user?.role === 'admin' || user?.role === 'operator') && (
            <div className="p-4 rounded-lg border border-emerald-800/50 bg-emerald-950/20">
              <p className="text-sm text-zinc-400 flex items-center gap-2">
                {isTeamAssignment ? (
                  <Users size={14} className="text-emerald-400" />
                ) : (
                  <User size={14} className="text-emerald-400" />
                )}
                <span className="text-zinc-500">Asignada a:</span>
                <span className="text-emerald-300 font-medium">
                  {assignmentLabel}
                </span>
              </p>
            </div>
          )}

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

          {/* Resumen de OT Completada */}
          {isCompleted && workOrder && (
            <div className="p-4 rounded-lg border border-emerald-700/30 bg-emerald-900/20">
              <h3 className="text-sm font-semibold text-white mb-4">Trabajo Completado</h3>
              <WorkOrderCompletedSummary workOrder={workOrder} />
            </div>
          )}
        </div>
      </div>

      {/* Material Dialog */}
      <Dialog open={showMaterialDialog} onOpenChange={setShowMaterialDialog}>
        <DialogContent
          className="bg-zinc-900 border-zinc-800 max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Agregar Material</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Loading indicator */}
            {(warehouseLoading || inventoryLoading) && (
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full" />
                Cargando inventario...
              </div>
            )}

            {/* Error messages */}
            {warehouseError && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-sm rounded-lg p-3 min-h-16 flex items-center">
                <div>
                  <p className="font-semibold">⚠️ Error de Warehouse</p>
                  <p className="text-xs mt-1">{warehouseError}</p>
                </div>
              </div>
            )}

            {inventoryError && (
              <div className="bg-amber-950/50 border border-amber-800 text-amber-200 text-sm rounded-lg p-3 min-h-16 flex items-center">
                <div>
                  <p className="font-semibold">⚠️ Error de Inventario</p>
                  <p className="text-xs mt-1">{inventoryError}</p>
                </div>
              </div>
            )}

            {/* Warehouse confirmation */}
            {!warehouseLoading && currentWarehouse && (
              <div className="bg-emerald-950/30 border border-emerald-800/50 text-emerald-200 text-xs rounded-lg p-3">
                📦 Stock de: <span className="font-semibold text-emerald-300">{currentWarehouse.name}</span>
              </div>
            )}

            {/* Producto - Dropdown real */}
            {!inventoryLoading && currentWarehouse && (
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-2">
                  Producto *
                </label>
                {products.length > 0 ? (
                  <select
                    value={materialForm.product_id}
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
                ) : (
                  <div className="text-xs text-zinc-500 p-2">No hay productos disponibles</div>
                )}
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
                  value={materialForm.quantity}
                  onChange={(e) => setMaterialForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Stock disponible: <span className="text-emerald-400 font-medium">{getMaxQuantity()} unidades</span>
                </p>
              </div>
            )}

            {/* Serial Number (solo para SERIALIZED) */}
            {selectedProduct && selectedProduct.type === 'SERIALIZED' && (
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-2">
                  Número de Serie *
                </label>
                {availableSerials.length > 0 ? (
                  <select
                    value={materialForm.serial_number}
                    onChange={(e) => setMaterialForm((prev) => ({ ...prev, serial_number: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecciona un serial...</option>
                    {availableSerials.map((serial) => (
                      <option key={serial.id} value={serial.serial_number}>
                        {serial.serial_number} - {serial.status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg text-amber-200 text-xs">
                    ⚠️ No hay seriales disponibles en tu inventario para este producto
                  </div>
                )}
                <p className="text-xs text-zinc-500 mt-1">
                  Disponibles: <span className="text-emerald-400 font-medium">{availableSerials.length}</span>
                </p>
              </div>
            )}

            {/* Notas (opcional) */}
            {selectedProduct && (
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={materialForm.notes}
                  onChange={(e) => setMaterialForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  rows={2}
                  placeholder="Observaciones sobre el material..."
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowMaterialDialog(false);
                setMaterialForm({ product_id: '', quantity: 1, serial_number: '', notes: '' });
                setSelectedProduct(null);
                setAvailableSerials([]);
              }}
              disabled={isSubmitting || warehouseLoading || inventoryLoading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddMaterial}
              disabled={!isAddMaterialValid() || isSubmitting || warehouseLoading || inventoryLoading}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Update Modal */}
      <UpdateLocationModal
        workOrderId={workOrder?.id}
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSaved={handleLocationSaved}
      />

      {/* Completion Dialog */}
      {/* Close Work Order Dialog (Wizard de 3 pasos) */}
      <CloseWorkOrderDialog
        workOrder={workOrder}
        isOpen={showCloseDialog}
        onClose={() => setShowCloseDialog(false)}
        onComplete={handleCloseWorkOrder}
        onMaterialsUpdated={loadWorkOrder}
      />
    </div>
  );
}
