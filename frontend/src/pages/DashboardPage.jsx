import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Wifi, Users, Zap, ArrowUpRight,
  TrendingUp, AlertTriangle, CheckCircle, HelpCircle,
  RefreshCw, Ticket, ClipboardList,
} from 'lucide-react';
import MonitorWidget from '../components/dashboard/MonitorWidget';
import { getDashboardSummary } from '../services/dashboard.service';

// ── Helpers ─────────────────────────────────────────────────────────────

function formatNumber(num) {
  if (num == null) return '—';
  if (num >= 1000) {
    const k = (num / 1000).toFixed(1);
    return k.endsWith('.0') ? `${Math.floor(num / 1000)}k` : `${k}k`;
  }
  return String(num);
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  return d.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ── Skeleton Loading ────────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-800/50 animate-pulse" />
            <div className="w-16 h-6 rounded-md bg-zinc-800/30 animate-pulse" />
          </div>
          <div className="h-4 w-24 bg-zinc-800/40 rounded mb-2 animate-pulse" />
          <div className="flex items-baseline justify-between">
            <div className="h-8 w-16 bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-4 w-14 bg-zinc-800/30 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 shadow-xl shadow-black/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800/80">
        <div className="h-5 w-40 bg-zinc-800/50 rounded animate-pulse mb-2" />
        <div className="h-3 w-60 bg-zinc-800/30 rounded animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-6 py-4 border-b border-zinc-800/40 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-zinc-800/40 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-zinc-800/40 rounded animate-pulse" />
            <div className="h-3 w-48 bg-zinc-800/30 rounded animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-zinc-800/30 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────

function KpiCard({ label, value, trend, icon: Icon, tone }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-xl shadow-black/20 hover:border-emerald-500/30 transition-all duration-200 group">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          tone === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : tone === 'warning'
              ? 'bg-amber-500/10 border border-amber-500/30'
              : tone === 'danger'
                ? 'bg-ruby-500/10 border border-ruby-500/30'
                : 'bg-blue-500/10 border border-blue-500/30'
        }`}>
          <Icon size={20} className={
            tone === 'success'
              ? 'text-emerald-400'
              : tone === 'warning'
                ? 'text-amber-400'
                : tone === 'danger'
                  ? 'text-ruby-400'
                  : 'text-blue-400'
          } />
        </div>
      </div>
      <p className="text-sm font-medium text-zinc-400 mb-2">{label}</p>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        {trend && (
          <span className="text-xs text-zinc-500 font-medium">{trend}</span>
        )}
      </div>
    </div>
  );
}

// ── Integration Status Badge ────────────────────────────────────────────

function SyncBadge({ estado }) {
  const cfg = {
    ok: { label: 'OK', dotClass: 'bg-emerald-500', textClass: 'text-emerald-400', bgClass: 'bg-emerald-950/50 border-emerald-500/30' },
    error: { label: 'Error', dotClass: 'bg-ruby-500', textClass: 'text-ruby-400', bgClass: 'bg-ruby-950/50 border-ruby-500/30' },
  };
  const c = cfg[estado] || cfg.ok;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${c.bgClass}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${c.dotClass}`} />
      {c.label}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const summary = await getDashboardSummary();
      setData(summary);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los datos del dashboard');
      console.error('❌ DashboardPage load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Auto-refresh cada 60s
    return () => clearInterval(interval);
  }, [loadData]);

  const {
    tickets = {},
    clientes = {},
    nodos = {},
    onus = {},
    work_orders = {},
    sync = {},
  } = data || {};

  const syncSources = sync.por_fuente || [];

  // ── Error State ──────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Tablero Operativo</h1>
            <p className="text-sm text-zinc-400">Visión rápida de tickets, clientes y estado de nodos Beholder.</p>
          </div>
        </div>
        <div className="rounded-xl border border-ruby-500/20 bg-zinc-900/60 p-8 text-center shadow-xl shadow-black/20">
          <AlertTriangle size={40} className="mx-auto mb-3 text-ruby-400" />
          <p className="text-lg font-medium text-ruby-300 mb-1">Error al cargar datos</p>
          <p className="text-sm text-zinc-400 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            Reintentar
          </button>
        </div>
        <MonitorWidget />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/20 mb-2">
            <Activity size={14} className="text-emerald-500" />
            <span className="text-xs font-medium text-emerald-400 tracking-wide uppercase">
              Status General
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Tablero Operativo</h1>
          <p className="text-sm text-zinc-400">
            Visión rápida de tickets, clientes y estado de nodos Beholder.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-zinc-500 font-mono">
              Actualizado {timeAgo(lastUpdated.toISOString())}
            </span>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
            title="Refrescar"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      {loading ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Tickets activos"
            value={formatNumber(tickets.total_activos)}
            trend={`${tickets.creados_hoy || 0} creados hoy`}
            icon={Ticket}
            tone={tickets.total_activos > 20 ? 'warning' : 'success'}
          />
          <KpiCard
            label="Clientes conectados"
            value={formatNumber(clientes.total_conexiones)}
            trend={`${clientes.total_clientes || 0} clientes`}
            icon={Users}
            tone="success"
          />
          <KpiCard
            label="Nodos operativos"
            value={nodos.total != null ? String(nodos.total) : '—'}
            trend="En BD local"
            icon={Zap}
            tone="success"
          />
          <KpiCard
            label="ONUs registradas"
            value={formatNumber(onus.total)}
            trend={`${formatNumber(onus.con_pppoe)} con PPPoE`}
            icon={Wifi}
            tone={onus.total > 0 ? 'success' : 'warning'}
          />
        </div>
      )}

      {/* ── Work Orders Quick Summary ───────────────────────────── */}
      {!loading && data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-xl shadow-black/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <ClipboardList size={16} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Pendientes</p>
                <p className="text-xl font-bold text-white">{work_orders.pendientes ?? '—'}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-xl shadow-black/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <Activity size={16} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">En Curso</p>
                <p className="text-xl font-bold text-white">{work_orders.en_curso ?? '—'}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-xl shadow-black/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Completadas Hoy</p>
                <p className="text-xl font-bold text-white">{work_orders.completadas_hoy ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Monitor Widget ──────────────────────────────────────── */}
      <MonitorWidget />

      {/* ── Sync Status Table ───────────────────────────────────── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 shadow-xl shadow-black/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Estado de Sincronización</h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                Últimas ejecuciones de sincronización con sistemas externos
              </p>
            </div>
            {lastUpdated && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-zinc-400 font-medium">
                  {timeAgo(lastUpdated.toISOString())}
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {syncSources.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <HelpCircle size={28} className="mx-auto mb-2 text-zinc-600" />
                <p className="text-sm text-zinc-500">No hay datos de sincronización disponibles</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Fuente</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Última Sync</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {syncSources.map((src) => (
                    <tr key={src.fuente} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            src.estado === 'ok'
                              ? 'bg-emerald-500/10 border border-emerald-500/30'
                              : 'bg-ruby-500/10 border border-ruby-500/30'
                          }`}>
                            {src.estado === 'ok'
                              ? <CheckCircle size={16} className="text-emerald-400" />
                              : <AlertTriangle size={16} className="text-ruby-400" />
                            }
                          </div>
                          <span className="text-sm font-medium text-white">{src.fuente}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <SyncBadge estado={src.estado} />
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 font-mono">
                        {timeAgo(src.ultima_sync)}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400 max-w-xs truncate">
                        {src.detalle || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
