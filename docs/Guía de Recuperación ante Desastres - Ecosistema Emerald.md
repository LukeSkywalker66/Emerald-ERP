# **Guía de Recuperación ante Desastres (Disaster Recovery Guide) \- Ecosistema Emerald**

Este documento contiene el protocolo absoluto para reconstruir e inicializar todo el ecosistema de servidores Emerald (Proxy Global, Entornos de Producción, Staging y Desarrollo) desde cero en un servidor nuevo (Debian/Ubuntu) ante un fallo catastrófico.

## **1\. Estrategia de Resiliencia 3-2-1**

Para garantizar la continuidad del negocio, la infraestructura se rige bajo la regla internacional de backups:

* **3 Copias de datos:** Datos vivos en producción, backup comprimido local en servidor, y copia externa de seguridad.  
* **2 Medios distintos:** Disco físico del servidor local y almacenamiento en la nube (Google Drive).  
* **1 Copia Offsite:** Copia fuera de las instalaciones físicas (Nube de Google) con opción de réplica en red local (LAN) aislada.

## **2\. Requisitos Previos en el Nuevo Servidor**

Antes de comenzar la reconstrucción, el nuevo sistema operativo debe contar con los siguientes paquetes y configuraciones esenciales:

`# 1. Actualizar el sistema operativo`  
`sudo apt update && sudo apt upgrade -y`

`# 2. Instalar Docker, Docker Compose, Git y Rclone`  
`sudo apt install docker.io docker-compose git rclone -y`

`# 3. Habilitar e iniciar los servicios esenciales`  
`sudo systemctl enable --now docker`

## **3\. Paso 1: Clonar e Inicializar el Proxy Global**

El Proxy Global actúa como el "Bouncer" de la infraestructura, gestionando el tráfico entrante y los certificados SSL de forma centralizada.

`cd /opt`  
`git clone git@github.com:LukeSkywalker66/emerald-proxy.git`  
`cd emerald-proxy`

Nota: Asegurarse de tener el archivo .gitignore configurado para no versionar carpetas temporales de certificados de manera pública:

`echo "certbot/" > .gitignore`

## **4\. Paso 2: Desafío ACME e Inicialización de Certificados SSL**

Con los DNS apuntando a la nueva IP del servidor, se ejecuta el comando de Certbot para validar la propiedad de los dominios mediante el método de verificación webroot por el puerto 80:

`docker exec emerald_global_certbot certbot certonly --webroot -w /var/www/certbot \`  
  `-d emerald.2finternet.ar \`  
  `-d emerald-test.2finternet.ar \`  
  `-d emerald-dev.2finternet.ar \`  
  `--email lucascaceres@gmail.com \`  
  `--agree-tos \`  
  `--no-eff-email`

Una vez obtenidos con éxito, se reinicia el proxy inverso para levantar el puerto 443 bajo HTTPS:

`docker compose restart proxy`

## **5\. Paso 3: Clonar los Entornos de la Aplicación**

Descargar las estructuras correspondientes a cada entorno dentro del directorio corporativo /opt/:

`# Entorno de Producción`  
`cd /opt && git clone git@github.com:LukeSkywalker66/emerald-erp.git emerald-erp`

`# Entorno de Staging`  
`cd /opt && git clone git@github.com:LukeSkywalker66/emerald-erp.git emerald-staging`

`# Entorno de Desarrollo`  
`cd /opt && git clone git@github.com:LukeSkywalker66/emerald-erp.git emerald-dev`

Configurar los respectivos archivos .env en cada directorio, asegurando envolver con comillas las variables complejas y evitando espacios libres antes o después del signo igual (=).

## **6\. Paso 4: Restauración Criptográfica de la Base de Datos**

Una vez descargado el archivo dump de respaldo (desde la nube o almacenamiento local), se procede a la inyección de datos de forma limpia utilizando tuberías (pipes) de Linux:

`cd /opt/emerald-erp`  
`source .env`

`# Comando definitivo de restauración`  
`cat /tmp/emerald_master_backup.dump | docker exec -i emerald_db pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists`

Repetir el procedimiento en los directorios emerald-staging y emerald-dev utilizando sus respectivas bases de datos para sincronizar los laboratorios de prueba.

## **7\. Paso 5: Automatización de Tareas (Cron-Engine)**

Para garantizar el funcionamiento desasistido del servidor, se importan las tareas cronificadas desde el repositorio de infraestructura:

`crontab /opt/emerald-proxy/backups/emerald-cron`

El archivo unificado de tareas automatiza dos procesos vitales con frecuencias diferenciadas:

| Frecuencia | Comando / Script | Propósito   |
| :---- | :---- | :---- |
| Todos los días a las 03:00 AM | /opt/emerald-proxy/backups/backup.sh | Generación de Dump de Producción, subida a nube y rotación de históricos. |
| Todos los domingos a las 04:00 AM | /usr/bin/docker system prune \-af \--volumes | Limpieza profunda de capas huérfanas de Docker para liberar espacio en disco. |

## **8\. Arquitectura "Cables Pelados" para Réplica en Red Local (LAN)**

Para mitigar la dependencia absoluta de una conexión activa a Internet o fallos en los servidores de Google, el script de backup incluye una sección preparada para transferir una copia extra a un nodo de almacenamiento físico secundario en la misma red LAN (ej. un NAS u otro servidor local) mediante SSH/SCP.  
Variables requeridas a incorporar en el archivo .env corporativo cuando la infraestructura local esté disponible:

`LAN_BACKUP_ENABLED=true`  
`LAN_SERVER_IP="138.59.172.50" # IP destino del almacenamiento local`  
`LAN_SERVER_USER="backup-user"`  
`LAN_DEST_FOLDER="/volume1/backups/emerald/"`  
