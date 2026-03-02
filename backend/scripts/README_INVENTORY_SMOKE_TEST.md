# 🔬 Smoke Test - Módulo de Inventario

Script de validación ("prueba de humo") para la API del módulo de inventario operativo de Emerald ERP.

## 📋 ¿Qué es una Smoke Test?

Una **smoke test** es un conjunto de pruebas rápidas y básicas que verifican que el sistema funciona correctamente en escenarios típicos ("happy path"). No es una suite completa, sino una validación rápida de que:

1. ✅ Los endpoints responden correctamente
2. ✅ Los datos se crean y se relacionan apropiadamente  
3. ✅ Las operaciones críticas (transferencias) funcionan
4. ✅ La auditoría se registra correctamente

## 🎯 Qué Valida Este Script

El script ejecuta secuencialmente este flujo completo:

```
1. Crear Warehouse CENTRAL (almacén principal)
2. Crear Warehouse MOBILE (camioneta de técnico)
3. Crear Producto BULK (Cable UTP)
4. Crear Producto SERIALIZED (ONU Huawei)
5. Agregar Stock Inicial (3 ONUs + 200m de cable)
6. Transferencia de Stock (50m cable + 2 ONUs a camioneta)
7. Verificar Stock Final (validar que la camioneta tiene lo transferido)
8. Verificar Movimientos (auditoría completa)
```

## 🚀 Cómo Ejecutar

### Opción 1: Desde el Host (Desarrollo Local)

```bash
# Requisitos previos
cd /opt/emerald-erp
docker compose up -d  # Asegurar que los containers están corriendo

# Ejecutar test
python3 backend/scripts/test_inventory_smoke.py

# O especificar base URL diferente
python3 backend/scripts/test_inventory_smoke.py http://localhost:8500
```

**Ventajas:** Rápido, útil para desarrollo  
**Desventajas:** Requiere Python3 + requests en el host

### Opción 2: Desde Dentro del Contenedor (Recomendado)

```bash
# Método A: Usando el script wrapper
cd /opt/emerald-erp
./backend/scripts/run_inventory_test.sh docker

# Método B: Directamente con docker exec
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py

# Método C: Con URL personalizada
docker exec -it emerald_backend \
  python3 /app/scripts/test_inventory_smoke.py http://backend:8500
```

**Ventajas:** 
- Aislado, sin dependencias del host
- Usa las mismas dependencias que el backend
- Puede alcanzar servicios por nombre de contenedor

**Desventajas:** Requiere Docker

### Opción 3: Script Interactivo (Desarrollo)

```bash
cd /opt/emerald-erp

# Ejecutar con outputs formateados
chmod +x ./backend/scripts/run_inventory_test.sh
./backend/scripts/run_inventory_test.sh docker-dev

# O con modo local
./backend/scripts/run_inventory_test.sh local http://localhost:8000
```

## 📊 Ejemplo de Salida

```
======================================================================
→ 🔬 SMOKE TEST - MÓDULO DE INVENTARIO
======================================================================

Base URL: http://backend:8500

======================================================================
→ [PASO 1] Crear Warehouse CENTRAL
======================================================================

  POST http://backend:8500/api/inventory/warehouses
  Payload: {
  "name": "Depósito Central Buenos Aires",
  "type": "CENTRAL",
  "user_id": null
}

✅ Warehouse CENTRAL creado exitosamente (ID: 1)
    {
      "id": 1,
      "name": "Depósito Central Buenos Aires",
      "type": "CENTRAL"
    }

[PASO 2] Crear Warehouse MOBILE (para técnico)
...

[PASO 6] Transferencia de Stock (CENTRAL → MOBILE)
...
6.2 - Transferir 2 ONUs al warehouse móvil...

  POST http://backend:8500/api/inventory/transfer
  Payload: {
    "product_id": 4,
    "from_warehouse_id": 1,
    "to_warehouse_id": 2,
    "quantity": null,
    "serial_item_ids": [1, 2],
    "reference": "Carga camioneta Técnico García",
    "notes": "ONUs para instalaciones del 13 Enero"
  }

✅ ONUs transferidas exitosamente
    {
      "success": true,
      "movements_created": [5, 6]
    }

[PASO 7] Verificar Stock Final del Warehouse MOBILE
...

Stock en Warehouse MOBILE:
  Warehouse: Camioneta Técnico Juan García (Tipo: MOBILE)

  📦 Cable UTP Cat6 305m (CAB-UTP-CAT6-305)
     Cantidad: 50.0 metros
     ✅ Correcto (50m transferidos)

  🎫 ONU GPON Huawei HG8546M (ONU-HUAWEI-HG8546M)
     Cantidad: 2 unidades
     Seriales en warehouse:
       - HUAWEI-2025-001 (Status: NEW)
       - HUAWEI-2025-002 (Status: NEW)
     ✅ Correcto (2 ONUs transferidas)

✅ SMOKE TEST COMPLETADO CON ÉXITO

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

## ⚙️ Configuración

### URLs por Defecto

| Contexto | URL | Comando |
|----------|-----|---------|
| Host local | `http://localhost:8000` | `python3 scripts/test_inventory_smoke.py` |
| Host local (puerto 8500) | `http://localhost:8500` | `python3 scripts/test_inventory_smoke.py http://localhost:8500` |
| Dentro del contenedor | `http://backend:8500` | `docker exec emerald_backend python3 ...` |

