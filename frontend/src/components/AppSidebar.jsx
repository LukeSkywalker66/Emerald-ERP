/**
 * AppSidebar - Navegación principal del sistema
 * Estructura plana orientada a operaciones diarias
 * Usa Shadcn UI Sidebar components
 */

import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  Map,
  ClipboardList,
  Network,
  TowerControl,
  Users,
  Settings,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { EmeraldLogo } from '@/components/ui/EmeraldLogo';

// Configuración de menú
const menuSections = [
  {
    label: 'Principal',
    items: [
      {
        title: 'Dashboard',
        icon: LayoutDashboard,
        href: '/app',
        description: 'Visión general del sistema',
      },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      {
        title: 'Tickets',
        icon: Ticket,
        href: '/app/tickets',
        description: 'Gestión de reclamos',
      },
      {
        title: 'Coordinación',
        icon: Map,
        href: '/app/coordination',
        description: 'Mapa y agenda',
        badge: 'Próximamente',
      },
      {
        title: 'Órdenes de Trabajo',
        icon: ClipboardList,
        href: '/app/work-orders',
        description: 'Ejecución técnica',
        badge: 'Próximamente',
      },
    ],
  },
  {
    label: 'Red y Clientes',
    items: [
      {
        title: 'Conexiones',
        icon: Network,
        href: '/app/connections',
        description: 'Base instalada (ISPCube)',
        badge: 'Próximamente',
      },
      {
        title: 'Nodos',
        icon: TowerControl,
        href: '/app/nodes',
        description: 'Infraestructura',
        badge: 'Próximamente',
      },
      {
        title: 'Clientes',
        icon: Users,
        href: '/app/customers',
        description: 'Datos comerciales',
        badge: 'Próximamente',
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        title: 'Configuración',
        icon: Settings,
        href: '/app/settings',
        description: 'Ajustes generales',
      },
    ],
  },
];

export default function AppSidebar() {
  const location = useLocation();

  /**
   * Determina si un item está activo
   * Exact match para Dashboard, prefix match para otros
   */
  const isItemActive = (href) => {
    if (href === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <Sidebar className="border-r border-zinc-800 bg-zinc-950">
      {/* Header con Logo */}
      <SidebarHeader className="border-b border-zinc-800/50 px-6 py-5">
        <Link to="/app" className="flex items-center gap-3 group">
          <EmeraldLogo className="scale-75" withText={false} />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-tight">
              Emerald ERP
            </span>
            <span className="text-xs text-emerald-400/80 font-medium">
              Operaciones
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="px-3 py-4">
        {menuSections.map((section) => (
          <SidebarGroup key={section.label} className="mb-6">
            <SidebarGroupLabel className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-3">
              {section.label}
            </SidebarGroupLabel>
            
            <SidebarMenu>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.description}
                      className={`
                        relative px-3 py-2.5 rounded-lg transition-all
                        ${
                          active
                            ? 'bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500'
                            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                        }
                      `}
                    >
                      <Link to={item.href} className="flex items-center gap-3 w-full">
                        <Icon
                          size={18}
                          className={active ? 'text-emerald-400' : 'text-zinc-500'}
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer con info de versión */}
      <SidebarFooter className="border-t border-zinc-800/50 px-6 py-4">
        <div className="text-xs text-zinc-600">
          <p className="font-mono">v2.1.0</p>
          <p className="text-zinc-700 mt-1">Build 2026.01.06</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
