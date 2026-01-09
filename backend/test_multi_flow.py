#!/usr/bin/env python3
"""
Script de testing para los 5 flujos de creación de tickets
"""

import httpx
import json
from datetime import datetime

BASE_URL = "http://localhost:8500"
HEADERS = {
    "Content-Type": "application/json",
}

# Token de prueba (generado o extraído del sistema)
# Para testing local, asumimos autenticación básica o sin auth

def test_technical_ticket():
    """Test flujo TECHNICAL - Soporte/Reparación"""
    print("\n" + "="*60)
    print("TEST 1: TECHNICAL - Soporte/Reparación")
    print("="*60)
    
    payload = {
        "ticket_type": "technical",
        "subject": "Velocidad lenta en conexión",
        "description": "El cliente reporta velocidad de descarga baja",
        "priority": "high",
        "connection_id": 1,
    }
    
    try:
        response = httpx.post(f"{BASE_URL}/api/v1/tickets", json=payload, headers=HEADERS)
        print(f"Status: {response.status_code}")
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ Ticket creado: ID={data.get('id')}, Type={data.get('ticket_type')}")
            print(f"   OT Auto-generado: {data.get('work_order_id')}")
            return data.get('id')
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Excepción: {e}")
        return None


def test_installation_ticket():
    """Test flujo INSTALLATION - Alta de servicio"""
    print("\n" + "="*60)
    print("TEST 2: INSTALLATION - Alta de Servicio")
    print("="*60)
    
    payload = {
        "ticket_type": "installation",
        "subject": "Nueva instalación en Calle A",
        "description": "Cliente nuevo solicita instalación de fibra",
        "priority": "medium",
        "destination_connection_id": 20,
        "installation_tech": "fiber",
    }
    
    try:
        response = httpx.post(f"{BASE_URL}/api/v1/tickets", json=payload, headers=HEADERS)
        print(f"Status: {response.status_code}")
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ Ticket creado: ID={data.get('id')}, Type={data.get('ticket_type')}")
            print(f"   Conexión destino: {data.get('destination_connection_id')}")
            print(f"   Tecnología: {data.get('installation_tech')}")
            print(f"   OT Auto-generado: {data.get('work_order_id')}")
            return data.get('id')
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Excepción: {e}")
        return None


def test_withdrawal_ticket():
    """Test flujo WITHDRAWAL - Retiro de servicio"""
    print("\n" + "="*60)
    print("TEST 3: WITHDRAWAL - Retiro de Servicio")
    print("="*60)
    
    payload = {
        "ticket_type": "withdrawal",
        "subject": "Retiro de conexión",
        "description": "Cliente solicita cancelación de servicio",
        "priority": "medium",
        "connection_id": 5,
    }
    
    try:
        response = httpx.post(f"{BASE_URL}/api/v1/tickets", json=payload, headers=HEADERS)
        print(f"Status: {response.status_code}")
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ Ticket creado: ID={data.get('id')}, Type={data.get('ticket_type')}")
            print(f"   Conexión a retirar: {data.get('connection_id')}")
            print(f"   OT Auto-generado: {data.get('work_order_id')}")
            return data.get('id')
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Excepción: {e}")
        return None


def test_relocation_ticket():
    """Test flujo RELOCATION - Cambio de domicilio"""
    print("\n" + "="*60)
    print("TEST 4: RELOCATION - Cambio de Domicilio")
    print("="*60)
    
    payload = {
        "ticket_type": "relocation",
        "subject": "Traslado de servicio",
        "description": "Cliente se muda a nueva dirección",
        "priority": "medium",
        "origin_connection_id": 3,
        "destination_connection_id": 21,
    }
    
    try:
        response = httpx.post(f"{BASE_URL}/api/v1/tickets", json=payload, headers=HEADERS)
        print(f"Status: {response.status_code}")
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ Ticket creado: ID={data.get('id')}, Type={data.get('ticket_type')}")
            print(f"   Conexión origen (retiro): {data.get('origin_connection_id')}")
            print(f"   Conexión destino (instalación): {data.get('destination_connection_id')}")
            print(f"   OT Auto-generado: {data.get('work_order_id')}")
            return data.get('id')
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Excepción: {e}")
        return None


def test_administrative_ticket():
    """Test flujo ADMINISTRATIVE - Trámites administrativos"""
    print("\n" + "="*60)
    print("TEST 5: ADMINISTRATIVE - Trámite Administrativo")
    print("="*60)
    
    payload = {
        "ticket_type": "administrative",
        "subject": "Cambio de plan",
        "description": "Cliente solicita upgrade de plan",
        "priority": "low",
        "administrative_subtype": "plan_change",
        "connection_id": 2,
    }
    
    try:
        response = httpx.post(f"{BASE_URL}/api/v1/tickets", json=payload, headers=HEADERS)
        print(f"Status: {response.status_code}")
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ Ticket creado: ID={data.get('id')}, Type={data.get('ticket_type')}")
            print(f"   Subtipo: {data.get('administrative_subtype')}")
            return data.get('id')
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Excepción: {e}")
        return None


def get_ticket_details(ticket_id):
    """Obtener detalles de un ticket"""
    try:
        response = httpx.get(f"{BASE_URL}/api/v1/tickets/{ticket_id}", headers=HEADERS)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"❌ Error fetching ticket: {e}")
        return None


def main():
    print("\n" + "="*60)
    print("TESTING MULTI-FLOW TICKET CREATION SYSTEM")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = {}
    
    # Test cada flujo
    results['technical'] = test_technical_ticket()
    results['installation'] = test_installation_ticket()
    results['withdrawal'] = test_withdrawal_ticket()
    results['relocation'] = test_relocation_ticket()
    results['administrative'] = test_administrative_ticket()
    
    # Resumen
    print("\n" + "="*60)
    print("RESUMEN DE RESULTADOS")
    print("="*60)
    
    success_count = sum(1 for v in results.values() if v is not None)
    total_count = len(results)
    
    for flow_type, ticket_id in results.items():
        status = "✅ OK" if ticket_id else "❌ FAILED"
        print(f"{flow_type:20} {status}")
        if ticket_id:
            # Obtener detalles
            details = get_ticket_details(ticket_id)
            if details:
                print(f"  ID: {details.get('id')}, Status: {details.get('status')}")
    
    print(f"\nTotal: {success_count}/{total_count} flujos exitosos")
    
    if success_count == total_count:
        print("\n🎉 TODOS LOS TESTS PASARON")
    else:
        print(f"\n⚠️  {total_count - success_count} test(s) fallaron")


if __name__ == "__main__":
    main()
