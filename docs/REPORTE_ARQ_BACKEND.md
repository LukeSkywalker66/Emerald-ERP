# Reporte de Estado de Arquitectura (backend/src)

## Árbol relevante
```
backend/src/
├── database/
│   ├── base.py
│   ├── session.py
├── models/
│   ├── user.py
│   ├── ticket.py
├── schemas/
│   ├── user_schemas.py
│   ├── ticket_schemas.py
├── repositories/
│   ├── base.py
│   ├── user_repository.py
│   ├── ticket_repository.py
├── services/
│   ├── auth_service.py
│   ├── ticket_service.py
├── routers/
│   └── v1/
│       ├── auth.py
│       └── tickets.py
└── core/
    └── security.py
```

## Código clave
### database/base.py
```python
"""
Base declarativa y mixins para modelos SQLAlchemy 2.0
"""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


# Naming convention para constraints (facilita migraciones Alembic)
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)


class Base(DeclarativeBase):
    """
    Base declarativa para todos los modelos del sistema.
    Usa SQLAlchemy 2.0 con type annotations.
    """
    metadata = metadata
    
    # Type checking helpers
    __allow_unmapped__ = False


class TimestampMixin:
    """
    Mixin para agregar timestamps automáticos a cualquier modelo.
    
    Campos:
        created_at: Timestamp de creación (UTC, automático)
        updated_at: Timestamp de última modificación (UTC, auto-actualizado)
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Fecha de creación del registro"
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Fecha de última actualización"
    )
```

### models/user.py
```python
"""
Modelos de autenticación y autorización (SQLAlchemy 2.0)
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import Base, TimestampMixin


class Role(Base, TimestampMixin):
    """
    Modelo de roles del sistema.
    
    Un rol define un conjunto de permisos que se pueden asignar a usuarios.
    """
    __tablename__ = "roles"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Nombre único del rol"
    )
    permissions: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=list,
        comment="Lista de permisos en formato JSON"
    )
    
    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="role",
        lazy="select"
    )
    
    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name='{self.name}')>"


class User(Base, TimestampMixin):
    """
    Modelo de usuario del sistema.
    """
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Email del usuario"
    )
    username: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Nombre de usuario"
    )
    full_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Nombre completo"
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Password hasheado con Argon2"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Usuario activo"
    )
    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Tiene permisos de superusuario"
    )
    
    # Foreign Keys
    role_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="ID del rol asignado"
    )
    
    # Relationships
    role: Mapped[Optional["Role"]] = relationship(
        "Role",
        back_populates="users",
        lazy="joined"
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"
    
    def has_permission(self, permission: str) -> bool:
        """Verifica si el usuario tiene un permiso específico."""
        if self.is_superuser:
            return True
        
        if not self.role or not self.role.permissions:
            return False
        
        return permission in self.role.permissions or "*" in self.role.permissions
```

### models/ticket.py
```python
from __future__ import annotations

from enum import StrEnum
from typing import Optional

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import Base, TimestampMixin
from src.models.user import User


class TicketStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketEventType(StrEnum):
    CREATED = "CREATED"
    COMMENT = "COMMENT"
    STATUS_CHANGE = "STATUS_CHANGE"


class TicketCategory(Base, TimestampMixin):
    __tablename__ = "ticket_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    tickets: Mapped[list[Ticket]] = relationship("Ticket", back_populates="category", lazy="select")


class Ticket(Base, TimestampMixin):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum"),
        default=TicketStatus.OPEN,
        nullable=False,
        index=True,
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority_enum"),
        default=TicketPriority.MEDIUM,
        nullable=False,
        index=True,
    )
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ticket_categories.id"), nullable=True, index=True)
    creator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    assigned_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    customer_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)

    category: Mapped[Optional[TicketCategory]] = relationship("TicketCategory", back_populates="tickets", lazy="joined")
    creator: Mapped[Optional[User]] = relationship("User", foreign_keys=[creator_id], lazy="joined")
    assignee: Mapped[Optional[User]] = relationship("User", foreign_keys=[assigned_id], lazy="joined")
    events: Mapped[list[TicketEvent]] = relationship(
        "TicketEvent",
        back_populates="ticket",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="TicketEvent.created_at.asc()",
    )


class TicketEvent(Base, TimestampMixin):
    __tablename__ = "ticket_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False, index=True)
    event_type: Mapped[TicketEventType] = mapped_column(
        Enum(TicketEventType, name="ticket_event_type_enum"),
        nullable=False,
        index=True,
    )
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    ticket: Mapped[Ticket] = relationship("Ticket", back_populates="events", lazy="joined")
    user: Mapped[Optional[User]] = relationship("User", lazy="joined")
```

