import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader, ShoppingCart, Trash2 } from 'lucide-react';
import { cancelSale, confirmSale, getSale } from '@/services/sales.service';

const STATUS_LABELS = {
  DRAFT: { label: 'Borrador', cls: 'bg-zinc-600/30 border-zinc-500/40 text-zinc-200' },
  CONFIRMED: { label: 'Confirmada', cls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
  CANCELLED: { label: 'Anulada', cls: 'bg-red-500/15 border-red-500/40 text-red-300' },
};

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSale(id);
      setSale(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo cargar la venta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleConfirm = async () => {
    if (!window.confirm(`¿Confirmar la venta ${sale.sale_number}? Se descontará stock.`)) return;
    try {
      setBusy(true);
      await confirmSale(sale.id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo confirmar la venta.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm(`¿Anular la venta ${sale.sale_number}?`)) return;
    try {
      setBusy(true);
      await cancelSale(sale.id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo anular la venta.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-300">
          <Loader className="w-6 h-6 animate-spin text-emerald-400" />
          Cargando venta...
        </div>
      </div>
    );
  }

  if (error && !sale) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate('/app/sales')} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <div className="p-4 rounded border border-red-500/50 bg-red-500/10 text-red-300">{error}</div>
        </div>
      </div>
    );
  }

  if (!sale) return null;

  const status = STATUS_LABELS[sale.status] || STATUS_LABELS.DRAFT;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/app/sales')} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-emerald-300">{sale.sale_number}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${status.cls}`}>{status.label}</span>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded border border-red-500/50 bg-red-500/10 text-red-300 text-sm">{error}</div>
        )}

        <div className="p-4 rounded border border-zinc-800 bg-zinc-900/40 space-y-2 text-sm">
          <p><span className="text-zinc-500">Depósito:</span> {sale.warehouse_name || `#${sale.warehouse_id}`}</p>
          <p><span className="text-zinc-500">Referencia:</span> {sale.reference || '—'}</p>
          {sale.notes && <p><span className="text-zinc-500">Notas:</span> {sale.notes}</p>}
          <p><span className="text-zinc-500">Registrada:</span> {new Date(sale.created_at).toLocaleString()}</p>
        </div>

        <div className="p-4 rounded border border-zinc-800 bg-zinc-900/40">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Líneas</h2>
          {(!sale.items || sale.items.length === 0) ? (
            <p className="text-xs text-zinc-500 italic">Sin líneas.</p>
          ) : (
            <ul className="space-y-2">
              {sale.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-zinc-800/60 border border-zinc-700/50 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-zinc-200">{it.product_name} <span className="text-xs font-mono text-zinc-500">({it.product_sku})</span></p>
                    <p className="text-xs text-zinc-500 font-mono">
                      {it.serial_number ? `Serial: ${it.serial_number}` : `Cantidad: ${it.quantity}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {sale.status === 'DRAFT' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {busy ? 'Procesando...' : 'Confirmar (descontar stock)'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded border border-red-700/60 text-red-300 hover:bg-red-950/30 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Anular
            </button>
          </div>
        )}

        <div className="text-xs text-zinc-600 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> La facturación se maneja por fuera por ahora.
        </div>
      </div>
    </div>
  );
}
