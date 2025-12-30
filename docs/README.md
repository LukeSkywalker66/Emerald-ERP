# 📚 Índice de Documentación - Emerald ERP

## Para Diferentes Públicos

### 👨‍💼 Project Managers / Stakeholders
1. [README.md](../README.md) - Overview general del proyecto
2. [ROADMAP.md](../ROADMAP.md) - Plan de desarrollo futuro
3. [Architecture Decision Records (ADR)](./adr/) - Decisiones clave tomadas

### 👨‍💻 Desarrolladores Backend
1. [Desarrollo Local](DESARROLLO_LOCAL.md) - Setup y ambiente
2. [Base de Datos](BASE_DATOS.md) - Esquema, relaciones, migraciones
3. [Integraciones](INTEGRACIONES.md) - APIs externas (ISPCube, Mikrotik, SmartOLT)
4. [Seguridad](SEGURIDAD.md) - Autenticación, autorización, HTTPS
5. [Sincronización Manual](MANUAL_SYNC.md) - Tareas Celery y Redis

### 👨‍💻 Desarrolladores Frontend
1. [Desarrollo Local](DESARROLLO_LOCAL.md) - Setup React/Vite
2. [Guía de Componentes](./COMPONENTES.md) - Estructura de componentes *(próximamente)*
3. [APIs y Endpoints](./API_REFERENCE.md) - Documentación de endpoints *(próximamente)*

### 🔧 DevOps / SRE
1. [README.md](../README.md) - Stack tecnológico
2. [Deployment](./DEPLOYMENT.md) - Deploy en producción *(próximamente)*
3. [Monitoreo y Alertas](./MONITORING.md) - Observabilidad *(próximamente)*
4. [Seguridad](SEGURIDAD.md) - Certificados, API Keys, permisos

