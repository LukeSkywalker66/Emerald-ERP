import React, { useState, useEffect } from 'react';
import { Package, MessageSquare, Activity, Loader2, Wifi, Cpu, Signal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ticketsService from '@/services/tickets.service';

/**
 * ConnectionInfoPanel - Widget de activos instalados y notas de conexión
 * para usar en TicketDetailPage.
 *
 * Muestra:
 *   - Equipos serializados instalados en la conexión (activos)
 *   - Notas de técnicos sobre la conexión
 */
export default function ConnectionInfoPanel({ ticketId, connectionId }) {
  const [assets, setAssets] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assets'); // 'assets' | 'notes'

  useEffect(() => {
    if (!ticketId) return;

    const loadData = async () => {
      setLoading(true);
      const [assetsData, notesData] = await Promise.all([
        ticketsService.getConnectionAssets(ticketId),
        ticketsService.getConnectionNotes(ticketId),
      ]);
      setAssets(assetsData?.assets || []);
      setNotes(notesData?.notes || []);
      setLoading(false);
    };

    loadData();
  }, [ticketId]);

  const hasAssets = assets.length > 0;
  const hasNotes = notes.length > 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-zinc-500 mr-2" />
          <span className="text-xs text-zinc-500">Cargando información de conexión...</span>
        </div>
      </div>
    );
  }

  if (!hasAssets && !hasNotes) return null;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-emerald-400" />
        <p className="text-xs text-zinc-500 uppercase tracking-wide">Información de Conexión</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 pb-2">
        {hasAssets && (
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-3 py-1 text-xs rounded-t transition ${
              activeTab === 'assets'
                ? 'bg-emerald-950/50 text-emerald-300 border-b-2 border-emerald-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Package size={12} className="inline mr-1" />
            Equipos ({assets.length})
          </button>
        )}
        {hasNotes && (
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1 text-xs rounded-t transition ${
              activeTab === 'notes'
                ? 'bg-emerald-950/50 text-emerald-300 border-b-2 border-emerald-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <MessageSquare size={12} className="inline mr-1" />
            Notas ({notes.length})
          </button>
        )}
      </div>

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {assets.map((asset) => (
            <div key={asset.id} className="p-2 rounded bg-zinc-800/30 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-purple-400" />
                  <span className="text-xs text-white font-mono">{asset.serial_number}</span>
                  {asset.status === 'INSTALLED' ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                      Instalado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-zinc-500/10 border-zinc-500/30 text-zinc-400">
                      Retirado
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500">
                  {new Date(asset.installed_at).toLocaleDateString('es-AR')}
                </span>
              </div>
              {asset.notes && (
                <p className="text-[10px] text-zinc-500 mt-1 ml-6">{asset.notes}</p>
              )}
            </div>
          ))}
          {!hasAssets && (
            <p className="text-xs text-zinc-500 text-center py-4">Sin equipos registrados</p>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notes.map((note) => (
            <div key={note.id} className="p-2 rounded bg-zinc-800/30 border border-zinc-800">
              <div className="flex items-start gap-2">
                <MessageSquare size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-zinc-200">{note.note}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {new Date(note.created_at).toLocaleDateString('es-AR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {note.is_pinned && ' 📌'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {!hasNotes && (
            <p className="text-xs text-zinc-500 text-center py-4">Sin notas registradas</p>
          )}
        </div>
      )}
    </div>
  );
}
