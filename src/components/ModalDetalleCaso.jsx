import { useState } from 'react';
import { 
  LISTA_INTEGRACIONES, 
  obtenerDetallesIntegracion 
} from '../data/integracionesCuadro';
import { 
  procesarActualizacionCaso, 
  analizarAlertasCaso,
  normalizarFecha 
} from '../utils/onboardingRules';

const LISTA_PAISES = [
  'Argentina', 'Chile', 'Uruguay', 'Ecuador', 'Perú', 
  'Bolivia', 'Colombia', 'Costa Rica', 'El Salvador', 
  'Guatemala', 'Honduras', 'Nicaragua', 'Panamá', 
  'Paraguay', 'República Dominicana', 'Venezuela'
];

const LISTA_ASSETS = [
  'Integración', 'Menú', 'Ambos (Integración y Menú)', 
  'Logística', 'Dispositivo', 'New Business', 
  'Upgrade/Upsell Alta Integracion', 'Upgrade/Upsell Baja Integracion', 
  'Franchise Extension', 'Win Back', 'Otros'
];

const LISTA_AGENTES = [
  'Jean Palomino', 'Prisila Leon', 'Joel Tocas', 
  'Yadira Flores', 'Guillermo Gonzales', 'Jean Changanaqui', 
  'Henry Serrato', 'Joseline Yactayo', 'Comercial', 'Sin asignación'
];

const LISTA_ESTADOS = [
  'Nuevo', 'En progreso', 'Ticket HC', 
  'Cerrado por oportunidad satisfactoria', 
  'Cerrado por KAM', 'Cerrado por API Vendor', 'Fallido'
];

const LISTA_ETAPAS = [
  'Sin integración confirmada', 
  'En proceso de seteo', 
  'En proceso de verificación de catálogo', 
  'Validación del Onboarding', 
  'En proceso para pruebas', 
  'Pedido de prueba realizado'
];

const LISTA_OPORTUNIDADES = [
  'Franchise Extension', 'New Business', 'Sabor y Arte', 
  'Migración de Sistema', 'Apertura de Sucursal', 'Reingreso', 
  'Cambio de Razón Social', 'Upgrade/Upsell Alta Integracion', 
  'Upgrade/Upsell Baja Integracion'
];

