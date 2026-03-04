# Installation Testing Rollback Script

Script interactivo para eliminar tickets de instalación y sus conexiones asociadas después de pruebas.

## Uso

```bash
./scripts/rollback_installation_test.sh
```

## Funcionalidad

El script permite:

1. **Listar** los últimos 5 tickets de instalación creados
2. **Eliminar el último ticket** automáticamente
3. **Eliminar un ticket específico** ingresando su ID
4. **Rollback completo**: Elimina:
   - El ticket
   - Todos los eventos de timeline asociados
   - Todos los eventos del ticket (ticket_events)
   - Todos los attachments
   - Todos los tags
   - La conexión asociada (si existe)

## Ventajas

- ✅ **No afecta ISPCube**: Solo elimina datos de Emerald
- ✅ **Transaccional**: Todo se elimina en una transacción (all-or-nothing)
- ✅ **Interactivo**: Muestra qué va a eliminar y pide confirmación
- ✅ **Respeta integridad**: Sigue el orden correcto de eliminación (FKs)
- ✅ **Reutilizable**: Puedes correr múltiples tests sin contaminar la BD

## Ejemplo de uso

```bash
$ ./scripts/rollback_installation_test.sh

========================================
Installation Testing - Rollback Script
========================================

📋 Últimos 5 tickets de instalación:

 1.  73 | [Intermitencia/Microcortes] - USUARIO PRUEBA | open       | (null) | 2026-02-27 14:42:03.702041
 2.  72 | OT PRUEBA - Drag & Drop Test                  | open       | (null) | 2026-02-19 15:48:59.37825
 
Opciones:
  1. Eliminar el ÚLTIMO ticket de instalación
  2. Ingresar ID específico
  3. Salir

Selecciona opción (1-3): 1

🔍 Obteniendo detalles...

Datos a eliminar:
  • Ticket ID: 73
  • Connection ID: 17352

Registros asociados a eliminar:
  • Timeline events: 4
  • Connection row: 1

¿Confirmar eliminación? (s/n): s

🗑️  Eliminando...
BEGIN
DELETE 4
DELETE 0
DELETE 0
DELETE 0
DELETE 1
DELETE 1
COMMIT

✅ Rollback completado exitosamente

Resumen de cambios:
  ✓ Ticket 73 eliminado
  ✓ Conexión 17352 eliminada
```

## Requisitos

- Docker corriendo (necesita conectar a `emerald_db`)
- Bash 4+
- Permisos de lectura/ejecución en el script

## Variables de entorno (opcionales)

Si tu BD está configurada diferente, puedes sobreescribir:

```bash
POSTGRES_USER=custom_user \
POSTGRES_PASSWORD=custom_pass \
POSTGRES_DB=custom_db \
POSTGRES_HOST=custom_host \
./scripts/rollback_installation_test.sh
```

Por defecto usa valores de `.env`.

## GitHub CI/CD

Si en el futuro necesitas correr esto desde GitHub Actions u otro CI, el script es amenco:

```bash
./scripts/rollback_installation_test.sh << EOF
2
${TICKET_ID_TO_DELETE}
EOF
```

(Responde opción 2 e ingresa el ID automáticamente)
