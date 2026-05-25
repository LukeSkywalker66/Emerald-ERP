import React, { useState, useEffect, useCallback } from 'react';
import { getMonitors, getMonitorStats } from '../../services/settings.service';
import { Activity, Wifi, Server, Shield, AlertTriangle, CheckCircle, HelpCircle, RefreshCw } from 'lucide-react';

// ── Icon map per monitor type ──────────────────────────────────────────
const TYPE_ICON = {
  PING: Wifi,
  HTTP: Activity,
  TCP: Server,
  SSL: Shield,
};

const TYPE_LABEL = {
  PING: 'Ping',
  HTTP: 'HTTP',
  TCP: 'TCP',
  SSL: 'SSL',
};

// ── Status helpers ─────────────────────────────────────────────────────
function statusConfig(status) {
  switch (status) {
    case 'UP':
    case 'up':
      return {
        label: 'Online',
        dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
        textClass: 'text-emerald-400',
        bgClass: 'bg-emerald-950/40 border-emerald-500/20',
        glowBorder: 'border-emerald-500/30',
      };
    case 'DOWN':
    case 'down':
      return {
        label: 'Offline',
        dotClass: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
        textClass: 'text-amber-400',
        bgClass: 'bg-amber-950/40 border-amber-500/20',
        glowBorder: 'border-amber-500/40',
        blink: true,
      };
    default:
      return {
        label: 'Sin verificar',
        dotClass: 'bg-zinc-500',
        textClass: 'text-zinc-400',
        bgClass: 'bg-zinc-900/40 border-zinc-700/20',
        glowBorder: 'border-zinc-700/30',
      };
  }
}

function formatLastChecked(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatResponseTime(ms) {
  if (ms == null) return '—';
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

// ── Main Component ─────────────────────────────────────────────────────
export default function MonitorWidget() {
  const [monitors, setMonitors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [monitorsData, statsData] = await Promise.all([
        getMonitors({ limit: 50 }),
        getMonitorStats(),
      ]);
      setMonitors(monitorsData.items || []);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los monitores');
      console.error('❌ MonitorWidget load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh each 30s
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const activeMonitors = monitors.filter((m) => m.is_active);
  const downMonitors = activeMonitors.filter((m) => m.last_status === 'DOWN');
  const upMonitors = activeMonitors.filter((m) => m.last_status === 'UP');

  // ── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-zinc-800/50 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-40 bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-3 w-24 bg-zinc-800/30 rounded animate-pulse" />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-zinc-800/20 rounded-lg mb-2 animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-ruby-500/20 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <div className="flex items-center gap-3 text-ruby-400">
          <AlertTriangle size={20} />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={loadData}
          className="mt-3 text-xs text-zinc-400 hover:text-white transition-colors underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 shadow-xl shadow-black/20 overflow-hidden transition-all duration-300">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Activity size={18} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Monitores de Servicio
              {downMonitors.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400 text-[10px] font-semibold uppercase tracking-wider animate-[blink_2s_ease-in-out_infinite]">
                  {downMonitors.length} caído{downMonitors.length > 1 ? 's' : ''}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-zinc-500 font-mono">
              {stats ? `${stats.up || 0} Online · ${stats.down || 0} Offline · ${stats.unknown || 0} Sin verificar · ${stats.total || 0} Total` : 'Cargando...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refrescar"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <span className={`text-xs font-bold transition-transform ${collapsed ? 'rotate-180' : ''}`}>▾</span>
          </button>
        </div>
      </div>

      {/* ── Summary Mini-Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-zinc-800/50 border-b border-zinc-800/50">
        <div className="px-4 py-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{stats?.up || 0}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Online</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-lg font-bold text-amber-400">{stats?.down || 0}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Offline</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-lg font-bold text-zinc-400">{stats?.unknown || 0}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Sin verif.</p>
        </div>
      </div>

      {/* ── Monitor List ────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {activeMonitors.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <HelpCircle size={28} className="mx-auto mb-2 text-zinc-600" />
              <p className="text-sm text-zinc-500">No hay monitores activos</p>
              <p className="text-xs text-zinc-600 mt-1">
                Cree monitores en Configuración → Monitores
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/40">
              {activeMonitors.map((monitor) => {
                const cfg = statusConfig(monitor.last_status);
                const IconComponent = TYPE_ICON[monitor.monitor_type] || Activity;
                const isCritical = monitor.is_critical;

                return (
                  <div
                    key={monitor.id}
                    className={`
                      px-5 py-3 flex items-center gap-3
                      transition-all duration-300
                      hover:bg-zinc-800/30 group
                      ${cfg.glowBorder} border-l-2
                    `}
                  >
                    {/* Status indicator dot */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dotClass} ${cfg.blink ? 'animate-[blink_3s_ease-in-out_infinite]' : ''}`} />
                      {cfg.blink && (
                        <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-amber-500/30 animate-[blink-ping_3s_ease-in-out_infinite]" />
                      )}
                    </div>

                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bgClass}`}>
                      <IconComponent size={15} className={cfg.textClass} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
                          {monitor.label}
                        </span>
                        {isCritical && (
                          <span className="px-1.5 py-0.5 rounded bg-ruby-950/60 border border-ruby-500/30 text-ruby-400 text-[9px] font-bold uppercase tracking-wider flex-shrink-0">
                            Crítico
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                        <span className="font-mono">{monitor.url}</span>
                        <span>·</span>
                        <span className="text-zinc-600">{TYPE_LABEL[monitor.monitor_type] || monitor.monitor_type}</span>
                      </div>
                    </div>

                    {/* Status & response time */}
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xs font-semibold ${cfg.textClass}`}>
                        {cfg.label}
                      </div>
                      <div className="text-[10px] text-zinc-600 font-mono">
                        {monitor.response_time_ms != null
                          ? formatResponseTime(monitor.response_time_ms)
                          : formatLastChecked(monitor.last_checked_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Empty collapsed state ───────────────────────────────────── */}
      {collapsed && (
        <div className="px-5 py-3 text-center text-xs text-zinc-600">
          {activeMonitors.length} monitor{activeMonitors.length !== 1 ? 'es' : ''} activo{activeMonitors.length !== 1 ? 's' : ''}
          {downMonitors.length > 0 && ` · ${downMonitors.length} caído${downMonitors.length > 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  );
}
