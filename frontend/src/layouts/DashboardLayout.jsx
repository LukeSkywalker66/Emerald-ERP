import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Ticket, Users, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/app', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { to: '/app/tickets', label: 'Tickets', icon: <Ticket size={18} /> },
  { to: '/app/clientes', label: 'Clientes', icon: <Users size={18} /> },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="badge-dot" /> Emerald Ops
        </div>

        <div className="nav-group">
          <span className="nav-label">Panel</span>
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink key={item.to} to={item.to} className={cn('nav-item', { active: isActive })}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && <span className="tag info">live</span>}
              </NavLink>
            );
          })}
        </div>

        <div className="nav-group">
          <span className="nav-label">Seguridad</span>
          <div className="nav-item" style={{ cursor: 'default' }}>
            <span className="nav-icon">
              <Shield size={18} />
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>Rol</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{user?.role || 'Viewer'}</div>
            </div>
          </div>
          <button type="button" className="nav-item" onClick={handleLogout}>
            <span className="nav-icon">
              <LogOut size={18} />
            </span>
            Salir
          </button>
        </div>
      </aside>

      <main className="main-area">
        <div className="topbar">
          <div>
            <div className="hero-badge">
              <span className="badge-dot" /> Backend · FastAPI · Beholder
            </div>
            <h1>Emerald ERP</h1>
          </div>
          <div className="pill">
            <span className="badge-dot" /> Sesión: {user?.email || 'sin usuario'}
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
