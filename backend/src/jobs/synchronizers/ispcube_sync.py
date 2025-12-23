# backend/src/jobs/synchronizers/ispcube_sync.py
import logging
from sqlalchemy.dialects.postgresql import insert
from models import Client, SyncLog  # Importamos tus modelos
from clients import ispcube         # Tu cliente API existente

logger = logging.getLogger(__name__)

def sync_clients(db_session):
    """
    Se encarga SOLAMENTE de sincronizar clientes de ISPCube.
    Retorna un dict con estadísticas para el log.
    """
    stats = {"processed": 0, "inserted": 0, "updated": 0}
    
    # 1. Extract (Extraer)
    raw_data = ispcube.obtener_clientes() # [cite: 55, 383]
    stats["processed"] = len(raw_data)

    # 2. Load (Cargar)
    for data in raw_data:
        # Lógica de Upsert (Insertar o Actualizar)
        client = db_session.query(Client).filter(Client.source_id == data['id']).first()
        
        if not client:
            client = Client(source_id=data['id'])
            db_session.add(client)
            stats["inserted"] += 1
        else:
            stats["updated"] += 1
            
        # Actualizamos datos y guardamos el JSON crudo
        client.name = data.get('name')
        client.raw_data = data 
        
    db_session.commit()
    return stats