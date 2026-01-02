import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';
import { EmeraldLogo } from '../components/ui/EmeraldLogo';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8 relative overflow-hidden">
      {/* Efecto de glitch en el fondo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(225,29,72,0.08)_0%,transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10"></div>

      <div className="relative z-10 text-center max-w-2xl">
        {/* Logo con efecto de error */}
        <div className="mb-8 inline-block relative">
          <EmeraldLogo className="scale-125 opacity-50" withText={false} />
          <div className="absolute inset-0 bg-ruby-500/20 blur-2xl animate-pulse"></div>
        </div>

        {/* Código de error */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ruby-950/30 border border-ruby-500/30 mb-4">
            <Zap size={14} className="text-ruby-500" />
            <span className="text-xs font-medium text-ruby-400 tracking-wide uppercase">
              Glitch Detectado
            </span>
          </div>
          
          <h1 className="text-7xl font-bold text-white mb-2 font-mono tracking-tighter">
            404
          </h1>
        </div>

        {/* Mensaje */}
        <div className="space-y-4 mb-10">
          <h2 className="text-2xl font-bold text-white/90">
            Glitch en la Matrix
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-lg mx-auto">
            Parece que ya no estamos en Kansas. Esta ruta no existe en el mapa del ISP. 
            El Orquestador no reconoce esta ubicación.
          </p>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => navigate('/app')}
            className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gold to-gold-glow hover:from-gold-glow hover:to-gold text-zinc-950 font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg shadow-gold/20"
          >
            Seguir el camino de baldosas amarillas
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors border border-zinc-700"
          >
            Volver atrás
          </button>
        </div>

        {/* Mensaje técnico */}
        <div className="mt-12 pt-8 border-t border-zinc-800/50">
          <p className="text-xs text-zinc-600 font-mono">
            Error Code: <span className="text-ruby-500">ROUTE_NOT_FOUND</span> | 
            Timestamp: <span className="text-zinc-500">{new Date().toISOString()}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
