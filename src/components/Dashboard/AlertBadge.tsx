import React from 'react';

export type AlertBadgeType = 'todos' | 'enProgreso' | 'sinOportunidad' | 'pushPos' | 'pushCat' | 'sla' | 'hcAbiertos' | string;

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
          ? 'bg-sky-200 border-2 border-sky-400 text-sky-950 font-black shadow-sm ring-2 ring-sky-300 scale-102 dark:bg-blue-600 dark:text-white dark:border-blue-500 dark:ring-blue-400' 
          : 'bg-sky-50/80 hover:bg-sky-100 text-sky-900 border border-sky-200/90 font-bold dark:bg-blue-950/80 dark:text-blue-100 dark:border-blue-700/50';
      case 'enProgreso':
        return activo
          ? 'bg-cyan-200 border-2 border-cyan-400 text-cyan-950 font-black shadow-sm ring-2 ring-cyan-300 scale-102 dark:bg-cyan-600 dark:text-white dark:border-cyan-500 dark:ring-cyan-400'
          : 'bg-cyan-50/80 hover:bg-cyan-100 text-cyan-900 border border-cyan-200/90 font-bold dark:bg-cyan-950/80 dark:text-cyan-100 dark:border-cyan-700/50';
      case 'sinOportunidad':
        return activo
          ? 'bg-purple-200 border-2 border-purple-400 text-purple-950 font-black shadow-sm ring-2 ring-purple-300 scale-102 dark:bg-purple-600 dark:text-white dark:border-purple-500 dark:ring-purple-400'
          : 'bg-purple-50/80 hover:bg-purple-100 text-purple-900 border border-purple-200/90 font-bold dark:bg-purple-950/80 dark:text-purple-100 dark:border-purple-700/50';
      case 'pushPos':
        return activo
          ? 'bg-amber-200 border-2 border-amber-400 text-amber-950 font-black shadow-sm ring-2 ring-amber-300 scale-102 dark:bg-amber-600 dark:text-white dark:border-amber-500 dark:ring-amber-400'
          : 'bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200/90 font-bold dark:bg-amber-950/80 dark:text-amber-100 dark:border-amber-700/50';
      case 'pushCat':
        return activo
          ? 'bg-pink-200 border-2 border-pink-400 text-pink-950 font-black shadow-sm ring-2 ring-pink-300 scale-102 dark:bg-[#E85A80] dark:text-white dark:border-pink-500 dark:ring-pink-400'
          : 'bg-pink-50/80 hover:bg-pink-100 text-pink-900 border border-pink-200/90 font-bold dark:bg-pink-950/80 dark:text-pink-100 dark:border-pink-700/50';
      case 'sla':
        return activo
          ? 'bg-rose-200 border-2 border-rose-400 text-rose-950 font-black shadow-sm ring-2 ring-rose-300 scale-102 dark:bg-rose-600 dark:text-white dark:border-rose-500 dark:ring-rose-400'
          : 'bg-rose-50/80 hover:bg-rose-100 text-rose-900 border border-rose-200/90 font-bold dark:bg-rose-950/80 dark:text-rose-100 dark:border-rose-700/50';
      case 'hcAbiertos':
        return activo
          ? 'bg-emerald-200 border-2 border-emerald-400 text-emerald-950 font-black shadow-sm ring-2 ring-emerald-300 scale-102 dark:bg-emerald-600 dark:text-white dark:border-emerald-500 dark:ring-emerald-400'
          : 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/90 font-bold dark:bg-emerald-950/80 dark:text-emerald-100 dark:border-emerald-700/50';
      default:
        return 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold dark:bg-slate-800 dark:text-white dark:border-slate-700';
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
      case 'hcAbiertos': return '🎫 Casos HC Abiertos';
      default: return '';
    }
  };

  return (
    <button
      type="button"
      onClick={() => onClick(tipo)}
      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer select-none ${getBadgeStyle()}`}
    >
      <span>{getLabel()}</span>
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
        activo 
          ? 'bg-sky-100 text-sky-950 border border-sky-300/80 shadow-xs dark:bg-black/40 dark:text-white dark:border-transparent' 
          : 'bg-white text-slate-800 border border-slate-200/80 dark:bg-white/20 dark:text-white dark:border-transparent'
      }`}>
        {cantidad}
      </span>
    </button>
  );
}
