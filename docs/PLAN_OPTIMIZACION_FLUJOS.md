# 🚀 Plan de Optimización de Flujos - Módulo Inventario

**Fecha:** 15 de Enero 2026  
**Estado:** Propuesta para Revisión  
**Objetivo:** Mejorar UX eliminando fricciones, reduciendo pasos innecesarios y agregando feedback visual

---

## 📊 ANÁLISIS ACTUAL

### Módulos Analizados
| Módulo | Archivo | Líneas | Status Actual |
|--------|---------|--------|---------------|
| **ProductCatalog** | `frontend/src/pages/inventory/ProductCatalog.jsx` | 889 | ✅ Funcional |
| **StockTransferWizard** | `frontend/src/pages/inventory/StockTransferWizard.jsx` | 622 | ✅ Funcional |
| **StockAdjustments** | `frontend/src/pages/inventory/StockAdjustments.jsx` | 558 | ✅ Funcional |

---

## 🎯 OPORTUNIDADES DE MEJORA IDENTIFICADAS

### 1️⃣ **ProductCatalog - Edición Inline**

**Problema Actual:**
- Click en producto → Abrir modal → Editar → Cerrar modal
- **3 clicks** para editar un campo simple (ej: min_stock_alert)

**Solución Propuesta:**
```
✨ Edición inline para campos simples:
- Doble-click en celda → Campo editable → Enter para guardar
- Solo para: min_stock_alert, category, description
- Campos críticos (SKU, type) requieren modal con confirmación
```

**Beneficio:** Reducir de **3 clicks a 1 doble-click + Enter**

**Implementación:**
```jsx
// Agregar en ProductCatalog.jsx
const [editingCell, setEditingCell] = useState(null); // {productId, field}
const [inlineValue, setInlineValue] = useState('');

const handleDoubleClick = (product, field) => {
  if (['min_stock_alert', 'category', 'description'].includes(field)) {
    setEditingCell({ productId: product.id, field });
    setInlineValue(product[field] || '');
  }
};

const handleInlineSave = async () => {
  try {
    await updateProduct(editingCell.productId, {
      [editingCell.field]: inlineValue
    });
    await loadProducts();
    setEditingCell(null);
  } catch (err) {
    setError(err.message);
  }
};

// En la tabla:
{editingCell?.productId === product.id && editingCell?.field === 'min_stock_alert' ? (
  <input 
    value={inlineValue}
    onChange={(e) => setInlineValue(e.target.value)}
    onBlur={handleInlineSave}
    onKeyDown={(e) => e.key === 'Enter' && handleInlineSave()}
    autoFocus
  />
) : (
  <span onDoubleClick={() => handleDoubleClick(product, 'min_stock_alert')}>
    {product.min_stock_alert}
  </span>
)}
```

---

### 2️⃣ **StockTransferWizard - Saltar Paso 3 (opcional)**

**Problema Actual:**
- Wizard 5 pasos obligatorios, incluso para transferencias simples
- Paso 3 (referencia/notas) es **opcional** pero requiere "Siguiente"

**Solución Propuesta:**
```
✨ Checkbox en Paso 2: "Transferir directamente (sin referencia)"
- Si activado → Paso 2 → Paso 4 (confirmación)
- Si desactivado → Flujo normal con Paso 3
```

**Beneficio:** Ahorro de **1 click** para transferencias rápidas (≈60% de casos)

**Implementación:**
```jsx
// En StockTransferWizard.jsx
const [skipReferenceStep, setSkipReferenceStep] = useState(false);

const handleStep2Next = (data) => {
  setFormData((prev) => ({
    ...prev,
    quantity: data.quantity,
    serial_item_ids: data.serial_item_ids || [],
  }));
  
  if (skipReferenceStep) {
    setCurrentStep(4); // Saltar Paso 3
  } else {
    setCurrentStep(3);
  }
};

// En Paso 2 UI:
<label className="flex items-center gap-2 mt-4 text-sm">
  <input 
    type="checkbox" 
    checked={skipReferenceStep}
    onChange={(e) => setSkipReferenceStep(e.target.checked)}
  />
  <span className="text-zinc-400">
    Transferir directamente sin agregar referencia
  </span>
</label>
```

