#!/bin/bash

# ============================================================================
# Rollback Script para Installation Testing
# Elimina el último ticket de instalación y sus conexiones asociadas
# Sin afectar ISPCube (que es productivo)
# ============================================================================

set -e

# Colores para salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración de BD
DB_USER="${POSTGRES_USER:-emerald_owner}"
DB_PASS="${POSTGRES_PASSWORD:-6058gef6}"
DB_NAME="${POSTGRES_DB:-emerald_stock}"
DB_HOST="${POSTGRES_HOST:-db}"
DB_PORT="${POSTGRES_PORT:-5432}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Installation Testing - Rollback Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# ============================================================================
# Función: Listar últimos tickets de instalación
# ============================================================================
list_recent_tickets() {
    echo -e "${YELLOW}📋 Últimos 5 tickets de instalación:${NC}\n"
    
    docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT 
        id,
        subject,
        status,
        destination_connection_id,
        created_at AT TIME ZONE 'America/Argentina/Buenos_Aires' as created_at_arg
    FROM tickets
    WHERE ticket_type = 'installation'
    ORDER BY created_at DESC
    LIMIT 5;
    " | nl -v 1 -s '. '
    
    echo ""
}

# ============================================================================
# Función: Obtener detalles de un ticket
# ============================================================================
get_ticket_details() {
    local ticket_id=$1
    
    docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT 
        id,
        subject,
        destination_connection_id,
        created_at AT TIME ZONE 'America/Argentina/Buenos_Aires' as created_at_arg
    FROM tickets
    WHERE id = $ticket_id;
    "
}

# ============================================================================
# Función: Eliminar ticket y sus datos asociados
# ============================================================================
delete_ticket() {
    local ticket_id=$1
    
    echo -e "${YELLOW}🔍 Obteniendo detalles...${NC}"
    
    # Obtener la conexión asociada
    local conn_id=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT destination_connection_id FROM tickets WHERE id = $ticket_id;
    " | xargs)
    
    if [ -z "$conn_id" ] || [ "$conn_id" = "NULL" ]; then
        echo -e "${YELLOW}ℹ️  El ticket no tiene conexión asociada.${NC}"
        conn_id=""
    fi

    # Resolver customer_id desde la conexión
    local customer_id=""
    local customer_connections_count=0
    local legacy_tickets_count=0
    local customer_phones_count=0
    local customer_emails_count=0
    local should_delete_customer="false"

    if [ -n "$conn_id" ]; then
        customer_id=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT customer_id FROM connections WHERE connection_id = $conn_id;
        " | xargs)

        if [ -n "$customer_id" ] && [ "$customer_id" != "NULL" ]; then
            customer_connections_count=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
                SELECT COUNT(*) FROM connections WHERE customer_id = $customer_id;
            " | xargs)

            legacy_tickets_count=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
                SELECT COUNT(*) FROM tickets_legacy WHERE customer_id = $customer_id;
            " | xargs)

            customer_phones_count=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
                SELECT COUNT(*) FROM clientes_telefonos WHERE customer_id = $customer_id;
            " | xargs)

            customer_emails_count=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
                SELECT COUNT(*) FROM clientes_emails WHERE customer_id = $customer_id;
            " | xargs)

            if [ "$customer_connections_count" -eq 1 ] && [ "$legacy_tickets_count" -eq 0 ]; then
                should_delete_customer="true"
            fi
        else
            customer_id=""
        fi
    fi
    
    # Mostrar lo que se va a eliminar
    echo -e "\n${YELLOW}Datos a eliminar:${NC}"
    echo -e "  • Ticket ID: $ticket_id"
    [ -n "$conn_id" ] && echo -e "  • Connection ID: $conn_id" || echo -e "  • Connection ID: (sin conexión)"
    [ -n "$customer_id" ] && echo -e "  • Customer ID: $customer_id" || echo -e "  • Customer ID: (no aplica)"
    
    # Contar registros asociados
    local timeline_count=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM ticket_timeline WHERE ticket_id = $ticket_id;
    " | xargs)
    
    local events_count=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM ticket_events WHERE ticket_id = $ticket_id;
    " | xargs)
    
    local attachments_count=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = $ticket_id;
    " | xargs)
    
    local tags_count=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM ticket_tags WHERE ticket_id = $ticket_id;
    " | xargs)

    local subscribers_count=0
    if [ -n "$conn_id" ]; then
        subscribers_count=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) FROM subscribers WHERE connection_id = $conn_id;
        " | xargs)
    fi
    
    echo -e "\n${YELLOW}Registros asociados a eliminar:${NC}"
    [ "$timeline_count" -gt 0 ] && echo -e "  • Timeline events: $timeline_count" || true
    [ "$events_count" -gt 0 ] && echo -e "  • Ticket events: $events_count" || true
    [ "$attachments_count" -gt 0 ] && echo -e "  • Attachments: $attachments_count" || true
    [ "$tags_count" -gt 0 ] && echo -e "  • Tags: $tags_count" || true
    [ "$subscribers_count" -gt 0 ] && echo -e "  • Subscribers: $subscribers_count" || true
    [ -z "$conn_id" ] || echo -e "  • Connection row: 1"

    if [ -n "$customer_id" ] && [ "$should_delete_customer" = "true" ]; then
        echo -e "  • Cliente row: 1"
        [ "$customer_phones_count" -gt 0 ] && echo -e "  • Cliente teléfonos: $customer_phones_count" || true
        [ "$customer_emails_count" -gt 0 ] && echo -e "  • Cliente emails: $customer_emails_count" || true
    elif [ -n "$customer_id" ]; then
        echo -e "  • Cliente NO se elimina (conexiones del cliente: $customer_connections_count, tickets_legacy: $legacy_tickets_count)"
    fi
    
    # Confirmación
    echo ""
    read -p "$(echo -e ${YELLOW}¿Confirmar eliminación? \(s/n\):${NC} )" -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${RED}❌ Operación cancelada.${NC}"
        exit 0
    fi
    
    # Ejecutar eliminación en transacción
    echo -e "\n${YELLOW}🗑️  Eliminando...${NC}"
    
    docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" << EOSQL
