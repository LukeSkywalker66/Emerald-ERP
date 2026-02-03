/**
 * AppSidebar - Navegación principal con estructura acordeón
 * 
 * Características:
 * - Secciones colapsables para reducir ruido visual
 * - Operaciones expandidas por defecto (uso diario)
 * - Inventario e Ingeniería colapsados (uso ocasional)
 * - Animaciones suaves y estado persistente en localStorage
 * - Auto-expansión cuando se navega a un item dentro de una sección colapsada
 */

import React, { useState, useEffect } from 'react';
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
  Wrench,
  ChevronDown,
  ChevronRight,
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

// Clave para localStorage
const SIDEBAR_STATE_KEY = 'emerald-sidebar-expanded-sections';

// 🎯 Configuración de menú con estructura jerárquica
const MENU_ITEMS = [
  {
    id: 'principal',
    label: 'Principal',
    expandedByDefault: true,
    collapsible: false, // No se puede colapsar
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
    id: 'operaciones',
    label: 'Operaciones',
    expandedByDefault: true, // Expandido por defecto (uso diario)
    collapsible: true,
    items: [
      {
        title: 'Tickets',
        icon: Ticket,
        href: '/app/tickets',
        description: 'Gestión de reclamos',
      },
      {
        title: 'Cuadrillas',
        icon: Users,
        href: '/app/cuadrillas',
        description: 'Gestión de equipos',
      },
      {
        title: '🎭 The Grid',
        icon: Map,
        href: '/app/coordination-grid',
        description: 'Despacho de cuadrillas',
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
    id: 'ingenieria',
    label: 'Ingeniería / NOC',
    expandedByDefault: false, // Colapsado por defecto
    collapsible: true,
    icon: Wrench,
    items: [
      {
        title: 'Tablero Kanban',
        icon: Wrench,
        href: '/app/engineering',
        description: 'Tareas de infraestructura',
      },
    ],
  },
  {
    id: 'inventario',
    label: 'Logística',
    expandedByDefault: false, // Colapsado por defecto
    collapsible: true,
    icon: Package,
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
        badge: 'hot', // Indicador especial
      },
    ],
  },
  {
    id: 'red-clientes',
    label: 'Red y Clientes',
    expandedByDefault: false,
    collapsible: true,
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
    id: 'sistema',
    label: 'Sistema',
    expandedByDefault: true,
    collapsible: false, // Siempre visible
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

  // Estado para manejar qué secciones están expandidas (con persistencia)
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      // Intentar cargar desde localStorage
      const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Error loading sidebar state from localStorage:', error);
    }

    // Si no hay datos guardados, usar valores por defecto
    const initial = {};
    MENU_ITEMS.forEach((section) => {
      initial[section.id] = section.expandedByDefault;
    });
    return initial;
  });

  // Guardar estado en localStorage cada vez que cambie
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(expandedSections));
    } catch (error) {
      console.warn('Error saving sidebar state to localStorage:', error);
    }
  }, [expandedSections]);

  // Auto-expandir sección si navegamos a un item dentro de ella
  useEffect(() => {
    MENU_ITEMS.forEach((section) => {
      if (!section.collapsible) return;

      const hasActiveChild = section.items.some((item) => isItemActive(item.href));
      
      if (hasActiveChild && !expandedSections[section.id]) {
        setExpandedSections((prev) => ({
          ...prev,
          [section.id]: true,
        }));
      }
    });
  }, [pathname]); // Solo cuando cambia la ruta

  // Toggle de sección
  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Detectar si un item está activo
  const isItemActive = (href) => {
    if (pathname === href) return true;
    if (href === '/app/inventory' && pathname.startsWith('/app/inventory/')) {
      return false;
    }
    return pathname.startsWith(href + '/');
  };

  // Detectar si algún hijo de una sección está activo
  const isSectionActive = (section) => {
    return section.items.some((item) => isItemActive(item.href));
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

      {/* Main Navigation con Acordeón */}
      <SidebarContent className="px-3 py-4 space-y-2">
        {MENU_ITEMS.map((section) => {
          const isExpanded = expandedSections[section.id];
          const hasActiveChild = isSectionActive(section);
          const SectionIcon = section.icon;

          return (
            <SidebarGroup key={section.id} className="py-2">
              {/* Header de Sección (Clickeable si es colapsable) */}
              {section.collapsible ? (
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-lg
                    transition-all duration-200 group
                    ${
                      hasActiveChild
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : 'hover:bg-zinc-800/50'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    {SectionIcon && (
                      <SectionIcon
                        size={14}
                        className={hasActiveChild ? 'text-emerald-400' : 'text-zinc-500'}
                      />
                    )}
                    <SidebarGroupLabel
                      className={`
                        text-xs font-semibold uppercase tracking-widest
                        ${
                          hasActiveChild
                            ? 'text-emerald-400'
                            : 'text-zinc-500 group-hover:text-zinc-400'
                        }
                      `}
                    >
                      {section.label}
                    </SidebarGroupLabel>
                  </div>

                  {isExpanded ? (
                    <ChevronDown
                      size={14}
                      className={hasActiveChild ? 'text-emerald-400' : 'text-zinc-600'}
                    />
                  ) : (
                    <ChevronRight
                      size={14}
                      className={hasActiveChild ? 'text-emerald-400' : 'text-zinc-600'}
                    />
                  )}
                </button>
              ) : (
                <SidebarGroupLabel className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-3 opacity-70">
                  {section.label}
                </SidebarGroupLabel>
              )}

              {/* Items de la sección (con animación de colapso) */}
              <div
                className={`
                  overflow-hidden transition-all duration-300 ease-in-out
                  ${isExpanded ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'}
                `}
              >
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
                              ${section.collapsible ? 'pl-6' : 'pl-3'}
                              ${
                                active
                                  ? 'bg-emerald-500/15 text-emerald-300 before:content-[""] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-gradient-to-b before:from-emerald-400 before:to-emerald-500 before:rounded-r-sm'
                                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
                              }
                            `}
                          >
                            {/* Icono */}
                            <div
                              className={`relative transition-all ${
                                active
                                  ? 'text-emerald-400'
                                  : 'text-zinc-500 group-hover:text-zinc-300'
                              }`}
                            >
                              <Icon size={18} />

                              {/* Badge especial para Alertas */}
                              {item.badge === 'hot' && (
                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                              )}
                            </div>

                            {/* Título */}
                            <span
                              className={`text-sm font-medium flex-1 group-hover:text-zinc-50 transition-colors ${
                                active ? 'font-semibold' : ''
                              }`}
                            >
                              {item.title}
                            </span>

                            {/* Indicador activo */}
                            {active && (
                              <div className="w-1 h-1 rounded-full bg-emerald-400 ml-auto" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer con info de versión */}
      <SidebarFooter className="border-t border-zinc-800/50 px-4 py-3 bg-gradient-to-r from-transparent to-emerald-500/5">
        <div className="text-xs text-zinc-500">
          <p className="font-mono text-zinc-600">v2.1.0</p>
          <p className="text-zinc-600/70 mt-0.5 text-xs">Build 2026.01.16</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
