import React, { useState, useEffect, useCallback } from 'react';
import { NotebookPen, Loader, CheckCircle2, AlertCircle } from 'lucide-react';
import workOrdersService from '@/services/workOrders.service';
import useMaterialSelector from './useMaterialSelector';

const UPDATE_TYPE_LABELS = {
  MATERIALS_ADDED: 'Material agregado',
  MATERIALS_REMOVED: 'Material quitado',
  MATERIALS_REPLACED: 'Material reemplazado',
  MATERIALS_QTY_UPDATED: 'Cantidad corregida',
  INFO_CORRECTION: 'Corrección de información',
  CLOSE_CORRECTION: 'Corrección del cierre',
  NOTE: 'Nota',
};

const UPDATE_TYPES = [
  { value: 'MATERIALS_ADDED', label: 'Agregar material olvidado' },
  { value: 'MATERIALS_REMOVED', label: 'Quitar material erróneo' },
  { value: 'MATERIALS_QTY_UPDATED', label: 'Corregir cantidad' },
  { value: 'MATERIALS_REPLACED', label: 'Reemplazar material' },
  { value: 'INFO_CORRECTION', label: 'Corregir información' },
  { value: 'CLOSE_CORRECTION', label: 'Corregir el cierre' },
  { value: 'NOTE', label: 'Nota / aclaración' },
];