### schemas/ticket_schemas.py
```python
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.models.ticket import TicketEventType, TicketPriority, TicketStatus
from src.schemas.user_schemas import UserResponse


class TicketCategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    category_id: Optional[int] = None
    priority: TicketPriority = TicketPriority.MEDIUM
    customer_id: Optional[int] = None


class TicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    assigned_to_id: Optional[int] = None


class TicketEventCreate(BaseModel):
    event_type: TicketEventType
    payload: Dict = Field(default_factory=dict)
    user_id: Optional[int] = None


class TicketEventOut(BaseModel):
    id: int
    event_type: TicketEventType
    payload: Dict
    created_at: datetime
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class TicketOut(TicketCreate):
    id: int
    status: TicketStatus
    created_at: datetime
    updated_at: datetime
    creator: Optional[UserResponse] = None
    assignee: Optional[UserResponse] = None
    category: Optional[TicketCategoryOut] = None

    model_config = ConfigDict(from_attributes=True)


class TicketDetail(TicketOut):
    events: List[TicketEventOut] = Field(default_factory=list)
```

### repositories/ticket_repository.py
```python
from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from src.models.ticket import Ticket, TicketEvent, TicketEventType
from src.repositories.base import BaseRepository


class TicketRepository(BaseRepository[Ticket]):
    def __init__(self, db: Session):
        super().__init__(Ticket, db)

    def get_ticket_with_details(self, ticket_id: int) -> Optional[Ticket]:
        stmt = (
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(
                joinedload(Ticket.category),
                joinedload(Ticket.creator),
                joinedload(Ticket.assignee),
                joinedload(Ticket.events).joinedload(TicketEvent.user),
            )
        )
        result = self.db.execute(stmt)
        return result.scalars().first()

    def add_event(
        self,
        ticket_id: int,
        event_type: TicketEventType,
        payload: dict,
        user_id: Optional[int] = None,
    ) -> TicketEvent:
        event = TicketEvent(
            ticket_id=ticket_id,
            event_type=event_type,
            payload=payload,
            user_id=user_id,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event
```

