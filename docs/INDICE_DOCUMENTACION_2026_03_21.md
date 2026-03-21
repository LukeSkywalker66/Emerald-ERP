# 📚 Índice de Documentación Actualizado - Emerald ERP (21 Marzo 2026)

**Versión:** 2.0 (Actualizado Q2)  
**Última actualización:** 21 de Marzo 2026

---

## 🎯 Para Leer PRIMERO (por rol)

### 👨‍💻 Para Desarrolladores (Cualquier rol)
1. **[LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md)** ⭐ - Estado actual, bugs recientes, módulos aplicables
2. **[ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md)** - Detalle técnico y lista de tareas
3. **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Reglas obligatorias de codificación

### 🏢 Para Project Managers / Stakeholders
1. **[ROADMAP.md](ROADMAP.md)** - Plan de desarrollo Q1-Q4 2026
2. **[README.md](../README.md)** - Overview general del proyecto

### 🔧 Para DevOps / SRE
1. **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deploy a staging/producción
2. **[DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md)#Docker** - Setup Docker Compose

---

## ✅ Documentación Actual (Vigente)

| Archivo | Descripción | Última Actualización | Prioridad |
|---------|-------------|---------------------|-----------|
| [LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md) | Estado actual del proyecto | 21 Mar 2026 | 🔴 CRÍTICA |
| [ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md) | Detalle técnico y bugs | 21 Mar 2026 | 🔴 CRÍTICA |
| [ROADMAP.md](ROADMAP.md) | Plan Q1-Q4 2026 | 21 Mar 2026 | 🟡 MEDIA |
| [.github/copilot-instructions.md](../.github/copilot-instructions.md) | Reglas de código | 21 Mar 2026 | 🔴 CRÍTICA |
| [README.md](../README.md) | Overview proyecto | 13 Ene 2026 | 🟡 MEDIA |
| [ARQUITECTURA_TICKETS_V2.md](ARQUITECTURA_TICKETS_V2.md) | Arquitectura modular | 05 Ene 2026 | 🟡 MEDIA |
| [AUTH_SYSTEM.md](AUTH_SYSTEM.md) | Sistema JWT + Rate Limit | 30 Dic 2025 | 🟢 BAJA |
| [BASE_DATOS.md](BASE_DATOS.md) | Esquema PostgreSQL | 06 Ene 2026 | 🟡 MEDIA |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deploy a producción | 06 Ene 2026 | 🟡 MEDIA |
| [DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md) | Setup + debugging | 06 Ene 2026 | 🟢 BAJA |
| [INTEGRACIONES.md](INTEGRACIONES.md) | ISPCube, Mikrotik, SmartOLT | 06 Ene 2026 | 🟢 BAJA |
| [MANUAL_SYNC.md](MANUAL_SYNC.md) | Celery + Redis jobs | 06 Ene 2026 | 🟢 BAJA |
| [SEGURIDAD.md](SEGURIDAD.md) | Auth, API Keys, HTTPS | 06 Ene 2026 | 🟢 BAJA |
| [MODULO_INVENTARIO.md](MODULO_INVENTARIO.md) | Inventario (completo) | 14 Ene 2026 | 🟢 BAJA |
| [FEATURE_TIMELINE_LIVE_STATUS.md](FEATURE_TIMELINE_LIVE_STATUS.md) | Timeline (status) | 14 Feb 2026 | 🟢 BAJA |
| [TEST_E2E_AUTOMATIZADAS_2026-03-12.md](TEST_E2E_AUTOMATIZADAS_2026-03-12.md) | Suite de tests | 12 Mar 2026 | 🟢 BAJA |
| [CHECKPOINTS_INDEX.md](CHECKPOINTS_INDEX.md) | Índice de checkpoints | 14 Ene 2026 | 🟢 BAJA |

---

## 🗑️ Documentación Obsoleta (Archivada)

Los siguientes archivos están **descontinuados** pero se conservan para referencia histórica:

