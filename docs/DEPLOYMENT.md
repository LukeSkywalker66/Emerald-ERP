# 🚀 Guía de Deployment a Producción

Esta guía te lleva paso a paso desde tu computadora hasta un servidor en producción.

---

## 📋 Pre-requisitos

### Hardware Mínimo Recomendado

| Componente | Desarrollo | Producción |
|-----------|-----------|-----------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Almacenamiento | 10 GB | 100 GB |
| Ancho de banda | 1 Mbps | 10 Mbps |

### Software Requerido

```bash
# Servidor Linux (Ubuntu 22.04 LTS recomendado)
lsb_release -a

# Docker (v20.10+)
docker --version

# Docker Compose (v2.0+)
docker compose --version

# Git
git --version
```

### Acceso

- 🔑 Clave SSH al servidor
- 🌐 Dominio apuntando al servidor (para certificado SSL)
- 📧 Email para Let's Encrypt

---

## 🏗️ Arquitectura de Producción

```
┌─────────────────────────────────────────┐
│            Usuarios/Clientes            │
│         (Navegador + API Clients)       │
└────────────────┬────────────────────────┘
                 │ HTTPS/443
         ┌───────▼────────┐
         │  Nginx + SSL   │
         │ (Let's Encrypt)│
         └───────┬────────┘
                 │ HTTP/5000 (interno)
    ┌────────────┼────────────┐
    │            │            │
┌───▼──┐    ┌────▼────┐  ┌───▼──┐
│ API  │    │ Frontend │  │Monitor│
│ Prod │    │   Prod   │  │(Beholder)
└──┬───┘    └────┬─────┘  └───┬──┘
   │             │            │
   └─────────────┼────────────┘
                 │
         ┌───────▼────────┐
         │  PostgreSQL    │
         │   (Vol. Persistente)
         └────────────────┘

   ┌──────────────────────────────┐
   │   Celery Worker + Redis      │
   │   (Tareas asincrónicas)      │
   └──────────────────────────────┘
```

---

## 🌍 Paso 1: Preparar Servidor

### 1.1 Conectar al Servidor

```bash
ssh -i tu_clave.pem ubuntu@tu_servidor_ip
```

### 1.2 Actualizar Sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git htop tmux
```

### 1.3 Instalar Docker

```bash
# Instalador oficial de Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar usuario actual al grupo docker
sudo usermod -aG docker $USER
newgrp docker

# Verificar
docker --version
docker compose --version
```

### 1.4 Configurar Firewall

```bash
# Habilitar firewall
sudo ufw enable

# Permitir SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Verificar
sudo ufw status
```

---

## 📁 Paso 2: Clonar Repositorio

```bash
# Crear directorio de aplicación
mkdir -p /opt/emerald
cd /opt/emerald

# Clonar repo
git clone https://github.com/LukeSkywalker66/Emerald-ERP.git .

# Verificar
ls -la
```

---

## 🔧 Paso 3: Configurar Ambiente

### 3.1 Crear archivo .env de Producción

```bash
cat > .env << 'EOF'
# === DATABASE ===
POSTGRES_USER=emerald_prod
POSTGRES_PASSWORD=$(openssl rand -base64 32)  # Generar contraseña aleatoria
POSTGRES_DB=emerald

# === BACKEND ===
API_KEY=$(openssl rand -base64 32)           # API Key fuerte
ENVIRONMENT=production

# === MIKROTIK ===
MK_HOST=192.168.1.100                        # Tu router Mikrotik
MK_PORT=8728                                  # Puerto API
MK_USER=admin
MK_PASS=tu_contraseña_mikrotik
MK_ENABLE_SSL=false                           # Cambiar a true si usas 8729

# === ISPCUBE ===
ISPCUBE_API_URL=http://192.168.1.50:8080    # URL de ISPCube
ISPCUBE_API_KEY=tu_api_key_ispcube

