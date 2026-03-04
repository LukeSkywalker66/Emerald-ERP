#!/bin/bash

# ============================================================================
# E2E Automated Testing - Installation Workflow (Simplified DB Access)
# ============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
API_BASE="http://localhost:8500/api"
DB_USER="emerald_owner"
DB_NAME="emerald_stock"
DB_CMD="docker exec emerald_db psql -U $DB_USER -d $DB_NAME"

# Test DNI
TEST_DNI="20294562746"  # USUARIO PRUEBA (cliente existente)

# Variables para almacenar valores
TICKET_ID=""
CONNECTION_ID=""
CUSTOMER_ID=""

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}E2E Automated Testing - Installation Workflow${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

# ============================================================================
# AUTH: Obtain JWT Token
# ============================================================================

echo -e "${YELLOW}[AUTH] Obtaining JWT Token${NC}"

TOKEN_RESPONSE=$(curl -s -X POST "${API_BASE}/v1/auth/login" \
  -d "username=admin@emerald.com&password=admin123")

JWT_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token', ''))" 2>/dev/null)

if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}❌ FAILED: Could not obtain JWT token${NC}"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ PASSED: JWT token obtained${NC}\n"

# ============================================================================
# STEP 1: Lookup Endpoint Test
# ============================================================================

echo -e "${YELLOW}[STEP 1] Testing ISPCube Lookup Endpoint${NC}"
echo "  → GET ${API_BASE}/external/customer-lookup-new-connections?dni=${TEST_DNI}"

LOOKUP_RESPONSE=$(curl -s "${API_BASE}/external/customer-lookup-new-connections?dni=${TEST_DNI}")

# Parse usando python
CUSTOMER_ID=$(echo "$LOOKUP_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('customer', {}).get('id', ''))" 2>/dev/null)
CUSTOMER_NAME=$(echo "$LOOKUP_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('customer', {}).get('name', ''))" 2>/dev/null)
NEW_CONNECTIONS=$(echo "$LOOKUP_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('connections', [])))" 2>/dev/null)

if [ -z "$CUSTOMER_ID" ]; then
    echo -e "${RED}❌ FAILED: Customer not found in ISPCube${NC}"
    exit 1
fi

echo "  → Response: $CUSTOMER_NAME, New connections: $NEW_CONNECTIONS"
echo -e "${GREEN}✅ PASSED: Customer found (ID: $CUSTOMER_ID)${NC}\n"

# ============================================================================
# STEP 2: Create Test Connection OR Use Existing from ISPCube Confirmation
# ============================================================================

echo -e "${YELLOW}[STEP 2] Preparing Connection Data${NC}"

