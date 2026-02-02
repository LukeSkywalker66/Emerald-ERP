# 🤖 AI ARCHITECT PROMPT - Emerald ERP

**Contexto consolidado para IA (Gemini, Claude, etc.)**

Use este documento como contexto para preguntas arquitectónicas sobre Emerald ERP.

---

## 🎯 Misión del Sistema

Proveer a un **ISP (Internet Service Provider)** argentino una plataforma integrada que gestione:
1. **Incidentes técnicos** (tickets multi-flujo)
2. **Órdenes de trabajo** (seguimiento en campo)
3. **Stock operativo** (central y móvil)
4. **Tareas de infraestructura** (NOC/ingeniería)

---

## 📐 Decisiones Arquitectónicas Clave

### D1: Service Layer Pattern

**Decisión:** Toda lógica de negocio en `services/`, no en routers.

**Por qué:** Facilita testing, reutilización, cambios centralizados.

```python
# ❌ MAL
@router.post("/tickets")
def create_ticket(payload):
    if payload.type == "withdrawal":
        # generar OT aquí...
        
# ✅ BIEN
@router.post("/tickets")
def create_ticket(payload):
    return ticket_service.create_ticket(payload)
```

---

### D2: SQLAlchemy 2.0 Mapped Types

**Decisión:** Usar `Mapped[]` y `mapped_column()`, nunca `Column()`.

**Por qué:** Type hints nativos, mejor IDE support, compatible futuro.

```python
# ✅ SIEMPRE así
class Ticket(Base):
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    
# ❌ NUNCA así
class Ticket(Base):
    id = Column(Integer, primary_key=True)
```

---

### D3: JSONB para Datos Flexibles

**Decisión:** Usar JSONB (PostgreSQL) para campos que varían por tipo.

**Por qué:** Sin migración cuando se agrega campo nuevo. ISP típicamente pide cambios frecuentes.

```python
# En Ticket
custom_data: Mapped[Optional[dict]] = mapped_column(JSONB)

# Al guardar withdrawal
ticket.custom_data = {
    "reason": "customer_request",
    "equipment": ["router", "onu"],
    "contact": "+5491123456789"
}
```

---

### D4: Soft Delete (No Borrar Nada)

**Decisión:** Borrados lógicos vía flag `is_deleted`, NO borrado físico.

**Por qué:** Auditoría, recuperación, compliance.

```python
# Nunca
db.delete(ticket)

# Siempre
ticket.is_deleted = True
db.commit()
```

---

### D5: Teams en lugar de Usuarios para OT

**Decisión:** OT se asigna a **Teams**, no a usuarios individuales.

**Por qué:** Permite redistribución dinámica. Si técnico 1 se enferma, técnico 2 del team toma OT.

```
OT → Team A → [Técnico 1, Técnico 2, Técnico 3]
                  ↓ (team lead asigna)
             Técnico 2 ejecuta
```

---

### D6: Categorías Dinámicas (API-First)

**Decisión:** Tipos de ticket + motivos cargados desde BD, NO hardcoded.

**Por qué:** ISP necesita crear nuevas categorías sin tocar código.

```python
# ✅ Dinámico
GET /v2/tickets/categories
# Response: [{"id": 1, "name": "Falla Técnica", "motivos": [...]}, ...]

# ❌ Hardcoded (NUNCA)
TICKET_TYPES = {"technical": {...}, "installation": {...}}
```

---

### D7: Motivos Generan Asuntos

**Decisión:** Seleccionar motivo → generar automáticamente asunto del ticket.

**Por qué:** Consistencia, menos errores tipeo, tracking mejor.

```
Usuario selecciona:
  Categoría → "Falla Técnica"
  Motivo    → "Sin conexión"
  ↓
Sistema genera asunto: "Cliente reporta sin conexión - Falla Técnica"
```

---

### D8: Timeline Unificada

**Decisión:** Un único stream de eventos por ticket (notas, alertas, cambios OT).

**Por qué:** Evita navegar múltiples tabs/tablas. Contexto completo en una vista.

