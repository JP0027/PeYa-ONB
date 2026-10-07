import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { obtenerTextoCasoOp } from '../../utils/onboardingRules';

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
  const [filtroAsset, setFiltroAsset] = useState<string>('todos');
  const [filtroAnio, setFiltroAnio] = useState<string>('todos');
  const [filtroMes, setFiltroMes] = useState<string>('todos');
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [casosPorPagina, setCasosPorPagina] = useState<number>(10);

  // Ordenamiento global de columnas
  type ColumnaOrden = 'num' | 'casoOp' | 'vendorId' | 'tienda' | 'pais' | 'propietarioOp' | 'integracion' | 'oportunidad' | 'estado' | 'etapa' | 'seguimiento' | null;
  type DireccionOrden = 'asc' | 'desc';

  const [columnaOrden, setColumnaOrden] = useState<ColumnaOrden>(null);
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('asc');

  const handleOrdenar = (col: ColumnaOrden) => {
    if (columnaOrden === col) {
      if (direccionOrden === 'asc') {
        setDireccionOrden('desc');
      } else {
        setColumnaOrden(null);
        setDireccionOrden('asc');
      }
    } else {
      setColumnaOrden(col);
      setDireccionOrden('asc');
    }
    setPaginaActual(1);
  };

  // Anchos de columnas ajustables (sin columna agente y acciones reducida para ahorrar espacio)
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    num: 50,
    casoOp: 130,
    vendorId: 110,
    tienda: 230,
    pais: 100,
    propietarioOp: 170,
    integracion: 140,
    oportunidad: 150,
    estado: 160,
    etapa: 180,
    seguimiento: 120,
    acciones: 80
  });

  const iniciarRedimensionar = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 120;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nuevoAncho = Math.max(50, startWidth + (moveEvent.clientX - startX));
      setColWidths(prev => ({ ...prev, [colKey]: nuevoAncho }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Estado para el modal de confirmación de eliminación
  const [casoAEliminar, setCasoAEliminar] = useState<any | null>(null);
  const [eliminando, setEliminando] = useState<boolean>(false);

  // Helper para extraer Año y Mes (01-12)
  const parseFecha = (fechaStr: string) => {
    if (!fechaStr || fechaStr === '-' || fechaStr === 'S/V') return null;
    // Asume formato DD/MM/YYYY o similar (e.g. 15/08/2024, 10:30)
    // Extraer AAAA y MM si es posible.
    const regex = /(\d{2})\/(\d{2})\/(\d{4})/;
    const match = fechaStr.match(regex);
    if (match) {
      return { mes: match[2], anio: match[3] };
    }
    // Formato YYYY-MM-DD
    const regexISO = /(\d{4})-(\d{2})-(\d{2})/;
    const matchISO = fechaStr.match(regexISO);
    if (matchISO) {
      return { anio: matchISO[1], mes: matchISO[2] };
    }
    return null;
  };

  // Listas únicas de años y meses
  const listasFecha = useMemo(() => {
    const anios = new Set<string>();
    const meses = new Set<string>();
    casos.forEach(c => {
      const p = parseFecha(c.fechaCreacion || '');
      if (p) {
        anios.add(p.anio);
        meses.add(p.mes);
      }
    });
    return {
      anios: Array.from(anios).sort((a, b) => b.localeCompare(a)), // Más recientes primero
      meses: Array.from(meses).sort()
    };
  }, [casos]);

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
  
  // Lista única de assets para el selector de filtro
  const listaAssets = useMemo(() => {
    const setA = new Set<string>();
    casos.forEach(c => {
      if (c.asset && c.asset !== '-' && c.asset !== 'S/V') {
        setA.add(c.asset.trim());
      }
    });
    return Array.from(setA).sort();
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
      
      // 4. Filtro de asset
      if (filtroAsset !== 'todos') {
        if (String(c.asset || '').toLowerCase() !== filtroAsset.toLowerCase()) return false;
      }

      // 5. Filtro de Año
      const p = parseFecha(c.fechaCreacion || '');
      if (filtroAnio !== 'todos') {
        if (!p || p.anio !== filtroAnio) return false;
      }
      
      // 6. Filtro de Mes
      if (filtroMes !== 'todos') {
        if (!p || p.mes !== filtroMes) return false;
      }

      return true;
    });

    // 4. Ordenamiento global por cualquier columna
    if (columnaOrden) {
      filtrados.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (columnaOrden) {
          case 'num':
            valA = a.filaNumero || 0;
            valB = b.filaNumero || 0;
            return direccionOrden === 'asc' ? valA - valB : valB - valA;
          case 'casoOp':
            valA = String(a.casoOp || '').trim();
            valB = String(b.casoOp || '').trim();
            break;
          case 'vendorId':
            valA = String(a.vendorId || a.vendor_id || '').trim();
            valB = String(b.vendorId || b.vendor_id || '').trim();
            break;
          case 'tienda':
            valA = String(a.tienda || '').trim();
            valB = String(b.tienda || '').trim();
            break;
          case 'pais':
            valA = String(a.pais || '').trim();
            valB = String(b.pais || '').trim();
            break;
          case 'propietarioOp':
            valA = String(a.propietarioOportunidad || '').trim();
            valB = String(b.propietarioOportunidad || '').trim();
            break;
          case 'integracion':
            valA = String(a.integracion || '').trim();
            valB = String(b.integracion || '').trim();
            break;
          case 'oportunidad':
            valA = String(a.oportunidad || '').trim();
            valB = String(b.oportunidad || '').trim();
            break;
          case 'estado':
            valA = String(a.estado || '').trim();
            valB = String(b.estado || '').trim();
            break;
          case 'etapa':
            valA = String(a.etapa || '').trim();
            valB = String(b.etapa || '').trim();
            break;
        }

        const cmp = String(valA).localeCompare(String(valB), 'es', { numeric: true, sensitivity: 'base' });
        return direccionOrden === 'asc' ? cmp : -cmp;
      });
    }

    return filtrados;
  }, [casos, busqueda, filtroEstado, filtroPais, columnaOrden, direccionOrden]);

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
    const caso = casoAEliminar;
    setCasoAEliminar(null);
    setEliminando(true);
    try {
      await onEliminarCaso(caso);
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

  // Descargar casos filtrados a Excel (.xlsx) con N° Caso Seguimiento en columna oficial
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
      "Caso OP": obtenerTextoCasoOp(c),
      "Vendor ID": c.vendorId || c.vendor_id || '',
      "Tienda": c.tienda || '',
      "País": c.pais || '',
      "Propietario Oportunidad": c.propietarioOportunidad || '',
      "KAM": c.kam || '',
      "Integración": c.integracion || '',
      "Oportunidad": c.oportunidad || '',
      "Asset": c.asset || '',
      "N° Caso Seguimiento": c.casoSeguimiento || '',
      "Estado": c.estado || '',
      "Etapa": c.etapa || '',
      "Fecha Creación": c.fechaCreacion || '',
      "SLA Inicio": c.sla_inicio || '',
      "Horas SLA": c.horasSLA !== undefined && c.horasSLA !== null ? c.horasSLA : '',
      "Rango SLA": c.rangoSla || c.rangoSlaOp || '',
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
      { wch: 36 }, // N° Caso Seguimiento
      { wch: 22 }, // Estado
      { wch: 28 }, // Etapa
      { wch: 18 }, // Fecha Creación
      { wch: 18 }, // SLA Inicio
      { wch: 12 }, // Horas SLA
      { wch: 16 }, // Rango SLA
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

  const renderHeader = (colKey: ColumnaOrden, titulo: string, anchoKey: string, alinear: 'left' | 'center' = 'left') => {
    const activo = columnaOrden === colKey;
    return (
      <th 
        onClick={() => handleOrdenar(colKey)}
        style={{ width: colWidths[anchoKey], minWidth: colWidths[anchoKey] }} 
        className={`py-3 px-3 relative select-none cursor-pointer hover:text-[#F46C8E] transition ${alinear === 'center' ? 'text-center' : 'text-left'} ${activo ? 'text-[#F46C8E] font-bold' : ''}`}
        title={`Clic para ordenar por ${titulo}`}
      >
        <div className={`flex items-center gap-1 ${alinear === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{titulo}</span>
          <span className="text-[10px] opacity-80 font-sans">
            {activo ? (direccionOrden === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </div>
        <div 
          onMouseDown={(e) => iniciarRedimensionar(anchoKey, e)} 
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E]/60 select-none" 
        />
      </th>
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Barra de Búsqueda y Selectores de Estado, País y Paginación */}
      <div className="bg-[#1A1A1C] border border-[#3A3A3E] rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Input de Búsqueda */}
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#9CA3AF] pointer-events-none">
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
              className="w-full bg-[#121212] border border-[#3A3A3E] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E85A80] transition"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[#B3B3B3] hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros Complementarios en Selectores */}
          <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
            {/* Filtro Estado del Caso */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#B3B3B3]">Estado:</span>
              <select
                value={filtroEstado}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setFiltroEstado(e.target.value);
                  setPaginaActual(1);
                }}
                className="bg-[#121212] border border-[#3A3A3E] text-[#D1D5DB] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#E85A80] font-semibold cursor-pointer"
              >
                <option value="todos">Todos los Estados ({conteos.todos})</option>
                <option value="activos">Todos los Activos ({conteos.activos})</option>
                <option value="enProgreso">En Progreso ({conteos.enProgreso})</option>
                <option value="sinOportunidad">Sin Oportunidad ({conteos.sinOportunidad})</option>
                <option value="onbSat">ONB (Satisfactorio) ({conteos.onbSat})</option>
                <option value="onbFall">ONB (Fallido) ({conteos.onbFall})</option>
                <option value="kamSat">KAM (Satisfactorio) ({conteos.kamSat})</option>
                <option value="kamFall">KAM (Fallido) ({conteos.kamFall})</option>
                <option value="apiVendor">API Vendor ({conteos.apiVendor})</option>
              </select>
            </div>

            {/* Filtro País */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#B3B3B3]">País:</span>
              <select
                value={filtroPais}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setFiltroPais(e.target.value);
                  setPaginaActual(1);
                }}
                className="bg-[#121212] border border-[#3A3A3E] text-[#D1D5DB] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#E85A80] cursor-pointer"
              >
                <option value="todos">Todos los Países ({listaPaises.length})</option>
                {listaPaises.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Filtro Asset */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#B3B3B3]">Asset:</span>
              <select
                value={filtroAsset}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setFiltroAsset(e.target.value);
                  setPaginaActual(1);
                }}
                className="bg-[#121212] border border-[#3A3A3E] text-[#D1D5DB] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#E85A80] cursor-pointer"
              >
                <option value="todos">Todos los Assets ({listaAssets.length})</option>
                {listaAssets.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Filtro Año */}
            {listasFecha.anios.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#B3B3B3]">Año:</span>
                <select
                  value={filtroAnio}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setFiltroAnio(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="bg-[#121212] border border-[#3A3A3E] text-[#D1D5DB] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#E85A80] cursor-pointer"
                >
                  <option value="todos">Todos</option>
                  {listasFecha.anios.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro Mes */}
            {listasFecha.meses.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#B3B3B3]">Mes:</span>
                <select
                  value={filtroMes}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setFiltroMes(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="bg-[#121212] border border-[#3A3A3E] text-[#D1D5DB] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#E85A80] cursor-pointer"
                >
                  <option value="todos">Todos</option>
                  {listasFecha.meses.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Botón Descargar Excel según filtros actuales */}
            <button
              onClick={descargarExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-sm transition flex items-center gap-1.5 shadow-md shadow-emerald-950/50 cursor-pointer"
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
        <div className="flex items-center justify-between text-xs text-[#B3B3B3] pt-2 border-t border-[#3A3A3E]/80">
          <div className="flex items-center">
            <div>
              Mostrando <strong className="text-white">{casosPaginados.length}</strong> de <strong className="text-[#F46C8E]">{casosFiltrados.length}</strong> casos filtrados (<span className="text-[#D1D5DB] font-mono">{casos.length}</span> casos totales registrados en Onboarding)
            </div>
            {/* Cantidad por página: 10, 15, 20 */}
            <div className="flex items-center gap-1.5 ml-4">
              <span className="text-[11px] text-[#B3B3B3]">Mostrar:</span>
              <select
                value={casosPorPagina}
                onChange={(e) => {
                  setCasosPorPagina(Number(e.target.value));
                  setPaginaActual(1);
                }}
                className="bg-[#121212] border border-[#3A3A3E] text-[#D1D5DB] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#E85A80] cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span>Página <strong className="text-white">{paginaSegura}</strong> de <strong className="text-white">{totalPaginas}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Tabla Reducida de Casos Totales (Ancho completo) */}
      <div className="bg-[#1A1A1C] border border-[#3A3A3E] rounded-2xl overflow-hidden shadow-xl w-full">
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
              <tr className="bg-[#202024]/80 border-b border-[#3A3A3E] text-[#B3B3B3] uppercase font-mono text-[10px] tracking-wider whitespace-nowrap">
                {renderHeader('num', '#', 'num', 'center')}
                {renderHeader('casoOp', 'Caso OP', 'casoOp')}
                {renderHeader('vendorId', 'Vendor ID', 'vendorId')}
                {renderHeader('tienda', 'Tienda', 'tienda')}
                {renderHeader('pais', 'País', 'pais')}
                {renderHeader('propietarioOp', 'Propietario Oportunidad', 'propietarioOp')}
                {renderHeader('integracion', 'Integración', 'integracion')}
                {renderHeader('oportunidad', 'Oportunidad', 'oportunidad')}
                {renderHeader('estado', 'Estado', 'estado')}
                {renderHeader('etapa', 'Etapa', 'etapa')}
                {renderHeader('seguimiento', 'N° Seguimiento', 'seguimiento')}
                <th style={{ width: colWidths.acciones, minWidth: colWidths.acciones }} className="py-3 px-2 text-center relative select-none">
                  Acciones
                  <div 
                    onMouseDown={(e) => iniciarRedimensionar('acciones', e)} 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#F46C8E]/60 select-none" 
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/80">
              {casosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-42 text-center text-[#9CA3AF]">
                    No se encontraron casos con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                casosPaginados.map((c, idx) => {
                  const estLower = String(c.estado || '').toLowerCase();
                  const esCerrado = estLower.includes('cerrad') || estLower.includes('fallid') || estLower.includes('cancel');
                  const filaNumeroVisual = c.filaNumero || ((paginaSegura - 1) * casosPorPagina + idx + 1);
                  const textoOp = obtenerTextoCasoOp(c);

                  return (
                    <tr
                      key={c.id || c.casoOp || idx}
                      className="hover:bg-[#2C2C32]/50 transition group"
                    >
                      {/* # / Fila */}
                      <td className="py-4 px-3 text-center text-[#9CA3AF] font-mono text-[11px]">
                        {filaNumeroVisual}
                      </td>

                      {/* Caso OP */}
                      <td className="py-4 px-3 font-mono font-bold">
                        <button
                          onClick={() => onEditarCaso && onEditarCaso(c)}
                          className={`hover:underline text-left cursor-pointer ${
                            textoOp === 'Sin caso OP'
                              ? 'text-[#9CA3AF] italic'
                              : 'text-cyan-400 hover:text-cyan-300'
                          }`}
                          title="Clic para ampliar y ver todos los datos del caso"
                        >
                          {textoOp}
                        </button>
                      </td>

                      {/* Vendor ID */}
                      <td className="py-4 px-3 font-mono text-[#D1D5DB]">
                        {c.vendorId || c.vendor_id || '-'}
                      </td>

                      {/* Tienda */}
                      <td className="py-4 px-4 font-semibold text-white max-w-[220px] truncate" title={c.tienda}>
                        {c.tienda || '-'}
                      </td>

                      {/* País */}
                      <td className="py-4 px-3 text-[#D1D5DB]">
                        <span className="px-1.5 py-0.5 rounded bg-[#2C2C32] text-[10px] text-[#D1D5DB] font-medium whitespace-nowrap">
                          {c.pais || '-'}
                        </span>
                      </td>

                      {/* Propietario Oportunidad */}
                      <td className="py-4 px-3 text-[#D1D5DB] max-w-[160px] truncate" title={c.propietarioOportunidad}>
                        {c.propietarioOportunidad || '-'}
                      </td>

                      {/* Integración */}
                      <td className="py-4 px-3 text-[#D1D5DB] max-w-[140px] truncate" title={c.integracion}>
                        {c.integracion || '-'}
                      </td>

                      {/* Oportunidad */}
                      <td className="py-4 px-3 text-[#B3B3B3] max-w-[140px] truncate" title={c.oportunidad}>
                        {c.oportunidad || '-'}
                      </td>

                      {/* Estado */}
                      <td className="py-4 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            !esCerrado
                              ? estLower.includes('sin oportunidad')
                                ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80'
                                : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                              : estLower.includes('satisfactorio')
                                ? 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-800/80'
                                : 'bg-[#2C2C32]/90 text-[#D1D5DB] border border-[#3A3A3E]'
                          }`}
                        >
                          {c.estado || 'En progreso'}
                        </span>
                      </td>

                      {/* Etapa */}
                      <td className="py-4 px-3 text-[#B3B3B3] text-[11px] max-w-[160px] truncate" title={c.etapa}>
                        {c.etapa || '-'}
                      </td>

                      {/* Seguimiento */}
                      <td className="py-4 px-3 font-mono text-[#D1D5DB] text-[11px] max-w-[140px] truncate" title={c.casoSeguimiento}>
                        {c.casoSeguimiento && c.casoSeguimiento !== '-' ? c.casoSeguimiento : <span className="text-[#9CA3AF] italic">S/N</span>}
                      </td>

                      {/* Acciones: Solo iconos para ahorrar espacio */}
                      <td className="py-4 px-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botón Editar / Ampliar (Solo icono) */}
                          <button
                            onClick={() => onEditarCaso && onEditarCaso(c)}
                            className="p-1.5 bg-[#E85A80]/20 hover:bg-[#E85A80] text-pink-300 hover:text-white border border-[#E85A80]/40 rounded-lg transition flex items-center justify-center cursor-pointer shadow-sm hover:scale-110"
                            title="Editar / Ampliar datos del caso"
                            aria-label="Editar caso"
                          >
                            <span className="text-xs">✏️</span>
                          </button>

                          {/* Botón Eliminar (Solo icono) */}
                          <button
                            onClick={() => setCasoAEliminar(c)}
                            className="p-1.5 bg-rose-950/60 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-800/60 rounded-lg transition flex items-center justify-center cursor-pointer shadow-sm hover:scale-110"
                            title="Eliminar caso en Sheets y Firebase"
                            aria-label="Eliminar caso"
                          >
                            <span className="text-xs">🗑️</span>
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
          <div className="p-3.5 bg-[#202024]/60 border-t border-[#3A3A3E] flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-[#B3B3B3]">
              Página <strong className="text-white">{paginaSegura}</strong> de <strong className="text-white">{totalPaginas}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPaginaActual(1)}
                disabled={paginaSegura === 1}
                className="px-2.5 py-1 rounded-lg bg-[#2C2C32] text-[#D1D5DB] hover:bg-[#3A3A3E] disabled:opacity-30 disabled:cursor-not-allowed transition text-xs cursor-pointer"
              >
                « Primero
              </button>
              <button
                onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
                disabled={paginaSegura === 1}
                className="px-2.5 py-1 rounded-lg bg-[#2C2C32] text-[#D1D5DB] hover:bg-[#3A3A3E] disabled:opacity-30 disabled:cursor-not-allowed transition text-xs cursor-pointer"
              >
                ◀ Anterior
              </button>
              <span className="px-3 py-1 bg-[#E85A80] text-white font-bold rounded-lg text-xs">
                {paginaSegura}
              </span>
              <button
                onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
                disabled={paginaSegura === totalPaginas}
                className="px-2.5 py-1 rounded-lg bg-[#2C2C32] text-[#D1D5DB] hover:bg-[#3A3A3E] disabled:opacity-30 disabled:cursor-not-allowed transition text-xs cursor-pointer"
              >
                Siguiente ▶
              </button>
              <button
                onClick={() => setPaginaActual(totalPaginas)}
                disabled={paginaSegura === totalPaginas}
                className="px-2.5 py-1 rounded-lg bg-[#2C2C32] text-[#D1D5DB] hover:bg-[#3A3A3E] disabled:opacity-30 disabled:cursor-not-allowed transition text-xs cursor-pointer"
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
          <div className="bg-[#202024] border border-rose-500/60 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-rose-950/40 relative">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-xl shrink-0">
                ⚠️
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">¿Eliminar caso definitivamente?</h3>
                <p className="text-xs text-[#B3B3B3] mt-1 leading-relaxed">
                  Esta acción eliminará el registro de forma permanente tanto en <strong className="text-emerald-400">Google Sheets (hoja Onboarding_New)</strong> como en <strong className="text-[#F46C8E]">Firebase Firestore</strong>.
                </p>

                {/* Resumen del caso a eliminar */}
                <div className="mt-3.5 bg-[#121212] border border-[#3A3A3E] rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Caso OP:</span>
                    <span className="font-mono font-bold text-cyan-400">{casoAEliminar.casoOp || 'S/OP'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Vendor ID:</span>
                    <span className="font-mono text-[#D1D5DB]">{casoAEliminar.vendorId || casoAEliminar.vendor_id || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Tienda:</span>
                    <span className="font-semibold text-white truncate max-w-[200px]">{casoAEliminar.tienda || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">País / Integración:</span>
                    <span className="text-[#D1D5DB]">{casoAEliminar.pais || '-'} • {casoAEliminar.integracion || '-'}</span>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="mt-5 flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setCasoAEliminar(null)}
                    disabled={eliminando}
                    className="px-4 py-2 rounded-xl bg-[#2C2C32] hover:bg-[#3A3A3E] text-[#D1D5DB] text-xs font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={ejecutarEliminacion}
                    disabled={eliminando}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-900/40 cursor-pointer disabled:opacity-50"
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
