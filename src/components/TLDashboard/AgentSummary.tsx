import React from 'react';

export interface AgentSummaryProps {
  agente: string;
  casos: any[];
  onClick: (agente: string) => void;
}

export default function AgentSummary({ agente, casos, onClick }: AgentSummaryProps) {
  const activos = casos.length;
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
      className="bg-[#1A1A1C] border border-[#3A3A3E] rounded-xl p-4 cursor-pointer hover:border-[#E85A80]/50 transition shadow-lg relative overflow-hidden group"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-900/40 border border-cyan-700/50 flex items-center justify-center text-cyan-400 font-bold text-lg shadow-inner">
            {agente.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm group-hover:text-[#F46C8E] transition">{agente}</h3>
            <p className="text-xs text-[#B3B3B3]">{activos} casos activos</p>
          </div>
        </div>
        {kamPushes > 0 && (
          <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-700 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 shadow-sm whitespace-nowrap" title={`${kamPushes} casos requieren Push KAM`}>
            <span>⚠️</span> {kamPushes} Push
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-1.5 flex flex-col items-center" title="Casos dentro de SLA (< 24h)">
          <span className="text-emerald-500 font-bold text-sm">{enTiempo}</span>
          <span className="text-[#9CA3AF] uppercase tracking-wider">OK</span>
        </div>
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-1.5 flex flex-col items-center" title="Casos con tiempo acumulado entre 24h y 96h">
          <span className="text-amber-500 font-bold text-sm">{atencion}</span>
          <span className="text-[#9CA3AF] uppercase tracking-wider">24-96h</span>
        </div>
        <div className="bg-rose-950/30 border border-rose-900/50 rounded-lg p-1.5 flex flex-col items-center" title="Casos fuera de SLA (≥ 96h)">
          <span className="text-rose-500 font-bold text-sm">{criticos}</span>
          <span className="text-[#9CA3AF] uppercase tracking-wider">Crit.</span>
        </div>
      </div>
    </div>
  );
}
