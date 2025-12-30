# ADR-001: Implementación de SSL/TLS con Let's Encrypt

- **Estado:** ✅ Aceptado
- **Fecha:** 2025-12-15 (Implementación) / 2025-12-30 (Documentación)
- **Autores:** Lucas (Dev), Equipo Emerald

---

## Problema

El sistema Emerald ERP opera en internet público y maneja datos sensibles de clientes (credenciales ISP, información de suscriptores).

### Requisitos de Seguridad

1. **Confidencialidad:** Encripción de datos en tránsito
2. **Autenticidad:** Verificación de identidad del servidor
3. **Escalabilidad:** Renovación automática de certificados
4. **Disponibilidad:** Cero downtime en renovaciones

### Opciones Evaluadas

| Opción | Pros | Contras | Costo |
|--------|------|---------|-------|
| Let's Encrypt + Certbot | Automático, gratuito, confiable | Renovación cada 90 días | $0 |
| Certificado Pagado (Comodo, DigiCert) | Validación adicional, soporte | Manual, caro | $20-300/año |
| Self-signed | Bajo overhead | Navegadores advierten, no confiable | $0 |
| AWS ACM | Integrado con AWS, gratuito | Vendor lock-in | $0 |

---

## Decisión

**✅ Let's Encrypt + Certbot + Nginx + Docker Compose**

### Fundamentos

1. **Let's Encrypt es estándar de facto:**
   - Usado por +70% de sitios HTTPS globales
   - Trusted en todos los navegadores modernos
   - Renovación automática gratuita

2. **Certbot es el cliente oficial:**
   - Mantenido por Electronic Frontier Foundation (EFF)
   - Integración nativa con Nginx
   - Webroot plugin para validaciones

3. **Docker asegura portabilidad:**
   - Toda la configuración está versionada
   - Funciona igual en dev, staging, prod
   - No depende de cron del host

4. **Nginx como reverse proxy:**
   - Termina TLS de forma centralizada
   - Backend habla solo HTTP internamente
   - Fácil de monitorear y debuggear

---

## Implementación Técnica

### Arquitectura

```
Internet
   ↓ (HTTPS/443)
Nginx + Certbot
   ↓ (HTTP/5000)
FastAPI Backend
   ↓
PostgreSQL
```

### Archivos Involucrados

```
docker-compose.yml
├── certbot: Renueva certificados cada 12h
├── nginx: Termina TLS, proxy a backend
└── backend: Escucha solo en localhost:5000

data/certbot/
├── conf/
│   ├── live/emerald.2finternet.ar/
│   │   ├── privkey.pem      (Clave privada - SECRETO)
│   │   ├── cert.pem          (Certificado público)
│   │   ├── chain.pem         (Cadena de CA)
│   │   └── fullchain.pem     (Todo junto)
│   └── renewal/
│       └── emerald.2finternet.ar.conf
└── www/ (Validación ACME)
```

### Nginx Configuration

```nginx
# nginx/default.conf
server {
    listen 80;
    server_name emerald.2finternet.ar;
    
    # Redirigir HTTP → HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
    
    # Permitir validación ACME
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}

server {
    listen 443 ssl http2;
    server_name emerald.2finternet.ar;
    
    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/emerald.2finternet.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/emerald.2finternet.ar/privkey.pem;
    
    # Configuración moderna de seguridad
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # HSTS (Force HTTPS)
    add_header Strict-Transport-Security "max-age=31536000" always;
    
    # Proxy al backend
    location / {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Comando Certbot (Inicial)

```bash
# 1. Primera vez, obtener certificado
docker-compose exec certbot certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d emerald.2finternet.ar \
  -d www.emerald.2finternet.ar \
  --non-interactive \
  --agree-tos \
  --email admin@emerald.com

# 2. Renovar (automático con script)
# Cada 12 horas, el container ejecuta:
certbot renew --webroot -w /var/www/certbot
```

---

## Ventajas (Decisión Positiva)

✅ **Automatización:**
- Renovación automática cada 12 horas
- Cero downtime (validación ACME sin reinicio)
- Notificaciones por email si falla

✅ **Seguridad:**
- Encriptación moderna TLS 1.2/1.3
- Certificados válidos 90 días (auditoría frecuente)
- HSTS headers previenen downgrades

✅ **Costo:**
- Completamente gratuito
- Sin vendor lock-in
- Escalable a múltiples dominios

✅ **Confiabilidad:**
- >99% uptime de Let's Encrypt
- Millones de sitios dependen de esto
- Auditorías de seguridad públicas

✅ **Portabilidad:**
- Docker: Funciona en AWS, Azure, DigitalOcean, VPS local
- No depende de servicios cloud específicos
- Migraciones sin pain

---

## Desventajas (Aceptadas)

⚠️ **Renovación cada 90 días:**
- Requiere proceso ACME válido
- Mitigación: Certbot automático manejado por Docker

⚠️ **DNS debe estar configurado:**
- Certificado requiere que el dominio apunte al servidor
- Mitigación: Setup inicial de DNS es one-time

⚠️ **Certificados no incluyen validación de organización:**
- Domain Validation (DV) solamente, no EV
- Mitigación: Para ISP/pequeña empresa es suficiente

---

## Operaciones

### Verificar estado

```bash
# Ver certificados activos
docker-compose exec certbot certbot certificates

