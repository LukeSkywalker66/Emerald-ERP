# backend/src/models.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base # Importamos la base que creamos en el paso 1

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
    billing_address = Column(String) # Domicilio legal/facturacion
    phone = Column(String)
    email = Column(String)
    cuit = Column(String)
    
    # Relación: Un cliente tiene muchos servicios
    services = relationship("ClientService", back_populates="client")

class ClientService(Base):
    __tablename__ = "client_services"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    plan_id = Column(Integer, ForeignKey("plans.id")) # Asumimos tabla plans a futuro
    
    # Datos Técnicos de la conexión
    ip_address = Column(String, nullable=True)
    mac_address = Column(String, nullable=True)
    
    # Datos de Ubicación del Servicio (Donde está el técnico)
    installation_address = Column(String)
    geolocation = Column(String) # Ej: "-31.4201,-64.1888"
    site_contact_name = Column(String, nullable=True)
    site_contact_phone = Column(String, nullable=True)

    client = relationship("Client", back_populates="services")
    tickets = relationship("Ticket", back_populates="service")

class Plan(Base):
    __tablename__ = "plans"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    bandwidth_down = Column(Integer)
    price = Column(Float, nullable=True)

class Ticket(Base):
    __tablename__ = "tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("client_services.id")) # Vinculado a la conexión específica
    creator_id = Column(Integer, ForeignKey("users.id"))
    assigned_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    category = Column(String) # "Tecnico", "Admin", "Ventas"
    status = Column(String, default="open") # open, in_progress, resolved, closed
    priority = Column(String, default="medium")
    
    title = Column(String)
    description = Column(Text) # Descripción interna completa
    public_note = Column(Text, nullable=True) # Lo que ve el cliente (Opcional)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    service = relationship("ClientService", back_populates="tickets")
    work_orders = relationship("ServiceSheet", back_populates="ticket")

class ServiceSheet(Base):
    """La Hoja de Servicio del Técnico (Digital)"""
    __tablename__ = "service_sheets"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    author_id = Column(Integer, ForeignKey("users.id"))
    
    # Tiempos
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    
    # Datos técnicos en sitio
    signal_power = Column(Float, nullable=True) # -24.5
    onu_sn = Column(String, nullable=True)
    nap_box_data = Column(String, nullable=True) # "Caja 4, Puerto 8"
    
    # Materiales (El famoso JSON)
    # Ej: {"cable_drop_mts": 50, "conectores": 2, "precintos": 10}
    materials_used = Column(JSON, default={})
    
    tech_notes = Column(Text) # Notas técnicas "Cambie conector"
    photos_url = Column(JSON, default=[]) # Lista de links a fotos
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("Ticket", back_populates="work_orders")