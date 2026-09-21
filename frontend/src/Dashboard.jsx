import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { db } from './firebase';

export default function Dashboard({ role, email, onLogout }) {
  const [activeTab, setActiveTab] = useState(role === 'Supervisor' ? 'global' : 'inicio');
  const [casos, setCasos] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(new Audio('/ding.mp3'));
  const alertasSonadas = useRef(new Set());

  useEffect(() => {
    let q;
    const casosRef = collection(db, "casos");
    
    // Si estamos en la pestaña global y es supervisor, trae todos. Si no, trae los del agente.
    if (activeTab === 'global' && role === 'Supervisor') {
      q = query(casosRef, where("estado", "==", "En progreso"));
    } else {
      q = query(casosRef, where("estado", "==", "En progreso"), where("agente", "==", email));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCasos(data);
      verificarSLAs(data);
    });

    return () => unsubscribe();
  }, [role, email, activeTab]);

  const verificarSLAs = (casosActuales) => {
    casosActuales.forEach(caso => {
      const horas = calcularHoras(caso.sla_inicio);
      if (horas >= 4 && !alertasSonadas.current.has(caso.id)) {
        alertasSonadas.current.add(caso.id);
        if (!isMuted) audioRef.current.play().catch(() => {});
      }
    });
  };

  const calcularHoras = (fechaInicio) => {
    if (!fechaInicio) return 0;
    return Math.abs(new Date() - new Date(fechaInicio)) / 36e5;
  };

  // Métricas para los Top Cards
  const totalCasos = casos.length;
  const riesgoCritico = casos.filter(c => calcularHoras(c.sla_inicio) >= 96).length;
  const atencionRequerida = casos.filter(c => calcularHoras(c.sla_inicio) >= 4 && calcularHoras(c.sla_inicio) < 96).length;

  return (
    <div className="flex h-screen bg-[#0f111a] text-gray-200 font-sans">
      
      {/* SIDEBAR IZQUIERDO */}
      <div className="w-64 bg-[#161925] border-r border-gray-800 flex flex-col justify-between">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-gray-800">
            <div className="w-8 h-8 bg-pink-600 rounded-md flex items-center justify-center font-bold text-white">HC</div>
            <h1 className="text-xl font-bold text-pink-500">HeroCare ONB</h1>
          </div>
          <nav className="p-4 flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('inicio')}
              className={`text-left px-4 py-2 rounded-lg flex items-center gap-3 transition ${activeTab === 'inicio' ? 'bg-pink-600 text-white' : 'hover:bg-gray-800'}`}>
              🚨 Mis Alertas (Inicio)
            </button>
            <button 
              onClick={() => setActiveTab('nuevo')}
              className={`text-left px-4 py-2 rounded-lg flex items-center gap-3 transition ${activeTab === 'nuevo' ? 'bg-pink-600 text-white' : 'hover:bg-gray-800'}`}>
              🔍 Consultar / Nuevo
            </button>
            
            {role === 'Supervisor' && (
              <button 
                onClick={() => setActiveTab('global')}
                className={`text-left px-4 py-2 rounded-lg flex items-center gap-3 transition mt-4 ${activeTab === 'global' ? 'bg-cyan-500 text-black font-semibold' : 'text-cyan-400 hover:bg-gray-800'}`}>
                📊 Dashboard Global
              </button>
            )}
          </nav>
        </div>
        
        {/* Footer del Sidebar */}
        <div className="p-4 border-t border-gray-800 text-sm">
          <p className="text-gray-500 mb-1">Iniciaste sesión como:</p>
          <p className="font-semibold truncate" title={email}>{email}</p>
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{role}</span>
            <button onClick={onLogout} className="text-red-400 hover:text-red-300 text-xs underline">Cerrar Sesión</button>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 overflow-auto p-8 relative">
        
        {/* Header con botón de Mute */}
        <div className="absolute top-8 right-8">
          <button onClick={() => setIsMuted(!isMuted)} className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${isMuted ? 'bg-red-900/50 text-red-400 border border-red-800' : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'}`}>
            {isMuted ? '🔇 Alertas Silenciadas' : '🔊 Alertas Activadas'}
          </button>
        </div>

        {/* VISTA: DASHBOARD GLOBAL */}
        {activeTab === 'global' && role === 'Supervisor' && (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-3 gap-6 mb-8 mt-12">
              <div className="bg-[#1a1d27] p-6 rounded-xl border border-gray-800 flex flex-col items-center justify-center">
                <p className="text-gray-400 text-sm mb-2">Total Casos Activos (Equipo)</p>
                <p className="text-4xl font-bold">{totalCasos}</p>
              </div>
              <div className="bg-[#1a1d27] p-6 rounded-xl border border-red-900/50 flex flex-col items-center justify-center">
                <p className="text-red-400 text-sm mb-2">Riesgo Crítico (≥ 96h)</p>
                <p className="text-4xl font-bold text-red-500">{riesgoCritico}</p>
              </div>
              <div className="bg-[#1a1d27] p-6 rounded-xl border border-yellow-900/50 flex flex-col items-center justify-center">
                <p className="text-yellow-400 text-sm mb-2">Atención Requerida (≥ 4h)</p>
                <p className="text-4xl font-bold text-yellow-500">{atencionRequerida}</p>
              </div>
            </div>

            <div className="bg-[#1a1d27] rounded-xl border border-gray-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Monitoreo de SLA Global</h2>
                  <p className="text-sm text-gray-400">Visualizando casos de todo el equipo ONB. Los casos cerrados se ocultan automáticamente.</p>
                </div>
                <button className="bg-green-600/20 text-green-400 border border-green-600 hover:bg-green-600/40 px-4 py-2 rounded-lg text-sm font-semibold transition">
                  ⬇ Descargar Casos Críticos (.CSV)
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-500 border-b border-gray-700">
                    <tr>
                      <th className="pb-3 font-medium">N° CASO</th>
                      <th className="pb-3 font-medium">ID LOCAL</th>
                      <th className="pb-3 font-medium">TIENDA</th>
                      <th className="pb-3 font-medium">ESTADO ACTUAL</th>
                      <th className="pb-3 font-medium text-center">TIEMPO SLA</th>
                      <th className="pb-3 font-medium">AGENTE</th>
                      <th className="pb-3 font-medium text-right">ACCIÓN TL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {casos.map(caso => {
                      const horas = calcularHoras(caso.sla_inicio);
                      return (
                        <tr key={caso.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition">
                          <td className="py-4 text-gray-300">{caso.id}</td>
                          <td className="py-4 font-mono text-gray-400">{caso.vendor_id}</td>
                          <td className="py-4">{caso.tienda}</td>
                          <td className="py-4">
                            <span className="bg-blue-900/50 text-blue-300 border border-blue-800 px-2 py-1 rounded text-xs">
                              {caso.estado}
                            </span>
                          </td>
                          <td className="py-4 text-center">
                            {horas >= 96 ? <span className="text-red-500 font-bold bg-red-900/20 px-2 py-1 rounded">≥ 96h</span> : 
                             horas >= 4 ? <span className="text-yellow-500 font-bold bg-yellow-900/20 px-2 py-1 rounded">≥ 4h</span> : 
                             <span className="text-green-500">OK</span>}
                          </td>
                          <td className="py-4 text-gray-400">{caso.agente.split('@')[0]}</td>
                          <td className="py-4 text-right flex flex-col gap-1 items-end">
                            <button className="text-xs bg-gray-800 border border-gray-600 hover:bg-gray-700 text-cyan-400 px-2 py-1 rounded w-32">💬 1. Copiar Slack</button>
                            <button className="text-xs bg-green-900/30 border border-green-800 hover:bg-green-900/60 text-green-400 px-2 py-1 rounded w-32">✅ 2. Confirmar Push</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {casos.length === 0 && <p className="text-center text-gray-500 mt-8">No hay casos activos en este momento.</p>}
              </div>
            </div>
          </div>
        )}

        {/* VISTA: CONSULTAR / NUEVO */}
        {activeTab === 'nuevo' && (
          <div className="max-w-5xl mx-auto mt-12">
            <div className="bg-[#1a1d27] p-4 rounded-xl border border-gray-800 flex gap-4 mb-8">
              <input type="text" placeholder="Ingrese VendorID (ej. 596135)..." className="flex-1 bg-[#0f111a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500" />
              <button className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-8 rounded-lg transition">Consultar Local</button>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-[#1a1d27] p-6 rounded-xl border border-gray-800">
                <h3 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">Historial del VendorID</h3>
                <div className="bg-[#0f111a] p-4 rounded-lg border-l-4 border-green-500 flex justify-between items-center opacity-50">
                  <div>
                    <p className="font-bold text-sm">Caso OP: 345933785</p>
                    <p className="text-xs text-gray-500">KAM: diego.kam@pedidosya.com</p>
                  </div>
                  <span className="text-green-500 text-xs font-bold">Cerrado Exitoso</span>
                </div>
              </div>

              <div className="bg-[#1a1d27] p-6 rounded-xl border border-pink-900/50">
                <h3 className="text-lg font-bold mb-6">Registrar Nueva Oportunidad</h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Tienda (Autocompletado)</label>
                    <input type="text" value="La Plateada - Temuco" disabled className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-gray-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Integración</label>
                    <select className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white">
                      <option>Fudo</option>
                      <option>Toteat</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">N° Ticket de HeroCare</label>
                    <input type="text" placeholder="Ingrese el ticket..." className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-pink-500" />
                  </div>
                  <p className="text-xs text-green-400 mt-2">✓ Propietario asignado automáticamente: {email.split('@')[0]}</p>
                  <button className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg mt-2 transition">Guardar Caso y Generar N° OP</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA: MIS ALERTAS (INICIO) */}
        {activeTab === 'inicio' && (
          <div className="max-w-4xl mx-auto mt-12">
            <h2 className="text-2xl font-bold mb-6">Mis Casos en Progreso (SLA Crítico)</h2>
            <div className="bg-[#1a1d27] rounded-xl border border-gray-800 p-6">
              {casos.length === 0 ? (
                <p className="text-gray-500">No tienes casos asignados actualmente.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-500 border-b border-gray-700">
                    <tr>
                      <th className="pb-3 font-medium">N° CASO OP</th>
                      <th className="pb-3 font-medium">TIENDA</th>
                      <th className="pb-3 font-medium text-center">TIEMPO SLA</th>
                      <th className="pb-3 font-medium text-right">ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {casos.map(caso => {
                       const horas = calcularHoras(caso.sla_inicio);
                       return (
                        <tr key={caso.id} className="border-b border-gray-800">
                          <td className="py-4 text-gray-300">{caso.id}</td>
                          <td className="py-4">{caso.tienda}</td>
                          <td className="py-4 text-center">
                            {horas >= 96 ? <span className="text-red-500 font-bold bg-red-900/20 px-2 py-1 rounded">≥ 96h</span> : 
                             horas >= 4 ? <span className="text-yellow-500 font-bold bg-yellow-900/20 px-2 py-1 rounded">≥ 4h</span> : 
                             <span className="text-green-500">OK</span>}
                          </td>
                          <td className="py-4 text-right">
                            <button className="bg-gray-800 border border-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs">✏️ Actualizar / Push</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}