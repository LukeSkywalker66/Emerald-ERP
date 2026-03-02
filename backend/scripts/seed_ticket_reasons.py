"""
Script para poblar motivos de ticket (ticket_reasons) en la base de datos.

Ejecutar con: python -m scripts.seed_ticket_reasons
"""
import sys
from pathlib import Path

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from src.database import SessionLocal
from src.models.tickets import TicketCategory, TicketReason


def seed_ticket_reasons():
    """
    Pobla los motivos de ticket según la estructura especificada:
    
    - Falla Técnica: 'Sin Servicio', 'Intermitencia/Microcortes', 'Lentitud', 'Problema WiFi'
    - Administrativo: 'Cambio de Plan/Servicio', 'Cambio de Titularidad', 'Facturación'
    - Traslado: 'Traslado Interno', 'Traslado a otro domicilio'
    - Baja: 'Precio/Competencia', 'Disconformidad Técnica', 'Mudanza', 'Fallecimiento'
    - Instalación: (Sin motivos por ahora)
    """
    db = SessionLocal()
    
    try:
        # Mapeo de categorías y sus motivos
        category_reasons = {
            "Falla Técnica": [
                "Sin Servicio",
                "Intermitencia/Microcortes",
                "Lentitud",
                "Problema WiFi"
            ],
            "Administrativo": [
                "Cambio de Plan/Servicio",
                "Cambio de Titularidad",
                "Facturación"
            ],
            "Traslado": [
                "Traslado Interno",
                "Traslado a otro domicilio"
            ],
            "Baja": [
                "Precio/Competencia",
                "Disconformidad Técnica",
                "Mudanza",
                "Fallecimiento"
            ],
            # Instalación no tiene motivos por ahora
        }
        
        reasons_created = 0
        reasons_skipped = 0
        
        for category_name, reason_names in category_reasons.items():
            # Buscar la categoría por nombre
            stmt = select(TicketCategory).where(TicketCategory.name == category_name)
            category = db.execute(stmt).scalar_one_or_none()
            
            if not category:
                print(f"⚠️  Categoría '{category_name}' no encontrada, saltando motivos...")
                continue
            
            print(f"\n📂 Procesando categoría: {category_name} (ID: {category.id})")
            
            for reason_name in reason_names:
                # Verificar si el motivo ya existe
                stmt = select(TicketReason).where(
                    TicketReason.name == reason_name,
                    TicketReason.category_id == category.id
                )
                existing = db.execute(stmt).scalar_one_or_none()
                
                if existing:
                    print(f"   ⏭️  '{reason_name}' ya existe")
                    reasons_skipped += 1
                    continue
                
                # Crear el motivo
                reason = TicketReason(
                    name=reason_name,
                    category_id=category.id
                )
                db.add(reason)
                print(f"   ✅ Creado: '{reason_name}'")
                reasons_created += 1
        
        # Commit de todos los cambios
        db.commit()
        
        print(f"\n{'='*60}")
        print(f"✅ Seed completado:")
        print(f"   • {reasons_created} motivos creados")
        print(f"   • {reasons_skipped} motivos ya existían")
        print(f"{'='*60}\n")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error durante el seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("\n🌱 Iniciando seed de motivos de ticket...\n")
    seed_ticket_reasons()
