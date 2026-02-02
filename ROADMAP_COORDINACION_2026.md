# 🛣️ ROADMAP 2026 - Emerald ERP "Nivel NASA"

**Fecha:** 2 de febrero de 2026  
**Estado:** Estrategia de priorización definida  
**Branch:** develop

---

## 📊 Estado Actual

### ✅ Completado (Producción)
- Tickets (5 flujos: técnico, instalación, retiro, traslado, administrativo)
- Work Orders (OT con consumo de stock automático)
- Inventory (Stock central + móvil, serializados y bulk)
- Engineering/NOC (Kanban + timeline completo)

### 🚧 En Desarrollo
- Coordinación (orquestación de equipos)

---

## 🎯 PRIORIZACIÓN DE FEATURES

### 1️⃣ **COORDINACIÓN MODULE** ⭐ RECOMENDADO
**Estatus:** 🚧 En desarrollo  
**Tiempo estimado:** 8-10 horas  
**Criticidad:** 🔴 CRÍTICA (cierra el sistema)

#### ¿Por qué es prioritario?
Sin Coordinación, no hay:
- Redistribución dinámica de OTs entre técnicos
- Seguimiento de carga de trabajo por team
- Capacidad de reasignación inteligente
- Orquestación operativa real

#### Escenario de impacto
**SIN Coordinación:**
- Técnico 1 se enferma → OT asignada a él se congela → Cliente espera ❌

**CON Coordinación:**
- Técnico 1 se enferma → Sistema redistribuye OT al team → Otro técnico la agarra ✅

#### Scope
- **Backend:**
  - Modelo `TeamAssignment`
  - Modelo `WorkOrderDistribution`
  - Endpoints: `GET /teams`, `POST /teams/{id}/assignments`, `PUT /work-orders/{id}/reassign`
  - Service layer: lógica de distribución inteligente

- **Frontend:**
  - Panel Coordinador (ruta `/app/coordination`)
  - Tabla equipos + OTs pendientes
  - Drag-drop de OT entre técnicos del mismo team
  - Vista de carga por técnico (horas disponibles vs asignadas)

- **Testing:**
  - E2E: crear team, asignar OT, reasignar
  - Validar que OT se redistribuye correctamente

#### Checklist
- [ ] Backend: Crear modelos en `backend/src/models/engineering.py`
- [ ] Backend: Crear endpoints en `backend/src/routers/engineering.py`
- [ ] Backend: Crear service layer en `backend/src/services/engineering_service.py`
- [ ] Frontend: Crear `CoordinationPage.jsx` (~400 líneas)
- [ ] Frontend: Integrar en `App.jsx` ruta `/app/coordination`
- [ ] Frontend: Agregar en sidebar
- [ ] Testing: E2E Playwright (6+ tests)
- [ ] Documentación: `COORDINACION_MODULE.md`

---

### 2️⃣ **AUDITORÍA Y COMPLIANCE**
**Estatus:** 📋 Backlog  
**Tiempo estimado:** 4-5 horas  
**Criticidad:** 🟠 ALTA (requisito legal)

#### ¿Por qué?
ISPs en Argentina deben cumplir ENACOM:
- Auditoría de cambios
- Trazabilidad completa
- Quién hizo qué y cuándo

#### Scope
- Timeline completo de cambios en Tickets/OTs/Stock
- Integración con RateLimit ya existente
- Reportes de auditoría (CSV export)
- Retención de 2 años (política de BD)

#### Checklist
- [ ] Backend: Extender `AuditLog` model
- [ ] Backend: Middleware que registre todos los cambios
- [ ] Frontend: Página de auditoría (búsqueda + filtros)
- [ ] Testing: Validar que se registra correctamente
- [ ] Documentación: `COMPLIANCE_ENACOM.md`

---

### 3️⃣ **MOBILE RESPONSIVE**
**Estatus:** 📋 Backlog  
**Tiempo estimado:** 3-4 horas  
**Criticidad:** 🟡 MEDIA (UX en campo)

#### ¿Por qué?
Técnicos en campo usan celular. WorkOrderExecutionPage hoy asume desktop.

#### Scope
- Viewport 375px (iPhone 12 mini)
- Touch-friendly buttons (48px mínimo)
- WorkOrderExecutionPage responsive
- StockAdjustments mobile-ready
- Agregar PWA offline support

#### Checklist
- [ ] Ajustar `WorkOrderExecutionPage.jsx` para mobile
- [ ] Agregar breakpoints Tailwind
- [ ] Testing en dispositivos reales (iOS + Android)
- [ ] Documentación: `MOBILE_RESPONSIVE.md`

---

### 4️⃣ **DASHBOARD + KPIs**
**Estatus:** 📋 Backlog  
**Tiempo estimado:** 6-8 horas  
**Criticidad:** 🟡 MEDIA (Analytics)

#### ¿Por qué?
Visibilidad operativa en tiempo real:
- SLAs (tickets resueltos en X horas)
- Eficiencia de técnicos
- Stock alerts
- Carga de equipos

