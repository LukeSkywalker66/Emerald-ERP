# Plan: Refactor Serial Validation v2 — Regex por Producto

## Problema raíz

El enfoque actual tiene `serial_formats` como tabla separada con un patrón genérico ITU-T G.984 que no matchea los seriales reales del hardware del cliente. Estuvimos ajustando el regex a ciegas, probando longitudes y caracteres. La solución correcta es: **cada producto define su propio regex de validación, configurado por el usuario.**

## Comparación: viejo vs nuevo

| Aspecto | Viejo (`serial_formats` table) | Nuevo (`Product.serial_validation_regex`) |
|---------|-------------------------------|------------------------------------------|
| Dónde se configura | Tabla aparte, seed data | Campo en el formulario de producto |
| Flexibilidad | Un patrón genérico para todos | Regex específico por modelo de ONU |
| Configuración | SQL o migración | UI de catálogo de productos |
| Validación | Backend-only (engine) | Frontend (hook shield) + Backend (API) |
| Fallback sin regex | Patrón ITU-T G.984 genérico | Acepta cualquier string |

## Cambios

### 1. Modelo: `Product.serial_validation_regex`

Agregar campo a `Product` en `models/inventory.py`:

```python
serial_validation_regex: Mapped[Optional[str]] = mapped_column(
    String(255),
    nullable=True,
    comment="Regex para validar seriales al registrar compras. Null = acepta cualquier valor."
)
```

### 2. Simplificar `serial_formats`

La tabla `serial_formats` queda **deprecada**. El `SerialFormatValidator` en el engine pasa a leer `Product.serial_validation_regex` directamente en lugar de consultar la tabla. Para el módulo DELIVERY (donde el producto no se conoce de antemano), se usa ITU-T G.984 como fallback (que ya está en `patterns.py`).

### 3. Schemas de Product

Agregar `serial_validation_regex: Optional[str]` a `ProductCreate`, `ProductUpdate`, `ProductResponse`.

### 4. Backend: validación estricta en compra

En el endpoint de confirmación de compra (o `createSerialItem`), antes de crear cada `SerialItem`:

```python
if product.serial_validation_regex:
    if not re.match(product.serial_validation_regex, serial_number):
        raise HTTPException(400, f"Serial '{serial_number}' no cumple el formato esperado para '{product.name}'")
```

### 5. BarcodeScannerEngine: simplificar

- `SerialFormatValidator`: reemplazar consulta a `serial_formats` por lectura de `Product.serial_validation_regex`
- `ITUTG984Validator`: se mantiene como fallback para DELIVERY
- `GenericSerialValidator`: se mantiene como último recurso

### 6. Frontend: ProductCatalog — campo regex

En el formulario de producto (`ProductCatalog.jsx`), nuevo campo:

```
[Regex de Validación de Serial (opcional)]
Tooltip: "Ej: ^[A-Z0-9]{16}$ para forzar 16 caracteres (Huawei ONT)"
```

### 7. Frontend: Hook Shield `useBarcodeScanner`

Refactorizar el hook existente `useBarcodeScan` para aceptar un `validationRegex`:

```javascript
useBarcodeScanner({
    validationRegex: product?.serial_validation_regex || null,
    onValidScan: (code) => addToSerials(code),
    onInvalidScan: (code) => toast.error(`Código inválido: "${code}". Escaneá el SN correcto.`),
});
```

Flujo:
1. Escáner lee código → hook acumula buffer → Enter
2. Si hay `validationRegex` → validar con `regex.test(code)`
3. Si match → `onValidScan(code)`
4. Si no match → `onInvalidScan(code)` + toast error
5. Si no hay regex → todo se acepta (`onValidScan`)

### 8. Migración Alembic

```python
# 2026_06_10_002_add_serial_validation_regex_to_products.py
def upgrade():
    op.add_column('products', sa.Column(
        'serial_validation_regex', sa.String(255), nullable=True,
        comment='Regex para validar seriales al registrar compras'
    ))
```

## Tareas

| Fase | Tarea | Archivo |
|------|-------|---------|
| **A** | Agregar `serial_validation_regex` a `Product` model | `models/inventory.py` |
| **A** | Migración Alembic | Nueva migración |
| **A** | Actualizar schemas de Product | `schemas/inventory.py` |
| **B** | Backend: validación en compra | `routers/inventory.py` (confirm) |
| **B** | Simplificar `SerialFormatValidator` (usar Product, no tabla) | `barcode_reader/validators.py` |
| **C** | Frontend: hook `useBarcodeScanner` con shield regex | `components/barcode-reader/useBarcodeScan.js` |
| **C** | Frontend: campo regex en ProductCatalog | `pages/inventory/ProductCatalog.jsx` |
| **C** | Integrar hook shield en StockAdjustments | `pages/inventory/StockAdjustments.jsx` |
| **D** | Migrar datos de `serial_formats` a `products.serial_validation_regex` | Script |
| **D** | Deprecar tabla `serial_formats` | (mantener por ahora) |
