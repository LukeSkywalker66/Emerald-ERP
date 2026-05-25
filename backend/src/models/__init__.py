"""
Models package exports
Unifica todos los modelos: Auth, Tickets, Beholder, API Keys, WorkOrders, Engineering
"""
from .user import Role, User
from .audit import AuditLog, LoginAttempt, AuditAction
from .installation import InstallationType
from .work_order_types import WorkOrderTypeConfig
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
	TicketReason,
	Tag,
	ticket_tags_association,
)
from .ticket_attachments import TicketAttachment
from .contact_attempts import ContactAttempt, ContactAttemptResult
from .coordination import Team, TeamMember, TeamRole
from .fleet import Vehicle, VehicleStatus, VehicleInspection
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
	ProductCategory,
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
from .settings import (
	# Settings Module - Configuración General
	SystemConfig,
	ServiceMonitor,
	MonitorType,
	CriticalityIndex,
	MonitorStatus,
	MonitorCheckHistory,
)
from .scheduled_task import (
	# Scheduled Tasks V2 - Configuración persistente de tareas programadas
	ScheduledTask,
)
from .locations import City, Neighborhood

__all__ = [
	# Auth models
	"Role",
	"User",
	"AuditLog",
	"LoginAttempt",
	# Fleet models
	"Vehicle",
	"VehicleStatus",
	"VehicleInspection",
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
	"TicketReason",
	"Tag",
	"TicketAttachment",
	# WorkOrderType configuration
	"WorkOrderTypeConfig",
	# Coordination models
	"Team",
	"TeamMember",
	"TeamRole",
	# Inventory models
	"Warehouse",
	"WarehouseType",
	"Product",
	"ProductType",
	"ProductCategory",
	"StockBulk",
	"SerialItem",
	"SerialItemStatus",
	"StockMovement",
	"MovementType",
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
	"City",
	"Neighborhood",
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
	# Settings Module
	"SystemConfig",
	"ServiceMonitor",
	"MonitorType",
	"CriticalityIndex",
	"MonitorStatus",
	# Scheduled Tasks
	"ScheduledTask",
]
