# ADR-003: Implementación de Tareas en Segundo Plano (Async Jobs)

* **Estado:** Aceptado
* **Fecha:** 2025-12-30
* **Autores:** Lucas (Dev), Gemini (AI Partner)

## Contexto
El sistema Emerald ERP necesita sincronizar grandes volúmenes de datos desde múltiples fuentes externas (ISPCube, Mikrotiks, SmartOLT) diariamente.
Inicialmente, esto se podía resolver con un script secuencial ejecutado manualmente o vía Cron del sistema operativo host.
Sin embargo, esto presenta problemas:
1. **Bloqueo:** Si se dispara desde la API, bloquea el hilo principal, dejando la UI congelada.
2. **Portabilidad:** Depender del Cron del Host (Linux) rompe la filosofía de "Docker autocontenido".
3. **Escalabilidad:** Procesar cientos de nodos router en serie tarda demasiado.

## Decisión
Se decide implementar una arquitectura de **Cola de Tareas Distribuidas** utilizando:
* **Celery:** Como gestor de tareas (Workers) y planificador (Beat).
* **Redis:** Como Broker de mensajería (cola) y backend de resultados.

La estructura elegida separa la aplicación en dos servicios Docker:
1.  `backend`: Atiende peticiones HTTP (FastAPI).
2.  `celery_worker`: Ejecuta procesos pesados en background.

## Consecuencias
### Positivas
* **Desacoplamiento:** La sincronización no afecta el rendimiento de la API.
* **Resiliencia:** Celery permite reintentos automáticos (retries) si falla una conexión externa.
* **Portabilidad:** Todo el stack (incluido el cronograma) está definido en `docker-compose.yml`. Funciona en cualquier servidor con Docker.
* **Observabilidad:** Se pueden monitorear las tareas en tiempo real.

### Negativas
* **Complejidad:** Se agregan dos contenedores nuevos (`redis` y `worker`) al stack.
* **Recursos:** Mayor consumo de RAM basal por los servicios adicionales.

## Implementación Técnica
* Los scripts de trabajo se ubican en `src/jobs/`.
* La configuración del cronograma está en `src/celery_app.py`.
* La seguridad de Redis se gestiona mediante binding a `127.0.0.1` y red interna de Docker.