# ⚡ Quick Start - Smoke Test de Inventario

## 🎯 En 30 Segundos

```bash
# Opción 1: Desde Docker (RECOMENDADO)
docker compose up -d
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py

# Opción 2: Desde el host
cd /opt/emerald-erp
python3 backend/scripts/test_inventory_smoke.py http://localhost:8500

# Opción 3: Con el script wrapper
./backend/scripts/run_inventory_test.sh docker
```

## ✅ Criterios de Éxito

Si ves esto al final, **TODO FUNCIONA**:

```
✅ SMOKE TEST COMPLETADO CON ÉXITO

Resumen de Recursos Creados:
  Warehouses: CENTRAL + MOBILE
  Productos: Cable UTP + ONU Huawei
  Serial Items: 3 ONUs
```

## 🐛 Si Algo Falla

### Error de Conexión
```bash
# Verificar que backend está corriendo
docker compose ps

# Reiniciar si es necesario
docker compose down && docker compose up -d
sleep 10
```

### Error de Inventario API
```bash
# Ver logs
docker logs emerald_backend --tail 100

# Verificar que migraciones se ejecutaron
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "\dt" | grep warehouse
```

### Error de Producto Duplicado (SKU)
```bash
# Es normal si ya corriste el test antes
# Solución: Cambiar SKU en el script o limpiar DB
docker exec -it emerald_backend python3 -c "
from src.database import SessionLocal
from src.models.inventory import Product
db = SessionLocal()
db.query(Product).delete()
db.commit()
print('✅ Productos eliminados')
"
```

## 📍 Ubicaciones de Archivos

```
/opt/emerald-erp/
├── backend/scripts/
│   ├── test_inventory_smoke.py          ← Script principal
│   ├── run_inventory_test.sh            ← Wrapper para ejecución
│   └── README_INVENTORY_SMOKE_TEST.md   ← Documentación completa
│
├── docs/
│   └── MODULO_INVENTARIO.md             ← Especificación técnica
│
└── docs/checkpoints/
    └── 2026-01-12-inventory-module.md   ← Checkpoint de sesión
```

## 🔗 URLs de Verificación (Después del Test)

Abre estas URLs en el navegador después de que el test pase:

```
http://localhost:8500/api/inventory/warehouses
http://localhost:8500/api/inventory/products
http://localhost:8500/api/inventory/movements?limit=20
```

O desde dentro del contenedor:
```bash
docker exec emerald_backend curl http://backend:8500/api/inventory/warehouses | jq .
```

## 📊 Lo Que el Test Valida

| Paso | Lo Que Hace | Por Qué Importa |
|------|------------|-----------------|
| 1-4 | Crear warehouses y productos | Estructura base del sistema |
| 5 | Agregar stock | Datos iniciales |
| 6 | Transferir stock | **CRÍTICO**: Valida lógica de negocio |
| 7 | Verificar stock | Confirma que transfer funcionó |
| 8 | Auditoría | Registros completos para compliance |

## 🚨 Casos que el Test NO Cubre (Todavía)

- ❌ Stock insuficiente (intentar transferir más de lo disponible)
- ❌ Serial items duplicados
- ❌ Warehouse inexistente
- ❌ Integración con tickets
- ❌ Performance bajo carga

→ Ver **Documento Completo** para contexto de estos casos

## 🎯 Próximos Pasos Después del Test

### Si Pasa ✅
1. Implementar frontend (inventory dashboard)
2. Crear transfer wizard en React
3. Integrar con módulo de tickets

### Si Falla ❌
1. Revisar logs: `docker logs emerald_backend`
2. Consultar doc de troubleshooting en README_INVENTORY_SMOKE_TEST.md
3. Verificar que migraciones están completas

---

**Última actualización:** 2026-01-12  
**Versión API:** v2.0 Inventory  
**Status:** ✅ Listo para testing
