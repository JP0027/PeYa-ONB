import React, { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, setDoc } from "firebase/firestore"; 
import { auth, provider, db } from './firebase';
import Dashboard from './components/Dashboard/index';
import { obtenerPerfilPorCorreo, validarAccesoUsuario, RolUsuario } from './utils/userPermissions';

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
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOCAL_ROLE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [loading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
      if (currentUser) {
        const emailLower = (currentUser.email || '').toLowerCase().trim();

        // 1. Validar contra la base en código y usuarios autorizados
        const autorizado = validarAccesoUsuario(emailLower);
        if (autorizado) {
          const userData: UserSession = {
            email: currentUser.email,
            displayName: autorizado.nombre || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Usuario')
          };
          guardarSesion(userData, autorizado.rol || 'Agente');
          return;
        }

        // 2. Validar contra Firestore (usuarios_permitidos) si existiera
        try {
          const docRef = doc(db, "usuarios_permitidos", emailLower);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const userData: UserSession = {
              email: currentUser.email,
              displayName: data.nombre || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Usuario')
            };
            guardarSesion(userData, data.rol || 'Agente');
            return;
          }

          // Intento B: Query por campo 'correo'
          const q = query(collection(db, "usuarios_permitidos"), where("correo", "==", emailLower));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            const userData: UserSession = {
              email: currentUser.email,
              displayName: data.nombre || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Usuario')
            };
            guardarSesion(userData, data.rol || 'Agente');
            return;
          }
        } catch (err) {
          console.warn("Consulta Firestore usuarios_permitidos falló:", err);
        }

        // 2. Validar contra el Backend persistente de la aplicación
        try {
          const resp = await fetch('/api/admin/usuarios');
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && Array.isArray(data.usuarios)) {
              const uEncontrado = data.usuarios.find((u: any) => (u.correo || '').toLowerCase().trim() === emailLower);
              if (uEncontrado) {
                const userData: UserSession = {
                  email: currentUser.email,
                  displayName: uEncontrado.nombre || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Usuario')
                };
                guardarSesion(userData, uEncontrado.rol || 'Agente');
                return;
              }
            }
          }
        } catch (errApi) {
          console.warn("Consulta API /api/admin/usuarios falló:", errApi);
        }

        // 3. Fallback a la lista blanca oficial de PedidosYa
        if (currentUser.email) {
          const perfil = obtenerPerfilPorCorreo(currentUser.email);
          if (perfil) {
            const userData: UserSession = {
              email: currentUser.email,
              displayName: perfil.nombre || currentUser.displayName || currentUser.email.split('@')[0]
            };
            // Guardar automáticamente en Firestore para persistencia
            try {
              await setDoc(doc(db, "usuarios_permitidos", emailLower), {
                correo: emailLower,
                nombre: perfil.nombre,
                rol: perfil.rol,
                pestanas: ['admin', 'inicio', 'nuevo', ...(perfil.rol.includes('Supervisor') ? ['tl', 'usuarios'] : [])],
                actualizadoEn: new Date().toISOString()
              }, { merge: true });
            } catch (_) {}

            guardarSesion(userData, perfil.rol);
            return;
          }
        }

        await signOut(auth);
        guardarSesion(null, null);
        setError(`Acceso denegado. El correo ${currentUser.email} no se encuentra registrado en la base de usuarios de Onboarding. Solicita a un supervisor que te dé de alta.`);
      } else {
        // Si no hay sesión en Firebase Auth, verificar si el usuario tiene sesión manual local activa
        try {
          const sesionActiva = localStorage.getItem(LOCAL_SESSION_KEY);
          if (!sesionActiva) {
            setUser(null);
            setRole(null);
          }
        } catch {
          setUser(null);
          setRole(null);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    setError("");
    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        const email = result.user.email || '';
        const emailLower = email.toLowerCase().trim();

        // 1. Validar contra la base en código y usuarios autorizados
        const autorizado = validarAccesoUsuario(emailLower);
        if (autorizado) {
          guardarSesion({
            email,
            displayName: autorizado.nombre || result.user.displayName || email.split('@')[0]
          }, autorizado.rol || 'Agente');
          return;
        }

        // 2. Validar contra Firestore (usuarios_permitidos) si existiera
        try {
          const docRef = doc(db, "usuarios_permitidos", emailLower);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            guardarSesion({
              email,
              displayName: data.nombre || result.user.displayName || email.split('@')[0]
            }, data.rol || 'Agente');
            return;
          }

          // Intento B: Query por campo 'correo'
          const q = query(collection(db, "usuarios_permitidos"), where("correo", "==", emailLower));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            guardarSesion({
              email,
              displayName: data.nombre || result.user.displayName || email.split('@')[0]
            }, data.rol || 'Agente');
            return;
          }
        } catch (e) {
          console.warn('Error validando en Firestore en login:', e);
        }

        // 2. Validar contra el Backend persistente de la aplicación
        try {
          const resp = await fetch('/api/admin/usuarios');
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && Array.isArray(data.usuarios)) {
              const uEncontrado = data.usuarios.find((u: any) => (u.correo || '').toLowerCase().trim() === emailLower);
              if (uEncontrado) {
                guardarSesion({
                  email,
                  displayName: uEncontrado.nombre || result.user.displayName || email.split('@')[0]
                }, uEncontrado.rol || 'Agente');
                return;
              }
            }
          }
        } catch (errApi) {
          console.warn('Error validando en API backend en login:', errApi);
        }

        // 3. Fallback a la lista blanca oficial
        const perfil = obtenerPerfilPorCorreo(email);
        if (perfil) {
          try {
            await setDoc(doc(db, "usuarios_permitidos", emailLower), {
              correo: emailLower,
              nombre: perfil.nombre,
              rol: perfil.rol,
              pestanas: ['admin', 'inicio', 'nuevo', ...(perfil.rol.includes('Supervisor') ? ['tl', 'usuarios'] : [])],
              actualizadoEn: new Date().toISOString()
            }, { merge: true });
          } catch (_) {}

          guardarSesion({
            email,
            displayName: perfil.nombre || result.user.displayName || email.split('@')[0]
          }, perfil.rol);
          return;
        }

        await signOut(auth);
        guardarSesion(null, null);
        setError(`Acceso denegado. El correo ${email} no se encuentra registrado en la base de usuarios de Onboarding. Solicita a un supervisor que te dé de alta.`);
      }
    } catch (err: any) {
      console.error("[Login Google]", err);
      const codigo = err?.code || "";
      if (codigo === "auth/unauthorized-domain") {
        setError(
          `Dominio no autorizado en Firebase (${window.location.hostname}). Agrégalo en la consola de Firebase: Authentication > Ajustes (Settings) > Dominios autorizados.`
        );
      } else if (codigo === "auth/popup-blocked") {
        setError("El navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes (pop-ups) para continuar.");
      } else if (codigo === "auth/popup-closed-by-user") {
        setError("Inicio de sesión cancelado (cerraste la ventana emergente de Google).");
      } else if (codigo === "auth/operation-not-allowed") {
        setError("El proveedor Google no está habilitado en Firebase 'PeYa ONB'. Actívalo en Authentication > Método de inicio de sesión > Google.");
      } else {
        setError(`Error al iniciar sesión con Google: ${err.message || "Intenta nuevamente."}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignorar
    }
    guardarSesion(null, null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121212] text-white">
        Cargando validación...
      </div>
    );
  }

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

        <div className="flex flex-col gap-3.5 w-full max-w-sm">

          {/* BOTÓN ÚNICO DE GOOGLE AUTH */}
          <button 
            type="button"
            onClick={login} 
            className="w-full bg-white dark:bg-[#1A1A1C] border border-slate-300 dark:border-[#3A3A3E] hover:border-[#E85A80] px-6 py-3.5 rounded-xl font-bold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-[#2C2C32] transition flex items-center justify-center gap-3 text-sm shadow-md cursor-pointer min-h-[44px]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 17c1.8 3.7 5.6 6.5 10.1 6.5z"/>
            </svg>
            <span>Iniciar sesión con cuenta Google</span>
          </button>
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