BEGIN;

-- Delete en orden respetando FKs
DELETE FROM ticket_timeline WHERE ticket_id = $ticket_id;
DELETE FROM ticket_events WHERE ticket_id = $ticket_id;
DELETE FROM ticket_attachments WHERE ticket_id = $ticket_id;
DELETE FROM ticket_tags WHERE ticket_id = $ticket_id;
DELETE FROM tickets WHERE id = $ticket_id;

$(if [ -n "$conn_id" ] && [ "$conn_id" != "NULL" ]; then
    echo "DELETE FROM subscribers WHERE connection_id = $conn_id;"
    echo "DELETE FROM connections WHERE connection_id = $conn_id;"
fi)

$(if [ -n "$customer_id" ] && [ "$should_delete_customer" = "true" ]; then
    echo "DELETE FROM clientes_telefonos WHERE customer_id = $customer_id;"
    echo "DELETE FROM clientes_emails WHERE customer_id = $customer_id;"
    echo "DELETE FROM clientes WHERE id = $customer_id;"
fi)

COMMIT;
EOSQL
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Rollback completado exitosamente${NC}"
        echo -e "\n${BLUE}Resumen de cambios:${NC}"
        echo -e "  ✓ Ticket $ticket_id eliminado"
        [ "$subscribers_count" -gt 0 ] && echo -e "  ✓ Subscribers para conexión $conn_id eliminados" || true
        [ -n "$conn_id" ] && echo -e "  ✓ Conexión $conn_id eliminada" || true
        if [ -n "$customer_id" ] && [ "$should_delete_customer" = "true" ]; then
            echo -e "  ✓ Cliente $customer_id eliminado (alta nueva)"
        elif [ -n "$customer_id" ]; then
            echo -e "  • Cliente $customer_id preservado"
        fi
        echo ""
    else
        echo -e "${RED}❌ Error durante la eliminación${NC}"
        exit 1
    fi
}

# ============================================================================
# MAIN
# ============================================================================

# Verificar si Docker está disponible
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no encontrado. Asegúrate de tener Docker instalado.${NC}"
    exit 1
fi

# Verificar si el contenedor de BD está corriendo
if ! docker ps --filter "name=emerald_db" --format "{{.Names}}" | grep -q emerald_db; then
    echo -e "${RED}❌ Contenedor emerald_db no está corriendo.${NC}"
    exit 1
fi

# Mostrar tickets recientes
list_recent_tickets

# Opciones de usuario
echo -e "${BLUE}Opciones:${NC}"
echo -e "  1. Eliminar el ÚLTIMO ticket de instalación"
echo -e "  2. Ingresar ID específico"
echo -e "  3. Salir"
echo ""

read -p "Selecciona opción (1-3): " option

case $option in
    1)
        # Obtener el último ticket de instalación
        latest_ticket=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT id FROM tickets WHERE ticket_type = 'installation' ORDER BY created_at DESC LIMIT 1;
        " | xargs)
        
        if [ -z "$latest_ticket" ]; then
            echo -e "${RED}❌ No hay tickets de instalación para eliminar.${NC}"
            exit 0
        fi
        
        echo -e "\n${YELLOW}Eliminando ticket ID $latest_ticket...${NC}\n"
        delete_ticket "$latest_ticket"
        ;;
    2)
        read -p "Ingresa el ID del ticket a eliminar: " ticket_id
        
        if ! [[ "$ticket_id" =~ ^[0-9]+$ ]]; then
            echo -e "${RED}❌ ID inválido.${NC}"
            exit 1
        fi
        
        # Verificar que el ticket existe y es de instalación
        ticket_type=$(docker exec emerald_db psql -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT ticket_type FROM tickets WHERE id = $ticket_id;
        " | xargs)
        
        if [ -z "$ticket_type" ]; then
            echo -e "${RED}❌ Ticket $ticket_id no encontrado.${NC}"
            exit 1
        fi
        
        if [ "$ticket_type" != "installation" ]; then
            echo -e "${YELLOW}⚠️  Advertencia: Ticket $ticket_id es de tipo '$ticket_type', no 'installation'.${NC}"
            read -p "¿Continuar? (s/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Ss]$ ]]; then
                echo -e "${RED}Operación cancelada.${NC}"
                exit 0
            fi
        fi
        
        echo ""
        delete_ticket "$ticket_id"
        ;;
    3)
        echo -e "${YELLOW}Saliendo...${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Opción inválida.${NC}"
        exit 1
        ;;
esac
