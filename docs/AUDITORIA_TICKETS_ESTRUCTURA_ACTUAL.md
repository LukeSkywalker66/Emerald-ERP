# 🔍 Auditoría: Estructura Actual de Tickets
## Para Diseño de Flujo Ingeniería/NOC

**Fecha:** 15 de Enero 2026  
**Rama:** `develop`  
**Objetivo:** Analizar código existente antes de implementar nuevo flujo NOC/Ingeniería  
**Archivos Analizados:**
- `backend/src/models/tickets.py`
- `frontend/src/pages/TicketDetailPage.jsx`
- `frontend/src/services/tickets.service.js`

---

## 📊 1. MODELO DE DATOS ACTUAL

### Ubicación
**Archivo:** `backend/src/models/tickets.py`

### Enums Disponibles

```python
class TicketStatus(StrEnum):
    """Estados posibles de un ticket."""
    open = "open"
    in_progress = "in_progress"
    pending = "pending"
    pending_infra = "pending_infra"  # ⚠️ ÚNICO ESTADO DE ESCALADO
    resolved = "resolved"
    closed = "closed"


class TicketPriority(StrEnum):
    """Prioridades de tickets."""
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TicketType(StrEnum):
    """
    Tipos de tickets según flujo de negocio.
    Define el proceso y las validaciones necesarias.
    """
    technical = "technical"
    installation = "installation"
    withdrawal = "withdrawal"
    relocation = "relocation"
    administrative = "administrative"


class AdministrativeSubtype(StrEnum):
    """Subtipos para tickets administrativos."""
    billing = "billing"
    data_update = "data_update"
    plan_change = "plan_change"
    other = "other"


class TicketTimelineEventType(StrEnum):
    """Tipos de eventos en la bitácora de ticket."""
    note = "note"
    alert = "alert"
    ot_event = "ot_event"
    status_change = "status_change"
    file = "file"
```

### Clase Ticket Completa

```python
class Ticket(Base, TimestampMixin):
    """
    Modelo de Tickets - Incidentes técnicos (Versión 2.0).
    """
    __tablename__ = "tickets"

    # ===== ID =====
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único del ticket"
    )

    # ===== CONEXIÓN =====
    connection_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="FK soft a tabla de conexiones"
    )

    # ===== CONTENIDO =====
    subject: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Asunto/Título del ticket"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Descripción detallada del problema"
    )

    availability_note: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Nota sobre disponibilidad horaria del cliente"
    )

    # ===== ESTADO Y PRIORIDAD =====
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum", native_enum=False),
        default=TicketStatus.open,
        nullable=False,
        index=True,
        comment="Estado actual: open, in_progress, pending, pending_infra, resolved, closed"
    )

    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority_enum", native_enum=False),
        default=TicketPriority.medium,
        nullable=False,
        index=True,
        comment="Prioridad: critical, high, medium, low"
    )

    # ===== TIPO DE TICKET =====
    ticket_type: Mapped[TicketType] = mapped_column(
        Enum(TicketType, name="ticket_type_enum", native_enum=False),
        default=TicketType.technical,
        nullable=False,
        index=True,
        comment="Tipo de flujo: technical, installation, withdrawal, relocation, administrative"
    )

    administrative_subtype: Mapped[Optional[AdministrativeSubtype]] = mapped_column(
        Enum(AdministrativeSubtype, name="administrative_subtype_enum", native_enum=False),
        nullable=True,
        comment="Subtipo para tickets administrativos"
    )

    # ===== CAMPOS PARA TRASLADOS/INSTALACIONES =====
    origin_connection_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="FK soft a conexión de origen (para RELOCATION)"
    )

    destination_connection_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="FK soft a conexión de destino (para RELOCATION, INSTALLATION)"
    )

    installation_tech: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Tecnología de instalación: fiber, wireless, hybrid"
    )

    # ===== AUDITORÍA - USUARIOS =====
    creator_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", name="fk_tickets_creator_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Usuario que creó el ticket"
    )

    assigned_to_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", name="fk_tickets_assigned_to_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Operador asignado al ticket"
    )

    # ===== RELACIONES =====
    creator: Mapped[Optional[User]] = relationship(
        "User",
        foreign_keys=[creator_id],
        lazy="joined"
    )

    assigned_to: Mapped[Optional[User]] = relationship(
        "User",
        foreign_keys=[assigned_to_id],
        lazy="joined"
    )

    timeline: Mapped[list[TicketTimeline]] = relationship(
        "TicketTimeline",
        back_populates="ticket",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="TicketTimeline.created_at.asc()"
    )

    work_orders: Mapped[list[WorkOrder]] = relationship(
        "WorkOrder",
        back_populates="ticket",
        lazy="select",
        cascade="all, delete-orphan"
    )

    attachments: Mapped[list[TicketAttachment]] = relationship(
        "TicketAttachment",
        back_populates="ticket",
        lazy="select",
        cascade="all, delete-orphan"
    )

    tags: Mapped[list[Tag]] = relationship(
        "Tag",
        secondary=ticket_tags_association,
        back_populates="tickets",
        lazy="selectin",
        viewonly=False
    )

    # ===== ÍNDICES =====
    __table_args__ = (
        Index("ix_tickets_status_priority", "status", "priority"),
        Index("ix_tickets_creator", "creator_id"),
        Index("ix_tickets_assigned", "assigned_to_id"),
        Index("ix_tickets_ticket_type", "ticket_type"),
        Index("ix_tickets_origin_connection", "origin_connection_id"),
        Index("ix_tickets_destination_connection", "destination_connection_id"),
    )

    def __repr__(self) -> str:
        return f"<Ticket(id={self.id}, subject='{self.subject}', status={self.status})>"
```

