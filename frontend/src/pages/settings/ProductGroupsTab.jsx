import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Package, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as inventoryService from '@/services/inventory.service';

export default function ProductGroupsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getProductGroups(false);
      setGroups(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const resetForm = () => setForm({ name: '', description: '', is_active: true });

  const startEdit = (group) => {
    setEditingId(group.id);
    setForm({ name: group.name, description: group.description || '', is_active: group.is_active });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await inventoryService.updateProductGroup(editingId, form);
      } else {
        await inventoryService.createProductGroup(form);
      }
      resetForm();
      setEditingId(null);
      await loadGroups();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este grupo? Los productos asignados quedarán sin grupo.')) return;
    try {
      await inventoryService.deleteProductGroup(id);
      await loadGroups();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300 text-sm">X</button>
        </div>
      )}

      {/* Form */}
      <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">
          {editingId ? 'Editar Grupo' : 'Nuevo Grupo de Producto'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Nombre *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: ONU/ONT, Router Domiciliario"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Descripción</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Equipos ópticos de abonado"
            />
          </div>
          <div className="flex items-end space-x-2">
            <Button variant="primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Actualizar' : 'Crear'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={() => { resetForm(); setEditingId(null); }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No hay grupos creados</p>
          <p className="text-zinc-500 text-xs mt-1">Creá grupos como ONU/ONT, Router, Cableado, Conectores</p>
        </div>
      ) : (
        <div className="bg-zinc-800/30 rounded-lg divide-y divide-zinc-800">
          {groups.map((group) => (
            <div key={group.id} className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors">
              <div className="flex items-center space-x-3">
                <Package className="w-5 h-5 text-zinc-500" />
                <div>
                  <p className="text-white font-medium text-sm">{group.name}</p>
                  {group.description && (
                    <p className="text-zinc-500 text-xs mt-0.5">{group.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  group.is_active ? 'bg-emerald-900/30 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {group.is_active ? 'Activo' : 'Inactivo'}
                </span>
                <button onClick={() => startEdit(group)}
                  className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(group.id)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
