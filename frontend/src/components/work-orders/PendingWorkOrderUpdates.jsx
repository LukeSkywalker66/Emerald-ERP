import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Inbox, Loader } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import workOrdersService from '@/services/workOrders.service';

const UPDATE_TYPE_LABELS = {
  MATERIALS_ADDED: 'Material agregado',
  MATERIALS_REMOVED: 'Material quitado',
  MATERIALS_REPLACED: 'Material reemplazado',
  MATERIALS_QTY_UPDATED: 'Cantidad corregida',
  INFO_CORRECTION: 'Corrección de información',
  CLOSE_CORRECTION: 'Corrección del cierre',
  NOTE: 'Nota',
};

const formatTs = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Aprobaciones pendientes de bitácora (P2). Muestra un badge con el conteo y un
 * diálogo para aprobar/rechazar entradas PROPOSED.
 */
export default function PendingWorkOrderUpdates() {
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workOrdersService.getPendingWorkOrderUpdates();
      setUpdates(data?.updates || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar pendientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = async (updateId, status) => {
    setWorking(true);
    setError(null);
    try {
      await workOrdersService.setWorkOrderUpdateStatus(updateId, status);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar estado');
    } finally {
      setWorking(false);
    }
  };

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setError(null);
      load();
    }
  };

  const pendingCount = updates.length;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-9 border-amber-700/50 text-amber-300 hover:bg-amber-950/30"
      >
        <Inbox size={14} className="mr-1" />
        Aprobaciones
        {pendingCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-zinc-950 text-xs font-bold flex items-center justify-center">
            {pendingCount}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Aprobaciones de bitácora pendientes</DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-zinc-500">
                <Loader size={18} className="animate-spin mr-2" />
                Cargando...
              </div>
            ) : (
              <>
                {error && (
                  <p className="text-xs text-rose-300 bg-rose-950/30 border border-rose-800/50 rounded p-2">{error}</p>
                )}
                {updates.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">No hay correcciones pendientes de aprobación.</p>
            ) : (
              updates.map((u) => (
                <div key={u.id} className="p-3 rounded bg-zinc-800/50 border border-zinc-700">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-emerald-300 font-medium">OT #{u.work_order_id}</span>
                    <span className="text-xs text-zinc-400">
                      {UPDATE_TYPE_LABELS[u.update_type] || u.update_type}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mb-2">{u.motive}</p>

                  <div className="text-[11px] leading-5 text-zinc-500 mb-2">
                    {u.technician_name && (
                      <div><span className="text-zinc-400">Solicitó:</span> {u.technician_name}</div>
                    )}
                    {(u.team_name || u.vehicle_label) && (
                      <div>
                        <span className="text-zinc-400">Cuadrilla:</span>{' '}
                        {[u.team_name, u.vehicle_label].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {(u.connection_label || u.client_name) && (
                      <div>
                        <span className="text-zinc-400">Cliente:</span>{' '}
                        {[u.client_name, u.connection_label].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <div><span className="text-zinc-400">Fecha:</span> {formatTs(u.created_at)}</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDecision(u.id, 'APPROVED')}
                      disabled={working}
                      className="flex-1 px-2 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} className="inline mr-1" />
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(u.id, 'REJECTED')}
                      disabled={working}
                      className="flex-1 px-2 py-1.5 rounded bg-rose-600/80 hover:bg-rose-700 text-white text-xs disabled:opacity-50"
                    >
                      <XCircle size={12} className="inline mr-1" />
                      Rechazar
                    </button>
                  </div>
                </div>
              ))
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
