import React, { useState, useEffect } from 'react';
import {
  Undo2, ArrowLeft, Check, X, Loader, AlertCircle,
  Scan, Package, Users, CheckCircle, Plus, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as logisticsService from '@/services/logistics.service';
import * as inventoryService from '@/services/inventory.service';

const CONDITIONS = [
  { value: 'GOOD', label: 'Buen estado', color: 'bg-emerald-900/30 text-emerald-300' },
  { value: 'DEFECTIVE', label: 'Defectuoso', color: 'bg-yellow-900/30 text-yellow-300' },
  { value: 'DAMAGED', label: 'Dañado', color: 'bg-red-900/30 text-red-300' },
];

export default function MaterialReceiptWizard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [teams, setTeams] = useState([]);
  const [centralWarehouses, setCentralWarehouses] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptCreated, setReceiptCreated] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const whData = await inventoryService.getWarehouses();
        setCentralWarehouses(whData.filter(w => w.type === 'CENTRAL') || []);
        const mobileWhs = whData.filter(w => w.type === 'MOBILE');
        const teamList = mobileWhs
          .filter(w => w.vehicle?.team)
          .map(w => ({
            id: w.vehicle.team.id,
            name: w.vehicle.team.name,
            warehouse_id: w.id,
            warehouse_name: w.name,
            vehicle_name: w.vehicle?.name || '',
          }));
        setTeams(teamList);
      } catch (err) {
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selectedTeamData = teams.find(t => String(t.id) === selectedTeam);

  const handleScan = async () => {
    if (!barcodeInput.trim()) return;
    setError(null);
    try {
      const products = await inventoryService.getProducts({ search: barcodeInput.trim() });
      const product = products?.[0];
      if (!product) throw new Error('Producto no encontrado');
      setScannedItems([...scannedItems, {
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        quantity: 1,
        condition: 'GOOD',
        serial_number: '',
      }]);
      setBarcodeInput('');
    } catch (err) {
      setError(err.message || 'Error al escanear');
    }
  };

  const updateItem = (index, field, value) => {
    const items = [...scannedItems];
    items[index] = { ...items[index], [field]: value };
    setScannedItems(items);
  };

  const removeItem = (index) => {
    setScannedItems(scannedItems.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (!selectedTeam || scannedItems.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const team = selectedTeamData;
      const centralWh = centralWarehouses[0];
      const receipt = await logisticsService.createReceipt({
        team_id: parseInt(selectedTeam),
        warehouse_from_id: team?.warehouse_id,
        warehouse_to_id: centralWh?.id,
        notes: notes,
      });
      // Confirm to execute stock transfer
      const result = await logisticsService.confirmReceipt(receipt.id);
      setReceiptCreated(result);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error al confirmar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (receiptCreated) {
    return (
      <div className="space-y-6 p-6 max-w-3xl mx-auto">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <div className="w-20 h-20 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-blue-400 mb-2">Recepción Completada</h2>
          <p className="text-zinc-400 mb-6">Materiales recibidos y stock actualizado correctamente</p>
          <div className="bg-zinc-800/50 rounded-lg p-4 mb-6 max-w-sm mx-auto space-y-2">
            <div className="flex justify-between text-sm"><span className="text-zinc-400">Recepción #</span><span className="text-white font-mono">{receiptCreated.id}</span></div>
            <div className="flex justify-between text-sm"><span className="text-zinc-400">Cuadrilla</span><span className="text-white">{receiptCreated.team_name}</span></div>
            <div className="flex justify-between text-sm"><span className="text-zinc-400">Items</span><span className="text-white">{receiptCreated.items?.length || 0}</span></div>
          </div>
          <div className="flex justify-center space-x-3">
            <button onClick={() => navigate('/app/logistics/deliveries')}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg">Volver</button>
            <button onClick={() => { setReceiptCreated(null); setScannedItems([]); setSelectedTeam(''); setNotes(''); }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Nueva Recepción</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-blue-400">Recepción de Materiales</h1>
          <p className="text-zinc-400 mt-1">Devolución de materiales de cuadrillas al depósito central</p>
        </div>
        <button onClick={() => navigate('/app/logistics/deliveries')}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg flex items-center space-x-2">
          <ArrowLeft className="w-4 h-4" /><span>Volver</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Step 1: Team */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Users className="w-5 h-5 text-blue-400" />
          <span>1. Seleccionar Cuadrilla</span>
        </h2>
        <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white">
          <option value="">Seleccionar cuadrilla...</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name} - {t.vehicle_name}</option>
          ))}
        </select>
      </div>

      {/* Step 2: Scan Products */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Scan className="w-5 h-5 text-blue-400" />
          <span>2. Escanear Productos Devueltos</span>
        </h2>

        <div className="bg-zinc-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-zinc-300 mb-2">Código de Barra</label>
          <div className="flex space-x-2">
            <input type="text" value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="Escanear código o buscar por SKU..."
              className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              autoFocus
            />
            <button onClick={handleScan} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              <Scan className="w-5 h-5" />
            </button>
          </div>
        </div>

        {scannedItems.length > 0 && (
          <div className="bg-zinc-800/30 rounded-lg divide-y divide-zinc-800">
            {scannedItems.map((item, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Package className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-white font-medium text-sm">{item.product_name}</p>
                      <code className="text-zinc-500 text-xs">{item.product_sku}</code>
                    </div>
                  </div>
                  <button onClick={() => removeItem(idx)} className="p-1.5 text-zinc-500 hover:text-red-400 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Cantidad</label>
                    <input type="number" value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                      min="1" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-zinc-500 mb-1">Condición</label>
                    <div className="flex space-x-2">
                      {CONDITIONS.map(c => (
                        <button key={c.value}
                          onClick={() => updateItem(idx, 'condition', c.value)}
                          className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
                            item.condition === c.value
                              ? c.color + ' border border-current'
                              : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {scannedItems.length === 0 && (
          <div className="text-center py-8">
            <Undo2 className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400">Escané los productos que la cuadrilla está devolviendo</p>
            <p className="text-zinc-500 text-sm mt-2">Clasificá cada uno como bueno, defectuoso o dañado</p>
          </div>
        )}
      </div>

      {/* Step 3: Notes + Confirm */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-blue-400" />
          <span>3. Notas y Confirmación</span>
        </h2>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas sobre la recepción (opcional)..."
          rows="2" className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white resize-none" />
        <button onClick={handleConfirm} disabled={submitting || !selectedTeam || scannedItems.length === 0}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center space-x-2 text-lg font-semibold">
          {submitting ? (
            <><Loader className="w-5 h-5 animate-spin" /><span>Procesando...</span></>
          ) : (
            <><CheckCircle className="w-5 h-5" /><span>Confirmar Recepción</span></>
          )}
        </button>
      </div>
    </div>
  );
}