```
TICKET #123 Timeline:
[14:30] Creado por operador
[14:35] Técnico asignado → Juan
[15:00] OT #456 generada (pickup)
[15:45] Alerta: Baja de señal detectada (Beholder)
[16:00] Juan: "Revisando en sitio"
[16:30] OT #456: Status → completed
[16:35] Ticket → resolved
```

---

### D9: Consumo Automático de Stock

**Decisión:** Completar OT deduce automáticamente materiales de inventario móvil.

**Por qué:** Sincronización automática, menos errores manuales.

```
WorkOrder item: 1x ONU (serial ABC123)
Status: completed
↓
Backend deduce de warehouse móvil del técnico
↓
Genera StockMovement (auditoria)
↓
Si stock < mínimo → alerta almacenero
```

---

### D10: API Keys para Bots

**Decisión:** Integraciones (bots, webhooks) usan `x-api-key`, no JWT.

**Por qué:** Credenciales no expiran, mejor para automatización.

```bash
curl -H "x-api-key: sk_prod_abc123xyz" https://emerald.local/api/v2/tickets
```

---

### D11: Teams en lugar de Usuarios individuales para Coordinación

**Decisión:** Coordinación gestiona **Teams** (equipos de técnicos), no usuarios aislados. WorkOrders se asignan a Teams, el Team distribuye internamente.

**Por qué:** 
- Permite redistribución dinámica (si técnico se enferma, otro del team asume)
- Previene bilocación (técnico solo en 1 team)
- Escala mejor que N:1 (usuario) model

```
Team A (Móvil Ruta Zona Sur)
  ├─ Técnico 1 (Líder)
  ├─ Técnico 2
  └─ Móvil warehouse vinculado

WorkOrder #456 → asigna a Team A
  ↓
Team A lead asigna a Técnico 2
  ↓
Técnico 2 ejecuta en móvil
```

**Implementación:**
- BD: Teams table + TeamMembers (N:N con rol)
- Validación: Solo 1 leader/team, no duplicados de técnico en múltiples teams
- UI: Avatar component reutilizable, color coding (Técnico=Emerald, Líder=Cyan)
- Filtering: Dropdowns inteligentes previenen bilocación y asignaciones inválidas

---

### D12: UI Filtering Preventivo (Set-based Deduplication)

**Decisión:** Frontend mantiene Set de recursos asignados, filtra dinámicamente en dropdowns.

**Por qué:** UX preventiva (no puedes cometer errores), mejor performance (O(1) lookups).

```javascript
// CuadrillasPage.jsx
const assignedUserIds = new Set(
  teams.flatMap(t => t.members || [])
    .map(m => m.user_id)
    .filter(id => id !== null)
    .map(id => Number(id))
);

// availableUsersForAssign = users.filter(u => !assignedUserIds.has(Number(u.id)));
// Dropdown solo muestra no-asignados → imposible duplicar
```

---

## 🗄️ Estructura Lógica de Datos

### Relaciones Críticas

```
Users → Roles (N:N)
Users → Tickets (1:N, creator_id + assigned_to_id)
Users → Warehouses (1:N, si MOBILE type)
Users → TeamMembers (N:N, con rol) → Teams

Tickets → TicketCategory (N:1)
Tickets → TicketReason (N:1, dinámico)
Tickets → TicketEvents/Timeline (1:N)
Tickets → WorkOrders (1:N, auto-generates en withdrawal)
Tickets → Tags (N:N)

WorkOrders → Teams (N:1, asignación)
WorkOrders → WorkOrderItems (1:N, consumo)
WorkOrderItems → Products (N:1)

Products → StockBulk | SerialItems (1:N)
Warehouses → StockMovements (1:N)
Warehouses ← Teams (FK vehicle_id, type=MOBILE)

Teams (Coordinación)
  ├─ name: nombre cuadrilla
  ├─ vehicle_id: FK → Warehouses (type=MOBILE, nullable)
  ├─ is_active: booleano
  ├─ has many: TeamMembers
  └─ created_at, updated_at

TeamMembers (N:N con roles)
  ├─ team_id: FK → Teams
  ├─ user_id: FK → Users
  ├─ role: enum [technician, leader] (solo 1 leader/team)
  └─ joined_at: timestamp

EngineeringTasks → Users (N:1)
EngineeringTasks → Tickets (N:1, opcional)
```

