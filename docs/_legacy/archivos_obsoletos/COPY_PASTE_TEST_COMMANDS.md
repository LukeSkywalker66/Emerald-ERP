# ⚡ Copy-Paste: Comandos para Ejecutar el Test

**Simplemente copia y pega los comandos que veas abajo**

---

## 🎯 Opción 1: Ejecutar desde Docker (RECOMENDADO)

```bash
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py
```

**Esto hace:**
- Ejecuta el test dentro del contenedor
- Usa red interna para conectar al backend
- No requiere dependencias en el host
- Output en tiempo real

**Resultado esperado:** Verde ✅ y duración ~30 segs

---

## 🎯 Opción 2: Ejecutar desde el Host (Si Docker No Quiere)

```bash
cd /opt/emerald-erp && \
pip3 install requests && \
python3 backend/scripts/test_inventory_smoke.py http://localhost:8500
```

**Esto hace:**
- Instala `requests` si no lo tiene
- Conecta al backend en puerto 8500
- Ejecuta el test

**Resultado esperado:** Verde ✅ y duración ~30 segs

---

## 🎯 Opción 3: Ejecutar con Script Wrapper

```bash
cd /opt/emerald-erp && \
chmod +x backend/scripts/run_inventory_test.sh && \
./backend/scripts/run_inventory_test.sh docker
```

**Esto hace:**
- Valida que Docker está disponible
- Valida que el contenedor existe
- Ejecuta el test
- Maneja errores automáticamente

**Resultado esperado:** Verde ✅ y duración ~30 segs

---

## 🆘 Si Algo Falla

### Problema: Backend no responde

```bash
# Reinicia el backend
docker compose restart backend

# Espera 10 segundos
sleep 10

# Reintentar
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py
```

### Problema: "Contenedor no existe"

```bash
# Asegurar que todo está corriendo
docker compose up -d

# Verificar
docker compose ps

# Reintentar test
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py
```

### Problema: Error de SKU duplicado (si repites el test)

```bash
# Opción A: Cambiar SKU en script (no recomendado)
# Edita backend/scripts/test_inventory_smoke.py línea ~200

# Opción B: Limpiar datos de la BD
docker exec emerald_db psql -U emerald_owner -d emerald_stock << 'EOF'
DELETE FROM stock_movements;
DELETE FROM serial_items;
DELETE FROM stock_bulk;
DELETE FROM products;
DELETE FROM warehouses;
EOF

# Reintentar
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py
```

---

## 📊 ¿Qué se Supone Que Debo Ver?

Al final, algo como esto:

```
======================================================================
→ ✅ SMOKE TEST COMPLETADO CON ÉXITO
======================================================================

Resumen de Recursos Creados:
  Warehouses: CENTRAL + MOBILE
  Productos: Cable UTP + ONU Huawei
  Serial Items: 3
```

**Si ves esto → ÉXITO ✅**

---

## 🔍 ¿Cómo Verifico que Funcionó?

```bash
# Ver warehouses creados
curl http://localhost:8500/api/inventory/warehouses | jq .

# Ver productos creados
curl http://localhost:8500/api/inventory/products | jq .

# Ver movimientos (auditoría)
curl http://localhost:8500/api/inventory/movements | jq .
```

---

## 📋 Secuencia Completa (Paso a Paso)

```bash
# 1. Ir a carpeta del proyecto
cd /opt/emerald-erp

# 2. Verificar que Docker está corriendo
docker compose ps

# 3. Ejecutar el test
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py

# 4. Ver resultado en pantalla (espera ~30 segs)
#    Debe terminar con "✅ SMOKE TEST COMPLETADO CON ÉXITO"

# 5. (Opcional) Verificar datos en BD
docker exec emerald_db psql -U emerald_owner -d emerald_stock \
  -c "SELECT id, name, type FROM warehouses;"

# 6. (Opcional) Ver en navegador
#    http://localhost:8500/api/inventory/warehouses
#    http://localhost:8500/api/inventory/products
#    http://localhost:8500/api/inventory/movements
```

---

## 📁 Dónde Están los Scripts

```
/opt/emerald-erp/
├── backend/scripts/
│   ├── test_inventory_smoke.py          ← Script principal
│   ├── run_inventory_test.sh            ← Wrapper (opcional)
│   ├── README_INVENTORY_SMOKE_TEST.md   ← Documentación completa
│   ├── QUICK_START_INVENTORY_TEST.md    ← Cheat sheet
│   └── RESUMEN_SCRIPTS_INVENTARIO.md    ← Este resumen

└── GUIA_EJECUTAR_INVENTORY_TEST.md      ← Guía general
```

---

## ✅ Checklist Pre-Test

```
□ Docker está instalado: docker --version
□ Backend está corriendo: docker compose ps | grep backend
□ Base de datos está sana: docker compose ps | grep db
□ Puerto 8500 accesible: curl http://localhost:8500/api/health
```

Si todo está ✅, ejecuta:
```bash
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py
```

---

## 🎓 Después del Test

### Si PASA ✅
```
Siguiente tarea: Implementar Frontend
├── Dashboard de inventario
├── Transfer wizard
└── Stock alerts

Ver: docs/checkpoints/2026-01-12-inventory-module.md
```

### Si FALLA ❌
```
Revisar logs:
docker logs emerald_backend --tail 50

Leer documentación:
cat backend/scripts/README_INVENTORY_SMOKE_TEST.md
```

---

## 🚀 TL;DR (Ultra Rápido)

```bash
cd /opt/emerald-erp && \
docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py
```

**Eso es todo. Todo lo demás es opcional.**

---

**Última actualización:** 2026-01-12  
**Versión:** 1.0  
**Status:** ✅ Listo
