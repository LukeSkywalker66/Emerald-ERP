/**
 * useDeliveryScanner — Máquina de estados para escaneo ciego en entregas.
 *
 * Estados: IDLE | WAITING_SERIAL
 *
 * Flujo:
 *  IDLE + código → pre-filtro regex → API resolve → 
 *    producto BULK → sumar cantidad + IDLE
 *    producto SERIALIZED → WAITING_SERIAL(pendingProductId)
 *    serial directo → resolver producto + IDLE
 *  WAITING_SERIAL + código → validar que sea serial del producto esperado → IDLE
 *
 * @param {Object}   options
 * @param {Array}    options.proposalItems   - Items de la propuesta [{product_id, product_name, is_serialized, serial_validation_regex?, quantity}]
 * @param {Function} options.onItemScanned   - Callback(item) cuando se escanea un ítem exitosamente
 * @param {Function} options.onError         - Callback(msg) para errores
 * @param {boolean}  options.enabled         - Si el hook está activo
 */
import { useState, useCallback, useRef } from 'react';
import { useBarcodeScanner } from './useBarcodeScanner';
import * as logisticsService from '@/services/logistics.service';

// Audio feedback
function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.1;

    if (type === 'success') {
      osc.frequency.value = 880; osc.type = 'sine';
      setTimeout(() => { osc.frequency.value = 1100; }, 80);
    } else if (type === 'error') {
      osc.frequency.value = 200; osc.type = 'square';
    } else {
      osc.frequency.value = 600; osc.type = 'triangle';
    }

    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) { /* Audio no disponible */ }
}

// Pre-filtro: valida contra regex de los productos de la propuesta
function preFilter(code, proposalItems) {
  // Si matchea algún SKU de producto esperado
  const skuMatch = proposalItems.find(
    (p) => p.product_sku?.toUpperCase() === code
  );
  if (skuMatch) return { type: 'product', item: skuMatch };

  // Si matchea algún regex de validación de serial
  for (const item of proposalItems) {
    if (item.is_serialized && item.serial_validation_regex) {
      try {
        const regex = new RegExp(item.serial_validation_regex);
        if (regex.test(code)) {
          return { type: 'potential_serial', item };
        }
      } catch (_) { /* regex inválida, ignorar */ }
    }
  }

  // Código genérico alfanumérico (podría ser serial sin regex registrado)
  if (/^[A-Z0-9]{6,40}$/.test(code)) {
    return { type: 'generic_code' };
  }

  return null; // Rechazar (probable MAC o basura)
}

export function useDeliveryScanner({
  proposalItems = [],
  onItemScanned,
  onError,
  enabled = true,
} = {}) {
  const [scanMode, setScanMode] = useState('IDLE'); // IDLE | WAITING_SERIAL
  const [pendingProductId, setPendingProductId] = useState(null);
  const [pendingProductName, setPendingProductName] = useState(null);
  const [lastFeedback, setLastFeedback] = useState(null);
  const busyRef = useRef(false);

  const resolveScan = useCallback(async (code) => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      // Pre-filtro capa 1
      const filterResult = preFilter(code, proposalItems);
      if (!filterResult) {
        playBeep('error');
        onError?.('Código no reconocido o formato inválido');
        return;
      }

      // Capa 2: llamada API
      const result = await logisticsService.scanBarcode(null, {
        product_code: code,
        quantity: 1,
      });

      if (!result.success) {
        playBeep('error');
        onError?.(result.message || 'Producto no encontrado');
        return;
      }

      // Evaluar según modo actual
      if (scanMode === 'WAITING_SERIAL') {
        if (result.is_serialized && result.product_id === pendingProductId) {
          playBeep('success');
          onItemScanned?.({ ...result, serial_number: code });
          setScanMode('IDLE');
          setPendingProductId(null);
          setPendingProductName(null);
          setLastFeedback({
            type: 'success',
            message: `Serial confirmado: ${code}`,
          });
        } else {
          playBeep('error');
          onError?.(`Serial incorrecto. Se esperaba serial del producto: ${pendingProductName}`);
        }
        return;
      }

      // Modo IDLE
      if (result.is_serialized) {
        // Producto serializado: esperar serial
        playBeep('info');
        setScanMode('WAITING_SERIAL');
        setPendingProductId(result.product_id);
        setPendingProductName(result.product_name);
        setLastFeedback({
          type: 'info',
          message: `Producto reconocido: ${result.product_name}. Escaneá el Número de Serie.`,
        });
      } else {
        // Producto BULK: agregar directamente
        playBeep('success');
        onItemScanned?.(result);
        setLastFeedback({
          type: 'success',
          message: `${result.product_name} agregado.`,
        });
      }
    } catch (err) {
      playBeep('error');
      const msg = err.response?.data?.detail || err.message || 'Error al resolver';
      onError?.(msg);
    } finally {
      busyRef.current = false;
    }
  }, [scanMode, pendingProductId, pendingProductName, proposalItems, onItemScanned, onError]);

  const handleScan = useCallback((code) => {
    resolveScan(code);
  }, [resolveScan]);

  useBarcodeScanner({
    onScan: handleScan,
    enabled: enabled && !busyRef.current,
  });

  const reset = useCallback(() => {
    setScanMode('IDLE');
    setPendingProductId(null);
    setPendingProductName(null);
    setLastFeedback(null);
  }, []);

  return {
    scanMode,
    pendingProductId,
    pendingProductName,
    lastFeedback,
    reset,
    resolveScan,
  };
}
