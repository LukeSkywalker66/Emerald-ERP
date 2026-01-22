#!/bin/bash
# Script de Testing Rápido - Módulo Engineering/NOC
# Ejecutar: bash test_engineering_quick.sh

set -e  # Exit on error

API_BASE="http://localhost:8500/api/v2"
ENGINEERING_API="${API_BASE}/engineering"
TICKETS_API="${API_BASE}/tickets"

echo "🧪 Testing Módulo Engineering/NOC"
echo "=================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Helper function para logs
log_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Test 1: Verificar que el backend esté corriendo
log_step "Test 1: Verificar backend"
if curl -s -f "${API_BASE}/tickets" > /dev/null 2>&1; then
    log_success "Backend responde correctamente"
else
    log_error "Backend no responde. ¿Está corriendo?"
    exit 1
fi
echo ""

# Test 2: Obtener un ticket existente (asumimos ticket #1 existe)
log_step "Test 2: Obtener ticket #1 para testear"
TICKET_RESPONSE=$(curl -s "${TICKETS_API}/1")
TICKET_ID=$(echo "$TICKET_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -n "$TICKET_ID" ]; then
    TICKET_SUBJECT=$(echo "$TICKET_RESPONSE" | grep -o '"subject":"[^"]*"' | head -1 | cut -d'"' -f4)
    ORIGINAL_STATUS=$(echo "$TICKET_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    log_success "Ticket encontrado: #${TICKET_ID} - ${TICKET_SUBJECT}"
    log_info "Estado actual: ${ORIGINAL_STATUS}"
else
    log_error "No se pudo obtener ticket #1. Creando uno nuevo..."
    
    # Crear ticket de prueba
    CREATE_RESPONSE=$(curl -s -X POST "${TICKETS_API}" \
        -H "Content-Type: application/json" \
        -d '{
            "subject": "Test Engineering - Cliente sin servicio",
            "description": "Ticket de prueba para módulo Engineering",
            "priority": "high",
            "status": "open",
            "connection_id": 1
        }')
    
    TICKET_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    log_success "Ticket creado: #${TICKET_ID}"
fi
echo ""

# Test 3: Crear tarea de ingeniería
log_step "Test 3: Crear tarea de ingeniería asociada al ticket #${TICKET_ID}"
CREATE_TASK_RESPONSE=$(curl -s -X POST "${ENGINEERING_API}/tasks" \
    -H "Content-Type: application/json" \
    -d "{
        \"ticket_id\": ${TICKET_ID},
        \"title\": \"[TEST] Revisar conectividad fibra óptica\",
        \"description\": \"Tarea de prueba automática. Cliente reporta pérdida de señal. Verificar niveles de potencia.\",
        \"task_type\": \"incident\",
        \"priority\": \"critical\"
    }")

TASK_ID=$(echo "$CREATE_TASK_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -n "$TASK_ID" ]; then
    log_success "Tarea creada: #${TASK_ID}"
    echo "$CREATE_TASK_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_TASK_RESPONSE"
else
    log_error "Error al crear tarea"
    echo "$CREATE_TASK_RESPONSE"
    exit 1
fi
echo ""

# Test 4: Verificar que ticket cambió a waiting_internal
log_step "Test 4: Verificar estado del ticket después de crear tarea"
sleep 1
TICKET_AFTER=$(curl -s "${TICKETS_API}/${TICKET_ID}")
NEW_STATUS=$(echo "$TICKET_AFTER" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$NEW_STATUS" == "waiting_internal" ]; then
    log_success "Estado del ticket cambió correctamente: ${ORIGINAL_STATUS} → waiting_internal"
else
    log_error "Estado del ticket NO cambió. Actual: ${NEW_STATUS}"
fi
echo ""

# Test 5: Listar tareas del ticket
log_step "Test 5: Listar tareas asociadas al ticket #${TICKET_ID}"
TASKS_LIST=$(curl -s "${ENGINEERING_API}/tasks?ticket_id=${TICKET_ID}")
TASKS_COUNT=$(echo "$TASKS_LIST" | grep -o '"id":' | wc -l)

log_success "Tareas encontradas: ${TASKS_COUNT}"
echo "$TASKS_LIST" | python3 -m json.tool 2>/dev/null || echo "$TASKS_LIST"
echo ""

# Test 6: Actualizar estado de tarea (backlog → in_progress)
log_step "Test 6: Actualizar tarea a 'in_progress'"
UPDATE_RESPONSE=$(curl -s -X PATCH "${ENGINEERING_API}/tasks/${TASK_ID}" \
    -H "Content-Type: application/json" \
    -d '{
        "status": "in_progress"
    }')

UPDATED_STATUS=$(echo "$UPDATE_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$UPDATED_STATUS" == "in_progress" ]; then
    log_success "Tarea actualizada: backlog → in_progress"
    STARTED_AT=$(echo "$UPDATE_RESPONSE" | grep -o '"started_at":"[^"]*"' | head -1 | cut -d'"' -f4)
    log_info "Timestamp de inicio: ${STARTED_AT}"
else
    log_error "No se pudo actualizar estado de tarea"
fi
echo ""

# Test 7a: Pasar tarea a testing (pre-requisito para completar)
log_step "Test 7a: Actualizar tarea a 'testing'"
TESTING_RESPONSE=$(curl -s -X PATCH "${ENGINEERING_API}/tasks/${TASK_ID}" \
    -H "Content-Type: application/json" \
    -d '{
        "status": "testing"
    }')

TESTING_STATUS=$(echo "$TESTING_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$TESTING_STATUS" == "testing" ]; then
    log_success "Tarea en validación: in_progress → testing"
else
    log_error "No se pudo pasar a testing"
fi
echo ""

# Test 7b: Completar tarea
log_step "Test 7b: Completar tarea (debe cambiar ticket a 'attention_required')"
COMPLETE_RESPONSE=$(curl -s -X POST "${ENGINEERING_API}/tasks/${TASK_ID}/complete?resolution_note=Fibra%20reparada.%20Cliente%20online.%20Speedtest%20OK." \
    -H "Content-Type: application/json")

COMPLETED_STATUS=$(echo "$COMPLETE_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$COMPLETED_STATUS" == "completed" ]; then
    log_success "Tarea completada exitosamente"
    RESOLUTION=$(echo "$COMPLETE_RESPONSE" | grep -o '"resolution_note":"[^"]*"' | head -1 | cut -d'"' -f4)
    log_info "Resolución: ${RESOLUTION}"
else
    log_error "No se pudo completar tarea"
    echo "$COMPLETE_RESPONSE"
fi
echo ""

# Test 8: Verificar que ticket cambió a attention_required
log_step "Test 8: Verificar estado final del ticket"
sleep 1
TICKET_FINAL=$(curl -s "${TICKETS_API}/${TICKET_ID}")
FINAL_STATUS=$(echo "$TICKET_FINAL" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$FINAL_STATUS" == "attention_required" ]; then
    log_success "Estado final correcto: waiting_internal → attention_required"
else
    log_error "Estado final incorrecto. Esperado: attention_required, Actual: ${FINAL_STATUS}"
fi
echo ""

# Test 9: Obtener estadísticas
log_step "Test 9: Obtener estadísticas del dashboard"
STATS_RESPONSE=$(curl -s "${ENGINEERING_API}/stats/dashboard")
TOTAL_TASKS=$(echo "$STATS_RESPONSE" | grep -o '"total_tasks":[0-9]*' | head -1 | cut -d: -f2)

log_success "Total de tareas en el sistema: ${TOTAL_TASKS}"
echo "$STATS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATS_RESPONSE"
echo ""

# Test 10: Crear tarea proactiva (sin ticket)
log_step "Test 10: Crear tarea proactiva (sin ticket_id)"
PROACTIVE_RESPONSE=$(curl -s -X POST "${ENGINEERING_API}/tasks" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "[TEST] Mantenimiento preventivo nodo Central",
        "description": "Tarea de mantenimiento programado para verificar equipos.",
        "task_type": "maintenance",
        "priority": "medium",
        "scheduled_date": "2026-01-20T09:00:00Z"
    }')

PROACTIVE_ID=$(echo "$PROACTIVE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
PROACTIVE_TICKET=$(echo "$PROACTIVE_RESPONSE" | grep -o '"ticket_id":[0-9]*' | head -1 | cut -d: -f2)

if [ -n "$PROACTIVE_ID" ] && [ -z "$PROACTIVE_TICKET" ]; then
    log_success "Tarea proactiva creada: #${PROACTIVE_ID} (sin ticket asociado)"
else
    log_error "Error al crear tarea proactiva"
fi
echo ""

# Resumen final
echo ""
echo -e "${PURPLE}=================================="
echo "✨ RESUMEN DE TESTING"
echo -e "==================================${NC}"
echo ""
echo -e "Tarea reactiva: #${TASK_ID} (ticket #${TICKET_ID})"
echo -e "Tarea proactiva: #${PROACTIVE_ID} (sin ticket)"
echo -e "Total de tareas: ${TOTAL_TASKS}"
echo ""
echo -e "${GREEN}✓ Todos los tests completados${NC}"
echo ""
echo "Para limpiar las tareas de prueba:"
echo "  curl -X DELETE ${ENGINEERING_API}/tasks/${TASK_ID}"
echo "  curl -X DELETE ${ENGINEERING_API}/tasks/${PROACTIVE_ID}"
echo ""
