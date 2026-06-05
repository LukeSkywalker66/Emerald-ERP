#!/bin/bash
# Wrapper para migrar_legacy_tickets.py
# Configura PYTHONPATH para que el script pueda importar src/
cd /app
PYTHONPATH=/app/src python /app/scripts/migrate_legacy_tickets.py "$@"
