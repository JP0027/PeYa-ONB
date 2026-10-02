import React, { useState, useMemo, useEffect } from 'react';
import { 
  LISTA_PAISES,
  LISTA_OPORTUNIDADES,
  LISTA_ASSETS,
  LISTA_ESTADOS,
  LISTA_ETAPAS,
  LISTA_TIENE_INICIO,
  LISTA_AGENTES,
  LISTA_INTEGRACIONES_OFICIALES,
  obtenerSponsorship
} from '../data/catalogoOnboarding';
import { 
  procesarActualizacionCaso, 
  analizarAlertasCaso,
  limpiarTextoEtapa,
  normalizarRespuesta,
  formatearFechaHora,
  esPushKamRealizado,
  resolverOportunidad
} from '../utils/onboardingRules';
import SearchableSelect from './Common/SearchableSelect';

export interface ModalDetalleCasoProps {
  caso: any;
  alCerrar: () => void;
  alActualizar: (caso: any) => Promise<void> | void;
  alReplicarTienda: (datos: any) => void;
  nombreUsuarioAutenticado?: string;
  estados?: string[];
  etapas?: string[];
  oportunidades?: string[];
  agentes?: string[];
  paises?: string[];
  assets?: string[];
  integraciones?: string[];
}

export default function ModalDetalleCaso({ 
  caso, 
  alCerrar, 
  alActualizar, 
  alReplicarTienda, 
  nombreUsuarioAutenticado,
  estados = LISTA_ESTADOS,
  etapas = LISTA_ETAPAS,
  oportunidades = LISTA_OPORTUNIDADES,
  agentes = LISTA_AGENTES,
  paises = LISTA_PAISES,
  assets = LISTA_ASSETS,
  integraciones = []
}: ModalDetalleCasoProps) {
  const casoOpLimpio = useMemo(() => {
    const raw = String(caso?.casoOp || '').trim();
    if (!raw || raw === '-' || raw.toLowerCase() === 'sin caso op' || raw.toLowerCase() === 'null' || raw.startsWith('TEMP_') || raw.startsWith('SIN_OP_') || raw.includes('_r')) {
      return 'Sin caso OP';
    }
    return raw;
  }, [caso]);

  const integracionInicial = String(caso?.integracion || '').trim() || 'Datalive';

  const [form, setForm] = useState(() => ({
    id: caso?.id || caso?.casoOp || '',
    filaNumero: caso?.filaNumero,
    casoOp: casoOpLimpio === 'Sin caso OP' ? '' : casoOpLimpio,
    vendorId: caso?.vendor_id || caso?.vendorId || '',
    tienda: caso?.tienda || '',
    pais: caso?.pais || 'Argentina',
    kam: caso?.kam || '',
    integracion: integracionInicial,
    sponsorship: caso?.sponsorship || obtenerSponsorship(integracionInicial),
    descuentosBajoEstructuraSponsorship: caso?.descuentosBajoEstructuraSponsorship || obtenerSponsorship(integracionInicial),
    oportunidad: resolverOportunidad(caso?.oportunidad, oportunidades),
    asset: caso?.asset || 'Integración',
    propietarioOportunidad: caso?.propietarioOportunidad || nombreUsuarioAutenticado || '',
    propietarioTicket: caso?.propietarioTicket || caso?.agente || nombreUsuarioAutenticado || '',
    casoSeguimiento: caso?.casoSeguimiento || '',
    tieneCasoInicio: caso?.tieneCasoInicio || 'Si',
    comentarios: caso?.comentarios || '',
    estado: caso?.estado || 'En progreso',
    etapa: limpiarTextoEtapa(caso?.etapa, caso?.comentarios, caso?.integracion),
    fechaCreacion: formatearFechaHora(caso?.fechaCreacion || ''),
    fechaCierre: formatearFechaHora(caso?.fechaCierre || ''),
    
    // Seguimiento POS API
    fechaInicioPos: formatearFechaHora(caso?.fechaInicioPos || ''),
    fechaPushPos: formatearFechaHora(caso?.fechaPushPos || ''),
    respuestaPos: normalizarRespuesta(caso?.respuestaPos),
    pushKamPos: esPushKamRealizado(caso?.pushKamPos),
    freezePos: caso?.fechaFreezePos || caso?.freezePos || '',
    fechaFreezePos: caso?.fechaFreezePos || caso?.freezePos || '',
    
    // Seguimiento Catálogo
    fechaInicioCat: formatearFechaHora(caso?.fechaInicioCat || ''),
    fechaPushCat: formatearFechaHora(caso?.fechaPushCat || ''),
    respuestaCat: normalizarRespuesta(caso?.respuestaCat),
    pushKamCat: esPushKamRealizado(caso?.pushKamCat),
    freezeCat: caso?.fechaFreezeCat || caso?.freezeCat || '',
    fechaFreezeCat: caso?.fechaFreezeCat || caso?.freezeCat || '',

    sla_inicio: caso?.sla_inicio || formatearFechaHora(new Date())
  }));

  const [guardando, setGuardando] = useState<boolean>(false);
  const [tabActiva, setTabActiva] = useState<'datos' | 'seguimiento'>('datos');
  const [cambioDetectado, setCambioDetectado] = useState<boolean>(false);

  useEffect(() => {
    if (caso) {
      const intLimpia = String(caso.integracion || '').trim();
      const opLimpia = resolverOportunidad(caso.oportunidad, oportunidades);
      setForm(prev => ({
        ...prev,
        ...caso,
        id: caso.id || caso.casoOp || '',
        filaNumero: caso.filaNumero || prev.filaNumero,
        casoOp: casoOpLimpio === 'Sin caso OP' ? '' : casoOpLimpio,
        vendorId: caso.vendor_id || caso.vendorId || '',
        tienda: caso.tienda || '',
        integracion: intLimpia || prev.integracion || 'Datalive',
        sponsorship: caso.sponsorship || obtenerSponsorship(intLimpia || prev.integracion || 'Datalive'),
        descuentosBajoEstructuraSponsorship: caso.descuentosBajoEstructuraSponsorship || obtenerSponsorship(intLimpia || prev.integracion || 'Datalive'),
        oportunidad: opLimpia,
        pushKamPos: esPushKamRealizado(caso.pushKamPos),
        pushKamCat: esPushKamRealizado(caso.pushKamCat),
        respuestaPos: normalizarRespuesta(caso.respuestaPos),
        respuestaCat: normalizarRespuesta(caso.respuestaCat)
      }));
    }
  }, [caso, casoOpLimpio, oportunidades]);

  const listaIntegracionesFinal = useMemo(() => {
    const base = Array.isArray(integraciones) && integraciones.length > 0 
      ? integraciones 
      : LISTA_INTEGRACIONES_OFICIALES;
    const lista = [...base];
    const actual = String(form.integracion || caso?.integracion || '').trim();
    if (actual && !lista.some(i => i.toLowerCase().trim() === actual.toLowerCase().trim())) {
      lista.unshift(actual);
    }
    return Array.from(new Set(lista));
  }, [integraciones, form.integracion, caso]);

  // Análisis de alertas de Push y SLA para badge compacto
  const alertas = analizarAlertasCaso(form);

  const listaOportunidadesDisponibles = useMemo(() => {
    const base = Array.isArray(oportunidades) && oportunidades.length > 0 ? oportunidades : LISTA_OPORTUNIDADES;
    const lista = [...base];
    const valActual = String(form.oportunidad || '').trim();
    if (valActual && valActual !== 'Seleccione oportunidad...') {
      const existe = lista.some(op => 
        op.toLowerCase().trim() === valActual.toLowerCase() ||
        op.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() === valActual.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
      );
      if (!existe) {
        lista.push(valActual);
      }
    }
    return Array.from(new Set(lista));
  }, [oportunidades, form.oportunidad]);

  if (!caso) return null;

  const manejarCambio = (e: any) => {
    const { name, value, type, checked } = e.target;
    let nuevoValor = type === 'checkbox' ? checked : value;
    if (name === 'respuestaPos' || name === 'respuestaCat') {
      nuevoValor = normalizarRespuesta(nuevoValor);
    }
    
    setForm(prev => {
      let extra: Record<string, any> = {};
      if (name === 'integracion') {
        const spon = obtenerSponsorship(nuevoValor);
        extra = {
          sponsorship: spon,
          descuentosBajoEstructuraSponsorship: spon
        };
      }
      const cambios = { [name]: nuevoValor, ...extra };
      const procesado = procesarActualizacionCaso(prev, cambios);
      return { ...prev, ...procesado, ...cambios, [name]: nuevoValor };
    });
    setCambioDetectado(true);
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const casoFinal = procesarActualizacionCaso(caso, form);
      casoFinal.esNuevo = false;
      if (form.filaNumero || caso?.filaNumero) {
        casoFinal.filaNumero = form.filaNumero || caso?.filaNumero;
      }
      if (form.id || caso?.id) {
        casoFinal.id = form.id || caso?.id;
      }
      if (form.freezePos || form.fechaFreezePos) {
        casoFinal.fechaFreezePos = form.fechaFreezePos || form.freezePos;
        casoFinal.freezePos = casoFinal.fechaFreezePos;
      }
      if (form.freezeCat || form.fechaFreezeCat) {
        casoFinal.fechaFreezeCat = form.fechaFreezeCat || form.freezeCat;
        casoFinal.freezeCat = casoFinal.fechaFreezeCat;
      }
      if (form.pushKamPos !== undefined) {
        casoFinal.pushKamPos = Boolean(form.pushKamPos);
      }
      if (form.pushKamCat !== undefined) {
        casoFinal.pushKamCat = Boolean(form.pushKamCat);
      }
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
      integracion: form.integracion,
      oportunidad: form.oportunidad,
      asset: form.asset
    });
    alCerrar();
  };

  const tituloCasoOp = form.casoOp && form.casoOp !== '-' ? form.casoOp : 'Sin caso OP';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-[#161925] border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        
        {/* HEADER MODAL - Simple y elegante */}
        <div className="p-4 sm:p-5 border-b border-gray-800 bg-[#12141e] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-600/20 border border-pink-500/40 flex items-center justify-center text-pink-400 font-bold text-sm">
              OP
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white font-mono">
                  Caso OP: <span className={tituloCasoOp === 'Sin caso OP' ? 'text-gray-400 italic font-sans' : 'text-pink-400'}>{tituloCasoOp}</span>
                </h3>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                  form.estado.toLowerCase().includes('cerrado') 
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' 
                    : form.estado.toLowerCase().includes('fallido')
                    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                    : 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                }`}>
                  {form.estado}
                </span>
                {alertas.horasTranscurridas !== undefined && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${alertas.colorClass}`}>
                    SLA: {alertas.horasTranscurridas}h
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
              type="button"
              onClick={usarDatosParaNuevaOp}
              title="Replicar tienda y datos en el formulario para una nueva OP"
              className="hidden sm:flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-pink-400 border border-pink-500/30 px-3 py-1.5 rounded-lg transition font-medium cursor-pointer"
            >
              <span>➕</span>
              <span>Replicar Tienda</span>
            </button>
            <button 
              type="button"
              onClick={alCerrar} 
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 text-lg transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* TABS SIMPLES: Exactamente 2 pestañas */}
        <div className="bg-[#0f111a] px-5 pt-2 border-b border-gray-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTabActiva('datos')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer ${
                tabActiva === 'datos' 
                  ? 'border-pink-500 text-pink-400 bg-[#161925]' 
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              📝 Datos del caso
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('seguimiento')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                tabActiva === 'seguimiento' 
                  ? 'border-pink-500 text-pink-400 bg-[#161925]' 
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>⏱️ Seguimiento</span>
              {(alertas.requierePushPos || alertas.requierePushCat) && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              )}
            </button>
          </div>

          <button 
            type="button"
            onClick={usarDatosParaNuevaOp}
            className="sm:hidden text-[11px] text-pink-400 hover:underline py-1"
          >
            ➕ Replicar
          </button>
        </div>

        {/* CUERPO DEL MODAL */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* PESTAÑA 1: DATOS DEL CASO */}
          {tabActiva === 'datos' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              
              <div>
                <label className="text-gray-400 block mb-1 font-medium">N° Caso OP</label>
                <input 
                  type="text" 
                  name="casoOp"
                  value={form.casoOp} 
                  onChange={manejarCambio}
                  placeholder="Pendiente (vacío si no tiene OP)..."
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-pink-400 font-mono focus:border-pink-500 placeholder-gray-600"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">Vendor ID</label>
                <input 
                  type="text" 
                  name="vendorId" 
                  value={form.vendorId} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white font-mono focus:border-pink-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-gray-400 block mb-1 font-medium">Nombre de Tienda</label>
                <input 
                  type="text" 
                  name="tienda" 
                  value={form.tienda} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">País</label>
                <select 
                  name="pais" 
                  value={form.pais} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                >
                  <option value="">Seleccione país...</option>
                  {paises.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">KAM</label>
                <input 
                  type="text" 
                  name="kam" 
                  value={form.kam} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-400 font-medium">Integración</label>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${form.sponsorship === 'SI' ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300' : 'bg-gray-800/80 border-gray-700 text-gray-400'}`}>
                    Sponsorship: {form.sponsorship || 'NO'}
                  </span>
                </div>
                <SearchableSelect
                  name="integracion"
                  value={form.integracion}
                  onChange={(val) => {
                    const spon = obtenerSponsorship(val);
                    setForm(prev => {
                      const cambios = { 
                        integracion: val, 
                        sponsorship: spon, 
                        descuentosBajoEstructuraSponsorship: spon 
                      };
                      const procesado = procesarActualizacionCaso(prev, cambios);
                      return { ...prev, ...procesado, ...cambios, integracion: val };
                    });
                    setCambioDetectado(true);
                  }}
                  options={listaIntegracionesFinal.map(i => ({
                    label: i,
                    value: i,
                    badge: obtenerSponsorship(i)
                  }))}
                  placeholder="Buscar integración..."
                  searchPlaceholder="Escribe para buscar integración..."
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">Oportunidad</label>
                <SearchableSelect
                  name="oportunidad"
                  value={resolverOportunidad(form.oportunidad, listaOportunidadesDisponibles)}
                  onChange={(val) => {
                    setForm(prev => {
                      const cambios = { oportunidad: val };
                      const procesado = procesarActualizacionCaso(prev, cambios);
                      return { ...prev, ...procesado, ...cambios, oportunidad: val };
                    });
                    setCambioDetectado(true);
                  }}
                  options={listaOportunidadesDisponibles}
                  placeholder="Buscar oportunidad..."
                  searchPlaceholder="Filtrar oportunidad..."
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">Asset</label>
                <select 
                  name="asset" 
                  value={form.asset} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                >
                  {assets.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">Propietario Oportunidad</label>
                <select 
                  name="propietarioOportunidad" 
                  value={form.propietarioOportunidad} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                >
                  {agentes.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                  {form.propietarioOportunidad && !agentes.includes(form.propietarioOportunidad) && (
                    <option value={form.propietarioOportunidad}>{form.propietarioOportunidad}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">Propietario Ticket</label>
                <select 
                  name="propietarioTicket" 
                  value={form.propietarioTicket} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500"
                >
                  {agentes.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                  {form.propietarioTicket && !agentes.includes(form.propietarioTicket) && (
                    <option value={form.propietarioTicket}>{form.propietarioTicket}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">N° Caso Seguimiento</label>
                <input 
                  type="text" 
                  name="casoSeguimiento" 
                  value={form.casoSeguimiento} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">¿Tiene caso en inicio?</label>
                <select 
                  name="tieneCasoInicio" 
                  value={form.tieneCasoInicio} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white"
                >
                  {LISTA_TIENE_INICIO.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="text-cyan-400 block mb-1 font-semibold">Estado del caso</label>
                <select 
                  name="estado" 
                  value={form.estado} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-cyan-700 rounded-lg p-2.5 text-cyan-300 font-bold"
                >
                  {estados.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className="text-cyan-400 block mb-1 font-semibold">Etapa del onboarding</label>
                <select 
                  name="etapa" 
                  value={form.etapa} 
                  onChange={manejarCambio}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white"
                >
                  {etapas.map(et => <option key={et} value={et}>{et}</option>)}
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-medium">Fecha Creación OP</label>
                <input 
                  type="text" 
                  name="fechaCreacion" 
                  value={form.fechaCreacion} 
                  onChange={manejarCambio}
                  placeholder="DD/MM/YYYY HH:mm"
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              {form.fechaCierre && (
                <div>
                  <label className="text-emerald-400 block mb-1 font-medium">Fecha de Cierre</label>
                  <input 
                    type="text" 
                    name="fechaCierre" 
                    value={form.fechaCierre} 
                    onChange={manejarCambio}
                    placeholder="DD/MM/YYYY HH:mm"
                    className="w-full bg-[#0f111a] border border-emerald-700/60 rounded-lg p-2.5 text-emerald-300 font-mono"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="text-gray-400 block mb-1 font-medium">Comentarios del Onboarding</label>
                <textarea 
                  name="comentarios" 
                  value={form.comentarios} 
                  onChange={manejarCambio}
                  rows={2} 
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-white focus:border-pink-500 text-xs"
                  placeholder="Notas y avances del caso..."
                ></textarea>
              </div>

            </div>
          )}

          {/* PESTAÑA 2: SEGUIMIENTO */}
          {tabActiva === 'seguimiento' && (
            <div className="space-y-4 text-xs">
              
              {/* POS API */}
              <div className="bg-[#0f111a] border border-gray-800 rounded-xl p-3.5 sm:p-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🖥️</span>
                    <h4 className="font-bold text-white text-sm">Seguimiento POS API</h4>
                    {alertas.tiempoTranscurridoPos && alertas.tiempoTranscurridoPos !== '-' && (
                      <span className="bg-gray-800 text-cyan-300 font-mono text-[10px] px-2 py-0.5 rounded border border-gray-700">
                        {alertas.tiempoTranscurridoPos}
                      </span>
                    )}
                  </div>
                  {alertas.requierePushPos && (
                    <span className="bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded text-[10px]">
                      ⚠️ Push Requerido
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
                      placeholder="DD/MM/YYYY HH:mm o S/V"
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-400">Fecha Push POS API</label>
                      <button
                        type="button"
                        onClick={() => {
                          const fechaNow = formatearFechaHora(new Date());
                          manejarCambio({ target: { name: 'fechaPushPos', value: fechaNow } });
                        }}
                        className="text-[10px] bg-amber-600 hover:bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded cursor-pointer"
                        title="Estampar fecha y hora actual (DD/MM/YYYY HH:mm)"
                      >
                        ⚡ Registrar
                      </button>
                    </div>
                    <input 
                      type="text" 
                      name="fechaPushPos" 
                      value={form.fechaPushPos} 
                      onChange={manejarCambio}
                      placeholder="DD/MM/YYYY HH:mm"
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1">Respuesta POS API</label>
                    <select 
                      name="respuestaPos" 
                      value={normalizarRespuesta(form.respuestaPos)} 
                      onChange={manejarCambio}
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-semibold text-xs"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Si">Si</option>
                      <option value="No">No</option>
                      <option value="S/V">S/V</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="pushKamPos" 
                      checked={Boolean(form.pushKamPos)} 
                      onChange={manejarCambio}
                      className="accent-pink-600 rounded cursor-pointer w-4 h-4"
                    />
                    <span className="font-medium text-gray-200">Push KAM POS</span>
                  </label>
                  {form.freezePos && (
                    <div>
                      Freeze: <span className="font-mono text-cyan-400">{form.freezePos}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CATÁLOGO */}
              <div className="bg-[#0f111a] border border-gray-800 rounded-xl p-3.5 sm:p-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <h4 className="font-bold text-white text-sm">Seguimiento Catálogo</h4>
                    {alertas.tiempoTranscurridoCat && alertas.tiempoTranscurridoCat !== '-' && (
                      <span className="bg-gray-800 text-pink-300 font-mono text-[10px] px-2 py-0.5 rounded border border-gray-700">
                        {alertas.tiempoTranscurridoCat}
                      </span>
                    )}
                  </div>
                  {alertas.requierePushCat && (
                    <span className="bg-pink-950 text-pink-400 border border-pink-800 px-2 py-0.5 rounded text-[10px]">
                      📦 Push Requerido
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
                      placeholder="DD/MM/YYYY HH:mm o S/V"
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-400">Fecha Push Catálogo</label>
                      <button
                        type="button"
                        onClick={() => {
                          const fechaNow = formatearFechaHora(new Date());
                          manejarCambio({ target: { name: 'fechaPushCat', value: fechaNow } });
                        }}
                        className="text-[10px] bg-pink-600 hover:bg-pink-500 text-white font-bold px-1.5 py-0.5 rounded cursor-pointer"
                        title="Estampar fecha y hora actual (DD/MM/YYYY HH:mm)"
                      >
                        ⚡ Registrar
                      </button>
                    </div>
                    <input 
                      type="text" 
                      name="fechaPushCat" 
                      value={form.fechaPushCat} 
                      onChange={manejarCambio}
                      placeholder="DD/MM/YYYY HH:mm"
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1">Respuesta Catálogo</label>
                    <select 
                      name="respuestaCat" 
                      value={normalizarRespuesta(form.respuestaCat)} 
                      onChange={manejarCambio}
                      className="w-full bg-[#161925] border border-gray-700 rounded p-2 text-white font-semibold text-xs"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Si">Si</option>
                      <option value="No">No</option>
                      <option value="S/V">S/V</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="pushKamCat" 
                      checked={Boolean(form.pushKamCat)} 
                      onChange={manejarCambio}
                      className="accent-pink-600 rounded cursor-pointer w-4 h-4"
                    />
                    <span className="font-medium text-gray-200">Push KAM Catálogo</span>
                  </label>
                  {form.freezeCat && (
                    <div>
                      Freeze: <span className="font-mono text-cyan-400">{form.freezeCat}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* FOOTER ACTIONS - Limpio y centrado en Guardar y Replicar */}
        <div className="p-4 border-t border-gray-800 bg-[#12141e] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-400 flex items-center gap-2">
            {caso.filaNumero && (
              <span className="text-gray-400 font-mono text-[11px]">
                Fila: #{caso.filaNumero}
              </span>
            )}
            {cambioDetectado && (
              <span className="text-amber-400 text-[11px] flex items-center gap-1 font-medium">
                ● Cambios no guardados
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={usarDatosParaNuevaOp}
              className="px-3.5 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-pink-300 border border-pink-900/40 rounded-lg transition font-medium cursor-pointer"
            >
              ➕ Replicar Tienda
            </button>
            <button
              type="button"
              onClick={alCerrar}
              className="px-3.5 py-2 text-xs text-gray-400 hover:text-white transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={guardarCambios}
              disabled={guardando}
              className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-5 rounded-lg text-xs transition flex items-center gap-2 shadow-lg shadow-pink-900/20 disabled:opacity-50 cursor-pointer"
            >
              <span>{guardando ? 'Guardando...' : '💾 Guardar Cambios'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
