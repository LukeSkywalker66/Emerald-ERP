# ⚡ EXECUTIVE SUMMARY - Emerald ERP (2 min read)

**Para arquitectos que necesitan entender el proyecto en tiempo mínimo.**

---

## 🎯 ¿Qué es Emerald ERP?

Sistema de gestión integral para ISP (Proveedor Internet) en Argentina. Maneja:
- **Tickets de soporte** (5 flujos: técnico, instalación, baja, traslado, administrativo)
- **Órdenes de trabajo** (OT) derivadas de tickets
- **Inventario operativo** (stock central + móvil en camionetas)
- **Ingeniería/NOC** (kanban de tareas de infraestructura)

---

## 📦 Stack (Ultra-Simple)

```
Frontend: React 19 + Vite + Tailwind CSS
         ↓
Nginx (proxy, SSL)
         ↓
Backend: Python 3.11 + FastAPI + SQLAlchemy 2.0
         ↓
PostgreSQL 15 (base de datos)
         ↓
Celery + Redis (tareas async)

Todo en Docker Compose
```

---

## 🗄️ Data Model (Esencial)

```
Users (técnicos, admins)
  ↓
Tickets (incidentes técnicos)
  ├─ TicketTimeline (bitácora unificada)
  └─ WorkOrders (órdenes de trabajo)
       ├─ asignadas a Teams (no usuarios)
       └─ WorkOrderItems (materiales consumidos)

Inventario:
  Warehouses (central + móvil)
    └─ Products (stock serializados + granel)
       └─ StockMovements (auditoría)

Engineering:
  Tasks (kanban)
    └─ Timeline (comentarios)
```

---

## 🔑 Reglas de Negocio Clave

| Regla | Descripción | Impacto |
|-------|-------------|--------|
| **Una baja → OT pickup** | Crear ticket de tipo `withdrawal` genera automáticamente WorkOrder de retiro | Flujo automático |
| **OT → Teams** | OT se asigna a equipos, no usuarios individuales | Flexibilidad laboral |
| **Stock automático** | Completar OT deduce automáticamente materiales usados | Inventory sync |
| **Timeline unificada** | Un único stream: notas, alertas, eventos OT, cambios estado | No múltiples tabs |
| **Categorías dinámicas** | Tipos de ticket + motivos NO hardcoded, cargados desde BD | Admin sin código |

---

## 📱 Módulos Status

| Módulo | Status | Features |
|--------|--------|----------|
| Tickets | ✅ Prod | 5 flujos dinámicos, timeline, adjuntos |
| Work Orders | ✅ Prod | CRUD, ejecución móvil, consumo stock |
| Inventario | ✅ Prod | Almacenes, serializados, movimientos |
| Ingeniería/NOC | ✅ Prod | Kanban, prioridad, timeline |
| Coordinación | 🚧 Dev | Teams, calendario, distribución OT |

---

## 🏗️ Patrones Clave

1. **Service Layer** → lógica de negocio separada de endpoints
2. **Flexible Schema** → JSONB para datos que varían por tipo
3. **Event-Driven Timeline** → cada cambio genera evento registrable
4. **Soft Delete** → archivado lógico, no borrado físico
5. **Auditoría** → tabla AuditLog con before/after y IP

---

## 🔐 Auth

```
User login (email + password)
  ↓
JWT token (JWT + Refresh Token)
  ↓
Header: Authorization: Bearer <jwt>
  ↓
API Key alternativo: x-api-key (para bots)
```

---

## 🚀 Deploy

```bash
# Desarrollo
docker-compose up -d
# http://localhost (nginx)

# Producción
docker-compose up -d --build
# SSL vía Let's Encrypt
# Postgres en volumen persistente
# Celery worker para async tasks
```

---

## 📂 Dónde Está Qué

| Necesito... | Archivo/Carpeta |
|---|---|
| Endpoints REST | `backend/src/routers/` |
| Lógica negocio | `backend/src/services/` |
| Modelos BD | `backend/src/models/` |
| UI React | `frontend/src/pages/` |
| Componentes | `frontend/src/components/` |
| API calls | `frontend/src/services/` |

---

## ❓ Preguntas Comunes Respondidas

**Q: ¿Por qué Teams en lugar de usuarios para OT?**
R: Permite redistribución dinámica. Si técnico 1 se enferma, técnico 2 del mismo team puede tomar la OT sin cambiar asignación.

**Q: ¿Cómo genera automáticamente el asunto del ticket?**
R: Categoría (ej "Falla Técnica") → Motivo (ej "Sin conexión") → Backend genera asunto. Todo dinámico desde BD.

**Q: ¿Qué es ese JSONB en las tablas?**
R: Columna PostgreSQL flexible para datos que no caben en columnas tradicionales. Ej: custom_data en ticket según tipo.

**Q: ¿Está listo para producción?**
R: Sí. Tickets, OT, Inventario e Ingeniería ✅. Coordinación (Teams) 🚧.

**Q: ¿Cómo sincroniza con ISPCube (CRM)?**
R: `ispcube_client.py` sincroniza conexiones cada N horas. Búsqueda de cliente por DNI usa ISPCube en tiempo real.

---

## 🔗 Documentación Completa

- **[MASTER_CONTEXT.md](MASTER_CONTEXT.md)** ← Para conocimiento profundo (30 min)
- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** ← Índice de todos los docs
- **[docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md)** ← Por qué decisiones así

---

**Generated:** 30 Enero 2026  
**Completitud:** 90% (Coordinación en desarrollo)  
**Next Review:** 15 Febrero 2026
