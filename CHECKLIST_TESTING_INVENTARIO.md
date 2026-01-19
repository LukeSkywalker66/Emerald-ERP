# ✅ Checklist de Testing - Módulo Inventario

**Fecha:** 16 de Enero 2026  
**Estado:** Testing manual en navegador  
**Servidor:** http://localhost:5173  
**Credenciales:** tecnico2@emerald.com / password  

---

## 📋 DATOS DE PRUEBA

```
Usuario: tecnico2@emerald.com
Contraseña: password
Warehouse: 4 (Camioneta Técnico 2 - TC201)
Warehouse Central: 1 (Depósito Pellegrini)

Stock en Warehouse 4:
- Cable UTP Cat6 305m (BULK): 75 unidades
- Conectores Verdes (SERIALIZED): 20 unidades  
- ONU GPON Huawei (SERIALIZED): 3 seriales (ONU-2024-001, ONU-2024-002, ONU-2024-003)

Work Orders:
- ID: 37, Status: completed (último en lista)
- Buscar pendientes: WO con status "pending"
```

---

## 🧪 TESTING MANUAL (PASO A PASO)

### 1️⃣ **LOGIN Y NAVEGACIÓN**

- [ ] Abrir http://localhost:5173
- [ ] Login con tecnico2@emerald.com
- [ ] Verificar que carga correctamente
- [ ] Navegar a: **Inventario** (en menu lateral)
- [ ] Confirmar que ve 5 opciones: Catálogo, Transferencias, Ajustes, Movimientos, Almacenes

---

### 2️⃣ **PRODUCTCATALOG - LISTADO**

**Ruta:** Inventario → Catálogo de Productos

- [ ] Carga tabla con 3+ productos
- [ ] Columnas visibles: SKU, Nombre, Tipo (icono), Categoría, Alerta Mínima, Acciones
- [ ] Verificar filtros:
  - [ ] Búsqueda por nombre: "Cable" → Filtra correctamente
  - [ ] Búsqueda por SKU: "CAB" → Filtra correctamente
  - [ ] Filtro por Tipo: "BULK" → Muestra solo productos BULK
  - [ ] Filtro por Tipo: "SERIALIZED" → Muestra solo ONUs/Conectores
  - [ ] Filtro por Categoría: "Cableado" → Filtra por categoría

✅ **Resultado esperado:** Filtros funcionan en tiempo real

---

### 3️⃣ **PRODUCTCATALOG - CREAR PRODUCTO**

**Ruta:** Inventario → Catálogo → Botón "Nuevo Producto"

- [ ] Click en "Nuevo Producto" abre modal
- [ ] Modal contiene campos: Nombre, SKU, Tipo, Categoría, Descripción, Alerta Mínima
- [ ] Completar formulario:
  - [ ] Nombre: "Cable Fibra Óptica"
  - [ ] SKU: "CAB-FIBRA-001" (único)
  - [ ] Tipo: "BULK"
  - [ ] Categoría: "Cableado"
  - [ ] Descripción: "Cable de fibra óptica monomodo"
  - [ ] Alerta Mínima: "20"
- [ ] Click "Crear"
- [ ] Verificar:
  - [ ] Modal se cierra
  - [ ] Tabla actualiza y muestra nuevo producto
  - [ ] Mensaje de éxito (toast si existe)

✅ **Resultado esperado:** Producto creado y visible en lista

---

### 4️⃣ **PRODUCTCATALOG - EDITAR PRODUCTO**

**Ruta:** Inventario → Catálogo → Botón editar (lápiz)

- [ ] Click en icono editar en producto "Cable Fibra Óptica"
- [ ] Modal se abre con datos pre-cargados
- [ ] Campos habilitados: Nombre, Categoría, Descripción, Alerta Mínima
- [ ] Campo BLOQUEADO: SKU y Tipo (no editable)
- [ ] Cambiar valores:
  - [ ] Alerta Mínima: "20" → "50"
  - [ ] Descripción: Agregar " - 1km"
