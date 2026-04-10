# Guia API para Agente IA (Emerald - Solo Datos Locales)

Fecha: 24 Marzo 2026
Scope: Esta guia cubre solo endpoints que trabajan con datos en la base local de Emerald (PostgreSQL).
No incluye consultas externas a ISPCube.

---

## 1) Objetivo

Esta guia sirve para que un agente IA externo consuma Emerald de forma robusta y predecible para:

- Buscar clientes en la base local.
- Buscar conexiones locales (PPPoE, direccion, DNI).
- Consultar tickets relacionados a una conexion.
- Usar autenticacion correcta para endpoints protegidos.

---

## 2) Base URL y versionado

Base URL (produccion con Nginx):
- https://emerald.2finternet.ar/api

Base URL (local/dev tipico):
- http://localhost:8500/api

Nota:
- En el backend, algunos routers ya incluyen prefijo en su definicion.
- El resultado final para cliente suele empezar por /api/...

---

## 3) Autenticacion para el agente

Hay dos estrategias disponibles:

### A. API Key (recomendada para agente servicio-a-servicio)

Header:
- x-api-key: <AGENT_API_KEY>

Ventajas:
- Simpler para integraciones automatas.
- Evita manejar ciclo de refresh JWT.

### B. JWT (login de usuario dedicado)

Login:
- POST /api/v1/auth/login
- Content-Type: application/x-www-form-urlencoded
- Campos: username, password

Luego usar:
- Authorization: Bearer <access_token>

---

## 4) Recomendacion de identidad del agente (NIVEL NASA)

Si, conviene crear una identidad dedicada para el agente.

Modelo recomendado:
1. Crear un usuario tecnico de integracion (ej: ai_agent_reader@...)
2. Asignar rol minimo necesario (principio de menor privilegio)
3. Emitir API Key dedicada para ese agente
4. Guardar credenciales en vault/secrets manager (no hardcode en codigo)
5. Rotar key periodicamente

Importante:
- No usar cuentas personales humanas para automatizaciones.
- No reutilizar API keys de otros sistemas.

---

## 5) Endpoints locales utiles (cliente/conexion/direccion/plan)

## 5.1 Busqueda local de clientes y conexiones (global)

Endpoint:
- GET /api/v2/search

Archivo backend:
- backend/src/routers/search.py

Query params:
- q (required, min 2): termino de busqueda
- limit (optional, default 10, max 50)

Busca en DB local (tabla connections + clientes) por:
- nombre cliente
- DNI
- PPPoE username
- direccion

Campos de respuesta:
- connection_id
- client_name
- client_dni
- pppoe_username
- installation_address

Observacion:
- Este endpoint es local DB, no consulta ISPCube.

---

## 5.2 Busqueda de conexiones para wizard de tickets (forzar local)

Endpoint:
- GET /api/v2/tickets/search-connections

Archivo backend:
- backend/src/routers/tickets.py

Query params:
- query (required)
- limit (optional, default 20)
- source (optional): usar source=local para bloquear fallback externo

Uso recomendado para agente:
- source=local

Respuesta (cuando hay datos locales):
- connection_id
- pppoe_username
- installation_address
- client_name
- client_id
- client_dni
- plan_name (actualmente llega como "N/A" en este endpoint)
- node_name (actualmente llega como "N/A")
- status

Importante:
- Si source=mixed y no hay resultados locales, puede intentar fallback externo.
- Para este documento, usar siempre source=local.

---

## 5.3 Tickets por conexion local

Endpoint:
- GET /api/v2/tickets/by-connection/{connection_id}

Archivo backend:
- backend/src/routers/tickets.py

Uso:
- Recuperar historial operativo de una conexion especifica en datos Emerald.

---

## 5.4 Detalle de ticket (incluye datos de contacto/conexion del ticket)

Endpoint:
- GET /api/v2/tickets/{ticket_id}

Archivo backend:
- backend/src/routers/tickets.py

Uso:
- Obtener detalle consolidado para contexto del agente (estado, timeline, work orders, contact_info).

---

## 6) Sobre direccion y plan (estado actual)

Direccion:
- Disponible en endpoints locales de busqueda como installation_address.

Plan:
- En los endpoints locales publicos anteriores no hay endpoint dedicado de plan detallado para conexion.
- En /api/v2/tickets/search-connections el campo plan_name actualmente es "N/A".

Conclusion operativa:
- Para el agente (hoy), direccion si; plan detallado no confiable via endpoint local publico actual.

---

## 7) Ejemplos de llamada (solo local)

1) Busqueda global local:
GET /api/v2/search?q=garcia&limit=20

2) Busqueda conexiones local-only para tickets:
GET /api/v2/tickets/search-connections?query=garcia&limit=20&source=local

3) Tickets de una conexion:
GET /api/v2/tickets/by-connection/12345

---

## 8) Headers recomendados del agente

Siempre enviar:
- Accept: application/json
- Content-Type: application/json (cuando aplique)
- x-api-key: <AGENT_API_KEY> (si usas API key)

Opcional:
- X-Request-ID: <uuid> para trazabilidad distribuida

---

## 9) Errores comunes

401 Unauthorized:
- Falta x-api-key o Bearer token en endpoints protegidos.

404 en busquedas:
- No hay coincidencias locales con ese termino.

Resultados vacios en search-connections:
- Revisar que source=local y que existan datos en connections/clientes.

---

## 10) Proximas mejoras recomendadas para agente

1. Exponer endpoint local de detalle de conexion con plan_id/plan_name real.
2. Exponer endpoint local de catalogo de planes (si aplica al negocio).
3. Definir contrato de respuesta estable para uso por agentes (schema versionado).
4. Agregar pruebas contractuales API para integraciones IA.

---

## 11) Referencias de codigo

- backend/src/routers/search.py
- backend/src/routers/tickets.py
- frontend/src/services/tickets.service.js
- backend/src/main.py
