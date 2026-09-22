import { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore"; 
import { auth, provider, db } from './firebase';
import Dashboard from './Dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const q = query(collection(db, "usuarios_permitidos"), where("correo", "==", currentUser.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            setUser(currentUser);
            setRole(querySnapshot.docs[0].data().rol); 
          } else {
            await signOut(auth);
            setError(`Acceso denegado. El correo ${currentUser.email} no está en la lista blanca.`);
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
      console.error(err);
      setError("No se pudo iniciar sesión con Google. Puedes probar con el Modo Demo.");
    }
  };

  const loginDemo = (selectedRole = 'Agente') => {
    setError("");
    setUser({ email: 'agente.demo@pedidosya.com', displayName: 'Agente Demo' });
    setRole(selectedRole);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignorar si era sesión demo
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
      <div className="flex h-screen flex-col items-center justify-center bg-[#0f111a] text-white p-4">
        <div className="w-16 h-16 bg-pink-600 rounded-2xl flex items-center justify-center font-bold text-white text-2xl mb-4 shadow-lg shadow-pink-900/40">
          HC
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-2 text-pink-500 text-center">HeroCare ONB</h1>
        <p className="text-gray-400 mb-8 text-center max-w-sm">Sistema de gestión y seguimiento de onboarding para PedidosYa</p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={login} 
            className="w-full bg-gray-800 border border-gray-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition flex items-center justify-center gap-2"
          >
            Iniciar sesión con Google
          </button>

          <button 
            onClick={() => loginDemo('Agente')} 
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            Entrar como Agente Demo
          </button>

          <button 
            onClick={() => loginDemo('Supervisor')} 
            className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 font-semibold px-6 py-2.5 rounded-lg transition text-sm"
          >
            Entrar como Supervisor Demo
          </button>
        </div>

        {error && <p className="text-red-400 mt-4 text-center max-w-md text-sm">{error}</p>}
      </div>
    );
  }

  return <Dashboard role={role} email={user.email} onLogout={handleLogout} />;
}