- [ ] Click "Guardar"
- [ ] Verificar:
  - [ ] Modal se cierra
  - [ ] Producto en tabla muestra valores actualizados
  - [ ] Alerta Mínima ahora es "50"

✅ **Resultado esperado:** Cambios guardados correctamente

---

### 5️⃣ **PRODUCTCATALOG - ELIMINAR PRODUCTO**

**Ruta:** Inventario → Catálogo → Botón eliminar (tacho)

- [ ] Click en icono eliminar en un producto sin stock
- [ ] Modal de confirmación aparece
- [ ] Mensaje: "¿Estás seguro que deseas eliminar este producto?"
- [ ] Click "Eliminar"
- [ ] Verificar:
  - [ ] Modal se cierra
  - [ ] Producto desaparece de la tabla
  - [ ] Mensaje de éxito (si existe)

**Caso negativo:**
- [ ] Intentar eliminar "Cable UTP Cat6 305m" (tiene stock)
- [ ] Backend retorna error 409 Conflict
- [ ] Frontend muestra mensaje: "No se puede eliminar: El producto tiene stock en algún almacén"

✅ **Resultado esperado:** Validación de conflictos funcionando

---

### 6️⃣ **STOCK ADJUSTMENTS - COMPRA BULK**

**Ruta:** Inventario → Ajustes de Stock

- [ ] Formulario visible con campos:
  - [ ] Producto (dropdown)
  - [ ] Almacén (dropdown)
  - [ ] Cantidad
  - [ ] Tipo de Movimiento (PURCHASE/ADJUSTMENT)
  - [ ] Referencia (opcional)
  - [ ] Notas (opcional)

**Compra de Cable (BULK):**
- [ ] Seleccionar Producto: "Cable UTP Cat6 305m" (BULK)
- [ ] Verificar que campo es: "Cantidad" (input numérico)
- [ ] Seleccionar Almacén: "4 - Camioneta Técnico 2"
- [ ] Cantidad: "10"
- [ ] Tipo: "PURCHASE"
- [ ] Referencia: "COMPRA_ENERO_2026"
- [ ] Click "Registrar Compra"
- [ ] Verificar:
  - [ ] Mensaje de éxito con ID del movimiento
  - [ ] Formulario se limpia
  - [ ] Tabla de movimientos actualiza (nuevo registro arriba)
  - [ ] Movimiento muestra: Producto, Cantidad (10), Tipo (🛒 Compra)

✅ **Resultado esperado:** Compra BULK registrada exitosamente

---

### 7️⃣ **STOCK ADJUSTMENTS - COMPRA SERIALIZED**

**Ruta:** Inventario → Ajustes de Stock

**Compra de ONUs (SERIALIZED):**
- [ ] Seleccionar Producto: "ONU GPON Huawei HG8546M" (SERIALIZED)
- [ ] Verificar que ahora el campo es: "Números de Serie" (textarea)
- [ ] Verificar que Tipo cambia automáticamente a "PURCHASE"
- [ ] Seleccionar Almacén: "4 - Camioneta Técnico 2"
- [ ] Números de Serie: Ingresar uno por línea:
  ```
  ONU-2024-004
  ONU-2024-005
  ONU-2024-006
  ```
- [ ] Referencia: "COMPRA_ONUs_ENERO_2026"
- [ ] Click "Registrar Compra"
- [ ] Verificar:
  - [ ] Mensaje de éxito (3 seriales creados)
  - [ ] Tabla muestra 3 nuevos movimientos
  - [ ] Cada fila muestra: Producto, Serial (ONU-2024-004, etc.), Tipo (🛒 Compra)

✅ **Resultado esperado:** 3 ONUs con seriales creados exitosamente

---

### 8️⃣ **STOCK TRANSFER WIZARD - TRANSFERENCIA BULK**

**Ruta:** Inventario → Transferencias de Stock

**Wizard Paso 1: Selección**
- [ ] Dropdown Producto: Seleccionar "Cable UTP Cat6 305m" (BULK)
- [ ] Warehouse Origen: "4 - Camioneta Técnico 2"
- [ ] Warehouse Destino: "1 - Depósito Pellegrini"
- [ ] Verificar que Stock Disponible muestre: "75 unidades"
- [ ] Click "Siguiente"

