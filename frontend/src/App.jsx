import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import WorkOrderExecutionPage from './pages/WorkOrderExecutionPage';
import CoordinationPage from './pages/CoordinationPage';
import WorkOrdersPage from './pages/WorkOrdersPage';
import ConnectionsPage from './pages/ConnectionsPage';
import NodesPage from './pages/NodesPage';
import CustomersPage from './pages/CustomersPage';
import ClientesPage from './pages/ClientesPage';
import InventarioPage from './pages/InventarioPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import LoadingScreen from './components/ui/LoadingScreen';
import RoleGuard from './components/auth/RoleGuard';

// Audit Module Pages
import AuditLogsPage from './pages/audit/AuditLogsPage';

// Inventory Module Pages
import InventoryDashboard from './pages/inventory/InventoryDashboard';
import WarehouseList from './pages/inventory/WarehouseList';
import WarehouseDetail from './pages/inventory/WarehouseDetail';
import ProductCatalog from './pages/inventory/ProductCatalog';
import StockTransferWizard from './pages/inventory/StockTransferWizard';
import StockAdjustments from './pages/inventory/StockAdjustments';
import MovementsHistory from './pages/inventory/MovementsHistory';
import StockAlerts from './pages/inventory/StockAlerts';
import FleetPage from './pages/fleet/FleetPage';

// Engineering Module Pages
import EngineeringBoardPage from './pages/engineering/EngineeringBoardPage';

// Coordination Module Pages
import CuadrillasPage from './pages/coordination/CuadrillasPage';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};
  const PrivateRoute = ({ children }) => {
    const { isAuthenticated, token } = useAuth();
  
    // Si hay token en localStorage pero aún no se ha decodificado (token state vacío pero localStorage tiene algo),
    // esperar un poco antes de redirigir
    if (!isAuthenticated && typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('emerald_token');
      if (storedToken && !token) {
        // Token en storage pero no ha sido procesado aún por AuthContext
        console.log('[Router] Token en localStorage pero AuthContext aún no listo, esperando...');
        return <LoadingScreen />;
      }
    }
  
    return isAuthenticated ? children : <Navigate to="/login" replace />;
  };
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
        
        <Route path="users" element={<RoleGuard resource="users"><UsersPage /></RoleGuard>} />
        <Route path="settings" element={<RoleGuard resource="settings"><SettingsPage /></RoleGuard>} />
        
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
