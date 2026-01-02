import React from 'react';
import { EmeraldLogo } from './EmeraldLogo';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center">
      {/* Efecto de resplandor radial */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1)_0%,transparent_70%)]"></div>
      
      {/* Logo animado */}
      <div className="relative z-10">
        <EmeraldLogo className="scale-150 animate-pulse-slow" withText={true} />
      </div>

      {/* Texto de estado */}
      <div className="mt-12 text-center space-y-3">
        <p className="text-emerald-500/80 text-sm font-medium tracking-wide animate-pulse">
          Consultando al Orquestador...
        </p>
        
        {/* Barra de progreso simulada */}
        <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 animate-[loading_1.5s_ease-in-out_infinite]"></div>
        </div>
      </div>

      {/* Versión del sistema */}
      <div className="absolute bottom-8 text-xs text-zinc-600 font-mono">
        v2.0.0-alpha | Core Build 2025.01
      </div>
    </div>
  );
}
