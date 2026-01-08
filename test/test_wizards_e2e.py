#!/usr/bin/env python3
"""
Test End-to-End del sistema de tickets multi-flow
Valida que los wizards y el backend funcionen correctamente
"""

import requests
import sys
from datetime import datetime

BASE_URL = "http://localhost:8500/api/v2/tickets"

def test_search_connections():
    """Test 1: Búsqueda de conexiones"""
    print("\n🔍 TEST 1: Búsqueda de Conexiones")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/search-connections", params={"query": "test", "limit": 5})
    
    if response.status_code != 200:
        print(f"❌ FAIL: Status {response.status_code}")
        return False
    
    results = response.json()
    print(f"✅ PASS: {len(results)} conexiones encontradas")
    
    if len(results) > 0:
        conn = results[0]
        print(f"   Ejemplo: ID {conn['connection_id']}, {conn['client_name']}")
        print(f"   Dirección: {conn['installation_address']}")
        return conn['connection_id']
    
    return None


def test_create_technical_ticket(connection_id):
    """Test 2: Crear ticket TECHNICAL via wizard"""
    print("\n🔧 TEST 2: Wizard Técnico")
    print("=" * 60)
    
    payload = {
        "ticket_type": "technical",
        "subject": "Test E2E - Sin internet",
        "description": "Cliente reporta pérdida de señal",
        "priority": "high",
        "connection_id": connection_id
    }
    
    response = requests.post(BASE_URL, json=payload)
    
    if response.status_code == 201:
        ticket = response.json()
        print(f"✅ PASS: Ticket #{ticket['id']} creado")
        print(f"   Tipo: {ticket['ticket_type']}")
        print(f"   Subject: {ticket['subject']}")
        return ticket['id']
    else:
        print(f"❌ FAIL: Status {response.status_code}")
        print(f"   {response.text}")
        return None


def test_create_installation_ticket():
    """Test 3: Crear ticket INSTALLATION"""
    print("\n➕ TEST 3: Wizard Instalación")
    print("=" * 60)
    
    # Primero buscar una conexión para destino
    search_resp = requests.get(f"{BASE_URL}/search-connections", params={"query": "test", "limit": 1})
    connections = search_resp.json()
    
    if len(connections) == 0:
        print("⚠️  SKIP: No hay conexiones para usar como destino")
        return None
    
    dest_id = connections[0]['connection_id']
    
    payload = {
        "ticket_type": "installation",
        "subject": f"Test E2E - Nueva instalación",
        "description": "Instalación fibra óptica",
        "priority": "medium",
        "destination_connection_id": dest_id,
        "installation_tech": "fiber"
    }
    
    response = requests.post(BASE_URL, json=payload)
    
    if response.status_code == 201:
        ticket = response.json()
        print(f"✅ PASS: Ticket #{ticket['id']} creado")
        print(f"   Destino: {ticket['destination_connection_id']}")
        print(f"   Tech: {ticket['installation_tech']}")
        
        # Verificar auto-OT
        detail_resp = requests.get(f"{BASE_URL}/{ticket['id']}")
        detail = detail_resp.json()
        wo_count = len(detail.get('work_orders', []))
        print(f"   Work Orders auto-creadas: {wo_count}")
        
        if wo_count > 0:
            print(f"      └─ OT #{detail['work_orders'][0]['id']}: {detail['work_orders'][0]['ot_type']}")
        
        return ticket['id']
    else:
        print(f"❌ FAIL: Status {response.status_code}")
        return None


def test_create_relocation_ticket():
    """Test 4: Crear ticket RELOCATION"""
    print("\n🚚 TEST 4: Wizard Relocation (Mudanza)")
    print("=" * 60)
    
    # Buscar 2 conexiones diferentes
    search_resp = requests.get(f"{BASE_URL}/search-connections", params={"query": "", "limit": 10})
    connections = search_resp.json()
    
    if len(connections) < 2:
        print("⚠️  SKIP: Se necesitan al menos 2 conexiones")
        return None
    
    origin_id = connections[0]['connection_id']
    dest_id = connections[1]['connection_id']
    
    payload = {
        "ticket_type": "relocation",
        "subject": "Test E2E - Mudanza",
        "description": "Cliente se muda de dirección",
        "priority": "medium",
        "origin_connection_id": origin_id,
        "destination_connection_id": dest_id
    }
    
    response = requests.post(BASE_URL, json=payload)
    
    if response.status_code == 201:
        ticket = response.json()
        print(f"✅ PASS: Ticket #{ticket['id']} creado")
        print(f"   Origen: {ticket['origin_connection_id']}")
        print(f"   Destino: {ticket['destination_connection_id']}")
        return ticket['id']
    else:
        print(f"❌ FAIL: Status {response.status_code}")
        return None


def test_create_administrative_ticket(connection_id):
    """Test 5: Crear ticket ADMINISTRATIVE"""
    print("\n📋 TEST 5: Wizard Administrativo")
    print("=" * 60)
    
    payload = {
        "ticket_type": "administrative",
        "subject": "Test E2E - Cambio de plan",
        "description": "Cliente solicita upgrade de plan",
        "priority": "low",
        "connection_id": connection_id,
        "administrative_subtype": "plan_change"
    }
    
    response = requests.post(BASE_URL, json=payload)
    
    if response.status_code == 201:
        ticket = response.json()
        print(f"✅ PASS: Ticket #{ticket['id']} creado")
        print(f"   Subtype: {ticket['administrative_subtype']}")
        return ticket['id']
    else:
        print(f"❌ FAIL: Status {response.status_code}")
        return None


def main():
    print("\n" + "=" * 60)
    print("🧪 TEST END-TO-END: Sistema Multi-Flow Tickets")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Test 1: Search
    connection_id = test_search_connections()
    
    if not connection_id:
        print("\n❌ No se puede continuar sin conexiones disponibles")
        sys.exit(1)
    
    # Test 2-5: Crear tickets de cada tipo
    results = {
        "technical": test_create_technical_ticket(connection_id),
        "installation": test_create_installation_ticket(),
        "relocation": test_create_relocation_ticket(),
        "administrative": test_create_administrative_ticket(connection_id)
    }
    
    # Resumen
    print("\n" + "=" * 60)
    print("📊 RESUMEN")
    print("=" * 60)
    
    passed = sum(1 for v in results.values() if v is not None)
    total = len(results)
    
    for ticket_type, ticket_id in results.items():
        status = "✅" if ticket_id else "❌"
        print(f"{status} {ticket_type.upper()}: {'PASS' if ticket_id else 'FAIL'}")
    
    print(f"\n🎯 Score: {passed}/{total} ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 ¡TODOS LOS TESTS PASARON!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) fallaron")
        sys.exit(1)


if __name__ == "__main__":
    main()
