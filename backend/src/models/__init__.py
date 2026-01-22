"""
Models package exports
Unifica todos los modelos: Auth, Tickets, Beholder, API Keys, WorkOrders, Engineering
"""
from .user import Role, User
from .audit import AuditLog, LoginAttempt
# DEPRECATED: Old ticket models replaced by new tickets.py version
# Do NOT import from .ticket to avoid SQLAlchemy registry conflicts
from .tickets import (
	# Nuevos modelos mejorados para Tickets v2 - USE THESE
	Ticket,
	TicketStatus,
	TicketPriority,
	TicketType,
	AdministrativeSubtype,
	TicketTimeline,
	TicketTimelineEventType,
	WorkOrder,
	WorkOrderStatus,
	WorkOrderType,
	WorkOrderItem,
	TicketCategory,
	Tag,
	ticket_tags_association,
)
from .ticket_attachments import TicketAttachment
from .engineering import (
	# Gestión de Tareas de Ingeniería/NOC
	EngineeringTask,
	EngineeringTaskType,
	EngineeringTaskPriority,
	EngineeringTaskStatus,
)
from .inventory import (
	# Gestión de Inventario Operativo
	Warehouse,
	WarehouseType,
	Product,
	ProductType,
	StockBulk,
	SerialItem,
	SerialItemStatus,
	StockMovement,
	MovementType,
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
	# Ticket models v2 (nuevos mejorados - ONLY VERSION IN USE)
	"Ticket",
	"TicketStatus",
	"TicketPriority",
	"TicketType",
	"AdministrativeSubtype",
	"TicketTimeline",
	"TicketTimelineEventType",
	"WorkOrder",
	"WorkOrderStatus",
	"WorkOrderType",
	"WorkOrderItem",
	"TicketCategory",
	"Tag",
	"TicketAttachment",
	# Engineering models
	"EngineeringTask",
	"EngineeringTaskType",
	"EngineeringTaskPriority",
	"EngineeringTaskStatus",
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
