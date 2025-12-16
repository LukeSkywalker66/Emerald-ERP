# backend/src/models.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String) # 'admin', 'tecnico', 'mesa_ayuda'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    billing_address = Column(String)
    phone = Column(String)
    email = Column(String)
    cuit = Column(String)
    
    services = relationship("ClientService", back_populates="client")

class Plan(Base):
    __tablename__ = "plans"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    bandwidth_down = Column(Integer) # Bajada (Mbps)
    bandwidth_up = Column(Integer)   # Subida (Mbps) - AGREGADO
    price = Column(Float, nullable=True)

class ClientService(Base):
    __tablename__ = "client_services"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    plan_id = Column(Integer, ForeignKey("plans.id")) 
    
    ip_address = Column(String, nullable=True)
    mac_address = Column(String, nullable=True)
    installation_address = Column(String)
    geolocation = Column(String)
    site_contact_name = Column(String, nullable=True)
    site_contact_phone = Column(String, nullable=True)

    client = relationship("Client", back_populates="services")
    plan = relationship("Plan") # Relación con el Plan
    tickets = relationship("Ticket", back_populates="service")

class Ticket(Base):
    __tablename__ = "tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("client_services.id"))
    creator_id = Column(Integer, ForeignKey("users.id"))
    assigned_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    category = Column(String) # "Tecnico", "Admin", "Ventas"
    status = Column(String, default="open") 
    priority = Column(String, default="medium")
    
    title = Column(String)
    description = Column(Text)
    public_note = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    service = relationship("ClientService", back_populates="tickets")
    work_orders = relationship("ServiceSheet", back_populates="ticket")
    creator = relationship("User", foreign_keys=[creator_id])
    assigned = relationship("User", foreign_keys=[assigned_id])

class ServiceSheet(Base):
    __tablename__ = "service_sheets"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    author_id = Column(Integer, ForeignKey("users.id"))
    
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    signal_power = Column(Float, nullable=True)
    onu_sn = Column(String, nullable=True)
    nap_box_data = Column(String, nullable=True)
    materials_used = Column(JSON, default={})
    tech_notes = Column(Text)
    photos_url = Column(JSON, default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("Ticket", back_populates="work_orders")