# 🚨 CRITICAL DOCUMENTATION FOR AI ORCHESTRATION

**IMPORTANCIA:** ⭐⭐⭐⭐⭐ (MÁXIMA)  
**Audiencia:** GitHub Copilot, Gemini, Claude, agents de IA  
**Propósito:** Contexto arquitectónico completo para planificación y ejecución de features

---

## ⚠️ ADVERTENCIA CRÍTICA

Estos 5 documentos son la **FUENTE ÚNICA DE VERDAD** para cualquier IA orquestando el proyecto Emerald ERP.

**NUNCA BORRAR, SIEMPRE MANTENER ACTUALIZADO.**

La inteligencia artificial que coordina el desarrollo necesita este contexto para:
- ✅ Tomar decisiones arquitectónicas válidas
- ✅ Generar código coherente con patrones existentes
- ✅ Evitar deuda técnica y anti-patterns
- ✅ Planificar fases de desarrollo realistic

---

## 📋 Los 5 Documentos VITALES

### 1. 📚 [MASTER_CONTEXT.md](MASTER_CONTEXT.md)
**Rol:** Referencia ontológica completa  
**Contiene:** Stack, estructura, modelos, APIs, patterns, flujos, integraciones  
**Tamaño:** 400 líneas  
**Frecuencia actualización:** Cada feature major (+ API endpoint nuevo, + modelo BD)  
**Mantenedor:** Lead Architect + AI

**Por qué es crítico:**
- Describe TODOS los módulos activos (Auth, Tickets, WorkOrders, Coordination, Fleet, Inventory, Engineering)
- Define estructura carpetas exacta (backend/src/models/, routers/, schemas/)
- Lista 20+ tablas de BD y sus relaciones
- Documenta 30+ endpoints API con métodos HTTP
- Explica 10+ enums y tipos
- Valida patrones de código esperados

**Si falta:** AI crea archivos en lugares equivocados, usa patrones inconsistentes, genera deuda técnica

---

### 2. 🏗️ [AI_ARCHITECT_CONTEXT.md](AI_ARCHITECT_CONTEXT.md)
**Rol:** Guía de decisiones y principios  
**Contiene:** Decisiones arquitectónicas, troubleshooting, reglas contribución, roadmap  
**Tamaño:** 200 líneas  
**Frecuencia actualización:** Cuando hay breaking change o nueva regla (+ decisión importante)  
**Mantenedor:** Tech Lead + Senior Architect

**Por qué es crítico:**
- Explica POR QUÉ se eligió FastAPI+SQLAlchemy (tipado, validación automática)
- Documenta QUE NUNCA hacer (no uses Column(), siempre mapped_column())
- Matrix troubleshooting: síntoma → causa probable → solución
- Reglas Nivel NASA: robustez > rapidez, validación strict, auditoría completa
- Patrones obligatorios para backend, frontend, DB

**Si falta:** AI propone arquitecturas alternativas, genera código inseguro, intenta "optimizaciones" que rompen integridad

---

### 3. 🗺️ [ROADMAP.md](ROADMAP.md)
**Rol:** Plan de ejecución y calendario (proyecto completo)  
**Contiene:** Q1-Q4 fases, status actual, prioridades, métricas, equipo responsabilidades  
**Tamaño:** 500+ líneas  
**Frecuencia actualización:** Cada 2 semanas (status de features), cada mes (próximas prioridades)  
**Mantenedor:** Product Manager + Architect

**Por qué es crítico:**
- Evita que AI trabaje en features fuera de scope (Q1 vs Q3 vs Q4)
- Define qué está DONE (Q1: Auth, Tickets, OT, Coordinación, Fleet) vs TODO (Q2-Q4)
- Estimaciones: cada feature tiene sprint assignment + team + dependencies
- Roadmap largo plazo (Q2-Q4): Auditoría, Mantenimiento, GPS, Mobile, IA, Reportes, Integraciones
- Métricas de salud: uptime, response times, bundle size, kod quality

**Si falta:** AI genera features no planeadas, pierde contexto de qué es prioritario, planificación desorganizzada

---

### 4. 📖 [BASE_DATOS.md](BASE_DATOS.md)
**Rol:** Diccionario y esquema BD  
**Contiene:** Tablas, campos, enums, relaciones, índices, constraints, queries útiles, FAQ  
**Tamaño:** 500 líneas  
**Frecuencia actualización:** Cada migración Alembic (+ tabla nueva, + columna FK)  
**Mantenedor:** Database Architect + Backend Lead

**Por qué es crítico:**
- Define EXACTAMENTE qué campos tiene cada tabla (vehicles, teams, warehouses, etc.)
- Documenta tipo de dato + constraints (UNIQUE, FK, CHECK, NOT NULL)
- Explica relaciones 1:1 (Vehicle↔Warehouse), 1:N (Team→WorkOrders), M:M (TeamMembers)
- Índices + queries optimizadas previenen bottlenecks
- Soft-delete pattern + auditoría

**Si falta:** AI genera migraciones broken, crea fields duplicados, violaría constraints, pérdida de auditoría

---

