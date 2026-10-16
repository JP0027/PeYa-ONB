import React, { useState, useMemo } from 'react';
import {
  LISTA_PAISES,
  LISTA_OPORTUNIDADES,
  LISTA_ASSETS,
  LISTA_TIENE_INICIO,
  LISTA_ESTADOS,
  LISTA_ETAPAS,
  LISTA_AGENTES,
  LISTA_INTEGRACIONES_OFICIALES
} from '../../data/catalogoOnboarding';
import { obtenerTextoCasoOp } from '../../utils/onboardingRules';

export interface ModalCambiosMasivosOnboardingProps {
  abierto: boolean;
  alCerrar: () => void;
  casos: any[];
  catalogos?: Record<string, any[]>;
  nombreUsuarioAutenticado?: string;
  temaClaro?: boolean;
  onActualizarCasos: (casosActualizados: any[]) => Promise<void>;
  onEliminarCasos: (casosAEliminar: any[]) => Promise<void>;
  onAgregarCasos: (casosNuevos: any[]) => Promise<void>;
  mostrarNotificacion?: (texto: string, tipo?: string) => void;
}

type TabMasivo = 'editar' | 'agregar' | 'eliminar';
type ModoAgregar = 'mismos_valores' | 'pegar_lineas';

export default function ModalCambiosMasivosOnboarding({
  abierto,
  alCerrar,
  casos,
  catalogos,
  nombreUsuarioAutenticado = 'Agente',
  temaClaro,
  onActualizarCasos,
  onEliminarCasos,
  onAgregarCasos,
  mostrarNotificacion
}: ModalCambiosMasivosOnboardingProps) {
  if (!abierto) return null;

  // Detección reactiva de modo claro / oscuro
  const esTemaClaro = typeof temaClaro === 'boolean'
    ? temaClaro
    : (typeof document !== 'undefined'
        ? document.documentElement.classList.contains('theme-light') || !document.documentElement.classList.contains('dark')
        : false);

  const [tabActiva, setTabActiva] = useState<TabMasivo>('editar');
  const [procesando, setProcesando] = useState<boolean>(false);
  const [mensajeEstado, setMensajeEstado] = useState<string>('');

  // Listas de catálogos enriquecidas
  const listaPaises = useMemo(() => catalogos?.paises && catalogos.paises.length > 0 ? catalogos.paises : LISTA_PAISES, [catalogos]);
  const listaIntegraciones = useMemo(() => {
    if (catalogos?.integraciones && catalogos.integraciones.length > 0) {
      return catalogos.integraciones.map(item => typeof item === 'string' ? item : item.nombre);
    }
    return LISTA_INTEGRACIONES_OFICIALES;
  }, [catalogos]);
  const listaOportunidades = useMemo(() => catalogos?.oportunidades && catalogos.oportunidades.length > 0 ? catalogos.oportunidades : LISTA_OPORTUNIDADES, [catalogos]);
  const listaAssets = useMemo(() => catalogos?.assets && catalogos.assets.length > 0 ? catalogos.assets : LISTA_ASSETS, [catalogos]);
  const listaEstados = useMemo(() => catalogos?.estados && catalogos.estados.length > 0 ? catalogos.estados : LISTA_ESTADOS, [catalogos]);
  const listaEtapas = useMemo(() => catalogos?.etapas && catalogos.etapas.length > 0 ? catalogos.etapas : LISTA_ETAPAS, [catalogos]);
  const listaAgentes = useMemo(() => catalogos?.agentes && catalogos.agentes.length > 0 ? catalogos.agentes : LISTA_AGENTES, [catalogos]);

  // ==========================================
  // ESTADO: TAB 1 - EDITAR MASIVO
  // ==========================================
  const [inputIdsEditar, setInputIdsEditar] = useState<string>('');
  const [camposAEditar, setCamposAEditar] = useState<{
    estado: boolean;
    etapa: boolean;
    integracion: boolean;
    oportunidad: boolean;
    asset: boolean;
    pais: boolean;
    propietario: boolean;
    seguimiento: boolean;
    comentarios: boolean;
  }>({
    estado: true,
    etapa: false,
    integracion: false,
    oportunidad: false,
    asset: false,
    pais: false,
    propietario: false,
    seguimiento: false,
    comentarios: false
  });

  const [valoresEditar, setValoresEditar] = useState<{
    estado: string;
    etapa: string;
    integracion: string;
    oportunidad: string;
    asset: string;
    pais: string;
    propietario: string;
    seguimiento: string;
    comentarios: string;
    modoComentarios: 'reemplazar' | 'anexar';
  }>({
    estado: 'En progreso',
    etapa: 'Sin integración confirmada',
    integracion: listaIntegraciones[0] || 'Datalive',
    oportunidad: listaOportunidades[0] || 'Franchise Extension',
    asset: listaAssets[0] || 'Integración',
    pais: listaPaises[0] || 'Argentina',
    propietario: nombreUsuarioAutenticado,
    seguimiento: '',
    comentarios: '',
    modoComentarios: 'anexar'
  });

  // ==========================================
  // ESTADO: TAB 2 - AGREGAR MASIVO
  // ==========================================
  const [modoAgregar, setModoAgregar] = useState<ModoAgregar>('mismos_valores');
  // Modo A: Mismos valores para múltiples OPs / IDs
  const [inputIdsAgregar, setInputIdsAgregar] = useState<string>('');
  const [tiendaBaseAgregar, setTiendaBaseAgregar] = useState<string>('');
  const [valoresComunesAgregar, setValoresComunesAgregar] = useState<{
    pais: string;
    integracion: string;
    oportunidad: string;
    asset: string;
    estado: string;
    etapa: string;
    propietario: string;
    tieneCasoInicio: string;
    comentarios: string;
  }>({
    pais: listaPaises[0] || 'Argentina',
    integracion: listaIntegraciones[0] || 'Datalive',
    oportunidad: listaOportunidades[0] || 'Franchise Extension',
    asset: listaAssets[0] || 'Integración',
    estado: 'En progreso',
    etapa: 'Sin integración confirmada',
    propietario: nombreUsuarioAutenticado,
    tieneCasoInicio: 'Si',
    comentarios: ''
  });

  // Modo B: Pegar líneas CSV
  const [inputLineasCsv, setInputLineasCsv] = useState<string>('');

  // ==========================================
  // ESTADO: TAB 3 - ELIMINAR MASIVO
  // ==========================================
  const [inputIdsEliminar, setInputIdsEliminar] = useState<string>('');
  const [confirmacionEliminar, setConfirmacionEliminar] = useState<boolean>(false);

  // ==========================================
  // UTILIDAD DE PARSEO DE IDS/OPS
  // Regla: "se replicaran en el ultimo ID u OP que encuentre, separados por comas para que los distinga"
  // ==========================================
  const normalizarClave = (str: any) => {
    return String(str || '')
      .toLowerCase()
      .replace(/^op[-_\s]*/, '')
      .replace(/\s+/g, '')
      .trim();
  };

  /**
   * Busca los casos correspondientes a una lista de tokens de entrada (separados por comas o saltos de línea).
   * Para cada token, encuentra todos los registros que coincidan y SELECCIONA EL ÚLTIMO encontrado.
   */
  const buscarCasosPorTokens = (textoTokens: string) => {
    if (!textoTokens || !textoTokens.trim()) {
      return { encontrados: [], noEncontrados: [], tokensTotal: 0 };
    }

    const tokens = textoTokens
      .split(/[\n,;]+/)
      .map(t => t.trim())
      .filter(Boolean);

    const tokensUnicos = Array.from(new Set(tokens));
    const encontradosMap = new Map<string, { caso: any; totalCoincidencias: number; tokenOriginal: string }>();
    const noEncontrados: string[] = [];

    tokensUnicos.forEach(token => {
      const tokNorm = normalizarClave(token);
      const esSoloDigitos = /^\d+$/.test(tokNorm);

      // Buscar todas las coincidencias en la lista de casos
      const matches = casos.filter(c => {
        const opRaw = String(c.casoOp || '').trim();
        const opNorm = normalizarClave(opRaw);
        const vendorRaw = String(c.vendorId || c.vendor_id || '').trim();
        const vendorNorm = normalizarClave(vendorRaw);
        const idRaw = String(c.id || '').trim();
        const idNorm = normalizarClave(idRaw);

        // Coincidencia exacta o normalizada (sin prefijo OP)
        if (opRaw.toLowerCase() === token.toLowerCase() || (tokNorm && opNorm === tokNorm)) {
          return true;
        }
        if (vendorRaw.toLowerCase() === token.toLowerCase() || (tokNorm && vendorNorm === tokNorm)) {
          return true;
        }
        if (idRaw.toLowerCase() === token.toLowerCase() || (tokNorm && idNorm === tokNorm)) {
          return true;
        }

        // Si el token es número y tiene 9 dígitos o más, comparar también con casoOp
        if (esSoloDigitos && tokNorm.length >= 9 && opNorm.includes(tokNorm)) {
          return true;
        }

        return false;
      });

      if (matches.length > 0) {
        // Regla explícita del usuario: Se replica en el ÚLTIMO registro encontrado
        const ultimoCaso = matches[matches.length - 1];
        const claveUnica = String(ultimoCaso.id || ultimoCaso.casoOp || ultimoCaso.filaNumero);
        encontradosMap.set(claveUnica, {
          caso: ultimoCaso,
          totalCoincidencias: matches.length,
          tokenOriginal: token
        });
      } else {
        noEncontrados.push(token);
      }
    });

    return {
      encontrados: Array.from(encontradosMap.values()),
      noEncontrados,
      tokensTotal: tokens.length
    };
  };

  // Coincidencias para Tab Editar
  const resultadoEditar = useMemo(() => {
    return buscarCasosPorTokens(inputIdsEditar);
  }, [inputIdsEditar, casos]);

  // Coincidencias para Tab Eliminar
  const resultadoEliminar = useMemo(() => {
    return buscarCasosPorTokens(inputIdsEliminar);
  }, [inputIdsEliminar, casos]);

  // Casos parseados para Tab Agregar (Modo A: Mismos Valores)
  const casosNuevosModoA = useMemo(() => {
    if (!inputIdsAgregar || !inputIdsAgregar.trim()) return [];

    const tokens = inputIdsAgregar
      .split(/[\n,;]+/)
      .map(t => t.trim())
      .filter(Boolean);

    return tokens.map((tok, idx) => {
      const tokLimpio = tok.trim();
      const soloNum = tokLimpio.replace(/\D/g, '');
      const esOp = tokLimpio.toUpperCase().startsWith('OP-') || soloNum.length >= 9;

      const casoOp = esOp ? (tokLimpio.toUpperCase().startsWith('OP-') ? tokLimpio : `OP-${tokLimpio}`) : '';
      const vendorId = !esOp ? tokLimpio : '';
      const tiendaNombre = tiendaBaseAgregar.trim()
        ? (tokens.length > 1 ? `${tiendaBaseAgregar.trim()} (${tokLimpio})` : tiendaBaseAgregar.trim())
        : `Tienda ${tokLimpio}`;

      return {
        id: casoOp || `TEMP_NUEVO_${vendorId || idx}`,
        casoOp,
        vendorId: vendorId || tokLimpio,
        vendor_id: vendorId || tokLimpio,
        tienda: tiendaNombre,
        pais: valoresComunesAgregar.pais,
        integracion: valoresComunesAgregar.integracion,
        oportunidad: valoresComunesAgregar.oportunidad,
        asset: valoresComunesAgregar.asset,
        estado: valoresComunesAgregar.estado,
        etapa: valoresComunesAgregar.etapa,
        propietarioOportunidad: valoresComunesAgregar.propietario,
        propietarioTicket: valoresComunesAgregar.propietario,
        agente: valoresComunesAgregar.propietario,
        tieneCasoInicio: valoresComunesAgregar.tieneCasoInicio,
        comentarios: valoresComunesAgregar.comentarios,
        esNuevo: true
      };
    });
  }, [inputIdsAgregar, tiendaBaseAgregar, valoresComunesAgregar]);

  // Casos parseados para Tab Agregar (Modo B: Pegar Líneas CSV)
  const casosNuevosModoB = useMemo(() => {
    if (!inputLineasCsv || !inputLineasCsv.trim()) return [];

    const lineas = inputLineasCsv
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.toLowerCase().startsWith('caso op') && !l.toLowerCase().startsWith('op,'));

    return lineas.map((linea, idx) => {
      // Separar por comas (respetando comillas simples o dobles básicas)
      const partes = linea.split(',').map(p => p.trim());
      const casoOpRaw = partes[0] || '';
      const vendorIdRaw = partes[1] || '';
      const tiendaRaw = partes[2] || `Tienda ${casoOpRaw || vendorIdRaw || idx + 1}`;
      const paisRaw = partes[3] || valoresComunesAgregar.pais;
      const integracionRaw = partes[4] || valoresComunesAgregar.integracion;
      const oportunidadRaw = partes[5] || valoresComunesAgregar.oportunidad;
      const assetRaw = partes[6] || valoresComunesAgregar.asset;
      const estadoRaw = partes[7] || valoresComunesAgregar.estado;
      const etapaRaw = partes[8] || valoresComunesAgregar.etapa;

      return {
        id: casoOpRaw || `TEMP_CSV_${vendorIdRaw || idx}`,
        casoOp: casoOpRaw,
        vendorId: vendorIdRaw,
        vendor_id: vendorIdRaw,
        tienda: tiendaRaw,
        pais: paisRaw,
        integracion: integracionRaw,
        oportunidad: oportunidadRaw,
        asset: assetRaw,
        estado: estadoRaw,
        etapa: etapaRaw,
        propietarioOportunidad: nombreUsuarioAutenticado,
        propietarioTicket: nombreUsuarioAutenticado,
        agente: nombreUsuarioAutenticado,
        tieneCasoInicio: 'Si',
        comentarios: '',
        esNuevo: true
      };
    });
  }, [inputLineasCsv, valoresComunesAgregar, nombreUsuarioAutenticado]);

  // ==========================================
  // EJECUCIÓN DE ACCIONES MASIVAS
  // ==========================================

  // 1. Ejecutar Editar Masivo
  const ejecutarEditarMasivo = async () => {
    const totalEncontrados = resultadoEditar.encontrados.length;
    if (totalEncontrados === 0) {
      if (mostrarNotificacion) mostrarNotificacion('No hay casos encontrados para editar.', 'warning');
      return;
    }

    const camposActivos = Object.entries(camposAEditar).filter(([_, activo]) => activo);
    if (camposActivos.length === 0) {
      if (mostrarNotificacion) mostrarNotificacion('Selecciona al menos un campo para actualizar.', 'warning');
      return;
    }

    setProcesando(true);
    setMensajeEstado(`Preparando actualización de ${totalEncontrados} casos...`);

    try {
      const casosAActualizar = resultadoEditar.encontrados.map(({ caso }) => {
        const cambios: Record<string, any> = {};

        if (camposAEditar.estado) cambios.estado = valoresEditar.estado;
        if (camposAEditar.etapa) cambios.etapa = valoresEditar.etapa;
        if (camposAEditar.integracion) cambios.integracion = valoresEditar.integracion;
        if (camposAEditar.oportunidad) cambios.oportunidad = valoresEditar.oportunidad;
        if (camposAEditar.asset) cambios.asset = valoresEditar.asset;
        if (camposAEditar.pais) cambios.pais = valoresEditar.pais;
        if (camposAEditar.propietario) {
          cambios.propietarioOportunidad = valoresEditar.propietario;
          cambios.propietarioTicket = valoresEditar.propietario;
          cambios.agente = valoresEditar.propietario;
        }
        if (camposAEditar.seguimiento) cambios.casoSeguimiento = valoresEditar.seguimiento;
        if (camposAEditar.comentarios) {
          if (valoresEditar.modoComentarios === 'reemplazar') {
            cambios.comentarios = valoresEditar.comentarios;
          } else {
            const previo = caso.comentarios ? String(caso.comentarios).trim() : '';
            cambios.comentarios = previo
              ? `${previo} | ${valoresEditar.comentarios}`
              : valoresEditar.comentarios;
          }
        }

        return {
          ...caso,
          ...cambios,
          esNuevo: false
        };
      });

      await onActualizarCasos(casosAActualizar);
      setInputIdsEditar('');
      alCerrar();
    } catch (err: any) {
      console.error('Error al editar casos masivos:', err);
      if (mostrarNotificacion) mostrarNotificacion(`Error: ${err.message}`, 'error');
    } finally {
      setProcesando(false);
      setMensajeEstado('');
    }
  };

  // 2. Ejecutar Agregar Masivo
  const ejecutarAgregarMasivo = async () => {
    const listaFinal = modoAgregar === 'mismos_valores' ? casosNuevosModoA : casosNuevosModoB;
    if (listaFinal.length === 0) {
      if (mostrarNotificacion) mostrarNotificacion('Ingresa al menos un caso válido para agregar.', 'warning');
      return;
    }

    setProcesando(true);
    setMensajeEstado(`Registrando ${listaFinal.length} casos en Google Sheets...`);

    try {
      await onAgregarCasos(listaFinal);
      setInputIdsAgregar('');
      setInputLineasCsv('');
      alCerrar();
    } catch (err: any) {
      console.error('Error al agregar casos masivos:', err);
      if (mostrarNotificacion) mostrarNotificacion(`Error: ${err.message}`, 'error');
    } finally {
      setProcesando(false);
      setMensajeEstado('');
    }
  };

  // 3. Ejecutar Eliminar Masivo
  const ejecutarEliminarMasivo = async () => {
    const totalEncontrados = resultadoEliminar.encontrados.length;
    if (totalEncontrados === 0) {
      if (mostrarNotificacion) mostrarNotificacion('No hay casos encontrados para eliminar.', 'warning');
      return;
    }

    setProcesando(true);
    setMensajeEstado(`Eliminando ${totalEncontrados} casos de Onboarding...`);

    try {
      const casosAEliminar = resultadoEliminar.encontrados.map(({ caso }) => caso);
      await onEliminarCasos(casosAEliminar);
      setInputIdsEliminar('');
      setConfirmacionEliminar(false);
      alCerrar();
    } catch (err: any) {
      console.error('Error al eliminar casos masivos:', err);
      if (mostrarNotificacion) mostrarNotificacion(`Error: ${err.message}`, 'error');
    } finally {
      setProcesando(false);
      setMensajeEstado('');
    }
  };

  // Cargar IDs de ejemplo desde la tabla para probar rápidamente
  const cargarEjemplosTabla = () => {
    const ejemplos = casos
      .filter(c => c.casoOp && c.casoOp !== '-' && c.casoOp !== 'Sin caso OP')
      .slice(0, 3)
      .map(c => c.casoOp)
      .join(', ');

    if (tabActiva === 'editar') {
      setInputIdsEditar(ejemplos || 'OP-123456789, 987654321');
    } else if (tabActiva === 'eliminar') {
      setInputIdsEliminar(ejemplos || 'OP-123456789, 987654321');
    }
  };

  return (
    <div className={`fixed inset-0 z-[9999] bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn modal-cambios-masivos ${esTemaClaro ? 'theme-light' : 'dark'}`}>
      <div className="modal-cambios-masivos bg-white dark:bg-[#1E1E24] border border-slate-200 dark:border-[#3A3A3E] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-all text-black dark:text-slate-100">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-4.5 bg-slate-50 dark:bg-[#18181D] border-b border-slate-200 dark:border-[#2C2C32] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-xl shrink-0 shadow-xs">
              ⚡
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-black dark:text-white flex items-center gap-2">
                <span>Cambios Masivos de Onboarding</span>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-black dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Lote / Batch
                </span>
              </h2>
              <p className="text-xs text-black/80 dark:text-slate-400">
                Edita, agrega o elimina múltiples casos a la vez sincronizados con Google Sheets y Onboarding.
              </p>
            </div>
          </div>

          <button
            onClick={alCerrar}
            disabled={procesando}
            className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 border border-slate-300 dark:bg-[#2A2A30] dark:hover:bg-[#383840] dark:border-transparent text-black dark:text-slate-300 hover:text-black dark:hover:text-white flex items-center justify-center text-xs transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Pestañas de Navegación: Editar, Agregar, Eliminar */}
        <div className="px-6 pt-3 bg-slate-100/90 dark:bg-[#16161B] border-b border-slate-200 dark:border-[#2C2C32] flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTabActiva('editar')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-t border-x ${
              tabActiva === 'editar'
                ? 'bg-white dark:bg-[#1E1E24] text-black dark:text-purple-400 border-slate-200 dark:border-[#3A3A3E] border-b-transparent shadow-xs'
                : 'border-transparent text-black/70 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#25252C]'
            }`}
          >
            <span>✏️</span>
            <span>Editar Masivo</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('agregar')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-t border-x ${
              tabActiva === 'agregar'
                ? 'bg-white dark:bg-[#1E1E24] text-black dark:text-emerald-400 border-slate-200 dark:border-[#3A3A3E] border-b-transparent shadow-xs'
                : 'border-transparent text-black/70 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#25252C]'
            }`}
          >
            <span>➕</span>
            <span>Agregar Masivo</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('eliminar')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-t border-x ${
              tabActiva === 'eliminar'
                ? 'bg-white dark:bg-[#1E1E24] text-black dark:text-rose-400 border-slate-200 dark:border-[#3A3A3E] border-b-transparent shadow-xs'
                : 'border-transparent text-black/70 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#25252C]'
            }`}
          >
            <span>🗑️</span>
            <span>Eliminar Masivo</span>
          </button>
        </div>

        {/* Contenido desplazable con scroll limpio */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ======================================================== */}
          {/* TAB 1: EDITAR MASIVO */}
          {/* ======================================================== */}
          {tabActiva === 'editar' && (
            <div className="space-y-6">
              {/* Instrucción e Input de IDs */}
              <div className="bg-slate-50 dark:bg-[#15151A] border border-slate-200 dark:border-[#2C2C32] rounded-2xl p-4.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <span>🎯 1. Ingresa los IDs u OPs a editar</span>
                      <span className="text-[11px] font-normal text-slate-600 dark:text-slate-400">(separados por comas o saltos de línea)</span>
                    </label>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      Las acciones se replicarán en el <strong>último ID u OP</strong> que encuentre registrado en la base.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cargarEjemplosTabla}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <span>⚡ Cargar ejemplos de la tabla</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={inputIdsEditar}
                  onChange={(e) => setInputIdsEditar(e.target.value)}
                  placeholder="Ej: OP-123456789, 987654321, 55442, OP-998877"
                  className="w-full bg-white dark:bg-[#0F0F12] border border-slate-300 dark:border-[#3A3A3E] rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition shadow-inner"
                />

                {/* Resumen de Coincidencias en Vivo */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-[#25252C] text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-transparent font-semibold text-[11px]">
                    Identificadores ingresados: <strong>{resultadoEditar.tokensTotal}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold text-[11px]">
                    ✓ Casos encontrados: <strong>{resultadoEditar.encontrados.length}</strong>
                  </span>
                  {resultadoEditar.noEncontrados.length > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px]">
                      ⚠️ No encontrados ({resultadoEditar.noEncontrados.length}): <span className="font-mono">{resultadoEditar.noEncontrados.slice(0, 3).join(', ')}{resultadoEditar.noEncontrados.length > 3 ? '...' : ''}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Selección de Campos a Modificar */}
              <div className="bg-slate-50 dark:bg-[#15151A] border border-slate-200 dark:border-[#2C2C32] rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-white">
                    ⚙️ 2. Selecciona qué campos deseas cambiar y sus nuevos valores:
                  </label>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Solo los campos marcados se actualizarán
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Campo: Estado */}
                  <div className={`p-3 rounded-xl border transition ${camposAEditar.estado ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/80' : 'bg-white dark:bg-[#0F0F12] border-slate-200 dark:border-[#2C2C32] opacity-80'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                        <input
                          type="checkbox"
                          checked={camposAEditar.estado}
                          onChange={(e) => setCamposAEditar(prev => ({ ...prev, estado: e.target.checked }))}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span>Cambiar Estado</span>
                      </label>
                    </div>
                    <select
                      disabled={!camposAEditar.estado}
                      value={valoresEditar.estado}
                      onChange={(e) => setValoresEditar(prev => ({ ...prev, estado: e.target.value }))}
                      className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      {listaEstados.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>

                  {/* Campo: Etapa */}
                  <div className={`p-3 rounded-xl border transition ${camposAEditar.etapa ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/80' : 'bg-white dark:bg-[#0F0F12] border-slate-200 dark:border-[#2C2C32] opacity-80'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                        <input
                          type="checkbox"
                          checked={camposAEditar.etapa}
                          onChange={(e) => setCamposAEditar(prev => ({ ...prev, etapa: e.target.checked }))}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span>Cambiar Etapa</span>
                      </label>
                    </div>
                    <select
                      disabled={!camposAEditar.etapa}
                      value={valoresEditar.etapa}
                      onChange={(e) => setValoresEditar(prev => ({ ...prev, etapa: e.target.value }))}
                      className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      {listaEtapas.map(et => <option key={et} value={et}>{et}</option>)}
                    </select>
                  </div>

                  {/* Campo: Integración */}
                  <div className={`p-3 rounded-xl border transition ${camposAEditar.integracion ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/80' : 'bg-white dark:bg-[#0F0F12] border-slate-200 dark:border-[#2C2C32] opacity-80'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                        <input
                          type="checkbox"
                          checked={camposAEditar.integracion}
                          onChange={(e) => setCamposAEditar(prev => ({ ...prev, integracion: e.target.checked }))}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span>Cambiar Integración</span>
                      </label>
                    </div>
                    <select
                      disabled={!camposAEditar.integracion}
                      value={valoresEditar.integracion}
                      onChange={(e) => setValoresEditar(prev => ({ ...prev, integracion: e.target.value }))}
                      className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      {listaIntegraciones.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>

                  {/* Campo: Oportunidad */}
                  <div className={`p-3 rounded-xl border transition ${camposAEditar.oportunidad ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/80' : 'bg-white dark:bg-[#0F0F12] border-slate-200 dark:border-[#2C2C32] opacity-80'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                        <input
                          type="checkbox"
                          checked={camposAEditar.oportunidad}
                          onChange={(e) => setCamposAEditar(prev => ({ ...prev, oportunidad: e.target.checked }))}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span>Cambiar Oportunidad</span>
                      </label>
                    </div>
                    <select
                      disabled={!camposAEditar.oportunidad}
                      value={valoresEditar.oportunidad}
                      onChange={(e) => setValoresEditar(prev => ({ ...prev, oportunidad: e.target.value }))}
                      className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      {listaOportunidades.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>

                  {/* Campo: País */}
                  <div className={`p-3 rounded-xl border transition ${camposAEditar.pais ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/80' : 'bg-white dark:bg-[#0F0F12] border-slate-200 dark:border-[#2C2C32] opacity-80'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                        <input
                          type="checkbox"
                          checked={camposAEditar.pais}
                          onChange={(e) => setCamposAEditar(prev => ({ ...prev, pais: e.target.checked }))}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span>Cambiar País</span>
                      </label>
                    </div>
                    <select
                      disabled={!camposAEditar.pais}
                      value={valoresEditar.pais}
                      onChange={(e) => setValoresEditar(prev => ({ ...prev, pais: e.target.value }))}
                      className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      {listaPaises.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Campo: Propietario / Agente */}
                  <div className={`p-3 rounded-xl border transition ${camposAEditar.propietario ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/80' : 'bg-white dark:bg-[#0F0F12] border-slate-200 dark:border-[#2C2C32] opacity-80'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                        <input
                          type="checkbox"
                          checked={camposAEditar.propietario}
                          onChange={(e) => setCamposAEditar(prev => ({ ...prev, propietario: e.target.checked }))}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span>Cambiar Agente / Propietario</span>
                      </label>
                    </div>
                    <select
                      disabled={!camposAEditar.propietario}
                      value={valoresEditar.propietario}
                      onChange={(e) => setValoresEditar(prev => ({ ...prev, propietario: e.target.value }))}
                      className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      {listaAgentes.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                    </select>
                  </div>

                  {/* Campo: N° Caso Seguimiento */}
                  <div className={`p-3 rounded-xl border transition ${camposAEditar.seguimiento ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/80' : 'bg-white dark:bg-[#0F0F12] border-slate-200 dark:border-[#2C2C32] opacity-80'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                        <input
                          type="checkbox"
                          checked={camposAEditar.seguimiento}
                          onChange={(e) => setCamposAEditar(prev => ({ ...prev, seguimiento: e.target.checked }))}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span>N° Caso Seguimiento</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={!camposAEditar.seguimiento}
                      value={valoresEditar.seguimiento}
                      onChange={(e) => setValoresEditar(prev => ({ ...prev, seguimiento: e.target.value }))}
                      placeholder="Ej: CASO-99123"
                      className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40"
                    />
                  </div>

                  {/* Campo: Comentarios */}
                  <div className={`p-3 rounded-xl border transition ${camposAEditar.comentarios ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/80' : 'bg-white dark:bg-[#0F0F12] border-slate-200 dark:border-[#2C2C32] opacity-80'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                        <input
                          type="checkbox"
                          checked={camposAEditar.comentarios}
                          onChange={(e) => setCamposAEditar(prev => ({ ...prev, comentarios: e.target.checked }))}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span>Actualizar Comentarios</span>
                      </label>
                      {camposAEditar.comentarios && (
                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setValoresEditar(prev => ({ ...prev, modoComentarios: 'anexar' }))}
                            className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${valoresEditar.modoComentarios === 'anexar' ? 'bg-purple-600 text-white' : 'text-slate-700 dark:text-slate-300'}`}
                          >
                            + Anexar
                          </button>
                          <button
                            type="button"
                            onClick={() => setValoresEditar(prev => ({ ...prev, modoComentarios: 'reemplazar' }))}
                            className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${valoresEditar.modoComentarios === 'reemplazar' ? 'bg-purple-600 text-white' : 'text-slate-700 dark:text-slate-300'}`}
                          >
                            Reemplazar
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      disabled={!camposAEditar.comentarios}
                      value={valoresEditar.comentarios}
                      onChange={(e) => setValoresEditar(prev => ({ ...prev, comentarios: e.target.value }))}
                      placeholder="Nota a incorporar a los casos..."
                      className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Vista Previa de Casos Encontrados que se Editarán */}
              {resultadoEditar.encontrados.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-white">
                      📋 Vista previa: {resultadoEditar.encontrados.length} caso(s) seleccionados para actualizar
                    </span>
                    <span className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold">
                      (Se toma el último registro de cada OP/ID)
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-[#2C2C32] rounded-2xl overflow-hidden max-h-56 overflow-y-auto bg-white dark:bg-[#121216]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#15151A] text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-[#2C2C32] text-[10px] uppercase font-mono tracking-wider">
                          <th className="py-2.5 px-3">Fila #</th>
                          <th className="py-2.5 px-3">Caso OP</th>
                          <th className="py-2.5 px-3">Tienda</th>
                          <th className="py-2.5 px-3">Estado Actual</th>
                          <th className="py-2.5 px-3">Etapa Actual</th>
                          <th className="py-2.5 px-3">Integración</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#25252C]">
                        {resultadoEditar.encontrados.map(({ caso, totalCoincidencias }, idx) => (
                          <tr key={caso.id || idx} className="hover:bg-purple-50/50 dark:hover:bg-[#25252D] text-slate-800 dark:text-slate-200 transition">
                            <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-[#9CA3AF]">{caso.filaNumero || idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-cyan-700 dark:text-cyan-400">
                              {obtenerTextoCasoOp(caso)}
                              {totalCoincidencias > 1 && (
                                <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-transparent font-sans">
                                  Último de {totalCoincidencias}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold truncate max-w-[160px] text-slate-900 dark:text-slate-100">{caso.tienda || '-'}</td>
                            <td className="py-2 px-3">
                              <span className="text-slate-700 dark:text-slate-300">{caso.estado || '-'}</span>
                              {camposAEditar.estado && (
                                <span className="ml-1 text-purple-700 dark:text-purple-300 font-bold">➔ {valoresEditar.estado}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 truncate max-w-[150px]">
                              <span className="text-slate-700 dark:text-slate-300">{caso.etapa || '-'}</span>
                              {camposAEditar.etapa && (
                                <span className="ml-1 text-purple-700 dark:text-purple-300 font-bold">➔ {valoresEditar.etapa}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                              {camposAEditar.integracion ? valoresEditar.integracion : (caso.integracion || '-')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: AGREGAR MASIVO */}
          {/* ======================================================== */}
          {tabActiva === 'agregar' && (
            <div className="space-y-6">
              {/* Selector de Modo de Agregado */}
              <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-[#15151A] rounded-2xl border border-slate-200 dark:border-[#2C2C32]">
                <button
                  type="button"
                  onClick={() => setModoAgregar('mismos_valores')}
                  className={`flex-1 min-w-[200px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    modoAgregar === 'mismos_valores'
                      ? 'bg-white dark:bg-[#202027] text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-[#3A3A3E]'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>⚡ Mismos valores para lista de OPs / IDs</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    Sugerido
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModoAgregar('pegar_lineas')}
                  className={`flex-1 min-w-[200px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    modoAgregar === 'pegar_lineas'
                      ? 'bg-white dark:bg-[#202027] text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-[#3A3A3E]'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>📋 Pegar líneas CSV / valores por coma</span>
                </button>
              </div>

              {/* MODO A: Mismos Valores para lista de OPs */}
              {modoAgregar === 'mismos_valores' && (
                <div className="space-y-5">
                  <div className="bg-slate-50 dark:bg-[#15151A] border border-slate-200 dark:border-[#2C2C32] rounded-2xl p-4.5 space-y-3">
                    <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <span>1. Lista de OPs o IDs a crear:</span>
                      <span className="text-[11px] font-normal text-slate-700 dark:text-slate-300">(separados por comas o saltos de línea)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={inputIdsAgregar}
                      onChange={(e) => setInputIdsAgregar(e.target.value)}
                      placeholder="Ej: OP-9001, OP-9002, OP-9003, OP-9004 o 87654321, 87654322"
                      className="w-full bg-white dark:bg-[#0F0F12] border border-slate-300 dark:border-[#3A3A3E] rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition shadow-inner"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                          Nombre o Prefijo de Tienda (Opcional):
                        </label>
                        <input
                          type="text"
                          value={tiendaBaseAgregar}
                          onChange={(e) => setTiendaBaseAgregar(e.target.value)}
                          placeholder="Ej: Franquicia Central"
                          className="w-full bg-white dark:bg-[#0F0F12] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div className="flex items-end">
                        <span className="text-[11px] text-slate-700 dark:text-slate-300">
                          {casosNuevosModoA.length > 0
                            ? `✓ Se generarán ${casosNuevosModoA.length} registros listos para añadir.`
                            : 'Escribe las OPs o IDs arriba para generar los casos.'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Formulario de valores compartidos */}
                  <div className="bg-slate-50 dark:bg-[#15151A] border border-slate-200 dark:border-[#2C2C32] rounded-2xl p-4.5 space-y-4">
                    <label className="text-xs font-bold text-slate-800 dark:text-white">
                      ⚙️ 2. Valores comunes que tendrán todos estos casos nuevos:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">País:</label>
                        <select
                          value={valoresComunesAgregar.pais}
                          onChange={(e) => setValoresComunesAgregar(prev => ({ ...prev, pais: e.target.value }))}
                          className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {listaPaises.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Integración:</label>
                        <select
                          value={valoresComunesAgregar.integracion}
                          onChange={(e) => setValoresComunesAgregar(prev => ({ ...prev, integracion: e.target.value }))}
                          className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {listaIntegraciones.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Oportunidad:</label>
                        <select
                          value={valoresComunesAgregar.oportunidad}
                          onChange={(e) => setValoresComunesAgregar(prev => ({ ...prev, oportunidad: e.target.value }))}
                          className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {listaOportunidades.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Asset:</label>
                        <select
                          value={valoresComunesAgregar.asset}
                          onChange={(e) => setValoresComunesAgregar(prev => ({ ...prev, asset: e.target.value }))}
                          className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {listaAssets.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Estado:</label>
                        <select
                          value={valoresComunesAgregar.estado}
                          onChange={(e) => setValoresComunesAgregar(prev => ({ ...prev, estado: e.target.value }))}
                          className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {listaEstados.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Etapa:</label>
                        <select
                          value={valoresComunesAgregar.etapa}
                          onChange={(e) => setValoresComunesAgregar(prev => ({ ...prev, etapa: e.target.value }))}
                          className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {listaEtapas.map(et => <option key={et} value={et}>{et}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Agente / Propietario:</label>
                        <select
                          value={valoresComunesAgregar.propietario}
                          onChange={(e) => setValoresComunesAgregar(prev => ({ ...prev, propietario: e.target.value }))}
                          className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {listaAgentes.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Tiene Caso Inicio:</label>
                        <select
                          value={valoresComunesAgregar.tieneCasoInicio}
                          onChange={(e) => setValoresComunesAgregar(prev => ({ ...prev, tieneCasoInicio: e.target.value }))}
                          className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {LISTA_TIENE_INICIO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Comentarios:</label>
                        <input
                          type="text"
                          value={valoresComunesAgregar.comentarios}
                          onChange={(e) => setValoresComunesAgregar(prev => ({ ...prev, comentarios: e.target.value }))}
                          placeholder="Nota inicial..."
                          className="w-full bg-white dark:bg-[#1A1A20] border border-slate-300 dark:border-[#3A3A3E] text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODO B: Pegar Líneas CSV */}
              {modoAgregar === 'pegar_lineas' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-[#15151A] border border-slate-200 dark:border-[#2C2C32] rounded-2xl p-4.5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-800 dark:text-white">
                          📋 Pega las líneas con los valores separados por comas:
                        </label>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                          Formato: Caso OP, Vendor ID, Tienda, País, Integración, Oportunidad, Asset, Estado, Etapa
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const ejemplo = `OP-88001, 10001, Burger King Centro, Argentina, Datalive, Franchise Extension, Integración, En progreso, Sin integración confirmada\nOP-88002, 10002, Burger King Norte, Argentina, Datalive, Franchise Extension, Integración, En progreso, Sin integración confirmada\nOP-88003, 10003, Burger King Sur, Chile, Spoonity, Franchise Extension, Integración, En progreso, Sin integración confirmada`;
                            setInputLineasCsv(ejemplo);
                          }}
                          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          ✨ Cargar ejemplo
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={6}
                      value={inputLineasCsv}
                      onChange={(e) => setInputLineasCsv(e.target.value)}
                      placeholder="OP-88001, 10001, Burger King Centro, Argentina, Datalive, Franchise Extension, Integración, En progreso, Sin integración confirmada&#10;OP-88002, 10002, Burger King Norte..."
                      className="w-full bg-white dark:bg-[#0F0F12] border border-slate-300 dark:border-[#3A3A3E] rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition shadow-inner"
                    />

                    <div className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Si solo incluyes <code>Caso OP, Vendor ID, Tienda</code>, las demás columnas tomarán los valores estándar automáticamente.</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {casosNuevosModoB.length} líneas detectadas
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Vista previa de nuevos casos a agregar */}
              {(modoAgregar === 'mismos_valores' ? casosNuevosModoA : casosNuevosModoB).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-white">
                      📋 Vista previa: {(modoAgregar === 'mismos_valores' ? casosNuevosModoA : casosNuevosModoB).length} nuevo(s) caso(s) para crear
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                      (Se asignará automáticamente N° Fila y fecha de creación)
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-[#2C2C32] rounded-2xl overflow-hidden max-h-56 overflow-y-auto bg-white dark:bg-[#121216]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#15151A] text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-[#2C2C32] text-[10px] uppercase font-mono tracking-wider">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Caso OP</th>
                          <th className="py-2.5 px-3">Vendor ID</th>
                          <th className="py-2.5 px-3">Tienda</th>
                          <th className="py-2.5 px-3">País</th>
                          <th className="py-2.5 px-3">Integración</th>
                          <th className="py-2.5 px-3">Estado</th>
                          <th className="py-2.5 px-3">Etapa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#25252C]">
                        {(modoAgregar === 'mismos_valores' ? casosNuevosModoA : casosNuevosModoB).map((c, idx) => (
                          <tr key={idx} className="hover:bg-emerald-50/50 dark:hover:bg-[#25252D] text-slate-800 dark:text-slate-200 transition">
                            <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-[#9CA3AF]">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-cyan-700 dark:text-cyan-400">{c.casoOp || '-'}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{c.vendorId || '-'}</td>
                            <td className="py-2.5 px-3 font-semibold truncate max-w-[160px] text-slate-900 dark:text-slate-100">{c.tienda}</td>
                            <td className="py-2.5 px-3">{c.pais}</td>
                            <td className="py-2.5 px-3">{c.integracion}</td>
                            <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">{c.estado}</td>
                            <td className="py-2.5 px-3 truncate max-w-[150px]">{c.etapa}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: ELIMINAR MASIVO */}
          {/* ======================================================== */}
          {tabActiva === 'eliminar' && (
            <div className="space-y-6">
              {/* Alerta de Peligro */}
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4.5 flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-600/20 border border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-center justify-center text-xl shrink-0">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900 dark:text-rose-300">
                    Eliminación Masiva Definitiva
                  </h3>
                  <p className="text-xs text-rose-700 dark:text-rose-400/90 mt-1 leading-relaxed">
                    Esta acción eliminará de forma permanente los casos encontrados tanto en <strong className="font-bold underline">Google Sheets (hoja Onboarding_New)</strong> como en la base de datos de Onboarding.
                  </p>
                </div>
              </div>

              {/* Input de IDs a Eliminar */}
              <div className="bg-slate-50 dark:bg-[#15151A] border border-slate-200 dark:border-[#2C2C32] rounded-2xl p-4.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <span>🎯 Ingresa los IDs u OPs a eliminar</span>
                    <span className="text-[11px] font-normal text-slate-600 dark:text-slate-400">(separados por comas o saltos de línea)</span>
                  </label>
                  <button
                    type="button"
                    onClick={cargarEjemplosTabla}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <span>⚡ Cargar ejemplos de la tabla</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={inputIdsEliminar}
                  onChange={(e) => setInputIdsEliminar(e.target.value)}
                  placeholder="Ej: OP-123456789, 987654321, 55442"
                  className="w-full bg-white dark:bg-[#0F0F12] border border-slate-300 dark:border-[#3A3A3E] rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:border-rose-500 transition shadow-inner"
                />

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-[#25252C] text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-transparent font-semibold text-[11px]">
                    Identificadores ingresados: <strong>{resultadoEliminar.tokensTotal}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold text-[11px]">
                    ✓ Casos que se eliminarán: <strong>{resultadoEliminar.encontrados.length}</strong>
                  </span>
                  {resultadoEliminar.noEncontrados.length > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px]">
                      ⚠️ No encontrados ({resultadoEliminar.noEncontrados.length})
                    </span>
                  )}
                </div>
              </div>

              {/* Lista de Casos que se Eliminarán */}
              {resultadoEliminar.encontrados.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-white">
                      🗑️ Vista previa: {resultadoEliminar.encontrados.length} caso(s) que serán eliminados
                    </span>
                    <span className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold">
                      (Se eliminará el último registro de cada OP/ID)
                    </span>
                  </div>

                  <div className="border border-rose-200 dark:border-rose-900/60 rounded-2xl overflow-hidden max-h-56 overflow-y-auto bg-white dark:bg-[#121216]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-rose-100/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-b border-rose-200 dark:border-rose-900/60 text-[10px] uppercase font-mono tracking-wider">
                          <th className="py-2.5 px-3">Fila #</th>
                          <th className="py-2.5 px-3">Caso OP</th>
                          <th className="py-2.5 px-3">Vendor ID</th>
                          <th className="py-2.5 px-3">Tienda</th>
                          <th className="py-2.5 px-3">País / Integración</th>
                          <th className="py-2.5 px-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 dark:divide-rose-950/40">
                        {resultadoEliminar.encontrados.map(({ caso, totalCoincidencias }, idx) => (
                          <tr key={caso.id || idx} className="hover:bg-rose-50/70 dark:hover:bg-rose-950/20 text-slate-800 dark:text-slate-200 transition">
                            <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-[#9CA3AF]">{caso.filaNumero || idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                              {obtenerTextoCasoOp(caso)}
                              {totalCoincidencias > 1 && (
                                <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-sans border border-amber-200 dark:border-transparent">
                                  Último de {totalCoincidencias}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{caso.vendorId || caso.vendor_id || '-'}</td>
                            <td className="py-2.5 px-3 font-semibold truncate max-w-[160px] text-slate-900 dark:text-slate-100">{caso.tienda || '-'}</td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{caso.pais || '-'} • {caso.integracion || '-'}</td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{caso.estado || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Casilla de confirmación obligatoria para eliminar */}
                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-900 dark:text-rose-400 select-none">
                      <input
                        type="checkbox"
                        checked={confirmacionEliminar}
                        onChange={(e) => setConfirmacionEliminar(e.target.checked)}
                        className="w-4.5 h-4.5 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                      />
                      <span>Confirmo que deseo eliminar definitivamente estos {resultadoEliminar.encontrados.length} casos de la base de datos.</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del Modal con Botones de Acción */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#18181D] border-t border-slate-200 dark:border-[#2C2C32] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
            {procesando && (
              <>
                <span className="animate-spin text-sm">🔄</span>
                <span className="font-semibold text-purple-700 dark:text-purple-300">{mensajeEstado || 'Procesando cambios...'}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={alCerrar}
              disabled={procesando}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 dark:bg-[#2A2A30] dark:hover:bg-[#36363E] dark:text-slate-200 dark:border-transparent text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            {tabActiva === 'editar' && (
              <button
                type="button"
                onClick={ejecutarEditarMasivo}
                disabled={procesando || resultadoEditar.encontrados.length === 0}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-purple-900/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>⚡</span>
                <span>
                  {procesando
                    ? 'Actualizando...'
                    : `Aplicar Cambios a ${resultadoEditar.encontrados.length} Caso(s)`}
                </span>
              </button>
            )}

            {tabActiva === 'agregar' && (
              <button
                type="button"
                onClick={ejecutarAgregarMasivo}
                disabled={procesando || (modoAgregar === 'mismos_valores' ? casosNuevosModoA : casosNuevosModoB).length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-900/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>➕</span>
                <span>
                  {procesando
                    ? 'Agregando...'
                    : `Agregar ${(modoAgregar === 'mismos_valores' ? casosNuevosModoA : casosNuevosModoB).length} Casos a Onboarding`}
                </span>
              </button>
            )}

            {tabActiva === 'eliminar' && (
              <button
                type="button"
                onClick={ejecutarEliminarMasivo}
                disabled={procesando || resultadoEliminar.encontrados.length === 0 || !confirmacionEliminar}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-rose-900/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>🗑️</span>
                <span>
                  {procesando
                    ? 'Eliminando...'
                    : `Eliminar ${resultadoEliminar.encontrados.length} Caso(s) Definitivamente`}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
