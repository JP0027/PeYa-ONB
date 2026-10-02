import React from 'react';
import { obtenerTextoCasoOp } from '../../utils/onboardingRules';

export interface CasoAlertas {
  requierePushPos?: boolean;
  requierePushCat?: boolean;
  colorClass?: string;
  estaCongelado?: boolean;
  horasTranscurridas?: number | string;
  [key: string]: any;
}

export interface CasoCardProps {
  caso: {
    id?: string;
    casoOp?: string;
    vendorId?: string;
    vendor_id?: string;
    tienda?: string;
    pais?: string;
    kam?: string;
    integracion?: string;
    estado?: string;
    etapa?: string;
    respuestaPos?: string;
    fechaPushPos?: string;
    respuestaCat?: string;
    fechaPushCat?: string;
    propietarioTicket?: string;
    agente?: string;
    [key: string]: any;
  };
  alertas: CasoAlertas;
  onClick: (caso: any) => void;
  onRegistrarPush: (caso: any, tipo: 'pos' | 'cat') => void;
  estaResaltado?: boolean;
}

export default function CasoCard({ caso, alertas, onClick, onRegistrarPush, estaResaltado }: CasoCardProps) {
  if (!caso) return null;

  const idFila = `caso-row-${caso.id || caso.casoOp || caso.vendorId}`;

  return (
    <tr 
      id={idFila}
      onClick={() => onClick(caso)}
      className={`border-b transition cursor-pointer ${
        estaResaltado 
          ? 'bg-amber-500/25 ring-2 ring-amber-400 border-amber-400 shadow-xl shadow-amber-500/30 animate-pulse' 
          : 'border-gray-800 hover:bg-[#1a1d27]'
      }`}
    >
      <td className="p-3 text-xs">
        {(() => {
          const textoOp = obtenerTextoCasoOp(caso);
          return (
            <span className={`font-mono font-semibold ${textoOp === 'Sin caso OP' ? 'text-gray-500 italic' : 'text-pink-400'}`}>
              {textoOp}
            </span>
          );
        })()}
      </td>
      <td className="p-3">
        <div className="text-xs font-semibold text-white">{caso.tienda || 'Sin tienda'}</div>
        <div className="text-[10px] text-gray-500 font-mono mt-0.5">{caso.vendorId || caso.vendor_id}</div>
      </td>
      <td className="p-3">
        <div className="text-[11px] text-gray-300">{caso.pais}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">{caso.kam || '-'}</div>
      </td>
      <td className="p-3 text-[11px] text-cyan-300 font-medium">
        {caso.integracion}
      </td>
      <td className="p-3">
        {(() => {
          const est = String(caso.estado || '').trim().toLowerCase();
          if (est.includes('sin oportunidad')) {
            return (
              <span className="bg-purple-950/70 text-purple-300 border border-purple-700/60 font-semibold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 shadow-sm">
                <span>⚡</span> Sin oportunidad
              </span>
            );
          } else if (est === 'en progreso' || est.includes('progreso')) {
            return (
              <span className="bg-cyan-950/70 text-cyan-300 border border-cyan-700/60 font-semibold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 shadow-sm">
                <span>💼</span> En progreso
              </span>
            );
          } else if (est.includes('satisfactori')) {
            return (
              <span className="bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-medium px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                <span>✅</span> {caso.estado}
              </span>
            );
          } else if (est.includes('fallid')) {
            return (
              <span className="bg-rose-950/70 text-rose-300 border border-rose-700/60 font-medium px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                <span>❌</span> {caso.estado}
              </span>
            );
          }
          return <div className="text-[11px] font-semibold text-white truncate max-w-[150px]" title={caso.estado}>{caso.estado}</div>;
        })()}
        <div className="text-[10px] text-gray-500 truncate max-w-[150px] mt-1" title={caso.etapa}>{caso.etapa}</div>
      </td>
      <td className="p-3">
        {alertas.requierePushPos ? (
          <button 
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRegistrarPush(caso, 'pos'); }}
            className="text-[10px] bg-amber-600 hover:bg-amber-500 text-white font-bold px-2.5 py-1 rounded shadow-md transition flex items-center gap-1 cursor-pointer"
            title="Registrar push de seguimiento POS API con 1 solo clic"
          >
            <span>🔔</span> Push POS
          </button>
        ) : (
          <div className="text-[10px]">
            {(caso.respuestaPos === 'Si' || caso.respuestaPos === 'Sí') ? (
              <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded font-mono inline-flex items-center gap-1" title="Respuesta en roadmap POS API: Si">
                <span>✨</span> Resp: Si
              </span>
            ) : caso.fechaPushPos && caso.fechaPushPos !== '-' && caso.fechaPushPos !== '' ? (
              <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded font-mono inline-flex items-center gap-1" title={`Push POS registrado: ${caso.fechaPushPos}`}>
                <span>✅</span> {caso.fechaPushPos}
              </span>
            ) : caso.respuestaPos ? (
              <span className="text-gray-400 font-mono">{caso.respuestaPos}</span>
            ) : (
              <span className="text-gray-600">-</span>
            )}
          </div>
        )}
      </td>
      <td className="p-3">
        {alertas.requierePushCat ? (
          <button 
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRegistrarPush(caso, 'cat'); }}
            className="text-[10px] bg-pink-600 hover:bg-pink-500 text-white font-bold px-2.5 py-1 rounded shadow-md transition flex items-center gap-1 cursor-pointer"
            title="Registrar push de catálogo con 1 solo clic"
          >
            <span>📦</span> Push Cat
          </button>
        ) : (
          <div className="text-[10px]">
            {(caso.respuestaCat === 'Si' || caso.respuestaCat === 'Sí') ? (
              <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded font-mono inline-flex items-center gap-1" title="Respuesta en roadmap Catálogo: Si">
                <span>✨</span> Resp: Si
              </span>
            ) : caso.fechaPushCat && caso.fechaPushCat !== '-' && caso.fechaPushCat !== '' ? (
              <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded font-mono inline-flex items-center gap-1" title={`Push Catálogo registrado: ${caso.fechaPushCat}`}>
                <span>✅</span> {caso.fechaPushCat}
              </span>
            ) : caso.respuestaCat ? (
              <span className="text-gray-400 font-mono">{caso.respuestaCat}</span>
            ) : (
              <span className="text-gray-600">-</span>
            )}
          </div>
        )}
      </td>
      <td className="p-3">
        <span className={`text-[11px] px-2 py-1 rounded-full font-semibold inline-flex items-center gap-1 ${alertas.colorClass}`}>
          {alertas.estaCongelado && <span>❄️</span>}
          {alertas.horasTranscurridas}h
        </span>
      </td>
      <td className="p-3 text-[10px] text-gray-400">
        {caso.propietarioTicket || caso.agente}
      </td>
      <td className="p-3">
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick(caso);
          }}
          className="text-[10px] bg-pink-950/40 hover:bg-pink-900/60 text-pink-300 hover:text-white px-2.5 py-1 rounded border border-pink-700/60 transition cursor-pointer font-medium"
        >
          Gestionar
        </button>
      </td>
    </tr>
  );
}