---

### 3️⃣ **StockAdjustments - Auto-detectar Tipo de Producto**

**Problema Actual:**
- Al seleccionar ONU (SERIALIZED), el usuario debe cambiar manualmente la UI
- Campo `quantity` permanece visible cuando debería ser `serial_numbers`

**Solución Propuesta:**
```
✨ Auto-switch UI basado en tipo de producto:
- Seleccionar producto → UI cambia automáticamente
- BULK → Mostrar campo "Cantidad"
- SERIALIZED → Mostrar campo "Números de Serie"
```

**Beneficio:** Eliminar confusión, reducir errores de validación

**Implementación:**
```jsx
// Ya está implementado parcialmente en línea 74-83
// Solo falta mejorar feedback visual:

const handleInputChange = (e) => {
  const { name, value } = e.target;
  setFormData((prev) => {
    const updated = { ...prev, [name]: value };

    if (name === 'product_id') {
      const product = products.find((p) => p.id === parseInt(value));
      if (product?.type === 'SERIALIZED') {
        updated.movement_type = 'PURCHASE';
        updated.quantity = ''; // Limpiar cantidad
        // Agregar toast/mensaje:
        showToast('Producto serializado detectado. Ingresa números de serie.');
      }
    }

    return updated;
  });
};
```

---

### 4️⃣ **Global - Toast Notifications System**

**Problema Actual:**
- Mensajes de éxito/error son modales o alerts
- Interrumpen el flujo, requieren dismissal manual

**Solución Propuesta:**
```
✨ Toast notifications (auto-dismiss en 3-5s):
- Esquina superior derecha
- No requieren acción del usuario
- Stack múltiples mensajes si hay varios
```

**Beneficio:** Feedback no-intrusivo, mejor UX

**Implementación:**
```jsx
// Crear componente global: frontend/src/components/common/ToastProvider.jsx
import React, { createContext, useContext, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slideIn ${
              toast.type === 'success' 
                ? 'bg-emerald-900/90 border border-emerald-700' 
                : 'bg-red-900/90 border border-red-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <span className="text-white text-sm">{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Uso en componentes:
import { useToast } from '@/components/common/ToastProvider';

const { showToast } = useToast();
await createProduct(payload);
showToast('Producto creado exitosamente', 'success');
```

---

### 5️⃣ **ProductCatalog - Bulk Actions**

**Problema Actual:**
- Para actualizar `min_stock_alert` de múltiples cables, hay que hacerlo uno por uno
- No hay selección múltiple

**Solución Propuesta:**
```
✨ Checkbox de selección múltiple + Acciones masivas:
- Seleccionar varios productos → "Actualizar min_stock_alert" → Modal
- Aplicar mismo valor a todos seleccionados
```

**Beneficio:** Ahorro masivo de tiempo para configuraciones repetitivas

**Implementación:**
```jsx
// En ProductCatalog.jsx
const [selectedProductIds, setSelectedProductIds] = useState([]);
const [showBulkModal, setShowBulkModal] = useState(false);
const [bulkValue, setBulkValue] = useState('');

const handleToggleSelect = (productId) => {
  setSelectedProductIds((prev) => 
    prev.includes(productId) 
      ? prev.filter((id) => id !== productId)
      : [...prev, productId]
  );
};

const handleBulkUpdate = async () => {
  try {
    await Promise.all(
      selectedProductIds.map((id) => 
        updateProduct(id, { min_stock_alert: parseInt(bulkValue) })
      )
    );
    await loadProducts();
    setSelectedProductIds([]);
    setShowBulkModal(false);
  } catch (err) {
    setError(err.message);
  }
};

// En la tabla:
<th>
  <input 
    type="checkbox" 
    checked={selectedProductIds.length === filteredProducts.length}
    onChange={(e) => 
      setSelectedProductIds(
        e.target.checked ? filteredProducts.map((p) => p.id) : []
      )
    }
  />
</th>

// Botón de acciones masivas:
{selectedProductIds.length > 0 && (
  <button onClick={() => setShowBulkModal(true)}>
    Actualizar {selectedProductIds.length} productos
  </button>
)}
```

