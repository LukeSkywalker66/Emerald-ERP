import sys
import os
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime

# Path setup para que Python encuentre 'src'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Imports de Emerald
from src.database import engine, Base, get_db
from src import models
from src import config

# 👇 IMPORTAMOS EL NUEVO SERVICIO (Tu lógica adaptada)
from src.services import diagnosis as diagnosis_service 

# Inicializar tablas DB
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Emerald ERP + Beholder")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MIDDLEWARE DE SEGURIDAD ---
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # Dejamos pasar libre al Frontend y a la Demo
    whitelist = [
        "/docs", "/redoc", "/openapi.json", 
        "/tickets", "/services_options", # Emerald CRM
        "/search", "/diagnosis", "/live", "/health", "/" # Beholder UI
    ]
    
    if request.method == "OPTIONS" or any(request.url.path.startswith(p) for p in whitelist):
        return await call_next(request)
    
    # Para bots o scripts externos, pedimos API KEY
    key = request.headers.get("x-api-key")
    if getattr(config, 'API_KEY', None) and key != config.API_KEY:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    
    return await call_next(request)

from pydantic import BaseModel
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
    ).order_by(models.Ticket.id.desc()).all()
    return tickets

@app.get("/services_options", response_model=List[ServiceSchema])
def get_services_options(db: Session = Depends(get_db)):
    services = db.query(models.ClientService).options(
        joinedload(models.ClientService.client),
        joinedload(models.ClientService.plan)
    ).all()
    return services

@app.post("/tickets", response_model=TicketResponse)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    db_ticket = models.Ticket(
        title=ticket.title, description=ticket.description, priority=ticket.priority,
        service_id=ticket.service_id, status="open", creator_id=1, created_at=datetime.now()
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db.query(models.Ticket).options(
        joinedload(models.Ticket.service).joinedload(models.ClientService.client),
        joinedload(models.Ticket.service).joinedload(models.ClientService.plan)
    ).filter(models.Ticket.id == db_ticket.id).first()

# ==========================
# 🔵 SECCIÓN BEHOLDER (Monitor)
# ==========================

@app.get("/health")
def health():
    return {"status": "ok", "system": "Emerald Core + Beholder"}

@app.get("/search")
def search_endpoint(q: str):
    # Ahora llamamos al servicio limpio
    return diagnosis_service.search_clients(q)

@app.get("/diagnosis/{pppoe_user}")
def diagnosis_endpoint(pppoe_user: str):
    # La lógica pesada está en src/services/diagnosis.py
    result = diagnosis_service.consultar_diagnostico(pppoe_user)
    if "error" in result and not result.get("pppoe_username"):
         # Si devolvió error puro sin datos parciales, es un 404 real
         raise HTTPException(status_code=404, detail=result["error"])
    return result

@app.get("/live/{pppoe_user}")
def live_traffic_endpoint(pppoe_user: str):
    result = diagnosis_service.get_live_traffic(pppoe_user)
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("detail"))
    return result