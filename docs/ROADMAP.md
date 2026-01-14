# 🗺️ Roadmap - Emerald ERP

## ✅ Completado (v2.0.0)

### Sistema de Tickets V2 (Reescrito)
- ✅ Arquitectura modular (routers, services, repositories)
- ✅ Enum `pending_infra` para tickets de infraestructura
- ✅ WorkOrderType `infrastructure`
- ✅ Campo `availability_note` (horarios de disponibilidad)
- ✅ Sistema de etiquetas (tags) con filtrado avanzado
- ✅ Historial de tickets por conexión
- ✅ Detección de problemas recurrentes (<7 días)
- ✅ Inline editing (estado, prioridad, asignado) con iconos
- ✅ Timeline de eventos con auditoría
- ✅ Detalles de conexión (cliente, plan, nodo)
- ✅ Búsqueda avanzada (ID, asunto, cliente, DNI)
- ✅ Componentes UI coherentes (Shadcn/UI + Tailwind)
- ✅ Estados dinámicos en timeline (live status de OTs) - 2026-01-08

### Sistema de Autenticación
- ✅ JWT + Refresh Tokens
- ✅ Hashing con Argon2
- ✅ Sistema de roles y permisos
- ✅ Auditoría de acciones (audit_logs)
- ✅ Rate limiting por IP

### Infraestructura
- ✅ Migraciones Alembic (6 migrations aplicadas)
- ✅ Docker Compose con servicios completos
- ✅ Nginx reverse proxy
- ✅ SSL con Let's Encrypt

## 🎯 Prioridad Alta (Q1 2026)

### Backend/API
- [ ] Migrar a async/await completo (FastAPI + async_sessionmaker)
- [ ] Implementar paginación en todos los endpoints de listado
- [ ] Añadir filtros avanzados en tickets (fecha creación, actualización)
- [ ] Webhooks para notificaciones (Discord, Telegram)
- [ ] Export de tickets a PDF/Excel
- [ ] Dashboard de métricas (tickets por estado, SLA, tiempo promedio)

### Sistema de Notificaciones
- [ ] Notificaciones en tiempo real (WebSockets)
- [ ] Alertas por email cuando hay problemas recurrentes
- [ ] Recordatorios de tickets pendientes
- [ ] Notificaciones de asignación

### UI/UX
- [ ] Dark/Light mode toggle
- [ ] Filtros guardados (presets)
- [ ] Drag & drop para adjuntos en tickets
- [ ] Kanban board para tickets
- [ ] Calendar view para OTs programadas

## 🔄 Prioridad Media (Q2 2026)

### Funcionalidades Nuevas
- [ ] Sistema de plantillas de tickets
- [ ] SLA tracking automático
- [ ] Chat interno por ticket
- [ ] Knowledge base / FAQ
- [ ] Mobile app (React Native)

### Backend
- [ ] Cache con Redis para queries frecuentes
- [ ] GraphQL API (además de REST)
- [ ] Tests automatizados (pytest + coverage >80%)

### Integraciones
- [ ] Retry con backoff exponencial en APIs externas
- [ ] Timeouts configurables por integración
- [ ] Webhooks desde ISPCube para sync en tiempo real

### Base de Datos
- [ ] Índices compuestos para queries frecuentes
- [ ] Soft deletes en tablas críticas
- [ ] Particionado en tablas de alto crecimiento

## 📊 Prioridad Baja (Q3 2026)

### DevOps
- [ ] Pipeline CI/CD completo (GitHub Actions)
- [ ] Tests E2E con Playwright
- [ ] Monitoring con Prometheus + Grafana
- [ ] Logging centralizado (ELK Stack)
- [ ] Pre-commit hooks (black, isort, ruff)

### Frontend
- [ ] Migrar a TypeScript completo
- [ ] React Query para state management
- [ ] Storybook para componentes
- [ ] PWA support (offline mode)

### Documentación
- [ ] OpenAPI spec completo
- [ ] Guía de contribución
- [ ] Video tutoriales
- [ ] API playground interactivo

---

**Última actualización:** 2026-01-06  
**Próxima revisión:** Q1 2026
- [ ] Implementar métricas por fuente de datos (Prometheus/Grafana)
- [ ] Añadir distributed tracing (OpenTelemetry)
- [ ] Configurar alertas automáticas por fallos de sync
- [ ] Dashboard de salud del sistema

### Testing
- [ ] Alcanzar 70%+ coverage en backend
- [ ] Tests de integración para jobs de sync
- [ ] Tests E2E para flujos críticos de frontend
- [ ] Contract testing para APIs externas

### Arquitectura
- [ ] Evaluar separación de jobs de sync en servicio independiente
- [ ] Implementar message queue para tareas asíncronas (Celery/RQ)
- [ ] Considerar API Gateway para unificar frontends
- [ ] Documentar arquitectura y flujos de datos

### Data/Modelado
- [ ] Crear capa de transformers para datos externos
- [ ] Implementar validación de schemas externos
- [ ] Auditoría de cambios en tablas críticas
- [ ] Versionado de configuraciones de sync

## 🚀 Quick Wins

- [ ] Añadir logging con rotación automática
- [ ] Documentar comandos útiles en README
- [ ] Crear script de setup inicial para desarrollo local
- [ ] Añadir ejemplos de .env para diferentes entornos
- [ ] Configurar prettier/eslint en frontends
- [ ] Añadir badges de CI/coverage en README

---

**Última actualización:** 26 de diciembre de 2025  
**Versión:** 1.0
