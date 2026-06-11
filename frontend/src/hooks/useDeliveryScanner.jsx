/**
 * useDeliveryScanner — Máquina de estados para escaneo ciego en entregas.
 *
 * Estados: IDLE | WAITING_SERIAL
 *
 * El hook actúa como clasificador inteligente:
 * 1. Clasifica localmente usando datos de la propuesta (SKU, regex)
 * 2. Si no puede clasificar, delega al API /resolve-scan (resolución ciega)
 * 3. El API detecta MAC addresses y retorna type='mac'
 * 4. Nunca bloquea códigos desconocidos — siempre intenta resolver
 *
 * Reglas estrictas:
 * 1. Bloqueo por isProcessing (promise guard, no debounce)
 * 2. Clasificación local solo por SKU o serial_validation_regex de la propuesta
 * 3. Sin hardcodear patrones MAC — el API los detecta
 *
 * @param {Object}   options
 * @param {Array}    options.proposalItems   - Items de la propuesta
 * @param {Function} options.onItemScanned   - Callback(item) cuando se escanea un ítem
 * @param {Function} options.onError         - Callback(msg) para errores
 * @param {boolean}  options.enabled         - Si el hook está activo
 */
import { useState, useCallback, useRef } from 'react';

// Audio feedback
function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination); gain.gain.value = 0.1;
    if (type === 'success') { osc.frequency.value = 880; osc.type = 'sine'; setTimeout(() => { osc.frequency.value = 1100; }, 80); }
    else if (type === 'error') { osc.frequency.value = 200; osc.type = 'square'; }
    else { osc.frequency.value = 600; osc.type = 'triangle'; }
    osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}

/**
 * Clasificador local: intenta identificar el código usando datos de la propuesta.
 * Retorna { type: 'sku'|'serial', product_id, item } o null si no puede clasificar.
 */
