# Decisiones Arquitectónicas - Emerald ERP

**Fecha:** 5 de Enero de 2026  
**Versión:** v2.0 - Tickets API  
**Estado:** En Producción (Testing)

---

## 1. Routing & URL Handling

### Decisión
Las rutas del backend aceptan **ambas formas**: con y sin trailing slash (`/tickets/` y `/tickets`).

### Justificación
- **Portabilidad**: Frontend puede usar rutas sin slash, backend respeta ambas.
- **Robustez**: No dependemos de middleware de redirecciones que causan problemas de CORS.
- **Simplidad**: Axios no necesita lógica especial de manejo de redirects.

### Implementación
```python
@router.get("/{ticket_id}/", response_model=TicketDetailResponse)
@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket_detail(ticket_id: int, db: Session = Depends(get_db)):
    # Una sola implementación, dos decoradores
```

**Frontend usa:** URLs sin trailing slash (`/v2/tickets`, `/v2/tickets/10`)  
**Backend acepta:** Ambas formas automáticamente

---

## 2. HTTP Client Configuration (Axios)

### Decisión
Cliente Axios minimalista con `maxRedirects: 5` pero **sin interceptores complicados**.

### Por Qué NO Usamos Interceptores de Redirecciones
- ❌ Pueden causar loops infinitos
- ❌ Pierden contexto de la solicitud original (headers, auth)
- ❌ Complican el debugging
- ✅ Axios ya maneja redirects 3xx automáticamente

### Configuración Final
```javascript
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  maxRedirects: 5,  // Confiar en Axios
});
```

---

## 3. Error Handling Strategy

### Backend
- **Pydantic Validation**: Automática en todos los endpoints
- **HTTP Exceptions**: `HTTPException` con `status_code` y `detail`
- **404 Handling**: Explícito si el recurso no existe

```python
if not ticket:
    raise HTTPException(status_code=404, detail="Ticket not found")
```

### Frontend
- **Error Boundary**: En `TicketDetailPage` y `TicketsPage`
- **User-Friendly Messages**: Mostrar `error.response?.data?.detail` cuando sea posible
- **Fallback Messages**: Mensajes genéricos si el backend no proporciona detalle

```javascript
catch (error) {
  setError(error.response?.data?.detail || error.message || 'Error desconocido');
}
```

---

## 4. Data Validation

### SQLAlchemy 2.0 + Pydantic
- **Models** (`models.py`): Definen estructura en DB (Mapped[], mapped_column())
- **Schemas** (`schemas/tickets.py`): Definen estructura de API (BaseModel)
- **Validación Automática**: Pydantic valida entrada, SQLAlchemy valida escritura

### Enum Safety
```python
# En modelo
priority: Mapped[TicketPriority] = mapped_column(Enum(TicketPriority), default=TicketPriority.MEDIUM)

# En schema
priority: TicketPriority = TicketPriority.MEDIUM
```

---

## 5. Security & CORS

### Current Setup
- **CORS Middleware**: Habilitado en `main.py`
- **JWT Ready**: Infraestructura para tokens (no activa en testing)
- **User Context**: `request.state.user_id` por seguridad futura

### For Production
- ✅ Implementar JWT token validation
- ✅ Usar `Depends(get_current_user)` en endpoints protegidos
- ✅ Validar origen en CORS (no usar `*`)
- ✅ Usar HTTPS obligatorio

---

## 6. Logging & Observability

### Actual State
- **Backend**: Logs de uvicorn (HTTP requests/responses)
- **Frontend**: `console.error()` en try/catch
- **Database**: PostgreSQL activity logs (via Docker)

### Recomendaciones para Escala
```python
# Backend - Agregar logging estructurado
import logging
logger = logging.getLogger(__name__)

# Ejemplo:
logger.info(f"Ticket {ticket_id} loaded by user {user_id}")
logger.error(f"Database error: {exc}", exc_info=True)
```

---

## 7. Frontend Architecture

### Service Layer Pattern
```
api/client.js (Axios client)
    ↓
services/tickets.service.js (Business logic)
    ↓
pages/TicketsPage.jsx (UI logic)
```

### Beneficios
- ✅ Centralized API calls
- ✅ Easy to mock for testing
- ✅ Consistent error handling
- ✅ Reusable across components

---

## 8. Database Relationships & Eager Loading

### Strategy
Usar `joinedload()` y `selectinload()` para evitar N+1 queries:

```python
stmt = (
    select(Ticket)
    .options(
        joinedload(Ticket.creator),
        joinedload(Ticket.assigned_to),
        selectinload(Ticket.timeline),
        selectinload(Ticket.work_orders).joinedload(WorkOrder.technician),
    )
)
```

