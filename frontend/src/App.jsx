import React, { useState, useEffect } from 'react';
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
        const q = query(collection(db, "usuarios_permitidos"), where("correo", "==", currentUser.email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          setUser(currentUser);
          setRole(querySnapshot.docs[0].data().rol); 
        } else {
          await signOut(auth);
          setError(`Acceso denegado. El correo ${currentUser.email} no está en la lista blanca.`);
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
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0f111a] text-white">Cargando validación...</div>;

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0f111a] text-white">
        <h1 className="text-5xl font-bold mb-8 text-pink-500">HeroCare ONB</h1>
        <button onClick={login} className="bg-gray-800 border border-gray-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition flex items-center gap-2">
          Iniciar sesión con Google
        </button>
        {error && <p className="text-red-500 mt-4 text-center max-w-md">{error}</p>}
      </div>
    );
  }

  // Se eliminó el <nav> superior. El Dashboard ahora controla toda la pantalla.
  return <Dashboard role={role} email={user.email} onLogout={handleLogout} />;
}