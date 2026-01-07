#!/usr/bin/env python3
"""
Script de backfill para rehidratar snapshots de conexión en OTs existentes.
Uso: python scripts/backfill_work_orders_snapshots.py
"""
import sys
import os
from pathlib import Path

# Agregar path del backend al sys.path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy import text
from sqlalchemy.orm.attributes import flag_modified
from src.database import SessionLocal
from src.models.tickets import WorkOrder
from src.routers.work_orders_snapshot_helper import build_connection_snapshot


def backfill_snapshots(dry_run=False):
    """Rehidrata snapshots de conexión en OTs que no los tienen."""
    db = SessionLocal()
    
    try:
        # Obtener OTs sin snapshot
        work_orders = db.query(WorkOrder).all()
        
        updated_count = 0
        skipped_count = 0
        failed_count = 0
        
        for wo in work_orders:
            # Verificar si ya tiene snapshot
            custom_data = wo.custom_data or {}
            if custom_data.get("connection"):
                skipped_count += 1
                continue
            
            # Intentar construir snapshot desde connection_id
            connection_id = custom_data.get("connection_id")
            if not connection_id:
                print(f"⚠️  OT #{wo.id}: sin connection_id, omitiendo")
                skipped_count += 1
                continue
            
            # Construir snapshot
            snapshot = build_connection_snapshot(db, connection_id)
            
            if not snapshot:
                print(f"❌ OT #{wo.id}: no se pudo construir snapshot (connection_id={connection_id})")
                failed_count += 1
                continue
            
            # Actualizar custom_data (importante: flag_modified para JSONB)
            if not dry_run:
                custom_data["connection"] = snapshot
                wo.custom_data = custom_data
                flag_modified(wo, "custom_data")  # 🔥 Necesario para JSONB
                db.flush()
            
            print(f"✅ OT #{wo.id}: snapshot rehidratado ({snapshot.get('client_name')} - {snapshot.get('pppoe_username')})")
            updated_count += 1
        
        if not dry_run:
            db.commit()
            print(f"\n🎉 Backfill completado:")
        else:
            print(f"\n🔍 DRY RUN completado:")
        
        print(f"   - Actualizadas: {updated_count}")
        print(f"   - Omitidas (ya tenían snapshot): {skipped_count}")
        print(f"   - Fallidas: {failed_count}")
        
    except Exception as e:
        db.rollback()
        print(f"\n💥 Error durante backfill: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Backfill de snapshots de conexión en OTs")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Ejecutar sin modificar la BD (solo mostrar lo que se haría)"
    )
    
    args = parser.parse_args()
    
    print("🚀 Iniciando backfill de snapshots de conexión en Work Orders...")
    if args.dry_run:
        print("⚠️  MODO DRY RUN - No se modificará la base de datos\n")
    
    backfill_snapshots(dry_run=args.dry_run)
