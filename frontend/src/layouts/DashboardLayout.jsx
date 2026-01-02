import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Ticket, Users, Box, Settings, LogOut, Shield, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmeraldLogo } from '../components/ui/EmeraldLogo';

const navItems = [
  { to: '/app', label: 'Inicio', icon: Home },
  { to: '/app/tickets', label: 'Tickets', icon: Ticket },
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/inventario', label: 'Inventario', icon: Box },
  { to: '/app/settings', label: 'Ajustes', icon: Settings },
];

function Tooltip({ label, children }) {
  return (
    <div className="rail-tooltip">
      {children}
      <span className="rail-tooltip-text">{label}</span>
    </div>
  );
}

function NavRail({ items, currentPath }) {
  return (
    <aside className="nav-rail">
      {/* Logo en la parte superior */}
      <div className="px-3 py-6 border-b border-zinc-800/50">
        <EmeraldLogo className="scale-75" withText={false} />
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4">
        {items.map(({ to, label, icon }) => (
          <Tooltip key={to} label={label}>
            <NavLink
              to={to}
              end={to === '/app'}
              className={({ isActive }) => `nav-rail-btn ${isActive ? 'active' : ''}`}
            >
              {React.createElement(icon, { 
                size: 20,
                className: ''
              })}
            </NavLink>
          </Tooltip>
        ))}
      </nav>
    </aside>
  );
}

function MobileBottomNav({ items, currentPath }) {
  const visible = items.slice(0, 4);
  return (
    <nav className="mobile-bottom-nav">
      <div className="mobile-bottom-nav__inner">
        {visible.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/app'}
            className={({ isActive }) => `mobile-bottom-nav__item ${isActive ? 'active' : ''}`}
          >
            {React.createElement(icon, { 
              size: 20,
              className: ''
            })}
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <NavRail items={navItems} currentPath={location.pathname} />

      <div className="content-column">
        <header className="topbar">
          <div className="topbar-brand">
            <Shield size={16} className="text-emerald-500" />
            <span>Emerald ERP</span>
            <span className="separator">|</span>
            <span className="accent text-emerald-400">Operaciones</span>
          </div>

          <div className="topbar-actions">
            <button type="button" className="command-placeholder">
              <Search size={16} />
              <span>Buscar... (Ctrl+K)</span>
            </button>

            <div className="user-chip">
              <span className="avatar-circle bg-emerald-950 text-emerald-400 border-emerald-500/30">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
              <div className="user-meta">
                <div className="user-email">{user?.email || 'Usuario'}</div>
                <div className="user-role text-emerald-500/80">{user?.role || 'Viewer'}</div>
              </div>
            </div>

            <button type="button" onClick={handleLogout} className="btn-logout">
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav items={navItems} currentPath={location.pathname} />
    </div>
  );
}
