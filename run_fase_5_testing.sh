#!/bin/bash
# FASE 5: Testing E2E - Coordinación NASA-Grade
# Script de testing automático + manual checklist
# Fecha: 24 Feb 2026

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "🧪 FASE 5: Testing E2E - Coordinación NASA-Grade"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Get token for API testing
echo "📌 Obteniendo token de acceso..."
TOKEN=$(curl -s -X POST "http://localhost:80/api/v2/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@emerald.local",
    "password": "admin123"
  }' | jq -r '.access_token' 2>/dev/null || echo "")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Error obteniendo token. ¿BD/Backend están corriendo?"
  echo "   Intenta: docker ps | grep emerald"
  exit 1
fi

echo "✅ Token obtenido: ${TOKEN:0:20}..."
echo ""

# ============== FASE 5.1: Prueba POLLING ==============
echo "🌊 FASE 5.1: Testing POLLING (5s interval)"
echo "─────────────────────────────────────────────────"

# Test GET /coordination/grid
RESPONSE=$(curl -s -X GET "http://localhost:80/api/v2/work-orders/coordination/grid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2026-02-24",
    "end_date": "2026-02-24"
  }')

# Verificar respuesta
if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
  TEAMS=$(echo "$RESPONSE" | jq '.teams | length' 2>/dev/null || echo "0")
  ALLOCATIONS=$(echo "$RESPONSE" | jq '.allocations | length' 2>/dev/null || echo "0")
  BACKLOG=$(echo "$RESPONSE" | jq '.backlog | length' 2>/dev/null || echo "0")
  
  echo "✅ GET /coordination/grid"
  echo "   Teams: $TEAMS"
  echo "   Allocations: $ALLOCATIONS"
  echo "   Backlog: $BACKLOG"
else
  echo "❌ Error en GET /coordination/grid"
  exit 1
fi

echo ""

# ============== FASE 5.2: Testing FILTROS ==============
echo "🎯 FASE 5.2: Testing FILTROS (backend)"
echo "─────────────────────────────────────────────────"

# Verificar que backlog tiene OTs con datos de ciudad
if [ "$BACKLOG" -gt 0 ]; then
  FIRST_WO=$(echo "$RESPONSE" | jq '.backlog[0]' 2>/dev/null)
  WO_ID=$(echo "$FIRST_WO" | jq -r '.id' 2>/dev/null)
  WO_CLIENT=$(echo "$FIRST_WO" | jq -r '.client_name // "N/A"' 2>/dev/null)
  WO_ADDRESS=$(echo "$FIRST_WO" | jq -r '.address // "N/A"' 2>/dev/null | cut -c1-50)
  
  echo "✅ Datos de OT disponibles para filtrado"
  echo "   OT ID: $WO_ID"
  echo "   Cliente: $WO_CLIENT"
  echo "   Dirección: ${WO_ADDRESS}..."
else
  echo "⚠️  Backlog vacío (esperado si todas las OTs están asignadas)"
fi

echo ""

# ============== FASE 5.3: Testing ASSIGN (drag & drop simulation) ==============
echo "📌 FASE 5.3: Testing ASSIGN (simulación drag & drop)"
echo "─────────────────────────────────────────────────"

# Obtener primer WO del backlog
FIRST_WO=$(echo "$RESPONSE" | jq '.backlog[0]' 2>/dev/null)
WO_ID=$(echo "$FIRST_WO" | jq -r '.id' 2>/dev/null)
TEAM_ID=$(echo "$RESPONSE" | jq '.teams[0].id' 2>/dev/null)

if [ -z "$WO_ID" ] || [ "$WO_ID" = "null" ] || [ -z "$TEAM_ID" ] || [ "$TEAM_ID" = "null" ]; then
  echo "⚠️  No hay OTs en backlog o equipos disponibles para testing"
  echo "   Saltando test de ASSIGN"
