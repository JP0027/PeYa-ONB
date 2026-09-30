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

  casos.forEach(c => {
    // Estimación básica usando horasSLA, o si esCritico está disponible (similar a HeroCareTLView)
    const horasSLA = c.horasSLA || 0;
    if (horasSLA >= 96) criticos++;
    else if (horasSLA >= 24) atencion++;
    else enTiempo++;
  });

  return (
    <div 
      onClick={() => onClick(agente)}
      className="bg-[#151824] border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-pink-500/50 transition shadow-lg relative overflow-hidden group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-cyan-900/40 border border-cyan-700/50 flex items-center justify-center text-cyan-400 font-bold text-lg shadow-inner">
          {agente.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="font-bold text-white text-sm group-hover:text-pink-400 transition">{agente}</h3>
          <p className="text-xs text-gray-400">{activos} casos activos</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-1.5 flex flex-col items-center">
          <span className="text-emerald-500 font-bold text-sm">{enTiempo}</span>
          <span className="text-gray-500 uppercase tracking-wider">OK</span>
        </div>
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-1.5 flex flex-col items-center">
          <span className="text-amber-500 font-bold text-sm">{atencion}</span>
          <span className="text-gray-500 uppercase tracking-wider">Push</span>
        </div>
        <div className="bg-rose-950/30 border border-rose-900/50 rounded-lg p-1.5 flex flex-col items-center">
          <span className="text-rose-500 font-bold text-sm">{criticos}</span>
          <span className="text-gray-500 uppercase tracking-wider">Crit.</span>
        </div>
      </div>
    </div>
  );
}
