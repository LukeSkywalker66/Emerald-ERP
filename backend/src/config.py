import os
import logging
import sys
from pathlib import Path
from dotenv import load_dotenv

# ═════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE EMERALD ERP
# ═════════════════════════════════════════════════════════════════════════════

# --- CARGA DE .ENV ---
# Definimos la ruta base del archivo actual (config.py)
# Asumiendo ruta: backend/src/config.py (o similar dentro de src)
# .parent = carpeta contenedora (src)
# .parent.parent = carpeta del backend (backend)
# .parent.parent.parent = RAÍZ DEL PROYECTO (donde está el .env)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"

# Cargamos el .env explícitamente.
# Nota: En Docker, esto no encontrará el archivo (porque no lo montamos),
# pero no importa porque Docker ya inyectó las variables al sistema.
load_dotenv(dotenv_path=ENV_PATH)

# --- AMBIENTE ---
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# --- CREDENCIALES DE BASE DE DATOS (POSTGRES) - CRÍTICAS ---
POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "db") 
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB")

# Validar que las credenciales de BD no estén vacías
def _validate_db_config():
    """Validar configuración crítica de base de datos"""
    errors = []
    
    if not POSTGRES_USER:
        errors.append("POSTGRES_USER no configurado")
    if not POSTGRES_PASSWORD:
        errors.append("POSTGRES_PASSWORD no configurado")
    if not POSTGRES_DB:
        errors.append("POSTGRES_DB no configurado")
    
    if errors:
        logger = logging.getLogger("Emerald.Config")
        for error in errors:
            logger.error(f"❌ {error}")
        raise ValueError(f"Configuración incompleta: {', '.join(errors)}")

# Construimos la URL para SQLAlchemy
SQLALCHEMY_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# --- API KEY (CRÍTICA) ---
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    logger = logging.getLogger("Emerald.Config")
    logger.warning("⚠️ API_KEY no configurada. Endpoints protegidos no funcionarán.")

# --- MIKROTIK CONFIGURATION (CRÍTICO) ---
MK_HOST = os.getenv("MK_HOST")
MK_USER = os.getenv("MK_USER")
MK_PASS = os.getenv("MK_PASS")
MK_PORT = int(os.getenv("MK_PORT", "8728"))
MK_ENABLE_SSL = os.getenv("MK_ENABLE_SSL", "false").lower() == "true"
MK_TIMEOUT = int(os.getenv("MK_TIMEOUT", "10"))

def _validate_mikrotik_config():
    """Validar configuración de Mikrotik"""
    errors = []
    
    if not MK_HOST:
        errors.append("MK_HOST no configurado")
    if not MK_USER:
        errors.append("MK_USER no configurado")
    if not MK_PASS:
        errors.append("MK_PASS no configurado")
    
    if errors:
        logger = logging.getLogger("Emerald.Config")
        for error in errors:
            logger.error(f"❌ {error}")
        raise ValueError(f"Configuración Mikrotik incompleta: {', '.join(errors)}")

# --- ISPCube CONFIGURATION ---
# Soportar nombres legacy: ISPCUBE_BASEURL / ISPCUBE_APIKEY
ISPCUBE_API_URL = os.getenv("ISPCUBE_API_URL") or os.getenv("ISPCUBE_BASEURL")
ISPCUBE_API_KEY = os.getenv("ISPCUBE_API_KEY") or os.getenv("ISPCUBE_APIKEY")
ISPCUBE_SYNC_ENABLED = os.getenv("ISPCUBE_SYNC_ENABLED", "true").lower() == "true"

# --- SmartOLT CONFIGURATION ---
SMARTOLT_API_URL = os.getenv("SMARTOLT_API_URL")
SMARTOLT_API_KEY = os.getenv("SMARTOLT_API_KEY")
SMARTOLT_OLT_ID = os.getenv("SMARTOLT_OLT_ID")
SMARTOLT_SYNC_ENABLED = os.getenv("SMARTOLT_SYNC_ENABLED", "true").lower() == "true"

# Alias para compatibilidad con código antiguo
SMARTOLT_BASEURL = SMARTOLT_API_URL
SMARTOLT_TOKEN = SMARTOLT_API_KEY
GENIEACS_URL = os.getenv("GENIEACS_URL")
ISPCUBE_BASEURL = ISPCUBE_API_URL
ISPCUBE_APIKEY = ISPCUBE_API_KEY
ISPCUBE_USER = os.getenv("ISPCUBE_USER")
ISPCUBE_PASSWORD = os.getenv("ISPCUBE_PASSWORD")
ISPCUBE_CLIENTID = os.getenv("ISPCUBE_CLIENTID")

# --- SEGURIDAD Y AUTENTICACIÓN ---
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    import secrets
    SECRET_KEY = secrets.token_urlsafe(32)
    logger = logging.getLogger("Emerald.Config")
    logger.warning("⚠️ SECRET_KEY no configurada. Generando clave temporal (NO USAR EN PRODUCCIÓN)")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# --- CONFIGURACIÓN DE LOGGING ---
# Usamos BASE_DIR para ubicar la carpeta de logs dentro de backend/data/logs
BACKEND_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BACKEND_DIR / "data" / "logs"

# Crear directorio si no existe
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Nivel de logging según ambiente
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG" if DEBUG else "INFO")

# Configuración: Guardar en archivo Y mostrar en consola (para ver logs de Docker)
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "app.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("Emerald")

# ═════════════════════════════════════════════════════════════════════════════
# VALIDACIÓN DE CONFIGURACIÓN AL STARTUP
# ═════════════════════════════════════════════════════════════════════════════

def validate_configuration():
    """
    Valida que todas las variables críticas estén configuradas.
    Se llama desde main.py en el evento @app.on_event("startup")
    """
    logger.info("🔍 Validando configuración de Emerald ERP...")
    
    try:
        # Validaciones críticas
        _validate_db_config()
        _validate_mikrotik_config()
        
        logger.info("✅ Configuración válida. Sistema listo.")
        
        # Warnings para configuración recomendada
        if not ISPCUBE_API_KEY:
            logger.warning("⚠️ ISPCUBE_API_KEY no configurado. Sincronización de ISPCube desactivada.")
        if not SMARTOLT_API_KEY:
            logger.warning("⚠️ SMARTOLT_API_KEY no configurado. Sincronización de SmartOLT desactivada.")
        if ENVIRONMENT == "production" and API_KEY and len(API_KEY) < 16:
            logger.warning("⚠️ API_KEY muy corta. Usar contraseña >16 caracteres en producción.")
        
        return True
        
    except ValueError as e:
        logger.error(f"❌ Validación fallida: {e}")
        return False

# Mostrar configuración en startup (sin exponer secretos)
def log_configuration_summary():
    """Log de resumen de configuración (sin exponer secretos)"""
    logger.info(f"Entorno: {ENVIRONMENT}")
    logger.info(f"Debug mode: {DEBUG}")
    logger.info(f"Base de datos: {POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
    logger.info(f"Mikrotik: {MK_HOST}:{MK_PORT} (SSL={MK_ENABLE_SSL})")
    logger.info(f"ISPCube: {('Habilitado' if ISPCUBE_SYNC_ENABLED else 'Deshabilitado')}")
    logger.info(f"SmartOLT: {('Habilitado' if SMARTOLT_SYNC_ENABLED else 'Deshabilitado')}")
    logger.info(f"Log level: {LOG_LEVEL}")
    logger.info(f"Log directory: {LOG_DIR}")