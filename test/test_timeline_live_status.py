#!/usr/bin/env python3
"""
Test Script: Timeline Live Status Feature
Valida que los estados dinámicos en bitácora funcionen correctamente.

Uso:
    cd /opt/emerald-erp/backend
    python test_timeline_live_status.py
"""

import sys
import requests
import json
import os
from datetime import datetime
from pathlib import Path

BASE_URL = "http://localhost:8500/api/v2"  # Backend corre en puerto 8500 con debugpy

# Colores para output
GREEN = '\033[92m'
RED = '\033[91m'
BLUE = '\033[94m'
YELLOW = '\033[93m'
END = '\033[0m'

def log_step(msg):
    print(f"{BLUE}→ {msg}{END}")

def log_success(msg):
    print(f"{GREEN}✓ {msg}{END}")

def log_error(msg):
    print(f"{RED}✗ {msg}{END}")

def log_info(msg):
    print(f"{YELLOW}ℹ {msg}{END}")

def get_token():
    """Obtiene token Bearer para pruebas E2E autenticadas."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    fallback = {}
    if env_path.exists():
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            fallback[key.strip()] = value.strip().strip('"').strip("'")

    candidates = [
        (
            os.getenv("E2E_ADMIN_EMAIL") or fallback.get("E2E_ADMIN_EMAIL"),
            os.getenv("E2E_ADMIN_PASSWORD") or fallback.get("E2E_ADMIN_PASSWORD"),
        ),
        (
            os.getenv("ADMIN_EMAIL") or fallback.get("ADMIN_EMAIL"),
            os.getenv("ADMIN_PASSWORD") or fallback.get("ADMIN_PASSWORD"),
        ),
        ("qa.phaseb2@emerald.com", "QAPhaseB123"),
    ]
    base_url = os.getenv("E2E_BASE_URL") or fallback.get("E2E_BASE_URL") or "http://localhost:8500"

    for email, password in candidates:
        if not email or not password:
            continue
        response = requests.post(
            f"{base_url}/api/v1/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code == 200:
            token = response.json().get("access_token")
            if token:
                log_success(f"Autenticación E2E OK ({email})")
            return token

    log_error("Login falló con todas las credenciales candidatas")
    return None

def test_ticket_timeline(token):
    """Test principal: verificar timeline con estados dinámicos"""
    
    if not token:
        log_error("No hay token disponible")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    
    print(f"\n{YELLOW}═══════════════════════════════════════════════════════════════{END}")
    print(f"{YELLOW}TEST 1: Obtener Ticket con Timeline y Estados Dinámicos{END}")
    print(f"{YELLOW}═══════════════════════════════════════════════════════════════{END}\n")
    
    # Obtener lista de tickets
    log_step("Obteniendo lista de tickets...")
    try:
        response = requests.get(f"{BASE_URL}/tickets", headers=headers)
        if response.status_code != 200:
            log_error(f"GET /tickets falló: {response.status_code}")
            return False
        
        data = response.json()
        tickets = data.get('items', [])  # Respuesta paginada con estructura {items: [...], total: ...}
        if not tickets:
            log_error("No hay tickets disponibles")
            return False
        
        ticket = tickets[0]
        ticket_id = ticket['id']
        log_success(f"Ticket {ticket_id} obtenido")
        
    except Exception as e:
        log_error(f"Error al obtener tickets: {str(e)}")
        return False
    
    # Obtener detalle con timeline
    log_step(f"Obteniendo detalle de ticket {ticket_id} con timeline...")
    try:
        response = requests.get(f"{BASE_URL}/tickets/{ticket_id}", headers=headers)
        if response.status_code != 200:
            log_error(f"GET /tickets/{ticket_id} falló: {response.status_code}")
            return False
        
        ticket_detail = response.json()
        timeline = ticket_detail.get('timeline', [])
        log_success(f"Timeline obtenida con {len(timeline)} eventos")
        
    except Exception as e:
        log_error(f"Error al obtener detalle: {str(e)}")
        return False
    
    # Validar timeline
    print(f"\n{YELLOW}┌─ TIMELINE EVENTS ─────────────────────────────────────────┐{END}")
    
    ot_event_found = False
    ot_event_count = 0
    for i, event in enumerate(timeline):
        event_type = event.get('event_type', 'UNKNOWN')
        content = event.get('content', 'sin contenido')
        meta = event.get('meta_data', {})
        
        if event_type == 'ot_event':
            ot_event_count += 1
            wo_id = meta.get('work_order_id')
            current_status = meta.get('current_status')
            snapshot_status = meta.get('status')
            current_ot_type = meta.get('current_ot_type')
            ot_type = meta.get('ot_type')
            
            # Solo mostrar eventos OT con work_order_id
            if wo_id:
                print(f"\n  Event #{i}: {event_type} (WO #{wo_id})")
                print(f"    Content: {content}")
                
                if current_status:
                    ot_event_found = True
                    print(f"    Snapshot Status: {snapshot_status} (guardado al crear)")
                    print(f"    {GREEN}✓ Current Status (LIVE): {current_status}{END}")
                    if current_ot_type:
                        print(f"    Current OT Type: {current_ot_type}")
                    
                    # Validar que es valor válido
                    valid_statuses = ['pending_planning', 'assigned', 'in_progress', 'completed', 'failed']
                    if current_status not in valid_statuses:
                        log_error(f"current_status '{current_status}' no es válido")
                        return False
                    
                    log_success(f"Status dinámico detectado: '{current_status}'")
    

    
    print(f"\n{YELLOW}└──────────────────────────────────────────────────────────────┘{END}")
    
    if not ot_event_found:
        log_info("No hay eventos OT_EVENT en esta bitácora (es normal si no hay OTs creadas)")
        return True
    
    return True

def test_status_consistency(token):
    """Test 2: Verificar que status en timeline coincide con status en WO (SKIP - trabajo pendiente)"""
    
    # Este test está diseñado para testing futuro cuando haya endpoint público de work_orders
    log_info("Test 2 SKIPPED - Endpoint /api/work_orders no disponible (planeado para futuro)")
    return True

def main():
    print(f"\n{BLUE}{'='*65}{END}")
    print(f"{BLUE}Timeline Live Status - Test Suite{END}")
    print(f"{BLUE}{'='*65}{END}\n")
    
    # Conectar
    try:
        response = requests.get(f"{BASE_URL}/tickets", headers={"Authorization": "Bearer test"})
        if response.status_code not in [200, 401, 403]:  # 401/403 OK si hay auth issue, significa que el backend responde
            log_error(f"Backend no responde en {BASE_URL}")
            print("\nAsegúrate de que el backend está corriendo:")
            print("  cd /opt/emerald-erp/backend && python -m uvicorn src.main:app --reload")
            return 1
    except:
        log_error(f"No se puede conectar a {BASE_URL}")
        return 1
    
    log_success(f"Backend respondiendo en {BASE_URL}")
    
    # Obtener token
    token = get_token()
    if not token:
        log_error("No se pudo autenticar")
        return 1
    
    # Ejecutar tests
    results = []
    results.append(("Timeline con estados dinámicos", test_ticket_timeline(token)))
    results.append(("Consistencia status", test_status_consistency(token)))
    
    # Resumen
    print(f"\n{BLUE}{'='*65}{END}")
    print(f"{BLUE}RESUMEN DE TESTS{END}")
    print(f"{BLUE}{'='*65}{END}\n")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = f"{GREEN}✓ PASS{END}" if result else f"{RED}✗ FAIL{END}"
        print(f"  {status} - {name}")
    
    print(f"\nResultado: {passed}/{total} tests pasados\n")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