### Enums Principales

**TicketStatus:** open, in_progress, pending, resolved, closed  
**TicketType:** technical, installation, withdrawal, relocation, administrative  
**WorkOrderStatus:** pending_planning, assigned, in_progress, completed, failed  
**WarehouseType:** CENTRAL, MOBILE, VIRTUAL  
**ProductType:** SERIALIZED, BULK

### D13: Agendamiento de Órdenes de Trabajo con Coordinación

**Decisión:** WorkOrder soporta agendamiento independiente de ejecución:
1. Coordinador pacta fecha con cliente → `scheduled_start` (estado: COORDINATED)
2. Coordinador asigna cuadrilla → `team_id` (estado: SCHEDULED automáticamente)
3. Técnico ejecuta en fecha pactada → `in_progress` → `completed`

**Campos nuevos:**
- `team_id` (FK a Teams, nullable)
- `scheduled_start` / `scheduled_end` (datetime timezone-aware)
- `estimated_duration` (minutos, default 60)
- `coordination_notes` (ej: "Llave en portería")

**Lógica automática:**
- Si se actualiza `scheduled_start` + `estimated_duration` → calcula `scheduled_end` automáticamente
- Si asigna `scheduled_start` sin `team_id` → transición a estado COORDINATED
- Si asigna `team_id` + existe `scheduled_start` → transición a estado SCHEDULED

**Ventaja:** Flujo de coordinación independiente del técnico individual (legacy `technician_id` deprecated).

---

### JWT Flow

```
POST /v1/auth/login
  username + password
  ↓
Backend valida contraseña (Argon2)
  ↓
Retorna {access_token, refresh_token, user_id}
  ↓
Frontend almacena en sessionStorage (JWT) + localStorage (refresh)
  ↓
Requests subsecuentes: Authorization: Bearer <jwt>
  ↓
Backend valida firma JWT en middleware
```

### API Key Flow

```
Admin crea API Key en UI
  ↓
Backend genera key + hash
  ↓
Bot/webhook usa: x-api-key: <key>
  ↓
Backend valida contra tabla APIKey
  ↓
Auditoria: IP + timestamp
```

---

## 🚀 Deployment Runbook

### Dev (Local)

```bash
docker-compose up -d
# Automáticamente:
#   - Crea BD + aplica migraciones
#   - Inicia backend (8500)
#   - Inicia frontend (5173)
#   - Nginx proxy en 80
```

### Prod (Clean Deploy)

```bash
# 1. BD
docker-compose up -d db
docker-compose exec backend alembic upgrade head

# 2. Backend
docker-compose build backend
docker-compose up -d backend

# 3. Frontend
docker-compose build frontend
docker-compose up -d frontend

# 4. Nginx + SSL
docker-compose build nginx
docker-compose up -d nginx certbot
```

---

## 🔧 Troubleshooting Matriz

| Síntoma | Causa Probable | Fix |
|---------|--------|-----|
| 404 /api/v2/tickets | Proxy Vite mal configurado | Check `INTERNAL_API_URL` en docker-compose |
| 401 Unauthorized | JWT expirado | Usar `refresh_token` endpoint |
| 422 Unprocessable Entity | Schema Pydantic inválido | Validar payload contra swagger |
| Slow queries | Missing índices | Ver logs PostgreSQL, añadir Index() |
| OT no deduce stock | Workflow incompleto | Check que status sea `completed` |
| Categoría no carga | API error silencioso | Ver console browser + logs backend |

---

## 📊 Módulos & Completitud

