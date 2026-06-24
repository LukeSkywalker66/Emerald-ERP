/**
 * RegexTester — Componente visual de testeo de RegEx con estética Cyberpunk.
 *
 * Permite al operador probar una expresión regular contra lo que lee
 * el escáner de códigos de barras, para validar que el patrón funciona.
 *
 * Props:
 * @prop {string}   value       - Valor actual de la regex (controlado)
 * @prop {Function} onChange    - Handler para cambios en la regex
 */
import React, { useState, useCallback } from 'react';
import { Shield, ShieldCheck, ShieldX, Scan, AlertTriangle } from 'lucide-react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

export default function RegexTester({ value = '', onChange }) {
  const [testInput, setTestInput] = useState('');
  const [result, setResult] = useState(null); // { type: 'success'|'error'|'syntax', message }
  const [testValue, setTestValue] = useState('');

  const evaluate = useCallback((code) => {
    if (!value || !value.trim()) {
      setResult({ type: 'info', message: 'Sin patrón definido — se acepta cualquier lectura.' });
      return;
    }

    try {
      const regex = new RegExp(value);
      if (regex.test(code)) {
        setResult({ type: 'success', message: 'ACCESO CONCEDIDO: Match perfecto' });
      } else {
        setResult({ type: 'error', message: 'DENEGADO: Lectura errónea' });
      }
    } catch (syntaxError) {
      setResult({ type: 'syntax', message: `Error de sintaxis: ${syntaxError.message}` });
    }
  }, [value]);

  // Hook de scanner gun para el input de prueba
  useBarcodeScanner({
    onScan: (code) => {
      setTestValue(code);
      evaluate(code);
    },
    enabled: true,
  });

  const handleManualTest = () => {
    evaluate(testValue || testInput);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualTest();
    }
  };

  return (
    <div className="space-y-3 p-4 bg-zinc-900/80 border border-zinc-700 rounded-lg">
      <div className="flex items-center space-x-2 text-emerald-400">
        <Shield className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Validador de Patrón</span>
      </div>

      {/* Regex input */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1">
          Expresión Regular (RegEx)
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange?.(e);
            // Re-evaluar si hay test value
            if (testValue) evaluate(testValue);
          }}
          placeholder="Ej: ^(?=.*[A-Z])[A-Z0-9]{12,16}$"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
          spellCheck="false"
        />
      </div>

      {/* Test input */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1">
          <Scan className="w-3 h-3 inline mr-1" />
          Dispare el escáner aquí para probar
        </label>
        <input
          type="text"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escanear o ingresar código..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white font-mono text-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/50"
          spellCheck="false"
          autoComplete="off"
        />
      </div>

      {/* Result area */}
      {result && (
        <div
          className={`flex items-start space-x-2 p-3 rounded border text-sm ${
            result.type === 'success'
              ? 'bg-emerald-900/20 border-emerald-700/50 text-emerald-400'
              : result.type === 'error'
                ? 'bg-red-900/20 border-red-700/50 text-red-400'
                : result.type === 'syntax'
                  ? 'bg-yellow-900/20 border-yellow-700/50 text-yellow-400'
                  : 'bg-blue-900/20 border-blue-700/50 text-blue-400'
          }`}
        >
          {result.type === 'success' ? (
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : result.type === 'error' ? (
            <ShieldX className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : result.type === 'syntax' ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">{result.message}</p>
            {testValue && (
              <p className="text-xs opacity-70 mt-1 font-mono">Código: {testValue}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
