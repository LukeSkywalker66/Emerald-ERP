import sys
import os
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from typing import Optional
from jose import JWTError, jwt
from pydantic import BaseModel

# Path setup para que Python encuentre 'src'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Imports de Emerald
from src.database import engine, Base, get_db
from src import models
from src import config
from src.services.api_key_service import APIKeyService
from src.routers.v1 import auth  # Removed old tickets router import
from src.routers.v1 import admin  # Administración y desbloqueo
from src.routers.v2 import users as users_v2
from src.routers.v2 import roles as roles_v2
from src.routers import tickets, search, tags, work_orders, inventory, engineering, coordination, fleet, installation_types, audit

# 👇 IMPORTAMOS EL NUEVO SERVICIO (Tu lógica adaptada)
from src.services import diagnosis as diagnosis_service 

# Ejecutar migraciones Alembic en startup en lugar de create_all
from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig

# --- Configuración JWT (para el futuro: frontend con login) ---
SECRET_KEY = os.getenv("SECRET_KEY", "cambiar-en-produccion")
ALGORITHM = "HS256"

def run_db_migrations():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # carpeta backend
    alembic_ini = os.path.join(here, "alembic.ini")
    alembic_dir = os.path.join(here, "alembic")

    cfg = AlembicConfig(alembic_ini)
    cfg.set_main_option("script_location", alembic_dir)
    cfg.set_main_option("sqlalchemy.url", config.SQLALCHEMY_DATABASE_URL)

    alembic_command.upgrade(cfg, "head")

app = FastAPI(
    title="Emerald ERP + Beholder",
    redirect_slashes=False,  # NO hacer redirects 307, aceptar ambas formas
)

# ✨ NUEVO: Configurar carpeta de medios para adjuntos
MEDIA_DIR = Path(__file__).parent.parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)
(MEDIA_DIR / "tickets").mkdir(exist_ok=True)

app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

# Incluir routers v1
app.include_router(
    auth.router,
    prefix="/api/v1",
    tags=["Authentication"]
)

# Admin endpoints (requires superuser role)
app.include_router(
    admin.router,
    prefix="/api/v1",
    tags=["Administration"]
)

# NOTE: v1/tickets router is deprecated. Use /api/v2/tickets instead.
# app.include_router(
#     tickets.router,
#     prefix="/api/v1",
#     tags=["Tickets"]
# )
app.include_router(
    tickets.router,
    prefix="/api/v2/tickets",
    tags=["Tickets V2"]
)
app.include_router(
    work_orders.router,
    prefix="/api",
    tags=["Work Orders"]
)
app.include_router(
    tags.router,
    prefix="/api/v2",
    tags=["Tags"]
)
app.include_router(
    installation_types.router,
    prefix="/api",
    tags=["Installation"]
)
app.include_router(
    search.router,
    prefix="/api",
    tags=["Search"]
)

# Users V2 (admin)
app.include_router(
    users_v2.router,
    prefix="/api/v2/users",
    tags=["Users V2"]
)

# Roles V2 (authenticated users)
app.include_router(
    roles_v2.router,
    prefix="/api/v2",
    tags=["Roles V2"]
)

# Inventory Module
app.include_router(
    inventory.router,
    prefix="/api",
    tags=["Inventory"]
)

# Engineering/NOC Module
app.include_router(
    engineering.router,
    tags=["Engineering/NOC"]
)

# Coordination Module (Teams)
app.include_router(
    coordination.router,
    tags=["Coordination"]
)

# Fleet Module (Vehicles)
app.include_router(
    fleet.router,
    tags=["Fleet"]
)

# Fleet Module (Vehicle Inspections)
app.include_router(
    fleet.inspection_router,
    tags=["Fleet Inspections"]
)

# Audit Logs Module (Admin Only)
app.include_router(
    audit.router,
    prefix="/api",
    tags=["Audit Logs"]
)

