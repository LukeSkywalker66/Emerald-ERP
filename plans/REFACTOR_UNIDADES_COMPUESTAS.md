# Refactor: Stock en Unidades Compuestas

## Problema detectado

Actualmente `StockBulk.quantity` almacena cantidades en la **unidad base** (metros para drop, unidades para conectores). Esto fuerza al depósito a pensar en metros cuando debería pensar en **bobinas**.

## Principio arquitectónico

> **TODO el stock en depósitos se mueve por UNIDADES (bobinas, blisters, cajas).**
> Solo en el depósito móvil (camioneta del técnico) se fracciona según la definición del producto compuesto.

### Ejemplo concreto

| Concepto | Actual (mal) | Corregido (bien) |
|----------|-------------|-------------------|
| Compra 10 bobinas drop | StockBulk += 3000m | StockBulk += 10 bobinas |
| Depósito central muestra | "3000m de drop" | "10 bobinas de drop" |
| Transferencia a móvil | Transfiere 300m | Transfiere 1 bobina |
| Móvil muestra | "300m disponibles" | "1 bobina (300m disponibles)" |
| Técnico consume 50m | StockBulk -= 50m | StockBulk móvil = "0.83 bobinas (250m restantes)" |
| Alerta de stock mínimo | Alerta si metros < umbral | Alerta si bobinas < umbral |

## Cambios necesarios

### 1. Modelo `StockBulk`
- **NO cambiar** la tabla `stock_bulk` — `quantity` siempre almacena en **unidades compuestas** (bobinas, blisters)
- El `unit_size` del producto determina la conversión solo para el **depósito móvil**
- Migración: recalcular `quantity` dividiendo por `unit_size` para productos compuestos existentes

### 2. Endpoints a modificar

#### Compras y Ajustes (`POST /adjustments`)
- Actual: `quantity` se almacena tal cual
- Corregido: `quantity` = cantidad de **unidades compuestas** (bobinas)
- Frontend: el formulario de compra debe mostrar y enviar en unidades compuestas
- No multiplicar por `unit_size` — el backend almacena tal cual

#### Transferencias (`POST /transfer`)
- Actual: transfiere en base units
- Corregido: transfiere en unidades compuestas

#### Stock en depósito (`GET /warehouses/{id}/stock`)
- Actual: muestra en base units
- Corregido: 
  - **CENTRAL y VIRTUAL**: muestra en unidades compuestas (bobinas)
  - **MOBILE**: muestra en unidades compuestas + desglose (ej: "1 bobina / 300m")

#### Alertas de stock (`GET /stock/alerts`)
- Actual: compara meters contra min_stock_alert
- Corregido: compara **unidades compuestas** contra min_stock_alert

#### WorkOrderItem (consumo en OT)
- Actual: `quantity` en base units (metros)
- Corregido: `quantity` en unidades compuestas con `fraction` opcional
  - Nuevo campo: `fraction_consumed` (float, nullable) — ej: 50m si unit_size=300
  - El técnico puede elegir: "usé 50m" (fracción) o "usé 1 bobina completa"

### 3. Propuesta inteligente (`material_delivery_service.py`)
- Actual: calcula en base units, redondea a compuestas
- Corregido: calcula directamente en unidades compuestas
- Si el móvil tiene 0.5 bobinas y necesita 0.17 bobinas para 2 instalaciones → propone 0 (suficiente)
- Si necesita 0.7 bobinas → propone 1 bobina

### 4. Vistas afectadas

| Vista | Cambio |
|-------|--------|
| WarehouseDetail (depósito) | Mostrar en unidades compuestas |
| WarehouseDetail (móvil) | Mostrar en unidades compuestas + desglose |
| StockAlerts | Comparar contra min_stock_alert en unidades compuestas |
| StockAdjustments | Input en unidades compuestas, sin conversión |
| MovementsHistory | Mostrar en unidades compuestas |

### 5. Datos existentes — Migración

Para productos compuestos existentes, necesitamos una migración que convierta:
```sql
UPDATE stock_bulk sb
SET quantity = quantity / p.unit_size
FROM products p
WHERE sb.product_id = p.id
AND p.is_composite = true
AND p.unit_size > 0;
```

## Prioridad de implementación

1. **Migración de datos** — convertir stock existente a unidades compuestas
2. **StockBulk** — verificar que todos los endpoints traten quantity como unidades compuestas
3. **Compras** — formulario de compra sin conversión (1 bobina = 1 en stock)
4. **Vistas de depósito** — mostrar en unidades compuestas
5. **Depósito móvil** — agregar desglose usando unit_size
6. **Alertas** — comparar en unidades compuestas
7. **Consumo en OT** — permitir fraccionamiento en el móvil
8. **Propuesta** — calcular en unidades compuestas

---

*Documento creado el 2026-06-07 como guía para el refactor pendiente.*
