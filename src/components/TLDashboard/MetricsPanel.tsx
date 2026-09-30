import React, { useMemo } from 'react';

export interface MetricsPanelProps {
  casos: any[];
  mesActual?: string;
}

export default function MetricsPanel({ casos, mesActual }: MetricsPanelProps) {
  const estadisticas = useMemo(() => {
    let total = casos.length;
    let enProgresoNormal = 0;
    let sinOportunidad = 0;
    let porAgente: Record<string, number> = {};
    let porEtapa: Record<string, number> = {};
    let sumSla = 0;
    let countSla = 0;
    let fueraDeSla = 0;
    let proximosVencer = 0;
    let totalActivos = 0;

    casos.forEach(c => {
      const estado = String(c.estado || '').toLowerCase().trim();
      const esActivo = !estado.match(/cerrad|fallid|cancel/) && (estado.includes('progreso') || c.esActivo);

      if (!esActivo) return;

      totalActivos++;
      const esSinOp = estado.includes('sin oportunidad') || !c.casoOp || String(c.casoOp).trim() === '';

      if (esSinOp) {
        sinOportunidad++;
      } else {
        enProgresoNormal++;

        // Agente activo para casos con OP
        const agente = c.agenteACargo || c.agente || c.propietarioTicket || c.propietarioOportunidad || 'Sin Asignar';
        porAgente[agente] = (porAgente[agente] || 0) + 1;

        // SLA de casos activos con OP
        const horas = typeof c.horasSLA === 'number' ? c.horasSLA : 0;
        if (horas > 0) {
          sumSla += horas;
          countSla++;
        }

        if (c.esCritico || horas >= 96) {
          fueraDeSla++;
        } else if (c.esProximoVencer || (horas >= 72 && horas < 96)) {
          proximosVencer++;
        }
      }

      // Etapa activa
      const etapa = c.etapa || 'Validación del Onboarding';
      porEtapa[etapa] = (porEtapa[etapa] || 0) + 1;
    });

    const avgSla = countSla > 0 ? Math.round(sumSla / countSla) : 0;

    return { 
      total, 
      totalActivos, 
      enProgresoNormal, 
      sinOportunidad, 
      avgSla, 
      fueraDeSla, 
      proximosVencer, 
      porAgente, 
      porEtapa 
    };
  }, [casos]);

  const agentesList = Object.entries(estadisticas.porAgente).sort((a, b) => b[1] - a[1]);
  const etapasList = Object.entries(estadisticas.porEtapa).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-[#151824] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-6">
      <div className="flex justify-between items-center border-b border-gray-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide">Indicadores Activos {mesActual ? `(${mesActual})` : ''}</h2>
          <p className="text-[11px] text-gray-400">Casos en progreso con oportunidad</p>
        </div>
        <div className="text-xs bg-cyan-950/40 text-cyan-400 border border-cyan-800/50 px-2 py-1 rounded font-semibold">
          {estadisticas.totalActivos} Activos
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* En Progreso con OP */}
        <div className="bg-[#0f111a] rounded-xl p-3.5 border border-cyan-900/60 flex flex-col items-center justify-center relative overflow-hidden shadow">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
          <span className="text-[11px] text-gray-400 mb-1 flex items-center gap-1 font-semibold"><span>💼</span> En Progreso con OP</span>
          <div className="flex items-end gap-1">
            <span className="text-3xl font-black text-cyan-400">{estadisticas.enProgresoNormal}</span>
          </div>
          <span className="text-[10px] text-gray-500 mt-1">Casos en curso</span>
        </div>

        {/* SLA Promedio */}
        <div className="bg-[#0f111a] rounded-xl p-3.5 border border-amber-900/60 flex flex-col items-center justify-center relative overflow-hidden shadow">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500" />
          <span className="text-[11px] text-gray-400 mb-1 flex items-center gap-1 font-semibold"><span>⏱️</span> SLA Promedio (OP)</span>
          <div className="flex items-end gap-1">
            <span className="text-3xl font-black text-white">{estadisticas.avgSla}</span>
            <span className="text-amber-400 text-xs font-bold mb-1">hrs</span>
          </div>
          <span className="text-[10px] text-gray-500 mt-1">Tiempo de atención L-V</span>
        </div>
      </div>

      {/* Estado y Alertas de Casos con OP */}
      <div className="bg-[#0f111a] rounded-xl p-3.5 border border-gray-800 space-y-2">
        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">Alertas de SLA (Casos con OP)</span>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-rose-950/40 border border-rose-800/60 p-2 rounded-lg">
            <div className="text-[10px] text-rose-300 font-semibold">🚨 Fuera SLA</div>
            <div className="text-rose-400 font-black text-base mt-0.5">{estadisticas.fueraDeSla}</div>
            <div className="text-[9px] text-rose-500/80">≥96 hrs</div>
          </div>
          <div className="bg-amber-950/40 border border-amber-800/60 p-2 rounded-lg">
            <div className="text-[10px] text-amber-300 font-semibold">⚠️ Próximos</div>
            <div className="text-amber-400 font-black text-base mt-0.5">{estadisticas.proximosVencer}</div>
            <div className="text-[9px] text-amber-500/80">72-96 hrs</div>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/60 p-2 rounded-lg">
            <div className="text-[10px] text-purple-300 font-semibold">⚡ Sin OP</div>
            <div className="text-purple-400 font-black text-base mt-0.5">{estadisticas.sinOportunidad}</div>
            <div className="text-[9px] text-purple-500/80">Adm/Test</div>
          </div>
        </div>
      </div>

      {/* Breakdown Agentes con OP */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Casos con OP por Agente</h3>
          <span className="text-[10px] text-gray-500">{estadisticas.enProgresoNormal} asignados</span>
        </div>
        <div className="space-y-2.5">
          {agentesList.map(([ag, count]) => (
            <div key={ag} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-28 truncate font-medium" title={ag}>{ag}</span>
              <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-pink-500 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, (count / (estadisticas.enProgresoNormal || 1)) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-white font-bold w-6 text-right font-mono">{count}</span>
            </div>
          ))}
          {agentesList.length === 0 && (
            <div className="text-xs text-gray-500 text-center py-2">Sin casos asignados</div>
          )}
        </div>
      </div>

      {/* Breakdown Etapas de Casos Activos */}
      <div>
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Etapas de Casos en Progreso</h3>
        <div className="space-y-2">
          {etapasList.slice(0, 6).map(([et, count]) => (
            <div key={et} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex-1 truncate" title={et}>{et}</span>
              <div className="w-16 bg-gray-800 rounded-full h-2.5 overflow-hidden flex-shrink-0">
                <div 
                  className="bg-cyan-500 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, (count / (estadisticas.totalActivos || 1)) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-white font-bold w-6 text-right flex-shrink-0 font-mono">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