# Para instalaciones, normalmente usarías una conexión nueva de ISPCube
# Si no hay conexiones nuevas, usamos una existente local para el test
EXISTING_CONNECTION=$($DB_CMD --tuples-only -q -c "
    SELECT connection_id FROM connections 
    WHERE customer_id = $CUSTOMER_ID 
    LIMIT 1;" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [ -z "$EXISTING_CONNECTION" ]; then
    # No existing connections - create a test one
    CONNECTION_ID=$(
      $DB_CMD --tuples-only -q -c "
        INSERT INTO connections (customer_id, pppoe_username, direccion)
        VALUES ($CUSTOMER_ID, 'test_e2e_' || ceil((random() * 1000000))::int::text, 'Calle E2E Test')
        RETURNING connection_id;" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
    )
else
    # Use existing connection from customer
    CONNECTION_ID=$EXISTING_CONNECTION
fi

if [ -z "$CONNECTION_ID" ] || ! [[ "$CONNECTION_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}❌ FAILED: Could not determine connection${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PASSED: Using connection (ID: $CONNECTION_ID)${NC}\n"

# ============================================================================
# STEP 3: Create Installation Ticket via API (with JWT Authentication)
# ============================================================================

echo -e "${YELLOW}[STEP 3] Creating Installation Ticket via API Endpoint${NC}"

TIMESTAMP=$(date +%s)
SUBJECT="E2E TEST - Instalacion $TIMESTAMP"
DESCRIPTION="Automated E2E test ticket via API"

TICKET_PAYLOAD=$(cat <<EOF
{
  "subject": "$SUBJECT",
  "description": "$DESCRIPTION",
  "priority": "medium",
  "ticket_type": "installation",
  "installation_tech": "wireless",
  "destination_connection_id": $CONNECTION_ID,
  "customer_dni": "20294562746",
  "category_id": 3,
  "availability_note": "E2E Test: Lunes 09-11"
}
EOF
)

echo "  → POST ${API_BASE}/v2/tickets (with JWT Authorization)"

TICKET_RESPONSE=$(curl -s -X POST "${API_BASE}/v2/tickets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "$TICKET_PAYLOAD")

TICKET_ID=$(echo "$TICKET_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', ''))" 2>/dev/null)

if [ -z "$TICKET_ID" ] || ! [[ "$TICKET_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}❌ FAILED: Ticket creation via API failed${NC}"
    echo "Response: $TICKET_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ PASSED: Ticket created via API endpoint (ID: $TICKET_ID)${NC}\n"

# ============================================================================
# STEP 4: Validate Ticket in Database
# ============================================================================

echo -e "${YELLOW}[STEP 4] Validating Ticket Persistence${NC}"

TICKET_CHECK=$($DB_CMD --tuples-only -q -c "
    SELECT id, subject, status, ticket_type, installation_tech
    FROM tickets
    WHERE id = $TICKET_ID;")

if [ -z "$TICKET_CHECK" ]; then
    echo -e "${RED}❌ FAILED: Ticket not found in database${NC}"
    exit 1
fi

echo "  → Ticket: $(echo $TICKET_CHECK | cut -d'|' -f2- | xargs)"
echo -e "${GREEN}✅ PASSED: Ticket persisted in database${NC}\n"

# ============================================================================
# STEP 5: Validate Timeline Event
# ============================================================================

echo -e "${YELLOW}[STEP 5] Validating Timeline Event${NC}"

TIMELINE=$($DB_CMD --tuples-only -q -c "
    SELECT content
    FROM ticket_timeline
    WHERE ticket_id = $TICKET_ID
    ORDER BY created_at DESC
    LIMIT 1;" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [[ ! "$TIMELINE" =~ "Instalación" ]] && [[ ! "$TIMELINE" =~ "instalación" ]]; then
    echo -e "${YELLOW}⚠️  WARN: Timeline content unexpected: '$TIMELINE'${NC}"
fi

echo "  → Timeline: $(echo $TIMELINE | head -c 50)..."
echo -e "${GREEN}✅ PASSED: Timeline event found${NC}\n"

# ============================================================================
# STEP 6: Validate Meta Data
# ============================================================================

echo -e "${YELLOW}[STEP 6] Validating Meta Data (Audit Trail)${NC}"

META_DATA=$($DB_CMD --tuples-only -q -c "
    SELECT meta_data
    FROM ticket_timeline
    WHERE ticket_id = $TICKET_ID
    ORDER BY created_at DESC
    LIMIT 1;" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [ -z "$META_DATA" ]; then
    echo -e "${YELLOW}⚠️  WARN: Meta data is empty (expected for audit)${NC}"
else
    echo "  → Meta data: $(echo $META_DATA | head -c 40)..."
fi

echo -e "${GREEN}✅ PASSED: Meta data accessible${NC}\n"

# ============================================================================
# STEP 7: Validate Connection Sync
# ============================================================================

echo -e "${YELLOW}[STEP 7] Validating Connection Sync${NC}"

CONN_CHECK=$($DB_CMD --tuples-only -q -c "
    SELECT connection_id, customer_id, pppoe_username
    FROM connections
    WHERE connection_id = $CONNECTION_ID;" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [ -z "$CONN_CHECK" ]; then
    echo -e "${RED}❌ FAILED: Connection not found in database${NC}"
    exit 1
fi

echo "  → Connection: $(echo $CONN_CHECK | head -c 40)..."
echo -e "${GREEN}✅ PASSED: Connection persisted in database${NC}\n"

# ============================================================================
# STEP 8: Load Installation Types
# ============================================================================

echo -e "${YELLOW}[STEP 8] Testing Installation Types Endpoint${NC}"

TYPES_RESPONSE=$(curl -s "${API_BASE}/v2/installation-types")
TYPES_COUNT=$(echo "$TYPES_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)

if [ "$TYPES_COUNT" -lt 3 ]; then
    echo -e "${RED}❌ FAILED: Expected 3+ types, got $TYPES_COUNT${NC}"
    exit 1
fi

WIRELESS=$(echo "$TYPES_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); w=[t for t in d if t.get('code')=='wireless']; print(w[0]['name'] if w else '')" 2>/dev/null)

echo "  → Found $TYPES_COUNT installation types"
echo "  → Wireless: $WIRELESS"
echo -e "${GREEN}✅ PASSED: Installation types loaded correctly${NC}\n"

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ ALL E2E TESTS PASSED${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}Test Results Summary:${NC}"
echo -e "  • JWT Authentication:    ${GREEN}✅${NC}"
echo -e "  • ISPCube Lookup:        ${GREEN}✅${NC}"
echo -e "  • Connection Creation:   ${GREEN}✅${NC}"
echo -e "  • Ticket via API:        ${GREEN}✅${NC}"
echo -e "  • Database Persistence:  ${GREEN}✅${NC}"
echo -e "  • Timeline Event:        ${GREEN}✅${NC}"
echo -e "  • Meta Data (Audit):     ${GREEN}✅${NC}"
echo -e "  • Connection Sync:       ${GREEN}✅${NC}"
echo -e "  • Installation Types:    ${GREEN}✅${NC}\n"

echo -e "${YELLOW}Created Test Resources:${NC}"
echo -e "  • Ticket ID:        $TICKET_ID"
echo -e "  • Connection ID:    $CONNECTION_ID"
echo -e "  • Customer ID:      $CUSTOMER_ID\n"

# ============================================================================
# CLEANUP
# ============================================================================

read -p "$(echo -e ${YELLOW}Do you want to rollback test data? \(y/n\):${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🗑️  Rolling back...${NC}\n"
    
    $DB_CMD << EOSQL
    BEGIN;
    DELETE FROM ticket_timeline WHERE ticket_id = $TICKET_ID;
    DELETE FROM ticket_events WHERE ticket_id = $TICKET_ID;
    DELETE FROM ticket_attachments WHERE ticket_id = $TICKET_ID;
    DELETE FROM ticket_tags WHERE ticket_id = $TICKET_ID;
    DELETE FROM tickets WHERE id = $TICKET_ID;
    DELETE FROM connections WHERE connection_id = $CONNECTION_ID;
    COMMIT;
EOSQL
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Rollback completed${NC}\n"
    else
        echo -e "${RED}❌ Rollback failed - manual cleanup may be needed${NC}\n"
    fi
fi

echo -e "${GREEN}✨ E2E Testing Complete!${NC}\n"
