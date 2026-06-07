"""
📦 Provisioning Script - Seed Data para Emerald ERP
====================================================

Uso:
  # Local (entorno virtual)
  cd backend && python scripts/provision_seed_data.py

  # Docker (desarrollo)
  docker exec emerald_backend_dev python scripts/provision_seed_data.py

  # Staging/Producción
  docker exec emerald_backend_staging python scripts/provision_seed_data.py

Este script es IDEMPOTENTE: se puede ejecutar múltiples veces sin duplicar datos.
"""
import sys
import os

# Asegurar que podemos importar desde src/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import SessionLocal
from src.models.inventory import Warehouse, WarehouseType
from src.models.work_order_types import WorkOrderTypeConfig, WOAction
from sqlalchemy import text


def seed_virtual_warehouse(db):
    """Crea el warehouse VIRTUAL para equipos instalados en cliente."""
    existing = db.query(Warehouse).filter(Warehouse.type == WarehouseType.VIRTUAL).first()
    if existing:
        print(f"  ✅ VIRTUAL warehouse ya existe: id={existing.id}, name='{existing.name}'")
        return existing.id

    wh = Warehouse(
        name="Equipos Instalados en Cliente",
        type=WarehouseType.VIRTUAL,
    )
    db.add(wh)
    db.flush()
    print(f"  ✅ VIRTUAL warehouse creado: id={wh.id}, name='{wh.name}'")
    return wh.id


def seed_work_order_types(db):
    """Crea/actualiza los tipos base de OT."""
    BASE_TYPES = [
        {"code": "install_ftth", "name": "Instalación FTTH",
         "description": "Instalación de fibra óptica hasta el hogar",
         "color": "bg-blue-600", "icon": "Zap", "is_active": True},
        {"code": "install_aire", "name": "Instalación Aire",
         "description": "Instalación de antena/radio enlace",
         "color": "bg-sky-600", "icon": "Wifi", "is_active": True},
        {"code": "repair", "name": "Reclamo",
         "description": "Soporte técnico y reparaciones",
         "color": "bg-emerald-600", "icon": "Wrench", "is_active": True},
        {"code": "pickup", "name": "Baja",
         "description": "Retiro de equipos y baja de servicio",
         "color": "bg-rose-600", "icon": "Package", "is_active": True},
        {"code": "infrastructure", "name": "Infraestructura",
         "description": "Trabajos de cuadrilla en postes y red",
         "color": "bg-purple-600", "icon": "TowerControl", "is_active": True},
    ]

    count = 0
    for t in BASE_TYPES:
        existing = db.query(WorkOrderTypeConfig).filter(
            WorkOrderTypeConfig.code == t["code"]
        ).first()
        if existing:
            for key, val in t.items():
                setattr(existing, key, val)
            print(f"  🔄 OT type '{t['code']}' actualizado")
        else:
            db.add(WorkOrderTypeConfig(**t))
            print(f"  ✅ OT type '{t['code']}' creado")
        count += 1

    db.flush()


