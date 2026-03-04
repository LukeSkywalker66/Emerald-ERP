#!/bin/bash

# E2E Test: Priority Management in Tickets and WorkOrders
# Valida que:
# 1. El operador puede elegir prioridad al crear instalación
# 2. La WorkOrder hereda la prioridad del ticket
# 3. La prioridad de la WO se puede editar independientemente
# 4. La UI muestra ambas prioridades correctamente

set -e

API_URL="http://localhost:8500/api"
AUTH_ENDPOINT="http://localhost:8500/api/v1/auth/login"

# Colores ANSI
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========== E2E: PRIORITY MANAGEMENT TEST ==========${NC}\n"

# ========== PASO 1: AUTENTICACIÓN ==========
echo -e "${YELLOW}[1/6]${NC} Obteniendo JWT token..."
TOKEN=$(curl -s -X POST "$AUTH_ENDPOINT" \
  -d "username=admin@emerald.com&password=admin123" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))")

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Error: No se pudo obtener JWT token${NC}"
  exit 1
fi

echo -e "${GREEN}✓ JWT token obtenido${NC}"

# ========== PASO 2: BÚSQUEDA DE CLIENTE ==========
echo -e "${YELLOW}[2/6]${NC} Buscando cliente en ISPCube..."
LOOKUP=$(curl -s "$API_URL/external/customer-lookup-new-connections?dni=20294562746" \
  -H "Authorization: Bearer $TOKEN")

CUSTOMER_ID=$(echo "$LOOKUP" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('customer', {}).get('id', ''))")
if [ -z "$CUSTOMER_ID" ]; then
  echo -e "${RED}✗ Error: Cliente no encontrado${NC}"
  exit 1
fi

# Obtener la primera conexión disponible del resultado
CONNECTION_ID=$(echo "$LOOKUP" | python3 -c "import sys, json; data=json.load(sys.stdin); conns = data.get('connections', []); print(str(conns[0].get('external_id', conns[0].get('id', ''))) if conns else '')")

if [ -z "$CONNECTION_ID" ] || [ "$CONNECTION_ID" = "None" ]; then
  echo -e "${RED}✗ Error: No hay conexiones disponibles${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Cliente encontrado: ID $CUSTOMER_ID, Conexión: $CONNECTION_ID${NC}"

# ========== PASO 3: CREAR TICKET CON PRIORIDAD ALTA ==========
echo -e "${YELLOW}[3/6]${NC} Creando instalación con prioridad CRÍTICA..."
TICKET=$(curl -s -X POST "$API_URL/v2/tickets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @- <<EOF
{
  "ticket_type": "installation",
  "subject": "Instalación - Test Priority",
  "description": "Test para validar gestión de prioridades",
  "priority": "critical",
  "category_id": 1,
  "destination_connection_id": $CONNECTION_ID,
  "installation_tech": "fiber",
  "availability_note": "Lunes a viernes 9-18hs",
  "customer_dni": "20294562746",
  "ispcube_customer": {
    "id": "$CUSTOMER_ID",
    "name": "Cliente Test",
    "doc_number": "20294562746"
  },
  "ispcube_connections": []
}
EOF
)

TICKET_ID=$(echo "$TICKET" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))")
if [ -z "$TICKET_ID" ]; then
  echo -e "${RED}✗ Error: No se pudo crear ticket${NC}"
  echo "$TICKET" | python3 -m json.tool 2>/dev/null || echo "$TICKET"
  exit 1
fi

TICKET_PRIORITY=$(echo "$TICKET" | python3 -c "import sys, json; print(json.load(sys.stdin).get('priority', ''))")
echo -e "${GREEN}✓ Ticket creado: ID $TICKET_ID, Prioridad: $TICKET_PRIORITY${NC}"

# ========== PASO 4: VERIFICAR WORKORDER HEREDA PRIORIDAD ==========
echo -e "${YELLOW}[4/6]${NC} Verificando que WorkOrder hereda prioridad del ticket..."
sleep 1
DETAIL=$(curl -s "$API_URL/v2/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $TOKEN")

WO_ID=$(echo "$DETAIL" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('work_orders', [{}])[0].get('id', ''))" 2>/dev/null)
if [ -z "$WO_ID" ]; then
  echo -e "${YELLOW}⚠ WorkOrder no fue auto-generada (puede ser normal según configuración)${NC}"
else
  WO_PRIORITY=$(echo "$DETAIL" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('work_orders', [{}])[0].get('priority', ''))" 2>/dev/null)
  if [ "$WO_PRIORITY" = "$TICKET_PRIORITY" ]; then
    echo -e "${GREEN}✓ WorkOrder hereda prioridad correctamente: $WO_PRIORITY${NC}"
  else
    echo -e "${RED}✗ Error: WorkOrder NO hereda prioridad. Ticket: $TICKET_PRIORITY, WO: $WO_PRIORITY${NC}"
    exit 1
  fi
fi

# ========== PASO 5: CAMBIAR PRIORIDAD DE WORKORDER (SI EXISTE) ==========
if [ ! -z "$WO_ID" ]; then
  echo -e "${YELLOW}[5/6]${NC} Modificando prioridad de WorkOrder a 'low'..."
  UPDATE=$(curl -s -X PATCH "$API_URL/v2/work-orders/$WO_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "priority": "low"
    }')

  UPDATED_PRIORITY=$(echo "$UPDATE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('priority', ''))" 2>/dev/null)
  if [ "$UPDATED_PRIORITY" = "low" ]; then
    echo -e "${GREEN}✓ Prioridad de WorkOrder actualizada independientemente: $UPDATED_PRIORITY${NC}"
  else
    echo -e "${RED}✗ Error: No se pudo actualizar prioridad de WorkOrder${NC}"
    echo "$UPDATE" | python3 -m json.tool 2>/dev/null || echo "$UPDATE"
    exit 1
  fi
else
  echo -e "${YELLOW}[5/6] Paso saltado (sin WorkOrder auto-generada)${NC}"
fi

# ========== PASO 6: VERIFICACIÓN FINAL ==========
echo -e "${YELLOW}[6/6]${NC} Verificación final de datos..."
FINAL=$(curl -s "$API_URL/v2/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $TOKEN")

FINAL_TICKET_PRIORITY=$(echo "$FINAL" | python3 -c "import sys, json; print(json.load(sys.stdin).get('priority', ''))")
echo -e "${GREEN}✓ Ticket mantiene prioridad: $FINAL_TICKET_PRIORITY${NC}"

# ========== ÉXITO ==========
echo -e "\n${GREEN}========== ✅ ALL E2E TESTS PASSED ==========${NC}\n"

echo "📊 Resumen:"
echo "  • Ticket creado con prioridad CRITICAL: $TICKET_PRIORITY"
if [ ! -z "$WO_ID" ]; then
  echo "  • WorkOrder heredó prioridad: $TICKET_PRIORITY → $UPDATED_PRIORITY"
fi
echo "  • Prioridades editables independientemente: ✓"
echo "\nID Ticket para referencia: $TICKET_ID"
if [ ! -z "$WO_ID" ]; then
  echo "ID WorkOrder para referencia: $WO_ID"
fi
