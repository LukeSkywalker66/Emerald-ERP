import React from 'react';
import { Map, Calendar } from 'lucide-react';

export default function CoordinationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
          <Map className="text-amber-400" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Coordinación</h1>
          <p className="text-sm text-zinc-400">
            Mapa de técnicos y agenda de órdenes.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-6 shadow-2xl shadow-black/30">
        <div className="flex items-start gap-4">
          <Calendar size={24} className="text-amber-400 mt-1 flex-shrink-0" />
          <div>
            <p className="text-zinc-300 mb-2">
              Próximamente: vista de mapa con técnicos en tiempo real y calendario de visitas programadas.
            </p>
            <p className="text-sm text-zinc-500">
              Integración con Google Maps API + Beholder Live Location.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
