import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, Check, X, Loader, AlertCircle,
  Truck, Scan, Package, Users, ClipboardList, RefreshCw,
  CheckCircle, Plus, Trash2,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import * as logisticsService from '@/services/logistics.service';
import * as inventoryService from '@/services/inventory.service';
import { getTeams } from '@/services/coordination.service';
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

  // Step 2: Proposal
  const [proposalItems, setProposalItems] = useState([]);
  const [proposalGenerated, setProposalGenerated] = useState(false);
  const [generatingProposal, setGeneratingProposal] = useState(false);

  // Step 3: Scan — usando máquina de estados inteligente
  const [barcodeInput, setBarcodeInput] = useState('');
  const [serialInput, setSerialInput] = useState('');
  const [scanningProduct, setScanningProduct] = useState(null);
  const [scannedItems, setScannedItems] = useState([]);
  const [scanComplete, setScanComplete] = useState(false);

  // Máquina de estados inteligente para escaneo en delivery
  const deliveryScanner = useDeliveryScanner({
    proposalItems,
    deliveryId: delivery?.id || null,
    onItemScanned: (item) => {
      setScannedItems(prev => [...prev, item]);
      setBarcodeInput('');
      setSerialInput('');
    },
    onError: (msg) => setError(msg),
    enabled: !scanComplete,
  });

  const handleScanCallback = useCallback((code) => {
    deliveryScanner.resolveScan(code);
  }, [deliveryScanner]);

  // Build proposal map: product_id -> { quantity, product_name }
  const proposalMap = {};
  (proposalItems || []).forEach(item => {
    const pid = item.product_id;
    if (!pid) return;
    if (!proposalMap[pid]) {
      proposalMap[pid] = {
        quantity: 0,
        product_name: item.product_name,
        product_sku: item.product_sku,
        is_composite: item.is_composite,
        unit_size: item.unit_size,
      };
    }
    proposalMap[pid].quantity += item.suggested_quantity || 0;
  });

  // Count scanned items per product
  const scannedCounts = {};
  (scannedItems || []).forEach(item => {
    const pid = item.product_id;
    if (!pid) return;
    scannedCounts[pid] = (scannedCounts[pid] || 0) + 1;
  });

  // Check if all proposed items have been scanned
  const allScanned = Object.keys(proposalMap).length > 0 &&
    Object.keys(proposalMap).every(pid => {
      const proposed = proposalMap[pid];
      // For composite: compare in base units
      const scanned = scannedCounts[pid] || 0;
      return scanned >= 1; // At least 1 unit scanned per product
    });

  // When all scanned, auto-set scanComplete
  if (allScanned && !scanComplete) {
    // Use setTimeout to avoid setState during render
    setTimeout(() => setScanComplete(true), 100);
  }

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

  // Generate proposal
  const handleGenerateProposal = async () => {
    if (!selectedTeam) return;
    setGeneratingProposal(true);
    setError(null);
    try {
      const preview = await logisticsService.getProposalPreview({
        team_id: parseInt(selectedTeam),
      });
      setProposalItems(preview.items || []);
      setProposalGenerated(true);
    } catch (err) {
      console.error('Error generating proposal:', err);
      const detail = err.response?.data?.detail; const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => d.msg || d.message).join(', ') : err.message; setError('Error al generar la propuesta: ' + msg);
    } finally {
      setGeneratingProposal(false);
    }
  };

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

  // Handle barcode scan
  const handleBarcodeScan = async () => {
    if (!barcodeInput.trim()) return;
    if (scanComplete) {
      setError('Todos los productos de la propuesta ya fueron escaneados.');
      return;
    }
    setError(null);
    try {
      let productId, productName, productSku, isSerialized;
      
      if (delivery?.id) {
        const result = await logisticsService.scanBarcode(delivery.id, {
          product_code: barcodeInput.trim(),
          quantity: 1,
        });
        productId = result.product_id;
        productName = result.product_name;
        productSku = result.product_sku;
        isSerialized = result.is_serialized;
      } else {
        const product = products.find(p =>
          p.sku.toUpperCase() === barcodeInput.trim().toUpperCase()
        );
        if (!product) throw new Error('Producto no encontrado');
        productId = product.id;
        productName = product.name;
        productSku = product.sku;
        isSerialized = product.type === 'SERIALIZED';
      }

      // Validar que el producto esté en la propuesta
      if (Object.keys(proposalMap).length > 0 && !proposalMap[productId]) {
        throw new Error(`'${productName}' no está en la propuesta. Agregalo desde el paso anterior.`);
      }

      // Validar que no se exceda la cantidad propuesta
      const currentScanned = scannedCounts[productId] || 0;
      if (currentScanned >= 1) {
        throw new Error(`'${productName}' ya fue escaneado. No se puede escanear más de lo propuesto.`);
      }

      if (isSerialized) {
        setScanMode('serial');
        setScanningProduct({ product_id: productId, product_name: productName, product_sku: productSku });
      } else {
        setScannedItems([...scannedItems, {
          product_id: productId,
          product_name: productName,
          product_sku: productSku,
          is_serialized: false,
          scanned: true,
        }]);
      }
      setBarcodeInput('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map(d => d.msg || d.message).join(', ')
        : err.message || 'Error al escanear';
      setError(msg);
    }
  };

  // Handle serial scan
  const handleSerialScan = async () => {
    if (!serialInput.trim() || !scanningProduct) return;
    setError(null);
    try {
      if (delivery?.id) {
        const result = await logisticsService.scanSerial(delivery.id, {
          product_id: scanningProduct.product_id,
          serial_number: serialInput.trim(),
        });
        setScannedItems([...scannedItems, {
          ...scanningProduct,
          serial_number: serialInput.trim(),
          scanned: true,
        }]);
      } else {
        setScannedItems([...scannedItems, {
          ...scanningProduct,
          serial_number: serialInput.trim(),
          scanned: true,
        }]);
      }
      setSerialInput('');
      setScanMode('barcode');
      setScanningProduct(null);
    } catch (err) {
      const detail2 = err.response?.data?.detail; const msg2 = typeof detail2 === 'string' ? detail2 : Array.isArray(detail2) ? detail2.map(d => d.msg || d.message).join(', ') : err.message || 'Error al escanear serial'; setError(msg2);
    }
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

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedTeam && selectedWarehouse && selectedFromWarehouse;
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
          </div>
        </div>
      )}

      {/* Step 2: Proposal */}
      {currentStep === 2 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Propuesta de Materiales</h2>
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
              <span>{proposalGenerated ? 'Actualizar Propuesta' : 'Generar Propuesta'}</span>
            </button>
          </div>

          {!proposalGenerated && proposalItems.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-400">Presioná "Generar Propuesta" para calcular los materiales necesarios</p>
              <p className="text-zinc-500 text-sm mt-2">
                Basado en las OT programadas y las plantillas de materiales configuradas
              </p>
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
                          {item.product_name || `Producto #${item.product_id}`}
                        </p>
                        {item.product_sku && (
                          <code className="text-zinc-500 text-xs">{item.product_sku}</code>
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
                  : `Escaneá los productos aceptados en el paso anterior (${Object.keys(proposalMap).length} producto(s)).`
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
          {Object.keys(proposalMap).length > 0 && (
            <div className="bg-zinc-800/30 rounded-lg divide-y divide-zinc-800">
              {Object.entries(proposalMap).map(([pid, info]) => {
                const scanned = deliveryScanner.scannedCounts?.[pid] || scannedCounts[pid] || 0;
                const required = deliveryScanner.requiredCounts?.[pid] || info.quantity || 1;
                const done = scanned >= required;
                return (
                  <div key={pid} className="flex items-center justify-between p-3">
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
                      onClick={() => setScannedItems(prev => prev.filter((_, i) => i !== idx))}
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
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canProceed()}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            <span>Siguiente</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
