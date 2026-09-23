import React, { useState, useMemo } from 'react';

export default function HeroCareTLView({ 
  casos = [], 
  onSeleccionarCaso,
  onActualizarCaso,
  nombreUsuario,
  rolUsuario,
  mostrarNotificacion 
}) {
  const [subTab, setSubTab] = useState('global'); // 'global' | 'rendimiento'
  const [filtroAgente, setFiltroAgente] = useState('todos');

  // Filtrar casos activos (ocultar cerrados o fallidos)
  const casosActivos = useMemo(() => {
    return casos.filter(c => {
      const estadoNorm = (c.estado || '').toLowerCase().trim();
      return !estadoNorm.includes('cerrado') && 
             !estadoNorm.includes('fallido') && 
             !estadoNorm.includes('resuelto');
    });
  }, [casos]);

  // Cálculo de SLA para cada caso
  const casosConSLA = useMemo(() => {
    return casosActivos.map(c => {
      let horas = 0;
      let inicio = null;

      if (c.sla_inicio) {
        inicio = new Date(c.sla_inicio);
      } else if (c.fechaCreacion) {
        inicio = new Date(c.fechaCreacion);
      }

      if (inicio && !isNaN(inicio.getTime())) {
        horas = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / (1000 * 60 * 60)));
      } else {
        // Fallback estimado si no hay fecha exacta
        horas = 12;
      }

      const esCritico = horas >= 96;
      const esAtencion = horas >= 4 && horas < 96;
      const esEnTiempo = horas < 4;

      let tiempoTexto = '< 4h';
      if (esCritico) {
        tiempoTexto = '≥ 96h';
      } else if (esAtencion) {
        tiempoTexto = '≥ 4h';
      }

      // Agente asignado
      const agenteACargo = c.propietarioTicket || c.propietarioOportunidad || c.agente || 'Sin Asignar';

      return {
        ...c,
        horasSLA: horas,
        esCritico,
        esAtencion,
        esEnTiempo,
        tiempoTexto,
        agenteACargo
      };
    });
  }, [casosActivos]);

  // Métricas TL
  const totalActivos = casosConSLA.length;
  const totalCriticos = casosConSLA.filter(c => c.esCritico).length;
  const totalAtencion = casosConSLA.filter(c => c.esAtencion).length;

  // Filtrado por agente si aplica
  const casosFiltrados = useMemo(() => {
    if (filtroAgente === 'todos') return casosConSLA;
    return casosConSLA.filter(c => c.agenteACargo.toLowerCase().includes(filtroAgente.toLowerCase()));
  }, [casosConSLA, filtroAgente]);

  // Lista de agentes para métricas de rendimiento
  const estadisticasAgentes = useMemo(() => {
    const mapa = {};
    casosConSLA.forEach(c => {
      const ag = c.agenteACargo || 'Sin Asignar';
      if (!mapa[ag]) {
        mapa[ag] = { nombre: ag, total: 0, criticos: 0, atencion: 0, enTiempo: 0 };
      }
      mapa[ag].total += 1;
      if (c.esCritico) mapa[ag].criticos += 1;
      else if (c.esAtencion) mapa[ag].atencion += 1;
      else mapa[ag].enTiempo += 1;
    });

    return Object.values(mapa).map(a => ({
      ...a,
      cumplimiento: a.total > 0 ? Math.round(((a.total - a.criticos) / a.total) * 100) : 100
    })).sort((a, b) => b.total - a.total);
  }, [casosConSLA]);

  // Acción TL 1: Copiar plantilla Slack de escalamiento
  const copiarSlack = (caso) => {
    const texto = `🚨 *ESCALAMIENTO TL - ONBOARDING*
• *Caso OP:* \`${caso.casoOp || caso.id}\`
• *ID Local:* \`${caso.vendorId || caso.id}\` (${caso.tienda || 'Sin nombre'})
• *Agente Asignado:* ${caso.agenteACargo}
• *Estado:* ${caso.estado || 'Activo'} | ${caso.etapa || 'Validación'}
• *SLA:* *${caso.tiempoTexto}* (${caso.horasSLA}h transcurridas)
Favor verificar push de catálogo y activación prioritaria con el KAM.`;

    navigator.clipboard.writeText(texto);
    if (mostrarNotificacion) {
      mostrarNotificacion(`📋 Plantilla de Slack copiada para Caso OP ${caso.casoOp || caso.id}`, "success");
    }
  };

  // Acción TL 2: Confirmar Push
  const confirmarPush = async (caso) => {
    const casoActualizado = {
      ...caso,
      etapa: 'Pedido de prueba realizado',
      estado: 'En progreso',
      comentarios: (caso.comentarios ? caso.comentarios + '\n' : '') + `[${new Date().toLocaleDateString('es-ES')}] Push confirmado por TL (${nombreUsuario || 'Supervisor'}).`
    };

    if (onActualizarCaso) {
      await onActualizarCaso(casoActualizado);
    }
    if (mostrarNotificacion) {
      mostrarNotificacion(`✅ Push confirmado para Caso OP ${caso.casoOp || caso.id}. Etapa actualizada.`, "success");
    }
  };

  // Descargar CSV de casos críticos
  const descargarCasosCriticos = () => {
    const criticos = casosConSLA.filter(c => c.esCritico);
    if (criticos.length === 0) {
      mostrarNotificacion?.("No hay casos en riesgo crítico en este momento.", "info");
      return;
    }

    const headers = ["N° Caso OP", "ID Local (Vendor)", "Tienda", "País", "Estado", "Etapa", "Horas SLA", "Agente a Cargo", "KAM"];
    const rows = criticos.map(c => [
      `"${c.casoOp || c.id}"`,
      `"${c.vendorId || ''}"`,
      `"${(c.tienda || '').replace(/"/g, '""')}"`,
      `"${c.pais || ''}"`,
      `"${c.estado || ''}"`,
      `"${c.etapa || ''}"`,
      `"${c.horasSLA}h"`,
      `"${c.agenteACargo}"`,
      `"${c.kam || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `HeroCare_TL_Casos_Criticos_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarNotificacion?.(`📥 Descargados ${criticos.length} casos críticos en CSV.`, "success");
  };

  return (
    <div className="space-y-6">
      {/* HEADER HERO CARE TL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-xl shadow-lg shadow-orange-950/40">
            📦
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
              <span>HeroCare TL</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-400">
                Supervisión & Escalamiento
              </span>
            </h1>
            <p className="text-xs text-gray-400">Control operativo de SLAs, push de catálogos y escalamiento en tiempo real</p>
          </div>
        </div>

        {/* SUB-TABS: Dashboard Global | Rendimiento Agentes */}
        <div className="flex items-center gap-2 bg-[#121420] p-1 rounded-xl border border-gray-800">
          <button
            onClick={() => setSubTab('global')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              subTab === 'global'
                ? 'bg-[#00e5ff] text-black shadow-md shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>📊</span> Dashboard Global
          </button>
          <button
            onClick={() => setSubTab('rendimiento')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              subTab === 'rendimiento'
                ? 'bg-[#00e5ff] text-black shadow-md shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>👥</span> Rendimiento Agentes
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Casos Activos */}
        <div className="bg-[#151824] border border-[#262a3b] rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-700 to-gray-500" />
          <span className="text-xs text-gray-400 font-medium mb-1">Total Casos Activos (Equipo)</span>
          <span className="text-4xl sm:text-5xl font-black text-white">{totalActivos}</span>
        </div>

        {/* Card 2: Riesgo Crítico (≥ 96h) */}
        <div className="bg-[#151824] border-2 border-red-500/80 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg shadow-red-950/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          <span className="text-xs text-red-400 font-bold mb-1 flex items-center gap-1">
            <span>⚠️</span> Riesgo Crítico (≥ 96h)
          </span>
          <span className="text-4xl sm:text-5xl font-black text-red-500">{totalCriticos}</span>
        </div>

        {/* Card 3: Atención Requerida (≥ 4h) */}
        <div className="bg-[#151824] border-2 border-amber-500/80 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg shadow-amber-950/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <span className="text-xs text-amber-400 font-bold mb-1 flex items-center gap-1">
            <span>⏱️</span> Atención Requerida (≥ 4h)
          </span>
          <span className="text-4xl sm:text-5xl font-black text-amber-400">{totalAtencion}</span>
        </div>
      </div>

      {subTab === 'global' ? (
        /* TAB: DASHBOARD GLOBAL */
        <div className="bg-[#151824] border border-[#232738] rounded-2xl p-5 space-y-4 shadow-xl">
          {/* Header de la tabla */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Monitoreo de SLA Global</h2>
              <p className="text-xs text-gray-400">
                Visualizando casos de todo el equipo ONB. Los casos cerrados o fallidos se ocultan automáticamente.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Filtro por agente */}
              <select
                value={filtroAgente}
                onChange={(e) => setFiltroAgente(e.target.value)}
                className="bg-[#0f111a] border border-gray-700 text-xs text-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-cyan-400 outline-none"
              >
                <option value="todos">Todos los Agentes</option>
                {estadisticasAgentes.map(ag => (
                  <option key={ag.nombre} value={ag.nombre}>{ag.nombre} ({ag.total})</option>
                ))}
              </select>

              {/* Botón Descargar Casos Críticos */}
              <button
                onClick={descargarCasosCriticos}
                className="bg-[#10b981] hover:bg-[#059669] text-black font-black px-4 py-2 rounded-lg text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                <span>📥</span> Descargar Casos Críticos (.CSV)
              </button>
            </div>
          </div>

          {/* Tabla Global */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0f111a] text-gray-400 uppercase text-[11px] font-bold border-b border-gray-800 tracking-wider">
                <tr>
                  <th className="py-3 px-4">N° CASO</th>
                  <th className="py-3 px-4">ID LOCAL</th>
                  <th className="py-3 px-4">TIENDA</th>
                  <th className="py-3 px-4">ESTADO ACTUAL</th>
                  <th className="py-3 px-4">TIEMPO SLA</th>
                  <th className="py-3 px-4">AGENTE A CARGO</th>
                  <th className="py-3 px-4 text-center">ACCIÓN TL (ESCALAR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-sans">
                {casosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No hay casos activos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  casosFiltrados.map((caso, idx) => (
                    <tr 
                      key={caso.casoOp || caso.id || idx}
                      className="hover:bg-gray-800/40 transition group"
                    >
                      {/* N° CASO */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                        <button
                          onClick={() => onSeleccionarCaso && onSeleccionarCaso(caso)}
                          className="hover:text-cyan-400 hover:underline transition"
                          title="Abrir detalles del caso"
                        >
                          {caso.casoOp || caso.id}
                        </button>
                      </td>

                      {/* ID LOCAL */}
                      <td className="py-3.5 px-4 font-mono text-gray-300 whitespace-nowrap">
                        {caso.vendorId || caso.id}
                      </td>

                      {/* TIENDA */}
                      <td className="py-3.5 px-4 font-semibold text-white max-w-xs truncate">
                        {caso.tienda || 'Sin nombre'}
                      </td>

                      {/* ESTADO ACTUAL */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-block px-3 py-1 rounded-md text-[11px] font-bold border border-cyan-500/40 bg-cyan-950/40 text-cyan-300">
                          {caso.etapa || caso.estado || 'En seguimiento'}
                        </span>
                      </td>

                      {/* TIEMPO SLA */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {caso.esCritico ? (
                          <span className="inline-block px-3 py-1 rounded-md text-[11px] font-black border border-red-500/80 bg-red-950/60 text-red-400 animate-pulse">
                            ≥ 96h
                          </span>
                        ) : caso.esAtencion ? (
                          <span className="inline-block px-3 py-1 rounded-md text-[11px] font-bold border border-amber-500/80 bg-amber-950/60 text-amber-300">
                            ≥ 4h
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-md text-[11px] font-semibold border border-emerald-500/80 bg-emerald-950/60 text-emerald-300">
                            &lt; 4h
                          </span>
                        )}
                      </td>

                      {/* AGENTE A CARGO */}
                      <td className="py-3.5 px-4 font-medium text-gray-200 whitespace-nowrap">
                        {caso.agenteACargo}
                      </td>

                      {/* ACCIÓN TL (ESCALAR) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => copiarSlack(caso)}
                            className="bg-[#121420] hover:bg-gray-800 text-gray-200 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow"
                            title="Copiar mensaje formateado para canal de Slack"
                          >
                            <span>📋</span> 1. Copiar Slack
                          </button>
                          <button
                            onClick={() => confirmarPush(caso)}
                            className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/80 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
                            title="Confirmar push de catálogo en el caso"
                          >
                            <span>✅</span> 2. Confirmar Push
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB: RENDIMIENTO AGENTES */
        <div className="bg-[#151824] border border-[#232738] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="border-b border-gray-800 pb-4">
            <h2 className="text-lg font-bold text-white tracking-wide">Rendimiento y Cumplimiento de SLA por Agente</h2>
            <p className="text-xs text-gray-400">Distribución de carga de trabajo y casos en riesgo por miembro del equipo.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {estadisticasAgentes.map(ag => (
              <div 
                key={ag.nombre}
                className="bg-[#0f111a] border border-gray-800 rounded-xl p-4 space-y-3 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{ag.nombre}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                    ag.cumplimiento >= 85 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
                  }`}>
                    {ag.cumplimiento}% SLA
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                    <span className="text-gray-400 block text-[10px]">Activos</span>
                    <span className="text-white font-bold text-base">{ag.total}</span>
                  </div>
                  <div className="bg-red-950/30 p-2 rounded-lg border border-red-900/50">
                    <span className="text-red-400 block text-[10px]">Críticos (≥96h)</span>
                    <span className="text-red-400 font-bold text-base">{ag.criticos}</span>
                  </div>
                  <div className="bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/50">
                    <span className="text-emerald-400 block text-[10px]">En Tiempo</span>
                    <span className="text-emerald-400 font-bold text-base">{ag.enTiempo}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setFiltroAgente(ag.nombre);
                    setSubTab('global');
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-cyan-300 text-xs py-1.5 rounded-lg font-semibold transition"
                >
                  Ver casos de {ag.nombre} →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FOOTER USER ROLE */}
      <div className="pt-2 text-xs text-gray-500 flex items-center justify-between">
        <div>
          Iniciaste sesión como: <span className="font-bold text-cyan-400">{rolUsuario || 'Supervisor / TL'}</span>
          {nombreUsuario && <span className="text-gray-400"> ({nombreUsuario})</span>}
        </div>
        <div className="text-[11px] text-gray-600">
          HeroCare TL • PedidosYa Onboarding System
        </div>
      </div>
    </div>
  );
}
