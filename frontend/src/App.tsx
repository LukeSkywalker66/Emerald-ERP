import { useEffect, useState } from 'react';
import './App.css';

// Definimos la "forma" de un Ticket (TypeScript es genial para esto)
interface Ticket {
  id: number;
  cliente: string;
  direccion: string;
  problema: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  estado: string;
  fecha: string;
}

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // Esta función se ejecuta al cargar la página
  useEffect(() => {
    // Usamos la variable de entorno que definimos en Docker
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';

    fetch(`${API_URL}/tickets`)
      .then((res) => res.json())
      .then((data) => {
        setTickets(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error conectando al backend:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="dashboard-container">
      <header className="top-bar">
        <h1>Emerald ERP 🛡️</h1>
        <div className="user-info">Admin: Lucas C.</div>
      </header>

      <main className="content">
        <div className="header-actions">
          <h2>Tickets de Soporte</h2>
          <button className="btn-primary">+ Nuevo Ticket</button>
        </div>

        {loading ? (
          <p>Cargando sistema...</p>
        ) : (
          <div className="table-wrapper">
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Problema</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>#{t.id}</td>
                    <td>
                      <div className="client-name">{t.cliente}</div>
                      <div className="client-addr">{t.direccion}</div>
                    </td>
                    <td>{t.problema}</td>
                    <td>
                      <span className={`badge priority-${t.prioridad.toLowerCase()}`}>
                        {t.prioridad}
                      </span>
                    </td>
                    <td>
                      <span className="status-dot">●</span> {t.estado}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;