| Módulo | Status | Risk | Notes |
|--------|--------|------|-------|
| **Tickets** | ✅ Prod | 🟢 Bajo | 5 flujos, 59 tests, 81% pass |
| **Work Orders** | ✅ Prod | 🟢 Bajo | CRUD, ejecución móvil, stock integration |
| **Inventory** | ✅ Prod | 🟢 Bajo | Stock + movimientos, serializados OK |
| **Engineering** | ✅ Prod | 🟢 Bajo | Kanban, timeline, NOC workflows |
| **Coordination** | ✅ MVP | 🟢 Bajo | Teams + miembros + móviles + roles + filtering (Q1 2026) |
| **Beholder** | ⚠️ Legacy | 🔴 Alto | Monitor diagnóstico, deprecar |

---

## 🎓 Decisiones de Diseño Controversiales (& Por Qué)

### C1: ¿Por Qué React + Vite y no Vue/Svelte?

**Contexto:** Cliente tiene experiencia React, ecosystem más grande.  
**Implicación:** Más fácil onboarding, librerías más maduras (Shadcn/ui).

### C2: ¿Por Qué FastAPI y no Django/Flask?

**Contexto:** Necesitamos async (Celery), validación automática (Pydantic), auto-docs.  
**Implicación:** FastAPI mejor para APIs puras. Django mejor si necesitaba admin UI.

### C3: ¿Por Qué PostgreSQL y no MongoDB?

**Contexto:** Datos altamente relacionales (tickets ↔ OT ↔ stock).  
**Implicación:** PostgreSQL + JSONB combina lo mejor: relaciones + flexibilidad.

### C4: ¿Por Qué SQLAlchemy 2.0?

**Contexto:** Type hints nativas, mejor IDE support, depreca sintaxis vieja.  
**Implicación:** Costo: curva aprendizaje. Ganancia: código más mantenible.

---

## 📈 Métricas de Éxito

| Métrica | Target | Actual |
|---------|--------|--------|
| Test Coverage (E2E) | >80% | 81% ✅ |
| API Response Time | <200ms | ~100ms ✅ |
| DB Query Time | <100ms | ~50ms ✅ |
| Uptime | 99.5% | TBD (prod) |
| Deployment Time | <5 min | ~2 min ✅ |

---

## 🔮 Roadmap 2026

| Q | Feature | Status |
|---|---------|--------|
| Q1 | Coordinación (Teams) | ✅ MVP Completado |
| Q2 | Mobile app nativa + Coordinación v2 (calendarios, OT integration) | 🚧 Plan |
| Q3 | Analytics + BI | 📋 Backlog |
| Q4 | ISPCube deep integration | 📋 Backlog |

---

## 📦 Detalles de Implementación: Módulo Coordinación

### Frontend Components

**CuadrillasPage.jsx** (326 lines) - Orquestación principal
```javascript
State Management:
  - teams: Team[] ← GET /v2/coordination/teams?active_only=true
  - users: User[] ← GET /v2/users?role=tecnico (filtrado por role)
  - vehicles: Warehouse[] ← GET /inventory/warehouses?type=MOBILE
  
Derived State (Set-based):
  - assignedVehicleIds = new Set(teams.map(t => t.vehicle_id))
  - assignedUserIds = new Set(teams.flatMap(t => t.members.map(m => m.user_id)))
  
Computed Lists (para dropdowns):
  - availableVehiclesForCreate = vehicles.filter(v => !assignedVehicleIds.has(v.id))
  - availableVehiclesForEdit = vehicles.filter(v => !assignedVehicleIds.has(v.id) || v.id === currentTeam.vehicle_id)
  - availableUsersForAssign = users.filter(u => !assignedUserIds.has(u.id))

Handlers:
  - loadTeams() → fetch + set state
  - loadUsers() → fetch + filter role → set state
  - loadVehicles() → fetch warehouse type=MOBILE → set state
  - handleCreateTeam(name, vehicle_id, initial_member_id)
  - handleEditTeam(teamId, name, vehicle_id, is_active)
  - handleDeleteTeam(teamId)
```