### services/auth_service.py
```python
"""
Servicio de autenticación y autorización
"""
import logging
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from src.models.user import User
from src.repositories.user_repository import UserRepository
from src.schemas.user_schemas import UserCreate, Token
from src.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
)


logger = logging.getLogger("Emerald.AuthService")


class AuthService:
    """Servicio para gestión de autenticación y autorización."""
    
    def __init__(self, user_repository: UserRepository, session: Session):
        self.user_repo = user_repository
        self.session = session
    
    def authenticate_user(self, email_or_username: str, password: str) -> Optional[User]:
        """Autentica un usuario por email, username y password."""
        # Intentar primero por email
        user = self.user_repo.get_by_email(email_or_username)
        
        # Si no encuentra por email, intentar por username
        if not user:
            user = self.user_repo.get_by_username(email_or_username)
        
        if not user:
            logger.warning(f"Login fallido: usuario '{email_or_username}' no existe")
            return None
        
        if not verify_password(password, user.hashed_password):
            logger.warning(f"Login fallido: password incorrecta para '{email_or_username}'")
            return None
        
        if not user.is_active:
            logger.warning(f"Login fallido: usuario '{email_or_username}' está inactivo")
            return None
        
        logger.info(f"✅ Login exitoso: {user.username} ({user.email})")
        return user
    
    def login(
        self,
        email: str,  # Puede ser email o username
        password: str,
        expires_delta: Optional[timedelta] = None
    ) -> Optional[Token]:
        """Realiza login de usuario y genera token JWT."""
        user = self.authenticate_user(email, password)
        
        if not user:
            return None
        
        if expires_delta is None:
            expires_delta = timedelta(minutes=30)
        
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "email": user.email,
                "username": user.username,
                "is_superuser": user.is_superuser,
            },
            expires_delta=expires_delta
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=int(expires_delta.total_seconds())
        )
    
    def register_user(self, user_create: UserCreate) -> User:
        """Registra un nuevo usuario en el sistema."""
        # Verificar que el email no exista
        existing_user = self.user_repo.get_by_email(user_create.email)
        if existing_user:
            logger.warning(f"Intento de registro con email duplicado: {user_create.email}")
            raise ValueError(f"El email '{user_create.email}' ya está registrado")
        
        # Verificar que el username no exista
        existing_user = self.user_repo.get_by_username(user_create.username)
        if existing_user:
            logger.warning(f"Intento de registro con username duplicado: {user_create.username}")
            raise ValueError(f"El username '{user_create.username}' ya está en uso")
        
        # Hashear password
        hashed_password = get_password_hash(user_create.password)
        
        # Crear usuario
        user = User(
            email=user_create.email,
            username=user_create.username,
            hashed_password=hashed_password,
            full_name=user_create.full_name,
            is_active=True,
            is_superuser=False,
            role_id=user_create.role_id
        )
        
        created_user = self.user_repo.create(user)
        
        logger.info(f"✅ Usuario registrado: {created_user.username} (ID: {created_user.id})")
        
        return created_user
    
    def change_password(
        self,
        user_id: int,
        old_password: str,
        new_password: str
    ) -> bool:
        """Cambia el password de un usuario."""
        user = self.user_repo.get(user_id)
        
        if not user:
            raise ValueError(f"Usuario {user_id} no encontrado")
        
        if not verify_password(old_password, user.hashed_password):
            logger.warning(f"Intento de cambio de password con contraseña incorrecta: {user.email}")
            raise ValueError("Password actual incorrecto")
        
        user.hashed_password = get_password_hash(new_password)
        self.user_repo.update(user)
        
        logger.info(f"✅ Password cambiado para: {user.username}")
        
        return True
```

