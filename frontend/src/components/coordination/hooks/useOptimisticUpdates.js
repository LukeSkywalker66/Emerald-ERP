/**
 * useOptimisticUpdates Hook
 * 
 * Gestiona actualizaciones optimistas (optimistic UI).
 * Muestra cambio inmediatamente, revierte si falla.
 * 
 * @param {Object} initialData - Estado inicial {teams, allocations, backlog}
 * @returns {Object} {
 *   data,
 *   applyOptimisticUpdate,
 *   revertOptimisticUpdate,
 *   isUpdating,
 *   pendingUpdates
 * }
 */

import { useState, useCallback, useRef } from 'react';

export function useOptimisticUpdates(initialData) {
  const [data, setData] = useState(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState([]);

  // Stack de snapshots para revert
  const updateStackRef = useRef([]);
  const lastSyncRef = useRef(Date.now());

  /**
   * Aplicar cambio optimista
   * @param {string} type - 'assign', 'unassign', 'update_times', etc.
   * @param {Object} payload - Datos específicos del cambio
   * @returns {string} updateId para tracking
   */
  const applyOptimisticUpdate = useCallback((type, payload) => {
    const updateId = `${type}_${Date.now()}_${Math.random()}`;
    setIsUpdating(true);

    // Guardar snapshot actual
    updateStackRef.current.push({
      id: updateId,
      timestamp: Date.now(),
      type,
      payload,
      snapshot: structuredClone(data),
    });

    // Agregar a pending
    setPendingUpdates((prev) => [
      ...prev,
      { id: updateId, type, status: 'pending' },
    ]);

    // Aplicar cambio optimista al estado
    try {
      const newData = applyOptimisticChange(data, type, payload);
      setData(newData);
      console.log(`✨ Cambio optimista aplicado: ${updateId}`, { type, payload });
    } catch (err) {
      console.error(`❌ Error en cambio optimista: ${updateId}`, err);
      updateStackRef.current.pop();
      setPendingUpdates((prev) =>
        prev.map((u) => (u.id === updateId ? { ...u, status: 'error' } : u))
      );
      setIsUpdating(false);
      throw err;
    }

    return updateId;
  }, [data]);

  /**
   * Confirmar actualización (la API respondió correctamente)
   */
  const confirmUpdate = useCallback((updateId, newData = null) => {
    // Remover de pending updates
    setPendingUpdates((prev) =>
      prev.filter((u) => u.id !== updateId)
    );

    // Si newData es proporcionada, sincronizar con respuesta del servidor
    if (newData) {
      setData(newData);
    }

    // Limpiar stack (remover este update y anteriores)
    const idx = updateStackRef.current.findIndex((u) => u.id === updateId);
    if (idx >= 0) {
      updateStackRef.current = updateStackRef.current.slice(idx + 1);
    }

    lastSyncRef.current = Date.now();
    setIsUpdating(false);

    console.log(`✅ Actualización confirmada: ${updateId}`);
  }, []);

  /**
   * Revertir actualización
   */
  const revertOptimisticUpdate = useCallback((updateId) => {
    const stackIndex = updateStackRef.current.findIndex(
      (u) => u.id === updateId
    );

    if (stackIndex === -1) {
      console.error(`❌ No se encontró updateId: ${updateId}`);
      return;
    }

    // Recuperar snapshot
    const snapshot = updateStackRef.current[stackIndex].snapshot;
    setData(structuredClone(snapshot)); // Restore snapshot

    // Remover del stack
    updateStackRef.current = updateStackRef.current.slice(0, stackIndex);

    // Remover de pending updates
    setPendingUpdates((prev) =>
      prev.map((u) =>
        u.id === updateId ? { ...u, status: 'reverted' } : u
      )
    );

    setIsUpdating(false);

    console.log(`⏮️ Cambio revertido: ${updateId}`);
  }, []);

  /**
   * Revertir múltiples updates (rollback)
   */
  const revertAll = useCallback(() => {
    if (updateStackRef.current.length === 0) {
      console.log('No hay cambios pendientes para revertir');
      return;
    }

    const oldestSnapshot = updateStackRef.current[0].snapshot;
    setData(structuredClone(oldestSnapshot));

    updateStackRef.current = [];
    setPendingUpdates([]);
    setIsUpdating(false);

    console.log('⏮️ Todos los cambios revertidos');
  }, []);

  /**
   * Sincronizar con datos frescos de BD
   */
  const syncWithBackend = useCallback((freshData) => {
    // Limpiar stack de updates
    updateStackRef.current = [];
    setPendingUpdates([]);
    setData(freshData);
    lastSyncRef.current = Date.now();
    setIsUpdating(false);

    console.log('🔄 Sincronizado con backend');
  }, []);

  return {
    data,
    applyOptimisticUpdate,
    confirmUpdate,
    revertOptimisticUpdate,
    revertAll,
    syncWithBackend,
    isUpdating,
    pendingUpdates,
    hasPendingUpdates: pendingUpdates.length > 0,
  };
}

/**
 * Aplicar cambio específico al estado
 */
function applyOptimisticChange(currentData, type, payload) {
  switch (type) {
    case 'assign': {
      // Asignar OT a equipo
      const { workOrderId, teamId, startTime, endTime } = payload;
      const newAllocations = [...currentData.allocations];

      // Buscar si ya existe asignación y actualizar
      const existingIdx = newAllocations.findIndex(
        (a) => a.work_order_id === workOrderId
      );

      const newAllocation = {
        id: `temp_${workOrderId}_${Date.now()}`,
        work_order_id: workOrderId,
        team_id: teamId,
        start_time: startTime,
        end_time: endTime,
        created_at: new Date().toISOString(),
        is_temporary: true, // Marcar como temporal hasta confirmación
      };

      if (existingIdx >= 0) {
        newAllocations[existingIdx] = newAllocation;
      } else {
        newAllocations.push(newAllocation);
      }

      return {
        ...currentData,
        allocations: newAllocations,
      };
    }

    case 'unassign': {
      // Desasignar OT
      const { workOrderId } = payload;
      return {
        ...currentData,
        allocations: currentData.allocations.filter(
          (a) => a.work_order_id !== workOrderId
        ),
      };
    }

    case 'update_times': {
      // Cambiar horarios de asignación
      const { workOrderId, startTime, endTime } = payload;
      const newAllocations = currentData.allocations.map((a) =>
        a.work_order_id === workOrderId
          ? { ...a, start_time: startTime, end_time: endTime }
          : a
      );
      return {
        ...currentData,
        allocations: newAllocations,
      };
    }

    case 'sync': {
      // Sincronización completa con BD
      return payload.newData;
    }

    default:
      console.warn(`Tipo de cambio desconocido: ${type}`);
      return currentData;
  }
}
