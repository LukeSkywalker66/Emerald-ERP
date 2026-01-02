"""
Models package exports
Unifica todos los modelos: Auth, Tickets, Beholder, API Keys, WorkOrders
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
from .tickets import (
	# Nuevos modelos mejorados para Tickets v2
	Ticket as TicketV2,
	TicketStatus as TicketStatusV2,
	TicketPriority as TicketPriorityV2,
	TicketTimeline,
	TicketTimelineEventType,
	WorkOrder,
	WorkOrderStatus,
	WorkOrderType,
	WorkOrderItem,
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
	# Ticket models (legacy)
	"Ticket",
	"TicketCategory",
	"TicketEvent",
	"TicketEventType",
	"TicketPriority",
	"TicketStatus",
	# Ticket models v2 (nuevos mejorados)
	"TicketV2",
	"TicketStatusV2",
	"TicketPriorityV2",
	"TicketTimeline",
	"TicketTimelineEventType",
	"WorkOrder",
	"WorkOrderStatus",
	"WorkOrderType",
	"WorkOrderItem",
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