def seed_wo_actions(db):
    """Crea las acciones de resolución por tipo de OT."""
    SEED_ACTIONS = [
        # Instalación FTTH
        {"ot_type": "install_ftth", "code": "realizada", "name": "Realizada",
         "description": None, "requires_notes": False, "sort_order": 0, "is_builtin": True},
        {"ot_type": "install_ftth", "code": "no_realizada", "name": "No Realizada",
         "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
        # Instalación Aire
        {"ot_type": "install_aire", "code": "realizada", "name": "Realizada",
         "description": None, "requires_notes": False, "sort_order": 0, "is_builtin": True},
        {"ot_type": "install_aire", "code": "no_realizada", "name": "No Realizada",
         "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
        # Baja (Pickup)
        {"ot_type": "pickup", "code": "realizada", "name": "Realizada",
         "description": None, "requires_notes": False, "sort_order": 0, "is_builtin": True},
        {"ot_type": "pickup", "code": "no_realizada", "name": "No Realizada",
         "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
        # Reclamo (Repair)
        {"ot_type": "repair", "code": "reconfiguracion", "name": "Reconfiguración",
         "description": "Reconfigurar equipo reseteado o cambiar clave WiFi",
         "requires_notes": False, "sort_order": 0, "is_builtin": False},
        {"ot_type": "repair", "code": "reemplazo_equipo", "name": "Reemplazo de equipo",
         "description": "Cambiar ONU, router u otro equipo",
         "requires_notes": False, "sort_order": 1, "is_builtin": False},
        {"ot_type": "repair", "code": "reemplazo_cable", "name": "Reemplazo de cable",
         "description": "Cambiar drop, UTP u otro cableado",
         "requires_notes": False, "sort_order": 2, "is_builtin": False},
        {"ot_type": "repair", "code": "reemplazo_conectores", "name": "Reemplazo de conectores",
         "description": "Cambiar conectores verdes, RJ45, etc.",
         "requires_notes": False, "sort_order": 3, "is_builtin": False},
        {"ot_type": "repair", "code": "agregar_mesh", "name": "Agregar Mesh",
         "description": "Instalar equipo mesh adicional",
         "requires_notes": False, "sort_order": 4, "is_builtin": False},
        {"ot_type": "repair", "code": "configurar_tv", "name": "Configurar TV",
         "description": "Configurar Smart TV u otro dispositivo",
         "requires_notes": False, "sort_order": 5, "is_builtin": False},
        {"ot_type": "repair", "code": "no_realizada", "name": "No Realizada",
         "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
        # Infraestructura
        {"ot_type": "infrastructure", "code": "realizada", "name": "Realizada",
         "description": None, "requires_notes": False, "sort_order": 0, "is_builtin": True},
        {"ot_type": "infrastructure", "code": "no_realizada", "name": "No Realizada",
         "description": None, "requires_notes": True, "sort_order": 99, "is_builtin": True},
    ]

    VALID_RESOLUTION_CATEGORIES = [
        "infrastructure", "equipment", "configuration",
        "incomplete", "other",
    ]

    count_created = 0
    count_updated = 0
    for a in SEED_ACTIONS:
        existing = db.query(WOAction).filter(
            WOAction.ot_type == a["ot_type"],
            WOAction.code == a["code"],
        ).first()
        if existing:
            for key, val in a.items():
                setattr(existing, key, val)
            count_updated += 1
        else:
            db.add(WOAction(**a))
            count_created += 1

    db.flush()

    # Fix: cualquier work_order con resolution_category inválido → 'other'
    fixed = db.execute(text("""
        UPDATE work_orders
        SET resolution_category = 'other'
        WHERE resolution_category IS NOT NULL
        AND resolution_category NOT IN :valid_cats
    """), {"valid_cats": tuple(VALID_RESOLUTION_CATEGORIES)})
    db.flush()

    print(f"  ✅ Acciones: {count_created} creadas, {count_updated} actualizadas")
    if fixed.rowcount:
        print(f"  🔧 {fixed.rowcount} work_orders con categoría inválida corregidas → 'other'")


def main():
    print("=" * 60)
    print("📦 Emerald ERP - Provisioning de Datos Semilla")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 1. VIRTUAL warehouse
        print("\n🏭 1. Warehouse VIRTUAL")
        print("-" * 40)
        seed_virtual_warehouse(db)

        # 2. Work Order Types
        print("\n📋 2. Tipos de OT")
        print("-" * 40)
        seed_work_order_types(db)

        # 3. WO Actions
        print("\n⚡ 3. Acciones de Resolución (WO Actions)")
        print("-" * 40)
        seed_wo_actions(db)

        # Commit final
        db.commit()
        print("\n" + "=" * 60)
        print("✅ Provisioning completado exitosamente")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error durante provisioning: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
