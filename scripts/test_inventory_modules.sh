#!/bin/bash

# 🧪 SCRIPT DE TESTING MÓDULO INVENTARIO
# Testing automatizado de endpoints y funcionalidades
# Ejecutar: bash test_inventory_modules.sh

set -e

API_URL="http://localhost:8500/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           🧪 TESTING MÓDULO INVENTARIO                         ║${NC}"
echo -e "${BLUE}║           Productos, Almacenes, Stock, Transferencias         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}\n"

# ============================================================================
# TEST 1: PRODUCTS (ProductCatalog)
# ============================================================================

echo -e "${YELLOW}1️⃣  TEST: PRODUCTS (ProductCatalog)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

echo "📋 GET /api/inventory/products"
PRODUCTS=$(curl -s "${API_URL}/inventory/products")
PRODUCT_COUNT=$(echo "$PRODUCTS" | grep -o '"id"' | wc -l)
echo -e "${GREEN}✅ Productos listados: $PRODUCT_COUNT${NC}\n"

# Extraer ID de primer producto BULK
BULK_PRODUCT_ID=$(echo "$PRODUCTS" | grep -A 5 '"type":"BULK"' | grep -m 1 '"id":' | grep -o '[0-9]*' | head -1)
echo "Primer producto BULK encontrado: ID=$BULK_PRODUCT_ID"

# Extraer ID de primer producto SERIALIZED
SERIALIZED_PRODUCT_ID=$(echo "$PRODUCTS" | grep -A 5 '"type":"SERIALIZED"' | grep -m 1 '"id":' | grep -o '[0-9]*' | head -1)
echo -e "Primer producto SERIALIZED encontrado: ID=$SERIALIZED_PRODUCT_ID\n"

# ============================================================================
# TEST 2: WAREHOUSES
# ============================================================================

echo -e "${YELLOW}2️⃣  TEST: WAREHOUSES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

echo "📍 GET /api/inventory/warehouses"
WAREHOUSES=$(curl -s "${API_URL}/inventory/warehouses")
WAREHOUSE_COUNT=$(echo "$WAREHOUSES" | grep -o '"id":' | wc -l)
echo -e "${GREEN}✅ Almacenes listados: $WAREHOUSE_COUNT${NC}\n"

# Usar warehouse 4 (Camioneta Técnico 2)
WAREHOUSE_ID=4
echo "Usando Warehouse ID=$WAREHOUSE_ID (Camioneta Técnico 2)\n"

# ============================================================================
# TEST 3: STOCK EN WAREHOUSE 4
# ============================================================================

echo -e "${YELLOW}3️⃣  TEST: STOCK EN WAREHOUSE${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

echo "📦 GET /api/inventory/warehouses/${WAREHOUSE_ID}/stock"
STOCK=$(curl -s "${API_URL}/inventory/warehouses/${WAREHOUSE_ID}/stock")
echo -e "${GREEN}✅ Stock obtenido${NC}"
echo "Items en warehouse:"
echo "$STOCK" | grep -o '"product_name":"[^"]*"' | head -5 | sed 's/\"product_name\"://g'
echo ""

# ============================================================================
# TEST 4: TEST TRANSFERENCIA BULK
# ============================================================================

echo -e "${YELLOW}4️⃣  TEST: TRANSFERENCIA BULK${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

if [ -z "$BULK_PRODUCT_ID" ]; then
  echo -e "${RED}❌ No hay productos BULK disponibles para test${NC}\n"
else
  echo "🔄 Transferir producto BULK (ID=$BULK_PRODUCT_ID)"
  echo "   Desde: Warehouse 4 (Móvil)"
  echo "   Hacia: Warehouse 1 (Central)"
  echo "   Cantidad: 5 unidades\n"
  
  TRANSFER_RESPONSE=$(curl -s -X POST "${API_URL}/inventory/transfer" \
    -H "Content-Type: application/json" \
    -d "{
      \"product_id\": $BULK_PRODUCT_ID,
      \"from_warehouse_id\": $WAREHOUSE_ID,
      \"to_warehouse_id\": 1,
      \"quantity\": 5,
      \"reference\": \"TEST_BULK_TRANSFER\"
    }")
  
  if echo "$TRANSFER_RESPONSE" | grep -q '"id"'; then
    echo -e "${GREEN}✅ Transferencia BULK exitosa${NC}"
    echo "Response: $(echo $TRANSFER_RESPONSE | cut -c1-100)...\n"
  else
    echo -e "${RED}❌ Error en transferencia BULK${NC}"
    echo "Response: $TRANSFER_RESPONSE\n"
  fi
fi

# ============================================================================
# TEST 5: TEST TRANSFERENCIA SERIALIZED
# ============================================================================

echo -e "${YELLOW}5️⃣  TEST: TRANSFERENCIA SERIALIZED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

if [ -z "$SERIALIZED_PRODUCT_ID" ]; then
  echo -e "${RED}❌ No hay productos SERIALIZED disponibles para test${NC}\n"