const STATUS_LABELS = {
  APPLIED: 'Aplicada',
  PROPOSED: 'Propuesta',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const EMPTY_FORM = {
  update_type: 'NOTE',
  motive: '',
  work_order_item_id: '',
  new_quantity: '',
};

/**
 * Panel de bitácora post-cierre (P2).
 * Permite manipulación total de materiales: agregar, quitar, corregir cantidad y
 * reemplazar. La selección de productos/seriales reusa useMaterialSelector (misma
 * operatoria que el cierre: combo de seriales disponibles en el móvil).
 */
export default function WorkOrderUpdatesPanel({ workOrderId, workOrderStatus }) {
  const canUpdate = workOrderStatus === 'completed' || workOrderStatus === 'failed';
  const [updates, setUpdates] = useState([]);
  const [woItems, setWoItems] = useState([]);
  const [woMeta, setWoMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const materialState = useMaterialSelector(workOrderId, {
    teamId: woMeta?.team_id ?? null,
    technicianId: woMeta?.technician_id ?? null,
  });

  const loadUpdates = useCallback(async () => {
    if (!workOrderId) return;
    setLoading(true);
    try {
      const data = await workOrdersService.getWorkOrderUpdates(workOrderId);
      setUpdates(data?.updates || []);
    } catch {
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  const loadWoDetail = useCallback(async () => {
    if (!workOrderId) return;
    try {
      const detail = await workOrdersService.getWorkOrderDetail(workOrderId);
      setWoItems(detail?.items || []);
      setWoMeta({
        team_id: detail?.team_id ?? null,
        technician_id: detail?.technician_id ?? null,
      });
    } catch {
      setWoItems([]);
    }
  }, [workOrderId]);

  useEffect(() => {
    loadUpdates();
    loadWoDetail();
  }, [loadUpdates, loadWoDetail]);

  useEffect(() => {
    if (woMeta) {
      materialState.loadInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woMeta?.team_id, woMeta?.technician_id]);

  const selectedProduct = materialState.selectedProduct;
  const selectedRemoveItem = woItems.find((i) => i.id === parseInt(form.work_order_item_id, 10));

  const selectedNeedsSerial = !!selectedProduct && (
    selectedProduct.type === 'SERIALIZED'
    || (selectedProduct.type === 'BULK' && selectedProduct.is_composite)
  );

  const itemLabel = (item) => {
    const name = item.product_name || `Producto ${item.product_id}`;
    const serial = item.serial_number ? ` · ${item.serial_number}` : '';
    return `${name} (x${item.quantity})${serial}`;
  };

  const handleSubmit = async () => {
    if (!form.motive || form.motive.trim().length < 5) {
      setFeedback({ type: 'error', text: 'El motivo es obligatorio (mínimo 5 caracteres)' });
      return;
    }

    const needsNewMaterial = form.update_type === 'MATERIALS_ADDED' || form.update_type === 'MATERIALS_REPLACED';
    if (needsNewMaterial) {
      const qty = materialState.form.quantity;
      if (!materialState.form.product_id || qty === '' || qty === null || qty === undefined) {
        setFeedback({ type: 'error', text: 'Indicá producto y cantidad para el material' });
        return;
      }
      if (selectedNeedsSerial && !materialState.form.serial_number) {
        setFeedback({ type: 'error', text: 'Seleccioná el serial o unidad disponible' });
        return;
      }
    }

    let payloadField = null;

    if (form.update_type === 'MATERIALS_ADDED') {
      payloadField = {
        product_id: parseInt(materialState.form.product_id, 10),
        quantity: parseFloat(materialState.form.quantity),
        serial_number: selectedNeedsSerial ? materialState.form.serial_number : null,
      };
    } else if (form.update_type === 'MATERIALS_REMOVED') {
      if (!form.work_order_item_id) {
        setFeedback({ type: 'error', text: 'Seleccioná el material a quitar' });
        return;
      }
      payloadField = { work_order_item_id: parseInt(form.work_order_item_id, 10) };
    } else if (form.update_type === 'MATERIALS_QTY_UPDATED') {
      if (!form.work_order_item_id || form.new_quantity === '' || form.new_quantity === null) {
        setFeedback({ type: 'error', text: 'Seleccioná el material e indicá la cantidad correcta' });
        return;
      }
      const newQty = parseFloat(form.new_quantity);
      if (!(newQty > 0)) {
        setFeedback({ type: 'error', text: 'La cantidad correcta debe ser mayor a 0' });
        return;
      }
      payloadField = {
        work_order_item_id: parseInt(form.work_order_item_id, 10),
        new_quantity: newQty,
      };
    } else if (form.update_type === 'MATERIALS_REPLACED') {
      if (!form.work_order_item_id) {
        setFeedback({ type: 'error', text: 'Seleccioná el material a reemplazar' });
        return;
      }
      payloadField = {
        remove_work_order_item_id: parseInt(form.work_order_item_id, 10),
        product_id: parseInt(materialState.form.product_id, 10),
        quantity: parseFloat(materialState.form.quantity),
        serial_number: selectedNeedsSerial ? materialState.form.serial_number : null,
      };
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      await workOrdersService.createWorkOrderUpdate(workOrderId, {
        update_type: form.update_type,
        motive: form.motive.trim(),
        payload: payloadField,
      });
      setForm(EMPTY_FORM);
      materialState.resetForm();
      await loadUpdates();
      await loadWoDetail();
      setFeedback({ type: 'success', text: 'Actualización registrada y aplicada en inventario' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Error al registrar actualización' });
    } finally {
      setSubmitting(false);
    }
  };

  const needsItemSelector =
    form.update_type === 'MATERIALS_REMOVED' ||
    form.update_type === 'MATERIALS_QTY_UPDATED' ||
    form.update_type === 'MATERIALS_REPLACED';

  const needsNewMaterialFields =
    form.update_type === 'MATERIALS_ADDED' || form.update_type === 'MATERIALS_REPLACED';

  const unitLabel = (() => {
    const raw = (selectedProduct?.unit_measure || '').trim().toLowerCase();
    if (!raw) return 'u.';
    if (['m', 'mts', 'metros', 'metro'].includes(raw)) return 'm';
    if (['units', 'unit', 'pcs', 'pieces', 'piece'].includes(raw)) return 'u.';
    return selectedProduct?.unit_measure || 'u.';
  })();

  return (
    <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <NotebookPen size={16} className="text-cyan-400" />
        Bitácora post-cierre
      </h2>

      {feedback && (
        <div
          className={`mb-3 p-2 rounded border text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-200'
              : 'bg-rose-950/30 border-rose-700/50 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="inline mr-1" size={14} /> : <AlertCircle className="inline mr-1" size={14} />}
          {feedback.text}
        </div>
      )}

      {/* Lista de entradas */}
      <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-4 text-zinc-500">
            <Loader size={16} className="animate-spin mr-2" />
            Cargando...
          </div>
        ) : updates.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-3">Sin actualizaciones registradas</p>
        ) : (
          updates.map((u) => (
            <div key={u.id} className="p-2 rounded bg-zinc-800/50 border border-zinc-700 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-200 font-medium">
                  {UPDATE_TYPE_LABELS[u.update_type] || u.update_type}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] ${
                    u.status === 'APPLIED' || u.status === 'APPROVED'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : u.status === 'REJECTED'
                        ? 'bg-rose-500/10 text-rose-300'
                        : 'bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {STATUS_LABELS[u.status] || u.status}
                </span>
              </div>
              <p className="text-zinc-400 mt-1">{u.motive}</p>
            </div>
          ))
        )}
      </div>

      {/* Formulario de nueva entrada (solo con OT cerrada) */}
      {canUpdate ? (
      <div className="space-y-2 border-t border-zinc-700 pt-3">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Tipo de actualización</label>
          <select
            value={form.update_type}
            onChange={(e) => setForm((p) => ({ ...p, update_type: e.target.value }))}
            className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            {UPDATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {needsItemSelector && (
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              {form.update_type === 'MATERIALS_REMOVED'
                ? 'Material a quitar'
                : form.update_type === 'MATERIALS_QTY_UPDATED'
                  ? 'Material a corregir'
                  : 'Material a reemplazar'}
            </label>
            <select
              value={form.work_order_item_id}
              onChange={(e) => setForm((p) => ({ ...p, work_order_item_id: e.target.value }))}
              className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Seleccioná un material de la OT...</option>
              {woItems.map((i) => (
                <option key={i.id} value={i.id}>{itemLabel(i)}</option>
              ))}
            </select>
            {woItems.length === 0 && (
              <p className="text-[10px] text-zinc-500 mt-1">La OT no tiene materiales registrados.</p>
            )}
          </div>
        )}

        {form.update_type === 'MATERIALS_QTY_UPDATED' && (
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Cantidad correcta</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.new_quantity}
              onChange={(e) => setForm((p) => ({ ...p, new_quantity: e.target.value }))}
              placeholder={selectedRemoveItem ? `Registrada: ${selectedRemoveItem.quantity}` : 'Nueva cantidad'}
              className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Solo aplica a materiales a granel (cable, conectores, bobinas).</p>
          </div>
        )}

        {needsNewMaterialFields && (
          <>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {form.update_type === 'MATERIALS_REPLACED' ? 'Material correcto (nuevo)' : 'Producto'}
              </label>
              <select
                value={materialState.form.product_id}
                onChange={(e) => materialState.handleProductChange(e.target.value)}
                className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Seleccioná un producto...</option>
                {materialState.products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={materialState.form.quantity}
                onChange={(e) =>
                  materialState.setForm((prev) => ({ ...prev, quantity: e.target.value }))
                }
                placeholder="Cantidad"
                className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              />

              {selectedNeedsSerial && (
                materialState.availableSerials.length > 0 ? (
                  <select
                    value={materialState.form.serial_number}
                    onChange={(e) =>
                      materialState.setForm((prev) => ({ ...prev, serial_number: e.target.value }))
                    }
                    className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Serial/unidad...</option>
                    {materialState.availableSerials.map((s) => (
                      <option key={s.id} value={s.serial_number}>
                        {s.serial_number}
                        {selectedProduct?.is_composite
                          ? ` — ${s.remaining_quantity ?? s.initial_quantity ?? '?'} ${unitLabel}`
                          : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-2 py-2 bg-amber-950/30 border border-amber-700/50 rounded text-[11px] text-amber-200">
                    Sin seriales disponibles en el móvil
                  </div>
                )
              )}
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Motivo *</label>
          <textarea
            value={form.motive}
            onChange={(e) => setForm((p) => ({ ...p, motive: e.target.value }))}
            rows={2}
            placeholder="Explicá el motivo de la corrección"
            className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-xs disabled:opacity-50"
        >
          {submitting ? 'Registrando...' : 'Registrar actualización'}
        </button>
      </div>
      ) : (
        <p className="text-xs text-zinc-500 text-center py-3 border-t border-zinc-700 mt-3">
          Disponible al completar la OT (completada o no realizada).
        </p>
      )}
    </div>
  );
}
