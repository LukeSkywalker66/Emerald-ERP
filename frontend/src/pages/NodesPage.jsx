import React from 'react';
import { TowerControl, Activity } from 'lucide-react';

export default function NodesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
          <TowerControl className="text-purple-400" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Nodos</h1>
          <p className="text-sm text-zinc-400">
            Infraestructura y estado de PON.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-6 shadow-2xl shadow-black/30">
        <div className="flex items-start gap-4">
          <Activity size={24} className="text-purple-400 mt-1 flex-shrink-0" />
          <div>
            <p className="text-zinc-300 mb-2">
              Próximamente: mapa de nodos con estado de uptime, carga y alertas.
            </p>
            <p className="text-sm text-zinc-500">
              Métricas de red troncal y capacidad disponible.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