### services/ticket_service.py
```python
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from src.models.ticket import Ticket, TicketEventType, TicketPriority, TicketStatus
from src.repositories.ticket_repository import TicketRepository
from src.schemas.ticket_schemas import TicketCreate, TicketEventCreate, TicketUpdate


class TicketService:
    def __init__(self, ticket_repository: TicketRepository, session: Session):
        self.ticket_repo = ticket_repository
        self.session = session

    def create_ticket(self, data: TicketCreate, creator_id: Optional[int]) -> Ticket:
        ticket = Ticket(
            title=data.title,
            description=data.description,
            category_id=data.category_id,
            priority=data.priority or TicketPriority.MEDIUM,
            status=TicketStatus.OPEN,
            customer_id=data.customer_id,
            creator_id=creator_id,
        )
        self.ticket_repo.create(ticket)
        self.ticket_repo.add_event(ticket.id, TicketEventType.CREATED, {"title": data.title}, creator_id)
        return self.ticket_repo.get_ticket_with_details(ticket.id)

    def add_comment(self, ticket_id: int, event: TicketEventCreate, user_id: Optional[int]) -> Ticket:
        ticket = self.ticket_repo.get(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        comment_text = event.payload.get("comment") if event.payload else None
        self.ticket_repo.add_event(
            ticket_id,
            TicketEventType.COMMENT,
            {"comment": comment_text},
            user_id,
        )
        return self.ticket_repo.get_ticket_with_details(ticket_id)

    def change_status(self, ticket_id: int, new_status: TicketStatus, user_id: Optional[int]) -> Ticket:
        ticket = self.ticket_repo.get(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        old_status = ticket.status
        ticket.status = new_status
        self.ticket_repo.update(ticket)
        self.ticket_repo.add_event(
            ticket_id,
            TicketEventType.STATUS_CHANGE,
            {"old": old_status, "new": new_status},
            user_id,
        )
        return self.ticket_repo.get_ticket_with_details(ticket_id)

    def update_ticket(self, ticket_id: int, data: TicketUpdate, user_id: Optional[int]) -> Ticket:
        ticket = self.ticket_repo.get(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")

        if data.priority is not None:
            ticket.priority = data.priority
        if data.assigned_to_id is not None:
            ticket.assigned_id = data.assigned_to_id
        if data.status is not None:
            return self.change_status(ticket_id, data.status, user_id)

        self.ticket_repo.update(ticket)
        return self.ticket_repo.get_ticket_with_details(ticket_id)
```

### routers/v1/tickets.py
```python
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.security import get_current_user
from src.database import get_db
from src.models.ticket import TicketEventType, TicketStatus
from src.repositories.ticket_repository import TicketRepository
from src.schemas.ticket_schemas import (
    TicketCreate,
    TicketDetail,
    TicketEventCreate,
    TicketOut,
    TicketUpdate,
)
from src.services.ticket_service import TicketService

router = APIRouter(prefix="/tickets", tags=["Tickets"])

PERM_TICKETS_READ = "tickets:read"
PERM_TICKETS_WRITE = "tickets:write"


def get_ticket_service(db: Session = Depends(get_db)) -> TicketService:
    repo = TicketRepository(db)
    return TicketService(repo, db)


def _ensure_can_read(user):
    if user.is_superuser:
        return True
    perms = (user.role.permissions if user.role and user.role.permissions else [])
    if isinstance(perms, dict):
        perms = perms.get("permissions", []) or []
    if PERM_TICKETS_READ in perms or "*" in perms:
        return True
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


def _ensure_can_write(user):
    if user.is_superuser:
        return True
    perms = (user.role.permissions if user.role and user.role.permissions else [])
    if isinstance(perms, dict):
        perms = perms.get("permissions", []) or []
    if PERM_TICKETS_WRITE in perms or "*" in perms:
        return True
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


@router.post("/", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    current_user=Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    _ensure_can_write(current_user)
    ticket = service.create_ticket(payload, creator_id=current_user.id)
    return ticket


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_ticket_detail(
    ticket_id: int,
    current_user=Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    _ensure_can_read(current_user)
    ticket = service.ticket_repo.get_ticket_with_details(ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


@router.post("/{ticket_id}/comment", response_model=TicketDetail)
def add_comment(
    ticket_id: int,
    payload: TicketEventCreate,
    current_user=Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    _ensure_can_write(current_user)
    if payload.event_type != TicketEventType.COMMENT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="event_type must be COMMENT")
    ticket = service.add_comment(ticket_id, payload, current_user.id)
    return ticket


@router.patch("/{ticket_id}/status", response_model=TicketDetail)
def change_status(
    ticket_id: int,
    data: TicketUpdate,
    current_user=Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    _ensure_can_write(current_user)
    if data.status is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status is required")
    ticket = service.change_status(ticket_id, data.status, current_user.id)
    return ticket
```

---

## Sistema de Tickets v2.0 (NUEVO - 02/01/2026)

### Modelos SQLAlchemy 2.0

**Archivo:** `backend/src/models/tickets.py` (519 líneas)