**Wizard Paso 2: Cantidad (BULK)**
- [ ] Verificar que campo es: "Cantidad a Transferir"
- [ ] Ingresar: "20"
- [ ] Verificar máximo permitido ≤ 75
- [ ] Click "Siguiente"

**Wizard Paso 3: Detalles**
- [ ] Referencia: "TRANSF_CENTRAL"
- [ ] Notas: "Reposición de central"
- [ ] Click "Siguiente"

**Wizard Paso 4: Confirmación**
- [ ] Resumen visible:
  - [ ] Producto: Cable UTP Cat6 305m
  - [ ] Cantidad: 20 unidades
  - [ ] Origen: Camioneta Técnico 2 (4)
  - [ ] Destino: Depósito Pellegrini (1)
- [ ] Click "Confirmar Transferencia"

**Wizard Paso 5: Resultado**
- [ ] Mensaje: "✅ Transferencia exitosa"
- [ ] ID del movimiento visible
- [ ] Opciones: "Nueva Transferencia" / "Ir al Dashboard"

✅ **Resultado esperado:** Cable transferido correctamente

---

### 9️⃣ **STOCK TRANSFER WIZARD - TRANSFERENCIA SERIALIZED**

**Ruta:** Inventario → Transferencias de Stock

**Wizard Paso 1: Selección**
- [ ] Dropdown Producto: Seleccionar "ONU GPON Huawei HG8546M" (SERIALIZED)
- [ ] Warehouse Origen: "4 - Camioneta Técnico 2"
- [ ] Warehouse Destino: "1 - Depósito Pellegrini"
- [ ] Click "Siguiente"

**Wizard Paso 2: Seriales (SERIALIZED)**
- [ ] Verificar que muestra lista de seriales disponibles:
  - [ ] ONU-2024-001 ✓
  - [ ] ONU-2024-002 ✓
  - [ ] ONU-2024-003 ✓
- [ ] Seleccionar: ONU-2024-002 (checkbox)
- [ ] Click "Siguiente"

**Wizard Paso 3: Detalles**
- [ ] Referencia: "TRANSF_ONU_CENTRAL"
- [ ] Notas: "Reposición de ONUs defectuosas"
- [ ] Click "Siguiente"

**Wizard Paso 4: Confirmación**
- [ ] Resumen:
  - [ ] Producto: ONU GPON Huawei HG8546M
  - [ ] Serial: ONU-2024-002
  - [ ] Origen: Camioneta Técnico 2 (4)
  - [ ] Destino: Depósito Pellegrini (1)
- [ ] Click "Confirmar Transferencia"

**Wizard Paso 5: Resultado**
- [ ] ✅ Transferencia exitosa

✅ **Resultado esperado:** Serial transferido correctamente

---

### 🔟 **WORK ORDERS - MATERIAL PERSISTENCE**

**Ruta:** Work Orders → [Buscar OT en estado pending]

**Ejecución de OT - Agregar Material:**
- [ ] Click en OT pendiente
- [ ] Ir a Paso 2 (Ejecución)
- [ ] Buscar sección "Materiales Utilizados"
- [ ] Click "Agregar Material"
- [ ] Modal/Form aparece con:
  - [ ] Dropdown Producto
  - [ ] Cantidad (input)
  - [ ] Botón "Agregar"
- [ ] Seleccionar: "Cable UTP Cat6 305m"
- [ ] Cantidad: "2"
- [ ] Click "Agregar"
- [ ] Verificar:
  - [ ] Material aparece en tabla de materiales
  - [ ] Stock se actualiza (cantidad restada)
  - [ ] No aparece error

**Eliminar Material:**
- [ ] Click icono eliminar (tacho) en el material agregado
- [ ] Verificar:
  - [ ] Material desaparece de tabla
  - [ ] Stock se restaura

✅ **Resultado esperado:** Materiales persistentes y stock actualizado

---

### 1️⃣1️⃣ **WORK ORDERS - CIERRE CON WIZARD**

