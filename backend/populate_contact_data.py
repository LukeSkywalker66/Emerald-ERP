"""
Script para poblar datos de contacto en tickets
"""
import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Usar DATABASE_URL del entorno
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://emerald_owner:6058gef6@db:5432/emerald_stock")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def populate_contact_data():
    db = SessionLocal()
    
    try:
        # Datos de ejemplo
        contact_data = [
            {
                'phone': '3512345678',
                'client_name': 'Juan Pérez',
                'client_dni': '12345678',
                'address': 'Av. Colón 1250',
                'city': 'Córdoba'
            },
            {
                'phone': '3516789012',
                'client_name': 'María González',
                'client_dni': '23456789',
                'address': 'San Martín 456',
                'city': 'Villa Carlos Paz'
            },
            {
                'phone': '3519876543',
                'client_name': 'Carlos Rodríguez',
                'client_dni': '34567890',
                'address': 'Belgrano 789',
                'city': 'Córdoba'
            },
            {
                'phone': '3514567890',
                'client_name': 'Ana López',
                'client_dni': '45678901',
                'address': 'Rivadavia 321',
                'city': 'Alta Gracia'
            },
            {
                'phone': '3517890123',
                'client_name': 'Luis Martínez',
                'client_dni': '56789012',
                'address': 'Independencia 654',
                'city': 'Córdoba'
            },
        ]
        
        # Obtener tickets sin connection_details
        result = db.execute(text("""
            SELECT id FROM tickets 
            WHERE connection_details IS NULL 
            LIMIT :limit
        """), {"limit": len(contact_data)})
        
        ticket_ids = [row[0] for row in result]
        
        if not ticket_ids:
            print("❌ No hay tickets sin connection_details para actualizar")
            return
        
        # Actualizar cada ticket
        for ticket_id, data in zip(ticket_ids, contact_data):
            import json
            db.execute(text("""
                UPDATE tickets
                SET connection_details = :data
                WHERE id = :ticket_id
            """), {
                "ticket_id": ticket_id,
                "data": json.dumps(data)
            })
            print(f"✅ Ticket {ticket_id} actualizado con datos de {data['client_name']}")
        
        db.commit()
        
        # Verificar
        print("\n📊 Tickets con datos de contacto:")
        result = db.execute(text("""
            SELECT 
                id,
                subject,
                connection_details->>'phone' as phone,
                connection_details->>'client_name' as client_name
            FROM tickets
            WHERE connection_details IS NOT NULL
            LIMIT 10
        """))
        
        for row in result:
            print(f"  ID: {row[0]} | {row[1][:40]}... | {row[3]} | {row[2]}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Poblando datos de contacto en tickets...")
    populate_contact_data()
    print("✅ Completado!")