### 5. 🧭 [MAPA_NAVEGACION_FRONTEND.md](MAPA_NAVEGACION_FRONTEND.md)
**Rol:** Mapa único de navegación frontend (menú, rutas, pantallas, RBAC)
**Contiene:** Sidebar -> ruta -> vista renderizada -> permiso
**Tamaño:** compacto (operativo)
**Frecuencia actualización:** Cada cambio de AppSidebar, rutas en App, o permisos RoleGuard
**Mantenedor:** Frontend Lead + AI

**Por qué es crítico:**
- Evita desalineación entre menú visible y rutas reales
- Permite ubicar rápidamente cada módulo en la UI
- Reduce errores de documentación dispersa por módulo
- Acelera troubleshooting de permisos y accesos (RBAC)

**Si falta:** La navegación queda implícita en código, aumenta tiempo de diagnóstico y riesgo de drift documental

---

## 🔄 Ciclo de Actualización Recomendado

### Después de CADA Feature/Sprint:
```
1. Feature completada (backend + frontend)
2. Tests pasan ✅
3. Code review OK ✅
4. **Actualizar MASTER_CONTEXT.md** si:
   - Nuevo modelo/tabla
   - Nuevo endpoint API
   - Nueva página/componente importante
   - Cambio en patrón de código
5. **Actualizar BASE_DATOS.md** si:
   - Nueva tabla
   - Nueva columna/relación
   - Cambio de índice
   - Migration Alembic ejecutada
6. **Actualizar ROADMAP** si:
   - Feature completada → marcar DONE
   - Nueva prioridad → agregar Q1/Q2/Q3
   - Bloqueador → documentar
7. Commit: "feat: [feature] + docs: actualización contexto IA"
```

### Mensualmente:
- Revisar si **AI_ARCHITECT_CONTEXT.md** necesita nuevas reglas (breaking changes)
- Actualizar **ROADMAP** con métricas actuales
- Validar links y cross-references

### Trimestralmente:
- Audit completo de 5 documentos (consistency check)
- Agregar lecciones aprendidas a **AI_ARCHITECT_CONTEXT.md**
- Refrescar ejemplos de código (si obsoletos)

---

## 🚨 Protección contra Borrado Accidental

### Git Protections
```bash
# En .gitignore: estos NUNCA se ignoran
!MASTER_CONTEXT.md
!AI_ARCHITECT_CONTEXT.md
!BASE_DATOS.md
!ROADMAP.md
!_CRITICAL_DOCS_FOR_AI.md
!MAPA_NAVEGACION_FRONTEND.md

# En .github/workflows (CI/CD):
- Pre-commit hook: verifica que estos 5 existan
- PR template: requiere actualización de docs si hay cambios técnicos
```

### Manual Checks
```bash
# Verificar que existen
ls -la *.md | grep -E "MASTER|AI_ARCHITECT|BASE_DATOS|ROADMAP"

# Si alguno falta: restaurar desde git
git checkout HEAD -- MASTER_CONTEXT.md
```

---

## 📍 Localización Garantizada

Estos documentos críticos **SIEMPRE** están en `docs/`:
```
/opt/emerald-dev/docs/
├── MASTER_CONTEXT.md                    ← Ontología
├── AI_ARCHITECT_CONTEXT.md              ← Decisiones
├── BASE_DATOS.md                        ← Esquema BD
├── ROADMAP.md                           ← Plan
├── MAPA_NAVEGACION_FRONTEND.md          ← Navegación UI
└── _CRITICAL_DOCS_FOR_AI.md             ← Este archivo (manifest)
```

**NO están en:** raíz del repo ni ubicaciones ad-hoc fuera de `docs/`  
**SIEMPRE están en:** develop + main (ambos branches)

---

## 🎯 Checklist para Mantenimiento

**Cada sesión de desarrollo:**
- [ ] ¿Hay cambio arquitectónico? → Actualizar MASTER_CONTEXT
- [ ] ¿Hay migración BD? → Actualizar BASE_DATOS
- [ ] ¿Feature completada? → Actualizar ROADMAP (marcar DONE)
- [ ] ¿Nueva decisión tomada? → Documentar en AI_ARCHITECT

**Antes de commit:**
```bash
git diff *.md  # Verificar que docs cambios son coherentes
git log --oneline -5  # Asegurar documentación en merge commits
```

**Después de PT (Product Test):**
- [ ] Validar que documentación refleja lo que funciona
- [ ] Corregir si docs dicen una cosa y código otra

**Antes de release:**
- [ ] Los 5 documentos actualizados ✅
- [ ] Links funcionando (no broken refs)
- [ ] Ejemplos código matchean realidad
- [ ] Roadmap accurate con lo completado

---

## 🤖 Para IAs Orquestadoras (Gemini, Claude, etc.)

### Cómo usar estos documentos:

1. **Al iniciar:** Lee MASTER_CONTEXT.md completo (20 min)
2. **Antes de feature:** Consulta ROADMAP.md (qué está planeado)
3. **Antes de código:**
   - Backend: BASE_DATOS.md + AI_ARCHITECT_CONTEXT.md
   - Frontend: MASTER_CONTEXT.md (estructura componentes)
