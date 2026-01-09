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
from src.models.ticket import (  # type: ignore
    Ticket,
    TicketCategory,
    TicketEvent,
    TicketEventType,
    TicketPriority,
    TicketStatus,
)

DEFAULT_CATEGORIES = [
    ("Falla Técnica", "Default priority: high"),
    ("Administrativo", "Default priority: low"),
    ("Instalación", "Default priority: medium"),
]


def seed_categories(db):
    created = []
    for name, desc in DEFAULT_CATEGORIES:
        cat = db.query(TicketCategory).filter(TicketCategory.name == name).first()
        if not cat:
            cat = TicketCategory(name=name, description=desc)
            db.add(cat)
            db.commit()
            db.refresh(cat)
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
        title="Cliente sin servicio - ONU en LOS",
        description="Reporte de corte total desde la medianoche.",
        status=TicketStatus.OPEN,
        priority=TicketPriority.HIGH,
        category_id=category.id if category else None,
        creator_id=admin.id,
        customer_id=None,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    event = TicketEvent(
        ticket_id=ticket.id,
        event_type=TicketEventType.CREATED,
        payload={"title": ticket.title},
        user_id=admin.id,
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
