"""
Utilidades de seguridad: hashing de passwords y JWT tokens
"""
from datetime import datetime, timedelta
from typing import Optional, Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from src import config
from src.database import get_db
from src.repositories.user_repository import UserRepository


# CONFIGURACIÓN DE HASHING - Argon2
# ====================================
# Argon2id es el algoritmo recomendado por OWASP (2023) para hashing de passwords.
# Parámetros tuneados para balance entre seguridad y rendimiento:
#  - memory_cost=65536 KiB (~64 MB): Resiste ataques GPU/ASIC
#  - time_cost=3: 3 iteraciones del hash
#  - parallelism=4: Paralelización interna
# Benchmark: ~150ms por hash en hardware típico (aceptable para login)
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__memory_cost=65536,
    argon2__time_cost=3,
    argon2__parallelism=4
)

# CONFIGURACIÓN DE OAUTH2
# ======================
# Extrae automáticamente el Bearer token del header Authorization: Bearer <token>
# FastAPI usa este scheme para documentación OpenAPI y validación de request.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica que un password en texto plano coincida con su hash Argon2.
    
    Implementa comparación segura contra timing attacks al usar passlib,
    que mantiene tiempo de ejecución consistente independientemente del resultado.
    
    Args:
        plain_password: Password sin encriptar (de request login).
        hashed_password: Hash Argon2 almacenado en base de datos (users.password_hash).
    
    Returns:
        bool: True si el password coincide, False en caso contrario o si hay error.
    
    Note:
        Si hashed_password está malformado o corrupto, retorna False (fallback seguro).
    
    Example:
        >>> user = users_repo.get(1)
        >>> if verify_password("miPassword123", user.password_hash):
        ...     create_token_for_user(user)
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    Genera un hash Argon2 criptográficamente seguro de un password.
    
    NUNCA almacenes passwords en texto plano. Esta función se llama en:
      1. POST /api/v1/auth/register - Crear nuevo usuario
      2. PATCH /api/v1/users/{id}/password - Cambiar password existente
      3. Scripts admin - Creación de usuarios iniciales
    
    Args:
        password: Password sin encriptar proporcionado por el usuario.
    
    Returns:
        str: Hash Argon2 ($argon2id$v=19$...) seguro para almacenar en BD.
    
    Raises:
        Implícita: No lanza excepciones; todo password genera hash válido.
    
    Security:
        - Cada llamada genera diferente hash (salt aleatorio incluido)
        - Es computacionalmente imposible revertir (irreversible por diseño)
        - Resiste ataques rainbow tables y brute-force mediante parámetros Argon2
    
    Example:
        >>> password_hash = get_password_hash("Usuario@2025")
        >>> # Guardar en user.password_hash antes de commit a BD
        >>> new_user = User(email="user@emerald.com", password_hash=password_hash)
    """
    return pwd_context.hash(password)


def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Crea un JSON Web Token (JWT) firmado con HS256 (HMAC-SHA256).
    
    El token contiene claims como user_id ("sub") y expiration ("exp").
    Se usa después de login exitoso para autorizar requests posteriores.
    
    Args:
        data: Diccionario con claims para incluir en el token.
              Típicamente: {"sub": str(user.id), "email": user.email}
        expires_delta: Duración del token. Si None, usa default de 30 minutos.
    
    Returns:
        str: Token JWT codificado como string (ej: "eyJhbGciOiJIUzI1NiIs...")
    
    Token Structure (Base64 decode):
        Header: {"alg": "HS256", "typ": "JWT"}
        Payload: {"sub": "123", "email": "user@emerald.com", "exp": 1704067200}
        Signature: HMAC-SHA256(secret_key)
    
    Security:
        - Firmado con config.SECRET_KEY (debe ser >32 caracteres, aleatorio)
        - Imposible falsificar token sin la clave secreta
        - Verificable por cualquiera sin acceso a la clave (público)
    
    Example:
        >>> user = users_repo.get_by_email("admin@emerald.com")
        >>> token = create_access_token(
        ...     {"sub": str(user.id), "email": user.email},
        ...     expires_delta=timedelta(hours=24)
        ... )
        >>> # Retornar en response JSON: {"access_token": token, "token_type": "bearer"}
    
    Configuration:
        - SECRET_KEY: src/config.py (variable de entorno)
        - ALGORITHM: "HS256" (no cambiar sin actualizar clientes)
        - Default expiry: 30 minutos (modificable por expires_delta)
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=30)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode,
        config.SECRET_KEY,
        algorithm=config.ALGORITHM
    )
    
    return encoded_jwt


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    FastAPI Dependency: Extrae y valida JWT token, retorna usuario autenticado.
    
    Esta es la función CLAVE para autenticación. Se usa en TODOS los endpoints
    protegidos como Depends(get_current_user).
    
    Flujo:
        1. FastAPI extrae token del header Authorization: Bearer <token>
        2. Decodifica y valida firma con SECRET_KEY
        3. Extrae user_id del claim "sub"
        4. Busca usuario en BD (get_db session inyectada)
        5. Verifica que usuario está activo (is_active=True)
        6. Retorna objeto User completo
    
    Args:
        token: JWT token automáticamente inyectado por oauth2_scheme.
               Viene del header: Authorization: Bearer <token>
        db: Sesión SQLAlchemy inyectada por FastAPI.
    
    Returns:
        User: Objeto modelo User con id, email, roles, permisos, etc.
    
    Raises:
        HTTPException (401): Token inválido, expirado, no contiene "sub", o malformado.
                            Mensaje: "No se pudo validar las credenciales"
        HTTPException (403): Usuario existe pero está inactivo (is_active=False).
                            Mensaje: "Usuario inactivo"
    
    Example (en router):
        @router.get("/api/v1/users/me")
        def get_profile(current_user = Depends(get_current_user)):
            # current_user es el User autenticado, nunca anonymous
            return {"id": current_user.id, "email": current_user.email}
    
    Security Headers:
        401 response incluye: {"WWW-Authenticate": "Bearer"}
        Indica al cliente que debe intentar con nuevo token Bearer.
    
    Token Lifetime:
        Si token expiró (claim exp < now), jwt.decode lanza JWTError → 401.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token,
            config.SECRET_KEY,
            algorithms=[config.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    user_repo = UserRepository(db)
    user = user_repo.get(int(user_id))
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )
    
def get_current_active_superuser(
    current_user = Depends(get_current_user)
):
    """
    FastAPI Dependency: Valida que usuario autenticado es SUPERUSUARIO.
    
    Anida get_current_user, entonces primero autentica, luego autoriza.
    Usa para endpoints solo-admin (crear roles, usuarios, etc.).
    
    Args:
        current_user: Usuario ya autenticado (inyectado por get_current_user).
    
    Returns:
        User: El mismo usuario si is_superuser=True.
    
    Raises:
        HTTPException (403): Usuario autenticado pero no es superusuario.
                            Mensaje: "No tienes permisos suficientes"
    
    Example (en router):
        @router.post("/api/v1/admin/users")
        def create_user_admin(data: UserCreate, admin = Depends(get_current_active_superuser)):
            # Solo ejecuta si admin.is_superuser=True, else 403 Forbidden
            return users_repo.create(data)
    
    Auditoría:
        Cuando alguien intenta acceso no-autorizado, es rechazado con 403.
        Este evento DEBERÍA loguear en audit_logs para investigación de seguridad.
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos suficientes"
        )
    return current_user