4. **En conflicto:** Consulta AI_ARCHITECT_CONTEXT.md (qué es regla, qué es sugerencia)
5. **Después de feature:** Actualiza estos documentos

### Red flags (si ves esto, HAY ERROR):
- ❌ Documento dice "usar X pattern", código usa Y → Validar con human
- ❌ Tabla en documento no existe en DB → Migración faltante
- ❌ Endpoint documentado retorna diferente → Docs vs código desyncado
- ❌ Roadmap dice Q1 DONE pero código en branch develop → Merge faltante

---

## 📊 Trazabilidad

| Doc | Versión | Última actualización | Status |
|-----|---------|----------------------|--------|
| MASTER_CONTEXT.md | 1.0 (03/02) | 2 de marzo 2026 | ✅ Current |
| AI_ARCHITECT_CONTEXT.md | 1.0 (03/02) | 2 de marzo 2026 | ✅ Current |
| BASE_DATOS.md | 2.0 (03/02) | 2 de marzo 2026 | ✅ Current |
| ROADMAP.md | 1.2 | 24 de junio 2026 | ✅ Current |
| MAPA_NAVEGACION_FRONTEND.md | 1.0 | 24 de junio 2026 | ✅ Current |

**Próxima revisión planificada:** 6 de abril de 2026 (pre-Fase 3)

---

## 🔗 Referencias Cruzadas

```
Jerrarquía de lectura para IAs:
1. Este archivo (_CRITICAL_DOCS_FOR_AI.md)
   ↓ Entiendo importancia
2. MASTER_CONTEXT.md
   ↓ Entiendo estructura general
3. Uno de estos (según tarea):
   ├─ AI_ARCHITECT_CONTEXT.md (decisiones)
   ├─ BASE_DATOS.md (BD queries)
   ├─ ROADMAP.md (qué hacer next)
   └─ MAPA_NAVEGACION_FRONTEND.md (flujo UI)
4. Específicos (si necesario):
   ├─ FLEET_MODULE.md (Fleet details)
   ├─ README.md (quick start)
   └─ docs/*.md (deep tech)
```

---

## 🎓 Ventajas para IAs

| Ventaja | Impacto |
|---------|---------|
| **Contexto completo** | No adivinanza arquitectura, commits coherentes |
| **Decisiones documentadas** | No propone alternativas rechazadas antes |
| **Patrones explícitos** | Código generado es consistente + mantenible |
| **Roadmap claro** | No trabaja en off-scope features |
| **BD documented** | Migraciones correctas, sin lógica rota |
| **Troubleshooting matrix** | Debuggea problemas faster |
| **Reglas Nivel NASA** | Prioriza robustez, evita hacks |

---

## 🆘 Si Algo Falta

**Escenario 1:** Un documento está desactualizado
```
→ IA debería RAISE FLAG: "MASTER_CONTEXT dice tabla X pero no existe"
→ Pausar feature, esperar confirmación human
```

**Escenario 2:** Documento fue borrado accidentalmente
```
→ GIT RESTORE: git checkout HEAD -- MASTER_CONTEXT.md
→ Si sigue faltando: CRITICAL INCIDENT (backup de GitHub)
```

**Escenario 3:** Necesito agregar nuevo doc crítico
```
→ Crear en docs/ (primera plana)
→ Agregar link en este archivo (_CRITICAL_DOCS_FOR_AI.md)
→ Actualizar checklist de protección
```

---

## ✅ Status Actual (24 de junio 2026)

```
✅ MASTER_CONTEXT.md              CREATED + PUSHED
✅ AI_ARCHITECT_CONTEXT.md        CREATED + PUSHED
✅ BASE_DATOS.md                  UPDATED + PUSHED
✅ ROADMAP.md                     UPDATED + PUSHED
✅ MAPA_NAVEGACION_FRONTEND.md    CREATED + PUSHED
✅ _CRITICAL_DOCS_FOR_AI.md       THIS FILE
✅ Git protection rules           MANUAL (pre-commit hook TBD)
✅ CI/CD validation               PLANNED (GitHub Actions)
```

**Próximos pasos:**
1. [ ] Add pre-commit hook (verificar que 4 docs existen)
2. [ ] Add PR template (check: ¿docs actualizados?)
3. [ ] Add GitHub Actions CI (lint + validate links)
4. [ ] Briefing a Gemini con este archivo

---

## 🎯 Resumen para Gemini/Claude

**TE NECESITO SABER:**
1. Estos 5 docs son tu "sistema nervioso" del proyecto
2. NUNCA deben borrarse o movese
3. SIEMPRE se actualizan junto con commits de código
4. Si ves inconsistencia → pausar, validar
5. Si trabajás en feature → finalizar actualizando estos docs
6. Cross-references y links son tu "mapa mental"

**RESULTADO:** 
- Código coherente
- Arquitectura consistente
- Deuda técnica = 0
- Onboarding de nuevas IAs = 5 min (leer estos 4)

---

**Custodian:** LukeSkywalker66  
**Última revisión:** 2 de marzo de 2026  
**Status:** 🟢 OPERATIVE