### Dependencias

El script requiere:
- Python 3.7+
- `requests` library

**Instalación:**
```bash
pip3 install requests
```

O desde dentro del contenedor (ya incluido en requirements.txt):
```bash
docker exec emerald_backend pip install requests
```

## 🔍 Troubleshooting

### Error: "No se puede conectar a http://localhost:8000"

**Causa:** Backend no está corriendo  
**Solución:**
```bash
docker compose ps
docker compose up -d backend
```

### Error: "Contenedor 'emerald_backend' no está corriendo"

**Causa:** Docker no está disponible o contenedor no está activo  
**Solución:**
```bash
docker compose up -d
docker exec emerald_backend echo "OK"
```

### Error: "requests module not found"

**Causa:** Librería requests no instalada en el host  
**Solución:**
```bash
pip3 install requests
# O usar modo docker en su lugar
```

### Error: "Status 404 Not Found"

**Causa:** Backend aún no tiene los endpoints de inventario cargados  
**Solución:**
```bash
# Verificar que el router está registrado en main.py
docker logs emerald_backend | grep inventory

# Reiniciar backend
docker compose restart backend
sleep 5
./backend/scripts/run_inventory_test.sh docker
```

### Error: "warehouse_id must exist"

**Causa:** Usuario_id = 1 no existe en tabla users  
**Solución:**
```bash
# Verificar usuarios existentes
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "SELECT id, username FROM users LIMIT 5;"

# Actualizar script para usar user_id correcto
# O crear usuario fixture
```

## 📝 Interpretar Resultados

### ✅ Éxito

Todos los pasos completados sin errores rojos. Significa:

- ✅ API responde correctamente
- ✅ Validaciones funcionan
- ✅ Transferencias crean movimientos
- ✅ Auditoría se registra
- ✅ Relaciones entre tablas OK

**Próximo paso:** Implementar frontend

### ⚠️ Warnings

Hay warnings amarillos (⚠️) pero el test continúa. Significa:

- Posibles inconsistencias en datos (ej: fixtures no tienen stock inicial)
- No es crítico pero debe investigarse

**Próximo paso:** Revisar la causa del warning

### ❌ Errores

Hay errores rojos (❌) y el test se detiene. Significa:

- ❌ API tiene problemas
- ❌ Validaciones rechazando datos válidos
- ❌ Base de datos corrupta o migraciones incompletas

**Próximo paso:** Revisar logs del backend
```bash
docker logs emerald_backend --tail 50
```

## 🔗 Integración con CI/CD

Para usar en pipeline de CI/CD:

```yaml
# .github/workflows/inventory-smoke-test.yml
name: Inventory Smoke Test

on: [push]

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
      # ... más servicios
    steps:
      - uses: actions/checkout@v3
      - name: Run Smoke Test
        run: |
          docker compose -f docker-compose.test.yml up -d
          sleep 10
          ./backend/scripts/run_inventory_test.sh docker
```

## 📚 Archivos Relacionados

- [Módulo de Inventario - Documentación](../docs/MODULO_INVENTARIO.md)
- [Router de Inventario - Código](../src/routers/inventory.py)
- [Modelos de Inventario - Código](../src/models/inventory.py)
- [Schemas de Inventario - Código](../src/schemas/inventory.py)
- [Checkpoint 2026-01-12](../../docs/checkpoints/2026-01-12-inventory-module.md)

## 💡 Próximos Pasos Después del Smoke Test

Una vez que pase el smoke test:

1. **Frontend:** Implementar vistas de inventario
   - Dashboard de stock
   - Transfer wizard
   - Auditoría de movimientos

2. **Tests Unitarios:** Edge cases y validaciones
   - Stock insuficiente
   - Serialization errors
   - Warehouse no encontrado

3. **Integración:** Conectar con módulo de tickets
   - Serial items instalados → ticket.ticket_id
   - Auto-crear movimientos al instalar
   - Status INSTALLED al crear work order

---

**Generado:** 2026-01-12  
**Versión:** 1.0  
**Estado:** ✅ Pronto para testing
