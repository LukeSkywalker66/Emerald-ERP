/**
 * SerialScanner — Componente para escaneo de números de serie con validación visual.
 *
 * Props:
 * @prop {Function} onScan - Callback con el serial escaneado
 * @prop {string} productName - Nombre del producto (se muestra como contexto)
 * @prop {string} productSku - SKU del producto
 * @prop {string} expectedPattern - Descripción del patrón esperado (ej: "4 letras + 8 dígitos")
 * @prop {boolean} disabled - Deshabilitar
 * @prop {boolean} validating - Mostrar indicador de validación
 * @prop {Function} onCancel - Callback para cancelar (volver a scan de código)
 */
import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Loader, AlertCircle, ArrowLeft } from 'lucide-react';
import { useBarcodeScan } from './useBarcodeScan';

export default function SerialScanner({
  onScan,
  productName = '',
  productSku = '',
  expectedPattern = '',
  disabled = false,
  validating = false,
  onCancel,
}) {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);

  // Auto-detect scanner gun
  useBarcodeScan({
    onScan: (code) => handleSubmit(code),
    enabled: !disabled,
  });

  const handleSubmit = (serialValue) => {
    const cleaned = serialValue?.trim() || value.trim();
    if (!cleaned) return;

    if (onScan) {
      setFeedback({ type: 'info', message: `Validando: ${cleaned}` });
      onScan(cleaned);
    }
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-foco
  useEffect(() => {
    if (inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1 hover:bg-zinc-700/50 rounded transition-colors"
              title="Volver a escanear código de producto"
            >
              <ArrowLeft className="w-4 h-4 text-zinc-400" />
            </button>
          )}
          <span className="text-sm font-medium text-yellow-300">
            Escanear Serial
          </span>
        </div>
        {productSku && (
          <code className="text-xs text-zinc-500 font-mono">{productSku}</code>
        )}
      </div>

      {/* Product context */}
      {productName && (
        <p className="text-xs text-zinc-400">
          Producto: <span className="text-zinc-300 font-medium">{productName}</span>
          {expectedPattern && (
            <span className="text-zinc-500"> · Formato: {expectedPattern}</span>
          )}
        </p>
      )}

      {/* Input */}
      <div className="flex space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase());
            setFeedback(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Escanear número de serie..."
          disabled={disabled || validating}
          className="flex-1 px-4 py-3 bg-zinc-800 border border-yellow-700 rounded-lg text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/50 disabled:opacity-50 uppercase"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={disabled || validating || !value.trim()}
          className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-zinc-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {validating ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`flex items-center space-x-2 text-sm px-3 py-2 rounded-lg ${
            feedback.type === 'success'
              ? 'bg-emerald-900/30 text-emerald-300'
              : feedback.type === 'error'
                ? 'bg-red-900/30 text-red-300'
                : 'bg-blue-900/30 text-blue-300'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <Loader className="w-4 h-4 flex-shrink-0 animate-spin" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
