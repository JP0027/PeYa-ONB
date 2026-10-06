import React from 'react';

export type AlertBadgeType = 'todos' | 'enProgreso' | 'sinOportunidad' | 'pushPos' | 'pushCat' | 'sla' | string;

export interface AlertBadgeProps {
  tipo: AlertBadgeType;
  cantidad: number | string;
  activo: boolean;
  onClick: (tipo: string) => void;
}

export default function AlertBadge({ tipo, cantidad, activo, onClick }: AlertBadgeProps) {
  const getBadgeStyle = (): string => {
    switch (tipo) {
      case 'todos':
        return activo 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' 
          : 'bg-[#2C2C32] text-[#B3B3B3] hover:bg-[#3A3A3E] hover:text-white';
      case 'enProgreso':
        return activo
          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/30'
          : 'bg-cyan-950/40 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-900/60 hover:text-white';
      case 'sinOportunidad':
        return activo
          ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
          : 'bg-purple-950/40 text-purple-400 border border-purple-800/50 hover:bg-purple-900/60 hover:text-white';
      case 'pushPos':
        return activo
          ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
          : 'bg-amber-950/40 text-amber-500 border border-amber-900/50 hover:bg-amber-900/60 hover:text-white';
      case 'pushCat':
        return activo
          ? 'bg-[#E85A80] text-white shadow-lg shadow-pink-900/30'
          : 'bg-pink-950/40 text-[#E85A80] border border-pink-900/50 hover:bg-pink-900/60 hover:text-white';
      case 'sla':
        return activo
          ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/30'
          : 'bg-rose-950/40 text-rose-500 border border-rose-900/50 hover:bg-rose-900/60 hover:text-white';
      default:
        return 'bg-[#2C2C32] text-[#B3B3B3]';
    }
  };

  const getLabel = (): string => {
    switch (tipo) {
      case 'todos': return '📁 Todos los Activos';
      case 'enProgreso': return '💼 En Progreso';
      case 'sinOportunidad': return '⚡ Sin Oportunidad';
      case 'pushPos': return '⚠️ Push POS API';
      case 'pushCat': return '📦 Push Catálogo';
      case 'sla': return '🚨 SLA Crítico';
      default: return '';
    }
  };

  return (
    <button
      onClick={() => onClick(tipo)}
      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${getBadgeStyle()}`}
    >
      <span>{getLabel()}</span>
      <span className={`px-2 py-0.5 rounded-full text-[10px] ${activo ? 'bg-white/20' : 'bg-black/30'}`}>
        {cantidad}
      </span>
    </button>
  );
}