export default function ModalDetalleCaso({ caso, alCerrar, alActualizar, alReplicarTienda, nombreUsuarioAutenticado }) {
  const [form, setForm] = useState(() => ({
    id: caso?.id || caso?.casoOp || '',
    casoOp: caso?.casoOp || caso?.id || '',
    vendorId: caso?.vendor_id || caso?.vendorId || '',
    tienda: caso?.tienda || '',
    pais: caso?.pais || '',
    kam: caso?.kam || '',
    integracion: caso?.integracion || '',
    oportunidad: caso?.oportunidad || '',
    asset: caso?.asset || 'Integración',
    propietarioOportunidad: caso?.propietarioOportunidad || nombreUsuarioAutenticado || 'Jean Palomino',
    propietarioTicket: caso?.propietarioTicket || caso?.agente || 'Jean Palomino',
    casoSeguimiento: caso?.casoSeguimiento || '',
    tieneCasoInicio: caso?.tieneCasoInicio || 'Si',
    comentarios: caso?.comentarios || '',
    estado: caso?.estado || 'En progreso',
    etapa: caso?.etapa || 'Validación del Onboarding',
    fechaCreacion: normalizarFecha(caso?.fechaCreacion || ''),
    fechaCierre: normalizarFecha(caso?.fechaCierre || ''),
    
    // Seguimiento POS API
    fechaInicioPos: normalizarFecha(caso?.fechaInicioPos || ''),
    fechaPushPos: caso?.fechaPushPos || '',
    respuestaPos: caso?.respuestaPos || '',
    pushKamPos: Boolean(caso?.pushKamPos),
    freezePos: caso?.freezePos || '',
    
    // Seguimiento Catálogo
    fechaInicioCat: normalizarFecha(caso?.fechaInicioCat || ''),
    fechaPushCat: caso?.fechaPushCat || '',
    respuestaCat: caso?.respuestaCat || '',
    pushKamCat: Boolean(caso?.pushKamCat),
    freezeCat: caso?.freezeCat || '',

    sla_inicio: caso?.sla_inicio || new Date().toISOString()
  }));

  const [guardando, setGuardando] = useState(false);
  const [tabActiva, setTabActiva] = useState('general'); // 'general' | 'seguimiento'
  const [cambioDetectado, setCambioDetectado] = useState(false);

  // Análisis de alertas de Push y SLA
  const alertas = analizarAlertasCaso(form);
  const detallesIntegracion = obtenerDetallesIntegracion(form.integracion);

  if (!caso) return null;

  const manejarCambio = (e) => {
    const { name, value, type, checked } = e.target;
    const nuevoValor = type === 'checkbox' ? checked : value;
    
    setForm(prev => {
      const actualizados = { ...prev, [name]: nuevoValor };
      // Evaluamos las reglas reactivas de negocio inmediatamente
      const procesado = procesarActualizacionCaso(prev, { [name]: nuevoValor });
      return { ...actualizados, ...procesado };
    });
    setCambioDetectado(true);
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      // Ejecutamos la validación integral de reglas de negocio
      const casoFinal = procesarActualizacionCaso(caso, form);
      await alActualizar(casoFinal);
      setCambioDetectado(false);
    } catch (err) {
      console.error('Error guardando cambios del caso:', err);
    } finally {
      setGuardando(false);
    }
  };

  const usarDatosParaNuevaOp = () => {
    alReplicarTienda({
      vendorId: form.vendorId,
      tienda: form.tienda,
      pais: form.pais,
      kam: form.kam,
      integracion: form.integracion
    });
    alCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-[#161925] border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* HEADER MODAL */}
        <div className="p-5 border-b border-gray-800 bg-[#12141e] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-pink-600/20 border border-pink-500/40 flex items-center justify-center text-pink-400 font-bold">
              OP
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white font-mono">
                  Caso OP: {form.casoOp || form.id}
                </h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  form.estado.toLowerCase().includes('cerrado') 
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' 
                    : form.estado.toLowerCase().includes('fallido')
                    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                    : 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                }`}>
                  {form.estado}
                </span>
                {alertas.estaCongelado && (
                  <span className="text-[11px] bg-indigo-950/80 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded-full">
                    ❄️ SLA Pausado (Freeze)
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                <strong className="text-gray-200">{form.tienda || 'Sin tienda'}</strong> • Vendor ID: <span className="font-mono text-pink-400">{form.vendorId || 'N/A'}</span> • {form.pais || 'Sin país'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={usarDatosParaNuevaOp}
              title="Cargar tienda, ID y país en el formulario de la derecha para registrar una nueva OP"
              className="hidden sm:flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-pink-400 border border-pink-500/30 px-3 py-1.5 rounded-lg transition"
            >
              <span>➕</span>
              <span>Replicar Tienda</span>
            </button>
            <button 
              onClick={alCerrar} 
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 text-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ALERT BAR STATUS */}
        <div className="bg-[#0f111a] px-5 py-2.5 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-gray-400">Estado de Seguimiento:</span>
            {alertas.requierePushPos ? (
              <span className="bg-amber-950/80 text-amber-300 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                <span>⚠️</span> Push POS API Requerido ({alertas.motivoPushPos})
              </span>
            ) : (
              <span className="text-gray-400 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded">
                POS API: {form.respuestaPos || 'Al día'}
              </span>
            )}

            {alertas.requierePushCat ? (
              <span className="bg-pink-950/80 text-pink-300 border border-pink-800 px-2 py-0.5 rounded flex items-center gap-1">
                <span>📦</span> Push Catálogo Requerido ({alertas.motivoPushCat})
              </span>
            ) : (
              <span className="text-gray-400 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded">
                Catálogo: {form.respuestaCat || 'Al día'}
              </span>
            )}

            {alertas.esVencido && (
              <span className="bg-rose-950/80 text-rose-300 border border-rose-800 px-2 py-0.5 rounded animate-pulse">
                🚨 SLA Vencido ({alertas.horasTranscurridas}h)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTabActiva('general')}
              className={`px-3 py-1 rounded-md transition ${tabActiva === 'general' ? 'bg-pink-600 text-white font-medium' : 'text-gray-400 hover:text-white'}`}
            >
              Datos del Caso (a - p)
            </button>
            <button
              onClick={() => setTabActiva('seguimiento')}
              className={`px-3 py-1 rounded-md transition ${tabActiva === 'seguimiento' ? 'bg-pink-600 text-white font-medium' : 'text-gray-400 hover:text-white'}`}
            >
              Seguimiento POS & Catálogo
            </button>
          </div>
        </div>

        {/* CUERPO DEL MODAL */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {tabActiva === 'general' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* a. N° Caso OP */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">a. N° Caso OP (Identificador)</label>
                <input 
                  type="text" 
                  value={form.casoOp} 
                  disabled
                  className="w-full bg-[#0f111a] border border-gray-800 rounded-lg p-2.5 text-pink-400 font-mono cursor-not-allowed"
                />
              </div>

              {/* b. ID */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">b. ID (Vendor ID)</label>
                <input 
                  type="text" 
                  name="vendorId" 
                  value={form.vendorId} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white font-mono focus:border-pink-500"
                />
              </div>

              {/* c. Tienda */}
              <div className="sm:col-span-2">
                <label className="text-gray-400 block mb-1 font-medium">c. Tienda</label>
                <input 
                  type="text" 
                  name="tienda" 
                  value={form.tienda} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-medium"
                />
              </div>

              {/* d. País */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">d. País *</label>
                <select 
                  name="pais" 
                  value={form.pais} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                >
                  <option value="">Seleccione país...</option>
                  {LISTA_PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* e. Kam */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">e. KAM</label>
                <input 
                  type="text" 
                  name="kam" 
                  value={form.kam} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                />
              </div>

              {/* f. Integración */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">f. Integración *</label>
                <select 
                  name="integracion" 
                  value={form.integracion} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                >
                  <option value="">Seleccione integración...</option>
                  {LISTA_INTEGRACIONES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* g. Oportunidad */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">g. Oportunidad</label>
                <select 
                  name="oportunidad" 
                  value={form.oportunidad} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                >
                  <option value="">Seleccione oportunidad...</option>
                  {LISTA_OPORTUNIDADES.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>

              {/* Contactos del Cuadro de Integraciones */}
              {detallesIntegracion && (
                <div className="sm:col-span-2 bg-[#0f111a] border border-gray-800 p-3 rounded-lg text-[11px]">
                  <p className="text-pink-400 font-semibold mb-1">
                    Contactos para integración {detallesIntegracion.integracion}:
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {detallesIntegracion.contactos.map((c, i) => (
                      <span key={i} className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700 font-mono">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* h. Asset */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">h. Asset *</label>
                <select 
                  name="asset" 
                  value={form.asset} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                >
                  {LISTA_ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* i. Propietario Oportunidad */}
              <div>
                <label className="text-pink-400 block mb-1 font-semibold flex items-center justify-between">
                  <span>i. Propietario Oportunidad (Editable)</span>
                  <span className="text-[10px] text-gray-400 font-normal">Actualiza en Sheets sin duplicar</span>
                </label>
                <select 
                  name="propietarioOportunidad" 
                  value={form.propietarioOportunidad} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-pink-700/60 rounded-lg p-2.5 text-white focus:border-pink-500 font-medium"
                >
                  {LISTA_AGENTES.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                </select>
              </div>

              {/* j. Propietario Ticket HeroCare */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">j. Propietario Ticket HeroCare (Fijo)</label>
                <input 
                  type="text" 
                  value={form.propietarioTicket} 
                  disabled
                  className="w-full bg-[#0f111a] border border-gray-800 rounded-lg p-2.5 text-gray-400 cursor-not-allowed"
                />
              </div>

              {/* k. N° Caso Seguimiento */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">k. N° Caso Seguimiento</label>
                <input 
                  type="text" 
                  name="casoSeguimiento" 
                  value={form.casoSeguimiento} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-mono"
                />
              </div>

              {/* l. ¿Tiene caso de onboarding en el inicio? */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">l. ¿Tiene caso de onboarding en inicio?</label>
                <select 
                  name="tieneCasoInicio" 
                  value={form.tieneCasoInicio} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white"
                >
                  <option value="Si">Si</option>
                  <option value="No">No</option>
                </select>
              </div>

              {/* p. Fecha Creación OP */}
              <div>
                <label className="text-gray-400 block mb-1 font-medium">p. Fecha de creación de la OP</label>
                <input 
                  type="date" 
                  name="fechaCreacion" 
                  value={form.fechaCreacion} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white"
                />
              </div>

              {/* n. Estado del caso */}
              <div>
                <label className="text-cyan-400 block mb-1 font-semibold">n. Estado del caso (SF)</label>
                <select 
                  name="estado" 
                  value={form.estado} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-cyan-700 rounded-lg p-2.5 text-cyan-300 font-bold"
                >
                  {LISTA_ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Regla 1: Si cambia a Cerrado o Fallido se estampa automáticamente Fecha de Cierre. Si vuelve a &quot;En progreso&quot;, se borra.
                </p>
              </div>

              {/* o. Etapa del onboarding */}
              <div>
                <label className="text-cyan-400 block mb-1 font-semibold">o. Etapa del onboarding</label>
                <select 
                  name="etapa" 
                  value={form.etapa} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white"
                >
                  {LISTA_ETAPAS.map(et => <option key={et} value={et}>{et}</option>)}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Reglas 2 y 3: Saltos de etapa autollenan S/V o deducen Sí/No según inicio de seguimientos.
                </p>
              </div>

              {/* Fecha de Cierre */}
              {form.fechaCierre && (
                <div className="sm:col-span-2 bg-emerald-950/30 border border-emerald-800 p-2.5 rounded-lg text-[11px] text-emerald-300 flex items-center justify-between">
                  <span>🏁 Fecha de Cierre Registrada:</span>
                  <span className="font-mono font-semibold">{form.fechaCierre}</span>
                </div>
              )}

              {/* m. Comentarios del Onboarding */}
              <div className="sm:col-span-2">
                <label className="text-gray-400 block mb-1 font-medium">m. Comentarios del Onboarding</label>
                <textarea 
                  name="comentarios" 
                  value={form.comentarios} 
                  onChange={manejarCambio}
                  rows={3} 
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 text-xs"
                  placeholder="Escriba aquí los avances y notas de seguimiento..."
                ></textarea>
              </div>

            </div>
          )}

          {tabActiva === 'seguimiento' && (
            <div className="space-y-6 text-xs">
              
              {/* TRACK 1: SEGUIMIENTO POS API */}
              <div className="bg-[#0f111a] border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🖥️</span>
                    <h4 className="font-bold text-white text-sm">Seguimiento POS API</h4>
                  </div>
                  {alertas.requierePushPos && (
                    <span className="bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded text-[11px]">
                      ⚠️ Alerta: Requiere Push
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-gray-400 block mb-1">Fecha de Inicio POS API</label>
                    <input 
                      type="text" 
                      name="fechaInicioPos" 
                      value={form.fechaInicioPos} 
                      onChange={manejarCambio}
                      placeholder="YYYY-MM-DD o S/V"
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1">Fecha de Push POS API</label>
                    <input 
                      type="text" 
                      name="fechaPushPos" 
                      value={form.fechaPushPos} 
                      onChange={manejarCambio}
                      placeholder="YYYY-MM-DD o S/V"
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1">Respuesta Roadmap POS API</label>
                    <select 
                      name="respuestaPos" 
                      value={form.respuestaPos} 
                      onChange={manejarCambio}
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-semibold"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Sí">Sí</option>
                      <option value="No">No</option>
                      <option value="S/V">S/V</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="pushKamPos" 
                      checked={form.pushKamPos} 
                      onChange={manejarCambio}
                      className="accent-pink-600 rounded"
                    />
                    <span>Push KAM (Check automático si Sí o S/V)</span>
                  </label>
                  <div>
                    Freeze Ancla: <span className="font-mono text-cyan-400">{form.freezePos || 'Sin Freeze (SLA activo)'}</span>
                  </div>
                </div>
              </div>

              {/* TRACK 2: SEGUIMIENTO CATÁLOGO */}
              <div className="bg-[#0f111a] border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <h4 className="font-bold text-white text-sm">Seguimiento Catálogo</h4>
                  </div>
                  {alertas.requierePushCat && (
                    <span className="bg-pink-950 text-pink-400 border border-pink-800 px-2 py-0.5 rounded text-[11px]">
                      📦 Alerta: Requiere Push Catálogo
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-gray-400 block mb-1">Fecha de Inicio Catálogo</label>
                    <input 
                      type="text" 
                      name="fechaInicioCat" 
                      value={form.fechaInicioCat} 
                      onChange={manejarCambio}
                      placeholder="YYYY-MM-DD o S/V"
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1">Fecha de Push Catálogo</label>
                    <input 
                      type="text" 
                      name="fechaPushCat" 
                      value={form.fechaPushCat} 
                      onChange={manejarCambio}
                      placeholder="YYYY-MM-DD o S/V"
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1">Respuesta Roadmap Catálogo</label>
                    <select 
                      name="respuestaCat" 
                      value={form.respuestaCat} 
                      onChange={manejarCambio}
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-semibold"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Sí">Sí</option>
                      <option value="No">No</option>
                      <option value="S/V">S/V</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="pushKamCat" 
                      checked={form.pushKamCat} 
                      onChange={manejarCambio}
                      className="accent-pink-600 rounded"
                    />
                    <span>Push KAM Catálogo (Check automático)</span>
                  </label>
                  <div>
                    Freeze Ancla Catálogo: <span className="font-mono text-cyan-400">{form.freezeCat || 'Sin Freeze (SLA activo)'}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-gray-800 bg-[#12141e] flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            {cambioDetectado && (
              <span className="text-amber-400 flex items-center gap-1">
                <span>●</span> Modificaciones pendientes por guardar
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={alCerrar}
              className="px-4 py-2 text-xs text-gray-400 hover:text-white transition"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={guardarCambios}
              disabled={guardando}
              className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-5 rounded-lg text-xs transition flex items-center gap-2 shadow-lg shadow-pink-900/20 disabled:opacity-50"
            >
              <span>{guardando ? '💾 Guardando...' : '💾 Actualizar Caso en Google Sheets'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