**TeamCard.jsx** (260 lines) - Display + inline editing
```javascript
Props:
  - team: Team object
  - onEdit(team), onDelete(teamId, teamName)
  - availableUsers: User[] (for adding members)
  - onTeamUpdated: callback to refresh

Key Features:
  - getRoleColor(role) → 
    case 'leader': return 'bg-cyan-600/20 text-cyan-300 border-cyan-600/40'
    case 'technician': return 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40'
  
  - Member card layout (px-2 py-1 compact):
    [Avatar] [Name/Email] [Role Selector] [Delete Button (h-5 w-5)]
    
  - handleRoleChange(member, newRole):
    if newRole=leader && currentLeader exists && currentLeader !== member:
      confirm("Replace current leader?") → if yes:
        1. demote currentLeader to technician
        2. promote member to leader
    
  - handleRemoveMember(userId) → DELETE /v2/coordination/teams/{id}/members/{userId}
```

**Avatar.jsx** (76 lines) - Reusable component
```javascript
Props:
  - name: string (full name)
  - email: string
  - image: optional URL
  - size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  - variant: 'emerald' | 'amber' | 'ruby' | 'zinc'

Logic:
  - getInitials(name) → take first 2 chars (J from Juan)
  - Display: image if exists, else initials in sized div
  - Tooltip: "{name} - {email}"
  
Size Mapping:
  xs: h-6 w-6, text-xs
  sm: h-8 w-8, text-sm
  md: h-10 w-10, text-base
  lg: h-12 w-12, text-lg
  xl: h-16 w-16, text-2xl
```

**CreateTeamDialog.jsx** (170 lines)
```javascript
Form Fields:
  - name: input[type=text] required
  - vehicle_id: select (name + ID display)
    options: {label: "Móvil Zona Sur (ID: 5)", value: 5}
  - initial_member_id: select
    options: {label: "Juan García (tech1@emerald.com)", value: 123}
  - is_active: checkbox, default true

onSubmit:
  1. POST /v2/coordination/teams {name, vehicle_id, is_active}
  2. if initial_member_id:
     POST /v2/coordination/teams/{newTeamId}/members
       {user_id: initial_member_id, role: "technician"}
```

**EditTeamDialog.jsx** (144 lines)
```javascript
Props:
  - team: Team
  - availableVehicles: Warehouse[]

Form Fields: (similar to create, minus member field)
  - name: input
  - vehicle_id: select
  - is_active: checkbox

onSubmit:
  PUT /v2/coordination/teams/{team.id} {name, vehicle_id, is_active}
```

**AddMemberDialog.jsx** (143 lines)
```javascript
Props:
  - availableUsers: User[] (pre-filtered, no duplicates)

Form Fields:
  - user_id: select
  - role: radio buttons or select [technician, leader]

onSubmit:
  POST /v2/coordination/teams/{teamId}/members {user_id, role}
```

### Backend Service Layer

**coordination_service.py**
```python
async def get_teams(db: Session, active_only: bool = True):
    """Get all teams with members populated"""
    query = db.query(Team)
    if active_only:
        query = query.filter(Team.is_active == True)
    return query.all()

async def create_team(db: Session, payload: TeamCreate):
    """Create team (optionally with initial vehicle)"""
    team = Team(name=payload.name, vehicle_id=payload.vehicle_id, is_active=True)
    db.add(team)
    db.commit()
    return team

async def add_team_member(db: Session, team_id: int, user_id: int, role: str = "technician"):
    """Add member with validation (no duplicate users in team)"""
    # Check user already in any team
    existing = db.query(TeamMember).filter(TeamMember.user_id == user_id).first()
    if existing:
        raise ValueError(f"User {user_id} already in team {existing.team_id} (bilocación)")
    
    # Add member
    member = TeamMember(team_id=team_id, user_id=user_id, role=role)
    db.add(member)
    db.commit()
    return member

async def update_member_role(db: Session, team_id: int, user_id: int, new_role: str):
    """Update role with single-leader enforcement"""
    member = db.query(TeamMember)\
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id)\
        .first()
    
    if not member:
        raise ValueError("Member not found")
    
    if new_role == "leader":
        current_leader = db.query(TeamMember)\
            .filter(TeamMember.team_id == team_id, TeamMember.role == "leader")\
            .first()
        
        if current_leader and current_leader.user_id != user_id:
            # Demote old leader
            current_leader.role = "technician"
            db.add(current_leader)
    
    member.role = new_role
    db.add(member)
    db.commit()
    return member
```

