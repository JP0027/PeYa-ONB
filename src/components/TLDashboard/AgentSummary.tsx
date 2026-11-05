import React from 'react';
import { contarTicketsSeguimientoUnicos, esCasoHcAbierto, esCasoEnProgreso } from '../../utils/onboardingRules';

export interface AgentSummaryProps {
  agente: string;
  casos: any[];
  onClick: (agente: string, kpi?: string) => void;
  seleccionado?: boolean;
  kpiActivo?: string;
}

export default function AgentSummary({ 
  agente, 
  casos, 
  onClick, 
  seleccionado = false,
  kpiActivo = 'todos'
}: AgentSummaryProps) {
  const activos = casos.length;
  
  // Casos de seguimiento abiertos y tickets únicos (deduplicados por N° Caso Seguimiento)
  const casosSegAbiertos = casos.filter(c => esCasoHcAbierto(c));
  const segAbiertosUnicos = contarTicketsSeguimientoUnicos(casosSegAbiertos);

  // Casos de onboarding con estado En progreso
  const onbEnProgreso = casos.filter(c => esCasoEnProgreso(c)).length;

  let criticos = 0; // >= 96h
  let atencion = 0; // >= 24h y < 96h
  let enTiempo = 0; // < 24h
  let kamPushes = 0;

  casos.forEach(c => {
    const horasSLA = c.horasSLA || 0;
    if (horasSLA >= 96) criticos++;
    else if (horasSLA >= 24) atencion++;
    else enTiempo++;

    if (c.requiereKamPush) {
      kamPushes++;
    }
  });

  return (
    <div 
      onClick={() => onClick(agente)}
      className={`bg-[#1A1A1C] border rounded-xl p-4 cursor-pointer transition shadow-lg relative overflow-hidden group select-none ${
        seleccionado 
          ? 'border-[#E85A80] ring-2 ring-[#E85A80]/60 shadow-[#E85A80]/20' 
          : 'border-[#3A3A3E] hover:border-[#E85A80]/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-full bg-cyan-900/40 border border-cyan-700/50 flex items-center justify-center text-cyan-400 font-bold text-lg shadow-inner">
            {agente.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm group-hover:text-[#F46C8E] transition truncate">{agente}</h3>
            <p className="text-[11px] text-[#B3B3B3]">{activos} casos activos</p>
          </div>
        </div>
        {kamPushes > 0 && (
          <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-700 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0" title={`${kamPushes} casos requieren Push KAM`}>
            <span>⚠️</span> {kamPushes} Push
          </span>
        )}
      </div>

      {/* Métricas lado a lado: Seg. Abiertos (tickets únicos sin repetir) y Casos ONB en Progreso */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onClick(agente, 'hc_abiertos');
          }}
          className={`p-2 rounded-lg border-2 text-center transition cursor-pointer flex flex-col justify-center bg-transparent ${
            seleccionado && kpiActivo === 'hc_abiertos'
              ? 'border-emerald-500 ring-2 ring-emerald-400 bg-emerald-950/20'
              : 'border-emerald-500/80 hover:border-emerald-400'
          }`}
          title={`Clic para filtrar por tickets de seguimiento de ${agente} (${segAbiertosUnicos} tickets únicos en ${casosSegAbiertos.length} casos OP)`}
        >
          <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-center gap-1">
            <span>🎫</span> Seg. Abiertos
          </div>
          <div className="text-xl font-black text-emerald-400 leading-tight mt-0.5">
            {segAbiertosUnicos}
          </div>
        </div>

        <div 
          onClick={(e) => {
            e.stopPropagation();
            onClick(agente, 'en_progreso');
          }}
          className={`p-2 rounded-lg border-2 text-center transition cursor-pointer flex flex-col justify-center bg-transparent ${
            seleccionado && kpiActivo === 'en_progreso'
              ? 'border-cyan-500 ring-2 ring-cyan-400 bg-cyan-950/20'
              : 'border-cyan-500/80 hover:border-cyan-400'
          }`}
          title={`Clic para filtrar por casos ONB en progreso de ${agente} (${onbEnProgreso} casos)`}
        >
          <div className="text-[11px] font-bold text-cyan-400 flex items-center justify-center gap-1">
            <span>💼</span> ONB Progreso
          </div>
          <div className="text-xl font-black text-cyan-400 leading-tight mt-0.5">
            {onbEnProgreso}
          </div>
        </div>
      </div>

      {/* Desglose SLA */}
      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        <div className="bg-transparent border-2 border-emerald-500 rounded-lg p-1.5 flex flex-col items-center" title="Casos dentro de SLA (< 24h)">
          <span className="text-emerald-500 font-bold text-sm">{enTiempo}</span>
          <span className="text-[#9CA3AF] uppercase tracking-wider font-semibold">OK</span>
        </div>
        <div className="bg-transparent border-2 border-amber-500 rounded-lg p-1.5 flex flex-col items-center" title="Casos con tiempo acumulado entre 24h y 96h">
          <span className="text-amber-500 font-bold text-sm">{atencion}</span>
          <span className="text-[#9CA3AF] uppercase tracking-wider font-semibold">24-96h</span>
        </div>
        <div className="bg-transparent border-2 border-rose-500 rounded-lg p-1.5 flex flex-col items-center" title="Casos fuera de SLA (≥ 96h)">
          <span className="text-rose-500 font-bold text-sm">{criticos}</span>
          <span className="text-[#9CA3AF] uppercase tracking-wider font-semibold">CRIT.</span>
        </div>
      </div>
    </div>
  );
}