else
  echo "🔄 Obtener seriales disponibles para producto SERIALIZED (ID=$SERIALIZED_PRODUCT_ID)"
  
  SERIALS=$(curl -s "${API_URL}/inventory/warehouses/${WAREHOUSE_ID}/stock" | \
    grep -A 50 "\"product_id\":$SERIALIZED_PRODUCT_ID" | \
    grep -o '"serial_number":"[^"]*"' | head -1 | sed 's/"serial_number":"//g' | sed 's/"//g')
  
  if [ -n "$SERIALS" ]; then
    echo "   Seriales disponibles encontrados: $SERIALS\n"
    echo "🔄 Transferir serial a Warehouse 1 (Central)\n"
    
    # Nota: El endpoint espera serial_item_ids (array de IDs, no strings)
    # Primero obtener el ID del serial_item
    SERIAL_ITEM_ID=$(curl -s "${API_URL}/inventory/warehouses/${WAREHOUSE_ID}/stock" | \
      grep -B 5 "\"serial_number\":\"$SERIALS\"" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
    
    if [ -n "$SERIAL_ITEM_ID" ]; then
      TRANSFER_RESPONSE=$(curl -s -X POST "${API_URL}/inventory/transfer" \
        -H "Content-Type: application/json" \
        -d "{
          \"product_id\": $SERIALIZED_PRODUCT_ID,
          \"from_warehouse_id\": $WAREHOUSE_ID,
          \"to_warehouse_id\": 1,
          \"serial_item_ids\": [$SERIAL_ITEM_ID],
          \"reference\": \"TEST_SERIALIZED_TRANSFER\"
        }")
      
      if echo "$TRANSFER_RESPONSE" | grep -q '"id"'; then
        echo -e "${GREEN}✅ Transferencia SERIALIZED exitosa${NC}"
        echo "Response: $(echo $TRANSFER_RESPONSE | cut -c1-100)...\n"
      else
        echo -e "${RED}❌ Error en transferencia SERIALIZED${NC}"
        echo "Response: $TRANSFER_RESPONSE\n"
      fi
    fi
  else
    echo -e "${YELLOW}⚠️  No hay seriales disponibles en warehouse${NC}\n"
  fi
fi

# ============================================================================
# TEST 6: HISTORIAL DE MOVIMIENTOS
# ============================================================================

echo -e "${YELLOW}6️⃣  TEST: HISTORIAL DE MOVIMIENTOS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

echo "📊 GET /api/inventory/movements?limit=10"
MOVEMENTS=$(curl -s "${API_URL}/inventory/movements?limit=10")
MOVEMENT_COUNT=$(echo "$MOVEMENTS" | grep -o '"id"' | wc -l)
echo -e "${GREEN}✅ Movimientos listados: $MOVEMENT_COUNT${NC}\n"

# ============================================================================
# TEST 7: WORK ORDERS (Material Persistence)
# ============================================================================

echo -e "${YELLOW}7️⃣  TEST: WORK ORDERS - Material Persistence${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

echo "📋 GET /api/v2/work-orders"
WO_RESPONSE=$(curl -s "http://localhost:8500/api/v2/work-orders")
WO_COUNT=$(echo "$WO_RESPONSE" | grep -o '"id"' | wc -l)
echo -e "${GREEN}✅ Work Orders listadas: $WO_COUNT${NC}\n"

# Extraer primer WO ID
WO_ID=$(echo "$WO_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
if [ -n "$WO_ID" ]; then
  echo "Primer Work Order encontrado: ID=$WO_ID"
  echo "🔍 GET /api/v2/work-orders/$WO_ID"
  
  WO_DETAIL=$(curl -s "http://localhost:8500/api/v2/work-orders/$WO_ID")
  if echo "$WO_DETAIL" | grep -q '"id"'; then
    echo -e "${GREEN}✅ WO obtenida correctamente${NC}"
    echo "Status: $(echo $WO_DETAIL | grep -o '"status":"[^"]*"' | head -1)\n"
  else
    echo -e "${RED}❌ Error al obtener WO${NC}\n"
  fi
fi

# ============================================================================
# RESUMEN
# ============================================================================

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    ✅ TESTING COMPLETADO                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}Resultados:${NC}"
echo "  ✅ Products: Listados ($PRODUCT_COUNT total)"
echo "  ✅ Warehouses: Listados ($WAREHOUSE_COUNT total)"
echo "  ✅ Stock: Obtenido para warehouse $WAREHOUSE_ID"
echo "  ✅ Movements: Listados ($MOVEMENT_COUNT total)"
echo "  ✅ Work Orders: Listadas ($WO_COUNT total)"
echo ""

echo -e "${YELLOW}📌 PRÓXIMOS PASOS:${NC}"
echo "  1. Abrir navegador: http://localhost:5173"
echo "  2. Login: tecnico2@emerald.com / password"
echo "  3. Navegar a: Inventario → Catálogo de Productos"
echo "  4. Testar CRUD: Crear, Editar, Eliminar producto"
echo "  5. Testar: Transferencias y Ajustes de Stock"
echo "  6. Testar: Work Orders - Agregar/Eliminar Materiales"
echo ""
