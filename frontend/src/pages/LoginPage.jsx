import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmeraldLogo } from '../components/ui/EmeraldLogo';

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('admin@emerald.com');
  const [password, setPassword] = useState('Admin@123');
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await login({ email, password });
      navigate('/app');
    } catch (err) {
      console.error('Login fallido', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Columna izquierda: Formulario contenido */}
      <div className="w-full lg:w-2/5 bg-zinc-950 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Rejilla sutil */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />

        <div className="relative z-10 mx-auto w-full sm:w-[350px]">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-500/20 mb-4">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span className="text-xs font-medium text-emerald-400 tracking-wide uppercase">Sistema Seguro</span>
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Acceso al Núcleo</h1>
            <p className="text-zinc-400 text-sm">Identifícate para acceder al sistema de orquestación Emerald.</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                  placeholder="usuario@emerald.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-ruby-950/30 border border-ruby-500/30 rounded-lg">
                <AlertCircle size={18} className="text-ruby-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ruby-400">Acceso Denegado</p>
                  <p className="text-xs text-ruby-300/80 mt-1">{error}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg transition-all duration-200 transform active:scale-[0.98] shadow-lg shadow-emerald-900/50 disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Autenticando...
                </span>
              ) : (
                'Identificarse'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 text-center">
              Demo: <code className="text-emerald-400 font-mono">admin@emerald.com</code> -{' '}
              <code className="text-emerald-400 font-mono">Admin@123</code>
            </p>
          </div>
        </div>
      </div>

      {/* Columna derecha: Arte decorativo */}
      <div className="hidden lg:flex lg:w-3/5 bg-zinc-950 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,transparent_50%)]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-emerald-500 to-transparent" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-emerald-500 to-transparent" />
          <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-emerald-500 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-10">
          <EmeraldLogo className="scale-[2.4] mb-12 drop-shadow-[0_0_30px_rgba(16,185,129,0.45)]" withText />
          <div className="space-y-4 max-w-xl">
            <h2 className="text-2xl font-bold text-white/90 tracking-tight">El Orquestador de Oz</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Detrás de la cortina, la máquina que sostiene el imperio de Internet. Sistema de gestión integral para
              operaciones críticas de ISP.
            </p>
            <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-zinc-800/50">
              <StatusDot label="Core Online" delay="" />
              <StatusDot label="Auth Ready" delay="0.2s" />
              <StatusDot label="DB Connected" delay="0.4s" />
            </div>
          </div>
        </div>

        {/* Partículas */}
        <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-emerald-500/30 rounded-full animate-ping" />
        <div className="absolute bottom-1/3 right-1/4 w-1 h-1 bg-emerald-500/20 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
      </div>
    </div>
  );
}

function StatusDot({ label, delay = '' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: delay }} />
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}