---

### 6️⃣ **StockTransferWizard - Preview en Paso 4**

**Problema Actual:**
- Paso 4 muestra resumen, pero no el **impacto** en stock
- Usuario no ve: "Warehouse A: 50 → 40 | Warehouse B: 10 → 20"

**Solución Propuesta:**
```
✨ Preview visual del cambio de stock:
- Antes: Origen (50 unidades) → Destino (10 unidades)
- Después: Origen (40 unidades) → Destino (20 unidades)
```

**Beneficio:** Validación visual antes de confirmar

**Implementación:**
```jsx
// En Paso 4 de StockTransferWizard.jsx
const sourceStockBefore = sourceStock?.quantity || 0;
const sourceStockAfter = sourceStockBefore - formData.quantity;
const destStockBefore = 0; // Obtener de API
const destStockAfter = destStockBefore + formData.quantity;

// UI:
<div className="bg-zinc-800 rounded-lg p-4">
  <h3 className="text-sm font-semibold text-zinc-400 mb-3">
    Impacto en Stock
  </h3>
  
  <div className="grid grid-cols-2 gap-4">
    <div>
      <p className="text-xs text-zinc-500 mb-1">{sourceWarehouse.name}</p>
      <div className="flex items-center gap-2">
        <span className="text-lg text-white">{sourceStockBefore}</span>
        <span className="text-zinc-500">→</span>
        <span className={`text-lg ${
          sourceStockAfter < 10 ? 'text-red-400' : 'text-emerald-400'
        }`}>
          {sourceStockAfter}
        </span>
      </div>
    </div>
    
    <div>
      <p className="text-xs text-zinc-500 mb-1">{destWarehouse.name}</p>
      <div className="flex items-center gap-2">
        <span className="text-lg text-white">{destStockBefore}</span>
        <span className="text-zinc-500">→</span>
        <span className="text-lg text-emerald-400">{destStockAfter}</span>
      </div>
    </div>
  </div>
</div>
```

---

### 7️⃣ **Global - Quick Actions Shortcuts**

**Problema Actual:**
- No hay atajos de teclado para acciones comunes
- Todo requiere mouse

**Solución Propuesta:**
```
✨ Keyboard shortcuts:
- Ctrl+N → Nuevo Producto (ProductCatalog)
- Ctrl+T → Nueva Transferencia (desde cualquier página inventario)
- Ctrl+P → Nueva Compra (StockAdjustments)
- Esc → Cerrar modales
- Enter → Confirmar acciones
```

**Beneficio:** Power users pueden trabajar sin mouse

