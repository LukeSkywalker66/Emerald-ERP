# Resolución dinámica de upstreams en Nginx (fix del 502 tras deploys)

## Problema

Tras un deploy que recrea contenedores, Docker les asigna **IPs nuevas** en la red
`emerald_gateway`. Nginx, con un `proxy_pass` estático como:

```nginx
proxy_pass http://emerald_nginx:80;
```

resuelve el hostname a IP **una sola vez al cargar la configuración**. Si el
contenedor de destino cambia de IP después, nginx sigue apuntando a la IP vieja y
devuelve **502**, hasta que se reinicia el contenedor de nginx.

## Solución

Apuntar `proxy_pass` a una **variable** y declarar un `resolver` apuntando al DNS
de Docker (`127.0.0.11`). Con esto nginx re-resuelve el hostname cada `valid`
segundos y levanta la IP nueva **sin reiniciar nada**.

## Cambio ya aplicado en este repo

[`nginx/default.conf`](nginx/default.conf:1) (nginx interno de cada stack) ya
resuelve `frontend`, `beholder` y `backend` dinámicamente:

```nginx
resolver 127.0.0.11 valid=10s ipv6=off;
set $frontend_upstream http://frontend:80;
set $beholder_upstream http://beholder:5173;
set $backend_upstream  http://backend:8500;

location / { proxy_pass $frontend_upstream; ... }
```

## Cambio pendiente en el Proxy Global (`/opt/emerald-proxy`)

El 502 reportado se originó en el **proxy global**, que apunta a
`emerald_nginx`, `emerald_nginx_staging` y `emerald_nginx_dev`. Aplicar el mismo
patrón en `/opt/emerald-proxy/nginx/default.conf`:

1. Agregar el resolver en el bloque `http` (una sola vez):

```nginx
http {
    resolver 127.0.0.11 valid=10s ipv6=off;
    # ... resto ...
}
```

2. Reemplazar cada `proxy_pass` estático por variable. Ejemplo por entorno:

```nginx
# Producción
server {
    listen 443 ssl;
    server_name emerald.2finternet.ar;

    set $emerald_prod http://emerald_nginx:80;

    location / {
        proxy_pass $emerald_prod;
        # ... headers ...
    }
}

# Staging
server {
    listen 443 ssl;
    server_name emerald-test.2finternet.ar;

    set $emerald_staging http://emerald_nginx_staging:80;

    location / {
        proxy_pass $emerald_staging;
        # ... headers ...
    }
}

# Desarrollo
server {
    listen 443 ssl;
    server_name emerald-dev.2finternet.ar;

    set $emerald_dev http://emerald_nginx_dev:80;

    location / {
        proxy_pass $emerald_dev;
        # ... headers ...
    }
}
```

3. Recargar sin downtime:

```bash
docker exec emerald_global_proxy nginx -t
docker exec emerald_global_proxy nginx -s reload
```

## Notas

- La directiva `set` debe ir dentro del `server` (o `location`) correspondiente,
  no en `http`.
- Con variables en `proxy_pass`, nginx pasa la URI original tal cual; si el proxy
  global agrega un path específico en el `proxy_pass` (ej. `/monitor/`), hay que
  revisar que la URI siga coincidiendo con lo que espera el backend.
- Después de esto, el reinicio del proxy tras un deploy deja de ser necesario.