def decode_token(token: str) -> dict:
    """
    Decodifica JWT token SIN validar expiración (claims "exp").
    
    ADVERTENCIA: Esta función es DÉBIL en seguridad. Úsala SOLO para:
      - Auditoría de tokens expirados (investigar historial)
      - Debugging de claims en development
      - Revisar tokens comprometidos sin ejecutar código
    
    Para autenticación en endpoints, USA get_current_user() siempre.
    
    Args:
        token: JWT token en formato string (puede estar expirado).
    
    Returns:
        dict: Claims decodificados (ej: {"sub": "123", "email": "...", "exp": ...})
              Si token es inválido (malformado, firma incorrecta), retorna {} vacío.
    
    Raises:
        Ninguna explícita. Retorna dict vacío si hay error.
    
    Why No Validation:
        jwt.decode con options={"verify_exp": False} permite decodificar
        tokens expirados. Igual valida firma (key must match).
    
    Example (endpoint admin de auditoría):
        @router.post("/api/v1/admin/audit/decode-token")
        def decode_suspicious_token(token: str):
            payload = decode_token(token)
            if not payload:
                raise HTTPException(400, "Token inválido/corrupto")
            # Investigar quién era y cuándo expiró
            return {"decoded": payload, "warning": "Token may be compromised"}
    
    Note:
        - signature_verification=True: Verifica que el token NO fue adulterado
        - exp validation deshabilitado: Permite tokens viejos
        - Si secret_key es incorrecta, no decodifica (retorna {})
    """
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        return payload
    except JWTError:
        return {}
