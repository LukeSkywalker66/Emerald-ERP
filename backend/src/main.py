from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import engine, Base  # <--- IMPORTAR ESTO
import models                      # <--- IMPORTAR TUS MODELOS NUEVOS

# ESTA LINEA ES LA MAGIA:
# Le dice a la base de datos: "Si las tablas no existen, créalas YA basándote en models.py"
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Emerald ERP API")

# Configuración de CORS para que el Frontend (puerto 4000) pueda hablar con el Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción esto se restringe, para la demo dejalo así
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelo de datos (Cómo se ve un ticket)
class Ticket(BaseModel):
    id: int
    cliente: str
    direccion: str
    problema: str
    prioridad: str
    estado: str
    fecha: datetime

@app.get("/")
def read_root():
    return {"system": "Emerald ERP", "status": "Online"}

@app.get("/tickets", response_model=List[Ticket])
def get_tickets():
    # DATOS MOCK: Esto es lo que verá tu jefe.
    # Parecen reales, pero están escritos a mano (hardcodeados).
    return [
        {
            "id": 1054, 
            "cliente": "Empresa Metalúrgica S.A.", 
            "direccion": "Av. San Martín 1200", 
            "problema": "Corte de fibra total. Luz roja en ONU.", 
            "prioridad": "Alta", 
            "estado": "Pendiente",
            "fecha": datetime.now()
        },
        {
            "id": 1055, 
            "cliente": "Juan Perez (Residencial)", 
            "direccion": "Calle Falsa 123", 
            "problema": "Lentitud en Youtube por las noches.", 
            "prioridad": "Baja", 
            "estado": "En Progreso",
            "fecha": datetime.now()
        },
        {
            "id": 1056, 
            "cliente": "Clinica Santa Salud", 
            "direccion": "Ruta 20 km 5", 
            "problema": "Necesitan IP Pública fija para cámaras.", 
            "prioridad": "Media", 
            "estado": "Abierto",
            "fecha": datetime.now()
        }
    ]