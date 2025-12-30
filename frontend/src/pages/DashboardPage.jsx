import React from 'react';
import { Activity, Wifi, Users, Zap, ArrowUpRight } from 'lucide-react';

const metrics = [
  { label: 'Tickets activos', value: '18', trend: '+3 hoy', icon: <Activity size={18} />, tone: 'info' },
  { label: 'Clientes conectados', value: '7.9k', trend: '+124 sync', icon: <Users size={18} />, tone: 'success' },
  { label: 'Nodos operativos', value: '9', trend: 'ok', icon: <Zap size={18} />, tone: 'success' },
  { label: 'ONUs online', value: '4.7k', trend: '96.2%', icon: <Wifi size={18} />, tone: 'warning' },
];

const alerts = [
  { name: 'SmartOLT', status: 'Degradado', impact: 'Latencia alta en zona sur', tag: 'warning' },
  { name: 'ISPCube Sync', status: 'OK', impact: 'Última sync hace 5 min', tag: 'success' },
  { name: 'Beholder Live', status: 'Monitor', impact: '2 casos lentos', tag: 'info' },
];

export default function DashboardPage() {
  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <section className="card glass" style={{ padding: '1.5rem' }}>
        <div className="topbar" style={{ marginBottom: '0.75rem' }}>
          <div>
            <div className="hero-badge">Status general</div>
            <h2 style={{ margin: '0.2rem 0' }}>Tablero operativo</h2>
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              Visión rápida de tickets, clientes y estado de nodos Beholder.
            </p>
          </div>
          <button type="button" className="button">
            <ArrowUpRight size={16} /> Ver monitoreo
          </button>
        </div>

        <div className="grid grid-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="card" style={{ borderColor: 'rgba(34, 211, 238, 0.16)' }}>
              <div className="card-title">{metric.label}</div>
              <div className="topbar" style={{ gap: '0.5rem' }}>
                <p className="card-value">{metric.value}</p>
                <span className={`tag ${metric.tone}`}>{metric.icon} {metric.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card table-card">
        <div className="topbar" style={{ marginBottom: '0.5rem' }}>
          <div>
            <div className="card-title">Alertas recientes</div>
            <h3 style={{ margin: 0 }}>Integraciones y diagnósticos</h3>
          </div>
          <div className="pill">Actualizado hace 2 min</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Estado</th>
              <th>Detalle</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.name}>
                <td>{alert.name}</td>
                <td>
                  <span className={`tag ${alert.tag}`}>{alert.status}</span>
                </td>
                <td style={{ color: 'var(--muted)' }}>{alert.impact}</td>
                <td>
                  <button type="button" className="button secondary">
                    <ArrowUpRight size={14} /> Ver log
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
