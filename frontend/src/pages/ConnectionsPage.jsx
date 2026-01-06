import React from 'react';
import { Network, Database } from 'lucide-react';

export default function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
          <Network className="text-emerald-400" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Conexiones</h1>
          <p className="text-sm text-zinc-400">
            Base instalada sincronizada con ISPCube.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-6 shadow-2xl shadow-black/30">
        <div className="flex items-start gap-4">
          <Database size={24} className="text-emerald-400 mt-1 flex-shrink-0" />
          <div>
            <p className="text-zinc-300 mb-2">
              Próximamente: tabla de conexiones con estado técnico en tiempo real.
            </p>
            <p className="text-sm text-zinc-500">
              Integración con SmartOLT + Beholder para diagnóstico rápido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
