import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';

export interface TablaOnboardingCasosProps {
  casos?: any[];
  onEditarCaso?: (caso: any) => void;
  onEliminarCaso?: (caso: any) => Promise<void> | void;
  mostrarNotificacion?: (texto: string, tipo?: string) => void;
  cargando?: boolean;
}

/**
 * Tabla reducida de casos totales para la opción "Onboarding" dentro de la pestaña "Datos"
 * Diseño ancho idéntico a "Mis casos", con filtros por estado tipo píldoras/badges,
 * buscador en vivo, ampliación/edición y eliminación sincronizada en Sheets y Firebase.
 */
export default function TablaOnboardingCasos({
  casos = [],
  onEditarCaso,
  onEliminarCaso,
  mostrarNotificacion,
  cargando = false
}: TablaOnboardingCasosProps) {
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroPais, setFiltroPais] = useState<string>('todos');
  const [ordenTienda, setOrdenTienda] = useState<'none' | 'asc' | 'desc'>('none');
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [casosPorPagina, setCasosPorPagina] = useState<number>(50);

  // Estado para el modal de confirmación de eliminación
  const [casoAEliminar, setCasoAEliminar] = useState<any | null>(null);
  const [eliminando, setEliminando] = useState<boolean>(false);

  // Conteo de casos por cada categoría de estado para las píldoras superiores
  const conteos = useMemo(() => {
    let todos = casos.length;
    let activos = 0;
    let enProgreso = 0;
    let sinOportunidad = 0;
    let onbSat = 0;
    let onbFall = 0;
    let kamSat = 0;
    let kamFall = 0;
    let apiVendor = 0;

    casos.forEach(c => {
      const e = String(c.estado || '').toLowerCase().trim();
      const esCerrado = e.includes('cerrad') || e.includes('fallid') || e.includes('cancel');

      if (!esCerrado) {
        activos++;
        if (e.includes('sin oportunidad')) {
          sinOportunidad++;
        } else {
          enProgreso++;
        }
      } else {
        if (e.includes('onb') && e.includes('satisfactorio')) {
          onbSat++;
        } else if (e.includes('onb') && (e.includes('fallido') || e.includes('cancel'))) {
          onbFall++;
        } else if (e.includes('kam') && e.includes('satisfactorio')) {
          kamSat++;
        } else if (e.includes('kam') && (e.includes('fallido') || e.includes('cancel'))) {
          kamFall++;
        } else if (e.includes('api vendor') || e.includes('vendor')) {
          apiVendor++;
        }
      }
    });

    return {
      todos,
      activos,
      enProgreso,
      sinOportunidad,
      onbSat,
      onbFall,
      kamSat,
      kamFall,
      apiVendor
    };
  }, [casos]);

  // Lista única de países para el selector de filtro
  const listaPaises = useMemo(() => {
    const setP = new Set<string>();
    casos.forEach(c => {
      if (c.pais && c.pais !== '-' && c.pais !== 'S/V') {
        setP.add(c.pais.trim());
      }
    });
    return Array.from(setP).sort();
  }, [casos]);

  // Filtrado y ordenamiento de casos en tiempo real
  const casosFiltrados = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    const filtrados = casos.filter(c => {
      // 1. Filtro textual
      if (term) {
        const op = String(c.casoOp || '').toLowerCase();
        const vendor = String(c.vendorId || c.vendor_id || '').toLowerCase();
        const tienda = String(c.tienda || '').toLowerCase();
        const kam = String(c.kam || '').toLowerCase();
        const inte = String(c.integracion || '').toLowerCase();
        const ag = String(c.agente || c.propietarioTicket || c.propietarioOportunidad || '').toLowerCase();
        const opor = String(c.oportunidad || '').toLowerCase();
        const com = String(c.comentarios || '').toLowerCase();

        const match = op.includes(term) ||
          vendor.includes(term) ||
          tienda.includes(term) ||
          kam.includes(term) ||
          inte.includes(term) ||
          ag.includes(term) ||
          opor.includes(term) ||
          com.includes(term);

        if (!match) return false;
      }

      // 2. Filtro de estado
      if (filtroEstado !== 'todos') {
        const est = String(c.estado || '').toLowerCase().trim();
        const esCerrado = est.includes('cerrad') || est.includes('fallid') || est.includes('cancel');

        if (filtroEstado === 'activos') {
          if (esCerrado) return false;
        } else if (filtroEstado === 'enProgreso') {
          if (esCerrado || est.includes('sin oportunidad')) return false;
        } else if (filtroEstado === 'sinOportunidad') {
          if (!est.includes('sin oportunidad')) return false;
        } else if (filtroEstado === 'onbSat') {
          if (!est.includes('onb') || !est.includes('satisfactorio')) return false;
        } else if (filtroEstado === 'onbFall') {
          if (!est.includes('onb') || (!est.includes('fallido') && !est.includes('cancel'))) return false;
        } else if (filtroEstado === 'kamSat') {
          if (!est.includes('kam') || !est.includes('satisfactorio')) return false;
        } else if (filtroEstado === 'kamFall') {
          if (!est.includes('kam') || (!est.includes('fallido') && !est.includes('cancel'))) return false;
        } else if (filtroEstado === 'apiVendor') {
          if (!est.includes('api vendor') && !est.includes('vendor')) return false;
        }
      }

      // 3. Filtro de país
      if (filtroPais !== 'todos') {
        if (String(c.pais || '').toLowerCase() !== filtroPais.toLowerCase()) return false;
      }

      return true;
    });

    // 4. Ordenamiento por nombre de Tienda / Local (A-Z o Z-A)
    if (ordenTienda === 'asc') {
      return [...filtrados].sort((a, b) => 
        String(a.tienda || '').localeCompare(String(b.tienda || ''), 'es', { sensitivity: 'base' })
      );
    }
    if (ordenTienda === 'desc') {
      return [...filtrados].sort((a, b) => 
        String(b.tienda || '').localeCompare(String(a.tienda || ''), 'es', { sensitivity: 'base' })
      );
    }

    return filtrados;
  }, [casos, busqueda, filtroEstado, filtroPais, ordenTienda]);

  // Paginación
  const totalPaginas = Math.max(1, Math.ceil(casosFiltrados.length / casosPorPagina));
  const paginaSegura = Math.min(paginaActual, totalPaginas);

  const casosPaginados = useMemo(() => {
    const inicio = (paginaSegura - 1) * casosPorPagina;
    return casosFiltrados.slice(inicio, inicio + casosPorPagina);
  }, [casosFiltrados, paginaSegura, casosPorPagina]);

  // Ejecutar eliminación confirmada
  const ejecutarEliminacion = async () => {
    if (!casoAEliminar || !onEliminarCaso) return;
    setEliminando(true);
    try {
      await onEliminarCaso(casoAEliminar);
      setCasoAEliminar(null);
    } catch (e) {
      console.error('Error al eliminar caso:', e);
    } finally {
      setEliminando(false);
    }
  };

  const cambiarFiltroEstado = (estadoId: string) => {
    setFiltroEstado(estadoId);
    setPaginaActual(1);
  };

  const toggleOrdenTienda = () => {
    setOrdenTienda(prev => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
    setPaginaActual(1);
  };

  // Descargar casos filtrados a Excel (.xlsx)
  const descargarExcel = () => {
    if (!casosFiltrados || casosFiltrados.length === 0) {
      if (mostrarNotificacion) {
        mostrarNotificacion('No hay casos con los filtros aplicados para descargar.', 'warning');
      } else {
        alert('No hay casos con los filtros aplicados para descargar.');
      }
      return;
    }

    const data = casosFiltrados.map((c, idx) => ({
      "N° Fila": c.filaNumero || idx + 1,
      "Caso OP": c.casoOp || '',
      "Vendor ID": c.vendorId || c.vendor_id || '',
      "Tienda": c.tienda || '',
      "País": c.pais || '',
      "Propietario Oportunidad": c.propietarioOportunidad || '',
      "KAM": c.kam || '',
      "Integración": c.integracion || '',
      "Oportunidad": c.oportunidad || '',
      "Asset": c.asset || '',
      "Agente / Ticket": c.propietarioTicket || c.agente || '',
      "Estado": c.estado || '',
      "Etapa": c.etapa || '',
      "Fecha Creación": c.fechaCreacion || '',
      "SLA Inicio": c.sla_inicio || '',
      "Horas SLA": c.horasSLA !== undefined && c.horasSLA !== null ? c.horasSLA : '',
      "Rango SLA": c.rangoSla || c.rangoSlaOp || '',
      "Caso Seguimiento": c.casoSeguimiento || '',
      "Comentarios": c.comentarios || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws['!cols'] = [
      { wch: 10 }, // N° Fila
      { wch: 16 }, // Caso OP
      { wch: 14 }, // Vendor ID
      { wch: 35 }, // Tienda
      { wch: 10 }, // País
      { wch: 28 }, // Propietario Oportunidad
      { wch: 28 }, // KAM
      { wch: 22 }, // Integración
      { wch: 22 }, // Oportunidad
      { wch: 16 }, // Asset
      { wch: 25 }, // Agente / Ticket
      { wch: 22 }, // Estado
      { wch: 28 }, // Etapa
      { wch: 18 }, // Fecha Creación
      { wch: 18 }, // SLA Inicio
      { wch: 12 }, // Horas SLA
      { wch: 16 }, // Rango SLA
      { wch: 25 }, // Caso Seguimiento
      { wch: 45 }  // Comentarios
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Casos Onboarding');

    const fecha = new Date().toISOString().slice(0, 10);
    const sufijoEstado = filtroEstado !== 'todos' ? `_${filtroEstado}` : '';
    const sufijoPais = filtroPais !== 'todos' ? `_${filtroPais}` : '';
    const filename = `Reporte_Onboarding${sufijoEstado}${sufijoPais}_${fecha}.xlsx`;

    XLSX.writeFile(wb, filename);

    if (mostrarNotificacion) {
      mostrarNotificacion(`Descargando ${casosFiltrados.length} casos en ${filename}`, 'success');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. Barra de Filtros por Estado (Píldoras idénticas a "Mis casos") */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Todos */}
        <button
          onClick={() => cambiarFiltroEstado('todos')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            filtroEstado === 'todos'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-500'
              : 'bg-[#151824] border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <span>📁 Todos los Casos</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${filtroEstado === 'todos' ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'}`}>
            {conteos.todos}
          </span>
        </button>

        {/* Todos los Activos */}
        <button
          onClick={() => cambiarFiltroEstado('activos')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            filtroEstado === 'activos'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-500'
              : 'bg-[#151824] border border-emerald-900/50 text-emerald-400 hover:bg-emerald-950/40'
          }`}
        >
          <span>🟢 Todos los Activos</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${filtroEstado === 'activos' ? 'bg-white/20 text-white' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'}`}>
            {conteos.activos}
          </span>
        </button>

        {/* En Progreso */}
        <button
          onClick={() => cambiarFiltroEstado('enProgreso')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            filtroEstado === 'enProgreso'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40 border border-cyan-500'
              : 'bg-[#151824] border border-cyan-900/50 text-cyan-400 hover:bg-cyan-950/40'
          }`}
        >
          <span>💼 En Progreso</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${filtroEstado === 'enProgreso' ? 'bg-white/20 text-white' : 'bg-cyan-950 text-cyan-400 border border-cyan-800/60'}`}>
            {conteos.enProgreso}
          </span>
        </button>

        {/* Sin Oportunidad */}
        <button
          onClick={() => cambiarFiltroEstado('sinOportunidad')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            filtroEstado === 'sinOportunidad'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 border border-purple-500'
              : 'bg-[#151824] border border-purple-900/50 text-purple-400 hover:bg-purple-950/40'
          }`}
        >
          <span>⚡ Sin Oportunidad</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${filtroEstado === 'sinOportunidad' ? 'bg-white/20 text-white' : 'bg-purple-950 text-purple-400 border border-purple-800/60'}`}>
            {conteos.sinOportunidad}
          </span>
        </button>

        {/* ONB Satisfactorio */}
        <button
          onClick={() => cambiarFiltroEstado('onbSat')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            filtroEstado === 'onbSat'
              ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/40 border border-fuchsia-500'
              : 'bg-[#151824] border border-fuchsia-900/40 text-fuchsia-400 hover:bg-fuchsia-950/30'
          }`}
        >
          <span>🟣 ONB (Satisfactorio)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${filtroEstado === 'onbSat' ? 'bg-white/20 text-white' : 'bg-fuchsia-950 text-fuchsia-400 border border-fuchsia-800/60'}`}>
            {conteos.onbSat}
          </span>
        </button>

        {/* ONB Fallido */}
        <button
          onClick={() => cambiarFiltroEstado('onbFall')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            filtroEstado === 'onbFall'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40 border border-rose-500'
              : 'bg-[#151824] border border-rose-900/40 text-rose-400 hover:bg-rose-950/30'
          }`}
        >
          <span>🔴 ONB (Fallido)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${filtroEstado === 'onbFall' ? 'bg-white/20 text-white' : 'bg-rose-950 text-rose-400 border border-rose-800/60'}`}>
            {conteos.onbFall}
          </span>
        </button>

        {/* KAM Satisfactorio */}
        <button
          onClick={() => cambiarFiltroEstado('kamSat')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            filtroEstado === 'kamSat'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 border border-indigo-500'
              : 'bg-[#151824] border border-indigo-900/40 text-indigo-400 hover:bg-indigo-950/30'
          }`}
        >
          <span>🔵 KAM (Satisfactorio)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${filtroEstado === 'kamSat' ? 'bg-white/20 text-white' : 'bg-indigo-950 text-indigo-400 border border-indigo-800/60'}`}>
            {conteos.kamSat}
          </span>
        </button>

        {/* KAM Fallido */}
        <button
          onClick={() => cambiarFiltroEstado('kamFall')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            filtroEstado === 'kamFall'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40 border border-amber-500'
              : 'bg-[#151824] border border-amber-900/40 text-amber-400 hover:bg-amber-950/30'
          }`}
        >
          <span>🟠 KAM (Fallido)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${filtroEstado === 'kamFall' ? 'bg-white/20 text-white' : 'bg-amber-950 text-amber-400 border border-amber-800/60'}`}>
            {conteos.kamFall}
          </span>
        </button>

        {/* API Vendor */}
        <button
          onClick={() => cambiarFiltroEstado('apiVendor')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            filtroEstado === 'apiVendor'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40 border border-sky-500'
              : 'bg-[#151824] border border-sky-900/40 text-sky-400 hover:bg-sky-950/30'
          }`}
        >
          <span>💻 API Vendor</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${filtroEstado === 'apiVendor' ? 'bg-white/20 text-white' : 'bg-sky-950 text-sky-400 border border-sky-800/60'}`}>
            {conteos.apiVendor}
          </span>
        </button>
      </div>

      {/* 2. Barra de Búsqueda y Selector de País / Paginación */}
      <div className="bg-[#151824] border border-gray-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Input de Búsqueda */}
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por Caso OP, Vendor, Tienda, Agente, Integración..."
              className="w-full bg-[#0f111a] border border-gray-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros Complementarios */}
          <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
            {/* Filtro País */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">País:</span>
              <select
                value={filtroPais}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setFiltroPais(e.target.value);
                  setPaginaActual(1);
                }}
                className="bg-[#0f111a] border border-gray-800 text-gray-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-pink-500"
              >
                <option value="todos">Todos los Países ({listaPaises.length})</option>
                {listaPaises.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Cantidad por página */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">Mostrar:</span>
              <select
                value={casosPorPagina}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setCasosPorPagina(Number(e.target.value));
                  setPaginaActual(1);
                }}
                className="bg-[#0f111a] border border-gray-800 text-gray-300 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-pink-500"
              >
                <option value={25}>25 por pág.</option>
                <option value={50}>50 por pág.</option>
                <option value={100}>100 por pág.</option>
              </select>
            </div>

            {/* Botón Ordenar Locales A-Z / Z-A */}
            <button
              onClick={toggleOrdenTienda}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                ordenTienda !== 'none'
                  ? 'bg-pink-600/30 text-pink-300 border-pink-500 shadow-sm'
                  : 'bg-[#0f111a] border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
              title="Ordenar locales alfabéticamente A-Z o Z-A"
            >
              <span>🔤</span>
              <span>{ordenTienda === 'asc' ? 'Tienda: A - Z 🔼' : ordenTienda === 'desc' ? 'Tienda: Z - A 🔽' : 'Ordenar A - Z'}</span>
            </button>

            {/* Botón Descargar Excel según filtros actuales */}
            <button
              onClick={descargarExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-950/50 cursor-pointer"
              title="Descargar los casos filtrados en formato Excel (.xlsx)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              <span>Descargar ({casosFiltrados.length})</span>
            </button>
          </div>
        </div>

        {/* Resumen de resultados */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800/80">
          <div>
            Mostrando <strong className="text-white">{casosPaginados.length}</strong> de <strong className="text-pink-400">{casosFiltrados.length}</strong> casos filtrados (<span className="text-gray-300 font-mono">{casos.length}</span> casos totales registrados en Onboarding)
          </div>
          <div className="flex items-center gap-2">
            <span>Página <strong className="text-white">{paginaSegura}</strong> de <strong className="text-white">{totalPaginas}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Tabla Reducida de Casos Totales (Ancho completo) */}
      <div className="bg-[#151824] border border-gray-800 rounded-2xl overflow-hidden shadow-xl w-full">
        {cargando && (
          <div className="bg-emerald-950/60 border-b border-emerald-800/70 px-4 py-2.5 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2.5 text-xs text-emerald-300 font-semibold">
              <span className="animate-spin text-sm">🔄</span>
              <span>Sincronizando casos en vivo desde Google Sheets (Onboarding_New)...</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono">Actualizando tabla...</span>
          </div>
        )}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800 text-gray-400 uppercase font-mono text-[10px] tracking-wider whitespace-nowrap">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3 min-w-[110px]">Caso OP</th>
                <th className="py-3 px-3 min-w-[100px]">Vendor ID</th>
                <th 
                  onClick={toggleOrdenTienda}
                  className="py-3 px-4 min-w-[200px] cursor-pointer hover:text-pink-400 select-none transition"
                  title="Clic para ordenar locales de A-Z o Z-A"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Tienda</span>
                    <span className="text-xs">
                      {ordenTienda === 'asc' ? '🔼 (A-Z)' : ordenTienda === 'desc' ? '🔽 (Z-A)' : '↕️'}
                    </span>
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[90px]">País</th>
                <th className="py-3 px-3 min-w-[150px]">Propietario Oportunidad</th>
                <th className="py-3 px-3 min-w-[130px]">Integración</th>
                <th className="py-3 px-3 min-w-[140px]">Oportunidad</th>
                <th className="py-3 px-3 min-w-[140px]">Agente / Ticket</th>
                <th className="py-3 px-3 min-w-[150px]">Estado</th>
                <th className="py-3 px-3 min-w-[150px]">Etapa</th>
                <th className="py-3 px-4 min-w-[160px] text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/80">
              {casosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-500">
                    No se encontraron casos con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                casosPaginados.map((c, idx) => {
                  const estLower = String(c.estado || '').toLowerCase();
                  const esCerrado = estLower.includes('cerrad') || estLower.includes('fallid') || estLower.includes('cancel');
                  const filaNumeroVisual = c.filaNumero || ((paginaSegura - 1) * casosPorPagina + idx + 1);

                  return (
                    <tr
                      key={c.id || c.casoOp || idx}
                      className="hover:bg-gray-800/50 transition group"
                    >
                      {/* # / Fila */}
                      <td className="py-2.5 px-3 text-center text-gray-500 font-mono text-[11px]">
                        {filaNumeroVisual}
                      </td>

                      {/* Caso OP */}
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">
                        <button
                          onClick={() => onEditarCaso && onEditarCaso(c)}
                          className="hover:underline hover:text-cyan-300 text-left cursor-pointer"
                          title="Clic para ampliar y ver todos los datos del caso"
                        >
                          {c.casoOp || 'S/OP'}
                        </button>
                      </td>

                      {/* Vendor ID */}
                      <td className="py-2.5 px-3 font-mono text-gray-300">
                        {c.vendorId || c.vendor_id || '-'}
                      </td>

                      {/* Tienda */}
                      <td className="py-2.5 px-4 font-semibold text-white max-w-[220px] truncate" title={c.tienda}>
                        {c.tienda || '-'}
                      </td>

                      {/* País */}
                      <td className="py-2.5 px-3 text-gray-300">
                        <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-gray-300 font-medium whitespace-nowrap">
                          {c.pais || '-'}
                        </span>
                      </td>

                      {/* Propietario Oportunidad */}
                      <td className="py-2.5 px-3 text-gray-300 max-w-[160px] truncate" title={c.propietarioOportunidad}>
                        {c.propietarioOportunidad || '-'}
                      </td>

                      {/* Integración */}
                      <td className="py-2.5 px-3 text-gray-300 max-w-[140px] truncate" title={c.integracion}>
                        {c.integracion || '-'}
                      </td>

                      {/* Oportunidad */}
                      <td className="py-2.5 px-3 text-gray-400 max-w-[140px] truncate" title={c.oportunidad}>
                        {c.oportunidad || '-'}
                      </td>

                      {/* Agente / Ticket */}
                      <td className="py-2.5 px-3 text-gray-300 max-w-[150px] truncate" title={c.propietarioTicket || c.agente}>
                        {c.propietarioTicket || c.agente || '-'}
                      </td>

                      {/* Estado */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            !esCerrado
                              ? estLower.includes('sin oportunidad')
                                ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80'
                                : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                              : estLower.includes('satisfactorio')
                                ? 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-800/80'
                                : 'bg-gray-800/90 text-gray-300 border border-gray-700'
                          }`}
                        >
                          {c.estado || 'En progreso'}
                        </span>
                      </td>

                      {/* Etapa */}
                      <td className="py-2.5 px-3 text-gray-400 text-[11px] max-w-[160px] truncate" title={c.etapa}>
                        {c.etapa || '-'}
                      </td>

                      {/* Acciones: Editar (Ampliar) y Eliminar */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {/* Botón Editar / Ampliar */}
                          <button
                            onClick={() => onEditarCaso && onEditarCaso(c)}
                            className="bg-pink-600/20 hover:bg-pink-600 text-pink-300 hover:text-white border border-pink-500/40 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Ampliar y editar datos completos del caso"
                          >
                            <span>✏️</span>
                            <span>Editar</span>
                          </button>

                          {/* Botón Eliminar */}
                          <button
                            onClick={() => setCasoAEliminar(c)}
                            className="bg-rose-950/60 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-800/60 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Eliminar caso en Sheets y Firebase"
                          >
                            <span>🗑️</span>
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Paginación Inferior */}
        {totalPaginas > 1 && (
          <div className="p-3.5 bg-gray-900/60 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-gray-400">
              Página <strong className="text-white">{paginaSegura}</strong> de <strong className="text-white">{totalPaginas}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPaginaActual(1)}
                disabled={paginaSegura === 1}
                className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs cursor-pointer"
              >
                « Primero
              </button>
              <button
                onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
                disabled={paginaSegura === 1}
                className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs cursor-pointer"
              >
                ◀ Anterior
              </button>
              <span className="px-3 py-1 bg-pink-600 text-white font-bold rounded-lg text-xs">
                {paginaSegura}
              </span>
              <button
                onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
                disabled={paginaSegura === totalPaginas}
                className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs cursor-pointer"
              >
                Siguiente ▶
              </button>
              <button
                onClick={() => setPaginaActual(totalPaginas)}
                disabled={paginaSegura === totalPaginas}
                className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs cursor-pointer"
              >
                Último »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmación para Eliminar Caso */}
      {casoAEliminar && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#161925] border border-rose-500/60 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-rose-950/40 relative">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-xl shrink-0">
                ⚠️
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">¿Eliminar caso definitivamente?</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Esta acción eliminará el registro de forma permanente tanto en <strong className="text-emerald-400">Google Sheets (hoja Onboarding_New)</strong> como en <strong className="text-pink-400">Firebase Firestore</strong>.
                </p>

                {/* Resumen del caso a eliminar */}
                <div className="mt-3.5 bg-[#0f111a] border border-gray-800 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Caso OP:</span>
                    <span className="font-mono font-bold text-cyan-400">{casoAEliminar.casoOp || 'S/OP'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vendor ID:</span>
                    <span className="font-mono text-gray-300">{casoAEliminar.vendorId || casoAEliminar.vendor_id || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tienda:</span>
                    <span className="font-semibold text-white truncate max-w-[200px]">{casoAEliminar.tienda || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">País / Integración:</span>
                    <span className="text-gray-300">{casoAEliminar.pais || '-'} • {casoAEliminar.integracion || '-'}</span>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="mt-5 flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setCasoAEliminar(null)}
                    disabled={eliminando}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={ejecutarEliminacion}
                    disabled={eliminando}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-900/40 cursor-pointer disabled:opacity-50"
                  >
                    <span>{eliminando ? 'Eliminando...' : '🗑️ Sí, eliminar caso'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