@app.on_event("startup")
def on_startup():
    # 1. Validar configuración
    from src.config import validate_configuration, log_configuration_summary
    if not validate_configuration():
        raise RuntimeError("Configuración inválida. Revisa los logs.")
    
    log_configuration_summary()
    
    # 2. Migraciones Alembic ya se ejecutaron en Docker
    # No ejecutar aquí para evitar cuelgues en desarrollo

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MIDDLEWARE DE SEGURIDAD MEJORADO ---
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """
    Middleware mejorado con soporte para:
    1. API Keys con validación en BD
    2. JWT Tokens (futuro frontend)
    3. Whitelist de endpoints públicos
    """
    
    # Endpoints públicos (no requieren autenticación)
    whitelist = [
        "/docs", 
        "/redoc", 
        "/openapi.json", 
        "/services_options",  # Demo pública
        # Beholder (legacy paths y prefijos /api)
        "/search", "/diagnosis", "/live", 
        "/api/search", "/api/diagnosis", "/api/live",
        # Health
        "/api/health", "/health",
        # Auth
        "/api/v1/auth/login", "/api/v1/auth/register",
    ]
    
    # Pasar libremente si es whitelist u OPTIONS
    if request.method == "OPTIONS" or request.url.path == "/" or any(request.url.path.startswith(p) for p in whitelist):
        return await call_next(request)
    
    # Endpoints que requieren autenticación
    protected_endpoints = ["/admin", "/api/clientes", "/api/servicios", "/api/v2/tickets", "/api/v2/users"]
    is_protected = any(request.url.path.startswith(p) for p in protected_endpoints)
    
    if is_protected:
        # Intentar autenticación por API Key (para bots)
        api_key = request.headers.get("x-api-key")
        if api_key:
            db = SessionLocal()
            try:
                key_data = await APIKeyService.validate_api_key(
                    db, 
                    api_key,
                    ip_address=request.client.host if request.client else None
                )
                if key_data:
                    request.state.api_key_id = key_data["id"]
                    request.state.api_key_name = key_data["name"]
                    request.state.auth_type = "api_key"
                    db.close()
                    return await call_next(request)
                else:
                    db.close()
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "API Key inválida o expirada"}
                    )
            except Exception as e:
                db.close()
                import logging
                logging.error(f"Error validando API Key: {e}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Error validando credenciales"}
                )
        else:
            # Intentar autenticación por JWT Token (para frontend futuro)
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                try:
                    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                    user_id_from_token = payload.get("sub")
                    
                    # DEBUG: Log del JWT
                    import logging
                    logger = logging.getLogger("uvicorn.error")
                    logger.info(f"🔑 [JWT AUTH] Token decodificado. Payload sub={user_id_from_token}, tipo={type(user_id_from_token)}")
                    logger.info(f"🔑 [JWT AUTH] Payload completo: {payload}")
                    
                    request.state.user_id = user_id_from_token
                    request.state.auth_type = "jwt"
                    return await call_next(request)
                except JWTError as e:
                    import logging
                    logger = logging.getLogger("uvicorn.error")
                    logger.error(f"[JWT AUTH] Error decodificando token: {e}")
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Token inválido o expirado"}
                    )
            
            # Sin autenticación
            return JSONResponse(
                status_code=401,
                content={"detail": "Se requiere API Key o JWT Token"}
            )
    
    return await call_next(request)

# Importar SessionLocal después del middleware
from src.database import SessionLocal

# ==========================
# 🔵 SECCIÓN BEHOLDER (Monitor)
# ==========================

@app.get("/health")
def health():
    return {"status": "ok", "system": "Emerald Core + Beholder"}

@app.get("/api/health")
def health_api():
    return health()

@app.get("/search")
def search_endpoint(q: str):
    # Ahora llamamos al servicio limpio
    return diagnosis_service.search_clients(q)

@app.get("/api/search")
def search_endpoint_api(q: str):
    return search_endpoint(q)