#### Estructura de Modelos

```
Ticket (tickets_v2)
├── ticket_code: STRING UNIQUE
├── title, description: TEXT
├── status, priority: ENUM
├── creator_id → User.id (FK NOT NULL)
├── assigned_to_id → User.id (FK NULLABLE)
├── Relationships:
│   ├── creator: User
│   ├── assigned_to: User
│   ├── timeline: List[TicketTimeline]
│   └── work_orders: List[WorkOrder]
│
├─→ TicketTimeline (ticket_timeline)
│   ├── ticket_id → Ticket.id (CASCADE)
│   ├── author_id → User.id (SET NULL)
│   ├── event_type: ENUM (note, status_change, ot_created, etc)
│   ├── content: TEXT
│   ├── meta_data: JSONB (flexible event-specific data)
│   └── Relationships:
│       ├── ticket: Ticket
│       └── author: User
│
└─→ WorkOrder (work_orders)
    ├── ticket_id → Ticket.id (CASCADE)
    ├── technician_id → User.id (SET NULL)
    ├── ot_type: ENUM (diagnosis, repair, install, upgrade, maintenance)
    ├── status: ENUM (pending_planning, scheduled, in_progress, completed, cancelled)
    ├── scheduled_date, completed_at: DATETIME
    ├── total_duration: INT (segundos)
    └── Relationships:
        ├── ticket: Ticket
        ├── technician: User
        └── items: List[WorkOrderItem]
             │
             └─→ WorkOrderItem (work_order_items)
                 ├── work_order_id → WorkOrder.id (CASCADE)
                 ├── product_id: UUID (SOFT FK, sin constraint)
                 ├── serial_number: STRING (índice para trazabilidad)
                 ├── quantity: INT
                 └── consumed_at: DATETIME
```

#### Enums del Sistema

| Enum | Valores | Uso |
|------|---------|-----|
| **TicketStatus** | open, in_progress, waiting, closed | Estado del ticket |
| **TicketPriority** | low, medium, high, critical | Prioridad |
| **TicketTimelineEventType** | note, status_change, assignment, ot_created, ot_completed, telemetry, contact, closed | Tipo de evento en bitácora |
| **WorkOrderStatus** | pending_planning, scheduled, in_progress, completed, cancelled | Estado de OT |
| **WorkOrderType** | diagnosis, repair, install, upgrade, maintenance | Tipo de trabajo |

#### Características clave

| Aspecto | Detalles |
|--------|---------|
| **Type Safety** | Todos los campos con `Mapped[]` (SQLAlchemy 2.0 strict mode) |
| **Enums** | 5 StrEnum definidos, almacenados como ENUM en PostgreSQL 15 |
| **Timestamps** | Automáticos via `TimestampMixin` (created_at, updated_at) |
| **Relaciones** | Bidireccionales con `back_populates`, cascades controlados |
| **JSONB** | Campo `meta_data` en `ticket_timeline` para datos flexibles |
| **Soft FKs** | `product_id` sin constraint FK para flexibilidad futura |
| **Indexes** | 15+ índices para queries comunes |
| **Cascades** | DELETE CASCADE en timeline/items, SET NULL para usuarios |

### Migración Alembic (08bc58d283e34)

**Archivo:** `backend/alembic/versions/8bc58d283e34_crear_tablas_tickets_work_orders.py`  
**Creada:** 02/01/2026  
**Status:** ✅ Ejecutada exitosamente

**Cambios aplicados:**

