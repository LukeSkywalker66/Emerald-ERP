"""
Modelos para Audit Logging
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import json

from src.database.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    """Registro de auditoría para todas las acciones importantes del sistema."""
    
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), index=True)  # login, logout, create_user, delete_user, etc.
    entity_type = Column(String(50), nullable=True)  # users, roles, tickets, etc.
    entity_id = Column(Integer, nullable=True)
    ip_address = Column(String(45))  # IPv4 o IPv6
    user_agent = Column(String(500), nullable=True)
    status = Column(String(20))  # success, failure
    details = Column(Text, nullable=True)  # JSON con detalles adicionales
    error_message = Column(String(500), nullable=True)
    
    def __repr__(self):
        return f"<AuditLog(user_id={self.user_id}, action={self.action}, status={self.status})>"
    
    def to_dict(self):
        """Convertir a diccionario incluyendo detalles deserializados."""
        details = {}
        if self.details:
            try:
                details = json.loads(self.details)
            except:
                details = {"raw": self.details}
        
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "status": self.status,
            "details": details,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LoginAttempt(Base, TimestampMixin):
    """Registro de intentos de login para rate limiting y detección de fraude."""
    
    __tablename__ = "login_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    username_or_email = Column(String(255), index=True)
    ip_address = Column(String(45), index=True)
    success = Column(Boolean)
    user_agent = Column(String(500), nullable=True)
    
    def __repr__(self):
        return f"<LoginAttempt(username={self.username_or_email}, ip={self.ip_address}, success={self.success})>"
