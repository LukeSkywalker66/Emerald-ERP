# 🔐 Sistema de Autenticación - Emerald ERP

## Resumen

Se implementó un **Sistema de Autenticación Complete** siguiendo **Clean Architecture** con:
- SQLAlchemy 2.0 (Database Layer)
- Repository Pattern (Data Access Layer)
- Service Layer (Business Logic)
- Pydantic v2 Schemas (API Layer)
- JWT Tokens + Argon2 Hashing (Security)

## Credenciales de Prueba

```
Email:    admin@emerald.com
Username: admin
Password: Admin123
```

## Endpoints API

### 1. Login
```bash
curl -X POST "http://localhost:8500/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=Admin123"
```

**Respuesta:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

**Nota:** El campo `username` acepta tanto email como username.

### 2. Obtener Usuario Actual
```bash
curl -X GET "http://localhost:8500/api/v1/auth/me" \
  -H "Authorization: Bearer <token>"
```

**Respuesta:**
```json
{
  "id": 1,
  "email": "admin@emerald.com",
  "username": "admin",
  "full_name": "Administrador del Sistema",
  "is_active": true,
  "is_superuser": true,
  "role_id": 1,
  "role": {
    "id": 1,
    "name": "admin",
    "permissions": ["*"],
    "created_at": "2025-12-30T13:58:45.627756Z",
    "updated_at": "2025-12-30T13:58:45.627756Z"
  },
  "created_at": "2025-12-30T13:59:08.357961Z",
  "updated_at": "2025-12-30T13:59:08.744093Z"
}
```

### 3. Registro de Nuevo Usuario
```bash
curl -X POST "http://localhost:8500/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@emerald.com",
    "username": "newuser",
    "password": "NewPass@123",
    "full_name": "New User"
  }'
```

**Requisitos de Contraseña:**
- Mínimo 8 caracteres
- Contiene al menos una mayúscula
- Contiene al menos una minúscula
- Contiene al menos un dígito

### 4. Cambiar Contraseña
```bash
curl -X POST "http://localhost:8500/api/v1/auth/change-password" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "OldPass123",
    "new_password": "NewPass456"
  }'
```

## Documentación Interactiva

Accede a **Swagger UI** en:
```
http://localhost:8500/docs
```

O **ReDoc** en:
```
http://localhost:8500/redoc
```

## Estructura del Código

```
backend/src/
├── core/
│   └── security.py          # Hashing, JWT, OAuth2
├── database/
│   ├── base.py             # Base models y mixins
│   └── session.py          # Conexión y sesiones
├── models/
│   └── user.py             # User y Role models
├── repositories/
│   ├── base.py             # BaseRepository genérico
│   └── user_repository.py  # UserRepository, RoleRepository
├── schemas/
│   └── user_schemas.py     # Pydantic schemas
├── services/
│   └── auth_service.py     # AuthService (lógica de negocio)
└── routers/
    └── v1/
        └── auth.py         # Endpoints FastAPI
```

## Características de Seguridad

✅ **Hashing:** Argon2 con configuración fuerte
  - Memory cost: 65536 KB
  - Time cost: 3 iteraciones
  - Parallelism: 4

✅ **JWT Tokens**
  - Algoritmo: HS256
  - Expiración: 30 minutos
  - Payload: user_id, email, username, is_superuser

✅ **Roles y Permisos**
  - Admin: `["*"]` (permisos ilimitados)
  - Tecnico: lectura/escritura de tickets y servicios
  - Viewer: solo lectura

✅ **Validación**
  - Email único
  - Username único
  - Password con requisitos de complejidad

## Testing

Ejecutar test completo:
```bash
bash /tmp/test_auth_final.sh
```

## Próximas Mejoras (TODO)

- [ ] Rate limiting en login
- [ ] 2FA (Two-Factor Authentication)
- [ ] Refresh tokens
- [ ] OAuth2 con terceros (Google, GitHub)
- [ ] API Key authentication
- [ ] Session management
- [ ] Audit logging

## Notas de Desarrollo

- El token JWT expira en 30 minutos
- Las migraciones se ejecutan automáticamente en el build de Docker
- El middleware de seguridad whitelista endpoints de auth y públicos
- Login flexible: acepta tanto email como username
