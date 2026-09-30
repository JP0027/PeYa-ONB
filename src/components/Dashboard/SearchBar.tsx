import React, { useState, useMemo } from 'react';

export interface SearchBarProps {
  onBuscar: (query: string) => void;
  cargando: boolean;
  resultados?: any[];
  onSeleccionarCaso: (caso: any) => void;
  onReplicarTienda: (caso: any) => void;
  onLimpiar?: () => void;
}

export default function SearchBar({ 
  onBuscar, 
  cargando, 
  resultados = [], 
  onSeleccionarCaso, 
  onReplicarTienda,
  onLimpiar 
}: SearchBarProps) {
  const [busquedaId, setBusquedaId] = useState<string>("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onBuscar(busquedaId);
    }
  };

  const handleLimpiar = () => {
    setBusquedaId("");
    if (onLimpiar) {
      onLimpiar();
    }
  };

  // Ordenar resultados para que el más reciente aparezca siempre primero arriba
  const resultadosOrdenados = useMemo(() => {
    if (!resultados || resultados.length === 0) return [];

    const parseFecha = (str: any): number => {
      if (!str) return 0;
      const s = String(str).trim();
      if (s.includes('/')) {
        const parts = s.split(' ')[0].split('/');
        if (parts.length === 3) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const y = parseInt(parts[2], 10);
          return new Date(y, m, d).getTime();
        }
      }
      const t = new Date(s).getTime();
      return isNaN(t) ? 0 : t;
    };

    return [...resultados].sort((a, b) => {
      // 1. Por fecha (sla_inicio o fechaCreacion)
      const fechaA = parseFecha(a.sla_inicio || a.fechaCreacion);
      const fechaB = parseFecha(b.sla_inicio || b.fechaCreacion);
      if (fechaA !== fechaB && fechaA > 0 && fechaB > 0) {
        return fechaB - fechaA;
      }

      // 2. Por número de fila en Sheets (filaNumero más alta = caso más reciente)
      const filaA = Number(a.filaNumero) || 0;
      const filaB = Number(b.filaNumero) || 0;
      if (filaA !== filaB && filaA > 0 && filaB > 0) {
        return filaB - filaA;
      }

      // 3. Por número de Caso OP numérico
      const opA = parseInt(String(a.casoOp || a.id || '').replace(/\D/g, ''), 10) || 0;
      const opB = parseInt(String(b.casoOp || b.id || '').replace(/\D/g, ''), 10) || 0;
      if (opA !== opB && opA > 0 && opB > 0) {
        return opB - opA;
      }

      return 0;
    });
  }, [resultados]);

  return (
    <div className="w-full space-y-4">
      {/* Barra de Búsqueda y Botones Buscar / Limpiar */}
      <div className="bg-[#151824] border border-gray-800 rounded-2xl p-5 shadow-xl">
        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">
          Buscar Antecedentes de Casos
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-500 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={busquedaId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusquedaId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por N° Caso OP, Vendor ID o Nombre de Tienda..."
              className="w-full bg-[#0f111a] border border-gray-700 focus:border-pink-500 rounded-xl pl-10 pr-9 py-2.5 text-white font-mono text-sm placeholder-gray-500 focus:outline-none transition shadow-inner"
            />
            {busquedaId && (
              <button
                onClick={() => setBusquedaId('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white text-xs cursor-pointer"
                title="Borrar texto"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onBuscar(busquedaId)}
              disabled={cargando}
              className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-pink-950/50 cursor-pointer whitespace-nowrap"
            >
              {cargando ? (
                <>
                  <span className="animate-spin inline-block text-xs">🔄</span>
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <span>🔍 Buscar</span>
                </>
              )}
            </button>
            <button
              onClick={handleLimpiar}
              disabled={cargando}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 border border-gray-700 shadow-sm cursor-pointer whitespace-nowrap"
              title="Limpiar búsqueda y resultados"
            >
              <span>🧹 Limpiar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Listado de Resultados en Cards Largos (Uno debajo de otro) */}
      {resultadosOrdenados && resultadosOrdenados.length > 0 && (
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <span>Resultados encontrados:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-pink-950 text-pink-400 border border-pink-800/80 font-mono text-xs font-bold">
                {resultadosOrdenados.length}
              </span>
              <span className="text-[11px] text-gray-500 font-normal lowercase hidden sm:inline">
                (ordenados del más reciente al más antiguo)
              </span>
            </h4>
          </div>

          <div className="space-y-3 w-full">
            {resultadosOrdenados.map((r: any, i: number) => {
              const estLower = String(r.estado || '').toLowerCase();
              const esCerrado = estLower.includes('cerrad') || estLower.includes('fallid') || estLower.includes('cancel');

              return (
                <div 
                  key={r.id || r.casoOp || i} 
                  className="bg-[#151824] hover:bg-[#1a1e2d] border border-gray-800 hover:border-pink-500/50 rounded-2xl p-4.5 transition shadow-lg cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group w-full"
                  onClick={() => onSeleccionarCaso(r)}
                >
                  {/* Contenido principal del Card Largo */}
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* PRIMER DATO: CASO OP PROMINENTE */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-950/80 border border-cyan-600/80 text-cyan-300 font-mono font-black text-sm shadow-sm">
                        <span className="text-cyan-400 text-xs font-semibold">Caso OP:</span>
                        <span>{r.casoOp || r.id || 'S/OP'}</span>
                      </div>

                      {/* Vendor ID */}
                      <span className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-pink-400 font-mono font-bold text-xs">
                        Vendor: {r.vendorId || r.vendor_id || '-'}
                      </span>

                      {/* País */}
                      {r.pais && (
                        <span className="px-2 py-0.5 rounded-md bg-gray-800/80 text-gray-300 text-[11px] font-medium border border-gray-700/60">
                          📍 {r.pais}
                        </span>
                      )}

                      {/* Estado */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        !esCerrado
                          ? estLower.includes('sin oportunidad')
                            ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                          : estLower.includes('satisfactorio')
                            ? 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-800'
                            : 'bg-gray-800 text-gray-300 border border-gray-700'
                      }`}>
                        {r.estado || 'En progreso'}
                      </span>

                      {/* Fecha / SLA Inicio si existe */}
                      {(r.sla_inicio || r.fechaCreacion) && (
                        <span className="text-[11px] text-gray-500 font-mono md:ml-auto">
                          🕒 {r.sla_inicio || r.fechaCreacion}
                        </span>
                      )}
                    </div>

                    {/* Nombre de Tienda */}
                    <div>
                      <h5 className="text-base font-bold text-white group-hover:text-pink-300 transition truncate" title={r.tienda}>
                        {r.tienda || 'Sin nombre de tienda'}
                      </h5>
                    </div>

                    {/* Metadatos secundarios en una sola línea horizontal */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 pt-1">
                      {r.integracion && (
                        <div>
                          <span className="text-gray-500">Integración: </span>
                          <span className="text-cyan-400 font-semibold">{r.integracion}</span>
                        </div>
                      )}
                      {r.etapa && (
                        <div className="truncate max-w-[260px]" title={r.etapa}>
                          <span className="text-gray-500">Etapa: </span>
                          <span className="text-gray-300">{r.etapa}</span>
                        </div>
                      )}
                      {r.oportunidad && (
                        <div>
                          <span className="text-gray-500">Oportunidad: </span>
                          <span className="text-gray-300">{r.oportunidad}</span>
                        </div>
                      )}
                      {r.kam && (
                        <div className="truncate max-w-[200px]" title={r.kam}>
                          <span className="text-gray-500">KAM: </span>
                          <span className="text-gray-300">{r.kam}</span>
                        </div>
                      )}
                      {(r.propietarioTicket || r.agente) && (
                        <div>
                          <span className="text-gray-500">Agente: </span>
                          <span className="text-gray-300">{r.propietarioTicket || r.agente}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones a la derecha */}
                  <div className="flex sm:flex-col items-stretch sm:items-end justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-800">
                    <button
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onReplicarTienda(r);
                      }}
                      className="text-xs bg-pink-600 hover:bg-pink-500 text-white font-bold px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-pink-950/40 cursor-pointer whitespace-nowrap"
                      title="Copiar datos de esta tienda para registrar un nuevo caso"
                    >
                      <span>➕</span>
                      <span>Replicar Tienda</span>
                    </button>
                    <button
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onSeleccionarCaso(r);
                      }}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-xl transition flex items-center justify-center gap-1 border border-gray-700 cursor-pointer whitespace-nowrap"
                      title="Ver todos los detalles del caso"
                    >
                      <span>👁️</span>
                      <span>Ver Caso</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
