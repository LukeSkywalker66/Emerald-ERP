import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';

/**
 * PendingClosureAlert
 * 
 * Componente de Alerta Global para "Equipos Bloqueados" (Coordinación)
 * Muestra estadísticas de OTs vencidas que bloquean agendas de técnicos.
 * @param {object} stats - { total_pending_closure, team_breakdown: [], oldest_orders: [] }
 * @param {boolean} isLoading - Estado de carga
 * @param {string|null} error - Mensaje de error si falla el fetch
 * @param {function} onRefresh - Callback para recargar stats
 */
export function PendingClosureAlert({ stats, isLoading, error, onRefresh, onSelectWorkOrder }) {
  // Filtrar OTs bloqueadas por team_id
  const getBlockedOTsForTeam = (teamId) => {
    if (!stats?.oldest_orders) return [];
    return stats.oldest_orders.filter((wo) => wo.team_id === teamId);
  };

  // Abrir OT en sidebar
  const handleSelectOT = (workOrder) => {
    if (typeof onSelectWorkOrder === 'function') {
      onSelectWorkOrder(workOrder);
    } else {
      console.error('❌ [ARQUITECTURA] PendingClosureAlert.handleSelectOT: callback onSelectWorkOrder no existe.');
    }
  };

  // No renderizar nada si no hay OTs pendientes (sin "ruido")
  if (!isLoading && !error && (!stats || stats.total_pending_closure === 0)) {
    return null;
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={undefined}
      className="border border-rose-500/30 bg-rose-950/20 rounded-lg mb-4"
    >
      <AccordionItem value="pending-closure" className="border-none">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-rose-950/40">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
              <div className="text-left">
                <p className="text-sm font-semibold text-rose-100">
                  🔒 Equipos Bloqueados
                </p>
                {isLoading ? (
                  <p className="text-xs text-rose-200/80">Cargando...</p>
                ) : error ? (
                  <p className="text-xs text-rose-300">Error al cargar</p>
                ) : (
                  <p className="text-xs text-rose-200/80">
                    {stats?.total_pending_closure || 0} OTs vencidas ·{' '}
                    {stats?.blocked_teams_count || 0} equipos bloqueados
                  </p>
                )}
              </div>
            </div>
            {stats && stats.total_pending_closure > 0 && (
              <Badge
                variant="outline"
                className="border-rose-400/50 text-rose-200 bg-rose-900/50 ml-2"
              >
                {stats.total_pending_closure}
              </Badge>
            )}
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-4 pb-4 pt-2">
          {error ? (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {error}
              </AlertDescription>
            </Alert>
          ) : stats && stats.total_pending_closure > 0 ? (
            <>
              <div className="space-y-3 mb-3">
                {stats.team_breakdown.map((team) => {
                  const blockedOTs = getBlockedOTsForTeam(team.team_id);
                  return (
                    <div
                      key={`${team.team_id}-${team.team_name || 'equipo'}`}
                      className="px-3 py-3 bg-zinc-900/60 border border-zinc-700/50 rounded"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-amber-300">
                          {team.team_name || `Equipo #${team.team_id}`}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-rose-500/50 text-rose-300 bg-rose-900/30"
                        >
                          {team.pending_count} OT{team.pending_count > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {blockedOTs.length > 0 && (
                        <div className="space-y-1">
                          {blockedOTs.map((wo) => (
                            <div
                              key={wo.id}
                              className="flex items-center justify-between px-2 py-1.5 bg-zinc-800/40 hover:bg-zinc-800/60 rounded border border-zinc-700/30 cursor-pointer transition-colors"
                              onClick={() => handleSelectOT(wo)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-semibold text-cyan-300">
                                  OT #{wo.id}
                                </span>
                                <span className="text-xs text-zinc-400 truncate">
                                  {wo.ticket_title || 'Sin descripción'}
                                </span>
                              </div>
                              <ExternalLink className="h-3 w-3 text-zinc-500 flex-shrink-0 ml-2" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Los técnicos deben completar estas OTs para desbloquear su agenda
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="h-7 px-2 text-xs"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-500 text-center py-2">
              ✅ No hay equipos bloqueados actualmente
            </p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
