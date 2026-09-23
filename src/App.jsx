import { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore"; 
import { auth, provider, db } from './firebase';
import Dashboard from './Dashboard';
import { obtenerPerfilPorCorreo, LISTA_BLANCA_OFICIAL } from './utils/userPermissions';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // 1. Validar contra la lista blanca oficial de PedidosYa
        const perfil = obtenerPerfilPorCorreo(currentUser.email);
        if (perfil) {
          setUser({
            email: currentUser.email,
            displayName: currentUser.displayName || perfil.nombre
          });
          setRole(perfil.rol);
          setLoading(false);
          return;
        }

        // 2. Si no está en la lista estática, validar en Firestore
        try {
          const q = query(collection(db, "usuarios_permitidos"), where("correo", "==", currentUser.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            setUser(currentUser);
            setRole(querySnapshot.docs[0].data().rol || 'Agente'); 
          } else {
            await signOut(auth);
            setError(`Acceso denegado. El correo ${currentUser.email} no está en la lista blanca de PedidosYa.`);
          }
        } catch (err) {
          console.error("Error al validar usuario en lista blanca:", err);
          await signOut(auth);
          setError("Error de conexión al validar permisos en la lista blanca.");
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    setError("");
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
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
    setUser(null);
    setRole(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f111a] text-white">
        Cargando validación...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f111a] text-white p-4 py-8">
        <div className="w-16 h-16 bg-pink-600 rounded-2xl flex items-center justify-center font-black text-white text-2xl mb-4 shadow-lg shadow-pink-900/40">
          PY
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-1 text-pink-500 text-center tracking-tight">PeYa ONB</h1>
        <p className="text-gray-400 mb-8 text-center max-w-sm text-sm">
          Sistema de gestión operativa de Onboarding para PedidosYa
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {/* BOTÓN ÚNICO DE GOOGLE AUTH */}
          <button 
            onClick={login} 
            className="w-full bg-[#151824] border border-gray-700 hover:border-pink-500 px-6 py-3.5 rounded-xl font-semibold hover:bg-gray-800 transition flex items-center justify-center gap-3 text-sm shadow-xl"
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
          <div className="mt-6 max-w-md bg-red-950/40 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-xs text-center shadow-lg">
            {error}
          </div>
        )}
      </div>
    );
  }

  return <Dashboard role={role} email={user.email} nombreUsuario={user.displayName} onLogout={handleLogout} />;
}
