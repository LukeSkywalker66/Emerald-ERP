# backend/src/models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, PrimaryKeyConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from src.database import Base

# --- Tablas de Infraestructura ---
class Subscriber(Base):
    __tablename__ = "subscribers"
    # CREATE TABLE subscribers (unique_external_id TEXT PRIMARY KEY...) [cite: 449]
    unique_external_id = Column(String, primary_key=True)
    pppoe_username = Column(String, index=True)
    sn = Column(String, index=True)
    olt_name = Column(String)
    olt_id = Column(String)
    board = Column(String)
    port = Column(String)
    onu = Column(String)
    onu_type_id = Column(String)
    mode = Column(String)
    node_id = Column(String)
    connection_id = Column(String)
    vlan = Column(String)

class Node(Base):
    __tablename__ = "nodes"
    # CREATE TABLE nodes (node_id TEXT PRIMARY KEY...) [cite: 451]
    node_id = Column(String, primary_key=True)
    name = Column(String)
    ip_address = Column(String)
    puerto = Column(String)

class Plan(Base):
    __tablename__ = "plans"
    # CREATE TABLE plans (plan_id TEXT PRIMARY KEY...) [cite: 452]
    plan_id = Column(String, primary_key=True)
    name = Column(String)
    speed = Column(String)
    description = Column(String)

class Connection(Base):
    __tablename__ = "connections"
    # CREATE TABLE connections (connection_id TEXT PRIMARY KEY...) [cite: 453]
    connection_id = Column(String, primary_key=True)
    pppoe_username = Column(String, index=True)
    customer_id = Column(Integer, index=True) 
    node_id = Column(String)
    plan_id = Column(String)
    direccion = Column(String)

# --- Tablas de Clientes (CRM) ---
class Cliente(Base):
    __tablename__ = "clientes"
    # CREATE TABLE clientes (id INTEGER PRIMARY KEY...) [cite: 454]
    id = Column(Integer, primary_key=True)
    code = Column(String)
    name = Column(String, index=True)
    doc_number = Column(String)
    address = Column(String)
    status = Column(String)
    
    # ... resto de campos mapeados de tu sync ...
    tax_residence = Column(String)
    type = Column(String)
    # (Agregá aquí el resto de las columnas si las usás en el código, 
    # o confiá en raw_data para lo que no sea crítico)
    
    # Campo extra para guardar TODO lo que venga de la API (nuestra mejora)
    raw_data = Column(JSONB, nullable=True)

class ClienteEmail(Base):
    __tablename__ = "clientes_emails"
    # [cite: 461]
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("clientes.id"))
    email = Column(String)

class ClienteTelefono(Base):
    __tablename__ = "clientes_telefonos"
    # [cite: 462]
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("clientes.id"))
    number = Column(String)

# --- Tablas Técnicas y de Sync ---
class PPPSecret(Base):
    __tablename__ = "ppp_secrets"
    # PK COMPUESTA (name, router_ip) [cite: 116]
    name = Column(String, primary_key=True)
    router_ip = Column(String, primary_key=True)
    password = Column(String)
    profile = Column(String)
    service = Column(String)
    last_caller_id = Column(String, index=True) # MAC
    comment = Column(String)
    last_logged_out = Column(String)
    
    # Definición explícita de PK compuesta para SQLAlchemy
    __table_args__ = (
        PrimaryKeyConstraint('name', 'router_ip'),
    )

class SyncStatus(Base):
    __tablename__ = "sync_status"
    # [cite: 463]
    id = Column(Integer, primary_key=True, autoincrement=True)
    fuente = Column(String)
    ultima_actualizacion = Column(DateTime(timezone=True), server_default=func.now())
    estado = Column(String)
    detalle = Column(String)