```sql
-- 1. CREATE ENUMS
CREATE TYPE ticketstatus AS ENUM ('open', 'in_progress', 'waiting', 'closed');
CREATE TYPE ticketpriority AS ENUM ('low', 'medium', 'high', 'critical');
-- ... más enums

-- 2. CREATE TABLE tickets_v2
CREATE TABLE tickets_v2 (
    id UUID PRIMARY KEY,
    ticket_code VARCHAR UNIQUE NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    status ticketstatus DEFAULT 'open' NOT NULL,
    priority ticketpriority DEFAULT 'medium' NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id),
    assigned_to_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
CREATE INDEX idx_tickets_v2_code ON tickets_v2(ticket_code);
CREATE INDEX idx_tickets_v2_status ON tickets_v2(status);
-- ... más índices

-- 3. CREATE TABLE ticket_timeline
CREATE TABLE ticket_timeline (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets_v2(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type tickettimelineeventtype NOT NULL,
    content TEXT NOT NULL,
    meta_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
-- ... índices

-- 4. CREATE TABLE work_orders
CREATE TABLE work_orders (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets_v2(id) ON DELETE CASCADE,
    technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ot_type workordertype NOT NULL,
    status workorderstatus DEFAULT 'pending_planning' NOT NULL,
    scheduled_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
-- ... índices

-- 5. CREATE TABLE work_order_items
CREATE TABLE work_order_items (
    id UUID PRIMARY KEY,
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    product_id UUID,
    serial_number VARCHAR,
    quantity INTEGER DEFAULT 1 NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
-- ... índices
```

**Reversión:** `alembic downgrade 324f44f48d0a`

### Patrones Utilizados

#### 1. Repository Pattern (Pendiente)
```python
class TicketRepository:
    def get_by_id(self, ticket_id: UUID) -> Ticket:
        """Obtener ticket con timeline y work_orders"""
    
    def list_by_status(self, status: TicketStatus) -> List[Ticket]:
        """Listar tickets filtrados por estado"""
    
    def create(self, data: TicketCreate, creator_id: UUID) -> Ticket:
        """Crear nuevo ticket con ticket_code autogenerado"""
```

#### 2. Service Layer (Pendiente)
```python
class TicketService:
    def __init__(self, repo: TicketRepository):
        self.repo = repo
    
    def request_visit(self, ticket_id: UUID, ot_type: WorkOrderType, 
                     scheduled_date: datetime) -> WorkOrder:
        """Crear OT, registrar en timeline, actualizar ticket status"""
        # - Crear WorkOrder en pending_planning
        # - Crear TicketTimeline event OT_CREATED con snapshot
        # - Retornar OT
    
    def close_ticket(self, ticket_id: UUID, resolution: str) -> Ticket:
        """Cerrar ticket con resumen de resolución"""
        # - Actualizar status → closed
        # - Completar todas las OT pendientes
        # - Registrar en timeline con resolution en meta_data
```

### Próximos Pasos (Roadmap v2.1)

1. ✅ **Modelos ORM** (completado 02/01/2026)
2. ✅ **Migración Alembic** (completado 02/01/2026)
3. ⏳ **Repositories** (TicketRepository, WorkOrderRepository)
4. ⏳ **Services** (TicketService, WorkOrderService)
5. ⏳ **API Endpoints** (FastAPI routers para CRUD)
6. ⏳ **WebSockets** (telemetry real-time updates)
7. ⏳ **Frontend Connection** (TicketDetailPage → API real)
8. ⏳ **Reportes** (generación automática de reportes de OT)

### Verificación Post-Migración

```bash
# Listar todas las tablas de tickets
docker-compose exec -T backend python -c "
from src.database.session import engine
from sqlalchemy import inspect
inspector = inspect(engine)
tables = [t for t in sorted(inspector.get_table_names()) 
          if 'ticket' in t.lower() or 'work_order' in t.lower()]
for t in tables:
    print(f'✓ {t}')
"

# Resultado esperado:
# ✓ ticket_categories
# ✓ ticket_events
# ✓ ticket_timeline
# ✓ tickets
# ✓ tickets_v2
# ✓ work_order_items
# ✓ work_orders
```

---

**Última actualización:** 02 de enero de 2026  
**Rama activa:** feature/new-navigation

