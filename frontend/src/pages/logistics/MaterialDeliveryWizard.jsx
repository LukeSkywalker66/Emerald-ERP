import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, Check, X, Loader, AlertCircle,
  Truck, Scan, Package, Users, ClipboardList, RefreshCw,
  CheckCircle, Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import * as logisticsService from '@/services/logistics.service';
import * as inventoryService from '@/services/inventory.service';
import { getTeams } from '@/services/coordination.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  BarcodeScanner,
  SerialScanner,
  ScannedSerialsList,
} from '@/components/barcode-reader';
import { useDeliveryScanner } from '@/hooks/useDeliveryScanner';

const STEPS = [
  { id: 1, label: 'Cuadrilla', icon: Users },
  { id: 2, label: 'Propuesta', icon: ClipboardList },
  { id: 3, label: 'Escanear', icon: Scan },
  { id: 4, label: 'Confirmar', icon: CheckCircle },
];

export default function MaterialDeliveryWizard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Data
  const [teams, setTeams] = useState([]);
  const [centralWarehouses, setCentralWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [delivery, setDelivery] = useState(null);

  // Step 1: Team + Warehouse selection
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedFromWarehouse, setSelectedFromWarehouse] = useState('');  // CENTRAL origen
  const [selectedWarehouse, setSelectedWarehouse] = useState('');  // MOBILE destino

  // Step 1: Selector de fechas
  const [scheduleDates, setScheduleDates] = useState([]);   // [{date, work_orders_count}]
  const [selectedDates, setSelectedDates] = useState([]);   // ['YYYY-MM-DD', ...]
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const t = new Date(); return { year: t.getFullYear(), month: t.getMonth() };
  });

  // Step 2: Proposal
  const [proposalItems, setProposalItems] = useState([]);
  const [proposalGenerated, setProposalGenerated] = useState(false);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [proposalEffectiveDate, setProposalEffectiveDate] = useState(null);
  const [proposalWorkOrdersCount, setProposalWorkOrdersCount] = useState(0);
  const [preparingDelivery, setPreparingDelivery] = useState(false);
  const [proposalConflict, setProposalConflict] = useState(null);

  // Step 3: Scan — usando máquina de estados inteligente
  const [scannedItems, setScannedItems] = useState([]);
  const [scanComplete, setScanComplete] = useState(false);

  // Máquina de estados inteligente para escaneo en delivery
  const deliveryScanner = useDeliveryScanner({
    proposalItems,
    deliveryId: delivery?.id || null,
    onItemScanned: (item) => {
      setScannedItems(prev => [...prev, item]);
    },
    onError: (msg) => setError(msg),
    onProposalConflict: useCallback((payload) => {
      return new Promise((resolve) => {
        setProposalConflict({
          message: payload?.message || 'El item no pertenece a la propuesta de entrega aceptada en el paso anterior, ¿Desea agregarlo de todas formas?',
          code: payload?.code || 'OUTSIDE_ACCEPTED_PROPOSAL',
          detail: payload?.detail || null,
          resolve,
        });
      });
    }, []),
    enabled: !scanComplete,
  });

  const handleScanCallback = useCallback((code) => {
    deliveryScanner.resolveScan(code);
  }, [deliveryScanner]);

  const requirementMap = {};
  (proposalItems || []).forEach(item => {
    const pid = item.product_id;
    if (!pid) return;
    const key = item.is_group_requirement && item.group_id != null
      ? `GROUP:${item.group_id}`
      : `PRODUCT:${pid}`;

    if (!requirementMap[key]) {
      requirementMap[key] = {
        quantity: 0,
        product_name: item.is_group_requirement && item.group_name
          ? `Grupo ${item.group_name}`
          : item.product_name,
        product_sku: item.product_sku,
      };
    }
    requirementMap[key].quantity += item.suggested_quantity || 0;
  });

  const scannedCountsByRequirement = {};
  (scannedItems || []).forEach(item => {
    const key = item.requirement_key || (item.product_group_id != null
      ? `GROUP:${item.product_group_id}`
      : `PRODUCT:${item.product_id}`);
    if (!key) return;
    scannedCountsByRequirement[key] = (scannedCountsByRequirement[key] || 0) + 1;
  });

  // Check if all proposed items have been scanned
  const allScanned = Object.keys(deliveryScanner.requiredCounts || {}).length > 0 &&
    Object.entries(deliveryScanner.requiredCounts || {}).every(([key, required]) => {
      const scanned = deliveryScanner.scannedCounts?.[key] || scannedCountsByRequirement[key] || 0;
      return scanned >= required;
    });
  const handleRemoveScanned = useCallback(async (item, idx) => {
    await deliveryScanner.removeScannedItem(item);
    setScannedItems(prev => prev.filter((_, i) => i !== idx));
  }, [deliveryScanner]);


  useEffect(() => {
    setScanComplete(allScanned);
  }, [allScanned]);

  // En escaneo, el banner de error no debe quedar fijo
  useEffect(() => {
    if (currentStep !== 3 || !error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [currentStep, error]);

  // Load initial data
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoading(true);
        const [whData, prodData, teamsData] = await Promise.all([
          inventoryService.getWarehouses(),
          inventoryService.getProducts(),
          getTeams({ active_only: true }),
        ]);

        setCentralWarehouses(whData.filter(w => w.type === 'CENTRAL') || []);
        setProducts(prodData || []);

        // Build team list from coordination API + match mobile warehouses
        const mobileWhs = whData.filter(w => w.type === 'MOBILE');
        const whByVehicleId = {};
        mobileWhs.forEach(w => {
          if (w.vehicle?.id) whByVehicleId[w.vehicle.id] = w;
        });

        const teamList = (teamsData || [])
          .filter(t => t.is_active !== false && t.vehicle_id)
          .map(t => {
            const wh = whByVehicleId[t.vehicle_id];
            return {
              id: t.id,
              name: t.name,
              warehouse_id: wh?.id || null,
              warehouse_name: wh?.name || 'Sin almacén',
              vehicle_name: wh?.vehicle?.name || `Vehículo #${t.vehicle_id}`,
            };
          })
          .filter(t => t.warehouse_id); // Solo teams con warehouse móvil asociado

        setTeams(teamList);

        if (isEdit && id) {
          const del = await logisticsService.getDelivery(id);
          setDelivery(del);
          setSelectedTeam(String(del.team_id));
          setSelectedWarehouse(String(del.warehouse_to_id));
          setProposalItems(del.items || []);
          if (del.items?.length > 0) setProposalGenerated(true);
          setCurrentStep(del.status === 'COMPLETED' ? 4 : 2);
        }
      } catch (err) {
        console.error('Error loading wizard data:', err);
        setError('Error al cargar datos iniciales');
      } finally {
        setLoading(false);
      }
    };
    loadInitial();
  }, [id, isEdit]);

  // Find selected team's mobile warehouse
  const selectedTeamData = teams.find(t => String(t.id) === selectedTeam);

  // Cargar fechas con OTs cuando cambia la cuadrilla seleccionada
  useEffect(() => {
    if (!selectedTeam) {
      setScheduleDates([]);
      setSelectedDates([]);
      setScheduleLoaded(false);
      setLoadingSchedule(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setScheduleLoaded(false);
      setLoadingSchedule(true);
      try {
        const result = await logisticsService.getTeamScheduleDates(parseInt(selectedTeam), 21);
        if (cancelled) return;
        setScheduleDates(result.dates || []);
        // Auto-seleccionar la primera fecha disponible
        if (result.dates && result.dates.length > 0) {
          setSelectedDates([result.dates[0].date]);
          // Centrar el calendario en el mes de la primera fecha
          const d = new Date(result.dates[0].date + 'T00:00:00');
          setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
        } else {
          setSelectedDates([]);
        }
      } catch (err) {
        if (!cancelled) console.error('Error cargando schedule:', err);
      } finally {
        if (!cancelled) {
          setLoadingSchedule(false);
          setScheduleLoaded(true);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedTeam]);

  // Toggle selección de una fecha
  const toggleDate = useCallback((dateStr) => {
    setSelectedDates(prev =>
      prev.includes(dateStr)
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr]
    );
  }, []);

  // Generate proposal
  const handleGenerateProposal = useCallback(async () => {
    if (!selectedTeam) return;
    setGeneratingProposal(true);
    setError(null);
    try {
      const params = { team_id: parseInt(selectedTeam) };
      if (selectedDates.length > 0) {
        params.dates = selectedDates;
      }
      const preview = await logisticsService.getProposalPreview(params);
      setProposalItems(preview.items || []);
      setProposalEffectiveDate(preview.effective_date || null);
      setProposalWorkOrdersCount(preview.work_orders_count || 0);
      setProposalGenerated(true);
    } catch (err) {
      console.error('Error generating proposal:', err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map(d => d.msg || d.message).join(', ')
        : err.message;
      setError('Error al generar la propuesta: ' + msg);
    } finally {
      setGeneratingProposal(false);
    }
  }, [selectedTeam, selectedDates]);

  // Invalidar propuesta cuando el usuario cambia las fechas seleccionadas
  useEffect(() => {
    setProposalGenerated(false);
    setProposalItems([]);
    setProposalEffectiveDate(null);
    setProposalWorkOrdersCount(0);
  }, [selectedDates]);

  // Auto-generar propuesta la primera vez que se entra al Step 2 (o si fue invalidada)
  useEffect(() => {
    if (currentStep === 2 && selectedTeam && !proposalGenerated) {
      handleGenerateProposal();
    }
  }, [currentStep, handleGenerateProposal, proposalGenerated]);

  // Update item quantity
  const handleQuantityChange = (index, newQty) => {
    const updated = [...proposalItems];
    updated[index] = { ...updated[index], suggested_quantity: Math.max(0, parseFloat(newQty) || 0) };
    setProposalItems(updated);
  };

  // Remove item from proposal
  const handleRemoveItem = (index) => {
    setProposalItems(proposalItems.filter((_, i) => i !== index));
  };

  // Add manual item
  const handleAddManualItem = () => {
    setProposalItems([...proposalItems, {
      product_id: '',
      product_name: '',
      product_sku: '',
      suggested_quantity: 1,
      is_manual: true,
    }]);
  };

  // Create and confirm delivery
  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let currentDelivery = delivery;

      // Create delivery if not exists
      if (!currentDelivery) {
        if (!selectedFromWarehouse) {
          throw new Error('Seleccioná el depósito de origen');
        }
        currentDelivery = await logisticsService.createDelivery({
          team_id: parseInt(selectedTeam),
          warehouse_from_id: parseInt(selectedFromWarehouse),
          warehouse_to_id: selectedTeamData?.warehouse_id,
          notes: '',
        });
      }

      // Generate proposal via API
      if (proposalItems.length > 0) {
        currentDelivery = await logisticsService.generateProposal(currentDelivery.id);
      }

      // Confirm delivery
      const result = await logisticsService.confirmDelivery(currentDelivery.id);
      setDelivery(result);
      setCurrentStep(4);
    } catch (err) {
      console.error('Error confirming delivery:', err);
      const detail3 = err.response?.data?.detail; const msg3 = typeof detail3 === 'string' ? detail3 : Array.isArray(detail3) ? detail3.map(d => d.msg || d.message).join(', ') : err.message || 'Error al confirmar entrega'; setError(msg3);
    } finally {
      setSubmitting(false);
    }
  };

  const closeProposalConflict = useCallback((accepted) => {
    if (!proposalConflict) return;
    proposalConflict.resolve(Boolean(accepted));
    setProposalConflict(null);
  }, [proposalConflict]);

  const ensureDeliveryDraft = useCallback(async () => {
    if (delivery?.id) return delivery;
    if (!selectedTeamData?.warehouse_id) {
      throw new Error('La cuadrilla seleccionada no tiene depósito móvil asociado');
    }
    if (!selectedFromWarehouse) {
      throw new Error('Seleccioná el depósito de origen');
    }

    const created = await logisticsService.createDelivery({
      team_id: parseInt(selectedTeam),
      warehouse_from_id: parseInt(selectedFromWarehouse),
      warehouse_to_id: selectedTeamData.warehouse_id,
      notes: '',
    });
    setDelivery(created);
    return created;
  }, [delivery, selectedFromWarehouse, selectedTeam, selectedTeamData]);

  const persistCurrentProposal = useCallback(async (targetDelivery) => {
    const deliveryId = targetDelivery?.id;
    if (!deliveryId) return targetDelivery;

    const refreshed = await logisticsService.getDelivery(deliveryId);
    const proposalSource = (refreshed.items || []).filter(i =>
      i.source === 'PROPOSAL' ||
      (i.source === 'MANUAL' && typeof i.notes === 'string' && i.notes.startsWith('GROUP_REQUIREMENT:'))
    );

    for (const item of proposalSource) {
      await logisticsService.removeDeliveryItem(deliveryId, item.id);
    }

    for (const item of proposalItems) {
      if (!item.product_id) continue;
      const qty = Number(item.suggested_quantity || 0);
      if (qty <= 0) continue;
      await logisticsService.addDeliveryItem(deliveryId, {
        product_id: item.product_id,
        quantity_proposed: qty,
        quantity_delivered: qty,
        is_serialized: item.product_type === 'SERIALIZED',
        source: 'PROPOSAL',
        notes: item.is_group_requirement
          ? `GROUP_REQUIREMENT:${item.group_id || ''}`
          : null,
      });
    }

    const synced = await logisticsService.getDelivery(deliveryId);
    setDelivery(synced);
    return synced;
  }, [proposalItems]);

  const handleNextStep = useCallback(async () => {
    if (currentStep !== 2) {
      setCurrentStep(currentStep + 1);
      return;
    }

    try {
      setPreparingDelivery(true);
      setError(null);
      const draft = await ensureDeliveryDraft();
      await persistCurrentProposal(draft);
      setCurrentStep(3);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map(d => d.msg || d.message).join(', ')
        : err.message || 'No se pudo preparar la entrega para el escaneo';
      setError(msg);
    } finally {
      setPreparingDelivery(false);
    }
  }, [currentStep, ensureDeliveryDraft, persistCurrentProposal]);

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedTeam && selectedWarehouse && selectedFromWarehouse &&
        scheduleLoaded && (scheduleDates.length === 0 || selectedDates.length > 0);
      case 2: return proposalGenerated || proposalItems.length > 0;
      case 3: return true;
      default: return true;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <Dialog
        open={Boolean(proposalConflict)}
        onOpenChange={(open) => {
          if (!open) closeProposalConflict(false);
        }}
      >
        <DialogContent
          className="bg-zinc-950 border-amber-600/40 max-w-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-amber-400">
              ⚠️ Ítem fuera de propuesta
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm text-zinc-300">
            <p>
              {proposalConflict?.message || 'El item no pertenece a la propuesta de entrega aceptada en el paso anterior, ¿Desea agregarlo de todas formas?'}
            </p>
            <p className="text-zinc-500">
              La propuesta guía el armado, pero la entrega puede incorporar materiales adicionales si el operador lo autoriza.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => closeProposalConflict(false)}
              className="px-4 py-2 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => closeProposalConflict(true)}
              className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              Agregar de todas formas
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400">
            {isEdit ? 'Editar Entrega' : 'Nueva Entrega de Materiales'}
          </h1>
          <p className="text-zinc-400 mt-1">
            {isEdit ? `Entrega #${id}` : 'Transferencia de materiales a cuadrilla'}
          </p>
        </div>
        <button
          onClick={() => navigate('/app/logistics/deliveries')}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>
      </div>

      {/* Steps Indicator */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center space-x-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  currentStep === step.id
                    ? 'bg-emerald-600 text-white'
                    : currentStep > step.id
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {currentStep > step.id ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                </div>
                <span className={`text-sm font-medium hidden md:inline ${
                  currentStep === step.id ? 'text-emerald-400' : 'text-zinc-500'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${
                  currentStep > step.id ? 'bg-emerald-600' : 'bg-zinc-800'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Team Selection */}
      {currentStep === 1 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
          <h2 className="text-xl font-bold text-white">Seleccionar Cuadrilla</h2>
          <p className="text-zinc-400 text-sm">
            Seleccioná la cuadrilla que recibirá los materiales. El sistema usará
            su almacén móvil asociado como destino.
          </p>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-zinc-300">Cuadrilla *</label>
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value);
                setScheduleLoaded(false);
                setLoadingSchedule(e.target.value !== '');
                setScheduleDates([]);
                setSelectedDates([]);
                const team = teams.find(t => String(t.id) === e.target.value);
                if (team) setSelectedWarehouse(String(team.warehouse_id));
              }}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Seleccionar cuadrilla...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} - {t.vehicle_name} ({t.warehouse_name})
                </option>
              ))}
            </select>

            {selectedTeamData && (
              <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center space-x-2 text-zinc-300">
                  <Truck className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium">{selectedTeamData.name}</span>
                </div>
                <p className="text-zinc-500 text-sm ml-6">
                  Vehículo: {selectedTeamData.vehicle_name} |
                  Almacén: {selectedTeamData.warehouse_name}
                </p>
              </div>
            )}

            {/* Depósito Origen */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Depósito de Origen *
              </label>
              <select
                value={selectedFromWarehouse}
                onChange={(e) => setSelectedFromWarehouse(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Seleccionar depósito...</option>
                {centralWarehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 mt-1">
                Depósito central desde donde se retirarán los materiales
              </p>
            </div>

            {/* Selector de fechas */}
            {selectedTeam && (
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <CalendarDays className="w-4 h-4 text-emerald-400" />
                  <label className="block text-sm font-medium text-zinc-300">
                    Días a preparar *
                  </label>
                  {loadingSchedule && <Loader className="w-3 h-3 text-zinc-500 animate-spin" />}
                </div>

                {loadingSchedule || !scheduleLoaded ? (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 flex items-center space-x-3 text-zinc-300">
                    <Loader className="w-4 h-4 animate-spin text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium">Consultando agenda de la cuadrilla</p>
                      <p className="text-xs text-zinc-500 mt-1">Buscando OTs programadas para los próximos 21 días.</p>
                    </div>
                  </div>
                ) : scheduleDates.length === 0 ? (
                  <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3 text-amber-300 text-sm">
                    Sin OTs programadas en los próximos 21 días para esta cuadrilla.
                  </div>
                ) : (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-4">

                    {/* Navegación del calendario */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setCalendarMonth(prev => {
                          const d = new Date(prev.year, prev.month - 1);
                          return { year: d.getFullYear(), month: d.getMonth() };
                        })}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-semibold text-zinc-200">
                        {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth(prev => {
                          const d = new Date(prev.year, prev.month + 1);
                          return { year: d.getFullYear(), month: d.getMonth() };
                        })}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Grilla del calendario */}
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const year = calendarMonth.year;
                      const month = calendarMonth.month;
                      const firstDay = new Date(year, month, 1).getDay(); // 0=Dom
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      // Índice de inicio lunes-first
                      const startOffset = (firstDay + 6) % 7;
                      const cells = [];
                      for (let i = 0; i < startOffset; i++) cells.push(null);
                      for (let d = 1; d <= daysInMonth; d++) cells.push(d);

                      // Mapa de fechas con OTs
                      const scheduleMap = {};
                      scheduleDates.forEach(s => { scheduleMap[s.date] = s.work_orders_count; });

                      const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

                      return (
                        <div>
                          <div className="grid grid-cols-7 mb-1">
                            {DAY_LABELS.map(l => (
                              <div key={l} className="text-center text-xs text-zinc-500 font-medium py-1">{l}</div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {cells.map((day, idx) => {
                              if (!day) return <div key={`e-${idx}`} />;
                              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const otCount = scheduleMap[dateStr] || 0;
                              const isSelected = selectedDates.includes(dateStr);
                              const cellDate = new Date(year, month, day);
                              const isPast = cellDate < today;
                              const isToday = cellDate.getTime() === today.getTime();
                              const hasOTs = otCount > 0;

                              return (
                                <button
                                  key={dateStr}
                                  type="button"
                                  disabled={isPast && !hasOTs}
                                  onClick={() => hasOTs ? toggleDate(dateStr) : undefined}
                                  title={hasOTs ? `${otCount} OT(s)` : undefined}
                                  className={[
                                    'relative rounded-md py-1.5 flex flex-col items-center justify-center text-xs font-medium transition-all',
                                    isPast && !hasOTs ? 'opacity-25 cursor-not-allowed text-zinc-600' : '',
                                    hasOTs && !isSelected ? 'bg-zinc-700 text-white hover:bg-zinc-600 cursor-pointer' : '',
                                    hasOTs && isSelected ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-1 ring-offset-zinc-800' : '',
                                    !hasOTs && !isPast ? 'text-zinc-500 cursor-default' : '',
                                    isToday && !isSelected ? 'ring-1 ring-amber-500' : '',
                                  ].join(' ')}
                                >
                                  <span>{day}</span>
                                  {hasOTs && (
                                    <span className={[
                                      'text-[9px] font-bold leading-none mt-0.5',
                                      isSelected ? 'text-emerald-200' : 'text-emerald-400',
                                    ].join(' ')}>
                                      {otCount} OT
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Chips de resumen + accesos rápidos */}
                    <div className="border-t border-zinc-700 pt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {/* Acceso rápido: cada fecha con OTs como chip */}
                        {scheduleDates.slice(0, 7).map(s => {
                          const d = new Date(s.date + 'T00:00:00');
                          const isSelected = selectedDates.includes(s.date);
                          const today = new Date(); today.setHours(0,0,0,0);
                          const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
                          const label = d.getTime() === today.getTime() ? 'Hoy'
                            : d.getTime() === tomorrow.getTime() ? 'Mañana'
                            : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
                          return (
                            <button
                              key={s.date}
                              type="button"
                              onClick={() => toggleDate(s.date)}
                              className={[
                                'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                                isSelected
                                  ? 'bg-emerald-600 border-emerald-500 text-white'
                                  : 'bg-zinc-700 border-zinc-600 text-zinc-300 hover:border-emerald-500',
                              ].join(' ')}
                            >
                              {label} · {s.work_orders_count} OT
                            </button>
                          );
                        })}
                      </div>
                      {selectedDates.length === 0 && (
                        <p className="text-xs text-amber-400">Seleccioná al menos un día para continuar.</p>
                      )}
                      {selectedDates.length > 0 && (
                        <p className="text-xs text-zinc-400">
                          {selectedDates.length} día(s) seleccionado(s) ·{' '}
                          {scheduleDates.filter(s => selectedDates.includes(s.date)).reduce((a, s) => a + s.work_orders_count, 0)} OT(s) total
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Proposal */}
      {currentStep === 2 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Propuesta de Materiales</h2>
              {proposalGenerated && (
                <p className="text-xs text-zinc-400 mt-1">
                  {proposalWorkOrdersCount} OT(s)
                  {proposalEffectiveDate && (
                    <> · <span className="text-emerald-400">{proposalEffectiveDate}</span></>
                  )}
                </p>
              )}
            </div>
            <button
              onClick={handleGenerateProposal}
              disabled={generatingProposal || !selectedTeam}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {generatingProposal ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Actualizar Propuesta</span>
            </button>
          </div>

          {!proposalGenerated && proposalItems.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              {generatingProposal ? (
                <p className="text-zinc-400">Calculando materiales necesarios...</p>
              ) : (
                <>
                  <p className="text-zinc-400">Calculando propuesta de materiales</p>
                  <p className="text-zinc-500 text-sm mt-2">
                    Basado en las OT programadas y las plantillas de materiales configuradas
                  </p>
                </>
              )}
            </div>
          ) : proposalGenerated && proposalItems.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-emerald-400 font-medium">Stock completo en el móvil</p>
              <p className="text-zinc-500 text-sm mt-1">
                Todos los materiales para las {proposalWorkOrdersCount} OT(s)
                {proposalEffectiveDate ? ` del ${proposalEffectiveDate}` : ''} ya están disponibles en el vehículo.
              </p>
              <p className="text-zinc-600 text-xs mt-3">Podés continuar o agregar productos manualmente.</p>
            </div>
          ) : (
            <>
              <div className="bg-zinc-800/50 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide bg-zinc-800/50">
                  <div className="col-span-4">Producto</div>
                  <div className="col-span-2">Disponible</div>
                  <div className="col-span-2">Requerido</div>
                  <div className="col-span-2">A Entregar</div>
                  <div className="col-span-2">Acción</div>
                </div>
                <div className="divide-y divide-zinc-800">
                  {proposalItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-zinc-800/30">
                      <div className="col-span-4">
                        <p className="text-white font-medium text-sm">
                          {item.is_group_requirement && item.group_name
                            ? `Grupo ${item.group_name}`
                            : (item.product_name || `Producto #${item.product_id}`)}
                        </p>
                        {item.product_sku && (
                          <code className="text-zinc-500 text-xs">{item.product_sku}</code>
                        )}
                        {item.is_group_requirement && item.suggested_model_name && (
                          <p className="text-zinc-500 text-xs mt-0.5">
                            Modelo sugerido: {item.suggested_model_name}
                          </p>
                        )}
                        {item.is_composite && item.suggested_composite_units ? (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/30 text-emerald-300 border border-emerald-800">
                              {item.suggested_composite_units} {item.composite_unit_label || 'unidad(es)'}
                            </span>
                            <span className="text-zinc-600 text-xs ml-2">
                              ({item.suggested_quantity} {item.unit_measure || 'unidades'})
                            </span>
                          </div>
                        ) : (
                          item.is_composite && item.composite_unit_label && (
                            <p className="text-zinc-500 text-xs mt-0.5">
                              {item.composite_unit_label} de {item.unit_size}{item.unit_measure}
                            </p>
                          )
                        )}
                      </div>
                      <div className="col-span-2">
                        <span className="text-zinc-400 text-sm">
                          {item.is_composite && item.unit_size
                            ? `${(item.available_in_mobile / item.unit_size).toFixed(1)}`
                            : (item.available_in_mobile || 0)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-zinc-400 text-sm">
                          {item.is_composite && item.unit_size
                            ? `${(item.required_total / item.unit_size).toFixed(1)}`
                            : (item.required_total || 0)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.is_composite && item.suggested_composite_units ? item.suggested_composite_units : item.suggested_quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (item.is_composite && item.unit_size) {
                              // Convert composite units to base units for storage
                              handleQuantityChange(idx, val * item.unit_size);
                            } else {
                              handleQuantityChange(idx, val);
                            }
                          }}
                          min="0"
                          step={item.is_composite ? "1" : "0.1"}
                          className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div className="col-span-2 flex space-x-2">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddManualItem}
                className="flex items-center space-x-2 text-emerald-400 hover:text-emerald-300 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar producto manualmente</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 3: Scan */}
      {currentStep === 3 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Escanear Códigos de Barra</h2>
              <p className="text-zinc-400 text-sm mt-1">
                {scanComplete
                  ? '✅ Todos los productos de la propuesta fueron escaneados.'
                  : `Escaneá los productos aceptados en el paso anterior (${Object.keys(requirementMap).length} requerimiento(s)).`
                }
              </p>
            </div>
            {scanComplete && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-900/30 text-emerald-300 border border-emerald-800">
                <CheckCircle className="w-4 h-4 mr-1" /> Completo
              </span>
            )}
          </div>

          {/* Proposal items tracking — con conteo X de Y */}
          {Object.keys(requirementMap).length > 0 && (
            <div className="bg-zinc-800/30 rounded-lg divide-y divide-zinc-800">
              {Object.entries(requirementMap).map(([reqKey, info]) => {
                const scanned = deliveryScanner.scannedCounts?.[reqKey] || scannedCountsByRequirement[reqKey] || 0;
                const required = deliveryScanner.requiredCounts?.[reqKey] || info.quantity || 1;
                const done = scanned >= required;
                return (
                  <div key={reqKey} className="flex items-center justify-between p-3">
                    <div className="flex items-center space-x-3">
                      {done ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : scanned > 0 ? (
                        <div className="w-5 h-5 rounded-full border-2 border-yellow-500/50 bg-yellow-500/20" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-zinc-600" />
                      )}
                      <div>
                        <p className="text-white text-sm">
                          {info.product_name}
                          <span className="text-zinc-500 ml-1">({scanned} de {required})</span>
                        </p>
                        {info.product_sku && (
                          <code className="text-zinc-500 text-xs">{info.product_sku}</code>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${done ? 'text-emerald-400' : scanned > 0 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                      {done ? 'Completo' : scanned > 0 ? 'Parcial' : 'Pendiente'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Barcode Scanner (reutilizable) — solo activo en IDLE */}
          <BarcodeScanner
            onScan={handleScanCallback}
            disabled={scanComplete || deliveryScanner.scanMode === 'WAITING_SERIAL'}
            placeholder={
              scanComplete ? 'Completado' :
              deliveryScanner.scanMode === 'WAITING_SERIAL' ? 'Escaneá el serial arriba...' :
              'Escanear o ingresar SKU...'
            }
            feedback={
              deliveryScanner.lastFeedback
                ? { type: deliveryScanner.lastFeedback.type, message: deliveryScanner.lastFeedback.message }
                : error ? { type: 'error', message: error } : null
            }
            autoFocus={!scanComplete && deliveryScanner.scanMode !== 'WAITING_SERIAL'}
          />

          {/* Serial Scanner — controlado por la máquina de estados */}
          {deliveryScanner.scanMode === 'WAITING_SERIAL' && (
            <SerialScanner
              productName={`${deliveryScanner.pendingProductName || ''} (${deliveryScanner.pendingRemaining || '?'} pend.)`}
              onScan={handleScanCallback}
              onCancel={() => deliveryScanner.reset()}
            />
          )}

          {/* Scanned Items List — con nombre, SKU y serial */}
          {scannedItems.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">Items Escaneados ({scannedItems.length})</h3>
              <div className="bg-zinc-800/30 rounded-lg divide-y divide-zinc-800 max-h-60 overflow-y-auto">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 group hover:bg-zinc-800/50">
                    <div className="flex items-center space-x-3 min-w-0">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">{item.product_name}</p>
                        <p className="text-zinc-500 text-xs truncate">
                          {item.product_sku && <code className="mr-2">{item.product_sku}</code>}
                          {item.serial_number && <span className="text-emerald-400">SN: {item.serial_number}</span>}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveScanned(item, idx)}
                      className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Scan className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-400">Usá la pistola lectora o ingresá el código manualmente</p>
              <p className="text-zinc-500 text-sm mt-2">
                Los productos escaneados aparecerán aquí
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Confirmation */}
      {currentStep === 4 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-2">
              {delivery?.status === 'COMPLETED' ? 'Entrega Completada' : 'Listo para Confirmar'}
            </h2>
            <p className="text-zinc-400">
              {delivery?.status === 'COMPLETED'
                ? 'Los materiales han sido transferidos exitosamente.'
                : 'Revisá el resumen antes de confirmar la transferencia.'}
            </p>
          </div>

          {delivery && (
            <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Entrega #</span>
                <span className="text-white font-mono">{delivery.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Cuadrilla</span>
                <span className="text-white">{delivery.team_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Items</span>
                <span className="text-white">{delivery.items?.length || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Estado</span>
                <span className="text-emerald-400 font-medium">
                  {delivery.status === 'COMPLETED' ? 'Completada' : 'Pendiente'}
                </span>
              </div>
            </div>
          )}

          {delivery?.items?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Items Transferidos</h3>
              <div className="bg-zinc-800/30 rounded-lg divide-y divide-zinc-800">
                {delivery.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-white text-sm">
                        {item.product_name || `Producto #${item.product_id}`}
                      </p>
                      {item.serial_number && (
                        <p className="text-zinc-500 text-xs">Serial: {item.serial_number}</p>
                      )}
                    </div>
                    <span className="text-zinc-300 font-medium">{item.quantity_delivered}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {delivery?.status !== 'COMPLETED' && (
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 text-lg font-semibold"
            >
              {submitting ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Confirmar y Transferir</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      {currentStep < 4 && (
        <div className="flex justify-between">
          <button
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/app/logistics/deliveries')}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{currentStep === 1 ? 'Cancelar' : 'Anterior'}</span>
          </button>
          <button
            onClick={handleNextStep}
            disabled={!canProceed() || preparingDelivery}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {preparingDelivery ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Preparando escaneo...</span>
              </>
            ) : (
              <span>Siguiente</span>
            )}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
