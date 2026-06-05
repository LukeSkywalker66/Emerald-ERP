/**
 * ToastContext.jsx
 *
 * Contexto global para el sistema de notificaciones toast.
 * Permite mostrar toasts desde cualquier componente sin prop drilling.
 * Además reemplaza window.alert por el sistema de toasts.
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ToastContainer from '@/components/ui/Toast';

const ToastContext = createContext(null);

let toastIdCounter = 0;

// Referencia mutable compartida para que el window.alert override
// pueda acceder al showToast sin depender del ciclo de React
const __toastDispatcher = { current: null };

// ═══ Override GLOBAL de window.alert ═══
// Se ejecuta al cargar el módulo, ANTES de que React monte cualquier cosa
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;
  window.alert = (message) => {
    if (__toastDispatcher.current) {
      // Usar el dispatcher que ya está conectado al contexto de React
      const type = message.startsWith('✅') || message.startsWith('✔') ? 'success'
        : message.startsWith('❌') || message.startsWith('✖') ? 'error'
        : message.startsWith('⚠') || message.startsWith('❗') ? 'warning'
        : 'info';
      __toastDispatcher.current(message, type);
    } else {
      // Fallback: si el toast no está listo aún, usar alert nativo
      originalAlert(message);
    }
  };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const success = useCallback((message, duration) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message, duration) => showToast(message, 'error', duration), [showToast]);
  const info = useCallback((message, duration) => showToast(message, 'info', duration), [showToast]);
  const warning = useCallback((message, duration) => showToast(message, 'warning', duration), [showToast]);

  // Conectar el dispatcher global al showToast del provider
  __toastDispatcher.current = (message, type) => showToast(message, type, 5000);

  const value = { showToast, success, error, info, warning, removeToast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return ctx;
}

export default ToastContext;
