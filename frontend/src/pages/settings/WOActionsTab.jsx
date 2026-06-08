import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import * as workOrderTypesService from '@/services/workOrderTypes.service';

export default function WOActionsTab() {
  const [actions, setActions] = useState([]);
  const [otTypes, setOtTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOt, setFilterOt] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [types, allActions] = await Promise.all([
        workOrderTypesService.getWorkOrderTypes(false),
        workOrderTypesService.getWOActions(),
      ]);
      setOtTypes(types || []);
      setActions(allActions || []);
    } catch (err) {
      console.error('Error loading actions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredActions = filterOt
    ? actions.filter(a => a.ot_type === filterOt)
    : actions;

  const groupedActions = {};
  for (const a of filteredActions) {
    if (!groupedActions[a.ot_type]) groupedActions[a.ot_type] = [];
    groupedActions[a.ot_type].push(a);
  }

  const startEdit = (action) => {
    setEditingId(action.id);
    setEditForm({ name: action.name, description: action.description || '', requires_notes: action.requires_notes });
  };

  const handleSave = async (id) => {
    try {
      await workOrderTypesService.updateWOAction(id, editForm);
      setEditingId(null);
      await loadData();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Eliminar la acción "${name}"?`)) return;
    try {
      await workOrderTypesService.deleteWOAction(id);
      await loadData();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const getTypeName = (code) => otTypes.find(t => t.code === code)?.name || code;

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-emerald-400" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <select value={filterOt} onChange={(e) => setFilterOt(e.target.value)}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm">
          <option value="">Todos los tipos</option>
          {otTypes.filter(t => t.is_active).map(t => (
            <option key={t.id} value={t.code}>{t.name}</option>
          ))}
        </select>
      </div>

      {Object.entries(groupedActions).map(([otType, items]) => (
        <div key={otType} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
          <h4 className="text-sm font-semibold text-emerald-300 mb-2">{getTypeName(otType)}</h4>
          <div className="space-y-1">
            {items.sort((a, b) => a.sort_order - b.sort_order).map((action) => (
              <div key={action.id} className="flex items-center justify-between p-2 rounded bg-zinc-800/30 border border-zinc-800">
                {editingId === action.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs" />
                    <label className="flex items-center gap-1 text-xs text-zinc-400">
                      <input type="checkbox" checked={editForm.requires_notes} onChange={(e) => setEditForm({...editForm, requires_notes: e.target.checked})} />
                      Requiere notas
                    </label>
                    <button onClick={() => handleSave(action.id)} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-zinc-500 hover:text-zinc-400"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{action.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono text-zinc-500 border-zinc-700">{action.code}</Badge>
                      {action.is_builtin && <Badge variant="outline" className="text-[10px] border-blue-700/50 text-blue-300">Built-in</Badge>}
                      {action.requires_notes && <Badge variant="outline" className="text-[10px] border-amber-700/50 text-amber-300">Requiere notas</Badge>}
                      {!action.is_active && <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-500">Inactiva</Badge>}
                    </div>
                    <div className="flex gap-1">
                      {!action.is_builtin && (
                        <>
                          <button onClick={() => startEdit(action)} className="p-1 text-zinc-500 hover:text-emerald-400"><Pencil size={12} /></button>
                          <button onClick={() => handleDelete(action.id, action.name)} className="p-1 text-zinc-500 hover:text-rose-400"><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {Object.keys(groupedActions).length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">No hay acciones configuradas para este filtro.</p>
      )}
    </div>
  );
}
