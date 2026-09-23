import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import RoleGuard from './components/auth/RoleGuard';
import PageFallback from './components/ui/PageFallback';

// Code splitting: páginas bajo demanda (React.lazy).
// Prioridad tácticas para campo: Tickets y OT (lista + detalle).
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TicketsPage = lazy(() => import('./pages/TicketsPage'));
const TicketDetailPage = lazy(() => import('./pages/TicketDetailPage'));
const WorkOrdersPage = lazy(() => import('./pages/WorkOrdersPage'));
const WorkOrderExecutionPage = lazy(() => import('./pages/WorkOrderExecutionPage'));
const CoordinationPage = lazy(() => import('./pages/CoordinationPage'));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'));
const NodesPage = lazy(() => import('./pages/NodesPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const ClientesPage = lazy(() => import('./pages/ClientesPage'));
const InventarioPage = lazy(() => import('./pages/InventarioPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Audit Module Pages
const AuditLogsPage = lazy(() => import('./pages/audit/AuditLogsPage'));

// Inventory Module Pages
const InventoryDashboard = lazy(() => import('./pages/inventory/InventoryDashboard'));
const WarehouseList = lazy(() => import('./pages/inventory/WarehouseList'));
const WarehouseDetail = lazy(() => import('./pages/inventory/WarehouseDetail'));
const ProductCatalog = lazy(() => import('./pages/inventory/ProductCatalog'));
const StockTransferWizard = lazy(() => import('./pages/inventory/StockTransferWizard'));
const StockAdjustments = lazy(() => import('./pages/inventory/StockAdjustments'));
const MovementsHistory = lazy(() => import('./pages/inventory/MovementsHistory'));
const StockAlerts = lazy(() => import('./pages/inventory/StockAlerts'));
const FleetPage = lazy(() => import('./pages/fleet/FleetPage'));

// Engineering Module Pages
const EngineeringBoardPage = lazy(() => import('./pages/engineering/EngineeringBoardPage'));

// Coordination Module Pages
const CuadrillasPage = lazy(() => import('./pages/coordination/CuadrillasPage'));

// Logistics Module Pages
const MaterialDeliveryDashboard = lazy(() => import('./pages/logistics/MaterialDeliveryDashboard'));
const MaterialDeliveryWizard = lazy(() => import('./pages/logistics/MaterialDeliveryWizard'));
const MaterialReceiptWizard = lazy(() => import('./pages/logistics/MaterialReceiptWizard'));
const BarcodeLabelPrinter = lazy(() => import('./pages/logistics/BarcodeLabelPrinter'));

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => (
  <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/app"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<RoleGuard resource="dashboard"><DashboardPage /></RoleGuard>} />
        <Route path="tickets" element={<RoleGuard resource="tickets"><TicketsPage /></RoleGuard>} />
        <Route path="tickets/:id" element={<RoleGuard resource="tickets"><TicketDetailPage /></RoleGuard>} />
        <Route path="work-orders/:id/execute" element={<RoleGuard resource="work_orders"><WorkOrderExecutionPage /></RoleGuard>} />
        <Route path="coordination" element={<RoleGuard resource="coordination"><CoordinationPage /></RoleGuard>} />
        <Route path="work-orders" element={<RoleGuard resource="work_orders"><WorkOrdersPage /></RoleGuard>} />
        <Route path="connections" element={<RoleGuard resource="connections"><ConnectionsPage /></RoleGuard>} />
        <Route path="nodes" element={<RoleGuard resource="nodes"><NodesPage /></RoleGuard>} />
        <Route path="customers" element={<RoleGuard resource="clients"><CustomersPage /></RoleGuard>} />
        <Route path="clientes" element={<RoleGuard resource="clients"><ClientesPage /></RoleGuard>} />
        <Route path="inventario" element={<RoleGuard resource="inventory" action="view_all" fallbackPath="/app/inventory/warehouses"><InventarioPage /></RoleGuard>} />
        
        {/* Engineering Module Routes */}
        <Route path="engineering" element={<RoleGuard resource="engineering"><EngineeringBoardPage /></RoleGuard>} />
        
        {/* Coordination Module Routes */}
        <Route path="cuadrillas" element={<RoleGuard resource="cuadrillas"><CuadrillasPage /></RoleGuard>} />

        {/* Fleet Module Routes */}
        <Route path="fleet" element={<RoleGuard resource="fleet_assigned" fallbackPath="/app/inventory/warehouses"><FleetPage /></RoleGuard>} />
        
        {/* Inventory Module Routes */}
        <Route path="inventory" element={<RoleGuard resource="inventory" action="view_all" fallbackPath="/app/inventory/warehouses"><InventoryDashboard /></RoleGuard>} />
        <Route path="inventory/warehouses" element={<RoleGuard resource="inventory_warehouses" fallbackPath="/app/work-orders"><WarehouseList /></RoleGuard>} />
        <Route path="inventory/warehouses/:id" element={<RoleGuard resource="inventory_warehouses" fallbackPath="/app/inventory/warehouses"><WarehouseDetail /></RoleGuard>} />
        <Route path="inventory/products" element={<RoleGuard resource="inventory" action="view_all" fallbackPath="/app/inventory/warehouses"><ProductCatalog /></RoleGuard>} />
        <Route path="inventory/transfer" element={<RoleGuard resource="inventory" action="transfer" fallbackPath="/app/inventory/warehouses"><StockTransferWizard /></RoleGuard>} />
        <Route path="inventory/adjustments" element={<RoleGuard resource="inventory" action="adjust" fallbackPath="/app/inventory/warehouses"><StockAdjustments /></RoleGuard>} />
        <Route path="inventory/movements" element={<RoleGuard resource="inventory" action="view_all" fallbackPath="/app/inventory/warehouses"><MovementsHistory /></RoleGuard>} />
        <Route path="inventory/alerts" element={<RoleGuard resource="inventory" action="view_all" fallbackPath="/app/inventory/warehouses"><StockAlerts /></RoleGuard>} />

        {/* Logistics Module Routes */}
        <Route path="logistics/deliveries" element={<RoleGuard resource="inventory_admin"><MaterialDeliveryDashboard /></RoleGuard>} />
        <Route path="logistics/deliveries/new" element={<RoleGuard resource="inventory_admin"><MaterialDeliveryWizard /></RoleGuard>} />
        <Route path="logistics/deliveries/:id" element={<RoleGuard resource="inventory_admin"><MaterialDeliveryWizard /></RoleGuard>} />
        <Route path="logistics/receipts/new" element={<RoleGuard resource="inventory_admin"><MaterialReceiptWizard /></RoleGuard>} />
        <Route path="logistics/receipts/:id" element={<RoleGuard resource="inventory_admin"><MaterialReceiptWizard /></RoleGuard>} />
        <Route path="logistics/print-labels" element={<RoleGuard resource="inventory" action="adjust" fallbackPath="/app/inventory/adjustments"><BarcodeLabelPrinter /></RoleGuard>} />
        
        {/*
          Settings route: permisivo por RBAC con self_service (todo usuario autenticado).
          SettingsPage internamente decide qué tabs mostrar según el rol del usuario
          (admin → CRUD completo, no-admin → solo auto-gestión de contraseña)
        */}
        <Route path="settings" element={<RoleGuard resource="self_service"><SettingsPage /></RoleGuard>} />
        
        {/* Audit Module Routes (Admin Only) */}
        <Route path="audit" element={<RoleGuard resource="audit_logs"><AuditLogsPage /></RoleGuard>} />
      </Route>

      {/* Redirección de raíz a /app */}
      <Route path="/" element={<Navigate to="/app" replace />} />
      
      {/* 404 - Catch all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>
);

export default function App() {
  return <AppRoutes />;
}