**Implementación:**
```jsx
// Hook global: frontend/src/hooks/useKeyboardShortcuts.js
import { useEffect } from 'react';

export const useKeyboardShortcuts = (shortcuts) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.key}`;
      const action = shortcuts[key];
      
      if (action && !e.target.matches('input, textarea')) {
        e.preventDefault();
        action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Uso en ProductCatalog:
useKeyboardShortcuts({
  'Ctrl+n': () => setShowCreateModal(true),
  'Escape': () => {
    setShowCreateModal(false);
    setShowEditModal(false);
  }
});
```

---

### 8️⃣ **StockAdjustments - Historial con Filtros Inteligentes**

**Problema Actual:**
- Tabla muestra últimos 20 movimientos sin contexto
- No hay filtro por producto, warehouse, o rango de fechas

**Solución Propuesta:**
```
✨ Filtros rápidos sobre la tabla:
- Por producto (dropdown)
- Por warehouse (dropdown)
- Por tipo de movimiento (PURCHASE/ADJUSTMENT)
- Rango de fechas (date picker)
```

**Beneficio:** Auditoría rápida de movimientos específicos

**Implementación:**
```jsx
// En StockAdjustments.jsx
const [filters, setFilters] = useState({
  product_id: '',
  warehouse_id: '',
  movement_type: '',
  date_from: '',
  date_to: ''
});

const filteredMovements = movements.filter((m) => {
  if (filters.product_id && m.product_id !== parseInt(filters.product_id)) return false;
  if (filters.warehouse_id && m.warehouse_id !== parseInt(filters.warehouse_id)) return false;
  if (filters.movement_type && m.movement_type !== filters.movement_type) return false;
  if (filters.date_from && new Date(m.created_at) < new Date(filters.date_from)) return false;
  if (filters.date_to && new Date(m.created_at) > new Date(filters.date_to)) return false;
  return true;
});

// UI:
<div className="grid grid-cols-4 gap-4 mb-4">
  <select value={filters.product_id} onChange={...}>
    <option value="">Todos los productos</option>
    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
  </select>
  
  <select value={filters.warehouse_id} onChange={...}>
    <option value="">Todos los almacenes</option>
    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
  </select>
  
  <select value={filters.movement_type} onChange={...}>
    <option value="">Todos los tipos</option>
    <option value="PURCHASE">Compra</option>
    <option value="ADJUSTMENT">Ajuste</option>
  </select>
  
  <input type="date" value={filters.date_from} onChange={...} />
</div>
```

---

## 📅 PLAN DE IMPLEMENTACIÓN

### Prioridad ALTA (Impacto inmediato)
| Mejora | Tiempo | Beneficio |
|--------|--------|-----------|
| **4. Toast Notifications** | 1h | Feedback no-intrusivo global |
| **3. Auto-detectar Tipo** | 30min | Reducir errores SERIALIZED |
| **7. Keyboard Shortcuts** | 45min | Power users +30% velocidad |

### Prioridad MEDIA (UX mejorado)
| Mejora | Tiempo | Beneficio |
|--------|--------|-----------|
| **1. Edición Inline** | 2h | -2 clicks por edición |
| **2. Saltar Paso 3** | 1h | -1 click (60% transferencias) |
| **6. Preview Paso 4** | 1.5h | Validación visual |

### Prioridad BAJA (Nice-to-have)
| Mejora | Tiempo | Beneficio |
|--------|--------|-----------|
| **5. Bulk Actions** | 3h | Configuraciones masivas |
| **8. Filtros Historial** | 2h | Auditoría mejorada |

### Estimación Total
- **Alta:** 2h 15min
- **Media:** 4h 30min
- **Baja:** 5h
- **TOTAL:** ~12h (1.5 días de desarrollo)

---

## ✅ CHECKLIST DE VALIDACIÓN POST-IMPLEMENTACIÓN

### Para cada mejora implementada:
- [ ] Testing manual en navegador (happy path)
- [ ] Testing de edge cases (validaciones)
- [ ] Verificar responsive design (mobile/tablet)
- [ ] Confirmar no hay regresiones en funcionalidad existente
- [ ] Actualizar documentación (si aplica)

---

## 🎓 PRINCIPIOS DE DISEÑO APLICADOS

1. **Reduce Friction:** Menos clicks = mejor UX
2. **Provide Feedback:** Usuarios siempre saben qué pasó
3. **Prevent Errors:** Validación proactiva vs reactiva
4. **Progressive Disclosure:** Solo mostrar lo necesario en cada paso
5. **Forgiveness:** Permitir deshacer acciones cuando sea posible

---

## 📞 NOTAS PARA IMPLEMENTACIÓN

### Orden Sugerido
1. Empezar con **Toast System** (base para todas las demás)
2. Luego **Keyboard Shortcuts** (hook reutilizable)
3. Finalmente mejoras específicas por módulo

### Testing Strategy
```bash
# Antes de implementar cada mejora:
1. Crear branch feature: git checkout -b feature/optimize-[nombre-mejora]
2. Implementar cambio
3. Testing manual (checklist)
4. Commit con mensaje descriptivo
5. Merge a develop

# Ejemplo:
git checkout -b feature/optimize-toast-system
# ... implementar ToastProvider ...
git add frontend/src/components/common/ToastProvider.jsx
git commit -m "feat(ux): Add global toast notification system"
git push origin feature/optimize-toast-system
```

---

**Generado:** 15-ENE-2026 23:30  
**Para Discusión:** Revisar prioridades con equipo antes de implementar  
**Objetivo:** Mejorar UX sin romper funcionalidad existente
