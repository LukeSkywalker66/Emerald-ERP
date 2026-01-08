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
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v2"

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
    """Obtener JWT token de prueba (admin por defecto)"""
    log_step("Obteniendo token...")
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "admin@emerald.local",
            "password": "admin123"  # Cambiar si es diferente
        })
        if response.status_code == 200:
            token = response.json()['access_token']
            log_success(f"Token obtenido: {token[:20]}...")
            return token
        else:
            log_error(f"Error al obtener token: {response.status_code}")
            return None
    except Exception as e:
        log_error(f"Excepción: {str(e)}")
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
        
        tickets = response.json()
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
    for i, event in enumerate(timeline):
        event_type = event.get('event_type', 'UNKNOWN')
        content = event.get('content', 'sin contenido')
        meta = event.get('meta_data', {})
        
        print(f"\n  Event #{i}: {event_type}")
        print(f"    Content: {content}")
        
        if event_type == 'OT_EVENT':
            ot_event_found = True
            wo_id = meta.get('work_order_id')
            current_status = meta.get('current_status', 'N/A')
            current_ot_type = meta.get('current_ot_type', 'N/A')
            
            print(f"    WO ID: {wo_id}")
            print(f"    {GREEN}Current Status (LIVE): {current_status}{END}")
            print(f"    Current OT Type: {current_ot_type}")
            
            # Validar que current_status existe
            if not current_status or current_status == 'N/A':
                log_error("current_status NO encontrado en meta_data (feature podría no estar funcionando)")
                return False
            
            # Validar que es valor válido
            valid_statuses = ['pending_planning', 'assigned', 'in_progress', 'completed', 'failed']
            if current_status not in valid_statuses:
                log_error(f"current_status '{current_status}' no es válido")
                return False
            
            log_success(f"OT_EVENT con status dinámico correcto: '{current_status}'")
    
    print(f"\n{YELLOW}└──────────────────────────────────────────────────────────────┘{END}")
    
    if not ot_event_found:
        log_info("No hay eventos OT_EVENT en esta bitácora (es normal si no hay OTs creadas)")
        return True
    
    return True

def test_status_consistency(token):
    """Test 2: Verificar que status en timeline coincide con status en WO"""
    
    if not token:
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n{YELLOW}═══════════════════════════════════════════════════════════════{END}")
    print(f"{YELLOW}TEST 2: Consistencia entre Timeline y Work Orders{END}")
    print(f"{YELLOW}═══════════════════════════════════════════════════════════════{END}\n")
    
    # Obtener trabajo orders
    log_step("Obteniendo lista de work orders...")
    try:
        response = requests.get(f"{BASE_URL}/work_orders", headers=headers)
        if response.status_code != 200:
            log_error(f"GET /work_orders falló: {response.status_code}")
            return False
        
        work_orders = response.json()
        if not work_orders:
            log_info("No hay work orders disponibles")
            return True
        
        log_success(f"{len(work_orders)} work orders obtenidas")
        
    except Exception as e:
        log_error(f"Error: {str(e)}")
        return False
    
    # Para cada WO, buscar su evento en ticket y comparar status
    mismatches = []
    for wo in work_orders[:3]:  # Testear primeras 3 para no spam
        wo_id = wo['id']
        wo_status = wo['status']
        ticket_id = wo.get('ticket_id')
        
        if not ticket_id:
            continue
        
        log_step(f"Verificando WO #{wo_id} (status={wo_status}) en Ticket #{ticket_id}")
        
        try:
            response = requests.get(f"{BASE_URL}/tickets/{ticket_id}", headers=headers)
            if response.status_code != 200:
                continue
            
            timeline = response.json().get('timeline', [])
            
            # Buscar evento para esta WO
            for event in timeline:
                if event.get('event_type') == 'OT_EVENT':
                    meta = event.get('meta_data', {})
                    if meta.get('work_order_id') == wo_id:
                        timeline_status = meta.get('current_status')
                        
                        if timeline_status == wo_status:
                            log_success(f"✓ Coincide: WO status='{wo_status}' → timeline current_status='{timeline_status}'")
                        else:
                            log_error(f"✗ Mismatch: WO status='{wo_status}' ≠ timeline='{timeline_status}'")
                            mismatches.append({
                                'wo_id': wo_id,
                                'wo_status': wo_status,
                                'timeline_status': timeline_status
                            })
                        break
        
        except Exception as e:
            log_info(f"Skipped: {str(e)}")
    
    if mismatches:
        log_error(f"Se encontraron {len(mismatches)} inconsistencias:")
        for m in mismatches:
            print(f"  WO #{m['wo_id']}: {m['wo_status']} ≠ {m['timeline_status']}")
        return False
    
    return True

def main():
    print(f"\n{BLUE}{'='*65}{END}")
    print(f"{BLUE}Timeline Live Status - Test Suite{END}")
    print(f"{BLUE}{'='*65}{END}\n")
    
    # Conectar
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code != 200:
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
