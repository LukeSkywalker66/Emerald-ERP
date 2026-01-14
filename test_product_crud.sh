#!/bin/bash

# Script para probar CRUD de Productos con validaciones
# Uso: ./test_product_crud.sh

BASE_URL="http://localhost:8000/api/inventory"
API_KEY="test-key-001"  # Ajusta según tu configuración

echo "=== TEST: PRODUCT CRUD WITH VALIDATION ==="
echo ""

# 1. CREATE - Crear un producto de prueba
echo "1. CREATE - Crear producto de prueba"
PRODUCT_ID=$(curl -s -X POST "$BASE_URL/products" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Test Cable UTP",
    "sku": "TEST-CABLE-001",
    "type": "BULK",
    "category": "Cableado",
    "description": "Cable de prueba",
    "min_stock_alert": 50
  }' | jq -r '.id')

echo "Producto creado con ID: $PRODUCT_ID"
echo ""

# 2. GET - Obtener el producto creado
echo "2. GET - Obtener producto creado"
curl -s -X GET "$BASE_URL/products/$PRODUCT_ID" \
  -H "X-API-Key: $API_KEY" | jq '.'
echo ""

# 3. UPDATE - Editar el producto (sin cambiar el type)
echo "3. UPDATE - Actualizar nombre y descripción"
curl -s -X PUT "$BASE_URL/products/$PRODUCT_ID" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Test Cable UTP Actualizado",
    "description": "Cable actualizado en prueba",
    "min_stock_alert": 100
  }' | jq '.'
echo ""

# 4. UPDATE - Intentar cambiar el type (debe ser ignorado)
echo "4. UPDATE - Intentar cambiar type (debe ignorarse)"
curl -s -X PUT "$BASE_URL/products/$PRODUCT_ID" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Test Cable UTP",
    "type": "SERIALIZED"
  }' | jq '.'
echo ""

# 5. GET - Verificar que type no cambió
echo "5. GET - Verificar que type sigue siendo BULK"
curl -s -X GET "$BASE_URL/products/$PRODUCT_ID" \
  -H "X-API-Key: $API_KEY" | jq '.type'
echo ""

# 6. DELETE - Eliminar el producto (debe funcionar porque no tiene stock)
echo "6. DELETE - Eliminar producto sin stock"
curl -s -X DELETE "$BASE_URL/products/$PRODUCT_ID" \
  -H "X-API-Key: $API_KEY" \
  -w "\nStatus: %{http_code}\n"
echo ""

# 7. GET - Intentar obtener el producto eliminado (debe dar 404)
echo "7. GET - Intentar obtener producto eliminado (debe dar 404)"
curl -s -X GET "$BASE_URL/products/$PRODUCT_ID" \
  -H "X-API-Key: $API_KEY" \
  -w "\nStatus: %{http_code}\n" | jq '.'
echo ""

echo "=== TEST COMPLETADO ==="
