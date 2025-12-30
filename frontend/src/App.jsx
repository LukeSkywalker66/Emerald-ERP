import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import ClientesPage from './pages/ClientesPage';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => (
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
      <Route path="clientes" element={<ClientesPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/app" replace />} />
  </Routes>
);

export default function App() {
  return <AppRoutes />;
}
