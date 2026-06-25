🚀 Protocolo Obligatorio de Despliegue (Fase de Estabilización)
Paso 1: Pull de Cambios en la Rama Destino
Asegúrate de estar en la rama correcta (desa o main/prod) y con el árbol limpio antes de impactar el servidor.

Bash
git checkout <tu-rama-destino>
git pull origin <tu-rama-destino>
Paso 2: Reconstrucción y Recarga de Contenedores
Para asegurar que los cambios en el backend (FastAPI), frontend (Vite) y las tareas de Celery se apliquen sin arrastrar caché corrupto, usamos la estrategia de recreación bi-fásica.

Como bien mencionas, el entorno (.dev.yml, .staging.yml, .yml) ya viene inyectado o preconfigurado en el comando genérico de Docker Compose si usas los archivos correctos. La línea maestra genérica es:

Bash
# Apagar, compilar sin caché los cambios del Dockerfile y levantar en background
docker compose down && docker compose build --no-cache && docker compose up -d
⚠️ Riesgo Operativo: Nunca uses un simple docker compose restart si hubo cambios en el package.json, requirements.txt o la configuración de Nginx, ya que no recompilará las imágenes ni refrescará las capas del contenedor.

Paso 3: Ejecución de Migraciones (Alembic)
Este es el paso crítico Nivel NASA. Las migraciones deben correrse inmediatamente después de levantar los contenedores para que el backend no lance errores 500 debido a discrepancias de esquemas con PostgreSQL 15.

Bash
# Correr el upgrade head impactando el contenedor de backend
docker compose exec backend alembic upgrade head
Paso 4: Verificación de Salud (Health Check Express)
Antes de retirarte de la sesión SSH, ejecuta el chequeo táctico para verificar que el Orquestador y sus motores estén arriba:

Bash
# Verificar que todos los servicios estén en estado "Up"
docker compose ps

# Monitorear las últimas 20 líneas del log del backend en busca de excepciones
docker compose logs backend --tail=20
📋 Resumen en Bloque Único (Para Copiar y Pegar)
Si vas a tirar comandos en cadena en la consola de Debian, esta es tu secuencia genérica infalible:

Bash
# 1. Traer cambios
git pull origin <rama>

# 2. Recrear infraestructura limpia
docker compose down && docker compose build --no-cache && docker compose up -d

# 3. Sincronizar esquemas de base de datos
docker compose exec backend alembic upgrade head

# 4. Control de pulso
docker compose ps