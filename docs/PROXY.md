# 🚀 Emerald ERP - Requisitos de Infraestructura

## ⚠️ ATENCIÓN: Arquitectura de Red (Modo Ciego)
Esta aplicación está diseñada con una arquitectura de **"Proxy Global" (API Gateway)**. 
Los contenedores de Emerald **NO** exponen los puertos `80` o `443` hacia el exterior, ni manejan sus propios certificados SSL. Son "ciegos" a internet.

### ¿Por qué?
Para permitir que múltiples entornos (Producción, Staging, Desarrollo) convivan en el mismo servidor físico siendo **clones exactos**, sin generar conflictos de puertos y manejando el SSL de forma centralizada.

### Requisitos para migrar a un servidor nuevo:
Si movés este repositorio a un servidor desde cero, Emerald **NO va a salir a internet por sí solo**. Necesitás configurar un "Bouncer" o Proxy Reverso en el servidor anfitrión antes de encender Emerald.

**Pasos de instalación en un servidor nuevo:**
1. Crear una red global en Docker: `docker network create emerald_gateway`
2. Levantar un Nginx/Traefik independiente (El Proxy Global) conectado a esa red.
3. El Proxy Global debe tener los certificados SSL (Certbot) de los dominios y apuntar el tráfico hacia el contenedor interno `emerald_nginx` (o `emerald_nginx_staging` / `_dev` según el entorno) por el puerto 80 interno.
4. Levantar Emerald: `docker compose up -d`

La aplicación buscará automáticamente la red externa `emerald_gateway` para recibir el tráfico limpio.