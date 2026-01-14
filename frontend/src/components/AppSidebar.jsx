/**
 * AppSidebar - Navegación principal del sistema
 * Estructura modular con secciones temáticas
 * Usa Shadcn UI Sidebar components + diseño Emerald profesional
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
  UserCog,
  Settings,
  BarChart3,
  Building2,
  Package,
  ArrowLeftRight,
  AlertCircle,
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
} from './ui/sidebar';
import { EmeraldLogo } from './ui/EmeraldLogo';

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
      },
      {
        title: 'Órdenes de Trabajo',
        icon: ClipboardList,
        href: '/app/work-orders',
        description: 'Ejecución técnica',
      },
    ],
  },
  {
    label: 'Inventario',
    items: [
      {
        title: 'Dashboard',
        icon: BarChart3,
        href: '/app/inventory',
        description: 'Métricas de stock',
      },
      {
        title: 'Almacenes',
        icon: Building2,
        href: '/app/inventory/warehouses',
        description: 'Gestión de depósitos',
      },
      {
        title: 'Catálogo',
        icon: Package,
        href: '/app/inventory/products',
        description: 'Base de productos',
      },
      {
        title: 'Operaciones',
        icon: ArrowLeftRight,
        href: '/app/inventory/transfer',
        description: 'Transferencias y ajustes',
      },
      {
        title: 'Auditoría',
        icon: ClipboardList,
        href: '/app/inventory/movements',
        description: 'Historial de movimientos',
      },
      {
        title: 'Alertas',
        icon: AlertCircle,
        href: '/app/inventory/alerts',
        description: 'Stock crítico',
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
      },
      {
        title: 'Nodos',
        icon: TowerControl,
        href: '/app/nodes',
        description: 'Infraestructura',
      },
      {
        title: 'Clientes',
        icon: Users,
        href: '/app/clients',
        description: 'Padrón de clientes',
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
        description: 'Opciones del sistema',
      },
      {
        title: 'Usuarios',
        icon: UserCog,
        href: '/app/users',
        description: 'Gestión de cuentas',
      },
    ],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();

  const isItemActive = (href) => {
    // Match exacto
    if (pathname === href) return true;
    
    // Para items que son "raíces" de secciones (ej: /app/inventory),
    // NO activar si estamos en una subruta específica
    if (href === '/app/inventory' && pathname.startsWith('/app/inventory/')) {
      // Solo activo si es exactamente /app/inventory
      return false;
    }
    
    // Para otras rutas, activo si comienza con href/
    return pathname.startsWith(href + '/');
  };

  return (
    <Sidebar className="bg-gradient-to-b from-zinc-950 to-zinc-900/80 w-64">
      {/* Header con Logo */}
      <SidebarHeader className="border-b border-zinc-800/50 px-4 py-4 bg-gradient-to-r from-zinc-950/50 to-transparent">
        <Link to="/app" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-lg group-hover:bg-emerald-500/30 transition-all" />
            <EmeraldLogo className="scale-75 relative" withText={false} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-tight group-hover:text-emerald-400 transition-colors">
              Emerald
            </span>
            <span className="text-xs text-emerald-400/70 font-semibold group-hover:text-emerald-400 transition-colors">
              ERP v2.1
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="px-3 py-4 space-y-2">
        {menuSections.map((section) => (
          <SidebarGroup key={section.label} className="py-2">
            <SidebarGroupLabel className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-3 opacity-70 hover:opacity-100 transition-opacity">
              {section.label}
            </SidebarGroupLabel>
            
            <SidebarMenu className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.href}
                        title={item.description}
                        className={`
                          relative group flex items-center gap-3 px-3 py-2.5 rounded-lg
                          transition-all duration-200 cursor-pointer
                          ${
                            active
                              ? 'bg-emerald-500/15 text-emerald-300 before:content-[""] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-gradient-to-b before:from-emerald-400 before:to-emerald-500 before:rounded-r-sm'
                              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
                          }
                        `}
                      >
                        {/* Icono con efecto */}
                        <div className={`relative transition-all ${active ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                          <Icon size={18} />
                          {/* Punto rojo para alertas (solo en Alertas) */}
                          {item.href === '/app/inventory/alerts' && (
                            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                          )}
                        </div>

                        {/* Texto con subrayado en hover */}
                        <span className={`text-sm font-medium flex-1 group-hover:text-zinc-50 transition-colors ${active ? 'font-semibold' : ''}`}>
                          {item.title}
                        </span>

                        {/* Indicador de chevron en activo */}
                        {active && (
                          <div className="w-1 h-1 rounded-full bg-emerald-400 ml-auto" />
                        )}
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
      <SidebarFooter className="border-t border-zinc-800/50 px-4 py-3 bg-gradient-to-r from-transparent to-emerald-500/5">
        <div className="text-xs text-zinc-500">
          <p className="font-mono text-zinc-600">v2.1.0</p>
          <p className="text-zinc-600/70 mt-0.5 text-xs">Build 2026.01.13</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
