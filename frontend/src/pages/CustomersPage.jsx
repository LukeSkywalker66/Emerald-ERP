import React from 'react';
import { Users, DollarSign } from 'lucide-react';

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
          <Users className="text-cyan-400" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-sm text-zinc-400">
            Datos comerciales y facturación.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-6 shadow-2xl shadow-black/30">
        <div className="flex items-start gap-4">
          <DollarSign size={24} className="text-cyan-400 mt-1 flex-shrink-0" />
          <div>
            <p className="text-zinc-300 mb-2">
              Próximamente: base de clientes con historial de pagos y contratos.
            </p>
            <p className="text-sm text-zinc-500">
              Integración con sistema de facturación externo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
