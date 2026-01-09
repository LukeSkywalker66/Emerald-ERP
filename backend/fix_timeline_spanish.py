"""Script para traducir eventos históricos del timeline a español"""
import re
from sqlalchemy import text
from src.database import SessionLocal

# Mapeos de traducción
STATUS_MAP = {
    'open': 'Abierto',
    'pending': 'Pendiente',
    'resolved': 'Resuelto',
    'closed': 'Cerrado',
}

PRIORITY_MAP = {
    'low': 'Baja',
    'medium': 'Media',
    'high': 'Alta',
    'critical': 'Crítica',
}

def translate_content(content):
    """Traduce el contenido de un evento al español"""
    
    # Patrón para "Estado cambiado de X a Y"
    status_pattern = r'Estado cambiado de (\w+) a (\w+)'
    match = re.search(status_pattern, content)
    if match:
        old_val, new_val = match.groups()
        old_translated = STATUS_MAP.get(old_val, old_val)
        new_translated = STATUS_MAP.get(new_val, new_val)
        return f'Estado cambiado de {old_translated} a {new_translated}'
    
    # Patrón para "Prioridad cambiada de X a Y"
    priority_pattern = r'Prioridad cambiada de (\w+) a (\w+)'
    match = re.search(priority_pattern, content)
    if match:
        old_val, new_val = match.groups()
        old_translated = PRIORITY_MAP.get(old_val, old_val)
        new_translated = PRIORITY_MAP.get(new_val, new_val)
        return f'Prioridad cambiada de {old_translated} a {new_translated}'
    
    return content

def main():
    db = SessionLocal()
    
    try:
        # Obtener todos los eventos de tipo status_change
        result = db.execute(
            text("SELECT id, content FROM ticket_timeline WHERE event_type = 'status_change'")
        ).fetchall()
        
        print(f"📝 Procesando {len(result)} eventos de timeline...")
        updated = 0
        
        for event_id, content in result:
            new_content = translate_content(content)
            if new_content != content:
                db.execute(
                    text("UPDATE ticket_timeline SET content = :content WHERE id = :id"),
                    {"content": new_content, "id": event_id}
                )
                updated += 1
                print(f"  ✓ [{event_id}] {content} → {new_content}")
        
        db.commit()
        print(f"\n✅ Actualizados {updated} eventos a español")
        
    finally:
        db.close()

if __name__ == '__main__':
    main()
