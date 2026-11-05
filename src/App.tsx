import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard/index';
import { validarAccesoUsuario, sincronizarUsuariosConFirestore } from './utils/userPermissions';

const LOCAL_SESSION_KEY = 'peya_session_user';
const LOCAL_ROLE_KEY = 'peya_session_role';
const GOOGLE_CLIENT_ID_KEY = 'peya_custom_google_client_id';

// Client ID oficial de Google OAuth para PeYa Onboarding (autorizado para https://pe-ya-onb.vercel.app y localhost)
const CLIENT_ID_DEFAULT = '384068416952-rjjkdcdl1s0st67j9pclsf3uegojv8g6.apps.googleusercontent.com';

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
  const [mostrarModalConfig, setMostrarModalConfig] = useState<boolean>(false);
  const [clientIdInput, setClientIdInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
      if (saved && !saved.startsWith('37543542668') && !saved.startsWith('718141235471')) {
        return saved;
      }
      return import.meta.env.VITE_GOOGLE_CLIENT_ID || CLIENT_ID_DEFAULT;
    }
    return CLIENT_ID_DEFAULT;
  });

  // Sincronizar usuarios desde la base central al montar la app
  useEffect(() => {
    sincronizarUsuariosConFirestore().catch(e => {
      console.warn('Sync usuarios inicial:', e);
    });
  }, []);

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
    setError('');
    try {
      if (userData) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(userData));
        localStorage.setItem(LOCAL_ROLE_KEY, userRole || 'Agente');
      } else {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        localStorage.removeItem(LOCAL_ROLE_KEY);
      }
    } catch (e) {
      console.warn('Error guardando sesión local:', e);
    }
  };

  /**
   * Validación estricta según los usuarios configurados en "Gestionar usuarios"
   */
  const verificarYAcceder = (correoGoogle: string, nombreGoogle?: string) => {
    setError('');
    const emailLower = correoGoogle.toLowerCase().trim();
    if (!emailLower) {
      setError('No se pudo obtener el correo de tu cuenta de Google.');
      return;
    }

    // Consultar si el usuario está autorizado en la lista de "Gestionar usuarios"
    const autorizado = validarAccesoUsuario(emailLower);

    if (autorizado) {
      // Acceso concedido con el rol y permisos configurados por el supervisor
      guardarSesion({
        email: autorizado.correo,
        displayName: autorizado.nombre || nombreGoogle || 'Usuario'
      }, autorizado.rol || 'Agente');
      return;
    }

    // Si no está registrado en la pestaña de Gestionar Usuarios, denegar acceso estrictamente
    setError(
      `Acceso denegado: El correo "${correoGoogle}" no está registrado en el sistema. Un supervisor debe agregarte previamente desde la pestaña "Gestionar usuarios" para que puedas ingresar con Google.`
    );
  };

  /**
   * Iniciar sesión con Google Identity Services (OAuth 2.0)
   */
  const iniciarSesionGoogle = () => {
    setError('');
    setCargandoGoogle(true);

    const activeClientId = clientIdInput.trim() || CLIENT_ID_DEFAULT;

    try {
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              try {
                // Obtener perfil y correo autenticado de Google
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                if (res.ok) {
                  const dataUser = await res.json();
                  if (dataUser && dataUser.email) {
                    verificarYAcceder(dataUser.email, dataUser.name);
                    setCargandoGoogle(false);
                    return;
                  }
                }
              } catch (e) {
                console.warn('Error obteniendo userinfo de Google:', e);
              }
            } else if (tokenResponse && tokenResponse.error) {
              console.error('Google OAuth error:', tokenResponse);
              if (tokenResponse.error === 'popup_closed_by_user') {
                setError('Se cerró la ventana de autenticación de Google.');
              } else {
                setError(`Error de autenticación Google: ${tokenResponse.error_description || tokenResponse.error}`);
              }
            }
            setCargandoGoogle(false);
          },
          error_callback: (err: any) => {
            setCargandoGoogle(false);
            console.error('TokenClient error:', err);
            setError(`Error de inicialización de Google Auth (${err.type || 'Verifica el Client ID'}).`);
          }
        });

        client.requestAccessToken();
      } else {
        setCargandoGoogle(false);
        setError('El servicio de autenticación de Google aún no termina de cargar. Por favor espera 3 segundos y vuelve a intentar.');
      }
    } catch (err: any) {
      setCargandoGoogle(false);
      console.error('Error al iniciar Google Auth:', err);
      setError(`Error al iniciar sesión con Google: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleLogout = () => {
    guardarSesion(null, null);
  };

  const guardarConfiguracionClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const val = clientIdInput.trim();
    if (val) {
      localStorage.setItem(GOOGLE_CLIENT_ID_KEY, val);
      setMostrarModalConfig(false);
      setError('');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-[#121212] text-slate-900 dark:text-white p-4 py-8 select-none relative">
        <div className="w-20 h-20 bg-[#E85A80] rounded-2xl flex items-center justify-center font-black text-white text-4xl mb-4 shadow-xl shadow-pink-900/30">
          O
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-1 text-[#E85A80] text-center tracking-tight">PeYa ONB</h1>
        <p className="text-slate-600 dark:text-[#B3B3B3] mb-8 text-center max-w-sm text-sm">
          Sistema de gestión operativa de Onboarding para PedidosYa
        </p>

        {/* Tarjeta de Inicio de Sesión Único con Google */}
        <div className="flex flex-col gap-5 w-full max-w-sm bg-white dark:bg-[#1A1A1C] border border-slate-200 dark:border-[#3A3A3E] p-8 rounded-2xl shadow-xl items-center text-center">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Acceso de Personal</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Inicia sesión con tu cuenta corporativa de Google. El acceso será validado según los usuarios autorizados por supervisión.
            </p>
          </div>

          <button 
            type="button"
            onClick={iniciarSesionGoogle}
            disabled={cargandoGoogle}
            className="w-full bg-white dark:bg-[#25252C] hover:bg-slate-50 dark:hover:bg-[#303038] text-slate-800 dark:text-white border border-slate-300 dark:border-[#3A3A3E] px-4 py-3.5 rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center gap-3 cursor-pointer"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.32 7.23 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.1 0 9.8 0 12s.43 3.9 1.19 5.42l4.09-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.68 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span className="text-sm font-semibold">{cargandoGoogle ? 'Conectando con Google...' : 'Iniciar sesión con Google'}</span>
          </button>
        </div>

        {error && (
          <div className="mt-5 max-w-sm w-full bg-rose-100 dark:bg-red-950/40 border border-rose-300 dark:border-red-800 text-rose-800 dark:text-red-300 px-4 py-3 rounded-xl text-xs text-center shadow-lg font-medium leading-relaxed">
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
