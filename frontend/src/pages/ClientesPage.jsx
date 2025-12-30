import React from 'react';
import { Users, WifiOff, Wifi } from 'lucide-react';

const clientes = [
  { nombre: 'Eventura SA', plan: 'Enterprise 200', nodo: 'NOC-01', estado: 'Online', ultimaSync: 'hace 5 min' },
  { nombre: 'MMVO Telecom', plan: 'Carrier 100', nodo: 'SUR-04', estado: 'Offline', ultimaSync: 'hace 12 min' },
  { nombre: 'Coop. Norte', plan: 'Business 50', nodo: 'NOR-02', estado: 'Online', ultimaSync: 'hace 9 min' },
];

export default function ClientesPage() {
  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <div className="topbar">
        <div>
          <div className="hero-badge">
            <Users size={16} /> Clientes
          </div>
          <h2 style={{ margin: '0.2rem 0' }}>Clientes y conexiones</h2>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Datos tomados de sincronización con ISPCube / SmartOLT.</p>
        </div>
        <button type="button" className="button secondary">
          Exportar
        </button>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plan</th>
              <th>Nodo</th>
              <th>Estado</th>
              <th>Última sync</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.nombre}>
                <td>{cliente.nombre}</td>
                <td>{cliente.plan}</td>
                <td>{cliente.nodo}</td>
                <td>
                  <span className={`tag ${cliente.estado === 'Online' ? 'success' : 'danger'}`}>
                    {cliente.estado === 'Online' ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {cliente.estado}
                  </span>
                </td>
                <td style={{ color: 'var(--muted)' }}>{cliente.ultimaSync}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