---

## 🔧 2. LÓGICA DE ESCALADO ACTUAL (FRONTEND)

### Ubicación
**Archivo:** `frontend/src/pages/TicketDetailPage.jsx`

### Botón de Escalado

```jsx
{isInSupport && !isClosed && (
  <Button
    className="w-full bg-purple-700 hover:bg-purple-600"
    onClick={() => setShowEscalateDialog(true)}
    disabled={isSaving}
  >
    <TrendingUp size={16} className="mr-2" /> Escalar a Infraestructura
  </Button>
)}
```

**Condiciones para mostrar:**
- ✅ Ticket en estado "in_progress" o "pending" (isInSupport)
- ✅ Ticket NO cerrado (isClosed === false)

### Dialog de Escalado

```jsx
<Dialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Escalar a Infraestructura</DialogTitle>
    </DialogHeader>
    <div className="space-y-3">
      <p className="text-sm text-zinc-300">
        El ticket pasará a estado Pendiente Infra y quedará retenido en soporte.
      </p>
      <textarea
        value={escalateNote}
        onChange={(e) => setEscalateNote(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        rows={3}
        placeholder="Nota opcional para la bitácora"
      />
    </div>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setShowEscalateDialog(false)}>
        Cancelar
      </Button>
      <Button 
        onClick={async () => { 
          await performStatusChange('pending_infra', escalateNote); 
          setShowEscalateDialog(false); 
          setEscalateNote(''); 
        }} 
        disabled={isSaving}
      >
        {isSaving ? 'Actualizando...' : 'Escalar'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Función Core: performStatusChange

```jsx
const performStatusChange = async (newStatus, note = '') => {
  try {
    setIsSaving(true);
    const payload = {
      status: newStatus,
    };
    
    // Si hay nota, agregamos evento a timeline
    if (note.trim()) {
      await ticketsService.addNote(ticket.id, note);
    }
    
    // Cambiar estado del ticket
    const updated = await ticketsService.updateTicket(ticket.id, payload);
    setTicket(updated);
    
    // Recargar para asegurar datos frescos
    await loadTicket();
  } catch (err) {
    console.error('Error changing status:', err);
    setError(err.message || 'Error al cambiar estado');
  } finally {
    setIsSaving(false);
  }
};
```

**Flujo de Ejecución:**
1. Usuario click "Escalar a Infraestructura"
2. Abre dialog con textarea opcional para nota
3. Click "Escalar" → `performStatusChange('pending_infra', escalateNote)`
4. **Llamadas API:**
   - Si hay nota: `POST /api/v2/tickets/{id}/timeline`
   - Siempre: `PATCH /api/v2/tickets/{id}` con `{status: "pending_infra"}`
5. Recarga ticket completo

---

## 📡 3. SERVICIOS Y ENDPOINTS

### Ubicación
**Archivo:** `frontend/src/services/tickets.service.js`

### Método: updateTicket

```javascript
/**
 * Actualizar ticket (PATCH)
 */
