# backend/src/seed.py
from database import SessionLocal, engine, Base
from models import User, Client, Plan, ClientService, Ticket
from passlib.context import CryptContext
from datetime import datetime

# Configuración para hashear passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def seed_data():
    db = SessionLocal()
    
    # 1. Verificar si ya existen datos para no duplicar
    if db.query(User).filter(User.username == "lucas").first():
        print("⚠️  La base de datos ya tiene datos. Saltando seed.")
        return

    print("🌱 Iniciando sembrado de datos...")

    # --- A. CREAR USUARIOS (STAFF) ---
    print("   Creating Users...")
    admin_user = User(
        username="lucas",
        password_hash=get_password_hash("admin123"),
        role="admin",
        is_active=True
    )
    tech_user = User(
        username="tecnico1",
        password_hash=get_password_hash("tech123"),
        role="tecnico",
        is_active=True
    )
    db.add_all([admin_user, tech_user])
    db.commit() # Confirmamos para que tengan ID

    # --- B. CREAR PLANES ---
    print("   Creating Plans...")
    plan_fibra = Plan(
        name="Fibra 100Mb Residencial",
        bandwidth_down=100,
        price=15000.00
    )
    db.add(plan_fibra)
    db.commit()

    # --- C. CREAR CLIENTE ---
    print("   Creating Client...")
    cliente = Client(
        name="Juan Perez (Demo)",
        billing_address="Av. San Martin 1234",
        phone="351-555-9999",
        email="juan.perez@example.com",
        cuit="20-12345678-9"
    )
    db.add(cliente)
    db.commit()

    # --- D. CONECTAR SERVICIO (CLIENTE + PLAN) ---
    print("   Creating Service...")
    servicio = ClientService(
        client_id=cliente.id,
        plan_id=plan_fibra.id,
        ip_address="10.10.1.50",
        mac_address="AA:BB:CC:DD:EE:FF",
        installation_address="Av. San Martin 1234, Depto 2B",
        geolocation="-31.4201,-64.1888",
        site_contact_name="Esposa de Juan",
        site_contact_phone="351-555-8888"
    )
    db.add(servicio)
    db.commit()

    # --- E. CREAR UN TICKET DE PRUEBA ---
    print("   Creating Ticket...")
    ticket = Ticket(
        service_id=servicio.id,
        creator_id=admin_user.id,
        assigned_id=tech_user.id,
        category="Soporte Técnico",
        status="open",
        priority="high",
        title="No navega - Luz roja en ONU",
        description="El cliente reporta que desde la tormenta de anoche no tiene servicio. La ONU parpadea en rojo (LOS).",
        public_note="Técnico asignado para visita mañana por la mañana."
    )
    db.add(ticket)
    db.commit()

    print("✅ ¡Base de datos poblada con éxito!")
    db.close()

if __name__ == "__main__":
    seed_data()