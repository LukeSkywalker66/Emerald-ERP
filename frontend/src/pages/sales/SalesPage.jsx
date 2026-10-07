import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Plus, ShoppingCart } from 'lucide-react';
import { listSales } from '@/services/sales.service';

const STATUS_LABELS = {
  DRAFT: { label: 'Borrador', cls: 'bg-zinc-600/30 border-zinc-500/40 text-zinc-200' },
  CONFIRMED: { label: 'Confirmada', cls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
  CANCELLED: { label: 'Anulada', cls: 'bg-ruby-500/15 border-ruby-500/40 text-ruby-300' },
};

export default function SalesPage() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listSales({ limit: 100 });
        setSales(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err?.response?.data?.detail || 'No se pudieron cargar las ventas.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-emerald-300">Ventas al Público</h1>
            <p className="text-zinc-400 text-sm">
              Salida de stock por venta de mostrador. La facturación se maneja por fuera por ahora.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/sales/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Venta
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-zinc-300 gap-3">
            <Loader className="w-6 h-6 animate-spin text-emerald-400" />
            Cargando ventas...
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded border border-ruby-500/50 bg-ruby-500/10 text-ruby-300">
            {error}
          </div>
        )}

        {!loading && !error && sales.length === 0 && (
          <div className="p-10 rounded border border-zinc-800 bg-zinc-900/40 text-center text-zinc-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
            Todavía no hay ventas registradas.
          </div>
        )}

        {!loading && !error && sales.length > 0 && (
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nº</th>
                  <th className="text-left px-4 py-3 font-semibold">Depósito</th>
                  <th className="text-left px-4 py-3 font-semibold">Referencia</th>
                  <th className="text-left px-4 py-3 font-semibold">Items</th>
                  <th className="text-left px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const status = STATUS_LABELS[sale.status] || STATUS_LABELS.DRAFT;
                  return (
                    <tr
                      key={sale.id}
                      className="border-t border-zinc-800 hover:bg-zinc-900/40 cursor-pointer"
                      onClick={() => navigate(`/app/sales/${sale.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-emerald-400">{sale.sale_number}</td>
                      <td className="px-4 py-3">{sale.warehouse_name || `#${sale.warehouse_id}`}</td>
                      <td className="px-4 py-3 text-zinc-300">{sale.reference || '—'}</td>
                      <td className="px-4 py-3">{sale.items?.length || 0}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
