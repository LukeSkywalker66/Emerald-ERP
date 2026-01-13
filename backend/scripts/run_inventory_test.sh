#!/bin/bash
# 🧪 Script para ejecutar Smoke Test del Módulo de Inventario
# Proporciona múltiples formas de ejecutar el test según el contexto

set -e  # Exit on error

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# FUNCIONES
# ============================================================================

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}→ $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

show_usage() {
    cat << 'EOF'

📖 USO:
    ./scripts/run_inventory_test.sh [MODO] [BASE_URL]

📌 MODOS:
    local       → Ejecutar en host (requiere que backend esté en localhost:8000)
    docker      → Ejecutar dentro del contenedor emerald_backend 
    docker-dev  → Ejecutar en contenedor de desarrollo (con reload)
    
📋 EJEMPLOS:
    ./scripts/run_inventory_test.sh local
    ./scripts/run_inventory_test.sh local http://localhost:8500
    ./scripts/run_inventory_test.sh docker
    ./scripts/run_inventory_test.sh docker http://backend:8500

EOF
}

# ============================================================================
# MODO: Ejecutar Localmente
# ============================================================================

run_local() {
    local base_url="${1:-http://localhost:8000}"
    
    print_header "SMOKE TEST - MODO LOCAL"
    print_info "Base URL: $base_url"
    print_info "Requiere que el backend esté corriendo localmente\n"
    
    # Verificar si Python3 está disponible
    if ! command -v python3 &> /dev/null; then
        print_error "Python3 no está instalado"
        echo "  Instala con: apt-get install python3"
        return 1
    fi
    
    # Verificar si requests está disponible
    if ! python3 -c "import requests" 2>/dev/null; then
        print_warning "requests no está instalado, instalando..."
        pip3 install requests
    fi
    
    # Verificar conectividad
    print_info "Verificando conectividad a $base_url..."
    if ! curl -s "$base_url/api/health" > /dev/null 2>&1; then
        print_error "No se puede conectar a $base_url"
        echo "  Verifica que el backend esté corriendo"
        return 1
    fi
    print_success "Conectividad verificada\n"
    
    # Ejecutar test
    print_info "Ejecutando test...\n"
    python3 "$(dirname "$0")/test_inventory_smoke.py" "$base_url"
}

# ============================================================================
# MODO: Ejecutar en Docker
# ============================================================================

run_docker() {
    local base_url="${1:-http://backend:8500}"
    
    print_header "SMOKE TEST - MODO DOCKER"
    print_info "Base URL: $base_url"
    print_info "Ejecutando dentro del contenedor emerald_backend\n"
    
    # Verificar que docker está disponible
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        return 1
    fi
    
    # Verificar que el contenedor existe
    if ! docker ps --filter "name=emerald_backend" --quiet | grep -q .; then
        print_error "Contenedor 'emerald_backend' no está corriendo"
        echo "  Inicia con: docker compose up -d"
        return 1
    fi
    print_success "Contenedor 'emerald_backend' encontrado\n"
    
    # Ejecutar test dentro del contenedor
    print_info "Ejecutando test en contenedor...\n"
    docker exec -it emerald_backend python3 /app/scripts/test_inventory_smoke.py "$base_url"
}

# ============================================================================
# MODO: Ejecutar en Docker Dev
# ============================================================================

run_docker_dev() {
    local base_url="${1:-http://backend:8500}"
    
    print_header "SMOKE TEST - MODO DOCKER DEV"
    print_info "Base URL: $base_url"
    print_info "Ejecutando en modo interactivo con reload\n"
    
    # Verificar que docker está disponible
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        return 1
    fi
    
    # Verificar que el contenedor existe
    if ! docker ps --filter "name=emerald_backend" --quiet | grep -q .; then
        print_error "Contenedor 'emerald_backend' no está corriendo"
        echo "  Inicia con: docker compose up -d"
        return 1
    fi
    print_success "Contenedor 'emerald_backend' encontrado\n"
    
    # Ejecutar test en modo interactivo
    print_info "Ejecutando test en contenedor (modo interactivo)...\n"
    docker exec -it \
        -e PYTHONUNBUFFERED=1 \
        emerald_backend \
        python3 -u /app/scripts/test_inventory_smoke.py "$base_url"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    local mode="${1:-docker}"
    local base_url="${2:-}"
    
    case "$mode" in
        local)
            run_local "$base_url"
            ;;
        docker)
            run_docker "$base_url"
            ;;
        docker-dev)
            run_docker_dev "$base_url"
            ;;
        help|--help|-h|"")
            show_usage
            ;;
        *)
            print_error "Modo desconocido: $mode"
            show_usage
            return 1
            ;;
    esac
}

# Ejecutar
main "$@"
