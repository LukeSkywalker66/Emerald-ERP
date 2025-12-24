from sqlalchemy import Column, Integer, String, DateTime, Text, PrimaryKeyConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from src.database import Base

# --- Tablas de Infraestructura ---
class Subscriber(Base):
    __tablename__ = "subscribers"
    id = Column(Integer, primary_key=True, index=True) # ID interno autoincremental (Solución duplicados SmartOLT)
    unique_external_id = Column(String, index=True)
    sn = Column(String)
    olt_name = Column(String)
    olt_id = Column(String)
    board = Column(String)
    port = Column(String)
    onu = Column(String)
    onu_type_id = Column(String)
    mode = Column(String)
    
    # RELACIONES "BLANDAS" (Sin ForeignKey estricto para evitar trabas)
    node_id = Column(Integer, index=True, nullable=True)
    connection_id = Column(Integer, index=True, nullable=True)
    vlan = Column(String, nullable=True)
    pppoe_username = Column(String, index=True, nullable=True)
    

class Node(Base):
    __tablename__ = "nodes"
    # Respetamos tus nombres originales
    node_id = Column(Integer, primary_key=True) 
    name = Column(String)
    ip_address = Column(String) # Volvemos a ip_address
    puerto = Column(String)

class Plan(Base):
    __tablename__ = "plans"
    plan_id = Column(Integer, primary_key=True)
    name = Column(String)
    speed = Column(String)
    description = Column(String)

class Connection(Base):
    __tablename__ = "connections"
    connection_id = Column(Integer, primary_key=True)
    pppoe_username = Column(String, index=True)
    customer_id = Column(Integer, index=True) 
    node_id = Column(Integer)
    plan_id = Column(Integer)
    direccion = Column(String)

# --- Tablas de Clientes (CRM) ---
class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(Integer, primary_key=True)
    code = Column(String)
    name = Column(String, index=True)
    doc_number = Column(String)
    address = Column(String)
    status = Column(String)
    tax_residence = Column(String)
    type = Column(String)
    
    # Raw Data
    raw_data = Column(JSONB, nullable=True)

class ClienteEmail(Base):
    __tablename__ = "clientes_emails"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer) # Sin FK estricta
    email = Column(String)

class ClienteTelefono(Base):
    __tablename__ = "clientes_telefonos"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer) # Sin FK estricta
    number = Column(String)

# --- Tablas Técnicas ---
class PPPSecret(Base):
    __tablename__ = "ppp_secrets"
    name = Column(String, primary_key=True)
    router_ip = Column(String, primary_key=True)
    password = Column(String)
    profile = Column(String)
    service = Column(String)
    last_caller_id = Column(String, index=True)
    comment = Column(String)
    last_logged_out = Column(String)
    
    __table_args__ = (
        PrimaryKeyConstraint('name', 'router_ip'),
    )

class SyncStatus(Base):
    __tablename__ = "sync_status"
    id = Column(Integer, primary_key=True, autoincrement=True)
    fuente = Column(String)
    ultima_actualizacion = Column(DateTime(timezone=True), server_default=func.now())
    estado = Column(String)
    detalle = Column(String)