else
  echo "   Intentando asignar OT #$WO_ID a equipo $TEAM_ID..."
  
  ASSIGN_RESPONSE=$(curl -s -X PATCH "http://localhost:80/api/v2/work-orders/$WO_ID/assign" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"team_id\": $TEAM_ID,
      \"scheduled_start\": \"2026-02-24T10:00:00\",
      \"estimated_duration\": 60
    }")
  
  # Verificar éxito
  if echo "$ASSIGN_RESPONSE" | jq . > /dev/null 2>&1; then
    STATUS=$(echo "$ASSIGN_RESPONSE" | jq -r '.status // "unknown"' 2>/dev/null)
    if [ "$STATUS" != "null" ] && [ -n "$STATUS" ]; then
      echo "✅ ASSIGN exitoso"
      echo "   Status: $STATUS"
      echo "   OT #$WO_ID → Equipo $TEAM_ID"
    else
      ERROR=$(echo "$ASSIGN_RESPONSE" | jq -r '.detail // "unknown error"' 2>/dev/null)
      echo "⚠️  Respuesta ASSIGN: $ERROR"
    fi
  else
    echo "❌ Error en ASSIGN"
  fi
fi

echo ""

# ============== FASE 5.4: Testing UNASSIGN ==============
echo "🔄 FASE 5.4: Testing UNASSIGN (devolver al backlog)"
echo "─────────────────────────────────────────────────"

# Obtener primer WO del backlog or allocations
ALLOCATED=$(echo "$RESPONSE" | jq '.allocations[0]' 2>/dev/null)
ALLOCATED_WO_ID=$(echo "$ALLOCATED" | jq -r '.id // .work_order_id // .workOrderId // "null"' 2>/dev/null)

if [ -z "$ALLOCATED_WO_ID" ] || [ "$ALLOCATED_WO_ID" = "null" ]; then
  echo "⚠️  No hay OTs asignadas para testing UNASSIGN"
else
  echo "   Intentando desasignar OT #$ALLOCATED_WO_ID..."
  
  UNASSIGN_RESPONSE=$(curl -s -X PATCH "http://localhost:80/api/v2/work-orders/$ALLOCATED_WO_ID/unassign" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")
  
  if echo "$UNASSIGN_RESPONSE" | jq . > /dev/null 2>&1; then
    STATUS=$(echo "$UNASSIGN_RESPONSE" | jq -r '.status // "unknown"' 2>/dev/null)
    if [ "$STATUS" = "pending_planning" ]; then
      echo "✅ UNASSIGN exitoso"
      echo "   OT #$ALLOCATED_WO_ID devuelta al backlog"
    else
      echo "⚠️  Status inesperado: $STATUS"
    fi
  else
    echo "❌ Error en UNASSIGN"
  fi
fi

echo ""

# ============== FASE 5.5: Testing AUTHORIZATION ==============
echo "🔐 FASE 5.5: Testing AUTHORIZATION (verificación token)"
echo "─────────────────────────────────────────────────"

# Test con token inválido
BAD_TOKEN="invalid_token_12345"
AUTH_TEST=$(curl -s -X GET "http://localhost:80/api/v2/work-orders/coordination/grid" \
  -H "Authorization: Bearer $BAD_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$AUTH_TEST" | tail -1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Authorization check funciona"
  echo "   Token inválido rechazado (401)"
else
  echo "❌ Authorization fallida: Expected 401, got $HTTP_CODE"
fi

echo ""

# ============== RESUMEN ==============
echo "═══════════════════════════════════════════════════════════════"
echo "✅ PRUEBAS API COMPLETADAS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 MANUAL TESTING CHECKLIST:"
echo "   1. Abrir navegador en: http://localhost (o IP del server)"
echo "   2. Navegar a /coordination"
echo "   3. Abrir DevTools (F12) → Console"
echo "   4. Ejecutar tests según TESTING_PLAN_FASE_5_24FEB2026.md"
echo ""
echo "🔍 Qué observar en Console:"
echo "   ✓ Logs '✅ Datos sincronizados desde BD:' cada ~5s"
echo "   ✓ Sin errores 404 o 401"
echo "   ✓ Sin localStorage access (solo sessionStorage)"
echo ""
echo "🎯 Tests Clave:"
echo "   • TC-5.1.1: Polling cada 5s"
echo "   • TC-5.2.1: Búsqueda por ID/cliente"
echo "   • TC-5.3.1: Drag & drop persiste en BD"
echo "   • TC-5.6.1: Unassign funciona"
echo "   • TC-5.9.1: Filtros persistidos en sessionStorage"
echo ""
