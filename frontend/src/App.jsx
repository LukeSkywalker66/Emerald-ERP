import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import ClientesPage from './pages/ClientesPage';
import InventarioPage from './pages/InventarioPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import LoadingScreen from './components/ui/LoadingScreen';

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
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="inventario" element={<InventarioPage />} />
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
