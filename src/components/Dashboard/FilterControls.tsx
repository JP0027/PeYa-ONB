import React from 'react';

export interface AgenteItem {
  nombre: string;
  [key: string]: any;
}

export interface FilterControlsProps {
  agenteFiltro: string;
  onCambiarAgente: (agente: string) => void;
  agentes: AgenteItem[];
  supervisores: AgenteItem[];
  nombreUsuario?: string;
}

export default function FilterControls({
  agenteFiltro,
  onCambiarAgente,
  agentes,
  supervisores,
  nombreUsuario
}: FilterControlsProps) {
  return (
    <div className="bg-[#202024] border border-[#3A3A3E] rounded-xl p-3 flex items-center gap-3">
      <label className="text-xs font-bold text-[#B3B3B3] whitespace-nowrap">👤 Vista de Agente:</label>
      <select
        value={agenteFiltro}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onCambiarAgente(e.target.value)}
        className="bg-[#121212] border border-[#3A3A3E] rounded-lg p-2 text-xs text-white focus:border-[#E85A80] min-w-[200px]"
      >
        <option value="auto">Automático ({nombreUsuario || 'Mi Cuenta'})</option>
        <option value="todos">Todos los casos (Equipo)</option>
        
        <optgroup label="Supervisores">
          {supervisores.map(s => (
            <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
          ))}
        </optgroup>
        
        <optgroup label="Agentes Operativos">
          {agentes.map(a => (
            <option key={a.nombre} value={a.nombre}>{a.nombre}</option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