# Ver expiración
openssl x509 -in data/certbot/conf/live/emerald.2finternet.ar/cert.pem \
  -noout -dates
```

### Renovar manualmente

```bash
# Por si acaso la renovación automática falla
docker-compose exec certbot certbot renew --force-renewal
```

### Agregar subdomain

```bash
# Actualizar cert para nuevo dominio
docker-compose exec certbot certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d beholder.emerald.2finternet.ar \
  --non-interactive
```

### Monitoreo

```bash
# Ver logs de Certbot
docker-compose logs certbot

# Ver logs de renovación
docker-compose exec certbot certbot renew --dry-run
```

---

## Monitoreo de Certificados

### Alertas Recomendadas

```
- Si certificado expira en < 14 días: ⚠️ WARNING
- Si renovación falla 3 veces: 🔴 CRITICAL
- Renovación exitosa: ✅ LOG INFO
```

### Email de Let's Encrypt

Let's Encrypt envía emails automáticamente a `admin@emerald.com`:
- 20 días antes de expiración (reminder)
- Si falla renovación (action required)

---

## Migración desde Otra Solución

Si venías de certificado manual/pagado:

```bash
# 1. Detener servicios
docker-compose down

# 2. Respaldar certificados viejos
mv data/certbot data/certbot.backup

# 3. Crear directorio nuevo
mkdir -p data/certbot/www data/certbot/conf

# 4. Generar certificado Let's Encrypt
docker-compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d emerald.2finternet.ar \
  --agree-tos --email admin@emerald.com

# 5. Reiniciar
docker-compose up -d
```

---

## Alternativas Rechazadas y Por Qué

### ❌ Certificado Pagado (DigiCert, Comodo)

**Por qué NO:**
- Costo: $20-300 anual + renovaciones manuales
- Let's Encrypt es igual de confiable
- Renovación manual = riesgo de olvido

---

### ❌ AWS ACM

**Por qué NO:**
- Vendor lock-in: Solo funciona en AWS
- Nos queríamos mantener agnóstico de cloud
- Certbot funciona en cualquier servidor

---

### ❌ Self-signed

**Por qué NO:**
- Navegadores advierten "Conexión no segura"
- Beholder/Frontend rechazarían certificado
- No es confiable para usuarios finales

---

## Validación de Decisión

### Criterios de Éxito

- ✅ Certificados renovados automáticamente
- ✅ Cero downtime en renovaciones
- ✅ HTTPS forzado en todos los dominios
- ✅ HSTS headers presentes
- ✅ TLS 1.2+ obligatorio
- ✅ Logs limpios en renovación

### Monitoreo Continuo

```bash
# Script de healthcheck
#!/bin/bash
DOMAIN="emerald.2finternet.ar"
EXPIRY=$(openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | \
  openssl x509 -noout -dates | grep notAfter)
echo "Certificado expira: $EXPIRY"

# Alertar si < 14 días
DAYS_LEFT=$(( ($(date -d "$(echo $EXPIRY | cut -d= -f2)" +%s) - $(date +%s)) / 86400 ))
if [ $DAYS_LEFT -lt 14 ]; then
  echo "ALERT: Certificado expira en $DAYS_LEFT días"
fi
```

---

## Referencias

- Let's Encrypt: https://letsencrypt.org/
- Certbot: https://certbot.eff.org/
- ACME Protocol: https://tools.ietf.org/html/rfc8555
- Nginx SSL: https://nginx.org/en/docs/http/ngx_http_ssl_module.html
- HSTS: https://en.wikipedia.org/wiki/HTTP_Strict_Transport_Security

---

**Próximas decisiones (ADR):**
- ADR-002: *Por escribir* - Estrategia de backups automáticos
- ADR-003: ✅ Implementación de Background Jobs (Celery + Redis)