| Archivo | Por qué es obsoleto | Alternativa |
|---------|---------------------|-------------|
| [_ARCHIVOS_OBSOLETOS/LEER_PRIMERO.md](_ARCHIVOS_OBSOLETOS/LEER_PRIMERO.md) | Enero 2026 (desactualizado) | [LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md) |
| [_ARCHIVOS_OBSOLETOS/LEER_PRIMERO_PROXIMA_SESION.md](_ARCHIVOS_OBSOLETOS/LEER_PRIMERO_PROXIMA_SESION.md) | Enero 2026 (desactualizado) | [LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md) |
| [checkpoints/STATUS_IMPLEMENTACIONES_2026-01-14.md](checkpoints/STATUS_IMPLEMENTACIONES_2026-01-14.md) | Enero 2026 (muy antiguo) | [ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md) |
| [CHECKPOINT_2026-01-13_INVENTORY_WO_INTEGRATION.md](CHECKPOINT_2026-01-13_INVENTORY_WO_INTEGRATION.md) | Checkpoint histórico | [ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md) |
| [CHECKPOINT_2026-01-15_VALIDACION_MODULOS.md](CHECKPOINT_2026-01-15_VALIDACION_MODULOS.md) | Checkpoint histórico | [ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md) |
| [CURRENT_STATUS_2026-03-02.md](CURRENT_STATUS_2026-03-02.md) | Status de marzo viejo | [ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md) |

---

## 🎓 Por Tema de Interés

### 🔐 Seguridad & Auth
- [AUTH_SYSTEM.md](AUTH_SYSTEM.md) - JWT, Refresh Tokens, Rate Limiting
- [SEGURIDAD.md](SEGURIDAD.md) - Checklist de seguridad, HTTPS, API Keys
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) - Reglas obligatorias

### 📊 Base de Datos
- [BASE_DATOS.md](BASE_DATOS.md) - Esquema ERD, migraciones Alembic
- [ARQUITECTURA_TICKETS_V2.md](ARQUITECTURA_TICKETS_V2.md) - Relaciones y eventos

### 🚀 Deployment & DevOps
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deploy a staging/prod
- [DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md) - Docker Compose setup
- [INTEGRACIONES.md](INTEGRACIONES.md) - ISPCube, Mikrotik

### 📦 Módulos Funcionales
- [MODULO_INVENTARIO.md](MODULO_INVENTARIO.md) - Warehouse, Stock, Auditoría
- [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) - Decisiones técnicas

### 🧪 Testing & Validación
- [TEST_E2E_AUTOMATIZADAS_2026-03-12.md](TEST_E2E_AUTOMATIZADAS_2026-03-12.md) - Suite de tests

---

## 📝 Cómo Mantener Esta Documentación

### ✅ Cuando Agregues Código Nuevo
1. Actualiza [LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md) si es un cambio de user-facing
2. Documenta en el archivo temático correspondiente (BASE_DATOS.md, etc.)
3. Crea un archivo `ESTADO_ACTUAL_2026-MM-DD.md` si los cambios son mayores

### ✅ Cuando Arregles Bugs
1. Si es crítico, agrégalo a la sección de "Bugs Corregidos" en [ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md)
2. Cita el commit y archivos modificados

### ✅ Cuando Depreces Algo
1. Mueve el archivo a `_ARCHIVOS_OBSOLETOS/` 
2. Agrégalo a la tabla "Documentación Obsoleta" arriba
3. Cita la alternativa vigente

### ✅ Cada Nueva Sesión
1. Actualiza LEER_PRIMERO_ACTUAL.md con la fecha y último commit
2. Si pasaron > 7 días, crea nuevo ESTADO_ACTUAL_2026-MM-DD.md

---

## 🆘 Troubleshooting Rápido by Topic

### "El código no compila"
→ Lee [.github/copilot-instructions.md](../.github/copilot-instructions.md) → Reglas De Codificación

### "¿Cómo conecto a la DB?"
→ Lee [BASE_DATOS.md](BASE_DATOS.md) → Credenciales

### "¿Cómo hago deploy?"
→ Lee [DEPLOYMENT.md](DEPLOYMENT.md)

### "¿Cómo testeo localmente?"
→ Lee [DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md)

### "¿Cuál es el estado actual?"
→ Lee [LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md) Y [ESTADO_ACTUAL_2026_03_21.md](ESTADO_ACTUAL_2026_03_21.md)

---

## 📞 Para la Próxima Sesión

Menciona en el prompt:
- **Documentación:** Usa [LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md)
- **Fecha:** Actualiza con la fecha de hoy
- **Último commit:** Incluye el hash (git log --oneline -1)
- **Cambios pendientes:** Si hay alguno

**Prompt Ideal:**
```
Entrada desde [LEER_PRIMERO_ACTUAL.md](LEER_PRIMERO_ACTUAL.md) (actualizado 21 Mar 2026).
Último commit: 0694c00 - Coordinación polls fixes.
¿Qué hago ahora?
```
