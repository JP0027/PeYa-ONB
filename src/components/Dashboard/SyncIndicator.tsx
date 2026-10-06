import React from 'react';

export interface SyncIndicatorProps {
  isConnected?: boolean;
  ultimaSync?: string | Date | number | null;
  sincronizando?: boolean;
  totalCasos?: number;
  onForzarSync?: () => void;
}

export default function SyncIndicator({
  isConnected = true,
  ultimaSync,
  sincronizando = false,
  totalCasos = 0,
  onForzarSync
}: SyncIndicatorProps) {
  const formatearHora = (fecha?: string | Date | number | null): string => {
    if (!fecha) return 'Nunca';
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? 'Nunca' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-[#202024] border border-[#3A3A3E] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-[#B3B3B3]">Sincronización Sheets</h4>
        <div className="flex items-center gap-1.5">
          <div className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400">
            Conectado
          </span>
        </div>
      </div>
      
      <div className="flex justify-between items-end">
        <div>
          <div className="text-[10px] text-[#9CA3AF] mb-0.5">Última actualización</div>
          <div className="text-xs text-white font-mono">{formatearHora(ultimaSync)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#9CA3AF] mb-0.5 text-right">Casos en Google Sheets</div>
          <div className="text-xs text-[#F46C8E] font-bold text-right font-mono">
            {totalCasos} <span className="text-[10px] text-[#B3B3B3] font-normal font-sans">(Fila {totalCasos ? totalCasos + 2 : '-'})</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <button
          onClick={onForzarSync}
          disabled={sincronizando}
          className="w-full bg-[#2C2C32]/80 hover:bg-[#3A3A3E] text-gray-200 text-[11px] font-medium py-1.5 rounded-lg transition border border-[#3A3A3E]/80 flex justify-center items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          title="Actualizar datos con Google Sheets"
        >
          {sincronizando ? (
            <>
              <span className="animate-spin text-[#E85A80]">↻</span>
              Sincronizando Sheets...
            </>
          ) : (
            <>
              <span>🔄</span> Actualizar ahora
            </>
          )}
        </button>
      </div>
    </div>
  );
}
