import React, { useState, useMemo, useEffect } from 'react';
import AgentSummary from './AgentSummary';
import MetricsPanel from './MetricsPanel';
import ReportDownloader from './ReportDownloader';
import { analizarAlertasCaso, limpiarTextoEtapa, esPushKamRealizado, normalizarRespuesta } from '../../utils/onboardingRules';
import { esEstadoActivoOficial } from '../../data/catalogoOnboarding';

const AGENTES_OFICIALES = [
  'Jean Palomino',
  'Joel Tocas',
  'Prisila Leon',
  'Yadira Flores'
];

const PAISES_OFICIALES = ['Bolivia', 'Chile', 'Ecuador', 'El Salvador', 'Perú', 'Uruguay', 'Argentina', 'Otros'];

export interface TLDashboardProps {
  casos?: any[];
  onSeleccionarCaso?: (caso: any) => void;
  onActualizarCaso?: (caso: any) => void;
  onRegistrarPush?: (caso: any, tipo: string) => void;
  nombreUsuario?: string;
  rolUsuario?: string;
  mostrarNotificacion?: (texto: string, tipo?: string) => void;
  onForzarSync?: () => void;
  sincronizando?: boolean;
  casoResaltadoId?: string | number | null;
}

export default function TLDashboard({ 
  casos = [], 
  onSeleccionarCaso, 
  onActualizarCaso, 
  onRegistrarPush,
  nombreUsuario, 
  rolUsuario, 
  mostrarNotificacion,
  onForzarSync,
  sincronizando = false,
  casoResaltadoId = null
}: TLDashboardProps) {
  const [filtroAgente, setFiltroAgente] = useState<string>('todos');
  const [filtroPais, setFiltroPais] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroEtapa, setFiltroEtapa] = useState<string>('todos');
  const [filtroKpi, setFiltroKpi] = useState<string>('todos'); // 'todos', 'en_progreso', 'sin_op', 'fuera_sla', 'proximos', 'req_kam_push'
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    op: 120,
    tienda: 150,
    estado: 120,
    agente: 120,
    etapa: 150,
    seguimiento: 280,
    sla_critico: 130,
    push: 140,
    acciones: 150
  });

  const [ordenCampo, setOrdenCampo] = useState<string>('sla_critico'); // default
  const [ordenDir, setOrdenDir] = useState<'asc' | 'desc'>('desc');
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const iniciarRedimensionar = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 120;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColWidths(prev => ({
        ...prev,
        [colKey]: Math.max(60, startWidth + delta)
      }));
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Procesar casos con análisis detallado de Push KAM
  const casosProcesados = useMemo(() => {
    return casos.map(c => {
      const alertas = analizarAlertasCaso(c);
      const agenteACargo = c.propietarioTicket || c.propietarioOportunidad || c.agente || 'Sin Asignar';
      
      let normalizedAgent = agenteACargo;
      AGENTES_OFICIALES.forEach(ao => {
        if (agenteACargo.toLowerCase().includes(ao.split(' ')[0].toLowerCase())) {
          normalizedAgent = ao;
        }
      });

      const estadoLower = String(c.estado || '').toLowerCase().trim();
      const esActivo = !estadoLower.match(/cerrad|fallid|cancel/) && (estadoLower.includes('progreso') || c.esActivo);

      // Evaluación estricta de seguimiento POS API y Catálogo según regla oficial
      // ¿A cuál le falta el push?: Si tiene fecha de inicio y fecha de push y en existe respuesta dice NO y Push KAM no está hecho
      const tieneInicioPos = Boolean(c.fechaInicioPos && c.fechaInicioPos !== 'S/V' && c.fechaInicioPos !== '-');
      const tienePushPos = Boolean(c.fechaPushPos && c.fechaPushPos !== 'S/V' && c.fechaPushPos !== '-');
      const respNoPos = normalizarRespuesta(c.respuestaPos) === 'No';
      const respPosOk = respNoPos ? false : (normalizarRespuesta(c.respuestaPos) === 'Si' || normalizarRespuesta(c.respuestaPos) === 'S/V');
      const noRealizoPushPos = esActivo && tieneInicioPos && !tienePushPos && !respPosOk;
      const kamPosHecho = tieneInicioPos && tienePushPos && esPushKamRealizado(c.pushKamPos);
      const faltaKamPos = esActivo && tieneInicioPos && tienePushPos && respNoPos && !esPushKamRealizado(c.pushKamPos);

      const tieneInicioCat = Boolean(c.fechaInicioCat && c.fechaInicioCat !== 'S/V' && c.fechaInicioCat !== '-');
      const tienePushCat = Boolean(c.fechaPushCat && c.fechaPushCat !== 'S/V' && c.fechaPushCat !== '-');
      const respNoCat = normalizarRespuesta(c.respuestaCat) === 'No';
      const respCatOk = respNoCat ? false : (normalizarRespuesta(c.respuestaCat) === 'Si' || normalizarRespuesta(c.respuestaCat) === 'S/V');
      const noRealizoPushCat = esActivo && tieneInicioCat && !tienePushCat && !respCatOk;
      const kamCatHecho = tieneInicioCat && tienePushCat && esPushKamRealizado(c.pushKamCat);
      const faltaKamCat = esActivo && tieneInicioCat && tienePushCat && respNoCat && !esPushKamRealizado(c.pushKamCat);

      const tieneSeguimientoAplicable = tieneInicioPos || tieneInicioCat;

      const horas = alertas.horasTranscurridas || c.horasSLA || 0;
      const rangoStr = String(alertas.rangoSla || c.rangoSlaOp || '').toLowerCase();
      const esMasDe24 = horas >= 24 || 
        rangoStr.includes('24') || 
        rangoStr.includes('72') || 
        rangoStr.includes('96') || 
        rangoStr.includes('≥') || 
        rangoStr.includes('>');

      const requiereKamPush = esActivo && esMasDe24 && (faltaKamPos || faltaKamCat);

      return {
        ...c,
        alertas,
        horasSLA: horas,
        rangoSlaOp: c.rangoSlaOp || alertas.rangoSla || '',
        tiempoTranscurridoOp: c.tiempoTranscurridoOp || alertas.tiempoTexto || '',
        esCritico: alertas.esCritico || horas >= 96,
        esProximoVencer: alertas.esProximoVencer || (horas >= 72 && horas < 96),
        agenteACargo: normalizedAgent,
        colorClass: alertas.colorClass || 'bg-[#2C2C32]',
        esActivo,
        tieneInicioPos,
        tieneInicioCat,
        tienePushPos,
        tienePushCat,
        noRealizoPushPos,
        noRealizoPushCat,
        tieneSeguimientoAplicable,
        faltaKamPos,
        faltaKamCat,
        kamPosHecho,
        kamCatHecho,
        requiereKamPush
      };
    });
  }, [casos]);

  // Aplicar filtros
  const casosFiltrados = useMemo(() => {
    return casosProcesados.filter(c => {
      if (filtroAgente !== 'todos' && c.agenteACargo !== filtroAgente) return false;
      if (filtroPais !== 'todos') {
        if (filtroPais === 'Otros') {
          if (PAISES_OFICIALES.includes(c.pais) && c.pais !== 'Otros') return false;
        } else {
          if (c.pais !== filtroPais) return false;
        }
      }
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
      if (filtroEtapa !== 'todos' && c.etapa !== filtroEtapa) return false;

      if (filtroKpi !== 'todos') {
        const estLower = String(c.estado || '').toLowerCase().trim();
        const esSinOp = estLower.includes('sin oportunidad') || !c.casoOp || String(c.casoOp).trim() === '' || String(c.casoOp).toLowerCase() === 'sin caso op';
        
        if (filtroKpi === 'en_progreso') {
          if (esSinOp || (!estLower.includes('progreso') && estLower !== 'en progreso')) return false;
        } else if (filtroKpi === 'sin_op') {
          if (!esSinOp) return false;
        } else if (filtroKpi === 'fuera_sla') {
          if (!c.esActivo || c.horasSLA < 96) return false;
        } else if (filtroKpi === 'proximos') {
          if (!c.esActivo || !(c.horasSLA >= 72 && c.horasSLA < 96)) return false;
        } else if (filtroKpi === 'req_kam_push') {
          if (!c.requiereKamPush) return false;
        }
      }

      return true;
    });
  }, [casosProcesados, filtroKpi, filtroAgente, filtroPais, filtroEstado, filtroEtapa]);

  useEffect(() => { setCurrentPage(1); }, [filtroAgente, filtroPais, filtroEstado, filtroEtapa, filtroKpi, ordenCampo, ordenDir, rowsPerPage]);

  const casosActivos = useMemo(() => {
    return casosProcesados.filter(c => c.esActivo);
  }, [casosProcesados]);

  // Ordenar casos activos
  const casosActivosOrdenados = useMemo(() => {
    const ordenados = [...casosFiltrados.filter(c => c.esActivo)];

    ordenados.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (ordenCampo === 'op') {
        valA = a.casoOp || ''; valB = b.casoOp || '';
      } else if (ordenCampo === 'tienda') {
        valA = String(a.tienda || '').toLowerCase(); valB = String(b.tienda || '').toLowerCase();
      } else if (ordenCampo === 'estado') {
        valA = String(a.estado || '').toLowerCase(); valB = String(b.estado || '').toLowerCase();
      } else if (ordenCampo === 'agente') {
        valA = String(a.agenteACargo || '').toLowerCase(); valB = String(b.agenteACargo || '').toLowerCase();
      } else if (ordenCampo === 'etapa') {
        valA = String(a.etapa || '').toLowerCase(); valB = String(b.etapa || '').toLowerCase();
      } else if (ordenCampo === 'sla') {
        valA = a.horasSLA || 0; valB = b.horasSLA || 0;
      } else if (ordenCampo === 'sla_critico') {
        // Lógica especial de SLA Crítico (predeterminada)
        const critA = (a.esCritico || a.horasSLA >= 96) ? 1 : 0;
        const critB = (b.esCritico || b.horasSLA >= 96) ? 1 : 0;
        if (critA !== critB) return (critB - critA) * (ordenDir === 'asc' ? -1 : 1);

        const proxA = (a.esProximoVencer || (a.horasSLA >= 72 && a.horasSLA < 96)) ? 1 : 0;
        const proxB = (b.esProximoVencer || (b.horasSLA >= 72 && b.horasSLA < 96)) ? 1 : 0;
        if (proxA !== proxB) return (proxB - proxA) * (ordenDir === 'asc' ? -1 : 1);

        valA = a.horasSLA || 0;
        valB = b.horasSLA || 0;
      } else if (ordenCampo === 'push') {
        // Sort priorities for Push: 
        // 1 = requires push KAM, 2 = missing agent push, 3 = OK, 4 = NA
        const score = (c: any) => {
          if (c.faltaKamPos || c.faltaKamCat) return 1;
          if (c.noRealizoPushPos || c.noRealizoPushCat) return 2;
          if (c.tieneSeguimientoAplicable && (c.kamPosHecho || c.kamCatHecho)) return 3;
          if (c.tieneSeguimientoAplicable) return 4;
          return 5;
        };
        valA = score(a);
        valB = score(b);
      }

      if (valA < valB) return ordenDir === 'asc' ? -1 : 1;
      if (valA > valB) return ordenDir === 'asc' ? 1 : -1;
      return 0;
    });

    return ordenados;
  }, [casosFiltrados, ordenCampo, ordenDir]);

  const totalPages = Math.ceil(casosActivosOrdenados.length / rowsPerPage);
  const paginatedCasos = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return casosActivosOrdenados.slice(start, start + rowsPerPage);
  }, [casosActivosOrdenados, currentPage, rowsPerPage]);

  // Métricas Generales
  let totalCasos = casosProcesados.length;
  let inProgressNormal = 0;
  let inProgressSinOp = 0;
  let closedSat = 0;
  let closedFail = 0;
  let kamPushTotal = 0;
  let fueraDeSla = 0;
  let proximosVencer = 0;

  casosProcesados.forEach(c => {
    const estado = String(c.estado || '').toLowerCase().trim();

    if (estado.includes('satisfactori')) closedSat++;
    else if (estado.includes('fallid')) closedFail++;
    else if (estado.includes('sin oportunidad') || !c.casoOp || String(c.casoOp).trim() === '' || String(c.casoOp).toLowerCase() === 'sin caso op') inProgressSinOp++;
    else if (estado === 'en progreso' || estado.includes('progreso')) inProgressNormal++;

    if (c.esActivo) {
      if (c.horasSLA >= 96) {
        fueraDeSla++;
      } else if (c.horasSLA >= 72 && c.horasSLA < 96) {
        proximosVencer++;
      }

      if (c.requiereKamPush) {
        kamPushTotal++;
      }
    }
  });

  const copiarTextoPush = (c: any) => {
    const nombreLocal = c.tienda || 'Sin tienda';
    const idLocal = c.vendorId || c.vendor_id || 'N/A';
    const pais = c.pais || 'Sin país';
    const numCasoOnb = (c.casoOp && c.casoOp !== '-' && c.casoOp !== 'Sin caso OP') ? c.casoOp : 'Sin caso OP';
    const numCasoSeguimiento = (c.casoSeguimiento && c.casoSeguimiento !== '-' && String(c.casoSeguimiento).trim() !== '') ? c.casoSeguimiento : 'Sin caso de seguimiento';

    const faltaPushPos = !c.fechaPushPos || c.fechaPushPos === '-' || String(c.fechaPushPos).trim() === '';
    const faltaPushCat = !c.fechaPushCat || c.fechaPushCat === '-' || String(c.fechaPushCat).trim() === '';
    
    let lineaAgente = '';
    if (faltaPushPos || faltaPushCat) {
      lineaAgente = '\nAgente: No realizo push';
    }

    const texto = `Nombre de local: ${nombreLocal}\nId de local: ${idLocal}\nPais: ${pais}\nNumero de caso onb: ${numCasoOnb}\nN° de caso de seguimiento: ${numCasoSeguimiento}${lineaAgente}`;
    navigator.clipboard.writeText(texto);
    
    setCopiadoId(c.id || c.casoOp);
    if (mostrarNotificacion) {
      mostrarNotificacion('Datos copiados al portapapeles', 'success');
    }
    setTimeout(() => {
      setCopiadoId(null);
    }, 2500);
  };

  const ejecutarPushSegunSeguimientoActivo = (c: any) => {
    if (!onRegistrarPush) return;
    if (c.faltaKamPos || c.alertas?.requierePushKamPos) {
      onRegistrarPush(c, 'kam_pos');
    } else if (c.faltaKamCat || c.alertas?.requierePushKamCat) {
      onRegistrarPush(c, 'kam_cat');
    }
  };

  const mesActual = new Date().toLocaleString('es-ES', { month: 'long' });

  // Listas para filtros
  const estadosUnicos = [...new Set(casosProcesados.map(c => c.estado).filter(Boolean))];
  const etapasUnicas = [...new Set(casosProcesados.map(c => c.etapa).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3A3A3E] pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide">Casos en progreso global</h1>
          <p className="text-xs text-[#B3B3B3]">Supervisión de SLAs, Rendimiento y Escalamientos KAM | Mes actual: <span className="capitalize">{mesActual}</span> {new Date().getFullYear()}</p>
        </div>
        <div className="flex items-center gap-3">
          {onForzarSync && (
            <button
              onClick={onForzarSync}
              disabled={sincronizando}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition shadow-lg ${
                sincronizando
                  ? 'bg-[#2C2C32] text-[#9CA3AF] border-[#3A3A3E] cursor-not-allowed'
                  : 'bg-[#2C2C32]/90 hover:bg-[#3A3A3E] text-[#F46C8E] hover:text-pink-300 border-[#E85A80]/40 hover:border-[#E85A80] shadow-pink-950/20 cursor-pointer'
              }`}
              title="Actualizar datos desde Google Sheets"
            >
              <span className={sincronizando ? 'animate-spin inline-block text-xs' : 'text-xs'}>🔄</span>
              <span>{sincronizando ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          )}
          <ReportDownloader 
            casos={casosProcesados.filter(c => c.esActivo && c.horasSLA >= 96)} 
            label="Reporte SLA (96h)" 
            className="bg-[#E85A80] hover:bg-[#F46C8E] text-white font-bold px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 shadow-lg shadow-pink-900/40 min-h-[44px] cursor-pointer"
            icon={<span>🚨</span>}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-[#1A1A1C] p-3.5 rounded-xl border border-[#3A3A3E] text-center">
          <div className="text-[#B3B3B3] text-xs mb-1">Total Casos</div>
          <div className="text-2xl font-bold text-white">{totalCasos}</div>
        </div>
        <div 
          onClick={() => setFiltroKpi(prev => prev === 'en_progreso' ? 'todos' : 'en_progreso')}
          className={`p-3.5 rounded-xl border text-center cursor-pointer transition select-none ${
            filtroKpi === 'en_progreso' ? 'bg-cyan-950/70 border-cyan-500 ring-2 ring-cyan-500' : 'bg-[#1A1A1C] border-cyan-800 hover:border-cyan-600'
          }`}
        >
          <div className="text-cyan-400 text-xs mb-1 flex items-center justify-center gap-1"><span>💼</span> En Progreso</div>
          <div className="text-2xl font-bold text-cyan-400">{inProgressNormal}</div>
        </div>
        <div 
          onClick={() => setFiltroKpi(prev => prev === 'sin_op' ? 'todos' : 'sin_op')}
          className={`p-3.5 rounded-xl border text-center cursor-pointer transition select-none ${
            filtroKpi === 'sin_op' ? 'bg-purple-950/70 border-purple-500 ring-2 ring-purple-500' : 'bg-[#1A1A1C] border-purple-800 hover:border-purple-600'
          }`}
        >
          <div className="text-purple-400 text-xs mb-1 flex items-center justify-center gap-1"><span>⚡</span> Sin OP</div>
          <div className="text-2xl font-bold text-purple-400">{inProgressSinOp}</div>
        </div>
        <div 
          onClick={() => setFiltroKpi(prev => prev === 'fuera_sla' ? 'todos' : 'fuera_sla')}
          className={`p-3.5 rounded-xl border text-center cursor-pointer transition select-none ${
            filtroKpi === 'fuera_sla' ? 'bg-rose-950/70 border-rose-500 ring-2 ring-rose-500' : 'bg-rose-950/20 border-rose-800/80 hover:border-rose-600'
          }`}
        >
          <div className="text-rose-400 text-xs mb-1 font-semibold flex items-center justify-center gap-1"><span>🚨</span> Fuera SLA (≥96h)</div>
          <div className="text-2xl font-black text-rose-400">{fueraDeSla}</div>
        </div>
        <div 
          onClick={() => setFiltroKpi(prev => prev === 'proximos' ? 'todos' : 'proximos')}
          className={`p-3.5 rounded-xl border text-center cursor-pointer transition select-none ${
            filtroKpi === 'proximos' ? 'bg-amber-950/70 border-amber-500 ring-2 ring-amber-500' : 'bg-amber-950/20 border-amber-800/80 hover:border-amber-600'
          }`}
        >
          <div className="text-amber-400 text-xs mb-1 font-semibold flex items-center justify-center gap-1"><span>⚠️</span> Próximos (72-96h)</div>
          <div className="text-2xl font-black text-amber-400">{proximosVencer}</div>
        </div>
        
        {/* Card Req. KAM Push con filtro interactivo */}
        <div 
          onClick={() => setFiltroKpi(prev => prev === 'req_kam_push' ? 'todos' : 'req_kam_push')}
          className={`p-3.5 rounded-xl border text-center cursor-pointer transition select-none ${
            filtroKpi === 'req_kam_push' 
              ? 'bg-amber-950/70 border-amber-500 ring-2 ring-amber-500 shadow-lg shadow-amber-950/50' 
              : 'bg-[#1A1A1C] border-amber-900 hover:border-amber-700'
          }`}
          title="Clic para filtrar la tabla por casos que requieren KAM Push"
        >
          <div className="text-amber-300 text-xs mb-1 font-bold flex items-center justify-center gap-1">
            <span>⚠️</span> Req. KAM Push
          </div>
          <div className="text-2xl font-black text-amber-300">{kamPushTotal}</div>
          <div className="text-[10px] text-amber-400/80 mt-0.5">
            {filtroKpi === 'req_kam_push' ? '● Filtro activo' : 'Clic para filtrar'}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Agent Overview */}
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Resumen por Agente</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {AGENTES_OFICIALES.map(ag => {
              const agentCases = casosActivos.filter(c => c.agenteACargo === ag);
              return <AgentSummary key={ag} agente={ag} casos={agentCases} onClick={setFiltroAgente} />;
            })}
          </div>
        </div>

        {/* Gráfico de Etapas */}
        <div className="bg-[#1A1A1C] p-4 rounded-xl border border-[#3A3A3E]">
          <h2 className="text-sm font-bold text-white mb-3">Distribución de Etapas (En Progreso)</h2>
          <div className="flex flex-col gap-2">
            {Object.entries(
              casosActivos.filter(c => {
                const e = String(c.estado || '').toLowerCase().trim();
                return e.includes('progreso') || e === 'en progreso';
              }).reduce((acc: Record<string, number>, curr: any) => {
                const etapa = limpiarTextoEtapa(curr.etapa) || 'Sin etapa';
                acc[etapa] = (acc[etapa] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).sort((a, b) => b[1] - a[1]).map(([etapa, count]: [string, number], _, arr: [string, number][]) => {
              const maxCount = arr.length > 0 ? arr[0][1] : 1;
              return (
                <div key={etapa} className="flex items-center gap-2">
                  <span className="text-xs text-[#B3B3B3] w-48 truncate" title={etapa}>{etapa}</span>
                  <div className="flex-1 bg-[#2C2C32] rounded-full h-2">
                    <div className="bg-cyan-500 rounded-full h-2" style={{ width: `${(count / maxCount) * 100}%` }}></div>
                  </div>
                  <span className="text-xs font-bold text-white w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
          <div className="bg-[#1A1A1C] p-4 rounded-xl border border-[#3A3A3E] flex flex-wrap gap-3 items-center">
            <span className="text-xs text-[#B3B3B3] font-bold uppercase">Filtros:</span>
            
            <select value={filtroAgente} onChange={e => setFiltroAgente(e.target.value)} className="bg-[#121212] border border-[#3A3A3E] text-xs text-white rounded px-2 py-1">
              <option value="todos">Todos los Agentes</option>
              {AGENTES_OFICIALES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filtroPais} onChange={e => setFiltroPais(e.target.value)} className="bg-[#121212] border border-[#3A3A3E] text-xs text-white rounded px-2 py-1">
              <option value="todos">Todos los Países</option>
              {PAISES_OFICIALES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="bg-[#121212] border border-[#3A3A3E] text-xs text-white rounded px-2 py-1 max-w-[150px]">
              <option value="todos">Todos los Estados</option>
              {estadosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)} className="bg-[#121212] border border-[#3A3A3E] text-xs text-white rounded px-2 py-1 max-w-[150px]">
              <option value="todos">Todas las Etapas</option>
              {etapasUnicas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {(filtroKpi !== 'todos' || filtroAgente !== 'todos' || filtroPais !== 'todos' || filtroEstado !== 'todos' || filtroEtapa !== 'todos') && (
              <button 
                onClick={() => { 
                  setFiltroKpi('todos');
                  setFiltroAgente('todos'); 
                  setFiltroPais('todos'); 
                  setFiltroEstado('todos'); 
                  setFiltroEtapa('todos'); 
                }} 
                className="text-xs text-[#E85A80] hover:underline cursor-pointer font-bold"
              >
                Limpiar Filtros
              </button>
            )}
            <ReportDownloader casos={casosActivosOrdenados} />
          </div>

          {/* Active Cases Table (Ordenados por SLA crítico arriba y con acciones de Push y Copiar) */}
          <div className="bg-[#1A1A1C] rounded-xl border border-[#3A3A3E] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#3A3A3E] bg-[#1a1d27] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Casos Activos ({casosActivosOrdenados.length})</h2>
                <span className="text-[11px] text-[#B3B3B3] bg-[#2C2C32]/80 px-2 py-0.5 rounded-full">
                  Ordenados por SLA Crítico arriba
                </span>
                {filtroKpi !== 'todos' && (
                  <span className="text-[11px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full font-bold">
                    Filtrado por KPI: {filtroKpi.replace(/_/g, ' ').toUpperCase()}
                  </span>
                )}
              </div>
              {fueraDeSla > 0 && (
                <span className="text-[11px] text-rose-300 font-bold bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                  <span>🚨</span> {fueraDeSla} fuera de SLA
                </span>
              )}
            </div>
            {sincronizando && (
              <div className="bg-emerald-950/60 border-b border-emerald-800/70 px-4 py-2.5 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                  <span className="animate-spin text-sm">🔄</span>
                  <span>Sincronizando casos en tiempo real desde Google Sheets (Onboarding_New)...</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">Actualizando tabla...</span>
              </div>
            )}
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-left text-xs text-[#D1D5DB] min-w-max">
                <thead className="bg-[#121212] text-[#B3B3B3] uppercase sticky top-0 z-10 shadow select-none">
                  <tr>
                    {[
                      { key: 'op', label: 'Caso OP' },
                      { key: 'tienda', label: 'Tienda' },
                      { key: 'estado', label: 'Estado' },
                      { key: 'agente', label: 'Agente' },
                      { key: 'etapa', label: 'Etapa' },
                      { key: 'seguimiento', label: 'N° Seguimiento' },
                      { key: 'sla_critico', label: 'SLA (Rango OP)' },
                      { key: 'push', label: 'Push / Seguimiento' },
                      { key: 'acciones', label: 'Acciones', noSort: true }
                    ].map(col => (
                      <th 
                        key={col.key} 
                        className="py-2.5 px-3 relative group"
                        style={{ width: colWidths[col.key], minWidth: colWidths[col.key] }}
                      >
                        <div 
                          className={`flex items-center gap-1 ${!col.noSort ? 'cursor-pointer hover:text-white transition' : ''}`}
                          onClick={() => {
                            if (col.noSort) return;
                            if (ordenCampo === col.key) {
                              setOrdenDir(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setOrdenCampo(col.key);
                              setOrdenDir('asc');
                            }
                          }}
                        >
                          {col.label}
                          {!col.noSort && (
                            <span className={`text-[10px] ${ordenCampo === col.key ? 'text-cyan-400' : 'text-transparent group-hover:text-gray-500'}`}>
                              {ordenCampo === col.key ? (ordenDir === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          )}
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-cyan-500/50"
                          onMouseDown={(e) => iniciarRedimensionar(col.key, e)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {paginatedCasos.map(c => {
                    const esCritico = c.esCritico || c.horasSLA >= 96;
                    const esProximo = !esCritico && (c.esProximoVencer || (c.horasSLA >= 72 && c.horasSLA < 96));
                    const opMostrada = (c.casoOp && c.casoOp !== '-' && c.casoOp !== 'Sin caso OP') ? c.casoOp : 'Sin caso OP';
                    const estaResaltado = casoResaltadoId && (
                      String(c.id) === String(casoResaltadoId) ||
                      String(c.casoOp) === String(casoResaltadoId) ||
                      String(c.vendorId || c.vendor_id) === String(casoResaltadoId)
                    );

                    const tieneAccionPush = Boolean(c.faltaKamPos || c.faltaKamCat);

                    return (
                      <tr 
                        key={c.id || c.casoOp} 
                        id={`caso-row-${c.id || c.casoOp || c.vendorId}`}
                        className={`transition ${
                          estaResaltado
                            ? 'bg-amber-500/25 ring-2 ring-amber-400 border-amber-400 shadow-xl shadow-amber-500/30 animate-pulse'
                            : `hover:bg-[#2C2C32]/50 ${esCritico ? 'bg-rose-950/15' : esProximo ? 'bg-amber-950/10' : ''}`
                        }`}
                      >
                        <td className="py-4 px-3 text-cyan-400 cursor-pointer hover:underline font-mono font-bold" onClick={() => onSeleccionarCaso && onSeleccionarCaso(c)}>
                          <div className="flex items-center gap-1.5">
                            {esCritico && <span title="SLA Vencido (≥96h)">🚨</span>}
                            {esProximo && <span title="Próximo a Vencer (>72h)">⚠️</span>}
                            <span className={opMostrada === 'Sin caso OP' ? 'text-[#B3B3B3] italic font-sans' : ''}>{opMostrada}</span>
                          </div>
                        </td>
                        <td className="py-4 px-3 truncate max-w-[150px]" title={c.tienda}>{c.tienda}</td>
                        <td className="py-4 px-3">
                          {String(c.estado || '').toLowerCase().includes('sin oportunidad') ? (
                            <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/70 text-[10px] font-semibold inline-flex items-center gap-1 shadow-sm">
                              <span>⚡</span> Sin OP
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/70 text-[10px] font-semibold inline-flex items-center gap-1 shadow-sm">
                              <span>💼</span> En Progreso
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-3 font-medium text-[#D1D5DB]">{c.agenteACargo}</td>
                        <td className="py-4 px-3"><span className="px-2 py-0.5 rounded bg-[#2C2C32] text-[10px]">{limpiarTextoEtapa(c.etapa)}</span></td>
                        <td className="py-4 px-3 text-[#D1D5DB] font-mono text-xs">{c.casoSeguimiento && c.casoSeguimiento !== '-' ? c.casoSeguimiento : <span className="text-[#9CA3AF] italic">S/N</span>}</td>
                        <td className="py-4 px-3">
                          <div className="flex flex-col items-start gap-0.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              esCritico 
                                ? 'bg-rose-950 text-rose-300 border border-rose-700 font-extrabold shadow-sm'
                                : esProximo
                                  ? 'bg-amber-950 text-amber-300 border border-amber-700 font-bold'
                                  : c.colorClass || 'bg-[#2C2C32] text-[#D1D5DB]'
                            }`}>
                              {c.rangoSlaOp || `${c.horasSLA}h`}
                            </span>
                            {c.tiempoTranscurridoOp && (
                              <span className="text-[10px] text-[#B3B3B3] font-mono" title={c.tiempoTranscurridoOp}>
                                {c.tiempoTranscurridoOp}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            {!c.tieneSeguimientoAplicable ? (
                              <span className="text-[10px] text-[#9CA3AF] font-mono" title="Etapa sin seguimiento de Push POS/Catálogo (S/V)">No aplica (S/V)</span>
                            ) : (
                              <>
                                {/* Alerta agente no realizó push en POS API */}
                                {c.noRealizoPushPos && (
                                  <span className="text-[10px] text-rose-300 bg-rose-950/80 border border-rose-800/80 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1" title="El agente no realizó push de seguimiento POS API">
                                    <span>⚠️</span> No realizo push {c.tieneInicioCat ? '(POS)' : ''}
                                  </span>
                                )}

                                {/* Alerta agente no realizó push en Catálogo */}
                                {c.noRealizoPushCat && (
                                  <span className="text-[10px] text-rose-300 bg-rose-950/80 border border-rose-800/80 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1" title="El agente no realizó push de seguimiento Catálogo">
                                    <span>📦</span> No realizo push {c.tieneInicioPos ? '(Cat)' : ''}
                                  </span>
                                )}

                                {/* Push KAM Estado */}
                                {c.faltaKamPos ? (
                                  <span className="text-[10px] text-amber-300 bg-amber-950/80 border border-amber-700/80 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1" title="Requiere Push KAM POS (>24h y respuesta NO)">
                                    <span>⚡</span> Falta KAM POS
                                  </span>
                                ) : c.kamPosHecho ? (
                                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded font-mono inline-flex items-center gap-1" title="Push KAM POS registrado">
                                    <span>✅</span> KAM POS
                                  </span>
                                ) : null}

                                {c.faltaKamCat ? (
                                  <span className="text-[10px] text-amber-300 bg-amber-950/80 border border-amber-700/80 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1" title="Requiere Push KAM Catálogo (>24h y respuesta NO)">
                                    <span>⚡</span> Falta KAM Cat
                                  </span>
                                ) : c.kamCatHecho ? (
                                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded font-mono inline-flex items-center gap-1" title="Push KAM Catálogo registrado">
                                    <span>✅</span> KAM Cat
                                  </span>
                                ) : null}

                                {!c.noRealizoPushPos && !c.noRealizoPushCat && !c.faltaKamPos && !c.faltaKamCat && (
                                  (c.kamPosHecho || c.kamCatHecho) ? (
                                    <span className="text-[10px] text-emerald-400 font-medium">✅ Al día</span>
                                  ) : (
                                    <span className="text-[10px] text-[#9CA3AF] font-medium">Sin req. KAM</span>
                                  )
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        {/* Columna Acciones con botón exclusivo Push KAM para TL / Supervisor */}
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-1.5 justify-center flex-wrap">
                            {/* Botón Push KAM POS API (exclusivo TL / Supervisor) */}
                            {c.faltaKamPos && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onRegistrarPush) onRegistrarPush(c, 'kam_pos');
                                }}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-2 py-1 rounded shadow transition flex items-center gap-1 cursor-pointer whitespace-nowrap active:scale-95"
                                title="Hacer Push KAM para POS API únicamente"
                              >
                                <span>⚡</span>
                                <span>Push KAM POS</span>
                              </button>
                            )}

                            {/* Botón Push KAM Catálogo (exclusivo TL / Supervisor) */}
                            {c.faltaKamCat && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onRegistrarPush) onRegistrarPush(c, 'kam_cat');
                                }}
                                className="bg-[#E85A80] hover:bg-[#F46C8E] text-white font-bold text-[10px] px-2 py-1 rounded shadow transition flex items-center gap-1 cursor-pointer whitespace-nowrap active:scale-95"
                                title="Hacer Push KAM para Catálogo únicamente"
                              >
                                <span>⚡</span>
                                <span>Push KAM Cat</span>
                              </button>
                            )}

                            {/* Si no requiere Push KAM, botón Ver */}
                            {!c.faltaKamPos && !c.faltaKamCat && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onSeleccionarCaso) onSeleccionarCaso(c);
                                }}
                                className="bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#B3B3B3] hover:text-white text-[10px] px-2 py-1 rounded transition cursor-pointer"
                                title="Ver detalles del caso"
                              >
                                Ver
                              </button>
                            )}

                            {/* Botón Copiar Push */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copiarTextoPush(c);
                              }}
                              className={`text-[10px] font-semibold px-2 py-1 rounded border transition flex items-center gap-1 cursor-pointer whitespace-nowrap active:scale-95 ${
                                copiadoId === (c.id || c.casoOp)
                                  ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                                  : 'bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#D1D5DB] hover:text-white border-[#3A3A3E]'
                              }`}
                              title="Copiar datos del caso (Nombre local, ID, País, Caso OP, Caso Seguimiento)"
                            >
                              <span>{copiadoId === (c.id || c.casoOp) ? '✅' : '📋'}</span>
                              <span>{copiadoId === (c.id || c.casoOp) ? '¡Copiado!' : 'Copiar Push'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {casosActivosOrdenados.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#9CA3AF]">
                        No hay casos activos que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>

              </table>
            </div>
            
            {/* Pagination Controls */}
            {casosActivosOrdenados.length > 0 && (
              <div className="p-3 bg-[#1a1d27] border-t border-[#3A3A3E] flex items-center justify-between text-xs text-[#B3B3B3]">
                <div className="flex items-center gap-2">
                  <span>Mostrar:</span>
                  <select 
                    value={rowsPerPage} 
                    onChange={e => setRowsPerPage(Number(e.target.value))} 
                    className="bg-[#121212] border border-[#3A3A3E] text-white rounded px-2 py-1"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                  </select>
                  <span>casos</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Página {currentPage} de {totalPages || 1}</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 bg-[#2C2C32] rounded disabled:opacity-50 hover:bg-[#3A3A3E] text-white transition"
                    >
                      Anterior
                    </button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-2 py-1 bg-[#2C2C32] rounded disabled:opacity-50 hover:bg-[#3A3A3E] text-white transition"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>


      </div>
    </div>
  );
}
