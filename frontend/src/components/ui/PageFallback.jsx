import React from 'react';

/**
 * PageFallback — loader minimalista para transiciones de ruta (React.lazy).
 * Estética "Emerald City Cyberpunk": fondo oscuro + acento esmeralda.
 */
export default function PageFallback() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center bg-zinc-950">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin" />
      </div>
      <p className="mt-4 text-xs font-medium tracking-wide text-emerald-500/70 uppercase animate-pulse">
        Cargando…
      </p>
    </div>
  );
}
