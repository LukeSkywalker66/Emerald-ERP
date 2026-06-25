/**
 * BarcodeScanner — Componente reutilizable de escaneo de códigos de barra.
 *
 * Props:
 * @prop {Function} onScan - Callback cuando se escanea un código
 * @prop {Function} onError - Callback de error
 * @prop {boolean} disabled - Deshabilitar input
 * @prop {string} placeholder - Placeholder del input
 * @prop {boolean} autoFocus - Auto-foco al montar
 * @prop {string} value - Valor controlado (opcional)
 * @prop {Function} onChange - Manejar cambio de valor (opcional)
 * @prop {string} inputClassName - Clases extra para el input
 */
import React, { useState, useRef, useEffect } from 'react';
import { Scan, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { useBarcodeScan } from './useBarcodeScan';

export default function BarcodeScanner({
  onScan,
  onError,
  disabled = false,
  placeholder = 'Escanear o ingresar SKU...',
  autoFocus = true,
  value: externalValue,
  onChange: externalOnChange,
  inputClassName = '',
  scanning = false,
  feedback = null, // { type: 'success' | 'error' | 'info', message: string }
}) {
  const [internalValue, setInternalValue] = useState('');
  const inputRef = useRef(null);

  const isControlled = externalValue !== undefined;
  const value = isControlled ? externalValue : internalValue;

  const handleScan = (code) => {
    if (onScan) onScan(code);
  };

  // Hook de scanner gun
  useBarcodeScan({
    onScan: handleScan,
    enabled: !disabled && autoFocus,
  });

  const handleChange = (e) => {
    if (externalOnChange) {
      externalOnChange(e);
    } else {
      setInternalValue(e.target.value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = value.trim();
      if (code && onScan) {
        onScan(code);
        if (!isControlled) setInternalValue('');
      }
    }
  };

  const handleScanClick = () => {
    const code = value.trim();
    if (code && onScan) {
      onScan(code);
      if (!isControlled) setInternalValue('');
    }
  };

  // Auto-foco
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Escaneo completado' : placeholder}
            disabled={disabled}
            className={`w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${inputClassName}`}
            autoFocus={autoFocus && !disabled}
            autoComplete="off"
            spellCheck="false"
          />
          {scanning && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader className="w-5 h-5 text-emerald-400 animate-spin" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleScanClick}
          disabled={disabled || scanning || !value.trim()}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center"
        >
          <Scan className="w-5 h-5" />
        </button>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          className={`flex items-center space-x-2 text-sm px-3 py-2 rounded-lg ${
            feedback.type === 'success'
              ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800/50'
              : feedback.type === 'error'
                ? 'bg-red-900/30 text-red-300 border border-red-800/50'
                : 'bg-blue-900/30 text-blue-300 border border-blue-800/50'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <Scan className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