export const updateTicket = async (id, payload) => {
  try {
    const { data } = await api.patch(`${BASE_URL}/${id}`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error updating ticket:', error);
    throw error;
  }
};
```

**Endpoint:** `PATCH /api/v2/tickets/{id}`  
**Payload Actual:**
```json
{
  "status": "pending_infra"
}
```

### Método: addNote

```javascript
/**
 * Agregar nota a timeline
 */
export const addNote = async (ticketId, content) => {
  try {
    const { data } = await api.post(`${BASE_URL}/${ticketId}/timeline`, {
      content,
      event_type: 'note',
    });
    return data;
  } catch (error) {
    console.error('❌ Error adding note:', error);
    throw error;
  }
};
```

**Endpoint:** `POST /api/v2/tickets/{id}/timeline`  
**Payload:**
```json
{
  "content": "Nota del usuario sobre escalado",
  "event_type": "note"
}
```

---

## ⚠️ 4. LIMITACIONES ACTUALES

### ❌ Qué NO existe actualmente

1. **Enum para Sector/Área Técnica**
   - No hay `escalation_sector` (ej: NOC, Infraestructura, Hardware, Seguridad)
   - Solo existe estado genérico `pending_infra`

2. **Metadata de Escalado**
   - No se guarda **razón técnica** del escalado
   - No se guarda **componente afectado** (router, switch, fibra, etc.)
   - No se guarda **nivel de urgencia técnica**

3. **Asignación a Equipos**
   - No hay FK a "equipo NOC" o "equipo Infraestructura"
   - `assigned_to_id` solo asigna a **usuario individual**
   - No hay concepto de **cola de equipo**

4. **Historial de Escalados**
   - No se registra **quién escaló** (solo se infiere del timeline)
   - No se registra **cuántas veces se escaló** un mismo ticket
   - No se registra **tiempo en cada sector**

5. **Estados Específicos por Sector**
   - Solo existe `pending_infra` (genérico)
   - No hay:
     - `pending_noc`
     - `pending_hardware`
     - `in_progress_noc`
     - `resolved_noc`

---

## 🎯 5. PROPUESTA PARA FLUJO NOC/INGENIERÍA

### Campos Nuevos Necesarios

```python
# En modelo Ticket:

# 1. Sector asignado
escalation_sector: Mapped[Optional[EscalationSector]] = mapped_column(
    Enum(EscalationSector, name="escalation_sector_enum", native_enum=False),
    nullable=True,
    index=True,
    comment="Sector técnico: noc, infrastructure, hardware, security"
)

# 2. Metadata de escalado (JSONB)
escalation_metadata: Mapped[Optional[dict]] = mapped_column(
    JSONB,
    nullable=True,
    comment="Datos técnicos del escalado: razón, componente, severidad"
)

# Ejemplo escalation_metadata:
{
    "reason": "packet_loss",
    "affected_component": "router_core_01",
    "technical_severity": "high",
    "escalated_by_user_id": 9,
    "escalated_at": "2026-01-15T22:30:00Z",
    "escalation_count": 1,
    "last_sector": "support"
}

# 3. Asignación a equipo (FK a tabla teams - si existe)
assigned_team_id: Mapped[Optional[int]] = mapped_column(
    ForeignKey("teams.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
    comment="Equipo técnico asignado (NOC, Infra, etc.)"
)
```

### Enum Nuevo: EscalationSector

```python
class EscalationSector(StrEnum):
    """Sectores técnicos para escalado."""
    support = "support"           # Soporte nivel 1 (default)
    noc = "noc"                   # NOC - Monitoreo y operaciones
    infrastructure = "infrastructure"  # Infraestructura física
    hardware = "hardware"         # Hardware / Equipos
    security = "security"         # Seguridad / Ciberseguridad
    engineering = "engineering"   # Ingeniería / Proyectos
```

### Estados Nuevos (Opcional)

Si queremos estados específicos por sector:

```python
class TicketStatus(StrEnum):
    # Estados generales
    open = "open"
    in_progress = "in_progress"
    pending = "pending"
    resolved = "resolved"
    closed = "closed"
    
    # Estados de escalado por sector (nuevo)
    pending_noc = "pending_noc"
    in_progress_noc = "in_progress_noc"
    pending_infra = "pending_infra"
    in_progress_infra = "in_progress_infra"
    pending_hardware = "pending_hardware"
    in_progress_hardware = "in_progress_hardware"
```

**Alternativa simple:** Usar combinación `status + escalation_sector`:
- Status: `pending_escalated`
- Sector: `noc`
- Resultado: Ticket pendiente en NOC

---

## 🚀 6. FLUJO PROPUESTO (NUEVO)

### Paso 1: Botón "Escalar"
```jsx
<Button onClick={() => setShowEscalateDialog(true)}>
  Escalar Ticket
</Button>
```

### Paso 2: Dialog Mejorado
```jsx
<Dialog>
  {/* Selector de Sector */}
  <Select value={escalationSector} onChange={setEscalationSector}>
    <option value="noc">NOC (Monitoreo)</option>
    <option value="infrastructure">Infraestructura</option>
    <option value="hardware">Hardware</option>
    <option value="security">Seguridad</option>
  </Select>
  
  {/* Razón Técnica */}
  <Select value={escalationReason} onChange={setEscalationReason}>
    <option value="packet_loss">Pérdida de Paquetes</option>
    <option value="fiber_cut">Corte de Fibra</option>
    <option value="equipment_failure">Falla de Equipo</option>
    <option value="other">Otra razón</option>
  </Select>
  
  {/* Componente Afectado (opcional) */}
  <Input 
    placeholder="Ej: Router Core 01, Switch Rack 3"
    value={affectedComponent}
    onChange={setAffectedComponent}
  />
  
  {/* Nota (opcional) */}
  <Textarea 
    placeholder="Detalles adicionales para el equipo técnico"
    value={escalateNote}
    onChange={setEscalateNote}
  />
  
  <Button onClick={handleEscalate}>Escalar</Button>
</Dialog>
```

### Paso 3: Función handleEscalate (Nueva)
```jsx
const handleEscalate = async () => {
  const payload = {
    status: 'pending_escalated',  // O 'pending_noc', etc.
    escalation_sector: escalationSector,
    escalation_metadata: {
      reason: escalationReason,
      affected_component: affectedComponent,
      technical_severity: ticket.priority, // Heredar de prioridad
      escalated_by_user_id: currentUser.id,
      escalated_at: new Date().toISOString(),
      escalation_count: (ticket.escalation_metadata?.escalation_count || 0) + 1,
      last_sector: 'support'
    }
  };
  
  // Agregar nota a timeline
  if (escalateNote.trim()) {
    await ticketsService.addNote(ticket.id, escalateNote);
  }
  
  // Actualizar ticket
  await ticketsService.updateTicket(ticket.id, payload);
  
  // Recargar
  await loadTicket();
  setShowEscalateDialog(false);
};
```

### Paso 4: Backend (Nuevo Endpoint - Opcional)
```python
@router.post("/{ticket_id}/escalate")
async def escalate_ticket(
    ticket_id: int,
    escalation: EscalationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Escalar ticket a sector técnico.
    """
    ticket = await get_ticket_or_404(ticket_id, db)
    
    # Validar permisos
    if not can_escalate_ticket(current_user, ticket):
        raise HTTPException(403, "No autorizado para escalar")
    
    # Actualizar ticket
    ticket.status = TicketStatus.pending_escalated
    ticket.escalation_sector = escalation.sector
    ticket.escalation_metadata = {
        "reason": escalation.reason,
        "affected_component": escalation.component,
        "escalated_by_user_id": current_user.id,
        "escalated_at": datetime.utcnow().isoformat(),
        "escalation_count": (ticket.escalation_metadata.get("escalation_count", 0) + 1) if ticket.escalation_metadata else 1
    }
    
    # Agregar evento a timeline
    await add_timeline_event(
        ticket_id=ticket.id,
        event_type="status_change",
        content=f"Escalado a {escalation.sector.upper()}: {escalation.reason}",
        user_id=current_user.id,
        db=db
    )
    
    db.commit()
    db.refresh(ticket)
    
    return ticket
```

---

## 📋 7. CHECKLIST PARA IMPLEMENTACIÓN

### Backend
- [ ] Crear `EscalationSector` enum
- [ ] Agregar campo `escalation_sector` a modelo Ticket
- [ ] Agregar campo `escalation_metadata` (JSONB) a modelo Ticket
- [ ] (Opcional) Agregar campo `assigned_team_id` si existe tabla teams
- [ ] Crear migración Alembic
- [ ] Actualizar endpoint `PATCH /tickets/{id}` para aceptar nuevos campos
- [ ] (Opcional) Crear endpoint `POST /tickets/{id}/escalate`
- [ ] Agregar validaciones de permisos (quién puede escalar)

### Frontend
- [ ] Actualizar `TicketDetailPage.jsx`:
  - [ ] Agregar estados para sector, razón, componente
  - [ ] Modificar dialog de escalado con selectores
  - [ ] Actualizar `handleEscalate` con nuevo payload
- [ ] Actualizar `tickets.service.js`:
  - [ ] (Opcional) Agregar método `escalateTicket()`
- [ ] Agregar UI para mostrar sector escalado en TicketCard/TicketDetail
- [ ] Agregar filtros por `escalation_sector` en lista de tickets

### Testing
- [ ] Test unitario: Escalado NOC
- [ ] Test unitario: Escalado Infraestructura
- [ ] Test: Usuario sin permisos no puede escalar
- [ ] Test: Metadata se guarda correctamente
- [ ] Test E2E: Flujo completo de escalado

---

## 📞 DATOS DE REFERENCIA

### Estados Actuales Relacionados con Escalado
```python
TicketStatus.pending_infra  # Único estado de escalado actual
```

### Timeline Events Relevantes
```python
TicketTimelineEventType.status_change  # Se usa al cambiar status
TicketTimelineEventType.note           # Se usa para notas de escalado
```

### Permisos Actuales
**Archivo:** `backend/src/api/v2/tickets.py` (verificar)
- Actualmente cualquier usuario puede cambiar status vía PATCH
- **Necesario:** Validar rol para escalar (solo Support/Admin)

---

**Generado:** 15-ENE-2026 23:45  
**Para Próxima Sesión:** Usar como base para diseño e implementación de flujo NOC/Ingeniería  
**Próximos Pasos:** Validar propuesta con equipo → Crear ADR → Implementar migración
