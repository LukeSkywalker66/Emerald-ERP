# 🗺️ Roadmap de Mejoras - Emerald ERP

## 🎯 Prioridad Alta

### Backend/API
- [ ] Reemplazar `Base.metadata.create_all` por migraciones Alembic en startup
- [ ] Restringir CORS: eliminar `allow_origins=["*"]` y definir lista por entorno
- [ ] Implementar autenticación básica (API key/token) en endpoints de tickets
- [ ] Estandarizar validación Pydantic con enums para `priority`/`status`
- [ ] Manejo estructurado de errores con `HTTPException` y logging consistente
- [ ] Añadir paginación a `/tickets` y `/services_options`

### Data Sync / Integraciones
- [ ] Reemplazar "tierra quemada" por upserts incrementales con control de cambios
- [ ] Implementar retry con backoff exponencial en clientes externos
- [ ] Añadir timeouts explícitos y rate limiting en APIs externas
- [ ] Proteger secretos: no loggear tokens, implementar rotación de cache
- [ ] Persistir estado de sincronización para reintentos parciales

### DevEx/Infra
- [ ] Crear `.env.example` con documentación de variables requeridas
- [ ] Configurar pipeline CI básico (lint + tests + build)
- [ ] Añadir healthcheck endpoints en backend
- [ ] Configurar `depends_on` + `healthcheck` en docker-compose
- [ ] Implementar pre-commit hooks (black/isort/ruff para Python)

## 🔄 Prioridad Media

### Backend
- [ ] Migrar a async/await (FastAPI + `async_sessionmaker`)
- [ ] Mover operaciones IO bloqueantes a `run_in_threadpool`
- [ ] Añadir filtros avanzados en endpoints de listado
- [ ] Implementar soft deletes en tablas críticas

### Base de Datos
- [ ] Formalizar Foreign Keys donde corresponda
- [ ] Añadir índices compuestos para queries frecuentes
- [ ] Implementar particionado en tablas de alto crecimiento
- [ ] Reemplazar `clear_table` por transacciones ACID optimizadas
- [ ] Considerar `TRUNCATE ... CASCADE` según volumen

### Frontend Tickets (React/Vite)
- [ ] Migrar a TypeScript
- [ ] Implementar React Query para caching y gestión de estado
- [ ] Centralizar cliente HTTP con manejo de errores
- [ ] Validar formularios y mostrar errores de red en UI
- [ ] Separar componentes (tabla, modales, KPIs) en archivos independientes
- [ ] Añadir protección ante datos null/undefined en modales

### Frontend Beholder
- [ ] Añadir estados de loading/error con skeletons
- [ ] Tipar `resultData` y props de componentes
- [ ] Implementar tests de componentes críticos
- [ ] Unificar tema/diseño con sistema de tokens

## 📊 Prioridad Baja

### Observabilidad
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
