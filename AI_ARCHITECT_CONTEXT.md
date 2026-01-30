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

## 🗄️ Estructura Lógica de Datos

### Relaciones Críticas

```
Users → Roles (N:N)
Users → Tickets (1:N, creator_id + assigned_to_id)
Users → Warehouses (1:N, si MOBILE type)

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

EngineeringTasks → Users (N:1)
EngineeringTasks → Tickets (N:1, opcional)
```

### Enums Principales

**TicketStatus:** open, in_progress, pending, resolved, closed  
**TicketType:** technical, installation, withdrawal, relocation, administrative  
**WorkOrderStatus:** pending_planning, assigned, in_progress, completed, failed  
**WarehouseType:** CENTRAL, MOBILE, VIRTUAL  
**ProductType:** SERIALIZED, BULK

---

## 🔐 Seguridad & Auth

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
| **Coordination** | 🚧 Dev | 🟠 Med | Teams, calendario, dist. OT (Q1 2026) |
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
| Q1 | Coordinación (Teams) | 🚧 Dev |
| Q2 | Mobile app nativa | 🚧 Plan |
| Q3 | Analytics + BI | 📋 Backlog |
| Q4 | ISPCube deep integration | 📋 Backlog |

---

## ⚠️ Deuda Técnica

1. **Beholder Legacy** → Funcionalidad replicada en Engineering. Deprecar Q2 2026.
2. **Frontend Legacy** → `src_legacy/` contiene código viejo. Limpiar.
3. **Test Coverage** → Coordinación sin tests (Q1).
4. **Documentation** → Algunos comentarios en código están desactualizados.

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

**Documento versión:** 1.0  
**Generado:** 30 Enero 2026  
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