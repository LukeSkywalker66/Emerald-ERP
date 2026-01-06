import React from 'react';
import { ClipboardList, Search } from 'lucide-react';

export default function WorkOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
          <ClipboardList className="text-blue-400" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Órdenes de Trabajo</h1>
          <p className="text-sm text-zinc-400">
            Ejecución técnica y seguimiento.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-6 shadow-2xl shadow-black/30">
        <div className="flex items-start gap-4">
          <Search size={24} className="text-blue-400 mt-1 flex-shrink-0" />
          <div>
            <p className="text-zinc-300 mb-2">
              Próximamente: lista de OT filtrable por estado, técnico asignado y tipo.
            </p>
            <p className="text-sm text-zinc-500">
              Integración con la vista de ejecución mobile ya implementada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
