import React, { useState, useMemo } from 'react';
import AgentSummary from './AgentSummary';
import MetricsPanel from './MetricsPanel';
import ReportDownloader from './ReportDownloader';
import { analizarAlertasCaso, limpiarTextoEtapa } from '../../utils/onboardingRules';
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

  // Procesar casos
  const casosProcesados = useMemo(() => {
    return casos.map(c => {
      const alertas = analizarAlertasCaso(c);
      const agenteACargo = c.propietarioTicket || c.propietarioOportunidad || c.agente || 'Sin Asignar';
      
      // Normalizar nombre de agente
      let normalizedAgent = agenteACargo;
      AGENTES_OFICIALES.forEach(ao => {
        if (agenteACargo.toLowerCase().includes(ao.split(' ')[0].toLowerCase())) {
          normalizedAgent = ao;
        }
      });

      return {
        ...c,
        alertas,
        horasSLA: alertas.horasTranscurridas || c.horasSLA || 0,
        rangoSlaOp: c.rangoSlaOp || alertas.rangoSla || '',
        tiempoTranscurridoOp: c.tiempoTranscurridoOp || alertas.tiempoTexto || '',
        esCritico: alertas.esCritico,
        esProximoVencer: alertas.esProximoVencer,
        agenteACargo: normalizedAgent,
        colorClass: alertas.colorClass || 'bg-gray-800'
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
      return true;
    });
  }, [casosProcesados, filtroAgente, filtroPais, filtroEstado, filtroEtapa]);

  const casosActivos = useMemo(() => {
    return casosProcesados.filter(c => esEstadoActivoOficial(c.estado) || (c.esActivo && !String(c.estado).toLowerCase().includes('cerrad') && !String(c.estado).toLowerCase().includes('fallid')));
  }, [casosProcesados]);

  // Ordenar casos activos: Críticos (≥96h) arriba de todo, luego próximos a vencer (72-96h), luego orden descendente por horasSLA
  const casosActivosOrdenados = useMemo(() => {
    return [...casosFiltrados.filter(c => esEstadoActivoOficial(c.estado) || (c.esActivo && !String(c.estado).toLowerCase().includes('cerrad') && !String(c.estado).toLowerCase().includes('fallid')))].sort((a, b) => {
      // 1. Críticos fuera de SLA (≥96h)
      const critA = (a.esCritico || a.horasSLA >= 96) ? 1 : 0;
      const critB = (b.esCritico || b.horasSLA >= 96) ? 1 : 0;
      if (critA !== critB) return critB - critA;

      // 2. Próximos a vencer (72h a <96h)
      const proxA = (a.esProximoVencer || (a.horasSLA >= 72 && a.horasSLA < 96)) ? 1 : 0;
      const proxB = (b.esProximoVencer || (b.horasSLA >= 72 && b.horasSLA < 96)) ? 1 : 0;
      if (proxA !== proxB) return proxB - proxA;

      // 3. Descendente por horasSLA
      return (b.horasSLA || 0) - (a.horasSLA || 0);
    });
  }, [casosFiltrados]);

  // Métricas Generales
  let totalCasos = casosProcesados.length;
  let inProgressNormal = 0;
  let inProgressSinOp = 0;
  let closedSat = 0;
  let closedFail = 0;
  let kamPush = 0;
  let fueraDeSla = 0;
  let proximosVencer = 0;

  casosProcesados.forEach(c => {
    const estado = String(c.estado || '').toLowerCase().trim();
    const esActivo = !estado.match(/cerrad|fallid|cancel/) && (estado.includes('progreso') || c.esActivo);

    if (estado.includes('satisfactori')) closedSat++;
    else if (estado.includes('fallid')) closedFail++;
    else if (estado.includes('sin oportunidad') || !c.casoOp || String(c.casoOp).trim() === '') inProgressSinOp++;
    else if (estado === 'en progreso' || estado.includes('progreso')) inProgressNormal++;

    if (esActivo) {
      if (c.esCritico || c.horasSLA >= 96) {
        fueraDeSla++;
      } else if (c.esProximoVencer || (c.horasSLA >= 72 && c.horasSLA < 96)) {
        proximosVencer++;
      }

      if (c.horasSLA >= 24 && c.horasSLA < 96) kamPush++;
    }
  });

  const mesActual = new Date().toLocaleString('es-ES', { month: 'long' });

  // Listas para filtros
  const estadosUnicos = [...new Set(casosProcesados.map(c => c.estado).filter(Boolean))];
  const etapasUnicas = [...new Set(casosProcesados.map(c => c.etapa).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide">Dashboard TL</h1>
          <p className="text-xs text-gray-400">Supervisión de SLAs, Rendimiento y Escalamientos KAM</p>
        </div>
        <div className="flex items-center gap-3">
          {onForzarSync && (
            <button
              onClick={onForzarSync}
              disabled={sincronizando}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition shadow-lg ${
                sincronizando
                  ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                  : 'bg-gray-800/90 hover:bg-gray-700 text-pink-400 hover:text-pink-300 border-pink-500/40 hover:border-pink-500 shadow-pink-950/20 cursor-pointer'
              }`}
              title="Actualizar datos desde Google Sheets"
            >
              <span className={sincronizando ? 'animate-spin inline-block text-xs' : 'text-xs'}>🔄</span>
              <span>{sincronizando ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          )}
          <ReportDownloader casos={casosActivos} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-[#151824] p-3.5 rounded-xl border border-gray-800 text-center">
          <div className="text-gray-400 text-xs mb-1">Total Casos</div>
          <div className="text-2xl font-bold text-white">{totalCasos}</div>
        </div>
        <div className="bg-[#151824] p-3.5 rounded-xl border border-cyan-800 text-center">
          <div className="text-cyan-400 text-xs mb-1 flex items-center justify-center gap-1"><span>💼</span> En Progreso</div>
          <div className="text-2xl font-bold text-cyan-400">{inProgressNormal}</div>
        </div>
        <div className="bg-[#151824] p-3.5 rounded-xl border border-purple-800 text-center">
          <div className="text-purple-400 text-xs mb-1 flex items-center justify-center gap-1"><span>⚡</span> Sin OP</div>
          <div className="text-2xl font-bold text-purple-400">{inProgressSinOp}</div>
        </div>
        <div className="bg-[#151824] p-3.5 rounded-xl border border-rose-800/80 bg-rose-950/20 text-center shadow-lg shadow-rose-950/30">
          <div className="text-rose-400 text-xs mb-1 font-semibold flex items-center justify-center gap-1"><span>🚨</span> Fuera SLA (≥96h)</div>
          <div className="text-2xl font-black text-rose-400">{fueraDeSla}</div>
        </div>
        <div className="bg-[#151824] p-3.5 rounded-xl border border-amber-800/80 bg-amber-950/20 text-center">
          <div className="text-amber-400 text-xs mb-1 font-semibold flex items-center justify-center gap-1"><span>⚠️</span> Próximos (72-96h)</div>
          <div className="text-2xl font-black text-amber-400">{proximosVencer}</div>
        </div>
        <div className="bg-[#151824] p-3.5 rounded-xl border border-amber-900 text-center">
          <div className="text-amber-300 text-xs mb-1">Req. KAM Push</div>
          <div className="text-2xl font-bold text-amber-300">{kamPush}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (Left, 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          
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

          {/* Filters */}
          <div className="bg-[#151824] p-4 rounded-xl border border-gray-800 flex flex-wrap gap-3 items-center">
            <span className="text-xs text-gray-400 font-bold uppercase">Filtros:</span>
            <select value={filtroAgente} onChange={e => setFiltroAgente(e.target.value)} className="bg-[#0f111a] border border-gray-700 text-xs text-white rounded px-2 py-1">
              <option value="todos">Todos los Agentes</option>
              {AGENTES_OFICIALES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filtroPais} onChange={e => setFiltroPais(e.target.value)} className="bg-[#0f111a] border border-gray-700 text-xs text-white rounded px-2 py-1">
              <option value="todos">Todos los Países</option>
              {PAISES_OFICIALES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="bg-[#0f111a] border border-gray-700 text-xs text-white rounded px-2 py-1 max-w-[150px]">
              <option value="todos">Todos los Estados</option>
              {estadosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)} className="bg-[#0f111a] border border-gray-700 text-xs text-white rounded px-2 py-1 max-w-[150px]">
              <option value="todos">Todas las Etapas</option>
              {etapasUnicas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {(filtroAgente !== 'todos' || filtroPais !== 'todos' || filtroEstado !== 'todos' || filtroEtapa !== 'todos') && (
              <button onClick={() => { setFiltroAgente('todos'); setFiltroPais('todos'); setFiltroEstado('todos'); setFiltroEtapa('todos'); }} className="text-xs text-pink-500 hover:underline">Limpiar</button>
            )}
          </div>

          {/* Active Cases Table (Ordenados por SLA crítico arriba) */}
          <div className="bg-[#151824] rounded-xl border border-gray-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-800 bg-[#1a1d27] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Casos Activos ({casosActivosOrdenados.length})</h2>
                <span className="text-[11px] text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-full">
                  Ordenados por SLA Crítico arriba
                </span>
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
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0f111a] text-gray-400 uppercase sticky top-0 z-10 shadow">
                  <tr>
                    <th className="py-2.5 px-3">Caso OP</th>
                    <th className="py-2.5 px-3">Tienda</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Agente</th>
                    <th className="py-2.5 px-3">Etapa</th>
                    <th className="py-2.5 px-3">SLA (Rango OP)</th>
                    <th className="py-2.5 px-3">Push / Seguimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {casosActivosOrdenados.map(c => {
                    const esCritico = c.esCritico || c.horasSLA >= 96;
                    const esProximo = !esCritico && (c.esProximoVencer || (c.horasSLA >= 72 && c.horasSLA < 96));
                    const estaResaltado = casoResaltadoId && (
                      String(c.id) === String(casoResaltadoId) ||
                      String(c.casoOp) === String(casoResaltadoId) ||
                      String(c.vendorId || c.vendor_id) === String(casoResaltadoId)
                    );

                    return (
                      <tr 
                        key={c.id || c.casoOp} 
                        id={`caso-row-${c.id || c.casoOp || c.vendorId}`}
                        className={`transition ${
                          estaResaltado
                            ? 'bg-amber-500/25 ring-2 ring-amber-400 border-amber-400 shadow-xl shadow-amber-500/30 animate-pulse'
                            : `hover:bg-gray-800/50 ${esCritico ? 'bg-rose-950/15' : esProximo ? 'bg-amber-950/10' : ''}`
                        }`}
                      >
                        <td className="py-2.5 px-3 text-cyan-400 cursor-pointer hover:underline font-mono font-bold" onClick={() => onSeleccionarCaso && onSeleccionarCaso(c)}>
                          <div className="flex items-center gap-1.5">
                            {esCritico && <span title="SLA Vencido (≥96h)">🚨</span>}
                            {esProximo && <span title="Próximo a Vencer (>72h)">⚠️</span>}
                            <span>{c.casoOp}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 truncate max-w-[150px]" title={c.tienda}>{c.tienda}</td>
                        <td className="py-2.5 px-3">
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
                        <td className="py-2.5 px-3 font-medium text-gray-300">{c.agenteACargo}</td>
                        <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-gray-800 text-[10px]">{limpiarTextoEtapa(c.etapa)}</span></td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col items-start gap-0.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              esCritico 
                                ? 'bg-rose-950 text-rose-300 border border-rose-700 font-extrabold shadow-sm'
                                : esProximo
                                  ? 'bg-amber-950 text-amber-300 border border-amber-700 font-bold'
                                  : c.colorClass || 'bg-gray-800 text-gray-300'
                            }`}>
                              {c.rangoSlaOp || `${c.horasSLA}h`}
                            </span>
                            {c.tiempoTranscurridoOp && (
                              <span className="text-[10px] text-gray-400 font-mono" title={c.tiempoTranscurridoOp}>
                                {c.tiempoTranscurridoOp}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            {/* Push POS */}
                            {c.alertas?.requierePushPos ? (
                              <button 
                                onClick={(e) => { e.stopPropagation(); onRegistrarPush && onRegistrarPush(c, 'pos'); }}
                                className="text-[10px] bg-amber-600 hover:bg-amber-500 text-white font-bold px-2 py-0.5 rounded shadow transition flex items-center gap-1 cursor-pointer"
                                title="Registrar Push POS API con 1 solo clic"
                              >
                                <span>🔔</span> Push POS
                              </button>
                            ) : c.fechaPushPos && c.fechaPushPos !== '-' && c.fechaPushPos !== '' ? (
                              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded font-mono inline-flex items-center gap-1" title={`Push POS: ${c.fechaPushPos}`}>
                                <span>✅</span> POS: {c.fechaPushPos.split(' ')[0]}
                              </span>
                            ) : null}

                            {/* Push Catálogo */}
                            {c.alertas?.requierePushCat ? (
                              <button 
                                onClick={(e) => { e.stopPropagation(); onRegistrarPush && onRegistrarPush(c, 'cat'); }}
                                className="text-[10px] bg-pink-600 hover:bg-pink-500 text-white font-bold px-2 py-0.5 rounded shadow transition flex items-center gap-1 cursor-pointer"
                                title="Registrar Push Catálogo con 1 solo clic"
                              >
                                <span>📦</span> Push Cat
                              </button>
                            ) : c.fechaPushCat && c.fechaPushCat !== '-' && c.fechaPushCat !== '' ? (
                              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded font-mono inline-flex items-center gap-1" title={`Push Catálogo: ${c.fechaPushCat}`}>
                                <span>✅</span> Cat: {c.fechaPushCat.split(' ')[0]}
                              </span>
                            ) : null}

                            {/* Push KAM si aplica */}
                            {c.alertas?.requierePushKamPos ? (
                              <button 
                                onClick={(e) => { e.stopPropagation(); onRegistrarPush && onRegistrarPush(c, 'kam_pos'); }}
                                className="text-[10px] bg-amber-700 hover:bg-amber-600 text-white font-bold px-2 py-0.5 rounded shadow transition flex items-center gap-1 cursor-pointer"
                                title="Registrar Push KAM (POS) con 1 clic"
                              >
                                <span>⚡</span> KAM POS
                              </button>
                            ) : null}

                            {c.alertas?.requierePushKamCat ? (
                              <button 
                                onClick={(e) => { e.stopPropagation(); onRegistrarPush && onRegistrarPush(c, 'kam_cat'); }}
                                className="text-[10px] bg-amber-700 hover:bg-amber-600 text-white font-bold px-2 py-0.5 rounded shadow transition flex items-center gap-1 cursor-pointer"
                                title="Registrar Push KAM (Catálogo) con 1 clic"
                              >
                                <span>⚡</span> KAM Cat
                              </button>
                            ) : null}

                            {!c.alertas?.requierePushPos && !c.alertas?.requierePushCat && !c.alertas?.requierePushKamPos && !c.alertas?.requierePushKamCat && !c.fechaPushPos && !c.fechaPushCat && (
                              <span className="text-[10px] text-gray-500">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {casosActivosOrdenados.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-gray-500">No hay casos activos que coincidan con los filtros seleccionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Needing KAM Push */}
          <div className="bg-amber-950/20 rounded-xl border border-amber-900/40 overflow-hidden">
            <div className="p-4 border-b border-amber-900/40 bg-amber-900/20 flex items-center justify-between">
              <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2"><span>⚠️</span> Requieren KAM Push (24-72h)</h2>
              <span className="text-[11px] text-amber-300 font-medium">1 clic para registrar Push KAM</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {casosActivos.filter(c => (c.horasSLA >= 24 && c.horasSLA < 96) || c.alertas?.requierePushKamPos || c.alertas?.requierePushKamCat).slice(0, 8).map(c => {
                const faltaKamPos = c.alertas?.requierePushKamPos;
                const faltaKamCat = c.alertas?.requierePushKamCat;
                const tieneAlgunPushKam = (c.pushKamPos === true || String(c.pushKamPos).toUpperCase() === 'TRUE') || (c.pushKamCat === true || String(c.pushKamCat).toUpperCase() === 'TRUE');

                return (
                  <div key={c.id} className="bg-[#0f111a] border border-amber-900/40 p-3 rounded-lg text-xs flex flex-col justify-between gap-2.5 hover:border-amber-500 transition">
                    <div className="flex justify-between items-start cursor-pointer" onClick={() => onSeleccionarCaso && onSeleccionarCaso(c)}>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="font-mono text-cyan-400">{c.casoOp}</span>
                          <span className="text-gray-300 truncate max-w-[130px]" title={c.tienda}>({c.tienda})</span>
                        </div>
                        <div className="text-gray-500 text-[10px] mt-0.5">{c.agenteACargo} • {c.pais}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-400 font-bold px-1.5 py-0.5 bg-amber-950/60 rounded border border-amber-800/60">{c.rangoSlaOp || `${c.horasSLA}h`}</span>
                      </div>
                    </div>

                    {/* Botones de acción Push KAM (SOLO SI FALTA HACER EL PUSH) */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-800 gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {faltaKamPos ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRegistrarPush && onRegistrarPush(c, 'kam_pos'); }}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow transition flex items-center gap-1 cursor-pointer"
                            title="Registrar Push KAM para POS API con 1 solo clic"
                          >
                            <span>🔔</span> Push KAM POS
                          </button>
                        ) : (c.pushKamPos === true || String(c.pushKamPos).toUpperCase() === 'TRUE') ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1" title="Push KAM POS registrado">
                            <span>✅</span> KAM POS
                          </span>
                        ) : null}

                        {faltaKamCat ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRegistrarPush && onRegistrarPush(c, 'kam_cat'); }}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow transition flex items-center gap-1 cursor-pointer"
                            title="Registrar Push KAM para Catálogo con 1 solo clic"
                          >
                            <span>📦</span> Push KAM Cat
                          </button>
                        ) : (c.pushKamCat === true || String(c.pushKamCat).toUpperCase() === 'TRUE') ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1" title="Push KAM Catálogo registrado">
                            <span>✅</span> KAM Cat
                          </span>
                        ) : null}

                        {!faltaKamPos && !faltaKamCat && tieneAlgunPushKam && (
                          <span className="text-[10px] text-emerald-400 inline-flex items-center gap-1 font-semibold">
                            <span>✅</span> Push KAM al día
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onSeleccionarCaso && onSeleccionarCaso(c)}
                        className="text-[10px] text-gray-400 hover:text-white underline cursor-pointer"
                      >
                        Ver caso
                      </button>
                    </div>
                  </div>
                );
              })}
              {casosActivos.filter(c => (c.horasSLA >= 24 && c.horasSLA < 96) || c.alertas?.requierePushKamPos || c.alertas?.requierePushKamCat).length === 0 && (
                <div className="col-span-2 text-center text-xs text-gray-500 py-4">No hay casos que requieran KAM Push actualmente.</div>
              )}
            </div>
          </div>

        </div>

        {/* Sidebar (Right, 1 col) */}
        <div>
          <MetricsPanel casos={casosProcesados} mesActual={mesActual} />
        </div>
      </div>
    </div>
  );
}
