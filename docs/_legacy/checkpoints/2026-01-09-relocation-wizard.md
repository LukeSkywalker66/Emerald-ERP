# Checkpoint - 2026-01-09

## Estado actual
- Rama activa: `develop` (push recientes: refresh tokens, wizard de traslado, notas OT descriptivas, fix de diálogo de cierre de OT).
- Cambios clave: búsqueda de conexiones ahora acepta `source`; backend prioriza DB local para `/v2/tickets/search-connections`; wizard de traslado permite dirección manual y usa `source=local`.
- Tickets/traslado: se puede crear traslado sin `destination_connection_id` si se informa dirección en `availability_note`.
- OTs: notas y timeline más descriptivas para traslados/instalaciones/retiros; cierre de OT reestilizado con `DialogContent` (UI restablecida).

## Archivos modificados (última sesión)
- backend/src/routers/tickets.py
- frontend/src/services/tickets.service.js
- frontend/src/components/tickets/wizards/RelocationWizard.jsx

## Validaciones pendientes
- Confirmar en ambiente desplegado que `/v2/tickets/search-connections` recibe `source=local` (no mixto) y responde con datos de la DB local.
- Revisar un caso real: consultar `usuarioprueba` en DB local (tabla `connections` + `clientes`) para validar nombre/dirección.
- Aún pendiente: revisar respuesta backend login/refresh (ver TODO list).

## Cómo reproducir/chequear
1) Frontend: abrir wizard de traslado, buscar cliente. Debería ir a `/v2/tickets/search-connections?query=...&source=local`.
2) Backend/API: hacer GET manual al endpoint anterior y ver `client_name`, `client_dni`, `installation_address`.
3) SQL sugerido:
```
SELECT c.connection_id, c.pppoe_username, c.direccion, cl.id AS cliente_id, cl.name, cl.doc_number
FROM connections c
LEFT JOIN clientes cl ON c.customer_id = cl.id
WHERE c.pppoe_username ILIKE '%usuarioprueba%';
```

## Riesgos/Notas
- Si el backend desplegado aún no tiene el cambio, la búsqueda seguirá en modo mixto (ISPCube + DB) y puede traer datos “raros”.
- availability_note ahora puede contener la dirección manual, ya que se usa para validar cuando no hay `destination_connection_id`.

## Próximos pasos sugeridos
- Verificar datos reales para `usuarioprueba` y ajustar registro en DB si está incorrecto.
- Si se necesita fallback a ISPCube en otros flujos, usar `searchConnections(query, { source: 'mixed' })` desde frontend.
- Completar chequeo de login/refresh backend (pendiente en TODO).
  
