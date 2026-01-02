import React from 'react';
import { Activity, Wifi, Users, Zap, ArrowUpRight, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

const metrics = [
  { 
    label: 'Tickets activos', 
    value: '18', 
    trend: '+3 hoy', 
    icon: Activity, 
    tone: 'warning',
    change: '+20%'
  },
  { 
    label: 'Clientes conectados', 
    value: '7.9k', 
    trend: '+124 sync', 
    icon: Users, 
    tone: 'success',
    change: '+1.6%'
  },
  { 
    label: 'Nodos operativos', 
    value: '9/9', 
    trend: 'Todos OK', 
    icon: Zap, 
    tone: 'success',
    change: '100%'
  },
  { 
    label: 'ONUs online', 
    value: '4.7k', 
    trend: '96.2%', 
    icon: Wifi, 
    tone: 'warning',
    change: '-0.3%'
  },
];

const integrations = [
  { 
    name: 'SmartOLT', 
    status: 'Degradado', 
    impact: 'Latencia alta en zona sur', 
    tag: 'warning',
    lastSync: 'Hace 2 min'
  },
  { 
    name: 'ISPCube Sync', 
    status: 'OK', 
    impact: 'Última sync hace 5 min', 
    tag: 'success',
    lastSync: 'Hace 5 min'
  },
  { 
    name: 'Beholder Live', 
    status: 'Monitor', 
    impact: '2 casos lentos', 
    tag: 'info',
    lastSync: 'En tiempo real'
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
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
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-900/30"
        >
          <ArrowUpRight size={16} />
          Ver monitoreo completo
        </button>
      </div>

      {/* KPI Cards - Bento Grid 4 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const IconComponent = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-xl shadow-black/20 hover:border-emerald-500/30 transition-all duration-200 group"
            >
              {/* Header con icono */}
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  metric.tone === 'success' 
                    ? 'bg-emerald-500/10 border border-emerald-500/30' 
                    : metric.tone === 'warning'
                    ? 'bg-amber-500/10 border border-amber-500/30'
                    : 'bg-blue-500/10 border border-blue-500/30'
                }`}>
                  <IconComponent 
                    size={20} 
                    className={
                      metric.tone === 'success' 
                        ? 'text-emerald-400' 
                        : metric.tone === 'warning'
                        ? 'text-amber-400'
                        : 'text-blue-400'
                    } 
                  />
                </div>
                
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                  metric.tone === 'success' 
                    ? 'bg-emerald-950/50 text-emerald-400' 
                    : metric.tone === 'warning'
                    ? 'bg-amber-950/50 text-amber-400'
                    : 'bg-blue-950/50 text-blue-400'
                }`}>
                  <TrendingUp size={12} />
                  {metric.change}
                </div>
              </div>

              {/* Título */}
              <p className="text-sm font-medium text-zinc-400 mb-2">
                {metric.label}
              </p>

              {/* Valor principal */}
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold text-white tracking-tight">
                  {metric.value}
                </p>
                <span className="text-xs text-zinc-500 font-medium">
                  {metric.trend}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla de Integraciones - Ancho completo */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 shadow-xl shadow-black/20 overflow-hidden">
        {/* Header de tabla */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Alertas Recientes</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Integraciones y diagnósticos de sistemas externos
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs text-zinc-400 font-medium">
              Actualizado hace 2 min
            </span>
          </div>
        </div>

        {/* Tabla compacta */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Servicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Impacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Última Sync
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {integrations.map((integration) => (
                <tr key={integration.name} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        integration.tag === 'success'
                          ? 'bg-emerald-500/10 border border-emerald-500/30'
                          : integration.tag === 'warning'
                          ? 'bg-amber-500/10 border border-amber-500/30'
                          : 'bg-blue-500/10 border border-blue-500/30'
                      }`}>
                        {integration.tag === 'success' && <CheckCircle size={16} className="text-emerald-400" />}
                        {integration.tag === 'warning' && <AlertTriangle size={16} className="text-amber-400" />}
                        {integration.tag === 'info' && <Activity size={16} className="text-blue-400" />}
                      </div>
                      <span className="text-sm font-medium text-white">
                        {integration.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                      integration.tag === 'success'
                        ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30'
                        : integration.tag === 'warning'
                        ? 'bg-amber-950/50 text-amber-400 border border-amber-500/30'
                        : 'bg-blue-950/50 text-blue-400 border border-blue-500/30'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        integration.tag === 'success'
                          ? 'bg-emerald-500'
                          : integration.tag === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}></div>
                      {integration.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {integration.impact}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500 font-mono">
                    {integration.lastSync}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors border border-zinc-700"
                    >
                      <ArrowUpRight size={12} />
                      Ver log
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
