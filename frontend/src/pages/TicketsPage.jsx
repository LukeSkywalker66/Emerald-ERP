import React from 'react';
import { Ticket, AlertCircle, CheckCircle2 } from 'lucide-react';

const tickets = [
  { id: 'T-1042', cliente: 'Eventura SA', prioridad: 'Alta', estado: 'Abierto', descripcion: 'ONU sin luz PON', fecha: 'Hoy 08:14' },
  { id: 'T-1039', cliente: 'MMVO Telecom', prioridad: 'Media', estado: 'Diagnóstico', descripcion: 'SNR inestable nodo 4', fecha: 'Ayer 19:02' },
  { id: 'T-1031', cliente: 'Barrio Norte', prioridad: 'Baja', estado: 'Cerrado', descripcion: 'Router reemplazado', fecha: 'Ayer 09:45' },
];

const statusTone = {
  Abierto: 'danger',
  Diagnóstico: 'warning',
  Cerrado: 'success',
};

export default function TicketsPage() {
  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <div className="topbar">
        <div>
          <div className="hero-badge">
            <Ticket size={16} /> Tickets
          </div>
          <h2 style={{ margin: '0.2rem 0' }}>Gestión de tickets</h2>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Estado rápido de incidencias y diagnósticos Beholder.</p>
        </div>
        <button type="button" className="button">
          Crear ticket
        </button>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Descripción</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>{ticket.id}</td>
                <td>{ticket.cliente}</td>
                <td>
                  <span className={`tag ${ticket.prioridad === 'Alta' ? 'danger' : ticket.prioridad === 'Media' ? 'warning' : 'info'}`}>
                    {ticket.prioridad}
                  </span>
                </td>
                <td>
                  <span className={`tag ${statusTone[ticket.estado]}`}>{ticket.estado}</span>
                </td>
                <td style={{ color: 'var(--muted)' }}>{ticket.descripcion}</td>
                <td>{ticket.fecha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card glass" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <AlertCircle size={18} color="#fbbf24" />
        <div>
          <div className="card-title">Sugerencia</div>
          <p style={{ margin: 0 }}>
            Integrá este módulo con el endpoint de tickets del backend para mostrar datos reales, paginación y filtros.
          </p>
        </div>
      </div>
    </div>
  );
}
