"""
Beholder models - Infrastructure, Clients, and Technical tables
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, PrimaryKeyConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from src.database import Base


# --- Tablas de Infraestructura ---
class Subscriber(Base):
    __tablename__ = "subscribers"
    id = Column(Integer, primary_key=True, index=True)  # ID interno autoincremental (Solución duplicados SmartOLT)
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
    ip_address = Column(String)  # Volvemos a ip_address
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
    customer_id = Column(Integer)  # Sin FK estricta
    email = Column(String)


class ClienteTelefono(Base):
    __tablename__ = "clientes_telefonos"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer)  # Sin FK estricta
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


# --- Tablas de Seguridad (API Keys) ---
class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)  # "ISPCube Sync", "SmartOLT"
    key_hash = Column(String, unique=True, nullable=False)  # bcrypt hash
    key_prefix = Column(String(10), index=True)  # "iso_" para identificar
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Fecha de expiración
    active = Column(Integer, default=1, index=True)  # 1 = activa, 0 = inactiva
    scopes = Column(JSONB, default=["read"])  # ["read", "write"]
    
    # Para auditoría
    created_by = Column(String, default="system")
    rotation_count = Column(Integer, default=0)
    last_rotated_at = Column(DateTime(timezone=True), nullable=True)


class APIKeyAudit(Base):
    __tablename__ = "api_key_audit"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(Integer, index=True, nullable=True)  # Sin FK estricta
    action = Column(String)  # "created", "used", "rotated", "revoked", "expired"
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    ip_address = Column(String, nullable=True)
    endpoint = Column(String, nullable=True)
    status_code = Column(Integer, nullable=True)
    details = Column(JSONB, nullable=True)
