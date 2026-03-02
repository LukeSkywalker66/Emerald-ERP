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

const AppRoutes = () => (
  <Suspense fallback={<LoadingScreen />}>
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
        <Route index element={<DashboardPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="work-orders/:id/execute" element={<WorkOrderExecutionPage />} />
        <Route path="coordination" element={<CoordinationPage />} />
        <Route path="work-orders" element={<WorkOrdersPage />} />
        <Route path="connections" element={<ConnectionsPage />} />
        <Route path="nodes" element={<NodesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="inventario" element={<InventarioPage />} />
        
        {/* Engineering Module Routes */}
        <Route path="engineering" element={<EngineeringBoardPage />} />
        
        {/* Coordination Module Routes */}
        <Route path="cuadrillas" element={<CuadrillasPage />} />

        {/* Fleet Module Routes */}
        <Route path="fleet" element={<FleetPage />} />
        
        {/* Inventory Module Routes */}
        <Route path="inventory" element={<InventoryDashboard />} />
        <Route path="inventory/warehouses" element={<WarehouseList />} />
        <Route path="inventory/warehouses/:id" element={<WarehouseDetail />} />
        <Route path="inventory/products" element={<ProductCatalog />} />
        <Route path="inventory/transfer" element={<StockTransferWizard />} />
        <Route path="inventory/adjustments" element={<StockAdjustments />} />
        <Route path="inventory/movements" element={<MovementsHistory />} />
        <Route path="inventory/alerts" element={<StockAlerts />} />
        
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
