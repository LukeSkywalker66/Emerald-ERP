/**
 * useDeliveryScanner — Máquina de estados estricta para escaneo en entregas.
 *
 * Estados: IDLE | WAITING_SERIAL
 *
 * Arquitectura en dos capas:
 * - Capa 1 (clasificación): el frontend solo mantiene contexto de propuesta y
 *   el estado WAITING_SERIAL. No decide disponibilidad real.
 * - Capa 2 (API): la API es la única fuente de verdad para existencia,
 *   duplicados y validación contra el depósito origen cuando existe delivery.
 *
 * Reglas estrictas:
 * 1. Bloqueo de concurrencia por isProcessing ref (NO debounce, NO setTimeout).
 * 2. Anti-duplicados por serial_item_id (Set en ref).
 * 3. Sin hardcodeo de patrones MAC en el hook.
 * 4. Sin validación de existencia exclusivamente en el frontend.
 */
import { useState, useCallback, useRef } from "react";
import api from "@/api/client";

// ─── Audio feedback ───────────────────────────────────────────────────────────

function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.1;
    if (type === "success") {
      osc.frequency.value = 880;
      osc.type = "sine";
      setTimeout(() => { osc.frequency.value = 1100; }, 80);
    } else if (type === "error") {
      osc.frequency.value = 200;
      osc.type = "square";
    } else {
      osc.frequency.value = 600;
      osc.type = "triangle";
    }
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeliveryScanner({
  proposalItems = [],
  deliveryId = null,
  onItemScanned,
  onError,
  onProposalConflict,
  enabled = true,
} = {}) {
  const [scanMode, setScanMode] = useState("IDLE"); // "IDLE" | "WAITING_SERIAL"
  const [pendingProduct, setPendingProduct] = useState(null); // { id, name, requirementKey, groupId }
  const [pendingRemaining, setPendingRemaining] = useState(0);
  const [lastFeedback, setLastFeedback] = useState(null);

  const isProcessing = useRef(false);
  const scannedSerialIds = useRef(new Set()); // Anti-duplicados por serial_item_id
  const scannedCounts = useRef({});
  const feedbackTimer = useRef(null);

  const productToGroup = {};
  const requirementByProduct = {};
  const requirementByGroup = {};
  const requirementLabels = {};
  const requiredCounts = {};

  proposalItems.forEach((item) => {
    if (item.product_id == null) return;
    const qty = item.suggested_quantity ?? item.quantity_proposed ?? item.quantity_delivered ?? 1;
    const isGroupReq = item.is_group_requirement && item.group_id != null;
    const key = isGroupReq ? `GROUP:${item.group_id}` : `PRODUCT:${item.product_id}`;
    const label = isGroupReq && item.group_name ? `Grupo ${item.group_name}` : (item.product_name || `Producto #${item.product_id}`);

    requiredCounts[key] = (requiredCounts[key] || 0) + qty;
    requirementLabels[key] = requirementLabels[key] || label;
    requirementByProduct[item.product_id] = key;
    if (item.group_id != null) {
      requirementByGroup[item.group_id] = key;
      productToGroup[item.product_id] = item.group_id;
    }
  });

  const hasAcceptedProposal = Object.keys(requiredCounts).length > 0;

  const resolveRequirementKey = useCallback((productId, groupId = null) => {
    if (groupId != null && requirementByGroup[groupId]) return requirementByGroup[groupId];
    return requirementByProduct[productId] || null;
  }, [proposalItems]);

  const resolveRequirementLabel = useCallback((requirementKey, fallback = "Producto") => {
    return requirementLabels[requirementKey] || fallback;
  }, [proposalItems]);

  const getRemaining = useCallback((requirementKey) => {
    return Math.max(0, (requiredCounts[requirementKey] || 0) - (scannedCounts.current[requirementKey] || 0));
  }, [proposalItems]);

  const setTimedFeedback = useCallback((fb) => {
    setLastFeedback(fb);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (fb) feedbackTimer.current = setTimeout(() => setLastFeedback(null), 4000);
  }, []);

  const registerLocalSerial = useCallback((payload) => {
    scannedSerialIds.current.add(payload.serial_item_id);
    const key = payload.requirement_key || resolveRequirementKey(payload.product_id, payload.product_group_id);
    if (key == null) return 0;
    scannedCounts.current[key] = (scannedCounts.current[key] || 0) + 1;
    onItemScanned?.(payload);
    return getRemaining(key);
  }, [getRemaining, onItemScanned, resolveRequirementKey]);

  const registerLocalBulk = useCallback((payload) => {
    const key = payload.requirement_key || resolveRequirementKey(payload.product_id, payload.product_group_id);
    if (key == null) return 0;
    scannedCounts.current[key] = (scannedCounts.current[key] || 0) + 1;
    onItemScanned?.(payload);
    return getRemaining(key);
  }, [getRemaining, onItemScanned, resolveRequirementKey]);

  const handleApiError = useCallback((err, fallbackMessage) => {
    playBeep("error");
    const msg = err.response?.data?.detail ?? fallbackMessage;
    setTimedFeedback({ type: "error", message: msg });
    onError?.(msg);
  }, [onError, setTimedFeedback]);

  const confirmProposalOverride = useCallback(async (detail) => {
    const fallbackMessage = detail?.message
      || "El item no pertenece a la propuesta de entrega aceptada en el paso anterior, ¿Desea agregarlo de todas formas?";

    if (onProposalConflict) {
      return Boolean(await onProposalConflict({
        code: detail?.code || "OUTSIDE_ACCEPTED_PROPOSAL",
        message: fallbackMessage,
        detail,
      }));
    }

    return window.confirm(fallbackMessage);
  }, [onProposalConflict]);

  const postWithProposalOverride = useCallback(async (url, payload) => {
    try {
      const response = await api.post(url, payload);
      return response.data;
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const code = detail?.code;

      if (err?.response?.status === 409 && code === "OUTSIDE_ACCEPTED_PROPOSAL") {
        const confirmed = await confirmProposalOverride(detail);
        if (!confirmed) {
          setTimedFeedback({
            type: "info",
            message: "Operación cancelada por el operador.",
          });
          return null;
        }

        const forcedResponse = await api.post(url, {
          ...payload,
          force_add_outside_proposal: true,
        });
        return forcedResponse.data;
      }

      throw err;
    }
  }, [confirmProposalOverride, setTimedFeedback]);

  const resolveScan = useCallback(
    async (code) => {
      if (enabled === false) return;
      // Bloqueo de concurrencia — gobernado por el ciclo de vida de la promesa
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        const upper = (code ?? "").trim().toUpperCase();
        if (upper.length === 0) return;

        setLastFeedback(null);

        // ─── WAITING_SERIAL: validar serial para producto pendiente ─────────
        if (scanMode === "WAITING_SERIAL" && pendingProduct != null) {
          if (deliveryId != null) {
            try {
              const resolvedResp = await api.get(
                "/v2/inventory/resolve-scan?query=" + encodeURIComponent(upper)
              );
              const resolved = resolvedResp.data;

              if (resolved.type !== "serial") {
                playBeep("error");
                setTimedFeedback({
                  type: "error",
                  message: "Se esperaba un serial válido.",
                });
                return;
              }

              const scannedGroupId = resolved.product?.group_id ?? null;
              let requirementKey = resolveRequirementKey(resolved.serial.product_id, scannedGroupId);
              if (!requirementKey && !hasAcceptedProposal) {
                requirementKey = `PRODUCT:${resolved.serial.product_id}`;
              }

              const sameRequirement = pendingProduct.requirementKey === requirementKey;
              if (sameRequirement === false) {
                playBeep("error");
                setTimedFeedback({
                  type: "error",
                  message: "Serial incorrecto. Se esperaba un serial del requerimiento activo.",
                });
                onError?.("Serial incorrecto para el requerimiento activo.");
                return;
              }

              const result = await postWithProposalOverride(
                `/v2/logistics/deliveries/${deliveryId}/scan-serial`,
                {
                  product_id: resolved.serial.product_id,
                  serial_number: resolved.serial.serial_number,
                }
              );

              if (!result) {
                return;
              }

              if (result.already_scanned) {
                playBeep("error");
                setTimedFeedback({ type: "error", message: result.message });
                onError?.(result.message);
                return;
              }

              if (scannedSerialIds.current.has(result.serial_item_id)) {
                playBeep("error");
                setTimedFeedback({ type: "error", message: "Este serial ya fue escaneado." });
                onError?.("Este serial ya fue escaneado.");
                return;
              }

              const remaining = registerLocalSerial({
                product_id: resolved.serial.product_id,
                product_name: result.product_name || resolved.product?.name || pendingProduct.name,
                serial_number: result.serial_number,
                delivery_item_id: result.delivery_item_id ?? null,
                serial_item_id: result.serial_item_id,
                product_group_id: scannedGroupId,
                requirement_key: pendingProduct.requirementKey,
                is_serialized: true,
              });

              playBeep("success");
              setScanMode("IDLE");
              setPendingProduct(null);
              setPendingRemaining(0);
              if (remaining <= 0) {
                setTimedFeedback({ type: "success", message: "Completo para " + (pendingProduct.name || result.product_name || "requerimiento") + "!" });
              } else {
                setTimedFeedback({ type: "success", message: result.message || ("Serial confirmado. Faltan " + remaining + ".") });
              }
              return;
            } catch (err) {
              handleApiError(err, "Error validando serial en el depósito origen.");
              return;
            }
          }
        }

        // ─── Capa 2: Validación de existencia en la API ─────────────────────
        // La API es la única fuente de verdad para clasificación del código.
        let resolved;
        try {
          const response = await api.get(
            "/v2/inventory/resolve-scan?query=" + encodeURIComponent(upper)
          );
          resolved = response.data;
        } catch (err) {
          if (err.response?.status === 404 || err.response?.status === 400) {
            handleApiError(err, "Código no reconocido.");
            return;
          }
          throw err; // error de red u otro → catch externo
        }

        // ─── Tipo: Producto ─────────────────────────────────────────────────
        if (resolved.type === "product") {
          const p = resolved.product;

          let requirementKey = resolveRequirementKey(p.id, p.group_id ?? null);
          const isProposalRequirement = requirementKey != null && requiredCounts[requirementKey] != null;

          if (requirementKey == null) {
            requirementKey = `PRODUCT:${p.id}`;
          }

          if (p.is_serialized) {
            const remaining = isProposalRequirement ? getRemaining(requirementKey) : 1;
            if (isProposalRequirement && remaining <= 0) {
              playBeep("error");
              const msg = p.name + " ya alcanzó la cantidad requerida.";
              setTimedFeedback({ type: "error", message: msg });
              onError?.(msg);
              return;
            }
            playBeep("info");
            const requirementLabel = isProposalRequirement
              ? resolveRequirementLabel(requirementKey, p.name)
              : p.name;
            setScanMode("WAITING_SERIAL");
            setPendingProduct({
              id: p.id,
              name: requirementLabel,
              groupId: p.group_id ?? productToGroup[p.id] ?? null,
              requirementKey,
            });
            setPendingRemaining(remaining);
            setTimedFeedback({
              type: "info",
              message: requirementLabel + " — escaneá " + remaining + " serial(es).",
            });
          } else {
            if (isProposalRequirement && (scannedCounts.current[requirementKey] || 0) >= (requiredCounts[requirementKey] || 0)) {
              playBeep("error");
              const msg = p.name + " ya alcanzó la cantidad requerida.";
              setTimedFeedback({ type: "error", message: msg });
              onError?.(msg);
              return;
            }

            if (deliveryId != null) {
              try {
                const result = await postWithProposalOverride(
                  `/v2/logistics/deliveries/${deliveryId}/scan-barcode`,
                  { product_code: upper, quantity: 1 }
                );

                if (!result) {
                  return;
                }

                playBeep(result.already_scanned ? "info" : "success");
                registerLocalBulk({
                  product_id: p.id,
                  product_name: p.name,
                  product_sku: p.sku,
                  product_group_id: p.group_id ?? null,
                  requirement_key: requirementKey,
                  is_serialized: false,
                });
                setTimedFeedback({
                  type: result.already_scanned ? "info" : "success",
                  message: result.message || (p.name + " agregado."),
                });
                return;
              } catch (err) {
                handleApiError(err, "Producto no disponible en el depósito origen.");
                return;
              }
            }

            playBeep("success");
            registerLocalBulk({
              product_id: p.id,
              product_name: p.name,
              product_sku: p.sku,
              product_group_id: p.group_id ?? null,
              requirement_key: requirementKey,
              is_serialized: false,
            });
            setTimedFeedback({ type: "success", message: p.name + " agregado." });
          }
          return;
        }

        // ─── Tipo: Serial ───────────────────────────────────────────────────
        if (resolved.type === "serial") {
          const { serial, product } = resolved;

          // Status debe ser NEW (la API ya retorna 400 si no, pero validamos localmente también)
          if (serial.status !== "NEW") {
            playBeep("error");
            setTimedFeedback({
              type: "error",
              message: "Serial no disponible (estado: " + serial.status + ").",
            });
            return;
          }

          // El producto del serial debe estar en la propuesta
          const serialGroupId = product?.group_id ?? productToGroup[serial.product_id] ?? null;
          let requirementKey = resolveRequirementKey(serial.product_id, serialGroupId);
          const isProposalRequirement = requirementKey != null && requiredCounts[requirementKey] != null;

          if (requirementKey == null) {
            requirementKey = `PRODUCT:${serial.product_id}`;
          }

          // Anti-duplicado local por serial_item_id
          if (scannedSerialIds.current.has(serial.id)) {
            playBeep("error");
            setTimedFeedback({ type: "error", message: "Este serial ya fue escaneado." });
            return;
          }

          // En WAITING_SERIAL, el serial debe pertenecer al producto esperado
          if (scanMode === "WAITING_SERIAL" && pendingProduct != null) {
            if (pendingProduct.requirementKey !== requirementKey) {
              playBeep("error");
              setTimedFeedback({
                type: "error",
                message: "Serial incorrecto. Se esperaba serial del requerimiento activo.",
              });
              return;
            }
          }

          if (isProposalRequirement && (scannedCounts.current[requirementKey] || 0) >= (requiredCounts[requirementKey] || 0)) {
            playBeep("error");
            const msg = (product?.name ?? "Producto") + " ya alcanzó la cantidad requerida.";
            setTimedFeedback({ type: "error", message: msg });
            onError?.(msg);
            return;
          }

          if (deliveryId != null) {
            try {
              const result = await postWithProposalOverride(
                `/v2/logistics/deliveries/${deliveryId}/scan-serial`,
                {
                  product_id: serial.product_id,
                  serial_number: serial.serial_number,
                }
              );

              if (!result) {
                return;
              }

              if (result.already_scanned) {
                playBeep("error");
                setTimedFeedback({ type: "error", message: result.message });
                onError?.(result.message);
                return;
              }

              const remaining = registerLocalSerial({
                product_id: serial.product_id,
                product_name: product?.name ?? result.product_name ?? pendingProduct?.name ?? "Producto",
                serial_number: result.serial_number,
                delivery_item_id: result.delivery_item_id ?? null,
                serial_item_id: result.serial_item_id,
                product_group_id: serialGroupId,
                requirement_key: requirementKey,
                is_serialized: true,
              });

              playBeep("success");
              if (scanMode === "WAITING_SERIAL") {
                setScanMode("IDLE");
                setPendingProduct(null);
                setPendingRemaining(0);
              }
              if (remaining <= 0) {
                setTimedFeedback({
                  type: "success",
                  message: "Completo para " + (product?.name ?? result.product_name ?? "Producto") + "!",
                });
              } else {
                setTimedFeedback({
                  type: "success",
                  message: result.message || ("Serial confirmado. Faltan " + remaining + "."),
                });
              }
              return;
            } catch (err) {
              handleApiError(err, "Serial no disponible en el depósito origen.");
              return;
            }
          }

          // Registrar serial
          const pid = serial.product_id;
          const remaining = registerLocalSerial({
            product_id: pid,
            product_name: product?.name ?? pendingProduct?.name ?? "Producto",
            serial_number: serial.serial_number,
            delivery_item_id: null,
            serial_item_id: serial.id,
            product_group_id: serialGroupId,
            requirement_key: requirementKey,
            is_serialized: true,
          });
          const productName = product?.name ?? pendingProduct?.name ?? "Producto";

          playBeep("success");
          if (scanMode === "WAITING_SERIAL") {
            setScanMode("IDLE");
            setPendingProduct(null);
            setPendingRemaining(0);
          }
          if (remaining <= 0) {
            setTimedFeedback({
              type: "success",
              message: "Completo para " + productName + "!",
            });
          } else {
            setTimedFeedback({
              type: "success",
              message: "Serial confirmado. Faltan " + remaining + ".",
            });
          }
          return;
        }

        // Tipo de respuesta desconocido
        playBeep("error");
        setTimedFeedback({ type: "error", message: "Respuesta inesperada del servidor." });

      } catch (err) {
        handleApiError(err, "Error de comunicación con el servidor.");
      } finally {
        isProcessing.current = false;
      }
    },
    [deliveryId, enabled, getRemaining, handleApiError, hasAcceptedProposal, onError, pendingProduct, postWithProposalOverride, productToGroup, proposalItems, registerLocalBulk, registerLocalSerial, requiredCounts, resolveRequirementKey, resolveRequirementLabel, scanMode, setTimedFeedback]
  );

  const reset = useCallback(() => {
    setScanMode("IDLE");
    setPendingProduct(null);
    setPendingRemaining(0);
    setTimedFeedback(null);
    scannedSerialIds.current.clear();
    scannedCounts.current = {};
  }, [setTimedFeedback]);

  const removeScannedItem = useCallback(async (item) => {
    if (!item) return;

    const key = item.requirement_key || resolveRequirementKey(item.product_id, item.product_group_id ?? null);
    if (key != null && scannedCounts.current[key] != null) {
      scannedCounts.current[key] = Math.max(0, scannedCounts.current[key] - 1);
    }

    if (item.serial_item_id != null) {
      scannedSerialIds.current.delete(item.serial_item_id);
    }

    if (deliveryId != null && item.delivery_item_id != null) {
      try {
        await api.delete(`/v2/logistics/deliveries/${deliveryId}/items/${item.delivery_item_id}`);
      } catch (err) {
        handleApiError(err, "No se pudo deshacer el escaneo en el servidor.");
      }
    }
  }, [deliveryId, handleApiError, resolveRequirementKey]);

  return {
    scanMode,
    pendingProductId: pendingProduct?.id ?? null,
    pendingProductName: pendingProduct?.name ?? null,
    pendingRemaining,
    scannedCounts: scannedCounts.current,
    requiredCounts,
    lastFeedback,
    resolveScan,
    removeScannedItem,
    reset,
  };
}
