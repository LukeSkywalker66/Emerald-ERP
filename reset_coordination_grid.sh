#!/bin/bash
# Reset Coordination Grid para testing
# Revierte todas las OTs a estado pending_planning (sin asignaciones)

docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "
UPDATE work_orders
SET 
  status = 'pending_planning',
  team_id = NULL,
  scheduled_start = NULL,
  scheduled_end = NULL,
  updated_at = NOW()
WHERE id IN (51, 52, 53, 54, 55);
"

echo "✅ Grilla de coordinación limpiada"
echo "   OTs 51-55 están en estado pending_planning sin asignaciones"