# @app.get("/diagnosis/{pppoe_user}")
# def diagnosis_endpoint(pppoe_user: str):
#     # La lógica pesada está en src/services/diagnosis.py
#     result = diagnosis_service.consultar_diagnostico(pppoe_user)
#     if "error" in result and not result.get("pppoe_username"):
#          # Si devolvió error puro sin datos parciales, es un 404 real
#          raise HTTPException(status_code=404, detail=result["error"])
#     return result
@app.get("/diagnosis/{pppoe_user}")
def diagnosis_endpoint(pppoe_user: str, ip: Optional[str] = None):
    # 1. Print corregido (usando pppoe_user)
    print(f"🛑 DEBUG 1: Entrando a diagnóstico para: {pppoe_user}", flush=True)
    
    try:
        # Llamada al servicio
        result = diagnosis_service.consultar_diagnostico(pppoe_user, ip)
        
        # 2. Print corregido (mostramos result, no client)
        print(f"🛑 DEBUG 2: Servicio respondió. Tipo: {type(result)}", flush=True)
        print(f"🛑 DEBUG 3: Datos crudos: {result}", flush=True)

        # 3. Validación de seguridad para que no explote si result es None
        if result is None:
            print("🔥 DEBUG: El servicio devolvió None!", flush=True)
            raise HTTPException(status_code=404, detail="Cliente no encontrado (Devolvió None)")

        # Tu lógica original del IF, pero con un print antes para saber si entra
        if "error" in result and not result.get("pppoe_username"):
             print(f"⚠️ DEBUG: Entrando al IF de error. Razón: {result.get('error')}", flush=True)
             raise HTTPException(status_code=404, detail=result["error"])
        
        return result

    except Exception as e:
        # 4. ESTO ES LO QUE BUSCAMOS: El error real de Python (ej: MultipleResultsFound)
        print(f"🔥🔥🔥 DEBUG CRASH EXCEPTION: {e}", flush=True)
        import traceback
        traceback.print_exc() # Esto imprime el choclo de líneas en el log
        # Devolvemos 500 para verlo en el navegador también
        raise HTTPException(status_code=500, detail=f"Error interno debuggeando: {str(e)}")


@app.get("/api/diagnosis/{pppoe_user}")
def diagnosis_endpoint_api(pppoe_user: str, ip: Optional[str] = None):
    return diagnosis_endpoint(pppoe_user, ip)


@app.get("/live/{pppoe_user}")
def live_traffic_endpoint(pppoe_user: str):
    result = diagnosis_service.get_live_traffic(pppoe_user)
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("detail"))
    return result


@app.get("/api/live/{pppoe_user}")
def live_traffic_endpoint_api(pppoe_user: str):
    return live_traffic_endpoint(pppoe_user)


# ════════════════════════════════════════════════════════════════════════════
# 🔐 ENDPOINTS DE ADMINISTRACIÓN DE API KEYS
# ════════════════════════════════════════════════════════════════════════════

class APIKeyCreateRequest(BaseModel):
    """Request para crear una nueva API Key"""
    name: str
    scopes: List[str] = ["read"]
    expires_in_days: int = 90

class APIKeyResponse(BaseModel):
    """Response con datos de API Key (sin la key raw excepto en creación)"""
    id: int
    name: str
    prefix: str
    active: bool
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime]
    scopes: List[str]
    rotation_count: int

class APIKeyCreateResponse(BaseModel):
    """Response cuando se crea una key (incluye la key sin hash)"""
    id: int
    name: str
    key: str
    prefix: str
    expires_at: datetime
    scopes: List[str]
    warning: str


# Dependencia para verificar que es admin (placeholder simple)
async def verify_admin(request: Request):
    """Verificar que la solicitud es del admin (futura implementación)"""
    # Por ahora: si tiene API Key válida, es admin
    # En futuro: verificar JWT con claims de admin
    if not hasattr(request.state, "api_key_id"):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return request.state.api_key_id


