# 📦 Resumen - Scripts de Smoke Test para Inventario

**Fecha:** 2026-01-12  
**Módulo:** Inventario Operativo  
**Estado:** ✅ Generados y listos para usar  
**Ubicación:** `/opt/emerald-erp/backend/scripts/`

---

## 📋 Archivos Generados

### 1. `test_inventory_smoke.py` (25 KB)
**Descripción:** Script principal de prueba

**Características:**
- 🧪 8 pasos de validación secuencial
- 📊 Output formateado con colores
- 🔍 Validaciones de estructura y datos
- 💾 Almacena IDs para reutilizar en pasos posteriores
- 📝 Resumen final con recursos creados
- ⚡ Aprox. 30 segundos de ejecución

**Uso Directo:**
```bash
python3 backend/scripts/test_inventory_smoke.py
python3 backend/scripts/test_inventory_smoke.py http://localhost:8500
python3 backend/scripts/test_inventory_smoke.py http://backend:8500
```

**Uso en Docker:**
```bash
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py http://backend:8500
```

---

### 2. `run_inventory_test.sh` (5.6 KB)
**Descripción:** Script wrapper para ejecución flexible

**Características:**
- 🎛️ 3 modos de ejecución: `local`, `docker`, `docker-dev`
- 📍 Validaciones automáticas de prereq
- 💬 Help system integrado
- 🎨 Outputs coloreados
- ✅ Manejo de errores con mensajes claros

**Uso:**
```bash
# Modo automático (docker si está disponible, sino local)
./backend/scripts/run_inventory_test.sh

# Modos específicos
./backend/scripts/run_inventory_test.sh local
./backend/scripts/run_inventory_test.sh docker
./backend/scripts/run_inventory_test.sh docker-dev

# Con base URL personalizada
./backend/scripts/run_inventory_test.sh docker http://backend:8500

# Ver ayuda
./backend/scripts/run_inventory_test.sh help
```

---

### 3. `README_INVENTORY_SMOKE_TEST.md` (9.2 KB)
**Descripción:** Documentación completa y guía de troubleshooting

**Secciones:**
- 📌 Qué es una smoke test
- 🎯 Qué valida este script
- 🚀 Instrucciones de ejecución (3 formas)
- 📊 Ejemplo de salida completa
- ⚙️ Configuración
- 🔍 Troubleshooting (6 casos comunes)
- 📝 Cómo interpretar resultados
- 🔗 Integración con CI/CD
- 📚 Enlaces a archivos relacionados

**Lectura:** 10 minutos

---

### 4. `QUICK_START_INVENTORY_TEST.md` (2.8 KB)
**Descripción:** Guía rápida (30 segundos)

**Contenido:**
- ⚡ 3 formas de ejecutar el test
- ✅ Criterio de éxito
- 🐛 Troubleshooting básico (3 casos)
- 📍 Ubicaciones de archivos
- 🔗 URLs de verificación
- 🎯 Próximos pasos

**Lectura:** 2 minutos

---

## 🎯 Los 8 Pasos del Test

```
PASO 1: Crear Warehouse CENTRAL
        └→ POST /api/inventory/warehouses
        └→ Status: 201 Created
        └→ Almacena: warehouse_central_id

PASO 2: Crear Warehouse MOBILE (técnico)
        └→ POST /api/inventory/warehouses (con user_id=1)
        └→ Status: 201 Created
        └→ Almacena: warehouse_mobile_id

PASO 3: Crear Producto BULK (Cable UTP)
        └→ POST /api/inventory/products
        └→ Status: 201 Created
        └→ Almacena: product_bulk_id

PASO 4: Crear Producto SERIALIZED (ONU Huawei)
        └→ POST /api/inventory/products
        └→ Status: 201 Created
        └→ Almacena: product_serialized_id

PASO 5: Agregar Stock Inicial
        └→ Crear 3 ONUs: POST /api/inventory/serial-items
        └→ Status: 201 Created
        └→ Cada serial se registra con warehouse_central_id
        └→ Almacena: serial_item_ids = [id1, id2, id3]

PASO 6: Transferencia de Stock (CRÍTICO)
        └→ Transfer 6a: 50m de Cable UTP (BULK)
           POST /api/inventory/transfer
           └→ from_warehouse_id: central
           └→ to_warehouse_id: mobile
           └→ quantity: 50.0
        
        └→ Transfer 6b: 2 ONUs (SERIALIZED)
           POST /api/inventory/transfer
           └→ from_warehouse_id: central
           └→ to_warehouse_id: mobile
           └→ serial_item_ids: [id1, id2]

PASO 7: Verificar Stock Final
        └→ GET /api/inventory/warehouses/{mobile_id}/stock
        └→ Valida que: 50m de cable + 2 ONUs estén en mobile

PASO 8: Verificar Movimientos (Auditoría)
        └→ GET /api/inventory/movements?limit=10
        └→ Debe haber 5+ movimientos registrados
```

---

## ⚙️ Configuración y Dependencias

### Requisitos por Modo

#### Modo Local (Host)
```
✅ Python 3.7+
✅ pip / pip3
✅ requests library (pip install requests)
✅ Backend corriendo en http://localhost:8000 o :8500
```

#### Modo Docker
```
✅ Docker instalado
✅ Container 'emerald_backend' corriendo
✅ Backend respondiendo en http://backend:8500
```

#### Modo Docker-Dev
```
✅ Igual que modo Docker
✅ PYTHONUNBUFFERED=1 (para output en tiempo real)
```

