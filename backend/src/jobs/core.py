# backend/src/jobs/core.py
from datetime import datetime
from database import SessionLocal
from models import SyncLog
from jobs.synchronizers import ispcube_sync, smartolt_sync

def run_safe_sync(source_name, sync_function):
    """
    Wrapper que ejecuta una sincronización y guarda el resultado en la DB.
    """
    db = SessionLocal()
    log_entry = SyncLog(source=source_name, status="RUNNING")
    db.add(log_entry)
    db.commit()
    
    try:
        # Ejecutamos la función del obrero
        stats = sync_function(db)
        
        # Si todo sale bien:
        log_entry.status = "SUCCESS"
        log_entry.records_processed = stats.get("processed", 0)
        log_entry.records_inserted = stats.get("inserted", 0)
        log_entry.records_updated = stats.get("updated", 0)
        
    except Exception as e:
        # Si falla:
        log_entry.status = "ERROR"
        log_entry.error_message = str(e)
        # ACÁ SÍ imprimimos el error completo a la consola para debuggear
        print(f"❌ Error crítico en {source_name}: {e}") 
        
    finally:
        log_entry.end_time = datetime.now()
        db.commit()
        db.close()

def run_nightly_process():
    print("🚀 Iniciando proceso nocturno...")
    
    # 1. Clientes ISPCube
    run_safe_sync("ispcube_clients", ispcube_sync.sync_clients)
    
    # 2. ONUs SmartOLT
    # run_safe_sync("smartolt_onus", smartolt_sync.sync_onus)
    
    print("✅ Proceso finalizado.")

if __name__ == "__main__":
    run_nightly_process()