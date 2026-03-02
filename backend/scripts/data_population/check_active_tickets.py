"""
Script para verificar qué tickets tienen work orders activos
y poblarlos con datos de contacto
"""
import sys
import os
from pathlib import Path

# Agregar el directorio src al path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir / "src"))

from database import SessionLocal
from models.work_orders import WorkOrder
from models.tickets import Ticket
from sqlalchemy import select

def check_and_populate():
    """Ver qué tickets necesitan contact_info"""
    session = SessionLocal()
    
    try:
        # Obtener todos los work orders activos
        stmt = (
            select(WorkOrder.ticket_id, Ticket.subject, Ticket.connection_details)
            .join(Ticket, WorkOrder.ticket_id == Ticket.id)
            .where(WorkOrder.status.in_(['pending', 'in_progress']))
            .distinct()
        )
        
        results = session.execute(stmt).all()
        
        print(f"\n📊 Work Orders Activos: {len(results)}")
        print("-" * 80)
        
        tickets_to_populate = []
        for ticket_id, subject, connection_details in results:
            has_contact = connection_details is not None
            status = "✅" if has_contact else "❌"
            print(f"{status} Ticket #{ticket_id}: {subject[:50]} | Contact: {has_contact}")
            
            if not has_contact:
                tickets_to_populate.append(ticket_id)
        
        print(f"\n🔧 Tickets que necesitan datos de contacto: {len(tickets_to_populate)}")
        print(f"IDs: {tickets_to_populate}")
        
        # Poblar los tickets que faltan
        if tickets_to_populate:
            print("\n📝 Poblando datos de contacto...")
            
            ciudades = ["Córdoba", "Villa Carlos Paz", "Alta Gracia", "Río Cuarto", "Villa María"]
            nombres = ["Juan Pérez", "María González", "Carlos Rodríguez", "Ana López", "Luis Martínez", 
                      "Sofia Torres", "Diego Fernández", "Laura Sánchez", "Pablo Castro", "Elena Romero"]
            
            for idx, ticket_id in enumerate(tickets_to_populate):
                ticket = session.get(Ticket, ticket_id)
                if ticket:
                    phone_base = 3510000000 + (ticket_id * 12345)
                    ticket.connection_details = {
                        "phone": f"{phone_base}",
                        "client_name": nombres[idx % len(nombres)],
                        "client_dni": f"{20000000 + ticket_id * 100000}",
                        "address": f"Calle Falsa {ticket_id * 100}, Barrio Test",
                        "city": ciudades[idx % len(ciudades)]
                    }
                    print(f"  ✅ Ticket #{ticket_id}: {ticket.connection_details['client_name']} - {ticket.connection_details['city']}")
            
            session.commit()
            print(f"\n✅ {len(tickets_to_populate)} tickets actualizados")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    check_and_populate()