### URLs por Defecto

| Contexto | URL | Usado en |
|----------|-----|----------|
| Host local | `http://localhost:8000` | Script directo |
| Host local alt | `http://localhost:8500` | Argumento |
| Contenedor Docker | `http://backend:8500` | Docker exec |

---

## 🚀 Inicio Rápido

### Para Usuario Impaciante (30 segs)

```bash
cd /opt/emerald-erp

# Asegurar que todo esté corriendo
docker compose up -d

# Ejecutar test
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py

# Si todo está verde ✅, LISTO
# Si hay rojo ❌, ver TROUBLESHOOTING abajo
```

### Troubleshooting Express

| Error | Solución |
|-------|----------|
| No se conecta | `docker compose restart backend && sleep 10` |
| Contenedor no existe | `docker compose up -d backend` |
| SKU duplicado | Script ya corrió antes; limpiar o cambiar SKU |
| API 404 | Backend aún cargando; esperar 10 seg y reintentar |

---

## 📊 Interpretación de Resultados

### ✅ TODO BIEN
```
✅ SMOKE TEST COMPLETADO CON ÉXITO

Resumen de Recursos Creados:
  Warehouses: CENTRAL + MOBILE
  Productos: Cable UTP + ONU Huawei
  Serial Items: 3 ONUs
```
→ **Acción:** Pasar a desarrollo de frontend

### ⚠️ WARNINGS (Amarillo)
```
⚠️ Esperado 50m, encontrado null
```
→ **Acción:** Revisar fixtures o dato inicial

### ❌ ERRORES (Rojo)
```
❌ Status 409 Conflict
   Producto con SKU 'CAB-UTP-CAT6-305' ya existe
```
→ **Acción:** Ver logs, revisar validaciones del API

---

## 🔗 Archivos Relacionados

```
/opt/emerald-erp/
├── backend/scripts/
│   ├── test_inventory_smoke.py
│   ├── run_inventory_test.sh
│   ├── README_INVENTORY_SMOKE_TEST.md       ← Lee esto primero para entender
│   ├── QUICK_START_INVENTORY_TEST.md        ← Después esto
│   └── RESUMEN_SCRIPTS_INVENTARIO.md        ← Este archivo
│
├── docs/
│   ├── MODULO_INVENTARIO.md                 ← Especificación técnica completa
│   └── checkpoints/2026-01-12-inventory-module.md
│
└── backend/src/
    ├── routers/inventory.py                 ← Implementación API
    ├── models/inventory.py                  ← Modelos ORM
    └── schemas/inventory.py                 ← Validaciones Pydantic
```

---

## 📌 Notas Importantes

### Datos de Prueba

El script crea datos nuevos cada vez que corre:

```python
warehouse_central = "Depósito Central Buenos Aires"
warehouse_mobile = "Camioneta Técnico Juan García"
cable = "Cable UTP Cat6 305m" (SKU: CAB-UTP-CAT6-305)
onus = "ONU GPON Huawei HG8546M" (SKU: ONU-HUAWEI-HG8546M)
```

**Si repites el test 2 veces:** Obtendrás error de SKU duplicado

**Soluciones:**
- Cambiar SKU en el script
- Limpiar DB: `DELETE FROM products WHERE sku LIKE 'CAB-UTP%'`
- Usar fixture que resetea DB antes del test

### User ID

El script asume que existe un usuario con ID=1. Si no:

```bash
# Verificar
docker exec emerald_db psql -U emerald_owner -d emerald_stock \
  -c "SELECT id, username FROM users LIMIT 5;"

# Actualizar script si es necesario
# En test_inventory_smoke.py, línea ~180:
# payload["user_id"] = 1  ← Cambiar aquí
```

### Performance

- **Primera ejecución:** ~30 seg (incluye creación de datos)
- **Transferencias:** <1 sec cada una
- **Auditoría:** <500ms

Si tarda >60 seg, revisar logs del backend:
```bash
docker logs emerald_backend --tail 50
```

---

## 🎓 Próximos Pasos Después del Test

### Si PASA ✅
1. **Frontend**
   - Crear vistas de inventario en React
   - Transfer wizard (form)
   - Dashboard de stock bajo

2. **Integración**
   - Conectar con módulo de tickets
   - Auto-crear movimientos en instalación

3. **Tests**
   - Unit tests para validaciones
   - Integration tests con tickets
   - Performance tests bajo carga

### Si FALLA ❌
1. Revisar logs completos
2. Aumentar SQLALCHEMY_ECHO=1 para ver queries
3. Validar migraciones ejecutadas
4. Contactar al equipo técnico

---

## 📞 Soporte

### Para Errores de Ejecución

```bash
# Ver logs detallados
docker logs emerald_backend --tail 100

# Ejecutar con debug
export SQLALCHEMY_ECHO=1
docker compose restart backend
# Luego ejecutar test
```

### Para Errores de API

```bash
# Verificar que endpoint existe
curl -v http://localhost:8500/api/inventory/warehouses

# Ver documentación de API
# → Ver docs/MODULO_INVENTARIO.md
```

### Para Errores de Datos

```bash
# Inspeccionar datos creados
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c \
  "SELECT * FROM warehouses;"
```

---

**Generado:** 2026-01-12  
**Versión:** 1.0 (Scripts Completos)  
**Estado:** ✅ Listo para Producción/Testing  
**Tiempo Estimado:** 30 segundos a 2 minutos
