import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Package, ClipboardList, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import * as workOrderTypesService from '@/services/workOrderTypes.service';
import * as inventoryService from '@/services/inventory.service';
import { getProductGroups } from '@/services/inventory.service';

/**
 * WOTemplatesTab - Admin panel for work order material templates.
 * Part of the Settings page (Etapa 5).
 * Supports both specific products and product groups (e.g., "ONU/ONT").
 */
export default function WOTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [products, setProducts] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [otTypes, setOtTypes] = useState([]);
  const [woActions, setWoActions] = useState([]);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    ot_type: '',
    action_code: '',
    is_active: true,
    items: [],
  });

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const [data, prods, groups, types, actions] = await Promise.all([
        workOrderTypesService.getWOTemplates(),
        inventoryService.getProducts().catch(() => []),
        getProductGroups().catch(() => []),
        workOrderTypesService.getWorkOrderTypes(false).catch(() => []),
        workOrderTypesService.getWOActions().catch(() => []),
      ]);
      setTemplates(data || []);
      setProducts(prods || []);
      setProductGroups(groups || []);
      setOtTypes(types || []);
      setWoActions(actions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const resetForm = () => setForm({
    name: '', description: '', ot_type: '', action_code: '', is_active: true, items: [],
  });

  const startEdit = (tmpl) => {
    setEditingId(tmpl.id);
    setForm({
      name: tmpl.name,
      description: tmpl.description || '',
      ot_type: tmpl.ot_type || '',
      action_code: tmpl.action_code || '',
      is_active: tmpl.is_active,
      items: (tmpl.items || []).map((i) => ({
        product_id: i.product_id || '',
        group_id: i.group_id || '',
        default_quantity: i.default_quantity,
        required: i.required,
        sort_order: i.sort_order,
        notes: i.notes || '',
      })),
    });
  };

  const handleSave = async () => {
    try {
      // Validate items have at least product_id or group_id
      const invalidItems = form.items.filter(
        i => (!i.product_id || i.product_id === '') && (!i.group_id || i.group_id === '')
      );
      if (invalidItems.length > 0) {
        alert('Cada item debe tener seleccionado un producto O un grupo. Corregí los items marcados.');
        return;
      }
      // Build payload: convert empty strings to null for optional fields
      const payload = {
        ...form,
        items: form.items.map((item) => ({
          ...item,
          product_id: item.product_id ? parseInt(item.product_id) : null,
          group_id: item.group_id ? parseInt(item.group_id) : null,
        })),
      };
      if (editingId) {
        await workOrderTypesService.updateWOTemplate(editingId, payload);
      } else {
        await workOrderTypesService.createWOTemplate(payload);
      }
      resetForm();
      setEditingId(null);
      await loadTemplates();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    try {
      await workOrderTypesService.deleteWOTemplate(id);
      await loadTemplates();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: '', group_id: '', default_quantity: 1, required: false, sort_order: prev.items.length, notes: '' }],
    }));
  };

  const updateItem = (idx, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      // If selecting a group, clear product and vice versa
      if (field === 'group_id' && value) items[idx].product_id = '';
      if (field === 'product_id' && value) items[idx].group_id = '';
      return { ...prev, items };
    });
  };

  const removeItem = (idx) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-emerald-400" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <ClipboardList size={16} className="text-emerald-400" />
          {editingId ? 'Editar Plantilla' : 'Nueva Plantilla'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre (ej: Instalación FTTH Mínima)"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
          />
          <select
            value={form.ot_type}
            onChange={(e) => setForm({ ...form, ot_type: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
          >
            <option value="">Todos los tipos de OT</option>
            {otTypes.filter(t => t.is_active).map((type) => (
              <option key={type.id} value={type.code}>
                {type.name}
              </option>
            ))}
          </select>
          <select
            value={form.action_code}
            onChange={(e) => setForm({ ...form, action_code: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
          >
            <option value="">Todas las acciones</option>
            {woActions
              .filter(a => a.is_active && (!form.ot_type || a.ot_type === form.ot_type))
              .map((action) => (
                <option key={action.id} value={action.code}>
                  {action.name}
                </option>
              ))}
          </select>
        </div>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descripción (opcional)"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
          rows={2}
        />

        {/* Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Productos sugeridos <span className="text-zinc-600">(podés elegir producto específico o grupo)</span>
            </span>
            <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs">
              <Plus size={12} className="mr-1" /> Agregar
            </Button>
          </div>
          {form.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-zinc-800/50 rounded border border-zinc-700">
              <div className="flex-1 space-y-1">
                {/* Group selector (arriba: jerarquía superior) */}
                <select
                  value={item.group_id}
                  onChange={(e) => updateItem(idx, 'group_id', e.target.value)}
                  className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs"
                  disabled={!!item.product_id}
                >
                  <option value="">— Grupo de producto —</option>
                  {productGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.description ? `(${g.description})` : ''}
                    </option>
                  ))}
                </select>
                {/* Product selector (abajo: refinamiento) */}
                <select
                  value={item.product_id}
                  onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                  className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs"
                  disabled={!!item.group_id}
                >
                  <option value="">— Producto específico —</option>
                  {products
                    .filter(p => !item.group_id || p.group_id === parseInt(item.group_id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) {p.group_name ? `[${p.group_name}]` : ''}
                      </option>
                    ))}
                </select>
              </div>
              <input
                type="number"
                value={item.default_quantity}
                onChange={(e) => updateItem(idx, 'default_quantity', parseFloat(e.target.value) || 0)}
                className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs text-center"
                min="0"
                step="0.5"
              />
              <div className="flex flex-col items-center gap-1">
                <label className="flex items-center gap-1 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) => updateItem(idx, 'required', e.target.checked)}
                    className="w-3 h-3"
                  />
                  Req
                </label>
                <button
                  onClick={() => removeItem(idx)}
                  className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {form.items.length === 0 && (
            <p className="text-xs text-zinc-500 italic">Sin productos. El técnico verá el selector vacío.</p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          {editingId && (
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setEditingId(null); }}>
              Cancelar
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!form.name} className="bg-emerald-600 hover:bg-emerald-700">
            {editingId ? 'Actualizar' : 'Crear'} Plantilla
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {templates.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">No hay plantillas configuradas. Creá la primera arriba.</p>
        ) : (
          templates.map((tmpl) => (
            <div key={tmpl.id} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{tmpl.name}</span>
                    {!tmpl.is_active && <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-500">Inactiva</Badge>}
                    {tmpl.ot_type && (
                      <Badge variant="outline" className="text-[10px] border-emerald-700/50 text-emerald-300">
                        {otTypes.find(t => t.code === tmpl.ot_type)?.name || tmpl.ot_type}
                      </Badge>
                    )}
                    {tmpl.action_code && (
                      <Badge variant="outline" className="text-[10px] border-blue-700/50 text-blue-300">
                        {woActions.find(a => a.code === tmpl.action_code)?.name || tmpl.action_code}
                      </Badge>
                    )}
                  </div>
                  {tmpl.description && (
                    <p className="text-xs text-zinc-500 mt-1">{tmpl.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(tmpl.items || []).map((item, i) => (
                      <Badge key={i} variant="outline" className={`text-[10px] ${item.required ? 'border-amber-700/50 text-amber-300' : 'border-zinc-700 text-zinc-400'}`}>
                        <Package size={10} className="mr-1" />
                        {item.group_name
                          ? `[${item.group_name}]`
                          : (item.product_name || `#${item.product_id}`)
                        }
                        {' x'}{item.default_quantity}
                        {item.required ? ' *' : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(tmpl)} className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(tmpl.id)} className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