# === SMARTOLT ===
SMARTOLT_API_URL=http://192.168.2.50:8080
SMARTOLT_API_KEY=tu_api_key_smartolt
SMARTOLT_OLT_ID=OLT_001

# === FRONTEND ===
VITE_API_URL=/api
CHOKIDAR_USEPOLLING=true

# === BEHOLDER ===
BEHOLDER_API_URL=/api
BEHOLDER_API_KEY=

# === DOMINIO ===
DOMAIN=emerald.2finternet.ar
EOF
```

### 3.2 Verificar Credenciales

```bash
# NO commitear .env
echo ".env" >> .gitignore

# Verificar que .env tiene todas las variables críticas
grep -E "^[A-Z_]+=" .env | wc -l
# Deberías ver ~15 variables
```

---

## 🔐 Paso 4: Obtener Certificado SSL

### 4.1 Configurar DNS

Asegúrate que tu dominio apunte a la IP del servidor:

```bash
# Verificar DNS
nslookup emerald.2finternet.ar
# Debe mostrar la IP de tu servidor
```

### 4.2 Generar Certificado

```bash
# Levantar solo Nginx y Certbot
docker compose up -d nginx certbot

# Esperar a que estén listos
sleep 5

# Generar certificado (primera vez)
docker compose exec certbot certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d emerald.2finternet.ar \
  -d www.emerald.2finternet.ar \
  --non-interactive \
  --agree-tos \
  --email admin@tu_email.com

# Verificar
docker compose exec certbot certbot certificates
```

---

## 🗄️ Paso 5: Levantar Base de Datos

```bash
# Levantar PostgreSQL
docker compose up -d db

# Esperar a que esté listo (healthcheck)
docker compose ps db

# Verificar conexión
docker compose exec db pg_isready -U emerald_prod
```

---

## 🚀 Paso 6: Levantar Backend

```bash
# Construir imagen de backend
docker compose build backend

# Levantar backend
docker compose up -d backend

# Ver logs
docker compose logs -f backend

# Esperar a que aplique migraciones (ver "Application startup complete")
# Presionar Ctrl+C cuando esté listo
```

---

## 💻 Paso 7: Levantar Frontend

```bash
# Construir frontend
docker compose build frontend

# Levantar frontend
docker compose up -d frontend

# Ver logs
docker compose logs -f frontend

# Esperar a compilación (ver "ready in X ms")
```

---

## 👁️ Paso 8: Levantar Beholder

```bash
# Construir Beholder
docker compose build beholder

# Levantar
docker compose up -d beholder

# Ver logs
docker compose logs -f beholder
```

---

## ⚙️ Paso 9: Levantar Celery + Redis

```bash
# Redis
docker compose up -d redis

# Celery Worker
docker compose build celery_worker
docker compose up -d celery_worker

# Ver logs
docker compose logs -f celery_worker | grep -i "ready\|error"
```

---

## ✅ Paso 10: Verificar Deployment

### 10.1 Health Checks

```bash
# API Health
curl -s https://emerald.2finternet.ar/api/health | jq .

# Frontend (debe responder HTML)
curl -s https://emerald.2finternet.ar/ | head -20

# Beholder
curl -s https://emerald.2finternet.ar/beholder | head -20
```

### 10.2 Ver Todos los Servicios

```bash
docker compose ps

# Esperado: Todos deben estar "Up"
```

### 10.3 Test de Acceso

```bash
# Desde tu computadora local:
open https://emerald.2finternet.ar
# Deberías ver el frontend

# API con cURL
curl -X GET "https://emerald.2finternet.ar/api/health"
```

---

## 📊 Paso 11: Configurar Monitoreo y Backups

### 11.1 Backup Automático de Base de Datos

```bash
cat > /opt/emerald/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/emerald/backups"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker compose exec -T db pg_dump \
  -U emerald_prod emerald \
  | gzip > $BACKUP_DIR/emerald_$TIMESTAMP.sql.gz

