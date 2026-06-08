import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Check, X, Eye, EyeOff, Trash2, Loader2, Palette, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import * as workOrderTypesService from '@/services/workOrderTypes.service';

const COLOR_OPTIONS = [
  { value: 'bg-blue-600', label: 'Azul' },
  { value: 'bg-sky-600', label: 'Celeste' },
  { value: 'bg-emerald-600', label: 'Verde' },
  { value: 'bg-rose-600', label: 'Rojo' },
  { value: 'bg-purple-600', label: 'Púrpura' },
  { value: 'bg-amber-600', label: 'Ámbar' },
  { value: 'bg-cyan-600', label: 'Cian' },
  { value: 'bg-zinc-600', label: 'Gris' },
];

const ICON_OPTIONS = [
  { value: 'Zap', label: '⚡ Rayo' },
  { value: 'Wifi', label: '📡 WiFi' },
  { value: 'Wrench', label: '🔧 Llave' },
  { value: 'Package', label: '📦 Paquete' },
  { value: 'TowerControl', label: '📶 Torre' },
  { value: 'Home', label: '🏠 Casa' },
  { value: 'Tool', label: '🛠️ Tool' },
  { value: 'Settings', label: '⚙️ Settings' },
];

/**
 * OTTypesTab - Admin panel for configuring Work Order Types.
 * Part of the Settings page.
 */
export default function OTTypesTab() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadTypes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await workOrderTypesService.getWorkOrderTypes(false);
      setTypes(data || []);
    } catch (err) {
      console.error('Error loading OT types:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTypes(); }, [loadTypes]);

  const startEdit = (type) => {
    setEditingId(type.id);
    setEditForm({
      name: type.name,
      description: type.description || '',
      color: type.color,
      icon: type.icon || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (id) => {
    try {
      await workOrderTypesService.updateWorkOrderType(id, editForm);
      cancelEdit();
      await loadTypes();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: '', name: '', description: '', color: 'bg-zinc-600', icon: '',
  });

  const handleCreate = async () => {
    try {
      await workOrderTypesService.createWorkOrderType(createForm);
      setShowCreateForm(false);
      setCreateForm({ code: '', name: '', description: '', color: 'bg-zinc-600', icon: '' });
      await loadTypes();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Eliminar el tipo "${name}"?`)) return;
    try {
      await workOrderTypesService.deleteWorkOrderType(id);
      await loadTypes();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggle = async (id) => {
    try {
      await workOrderTypesService.toggleWorkOrderType(id);
      await loadTypes();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-emerald-400" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Create button */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowCreateForm(!showCreateForm)} className="h-8 text-xs">
          {showCreateForm ? 'Cancelar' : '+ Nuevo Tipo de OT'}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="p-4 rounded-lg border border-emerald-800/50 bg-emerald-950/20 space-y-3">
          <h4 className="text-sm font-medium text-emerald-300">Nuevo Tipo de OT</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={createForm.code} onChange={(e) => setCreateForm({...createForm, code: e.target.value})}
              placeholder="Código (ej: install_wifi)" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm font-mono" />
            <input value={createForm.name} onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
              placeholder="Nombre (ej: Instalación WiFi)" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm" />
            <input value={createForm.description} onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
              placeholder="Descripción" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm" />
            <div className="flex gap-2">
              <select value={createForm.color} onChange={(e) => setCreateForm({...createForm, color: e.target.value})}
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm">
                {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select value={createForm.icon} onChange={(e) => setCreateForm({...createForm, icon: e.target.value})}
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm">
                <option value="">Sin ícono</option>
                {ICON_OPTIONS.map(ico => <option key={ico.value} value={ico.value}>{ico.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={!createForm.code || !createForm.name}
              className="bg-emerald-600 hover:bg-emerald-700">Crear Tipo</Button>
          </div>
        </div>
      )}

      {types.map((type) => (
        <div key={type.id} className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
          {editingId === type.id ? (
            /* Editing mode */
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Nombre</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Descripción</label>
                  <input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">
                    <Palette size={12} className="inline mr-1" /> Color
                  </label>
                  <select
                    value={editForm.color}
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">
                    <Type size={12} className="inline mr-1" /> Icono
                  </label>
                  <select
                    value={editForm.icon}
                    onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                  >
                    {ICON_OPTIONS.map((ico) => (
                      <option key={ico.value} value={ico.value}>{ico.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  <X size={14} className="mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={() => handleSave(type.id)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Check size={14} className="mr-1" /> Guardar
                </Button>
              </div>
            </div>
          ) : (
            /* Display mode */
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-8 h-8 rounded-lg ${type.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {type.icon ? type.icon.substring(0, 2) : 'OT'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{type.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono text-zinc-500 border-zinc-700">
                      {type.code}
                    </Badge>
                    {!type.is_active && (
                      <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-500">Inactivo</Badge>
                    )}
                  </div>
                  {type.description && (
                    <p className="text-xs text-zinc-500 mt-0.5">{type.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => startEdit(type)} className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors" title="Editar">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleToggle(type.id)} className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors" title={type.is_active ? 'Desactivar' : 'Activar'}>
                  {type.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => handleDelete(type.id, type.name)} className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors" title="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
