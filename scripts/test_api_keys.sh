#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Script de Validación - Sistema de API Keys de Emerald ERP
# ═══════════════════════════════════════════════════════════════════════════
#
# Uso: bash test_api_keys.sh
#
# Este script valida que el sistema de API Keys está funcionando correctamente
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
API_URL="http://localhost"
OLD_API_KEY="${API_KEY:-tu_api_key_viejo}"  # Usar var de entorno o valor default

echo -e "${BLUE}═════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite: Sistema de API Keys${NC}"
echo -e "${BLUE}═════════════════════════════════════════════════════════════${NC}"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check (sin autenticación)${NC}"
if curl -s "${API_URL}/health" | grep -q "ok"; then
    echo -e "${GREEN}✅ PASS${NC}: Servidor respondiendo"
else
    echo -e "${RED}❌ FAIL${NC}: Servidor no disponible"
    exit 1
fi
echo ""

# Test 2: Endpoint protegido sin key
echo -e "${YELLOW}Test 2: Acceso a /admin/api-keys sin key${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/admin/api-keys")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ PASS${NC}: Retorna 401 Unauthorized"
else
    echo -e "${RED}❌ FAIL${NC}: Esperaba 401, got $HTTP_CODE"
fi
echo ""

# Test 3: Crear nueva API Key
echo -e "${YELLOW}Test 3: Crear nueva API Key${NC}"
NEW_KEY_RESPONSE=$(curl -s -X POST "${API_URL}/admin/api-keys" \
  -H "x-api-key: ${OLD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test API Key",
    "scopes": ["read"],
    "expires_in_days": 90
  }')

# Extraer valores
NEW_API_KEY=$(echo "$NEW_KEY_RESPONSE" | grep -o '"key":"[^"]*' | cut -d'"' -f4)
KEY_PREFIX=$(echo "$NEW_KEY_RESPONSE" | grep -o '"prefix":"[^"]*' | cut -d'"' -f4)

if [ -z "$NEW_API_KEY" ]; then
    echo -e "${RED}❌ FAIL${NC}: No se pudo crear la key"
    echo "Response: $NEW_KEY_RESPONSE"
else
    echo -e "${GREEN}✅ PASS${NC}: Key creada"
    echo "  Prefix: $KEY_PREFIX"
    echo "  Key: ${NEW_API_KEY:0:20}..."
fi
echo ""

# Test 4: Listar API Keys
echo -e "${YELLOW}Test 4: Listar todas las API Keys${NC}"
if curl -s -X GET "${API_URL}/admin/api-keys" \
  -H "x-api-key: ${OLD_API_KEY}" | grep -q "Test API Key"; then
    echo -e "${GREEN}✅ PASS${NC}: Key listada correctamente"
else
    echo -e "${RED}❌ FAIL${NC}: Key no encontrada en listado"
fi
echo ""

# Test 5: Usar API Key para acceder endpoint protegido
echo -e "${YELLOW}Test 5: Usar nueva API Key en endpoint protegido${NC}"
if [ -n "$NEW_API_KEY" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/admin/api-keys" \
      -H "x-api-key: ${NEW_API_KEY}")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC}: Key válida (200 OK)"
    else
        echo -e "${RED}❌ FAIL${NC}: Esperaba 200, got $HTTP_CODE"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: No se pudo crear key en Test 3"
fi
echo ""

# Test 6: API Key inválida
echo -e "${YELLOW}Test 6: Intentar usar API Key inválida${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/admin/api-keys" \
  -H "x-api-key: iso_INVALID_KEY_12345")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ PASS${NC}: Retorna 401 para key inválida"
else
    echo -e "${RED}❌ FAIL${NC}: Esperaba 401, got $HTTP_CODE"
fi
echo ""

# Test 7: Ver auditoría
echo -e "${YELLOW}Test 7: Ver log de auditoría${NC}"
if curl -s -X GET "${API_URL}/admin/api-keys/audit/all?limit=10" \
  -H "x-api-key: ${OLD_API_KEY}" | grep -q "audit_log"; then
    echo -e "${GREEN}✅ PASS${NC}: Auditoría disponible"
else
    echo -e "${RED}❌ FAIL${NC}: No se pudo acceder a auditoría"
fi
echo ""

# Test 8: Rotar API Key (si se creó una)
echo -e "${YELLOW}Test 8: Rotar API Key manualmente${NC}"
if [ -n "$NEW_API_KEY" ]; then
    # Primero obtener el ID de la key
    KEY_ID=$(curl -s -X GET "${API_URL}/admin/api-keys" \
      -H "x-api-key: ${OLD_API_KEY}" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    
    if [ -n "$KEY_ID" ]; then
        ROTATED_RESPONSE=$(curl -s -X POST "${API_URL}/admin/api-keys/${KEY_ID}/rotate" \
          -H "x-api-key: ${OLD_API_KEY}")
        
        if echo "$ROTATED_RESPONSE" | grep -q '"key"'; then
            echo -e "${GREEN}✅ PASS${NC}: Key rotada exitosamente"
            ROTATED_KEY=$(echo "$ROTATED_RESPONSE" | grep -o '"key":"[^"]*' | cut -d'"' -f4)
            echo "  Nueva key: ${ROTATED_KEY:0:20}..."
        else
            echo -e "${RED}❌ FAIL${NC}: Error rotando key"
        fi
    else
        echo -e "${RED}❌ FAIL${NC}: No se encontró KEY_ID"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: No se pudo crear key en Test 3"
fi
echo ""

# Resumen
echo -e "${BLUE}═════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ TESTS COMPLETADOS${NC}"
echo -e "${BLUE}═════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Próximos pasos:"
echo "1. Ejecutar migraciones: docker-compose exec backend alembic upgrade head"
echo "2. Validar Celery Beat: docker-compose logs -f celery-beat"
echo "3. Ver auditoría: curl -H 'x-api-key: \$KEY' http://localhost/admin/api-keys/audit/all"
echo ""
