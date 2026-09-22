import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, where, getDocs, setDoc, doc } from "firebase/firestore";
import { db } from './firebase';
import integracionesData from './integraciones.json';

// Extraídas directamente de tus capturas de pantalla de Google Sheets
const LISTA_PAISES = ['Argentina', 'Bolivia', 'Chile', 'Colombia', 'Ecuador', 'El Salvador', 'Guatemala', 'Perú', 'Uruguay', 'Venezuela'];
const LISTA_ASSETS = ['New Business', 'Upgrade/Upsell Alta Integracion', 'Upgrade/Upsell Baja Integracion', 'Franchise Extension', 'Win Back', 'Otros', 'Owner Change', 'Upgrade/Upsell Cambio de comisión', 'Legal Form Change', 'Switch', 'Sin oportunidad'];
const LISTA_AGENTES = ['Jean Palomino', 'Prisila Leon', 'Joel Tocas', 'Yadira Flores', 'Guillermo Gonzales', 'Jean Changanaqui', 'Comercial', 'Sin asignación'];
const LISTA_ESTADOS = ['Nuevo', 'En progreso', 'Cerrado por KAM', 'Cerrado por oportunidad satisfactoria', 'Cerrado por API Vendor', 'Fallido', 'Sin caso de onboarding (Ticket HC en progreso)'];
const LISTA_ETAPAS = ['Validación del Onboarding', 'En proceso de verificación de catálogo', 'En proceso de seteo', 'Sin integración confirmada', 'En proceso para pruebas', 'Pedido de prueba realizado'];

