# 🔬 Guía Ejecutiva - Smoke Test Módulo Inventario

## 📊 Estado Actual

- ✅ Backend: Corriendo en puerto 8500
- ✅ Base de Datos: PostgreSQL 15, healthy
- ✅ API Inventario: Endpoints implementados
- ✅ Scripts: Generados y listos

## 🚀 Cómo Ejecutar (Elige UNA opción)

### Opción A: Desde el Host (Más Rápido)

```bash
cd /opt/emerald-erp

# Instalar dependencia (si no está)
pip3 install requests

# Ejecutar
python3 backend/scripts/test_inventory_smoke.py http://localhost:8500
```

**Resultado esperado:** ~30 segundos, output coloreado

---

### Opción B: Desde el Contenedor (RECOMENDADO)

```bash
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py
```

**Ventaja:** Aislado, usa red interna `http://backend:8500`

---

### Opción C: Con Script Wrapper

```bash
cd /opt/emerald-erp
chmod +x backend/scripts/run_inventory_test.sh

# Ejecutar
./backend/scripts/run_inventory_test.sh docker
```

**Ventaja:** Valida prereqs automáticamente

---

## 📋 Lo Que el Test Hace

```
Step 1: Crear Warehouse CENTRAL          ✓
Step 2: Crear Warehouse MOBILE           ✓
Step 3: Crear Producto BULK (Cable)      ✓
Step 4: Crear Producto SERIALIZED (ONU)  ✓
Step 5: Agregar Stock (3 ONUs + 200m)    ✓
Step 6: Transferencia (CRÍTICO)          ✓
Step 7: Verificar Stock Final            ✓
Step 8: Verificar Auditoría              ✓
```

**Duración:** ~30 segundos  
**Validaciones:** 8 endpoints API  
**Datos creados:** 2 warehouses, 2 productos, 3 seriales, 5+ movimientos

---

## ✅ Criterio de Éxito

Busca esto al final del output:

```
======================================================================
→ ✅ SMOKE TEST COMPLETADO CON ÉXITO
======================================================================

Resumen de Recursos Creados:
  Warehouses: CENTRAL + MOBILE
  Productos: Cable UTP + ONU Huawei
  Serial Items: 3
```

Si ves esto con colores verdes → **TODO FUNCIONA** ✅

---

## 🔍 Si Algo Falla

### Problema 1: "No se puede conectar"
```bash
# Backend no responde
# Solución:
docker compose restart backend
sleep 5
# Reintentar
```

### Problema 2: "Status 409 Conflict"
```
❌ Producto con SKU 'CAB-UTP-CAT6-305' ya existe
```
**Causa:** Ya corriste el test antes  
**Solución:** Cambiar SKU en script o limpiar datos

### Problema 3: "Status 404 Not Found"
```
❌ Endpoint /api/inventory/warehouses no encontrado
```
**Causa:** API aún no cargada  
**Solución:** Esperar 10 seg y reintentar, revisar logs

```bash
docker logs emerald_backend | grep inventory
```

---

## 📊 Ejemplo de Salida Completa

