# 🔒 Audit Logging & Rate Limiting - Emerald ERP

## Resumen

Sistema completo de auditoría y protección contra ataques de fuerza bruta implementado.

---

## 🔍 Audit Logging

### Características

- **Registro automático de todas las acciones importantes**
- **Tracking de intentos de login (exitosos y fallidos)**
- **Almacenamiento de IP, User-Agent, detalles de la acción**
- **Consulta de logs con filtros**

### Tablas de Base de Datos

#### `audit_logs`
```sql
- id: INT (Primary Key)
- user_id: INT (Foreign Key → users.id)
- action: VARCHAR(100) - tipo de acción (login, logout, create_user, etc.)
- entity_type: VARCHAR(50) - tipo de entidad afectada
- entity_id: INT - ID de la entidad
- ip_address: VARCHAR(45) - IPv4/IPv6
- user_agent: VARCHAR(500) - navegador/cliente
- status: VARCHAR(20) - success/failure
- details: TEXT - JSON con detalles adicionales
- error_message: VARCHAR(500) - mensaje de error si aplicable
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `login_attempts`
```sql
- id: INT (Primary Key)
- username_or_email: VARCHAR(255)
- ip_address: VARCHAR(45)
- success: BOOLEAN
- user_agent: VARCHAR(500)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Consultar Logs

```sql
-- Últimos 10 logins
SELECT * FROM audit_logs 
WHERE action = 'login' 
ORDER BY created_at DESC 
LIMIT 10;

-- Intentos de login fallidos en las últimas 24 horas
SELECT * FROM login_attempts 
WHERE success = false 
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Actividad por usuario
SELECT 
  action, 
  status, 
  ip_address, 
  created_at 
FROM audit_logs 
WHERE user_id = 1 
ORDER BY created_at DESC;
```

---

## 🛡️ Rate Limiting

### Configuración

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `MAX_ATTEMPTS_PER_USER` | 3 | Máximo intentos fallidos por usuario |
| `MAX_ATTEMPTS_PER_IP` | 5 | Máximo intentos fallidos por IP |
| `LOCKOUT_DURATION_MINUTES` | 15 | Tiempo de bloqueo en minutos |

### Funcionamiento

1. **Validación Pre-Login**: Antes de autenticar, verifica si el usuario o IP están bloqueados
2. **Conteo de Intentos**: Cuenta intentos fallidos en los últimos 15 minutos
3. **Bloqueo Temporal**: Si se excede el límite, bloquea con HTTP 429
4. **Reset Automático**: Después de login exitoso, limpia intentos fallidos del usuario

### Respuestas

**Login bloqueado por usuario:**
```json
{
  "detail": "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos."
}
```
Status Code: `429 TOO MANY REQUESTS`

**Login bloqueado por IP:**
```json
{
  "detail": "Demasiados intentos fallidos desde tu IP. Intenta de nuevo más tarde."
}
```
Status Code: `429 TOO MANY REQUESTS`

---

## 📊 Monitoreo

### Endpoints de Administración (TODO)

```bash
# Ver audit logs (requiere permisos admin)
GET /api/v1/admin/audit-logs?user_id=1&action=login&limit=50

# Ver intentos de login
GET /api/v1/admin/login-attempts?ip_address=1.2.3.4

# Estadísticas de seguridad
GET /api/v1/admin/security-stats
```

### Consultas Útiles

```sql
-- Top 10 IPs con más intentos fallidos
SELECT 
  ip_address, 
  COUNT(*) as failed_attempts,
  MAX(created_at) as last_attempt
FROM login_attempts 
WHERE success = false 
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address 
ORDER BY failed_attempts DESC 
LIMIT 10;

-- Usuarios con más intentos fallidos
SELECT 
  username_or_email,
  COUNT(*) as failed_attempts,
  MAX(created_at) as last_attempt
FROM login_attempts 
WHERE success = false 
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY username_or_email 
ORDER BY failed_attempts DESC 
LIMIT 10;

-- Actividad sospechosa (muchos intentos fallidos seguidos)
SELECT 
  ip_address,
  username_or_email,
  COUNT(*) as attempts,
  MIN(created_at) as first_attempt,
  MAX(created_at) as last_attempt
FROM login_attempts 
WHERE success = false 
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address, username_or_email
HAVING COUNT(*) >= 3
ORDER BY attempts DESC;
```

---

## 🚀 Uso desde Código

### Registrar Acción en Audit Log

```python
from src.services.audit_service import AuditService
from src.database import get_db

db = next(get_db())

AuditService.log_action(
    db=db,
    user_id=1,
    action="delete_user",
    entity_type="users",
    entity_id=5,
    ip_address="192.168.1.100",
    user_agent="Mozilla/5.0...",
    status="success",
    details={"reason": "User requested account deletion"},
)
```

### Verificar Rate Limit Manualmente

```python
from src.services.rate_limit_service import RateLimitService

is_allowed, message = RateLimitService.check_rate_limit(
    db=db,
    username_or_email="admin",
    ip_address="192.168.1.100",
)

if not is_allowed:
    # Usuario bloqueado
    print(f"Blocked: {message}")
```

---

## 🔐 Acceso a Documentación API

### Swagger UI
```
https://emerald.2finternet.ar/docs
http://localhost:8500/docs (desarrollo)
```

### ReDoc
```
https://emerald.2finternet.ar/redoc
http://localhost:8500/redoc (desarrollo)
```

### OpenAPI JSON
```
https://emerald.2finternet.ar/openapi.json
http://localhost:8500/openapi.json (desarrollo)
```

---

## ⚙️ Configuración Avanzada

Edita `backend/src/services/rate_limit_service.py`:

```python
class RateLimitService:
    # Ajustar estos valores según necesidades
    MAX_ATTEMPTS_PER_IP = 10  # Más permisivo
    MAX_ATTEMPTS_PER_USER = 5  # Más estricto
    LOCKOUT_DURATION_MINUTES = 30  # Bloqueo más largo
```

---

## 📝 Notas Importantes

1. ✅ Todos los logins se registran automáticamente
2. ✅ Rate limiting se aplica solo en `/api/v1/auth/login`
3. ✅ Los intentos se cuentan en ventana deslizante (últimos 15 min)
4. ✅ Login exitoso limpia intentos fallidos del usuario
5. ⚠️ IP blocking persiste hasta que pase el tiempo de lockout
6. 🔄 Logs antiguos deberían limpiarse periódicamente (TODO: cron job)

---

## 🎯 Próximas Mejoras

- [ ] Endpoint admin para ver audit logs
- [ ] Dashboard de seguridad en el frontend
- [ ] Alertas por email cuando hay actividad sospechosa
- [ ] Exportar logs a CSV/JSON
- [ ] Limpieza automática de logs antiguos (retention policy)
- [ ] Whitelist de IPs confiables
- [ ] CAPTCHA después de 2 intentos fallidos
