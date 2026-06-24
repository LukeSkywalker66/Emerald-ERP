/**
 * useBarcodeScanner — Hook reutilizable para lectores de código de barras.
 *
 * Captura keydown events globales con buffer, detecta Enter como fin de lectura,
 * y opcionalmente valida el código contra un regexPattern antes de retornarlo.
 *
 * @param {Object} options
 * @param {Function} options.onScan      - Callback con el código escaneado (si pasa validación)
 * @param {Function} options.onInvalid   - Callback si el código falla la validación regex
 * @param {string}   options.regexPattern - Patrón regex opcional para validar
 * @param {number}   options.timeout     - ms entre chars para resetear buffer (default: 30)
 * @param {number}   options.minLength   - Longitud mínima del código (default: 3)
 * @param {boolean}  options.enabled     - Si el hook está activo (default: true)
 */
import { useRef, useEffect, useCallback } from 'react';

export function useBarcodeScanner({
  onScan,
  onInvalid,
  regexPattern = null,
  timeout = 30,
  minLength = 3,
  enabled = true,
} = {}) {
  const buffer = useRef('');
  const timer = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled) return;

      // Ignorar teclas modificadoras
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

      // Ignorar teclas de función/navegación que tengan más de 1 char
      if (e.key.length > 1 && e.key !== 'Enter') return;

      // Resetear timer de inactividad
      if (timer.current) clearTimeout(timer.current);

      if (e.key === 'Enter') {
        e.preventDefault();
        const code = buffer.current.trim();
        buffer.current = '';

        if (code.length < minLength) return;

        // Validar contra regex si existe
        if (regexPattern) {
          try {
            const regex = new RegExp(regexPattern);
            if (regex.test(code)) {
              onScan?.(code);
            } else {
              onInvalid?.(code);
            }
          } catch (_syntaxError) {
            // Regex inválida — aceptar el código sin validar
            onScan?.(code);
          }
        } else {
          onScan?.(code);
        }
        return;
      }

      // Acumular caracteres
      if (e.key.length === 1) {
        buffer.current += e.key;
      }

      // Timeout: si no llega otro char, no es scanner gun
      timer.current = setTimeout(() => {
        buffer.current = '';
      }, timeout);
    },
    [onScan, onInvalid, regexPattern, timeout, minLength, enabled],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [handleKeyDown]);

  const flush = useCallback(() => {
    buffer.current = '';
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { flush };
}
