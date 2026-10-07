import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { reportClientError } from './api/client';
import './index.css';

const queryClient = new QueryClient();

// Reportar errores JS globales al backend (best-effort) para seguimiento remoto.
window.addEventListener('error', (event) => {
  reportClientError({
    module: 'window.onerror',
    message: event.message || 'Unhandled JS error',
    stack: event.error?.stack || null,
    url: window.location.pathname,
    payload: { filename: event.filename, line: event.lineno, col: event.colno },
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportClientError({
    module: 'unhandledrejection',
    message: reason?.message || String(reason || 'Unhandled promise rejection'),
    stack: reason?.stack || null,
    url: window.location.pathname,
  });
});

const root = document.getElementById('root');
if (!root) {
  throw new Error('No se encontró el contenedor root para montar la app.');
}

createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
