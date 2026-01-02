import React from 'react';
import { Box } from 'lucide-react';

export default function InventarioPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Box className="text-emerald-400" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Inventario</h1>
          <p className="text-sm text-zinc-400">Panel de equipos y stock. (Vista placeholder)</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-6 shadow-2xl shadow-black/30">
        <p className="text-zinc-400 text-sm">
          Próximamente: gestión de ONU, CPEs, routers y asignación a clientes. Mientras tanto, navegá con seguridad: el Orquestador está escuchando.
        </p>
      </div>
    </div>
  );
}
