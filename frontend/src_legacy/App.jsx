import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  
  // MODAL DETALLE (VER)
  const [selectedTicket, setSelectedTicket] = useState(null)
  
  // MODAL CREACIÓN (NUEVO)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [servicesList, setServicesList] = useState([]) 
  const [newTicketData, setNewTicketData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    service_id: ''
  })
  
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // DICCIONARIOS
  const statusMap = { 'open': 'Abierto', 'in_progress': 'En Progreso', 'resolved': 'Resuelto', 'closed': 'Cerrado' }
  const priorityMap = { 'low': 'Baja', 'medium': 'Media', 'high': 'Alta', 'critical': 'Crítica' }

  // CARGA INICIAL
  useEffect(() => {
    fetchTickets()
    fetchServices()
  }, [])

  const fetchTickets = () => {
    fetch(`${API_URL}/tickets`)
      .then(res => res.json())
      .then(data => {
        setTickets(data)
        setLoading(false)
      })
      .catch(err => console.error("Error:", err))
  }

  const fetchServices = () => {
    fetch(`${API_URL}/services_options`)
      .then(res => res.json())
      .then(data => setServicesList(data))
      .catch(err => console.error("Error services:", err))
  }

  // CREAR TICKET (POST)
  const handleCreateSubmit = (e) => {
    e.preventDefault()
    
    if(!newTicketData.service_id) {
        alert("Por favor selecciona un cliente")
        return
    }

    const payload = {
        title: newTicketData.title,
        description: newTicketData.description,
        priority: newTicketData.priority,
        service_id: parseInt(newTicketData.service_id)
    }

    fetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(savedTicket => {
        setTickets([savedTicket, ...tickets]) 
        setShowCreateModal(false)
        setNewTicketData({ title: '', description: '', priority: 'medium', service_id: '' }) 
    })
    .catch(err => alert("Error creando ticket: " + err))
  }

  return (
    <div>
      {/* NAVBAR */}
      <nav className="navbar-top">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <span className="navbar-brand">Emerald ERP</span>
            <span className="navbar-text-small">Gestión de ISP</span>
          </div>
          <div className="text-white small">Admin (Clark Kent)</div>
        </div>
      </nav>

      <div className="container">
        {/* KPIS */}
        <div className="row mb-4">
          <div className="col-md-3 mb-3">
            <div className="kpi-card kpi-success">
              <div className="kpi-title">Tickets Pendientes</div>
              <div className="kpi-value">{tickets.filter(t => t.status === 'open').length}</div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="kpi-card kpi-warning">
              <div className="kpi-title">En Atención</div>
              <div className="kpi-value">{tickets.filter(t => t.status === 'in_progress').length}</div>
            </div>
          </div>
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="table-container">
          <div className="table-header">
            <h5>Bandeja de Entrada</h5>
            <button 
                className="btn btn-primary btn-primary-custom btn-sm"
                onClick={() => setShowCreateModal(true)}
            >
                + Nuevo Reclamo
            </button>
          </div>
          
          {loading ? (
            <div className="p-5 text-center text-muted">Cargando sistema...</div>
          ) : (
            <div className="table-responsive">
              <table className="table custom-table table-hover">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Asunto</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => (
                    <tr key={ticket.id} onClick={() => setSelectedTicket(ticket)} style={{cursor: 'pointer'}}>
                      <td className="fw-bold">#{ticket.id}</td>
                      <td className="fw-semibold text-dark">{ticket.title}</td>
                      <td>
                        <span className={`status-badge ${ticket.priority === 'high' ? 'badge-high' : 'badge-normal'}`}>
                          {priorityMap[ticket.priority] || ticket.priority}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge badge-open">{statusMap[ticket.status] || ticket.status}</span>
                      </td>
                      <td className="text-muted small">{ticket.description?.substring(0, 50)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL 1: DETALLE (LECTURA) --- */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            
            <div className="modal-header">
              <div>
                <h5 className="mb-0 fw-bold">Reclamo #{selectedTicket.id}</h5>
                <small className="text-muted">Ingresado el {new Date(selectedTicket.created_at).toLocaleDateString()}</small>
              </div>
              <button className="btn-close" onClick={() => setSelectedTicket(null)}>×</button>
            </div>

            <div className="modal-body">
              <h4 className="mb-3">{selectedTicket.title}</h4>
              
              <div className="row mb-4">
                <div className="col-6">
                  <label className="small text-muted fw-bold">ESTADO</label>
                  <div><span className="badge bg-light text-dark border">{statusMap[selectedTicket.status]}</span></div>
                </div>
                <div className="col-6">
                  <label className="small text-muted fw-bold">PRIORIDAD</label>
                  <div>
                    <span className={`status-badge ${selectedTicket.priority === 'high' ? 'badge-high' : 'badge-normal'}`}>
                        {priorityMap[selectedTicket.priority]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="small text-muted fw-bold">DESCRIPCIÓN DEL PROBLEMA</label>
                <p className="p-3 bg-light rounded border">{selectedTicket.description}</p>
              </div>

              {/* DATOS DEL CLIENTE RECUPERADOS */}
              {selectedTicket.service && selectedTicket.service.client ? (
                <div className="mb-3 border-top pt-3">
                   <label className="small text-muted fw-bold">DATOS DEL CLIENTE Y SERVICIO</label>
                   <div className="d-flex align-items-center mt-2">
                      <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{width: 40, height: 40, marginRight: 12, fontSize: '1.2rem'}}>
                        {selectedTicket.service.client.name.charAt(0)}
                      </div>
                      <div className="w-100">
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="fw-bold text-dark">{selectedTicket.service.client.name}</div>
                            {selectedTicket.service.plan && (
                                <span className="badge bg-secondary text-white">
                                    ⬇ {selectedTicket.service.plan.bandwidth_down}M / ⬆ {selectedTicket.service.plan.bandwidth_up}M
                                </span>
                            )}
                          </div>
                          <div className="small text-muted">
                            {selectedTicket.service.installation_address}
                          </div>
                          <div className="small text-primary font-monospace">
                             IP: {selectedTicket.service.ip_address}
                          </div>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="alert alert-warning">Ticket sin datos de servicio asociados</div>
              )}

            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTicket(null)}>Cerrar</button>
              <button className="btn btn-primary btn-primary-custom btn-sm">Asignar Técnico</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: NUEVO TICKET (FORMULARIO) --- */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="mb-0 fw-bold">Nuevo Reclamo Técnico</h5>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleCreateSubmit}>
                <div className="modal-body">
                    
                    <div className="mb-3">
                        <label className="form-label small fw-bold text-muted">CLIENTE / SERVICIO AFECTADO</label>
                        <select 
                            className="form-select" 
                            value={newTicketData.service_id}
                            onChange={(e) => setNewTicketData({...newTicketData, service_id: e.target.value})}
                            required
                        >
                            <option value="">Seleccione un cliente...</option>
                            {servicesList.map(svc => (
                                <option key={svc.id} value={svc.id}>
                                    {svc.client.name} — {svc.installation_address} ({svc.ip_address})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-3">
                        <label className="form-label small fw-bold text-muted">ASUNTO</label>
                        <input 
                            type="text" 
                            className="form-control"
                            placeholder="Ej: Sin internet, cable cortado..."
                            value={newTicketData.title}
                            onChange={(e) => setNewTicketData({...newTicketData, title: e.target.value})}
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <label className="form-label small fw-bold text-muted">PRIORIDAD</label>
                        <select 
                            className="form-select"
                            value={newTicketData.priority}
                            onChange={(e) => setNewTicketData({...newTicketData, priority: e.target.value})}
                        >
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                            <option value="critical">Crítica</option>
                        </select>
                    </div>

                    <div className="mb-3">
                        <label className="form-label small fw-bold text-muted">DETALLE DEL PROBLEMA</label>
                        <textarea 
                            className="form-control" 
                            rows="3"
                            value={newTicketData.description}
                            onChange={(e) => setNewTicketData({...newTicketData, description: e.target.value})}
                            required
                        ></textarea>
                    </div>

                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary btn-primary-custom btn-sm">Crear Ticket</button>
                </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default App