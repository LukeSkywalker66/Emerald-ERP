import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Package, ClipboardList, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import * as workOrderTypesService from '@/services/workOrderTypes.service';
import * as inventoryService from '@/services/inventory.service';

/**
 * WOTemplatesTab - Admin panel for work order material templates.
 * Part of the Settings page (Etapa 5).
 */
export default function WOTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [products, setProducts] = useState([]);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    ot_type: '',
    is_active: true,
    items: [],
  });

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const [data, cats] = await Promise.all([
        workOrderTypesService.getWOTemplates(),
        inventoryService.getProducts().catch(() => []),
      ]);
      setTemplates(data || []);
      setProducts(cats || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const resetForm = () => setForm({
    name: '', description: '', ot_type: '', is_active: true, items: [],
  });

  const startEdit = (tmpl) => {
    setEditingId(tmpl.id);
    setForm({
      name: tmpl.name,
      description: tmpl.description || '',
      ot_type: tmpl.ot_type || '',
      is_active: tmpl.is_active,
      items: (tmpl.items || []).map((i) => ({
        product_id: i.product_id,
        default_quantity: i.default_quantity,
        required: i.required,
        sort_order: i.sort_order,
        notes: i.notes || '',
      })),
    });
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await workOrderTypesService.updateWOTemplate(editingId, form);
      } else {
        await workOrderTypesService.createWOTemplate(form);
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
      items: [...prev.items, { product_id: '', default_quantity: 1, required: false, sort_order: prev.items.length, notes: '' }],
    }));
  };

  const updateItem = (idx, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
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
      {/* Error */}
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
            <option value="install">Instalación</option>
            <option value="repair">Soporte/Reparación</option>
            <option value="pickup">Retiro</option>
            <option value="infrastructure">Infraestructura</option>
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
            <span className="text-xs font-medium text-zinc-400">Productos sugeridos</span>
            <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs">
              <Plus size={12} className="mr-1" /> Agregar producto
            </Button>
          </div>
          {form.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded border border-zinc-700">
              <select
                value={item.product_id}
                onChange={(e) => updateItem(idx, 'product_id', parseInt(e.target.value))}
                className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs"
              >
                <option value="">Seleccionar...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
              <input
                type="number"
                value={item.default_quantity}
                onChange={(e) => updateItem(idx, 'default_quantity', parseFloat(e.target.value))}
                className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs text-center"
                min="1"
                step="0.5"
              />
              <label className="flex items-center gap-1 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={item.required}
                  onChange={(e) => updateItem(idx, 'required', e.target.checked)}
                />
                Requerido
              </label>
              <button
                onClick={() => removeItem(idx)}
                className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
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
                        {tmpl.ot_type}
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
                        {item.product_name || `#${item.product_id}`} x{item.default_quantity}
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