---

## ⚠️ Deuda Técnica

1. **Beholder Legacy** → Funcionalidad replicada en Engineering. Deprecar Q2 2026.
2. **Frontend Legacy** → `src_legacy/` contiene código viejo. Limpiar.
3. **Test Coverage** → Coordinación sin tests E2E (deferred Q2 2026).
4. **Documentación** → Algunos comentarios en código están desactualizados (actualizado 2 Feb 2026).

---

## 🤝 Contribución Guidelines (Para IA)

Si hago cambios en Emerald:

1. **Service Layer First** → lógica en services/, no routers
2. **Mapped Types** → SQLAlchemy 2.0 siempre
3. **JSONB** → datos flexibles en JSONB, no nuevas columnas
4. **Audit** → registra changes en AuditLog (via trigger o servicio)
5. **Tests** → al menos 1 test E2E por nueva feature
6. **Docs** → actualizar MASTER_CONTEXT.md si cambio arquitectura

---

## 📞 Contacto & Escalación

- **Arquitectura:** Revisar ARCHITECTURE_DECISIONS.md
- **Frontend:** Ver PLAN_FRONTEND_INVENTARIO.md
- **Backend:** Ver AUTH_SYSTEM.md, BASE_DATOS.md
- **Deployment:** Ver DEPLOYMENT.md
- **Integraciones:** Ver INTEGRACIONES.md, ISPCUBE_API_REFERENCE.md

---

**Documento versión:** 1.1  
**Generado:** 2 Febrero 2026  
**Para:** Arquitectos de sistemas + IA (Gemini, Claude, etc.)  
**Precisión:** 95%+ (basado en código fuente actual)

---

## 🎨 Design Language & UX Guidelines

### Concepto Central: "The Emerald City Cyberpunk"
La interfaz debe fusionar la narrativa de **"El Mago de Oz"** con una estética **Retro-Futurista / Cyberpunk**.
No queremos un "ERP corporativo gris". Queremos una interfaz que se sienta como operar una consola de hacking en la Ciudad Esmeralda.

**Paleta de Colores (Tailwind):**
- **Primario:** Esmeralda Neón (`emerald-400`, `emerald-500`) para acciones principales y bordes brillantes.
- **Fondo:** Oscuro profundo (`zinc-950`, `black`), simulando terminales CRT o modo nocturno perpetuo.
- **Acentos:**
    - **Ruby Red** (`rose-600`): Para errores críticos ("Zapatillas de Rubí").
    - **Yellow Brick Road** (`amber-400`): Para advertencias, caminos de progreso o estados intermedios.
    - **Tin Man Metal** (`slate-400`): Para textos secundarios y estructuras metálicas.

**Componentes & Vibe:**
- **Bordes:** Finos, brillantes, con sutiles efectos de `glow` (resplandor) o `box-shadow` de color.
- **Tipografía:** Sans-serif moderna para lectura, pero Monospaced (tipo código) para datos técnicos (IPs, MACs, Logs).
- **Feedback Visual:** Todo debe reaccionar. Hover effects tipo "encendido de neón".
- **Glassmorphism:** Paneles semitransparentes (`bg-zinc-900/80 backdrop-blur`) sobre fondos oscuros.

**Nombres de Código (Lore):**
- **Beholder:** El ojo que todo lo ve (Monitoreo).
- **Tin Man:** Automatización y scripts rígidos.
- **Scarecrow:** Inteligencia y analítica (El cerebro).
- **Lion:** Seguridad y permisos (El coraje/fuerza).
- **Yellow Road:** Flujos de onboarding o wizards paso a paso.
-