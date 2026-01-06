import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppSidebar } from '../components/AppSidebar';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar with flat navigation */}
      <AppSidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1">
        {/* Topbar */}
        <header className="border-b border-zinc-800 bg-zinc-950/50 px-6 py-3 flex items-center justify-between">
          <div className="flex-1" />
          
          {/* Right side actions */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-800/30">
              <span className="text-xs text-zinc-400">{user?.email || 'Usuario'}</span>
              <span className="text-xs text-emerald-400/60 font-medium">{user?.role || 'Viewer'}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400 transition-colors px-3 py-2 rounded-md hover:bg-zinc-800/30"
            >
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