### 🆘 Soporte Técnico
1. [Troubleshooting](./TROUBLESHOOTING.md) - Errores comunes *(próximamente)*
2. [FAQ](./FAQ.md) - Preguntas frecuentes *(próximamente)*
3. [Logs y Debugging](DESARROLLO_LOCAL.md#debugging) - Cómo leer logs

---

## Documentación Actual

### ✅ Completada

| Archivo | Descripción | Última actualización |
|---------|-------------|---------------------|
| [README.md](../README.md) | Overview, stack, instrucciones básicas | 29/12/2025 |
| [API_REFERENCE.md](API_REFERENCE.md) | Documentación de todos los endpoints | 30/12/2025 |
| [MANUAL_SYNC.md](MANUAL_SYNC.md) | Sincronización y background jobs | 15/12/2025 |
| [INTEGRACIONES.md](INTEGRACIONES.md) | APIs externas detalladas | 29/12/2025 |
| [BASE_DATOS.md](BASE_DATOS.md) | Diagrama ERD, índices, migraciones | 29/12/2025 |
| [SEGURIDAD.md](SEGURIDAD.md) | Auth, HTTPS, gestión de secretos | 29/12/2025 |
| [DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md) | Setup, endpoints, debugging | 29/12/2025 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deploy a servidor de producción | 30/12/2025 |
| [ADR-001](adr/001-implementacion-ssl.md.md) | Decisión: SSL/TLS con Let's Encrypt | 30/12/2025 |

### ⏳ Por Hacer (Roadmap de Documentación)

| Archivo | Descripción | Prioridad |
|---------|-------------|-----------|
| `TROUBLESHOOTING.md` | Errores y soluciones | 🔴 Alta |
| `MONITORING.md` | Observabilidad y alertas | 🟡 Media |
| `COMPONENTES.md` | Componentes React documentados | 🟡 Media |
| `FAQ.md` | Preguntas frecuentes | 🟢 Baja |
| `PERFORMANCE.md` | Optimización y benchmarks | 🟢 Baja |

### 📂 Architecture Decision Records (ADR)

| ID | Decisión | Estado |
|----|---------:|--------|
| [001](adr/001-implementacion-ssl.md.md) | Implementación de SSL/TLS | *(vacío)* |
| [003](adr/003-background-jobs-celery.md) | Background Jobs con Celery + Redis | ✅ Aceptado |

---

## Guías Rápidas por Caso de Uso

### 📝 "Acabo de clonar el repo, ¿qué hago?"
1. Lee [README.md](../README.md) - Sección "Guía de Inicio Rápido"
2. Sigue [Desarrollo Local](DESARROLLO_LOCAL.md) - Sección "Setup Inicial"
3. Verifica que `docker-compose ps` muestre todos los servicios verdes

### 🔄 "Debo agregar un nuevo endpoint"
1. Lee [Desarrollo Local](DESARROLLO_LOCAL.md) - Sección "Estructura de un Endpoint"
2. Consuta [BASE_DATOS.md](BASE_DATOS.md) - Para entender el modelo
3. Si necesitas nueva tabla, sigue la sección "Agregar Nuevo Modelo"

### 🔗 "Debo integrar una API nueva"
1. Lee [Integraciones](INTEGRACIONES.md) - Para ver el patrón
2. Crea el cliente en `backend/src/clients/nueva_api.py`
3. Documenta en [INTEGRACIONES.md](INTEGRACIONES.md)

### 🚀 "¿Cómo subo esto a producción?"
1. Lee [DEPLOYMENT.md](./DEPLOYMENT.md) *(en progreso)*
2. Revisa [SEGURIDAD.md](SEGURIDAD.md) - Especialmente "Checklist de Seguridad"
3. Configura variables de entorno de producción

### 🐛 "Algo no funciona, ¿cómo debuggeo?"
1. Revisa [DESARROLLO_LOCAL.md](DESARROLLO_LOCAL.md) - Sección "Debugging"
2. Consulta logs: `docker-compose logs -f backend`
3. Si es error conocido, revisa [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) *(en progreso)*

### 🔒 "Necesito agregar autenticación"
1. Lee [SEGURIDAD.md](SEGURIDAD.md) - Sección "Autenticación de API"
2. Implementa según patrón mostrado
3. Testea con `curl -H "x-api-key: KEY"`

### 📊 "¿Cómo monitoreo la salud del sistema?"
1. Revisa [MONITORING.md](./MONITORING.md) *(en progreso)*
2. Comandos útiles en [README.md](../README.md) - "Comandos Útiles"
3. Ver logs: `docker-compose logs -f`

---

## Convenciones de Documentación

### Estructura de Archivos .md

```markdown
# Título Principal (H1)

Párrafo introductorio con contexto.

---

## Sección (H2)

### Subsección (H3)

**Negrita** para énfasis.

```código```para bloques.

- Lista de puntos
```

### Emojis Usados

| Emoji | Significado |
|-------|------------|
| 📚 | Documentación |
| 👨‍💻 | Desarrollo |
| 🚀 | Deploy/Producción |
| 🔐 | Seguridad |
| 🐛 | Bugs/Debugging |
| ✅ | Completado |
| ⏳ | En progreso |
| 🔴 | Prioridad alta |
| 🟡 | Prioridad media |
| 🟢 | Prioridad baja |

### Links Internos

```markdown
[Enlace a archivo](ARCHIVO.md)
[Enlace a sección](ARCHIVO.md#sección)
[Enlace a código](../backend/src/main.py)
```

---

## Cómo Contribuir a la Documentación

### Agregar Nuevo Documento

1. **Crear archivo** en `docs/` con nombre descriptivo (ej: `DEPLOYMENT.md`)

2. **Estructura base:**
   ```markdown
   # 📋 Titulo del Documento
   
   Descripción breve de qué trata.
   
   ---
   
   ## Sección 1
   
   Contenido...
   ```

3. **Agregar a este índice** en la sección "Por Hacer" → "Completada"

4. **Commitear:**
   ```bash
   git add docs/NUEVO_ARCHIVO.md
   git commit -m "docs: agregar documentación de NUEVO_ARCHIVO"
   ```

### Actualizar Documento Existente

1. **Editar** el archivo
2. **Cambiar fecha** de "Última actualización"
3. **Commitear:**
   ```bash
   git add docs/ARCHIVO.md
   git commit -m "docs: actualizar ARCHIVO - cambio específico"
   ```

---

## Estadísticas de Documentación

```
Total de archivos .md:     9
- Completados:             9
- En progreso:             0
- Por hacer:               5

Cobertura aproximada:      65%
Áreas mejorables:          Troubleshooting, Monitoring, Frontend
```

---

## Contacto y Preguntas

Para dudas o sugerencias sobre la documentación:

- 📧 Email: [tu-email@emerald.com]
- 💬 Issues en GitHub: [Crear issue](https://github.com/LukeSkywalker66/Emerald-ERP/issues)
- 🤝 Pull Requests bienvenidos

---

**Última revisión:** 29 de diciembre de 2025  
**Mantenedor:** Lucas (Desarrollo)