**Ruta:** Work Orders → [OT en progreso] → Botón "Cerrar OT"

**Wizard Paso 1: Resultado**
- [ ] Seleccionar resultado: "Resuelto" / "No Resuelto"
- [ ] Si aplica, notas sobre resultado
- [ ] Click "Siguiente"

**Wizard Paso 2: Materiales (NUEVO)**
- [ ] Verificar sección "Materiales Adicionales"
- [ ] Click "Agregar Material"
- [ ] Agregar 1-2 materiales más
- [ ] Verificar que persisten
- [ ] Click "Siguiente"

**Paso 3: Fotos/Pruebas**
- [ ] Adjuntar fotos si es posible
- [ ] Click "Siguiente"

**Paso 4: Confirmación**
- [ ] Resumen completo visible
- [ ] Click "Confirmar y Cerrar"

**Resultado:**
- [ ] ✅ OT cerrada exitosamente
- [ ] Status cambia a "completed"
- [ ] Materiales registrados permanecen

✅ **Resultado esperado:** OT cerrada con materiales persistentes

---

### 1️⃣2️⃣ **MOVIMIENTOS HISTORY - FILTROS**

**Ruta:** Inventario → Historial de Movimientos

- [ ] Tabla muestra últimos movimientos
- [ ] Campos visibles: Fecha, Tipo, Producto, Almacén, Cantidad/Serial, Usuario
- [ ] Filtros funcionales:
  - [ ] Por Producto: Seleccionar "Cable UTP" → Filtra
  - [ ] Por Almacén: Seleccionar "Camioneta Técnico 2" → Filtra
  - [ ] Por Tipo: "TRANSFER" → Muestra solo transferencias
  - [ ] Rango de fechas (si existe)
- [ ] Paginación:
  - [ ] Botones Anterior/Siguiente funcionan
  - [ ] Total de registros visible

✅ **Resultado esperado:** Historial filtrable y paginado

---

### 1️⃣3️⃣ **WAREHOUSE DETAIL**

**Ruta:** Inventario → Almacenes → [Seleccionar Warehouse 4]

- [ ] Nombre: "Camioneta Técnico 2 - TC201"
- [ ] Tipo: "MOBILE"
- [ ] Responsable: "Técnico 2"
- [ ] Tabla de stock:
  - [ ] Producto: Cable UTP Cat6 305m
  - [ ] Cantidad: Muestra valor actual (después de transferencias)
  - [ ] Productos SERIALIZED: Muestra seriales con estado "NEW" / "IN_USE"
- [ ] Acciones disponibles:
  - [ ] Ver detalles
  - [ ] Transferir stock
  - [ ] Ajustar stock

✅ **Resultado esperado:** Vista completa del almacén

---

## 📊 RESUMEN DE TESTING

### ✅ Funcionalidades Validadas

- [ ] ProductCatalog: CRUD (Create, Read, Update, Delete)
- [ ] Filtros: Búsqueda, Tipo, Categoría
- [ ] Stock Adjustments: BULK y SERIALIZED
- [ ] Transferencias: BULK y SERIALIZED
- [ ] Material Persistence en Work Orders
- [ ] Historial de Movimientos
- [ ] Vistas de Almacenes

### ⚠️ Issues Encontrados

(Completar durante testing)

```
1. [Descripción del issue]
   - Pasos para reproducir
   - Resultado esperado vs actual
   - Severidad: CRITICAL / HIGH / MEDIUM / LOW
```

### 🔧 Notas Técnicas

(Completar durante testing)

```
- [Observación técnica 1]
- [Observación técnica 2]
```

---

## 📝 FIRMA DE VALIDACIÓN

**Testeado por:** ___________________________  
**Fecha:** ________________  
**Estado Final:** ☐ Listo para Producción | ☐ Correcciones Pendientes | ☐ Crítico

**Comentarios:**
```
[Espacio para comentarios finales]
```

---

**Generado:** 16-ENE-2026  
**Próxima Fase:** Optimizaciones de UX (Toast System, Keyboard Shortcuts, etc.)
