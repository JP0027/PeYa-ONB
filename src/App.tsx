import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard/index';
import { obtenerPerfilPorCorreo, validarAccesoUsuario, USUARIOS_CODIGO_BASE } from './utils/userPermissions';

const LOCAL_SESSION_KEY = 'peya_session_user';
const LOCAL_ROLE_KEY = 'peya_session_role';

export interface UserSession {
  email: string | null;
  displayName: string | null;
}

export default function App() {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_SESSION_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignorar
    }
    // Por defecto iniciar con Yadira Flores (Supervisor / TL) si no hay sesión para agilizar pruebas y Render/Vercel
    const defaultUser = USUARIOS_CODIGO_BASE[3]; // Yadira Flores
    return {
      email: defaultUser.correo,
      displayName: defaultUser.nombre
    };
  });

  const [role, setRole] = useState<string | null>(() => {
    try {
      const savedRole = localStorage.getItem(LOCAL_ROLE_KEY);
      if (savedRole) return savedRole;
    } catch {}
    const defaultUser = USUARIOS_CODIGO_BASE[3];
    return defaultUser.rol;
  });

  const [emailInput, setEmailInput] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (user?.email) {
      const perfil = validarAccesoUsuario(user.email);
      if (perfil && perfil.rol && perfil.rol !== role) {
        setRole(perfil.rol);
        try {
          localStorage.setItem(LOCAL_ROLE_KEY, perfil.rol);
        } catch {}
      }
    }
  }, [user, role]);

  const guardarSesion = (userData: UserSession | null, userRole: string | null) => {
    setUser(userData);
    setRole(userRole);
    setError("");
    try {
      if (userData) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(userData));
        localStorage.setItem(LOCAL_ROLE_KEY, userRole || 'Supervisor');
      } else {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        localStorage.removeItem(LOCAL_ROLE_KEY);
      }
    } catch (e) {
      console.warn("Error guardando sesión local:", e);
    }
  };

  const loginConCorreo = (correoStr: string) => {
    setError("");
    const emailLower = correoStr.toLowerCase().trim();
    if (!emailLower) {
      setError("Ingresa un correo corporativo válido.");
      return;
    }

    const autorizado = validarAccesoUsuario(emailLower);
    if (autorizado) {
      guardarSesion({
        email: autorizado.correo,
        displayName: autorizado.nombre
      }, autorizado.rol || 'Agente');
      return;
    }

    const perfil = obtenerPerfilPorCorreo(emailLower);
    if (perfil) {
      guardarSesion({
        email: emailLower,
        displayName: perfil.nombre
      }, perfil.rol);
      return;
    }

    // Permitir cualquier correo corporativo @pedidosya.com como Agente por defecto
    if (emailLower.endsWith('@pedidosya.com') || emailLower.endsWith('@gmail.com')) {
      const nombrePart = emailLower.split('@')[0];
      const nombreBonito = nombrePart.charAt(0).toUpperCase() + nombrePart.slice(1);
      guardarSesion({
        email: emailLower,
        displayName: nombreBonito
      }, 'Agente');
      return;
    }

    setError(`Acceso denegado. El correo ${correoStr} no está autorizado.`);
  };

  const handleLogout = () => {
    guardarSesion(null, null);
    setEmailInput('');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-[#121212] text-slate-900 dark:text-white p-4 py-8 select-none">
        <div className="w-16 h-16 bg-[#E85A80] rounded-2xl flex items-center justify-center font-black text-white text-3xl mb-4 shadow-xl shadow-pink-900/30">
          O
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-1 text-[#E85A80] text-center tracking-tight">PeYa ONB</h1>
        <p className="text-slate-600 dark:text-[#B3B3B3] mb-8 text-center max-w-sm text-sm">
          Sistema de gestión operativa de Onboarding para PedidosYa
        </p>

        <div className="flex flex-col gap-3.5 w-full max-w-sm bg-white dark:bg-[#1A1A1C] border border-slate-200 dark:border-[#3A3A3E] p-6 rounded-2xl shadow-xl">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Ingresa con tu correo corporativo:
          </label>
          <input 
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loginConCorreo(emailInput); }}
            placeholder="usuario@pedidosya.com"
            className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-300 dark:border-[#3A3A3E] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#E85A80]"
          />
          <button 
            type="button"
            onClick={() => loginConCorreo(emailInput)} 
            className="w-full bg-[#E85A80] hover:bg-[#d4486d] text-white px-6 py-3 rounded-xl font-bold text-xs transition shadow-md shadow-pink-900/30 cursor-pointer"
          >
            Iniciar Sesión
          </button>

          <div className="border-t border-slate-200 dark:border-[#3A3A3E] pt-3 mt-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 font-semibold">Acceso rápido con cuentas autorizadas:</p>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {USUARIOS_CODIGO_BASE.map(u => (
                <button
                  key={u.correo}
                  type="button"
                  onClick={() => loginConCorreo(u.correo)}
                  className="text-left px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#25252C] hover:bg-slate-100 dark:hover:bg-[#303038] text-xs transition flex items-center justify-between cursor-pointer border border-slate-200 dark:border-transparent"
                >
                  <span className="font-bold text-slate-800 dark:text-white">{u.nombre}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{u.rol}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 max-w-md bg-rose-100 dark:bg-red-950/40 border border-rose-300 dark:border-red-800 text-rose-800 dark:text-red-300 px-4 py-3 rounded-xl text-xs text-center shadow-lg font-medium">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <Dashboard 
      role={role || undefined} 
      email={user.email || undefined} 
      nombreUsuario={user.displayName || undefined} 
      onLogout={handleLogout} 
    />
  );
}
