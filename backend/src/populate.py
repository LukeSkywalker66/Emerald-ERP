# backend/src/populate.py
import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
import models

# --- ESTA ES LA LÍNEA MÁGICA QUE FALTABA ---
# Asegura que las tablas existan antes de insertar nada
models.Base.metadata.create_all(bind=engine)
# -------------------------------------------

db = SessionLocal()

print("🌱 Sembrando datos 2.0 (Estructura Completa)...")

# 1. Crear Usuarios (Admin y Tecnicos)
# Verificamos si ya existen para no duplicar si corres el script dos veces
if not db.query(models.User).filter_by(username="admin").first():
    admin = models.User(username="admin", role="admin", password_hash="xxx")
    db.add(admin)
else:
    print("User admin ya existe")
    admin = db.query(models.User).filter_by(username="admin").first()

if not db.query(models.User).filter_by(username="tecnico1").first():
    tecnico = models.User(username="tecnico1", role="tecnico", password_hash="xxx")
    db.add(tecnico)
else:
    print("User tecnico1 ya existe")
    tecnico = db.query(models.User).filter_by(username="tecnico1").first()
    
db.commit()

# 2. Crear Planes
if not db.query(models.Plan).filter_by(name="Fibra 300 Mega").first():
    plan_fibra = models.Plan(name="Fibra 300 Mega", bandwidth_down=300, bandwidth_up=100, price=15000)
    db.add(plan_fibra)
else:
    plan_fibra = db.query(models.Plan).filter_by(name="Fibra 300 Mega").first()

if not db.query(models.Plan).filter_by(name="Aire 20 Mega").first():
    plan_aire = models.Plan(name="Aire 20 Mega", bandwidth_down=20, bandwidth_up=5, price=8000)
    db.add(plan_aire)
else:
    plan_aire = db.query(models.Plan).filter_by(name="Aire 20 Mega").first()

db.commit()

# 3. Crear Clientes y Servicios
datos = [
    {"nombre": "Farmacia Central", "plan": plan_fibra, "ip": "10.10.1.20", "problema": "Corte de Fibra", "prio": "high", "estado": "open"},
    {"nombre": "Juan Perez", "plan": plan_fibra, "ip": "10.10.2.50", "problema": "Cambio de clave Wifi", "prio": "low", "estado": "resolved"},
    {"nombre": "Carlos Gamer", "plan": plan_fibra, "ip": "10.10.5.10", "problema": "Latencia Alta", "prio": "medium", "estado": "in_progress"},
    {"nombre": "Estancia El Ombú", "plan": plan_aire, "ip": "192.168.5.5", "problema": "Antena desalineada", "prio": "high", "estado": "open"},
]

for d in datos:
    # Verificamos existencia por nombre para no explotar
    if not db.query(models.Client).filter_by(name=d["nombre"]).first():
        # Cliente
        cli = models.Client(name=d["nombre"], billing_address="Domicilio Conocido", phone="123456")
        db.add(cli)
        db.commit()
        
        # Servicio (Conexionado)
        serv = models.ClientService(
            client_id=cli.id, 
            plan_id=d["plan"].id, 
            ip_address=d["ip"], 
            installation_address="Mismo que facturacion"
        )
        db.add(serv)
        db.commit()
        
        # Ticket
        t = models.Ticket(
            title=d["problema"],
            description="Detalle del problema reportado por teléfono.",
            priority=d["prio"],
            status=d["estado"],
            category="Tecnico",
            service_id=serv.id,
            creator_id=admin.id,
            assigned_id=tecnico.id if d["estado"] == "in_progress" else None
        )
        db.add(t)
        db.commit()

print("✅ Base de datos poblada con éxito.")
db.close()