import os
import logging
import sys
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join("config", ".env"))


# Intentamos cargar .env desde la carpeta config/ (relativa al root del backend)
# En Docker, esto es /app/config/.env si montaste el volumen correctamente
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", ".env")
load_dotenv(env_path)

# --- CREDENCIALES DE BASE DE DATOS (POSTGRES) ---
POSTGRES_USER = os.getenv("POSTGRES_USER", "admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "adminpassword")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "db") # 'db' es el nombre del servicio en docker-compose
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "emerald_stock")

# Construimos la URL para SQLAlchemy
SQLALCHEMY_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"



# Variables de entorno
API_KEY = os.getenv("API_KEY")
SMARTOLT_BASEURL = os.getenv("SMARTOLT_BASEURL")
SMARTOLT_TOKEN = os.getenv("SMARTOLT_TOKEN")
MK_HOST = os.getenv("MK_HOST")
MK_USER = os.getenv("MK_USER")
MK_PASS = os.getenv("MK_PASS")
MK_PORT = int(os.getenv("MK_PORT", 8799))
GENIEACS_URL = os.getenv("GENIEACS_URL")
ISPCUBE_BASEURL=os.getenv("ISPCUBE_BASEURL")
ISPCUBE_APIKEY=os.getenv("ISPCUBE_APIKEY")
ISPCUBE_USER=os.getenv("ISPCUBE_USER")
ISPCUBE_PASSWORD=os.getenv("ISPCUBE_PASSWORD")
ISPCUBE_CLIENTID=os.getenv("ISPCUBE_CLIENTID")

# --- CONFIGURACIÓN DE LOGGING ---
# Aseguramos que exista la carpeta de logs dentro del contenedor
log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "logs")
os.makedirs(log_dir, exist_ok=True)

# Configuración: Guardar en archivo Y mostrar en consola (para ver logs de Docker)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(log_dir, "sync.log")),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("Emerald")