@app.post("/admin/api-keys", response_model=APIKeyCreateResponse)
async def create_api_key_endpoint(
    request: APIKeyCreateRequest,
    db: Session = Depends(get_db),
    _admin = Depends(verify_admin)
):
    """
    Crear una nueva API Key.
    
    ⚠️ Requiere autenticación admin (API Key o JWT)
    
    **IMPORTANTE**: La key se devuelve SIN HASH solo en esta respuesta.
    El usuario debe copiarla inmediatamente, no se mostrará de nuevo.
    """
    new_key = await APIKeyService.create_api_key(
        db=db,
        name=request.name,
        scopes=request.scopes,
        expires_in_days=request.expires_in_days,
        created_by="admin"
    )
    
    return APIKeyCreateResponse(
        id=new_key["id"],
        name=new_key["name"],
        key=new_key["key"],
        prefix=new_key["prefix"],
        expires_at=datetime.fromisoformat(new_key["expires_at"]),
        scopes=new_key["scopes"],
        warning=new_key["warning"]
    )


@app.get("/admin/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    db: Session = Depends(get_db),
    _admin = Depends(verify_admin)
):
    """
    Listar todas las API Keys (sin las keys raw).
    
    Requiere autenticación admin.
    """
    keys = db.query(models.APIKey).order_by(models.APIKey.created_at.desc()).all()
    
    return [
        APIKeyResponse(
            id=k.id,
            name=k.name,
            prefix=k.key_prefix,
            active=bool(k.active),
            created_at=k.created_at,
            expires_at=k.expires_at,
            last_used=k.last_used,
            scopes=k.scopes or [],
            rotation_count=k.rotation_count
        )
        for k in keys
    ]


@app.post("/admin/api-keys/{key_id}/rotate", response_model=APIKeyCreateResponse)
async def rotate_api_key_endpoint(
    key_id: int,
    db: Session = Depends(get_db),
    _admin = Depends(verify_admin)
):
    """
    Rotar una API Key manualmente.
    
    Crea una nueva key y desactiva la antigua.
    Requiere autenticación admin.
    """
    try:
        new_key = await APIKeyService.rotate_api_key(db, key_id)
        return APIKeyCreateResponse(
            id=new_key["id"],
            name=new_key["name"],
            key=new_key["key"],
            prefix=new_key["prefix"],
            expires_at=datetime.fromisoformat(new_key["expires_at"]),
            scopes=new_key["scopes"],
            warning=new_key["warning"]
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/admin/api-keys/{key_id}")
async def revoke_api_key_endpoint(
    key_id: int,
    db: Session = Depends(get_db),
    _admin = Depends(verify_admin)
):
    """
    Revocar una API Key (desactivarla permanentemente).
    
    Requiere autenticación admin.
    """
    success = await APIKeyService.revoke_api_key(db, key_id)
    if not success:
        raise HTTPException(status_code=404, detail="API Key not found")
    
    return {"message": "API Key revoked successfully"}


@app.get("/admin/api-keys/{key_id}/audit")
async def get_api_key_audit(
    key_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    _admin = Depends(verify_admin)
):
    """
    Obtener log de auditoría de una API Key específica.
    
    Requiere autenticación admin.
    """
    audit_log = APIKeyService.get_audit_log(db, key_id=key_id, limit=limit)
    
    if not audit_log:
        raise HTTPException(status_code=404, detail="API Key not found or no audit records")
    
    return {"audit_log": audit_log}


@app.get("/admin/api-keys/audit/all")
async def get_all_api_keys_audit(
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin = Depends(verify_admin)
):
    """
    Obtener log de auditoría de TODAS las API Keys.
    
    Requiere autenticación admin.
    """
    audit_log = APIKeyService.get_audit_log(db, key_id=None, limit=limit)
    
    return {
        "total_records": len(audit_log),
        "audit_log": audit_log
    }