# Mantener últimos 30 días
find $BACKUP_DIR -mtime +30 -delete

echo "Backup completado: $BACKUP_DIR/emerald_$TIMESTAMP.sql.gz"
EOF

chmod +x /opt/emerald/backup.sh

# Cron para backup diario a las 2 AM
crontab -e
# Agregar:
# 0 2 * * * /opt/emerald/backup.sh
```

### 11.2 Monitoreo de Logs

```bash
# Ver últimos errores
docker compose logs --tail=50 backend | grep ERROR

# Monitoreo en tiempo real
watch -n 5 'docker compose logs --tail=20 backend'
```

---

## 🔄 Paso 12: Actualizar Código en Producción

Cuando haces cambios en `develop`:

```bash
# Pull últimos cambios
cd /opt/emerald
git pull origin develop

# Rebuild servicios modificados
docker compose build backend frontend celery_worker

# Restart servicios
docker compose up -d backend frontend celery_worker

# Verificar logs
docker compose logs -f backend
```

---

## 🆘 Troubleshooting

### Certificado SSL no obtiene

```bash
# Verificar DNS
nslookup emerald.2finternet.ar
# Debe apuntar a tu IP

# Ver logs de Certbot
docker compose logs certbot

# Reintentar
docker compose exec certbot certbot certonly --force-renewal
```

### Backend no conecta a PostgreSQL

```bash
# Verificar que DB está healthy
docker compose exec db pg_isready -U emerald_prod

# Ver logs de DB
docker compose logs db

# Reiniciar
docker compose restart db backend
```

### API lenta

```bash
# Ver consumo de recursos
docker stats

# Ver consultas SQL lentas
docker compose exec db psql -U emerald_prod -d emerald -c \
  "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Disco lleno

```bash
# Ver uso de disco
df -h

# Limpiar imágenes viejas
docker image prune -a

# Limpiar volúmenes no usados
docker volume prune

# Ver tamaño de base de datos
docker compose exec db du -sh /var/lib/postgresql/data
```

---

## 📈 Scaling (Futuro)

### Multi-Worker Celery

```yaml
# docker compose.yml
celery_worker_1:
  build: ./backend
  command: celery -A src.celery_app worker -l info --concurrency=4
  
celery_worker_2:
  build: ./backend
  command: celery -A src.celery_app worker -l info --concurrency=4
```

### Load Balancer

```bash
# Con HAProxy o AWS ALB
# Para distribuir carga entre múltiples instancias de backend
```

### Caché Redis

```python
# En src/services/diagnosis.py
import redis

cache = redis.Redis(host='redis', port=6379, db=0)

@cache_result(ttl=300)  # Cache 5 minutos
def consultar_diagnostico(pppoe_user):
    ...
```

---

## 🔒 Seguridad - Checklist Final

- [ ] Certificado SSL válido y renovando automáticamente
- [ ] API Key configurada y fuerte
- [ ] Contraseña PostgreSQL cambiadade default
- [ ] Backups automáticos funcionando
- [ ] Firewall habilitado (solo 22, 80, 443)
- [ ] Logs monitoreados (alertas en errores)
- [ ] Credenciales Mikrotik no expuestas
- [ ] SSH key-based auth (no password)
- [ ] Fail2ban instalado (protección contra brute force)
- [ ] Rate limiting en Nginx activado

---

## 📞 Soporte y Mantenimiento

### Diarios
- Revisar logs: `docker compose logs | grep ERROR`

### Semanales
- Verificar espacio en disco: `df -h`
- Ver health de servicios: `docker compose ps`

### Mensuales
- Revisar certificado SSL: `docker compose exec certbot certbot certificates`
- Backup manual adicional
- Update de dependencias: `docker compose pull`

### Anuales
- Cambiar credenciales (PostgreSQL, API Keys)
- Revisar y actualizar politicas de seguridad

---

**Última actualización:** 30 de diciembre de 2025  
**Versión:** 1.0.0