#### Scope
- Dashboard principal (6+ KPIs)
- Gráficos de trends (Chart.js)
- Real-time metrics desde backend
- Drill-down a detalles

**KPIs sugeridos:**
1. Tickets abiertos / resueltos hoy
2. OTs en progreso / completadas
3. Stock bajo mínimo (alertas)
4. Eficiencia de técnicos (OTs/día)
5. SLA compliance (%)
6. Tiempo promedio resolución

#### Checklist
- [ ] Backend: Endpoints de métricas en `/api/v2/metrics`
- [ ] Frontend: `DashboardPage.jsx` (~500 líneas)
- [ ] Frontend: Componentes KPI card reutilizables
- [ ] Frontend: Gráficos (Chart.js + react-chartjs-2)
- [ ] Testing: E2E validar datos se actualizan
- [ ] Documentación: `DASHBOARD_METRICS.md`

---

## 📈 ROADMAP VISUAL

```
FEB 2026          Coordinación       (2w)
                       ↓
MAR 2026          Auditoría/Compliance (1w)
                       ↓
APR 2026          Mobile Responsive  (1w)
                       ↓
MAY 2026          Dashboard/KPIs     (2w)
                       ↓
JUN 2026          ✅ MVP COMPLETO
                  (Sistema 100% operativo)
```

---

## 🚀 CÓMO EMPEZAR CON COORDINACIÓN

### Paso 1: Análisis de datos (0.5h)
```bash
# Verificar estructura actual de equipos
SELECT * FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'técnico');
SELECT * FROM engineering_tasks WHERE status = 'pending';
```

### Paso 2: Backend setup (3-4h)
1. Crear modelos en `backend/src/models/engineering.py`
2. Crear endpoints en `backend/src/routers/engineering.py`
3. Agregar service methods en `backend/src/services/engineering_service.py`
4. Crear migración Alembic
5. Testing manual en Swagger

### Paso 3: Frontend setup (3-4h)
1. Crear `frontend/src/pages/CoordinationPage.jsx`
2. Crear `frontend/src/components/coordination/TeamCard.jsx`
3. Crear `frontend/src/components/coordination/WorkOrderBoard.jsx`
4. Integrar drag-drop (usar `@dnd-kit` como en Kanban)
5. Agregar ruta en `App.jsx`

### Paso 4: Testing (1-2h)
1. Tests unitarios en backend
2. Tests E2E en Playwright
3. Testing manual en navegador

### Paso 5: Documentación (0.5h)
1. Crear `docs/COORDINACION_MODULE.md`
2. Actualizar `MASTER_CONTEXT.md`
3. Agregar notas en checkpoint

---

## 📋 CRITERIOS DE ACEPTACIÓN

### Coordinación está completa cuando:
- ✅ Se puede crear un equipo (Team) con múltiples técnicos
- ✅ Se puede asignar OT a un equipo (no a usuario individual)
- ✅ Se puede reasignar OT entre técnicos del mismo equipo
- ✅ El sistema muestra carga por técnico (OTs asignadas)
- ✅ Histórico de reasignaciones queda en timeline
- ✅ Tests E2E pasen (6/6)
- ✅ Documentación completa

---

## 🎓 NOTAS ARQUITECTÓNICAS

### Principios clave
- **Orquestación sin acoplamiento:** Team → WorkOrder, pero WorkOrder se ejecuta por técnico individual
- **Auditoría completa:** Toda reasignación genera evento en timeline
- **Smart distribution:** No solo round-robin; considerar capacidad, especialidad, ubicación
- **Fallback seguro:** Si reasignación falla, OT no se pierde

### Patterns a usar
- Service Layer (como inventario)
- Event sourcing (timeline)
- Drag-drop con DND-kit (como Kanban)

---

## 📞 REFERENCIAS

- Checkpoint anterior: [docs/checkpoints/CHECKPOINT_2026-01-29_ENGINEERING_TIMELINE_COMPLETE.md](docs/checkpoints/CHECKPOINT_2026-01-29_ENGINEERING_TIMELINE_COMPLETE.md)
- Documentación stacks: [MASTER_CONTEXT.md](MASTER_CONTEXT.md)
- Setup guides: [docs/AUTO_SYNC_CONTEXT_SETUP.md](docs/AUTO_SYNC_CONTEXT_SETUP.md)

---

## 🎯 DECISIÓN FINAL

**Feature a implementar ahora:** ✅ **COORDINACIÓN MODULE**

**Razón:** Cierra el ciclo operativo. Sin ella, el sistema es registro; con ella, es orquestación real.

**ETA:** 8-10 horas (puede dividirse en 2 sesiones de 4-5h)

**Próximo paso:** Crear rama `feature/coordination` y comenzar con backend models.

---

**Versión:** 1.0  
**Última actualización:** 2 de febrero de 2026  
**Status:** ✅ Listo para implementación
