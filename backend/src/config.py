import os
import logging
import sys
from pathlib import Path
from dotenv import load_dotenv

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

# --- CREDENCIALES DE BASE DE DATOS (POSTGRES) ---
POSTGRES_USER = os.getenv("POSTGRES_USER", "admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "adminpassword")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "db") 
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "emerald_stock")

# Construimos la URL para SQLAlchemy
SQLALCHEMY_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# --- VARIABLES DE ENTORNO ---
API_KEY = os.getenv("API_KEY")
SMARTOLT_BASEURL = os.getenv("SMARTOLT_BASEURL")
SMARTOLT_TOKEN = os.getenv("SMARTOLT_TOKEN")
MK_HOST = os.getenv("MK_HOST")
MK_USER = os.getenv("MK_USER")
MK_PASS = os.getenv("MK_PASS")
# Convertimos a int de forma segura, con default 8728 (puerto api mikrotik default) u 8799
MK_PORT = int(os.getenv("MK_PORT", 8799))
GENIEACS_URL = os.getenv("GENIEACS_URL")
ISPCUBE_BASEURL = os.getenv("ISPCUBE_BASEURL")
ISPCUBE_APIKEY = os.getenv("ISPCUBE_APIKEY")
ISPCUBE_USER = os.getenv("ISPCUBE_USER")
ISPCUBE_PASSWORD = os.getenv("ISPCUBE_PASSWORD")
ISPCUBE_CLIENTID = os.getenv("ISPCUBE_CLIENTID")

# --- CONFIGURACIÓN DE LOGGING ---
# Usamos BASE_DIR para ubicar la carpeta de logs dentro de backend/data/logs
# BASE_DIR es la raiz, asi que bajamos a backend/data/logs
# O si preferís mantenerlo dentro de backend, ajustamos la ruta:
BACKEND_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BACKEND_DIR / "data" / "logs"

# Crear directorio si no existe
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Configuración: Guardar en archivo Y mostrar en consola (para ver logs de Docker)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "sync.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("Emerald")