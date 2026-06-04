/**
 * AppSidebar - Navegación principal con estructura acordeón
 *
 * Características:
 * - Secciones colapsables para reducir ruido visual
 * - Operaciones expandidas por defecto (uso diario)
 * - Inventario e Ingeniería colapsados (uso ocasional)
 * - Animaciones suaves y estado persistente en localStorage
 * - Auto-expansión cuando se navega a un item dentro de una sección colapsada
 * - Pin para fijar/colapsar la sidebar: colapsada muestra solo íconos, se expande al hover
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/utils/permissions';
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
  Truck,
  ChevronDown,
  ChevronRight,
  Shield,
  Pin,
  PinOff,
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

// Claves para localStorage
const SIDEBAR_STATE_KEY = 'emerald-sidebar-expanded-sections';
const SIDEBAR_PINNED_KEY = 'emerald-sidebar-pinned';

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
        resource: 'dashboard', // ← RBAC: Oculto para técnicos
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
        resource: 'tickets',
      },
      {
        title: 'Cuadrillas',
        icon: Users,
        href: '/app/cuadrillas',
        description: 'Gestión de equipos',
        resource: 'cuadrillas', // ← RBAC: Oculto para técnicos
      },
      {
        title: 'Coordinación',
        icon: Map,
        href: '/app/coordination',
        description: 'Mapa y agenda',
        resource: 'coordination', // ← RBAC: Oculto para técnicos
      },
      {
        title: 'Órdenes de Trabajo',
        icon: ClipboardList,
        href: '/app/work-orders',
        description: 'Ejecución técnica',
        resource: 'work_orders',
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
        resource: 'engineering', // ← RBAC: Oculto para técnicos
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
        resource: 'inventory_admin',
      },
      {
        title: 'Almacenes',
        icon: Building2,
        href: '/app/inventory/warehouses',
        description: 'Gestión de depósitos',
        resource: 'inventory_warehouses',
      },
      {
        title: 'Flota',
        icon: Truck,
        href: '/app/fleet',
        description: 'Gestión administrativa de vehículos',
        resource: 'fleet_assigned',
      },
      {
        title: 'Catálogo',
        icon: Package,
        href: '/app/inventory/products',
        description: 'Base de productos',
        resource: 'inventory_admin',
      },
      {
        title: 'Operaciones',
        icon: ArrowLeftRight,
        href: '/app/inventory/transfer',
        description: 'Transferencias y ajustes',
        resource: 'inventory_admin',
      },
      {
        title: 'Auditoría',
        icon: ClipboardList,
        href: '/app/inventory/movements',
        description: 'Historial de movimientos',
        resource: 'inventory_admin',
      },
      {
        title: 'Alertas',
        icon: AlertCircle,
        href: '/app/inventory/alerts',
        description: 'Stock crítico',
        resource: 'inventory_admin',
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
        resource: 'connections', // Sin restricción RBAC de momento
      },
      {
        title: 'Nodos',
        icon: TowerControl,
        href: '/app/nodes',
        description: 'Infraestructura',
        resource: 'nodes', // Sin restricción RBAC de momento
      },
      {
        title: 'Clientes',
        icon: Users,
        href: '/app/clients',
        description: 'Padrón de clientes',
        resource: 'clients', // Sin restricción RBAC de momento
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
        resource: 'settings', // ← RBAC: Oculto para técnicos
      },
      {
        title: 'Auditoría',
        icon: Shield,
        href: '/app/audit',
        description: 'Monitor de cambios',
        resource: 'audit_logs', // ← RBAC: Solo admin
      },
    ],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { user } = useAuth(); // ← RBAC: Obtener usuario para filtrar items

  // Estado: sidebar pinned (fijada = siempre expandida)
  const [isPinned, setIsPinned] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_PINNED_KEY);
      return saved === 'true';
    } catch {
      return true; // Default: pinned (comportamiento actual)
    }
  });

  // Estado: hover sobre la sidebar (para expandir al pasar el mouse cuando no está fijada)
  const [isHovering, setIsHovering] = useState(false);

  // Colapsada solo cuando NO está fijada Y NO estamos haciendo hover
  const isCollapsed = !isPinned && !isHovering;

  // Persistir estado de pin
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_PINNED_KEY, JSON.stringify(isPinned));
    } catch (error) {
      console.warn('Error saving sidebar pin state to localStorage:', error);
    }
  }, [isPinned]);

  // Toggle pin
  const togglePin = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, []);

  // Handlers para hover expand en modo colapsado
  const handleMouseEnter = useCallback(() => {
    if (!isPinned) setIsHovering(true);
  }, [isPinned]);

  const handleMouseLeave = useCallback(() => {
    if (!isPinned) setIsHovering(false);
  }, [isPinned]);

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
    // No marcar el Dashboard raíz (/app) cuando estamos en una sub-ruta
    if (href === '/app') return false;
    // No marcar Inventory Dashboard cuando estamos en sub-páginas de inventario
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
    <Sidebar
      className={`
        bg-gradient-to-b from-zinc-950 to-zinc-900/80
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header con Logo */}
      <SidebarHeader className="border-b border-zinc-800/50 px-4 py-4 bg-gradient-to-r from-zinc-950/50 to-transparent">
        <Link to="/app" className={`flex items-center group ${isCollapsed ? 'gap-0 justify-center' : 'gap-3'}`}>
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-lg group-hover:bg-emerald-500/30 transition-all" />
            <EmeraldLogo className="scale-75 relative" withText={false} />
          </div>
          {/* Texto del logo — oculto en modo colapsado */}
          <div
            className={`
              flex flex-col overflow-hidden transition-all duration-300 ease-in-out
              ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
            `}
          >
            <span className="text-sm font-bold text-white tracking-tight whitespace-nowrap group-hover:text-emerald-400 transition-colors">
              Emerald
            </span>
            <span className="text-xs text-emerald-400/70 font-semibold whitespace-nowrap group-hover:text-emerald-400 transition-colors">
              ERP v2.1
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Main Navigation con Acordeón */}
      <SidebarContent className="px-3 py-4 space-y-2">
        {/* Hint visual en modo colapsado: indica que se expande al hover */}
        {isCollapsed && (
          <div className="flex justify-center mb-1">
            <div className="w-1 h-8 rounded-full bg-zinc-800 animate-pulse" />
          </div>
        )}
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
                    w-full flex items-center rounded-lg
                    transition-all duration-200 group
                    ${isCollapsed ? 'justify-center px-2 py-2' : 'justify-between px-3 py-2'}
                    ${
                      hasActiveChild
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : 'hover:bg-zinc-800/50'
                    }
                  `}
                  title={isCollapsed ? section.label : undefined}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
                    {SectionIcon && (
                      <SectionIcon
                        size={isCollapsed ? 18 : 14}
                        className={`shrink-0 ${hasActiveChild ? 'text-emerald-400' : 'text-zinc-500'}`}
                      />
                    )}
                    {/* Label oculto en modo colapsado */}
                    <SidebarGroupLabel
                      className={`
                        text-xs font-semibold uppercase tracking-widest
                        overflow-hidden transition-all duration-300 ease-in-out
                        ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
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

                  {/* Chevron oculto en modo colapsado */}
                  <div
                    className={`
                      shrink-0 transition-all duration-300 ease-in-out
                      ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
                    `}
                  >
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
                  </div>
                </button>
              ) : (
                /* Non-collapsible sections — label oculto en modo colapsado */
                <div
                  className={`
                    overflow-hidden transition-all duration-300 ease-in-out
                    ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'}
                  `}
                >
                  <SidebarGroupLabel className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-3 opacity-70">
                    {section.label}
                  </SidebarGroupLabel>
                </div>
              )}

              {/* Items de la sección (con animación de colapso) */}
              <div
                className={`
                  overflow-hidden transition-all duration-300 ease-in-out
                  ${isExpanded ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'}
                `}
              >
                <SidebarMenu className="space-y-1">
                  {section.items
                    .filter((item) => {
                      // Si no hay recurso definido, mostrar siempre
                      if (!item.resource) return true;
                      // Verificar permiso primario del recurso
                      const hasResourceAccess = user && hasPermission(user.role, item.resource, 'view');
                      // Fallback: si el recurso es "settings" y tiene self_service, mostrar igual
                      // (permite a no-admins acceder a su auto-gestión de perfil)
                      const hasSelfServiceFallback = item.resource === 'settings' && user && hasPermission(user.role, 'self_service', 'view');
                      return hasResourceAccess || hasSelfServiceFallback;
                    })
                    .map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item.href);

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild>
                          <Link
                            to={item.href}
                            title={isCollapsed ? item.title : item.description}
                            className={`
                              relative group flex items-center px-3 py-2.5 rounded-lg ${isCollapsed ? 'gap-0' : 'gap-3'}
                              transition-all duration-200 cursor-pointer
                              ${section.collapsible ? (isCollapsed ? 'pl-2.5 justify-center' : 'pl-6') : (isCollapsed ? 'pl-2.5 justify-center' : 'pl-3')}
                              ${
                                active
                                  ? 'bg-emerald-500/15 text-emerald-300 before:content-[""] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-gradient-to-b before:from-emerald-400 before:to-emerald-500 before:rounded-r-sm'
                                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
                              }
                            `}
                          >
                            {/* Icono */}
                            <div
                              className={`relative shrink-0 transition-all ${
                                active
                                  ? 'text-emerald-400'
                                  : 'text-zinc-500 group-hover:text-zinc-300'
                              }`}
                            >
                              <Icon size={isCollapsed ? 20 : 18} />

                              {/* Badge especial para Alertas */}
                              {item.badge === 'hot' && (
                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                              )}
                            </div>

                            {/* Título — oculto en modo colapsado */}
                            <span
                              className={`
                                text-sm font-medium group-hover:text-zinc-50 transition-all duration-300 ease-in-out
                                ${active ? 'font-semibold' : ''}
                                ${isCollapsed ? 'w-0 opacity-0 overflow-hidden shrink-0' : 'flex-1 w-auto opacity-100'}
                              `}
                            >
                              {item.title}
                            </span>

                            {/* Indicador activo — oculto en modo colapsado */}
                            {active && (
                              <div
                                className={`
                                  w-1 h-1 rounded-full bg-emerald-400 ml-auto shrink-0
                                  transition-all duration-300 ease-in-out
                                  ${isCollapsed ? 'w-0 opacity-0' : 'w-1 opacity-100'}
                                `}
                              />
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

      {/* Footer con pin toggle + info de versión */}
      <SidebarFooter className="border-t border-zinc-800/50 px-4 py-3 bg-gradient-to-r from-transparent to-emerald-500/5">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {/* Pin toggle button — siempre visible */}
          <button
            onClick={togglePin}
            title={isPinned ? 'Sidebar fijada — haz clic para colapsar' : 'Sidebar colapsable — haz clic para fijar'}
            className={`
              flex items-center justify-center p-1.5 rounded-md
              transition-all duration-200
              ${
                isPinned
                  ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50'
              }
            `}
          >
            {isPinned ? (
              <Pin size={14} className="fill-emerald-400" />
            ) : (
              <PinOff size={14} />
            )}
          </button>

          {/* Versión — oculta en modo colapsado */}
          <div
            className={`
              text-xs text-zinc-500 overflow-hidden transition-all duration-300 ease-in-out
              ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
            `}
          >
            <p className="font-mono text-zinc-600 whitespace-nowrap">v2.1.0</p>
            <p className="text-zinc-600/70 mt-0.5 text-xs whitespace-nowrap">Build 2026.01.16</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
