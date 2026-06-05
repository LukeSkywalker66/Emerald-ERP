/**
 * Toast.jsx
 * 
 * Sistema de notificaciones flotantes estilo neon cyberpunk.
 * Reemplaza los alert() nativos del navegador por mensajes
 * semitransparentes animados que desaparecen automáticamente.
 * 
 * Uso:
 *   import { useToast } from '@/context/ToastContext';
 *   const { showToast } = useToast();
 *   showToast('✅ Operación exitosa', 'success');
 *   showToast('❌ Error al guardar', 'error');
 *   showToast('ℹ️ Información', 'info');
 */
import { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS = {
  success: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    glow: 'shadow-emerald-500/20',
    icon: 'text-emerald-400',
  },
  error: {
    bg: 'bg-red-500/15',
    border: 'border-red-500/40',
    text: 'text-red-300',
    glow: 'shadow-red-500/20',
    icon: 'text-red-400',
  },
  info: {
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/40',
    text: 'text-blue-300',
    glow: 'shadow-blue-500/20',
    icon: 'text-blue-400',
  },
  warning: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    glow: 'shadow-amber-500/20',
    icon: 'text-amber-400',
  },
};

export default function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);
  const colors = COLORS[toast.type] || COLORS.info;
  const Icon = ICONS[toast.type] || ICONS.info;

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(onRemove, 300); // Esperar animación de salida
  }, [onRemove]);

  useEffect(() => {
    const timer = setTimeout(handleClose, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [handleClose, toast.duration]);

  return (
    <div
      className={`
        pointer-events-auto
        flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl
        ${colors.bg} ${colors.border} ${colors.glow}
        shadow-lg shadow-black/30
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100'}
        animate-in slide-in-from-right-4
      `}
      role="alert"
      style={{
        animation: 'toastSlideIn 0.3s ease-out',
      }}
    >
      <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${colors.icon}`} />
      <p className={`text-sm font-medium flex-1 ${colors.text}`}>
        {toast.message}
      </p>
      <button
        onClick={handleClose}
        className={`p-0.5 rounded hover:bg-white/10 transition-colors ${colors.text}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