### Diferencia
- **joinedload**: Para relaciones 1-to-1 (creator, assigned_to)
- **selectinload**: Para relaciones 1-to-Many (timeline, work_orders)

---

## 9. API Response Format

### Standardized Responses
```json
// GET /api/v2/tickets
[
  {
    "id": 10,
    "subject": "...",
    "status": "open",
    "priority": "high",
    "created_at": "2026-01-05T12:09:21.599142Z",
    "creator_name": "Administrador"
  }
]

// GET /api/v2/tickets/10
{
  "id": 10,
  "subject": "...",
  "timeline": [...],
  "work_orders": [...]
}
```

### No Wrapper Objects
- ✅ Arrays at root level para listas
- ✅ Flat structure para detalles
- ❌ Evitar `{data: [...], status: "ok"}`

---

## 10. Deployment & Portability

### Docker Compose Strategy
- **Backend**: Uvicorn on port 8500
- **Frontend**: Vite dev server on port 5173 (dev) / Nginx (prod)
- **Database**: PostgreSQL 15 with mounted volume
- **No hardcoded IPs**: Todo via service names (emerald_backend, etc)

### Environment Configuration
```python
# backend/src/config.py
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://emerald_owner:password@emerald_db:5432/emerald_stock"
)
```

### Frontend
```javascript
// .env (git ignored)
VITE_API_URL=/api  // Relative path para portabilidad
```

---

## 11. Testing & Quality Assurance

### Upcoming (Phase 2)
- [ ] Unit tests para servicios (backend)
- [ ] Integration tests para API endpoints
- [ ] E2E tests para flujos principales (Cypress/Playwright)
- [ ] Load testing con k6/Apache JMeter

### Current QA
- Manual testing en localhost
- Database verification con `psql`
- API testing con `curl`

---

## 12. Migration Strategy (Alembic)

### Current Migrations
- `221e88a56548_creacion_inicial_de_tablas.py` - Initial tables
- `678033205aa3_sincronizacion_post_stamp.py` - Post-sync

### Process for New Changes
```bash
# 1. Modify model in models.py
# 2. Create migration
alembic revision --autogenerate -m "description"
# 3. Review migration
# 4. Apply
alembic upgrade head
```

### Safety
- ✅ Migrations are reversible (`alembic downgrade -1`)
- ✅ Always test migrations on dev before prod
- ✅ Keep migrations in git for reproducibility

---

## 13. Known Limitations & TODOs

### Current
- ❌ No authentication (user_id hardcoded to 2)
- ❌ No pagination UI (API supports it)
- ❌ No filtering UI (API supports it)
- ❌ No edit/delete endpoints
- ❌ No real-time updates (WebSocket)

### Next Phase
1. Implement JWT login
2. Add edit/delete for tickets
3. Implement work-order creation UI
4. Add timeline comments
5. Real-time notifications

---

## 14. Performance Considerations

### Backend
- ✅ Eager loading relationships (no N+1)
- ✅ Query pagination (limit/offset)
- ✅ Index database on frequently-queried fields
- ⚠️ TODO: Add caching for list endpoints

### Frontend
- ✅ Component lazy loading via React.lazy()
- ✅ Service layer separates concerns
- ⚠️ TODO: Implement SWR or React Query for data fetching

### Database
- ✅ PostgreSQL JSONB for flexible fields (meta_data)
- ✅ Indexed timestamps for sorting
- ⚠️ TODO: Add triggers for audit logging

---

## 15. Code Organization

```
backend/
├── alembic/               # Database migrations
├── src/
│   ├── main.py           # FastAPI app setup
│   ├── models.py         # SQLAlchemy models
│   ├── database.py       # DB connection
│   ├── routers/
│   │   ├── v1/          # Legacy endpoints
│   │   └── tickets_v2.py # New API
│   ├── schemas/          # Pydantic models
│   ├── services/         # Business logic
│   └── clients/          # External integrations

frontend/
├── src/
│   ├── api/
│   │   └── client.js     # Axios instance
│   ├── services/         # API services
│   ├── pages/            # Route components
│   ├── components/       # Reusable UI
│   └── assets/           # Static files
├── vite.config.js        # Build config
└── tailwind.config.js    # Styling
```

---

## Conclusion

**El sistema está diseñado para escalar:**
- ✅ Modular (routers/servicios separados)
- ✅ Type-safe (Pydantic + SQLAlchemy 2.0)
- ✅ Error-resilient (validaciones en ambas capas)
- ✅ Portable (Docker + env vars)
- ✅ Maintainable (documentado + clean code)

**Próximas acciones:**
1. Agregar autenticación real
2. Implementar tests
3. Optimizar queries con caching
4. Documentar API con OpenAPI/Swagger
