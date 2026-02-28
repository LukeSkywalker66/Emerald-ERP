# Quick Reference: Drag & Drop Bug - Comienza Aquí

## 🎯 El Problema en 30 segundos

**User acción**: Arrastra OT del sidebar al grid
**Resultado esperado**: OT aparece en grid permanentemente + desaparece del sidebar
**Resultado actual**: OT aparece brevemente, luego **DESAPARECE del grid**

## 🔴 Raíz del Problema

```
PATCH /assign → OT asignada ✅
    ↓
Grid llama parent.loadCoordinationGrid() ← ESTO LO ROMPE
    ↓
Parent hace GET /coordination/grid
    ↓
Backend retorna allocations SIN la OT (replicación lag o filter issue)
    ↓
Grid recibe nuevos props sin la OT → OT desaparece ❌
```

## ✅ Intento de Solución (Status: NO FUNCIONA AÚN)

**Ubicación**: `frontend/src/components/coordination/ImprovedCoordinationGrid.jsx` Lines 75-87

**Idea**: Merge inteligente que mantiene OTs "huérfanas" (locales pero no en servidor)

**Problema**: Hay un bug de lógica o timing → Los logs revelarán qué es

## 📋 Tu Primer Paso (5 minutos)

1. Abre: `frontend/src/components/coordination/ImprovedCoordinationGrid.jsx`
2. Ve a Lines 75-87 (useEffect del merge)
3. Agrega esto al inicio del `setLocalWorkOrders`:
```javascript
console.log('📥 MERGE TRIGGERED - prev:', prev.length, 'workOrders:', workOrders.length);
```
4. Agrega esto antes del return:
```javascript
console.log('📤 MERGE RESULT - merged:', merged.length, 'IDs:', merged.map(w => w.id));
```
5. Abre DevTools (F12 → Console)
6. **Dropea una OT y observa qué dice la consola**
7. Reporta exactamente qué ves

## 🎮 Test Rápido

```
1. Abre http://localhost:3000
2. Ve a Coordinación
3. En el sidebar, agarra una OT azul (del backlog)
4. Arrastra a un espacio verde en la grilla
5. Suelta → Debería:
   - ✅ Aparecer en el grid
   - ✅ No darte error 500
   - ✅ Desaparecer del sidebar
   - ❌ PERO probablemente desaparecerá del grid a los 100ms
```

## 🔍 Logs Clave a Observar

**Esperados después de un drop perfecto**:
1. `💾 OT actualizada en el backend` (handleDrop)
2. `📥 MERGE TRIGGERED - prev: X, workOrders: Y` (useEffect)
3. `📤 MERGE RESULT - merged: Z, IDs: [...]` (useEffect)

**Si desaparece es porque**:
- No ves estos logs (useEffect no se ejecuta) → problema de dependencies
- El MERGE no contiene la OT (Z no incluye el ID) → algoritmo no funciona
- O el render no muestra OTs huérfanas → filter de allocations las elimina

## 🛠️ Si Necesitas Revertir Rápidamente

```bash
cd /opt/emerald-erp
git show 4513e16:frontend/src/components/coordination/ImprovedCoordinationGrid.jsx > /tmp/backup.jsx
# Ahora el archivo está en /tmp/backup.jsx, revisa qué cambió
```

## 📞 Próximos Pasos (en Orden)

1. **Ejecuta los logs** → Entiende qué falla
2. **Lee CODIGO_DEBUG_DRAG_DROP_2026-02-23.md** → Soluciones específicas
3. **Elige una solución**:
   - Quick Win #1: Cambiar dependency array
   - Quick Win #2: Deduplicar en merge
   - Quick Win #3: Validar que OT pase filter de día
4. **Implementa + Prueba**
5. **Si falla**: Lee CHECKPOINT_DRAG_DROP_2026-02-23.md para contexto completo

## 📁 Documentos de Soporte

- **CHECKPOINT_DRAG_DROP_2026-02-23.md** → Análisis completo, todos los intentos previos
- **CODIGO_DEBUG_DRAG_DROP_2026-02-23.md** → Bugs específicos + logs + soluciones rápidas
- **ESTADO_CODIGO_SNAPSHOT_2026-02-23.md** → Código congelado, qué no tocar

## ✋ IMPORTANTE: Reglas de Oro

- 🛡️ **No toques CSS/Styling**
- 🛡️ **No elimines validación de colisiones**
- 🛡️ **No cambies response del PATCH**
- 🛡️ **Agrega logs antes de cambiar código**
- 🛡️ **Prueba en consola PRIMERO**

---

**Creado**: 23 Feb 2026, 10:45 UTC  
**Nivel de urgencia**: Media (UX roto pero sin data loss)  
**Estimado para siguente sesión**: 30-60 minutos si empiezas con los logs