function classifyLocal(code, proposalItems) {
  const upper = (code || '').toUpperCase();
  for (const item of proposalItems) {
    // A) Match exacto de SKU
    if (item.product_sku?.toUpperCase() === upper) {
      return { type: 'sku', product_id: item.product_id, item };
    }
    // B) Match contra serial_validation_regex del producto
    if (item.serial_validation_regex) {
      try {
        if (new RegExp(item.serial_validation_regex).test(upper)) {
          return { type: 'serial', product_id: item.product_id, item };
        }
      } catch (_) {}
    }
  }
  return null;
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
  const [pendingRemaining, setPendingRemaining] = useState(0);
  const [lastFeedback, setLastFeedback] = useState(null);
  const feedbackTimer = useRef(null);
  const isProcessing = useRef(false);

  // Contadores de requeridos por producto (desde proposalItems)
  const requiredCounts = {};
  proposalItems.forEach(item => {
    const pid = item.product_id; if (!pid) return;
    requiredCounts[pid] = (requiredCounts[pid] || 0) + (item.suggested_quantity || item.quantity_proposed || item.quantity_delivered || 1);
  });
  const scannedCounts = useRef({});
  const getRemaining = (pid) => (requiredCounts[pid] || 0) - (scannedCounts.current[pid] || 0);

  // Auto-dismiss feedback after 4s
  const setTimedFeedback = useCallback((fb) => {
    setLastFeedback(fb);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (fb) feedbackTimer.current = setTimeout(() => setLastFeedback(null), 4000);
  }, []);

  /**
   * Busca info de un producto en los proposalItems.
   */
  const getProposalProductInfo = useCallback((productId) => {
    const item = proposalItems.find(i => i.product_id === productId);
    if (!item) return null;
    return {
      id: item.product_id,
      name: item.product_name,
      sku: item.product_sku,
      is_serialized: item.is_serialized,
    };
  }, [proposalItems]);

  /**
   * Resuelve un código escaneado.
   * Flujo:
   * 1. Clasificación local (SKU / regex serial)
   * 2. Si clasificado → ruteo inmediato
   * 3. Si no clasificado → API /resolve-scan (resolución ciega)
   */
  const resolveScan = useCallback(async (code) => {
    // Regla 1: bloqueo por promesa activa
    if (isProcessing.current) return;
    isProcessing.current = true;

    try {
      // ─── Capa 1: Clasificación local ───
      const local = classifyLocal(code, proposalItems);

      // ─── Caso A: Clasificado como SKU ───
      if (local && local.type === 'sku') {
        const info = getProposalProductInfo(local.product_id);
        if (!info) {
          // Producto en propuesta pero sin datos → resolver por API
          // (no debería pasar, pero fallback)
        } else if (info.is_serialized) {
          // Producto serializado → entrar en WAITING_SERIAL
          const remaining = getRemaining(info.id);
          playBeep('info');
          setScanMode('WAITING_SERIAL');
          setPendingProductId(info.id);
          setPendingProductName(info.name);
          setPendingRemaining(remaining > 0 ? remaining : 1);
          setTimedFeedback({ type: 'info', message: `${info.name}. Faltan ${remaining > 0 ? remaining : 1} serial(es).` });
          isProcessing.current = false;
          return;
        } else {
          // Producto no serializado → agregar directo
          playBeep('success');
          scannedCounts.current[info.id] = (scannedCounts.current[info.id] || 0) + 1;
          onItemScanned?.({ product_id: info.id, product_name: info.name, product_sku: info.sku });
          setTimedFeedback({ type: 'success', message: `${info.name} agregado.` });
          isProcessing.current = false;
          return;
        }
      }

      // ─── Caso B: Clasificado como Serial (regex match) ───
      if (local && local.type === 'serial') {
        const info = getProposalProductInfo(local.product_id);

        if (scanMode === 'WAITING_SERIAL') {
          // Validar que el serial pertenece al producto esperado
          if (local.product_id === pendingProductId) {
            playBeep('success');
            const pid = pendingProductId;
            scannedCounts.current[pid] = (scannedCounts.current[pid] || 0) + 1;
            const remaining = getRemaining(pid);
            onItemScanned?.({
              product_id: pid, product_name: pendingProductName,
              serial_number: code, is_serialized: true,
            });
            if (remaining > 0) {
              setPendingRemaining(remaining);
              setTimedFeedback({ type: 'success', message: `Serial confirmado. Faltan ${remaining}.` });
            } else {
              setTimedFeedback({ type: 'success', message: `¡Completo para ${pendingProductName}!` });
              setScanMode('IDLE'); setPendingProductId(null); setPendingProductName(null); setPendingRemaining(0);
            }
            isProcessing.current = false;
            return;
          } else {
            // Serial de otro producto → warning
            playBeep('error');
            setTimedFeedback({ type: 'error', message: `Serial de ${info?.name || 'otro producto'}. Se esperaba: ${pendingProductName}` });
            isProcessing.current = false;
            return;
          }
        } else {
          // IDLE + serial detectado → agregar directo (el regex ya identificó el producto)
          if (info) {
            playBeep('success');
            scannedCounts.current[info.id] = (scannedCounts.current[info.id] || 0) + 1;
            onItemScanned?.({
              product_id: info.id, product_name: info.name,
              serial_number: code, is_serialized: true,
            });
            setTimedFeedback({ type: 'success', message: `Serial → ${info.name}` });
            isProcessing.current = false;
            return;
          }
          // Si no hay info del producto, caer a API
        }
      }

      // ─── Capa 2: API de resolución ciega ───
      const { default: api } = await import('@/api/client');
      const response = await api.get(`/v2/inventory/resolve-scan?query=${encodeURIComponent(code)}`);
      const resolved = response.data;

      // ─── API: MAC address ───
      if (resolved.type === 'mac') {
        playBeep('error');
        setTimedFeedback({ type: 'error', message: 'Dirección MAC detectada — ignorada.' });
        return;
      }

      // ─── API: Producto ───
      if (resolved.type === 'product') {
        const p = resolved.product;
        if (p.is_serialized) {
          const remaining = getRemaining(p.id);
          playBeep('info');
          setScanMode('WAITING_SERIAL'); setPendingProductId(p.id);
          setPendingProductName(p.name); setPendingRemaining(remaining > 0 ? remaining : 1);
          setTimedFeedback({ type: 'info', message: `${p.name}. Faltan ${remaining > 0 ? remaining : 1} serial(es).` });
        } else {
          playBeep('success');
          scannedCounts.current[p.id] = (scannedCounts.current[p.id] || 0) + 1;
          onItemScanned?.({ product_id: p.id, product_name: p.name, product_sku: p.sku });
          setTimedFeedback({ type: 'success', message: `${p.name} agregado.` });
        }
        return;
      }

      // ─── API: Serial ───
      if (resolved.type === 'serial') {
        const pid = resolved.serial?.product_id;
        const pname = resolved.product?.name;
        const sid = resolved.serial?.id;

        // Dedup: verificar que este serial_item_id no fue ya escaneado
        if (sid && scannedCounts.current[`_sn_${sid}`]) {
          playBeep('error');
          setTimedFeedback({ type: 'error', message: 'Este serial ya fue escaneado.' });
          return;
        }

        if (scanMode === 'WAITING_SERIAL') {
          if (pid === pendingProductId) {
            playBeep('success');
            scannedCounts.current[pid] = (scannedCounts.current[pid] || 0) + 1;
            if (sid) scannedCounts.current[`_sn_${sid}`] = 1;
            const remaining = getRemaining(pid);
            onItemScanned?.({
              product_id: pid, product_name: pendingProductName,
              serial_number: resolved.serial.serial_number, is_serialized: true,
            });
            if (remaining > 0) {
              setPendingRemaining(remaining);
              setTimedFeedback({ type: 'success', message: `Serial confirmado. Faltan ${remaining}.` });
            } else {
              setTimedFeedback({ type: 'success', message: `¡Completo para ${pendingProductName}!` });
              setScanMode('IDLE'); setPendingProductId(null); setPendingProductName(null); setPendingRemaining(0);
            }
          } else {
            playBeep('error');
            onError?.(`Serial incorrecto. Se esperaba serial de: ${pendingProductName}`);
          }
        } else {
          // IDLE + serial encontrado por API → agregar directo
          scannedCounts.current[pid] = (scannedCounts.current[pid] || 0) + 1;
          if (sid) scannedCounts.current[`_sn_${sid}`] = 1;
          playBeep('success');
          onItemScanned?.({
            product_id: pid, product_name: pname,
            serial_number: resolved.serial.serial_number, is_serialized: true,
          });
          setTimedFeedback({ type: 'success', message: `Serial directo → ${pname || 'producto'}.` });
        }
        return;
      }

      // ─── API: tipo desconocido ───
      playBeep('error');
      setTimedFeedback({ type: 'error', message: 'Código no reconocido por el sistema.' });

    } catch (err) {
      playBeep('error');
      const msg = err.response?.data?.detail || err.message || 'Error al resolver';
      onError?.(msg);
    } finally {
      isProcessing.current = false;
    }
  }, [scanMode, pendingProductId, pendingProductName, proposalItems, onItemScanned, onError, getProposalProductInfo]);

  const reset = useCallback(() => {
    setScanMode('IDLE'); setPendingProductId(null);
    setPendingProductName(null); setPendingRemaining(0);
    setTimedFeedback(null);
  }, []);

  return {
    scanMode, pendingProductId, pendingProductName, pendingRemaining,
    scannedCounts: scannedCounts.current, requiredCounts,
    lastFeedback, resolveScan, reset,
  };
}
