import React, { useState } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="hero-badge">
          <ShieldCheck size={16} />
          Acceso Emerald ERP
        </div>
        <h2>Panel Operativo</h2>
        <p>Ingresá con tus credenciales para administrar tickets, clientes y diagnósticos.</p>

        <form onSubmit={handleSubmit} className="form-stack">
          <div>
            <label className="card-title" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              className="input"
              placeholder="usuario@emerald.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="card-title" htmlFor="password">
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', top: 14, right: 14, opacity: 0.5 }} />
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button type="submit" className="button" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {error && <div className="tag danger">{error}</div>}
        <div className="helper">Usá tus credenciales de backend. Demo: admin@emerald.com / Admin@123</div>
      </div>
    </div>
  );
}
