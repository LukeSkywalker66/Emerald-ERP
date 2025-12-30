"""
Models package exports
Unifica todos los modelos: Auth, Tickets, Beholder, API Keys
"""
from .user import Role, User
from .audit import AuditLog, LoginAttempt
from .ticket import (
	Ticket,
	TicketCategory,
	TicketEvent,
	TicketEventType,
	TicketPriority,
	TicketStatus,
)
from .beholder import (
	# Infraestructura
	Subscriber,
	Node,
	Plan,
	Connection,
	# Clientes (CRM)
	Cliente,
	ClienteEmail,
	ClienteTelefono,
	# Técnicas
	PPPSecret,
	SyncStatus,
	# API Keys
	APIKey,
	APIKeyAudit,
)

__all__ = [
	# Auth models
	"Role",
	"User",
	"AuditLog",
	"LoginAttempt",
	# Ticket models
	"Ticket",
	"TicketCategory",
	"TicketEvent",
	"TicketEventType",
	"TicketPriority",
	"TicketStatus",
	# Beholder models - Infraestructura
	"Subscriber",
	"Node",
	"Plan",
	"Connection",
	# Beholder models - Clientes (CRM)
	"Cliente",
	"ClienteEmail",
	"ClienteTelefono",
	# Beholder models - Técnicas
	"PPPSecret",
	"SyncStatus",
	# API Keys
	"APIKey",
	"APIKeyAudit",
]
