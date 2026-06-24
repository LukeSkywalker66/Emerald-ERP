/**
 * useBarcodeScan — Hook para manejar lectores de código de barras.
 *
 * Los scanners de código de barras se comportan como un teclado:
 * emiten keydown events muy rápidos y terminan con un Enter.
 *
 * Este hook:
 * 1. Acumula caracteres en un buffer
 * 2. Detecta el fin de lectura por Enter o por timeout entre caracteres
 * 3. Ejecuta el callback onScan con el código completo
 *
 * @param {Object} options
 * @param {Function} options.onScan - Callback con el código escaneado
 * @param {number} options.timeout - ms entre chars para detectar scanner (default: 30)
 * @param {number} options.minLength - Longitud mínima para considerar válido (default: 3)
 * @param {boolean} options.enabled - Si el hook está activo (default: true)
 */
import { useRef, useEffect, useCallback } from 'react';

export function useBarcodeScan({
  onScan,
  timeout = 30,
  minLength = 3,
  enabled = true,
} = {}) {
  const buffer = useRef('');
  const timer = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled) return;

      // Ignorar teclas de control (Shift, Ctrl, etc.)
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
      }

      // Ignorar si el foco está en un input (el usuario está escribiendo manualmente)
      // Esto permite que el scanner funcione incluso sin foco en un input específico
      if (e.key.length > 1 && e.key !== 'Enter') {
        return; // Teclas especiales como F1, ArrowUp, etc.
      }

      // Limpiar timer anterior (reseteamos el contador de inactividad)
      if (timer.current) {
        clearTimeout(timer.current);
      }

      if (e.key === 'Enter') {
        // Scanner gun terminó de leer
        e.preventDefault();

        const code = buffer.current.trim();
        buffer.current = '';

        if (code.length >= minLength && onScan) {
          onScan(code);
        }
        return;
      }

      // Acumular caracteres
      if (e.key.length === 1) {
        buffer.current += e.key;
      }

      // Si no llega otro caracter en `timeout` ms, no es scanner gun.
      // Descartamos el buffer para no acumular basura.
      timer.current = setTimeout(() => {
        buffer.current = '';
      }, timeout);
    },
    [onScan, timeout, minLength, enabled],
  );

  useEffect(() => {
    // Escuchamos keydown en el documento para capturar el scanner
    // incluso si no hay foco en un input específico
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [handleKeyDown]);

  /**
   * Forzar limpieza del buffer (útil cuando se cambia de pantalla).
   */
  const flush = useCallback(() => {
    buffer.current = '';
    if (timer.current) {
      clearTimeout(timer.current);
    }
  }, []);

  return { flush };
}
