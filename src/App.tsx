import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard/index';
import { obtenerPerfilPorCorreo, validarAccesoUsuario } from './utils/userPermissions';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

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
    return null;
  });

  const [role, setRole] = useState<string | null>(() => {
    try {
      const savedRole = localStorage.getItem(LOCAL_ROLE_KEY);
      if (savedRole) return savedRole;
    } catch {}
    return null;
  });

  const [error, setError] = useState<string>('');
  const [cargandoGoogle, setCargandoGoogle] = useState<boolean>(false);
  const [mostrarAccesoManual, setMostrarAccesoManual] = useState<boolean>(false);
  const [correoManual, setCorreoManual] = useState<string>('');

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

  // Escuchar estado de autenticación en Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email && !user) {
        loginConCorreo(firebaseUser.email, firebaseUser.displayName || undefined);
      }
    });
    return () => unsubscribe();
  }, [user]);

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

  const loginConCorreo = (correoStr: string, nombreReal?: string) => {
    setError("");
    const emailLower = correoStr.toLowerCase().trim();
    if (!emailLower) {
      setError("No se pudo obtener el correo de Google.");
      return;
    }

    const autorizado = validarAccesoUsuario(emailLower);
    if (autorizado) {
      guardarSesion({
        email: autorizado.correo,
        displayName: nombreReal || autorizado.nombre
      }, autorizado.rol || 'Agente');
      return;
    }

    const perfil = obtenerPerfilPorCorreo(emailLower);
    if (perfil) {
      guardarSesion({
        email: emailLower,
        displayName: nombreReal || perfil.nombre
      }, perfil.rol);
      return;
    }

    // Permitir cualquier correo corporativo @pedidosya.com o cuenta autorizada
    if (emailLower.endsWith('@pedidosya.com') || emailLower === 'yadirayajaida@gmail.com') {
      const nombrePart = emailLower.split('@')[0];
      const nombreBonito = nombreReal || (nombrePart.charAt(0).toUpperCase() + nombrePart.slice(1));
      guardarSesion({
        email: emailLower,
        displayName: nombreBonito
      }, emailLower === 'yadirayajaida@gmail.com' ? 'Supervisor' : 'Agente');
      return;
    }

    setError(`Acceso denegado. El correo ${correoStr} no está autorizado en PedidosYa Onboarding.`);
  };

  const iniciarSesionGoogle = async () => {
    setError('');
    setCargandoGoogle(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result && result.user && result.user.email) {
        loginConCorreo(result.user.email, result.user.displayName || undefined);
      } else {
        setError('No se pudo obtener la información de la cuenta de Google.');
      }
    } catch (err: any) {
      console.error('Error al iniciar sesión con Firebase:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Se cerró la ventana emergente de inicio de sesión de Google.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`El dominio "${window.location.hostname}" no está autorizado en Firebase Authentication. Agrega este dominio en la consola de Firebase o usa el acceso con correo corporativo.`);
        setMostrarAccesoManual(true);
      } else {
        setError(`Error al iniciar sesión con Firebase: ${err.message || 'Error desconocido'}`);
      }
    } finally {
      setCargandoGoogle(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correoManual.trim()) return;
    loginConCorreo(correoManual.trim());
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Error cerrando sesión en Firebase:', e);
    }
    guardarSesion(null, null);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-[#121212] text-slate-900 dark:text-white p-4 py-8 select-none">
        <div className="w-20 h-20 bg-[#E85A80] rounded-2xl flex items-center justify-center font-black text-white text-4xl mb-4 shadow-xl shadow-pink-900/30">
          O
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-1 text-[#E85A80] text-center tracking-tight">PeYa ONB</h1>
        <p className="text-slate-600 dark:text-[#B3B3B3] mb-8 text-center max-w-sm text-sm">
          Sistema de gestión operativa de Onboarding para PedidosYa
        </p>

        <div className="flex flex-col gap-4 w-full max-w-sm bg-white dark:bg-[#1A1A1C] border border-slate-200 dark:border-[#3A3A3E] p-8 rounded-2xl shadow-xl items-center text-center">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-2">
            Inicia sesión utilizando tu cuenta corporativa autorizada de Google (@pedidosya.com) con Firebase Authentication
          </p>

          <button 
            type="button"
            onClick={iniciarSesionGoogle}
            disabled={cargandoGoogle}
            className="w-full bg-white dark:bg-[#25252C] hover:bg-slate-50 dark:hover:bg-[#303038] text-slate-800 dark:text-white border border-slate-300 dark:border-[#3A3A3E] px-6 py-3.5 rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center gap-3 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.32 7.23 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.1 0 9.8 0 12s.43 3.9 1.19 5.42l4.09-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.68 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            {cargandoGoogle ? 'Conectando con Firebase Auth...' : 'Iniciar sesión con Google (Firebase)'}
          </button>

          <div className="w-full pt-2">
            <button
              type="button"
              onClick={() => setMostrarAccesoManual(!mostrarAccesoManual)}
              className="text-[11px] text-slate-500 hover:text-slate-400 underline cursor-pointer"
            >
              {mostrarAccesoManual ? 'Ocultar acceso manual' : '¿Problemas con la ventana emergente? Acceder con correo'}
            </button>
          </div>

          {mostrarAccesoManual && (
            <form onSubmit={handleManualSubmit} className="w-full pt-2 space-y-2 border-t border-slate-200 dark:border-[#3A3A3E] mt-2">
              <input 
                type="email"
                value={correoManual}
                onChange={(e) => setCorreoManual(e.target.value)}
                placeholder="tu.nombre@pedidosya.com"
                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-300 dark:border-[#3A3A3E] px-3 py-2 rounded-lg text-xs text-slate-800 dark:text-white"
              />
              <button 
                type="submit"
                className="w-full bg-[#E85A80] hover:bg-[#F46C8E] text-white font-bold py-2 rounded-lg text-xs transition cursor-pointer"
              >
                Acceder al sistema
              </button>
            </form>
          )}
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
