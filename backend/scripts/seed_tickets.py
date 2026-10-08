#!/usr/bin/env python3
"""
Seed inicial para el módulo de tickets.
- Crea categorías por defecto.
- Opcionalmente crea un ticket de prueba asociado al usuario admin.
"""
import os
import sys
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from src.database import SessionLocal  # type: ignore
from src.models.user import User  # type: ignore
from src.models import Ticket, TicketCategory, TicketPriority, TicketStatus
from src.models.tickets import TicketTimeline, TicketTimelineEventType  # type: ignore

DEFAULT_CATEGORIES = [
    ("Servicio Técnico", "Diagnóstico, reparación y tareas técnicas varias", "technical"),
    ("Administrativo", "Cambios de plan y facturación", "administrative"),
    ("Instalación", "Alta de nuevo servicio al cliente", "installation"),
    ("Instalación Mesh", "Instalación de sistema mesh inalámbrico (routers específicos) sobre conexión existente", "mesh"),
    ("Traslado", "Relocalización del cliente", "relocation"),
    ("Baja", "Cancelación de servicio", "withdrawal"),
    ("Pase a Fibra", "Migración de conexión existente de aire a fibra, con retiro de antena/equipo", "fiber_migration"),
]


def seed_categories(db):
    created = []
    for name, desc, flow_key in DEFAULT_CATEGORIES:
        cat = db.query(TicketCategory).filter(TicketCategory.name == name).first()
        if not cat:
            cat = TicketCategory(name=name, description=desc, flow_key=flow_key)
            db.add(cat)
            db.commit()
            db.refresh(cat)
        elif not cat.flow_key:
            cat.flow_key = flow_key
            db.add(cat)
        created.append(cat)
    return created


def seed_sample_ticket(db, categories):
    admin = db.query(User).filter(User.is_superuser == True).order_by(User.id.asc()).first()
    if not admin:
        print("⚠️ No se encontró usuario admin; se omite ticket de prueba.")
        return

    existing = db.query(Ticket).first()
    if existing:
        print("ℹ️ Ya existen tickets; no se crea ticket de prueba.")
        return

    category = categories[0] if categories else None
    ticket = Ticket(
        subject="Cliente sin servicio - ONU en LOS",
        description="Reporte de corte total desde la medianoche.",
        status=TicketStatus.OPEN,
        priority=TicketPriority.HIGH,
        category_id=category.id if category else None,
        creator_id=admin.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    event = TicketTimeline(
        ticket_id=ticket.id,
        event_type=TicketTimelineEventType.note,
        content="Ticket de prueba creado por seed.",
        author_id=admin.id,
    )
    db.add(event)
    db.commit()
    print(f"✅ Ticket de prueba creado (ID {ticket.id})")


def main():
    db = SessionLocal()
    try:
        cats = seed_categories(db)
        seed_sample_ticket(db, cats)
    finally:
        db.close()


if __name__ == "__main__":
    main()