```
======================================================================
→ 🔬 SMOKE TEST - MÓDULO DE INVENTARIO
======================================================================

Base URL: http://localhost:8500

======================================================================
→ [PASO 1] Crear Warehouse CENTRAL
======================================================================

  POST http://localhost:8500/api/inventory/warehouses

✅ Warehouse CENTRAL creado exitosamente (ID: 1)
    {
      "id": 1,
      "name": "Depósito Central Buenos Aires",
      "type": "CENTRAL"
    }

[PASO 2] Crear Warehouse MOBILE (para técnico)
  POST http://localhost:8500/api/inventory/warehouses

✅ Warehouse MOBILE creado exitosamente (ID: 2)

[PASO 3] Crear Producto BULK (Cable UTP)
✅ Producto BULK creado exitosamente (ID: 3)

[PASO 4] Crear Producto SERIALIZED (ONU Huawei)
✅ Producto SERIALIZED creado exitosamente (ID: 4)

[PASO 5] Agregar Stock Inicial
✅ Serial HUAWEI-2025-001 creado (ID: 1)
✅ Serial HUAWEI-2025-002 creado (ID: 2)
✅ Serial HUAWEI-2025-003 creado (ID: 3)
✅ Stock inicial completo: 3 ONUs + 200m de Cable

[PASO 6] Transferencia de Stock (CENTRAL → MOBILE)
✅ Cable transferido exitosamente
✅ ONUs transferidas exitosamente

[PASO 7] Verificar Stock Final del Warehouse MOBILE
Stock en Warehouse MOBILE:
  Warehouse: Camioneta Técnico Juan García (Tipo: MOBILE)

  📦 Cable UTP Cat6 305m (CAB-UTP-CAT6-305)
     Cantidad: 50.0 metros
     ✅ Correcto (50m transferidos)

  🎫 ONU GPON Huawei HG8546M (ONU-HUAWEI-HG8546M)
     Cantidad: 2 unidades
     ✅ Correcto (2 ONUs transferidas)

✅ Verificación de stock final EXITOSA

[PASO 8] Verificar Movimientos Registrados
Últimos movimientos registrados:
  [PURCHASE] ONU GPON Huawei HG8546M
  [PURCHASE] ONU GPON Huawei HG8546M
  [PURCHASE] ONU GPON Huawei HG8546M
  [TRANSFER] Cable UTP Cat6 305m
  [TRANSFER] ONU GPON Huawei HG8546M

✅ Auditoría: 5 movimientos registrados

======================================================================
→ ✅ SMOKE TEST COMPLETADO CON ÉXITO
======================================================================

Resumen de Recursos Creados:

  Warehouses:
    • CENTRAL (ID: 1)
    • MOBILE (ID: 2)

  Productos:
    • BULK: Cable UTP (ID: 3)
    • SERIALIZED: ONU Huawei (ID: 4)

  Serial Items Creados: 3
    • Serial #1 (ID: 1)
    • Serial #2 (ID: 2)
    • Serial #3 (ID: 3)

Próximos Pasos Recomendados:

  ✅ Verificar en browser: /api/inventory/warehouses/2/stock
  ✅ Verificar en browser: /api/inventory/movements
  ✅ Crear test unitarios para edge cases
  ✅ Implementar frontend (inventario views + transfer wizard)
```

---

## 🔗 Verificación Manual (Opcional)

Después de que el test pase, verifica los datos en la API:

```bash
# Listar warehouses
curl http://localhost:8500/api/inventory/warehouses | jq .

# Ver stock de warehouse mobile (ID 2)
curl http://localhost:8500/api/inventory/warehouses/2/stock | jq .

# Ver movimientos
curl http://localhost:8500/api/inventory/movements | jq .
```

---

## 📚 Documentación Completa

Para más detalles, lee estos archivos (en orden):

1. **QUICK_START_INVENTORY_TEST.md** (2 min)
   - Comandos rápidos
   - Troubleshooting básico

2. **README_INVENTORY_SMOKE_TEST.md** (10 min)
   - Cómo funciona el test
   - Todos los casos de error
   - Integración CI/CD

3. **RESUMEN_SCRIPTS_INVENTARIO.md** (5 min)
   - Descripción de archivos
   - Configuración avanzada
   - Próximos pasos

---

## 🎯 Próximo Paso (Después de ✅)

Una vez que el test pase:

```
Pasar al desarrollo de FRONTEND
├── Dashboard de inventario
├── Wizard de transferencias
└── Alertas de stock bajo
```

Ver checkpoint: `docs/checkpoints/2026-01-12-inventory-module.md`

---

## 📞 Errores No Listados?

Revisa la documentación completa:
```bash
cat backend/scripts/README_INVENTORY_SMOKE_TEST.md
```

O inspecciona logs directamente:
```bash
docker logs emerald_backend --tail 100
```

---

**Estado:** ✅ LISTO PARA TESTING  
**Creado:** 2026-01-12  
**Versión:** 1.0