export default function Dashboard({ role, email, onLogout }) {
  const [activeTab, setActiveTab] = useState(role === 'Supervisor' ? 'global' : 'inicio');
  const [casos, setCasos] = useState([]);
  const [listaIntegraciones, setListaIntegraciones] = useState([]);
  
  // Estados de Búsqueda
  const [busquedaId, setBusquedaId] = useState("");
  const [historialBusqueda, setHistorialBusqueda] = useState([]);
  const [cargandoBusqueda, setCargandoBusqueda] = useState(false);

  const nombreUsuarioAutenticado = email.split('@')[0];

  // Estado del Formulario (Campos a - p)
  const [formulario, setFormulario] = useState({
    casoOp: '', // a
    vendorId: '', // b
    tienda: '', // c
    pais: '', // d
    kam: '', // e
    integracion: '', // f
    oportunidad: '', // g
    asset: '', // h
    propietarioOportunidad: 'Jean Palomino', // i (Editable, inicializado por defecto)
    propietarioTicket: nombreUsuarioAutenticado, // j (Fijo, automático)
    casoSeguimiento: '', // k
    tieneCasoInicio: 'Si', // l
    comentarios: '', // m
    estado: 'Nuevo', // n
    etapa: 'Validación del Onboarding', // o
    fechaCreacion: new Date().toISOString().split('T')[0] // p
  });

  useEffect(() => {
    const unicas = [...new Set(integracionesData.map(item => item["Nombre de la Integración"]))]
      .filter(Boolean).sort();
    setListaIntegraciones(unicas);
  }, []);

  useEffect(() => {
    let q;
    const casosRef = collection(db, "casos");
    if (activeTab === 'global' && role === 'Supervisor') {
      q = query(casosRef, where("estado", "==", "En progreso"));
    } else if (activeTab === 'inicio') {
      q = query(casosRef, where("estado", "==", "En progreso"), where("agente", "==", email));
    } else {
      return; 
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCasos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [role, email, activeTab]);

  const manejarBusqueda = async () => {
    if (!busquedaId.trim()) return;
    setCargandoBusqueda(true);
    setHistorialBusqueda([]);
    
    try {
      const term = busquedaId.trim();
      const qString = query(collection(db, "casos"), where("vendor_id", "==", term));
      const qNumber = query(collection(db, "casos"), where("vendor_id", "==", Number(term)));

      const [snapString, snapNumber] = await Promise.all([getDocs(qString), getDocs(qNumber)]);
      const resultados = [...snapString.docs, ...snapNumber.docs].map(doc => ({ id: doc.id, ...doc.data() }));
      
      setHistorialBusqueda(resultados);

      // Si el ID existe, replicar datos b, c, d
      if (resultados.length > 0) {
        const dataTienda = resultados[0];
        setFormulario(prev => ({
          ...prev,
          vendorId: dataTienda.vendor_id || term,
          tienda: dataTienda.tienda || '',
          pais: dataTienda.pais || ''
        }));
      } else {
        // Resetear si es nuevo, conservando el ID buscado
        setFormulario(prev => ({ ...prev, vendorId: term, tienda: '', pais: '' }));
      }
    } catch (error) {
      console.error("Error en búsqueda:", error);
    }
    setCargandoBusqueda(false);
  };

  const manejarCambioFormulario = (e) => {
    const { name, value } = e.target;
    setFormulario(prev => ({ ...prev, [name]: value }));
  };

  const guardarNuevoCaso = async () => {
    if (!formulario.casoOp) return alert("El N° Caso OP (a) es obligatorio para guardar.");
    
    try {
      const casoRef = doc(db, "casos", formulario.casoOp);
      await setDoc(casoRef, {
        ...formulario,
        // Estandarizamos los campos para que tu tabla de inicio los lea correctamente
        vendor_id: formulario.vendorId, 
        agente: formulario.propietarioTicket,
        sla_inicio: new Date().toISOString()
      });
      alert("¡Caso guardado exitosamente en Firebase!");
      manejarBusqueda(); 
    } catch (error) {
      console.error("Error al guardar:", error);
    }
  };

  return (
    <div className="flex h-screen bg-[#0f111a] text-gray-200 font-sans">
      
      <div className="w-64 bg-[#161925] border-r border-gray-800 flex flex-col justify-between">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-gray-800">
            <div className="w-8 h-8 bg-pink-600 rounded-md flex items-center justify-center font-bold text-white">HC</div>
            <h1 className="text-xl font-bold text-pink-500">HeroCare ONB</h1>
          </div>
          <nav className="p-4 flex flex-col gap-2">
            <button onClick={() => setActiveTab('inicio')} className={`text-left px-4 py-2 rounded-lg ${activeTab === 'inicio' ? 'bg-pink-600 text-white' : 'hover:bg-gray-800'}`}>🚨 Mis Alertas</button>
            <button onClick={() => setActiveTab('nuevo')} className={`text-left px-4 py-2 rounded-lg ${activeTab === 'nuevo' ? 'bg-pink-600 text-white' : 'hover:bg-gray-800'}`}>🔍 Consultar / Nuevo</button>
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'nuevo' && (
          <div className="max-w-7xl mx-auto mt-4">
            
            <div className="bg-[#1a1d27] p-4 rounded-xl border border-gray-800 flex gap-4 mb-6">
              <input 
                type="text" 
                value={busquedaId}
                onChange={(e) => setBusquedaId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && manejarBusqueda()}
                placeholder="Ingrese VendorID (ej. 637917) y presione Enter..." 
                className="flex-1 bg-[#0f111a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500" 
              />
              <button onClick={manejarBusqueda} disabled={cargandoBusqueda} className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-8 rounded-lg transition disabled:opacity-50">
                {cargandoBusqueda ? 'Buscando...' : 'Consultar Local'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* HISTORIAL */}
              <div className="xl:col-span-1 bg-[#1a1d27] p-6 rounded-xl border border-gray-800 max-h-[850px] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">Historial Previo</h3>
                <div className="flex flex-col gap-3">
                  {historialBusqueda.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin registros previos. Se habilitará la creación limpia.</p>
                  ) : (
                    historialBusqueda.map((caso) => (
                      <div key={caso.id} className="bg-[#0f111a] p-4 rounded-lg border-l-4 border-cyan-500">
                        <p className="font-bold text-sm text-white">OP: {caso.casoOp || caso.id}</p>
                        <p className="text-xs text-gray-400 mt-1">Estado: <span className="text-cyan-400 font-semibold">{caso.estado}</span></p>
                        <p className="text-xs text-gray-400">Etapa: {caso.etapa}</p>
                        <p className="text-xs text-gray-500 mt-2">KAM: {caso.kam || 'N/A'}</p>
                        <p className="text-xs text-gray-500">Fecha OP: {caso.fechaCreacion || 'N/A'}</p>
                        {caso.comentarios && (
                          <div className="mt-2 p-2 bg-gray-800/50 rounded border border-gray-700/50 text-xs text-gray-400 italic">
                            "{caso.comentarios}"
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* FORMULARIO NUEVO CASO */}
              <div className="xl:col-span-2 bg-[#1a1d27] p-6 rounded-xl border border-pink-900/50">
                <h3 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">Crear / Registrar Oportunidad</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">a. N° Caso OP *</label>
                    <input name="casoOp" value={formulario.casoOp} onChange={manejarCambioFormulario} type="text" className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white focus:border-pink-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">b. ID (Vendor ID)</label>
                    <input name="vendorId" value={formulario.vendorId} onChange={manejarCambioFormulario} type="text" className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 mb-1 block">c. Tienda</label>
                    <input name="tienda" value={formulario.tienda} onChange={manejarCambioFormulario} type="text" className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white focus:border-pink-500" />
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">d. País</label>
                    <select name="pais" value={formulario.pais} onChange={manejarCambioFormulario} className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white">
                      <option value="">Seleccione país...</option>
                      {LISTA_PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">e. KAM</label>
                    <input name="kam" value={formulario.kam} onChange={manejarCambioFormulario} type="text" className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white focus:border-pink-500" />
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">f. Integración</label>
                    <select name="integracion" value={formulario.integracion} onChange={manejarCambioFormulario} className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white">
                      <option value="">Seleccione integración...</option>
                      {listaIntegraciones.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">g. Oportunidad</label>
                    <input name="oportunidad" value={formulario.oportunidad} onChange={manejarCambioFormulario} type="text" className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white focus:border-pink-500" />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">h. Asset</label>
                    <select name="asset" value={formulario.asset} onChange={manejarCambioFormulario} className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white">
                      <option value="">Seleccione Asset...</option>
                      {LISTA_ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">i. Propietario Oportunidad</label>
                    <select name="propietarioOportunidad" value={formulario.propietarioOportunidad} onChange={manejarCambioFormulario} className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white">
                      {LISTA_AGENTES.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">j. Propietario Ticket HeroCare</label>
                    <input value={formulario.propietarioTicket} disabled type="text" className="w-full bg-[#0f111a] border border-gray-700 text-gray-500 rounded p-2 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">k. N° Caso Seguimiento</label>
                    <input name="casoSeguimiento" value={formulario.casoSeguimiento} onChange={manejarCambioFormulario} type="text" className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white focus:border-pink-500" />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">l. ¿Tiene caso de onboarding inicial?</label>
                    <select name="tieneCasoInicio" value={formulario.tieneCasoInicio} onChange={manejarCambioFormulario} className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white">
                      <option value="Si">Si</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">p. Fecha de creación de la OP</label>
                    <input name="fechaCreacion" type="date" value={formulario.fechaCreacion} onChange={manejarCambioFormulario} className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white" />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">n. Estado del caso</label>
                    <select name="estado" value={formulario.estado} onChange={manejarCambioFormulario} className="w-full bg-[#0f111a] border border-cyan-700 rounded p-2 text-cyan-400 font-semibold">
                      {LISTA_ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">o. Etapa del onboarding</label>
                    <select name="etapa" value={formulario.etapa} onChange={manejarCambioFormulario} className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white">
                      {LISTA_ETAPAS.map(et => <option key={et} value={et}>{et}</option>)}
                    </select>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 mb-1 block">m. Comentarios del Onboarding</label>
                    <textarea name="comentarios" value={formulario.comentarios} onChange={manejarCambioFormulario} rows="2" className="w-full bg-[#0f111a] border border-gray-700 rounded p-2 text-white focus:border-pink-500"></textarea>
                  </div>
                </div>

                <button onClick={guardarNuevoCaso} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg mt-6 transition shadow-lg shadow-pink-900/20">
                  Guardar Caso en Base de Datos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}