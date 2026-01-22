# 🧪 Test Flujo Completo: Técnico 2 → Móvil → OT → Materiales

**Fecha:** 14-ENE-2026  
**Estado:** ✅ DATOS CONFIGURADOS Y LISTOS PARA TESTEAR

---

## 📊 Configuración de Datos Creada

### 1️⃣ Warehouse MOBILE para Técnico 2
```
ID: 4
Nombre: Camioneta Técnico 2 - TC201
Tipo: MOBILE
Usuario Asignado: Técnico 2 (user_id = 9)
Email: tecnico2@emerald.com
```

### 2️⃣ Stock Asignado al Warehouse (ID=4)

#### 📦 BULK Products
| Producto | Cantidad | SKU |
|----------|----------|-----|
| Cable UTP Cat6 305m | 75 metros | CAB-UTP-CAT6-305 |
| Conectores Verdes | 20 unidades | ASDASDASDASD |

#### 🏷️ SERIALIZED Products
| Producto | Serial | Estado |
|----------|--------|--------|
| ONU GPON Huawei HG8546M | ONU-2024-001 | NEW |
| ONU GPON Huawei HG8546M | ONU-2024-002 | NEW |
| ONU GPON Huawei HG8546M | ONU-2024-003 | NEW |

### 3️⃣ Work Order Asignada
```
ID: 1
Ticket ID: 10 (Prueba de ticket nuevo)
Técnico Asignado: Técnico 2 (user_id = 9)
Status: pending_planning
```

---

## 🧑‍💻 Pasos para Probar

### PASO 1: Login como Técnico 2
```
URL: http://localhost:3000/login
Email: tecnico2@emerald.com
Password: [cualquiera, ajustar según config]
```

### PASO 2: Navegar a la OT
```
URL: http://localhost:3000/app/work-orders/1/execute
Esperar a que cargue la página
```

### PASO 3: Abrir Modal "Agregar Material"
1. Click en botón **"+ Agregar Material"**
2. Esperar loading spinner (2-3 segundos)
3. Verificar que aparezca:
   - ✅ Nombre del warehouse: "📦 Stock de: Camioneta Técnico 2 - TC201"
   - ✅ Dropdown con productos (no vacío)
   - ✅ Stock counter visible

### PASO 4: Probar Flujo BULK (Cable UTP)
1. Seleccionar "Cable UTP Cat6 305m" en dropdown
2. Verificar:
   - ✅ Aparezca campo "Cantidad"
   - ✅ Desaparezca campo "Serial Number"
   - ✅ Stock counter muestre: "Stock disponible: 75 metros"
3. Ingresar cantidad: `10`
4. Click "Agregar"
5. Verificar:
   - ✅ Se agregó correctamente
   - ✅ Stock actualiza a: `65 metros`
   - ✅ El material aparece en la tabla

### PASO 5: Probar Flujo SERIALIZED (ONU Huawei)
1. Seleccionar "ONU GPON Huawei HG8546M" en dropdown
2. Verificar:
   - ✅ Aparezca campo "Serial Number" (dropdown)
   - ✅ Desaparezca campo "Cantidad"
   - ✅ Stock counter muestre: "Disponibles: 2 seriales" (porque 1 se usó en paso anterior, no... espera, ONU es diferente)
   - ✅ Dropdown de seriales muestre: ONU-2024-002, ONU-2024-003 (ONU-2024-001 está disponible también)
3. Seleccionar serial: `ONU-2024-001`
4. Click "Agregar"
5. Verificar:
   - ✅ Se agregó correctamente
   - ✅ Serial ONU-2024-001 desaparece de dropdown (ahora solo ONU-2024-002 y 003)
   - ✅ Stock counter actualiza: "Disponibles: 2 seriales"

### PASO 6: Probar Error Handling
1. Click "+ Agregar Material" nuevamente
2. Sin seleccionar nada, intentar click "Agregar"
3. Verificar:
   - ✅ Botón está **disabled** (grisado)
4. Seleccionar producto pero no completar:
   - Si BULK: ingresar cantidad = 100 (más que disponible)
   - Si SERIALIZED: no seleccionar serial
5. Verificar:
   - ✅ Botón sigue **disabled**
   - ✅ Hay mensaje de error o validación

---

## ❌ Problemas Conocidos a Revisar

| Problema | Síntoma | Acción si Ocurre |
|----------|---------|-----------------|
| Warehouse vacío | Dice "No tienes una camioneta asignada" | DB correcta, revisar `getMyWarehouse` backend |
| Dropdown vacío | No muestra productos | Verificar `getProducts` backend devuelve datos |
| Stock no actualiza | Dice 75 después de agregar 10 | Revisar `reload stock` post-add en `handleAddMaterial` |
| Serial no filtra | Muestra todos en lugar de solo disponibles | Revisar lógica en `handleProductChange` línea ~242 |

---

## 🔍 Verificación de Código

Cambios aplicados en `/opt/emerald-erp/frontend/src/pages/WorkOrderExecutionPage.jsx`:

**Línea 110-121:** 6 nuevos states  
**Línea 166-216:** `loadInventoryData()` refactorizada  
**Línea 242-262:** `handleProductChange()`  
**Línea 264-278:** `getMaxQuantity()`  
**Línea 279-295:** `isAddMaterialValid()`  
**Línea 297-330:** `handleAddMaterial()` refactorizada  
**Línea 760-929:** Modal JSX rediseñada con dropdown + conditional rendering

---

## 📱 Browser Console Logging

Si abres DevTools (F12), deberías ver logs como:

```javascript
// Al abrir modal
✅ Inventario cargado para técnico Técnico 2: {
  warehouse: { id: 4, name: "Camioneta Técnico 2 - TC201", type: "MOBILE", user_id: 9 }
  productsCount: 3
  stockItems: 2
}

// Al cambiar producto
handleProductChange: Producto seleccionado: Cable UTP Cat6 305m
handleProductChange: BULK product - Seriales disponibles: 0

// Al agregar material
Agregando material: { product_id: 1, quantity: 10, serial_number: null }
Material agregado exitosamente
Reloading warehouse stock...
```

---

## ✅ Criterios de Éxito

✅ **TODOS** los puntos del PASO 3 al 5 funcionan sin errores  
✅ Console logs aparecen sin mensajes de error  
✅ Browser console (F12) no muestra excepciones en rojo  
✅ Materiales se agregan y stock se actualiza en tiempo real

---

## 📝 Notas

- El warehouse stock carga en **2-3 segundos máximo** (respeta cleanup de async)
- Los productos son fetched **una sola vez** en el useEffect
- Los seriales se filtran **por warehouse actual** para seguridad
- La cantidad se valida **contra el stock real**, no cantidad input arbitraria

---

**Próximos Pasos:**
1. ✅ Completar test
2. 🔄 Si hay errores, revisar console logs
3. 🔧 Aplicar fixes si es necesario
4. 📸 Capturar pantalla como comprobante
