import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import engine, Base, get_db
import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Emerald ERP API")

#origins = ["http://localhost:4000", "http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ESQUEMAS DE LECTURA (Lo que sale hacia afuera) ---
class PlanSchema(BaseModel):
    name: str
    bandwidth_down: int
    bandwidth_up: int
    class Config: from_attributes = True

class ClientSchema(BaseModel):
    name: str
    phone: str | None = None
    billing_address: str | None = None
    class Config: from_attributes = True

class ServiceSchema(BaseModel):
    id: int # Necesitamos el ID para seleccionarlo
    ip_address: str | None = None
    installation_address: str | None = None
    client: ClientSchema | None = None
    plan: PlanSchema | None = None
    class Config: from_attributes = True

class TicketResponse(BaseModel):
    id: int
    title: str
    priority: str
    status: str
    category: str | None = None
    description: str | None = None
    created_at: datetime | None = None
    service: ServiceSchema | None = None 
    class Config: from_attributes = True

# --- ESQUEMAS DE CREACIÓN (Lo que entra desde el formulario) ---
class TicketCreate(BaseModel):
    title: str
    description: str
    priority: str
    service_id: int
    # No pedimos status (siempre nace open) ni usuario (hardcodeamos admin por ahora)

# --- ENDPOINTS ---

@app.get("/tickets", response_model=List[TicketResponse])
def get_tickets(db: Session = Depends(get_db)):
    tickets = db.query(models.Ticket).options(
        joinedload(models.Ticket.service).joinedload(models.ClientService.client),
        joinedload(models.Ticket.service).joinedload(models.ClientService.plan)
    ).order_by(models.Ticket.id.desc()).all() # Ordenamos por ID descendente (nuevos arriba)
    return tickets

# NUEVO: Endpoint para llenar el combo de "Seleccionar Servicio/Cliente"
@app.get("/services_options", response_model=List[ServiceSchema])
def get_services_options(db: Session = Depends(get_db)):
    # Traemos solo los servicios activos para que el operador elija
    services = db.query(models.ClientService).options(
        joinedload(models.ClientService.client),
        joinedload(models.ClientService.plan)
    ).all()
    return services

# NUEVO: Endpoint para CREAR el ticket
@app.post("/tickets", response_model=TicketResponse)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    # 1. Creamos el objeto DB
    db_ticket = models.Ticket(
        title=ticket.title,
        description=ticket.description,
        priority=ticket.priority,
        service_id=ticket.service_id,
        status="open",          # Por defecto
        creator_id=1,           # HARDCODE: Asumimos que lo crea el Admin (ID 1)
        created_at=datetime.now()
    )
    # 2. Guardamos
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    
    # 3. Importante: Recargamos relaciones para devolver el JSON completo con Cliente/Plan
    # Si no hacemos esto, el frontend recibe el ticket pero con "service: null" y explota
    ticket_con_datos = db.query(models.Ticket).options(
        joinedload(models.Ticket.service).joinedload(models.ClientService.client),
        joinedload(models.Ticket.service).joinedload(models.ClientService.plan)
    ).filter(models.Ticket.id == db_ticket.id).first()
    
    return ticket_con_datos