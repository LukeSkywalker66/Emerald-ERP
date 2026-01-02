import { cn } from "@/lib/utils";

export const EmeraldLogo = ({ className, withText = true }) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Isotipo: The Emerald Core */}
      <svg
        width="36"
        height="36"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" // Efecto Glow (Resplandor)
      >
        {/* La Base (La Ciudad/Estructura) */}
        <path
          d="M50 5 L95 25 V75 L50 95 L5 75 V25 L50 5Z"
          className="stroke-emerald-600/50 fill-emerald-950/30"
          strokeWidth="2"
        />
        
        {/* Los Pilares (Art Deco / Barras de Señal) */}
        <path
          d="M35 35 V75 M50 25 V85 M65 35 V75"
          className="stroke-emerald-400"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* El Orquestador (El centro brillante) */}
        <circle cx="50" cy="55" r="6" className="fill-white animate-pulse" />
        
        {/* Rayos de conexión */}
        <path
          d="M20 50 L35 50 M65 50 L80 50"
          className="stroke-emerald-500/60"
          strokeWidth="2"
        />
      </svg>

      {/* Logotipo */}
      {withText && (
        <div className="flex flex-col select-none">
          <span className="font-bold text-xl tracking-tighter text-white leading-none font-sans">
            EMERALD
          </span>
          <span className="text-[9px] font-bold text-emerald-500 tracking-[0.2em] uppercase leading-none opacity-80 mt-1">
            Orchestrator
          </span>
        </div>
      )}
    </div>
  );
};