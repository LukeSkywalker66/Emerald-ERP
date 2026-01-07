/**
 * MobileNav - Barra de navegación inferior para móviles
 * 
 * Estilo "App Nativa" con 3 botones principales:
 * - Tickets
 * - Mis OTs (destacado)
 * - Menú (Sheet con opciones)
 * 
 * Visible solo en pantallas < 768px (md breakpoint)
 */

import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Ticket, ClipboardList, Menu, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  {
    id: 'tickets',
    label: 'Tickets',
    icon: Ticket,
    href: '/app/tickets',
    matchPaths: ['/app/tickets'],
  },
  {
    id: 'work-orders',
    label: 'Mis OTs',
    icon: ClipboardList,
    href: '/app/work-orders',
    matchPaths: ['/app/work-orders'],
    featured: true, // Destacado para técnicos
  },
  {
    id: 'menu',
    label: 'Menú',
    icon: Menu,
    isMenu: true,
  },
];

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuOpen(false);
  };

  const isActive = (item) => {
    if (!item.matchPaths) return false;
    return item.matchPaths.some(path => location.pathname.startsWith(path));
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800 h-16 safe-area-inset-bottom">
      <div className="grid grid-cols-3 h-full max-w-screen-sm mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          // Item de menú (Sheet)
          if (item.isMenu) {
            return (
              <Sheet key={item.id} open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className="flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors active:scale-95"
                  >
                    <Icon size={22} className="transition-transform" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                </SheetTrigger>
                
                <SheetContent 
                  side="bottom" 
                  className="bg-zinc-950 border-zinc-800 rounded-t-2xl"
                >
                  <SheetHeader className="pb-4 border-b border-zinc-800">
                    <SheetTitle className="text-white text-left">Opciones</SheetTitle>
                  </SheetHeader>

                  <div className="py-6 space-y-3">
                    {/* Info del usuario */}
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <UserIcon size={18} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {user?.email || 'Usuario'}
                        </p>
                        <p className="text-xs text-emerald-400/80 capitalize">
                          {user?.role || 'Técnico'}
                        </p>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800"
                        onClick={() => {
                          navigate('/app/settings');
                          setMenuOpen(false);
                        }}
                      >
                        <UserIcon size={16} className="mr-2" />
                        Mi Perfil
                      </Button>

                      <Button
                        variant="ghost"
                        className="w-full justify-start text-rose-300 hover:text-rose-200 hover:bg-rose-950/30"
                        onClick={handleLogout}
                      >
                        <LogOut size={16} className="mr-2" />
                        Cerrar Sesión
                      </Button>
                    </div>

                    {/* Footer info */}
                    <div className="pt-4 mt-4 border-t border-zinc-800">
                      <p className="text-xs text-zinc-600 text-center font-mono">
                        Emerald ERP v2.1.0
                      </p>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            );
          }

          // Items de navegación normal
          return (
            <Link
              key={item.id}
              to={item.href}
              className={`
                flex flex-col items-center justify-center gap-1 transition-all active:scale-95
                ${active 
                  ? 'text-emerald-400' 
                  : 'text-zinc-400 hover:text-zinc-200'
                }
              `}
            >
              <Icon 
                size={item.featured ? 26 : 22} 
                className={`
                  transition-all
                  ${item.featured && active ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' : ''}
                  ${item.featured ? 'text-emerald-400' : ''}
                `}
              />
              <span 
                className={`
                  text-xs font-medium
                  ${item.featured && active ? 'font-semibold' : ''}
                `}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
